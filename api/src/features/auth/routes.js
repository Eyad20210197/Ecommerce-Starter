import { Router } from 'express';
import { z } from 'zod';
import { validate, requireThat } from '../../shared/errors.js';
import { hashPassword, verifyPassword, token } from '../../shared/security.js';
import { requireUser, rateLimit } from './middleware.js';

export const addressSchema = z.object({
  name: z.string().trim().min(2).max(100), phone: z.string().trim().min(6).max(30),
  line1: z.string().trim().min(3).max(160), line2: z.string().trim().max(160).default(''),
  city: z.string().trim().min(2).max(80), region: z.string().trim().max(80).default(''),
  postalCode: z.string().trim().max(20).default(''), country: z.string().regex(/^[A-Z]{2}$/),
}).strict();
const credentials = z.object({ email: z.email().max(254).transform(value => value.toLowerCase().trim()), password: z.string().min(12).max(128) });
const profile = z.object({ name: z.string().trim().min(2).max(100), phone: z.string().trim().max(30).default('') }).strict();
export function authRoutes(store, config, auth) {
  const router = Router();
  const loginLimit = rateLimit(store, { scope: 'auth', limit: 20, seconds: 900 });
  const dummyHash = hashPassword(token());
  async function signIn(request, response, user, registration) {
    const oldSession = request.session;
    await store.tx(async transaction => {
      if (registration) {
        user = await store.one('INSERT INTO users(email,password_hash,name) VALUES($email,$hash,$name) ON CONFLICT(email) DO NOTHING RETURNING *', registration, transaction);
        requireThat(user, 409, 'ACCOUNT_EXISTS', 'Unable to create an account with that email.');
      } else {
        const current = await store.one('SELECT password_hash,active FROM users WHERE id=$id FOR UPDATE', { id: user.id }, transaction);
        requireThat(current?.active && current.password_hash === user.password_hash, 401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
      }
      if (oldSession) {
        await store.one('SELECT id FROM sessions WHERE id=$id FOR UPDATE', { id: oldSession.id }, transaction);
        const cart = await store.one('SELECT id FROM carts WHERE session_id=$id', { id: oldSession.id }, transaction);
        if (cart) {
          const target = await store.one('INSERT INTO carts(user_id) VALUES($user) ON CONFLICT(user_id) DO UPDATE SET updated_at=now() RETURNING id', { user: user.id }, transaction);
          await store.rows(`INSERT INTO cart_items(cart_id,product_id,quantity) SELECT $target,product_id,quantity FROM cart_items WHERE cart_id=$source
            ON CONFLICT(cart_id,product_id) DO UPDATE SET quantity=LEAST(100,cart_items.quantity+EXCLUDED.quantity) RETURNING product_id`, { target: target.id, source: cart.id }, transaction);
        }
        await store.rows('DELETE FROM sessions WHERE id=$id RETURNING id', { id: oldSession.id }, transaction);
      }
      await auth.issue(request, response, user.id, transaction);
      await store.audit(user.id, 'auth.sign_in', 'user', user.id, {}, transaction);
    });
    response.json({ user: { id: user.id, email: user.email, name: user.name, phone: user.phone, role: user.role }, csrfToken: request.session.csrf_token });
  }
  router.get('/session', rateLimit(store, { scope: 'session', limit: 60, seconds: 60 }), auth.ensureSession, (request, response) => response.json({ user: request.user || null, csrfToken: request.session.csrf_token }));
  router.post('/register', loginLimit, async (request, response) => {
    const data = validate(credentials.extend({ name: profile.shape.name }).strict(), request.body);
    const hash = await hashPassword(data.password);
    await signIn(request, response, null, { email: data.email, hash, name: data.name });
  });
  router.post('/login', loginLimit, async (request, response) => {
    const data = validate(credentials.strict(), request.body);
    const user = await store.one('SELECT * FROM users WHERE email=$email AND active=true', { email: data.email });
    const valid = await verifyPassword(data.password, user?.password_hash || await dummyHash);
    requireThat(user && valid, 401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
    await signIn(request, response, user);
  });
  router.post('/logout', async (request, response) => {
    if (request.session) await store.rows('DELETE FROM sessions WHERE id=$id RETURNING id', { id: request.session.id });
    response.clearCookie(auth.cookieName, { ...auth.cookieOptions, maxAge: undefined });
    response.status(204).end();
  });
  router.patch('/profile', requireUser, async (request, response) => {
    const data = validate(profile, request.body);
    const user = await store.one('UPDATE users SET name=$name,phone=$phone WHERE id=$id RETURNING id,email,name,phone,role', { ...data, id: request.user.id });
    response.json({ user });
  });
  router.post('/password', requireUser, loginLimit, async (request, response) => {
    const data = validate(z.object({ currentPassword: z.string().max(128), password: credentials.shape.password }).strict(), request.body);
    const user = await store.one('SELECT password_hash FROM users WHERE id=$id', { id: request.user.id });
    requireThat(await verifyPassword(data.currentPassword, user.password_hash), 401, 'INVALID_CREDENTIALS', 'Current password is incorrect.');
    const hash = await hashPassword(data.password);
    await store.tx(async transaction => {
      const updated = await store.one('UPDATE users SET password_hash=$hash WHERE id=$id AND password_hash=$before RETURNING id', { id: request.user.id, hash, before: user.password_hash }, transaction);
      requireThat(updated, 409, 'CREDENTIALS_CHANGED', 'Your password changed. Sign in again.');
      await store.rows('DELETE FROM sessions WHERE user_id=$id RETURNING id', { id: request.user.id }, transaction);
      await auth.issue(request, response, request.user.id, transaction);
      await store.audit(request.user.id, 'auth.password_changed', 'user', request.user.id, {}, transaction);
    });
    response.json({ csrfToken: request.session.csrf_token });
  });
  router.get('/addresses', requireUser, async (request, response) => response.json({ addresses: await store.rows('SELECT id,label,data FROM addresses WHERE user_id=$id ORDER BY created_at', { id: request.user.id }) }));
  router.post('/addresses', requireUser, async (request, response) => {
    const data = validate(z.object({ label: z.string().trim().min(1).max(40), data: addressSchema }).strict(), request.body);
    const result = await store.tx(async transaction => {
      await store.one('SELECT id FROM users WHERE id=$id FOR UPDATE', { id: request.user.id }, transaction);
      const count = await store.one('SELECT count(*)::int AS count FROM addresses WHERE user_id=$id', { id: request.user.id }, transaction);
      requireThat(count.count < 20, 400, 'ADDRESS_LIMIT', 'You can save up to 20 addresses.');
      return store.one('INSERT INTO addresses(user_id,label,data) VALUES($user,$label,$data::jsonb) RETURNING id,label,data', { user: request.user.id, label: data.label, data: JSON.stringify(data.data) }, transaction);
    });
    response.status(201).json(result);
  });
  router.patch('/addresses/:id', requireUser, async (request, response) => {
    const id = validate(z.uuid(), request.params.id);
    const data = validate(z.object({ label: z.string().trim().min(1).max(40), data: addressSchema }).strict(), request.body);
    const result = await store.one('UPDATE addresses SET label=$label,data=$data::jsonb WHERE id=$id AND user_id=$user RETURNING id,label,data', { id, user: request.user.id, label: data.label, data: JSON.stringify(data.data) });
    requireThat(result, 404, 'NOT_FOUND', 'Address not found.'); response.json(result);
  });
  router.delete('/addresses/:id', requireUser, async (request, response) => {
    const id = validate(z.uuid(), request.params.id);
    await store.rows('DELETE FROM addresses WHERE id=$id AND user_id=$user RETURNING id', { id, user: request.user.id });
    response.status(204).end();
  });
  return router;
}

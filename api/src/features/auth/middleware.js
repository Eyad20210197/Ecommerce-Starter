import { AppError, requireThat } from '../../shared/errors.js';
import { token, digest } from '../../shared/security.js';

export function authMiddleware(store, config) {
  const cookieName = config.NODE_ENV === 'production' ? '__Host-store_session' : 'store_session';
  // Vercel rewrites /api to the backend: browser cookies remain first-party.
  const cookieOptions = { httpOnly: true, secure: config.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: config.SESSION_DAYS * 86400000 };
  async function issue(request, response, userId = null, transaction) {
    const value = token();
    const session = await store.one('INSERT INTO sessions(token_hash,csrf_token,user_id,expires_at) VALUES($hash,$csrf,$user,now()+($days * interval \'1 day\')) RETURNING *',
      { hash: digest(value), csrf: token(), user: userId, days: config.SESSION_DAYS }, transaction);
    response.cookie(cookieName, value, cookieOptions);
    request.session = session;
    return session;
  }
  async function load(request, response, next) {
    const raw = (request.headers.cookie || '').split(';').map(part => part.trim()).find(part => part.startsWith(cookieName + '='))?.slice(cookieName.length + 1);
    if (raw && /^[A-Za-z0-9_-]{43}$/.test(raw)) {
      request.session = await store.one('SELECT * FROM sessions WHERE token_hash=$hash AND expires_at > now()', { hash: digest(raw) });
      if (request.session?.user_id) request.user = await store.one('SELECT id,email,name,phone,role,active FROM users WHERE id=$id AND active=true', { id: request.session.user_id });
      if (request.session?.user_id && !request.user) {
        await store.rows('DELETE FROM sessions WHERE id=$id RETURNING id', { id: request.session.id });
        request.session = null;
      }
    }
    next();
  }
  const ensureSession = async (request, response, next) => { if (!request.session) await issue(request, response); next(); };
  const csrf = (request, response, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return next();
    const requestOrigin = request.get('origin');
    requireThat(!requestOrigin || requestOrigin === config.WEB_ORIGIN, 403, 'ORIGIN_REJECTED', 'Request origin is not allowed.');
    requireThat(request.session && request.get('x-csrf-token') === request.session.csrf_token, 403, 'CSRF_REJECTED', 'Refresh the page and try again.');
    next();
  };
  return { load, ensureSession, csrf, issue, cookieName, cookieOptions };
}
export const requireUser = (request, response, next) => {
  requireThat(request.user, 401, 'AUTH_REQUIRED', 'Please sign in.'); next();
};
export const roles = (...allowed) => (request, response, next) => {
  requireThat(request.user, 401, 'AUTH_REQUIRED', 'Please sign in.');
  requireThat(allowed.includes(request.user.role), 403, 'FORBIDDEN', 'You do not have permission for this action.'); next();
};
export function rateLimit(store, { scope, limit, seconds }) {
  return async (request, response, next) => {
    const key = digest(scope + ':' + request.ip);
    const result = await store.one(`INSERT INTO rate_limits(key,hits,expires_at) VALUES($key,1,now()+($seconds * interval '1 second'))
      ON CONFLICT(key) DO UPDATE SET hits=CASE WHEN rate_limits.expires_at < now() THEN 1 ELSE rate_limits.hits+1 END,
      expires_at=CASE WHEN rate_limits.expires_at < now() THEN EXCLUDED.expires_at ELSE rate_limits.expires_at END RETURNING hits`,
    { key, seconds });
    if (result.hits > limit) { response.set('Retry-After', String(seconds)); throw new AppError(429, 'RATE_LIMITED', 'Too many requests. Please try again later.'); }
    next();
  };
}

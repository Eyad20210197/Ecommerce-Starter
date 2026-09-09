import { Router } from 'express';
import { z } from 'zod';
import { validate, requireThat } from '../../shared/errors.js';
import { getCart, cartLines } from './service.js';
export function cartRoutes(store, auth) {
  const router = Router();
  router.use(auth.ensureSession);
  router.get('/', async (request, response) => {
    const cart = await getCart(store, request);
    response.json({ items: await cartLines(store, cart.id) });
  });
  router.put('/items/:id', async (request, response) => {
    const product = validate(z.uuid(), request.params.id);
    const { quantity } = validate(z.object({ quantity: z.number().int().min(0).max(100) }).strict(), request.body);
    const items = await store.tx(async transaction => {
      const cart = await getCart(store, request, transaction);
      if (!quantity) await store.rows('DELETE FROM cart_items WHERE cart_id=$cart AND product_id=$product RETURNING product_id', { cart: cart.id, product }, transaction);
      else {
        const row = await store.one('SELECT id,on_hand-reserved AS available FROM products WHERE id=$product AND active', { product }, transaction);
        requireThat(row && row.available >= quantity, 409, 'OUT_OF_STOCK', 'The requested quantity is unavailable.');
        const count = await store.one('SELECT count(*)::int AS count FROM cart_items WHERE cart_id=$id', { id: cart.id }, transaction);
        const existing = await store.one('SELECT product_id FROM cart_items WHERE cart_id=$cart AND product_id=$product', { cart: cart.id, product }, transaction);
        requireThat(existing || count.count < 50, 400, 'CART_LIMIT', 'A cart can contain up to 50 products.');
        await store.rows('INSERT INTO cart_items(cart_id,product_id,quantity) VALUES($cart,$product,$quantity) ON CONFLICT(cart_id,product_id) DO UPDATE SET quantity=$quantity RETURNING product_id', { cart: cart.id, product, quantity }, transaction);
      }
      return cartLines(store, cart.id, transaction);
    }); response.json({ items });
  });
  return router;
}

import { Router } from 'express';
import { z } from 'zod';
import { validate, requireThat } from '../../shared/errors.js';
import { roles } from '../auth/middleware.js';
export function inventoryRoutes(store) {
  const router = Router();
  router.use(roles('owner','manager','warehouse'));
  router.get('/lookup', async (request, response) => {
    const code = validate(z.string().trim().min(1).max(200), request.query.code);
    const cleanCode = code.toLowerCase();

    const selectCols = 'id,sku,name,description,price_minor,active,serialized,on_hand,reserved,on_hand-reserved AS available,category_id,image_url,tags';

    // 1. Check SKU
    let product = await store.one(
      `SELECT ${selectCols} FROM products WHERE lower(sku)=$cleanCode`,
      { cleanCode }
    );
    let matchedBy = 'sku';

    // 2. Check serial if not found by SKU
    if (!product) {
      const serialMatch = await store.one(
        'SELECT product_id, serial, status FROM serial_units WHERE lower(serial)=$cleanCode LIMIT 1',
        { cleanCode }
      );
      if (serialMatch) {
        product = await store.one(
          `SELECT ${selectCols} FROM products WHERE id=$id`,
          { id: serialMatch.product_id }
        );
        matchedBy = 'serial';
      }
    }

    // 3. Check UUID if valid
    if (!product && z.string().uuid().safeParse(code).success) {
      product = await store.one(
        `SELECT ${selectCols} FROM products WHERE id=$code`,
        { code }
      );
      matchedBy = 'id';
    }

    // 4. Fallback: exact product name
    if (!product) {
      product = await store.one(
        `SELECT ${selectCols} FROM products WHERE lower(name)=$cleanCode LIMIT 1`,
        { cleanCode }
      );
      matchedBy = 'name';
    }

    requireThat(product, 404, 'PRODUCT_NOT_FOUND', `No product found for barcode / code "${code}".`);

    const serials = product.serialized
      ? await store.rows('SELECT id,serial,status,order_item_id FROM serial_units WHERE product_id=$id ORDER BY created_at DESC LIMIT 50', { id: product.id })
      : [];

    const activeOrders = await store.rows(
      `SELECT o.id, o.number, o.status, o.contact->>'email' AS customer_email, o.created_at, oi.id AS order_item_id, oi.quantity, oi.verified
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE oi.product_id=$id AND o.status IN ('placed','preparing')
       ORDER BY o.created_at DESC LIMIT 10`,
      { id: product.id }
    );

    response.json({ product, serials, activeOrders, matchedBy });
  });
  router.get('/', async (request, response) => {
    const products = await store.rows('SELECT id,sku,name,active,serialized,on_hand,reserved,on_hand-reserved AS available FROM products ORDER BY name LIMIT 200');
    response.json({ products });
  });
  router.get('/:id/serials', async (request, response) => {
    const id = validate(z.uuid(), request.params.id);
    response.json({ serials: await store.rows('SELECT id,serial,status,order_item_id FROM serial_units WHERE product_id=$id ORDER BY created_at DESC LIMIT 500', { id }) });
  });
  router.get('/:id/movements', async (request, response) => {
    const id = validate(z.uuid(), request.params.id);
    const page = validate(z.coerce.number().int().min(1).default(1), request.query.page);
    response.json({ movements: await store.rows('SELECT m.*,u.name AS actor_name FROM stock_movements m LEFT JOIN users u ON u.id=m.actor_id WHERE product_id=$id ORDER BY m.id DESC LIMIT 100 OFFSET $offset', { id, offset: (page-1)*100 }) });
  });
  router.post('/:id/adjustments', async (request, response) => {
    const id = validate(z.uuid(), request.params.id);
    const data = validate(z.object({
      delta: z.number().int().min(-10000).max(10000).refine(value => value !== 0),
      kind: z.enum(['receipt','adjustment']), reason: z.string().trim().min(3).max(300),
      serials: z.array(z.string().trim().min(1).max(100)).max(1000).default([]),
    }).strict(), request.body);
    requireThat(data.kind !== 'receipt' || data.delta > 0, 400, 'INVALID_RECEIPT', 'Receipts must add stock.');
    const product = await store.tx(async transaction => {
      const row = await store.one('SELECT * FROM products WHERE id=$id FOR UPDATE', { id }, transaction);
      requireThat(row, 404, 'NOT_FOUND', 'Product not found.');
      requireThat(row.on_hand + data.delta >= row.reserved, 409, 'STOCK_RESERVED', 'Adjustment would remove reserved stock.');
      requireThat(row.on_hand + data.delta <= 10000000, 400, 'STOCK_LIMIT', 'Stock limit exceeded.');
      if (row.serialized) {
        requireThat(data.serials.length === Math.abs(data.delta) && new Set(data.serials).size === data.serials.length, 400, 'SERIAL_COUNT', 'Provide one unique serial for each unit.');
        for (const serial of [...data.serials].sort()) {
          if (data.delta > 0) await store.rows('INSERT INTO serial_units(product_id,serial) VALUES($id,$serial) RETURNING id', { id, serial }, transaction);
          else {
            const unit = await store.one("UPDATE serial_units SET status='removed' WHERE product_id=$id AND serial=$serial AND status='available' RETURNING id", { id, serial }, transaction);
            requireThat(unit, 409, 'SERIAL_UNAVAILABLE', 'A serial is unavailable or belongs to another product.');
          }
        }
      } else requireThat(data.serials.length === 0, 400, 'SERIAL_NOT_REQUIRED', 'This product does not use serial numbers.');
      const result = await store.one('UPDATE products SET on_hand=on_hand+$delta,version=version+1,updated_at=now() WHERE id=$id RETURNING *', { id, delta: data.delta }, transaction);
      await store.rows('INSERT INTO stock_movements(product_id,on_hand_delta,reserved_delta,kind,reason,actor_id,serials) VALUES($id,$delta,0,$kind,$reason,$actor,$serials) RETURNING id', { id, ...data, actor: request.user.id }, transaction);
      await store.audit(request.user.id, 'inventory.'+data.kind, 'product', id, data, transaction); return result;
    }); response.json({ product });
  });
  return router;
}

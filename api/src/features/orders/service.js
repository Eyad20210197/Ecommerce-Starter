import { z } from 'zod';
import { createHmac } from 'node:crypto';
import { validate, requireThat } from '../../shared/errors.js';
import { digest } from '../../shared/security.js';
import { convertMinor } from '../../shared/money.js';
import { addressSchema } from '../auth/routes.js';
import { getCart } from '../cart/service.js';

export const checkoutSchema = z.object({
  contact: z.object({ name: z.string().trim().min(2).max(100), email: z.email().max(254), phone: z.string().trim().min(6).max(30) }).strict(),
  address: addressSchema, currency: z.string().regex(/^[A-Z]{3}$/),
  payment_method: z.enum(['cod','stripe']).default('cod'), notes: z.string().trim().max(500).default(''),
  items: z.array(z.object({ product_id: z.uuid(), quantity: z.number().int().min(1).max(100) }).strict()).min(1).max(50),
}).strict();
export async function orderDetail(store, id, request, transaction) {
  const order = await store.one('SELECT * FROM orders WHERE id=$id', { id }, transaction);
  const staff = ['owner','manager','warehouse'].includes(request.user?.role);
  const access = request.get?.('x-order-token');
  requireThat(order && (staff || (order.user_id && order.user_id === request.user?.id) || (access && order.guest_token_hash === digest(access))), 404, 'NOT_FOUND', 'Order not found.');
  const items = await store.rows('SELECT oi.*,ARRAY(SELECT serial FROM order_serials WHERE order_item_id=oi.id ORDER BY serial) AS serials FROM order_items oi WHERE order_id=$id ORDER BY oi.id', { id }, transaction);
  const events = await store.rows('SELECT action,details,created_at FROM order_events WHERE order_id=$id ORDER BY id', { id }, transaction);
  const returned = await store.one('SELECT * FROM returns WHERE order_id=$id', { id }, transaction);
  const { guest_token_hash, checkout_scope, request_hash, idempotency_key, ...safe } = order;
  return { ...safe, items, events, return: returned };
}
export function orderService(store, config) {
  const event = (order, actor, action, details, transaction) => store.rows(
    'INSERT INTO order_events(order_id,actor_id,action,details) VALUES($order,$actor,$action,$details::jsonb) RETURNING id',
    { order, actor: actor || null, action, details: JSON.stringify(details) }, transaction);
  const movement = (product, hand, reserved, kind, order, actor, reason, transaction) => store.rows(
    'INSERT INTO stock_movements(product_id,on_hand_delta,reserved_delta,kind,reason,order_id,actor_id) VALUES($product,$hand,$reserved,$kind,$reason,$order,$actor) RETURNING id',
    { product, hand, reserved, kind, order, actor: actor || null, reason }, transaction);
  async function checkout(request, key) {
    const input = validate(checkoutSchema, request.body);
    requireThat(input.payment_method === 'cod' || config.PAYMENT_PROVIDER === 'stripe', 400, 'PAYMENT_UNAVAILABLE', 'This payment method is unavailable.');
    const items = [...input.items].sort((a,b) => a.product_id.localeCompare(b.product_id));
    requireThat(new Set(items.map(item => item.product_id)).size === items.length, 400, 'DUPLICATE_ITEMS', 'Combine repeated products into one cart line.');
    const scope = request.user ? 'user:'+request.user.id : 'guest:'+request.session.id;
    const fingerprint = digest(JSON.stringify({ ...input, items }));
    // A retry in the same guest session derives the same capability without storing it in plaintext.
    const guestToken = request.user ? null : createHmac('sha256', request.session.csrf_token).update(key).digest('base64url');
    const result = await store.tx(async transaction => {
      await store.one('SELECT pg_advisory_xact_lock(hashtextextended($scope,0))', { scope: scope+':'+key }, transaction);
      const existing = await store.one('SELECT id,request_hash FROM orders WHERE checkout_scope=$scope AND idempotency_key=$key', { scope, key }, transaction);
      if (existing) {
        requireThat(existing.request_hash === fingerprint, 409, 'IDEMPOTENCY_CONFLICT', 'This checkout key has already been used for different order details.');
        return { id: existing.id, reused: true };
      }
      const cart = await getCart(store, request, transaction);
      const snapshot = [];
      let subtotal = 0;
      for (const item of items) {
        const product = await store.one('SELECT * FROM products WHERE id=$id FOR UPDATE', { id: item.product_id }, transaction);
        requireThat(product?.active && product.on_hand-product.reserved >= item.quantity, 409, 'OUT_OF_STOCK', 'A product no longer has the requested quantity. Refresh your cart.');
        const price = convertMinor(product.price_minor, input.currency, config);
        subtotal += price * item.quantity;
        snapshot.push({ ...item, product, price });
      }
      requireThat(Number.isSafeInteger(subtotal) && subtotal <= 1000000000, 400, 'AMOUNT_TOO_LARGE', 'Order amount exceeds the limit.');
      const shipping = convertMinor(config.SHIPPING_FEE_MINOR, input.currency, config);
      const tax = Math.round(subtotal * config.TAX_BPS / 10000);
      requireThat(Number.isSafeInteger(subtotal+shipping+tax) && subtotal+shipping+tax <= 2000000000, 400, 'AMOUNT_TOO_LARGE', 'Order amount exceeds the limit.');
      const number = (await store.one("SELECT nextval('order_number_seq') AS number", {}, transaction)).number;
      const order = await store.one(`INSERT INTO orders(number,invoice_number,user_id,guest_token_hash,checkout_scope,idempotency_key,request_hash,contact,address,seller,
        currency,exchange_rate,base_currency,subtotal_minor,shipping_minor,tax_minor,total_minor,payment_method,notes)
        VALUES($number,$invoice,$user,$guest,$scope,$key,$hash,$contact::jsonb,$address::jsonb,$seller::jsonb,$currency,$rate,$base,$subtotal,$shipping,$tax,$total,$method,$notes) RETURNING *`, {
        number, invoice: 'INV-'+String(number).padStart(8,'0'), user: request.user?.id || null, guest: guestToken ? digest(guestToken) : null,
        scope, key, hash: fingerprint, contact: JSON.stringify(input.contact), address: JSON.stringify(input.address),
        seller: JSON.stringify({ name: config.STORE_NAME, address: config.STORE_ADDRESS, email: config.STORE_EMAIL, taxId: config.STORE_TAX_ID, taxBps: config.TAX_BPS }),
        currency: input.currency, rate: config.rates[input.currency], base: config.CURRENCY, subtotal, shipping, tax, total: subtotal+shipping+tax, method: input.payment_method, notes: input.notes,
      }, transaction);
      for (const item of snapshot) {
        const line = await store.one('INSERT INTO order_items(order_id,product_id,sku,name,quantity,unit_price_minor,serialized) VALUES($order,$product,$sku,$name,$quantity,$price,$serialized) RETURNING id',
          { order: order.id, product: item.product_id, sku: item.product.sku, name: item.product.name, quantity: item.quantity, price: item.price, serialized: item.product.serialized }, transaction);
        if (item.product.serialized) {
          const units = await store.rows("SELECT id,serial FROM serial_units WHERE product_id=$product AND status='available' ORDER BY id LIMIT $quantity FOR UPDATE", { product: item.product_id, quantity: item.quantity }, transaction);
          requireThat(units.length === item.quantity, 409, 'SERIAL_STOCK_MISMATCH', 'Serial stock needs reconciliation before this product can be ordered.');
          for (const unit of units) await store.rows('INSERT INTO order_serials(order_item_id,serial) VALUES($line,$serial) RETURNING serial', { line: line.id, serial: unit.serial }, transaction);
          await store.rows("UPDATE serial_units SET status='reserved',order_item_id=$line WHERE id=ANY($ids::uuid[]) RETURNING id", { line: line.id, ids: units.map(unit => unit.id) }, transaction);
        }
        await store.rows('UPDATE products SET reserved=reserved+$quantity,version=version+1,updated_at=now() WHERE id=$id RETURNING id', { id: item.product_id, quantity: item.quantity }, transaction);
        await movement(item.product_id, 0, item.quantity, 'reserve', order.id, request.user?.id, 'Order placed', transaction);
      }
      await store.rows('DELETE FROM cart_items WHERE cart_id=$cart RETURNING product_id', { cart: cart.id }, transaction);
      await event(order.id, request.user?.id, 'placed', {}, transaction);
      await store.audit(request.user?.id, 'order.placed', 'order', order.id, { number, total: order.total_minor, currency: order.currency }, transaction);
      return { id: order.id, reused: false };
    });
    return { ...result, guestToken };
  }
  async function transition(id, next, request, note = '', externalTx) {
    return (externalTx ? work => work(externalTx) : store.tx)(async transaction => {
      const order = await store.one('SELECT * FROM orders WHERE id=$id FOR UPDATE', { id }, transaction);
      await orderDetail(store, id, request, transaction);
      if (order.status === next) return order;
      const staff = ['owner','manager','warehouse'].includes(request.user?.role);
      requireThat(staff || next === 'cancelled', 403, 'FORBIDDEN', 'You cannot change this order status.');
      const allowed = { placed:['preparing','cancelled'], preparing:['dispatched','cancelled'], dispatched:['delivered'], delivered:['completed'], completed:[], cancelled:[], returned:[] };
      requireThat(allowed[order.status].includes(next), 409, 'INVALID_TRANSITION', 'This order cannot move to that status.');
      if (request.user?.role === 'warehouse') requireThat(['preparing','dispatched'].includes(next), 403, 'FORBIDDEN', 'Warehouse staff can prepare and dispatch orders.');
      if (next === 'completed') requireThat(order.payment_status === 'paid', 409, 'PAYMENT_REQUIRED', 'Record payment collection before completing the order.');
      if (next === 'cancelled') requireThat(order.payment_status !== 'paid', 409, 'REFUND_REQUIRED', 'Refund the online payment before cancellation.');
      const pendingRefund = await store.one("SELECT 1 FROM integration_jobs WHERE order_id=$id AND kind='refund' AND state='pending'", { id }, transaction);
      requireThat(!pendingRefund || next === 'cancelled', 409, 'REFUND_PENDING', 'A payment refund is being reconciled. Fulfillment is paused.');
      if (['preparing','dispatched'].includes(next) && order.payment_method === 'stripe') requireThat(order.payment_status === 'paid', 409, 'PAYMENT_REQUIRED', 'Online payment must be confirmed first.');
      if (next === 'preparing') {
        const unverified = await store.rows('SELECT id,sku,name FROM order_items WHERE order_id=$id AND NOT verified', { id }, transaction);
        requireThat(unverified.length === 0, 409, 'ITEMS_NOT_VERIFIED', `Cannot prepare order: ${unverified.length} item(s) have not been barcode verified (${unverified.map(u => u.sku).join(', ')}).`);
      }
      if (['dispatched','cancelled'].includes(next)) {
        const lines = await store.rows('SELECT * FROM order_items WHERE order_id=$id ORDER BY product_id', { id }, transaction);
        for (const line of lines) {
          const product = await store.one('SELECT id,on_hand,reserved FROM products WHERE id=$id FOR UPDATE', { id: line.product_id }, transaction);
          const hand = next === 'dispatched' ? -Math.min(product.on_hand, line.quantity) : 0;
          const reservedDelta = -Math.min(product.reserved, line.quantity);
          await store.rows('UPDATE products SET on_hand=GREATEST(0,on_hand+$hand),reserved=LEAST(GREATEST(0,reserved+$reservedDelta),GREATEST(0,on_hand+$hand)),version=version+1,updated_at=now() WHERE id=$id RETURNING id', { id: line.product_id, hand, reservedDelta }, transaction);
          if (line.serialized) {
            const units = await store.rows("UPDATE serial_units SET status=$status,order_item_id=CASE WHEN $status='available' THEN NULL ELSE order_item_id END WHERE order_item_id=$line AND status='reserved' RETURNING id", { line: line.id, status: next === 'dispatched' ? 'sold' : 'available' }, transaction);
            requireThat(units.length === line.quantity, 409, 'SERIAL_STOCK_MISMATCH', 'Assigned serial quantities do not match this order.');
          }
          await movement(line.product_id, hand, reservedDelta, next === 'dispatched' ? 'sale' : 'release', id, request.user?.id, note || next, transaction);
        }
      }
      const result = await store.one(`UPDATE orders SET status=$next,updated_at=now(),delivered_at=CASE WHEN $next='delivered' THEN now() ELSE delivered_at END,
        payment_status=CASE WHEN $next='cancelled' AND payment_status='pending' THEN 'void' ELSE payment_status END WHERE id=$id RETURNING *`, { next, id }, transaction);
      await event(id, request.user?.id, next, { from: order.status, note }, transaction);
      await store.audit(request.user?.id, 'order.'+next, 'order', id, { from: order.status, note }, transaction);
      return result;
    });
  }
  async function collect(id, actor, reference) {
    return store.tx(async transaction => {
      const order = await store.one('SELECT * FROM orders WHERE id=$id FOR UPDATE', { id }, transaction);
      requireThat(order, 404, 'NOT_FOUND', 'Order not found.');
      if (order.payment_status === 'paid') return order;
      requireThat(order.payment_method === 'cod' && order.status === 'delivered' && order.payment_status === 'pending', 409, 'PAYMENT_STATE', 'Cash can be collected for a delivered, unpaid COD order.');
      await store.rows("INSERT INTO payment_events(order_id,kind,amount_minor,currency,reference,actor_id) VALUES($id,'collection',$amount,$currency,$reference,$actor) RETURNING id",
        { id, amount: order.total_minor, currency: order.currency, reference, actor }, transaction);
      await store.rows("UPDATE orders SET payment_status='paid',updated_at=now() WHERE id=$id RETURNING id", { id }, transaction);
      await store.audit(actor, 'payment.collected', 'order', id, { amount: order.total_minor, reference }, transaction);
      await event(id, actor, 'payment_collected', {}, transaction);
      return { ...order, payment_status: 'paid' };
    });
  }
  async function requestReturn(id, request, reason) {
    return store.tx(async transaction => {
      const order = await store.one('SELECT * FROM orders WHERE id=$id FOR UPDATE', { id }, transaction);
      await orderDetail(store, id, request, transaction);
      requireThat(['delivered','completed'].includes(order.status), 409, 'RETURN_STATE', 'Only delivered orders can be returned.');
      requireThat(Date.now() - new Date(order.delivered_at).getTime() <= config.RETURN_WINDOW_DAYS*86400000, 409, 'RETURN_WINDOW', 'The return window has closed.');
      const result = await store.one('INSERT INTO returns(order_id,reason) VALUES($id,$reason) ON CONFLICT(order_id) DO NOTHING RETURNING *', { id, reason }, transaction);
      requireThat(result, 409, 'RETURN_EXISTS', 'A return request already exists for this order.');
      await event(id, request.user?.id, 'return_requested', { reason }, transaction);
      await store.audit(request.user?.id, 'return.requested', 'order', id, { reason }, transaction); return result;
    });
  }
  async function returnAction(id, action, request, { note, restock = false, serials = [] }) {
    return store.tx(async transaction => {
      const order = await store.one('SELECT * FROM orders WHERE id=$id FOR UPDATE', { id }, transaction);
      requireThat(order, 404, 'NOT_FOUND', 'Order not found.');
      const returned = await store.one('SELECT * FROM returns WHERE order_id=$id FOR UPDATE', { id }, transaction);
      requireThat(returned, 404, 'NOT_FOUND', 'Return not found.');
      if (returned.status === action) return returned;
      const states = { requested:['approved','rejected'], approved:['received'], rejected:[], received:[], refunded:[] };
      requireThat(states[returned.status].includes(action), 409, 'RETURN_STATE', 'This return cannot move to that status.');
      if (action === 'received') {
        requireThat(['owner','warehouse'].includes(request.user.role), 403, 'FORBIDDEN', 'Warehouse receipt permission is required.');
        const lines = await store.rows('SELECT * FROM order_items WHERE order_id=$id ORDER BY product_id', { id }, transaction);
        const expected = await store.rows('SELECT su.serial FROM serial_units su JOIN order_items oi ON oi.id=su.order_item_id WHERE oi.order_id=$id AND su.status=\'sold\' ORDER BY su.serial', { id }, transaction);
        requireThat(JSON.stringify([...new Set(serials)].sort()) === JSON.stringify(expected.map(unit => unit.serial)) && serials.length === expected.length, 400, 'RETURN_SERIALS', 'Scan exactly the serials supplied with this order.');
        for (const line of lines) {
          await store.one('SELECT id FROM products WHERE id=$id FOR UPDATE', { id: line.product_id }, transaction);
          if (restock) await store.rows('UPDATE products SET on_hand=on_hand+$quantity,version=version+1,updated_at=now() WHERE id=$id RETURNING id', { id: line.product_id, quantity: line.quantity }, transaction);
          if (line.serialized) await store.rows("UPDATE serial_units SET status=$status,order_item_id=CASE WHEN $restock THEN NULL ELSE order_item_id END WHERE order_item_id=$id AND status='sold' RETURNING id", { status: restock ? 'available' : 'quarantine', restock, id: line.id }, transaction);
          await movement(line.product_id, restock ? line.quantity : 0, 0, 'return', id, request.user.id, note || (restock ? 'Inspected and restocked' : 'Received, not sellable'), transaction);
        }
        await store.rows("UPDATE orders SET status='returned',payment_status=CASE WHEN payment_status='pending' THEN 'void' ELSE payment_status END,updated_at=now() WHERE id=$id RETURNING id", { id }, transaction);
      } else requireThat(['owner','manager'].includes(request.user.role), 403, 'FORBIDDEN', 'Store management permission is required.');
      const result = await store.one('UPDATE returns SET status=$action,restocked=CASE WHEN $action=\'received\' THEN $restock ELSE restocked END,note=$note,updated_at=now() WHERE id=$id RETURNING *', { id: returned.id, action, restock, note }, transaction);
      await event(id, request.user.id, 'return_'+action, { note, restock }, transaction);
      await store.audit(request.user.id, 'return.'+action, 'order', id, { note, restock, serials }, transaction); return result;
    });
  }
  async function refund(id, actor, reference, onlineReference = null, externalTx) {
    return (externalTx ? work => work(externalTx) : store.tx)(async transaction => {
      const order = await store.one('SELECT * FROM orders WHERE id=$id FOR UPDATE', { id }, transaction);
      requireThat(order, 404, 'NOT_FOUND', 'Order not found.');
      if (order.payment_status === 'refunded') return order;
      requireThat(order.payment_status === 'paid' && ['placed','preparing','returned'].includes(order.status), 409, 'REFUND_STATE', 'Refund requires a paid order before dispatch or after return receipt.');
      requireThat(order.payment_method === 'cod' || onlineReference, 409, 'ONLINE_REFUND_REQUIRED', 'The payment provider must confirm the refund.');
      await store.rows("INSERT INTO payment_events(order_id,kind,amount_minor,currency,reference,actor_id) VALUES($id,'refund',$amount,$currency,$reference,$actor) RETURNING id", { id, amount: order.total_minor, currency: order.currency, reference: onlineReference || reference, actor }, transaction);
      await store.rows("UPDATE orders SET payment_status='refunded',updated_at=now() WHERE id=$id RETURNING id", { id }, transaction);
      await store.rows("UPDATE returns SET status='refunded',updated_at=now() WHERE order_id=$id AND status='received' RETURNING id", { id }, transaction);
      await event(id, actor, 'refunded', {}, transaction);
      await store.audit(actor, 'payment.refunded', 'order', id, { amount: order.total_minor, reference: onlineReference || reference }, transaction); return order;
    });
  }
  async function verifyOrderItem(orderId, itemId, barcode, actorId) {
    return store.tx(async transaction => {
      const order = await store.one('SELECT * FROM orders WHERE id=$id FOR UPDATE', { id: orderId }, transaction);
      requireThat(order, 404, 'NOT_FOUND', 'Order not found.');
      requireThat(['placed','preparing'].includes(order.status), 409, 'INVALID_STATE', 'Items can only be verified on placed or preparing orders.');
      const item = await store.one('SELECT * FROM order_items WHERE id=$itemId AND order_id=$orderId FOR UPDATE', { itemId, orderId }, transaction);
      requireThat(item, 404, 'NOT_FOUND', 'Order line item not found.');

      const cleanScanned = String(barcode).trim().toLowerCase();
      const cleanSku = item.sku.trim().toLowerCase();
      let matches = cleanScanned === cleanSku;

      if (!matches && item.serialized) {
        const assignedSerial = await store.one(
          'SELECT serial FROM order_serials WHERE order_item_id=$itemId AND lower(serial)=$cleanScanned LIMIT 1',
          { itemId, cleanScanned }, transaction
        );
        if (assignedSerial) matches = true;
      }

      requireThat(matches, 400, 'SKU_MISMATCH', `Scanned code "${barcode}" does not match product SKU "${item.sku}".`);

      const updated = await store.one(
        'UPDATE order_items SET verified=true, verified_at=now(), verified_by=$actorId WHERE id=$itemId RETURNING *',
        { itemId, actorId }, transaction
      );
      await event(orderId, actorId, 'item_verified', { item_id: itemId, sku: item.sku, name: item.name, barcode }, transaction);
      await store.audit(actorId, 'order.item_verified', 'order', orderId, { item_id: itemId, sku: item.sku, name: item.name, barcode }, transaction);
      return updated;
    });
  }
  async function resetOrderItemVerification(orderId, itemId, actorId) {
    return store.tx(async transaction => {
      const order = await store.one('SELECT * FROM orders WHERE id=$id FOR UPDATE', { id: orderId }, transaction);
      requireThat(order, 404, 'NOT_FOUND', 'Order not found.');
      requireThat(['placed','preparing'].includes(order.status), 409, 'INVALID_STATE', 'Items can only be reset on placed or preparing orders.');
      const item = await store.one('SELECT * FROM order_items WHERE id=$itemId AND order_id=$orderId FOR UPDATE', { itemId, orderId }, transaction);
      requireThat(item, 404, 'NOT_FOUND', 'Order line item not found.');

      const updated = await store.one(
        'UPDATE order_items SET verified=false, verified_at=null, verified_by=null WHERE id=$itemId RETURNING *',
        { itemId }, transaction
      );
      await event(orderId, actorId, 'item_unverified', { item_id: itemId, sku: item.sku, name: item.name }, transaction);
      await store.audit(actorId, 'order.item_unverified', 'order', orderId, { item_id: itemId, sku: item.sku }, transaction);
      return updated;
    });
  }
  return { checkout, transition, collect, requestReturn, returnAction, refund, event, verifyOrderItem, resetOrderItemVerification };
}

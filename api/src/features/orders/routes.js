import { Router } from 'express';
import { z } from 'zod';
import { validate, requireThat } from '../../shared/errors.js';
import { requireUser, roles, rateLimit } from '../auth/middleware.js';
import { orderDetail } from './service.js';
import { renderInvoice } from './invoice.js';
export function orderRoutes(store, config, service, integrations) {
  const router = Router();
  router.post('/', rateLimit(store, { scope:'checkout',limit:30,seconds:900 }), async (request, response) => {
    const key = validate(z.uuid(), request.get('idempotency-key'));
    const result = await service.checkout(request, key);
    response.status(result.reused ? 200 : 201).json(result);
  });
  router.get('/', requireUser, async (request, response) => {
    const page = validate(z.coerce.number().int().min(1).max(10000).default(1), request.query.page);
    const status = validate(z.enum(['','placed','preparing','dispatched','delivered','completed','cancelled','returned']).default(''), request.query.status);
    const staff = ['owner','manager','warehouse'].includes(request.user.role);
    const bind = { staff, user:request.user.id, status, offset:(page-1)*30 };
    const orders = await store.rows(`SELECT o.id,o.number,o.status,o.payment_status,o.payment_method,o.currency,o.total_minor,o.created_at,o.contact,
      r.status AS return_status FROM orders o LEFT JOIN returns r ON r.order_id=o.id
      WHERE ($staff OR o.user_id=$user) AND ($status='' OR o.status=$status) ORDER BY o.created_at DESC LIMIT 30 OFFSET $offset`, bind);
    const count = await store.one("SELECT count(*)::int AS total FROM orders WHERE ($staff OR user_id=$user) AND ($status='' OR status=$status)", bind);
    response.json({ orders,...count,page });
  });
  router.get('/:id', async (request, response) => response.json({ order: await orderDetail(store, validate(z.uuid(), request.params.id), request) }));
  router.get('/:id/invoice', async (request, response) => {
    const order = await orderDetail(store, validate(z.uuid(), request.params.id), request);
    response.type('html').set('Content-Disposition', 'inline; filename="'+order.invoice_number+'.html"').send(renderInvoice(order));
  });
  router.post('/:id/status', async (request, response) => {
    const data = validate(z.object({ status:z.enum(['preparing','dispatched','delivered','completed','cancelled']),note:z.string().trim().max(300).default('') }).strict(), request.body);
    const id = validate(z.uuid(),request.params.id);
    if (data.status === 'cancelled') await integrations.cancel(id,request,data.note);
    else await service.transition(id,data.status,request,data.note);
    response.json({ order: await orderDetail(store, request.params.id, request) });
  });
  router.post('/:id/verify-item', roles('owner','manager','warehouse'), async (request, response) => {
    const id = validate(z.uuid(), request.params.id);
    const data = validate(z.object({
      item_id: z.uuid().optional(),
      itemId: z.uuid().optional(),
      barcode: z.string().trim().min(1).max(100)
    }).refine(d => d.item_id || d.itemId, { message: 'item_id is required' }), request.body);
    const targetItemId = data.item_id || data.itemId;
    await service.verifyOrderItem(id, targetItemId, data.barcode, request.user.id);
    response.json({ success: true, order: await orderDetail(store, id, request) });
  });
  router.post('/:id/verify-item/reset', roles('owner','manager','warehouse'), async (request, response) => {
    const id = validate(z.uuid(), request.params.id);
    const data = validate(z.object({
      item_id: z.uuid().optional(),
      itemId: z.uuid().optional()
    }).refine(d => d.item_id || d.itemId, { message: 'item_id is required' }), request.body);
    const targetItemId = data.item_id || data.itemId;
    await service.resetOrderItemVerification(id, targetItemId, request.user.id);
    response.json({ success: true, order: await orderDetail(store, id, request) });
  });
  router.post('/:id/collect', roles('owner','manager'), async (request,response) => {
    const data = validate(z.object({ reference:z.string().trim().min(3).max(120) }).strict(), request.body);
    await service.collect(validate(z.uuid(),request.params.id),request.user.id,data.reference);
    response.json({ order: await orderDetail(store, request.params.id, request) });
  });
  router.post('/:id/returns', async (request,response) => {
    const data = validate(z.object({ reason:z.string().trim().min(5).max(500) }).strict(), request.body);
    response.status(201).json({ return: await service.requestReturn(validate(z.uuid(),request.params.id),request,data.reason) });
  });
  router.post('/:id/returns/status', roles('owner','manager','warehouse'), async (request,response) => {
    const data = validate(z.object({ status:z.enum(['approved','rejected','received']),note:z.string().trim().min(3).max(500),restock:z.boolean().default(false),serials:z.array(z.string().min(1).max(100)).max(5000).default([]) }).strict(),request.body);
    response.json({ return:await service.returnAction(validate(z.uuid(),request.params.id),data.status,request,data) });
  });
  router.post('/:id/refund', roles('owner'), async (request,response) => {
    const id = validate(z.uuid(),request.params.id);
    const data = validate(z.object({ reference:z.string().trim().min(3).max(120) }).strict(),request.body);
    await integrations.refund(id,request.user.id,data.reference);
    response.json({ order:await orderDetail(store,id,request) });
  });
  router.post('/:id/payment', async (request,response) => {
    const id = validate(z.uuid(),request.params.id); await orderDetail(store,id,request);
    response.json(await integrations.checkoutPayment(id));
  });
  router.post('/:id/shipment', roles('owner','manager','warehouse'), async (request,response) => {
    const id = validate(z.uuid(),request.params.id);
    response.json(await integrations.createShipment(id,request.user.id));
  });
  router.patch('/:id/shipment', roles('owner','manager','warehouse'), async (request,response) => {
    const id = validate(z.uuid(),request.params.id);
    const data = validate(z.object({ reference:z.string().trim().min(1).max(120),tracking_url:z.union([z.url().refine(url=>url.startsWith('https://')),z.literal('')]) }).strict(),request.body);
    await store.tx(async transaction => {
      const updated = await store.one('UPDATE orders SET shipping_reference=$reference,tracking_url=$tracking_url,updated_at=now() WHERE id=$id RETURNING id',{id,...data},transaction);
      requireThat(updated,404,'NOT_FOUND','Order not found.');
      await store.audit(request.user.id,'shipment.updated','order',id,data,transaction);
    }); response.json({ order:await orderDetail(store,id,request) });
  });
  return router;
}

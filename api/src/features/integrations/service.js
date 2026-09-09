import { createHmac, timingSafeEqual } from 'node:crypto';
import { requireThat, AppError } from '../../shared/errors.js';
import { orderDetail } from '../orders/service.js';

export function verifySignature(raw, signature, secret, stripe = false) {
  if (!signature || !secret) return false;
  const parts = stripe ? signature.split(',') : [];
  const timestamp = stripe ? parts.find(part=>part.startsWith('t='))?.slice(2) : signature.split('.')[0];
  const candidates = stripe ? parts.filter(part=>part.startsWith('v1=')).map(part=>part.slice(3)) : [signature.split('.')[1]];
  if (!/^\d+$/.test(timestamp || '') || Math.abs(Date.now()/1000-Number(timestamp)) > 300) return false;
  const expected = createHmac('sha256',secret).update(timestamp+'.').update(raw).digest();
  return candidates.some(candidate => {
    if (!/^[a-f0-9]{64}$/i.test(candidate || '')) return false;
    return timingSafeEqual(Buffer.from(candidate,'hex'),expected);
  });
}
export function integrationService(store, config, orders) {
  async function stripe(path, params, key, method = 'POST') {
    const body = new URLSearchParams(params);
    const response = await fetch('https://api.stripe.com/v1/'+path, {
      method, headers:{ Authorization:'Bearer '+config.STRIPE_SECRET_KEY, ...(method==='POST'?{'Content-Type':'application/x-www-form-urlencoded','Idempotency-Key':key}:{}) },
      ...(method==='POST'?{body}:{}), signal:AbortSignal.timeout(10000),
    });
    const result = await response.json();
    if (!response.ok) throw new AppError(502,'PAYMENT_PROVIDER_ERROR','The payment service could not complete the request. Try again.');
    return result;
  }
  async function checkoutPayment(id) {
    requireThat(config.PAYMENT_PROVIDER==='stripe',400,'PAYMENT_UNAVAILABLE','Online payments are disabled.');
    return store.tx(async transaction => {
      const order = await store.one('SELECT * FROM orders WHERE id=$id FOR UPDATE',{id},transaction);
      requireThat(order?.payment_method==='stripe' && order.payment_status==='pending' && order.status==='placed',409,'PAYMENT_STATE','This order is not awaiting online payment.');
      if (order.payment_reference) {
        const session = await stripe('checkout/sessions/'+encodeURIComponent(order.payment_reference),null,null,'GET');
        requireThat(session.status==='open' && session.url,409,'PAYMENT_SESSION_CLOSED','This payment session is closed. Cancel the unpaid order before checking out again.');
        return { url:session.url };
      }
      const params = {
        mode:'payment','payment_method_types[0]':'card','client_reference_id':id,
        'metadata[order_id]':id,'payment_intent_data[metadata][order_id]':id,
        'line_items[0][price_data][currency]':order.currency.toLowerCase(),
        'line_items[0][price_data][product_data][name]':config.STORE_NAME+' order #'+order.number,
        'line_items[0][price_data][unit_amount]':String(order.total_minor),'line_items[0][quantity]':'1',
        success_url:config.WEB_ORIGIN+'/#/orders/'+id+'?payment=success',
        cancel_url:config.WEB_ORIGIN+'/#/orders/'+id+'?payment=cancelled',
        expires_at:String(Math.floor(new Date(order.created_at).getTime()/1000)+86400),
      };
      requireThat(Number(params.expires_at)>Date.now()/1000+1800,409,'PAYMENT_WINDOW_CLOSED','The payment window has closed. Cancel this order and place a new one.');
      const session = await stripe('checkout/sessions',params,'checkout:'+id);
      await store.rows('UPDATE orders SET payment_reference=$reference WHERE id=$id RETURNING id',{id,reference:session.id},transaction);
      return { url:session.url };
    });
  }
  async function cancel(id,request,note) {
    return store.tx(async transaction => {
      const order = await store.one('SELECT * FROM orders WHERE id=$id FOR UPDATE',{id},transaction);
      await orderDetail(store,id,request,transaction);
      requireThat(request.user?.role !== 'warehouse',403,'FORBIDDEN','Warehouse staff cannot cancel orders.');
      requireThat(['placed','preparing','cancelled'].includes(order.status),409,'INVALID_TRANSITION','This order can no longer be cancelled.');
      if (order.status==='cancelled') return order;
      if (order.payment_method==='stripe' && order.payment_reference && order.payment_status==='pending') {
        const session = await stripe('checkout/sessions/'+encodeURIComponent(order.payment_reference),null,null,'GET');
        requireThat(session.payment_status!=='paid',409,'PAYMENT_PROCESSING','Payment is processing. Wait for confirmation before requesting a refund.');
        if (session.status==='open') await stripe('checkout/sessions/'+encodeURIComponent(order.payment_reference)+'/expire',{},'expire:'+id);
      }
      return orders.transition(id,'cancelled',request,note,transaction);
    });
  }
  async function refund(id,actor,reference) {
    return store.tx(async transaction => {
      const order = await store.one('SELECT * FROM orders WHERE id=$id FOR UPDATE',{id},transaction);
      requireThat(order,404,'NOT_FOUND','Order not found.');
      if (order.payment_status==='refunded') return;
      requireThat(order.payment_status==='paid' && ['placed','preparing','returned'].includes(order.status),409,'REFUND_STATE','Receive the return or stop fulfillment before refunding.');
      let onlineReference = null;
      if (order.payment_method==='stripe') {
        const session = await stripe('checkout/sessions/'+encodeURIComponent(order.payment_reference),null,null,'GET');
        requireThat(session.payment_intent,409,'PAYMENT_STATE','Payment reference is not available.');
        const result = await stripe('refunds',{payment_intent:session.payment_intent,amount:String(order.total_minor)},'refund:'+id);
        requireThat(result.status==='succeeded',409,'REFUND_PENDING','The provider has not confirmed this refund. Retry after it completes.');
        onlineReference = result.id;
      }
      return orders.refund(id,actor,reference,onlineReference,transaction);
    });
  }
  async function stripeWebhook(raw,signature) {
    requireThat(config.PAYMENT_PROVIDER==='stripe' && verifySignature(raw,signature,config.STRIPE_WEBHOOK_SECRET,true),400,'WEBHOOK_SIGNATURE','Invalid webhook signature.');
    let event; try { event=JSON.parse(raw.toString('utf8')); } catch { throw new AppError(400,'WEBHOOK_BODY','Invalid webhook body.'); }
    if (!['checkout.session.completed','checkout.session.expired'].includes(event.type)) return;
    const session = event.data?.object;
    requireThat(typeof event.id==='string' && session?.client_reference_id,400,'WEBHOOK_BODY','Invalid webhook event.');
    await store.tx(async transaction => {
      const recorded = await store.one('INSERT INTO webhook_events(provider,event_id) VALUES(\'stripe\',$event) ON CONFLICT DO NOTHING RETURNING event_id',{event:event.id},transaction);
      if (!recorded) return;
      const order = await store.one('SELECT * FROM orders WHERE id::text=$id FOR UPDATE',{id:session.client_reference_id},transaction);
      requireThat(order?.payment_method==='stripe' && order.payment_reference===session.id,409,'PAYMENT_MISMATCH','Payment session does not match this order.');
      if (event.type==='checkout.session.expired') {
        if (order.status==='placed' && order.payment_status==='pending') {
          const request = {user:{id:order.user_id,role:'owner'},get:()=>undefined};
          await orders.transition(order.id,'cancelled',request,'Payment session expired',transaction);
        }
        return;
      }
      requireThat(session.payment_status==='paid' && session.amount_total===order.total_minor && session.currency===order.currency.toLowerCase(),409,'PAYMENT_MISMATCH','Payment amount or currency does not match.');
      if (order.payment_status==='paid' || order.payment_status==='refunded') return;
      requireThat(order.status==='placed',409,'PAYMENT_STATE','Order no longer accepts payment.');
      await store.rows("INSERT INTO payment_events(order_id,kind,amount_minor,currency,reference) VALUES($id,'collection',$amount,$currency,$reference) RETURNING id",
        {id:order.id,amount:order.total_minor,currency:order.currency,reference:session.payment_intent},transaction);
      await store.rows("UPDATE orders SET payment_status='paid',updated_at=now() WHERE id=$id RETURNING id",{id:order.id},transaction);
      await orders.event(order.id,null,'payment_collected',{},transaction);
      await store.audit(null,'payment.confirmed','order',order.id,{provider:'stripe',reference:session.payment_intent},transaction);
    });
  }
  async function createShipment(id,actor) {
    requireThat(config.SHIPPING_PROVIDER==='webhook',400,'SHIPPING_DISABLED','Use manual shipment details for this store.');
    return store.tx(async transaction => {
      const order = await store.one('SELECT * FROM orders WHERE id=$id FOR UPDATE',{id},transaction);
      requireThat(order && order.status==='preparing',409,'SHIPMENT_STATE','Prepare the order before requesting shipping.');
      if (order.shipping_reference) return {reference:order.shipping_reference,tracking_url:order.tracking_url};
      const items=await store.rows('SELECT sku,name,quantity FROM order_items WHERE order_id=$id',{id},transaction);
      const response=await fetch(config.SHIPPING_API_URL,{method:'POST',headers:{Authorization:'Bearer '+config.SHIPPING_API_TOKEN,'Content-Type':'application/json','Idempotency-Key':'shipment:'+id},
        body:JSON.stringify({orderId:id,number:order.number,contact:order.contact,address:order.address,items,currency:order.currency,collectOnDeliveryMinor:order.payment_method==='cod'?order.total_minor:0}),
        signal:AbortSignal.timeout(10000)});
      requireThat(response.ok,502,'SHIPPING_PROVIDER_ERROR','The shipping service is unavailable.');
      const result=await response.json();
      requireThat(typeof result.reference==='string' && result.reference.length<=120 && (result.tracking_url==null || (typeof result.tracking_url==='string' && result.tracking_url.startsWith('https://'))),502,'SHIPPING_PROVIDER_ERROR','Invalid shipping service response.');
      await store.rows('UPDATE orders SET shipping_reference=$reference,tracking_url=$url,updated_at=now() WHERE id=$id RETURNING id',{id,reference:result.reference,url:result.tracking_url||null},transaction);
      await store.audit(actor,'shipment.created','order',id,{reference:result.reference},transaction);
      return result;
    });
  }
  async function shippingWebhook(raw,signature) {
    requireThat(config.SHIPPING_PROVIDER==='webhook' && verifySignature(raw,signature,config.SHIPPING_WEBHOOK_SECRET),400,'WEBHOOK_SIGNATURE','Invalid webhook signature.');
    let event;try{event=JSON.parse(raw.toString('utf8'));}catch{throw new AppError(400,'WEBHOOK_BODY','Invalid webhook body.');}
    requireThat(typeof event.eventId==='string' && event.eventId.length<=150 && typeof event.reference==='string' && event.status==='delivered',400,'WEBHOOK_BODY','Expected a delivered event with eventId and reference.');
    await store.tx(async transaction=>{
      const recorded=await store.one("INSERT INTO webhook_events(provider,event_id) VALUES('shipping',$event) ON CONFLICT DO NOTHING RETURNING event_id",{event:event.eventId},transaction);
      if(!recorded)return;
      const order=await store.one('SELECT * FROM orders WHERE shipping_reference=$reference FOR UPDATE',{reference:event.reference},transaction);
      requireThat(order,404,'NOT_FOUND','Shipment not found.');
      if(['delivered','completed','returned'].includes(order.status))return;
      await orders.transition(order.id,'delivered',{user:{role:'owner',id:null},get:()=>undefined},'Carrier delivery confirmation',transaction);
    });
  }
  return { checkoutPayment,cancel,refund,stripeWebhook,createShipment,shippingWebhook };
}

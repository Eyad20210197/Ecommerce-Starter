import { Router } from 'express';
import { z } from 'zod';
import { validate,requireThat } from '../../shared/errors.js';
import { roles } from '../auth/middleware.js';
import { hashPassword } from '../../shared/security.js';
export function adminRoutes(store,config) {
  const router=Router();
  router.get('/reports',roles('owner','manager'),async(request,response)=>{
    const range=validate(z.object({from:z.iso.date().default(new Date(Date.now()-30*86400000).toISOString().slice(0,10)),to:z.iso.date().default(new Date().toISOString().slice(0,10))}),request.query);
    requireThat(range.from<=range.to,400,'INVALID_RANGE','Start date must precede end date.');
    const bind={from:range.from,to:range.to};
    const orders=await store.rows(`SELECT currency,count(*)::int AS orders,sum(total_minor)::text AS placed_total,
      count(*) FILTER(WHERE status='cancelled')::int AS cancelled,count(*) FILTER(WHERE status='completed')::int AS completed
      FROM orders WHERE created_at >= $from::date AND created_at < $to::date+interval '1 day' GROUP BY currency`,bind);
    const payments=await store.rows(`SELECT currency,COALESCE(sum(amount_minor) FILTER(WHERE kind='collection'),0)::text AS collected,
      COALESCE(sum(amount_minor) FILTER(WHERE kind='refund'),0)::text AS refunded FROM payment_events
      WHERE created_at >= $from::date AND created_at < $to::date+interval '1 day' GROUP BY currency`,bind);
    const sales=await store.rows(`SELECT oi.sku,oi.name,o.currency,sum(oi.quantity)::int AS units,sum(oi.quantity::bigint*oi.unit_price_minor)::text AS revenue
      FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE o.status IN ('delivered','completed') AND
      o.delivered_at >= $from::date AND o.delivered_at < $to::date+interval '1 day'
      GROUP BY oi.sku,oi.name,o.currency ORDER BY sum(oi.quantity) DESC LIMIT 50`,bind);
    const inventory=await store.one('SELECT count(*)::int AS products,COALESCE(sum(on_hand),0)::text AS on_hand,COALESCE(sum(reserved),0)::text AS reserved,COALESCE(sum(on_hand::bigint*price_minor),0)::text AS retail_value FROM products');
    const lowStock=await store.rows('SELECT sku,name,on_hand,reserved,on_hand-reserved AS available FROM products WHERE active AND on_hand-reserved<=5 ORDER BY available,name LIMIT 50');
    const outstanding=await store.rows("SELECT currency,count(*)::int AS orders,sum(total_minor)::text AS amount FROM orders WHERE payment_method='cod' AND payment_status='pending' AND status='delivered' GROUP BY currency");
    response.json({range,orders,payments,sales,inventory,lowStock,outstanding,baseCurrency:config.CURRENCY});
  });
  router.get('/staff',roles('owner'),async(request,response)=>response.json({staff:await store.rows("SELECT id,name,email,phone,role,active,created_at FROM users WHERE role<>'customer' ORDER BY created_at")}));
  router.post('/staff',roles('owner'),async(request,response)=>{
    const data=validate(z.object({name:z.string().trim().min(2).max(100),email:z.email().max(254).transform(value=>value.toLowerCase()),password:z.string().min(12).max(128),role:z.enum(['manager','warehouse'])}).strict(),request.body);
    const hash=await hashPassword(data.password);
    const user=await store.tx(async transaction=>{
      const result=await store.one('INSERT INTO users(name,email,password_hash,role) VALUES($name,$email,$hash,$role) RETURNING id,name,email,role,active',{name:data.name,email:data.email,hash,role:data.role},transaction);
      await store.audit(request.user.id,'staff.created','user',result.id,{role:result.role},transaction);return result;
    });response.status(201).json({user});
  });
  router.patch('/staff/:id',roles('owner'),async(request,response)=>{
    const id=validate(z.uuid(),request.params.id);
    const data=validate(z.object({role:z.enum(['manager','warehouse']),active:z.boolean()}).strict(),request.body);
    const user=await store.tx(async transaction=>{
      const before=await store.one("SELECT id,role,active FROM users WHERE id=$id AND role IN ('manager','warehouse') FOR UPDATE",{id},transaction);
      requireThat(before,404,'NOT_FOUND','Employee not found.');
      const result=await store.one('UPDATE users SET role=$role,active=$active WHERE id=$id RETURNING id,name,email,role,active',{id,...data},transaction);
      await store.rows('DELETE FROM sessions WHERE user_id=$id RETURNING id',{id},transaction);
      await store.audit(request.user.id,'staff.updated','user',id,{before,after:data},transaction);return result;
    });response.json({user});
  });
  router.get('/audit',roles('owner'),async(request,response)=>{
    const page=validate(z.coerce.number().int().min(1).max(10000).default(1),request.query.page);
    response.json({events:await store.rows('SELECT a.*,u.name AS actor_name FROM audit_events a LEFT JOIN users u ON u.id=a.actor_id ORDER BY a.id DESC LIMIT 100 OFFSET $offset',{offset:(page-1)*100}),page});
  });
  router.get('/settings',roles('owner'),(request,response)=>response.json({
    store:{name:config.STORE_NAME,currency:config.CURRENCY,language:config.LANGUAGE,address:config.STORE_ADDRESS,email:config.STORE_EMAIL,taxId:config.STORE_TAX_ID},
    features:{payments:config.PAYMENT_PROVIDER,shipping:config.SHIPPING_PROVIDER,multiCurrency:config.MULTI_CURRENCY,multiLanguage:config.MULTI_LANGUAGE},
    future:{googleSso:false,customerService:false,aiChatbot:false,logistics:false},
    policy:{returnWindowDays:config.RETURN_WINDOW_DAYS,taxBps:config.TAX_BPS,shippingFeeMinor:config.SHIPPING_FEE_MINOR},
  }));
  return router;
}

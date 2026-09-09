import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readEnv} from '../src/config/env.js';
import {createDatabase} from '../src/infrastructure/database/connection.js';
import {migrate} from '../src/infrastructure/database/migrate.js';
import {createStore} from '../src/shared/db.js';
import {hashPassword} from '../src/shared/security.js';
import {createApp} from '../src/app.js';

test('PostgreSQL commerce and authorization workflows',async t=>{
 const url=process.env.INTEGRATION_DATABASE_URL;
 assert.ok(url && new URL(url).pathname.endsWith('_test'),'INTEGRATION_DATABASE_URL must point to a dedicated database ending in _test');
 const config=readEnv({DATABASE_URL:url,WEB_ORIGIN:'http://localhost:3000',NODE_ENV:'test',LOG_LEVEL:'error'});
 const database=createDatabase(config);await database.authenticate();await migrate(database,{info(){}});
 const store=createStore(database);
 const app=createApp({config,database,checkDatabase:()=>database.authenticate(),logger:{info(){},error(...args){console.error(...args);}}});
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 const base='http://127.0.0.1:'+server.address().port+'/api/v1';
 const suffix=randomUUID().slice(0,8);
 async function client(role){
  let cookie='',csrf='';
  async function call(path,method='GET',body,extra={}){
   const response=await fetch(base+path,{method,headers:{Cookie:cookie,Origin:config.WEB_ORIGIN,...(csrf?{'X-CSRF-Token':csrf}:{}),...(body!==undefined?{'Content-Type':'application/json'}:{}),...extra},...(body!==undefined?{body:JSON.stringify(body)}:{})});
   const set=response.headers.getSetCookie();if(set.length)cookie=set.at(-1).split(';')[0];
   const result=response.status===204?null:await response.json();
   if(result?.csrfToken)csrf=result.csrfToken;
   return {status:response.status,data:result};
  }
  await call('/auth/session');
  if(role){
   const email=role+'-'+suffix+'@example.test';
   await store.rows('INSERT INTO users(email,name,password_hash,role) VALUES($email,$role,$hash,$role) RETURNING id',{email,role,hash:await hashPassword('test-password-123')});
   assert.equal((await call('/auth/login','POST',{email,password:'test-password-123'})).status,200);
  }
  return call;
 }
 try{
  const owner=await client('owner'),warehouse=await client('warehouse'),guest=await client(),other=await client();
  const p=await owner('/catalog/products','POST',{sku:'SKU-'+suffix,name:'Test item',price_minor:1000,serialized:false,images:[
   {url:'https://images.example.test/'+suffix+'-front.jpg',alt:'Front'},
   {url:'https://images.example.test/'+suffix+'-side.jpg',alt:'Side'}
  ]});
  assert.equal(p.status,201);const product=p.data.product;
  await t.test('product gallery stores ordered images and exposes a main photo',async()=>{
   assert.equal(product.image_url,'https://images.example.test/'+suffix+'-front.jpg');
   const detail=await owner('/catalog/products/'+product.id);
   assert.equal(detail.status,200);assert.deepEqual(detail.data.product.images.map(image=>image.url),[
    'https://images.example.test/'+suffix+'-front.jpg','https://images.example.test/'+suffix+'-side.jpg'
   ]);assert.equal(detail.data.product.images[0].is_primary,true);
  });
  assert.equal((await warehouse('/inventory/'+product.id+'/adjustments','POST',{delta:1,kind:'receipt',reason:'Test receipt'})).status,200);
  const body={contact:{name:'Test Buyer',email:'buyer@example.test',phone:'123456789'},address:{name:'Test Buyer',phone:'123456789',line1:'123 Test Street',city:'Test City',country:'US'},currency:'USD',payment_method:'cod',items:[{product_id:product.id,quantity:1}]};
  let orderId,guestToken;
  await t.test('concurrent checkouts cannot oversell the last unit',async()=>{
   const results=await Promise.all([guest('/orders','POST',body,{'Idempotency-Key':randomUUID()}),other('/orders','POST',body,{'Idempotency-Key':randomUUID()})]);
   assert.deepEqual(results.map(r=>r.status).sort(),[201,409]);
   const success=results.find(r=>r.status===201);orderId=success.data.id;guestToken=success.data.guestToken;
   const stock=await store.one('SELECT on_hand,reserved FROM products WHERE id=$id',{id:product.id});assert.deepEqual(stock,{on_hand:1,reserved:1});
  });
  const access={'X-Order-Token':guestToken};
  await t.test('guest access requires an unguessable order capability',async()=>{
   assert.equal((await other('/orders/'+orderId)).status,404);
   assert.equal((await other('/orders/'+orderId,'GET',undefined,access)).status,200);
  });
  await t.test('warehouse cannot change price or access owner staff management',async()=>{
   assert.equal((await warehouse('/catalog/products','POST',{sku:'NO',name:'Bad',price_minor:1})).status,403);
   assert.equal((await warehouse('/admin/staff')).status,403);
   assert.equal((await warehouse('/orders/'+orderId+'/status','POST',{status:'cancelled'})).status,403);
  });
  await t.test('cancellation releases stock exactly once',async()=>{
   assert.equal((await other('/orders/'+orderId+'/status','POST',{status:'cancelled'},access)).status,200);
   assert.equal((await other('/orders/'+orderId+'/status','POST',{status:'cancelled'},access)).status,200);
   const stock=await store.one('SELECT on_hand,reserved FROM products WHERE id=$id',{id:product.id});assert.deepEqual(stock,{on_hand:1,reserved:0});
  });
  await t.test('idempotent checkout creates one order and rejects changed request reuse',async()=>{
   const key=randomUUID();
   const result=await Promise.all([guest('/orders','POST',body,{'Idempotency-Key':key}),guest('/orders','POST',body,{'Idempotency-Key':key})]);
   assert.deepEqual(result.map(r=>r.status).sort(),[200,201]);assert.equal(result[0].data.id,result[1].data.id);
   orderId=result[0].data.id;guestToken=result[0].data.guestToken;
   assert.equal((await guest('/orders','POST',{...body,notes:'different'},{'Idempotency-Key':key})).status,409);
  });
  await t.test('COD fulfillment, collection, return receipt and refund remain separate',async()=>{
   const path='/orders/'+orderId;
   assert.equal((await warehouse(path+'/status','POST',{status:'preparing'})).status,200);
   assert.equal((await warehouse(path+'/status','POST',{status:'dispatched'})).status,200);
   assert.equal((await owner(path+'/status','POST',{status:'delivered'})).status,200);
   assert.equal((await owner(path+'/status','POST',{status:'completed'})).status,409);
   assert.equal((await owner(path+'/collect','POST',{reference:'Receipt test'})).status,200);
   assert.equal((await owner(path+'/collect','POST',{reference:'Receipt retry'})).status,200);
   assert.equal((await owner(path+'/status','POST',{status:'completed'})).status,200);
   assert.equal((await guest(path+'/returns','POST',{reason:'Item is not suitable'},{'X-Order-Token':guestToken})).status,201);
   assert.equal((await owner(path+'/returns/status','POST',{status:'approved',note:'Return approved'})).status,200);
   assert.equal((await warehouse(path+'/returns/status','POST',{status:'received',note:'Inspected in warehouse',restock:true})).status,200);
   assert.equal((await warehouse(path+'/returns/status','POST',{status:'received',note:'Retry receipt',restock:true})).status,200);
   assert.equal((await owner(path+'/refund','POST',{reference:'Cash returned'})).status,200);
   assert.equal((await owner(path+'/refund','POST',{reference:'Cash returned retry'})).status,200);
   assert.deepEqual(await store.one('SELECT on_hand,reserved FROM products WHERE id=$id',{id:product.id}),{on_hand:1,reserved:0});
   assert.equal((await store.one('SELECT count(*)::int AS count FROM payment_events WHERE order_id=$id',{id:orderId})).count,2);
  });
  await t.test('serial assignments and invoice history survive restock',async()=>{
   const result=await owner('/catalog/products','POST',{sku:'SERIAL-'+suffix,name:'Serialized item',price_minor:5000,serialized:true});const id=result.data.product.id;
   assert.equal((await warehouse('/inventory/'+id+'/adjustments','POST',{delta:1,kind:'receipt',reason:'Serial receipt',serials:['SERIAL-'+suffix]})).status,200);
   const order=await guest('/orders','POST',{...body,items:[{product_id:id,quantity:1}]},{'Idempotency-Key':randomUUID()});
   assert.equal(order.status,201);const path='/orders/'+order.data.id;
   await warehouse(path+'/status','POST',{status:'preparing'});await warehouse(path+'/status','POST',{status:'dispatched'});await owner(path+'/status','POST',{status:'delivered'});
   await owner(path+'/returns','POST',{reason:'Return unopened item'});await owner(path+'/returns/status','POST',{status:'approved',note:'Approved'});
   assert.equal((await warehouse(path+'/returns/status','POST',{status:'received',note:'Inspected',restock:true,serials:['WRONG']})).status,400);
   assert.equal((await warehouse(path+'/returns/status','POST',{status:'received',note:'Inspected',restock:true,serials:['SERIAL-'+suffix]})).status,200);
   assert.deepEqual((await owner(path)).data.order.items[0].serials,['SERIAL-'+suffix]);
  });
  await t.test('CSRF and parser errors remain client errors',async()=>{
   const response=await fetch(base+'/auth/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert.equal(response.status,403);
   const unsupported=await fetch(base+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json; charset=iso-8859-1'},body:'{}'});assert.equal(unsupported.status,415);
  });
  await t.test('stock ledger and audit records cannot be rewritten',async()=>{
   await assert.rejects(()=>store.rows("UPDATE stock_movements SET reason='rewrite' WHERE product_id=$id RETURNING id",{id:product.id}));
   await assert.rejects(()=>store.rows("DELETE FROM audit_events WHERE entity_id=$id RETURNING id",{id:product.id}));
  });
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await database.close();}
});

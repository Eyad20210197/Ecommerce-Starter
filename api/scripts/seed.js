import {readEnv} from '../src/config/env.js';
import {createDatabase} from '../src/infrastructure/database/connection.js';
import {createStore} from '../src/shared/db.js';
const config=readEnv();
if(config.NODE_ENV==='production')throw new Error('Demo seed is disabled in production.');
const database=createDatabase(config);
try{
 const store=createStore(database);
 await store.tx(async transaction=>{
  const category=await store.one("INSERT INTO categories(name,slug) VALUES('Everyday','everyday') ON CONFLICT(slug) DO UPDATE SET name=categories.name RETURNING id",{},transaction);
  for(const [sku,name,price,description] of [
   ['DEMO-TOTE','Canvas tote',2400,'A simple cotton canvas bag with an inside pocket.'],
   ['DEMO-NOTE','Daily notebook',1600,'An A5 notebook with a cloth cover and ruled pages.'],
   ['DEMO-BOTTLE','Steel bottle',3200,'A reusable stainless steel bottle. 750 ml.'],
  ]){
   const product=await store.one('INSERT INTO products(sku,name,price_minor,description,category_id,tags,on_hand) VALUES($sku,$name,$price,$description,$category,ARRAY[\'everyday\'],20) ON CONFLICT(sku) DO NOTHING RETURNING id',{sku,name,price,description,category:category.id},transaction);
   if(product)await store.rows("INSERT INTO stock_movements(product_id,on_hand_delta,reserved_delta,kind,reason) VALUES($id,20,0,'receipt','Development seed') RETURNING id",{id:product.id},transaction);
  }
 });
 console.log('Development products added. Add product photos through the store dashboard.');
}finally{await database.close();}


import {readDatabaseEnv} from '../src/config/env.js';
import {createDatabase} from '../src/infrastructure/database/connection.js';
import {createStore} from '../src/shared/db.js';
import {hashPassword} from '../src/shared/security.js';
import {z} from 'zod';
const input=z.object({OWNER_EMAIL:z.email().transform(value=>value.toLowerCase()),OWNER_NAME:z.string().min(2).max(100),OWNER_PASSWORD:z.string().min(16).max(128)}).safeParse(process.env);
if(!input.success)throw new Error('Set OWNER_EMAIL, OWNER_NAME and OWNER_PASSWORD (16+ characters) for this command only.');
const database=createDatabase(readDatabaseEnv());
try{
 const store=createStore(database);const hash=await hashPassword(input.data.OWNER_PASSWORD);
 await store.tx(async transaction=>{
  await store.one('SELECT pg_advisory_xact_lock(720260910)',{},transaction);
  const existing=await store.one("SELECT id FROM users WHERE role='owner' LIMIT 1",{},transaction);
  if(existing)throw new Error('An owner already exists. This bootstrap command cannot change existing owners.');
  const user=await store.one("INSERT INTO users(email,name,password_hash,role) VALUES($email,$name,$hash,'owner') RETURNING id",{email:input.data.OWNER_EMAIL,name:input.data.OWNER_NAME,hash},transaction);
  await store.audit(user.id,'owner.bootstrapped','user',user.id,{},transaction);
 });
 console.log('Owner created. Remove OWNER_PASSWORD from the command environment.');
}finally{await database.close();}


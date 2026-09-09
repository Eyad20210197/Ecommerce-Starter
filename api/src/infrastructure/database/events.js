import pg from 'pg';
import { EventEmitter } from 'node:events';
import { sslOptions } from './connection.js';
export function inventoryEvents(config,logger) {
  const events=new EventEmitter();events.setMaxListeners(250);
  let client,stopped=false,retry;
  async function connect(){
    if(stopped)return;
    client=new pg.Client({connectionString:config.DATABASE_URL,ssl:sslOptions(config),connectionTimeoutMillis:10000});
    client.on('notification',message=>events.emit('change',message.payload));
    client.on('error',()=>{});
    client.on('end',()=>{if(!stopped)retry=setTimeout(connect,5000);});
    try{await client.connect();await client.query('LISTEN inventory_changed');}
    catch(error){logger.error('Inventory listener reconnecting',{name:error.name});await client.end().catch(()=>{});}
  }
  void connect();
  return {events,close:async()=>{stopped=true;clearTimeout(retry);await client?.end().catch(()=>{});}};
}

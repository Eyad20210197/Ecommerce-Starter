import { readEnv } from './config/env.js';
import { createDatabase } from './infrastructure/database/connection.js';
import { inventoryEvents } from './infrastructure/database/events.js';
import { createApp } from './app.js';
import { logger,safeError } from './shared/logger.js';
let database,listener,server,stopping=false;
async function shutdown(code=0){
  if(stopping)return;stopping=true;
  const deadline=setTimeout(()=>process.exit(1),15000);deadline.unref();
  try{
    await listener?.close();
    if(server)await new Promise((resolve,reject)=>{server.close(error=>error?reject(error):resolve());server.closeIdleConnections();setTimeout(()=>server.closeAllConnections(),10000).unref();});
    await database?.close();clearTimeout(deadline);process.exitCode=code;
  }catch(error){logger.error('Shutdown failed',safeError(error));process.exitCode=1;}
}
try{
  const config=readEnv();database=createDatabase(config);await database.authenticate();
  // Readiness requires the commerce schema, not just an accepting database socket.
  const checkDatabase=async()=>{await database.query('SELECT id FROM products LIMIT 0');};
  await checkDatabase();
  listener=inventoryEvents(config,logger);
  const app=createApp({config,database,checkDatabase,logger,events:listener.events});
  server=app.listen(config.PORT,'0.0.0.0',()=>logger.info('API listening',{port:config.PORT}));
  server.on('error',error=>{logger.error('HTTP server failed',safeError(error));void shutdown(1);});
  server.requestTimeout=30000;server.headersTimeout=15000;server.keepAliveTimeout=5000;
}catch(error){logger.error('Startup failed',safeError(error));await shutdown(1);}
process.on('SIGTERM',()=>void shutdown());
process.on('SIGINT',()=>void shutdown());
process.on('unhandledRejection',error=>{logger.error('Unhandled rejection',safeError(error));void shutdown(1);});
process.on('uncaughtException',error=>{logger.error('Uncaught exception',safeError(error));void shutdown(1);});

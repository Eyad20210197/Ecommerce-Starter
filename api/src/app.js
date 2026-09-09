import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { randomUUID } from 'node:crypto';
import { createStore } from './shared/db.js';
import { AppError } from './shared/errors.js';
import { safeError } from './shared/logger.js';
import { authMiddleware,rateLimit } from './features/auth/middleware.js';
import { authRoutes } from './features/auth/routes.js';
import { catalogRoutes } from './features/catalog/routes.js';
import { cartRoutes } from './features/cart/routes.js';
import { inventoryRoutes } from './features/inventory/routes.js';
import { orderService } from './features/orders/service.js';
import { orderRoutes } from './features/orders/routes.js';
import { integrationService } from './features/integrations/service.js';
import { adminRoutes } from './features/admin/routes.js';
import { uploadRoutes } from './features/uploads/routes.js';

export function createApp({webOrigin,checkDatabase,logger=console,config,database,events}) {
  const app=express();
  app.disable('x-powered-by');
  app.set('trust proxy',config?.TRUST_PROXY || 'loopback');
  app.use((request,response,next)=>{
    request.id=randomUUID();response.set('X-Request-ID',request.id);
    response.set('Cache-Control','no-store');
    const start=Date.now();
    response.on('finish',()=>{if(config?.LOG_LEVEL==='info')logger.info('HTTP request',{requestId:request.id,method:request.method,status:response.statusCode,durationMs:Date.now()-start});});
    next();
  });
  app.use(helmet({contentSecurityPolicy:{directives:{'style-src':["'self'","'unsafe-inline'"],'script-src':["'none'"]}}}));
  app.use(cors({origin:webOrigin || config?.WEB_ORIGIN,credentials:true,allowedHeaders:['Content-Type','X-CSRF-Token','X-Order-Token','Idempotency-Key']}));
  app.get('/api/v1/health',(request,response)=>response.json({status:'ok'}));
  app.get('/api/v1/ready',async(request,response)=>{
    try{await checkDatabase();response.json({status:'ready'});}
    catch{response.status(503).json({status:'unavailable'});}
  });
  let store,auth,orders,integrations;
  if(database){
    store=createStore(database);auth=authMiddleware(store,config);orders=orderService(store,config);integrations=integrationService(store,config,orders);
    app.post('/api/v1/webhooks/stripe',express.raw({type:'application/json',limit:'256kb'}),async(request,response)=>{await integrations.stripeWebhook(request.body,request.get('stripe-signature'));response.json({received:true});});
    app.post('/api/v1/webhooks/shipping',express.raw({type:'application/json',limit:'64kb'}),async(request,response)=>{await integrations.shippingWebhook(request.body,request.get('x-shipping-signature'));response.json({received:true});});
  }
  app.use(express.json({limit:'100kb'}));
  if(database){
    app.use('/api/v1',rateLimit(store,{scope:'api',limit:600,seconds:60}),auth.load,auth.csrf);
    app.get('/api/v1/config',(request,response)=>response.json({
      name:config.STORE_NAME,email:config.STORE_EMAIL,currency:config.CURRENCY,language:config.LANGUAGE,
      currencies:config.rates,languages:config.MULTI_LANGUAGE?['en','ar']:[config.LANGUAGE],
      shippingFeeMinor:config.SHIPPING_FEE_MINOR,taxBps:config.TAX_BPS,returnWindowDays:config.RETURN_WINDOW_DAYS,
      paymentMethods:config.PAYMENT_PROVIDER==='stripe'?['cod','stripe']:['cod'],
      imagekit:{
        enabled:Boolean(config.IMAGEKIT_PUBLIC_KEY && config.IMAGEKIT_URL_ENDPOINT),
        publicKey:config.IMAGEKIT_PUBLIC_KEY,
        urlEndpoint:config.IMAGEKIT_URL_ENDPOINT,
        imagekitId:config.IMAGEKIT_ID || ''
      },
    }));
    app.use('/api/v1/auth',authRoutes(store,config,auth));
    app.use('/api/v1/catalog',catalogRoutes(store));
    app.use('/api/v1/cart',cartRoutes(store,auth));
    app.use('/api/v1/orders',orderRoutes(store,config,orders,integrations));
    app.use('/api/v1/inventory',inventoryRoutes(store));
    app.use('/api/v1/admin',adminRoutes(store,config));
    app.use('/api/v1/uploads',uploadRoutes(config));
    app.get('/api/v1/events',rateLimit(store,{scope:'events',limit:20,seconds:60}),(request,response)=>{
      if(!events)return response.status(503).json({error:{code:'EVENTS_UNAVAILABLE',message:'Live updates are temporarily unavailable.'}});
      if(events.listenerCount('change')>=200)return response.status(503).end();
      response.set({'Content-Type':'text/event-stream','Cache-Control':'no-store','X-Accel-Buffering':'no'});response.flushHeaders();
      response.write('retry: 5000\n\n');
      const listener=id=>response.write('event: inventory\ndata: '+JSON.stringify({id})+'\n\n');
      events.on('change',listener);
      const heartbeat=setInterval(()=>response.write(': heartbeat\n\n'),20000);
      request.on('close',()=>{clearInterval(heartbeat);events.off('change',listener);});
    });
  }
  app.use((request,response)=>response.status(404).json({error:{code:'NOT_FOUND',message:'Endpoint not found.'}}));
  app.use((error,request,response,next)=>{
    if(response.headersSent)return next(error);
    let status=500,code='INTERNAL_ERROR',message='Something went wrong. Please try again.';
    if(error instanceof AppError){status=error.status;code=error.code;message=error.message;}
    else if(['entity.parse.failed','request.aborted','request.size.invalid'].includes(error.type)){status=400;code='INVALID_REQUEST';message='Invalid request body.';}
    else if(error.type==='entity.too.large'){status=413;code='INVALID_REQUEST';message='Request body is too large.';}
    else if(['charset.unsupported','encoding.unsupported'].includes(error.type)){status=415;code='INVALID_REQUEST';message='Unsupported request encoding.';}
    else if(error.name==='SequelizeUniqueConstraintError' || error.original?.code==='23505'){status=409;code='ALREADY_EXISTS';message='This value is already in use.';}
    else if(error.name==='SequelizeForeignKeyConstraintError'){status=409;code='REFERENCE_CONFLICT';message='This record is referenced or no longer available.';}
    else if(['40P01','40001','55P03'].includes(error.original?.code)){status=409;code='CONCURRENT_CHANGE';message='Another update is in progress. Please retry.';}
    if(status>=500)logger.error('Request failed',{requestId:request.id,...safeError(error)});
    response.status(status).json({error:{code,message,requestId:request.id}});
  });
  return app;
}

import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
spawnSync(process.execPath,[path.join(import.meta.dirname,'build.js')],{stdio:'inherit'});
const root=path.resolve(import.meta.dirname,'../dist');
const backend=new URL(process.env.API_ORIGIN || 'http://127.0.0.1:4000');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png'};
http.createServer(async(request,response)=>{
  if(request.url.startsWith('/api/')){
    const proxy=http.request(new URL(request.url,backend),{method:request.method,headers:{...request.headers,host:backend.host}},upstream=>{
      response.writeHead(upstream.statusCode,upstream.headers);upstream.pipe(response);
    });
    proxy.on('error',()=>{if(!response.headersSent)response.writeHead(502,{'Content-Type':'application/json'});response.end(JSON.stringify({error:{message:'API is unavailable. Start the backend.'}}));});
    request.pipe(proxy);request.on('close',()=>{if(!request.complete)proxy.destroy();});return;
  }
  try{
    const pathname=decodeURIComponent(new URL(request.url,'http://localhost').pathname);
    const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
    if(!file.startsWith(root+path.sep))throw new Error();
    const body=await readFile(file);response.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});response.end(body);
  }catch{response.writeHead(404);response.end('Not found');}
}).listen(3000,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:3000'));


const backend=new URL(process.env.API_ORIGIN || 'http://127.0.0.1:4000');
if(process.env.VERCEL && backend.protocol!=='https:')throw new Error('API_ORIGIN must use HTTPS on Vercel');
if(backend.pathname!=='/' || backend.search || backend.hash || backend.username || backend.password)throw new Error('API_ORIGIN must be an origin');
export const config={
  buildCommand:'npm run build',outputDirectory:'dist',framework:null,
  rewrites:[{source:'/api/:path*',destination:backend.origin+'/api/:path*'}],
  headers:[{source:'/(.*)',headers:[
    {key:'X-Content-Type-Options',value:'nosniff'},{key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},
    {key:'X-Frame-Options',value:'DENY'},
    {key:'Content-Security-Policy',value:"default-src 'self'; script-src 'self'; style-src 'self' https://cdn.jsdelivr.net; img-src 'self' https: data:; connect-src 'self' https://upload.imagekit.io; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"},
    {key:'Permissions-Policy',value:'camera=(self), microphone=(), geolocation=()'}
  ]}],
};

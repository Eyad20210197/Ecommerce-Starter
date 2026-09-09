import test from 'node:test';
import assert from 'node:assert/strict';
import {readEnv,readDatabaseEnv} from '../src/config/env.js';
import {hashPassword,verifyPassword,escapeHtml} from '../src/shared/security.js';
import {convertMinor} from '../src/shared/money.js';
import {verifySignature} from '../src/features/integrations/service.js';
import {createHmac} from 'node:crypto';
const env={WEB_ORIGIN:'http://localhost:3000',DATABASE_URL:'postgres://user:password@localhost/store'};
test('configuration validates origin, database and production HTTPS',()=>{
 assert.equal(readEnv({...env,WEB_ORIGIN:'http://localhost:3000/'}).WEB_ORIGIN,'http://localhost:3000');
 for(const value of ['ftp://example.com','https://example.com/path','not a url'])assert.throws(()=>readEnv({...env,WEB_ORIGIN:value}));
 for(const value of ['postgres://','private-secret'])assert.throws(()=>readEnv({...env,DATABASE_URL:value}),error=>!error.message.includes(value));
 assert.throws(()=>readEnv({...env,NODE_ENV:'production'}));
 assert.ok(readDatabaseEnv({DATABASE_URL:env.DATABASE_URL}));
});
test('password hashes are salted and verify only the correct password',async()=>{
 const a=await hashPassword('correct-password-123'),b=await hashPassword('correct-password-123');
 assert.notEqual(a,b);assert.equal(await verifyPassword('correct-password-123',a),true);assert.equal(await verifyPassword('wrong-password-123',a),false);
});
test('currency conversion respects fractional digits and configured currency allowlist',()=>{
 const config=readEnv({...env,MULTI_CURRENCY:'true',CURRENCY_RATES:'{"EUR":0.9,"JPY":150}'});
 assert.equal(convertMinor(1000,'EUR',config),900);assert.equal(convertMinor(1000,'JPY',config),1500);
 assert.throws(()=>convertMinor(1000,'GBP',config));
 assert.throws(()=>readEnv({...env,CURRENCY_RATES:'{"EUR":-1}'}));
});
test('HTML escaping and webhook HMAC reject injection, tampering and stale events',()=>{
 assert.equal(escapeHtml('<script>'), '&lt;script&gt;');
 const secret='secret';const body=Buffer.from('{"ok":true}');const time=String(Math.floor(Date.now()/1000));
 const hash=createHmac('sha256',secret).update(time+'.').update(body).digest('hex');
 assert.equal(verifySignature(body,time+'.'+hash,secret),true);
 assert.equal(verifySignature(Buffer.from('{}'),time+'.'+hash,secret),false);
 assert.equal(verifySignature(body,'1.'+hash,secret),false);
});
test('ImageKit upload authentication parameters generate valid HMAC-SHA1 signature',()=>{
  const privateKey = 'private_test123';
  const token = 'token-uuid-123';
  const expire = 1725850000;
  const expectedSig = createHmac('sha1', privateKey).update(token + String(expire)).digest('hex');
  assert.ok(expectedSig && expectedSig.length === 40);
  assert.equal(createHmac('sha1', privateKey).update(token + String(expire)).digest('hex'), expectedSig);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './app.js';
import { readEnv } from './config/env.js';
async function withServer(checkDatabase, run) {
  const server = createApp({ webOrigin: 'http://localhost:3000', checkDatabase }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try { await run('http://127.0.0.1:' + server.address().port); }
  finally { await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
}
test('health, readiness and unknown endpoints', async () => {
  await withServer(async () => {}, async url => {
    assert.equal((await fetch(url + '/api/v1/health')).status, 200);
    assert.equal((await fetch(url + '/api/v1/ready')).status, 200);
    assert.equal((await fetch(url + '/missing')).status, 404);
  });
});
test('database outage keeps liveness and hides database details', async () => {
  await withServer(async () => { throw new Error('private connection'); }, async url => {
    const response = await fetch(url + '/api/v1/ready');
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { status: 'unavailable' });
    assert.equal((await fetch(url + '/api/v1/health')).status, 200);
  });
});
test('malformed JSON is a safe client error', async () => {
  await withServer(async () => {}, async url => {
    const response = await fetch(url + '/missing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error.code, 'INVALID_REQUEST');
  });
});
test('invalid configuration does not leak secrets', () => {
  assert.throws(() => readEnv({ DATABASE_URL: 'secret' }), error => {
    assert.match(error.message, /DATABASE_URL/);
    assert.ok(!error.message.includes('secret'));
    return true;
  });
});

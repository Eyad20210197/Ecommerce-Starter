import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('storefront build contains brand identity and no environment secret file',async()=>{
 const html=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');
 assert.ok(!html.includes('{{STORE_NAME}}'));assert.ok(html.includes('integrity="sha384-'));
 const brand=await readFile(new URL('../dist/brand.js',import.meta.url),'utf8');
 assert.ok(!brand.includes('API_ORIGIN'));assert.ok(!brand.includes('SECRET'));
});


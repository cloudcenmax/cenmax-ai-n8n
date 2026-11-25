import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {connection, availableModels} from '../lib/connections.mjs';
import {subscriptionFetch} from '../lib/transport.mjs';
import {API, form} from '../lib/oauth.mjs';
import {cenmaxModelClass} from '../lib/model-class.mjs';
const require = createRequire(import.meta.url);
const json = (body, status=200) => new Response(JSON.stringify(body), {status, headers:{'content-type':'application/json'}});
const reference = 'a'.repeat(64);

test('actual n8n node and credential exports match package manifest', () => {
  const {CenmaxAiChatModel} = require('../nodes/CenmaxAiChatModel.node.js');
  const {CenmaxAiOAuth} = require('../credentials/CenmaxAiOAuth.credentials.js');
  const node = new CenmaxAiChatModel();
  assert.deepEqual(node.description.outputs, ['ai_languageModel']);
  assert.equal(node.description.credentials[0].name, new CenmaxAiOAuth().name);
  assert.equal(typeof node.supplyData, 'function');
  assert.equal(typeof node.methods.loadOptions.getModels, 'function');
});

test('model tracing and serialization expose only the selected public Cenmax AI identity', () => {
  class Model { constructor(fields) {Object.assign(this,fields);} }
  const PublicModel=cenmaxModelClass(Model);
  const model=new PublicModel({model:'pro',temperature:0.2,maxTokens:100,clientConfig:{apiKey:'private-test'}});
  assert.equal(PublicModel.lc_name(),'CenmaxAIChatModel');
  assert.equal(model._llmType(),'cenmax_ai');
  assert.equal(model.getLsParams().ls_provider,'cenmax-ai');
  assert.equal(model.identifyingParams().model,'pro');
  assert.doesNotMatch(JSON.stringify(model),/private-test|clientConfig|openai/i);
});

test('revocation accepts successful array and empty bodies but retains response bounds', async () => {
  for (const response of [json([]), new Response(null,{status:204}), new Response('not-json',{status:200})]) {
    assert.deepEqual(await form('/oauth/revoke',{token:'access-test'},async()=>response),{});
  }
  await assert.rejects(form('/oauth/revoke',{token:'access-test'},async()=>new Response('x'.repeat(1024*1024+1),{status:200})));
});

test('logout removes the stored session when the public revoke endpoint returns arrays', async () => {
  const root=await fs.mkdtemp(path.join(await fs.realpath(os.tmpdir()), 'cenmax-n8n-test-'));
  let calls=0;
  const store=connection(reference,{root,fetcher:async()=>{calls++;return json([]);}});
  try {
    await store.locked(()=>store.write({accessToken:'access-test',refreshToken:'refresh-test',expiresAt:Date.now()+3600000}));
    await store.logout();
    assert.equal(calls,2);
    await assert.rejects(fs.stat(store.file));
  } finally {await fs.rm(root,{recursive:true,force:true});}
});

test('connection references are unguessable-format capabilities without path traversal', () => {
  for (const value of ['pro', '../credentials', 'a'.repeat(63), 'A'.repeat(64), '', null]) assert.throws(() => connection(value));
  assert.match(connection(reference).file, /[a-f0-9]{64}\.json$/);
  assert.notEqual(connection(reference).file, connection('b'.repeat(64)).file);
});

test('cross-instance refresh rotates only once and files remain private', async () => {
  const root=await fs.mkdtemp(path.join(await fs.realpath(os.tmpdir()), 'cenmax-n8n-test-'));
  let calls=0;
  const fetcher=async()=>{calls++; return json({access_token:'access-test',refresh_token:'refresh-test',token_type:'bearer',expires_in:3600});};
  const first=connection(reference,{root,fetcher});
  try {
    await first.locked(()=>first.write({accessToken:'old-test',refreshToken:'old-refresh-test',expiresAt:0}));
    assert.deepEqual(await Promise.all([first.accessToken(),connection(reference,{root,fetcher}).accessToken()]),['access-test','access-test']);
    assert.equal(calls,1);
    assert.equal((await fs.stat(first.file)).mode & 0o777,0o600);
    assert.notEqual((await fs.readFile(first.file,'utf8')).includes(reference),true);
  } finally {await fs.rm(root,{recursive:true,force:true});}
});

test('uncertain refresh never replays the spent credential', async () => {
  const root=await fs.mkdtemp(path.join(await fs.realpath(os.tmpdir()), 'cenmax-n8n-test-'));
  let calls=0;
  const store=connection(reference,{root,fetcher:async()=>{calls++;throw new Error('private-test');}});
  try {
    await store.locked(()=>store.write({accessToken:'old-test',refreshToken:'old-refresh-test',expiresAt:0}));
    await assert.rejects(store.accessToken()); await assert.rejects(store.accessToken()); assert.equal(calls,1);
  } finally {await fs.rm(root,{recursive:true,force:true});}
});

test('transport rejects alternate destinations and injects token only at dispatch', async () => {
  let calls=0;
  const transport=subscriptionFetch({accessToken:async()=> 'access-test'},'pro',async(url,init)=>{
    calls++; assert.equal(url,`${API}/chat/completions`); assert.equal(init.redirect,'error');
    assert.equal(init.headers.Authorization,'Bearer access-test');
    return json({model:'pro',choices:[{message:{content:'Cenmax AI'}}]});
  });
  for(const url of ['https://attacker.invalid/app/v1/chat/completions',`${API}/models`,`${API}/chat/completions?redirect=1`]) await assert.rejects(transport(url,{method:'POST',body:'{}'}));
  assert.equal(calls,0);
  const response=await transport(`${API}/chat/completions`,{method:'POST',headers:{Authorization:'Bearer placeholder'},body:JSON.stringify({model:'pro',messages:[{role:'user',content:'Hello'}]})});
  assert.equal(response.status,200); assert.equal(calls,1);
  await assert.rejects(transport(`${API}/chat/completions`,{method:'POST',body:JSON.stringify({model:'worker',messages:[{role:'user',content:'Hello'}]})}));
});

test('refresh generation is retired on disk before a single-use grant is dispatched', async () => {
  const root=await fs.mkdtemp(path.join(await fs.realpath(os.tmpdir()), 'cenmax-n8n-test-'));
  const store=connection(reference,{root,fetcher:async()=>{
    assert.deepEqual(JSON.parse(await fs.readFile(store.file,'utf8')),{refreshInFlight:true});
    await assert.rejects(connection(reference,{root}).read());
    return json({access_token:'access-test',refresh_token:'refresh-test',token_type:'bearer',expires_in:3600});
  }});
  try {
    await store.locked(()=>store.write({accessToken:'old-test',refreshToken:'old-refresh-test',expiresAt:0}));
    assert.equal(await store.accessToken(),'access-test');
  } finally {await fs.rm(root,{recursive:true,force:true});}
});

test('transport never displays raw service failures or private response headers', async () => {
  const transport=subscriptionFetch({accessToken:async()=> 'access-test'},'pro',async()=>new Response('private-test',{status:500,headers:{'x-private':'private-test'}}));
  const response=await transport(`${API}/chat/completions`,{method:'POST',body:JSON.stringify({model:'pro',messages:[{role:'user',content:'Hello'}]})});
  assert.equal(response.status,502);assert.equal(response.headers.get('x-private'),null);assert.doesNotMatch(await response.text(),/private-test/);
});

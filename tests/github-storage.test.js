import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GitHubStorage,normalizeGitHubConfig,encodeContent,decodeContent} from '../js/github-storage.js';
import {loadConnectionSettings,saveConnectionSettings} from '../js/connection-settings.js';
const config={owner:'greatthursday',repo:'campaign-ledger-data',branch:'main',path:'campaign.json'};
const sample=()=>JSON.parse(readFileSync(new URL('../data/sample-campaign.json',import.meta.url)));
const A='a'.repeat(40),B='b'.repeat(40),C='c'.repeat(40);
const reply=(status,data)=>({status,ok:status>=200&&status<300,json:async()=>data});
function server({exists=true,privateRepo=true,campaign=sample()}={}){
 const s={exists,privateRepo,campaign,sha:A,calls:[],putError:null,readError:null,networkPut:false};
 s.fetch=async(url,options)=>{
  s.calls.push({url,options});
  assert.ok(url.startsWith('https://api.github.com/repos/greatthursday/campaign-ledger-data'));
  if(!url.includes('/contents/'))return reply(200,{private:s.privateRepo});
  if(options.method==='PUT'){
   if(s.putError)return reply(s.putError,{});
   const body=JSON.parse(options.body);
   if((s.exists&&body.sha!==s.sha)||(!s.exists&&body.sha))return reply(409,{});
   s.campaign=JSON.parse(decodeContent(body.content));s.exists=true;s.sha=B;
   if(s.networkPut)throw new Error('secret-details-must-not-leak');
   return reply(200,{content:{sha:B},commit:{sha:C}});
  }
  if(s.readError)return reply(s.readError,{});
  if(!s.exists)return reply(404,{});
  return reply(200,{type:'file',sha:s.sha,size:2000,encoding:'base64',content:typeof s.campaign==='string'?encodeContent(s.campaign):encodeContent(JSON.stringify(s.campaign))});
 };
 return s;
}
const client=s=>new GitHubStorage(config,'synthetic-test-token',{fetchImpl:s.fetch});
test('load validates private remote JSON and records its SHA',async()=>{const s=server(),c=client(s);const result=await c.loadCampaign();assert.deepEqual(result.campaign,sample());assert.equal(c.sha,A);assert.equal(c.loaded,true);assert.equal(s.calls[0].options.headers.Authorization,'Bearer synthetic-test-token');assert.equal(s.calls[0].options.redirect,'error');assert.equal(s.calls[0].options.credentials,'omit');});
test('save explicitly checks remote SHA then commits the whole Unicode campaign',async()=>{const s=server(),c=client(s);const {campaign}=await c.loadCampaign();campaign.name='Aventure — ✧ Étoile';const r=await c.saveCampaign(campaign);const body=JSON.parse(s.calls.at(-1).options.body);assert.equal(body.sha,A);assert.equal(body.branch,'main');assert.deepEqual(s.campaign,campaign);assert.equal(r.sha,B);assert.equal(c.sha,B);assert.equal(s.calls.at(-2).options.method,'GET');});
test('second save uses returned SHA, never a stale file version',async()=>{const s=server(),c=client(s),{campaign}=await c.loadCampaign();await c.saveCampaign(campaign);campaign.notes='another change';await c.saveCampaign(campaign);assert.equal(JSON.parse(s.calls.at(-1).options.body).sha,B);});
test('remote changes stop before PUT and preserve the old anchor',async()=>{const s=server(),c=client(s),{campaign}=await c.loadCampaign();s.sha=C;await assert.rejects(()=>c.saveCampaign(campaign),{code:'CONFLICT'});assert.equal(s.calls.filter(x=>x.options.method==='PUT').length,0);assert.equal(c.sha,A);});
test('remote deletion after load is a conflict, not file recreation',async()=>{const s=server(),c=client(s),{campaign}=await c.loadCampaign();s.exists=false;await assert.rejects(()=>c.saveCampaign(campaign),{code:'CONFLICT'});assert.ok(!s.calls.some(x=>x.options.method==='PUT'));});
test('race after preflight is rejected by GitHub SHA check',async()=>{const s=server(),c=client(s),{campaign}=await c.loadCampaign();s.putError=409;await assert.rejects(()=>c.saveCampaign(campaign),{code:'CONFLICT'});assert.equal(c.sha,A);});
test('new-file initialization never sends a SHA or overwrites an existing file',async()=>{const s=server({exists:false}),c=client(s);await assert.rejects(()=>c.loadCampaign(),{code:'FILE_NOT_FOUND'});assert.equal(c.loaded,false);await c.initializeCampaign(sample());assert.equal(c.sha,B);assert.ok(!Object.hasOwn(JSON.parse(s.calls.at(-1).options.body),'sha'));await assert.rejects(()=>c.initializeCampaign(sample()),{code:'CONFLICT'});});
test('initialization collision between GET and PUT preserves local data',async()=>{const s=server({exists:false}),c=client(s);s.putError=422;await assert.rejects(()=>c.initializeCampaign(sample()),{code:'CONFLICT'});assert.equal(c.loaded,false);});
test('existing files cannot be saved without a successful load',async()=>{const s=server(),c=client(s);await assert.rejects(()=>c.saveCampaign(sample()),{code:'LOAD_REQUIRED'});assert.equal(s.calls.length,0);});
test('public repositories are rejected for reads and writes',async()=>{const s=server({privateRepo:false}),c=client(s);await assert.rejects(()=>c.loadCampaign(),{code:'PRIVATE_REQUIRED'});await assert.rejects(()=>c.initializeCampaign(sample()),{code:'PRIVATE_REQUIRED'});assert.ok(!s.calls.some(x=>x.options.method==='PUT'));});
test('repository becoming public after load stops a save',async()=>{const s=server(),c=client(s),{campaign}=await c.loadCampaign();s.privateRepo=false;await assert.rejects(()=>c.saveCampaign(campaign),{code:'PRIVATE_REQUIRED'});assert.equal(c.sha,A);});
test('invalid remote JSON never becomes a loaded baseline',async()=>{const s=server({campaign:'{"broken":true}'}),c=client(s);await assert.rejects(()=>c.loadCampaign(),{code:'INVALID_CAMPAIGN'});assert.equal(c.loaded,false);});
test('invalid local ledger never reaches the network',async()=>{const s=server(),c=client(s);await assert.rejects(()=>c.saveCampaign({schemaVersion:99}));assert.equal(s.calls.length,0);});
test('a different campaign ID cannot overwrite a loaded file',async()=>{const s=server(),c=client(s),{campaign}=await c.loadCampaign();campaign.id='different';campaign.characters.forEach(ch=>ch.campaignId=campaign.id);campaign.events.forEach(e=>e.campaignId=campaign.id);await assert.rejects(()=>c.saveCampaign(campaign),{code:'CAMPAIGN_MISMATCH'});});
test('token and API errors are not leaked through serialized client or errors',async()=>{const s=server(),c=client(s);assert.equal(JSON.stringify(c),'{}');for(const [status,code] of [[401,'AUTH'],[403,'PERMISSION'],[429,'RATE_LIMIT'],[500,'GITHUB']]){s.readError=status;await assert.rejects(()=>c.loadCampaign(),error=>error.code===code&&!error.message.includes('synthetic-test-token'));}});
test('missing repository is distinct from missing campaign file',async()=>{const c=new GitHubStorage(config,'synthetic-test-token',{fetchImpl:async()=>reply(404,{})});await assert.rejects(()=>c.loadCampaign(),{code:'NOT_FOUND'});});
test('unconfirmed PUT leaves SHA intact and the next attempt detects any committed change',async()=>{const s=server(),c=client(s),{campaign}=await c.loadCampaign();s.networkPut=true;await assert.rejects(()=>c.saveCampaign(campaign),error=>error.code==='SAVE_UNCERTAIN'&&!error.message.includes('secret-details'));assert.equal(c.sha,A);s.networkPut=false;await assert.rejects(()=>c.saveCampaign(campaign),{code:'CONFLICT'});});
test('concurrent operations are blocked; disconnect forgets credentials',async()=>{const s=server();let release;const gate=new Promise(resolve=>release=resolve);const c=new GitHubStorage(config,'synthetic-test-token',{fetchImpl:async(...args)=>{await gate;return s.fetch(...args);}});const pending=c.loadCampaign();await assert.rejects(()=>c.loadCampaign(),{code:'BUSY'});assert.throws(()=>c.disconnect(),{code:'BUSY'});release();await pending;c.disconnect();await assert.rejects(()=>c.loadCampaign(),{code:'TOKEN'});assert.throws(()=>c.fork(),{code:'TOKEN'});assert.equal(c.loaded,false);});
test('load forks are isolated so cancelling a reload cannot advance the active save anchor',async()=>{const s=server(),c=client(s);await c.loadCampaign();s.sha=C;const candidate=c.fork();await candidate.loadCampaign();assert.equal(c.sha,A);assert.equal(candidate.sha,C);candidate.disconnect();assert.equal(c.sha,A);});
test('save freezes a validated snapshot before asynchronous work',async()=>{const s=server(),c=client(s),{campaign}=await c.loadCampaign();const pending=c.saveCampaign(campaign);campaign.name='edited while saving';await pending;assert.notEqual(s.campaign.name,campaign.name);assert.equal(s.campaign.name,sample().name);});
test('target config rejects URLs, source repository, traversal and invalid branches',()=>{for(const changes of [{repo:'https://github.com/x/y'},{repo:'campaign-ledger'},{path:'../campaign.json'},{path:'.github/workflows/x.json'},{branch:'main..bad'},{branch:'bad branch'},{path:'campaign.txt'}])assert.throws(()=>normalizeGitHubConfig({...config,...changes}),{code:'CONFIG'});assert.equal(normalizeGitHubConfig({...config,branch:'campaign/history',path:'data/campaign.json'}).path,'data/campaign.json');});
test('Unicode encoding roundtrips, invalid content and oversized data are rejected',()=>{const text='Callista — Éléonore 🧙';assert.equal(decodeContent(encodeContent(text)),text);assert.throws(()=>decodeContent('%%%'),{code:'FORMAT'});assert.throws(()=>encodeContent('x'.repeat(1024*1024+1)),{code:'SIZE'});});
test('only non-secret configuration fields survive browser settings save',()=>{const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};saveConnectionSettings(storage,{...config,token:'should-never-persist',sha:A});assert.deepEqual(loadConnectionSettings(storage),config);assert.ok(![...data.values()].join('').includes('should-never-persist'));assert.ok(![...data.values()].join('').includes(A));});
test('request timeouts are sanitized and release the operation lock',async()=>{const c=new GitHubStorage(config,'synthetic-test-token',{timeoutMs:5,fetchImpl:(_url,options)=>new Promise((_resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new Error('internal details'))))});await assert.rejects(()=>c.loadCampaign(),error=>error.code==='NETWORK'&&!error.message.includes('internal details'));c.disconnect();});
test('unreadable success response never claims a confirmed save',async()=>{const s=server(),base=s.fetch;s.fetch=async(url,opts)=>opts.method==='PUT'?{ok:true,status:200,json:async()=>{throw new Error('parse failure');}}:base(url,opts);const c=client(s),{campaign}=await c.loadCampaign();await assert.rejects(()=>c.saveCampaign(campaign),{code:'SAVE_UNCERTAIN'});assert.equal(c.sha,A);});
test('browser fetch is bound to the global receiver, including forked reload sessions',async()=>{const s=server();function browserFetch(url,options){assert.equal(this,globalThis,'Web browser fetch requires its global receiver');return s.fetch(url,options);}const c=new GitHubStorage(config,'synthetic-test-token',{fetchImpl:browserFetch});await c.loadCampaign();const fork=c.fork();await fork.loadCampaign();assert.equal(c.loaded,true);assert.equal(fork.loaded,true);});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {authorize,identifySafeReceipt,compatibleControlSha,execute,REPO,
 TITLE,SCHEMA,OUTPUT,SOURCE_SHA,CHECKPOINT_SHA}
 from '../tools/w03-gmh-seven-collection-time-a.mjs';
import {sanitize,publish}
 from '../tools/w03-gmh-seven-collection-time-report.mjs';
import {MANIFEST_SHA,PRIVATE_SHA}
 from '../tools/w03-gmh-seven-public-compat-a.mjs';

const CONTROL='a'.repeat(40),REQUEST='8d8cc82e-987b-434b-a6b6-87991491cd4b';
const CHAT='f73443d4-24f4-409e-bbf0-acdd37743e4c';
const req=()=>({schema:SCHEMA,operation:TITLE,requestId:REQUEST,chatId:CHAT,
 controlRepository:REPO,controlSourceSha:CONTROL,candidateSourceSha:SOURCE_SHA,
 expectedManifestSha256:MANIFEST_SHA,expectedCheckpointSha256:CHECKPOINT_SHA,
 expectedPrivateArtifactSha256:PRIVATE_SHA});
const event=()=>({repository:{full_name:REPO,private:true},
 sender:{login:'ansqhd5774-Choi'},issue:{number:2350,title:TITLE,
 user:{login:'ansqhd5774-Choi'},labels:[{name:'pc-writer-b-install'}],
 body:JSON.stringify(req())}});
const env=()=>({GITHUB_REPOSITORY:REPO,GITHUB_EVENT_NAME:'issues',
 GITHUB_EVENT_ACTION:'opened',GITHUB_RUN_ATTEMPT:'1',
 GITHUB_ACTOR:'ansqhd5774-Choi',GITHUB_SHA:CONTROL,
 GITHUB_RUN_ID:'44286478888',GITHUB_WORKSPACE:'C:\\runner\\work'});
const sample=()=>({
 status:'GMH_SEVEN_SOURCE_REQUEST_TIME_ATTESTED_READONLY',
 observationDate:'2026-11-13',
 rawManifestSha256:MANIFEST_SHA,checkpointSha256:CHECKPOINT_SHA,
 sourceStoredAt:'2026-11-17T12:00:00.000Z',
 sourceTimestampBasis:'MANIFEST_GET_REQUEST_AT',
 sourceTimestampIsFileCommitTime:false,
 verifiedSymbols:14,checkedRawPages:30,coveringPages:14,
 rawFilesRehashedInMemory:true,
 publicationAuthorized:false,upstreamCommercialRightsVerified:false,
 derivedLicenseVerified:false,providerCalls:0,sqliteWrites:0,d1Writes:0,
 publicWrites:0,hiddenClose:999999,rawVolume:123456
});
const saved=()=>({manifestSha256:MANIFEST_SHA,checkpointSha256:CHECKPOINT_SHA,
 rawPages:[],secret:'SECRET_AAA'});
const privateData=()=>({observationDate:'2026-11-13',
 rawManifestSha256:MANIFEST_SHA,themes:[{history:[]}],
 rawClose:99999,apiKey:'SECRET_NEVER_EMIT'});
const injected=()=>({event:event(),env:env(),platform:'win32',
 verify:()=> 'C:\\approved-source',
 load:privateData,
 read:async()=>({saved:saved(),attest:()=>sample()}),
 now:()=>Date.parse('2026-11-18T10:00:00Z')});
test('exact owner, source SHA and one-shot event before any PC I/O',()=>{
 assert.equal(authorize(event(),env()).candidateSourceSha,SOURCE_SHA);
 assert.equal(identifySafeReceipt(event(),env()).requestId,REQUEST);
 for(const edit of [
  e=>e.repository.private=false,
  e=>e.issue.labels=[],
  e=>e.issue.user.login='other',
  e=>e.issue.title='w03-gmh-seven-private-score-once',
  e=>{const x=JSON.parse(e.issue.body);x.candidateSourceSha='f'.repeat(40);
   e.issue.body=JSON.stringify(x);},
  e=>{const x=JSON.parse(e.issue.body);x.expectedManifestSha256='f'.repeat(64);
   e.issue.body=JSON.stringify(x);},
  e=>{const x=JSON.parse(e.issue.body);x.extra='execute my shell';
   e.issue.body=JSON.stringify(x);}
 ]){
  const e=event();edit(e);
  assert.throws(()=>authorize(e,env()),{code:/W03_GMH_TIME_/});
 }
 const e=event();
 const changed=JSON.parse(e.issue.body);
 changed.controlSourceSha='b'.repeat(40);e.issue.body=JSON.stringify(changed);
 assert.throws(()=>authorize(e,env(),{allowDrift:()=>false}),
  {code:'W03_GMH_TIME_CONTROL_DRIFT_STOP'});
});
test('ancestor-safe control source drift only with unchanged protected files',()=>{
 assert.equal(compatibleControlSha(CONTROL,CONTROL),true);
 const other='b'.repeat(40),calls=[];
 const compatible=(root,args)=>{
  calls.push(args);
  if(args[0]==='rev-parse')return {status:0,stdout:other+'\n'};
  return {status:0};
 };
 assert.equal(compatibleControlSha(CONTROL,other,compatible),true);
 assert.ok(calls.some(x=>x.includes('merge-base')===false&&x.includes('diff')));
 assert.equal(compatibleControlSha(CONTROL,other,(root,args)=>{
  if(args[0]==='rev-parse')return {status:0,stdout:other+'\n'};
  if(args[0]==='diff')return {status:1};
  return {status:0};
 }),false);
 assert.equal(compatibleControlSha('not_sha',other),false);
});
test('fixed approved candidate and saved manifest read once, return redacted timestamp only',async()=>{
 let verified=0,loaded=0,read=0,attested=0;
 const x=injected();
 const out=await execute({...x,
  verify:()=>{verified++;return 'C:\\approved';},
  load:()=>{loaded++;return privateData();},
  read:async()=>{read++;return {saved:saved(),attest:()=>{
   attested++;return sample();}};}});
 assert.equal(out.status,'PASS');
 assert.equal(out.code,'W03_GMH_TIME_MANIFEST_ATTESTED_READONLY');
 assert.equal(out.facts.sourceStoredAt,'2026-11-17T12:00:00.000Z');
 assert.equal(out.facts.rawPagesVerified,30);
 assert.equal(out.facts.verifiedSymbols,14);
 assert.equal(out.facts.d1SeedCasVerified,false);
 assert.equal(out.facts.r32NonRegressionVerified,false);
 assert.equal(out.rawPricesExposed,false);
 assert.equal(out.providerCalls,0);
 assert.equal(out.d1Writes,0);
 assert.equal(out.publicWrites,0);
 assert.deepEqual([verified,loaded,read,attested],[1,1,1,1]);
 assert.doesNotMatch(JSON.stringify(out),/SECRET|hiddenClose|rawVolume|rawClose|apiKey/);
 assert.equal(sanitize(out,req(),env()).status,'PASS');
});
test('unverified pins, manifest time, mutation effects and unsafe counts stop',async()=>{
 const base=injected();
 const mutation=[
  {...base,load:()=>({...privateData(),rawManifestSha256:'b'.repeat(64)})},
  {...base,read:async()=>({saved:{...saved(),checkpointSha256:'f'.repeat(64)},
   attest:()=>sample()})},
  {...base,read:async()=>({saved:saved(),attest:()=>({...sample(),
   sourceStoredAt:'2026-11-19T12:00:00.000Z'})})},
  {...base,read:async()=>({saved:saved(),attest:()=>({...sample(),
   providerCalls:1})})},
  {...base,read:async()=>({saved:saved(),attest:()=>({...sample(),
   checkedRawPages:31})})}
 ];
 for(const x of mutation)await assert.rejects(execute(x),/W03_GMH_TIME_/);
 const legit=await execute(base);
 for(const f of [
  {d1Writes:1},{rightsVerified:true},{rawPagesVerified:29},
  {privateArtifactSha256:'f'.repeat(64)}
 ]){
  const tampered={...legit,facts:{...legit.facts,...f}};
  assert.equal(sanitize(tampered,req(),env()).status,'STATE_UNKNOWN');
 }
 assert.equal(sanitize({...legit,rawPricesExposed:true},req(),env()).status,
  'STATE_UNKNOWN');
 assert.equal(sanitize({...legit,status:'STOP',code:'W03_GMH_TIME_SAFE_STOP'},
  req(),env()).status,'STOP');
 assert.equal(sanitize(legit,req(),{...env(),GITHUB_SHA:'b'.repeat(40)},
  {controlCheck:()=>false}).code,'W03_GMH_TIME_CONTROL_DRIFT_STOP');
});
test('one-shot reporter posts exactly two sanitized new files and checks both readbacks',async()=>{
 const out=await execute(injected()),savedPosts=new Map();
 let comments=0;
 const fakeFetch=async(url,options={})=>{
  const base=url.split('?ref=main')[0];
  if(url.endsWith('?ref=main')){
   const v=savedPosts.get(base);
   return v?{status:200,json:async()=>({encoding:'base64',
    content:Buffer.from(v).toString('base64')})}:{status:404};
  }
  if(options.method==='PUT'){
   const body=JSON.parse(options.body);
   savedPosts.set(url,Buffer.from(body.content,'base64'));
   return {status:201};
  }
  if(options.method==='POST'&&url.endsWith('/comments')){
   comments++;
   return {status:201};
  }
  return {status:404};
 };
 const x=await publish({event:event(),env:{...env(),GITHUB_TOKEN:'x'.repeat(40)},
  raw:JSON.stringify({...out,rawSecret:'SHOULD_NOT_LEAK'}),fetchApi:fakeFetch});
 assert.deepEqual(x,{status:'PASS',verified:2,created:2});
 assert.equal(savedPosts.size,2);
 assert.equal(comments,1);
 for(const bytes of savedPosts.values()){
  assert.doesNotMatch(bytes.toString('utf8'),
   /SHOULD_NOT_LEAK|rawClose|SECRET_NEVER_EMIT|hiddenClose|rawVolume/);
 }
});
test('existing B workflow and shared admission limit source scope to the exact W03 route',()=>{
 const wf=readFileSync(new URL(
  '../.github/workflows/pc-writer-b-source-once.yml',import.meta.url),'utf8');
 const required=[TITLE,'w03-gmh-seven-collection-time-preflight.mjs',
  'w03-gmh-seven-collection-time-a.mjs',
  'w03-gmh-seven-collection-time-report.mjs',
  'candidateSourceSha','persist-credentials: false'];
 for(const s of required)assert.ok(wf.includes(s),s);
 assert.ok(!/w03-gmh-seven-collection-time.*Task|Cron|wrangler/i.test(wf));
});

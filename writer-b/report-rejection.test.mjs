import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {readWriterBLocalResult,uploadWriterBReport,sanitizeWriterBResult} from './report.mjs';
import {ACTOR,CONTROL_REPO,ISSUE_LABEL,ISSUE_TITLE,REQUEST_SCHEMA,
 OPERATION} from './contract.mjs';

const REQUEST_ID='01234567-89ab-4cde-8fab-0123456789ab';
const CHAT_ID='11234567-89ab-4cde-8fab-1123456789ab';
const RUN_ID='42690178086';
const request={schema:REQUEST_SCHEMA,requestId:REQUEST_ID,chatId:CHAT_ID,
 operation:OPERATION,controlRepository:CONTROL_REPO,
 approvalManifestPath:'approvals/writer-updates/example.json',
 approvalManifestSha256:'a'.repeat(64)};
const env={GITHUB_REPOSITORY:CONTROL_REPO,GITHUB_ACTOR:ACTOR,
 GITHUB_EVENT_NAME:'issues',GITHUB_EVENT_ACTION:'opened',
 GITHUB_RUN_ATTEMPT:'1',GITHUB_SHA:'b'.repeat(40),
 GITHUB_RUN_ID:RUN_ID,GITHUB_TOKEN:'fixture-secret-token-never-log'};

function eventFor(requestBody){return {
 repository:{full_name:CONTROL_REPO,private:true},sender:{login:ACTOR},
 issue:{number:1130,title:ISSUE_TITLE,user:{login:ACTOR},
  labels:[{name:ISSUE_LABEL}],body:requestBody}};}
const invalidRequest={...request,chatId:'market-calendar-treasury-annual-r2-20261110',
 fixtureSecret:'MUST_NOT_APPEAR_IN_RECEIPT'};
const invalidEvent=eventFor(JSON.stringify(invalidRequest));
const proof={status:'WRITER_B_SETUP_STOP',code:'WRITER_B_REQUEST_CONTRACT_STOP',
 runId:RUN_ID};

test('report step reads the exact run-local preflight STOP and not an unrelated file',()=>{
 const reads=[];
 const localEnv={...env,RUNNER_TEMP:path.resolve('zgmini-writer-b-run')};
 const rawResult=readWriterBLocalResult({env:localEnv,fsOps:{readFileSync(file){
  reads.push(file);
  if(file.endsWith(`writer-b-preflight-stop-${RUN_ID}.json`))
   return JSON.stringify(proof);
  throw Object.assign(new Error('missing'),{code:'ENOENT'});
 }}});
 assert.equal(JSON.parse(rawResult).code,'WRITER_B_REQUEST_CONTRACT_STOP');
 assert.equal(reads.length,2);
 assert.match(reads[1],new RegExp(`writer-b-preflight-stop-${RUN_ID}\\.json$`));
});

test('authenticated invalid request receives one bounded, no-install receipt',async()=>{
 const calls=[];
 const apiFetch=async(url,options)=>{
  calls.push({url,...options});
  return {status:201};
 };
 const out=await uploadWriterBReport({event:invalidEvent,env,
  rawResult:JSON.stringify(proof),apiFetch});
 assert.deepEqual(out,{status:'WRITER_B_SETUP_STOP',
  code:'WRITER_B_REQUEST_CONTRACT_STOP',
  deliveryStatus:'REQUEST_REJECTED_BEFORE_PC',created:0,verified:0});
 assert.equal(calls.length,1);
 assert.equal(calls[0].method,'POST');
 assert.match(calls[0].url,/\/issues\/1130\/comments$/);
 const body=JSON.parse(calls[0].body).body;
 assert.match(body,/REJECTED_BEFORE_PC/);
 assert.match(body,/PC_INSTALL: NOT_EXECUTED/);
 assert.match(body,/RESULT_PAIR: NOT_CREATED_INVALID_REQUEST/);
 assert.match(body,/RETRY: NO_REEXECUTE/);
 assert.doesNotMatch(body,/MUST_NOT_APPEAR_IN_RECEIPT|fixture-secret|market-calendar/);
 assert.ok(!calls.some(x=>x.method==='PUT'));
});

test('missing or wrong-run preflight proof cannot publish a rejection',async()=>{
 for(const rawResult of ['{}',JSON.stringify({...proof,runId:'1234'}),
  JSON.stringify({...proof,code:'WRITER_B_APPROVAL_PREFLIGHT_UNEXPECTED_STOP'}),
  'invalid-json']){
  let calls=0;
  await assert.rejects(uploadWriterBReport({event:invalidEvent,env,rawResult,
   apiFetch:async()=>{calls++;return {status:201};}}),
  {code:'WRITER_B_REPORT_REJECTION_PROOF_STOP'});
  assert.equal(calls,0);
 }
});

test('unauthenticated issue origin cannot publish even with exact proof',async()=>{
 let calls=0;
 const event=eventFor(JSON.stringify(invalidRequest));
 event.sender.login='other-user';
 await assert.rejects(uploadWriterBReport({event,env,
  rawResult:JSON.stringify(proof),apiFetch:async()=>{calls++;return {status:201};}}),
 {code:'WRITER_B_REPORT_EVENT_STOP'});
 assert.equal(calls,0);
});

test('malformed request JSON never uses the contract rejection receipt',async()=>{
 let calls=0;
 await assert.rejects(uploadWriterBReport({event:eventFor('{'),env,
  rawResult:JSON.stringify(proof),apiFetch:async()=>{calls++;return {status:201};}}),
 {code:'WRITER_B_REPORT_REQUEST_JSON_STOP'});
 assert.equal(calls,0);
});

test('Core idle timeout counts survive safe JSON sanitization; spoofed details never leak',()=>{
 const counts={windowMs:6000,samples:4,readySamples:2,
  activeSamples:2,otherSamples:0,maxReadyStreak:1};
 const raw={status:'WRITER_B_PREFLIGHT_STOP',requestId:REQUEST_ID,
  code:'WRITER_B_CORE_ACTIVE_WINDOW_DEFERRED',
  idleObservation:{...counts,privatePid:'SECRET-PID'}};
 const clean=sanitizeWriterBResult(raw,REQUEST_ID,RUN_ID,'a'.repeat(64));
 assert.deepEqual(clean.idleObservation,counts);
 assert.doesNotMatch(JSON.stringify(clean),/privatePid|SECRET-PID/);
 const spoofed=sanitizeWriterBResult({...raw,
  idleObservation:{...counts,samples:900000,secret:'NEVER-PUBLISH'}},
  REQUEST_ID,RUN_ID,'a'.repeat(64));
 assert.equal(spoofed.idleObservation,undefined);
 assert.equal(spoofed.status,'WRITER_B_PREFLIGHT_STOP');
});

test('Core idle stop publishes identical bounded counts in readback JSON and TXT',async()=>{
 const counts={windowMs:6000,samples:4,readySamples:2,
  activeSamples:2,otherSamples:0,maxReadyStreak:1};
 const files=new Map(),calls=[];
 const apiFetch=async(url,options)=>{
  calls.push(options.method);
  if(options.method==='PUT'){
   files.set(url,JSON.parse(options.body).content);
   return {status:201};
  }
  if(options.method==='GET'){
   const encoded=files.get(url.split('?')[0]);
   return encoded?{status:200,json:async()=>({encoding:'base64',content:encoded})}:{status:404};
  }
  return {status:201};
 };
 const status=await uploadWriterBReport({event:eventFor(JSON.stringify(request)),env,
  rawResult:JSON.stringify({status:'WRITER_B_PREFLIGHT_STOP',requestId:REQUEST_ID,
   code:'WRITER_B_CORE_ACTIVE_WINDOW_DEFERRED',
   idleObservation:{...counts,unsafe:'DO_NOT_EXPOSE'}}),apiFetch});
 assert.equal(status.deliveryStatus,'RESULT_PAIR_READBACK_VERIFIED');
 assert.equal(status.verified,2);
 const texts=[...files.entries()].map(([key,base64])=>
  ({key,content:Buffer.from(base64,'base64').toString('utf8')}));
 assert.equal(texts.length,2);
 const json=JSON.parse(texts.find(x=>x.key.endsWith('.json')).content);
 const txt=texts.find(x=>x.key.endsWith('.txt')).content;
 assert.deepEqual(json.idleObservation,counts);
 assert.match(txt,/IDLE_SAMPLES=4/);
 assert.match(txt,/IDLE_ACTIVE_SAMPLES=2/);
 assert.match(txt,/IDLE_MAX_READY_STREAK=1/);
 assert.doesNotMatch(JSON.stringify(texts),/DO_NOT_EXPOSE/);
 assert.deepEqual(calls,['PUT','GET','PUT','GET','POST']);
});

test('valid request retains two result files, readback and normal comment',async()=>{
 const calls=[];
 const files=new Map();
 const apiFetch=async(url,options)=>{
  calls.push({url,...options});
  if(options.method==='PUT'){
   files.set(url,JSON.parse(options.body).content);
   return {status:201};
  }
  if(options.method==='GET'){
   const encoded=files.get(url.split('?')[0]);
   return encoded?{status:200,json:async()=>({encoding:'base64',content:encoded})}:
    {status:404};
  }
  return {status:201};
 };
 const out=await uploadWriterBReport({event:eventFor(JSON.stringify(request)),env,
  rawResult:JSON.stringify({...proof,code:'WRITER_B_APPROVAL_PREFLIGHT_STOP'}),
  apiFetch});
 assert.equal(out.deliveryStatus,'RESULT_PAIR_READBACK_VERIFIED');
 assert.equal(out.created,2);
 assert.equal(out.verified,2);
 assert.deepEqual(calls.map(x=>x.method),['PUT','GET','PUT','GET','POST']);
 assert.match(JSON.parse(calls[4].body).body,/RESULT_READBACK: 2\/2/);
});

test('rejected request cannot claim delivery if comment POST fails',async()=>{
 let calls=0;
 await assert.rejects(uploadWriterBReport({event:invalidEvent,env,
  rawResult:JSON.stringify(proof),apiFetch:async()=>{calls++;return {status:403};}}),
 {code:'WRITER_B_REPORT_COMMENT_STOP'});
 assert.equal(calls,1);
});

test('bounded last-blocker details are sanitized, never permit raw process data',()=>{
 const counts={windowMs:6000,samples:4,readySamples:0,activeSamples:4,
  otherSamples:0,maxReadyStreak:0};
 const blocker={enabled:true,state:4,instances:1,relatedProcesses:2,
  unknownProcessLines:0,cycleLockPresent:true};
 const raw={status:'WRITER_B_PREFLIGHT_STOP',requestId:REQUEST_ID,
  code:'WRITER_B_CORE_ACTIVE_WINDOW_DEFERRED',idleObservation:{...counts,
   lastBlocker:{...blocker,secret:'do-not-publish'}}};
 const cleaned=sanitizeWriterBResult(raw,REQUEST_ID,RUN_ID,'a'.repeat(64));
 assert.equal(cleaned.idleObservation.lastBlocker,undefined);
 const good=sanitizeWriterBResult({...raw,idleObservation:{...counts,
  lastBlocker:blocker}},REQUEST_ID,RUN_ID,'a'.repeat(64));
 assert.deepEqual(good.idleObservation.lastBlocker,blocker);
 assert.doesNotMatch(JSON.stringify(good),/do-not-publish/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {readWriterBLocalResult,uploadWriterBReport} from './report.mjs';
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

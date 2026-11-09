import test from 'node:test';
import assert from 'node:assert/strict';
import {
 validateR6BReportEvent,sanitizeR6BResult,deliverR6BReport,
 r6BTextResult,
} from './report.mjs';

const uuid='a3b44168-e96e-48b2-b787-10aa1a0e001a';
const chat='d3ac6032-49c1-47e6-98d1-d7adeba91a7c';
const request={schema:'ZGMINI_R6_REGISTERED_DATA_B_REQUEST_V1',
 requestId:uuid,chatId:chat,operation:'employment-r6-registered-data-once',
 approvalManifestSha256:'a'.repeat(64)};
const env={GITHUB_REPOSITORY:'ansqhd5774-Choi/zgmini-pc-control',
 GITHUB_EVENT_NAME:'issues',GITHUB_EVENT_ACTION:'opened',
 GITHUB_ACTOR:'ansqhd5774-Choi',GITHUB_RUN_ATTEMPT:'1',
 GITHUB_SHA:'b'.repeat(40),GITHUB_RUN_ID:'42599999999',
 GITHUB_TOKEN:'local-test-token-no-network',R6_B_EFFECT_OUTCOME:'success'};
function event(){return{action:'opened',
 repository:{full_name:env.GITHUB_REPOSITORY,private:true},
 sender:{login:env.GITHUB_ACTOR},issue:{number:1010,title:'pc-employment-r6-registered-data-once',
  user:{login:env.GITHUB_ACTOR},labels:[{name:'pc-writer-b-install'}],
  body:JSON.stringify(request)}};}
function validRaw(){return{schema:'ZGMINI_R6_REGISTERED_DATA_B_RESULT_V1',
 requestId:uuid,status:'SUCCESS',code:'R6_B_COLLECT_PUBLISH_VERIFIED',
 sourceSha:'c'.repeat(40),mode:'ONE_YEAR',
 providerRequests:9,blsRequests:7,dolRequests:2,
 groupResults:[
  {groupName:'BLS_EMPLOYMENT_SITUATION',status:'SUCCESS',providerRequests:1},
  {groupName:'BLS_JOLTS',status:'SUCCESS',providerRequests:1},
  {groupName:'BLS_ECI',status:'SUCCESS',providerRequests:1},
  {groupName:'BLS_STATE_MSA',status:'SUCCESS',providerRequests:1},
  {groupName:'BLS_BED',status:'SUCCESS',providerRequests:3},
  {groupName:'DOL_UI_WEEKLY_CLAIMS',status:'SUCCESS',providerRequests:2}],
 sqlite:'COLLECTOR_RECORDED',publication:'VERIFIED',sourceStoredAt:1794206708243,
 sourceFeatures:28,chartReadyFeatures:21,lastPass:'PUBLISH_READBACK',firstFail:null,
 providerResponse:{secret:'NOT_FOR_REPORT'}};}

test('owner event + exact issue title/label/request only',()=>{
 assert.equal(validateR6BReportEvent(event(),env).requestId,uuid);
 const wrong=event();wrong.issue.title='PC R6 BLS';
 assert.throws(()=>validateR6BReportEvent(wrong,env),/R6_B_REPORT_EVENT_STOP/);
 wrong.issue.title='pc-employment-r6-registered-data-once';
 wrong.issue.body=JSON.stringify({...request,command:'cmd /c echo'});
 assert.throws(()=>validateR6BReportEvent(wrong,env),/R6_B_REPORT_REQUEST_STOP/);
 assert.throws(()=>validateR6BReportEvent(event(),{...env,GITHUB_RUN_ATTEMPT:'2'}),
  /R6_B_REPORT_EVENT_STOP/);
});

test('valid success counts and names, no raw credential or body',()=>{
 const r=sanitizeR6BResult(validRaw(),request,env);
 assert.equal(r.status,'SUCCESS');assert.equal(r.providerRequests,9);
 assert.equal(r.blsRequests,7);assert.equal(r.dolRequests,2);
 assert.equal(r.groupResults.length,6);
 const serialized=JSON.stringify(r)+'\n'+r6BTextResult(r);
 assert.doesNotMatch(serialized,/NOT_FOR_REPORT|providerResponse|secret/);
 assert.match(serialized,/SOURCE_STORED_AT=1794206708243/);
});

test('report fails closed when counts/group/schema/status mismatch',()=>{
 for(const raw of [
  {...validRaw(),blsRequests:8},
  {...validRaw(),providerRequests:8},
  {...validRaw(),groupResults:[{groupName:'FOO',status:'SUCCESS',providerRequests:9}]},
  {...validRaw(),sourceStoredAt:'2026-11-09'},
  {...validRaw(),code:'R6_B_CLAIM_NO_PROOF'},
  {...validRaw(),requestId:'other'},
 ])assert.equal(sanitizeR6BResult(raw,request,env).status,'STATE_UNKNOWN');
});

test('NOOP and safe PRESTART BLOCKED remain distinct from success',()=>{
 const no={...validRaw(),status:'NOOP',code:'R6_B_ALREADY_COLLECTED',
  groupResults:[],providerRequests:0,blsRequests:0,dolRequests:0,
  sqlite:'UNCHANGED',publication:'NOT_ATTEMPTED'};
 assert.equal(sanitizeR6BResult(no,request,env).status,'NOOP');
 const blocked={status:'BLOCKED',code:'R6_B_REGISTERED_KEY_MISSING',requestId:null,
  error:'E:\\secret\\token'};
 const out=sanitizeR6BResult(blocked,request,env);
 assert.equal(out.status,'BLOCKED');
 assert.doesNotMatch(JSON.stringify(out),/secret|token/);
});

test('failed Actions effect step cannot be mislabeled SUCCESS by reporter',()=>{
 const raw=validRaw();
 const result=sanitizeR6BResult(raw,request,{...env,R6_B_EFFECT_OUTCOME:'failure'});
 assert.equal(result.status,'STATE_UNKNOWN');
 assert.equal(result.code,'R6_B_RESULT_UNVERIFIED_STOP');
});

test('atomic JSON/TXT pair and one originating comment; delivery readback required',async()=>{
 const calls=[];let outputs;
 const pairUploader=async opts=>{outputs=opts.outputs;
  assert.match(opts.headers.authorization,/^Bearer /);
  return{created:2,verified:2,delivery:'RESULT_PAIR_READBACK_VERIFIED'};};
 const fetchApi=async(url,opts)=>{calls.push({url,opts});return{status:201};};
 const result=await deliverR6BReport({event:event(),env,
  rawResult:JSON.stringify(validRaw()),pairUploader,fetchApi});
 assert.equal(result.status,'SUCCESS');assert.equal(result.verified,2);
 assert.equal(calls.length,1);assert.match(calls[0].url,/\/issues\/1010\/comments$/);
 assert.equal(outputs.length,2);
 assert.equal(outputs[0][0],`results/employment-r6-registered-${uuid}.json`);
 assert.equal(outputs[1][0],`results/employment-r6-registered-${uuid}.txt`);
 assert.equal(JSON.parse(outputs[0][1]).status,'SUCCESS');
 assert.doesNotMatch(JSON.stringify(outputs),/NOT_FOR_REPORT|local-test-token/);
});

test('result pair unverified never claims execution success',async()=>{
 const calls=[];
 const result=await deliverR6BReport({event:event(),env,
  rawResult:JSON.stringify(validRaw()),
  pairUploader:async()=>({created:null,verified:0,delivery:'RESULT_PAIR_REF_UNVERIFIED_READ_ONLY_RECONCILE'}),
  fetchApi:async(url,opts)=>{calls.push(JSON.parse(opts.body).body);return{status:201};}});
 assert.equal(result.status,'STATE_UNKNOWN');assert.equal(result.verified,0);
 assert.match(calls[0],/READBACK: 0\/2/);
 assert.doesNotMatch(calls[0],/\*\*SUCCESS\*\*/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {sanitizeSidecarBReport} from './report.mjs';
const id='8f265fcb-45b7-43b8-acd2-40976524db91';
const before='b'.repeat(64),after='c'.repeat(64),mhash='d'.repeat(64);
const head='a'.repeat(40);
const request={requestId:id,approvalManifestSha256:mhash};
const env={GITHUB_SHA:head};
const success={
 schema:'ZGMINI_CNN_SIDECAR_B_RESULT_V1',
 status:'SIDECAR_B_APPLIED_VERIFIED',
 code:'SIDECAR_B_EXACT_FILE_READBACK_PASS',
 applied:true,changedFileCount:1,requestId:id,controlSha:head,
 beforeSha256:before,afterSha256:after,
 manifestSha256:mhash,backupVerified:true
};
const call=(raw,readCurrent=()=>after)=>sanitizeSidecarBReport({
 raw,request,env,readCurrent
});
test('success requires every origin binding and real current installed digest',()=>{
 assert.equal(call(success).applied,true);
 for(const override of [
  {requestId:'another-id'},{controlSha:'f'.repeat(40)},
  {manifestSha256:'f'.repeat(64)},{beforeSha256:after},
  {backupVerified:false},{changedFileCount:0},
  {status:'SIDECAR_B_STATE_UNKNOWN'}
 ])assert.equal(call({...success,...override}).applied,false);
 assert.equal(call(success,()=>before).applied,false);
});
test('failure and recovery statuses never become applied',()=>{
 for(const status of ['SIDECAR_B_RECOVERY_REQUIRED',
  'SIDECAR_B_PREFLIGHT_OR_RUNTIME_STOP','SIDECAR_B_STATE_UNKNOWN']){
  const r=call({...success,status,applied:false,
   code:'SIDECAR_B_BACKUP_STOP'});
  assert.equal(r.applied,false);
  assert.equal(r.status,status);
  assert.equal(r.retry,'READ_ONLY_RECONCILE_NO_REPLAY');
 }
});
test('untrusted status, code or missing result is state unknown',()=>{
 for(const raw of [null,{}, {...success,code:'BAD'},
  {...success,applied:true,status:'SIDECAR_B_RECOVERY_REQUIRED'}]){
  const r=call(raw);
  assert.equal(r.applied,false);
  assert.equal(r.status,'SIDECAR_B_STATE_UNKNOWN');
 }
});

test('reporter emits create-only JSON/TXT and verifies both remote bytes before comment',
 async()=>{
 const {publishSidecarBReport}=await import('./report.mjs');
 const req={schema:'ZGMINI_CNN_SIDECAR_ONEFILE_B_REQUEST_V1',
  requestId:id,controlHead:head,
  approvalManifestPath:'approvals/sidecar-b/cnn-r10.json',
  approvalManifestSha256:mhash};
 const event={repository:{full_name:'ansqhd5774-Choi/zgmini-pc-control',
  private:true},sender:{login:'ansqhd5774-Choi'},
  issue:{number:123,user:{login:'ansqhd5774-Choi'},
   title:'cnn-sidecar-onefile-b-install',labels:[{name:'pc-writer-b-install'}],
   body:JSON.stringify(req)}};
 const e={GITHUB_SHA:head,GITHUB_ACTOR:'ansqhd5774-Choi',
  GITHUB_REPOSITORY:'ansqhd5774-Choi/zgmini-pc-control',
  GITHUB_EVENT_NAME:'issues',GITHUB_EVENT_ACTION:'opened',
  GITHUB_RUN_ATTEMPT:'1',GITHUB_TOKEN:'x'.repeat(30)};
 const stored=new Map(),comments=[];
 const fake=async(url,opts={})=>{
  const base=url.split('?')[0];
  if(opts.method==='PUT'){
   if(stored.has(base))return {status:422};
   const record=JSON.parse(opts.body);
   stored.set(base,Buffer.from(record.content,'base64'));
   return {status:201};
  }
  if(opts.method==='POST'){
   comments.push(JSON.parse(opts.body).body);
   return {status:201};
  }
  if(stored.has(base))
   return {status:200,json:async()=>({
    encoding:'base64',content:stored.get(base).toString('base64')
   })};
  return {status:404};
 };
 const result=await publishSidecarBReport({
  event,env:e,raw:JSON.stringify(success),
  fetchApi:fake,readCurrent:()=>after
 });
 assert.deepEqual({verified:result.verified,created:result.created},{verified:2,created:2});
 assert.equal(comments.length,1);
 assert.match(comments[0],/APPLIED_VERIFIED/);
 assert.equal(stored.size,2);
});

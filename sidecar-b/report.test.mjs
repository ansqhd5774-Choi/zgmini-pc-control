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

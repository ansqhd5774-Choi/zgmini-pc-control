import test from 'node:test';
import assert from 'node:assert/strict';
import {sanitizeSidecarBReport,publishSidecarBReport} from './report.mjs';
import {createGitPairFixture} from '../writer-config-b/result-pair-test-fixture.mjs';
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
test('whitelisted resource evidence survives failed result without arbitrary keys',()=>{
 const x={windowMs:420000,samples:49,coreActiveSamples:47,
  sidecarActiveSamples:32,controllerBusySamples:0,writerBusySamples:0,
  rawCommandLine:'SECRET-MUST-NOT-BE-PUBLISHED'};
 const raw={...success,status:'SIDECAR_B_PREFLIGHT_OR_RUNTIME_STOP',
  code:'SIDECAR_B_PROBE_RESOURCE_STOP',applied:false,idleObservation:x};
 const out=call(raw);
 assert.equal(out.applied,false);
 assert.equal(out.idleObservation.samples,49);
 assert.equal(JSON.stringify(out).includes('SECRET-MUST-NOT-BE-PUBLISHED'),false);
 assert.equal(call({...raw,idleObservation:{...x,samples:-1}}).idleObservation,undefined);
 assert.equal(call({...raw,code:'SIDECAR_B_BACKUP_STOP'}).idleObservation,undefined);
});
test('resource failure reporter atomically publishes only validated bounded counters',async()=>{
 const fixture=createGitPairFixture();
 const x={windowMs:420000,samples:49,coreActiveSamples:47,
  sidecarActiveSamples:32,controllerBusySamples:0,writerBusySamples:0,
  pid:1234};
 const raw={...success,status:'SIDECAR_B_PREFLIGHT_OR_RUNTIME_STOP',
  code:'SIDECAR_B_PROBE_RESOURCE_STOP',applied:false,idleObservation:x};
 const result=await publishSidecarBReport({event,env:e,raw:JSON.stringify(raw),
  fetchApi:fixture.fetchApi,readCurrent:()=>after});
 assert.equal(result.verified,2);
 const prefix='results/cnn-sidecar-b-'+id;
 const json=fixture.files.get(prefix+'.json').toString('utf8');
 const txt=fixture.files.get(prefix+'.txt').toString('utf8');
 assert.match(txt,/IDLE_coreActiveSamples=47/);
 assert.equal(json.includes('"pid"'),false);
 assert.equal(JSON.parse(json).idleObservation.sidecarActiveSamples,32);
});
test('untrusted status, code or missing result is state unknown',()=>{
 for(const raw of [null,{}, {...success,code:'BAD'},
  {...success,applied:true,status:'SIDECAR_B_RECOVERY_REQUIRED'}]){
  const r=call(raw);
  assert.equal(r.applied,false);
  assert.equal(r.status,'SIDECAR_B_STATE_UNKNOWN');
 }
});

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

test('reporter creates atomic sanitized JSON/TXT and verifies both remote bytes before comment',async()=>{
 const fixture=createGitPairFixture();
 const r=await publishSidecarBReport({event,env:e,raw:JSON.stringify(success),
  fetchApi:fixture.fetchApi,readCurrent:()=>after});
 assert.deepEqual({verified:r.verified,created:r.created},{verified:2,created:2});
 assert.equal(r.status,'SIDECAR_B_APPLIED_VERIFIED');
 assert.equal(fixture.counts.commits,1);
 assert.equal(fixture.counts.updates,1);
 assert.equal(fixture.counts.comments,1);
 const prefix='results/cnn-sidecar-b-'+id;
 assert.equal(fixture.files.size,2);
 const json=JSON.parse(fixture.files.get(prefix+'.json').toString('utf8'));
 const txt=fixture.files.get(prefix+'.txt').toString('utf8');
 assert.equal(json.requestId,id);assert.equal(json.applied,true);
 assert.match(txt,/STATUS=SIDECAR_B_APPLIED_VERIFIED/);
});
test('failed branch CAS leaves neither result file, and never reports verified',async()=>{
 const fixture=createGitPairFixture({rejectRefUpdate:true});
 const r=await publishSidecarBReport({event,env:e,raw:JSON.stringify(success),
  fetchApi:fixture.fetchApi,readCurrent:()=>after});
 assert.equal(r.status,'SIDECAR_B_STATE_UNKNOWN');
 assert.equal(r.created,0);assert.equal(r.verified,0);
 assert.equal(fixture.files.size,0);
 assert.equal(fixture.counts.comments,1);
});
test('ambiguous lost PATCH acknowledgment reconciles committed pair without reexecution',async()=>{
 const fixture=createGitPairFixture({throwAfterUpdate:true});
 const r=await publishSidecarBReport({event,env:e,raw:JSON.stringify(success),
  fetchApi:fixture.fetchApi,readCurrent:()=>after});
 assert.equal(r.status,'SIDECAR_B_APPLIED_VERIFIED');
 assert.equal(r.created,2);assert.equal(r.verified,2);
 assert.equal(fixture.counts.updates,1);
 assert.equal(fixture.files.size,2);
});
test('concurrent main fast-forward makes one bounded result-only CAS rebase',async()=>{
 const fixture=createGitPairFixture({advanceMainOnFirstPatch:true});
 const r=await publishSidecarBReport({event,env:e,raw:JSON.stringify(success),
  fetchApi:fixture.fetchApi,readCurrent:()=>after});
 assert.equal(r.status,'SIDECAR_B_APPLIED_VERIFIED');
 assert.equal(r.created,2);assert.equal(r.verified,2);
 assert.equal(fixture.counts.updates,2);
 assert.equal(fixture.files.size,2);
});
test('existing evidence blocks overwrite and cannot be reported as successful delivery',async()=>{
 const prefix='results/cnn-sidecar-b-'+id;
 const fixture=createGitPairFixture({existingPaths:[prefix+'.json']});
 const r=await publishSidecarBReport({event,env:e,raw:JSON.stringify(success),
  fetchApi:fixture.fetchApi,readCurrent:()=>after});
 assert.equal(r.status,'SIDECAR_B_STATE_UNKNOWN');
 assert.equal(r.created,0);assert.equal(r.verified,0);
 assert.equal(fixture.counts.updates,0);
 assert.equal(fixture.files.size,1);
});

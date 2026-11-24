import test from 'node:test';
import assert from 'node:assert/strict';
import {authorizeSidecarIssue,TITLE,LABEL,REQUEST_SCHEMA} from './admission.mjs';
import {SCHEMA,TARGET,PREIMAGE,sha256} from './contract.mjs';
const SHA='a'.repeat(40), h='b'.repeat(64);
const id='8f265fcb-45b7-43b8-acd2-40976524db91';
const manifest={schema:SCHEMA,status:'APPROVED_B',requestId:id,
 target:TARGET,beforeSha256:PREIMAGE,afterSha256:'c'.repeat(64),
 approvedContentSha256:'c'.repeat(64),approvedSourceSha:SHA,
 installedHead:SHA,installedConfigSource:SHA,taskDefinitionSha256:h,
 wrapperSha256:h,allowProviderCalls:false,allowDbChanges:false,
 allowD1Writes:false,allowTaskChanges:false,runCount:1};
const bytes=Buffer.from(JSON.stringify(manifest));
const req={schema:REQUEST_SCHEMA,requestId:id,
 approvalManifestPath:'approvals/sidecar-b/cnn-r10.json',
 approvalManifestSha256:sha256(bytes),controlHead:SHA};
const event={repository:{full_name:'ansqhd5774-Choi/zgmini-pc-control',private:true},
 sender:{login:'ansqhd5774-Choi'},issue:{number:100,title:TITLE,
 user:{login:'ansqhd5774-Choi'},labels:[{name:LABEL}],body:JSON.stringify(req)}};
const env={GITHUB_REPOSITORY:'ansqhd5774-Choi/zgmini-pc-control',
 GITHUB_EVENT_NAME:'issues',GITHUB_EVENT_ACTION:'opened',
 GITHUB_ACTOR:'ansqhd5774-Choi',GITHUB_RUN_ATTEMPT:'1',GITHUB_SHA:SHA};
const invoke=(overrides={})=>authorizeSidecarIssue({
 event,env,manifestBytes:bytes,controlHead:SHA,...overrides});
test('exact pinned owner issue and manifest accepted',()=>{
 assert.equal(invoke().manifest.requestId,id);
});
test('foreign actor, unpinned workflow and wrong issue label denied',()=>{
 for(const override of [
  {env:{...env,GITHUB_ACTOR:'outsider'}},
  {env:{...env,GITHUB_SHA:'f'.repeat(40)}},
  {event:{...event,issue:{...event.issue,labels:[]}}}
 ])assert.throws(()=>invoke(override),e=>e.code==='SIDECAR_B_EVENT_ORIGIN_STOP');
});
test('malformed request path and additional fields fail closed',()=>{
 for(const change of [{approvalManifestPath:'../archive-run.mjs'},
  {extra:true}])assert.throws(()=>invoke({
   event:{...event,issue:{...event.issue,
    body:JSON.stringify({...req,...change})}}}),
   e=>e.code==='SIDECAR_B_REQUEST_SCOPE_STOP');
});
test('raw approval digest and request identity are both required',()=>{
 assert.throws(()=>invoke({manifestBytes:Buffer.from('not approved')}),
  e=>e.code==='SIDECAR_B_APPROVAL_BYTES_STOP');
 assert.throws(()=>invoke({manifestBytes:Buffer.from(JSON.stringify(
  {...manifest,requestId:'7f265fcb-45b7-43b8-acd2-40976524db91'})),
  event:{...event,issue:{...event.issue,body:JSON.stringify({
   ...req,approvalManifestSha256:sha256(Buffer.from(JSON.stringify(
    {...manifest,requestId:'7f265fcb-45b7-43b8-acd2-40976524db91'})))})}}}),
  e=>e.code==='SIDECAR_B_REQUEST_MANIFEST_STOP');
});

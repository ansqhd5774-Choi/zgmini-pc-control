import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {inspectNativeReceiver} from '../ci-approval/native-receiver-contract.mjs';

const REPO='ansqhd5774-Choi/zgmini-pc-control', REPO_ID=1442936296;
const repo={id:REPO_ID,full_name:REPO,private:true};
const hash=b=>createHash('sha256').update(b).digest('hex');
const blob=b=>createHash('sha1').update(Buffer.from('blob '+b.length+'\0')).update(b).digest('hex');
const baseFile=p=>readFileSync(new URL('../'+p,import.meta.url));

function fixture(effect='A_READONLY'){
 const approvalBytes=baseFile(effect==='A_READONLY'?'config/operations.json':
    'approvals/writer-updates/w05-r304-maintenance-window-20261119.json');
 const a=JSON.parse(approvalBytes);
 const req=effect==='A_READONLY'?{
  schema:'ZGMINI_PC_JOB_V1',requestId:'pc-test-001',chatId:'test',
  operation:'runner-smoke',sourceRepository:a.sourceRepository,
  sourceBranch:'main',sourceSha:'a'.repeat(40)
 }:{
  schema:'ZGMINI_PC_WRITER_SOURCE_B_REQUEST_V1',
  requestId:'12345678-1234-4234-8234-123456789abc',
  chatId:'12345678-1234-4234-8234-123456789abd',
  operation:'pc-writer-source-install',controlRepository:REPO,
  approvalManifestPath:'approvals/writer-updates/w05-r304-maintenance-window-20261119.json',
  approvalManifestSha256:hash(approvalBytes)
 };
 const requestBytes=Buffer.from(JSON.stringify(req));
 const sourceBytes=Buffer.from('name: fixed reviewed source tests\n');
 const receiverBytes=Buffer.from('name: fixed reviewed native receiver\n');
 const receiverWorkflowPath=effect==='A_READONLY'?
  '.github/workflows/ci-approved-a-once.yml':
  '.github/workflows/ci-approved-writer-b-once.yml';
 const policy={
  schema:'ZGMINI_CI_NATIVE_DISPATCH_V1',enabled:true,effect,
  sourceRunId:123,sourceAttempt:1,sourceWorkflowId:416355595,
  sourceHeadSha:'a'.repeat(40),
  sourceWorkflowPath:'.github/workflows/controller-maintenance-source-tests.yml',
  sourceWorkflowBlobSha:blob(sourceBytes),
  receiverWorkflowPath,receiverWorkflowBlobSha:blob(receiverBytes),
  approvedRequestSha256:hash(requestBytes),businessApprovalSha256:hash(approvalBytes),
  policyRevision:'b'.repeat(40)
 };
 const event={repository:repo,
  sender:{id:41898282,login:'github-actions[bot]',type:'Bot'},
  inputs:{
   effect,source_run_id:'123',source_attempt:'1',
   approval_sha256:policy.businessApprovalSha256,
   request_sha256:policy.approvedRequestSha256,
   effect_key:hash(JSON.stringify([effect,policy.businessApprovalSha256,policy.approvedRequestSha256]))
  }};
 const env={GITHUB_REPOSITORY:REPO,GITHUB_EVENT_NAME:'workflow_dispatch',
  GITHUB_ACTOR:'github-actions[bot]',GITHUB_REF:'refs/heads/main',
  GITHUB_RUN_ATTEMPT:'1',GITHUB_SHA:'c'.repeat(40)};
 const sourceRun={
  id:123,run_attempt:1,workflow_id:416355595,
  path:policy.sourceWorkflowPath,head_sha:policy.sourceHeadSha,
  status:'completed',conclusion:'success',event:'pull_request',
  repository:repo,head_repository:repo
 };
 const sourceWorkflow={type:'file',path:policy.sourceWorkflowPath,
  ref:policy.sourceHeadSha,sha:policy.sourceWorkflowBlobSha,
  encoding:'base64',content:sourceBytes.toString('base64')};
 const receiverWorkflow={type:'file',path:receiverWorkflowPath,
  ref:env.GITHUB_SHA,sha:policy.receiverWorkflowBlobSha,
  encoding:'base64',content:receiverBytes.toString('base64')};
 return {event,env,policy,approvalBytes,requestBytes,sourceRun,sourceWorkflow,receiverWorkflow};
}
function expect(f,code,state='EVIDENCE_MISSING'){
 const r=inspectNativeReceiver(f);
 assert.equal(r.state,state);assert.equal(r.code,code);
 assert.equal(r.canExecute,false);assert.equal(r.canPublish,false);assert.equal(r.canInstall,false);
}
for(const effect of ['A_READONLY','B_WRITER_SOURCE'])test(effect+' is contract match only, never execution grant',()=>{
 const f=fixture(effect),r=inspectNativeReceiver(f);
 assert.equal(r.state,'CONTRACT_MATCH_ONLY');assert.equal(r.canExecute,false);
 assert.equal(r.canInstall,false);assert.equal(r.effect,effect);
 assert.equal(r.effectKey,f.event.inputs.effect_key);
});
test('uninstalled receiver policy stays disabled',()=>{
 const f=fixture();delete f.policy.enabled;expect(f,'CI_NATIVE_RECEIVER_NOT_ENABLED','DISABLED');
});
test('foreign event owner is rejected',()=>{
 const f=fixture();f.event.repository={...repo,id:44};
 expect(f,'CI_NATIVE_RECEIVER_EVENT_ORIGIN_DENIED','REJECTED');
});
test('owner manual dispatch cannot impersonate a CI emitter',()=>{
 const f=fixture();f.event.sender={id:327938088,login:'ansqhd5774-Choi',type:'User'};
 expect(f,'CI_NATIVE_RECEIVER_EVENT_ORIGIN_DENIED','REJECTED');
});
test('source sender login without authenticated Bot ID is rejected',()=>{
 const f=fixture();f.event.sender.id=999;
 expect(f,'CI_NATIVE_RECEIVER_EVENT_ORIGIN_DENIED','REJECTED');
});
test('CI dispatch from another branch is rejected',()=>{
 const f=fixture();f.env.GITHUB_REF='refs/heads/codex/untrusted';
 expect(f,'CI_NATIVE_RECEIVER_EVENT_ORIGIN_DENIED','REJECTED');
});
test('receiver rerun requires independent reconciliation',()=>{
 const f=fixture();f.env.GITHUB_RUN_ATTEMPT='2';
 expect(f,'CI_NATIVE_RECEIVER_EVENT_ORIGIN_DENIED','REJECTED');
});
test('unknown extra dispatch input fails closed',()=>{
 const f=fixture();f.event.inputs.shell='powershell.exe';
 expect(f,'CI_NATIVE_RECEIVER_INPUT_SCOPE_MISMATCH','REJECTED');
});
test('changed approval hash cannot authorize a request',()=>{
 const f=fixture();f.event.inputs.approval_sha256='e'.repeat(64);
 expect(f,'CI_NATIVE_RECEIVER_INPUT_SCOPE_MISMATCH','REJECTED');
});
test('changed effect key is rejected',()=>{
 const f=fixture();f.event.inputs.effect_key='e'.repeat(64);
 expect(f,'CI_NATIVE_RECEIVER_EFFECT_KEY_MISMATCH','REJECTED');
});
test('request bytes mismatch cannot reach operating contract',()=>{
 const f=fixture();f.requestBytes=Buffer.from('{}');
 expect(f,'CI_NATIVE_RECEIVER_APPROVAL_OR_REQUEST_BYTES_MISSING');
});
test('approval bytes mismatch cannot become an A permission',()=>{
 const f=fixture();f.approvalBytes=Buffer.from('{}');
 expect(f,'CI_NATIVE_RECEIVER_APPROVAL_OR_REQUEST_BYTES_MISSING');
});
test('failed source CI cannot be used for receiver admission',()=>{
 const f=fixture();f.sourceRun.conclusion='failure';
 expect(f,'CI_NATIVE_RECEIVER_SOURCE_RUN_UNVERIFIED');
});
test('source workflow blob content is checked at immutable head',()=>{
 const f=fixture();f.sourceWorkflow.content=Buffer.from('edited source').toString('base64');
 expect(f,'CI_NATIVE_RECEIVER_SOURCE_WORKFLOW_UNVERIFIED');
});
test('receiver workflow must match running GH SHA and approved blob',()=>{
 const f=fixture();f.receiverWorkflow.ref='d'.repeat(40);
 expect(f,'CI_NATIVE_RECEIVER_OWN_WORKFLOW_UNVERIFIED');
});
test('receiver workflow source bytes cannot be silently changed',()=>{
 const f=fixture();f.receiverWorkflow.content=Buffer.from('injected').toString('base64');
 expect(f,'CI_NATIVE_RECEIVER_OWN_WORKFLOW_UNVERIFIED');
});
test('A mutation-enabled installed policy is outside scope',()=>{
 const f=fixture();let a=JSON.parse(f.approvalBytes);a.mutationsEnabled=true;
 f.approvalBytes=Buffer.from(JSON.stringify(a));
 f.policy.businessApprovalSha256=hash(f.approvalBytes);
 f.event.inputs.approval_sha256=f.policy.businessApprovalSha256;
 f.event.inputs.effect_key=hash(JSON.stringify([f.policy.effect,f.policy.businessApprovalSha256,f.policy.approvedRequestSha256]));
 expect(f,'CI_NATIVE_RECEIVER_A_POLICY_DENIED','OUT_OF_SCOPE');
});
test('Writer B request cannot substitute an unrelated approved manifest',()=>{
 const f=fixture('B_WRITER_SOURCE');
 let m=JSON.parse(f.approvalBytes);m.files=[];
 f.approvalBytes=Buffer.from(JSON.stringify(m));
 f.policy.businessApprovalSha256=hash(f.approvalBytes);
 f.event.inputs.approval_sha256=f.policy.businessApprovalSha256;
 f.event.inputs.effect_key=hash(JSON.stringify([f.policy.effect,f.policy.businessApprovalSha256,f.policy.approvedRequestSha256]));
 expect(f,'CI_NATIVE_RECEIVER_EXISTING_CONTRACT_REJECTED','OUT_OF_SCOPE');
});
test('admin effect is not accepted in native A Writer receiver',()=>{
 const f=fixture();f.policy.effect='C_ADMIN';
 expect(f,'CI_NATIVE_RECEIVER_INSTALLED_POLICY_INVALID');
});


for(const effect of ['A_READONLY','B_WRITER_SOURCE'])test(effect+' independently verified event-bound Run cannot mint an execution grant',()=>{
 const f=fixture(effect);
 f.policy.sourceRunMode='EVENT_COMPLETION_V1';
 const r=inspectNativeReceiver(f);
 assert.equal(r.state,'CONTRACT_MATCH_ONLY');
 assert.equal(r.canPublish,false);
 assert.equal(r.canExecute,false);
 assert.equal(r.canInstall,false);
});
test('receiver rejects unknown event-binding policy schemas even with a successful run',()=>{
 const f=fixture();
 f.policy.sourceRunMode='UNREVIEWED';
 expect(f,'CI_NATIVE_RECEIVER_INSTALLED_POLICY_INVALID');
});

test('Public Writer receiver requires independent public B policy and exact public source',()=>{
 const f=fixture('B_WRITER_SOURCE');
 f.policy.repositoryVisibility='public';
 f.policy.nativeWriterBExecutionEnabled=true;
 f.policy.nativeWriterBControlSha='d'.repeat(40);
 f.policy.nativeWriterBAdapterSha256='e'.repeat(64);
 f.policy.installedControllerSha='f'.repeat(40);
 f.event.repository={...repo,private:false};
 f.sourceRun.repository={...repo,private:false};
 const r=inspectNativeReceiver(f);
 assert.equal(r.state,'CONTRACT_MATCH_ONLY');assert.equal(r.canExecute,false);
 const missing=structuredClone(f);delete missing.policy.nativeWriterBExecutionEnabled;
 expect(missing,'CI_NATIVE_RECEIVER_EVENT_ORIGIN_DENIED','REJECTED');
 const cross={...f,sourceRun:{...f.sourceRun,
  repository:{...f.sourceRun.repository,private:true}}};
 expect(cross,'CI_NATIVE_RECEIVER_SOURCE_RUN_UNVERIFIED');
 const other=structuredClone(f);other.policy.effect='A_READONLY';
 expect(other,'CI_NATIVE_RECEIVER_INSTALLED_POLICY_INVALID');
});

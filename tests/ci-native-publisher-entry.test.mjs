import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {publishNativeCompletion,readNativeInstalledProof,verifyNativeInstalledProof,createNativePublisherLocalPolicyPorts} from '../ci-approval/native-publisher-entry.mjs';
const REPO='ansqhd5774-Choi/zgmini-pc-control';
const hash=b=>createHash('sha256').update(b).digest('hex');
const blob=b=>createHash('sha1').update(Buffer.from('blob '+b.length+'\0')).update(b).digest('hex');
const fixture=(effect='A_READONLY')=>{
 const requestBytes=Buffer.from('{"operation":"core-status"}');
 const approvalBytes=Buffer.from('{"approved":"pinned-A-or-Writer-scope"}');
 const sourceBytes=Buffer.from('name: approved source CI\n');
 const receiverBytes=Buffer.from('name: approved native receiver\n');
 const pathValue=effect==='A_READONLY'?'.github/workflows/ci-approved-a-once.yml':'.github/workflows/ci-approved-writer-b-once.yml';
 const policy={schema:'ZGMINI_CI_NATIVE_DISPATCH_V1',enabled:true,effect,
  sourceRunId:222,sourceAttempt:1,sourceWorkflowId:1234,sourceHeadSha:'a'.repeat(40),
  sourceWorkflowPath:'.github/workflows/controller-maintenance-source-tests.yml',
  sourceWorkflowBlobSha:blob(sourceBytes),receiverWorkflowPath:pathValue,receiverWorkflowBlobSha:blob(receiverBytes),
  businessApprovalSha256:hash(approvalBytes),approvedRequestSha256:hash(requestBytes),policyRevision:'c'.repeat(40)};
 const run={id:222,run_attempt:1,workflow_id:1234,path:policy.sourceWorkflowPath,
  head_sha:policy.sourceHeadSha,status:'completed',conclusion:'success',event:'pull_request',
  repository:{id:1442936296,full_name:REPO,private:true},head_repository:{id:1442936296}};
 const event={action:'completed',repository:{id:1442936296,full_name:REPO,private:true},workflow_run:run};
 const env={GITHUB_EVENT_NAME:'workflow_run',GITHUB_REPOSITORY:REPO,GITHUB_REF:'refs/heads/main'};
 let created=0,claim=null;
 const ports={
  readNativeScope:async()=>({policy,requestBytes,approvalBytes}),
  readSourceRun:async()=>run,
  readSourceWorkflow:async()=>({type:'file',path:policy.sourceWorkflowPath,
   sha:policy.sourceWorkflowBlobSha,encoding:'base64',content:sourceBytes.toString('base64')}),
  readReceiverWorkflow:async()=>({type:'file',path:pathValue,sha:policy.receiverWorkflowBlobSha,
   encoding:'base64',content:receiverBytes.toString('base64')}),
  readInstalledReceiver:async()=>({...policy}),
  loadReceipt:async()=>claim,
  saveReceipt:async(k,v,opts)=>{if(opts?.exclusive&&claim)throw Error('EXISTS');claim=v},
  dispatchWorkflow:async()=>{created++;return {status:204}}
 };
 return {policy,event,env,ports,requestBytes,readCount:()=>created};
};
for(const effect of ['A_READONLY','B_WRITER_SOURCE'])test(effect+' original CI completion creates at most one receiver wakeup',async()=>{
 const x=fixture(effect);
 const a=await publishNativeCompletion({...x,effect});
 assert.equal(a.state,'DISPATCH_ACCEPTED_NOT_EXECUTED');assert.equal(a.executed,false);
 assert.equal(a.dispatched,true);assert.equal(x.readCount(),1);
 const again=await publishNativeCompletion({...x,effect});
 assert.equal(again.code,'CI_NATIVE_DISPATCH_PRIOR_EFFECT_NO_REPOST');
 assert.equal(x.readCount(),1);
});
test('the caller cannot select C-grade effect',async()=>{
 const x=fixture();const a=await publishNativeCompletion({...x,effect:'C_ADMIN'});
 assert.equal(a.code,'CI_NATIVE_PUBLISH_EFFECT_DENIED');assert.equal(x.readCount(),0);
});
test('unsuccessful source CI event never posts',async()=>{
 const x=fixture();x.event.workflow_run.conclusion='failure';
 const a=await publishNativeCompletion({...x,effect:'A_READONLY'});
 assert.equal(a.state,'IGNORED');assert.equal(a.code,'CI_NATIVE_PUBLISH_SOURCE_EVENT_NOT_TARGET');assert.equal(x.readCount(),0);
});
test('source CI ID mismatch never posts even if eligible policy exists',async()=>{
 const x=fixture();x.event.workflow_run.id=333;
 const a=await publishNativeCompletion({...x,effect:'A_READONLY'});
 assert.equal(a.state,'IGNORED');assert.equal(a.code,'CI_NATIVE_PUBLISH_SOURCE_EVENT_NOT_TARGET');assert.equal(x.readCount(),0);
});
test('source event from foreign repo never posts',async()=>{
 const x=fixture();x.event.repository.id=99;
 const a=await publishNativeCompletion({...x,effect:'A_READONLY'});
 assert.equal(a.state,'IGNORED');assert.equal(a.code,'CI_NATIVE_PUBLISH_SOURCE_EVENT_NOT_TARGET');assert.equal(x.readCount(),0);
});
test('disabled policy never dispatches',async()=>{
 const x=fixture();x.policy.enabled=false;
 const a=await publishNativeCompletion({...x,effect:'A_READONLY'});
 assert.equal(a.state,'DISABLED');assert.equal(x.readCount(),0);
});
test('missing installed native scope is missing evidence',async()=>{
 const x=fixture();x.ports.readNativeScope=async()=>{throw Error('NOT_INSTALLED')};
 const a=await publishNativeCompletion({...x,effect:'A_READONLY'});
 assert.equal(a.code,'CI_NATIVE_PUBLISH_SCOPE_UNAVAILABLE');assert.equal(x.readCount(),0);
});
test('installed proof must have an exact approved B receipt and policy hash',async()=>{
 const p=fixture().policy;
 const proof={
  schema:'ZGMINI_CI_NATIVE_B_INSTALLED_PROOF_V1',effect:'A_READONLY',
  policy:p,nativePolicySha256:hash(Buffer.from(JSON.stringify(p))),
  installationRequestId:'pc-update-12345678-1234-4234-8234-123456789abc',
  installationReceiptPath:'results/maintenance-pc-update-12345678-1234-4234-8234-123456789abc.json',
  installationReceiptSha256:'0'.repeat(64),actualControllerSha:'d'.repeat(40)};
 const receipt={schema:'ZGMINI_PC_MAINTENANCE_RESULT_V1',
  requestId:proof.installationRequestId,actualControllerSha:proof.actualControllerSha,
  targetControllerSha:proof.actualControllerSha,status:'SUCCEEDED',protectedStateUnchanged:true,
  ciNativeEffect:'A_READONLY',ciNativePolicySha256:proof.nativePolicySha256};
 const bytes=Buffer.from(JSON.stringify(receipt));proof.installationReceiptSha256=hash(bytes);
 const good={getJson:async()=>({type:'file',path:proof.installationReceiptPath,encoding:'base64',content:bytes.toString('base64')})};
 assert.deepEqual(await verifyNativeInstalledProof('A_READONLY',proof,good),p);
 delete receipt.ciNativePolicySha256;
 const badBytes=Buffer.from(JSON.stringify(receipt));proof.installationReceiptSha256=hash(badBytes);
 const bad={getJson:async()=>({type:'file',path:proof.installationReceiptPath,encoding:'base64',content:badBytes.toString('base64')})};
 await assert.rejects(()=>verifyNativeInstalledProof('A_READONLY',proof,bad),/CI_NATIVE_PROOF_INSTALLATION_SCOPE_UNVERIFIED/);
});
test('unrelated historical successful B cannot authorize native CI effect',async()=>{
 const p=fixture().policy;
 const proof={effect:'A_READONLY',installationReceiptPath:'results/maintenance-pc-update-12345678-1234-4234-8234-123456789abc.json',
  installationReceiptSha256:'0'.repeat(64),nativePolicySha256:hash(Buffer.from(JSON.stringify(p))),installationRequestId:'pc-update-12345678-1234-4234-8234-123456789abc',actualControllerSha:'d'.repeat(40),policy:p};
 const old=Buffer.from(JSON.stringify({schema:'ZGMINI_PC_MAINTENANCE_RESULT_V1',requestId:proof.installationRequestId,
  actualControllerSha:proof.actualControllerSha,targetControllerSha:proof.actualControllerSha,status:'SUCCEEDED',protectedStateUnchanged:true}));
 proof.installationReceiptSha256=hash(old);
 await assert.rejects(()=>verifyNativeInstalledProof('A_READONLY',proof,{getJson:async()=>({
  type:'file',path:proof.installationReceiptPath,encoding:'base64',content:old.toString('base64')})}),
 /CI_NATIVE_PROOF_INSTALLATION_SCOPE_UNVERIFIED/);
});
test('installed proof local path is fixed, never taken from event',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-native-producer-'));
 try{
  const p=fixture().policy;
  const proof={schema:'ZGMINI_CI_NATIVE_B_INSTALLED_PROOF_V1',effect:'A_READONLY',policy:p,
   nativePolicySha256:hash(Buffer.from(JSON.stringify(p))),
   installationReceiptSha256:'d'.repeat(64),actualControllerSha:'e'.repeat(40),
   installationRequestId:'pc-update-12345678-1234-4234-8234-123456789abc',
   installationReceiptPath:'results/maintenance-pc-update-12345678-1234-4234-8234-123456789abc.json'};
  fs.writeFileSync(path.join(root,'ci-native-a-installed-proof.json'),JSON.stringify(proof));
  assert.equal(readNativeInstalledProof('A_READONLY',{root}).policy.effect,'A_READONLY');
  assert.throws(()=>readNativeInstalledProof('C_ADMIN',{root}),/CI_NATIVE_PROOF_EFFECT_DENIED/);
 }finally{fs.rmSync(root,{recursive:true,force:true})}
});
test('native publisher workflow is event-driven, write-scoped, opt-in only',()=>{
 const source=fs.readFileSync(new URL('../.github/workflows/ci-native-auto-publish.yml',import.meta.url),'utf8').replace(/\r\n/g,'\n');
 assert.match(source,/^on:\n  workflow_run:\n/m);
 assert.doesNotMatch(source,/^\s+(?:schedule:|issues:|workflow_dispatch:|pull_request:)/m);
 assert.match(source,/vars\.ZGMINI_CI_NATIVE_A_ENABLED == 'true'/);
 assert.match(source,/vars\.ZGMINI_CI_NATIVE_WRITER_B_ENABLED == 'true'/);
 assert.match(source,/actions: write/);assert.match(source,/contents: read/);
 assert.doesNotMatch(source,/issues: write|contents: write/);
 assert.match(source,/github\.event\.workflow_run\.event == 'pull_request'/);
 assert.match(source,/native-publisher-entry\.mjs/);
 assert.doesNotMatch(source,/controller\\entry\.mjs|writer-b\\windows-adapter\.mjs/);
});


for(const effect of ['A_READONLY','B_WRITER_SOURCE'])test(effect+' preinstalled event-bound grant binds the first actual CI run once',async()=>{
 const x=fixture(effect);
 delete x.policy.sourceRunId;
 x.policy.sourceRunMode='EVENT_COMPLETION_V1';
 const first=await publishNativeCompletion({...x,effect});
 assert.equal(first.state,'DISPATCH_ACCEPTED_NOT_EXECUTED');
 assert.equal(x.readCount(),1);
 assert.equal(x.ports.readNativeScope!==undefined,true);
 const again=await publishNativeCompletion({...x,effect});
 assert.equal(again.code,'CI_NATIVE_DISPATCH_PRIOR_EFFECT_NO_REPOST');
 assert.equal(x.readCount(),1);
});
test('event-bound publisher rejects a source-run attempt 2, unknown source SHA or unapproved policy mode',async()=>{
 for(const change of [
  x=>{x.event.workflow_run.run_attempt=2},
  x=>{x.event.workflow_run.head_sha='f'.repeat(40)},
  x=>{x.policy.sourceRunMode='UNREVIEWED'}
 ]){
  const x=fixture();
  delete x.policy.sourceRunId;
  x.policy.sourceRunMode='EVENT_COMPLETION_V1';
  change(x);
  const r=await publishNativeCompletion({...x,effect:'A_READONLY'});
  assert.notEqual(r.dispatched,true);
  assert.equal(x.readCount(),0);
 }
});
test('event-bound publisher does not accept a future run from a different workflow',async()=>{
 const x=fixture();
 delete x.policy.sourceRunId;
 x.policy.sourceRunMode='EVENT_COMPLETION_V1';
 x.event.workflow_run.workflow_id=999;
 const r=await publishNativeCompletion({...x,effect:'A_READONLY'});
 assert.equal(r.code,'CI_NATIVE_PUBLISH_SOURCE_EVENT_NOT_TARGET');
 assert.equal(x.readCount(),0);
});
test('future-run mode is explicit and cannot silently reuse a fixed-ID grant',async()=>{
 const x=fixture();
 x.policy.sourceRunMode='EVENT_COMPLETION_V1';
 const r=await publishNativeCompletion({...x,effect:'A_READONLY'});
 assert.equal(r.code,'CI_NATIVE_PUBLISH_SOURCE_EVENT_NOT_TARGET');
 assert.equal(x.readCount(),0);
});


for(const mode of ['FIXED','EVENT_COMPLETION_V1'])test('approval bytes drift refuses native dispatch without consuming the one-shot claim in '+mode,async()=>{
 const x=fixture();
 if(mode==='EVENT_COMPLETION_V1'){
  delete x.policy.sourceRunId;
  x.policy.sourceRunMode=mode;
 }
 const old=x.ports.readNativeScope;
 x.ports.readNativeScope=async()=>({...await old(),
  approvalBytes:Buffer.from('{"unapproved":true}')});
 const r=await publishNativeCompletion({...x,effect:'A_READONLY'});
 assert.equal(r.code,'CI_NATIVE_PUBLISH_APPROVAL_BYTES_DRIFT');
 assert.equal(r.state,'EVIDENCE_MISSING');
 assert.equal(x.readCount(),0);
});


test('isolated native publisher uses independently provisioned policy root, not operating E drive or writable claims',async t=>{
 const base=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-native-roots-'));
 t.after(()=>fs.rmSync(base,{recursive:true,force:true}));
 const scopeRoot=path.join(base,'b-installed-policy');
 const receiptRoot=path.join(base,'one-shot-claims');
 fs.mkdirSync(scopeRoot);fs.mkdirSync(receiptRoot);
 for(const effect of ['A_READONLY','B_WRITER_SOURCE']){
  const x=fixture(effect);
  const {approvalBytes,requestBytes}=await x.ports.readNativeScope();
  const policy=x.policy;
  const scope={schema:'ZGMINI_CI_NATIVE_READONLY_SCOPE_V1',policy,
   approvalBytesBase64:approvalBytes.toString('base64'),
   requestBytesBase64:requestBytes.toString('base64')};
  const proof={schema:'ZGMINI_CI_NATIVE_B_INSTALLED_PROOF_V1',effect,policy,
   nativePolicySha256:hash(Buffer.from(JSON.stringify(policy))),
   installationReceiptSha256:'f'.repeat(64),actualControllerSha:'d'.repeat(40),
   installationRequestId:'pc-update-12345678-1234-4234-8234-123456789abc',
   installationReceiptPath:'results/maintenance-pc-update-12345678-1234-4234-8234-123456789abc.json'};
  const basename=effect==='A_READONLY'?'ci-native-a':'ci-native-writer-b';
  fs.writeFileSync(path.join(scopeRoot,basename+'-approved.json'),JSON.stringify(scope));
  fs.writeFileSync(path.join(scopeRoot,basename+'-installed-proof.json'),JSON.stringify(proof));
 }
 const local=createNativePublisherLocalPolicyPorts({scopeRoot,receiptRoot});
 for(const effect of ['A_READONLY','B_WRITER_SOURCE']){
  assert.equal(local.readNativeScope(effect).policy.effect,effect);
  assert.equal(local.readNativeInstalledProof(effect).effect,effect);
  assert.equal(local.readNativeInstalledProof(effect).nativePolicySha256,
   hash(Buffer.from(JSON.stringify(local.readNativeScope(effect).policy))));
 }
 assert.equal(fs.readdirSync(receiptRoot).length,0);
 assert.throws(()=>local.readNativeScope('C_ADMIN'),/CI_NATIVE_SCOPE_EFFECT_DENIED/);
 assert.throws(()=>local.readNativeInstalledProof('C_ADMIN'),/CI_NATIVE_PROOF_EFFECT_DENIED/);
});
test('native publisher never trusts claim, TEMP, checkout or missing path as installed policy',t=>{
 const base=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-native-roots-denial-'));
 t.after(()=>fs.rmSync(base,{recursive:true,force:true}));
 const scopeRoot=path.join(base,'b-installed-policy');
 const receiptRoot=path.join(base,'one-shot-claims');
 fs.mkdirSync(scopeRoot);fs.mkdirSync(receiptRoot);
 for(const args of [
  {scopeRoot:receiptRoot,receiptRoot},
  {scopeRoot:base,receiptRoot},
  {scopeRoot,receiptRoot:base},
  {scopeRoot,receiptRoot,volatileRoots:[base]},
  {scopeRoot,receiptRoot,volatileRoots:[scopeRoot]},
  {scopeRoot:path.join(base,'never-installed'),receiptRoot},
  {scopeRoot:receiptRoot+'\\0override',receiptRoot},
  {scopeRoot:'.',receiptRoot}
 ]){
  assert.throws(()=>createNativePublisherLocalPolicyPorts(args),
   /CI_NATIVE_PUBLISH_LOCAL_ROOT_|CI_NATIVE_PUBLISH_POLICY_ROOT_NOT_INDEPENDENT|ENOENT/);
 }
});
test('both native publisher jobs inject separate installed policy root but never enable themselves',()=>{
 const y=fs.readFileSync(new URL('../.github/workflows/ci-native-auto-publish.yml',import.meta.url),'utf8');
 assert.equal(y.split('ZGMINI_CI_NATIVE_SCOPE_ROOT:').length-1,2);
 assert.match(y,/vars.ZGMINI_CI_NATIVE_A_ENABLED == 'true'/);
 assert.match(y,/vars.ZGMINI_CI_NATIVE_WRITER_B_ENABLED == 'true'/);
 assert.doesNotMatch(y,/mkdir|New-Item|Copy-Item|icacls|runner-smoke|controller\\entry\.mjs/);
});

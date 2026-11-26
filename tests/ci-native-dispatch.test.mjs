import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {dispatchApprovedCiEffect,createCiNativeReceiptStore} from '../ci-approval/native-dispatch.mjs';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
const repo={id:1442936296,full_name:'ansqhd5774-Choi/zgmini-pc-control',private:true};
const hash=b=>createHash('sha256').update(b).digest('hex');
const blob=b=>createHash('sha1').update(Buffer.from('blob '+b.length+'\0')).update(b).digest('hex');
const make=(effect='A_READONLY')=>{
 const bytes=Buffer.from('{"operation":"core-status"}');
 const path=effect==='A_READONLY'?'.github/workflows/ci-approved-a-once.yml':'.github/workflows/ci-approved-writer-b-once.yml';
 const source=Buffer.from('name: fixed trusted workflow\n');
 const policy={schema:'ZGMINI_CI_NATIVE_DISPATCH_V1',enabled:true,effect,
   receiverWorkflowPath:path,receiverWorkflowBlobSha:blob(source),
   sourceRunId:123,sourceAttempt:1,sourceWorkflowId:416355595,
   sourceHeadSha:'a'.repeat(40),sourceWorkflowPath:'.github/workflows/controller-maintenance-source-tests.yml',sourceWorkflowBlobSha:blob(source),
   businessApprovalSha256:'b'.repeat(64),approvedRequestSha256:hash(bytes),policyRevision:'c'.repeat(40)};
 const run={id:123,run_attempt:1,workflow_id:416355595,path:policy.sourceWorkflowPath,
   head_sha:policy.sourceHeadSha,status:'completed',conclusion:'success',event:'pull_request',
   repository:repo,head_repository:repo};
 let claims=[],dispatches=[],old=null;
 const ports={readSourceRun:async()=>run,
   readSourceWorkflow:async()=>({type:'file',path:policy.sourceWorkflowPath,encoding:'base64',sha:policy.sourceWorkflowBlobSha,content:source.toString('base64')}),
   readReceiverWorkflow:async()=>({type:'file',path,encoding:'base64',sha:policy.receiverWorkflowBlobSha,content:source.toString('base64')}),
   readInstalledReceiver:async()=>({...policy,enabled:true}),
   loadReceipt:async()=>old,
   saveReceipt:async(key,r,options)=>{claims.push({key,phase:r.phase,exclusive:options?.exclusive});old=r;},
   dispatchWorkflow:async(path,payload)=>{dispatches.push({path,payload});return {status:204}}};
 return {bytes,policy,ports,run,claims,dispatches,getOld:()=>old};
};
for(const effect of ['A_READONLY','B_WRITER_SOURCE'])test(effect+' fixed dispatch claims before dispatch, never asserts PC execution',async()=>{
 const x=make(effect),r=await dispatchApprovedCiEffect({policy:x.policy,requestBytes:x.bytes,ports:x.ports});
 assert.equal(r.state,'DISPATCH_ACCEPTED_NOT_EXECUTED');assert.equal(r.dispatched,true);assert.equal(r.executed,false);
 assert.deepEqual(x.claims.map(v=>v.phase),['CREATING','DISPATCH_ACCEPTED_NOT_EXECUTED']);
 assert.equal(x.claims[0].exclusive,true);assert.equal(x.dispatches.length,1);
 assert.equal(x.dispatches[0].payload.ref,'main');assert.equal(x.dispatches[0].payload.inputs.effect,effect);
 assert.deepEqual(Object.keys(x.dispatches[0].payload.inputs).sort(),
 ['approval_sha256','effect','effect_key','request_sha256','source_attempt','source_run_id'].sort());
 const repeat=await dispatchApprovedCiEffect({policy:x.policy,requestBytes:x.bytes,ports:x.ports});
 assert.equal(repeat.code,'CI_NATIVE_DISPATCH_PRIOR_EFFECT_NO_REPOST');assert.equal(x.dispatches.length,1);
});
test('disabled never reads or dispatches',async()=>{const x=make();x.policy.enabled=false;const r=await dispatchApprovedCiEffect({policy:x.policy,requestBytes:x.bytes,ports:x.ports});assert.equal(r.state,'DISABLED');assert.equal(x.claims.length,0);});
test('unverified approval bytes do not claim receipt',async()=>{const x=make();const r=await dispatchApprovedCiEffect({policy:x.policy,requestBytes:Buffer.from('{}'),ports:x.ports});assert.equal(r.code,'CI_NATIVE_DISPATCH_SCOPE_UNVERIFIED');assert.equal(x.dispatches.length,0);});
test('source run drift rejects without writes',async()=>{const x=make();x.run.head_sha='f'.repeat(40);const r=await dispatchApprovedCiEffect({policy:x.policy,requestBytes:x.bytes,ports:x.ports});assert.equal(r.code,'CI_NATIVE_DISPATCH_RUN_UNVERIFIED');assert.equal(x.claims.length,0);});
test('failed source CI rejects without writes',async()=>{const x=make();x.run.conclusion='failure';const r=await dispatchApprovedCiEffect({policy:x.policy,requestBytes:x.bytes,ports:x.ports});assert.equal(r.code,'CI_NATIVE_DISPATCH_RUN_UNVERIFIED');assert.equal(x.claims.length,0);});
test('receiver installed readback cannot be omitted',async()=>{const x=make();x.ports.readInstalledReceiver=async()=>null;const r=await dispatchApprovedCiEffect({policy:x.policy,requestBytes:x.bytes,ports:x.ports});assert.equal(r.code,'CI_NATIVE_DISPATCH_RECEIVER_NOT_ATTESTED');assert.equal(x.claims.length,0);});
test('receiver workflow SHA mismatch rejects',async()=>{const x=make();x.policy.receiverWorkflowBlobSha='0'.repeat(40);const r=await dispatchApprovedCiEffect({policy:x.policy,requestBytes:x.bytes,ports:x.ports});assert.equal(r.code,'CI_NATIVE_DISPATCH_RECEIVER_BYTES_UNVERIFIED');assert.equal(x.claims.length,0);});
test('receiver path cannot be caller-selected',async()=>{const x=make();x.policy.receiverWorkflowPath='.github/workflows/pc-job.yml';const r=await dispatchApprovedCiEffect({policy:x.policy,requestBytes:x.bytes,ports:x.ports});assert.equal(r.code,'CI_NATIVE_DISPATCH_SCOPE_UNVERIFIED');});
test('unknown POST preserves claim and does not retry',async()=>{const x=make();x.ports.dispatchWorkflow=async()=>{throw Error('network unknown');};const first=await dispatchApprovedCiEffect({policy:x.policy,requestBytes:x.bytes,ports:x.ports});assert.equal(first.code,'CI_NATIVE_DISPATCH_POST_OUTCOME_UNKNOWN');assert.equal(x.getOld().phase,'DISPATCH_OUTCOME_UNKNOWN');const second=await dispatchApprovedCiEffect({policy:x.policy,requestBytes:x.bytes,ports:x.ports});assert.equal(second.code,'CI_NATIVE_DISPATCH_PRIOR_EFFECT_NO_REPOST');});
test('receipt creation failure prevents dispatch',async()=>{const x=make();x.ports.saveReceipt=async()=>{throw Error('disk unavailable');};const r=await dispatchApprovedCiEffect({policy:x.policy,requestBytes:x.bytes,ports:x.ports});assert.equal(r.code,'CI_NATIVE_DISPATCH_RECEIPT_CLAIM_UNKNOWN');assert.equal(x.dispatches.length,0);});
test('unsupported effect does not dispatch',async()=>{const x=make();x.policy.effect='C_ADMIN';const r=await dispatchApprovedCiEffect({policy:x.policy,requestBytes:x.bytes,ports:x.ports});assert.equal(r.code,'CI_NATIVE_DISPATCH_SCOPE_UNVERIFIED');assert.equal(x.dispatches.length,0);});
test('foreign source repository is never accepted',async()=>{const x=make();x.run.head_repository={...repo,id:99};const r=await dispatchApprovedCiEffect({policy:x.policy,requestBytes:x.bytes,ports:x.ports});assert.equal(r.code,'CI_NATIVE_DISPATCH_RUN_UNVERIFIED');assert.equal(x.dispatches.length,0);});
test('source CI from push cannot masquerade as approved PR run',async()=>{const x=make();x.run.event='push';const r=await dispatchApprovedCiEffect({policy:x.policy,requestBytes:x.bytes,ports:x.ports});assert.equal(r.code,'CI_NATIVE_DISPATCH_RUN_UNVERIFIED');assert.equal(x.dispatches.length,0);});
test('installed receiver policy revision drift prevents dispatch',async()=>{const x=make();x.ports.readInstalledReceiver=async()=>({effect:x.policy.effect,enabled:true,receiverWorkflowBlobSha:x.policy.receiverWorkflowBlobSha,policyRevision:'d'.repeat(40),approvedRequestSha256:x.policy.approvedRequestSha256});const r=await dispatchApprovedCiEffect({policy:x.policy,requestBytes:x.bytes,ports:x.ports});assert.equal(r.code,'CI_NATIVE_DISPATCH_RECEIVER_NOT_ATTESTED');assert.equal(x.dispatches.length,0);});
test('HTTP not-204 is uncertain, never interpreted as execution',async()=>{const x=make();x.ports.dispatchWorkflow=async()=>({status:200});const r=await dispatchApprovedCiEffect({policy:x.policy,requestBytes:x.bytes,ports:x.ports});assert.equal(r.code,'CI_NATIVE_DISPATCH_POST_OUTCOME_UNKNOWN');assert.equal(x.getOld().phase,'DISPATCH_OUTCOME_UNKNOWN');});
test('durable prior receipt never reposts even if source run changes',async()=>{const x=make();await dispatchApprovedCiEffect({policy:x.policy,requestBytes:x.bytes,ports:x.ports});x.policy.sourceRunId=999;x.run.id=999;const r=await dispatchApprovedCiEffect({policy:x.policy,requestBytes:x.bytes,ports:x.ports});assert.equal(r.code,'CI_NATIVE_DISPATCH_PRIOR_EFFECT_NO_REPOST');assert.equal(x.dispatches.length,1);});
test('missing readback adapter prevents dispatch',async()=>{const x=make();delete x.ports.readInstalledReceiver;const r=await dispatchApprovedCiEffect({policy:x.policy,requestBytes:x.bytes,ports:x.ports});assert.equal(r.code,'CI_NATIVE_DISPATCH_PORT_UNAVAILABLE');assert.equal(x.dispatches.length,0);});

test('policy revision change cannot dispatch an existing business effect again',async()=>{const x=make();await dispatchApprovedCiEffect({policy:x.policy,requestBytes:x.bytes,ports:x.ports});x.policy.policyRevision='d'.repeat(40);const r=await dispatchApprovedCiEffect({policy:x.policy,requestBytes:x.bytes,ports:x.ports});assert.equal(r.code,'CI_NATIVE_DISPATCH_PRIOR_EFFECT_NO_REPOST');assert.equal(x.dispatches.length,1);});


function withRoot(fn){const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-native-ci-'));try{return fn(root)}finally{fs.rmSync(root,{recursive:true,force:true})}}
test('native receipt is durable across independent store instances',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-native-ci-'));
 try{const x=make(),store=createCiNativeReceiptStore(root);
 x.ports.loadReceipt=store.loadReceipt;x.ports.saveReceipt=store.saveReceipt;
 const first=await dispatchApprovedCiEffect({policy:x.policy,requestBytes:x.bytes,ports:x.ports});
 assert.equal(first.code,'CI_NATIVE_DISPATCH_WAKEUP_ONLY');
 const reopened=createCiNativeReceiptStore(root),persisted=reopened.loadReceipt(first.effectKey);
 assert.equal(persisted.phase,'DISPATCH_ACCEPTED_NOT_EXECUTED');
 x.ports.loadReceipt=reopened.loadReceipt;x.ports.saveReceipt=reopened.saveReceipt;
 const twice=await dispatchApprovedCiEffect({policy:x.policy,requestBytes:x.bytes,ports:x.ports});
 assert.equal(twice.code,'CI_NATIVE_DISPATCH_PRIOR_EFFECT_NO_REPOST');
 assert.throws(()=>reopened.saveReceipt(first.effectKey,persisted,{exclusive:true}),{code:'EEXIST'});
 assert.equal(x.dispatches.length,1);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('receipt root must preexist and cannot be under volatile root',()=>withRoot(root=>{
 assert.throws(()=>createCiNativeReceiptStore(path.join(root,'absent')));
 assert.throws(()=>createCiNativeReceiptStore(root,{volatileRoots:[os.tmpdir()]}),/CI_NATIVE_RECEIPT_ROOT_VOLATILE/);
}));
test('corrupt receipt cannot be treated as empty',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-native-ci-'));
 try{const x=make(),store=createCiNativeReceiptStore(root);
 x.ports.loadReceipt=store.loadReceipt;x.ports.saveReceipt=store.saveReceipt;
 const first=await dispatchApprovedCiEffect({policy:x.policy,requestBytes:x.bytes,ports:x.ports});
 fs.writeFileSync(path.join(root,'native-'+first.effectKey+'.json'),'{}');
 const next=await dispatchApprovedCiEffect({policy:x.policy,requestBytes:x.bytes,ports:x.ports});
 assert.equal(next.code,'CI_NATIVE_DISPATCH_RECEIPT_READ_UNKNOWN');assert.equal(x.dispatches.length,1);
 }finally{fs.rmSync(root,{recursive:true,force:true})}
});


test('pinned source workflow blob must match actual immutable bytes',async()=>{
 const x=make();const original=x.ports.readSourceWorkflow;
 x.ports.readSourceWorkflow=async()=>({...await original(),content:Buffer.from('edited workflow').toString('base64')});
 const r=await dispatchApprovedCiEffect({policy:x.policy,requestBytes:x.bytes,ports:x.ports});
 assert.equal(r.code,'CI_NATIVE_DISPATCH_SOURCE_BYTES_UNVERIFIED');assert.equal(x.dispatches.length,0);
});
test('source workflow pin mismatch must not create a receipt',async()=>{
 const x=make();x.policy.sourceWorkflowBlobSha='f'.repeat(40);
 const r=await dispatchApprovedCiEffect({policy:x.policy,requestBytes:x.bytes,ports:x.ports});
 assert.equal(r.code,'CI_NATIVE_DISPATCH_SOURCE_BYTES_UNVERIFIED');assert.equal(x.claims.length,0);
});
test('missing independent source workflow reader prevents calling receiver',async()=>{
 const x=make();delete x.ports.readSourceWorkflow;
 const r=await dispatchApprovedCiEffect({policy:x.policy,requestBytes:x.bytes,ports:x.ports});
 assert.equal(r.code,'CI_NATIVE_DISPATCH_PORT_UNAVAILABLE');assert.equal(x.dispatches.length,0);
});
test('caller cannot substitute approval hash absent independently installed grant',async()=>{
 const x=make(),installed={...x.policy};x.ports.readInstalledReceiver=async()=>installed;
 x.policy.businessApprovalSha256='f'.repeat(64);
 const r=await dispatchApprovedCiEffect({policy:x.policy,requestBytes:x.bytes,ports:x.ports});
 assert.equal(r.code,'CI_NATIVE_DISPATCH_RECEIVER_NOT_ATTESTED');assert.equal(x.claims.length,0);
});
test('caller cannot substitute source run and mint a new grant',async()=>{
 const x=make(),installed={...x.policy};x.ports.readInstalledReceiver=async()=>installed;
 x.policy.sourceRunId=999;x.run.id=999;
 const r=await dispatchApprovedCiEffect({policy:x.policy,requestBytes:x.bytes,ports:x.ports});
 assert.equal(r.code,'CI_NATIVE_DISPATCH_RECEIVER_NOT_ATTESTED');assert.equal(x.claims.length,0);
});
test('caller cannot substitute receiver path with another source file',async()=>{
 const x=make(),installed={...x.policy};x.ports.readInstalledReceiver=async()=>installed;
 x.policy.sourceWorkflowPath='.github/workflows/fake-tests.yml';x.run.path=x.policy.sourceWorkflowPath;
 const r=await dispatchApprovedCiEffect({policy:x.policy,requestBytes:x.bytes,ports:x.ports});
 assert.equal(r.code,'CI_NATIVE_DISPATCH_RECEIVER_NOT_ATTESTED');assert.equal(x.claims.length,0);
});

test('200 with verified workflow run ID is recorded without asserting execution',async()=>{
 const x=make(),id=928392;
 x.ports.dispatchWorkflow=async()=>({status:200,workflow_run_id:id,
  run_url:'https://api.github.com/repos/ansqhd5774-Choi/zgmini-pc-control/actions/runs/'+id,
  html_url:'https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/'+id});
 const r=await dispatchApprovedCiEffect({policy:x.policy,requestBytes:x.bytes,ports:x.ports});
 assert.equal(r.code,'CI_NATIVE_DISPATCH_WAKEUP_ONLY');assert.equal(r.downstreamRunId,id);
 assert.equal(r.executed,false);assert.equal(x.getOld().downstreamRunId,id);
});
test('200 without valid run details remains unknown and does not repost',async()=>{
 const x=make();
 x.ports.dispatchWorkflow=async()=>({status:200,workflow_run_id:928392,
   run_url:'https://untrusted.example/actions/runs/928392'});
 const r=await dispatchApprovedCiEffect({policy:x.policy,requestBytes:x.bytes,ports:x.ports});
 assert.equal(r.code,'CI_NATIVE_DISPATCH_POST_OUTCOME_UNKNOWN');
 assert.equal(x.getOld().phase,'DISPATCH_OUTCOME_UNKNOWN');
 const next=await dispatchApprovedCiEffect({policy:x.policy,requestBytes:x.bytes,ports:x.ports});
 assert.equal(next.code,'CI_NATIVE_DISPATCH_PRIOR_EFFECT_NO_REPOST');
});
test('200 response survives exact durable receipt readback',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-native-ci-'));
 try{
  const x=make(),store=createCiNativeReceiptStore(root),id=928394;
  x.ports.loadReceipt=store.loadReceipt;x.ports.saveReceipt=store.saveReceipt;
  x.ports.dispatchWorkflow=async()=>({status:200,workflow_run_id:id,
   run_url:'https://api.github.com/repos/ansqhd5774-Choi/zgmini-pc-control/actions/runs/'+id,
   html_url:'https://github.com/ansqhd5774-Choi/zgmini-pc-control/actions/runs/'+id});
  const r=await dispatchApprovedCiEffect({policy:x.policy,requestBytes:x.bytes,ports:x.ports});
  assert.equal(r.downstreamRunId,id);assert.equal(store.loadReceipt(r.effectKey).downstreamRunId,id);
 }finally{fs.rmSync(root,{recursive:true,force:true})}
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {
 authorizeW06Finalize,verifyW06FinalizationReady,applyW06Finalization,
 SCHEMA,TITLE,RESULT_SCHEMA,RECOVERY_ID,ENABLED_XML_SHA
} from '../task-create-b/finalize-contract.mjs';
import {ORIGIN,APPROVAL_PATH,APPROVAL_SHA} from '../task-create-b/recovery-contract.mjs';
import {sanitizeW06Finalization} from '../task-create-b/finalize-report.mjs';
const id='9b01a780-728e-41f8-aa6a-b92b9e992814';
const req={schema:SCHEMA,requestId:id,operation:'finalize-already-enabled-once',
 recoveryRequestId:RECOVERY_ID,originalCreateRequestId:ORIGIN,
 approvalManifestPath:APPROVAL_PATH,approvalManifestSha256:APPROVAL_SHA};
const m={scope:'W06_ONE_TASK_CREATE_AND_ENABLE_WITH_CNN_RUNTIME_EFFECTS',
 installedSourceSha:'a'.repeat(40),sidecarSourceSha256:'b'.repeat(64),
 coreTaskXmlSha256:'c'.repeat(64)};
const proof={request:req,originalProof:{request:{requestId:RECOVERY_ID},
 originProof:{request:{requestId:ORIGIN},manifest:m}}};
const event={action:'opened',sender:{login:'ansqhd5774-Choi'},
 repository:{full_name:'ansqhd5774-Choi/zgmini-pc-control',private:true},
 issue:{number:4000,title:TITLE,user:{login:'ansqhd5774-Choi'},
  labels:[{name:'pc-writer-b-install'}],body:JSON.stringify(req)}};
const env={GITHUB_REPOSITORY:'ansqhd5774-Choi/zgmini-pc-control',
 GITHUB_EVENT_NAME:'issues',GITHUB_EVENT_ACTION:'opened',
 GITHUB_ACTOR:'ansqhd5774-Choi',GITHUB_RUN_ATTEMPT:'1'};
const snapshot=()=>({taskPresent:true,taskXmlSha256:ENABLED_XML_SHA,
 wrapperExact:true,originalJournalExact:true,originalOwnerLockExact:true,
 originalBackupsMatch:true,savedCandidateExact:true,protectedUnchanged:true,
 disabledTaskExact:false,enabledTaskExact:true,installedSourceSha:m.installedSourceSha,
 configSourceSha:m.installedSourceSha,sidecarSourceSha256:m.sidecarSourceSha256,
 coreTaskXmlSha256:m.coreTaskXmlSha256});
function port({badBefore=null,badAfter=null,failedFinish=false}={}){
 const calls=[];let claimed=false;
 return {calls,io:{
  async snapshot(){calls.push('snapshot');
   return claimed?{...snapshot(),...badAfter}:{...snapshot(),...badBefore}},
  async claimOnce(v){calls.push('claim:'+v);claimed=true},
  async finishOnce(v){calls.push('finish:'+v);
   if(failedFinish)throw Error('UNKNOWN_AFTER_EFFECT')},
  async readback(v){calls.push('readback:'+v);return true}
 }};
}
test('W06 exact old approval proof is required for owner opened finalizer',()=>{
 let invoked=0;
 const p=authorizeW06Finalize({event,env,controlRoot:'X',
  read:({event:e})=>{
   invoked++;assert.equal(e.issue.title,'pc-writer-task-create-once');
   const body=JSON.parse(e.issue.body);
   assert.equal(body.requestId,ORIGIN);
   assert.equal(body.approvalManifestSha256,APPROVAL_SHA);
   return proof.originalProof.originProof;
  }});
 assert.equal(invoked,1);
 assert.equal(p.request.requestId,id);
 for(const changed of [
  {body:JSON.stringify({...req,recoveryRequestId:ORIGIN})},
  {body:JSON.stringify({...req,operation:'task-create-once'})},
  {body:JSON.stringify({...req,extra:'unapproved'})},
  {labels:[]},{title:'pc-writer-task-recover-once'}
 ]){
  assert.throws(()=>authorizeW06Finalize({event:{...event,
   issue:{...event.issue,...changed}},env,controlRoot:'X',
   read:()=>proof.originalProof.originProof}),e=>/^TASK_FINALIZE_B_/.test(e.code));
 }
});
test('W06 enabled Task and exact retained original CAS required before any claim',()=>{
 for(const drift of [
  {taskXmlSha256:'0'.repeat(64)},{originalOwnerLockExact:false},
  {originalBackupsMatch:false},{originalJournalExact:false},
  {savedCandidateExact:false},{protectedUnchanged:false},
  {disabledTaskExact:true},{enabledTaskExact:false},{wrapperExact:false},
  {coreTaskXmlSha256:'0'.repeat(64)}
 ])assert.throws(()=>verifyW06FinalizationReady({...snapshot(),...drift},m),
  e=>e.code==='TASK_FINALIZE_B_PREIMAGE_CAS_STOP');
 assert.equal(verifyW06FinalizationReady(snapshot(),m),true);
});
test('W06 finalizer never re-enables Task and releases only after two exact snapshots',async()=>{
 const {io,calls}=port();
 const x=await applyW06Finalization(proof,io);
 assert.equal(x.status,'TASK_FINALIZE_B_FINALIZED_VERIFIED');
 assert.equal(x.taskChanges,0);assert.equal(x.otherTaskChanges,0);
 assert.deepEqual(calls,['snapshot','claim:'+id,'snapshot','finish:'+RECOVERY_ID,'readback:'+id]);
 assert.equal(calls.some(x=>/enable|create|delete/i.test(x)),false);
});
test('W06 stale Task CAS fails before any filesystem claim',async()=>{
 const {io,calls}=port({badBefore:{taskXmlSha256:'f'.repeat(64)}});
 const x=await applyW06Finalization(proof,io);
 assert.equal(x.status,'TASK_FINALIZE_B_PREFLIGHT_STOP');
 assert.deepEqual(calls,['snapshot']);
});
test('W06 protected drift after claim never enters completion',async()=>{
 const {io,calls}=port({badAfter:{protectedUnchanged:false}});
 const x=await applyW06Finalization(proof,io);
 assert.equal(x.status,'TASK_FINALIZE_B_RECOVERY_REQUIRED');
 assert.equal(calls.some(y=>y.startsWith('finish:')),false);
});
test('W06 uncertain completion is never marked successful or retried',async()=>{
 const {io,calls}=port({failedFinish:true});
 const x=await applyW06Finalization(proof,io);
 assert.equal(x.status,'TASK_FINALIZE_B_RECOVERY_REQUIRED');
 assert.equal(x.finalizationAttempted,true);
 assert.equal(calls.filter(y=>y.startsWith('finish:')).length,1);
});
test('W06 finalizer success receipt independently verifies actual postcheck',()=>{
 const raw={schema:RESULT_SCHEMA,requestId:id,recoveryRequestId:RECOVERY_ID,
  originalCreateRequestId:ORIGIN,status:'TASK_FINALIZE_B_FINALIZED_VERIFIED',
  code:'TASK_FINALIZE_B_EXACT_OWNER_RELEASE_PASS',installed:true,taskChanges:0};
 assert.equal(sanitizeW06Finalization(raw,req,{verified:false}).installed,null);
 assert.equal(sanitizeW06Finalization(raw,req,{verified:true}).ownerLockReleased,true);
 assert.equal(sanitizeW06Finalization({...raw,requestId:'foreign'},req,{verified:true}).installed,null);
});
test('W06 no Task mutation or provider calls in finalization entry, receipt and port source',()=>{
 for(const p of ['../task-create-b/finalize-contract.mjs',
  '../task-create-b/finalize-entry.mjs',
  '../task-create-b/finalize-windows.mjs',
  '../task-create-b/finalize-report.mjs']){
  const c=fs.readFileSync(fileURLToPath(new URL(p,import.meta.url)),'utf8');
  assert.doesNotMatch(c,/\/Change.{0,200}\/Enable|\/Create.{0,200}\/TN|Start-ScheduledTask/);
  assert.doesNotMatch(c,/fetch\s*\(\s*['"]https:\/\/production|wrangler\s+d1/i);
 }
});

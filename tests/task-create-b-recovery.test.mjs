import test from 'node:test';
import assert from 'node:assert/strict';
import {
 authorizeTaskRecoveryB,RECOVERY_TITLE,RECOVERY_SCHEMA,ORIGIN,
 APPROVAL_PATH,APPROVAL_SHA,DISABLED_XML_SHA,RECOVERY_RESULT_SCHEMA
} from '../task-create-b/recovery-contract.mjs';
import {recoverW06TaskB,verifyRecoverySnapshot}
 from '../task-create-b/recovery-transaction.mjs';
import {sanitizeRecoveryB} from '../task-create-b/recovery-report.mjs';

const requestId='d70d6ad6-5779-4d92-ad76-63eae6ad019e';
const req={schema:RECOVERY_SCHEMA,requestId,
 operation:'recover-existing-disabled-once',
 originRequestId:ORIGIN,approvalManifestPath:APPROVAL_PATH,
 approvalManifestSha256:APPROVAL_SHA};
const manifest={scope:'W06_ONE_TASK_CREATE_AND_ENABLE_WITH_CNN_RUNTIME_EFFECTS',
 installedSourceSha:'393cee0da46515ff056543173fcd1253a858b3d7',
 sidecarSourceSha256:'a'.repeat(64),coreTaskXmlSha256:'b'.repeat(64)};
const proof={request:req,originProof:{request:{requestId:ORIGIN},manifest}};
const event={action:'opened',repository:{full_name:'ansqhd5774-Choi/zgmini-pc-control',private:true},
 sender:{login:'ansqhd5774-Choi'},issue:{number:4321,
 title:RECOVERY_TITLE,body:JSON.stringify(req),labels:[{name:'pc-writer-b-install'}],
 user:{login:'ansqhd5774-Choi'}}};
const env={GITHUB_REPOSITORY:'ansqhd5774-Choi/zgmini-pc-control',
 GITHUB_EVENT_NAME:'issues',GITHUB_EVENT_ACTION:'opened',
 GITHUB_ACTOR:'ansqhd5774-Choi',GITHUB_RUN_ATTEMPT:'1'};
const disabled=()=>({taskPresent:true,taskXmlSha256:DISABLED_XML_SHA,
 wrapperExact:true,originalJournalExact:true,originalOwnerLockExact:true,
 originalBackupsMatch:true,savedCandidateExact:true,protectedUnchanged:true,
 installedSourceSha:manifest.installedSourceSha,configSourceSha:manifest.installedSourceSha,
 sidecarSourceSha256:manifest.sidecarSourceSha256,
 coreTaskXmlSha256:manifest.coreTaskXmlSha256,
 disabledTaskExact:true,enabledTaskExact:false});
const enabled=()=>({...disabled(),taskXmlSha256:'c'.repeat(64),
 disabledTaskExact:false,enabledTaskExact:true});
function port({before=disabled(),after=enabled(),throwOnEnable=false,
 throwOnFinish=false}={}){
 const log=[];let flag=false;
 return {log,io:{
  async snapshot(){log.push('snapshot');return flag?after:before},
  async claimOnce(id){log.push('claim:'+id)},
  async enableOnce(hash){log.push('enable:'+hash);if(throwOnEnable)throw Error('UNKNOWN');
   flag=true},
  async finishOnce(id){log.push('finish:'+id);if(throwOnFinish)throw Error('UNKNOWN')}
 }};
}
test('fixed approval: exact original approved source, issue owner and recovery operation',()=>{
 let called=0;
 const p=authorizeTaskRecoveryB({event,env,controlRoot:'X',
  read:({event:x})=>{called++;const body=JSON.parse(x.issue.body);
   assert.equal(x.issue.title,'pc-writer-task-create-once');
   assert.equal(body.requestId,ORIGIN);
   assert.equal(body.approvalManifestSha256,APPROVAL_SHA);return proof.originProof}});
 assert.equal(called,1);assert.equal(p.request.requestId,requestId);
 for(const patch of [
  {body:JSON.stringify({...req,originRequestId:'0'.repeat(36)})},
  {body:JSON.stringify({...req,approvalManifestSha256:'0'.repeat(64)})},
  {title:'pc-writer-task-create-once'},
  {labels:[]}
 ]){
  assert.throws(()=>authorizeTaskRecoveryB({event:{...event,issue:{...event.issue,...patch}},
   env,controlRoot:'X',read:()=>proof.originProof}),
   e=>e.code?.startsWith('TASK_RECOVERY_B_'));
 }
});
test('fixed CAS rejects drift in original journal, lock, backup or Task before claim',()=>{
 for(const update of [
  {taskXmlSha256:'0'.repeat(64)},{originalOwnerLockExact:false},
  {originalJournalExact:false},{originalBackupsMatch:false},
  {wrapperExact:false},{savedCandidateExact:false},
  {disabledTaskExact:false},{protectedUnchanged:false},
  {sidecarSourceSha256:'0'.repeat(64)}
 ]){
  const snap={...disabled(),...update};
  assert.throws(()=>verifyRecoverySnapshot(snap,manifest),
   e=>e.code==='TASK_RECOVERY_B_PREIMAGE_CAS_STOP');
 }
 assert.equal(verifyRecoverySnapshot(enabled(),manifest,{enabled:true}),true);
 assert.throws(()=>verifyRecoverySnapshot(disabled(),manifest,{enabled:true}));
});
test('recovery finishes only one approved existing disabled Task after two CAS reads',async()=>{
 const {io,log}=port();
 const x=await recoverW06TaskB(proof,io);
 assert.equal(x.status,'TASK_RECOVERY_B_INSTALLED_VERIFIED');
 assert.equal(x.code,'TASK_RECOVERY_B_ONE_ENABLE_READBACK_PASS');
 assert.equal(x.installed,true);assert.equal(x.otherTaskChanges,0);
 assert.deepEqual(log,['snapshot','claim:'+requestId,'snapshot',
  'enable:'+DISABLED_XML_SHA,'snapshot','finish:'+requestId]);
});
test('preflight mismatch never claims or enables',async()=>{
 const {io,log}=port({before:{...disabled(),originalOwnerLockExact:false}});
 const x=await recoverW06TaskB(proof,io);
 assert.equal(x.status,'TASK_RECOVERY_B_PREFLIGHT_STOP');
 assert.deepEqual(log,['snapshot']);
});
test('claimed mutation unknown retains recovery and NEVER automatically re-enables',async()=>{
 const {io,log}=port({throwOnEnable:true});
 const x=await recoverW06TaskB(proof,io);
 assert.equal(x.status,'TASK_RECOVERY_B_RECOVERY_REQUIRED');
 assert.equal(x.lastEffect,'ENABLE_ATTEMPTED_RECONCILE_NO_RETRY');
 assert.equal(log.filter(x=>x.startsWith('enable:')).length,1);
 assert.equal(log.some(x=>x.startsWith('finish:')),false);
});
test('post-enabled final journal failure remains recovery required without rollback',async()=>{
 const {io,log}=port({throwOnFinish:true});
 const x=await recoverW06TaskB(proof,io);
 assert.equal(x.status,'TASK_RECOVERY_B_RECOVERY_REQUIRED');
 assert.equal(log.filter(x=>x.startsWith('enable:')).length,1);
 assert.equal(log.filter(x=>x.startsWith('finish:')).length,1);
});
test('result refuses to report success without independent PC readback',()=>{
 const success={schema:RECOVERY_RESULT_SCHEMA,requestId,originRequestId:ORIGIN,
  taskName:'ZGMINI-PC-CNN-Minute',code:'TASK_RECOVERY_B_ONE_ENABLE_READBACK_PASS',
  status:'TASK_RECOVERY_B_INSTALLED_VERIFIED',installed:true,taskChanges:1};
 assert.equal(sanitizeRecoveryB(success,req,false).installed,null);
 assert.equal(sanitizeRecoveryB(success,req,true).installed,true);
 assert.equal(sanitizeRecoveryB({...success,requestId:'other'},req,true).installed,null);
});

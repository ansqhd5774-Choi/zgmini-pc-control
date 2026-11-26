import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {authorizeRecoveryB,applyRecoveryB,ORIGINAL_REQUEST,
 RECOVERY_TITLE,RECOVERY_MANIFEST,RECOVERY_LABEL,RECOVERY_REQUEST_SCHEMA,
 DISABLED_TASK_SHA256,RECOVERY_RESULT_SCHEMA} from '../task-create-b/recovery-contract.mjs';

const root=path.dirname(fileURLToPath(import.meta.url));
const raw=fs.readFileSync(path.join(root,'../approvals/task-create-b/w06-cnn-minute-recovery-20261126.json'));
const digest=v=>createHash('sha256').update(v).digest('hex');
const create=()=>{
 const request={schema:RECOVERY_REQUEST_SCHEMA,
  requestId:'5346a3a7-62d6-4f91-9cc8-c7f636159e8a',
  operation:'task-recover-once',approvalManifestPath:RECOVERY_MANIFEST,
  approvalManifestSha256:digest(raw)};
 const event={action:'opened',repository:{full_name:'ansqhd5774-Choi/zgmini-pc-control',private:true},
  sender:{login:'ansqhd5774-Choi'},issue:{title:RECOVERY_TITLE,
   body:JSON.stringify(request),user:{login:'ansqhd5774-Choi'},
   labels:[{name:RECOVERY_LABEL}]}};
 return {event,request,proof:authorizeRecoveryB({event,manifestBytes:raw,manifestCommitted:true})};
};
function mocked(overrides={}){
 const calls=[];
 const port={
  async observe(){calls.push('observe');return true;},
  async claimRecoveryOnce(){calls.push('claim');},
  async enableExisting(){calls.push('enable');},
  async verifyEnabled(){calls.push('enabledReadback');return true;},
  async verifyProtected(){calls.push('protected');return true;},
  async releaseOriginalOwnerLock(){calls.push('releaseOldOwner');},
  ...overrides};
 return {port,calls};
}
test('W06 recovery is strictly an existing original-owner Task with precise HTTP SQLite D1 effects',()=>{
 const {proof}=create(),m=proof.manifest;
 assert.equal(m.taskDisabledXmlSha256,DISABLED_TASK_SHA256);
 assert.equal(m.ownerRequestId,ORIGINAL_REQUEST);
 assert.equal(m.runCount,1);
 assert.equal(m.allowTaskCreate,false);
 assert.equal(m.allowTaskDelete,false);
 assert.equal(m.allowOtherTaskChanges,false);
 assert.equal(m.allowScheduledCnnHttpRequests,true);
 assert.equal(m.allowScheduledSqliteWrites,true);
 assert.equal(m.allowScheduledD1Writes,true);
 assert.equal(m.taskName,'ZGMINI-PC-CNN-Minute');
});
test('W06 recovery explicitly rejects uncommitted, nonowner, forged and widened approval',()=>{
 const {event,request}=create();
 assert.throws(()=>authorizeRecoveryB({event,manifestBytes:raw,manifestCommitted:false}),
  e=>e.code==='TASK_RECOVERY_B_OWNER_OR_COMMIT_STOP');
 const forged={...event,issue:{...event.issue,user:{login:'other'}}};
 assert.throws(()=>authorizeRecoveryB({event:forged,manifestBytes:raw,manifestCommitted:true}),
  e=>e.code==='TASK_RECOVERY_B_OWNER_OR_COMMIT_STOP');
 const other=Buffer.from(JSON.stringify({...JSON.parse(raw),allowTaskCreate:true}));
 const altered={...event,issue:{...event.issue,body:JSON.stringify({...request,
  approvalManifestSha256:digest(other)})}};
 assert.throws(()=>authorizeRecoveryB({event:altered,manifestBytes:other,manifestCommitted:true}),
  e=>e.code==='TASK_RECOVERY_B_SCOPE_STOP');
 const replay={...event,issue:{...event.issue,body:JSON.stringify({...request,
  requestId:ORIGINAL_REQUEST})}};
 assert.throws(()=>authorizeRecoveryB({event:replay,manifestBytes:raw,manifestCommitted:true}),
  e=>e.code==='TASK_RECOVERY_B_REQUEST_STOP');
});
test('W06 exact-owner recovery runs one activation and only then releases original lock',async()=>{
 const {proof}=create(),{port,calls}=mocked();
 const r=await applyRecoveryB(proof,port);
 assert.equal(r.schema,RECOVERY_RESULT_SCHEMA);
 assert.equal(r.status,'TASK_RECOVERY_B_ENABLED_VERIFIED');
 assert.equal(r.installed,true);
 assert.equal(r.taskChanges,1);
 assert.deepEqual(calls,['observe','claim','observe','enable',
  'enabledReadback','protected','releaseOldOwner']);
});
test('W06 preimage fails before any Task mutation, claim or owner lock effect',async()=>{
 const {proof}=create(),{port,calls}=mocked({async observe(){calls.push('observe');return false;}});
 const r=await applyRecoveryB(proof,port);
 assert.equal(r.status,'TASK_RECOVERY_B_PREFLIGHT_STOP');
 assert.equal(r.installed,false);
 assert.deepEqual(calls,['observe']);
});
test('W06 uncertain original claim stays RECOVERY_REQUIRED without activation or release',async()=>{
 const {proof}=create(),{port,calls}=mocked({
  async claimRecoveryOnce(){calls.push('claim');throw Error('WIN32_UNCERTAIN');}
 });
 const r=await applyRecoveryB(proof,port);
 assert.equal(r.status,'TASK_RECOVERY_B_RECOVERY_REQUIRED');
 assert.equal(r.code,'TASK_RECOVERY_B_CLAIM_OUTCOME_UNKNOWN');
 assert.equal(r.installed,null);
 assert.deepEqual(calls,['observe','claim']);
});
test('W06 native enable uncertainty retains original owner lock with no automatic replay',async()=>{
 const {proof}=create(),{port,calls}=mocked({
  async enableExisting(){calls.push('enable');throw Error('SCHTASKS_AMBIGUOUS');}
 });
 const r=await applyRecoveryB(proof,port);
 assert.equal(r.status,'TASK_RECOVERY_B_RECOVERY_REQUIRED');
 assert.equal(r.installed,null);
 assert.deepEqual(calls,['observe','claim','observe','enable']);
});
test('W06 protected drift after activation never releases original lock or fakes a PASS',async()=>{
 const {proof}=create(),{port,calls}=mocked({
  async verifyProtected(){calls.push('protected');return false;}
 });
 const r=await applyRecoveryB(proof,port);
 assert.equal(r.status,'TASK_RECOVERY_B_RECOVERY_REQUIRED');
 assert.deepEqual(calls,['observe','claim','observe','enable','enabledReadback','protected']);
});
test('W06 original Task recovery code forbids new Task create, delete or network side effects',()=>{
 const code=fs.readFileSync(path.join(root,'../task-create-b/recovery-operating.mjs'),'utf8');
 assert.match(code,/createOperatingTaskCreateBPort/);
 assert.match(code,/taskXmlRaw\(TASK\)/);
 assert.match(code,/DISABLED_TASK_SHA256/);
 assert.match(code,/exactFile\(OWNER_LOCK,256\)/);
 assert.match(code,/fs\.openSync\(claimFile,'wx'\)/);
 assert.match(code,/existing\.enableTask\(TASK\)/);
 assert.match(code,/fs\.unlinkSync\(OWNER_LOCK\)/);
 assert.doesNotMatch(code,/['"]\/Create['"]/);
 assert.doesNotMatch(code,/['"]\/Delete['"]/);
 assert.doesNotMatch(code,/fetch\s*\(/);
 assert.doesNotMatch(code,/run\(\s*['"]cmd/i);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
 R54_B_V3_SCHEMA,R54_B_V3_SCOPE,R54_B_V3_TASK,
 R54_B_GUARD_BOOTSTRAP,R54_B_V3_SIX_FILES,R54_B_V3_SEQUENCE,
 R54_B_HISTORIC_TASK_CMD_SHA256,
 r54Bv3DraftManifest,validateR54Bv3DraftManifest,
 compareR54Bv3OriginalInventory,
} from '../tools/theme-nine-r54-b-guard-v3.mjs';

const checked=()=>r54Bv3DraftManifest();
const denied=fn=>assert.throws(fn,/R54_B_V3_MANIFEST_EXACT_CONTRACT_DENIED/);

test('V3 contract is deliberately Draft and denies executable authority',()=>{
 const value=checked();
 assert.equal(value.schema,R54_B_V3_SCHEMA);
 assert.equal(value.scope,R54_B_V3_SCOPE);
 assert.equal(value.status,'DRAFT_NOT_INSTALLABLE');
 assert.equal(validateR54Bv3DraftManifest(value).status,'DRAFT_VALIDATED_NOT_APPROVED');
 denied(()=>validateR54Bv3DraftManifest({...value,status:'APPROVED_B'}));
});
test('single Task hold despite two source transitions',()=>{
 const v=checked();
 assert.equal(v.runCount,1);
 assert.equal(v.taskStateException.disableCount,1);
 assert.equal(v.taskStateException.restoreCount,1);
 assert.equal(v.sequence.filter(s=>s==='DISABLE_EXACT_TASK_ONCE').length,1);
 assert.equal(v.sequence.filter(s=>s==='RESTORE_EXACT_TASK_ONCE').length,1);
 denied(()=>validateR54Bv3DraftManifest({...v,runCount:2}));
 denied(()=>validateR54Bv3DraftManifest({...v,taskStateException:{...R54_B_V3_TASK,noOtherTaskChanges:false}}));
});
test('guard and six-file source pins exactly cover approved paths',()=>{
 const pins=[R54_B_GUARD_BOOTSTRAP.lease,...R54_B_GUARD_BOOTSTRAP.directSourceMutators,
  ...R54_B_V3_SIX_FILES];
 assert.equal(pins.length,9);
 assert.equal(new Set(pins.map(x=>x.path)).size,9);
 assert.equal(R54_B_V3_SIX_FILES.length,6);
 assert.equal(R54_B_GUARD_BOOTSTRAP.lease.expectedOldState,'ABSENT');
 assert.match(R54_B_GUARD_BOOTSTRAP.lease.sharedLockDir,/R54_B_SOURCE_EXCLUSIVE\.lock$/);
});
test('connector old→interim→final are distinct exact SHA pins',()=>{
 const {connector}=R54_B_GUARD_BOOTSTRAP;
 const [six]=R54_B_V3_SIX_FILES;
 assert.equal(six.original,connector.originalSha256);
 assert.equal(six.beforeFinal,connector.guardedInterimSha256);
 assert.equal(six.next,connector.guardedFinalSha256);
 assert.equal(new Set([six.original,six.beforeFinal,six.next]).size,3);
 const v=checked();v.guardBootstrap.connector.guardedInterimSha256='0'.repeat(64);
 denied(()=>validateR54Bv3DraftManifest(v));
});
test('all other five pin old→final, no temporary mutation',()=>{
 for(const pin of R54_B_V3_SIX_FILES.slice(1)){
  assert.equal(pin.beforeFinal,pin.original);
  assert.notEqual(pin.next,pin.original);
  for(const sha of [pin.original,pin.beforeFinal,pin.next])assert.match(sha,/^[0-9a-f]{64}$/);
 }
});
test('rejects helper addition and mutator source SHA alteration',()=>{
 const v=checked();v.guardBootstrap.lease.expectedOldState='UNKNOWN';
 denied(()=>validateR54Bv3DraftManifest(v));
 const t=checked();t.guardBootstrap.directSourceMutators[0].nextSha256='0'.repeat(64);
 denied(()=>validateR54Bv3DraftManifest(t));
});
test('rejects path additions, missing files, duplicate staged files',()=>{
 const v=checked();v.sixFiles.push({...v.sixFiles[0],path:'etc/wrong'});
 denied(()=>validateR54Bv3DraftManifest(v));
 const s=checked();s.sixFiles.splice(2,1);
 denied(()=>validateR54Bv3DraftManifest(s));
});
test('rejects loss of drain, freeze or lease phases',()=>{
 for(const phase of ['WAIT_NATURAL_PARENT_CHILD_DRAIN_AND_MANUAL_FREEZE',
  'ACQUIRE_SHARED_B_LEASE','VERIFY_FINAL_HELPER_MUTATORS_AND_SIX_FILES']){
   const v=checked();v.sequence=v.sequence.filter(x=>x!==phase);
   denied(()=>validateR54Bv3DraftManifest(v));
  }
 assert.ok(R54_B_V3_SEQUENCE.indexOf('SWAP_ORIGINAL_TO_GUARDED_INTERIM')<
  R54_B_V3_SEQUENCE.indexOf('CAS_GUARDED_INTERIM_AND_OTHER_FIVE_TO_FINAL'));
});
test('must not broaden provider, D1, controller or sibling Task writes',()=>{
 for(const key of ['noProviderCalls','noD1Writes','noControllerChanges','noOtherTaskChanges']){
  const v=checked();v[key]=false;denied(()=>validateR54Bv3DraftManifest(v));
 }
});
test('cannot erase failclosed conditions or add hidden fields',()=>{
 const v=checked();v.taskStateException.noAutomaticRetry=false;
 denied(()=>validateR54Bv3DraftManifest(v));
 const t=checked();t.silentWrite=true;
 denied(()=>validateR54Bv3DraftManifest(t));
 assert.equal(typeof validateR54Bv3DraftManifest(checked()).sha256,'string');
});
const originInventory=()=>({
 task:{name:'ZGMINI-PC-Theme-Nine-R54-Public',enabled:true,
  xmlSha256:'a'.repeat(64),actionCmdSha256:R54_B_HISTORIC_TASK_CMD_SHA256,
  actionPathVerified:true,xmlBackupReadbackVerified:true},
 leaseState:'ABSENT',
 files:[
  ...R54_B_V3_SIX_FILES.map(x=>({path:x.path,sha256:x.original})),
  {path:R54_B_GUARD_BOOTSTRAP.lease.path,sha256:null},
  ...R54_B_GUARD_BOOTSTRAP.directSourceMutators.map(x=>({path:x.path,sha256:x.oldSha256})),
 ],
});
test('read-only inventory claim compares all 9 originals and one Task',()=>{
 const report=compareR54Bv3OriginalInventory(originInventory());
 assert.equal(report.checkedFiles,9);
 assert.equal(report.status,'BASELINE_CLAIM_MATCH_NOT_OS_ATTESTED');
});
test('inventory claim rejects stale installed Writer SHA and unexpected helper',()=>{
 const v=originInventory();v.files[0].sha256='f'.repeat(64);
 assert.throws(()=>compareR54Bv3OriginalInventory(v),/R54_B_V3_ORIGINAL_SOURCE_DRIFT/);
 const h=originInventory();h.files[6].sha256='f'.repeat(64);
 assert.throws(()=>compareR54Bv3OriginalInventory(h),/R54_B_V3_ORIGINAL_SOURCE_DRIFT/);
});
test('inventory claim rejects R78/R80 drift or extra paths',()=>{
 const r78=originInventory();r78.files[7].sha256='f'.repeat(64);
 assert.throws(()=>compareR54Bv3OriginalInventory(r78),/R54_B_V3_ORIGINAL_SOURCE_DRIFT/);
 const extra=originInventory();extra.files.push({path:'extra',sha256:null});
 assert.throws(()=>compareR54Bv3OriginalInventory(extra),/R54_B_V3_ORIGINAL_SOURCE_DRIFT/);
});
test('inventory claim rejects Task XML/action drift and lock unknown',()=>{
 const task=originInventory();task.task.actionCmdSha256='f'.repeat(64);
 assert.throws(()=>compareR54Bv3OriginalInventory(task),/R54_B_V3_TASK_BASELINE_UNVERIFIED/);
 const xml=originInventory();xml.task.xmlBackupReadbackVerified=false;
 assert.throws(()=>compareR54Bv3OriginalInventory(xml),/R54_B_V3_TASK_BASELINE_UNVERIFIED/);
 const held=originInventory();held.leaseState='HELD';
 assert.throws(()=>compareR54Bv3OriginalInventory(held),/R54_B_V3_INITIAL_LEASE_STATE_UNKNOWN/);
});

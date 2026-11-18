import test from 'node:test';
import assert from 'node:assert/strict';
import {
 R47_CMD_B,R47_CMD_B_CALENDAR_SAFE,R47_CMD_B_TRANSIENT_SAFE,
 R47_CMD_B_UTC_BOUNDARY_SAFE,validateR47CmdBManifest,verifyR47CmdBPreimage,
 verifyR47CmdBCandidate,verifyR47CmdBPaused,applyR47CmdBCas
} from '../task-cmd-b/r47-onefile-cas.mjs';

function manifest(){
 return {
  schema:R47_CMD_B.schema,status:'APPROVED_B',scope:R47_CMD_B.scope,
  requestId:'w03-r47-cmd-b-20261117-fixed-001',
  sourceRepository:R47_CMD_B.sourceRepository,
  sourceSha:'d959424f3218af892b186cb35c251736e95cbac5',
  sourcePath:R47_CMD_B.sourcePath,
  targetPath:R47_CMD_B.targetPath,
  task:R47_CMD_B.task,
  beforeSha256:R47_CMD_B.historicalOldSha256,
  afterSha256:R47_CMD_B.requestedTargetSha256,
  taskXmlSha256:R47_CMD_B.historicalTaskXmlSha256,
  runCount:1,allowTaskChanges:false,allowProviderCalls:false,
  allowSqliteWrites:false,allowD1Writes:false,allowOtherFileWrites:false,
 };
}
function preimage(m){
 return {task:m.task,taskActionPath:m.targetPath,
  installedFilePath:m.targetPath,taskXmlSha256:m.taskXmlSha256,
  installedSha256:m.beforeSha256,taskEnabled:true,taskRunning:false,
  sharedWriterLeaseOwned:true,unrelatedWriteConflict:false,
  sourceDirtyOnTarget:false};
}
test('legacy onefile GO stays exact and new calendar-safe version accepts only its own pinned source',()=>{
 const legacy=manifest();
 assert.equal(validateR47CmdBManifest(legacy),legacy);
 const upgrade={...legacy,
  sourceSha:R47_CMD_B_CALENDAR_SAFE.sourceSha,
  beforeSha256:R47_CMD_B_CALENDAR_SAFE.beforeSha256,
  afterSha256:R47_CMD_B_CALENDAR_SAFE.afterSha256};
 assert.equal(validateR47CmdBManifest(upgrade),upgrade);
 assert.equal(verifyR47CmdBPreimage(upgrade,preimage(upgrade)),true);
 const paused={...preimage(upgrade),taskEnabled:false,
  taskDefinitionExceptEnabledMatchesOriginal:true};
 assert.equal(verifyR47CmdBPaused(upgrade,paused),true);
 for(const mutant of [
  {...upgrade,sourceSha:'a'.repeat(40)},
  {...upgrade,beforeSha256:legacy.beforeSha256},
  {...upgrade,afterSha256:legacy.afterSha256},
  {...legacy,beforeSha256:upgrade.beforeSha256},
  {...legacy,afterSha256:upgrade.afterSha256},
  {...upgrade,taskXmlSha256:'0'.repeat(64)},
  {...upgrade,targetPath:String.raw`E:\ZGmini\different.cmd`},
  {...upgrade,allowOtherFileWrites:true}
 ]){
  assert.throws(()=>validateR47CmdBManifest(mutant),{
   code:mutant.allowOtherFileWrites?'TASK_CMD_B_SIDE_EFFECT_STOP':
    'TASK_CMD_B_MANIFEST_SCOPE_STOP'});
 }
 assert.throws(()=>verifyR47CmdBPreimage(upgrade,{
  ...preimage(upgrade),installedSha256:legacy.beforeSha256
 }),{code:'TASK_CMD_B_PREIMAGE_STOP'});
});
test('R47 fixed CMD path matches the R54 observed data-root location, not a doubled pc-writer segment',()=>{
 const r54Observed=String.raw`E:\ZGmini\data\pc-writer\theme-nine-r48\THEME_NINE_R47_RECURRING_PRIVATE_UPDATE.cmd`;
 assert.equal(R47_CMD_B.targetPath,r54Observed);
 // This does not certify Task Exec action: preimage comparison still fails closed.
 assert.throws(()=>verifyR47CmdBPreimage(manifest(),{
  ...preimage(manifest()),taskActionPath:String.raw`E:\ZGmini\data\pc-writer\pc-writer\theme-nine-r48\THEME_NINE_R47_RECURRING_PRIVATE_UPDATE.cmd`
 }),{code:'TASK_CMD_B_PREIMAGE_STOP'});
});
test('R47 one-file manifest restricts task, CMD path, both SHA and effects',()=>{
 const m=manifest();assert.equal(validateR47CmdBManifest(m),m);
 for(const [key,value] of [
  ['status','PROPOSED_NOT_APPROVED'],
  ['targetPath',String.raw`E:\\ZGmini\\data\\pc-writer\\different.cmd`],
  ['beforeSha256','0'.repeat(64)],
  ['afterSha256','f'.repeat(64)],
  ['taskXmlSha256','0'.repeat(64)],
  ['allowTaskChanges',true],['allowProviderCalls',true],
  ['allowSqliteWrites',true],['allowD1Writes',true],
  ['allowOtherFileWrites',true],['runCount',2]
 ]) {
  assert.throws(()=>validateR47CmdBManifest({...m,[key]:value}),
   {code:key.startsWith('allow')?'TASK_CMD_B_SIDE_EFFECT_STOP':
    'TASK_CMD_B_MANIFEST_SCOPE_STOP'},key);
 }
 assert.throws(()=>validateR47CmdBManifest({...m,command:'cmd /c whoami'}),
  {code:'TASK_CMD_B_MANIFEST_FIELDS_STOP'});
});
test('R47 CAS preimage requires the actual installed Task action, not repo source path',()=>{
 const m=manifest();
 assert.equal(verifyR47CmdBPreimage(m,preimage(m)),true);
 for(const [key,value] of [
  ['taskActionPath',m.sourcePath],['installedSha256','e'.repeat(64)],
  ['taskXmlSha256','d'.repeat(64)],['taskRunning',true],
  ['sharedWriterLeaseOwned',false],['sourceDirtyOnTarget',true],
  ['unrelatedWriteConflict',true]
 ]) assert.throws(()=>verifyR47CmdBPreimage(m,{...preimage(m),[key]:value}),
  {code:'TASK_CMD_B_PREIMAGE_STOP'},key);
});
test('R47 CMD candidate accepts bytes only at exact expected SHA',()=>{
 assert.throws(()=>verifyR47CmdBCandidate(manifest(),Buffer.from('unverified')),
  {code:'TASK_CMD_B_CANDIDATE_SHA_STOP'});
});
test('R47 adapter must be registered, no implicit Windows execution',async()=>{
 await assert.rejects(()=>applyR47CmdBCas(manifest(),{}),
  {code:'TASK_CMD_B_ADAPTER_NOT_REGISTERED_STOP'});
});
test('R47 rejected B approval performs no lease or file change',async()=>{
 const m=manifest();let calls=[];
 const io={
  assertPinnedApproval:async()=>{calls.push('approval');return false},
  acquireSharedWriterLease:async()=>{calls.push('lock')},
  readPreimage:async()=>preimage(m),
  fetchCandidateBytes:async()=>Buffer.from('invalid'),
  backupOriginal:async()=>({sha256:m.beforeSha256,durable:true}),
  pauseExactTask:async()=>{},
  readPausedState:async()=>({...preimage(m),taskEnabled:false,
   taskDefinitionExceptEnabledMatchesOriginal:true}),
  restoreExactTask:async()=>{},
  verifyTaskRestored:async()=>true,
  journalWriteIntent:async()=>{},
  assertTaskQuiet:async()=>{},
  replaceExactBytesIfBeforeMatches:async()=>{calls.push('replace')},
  readInstalledAfter:async()=>({}),
  releaseSharedWriterLease:async()=>{calls.push('release')},
 };
 const result=await applyR47CmdBCas(m,io);
 assert.equal(result.status,'STOP');
 assert.equal(result.code,'TASK_CMD_B_APPROVAL_NOT_VERIFIED_STOP');
 assert.deepEqual(calls,['approval']);
});
test('R47 candidate mismatch safely releases owned shared Writer lease',async()=>{
 const m=manifest();let calls=[],released;
 const io={
  assertPinnedApproval:async()=>true,
  acquireSharedWriterLease:async()=>{calls.push('lease')},
  readPreimage:async()=>preimage(m),
  fetchCandidateBytes:async()=>Buffer.from('incorrect bytes'.repeat(20)),
  backupOriginal:async()=>{calls.push('backup');return{}},
  pauseExactTask:async()=>{},
  readPausedState:async()=>({...preimage(m),taskEnabled:false,
   taskDefinitionExceptEnabledMatchesOriginal:true}),
  restoreExactTask:async()=>{},
  verifyTaskRestored:async()=>true,
  journalWriteIntent:async()=>{calls.push('intent')},
  assertTaskQuiet:async()=>{},
  replaceExactBytesIfBeforeMatches:async()=>{calls.push('write')},
  readInstalledAfter:async()=>({}),
  releaseSharedWriterLease:async x=>{released=x;calls.push('release')},
 };
 const result=await applyR47CmdBCas(m,io);
 assert.equal(result.status,'STOP');assert.equal(result.providerCalls,0);
 assert.equal(result.code,'TASK_CMD_B_CANDIDATE_SHA_STOP');
 assert.deepEqual(calls,['lease','release']);
 assert.equal(released.retain,false);
});

test('R47 requires disabled and drained Task before any file write',()=>{
 const m=manifest(),base={...preimage(m),taskEnabled:false,
  taskDefinitionExceptEnabledMatchesOriginal:true};
 assert.equal(verifyR47CmdBPaused(m,base),true);
 for(const [key,value] of [
  ['taskEnabled',true],['taskRunning',true],
  ['taskDefinitionExceptEnabledMatchesOriginal',false],
  ['sharedWriterLeaseOwned',false],
  ['installedSha256','f'.repeat(64)]
 ]) assert.throws(()=>verifyR47CmdBPaused(m,{...base,[key]:value}),
  {code:'TASK_CMD_B_PAUSED_PREIMAGE_STOP'},key);
});

test('transient-recovery upgrade accepts only exact current preimage and reviewed source',async()=>{
 const {R47_CMD_B_TRANSIENT_SAFE:p}=await import('../task-cmd-b/r47-onefile-cas.mjs');
 const m={...manifest(),sourceSha:p.sourceSha,beforeSha256:p.beforeSha256,afterSha256:p.afterSha256};
 assert.equal(validateR47CmdBManifest(m),m);
 assert.equal(verifyR47CmdBPreimage(m,preimage(m)),true);
 for(const mutant of [{...m,sourceSha:'a'.repeat(40)},
   {...m,beforeSha256:R47_CMD_B.historicalOldSha256},
   {...m,afterSha256:R47_CMD_B_CALENDAR_SAFE.afterSha256}]){
  assert.throws(()=>validateR47CmdBManifest(mutant),{code:'TASK_CMD_B_MANIFEST_SCOPE_STOP'});
 }
});


test('UTC scorer fix B is one exact source/preimage/after SHA transition only',()=>{
 const pin=R47_CMD_B_UTC_BOUNDARY_SAFE;
 const m={...manifest(),sourceSha:pin.sourceSha,
  beforeSha256:pin.beforeSha256,afterSha256:pin.afterSha256};
 assert.equal(pin.beforeSha256,R47_CMD_B_TRANSIENT_SAFE.afterSha256);
 assert.equal(validateR47CmdBManifest(m),m);
 assert.equal(verifyR47CmdBPreimage(m,preimage(m)),true);
 assert.equal(verifyR47CmdBPaused(m,{...preimage(m),
  taskEnabled:false,taskDefinitionExceptEnabledMatchesOriginal:true}),true);
 for(const changed of [
  {sourceSha:R47_CMD_B_TRANSIENT_SAFE.sourceSha},
  {beforeSha256:R47_CMD_B_TRANSIENT_SAFE.beforeSha256},
  {afterSha256:R47_CMD_B_TRANSIENT_SAFE.afterSha256},
  {taskXmlSha256:'0'.repeat(64)},
  {targetPath:String.raw`E:\\ZGmini\\data\\other.cmd`},
  {runCount:2},
 ]){
  assert.throws(()=>validateR47CmdBManifest({...m,...changed}),
   {code:'TASK_CMD_B_MANIFEST_SCOPE_STOP'});
 }
 for(const key of ['allowProviderCalls','allowSqliteWrites','allowD1Writes',
  'allowTaskChanges','allowOtherFileWrites']){
  assert.throws(()=>validateR47CmdBManifest({...m,[key]:true}),
   {code:'TASK_CMD_B_SIDE_EFFECT_STOP'});
 }
 assert.throws(()=>verifyR47CmdBPreimage(m,{
  ...preimage(m),installedSha256:R47_CMD_B_TRANSIENT_SAFE.beforeSha256
 }),{code:'TASK_CMD_B_PREIMAGE_STOP'});
 // Old triples retain their explicit source/after pairing.
 const previous={...manifest(),
  sourceSha:R47_CMD_B_TRANSIENT_SAFE.sourceSha,
  beforeSha256:R47_CMD_B_TRANSIENT_SAFE.beforeSha256,
  afterSha256:R47_CMD_B_TRANSIENT_SAFE.afterSha256};
 assert.equal(validateR47CmdBManifest(previous),previous);
 assert.throws(()=>validateR47CmdBManifest({...previous,
  afterSha256:pin.afterSha256}),{code:'TASK_CMD_B_MANIFEST_SCOPE_STOP'});
});

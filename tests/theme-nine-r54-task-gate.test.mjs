import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {runApprovedR54TaskTransition,R54_TASK_NAME,R54_TASK_ACTION,
 R54_TASK_ACTION_SHA256,R54_TASK_EXCEPTION,runR54QuarantinedConnectorSwap}
 from '../tools/theme-nine-r54-task-gate.mjs';
import {FILES} from '../tools/theme-nine-r54-sixfile-b.mjs';

const hash=x=>createHash('sha256').update(x).digest('hex');
const approval={grade:'B',scope:R54_TASK_EXCEPTION,taskName:R54_TASK_NAME,
 singleUse:true,preserveTaskDefinition:true,
 allowForceTermination:false,allowOtherTaskChanges:false};
const hashes=FILES.map(x=>({...x}));
function fixture({enabled=true,drainBusy=0,blockManual=true,
 conflictingSourceLaunches=0,unrelatedTaskCount=0,
 swapMode='success',restoreOK=true}={}){
 const state={enabled,initialEnabled:enabled,phase:'old',drainBusy,
  disableCalls:0,restoreCalls:0,applies:0,waits:0,kills:0,readbacks:0};
 const xml=Buffer.from('<Task><Action>R54</Action></Task>');
 const snap=()=>({name:R54_TASK_NAME,actionPath:R54_TASK_ACTION,
  actionSha256:R54_TASK_ACTION_SHA256,
  definitionDigest:hash('definition-stable'),
  xml:Buffer.from(xml),enabled:state.enabled});
 const ports={
  inspect:async()=>{state.readbacks++;return snap()},
  saveBaseline:async data=>({writtenAndReadback:true,
   xmlSha256:hash(data.xml),initialEnabled:data.enabled}),
  disable:async(name)=>{assert.equal(name,R54_TASK_NAME);state.disableCalls++;
   state.enabled=false;return {success:true}},
  closedRoutes:async()=>{const busy=state.drainBusy>0;
   if(busy)state.drainBusy--;
   return {taskName:R54_TASK_NAME,schedulerStartDisabled:!state.enabled,
     taskNotRunning:!busy,childProcessCount:busy?2:0,
     conflictingSourceLaunches,unrelatedTaskCount,
     installWindowExclusivityVerified:blockManual,
     relevantLocksClear:!busy,exclusiveBLeaseHeld:true}},
  readSixHashes:async()=>hashes.map(x=>({...x,actual:x[state.phase]})),
  restore:async({taskName,enabled:original,expectedXmlSha256})=>{
   assert.equal(taskName,R54_TASK_NAME);
   assert.equal(expectedXmlSha256,hash(xml));state.restoreCalls++;
   if(!restoreOK)return {success:false};
   state.enabled=original;return {success:true}},
  wait:async()=>{state.waits++},
 };
 const applySix=async()=>{
  state.applies++;
  if(swapMode==='mixed'){
   state.phase='old';const original=ports.readSixHashes;
   ports.readSixHashes=async()=>{const x=await original();
     x[1].actual=x[1].next;return x};
   throw Error('INJECTED_PARTIAL_SWAP');
  }
  if(swapMode==='rolledback')throw Error('INJECTED_ROLLBACK');
  state.phase='next';return {status:'SIX_FILE_SOURCE_APPLIED_SHA_VERIFIED'};
 };
 return {state,ports,applySix};
}

test('one-time B gate disables only R54, applies six, verifies and restores exact enabled state',async()=>{
 const {state,ports,applySix}=fixture();
 const result=await runApprovedR54TaskTransition({authorization:approval,ports,applySix,waitMs:0});
 assert.equal(result.status,'R54_SIXFILE_AND_TASK_RESTORED_VERIFIED');
 assert.equal(state.disableCalls,1);assert.equal(state.restoreCalls,1);
 assert.equal(state.enabled,true);assert.equal(state.applies,1);assert.equal(state.kills,0);
});

test('drains active task and child processes naturally; never kills or duplicates apply',async()=>{
 const {state,ports,applySix}=fixture({drainBusy:3});
 await runApprovedR54TaskTransition({authorization:approval,ports,applySix,waitMs:0});
 assert.equal(state.waits,3);assert.equal(state.applies,1);assert.equal(state.kills,0);
});

test('unrelated scheduled tasks do not block a collision-free R54 transaction',async()=>{
 const f=fixture({unrelatedTaskCount:11});
 const result=await runApprovedR54TaskTransition({authorization:approval,
  ports:f.ports,applySix:f.applySix,waitMs:0});
 assert.equal(result.status,'R54_SIXFILE_AND_TASK_RESTORED_VERIFIED');
 assert.equal(f.state.applies,1);
});

test('actual competing source writer prevents the swap despite idle R54 Task',async()=>{
 const f=fixture({conflictingSourceLaunches:1});
 await assert.rejects(runApprovedR54TaskTransition({authorization:approval,
  ports:f.ports,applySix:f.applySix,maxDrainChecks:2,waitMs:0}),
  {code:'R54_TASK_NATURAL_DRAIN_PENDING'});
 assert.equal(f.state.applies,0);
});

test('pre-existing disabled task remains disabled after swap',async()=>{
 const {state,ports,applySix}=fixture({enabled:false});
 const result=await runApprovedR54TaskTransition({authorization:approval,ports,applySix,waitMs:0});
 assert.equal(result.taskRestoredEnabled,false);
 assert.equal(state.disableCalls,0);assert.equal(state.restoreCalls,1);
});

test('cannot start without exact B exception or verified baseline source',async()=>{
 const f=fixture();
 await assert.rejects(runApprovedR54TaskTransition({authorization:{...approval,
    allowOtherTaskChanges:true},ports:f.ports,applySix:f.applySix}),
    {code:'R54_TASK_B_EXCEPTION_REQUIRED'});
 assert.equal(f.state.disableCalls,0);
 f.ports.readSixHashes=async()=>hashes.map(x=>({...x,actual:x.next}));
 await assert.rejects(runApprovedR54TaskTransition({authorization:approval,
    ports:f.ports,applySix:f.applySix}),
    {code:'R54_TASK_INSTALLED_SIX_ORIGINAL_SHA_DRIFT'});
 assert.equal(f.state.disableCalls,0);
});

test('manual entrypoint not blocked -> never swaps, leaves task disabled for reconciliation',async()=>{
 const f=fixture({blockManual:false});
 await assert.rejects(runApprovedR54TaskTransition({authorization:approval,
   ports:f.ports,applySix:f.applySix,maxDrainChecks:3,waitMs:0}),
   {code:'R54_TASK_NATURAL_DRAIN_PENDING'});
 assert.equal(f.state.applies,0);assert.equal(f.state.enabled,false);
});

test('injected partial swap cannot reactivate schedule; rollback result never retried',async()=>{
 const partial=fixture({swapMode:'mixed'});
 await assert.rejects(runApprovedR54TaskTransition({authorization:approval,
   ports:partial.ports,applySix:partial.applySix,waitMs:0}),
   {code:'R54_TASK_HOLD_DISABLED_MIXED_SOURCE'});
 assert.equal(partial.state.enabled,false);assert.equal(partial.state.restoreCalls,0);
 const safe=fixture({swapMode:'rolledback'});
 await assert.rejects(runApprovedR54TaskTransition({authorization:approval,
   ports:safe.ports,applySix:safe.applySix,waitMs:0}),
   {code:'R54_TASK_SIXFILE_APPLY_FAILED_RESTORED'});
 assert.equal(safe.state.enabled,true);assert.equal(safe.state.applies,1);
});

test('restore uncertainty is never called success',async()=>{
 const f=fixture({restoreOK:false});
 await assert.rejects(runApprovedR54TaskTransition({authorization:approval,
   ports:f.ports,applySix:f.applySix,waitMs:0}),
   {code:'R54_TASK_RESTORE_OUTCOME_UNKNOWN'});
 assert.equal(f.state.enabled,false);
});

test('verified source rollback still keeps task disabled when descendants are active',async()=>{
 const f=fixture({swapMode:'rolledback'});
 const scan=f.ports.closedRoutes;
 f.ports.closedRoutes=async()=>{
  const result=await scan();
  return f.state.applies?{...result,taskNotRunning:false,childProcessCount:1}:result;
 };
 await assert.rejects(runApprovedR54TaskTransition({authorization:approval,
   ports:f.ports,applySix:f.applySix,waitMs:0}),
   {code:'R54_TASK_HOLD_DISABLED_AFTER_ROLLBACK'});
 assert.equal(f.state.enabled,false);assert.equal(f.state.restoreCalls,0);
});

function connectorFixture({bypass=false,regenerator=false,failSwap=false,failRollback=false,
 failAfterExpose=false,failAfterQuarantine=false,failRestoreOriginal=false,
 activeBeforeQuarantine=0}={}){
 const state={connector:'old',five:'old',manualStarts:[],
  blockedStarts:0,active:activeBeforeQuarantine,drains:0,rollbackCalls:0};
 const spec=FILES.find(x=>x.path.endsWith('/theme-nine-r54-public-connect.mjs'));
 const rows=()=>FILES.map(x=>({...x,actual:x.path===spec.path
   ?state.connector==='absent'?null:x[state.connector]
   :x[state.five]}));
 const tryManualStart=()=>{
  if(state.connector==='absent'){
   state.blockedStarts++;return false;
  }
  state.manualStarts.push({connector:state.connector,five:state.five});return true;
 };
 const ports={
  verifyEntrypoints:async()=>({verifiedAllKnownPaths:true,
    allR54RoutesLoadConnector:!bypass,
    unexpectedDirectEntryAbsent:true,sourceRegeneratorEntrypointsExcluded:!regenerator,
    otherSourceWriterProcessesAbsent:true}),
  readSixHashes:async()=>rows(),
  quarantineOriginalConnector:async(x)=>{
    assert.equal(x.path,spec.path);state.connector='absent';
    if(failAfterQuarantine)throw Error('INJECTED_RENAME_SUCCEEDED_ACK_LOST');
    return {atomicRenameVerified:true,backupSha256:spec.old}},
  readBarrier:async()=>({connectorAbsent:state.connector==='absent',
    originalBackupSha256:spec.old,fiveOriginalShaVerified:state.five==='old',
    exclusiveBLeaseHeld:true,otherSourceWritersExcluded:true}),
  scanRunning:async()=>{
    const running=state.active>0; if(running)state.active--;
    state.drains++;
    // Concurrent manual command invoking the pinned connector is blocked.
    tryManualStart();
    return {taskDisabled:true,activeR54ProcessCount:running?1:0,
      activeDescendantCount:running?1:0,otherExecutableEntrypointsAbsent:true}},
  swapFive:async(five)=>{
    assert.equal(five.length,5);assert.equal(state.connector,'absent');
    tryManualStart();
    if(failSwap){state.five='mixed';throw Error('INJECTED_MID_SWAP')}
    state.five='next';return {fiveNextShaVerified:true}},
  installNewConnector:async()=>{
    assert.equal(state.five,'next');
    state.connector='next';
    if(failAfterExpose)throw Error('INJECTED_POST_RENAME_IO');
    return {atomicRenameVerified:true,newSha256:spec.next}},
  quarantineNewConnector:async()=>{state.connector='absent';
    return {connectorAbsent:true}},
  rollbackFive:async()=>{state.rollbackCalls++;
    if(failRollback)return {fiveOldShaVerified:false};
    state.five='old';return {fiveOldShaVerified:true}},
  restoreOldConnector:async()=>{assert.equal(state.five,'old');
    if(failRestoreOriginal)throw Error('INJECTED_OLD_CONNECTOR_RESTORE_FAIL');
    state.connector='old';return {originalSha256:spec.old}},
  wait:async()=>{},
 };
 const gate={taskName:R54_TASK_NAME,taskDisabledVerified:true,
  exclusiveBLeaseHeld:true,originalTaskXmlBackedUp:true,
  originalTaskStateBackedUp:true,knownRoutesAttested:true,
  preQuarantineNaturalDrainVerified:true};
 return {state,gate,ports,tryManualStart};
}

test('connector-last quarantine blocks manual entry while five files change',async()=>{
 const f=connectorFixture({activeBeforeQuarantine:2});
 const result=await runR54QuarantinedConnectorSwap({...f,maxDrainChecks:6,waitMs:0});
 assert.equal(result.status,'SIX_FILE_SOURCE_APPLIED_SHA_VERIFIED');
 assert.equal(f.state.connector,'next');assert.equal(f.state.five,'next');
 assert.ok(f.state.blockedStarts>=3);
 assert.deepEqual(f.state.manualStarts,[]);
 assert.equal(f.tryManualStart(),true);
 assert.deepEqual(f.state.manualStarts,[{connector:'next',five:'next'}]);
});

test('mid-five failure restores five originals before original connector reappears',async()=>{
 const f=connectorFixture({failSwap:true});
 await assert.rejects(runR54QuarantinedConnectorSwap({...f,waitMs:0}),
  {code:'R54_CONNECTOR_SWAP_FAILED_ROLLED_BACK_NO_RETRY'});
 assert.equal(f.state.rollbackCalls,1);
 assert.equal(f.state.connector,'old');assert.equal(f.state.five,'old');
 assert.ok(f.state.blockedStarts>=2);
});

test('ambiguous connector exposure is quarantined before rollback',async()=>{
 const f=connectorFixture({failAfterExpose:true});
 await assert.rejects(runR54QuarantinedConnectorSwap({...f,waitMs:0}),
  {code:'R54_CONNECTOR_SWAP_FAILED_ROLLED_BACK_NO_RETRY'});
 assert.equal(f.state.connector,'old');assert.equal(f.state.five,'old');
});

test('quarantine rename success followed by lost ACK restores original or requires recovery',async()=>{
 const f=connectorFixture({failAfterQuarantine:true});
 await assert.rejects(runR54QuarantinedConnectorSwap({...f,waitMs:0}),
  {code:'R54_CONNECTOR_SWAP_FAILED_ROLLED_BACK_NO_RETRY'});
 assert.equal(f.state.connector,'old');assert.equal(f.state.five,'old');
 assert.equal(f.state.rollbackCalls,0); // No five-file swap was attempted.
 const failed=connectorFixture({failAfterQuarantine:true,failRestoreOriginal:true});
 await assert.rejects(runR54QuarantinedConnectorSwap({...failed,waitMs:0}),
  {code:'R54_CONNECTOR_HOLD_TASK_DISABLED_RECOVERY_REQUIRED'});
 assert.equal(failed.state.connector,'absent');
 assert.equal(failed.state.five,'old');
});

test('unverified bypass route refuses quarantine; rollback uncertainty holds connector absent',async()=>{
 const noProof=connectorFixture({bypass:true});
 await assert.rejects(runR54QuarantinedConnectorSwap({...noProof,waitMs:0}),
  {code:'R54_CONNECTOR_UNVERIFIED_BYPASS_ENTRY'});
 assert.equal(noProof.state.connector,'old');
 const regeneration=connectorFixture({regenerator:true});
 await assert.rejects(runR54QuarantinedConnectorSwap({...regeneration,waitMs:0}),
  {code:'R54_CONNECTOR_UNVERIFIED_BYPASS_ENTRY'});
 assert.equal(regeneration.state.connector,'old');
 const badRollback=connectorFixture({failSwap:true,failRollback:true});
 await assert.rejects(runR54QuarantinedConnectorSwap({...badRollback,waitMs:0}),
  {code:'R54_CONNECTOR_HOLD_TASK_DISABLED_RECOVERY_REQUIRED'});
 assert.equal(badRollback.state.connector,'absent');
 assert.equal(badRollback.state.five,'mixed');
});

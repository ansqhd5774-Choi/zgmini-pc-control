import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {acquireMaintenanceLock} from '../tools/maintenance-lock.mjs';
import {createOrphanSixMaintenanceJournal}
 from '../tools/supervisor-orphan-six-maintenance-journal.mjs';
import {runOrphanSixGracefulB}
 from '../tools/supervisor-orphan-six-graceful-b-coordinator.mjs';
import {ORPHAN_GRACEFUL_SIX_SCOPE}
 from '../tools/supervisor-orphan-six-graceful-source.mjs';

const d=x=>x.repeat(64);
function sample(){
 const observed=new Date(Date.now()-300).toISOString();
 const lastHeartbeat=new Date(Date.now()-60_000).toISOString();
 const birth=new Date(Date.now()-300_000).toISOString();
 const seats=Array.from({length:6},(_,i)=>({
  seat:i+1,pid:51101+i,startedAtUtc:birth,
  canonicalPathSha256:String.fromCharCode(97+i).repeat(64),
  consoleAttached:true,consoleMemberCount:1,workerPresent:false,alive:true
 }));
 return {
  schema:'ZGMINI_ORPHAN_SIX_PRIVATE_B_SNAPSHOT_V1',observedAtUtc:observed,
  installed:{controllerSourceSha:'d'.repeat(40),controllerFilesVerified:true},
  preimage:{ownerRawSha256:d('a'),heartbeatRawSha256:d('b'),hostRawSha256:d('c')},
  approval:{scope:ORPHAN_GRACEFUL_SIX_SCOPE,
   source:'PRIVATE_B_MANIFEST_BYTES_ALREADY_ATTESTED',approved:true,
   manifestRawSha256:d('d'),ownerRawSha256:d('a'),heartbeatRawSha256:d('b'),
   hostRawSha256:d('c'),controllerSourceSha:'d'.repeat(40)},
  oldOwner:{pid:50000,deadVerified:true,sameBootVerified:true,
   sixOriginalListenerIdentitiesVerified:true,lastHeartbeatAt:lastHeartbeat},
  operator:{source:'PRIVATE_INDEPENDENT_WINDOWS_B',notRunnerDescendantVerified:true,
   oneUseEffectClaimVerified:true,originalMaintenanceLeaseOwnedVerified:true,
   watchdogRecoverySectionExcludedVerified:true},
  watchdog:{ownerIdentityVerified:true,sourceVerified:true,
   noPromotionPendingVerified:true,blockedOnOldLiveRunnerVerified:true},
  resources:{intakePauseAcknowledged:true,drainCompleteVerified:true,
   completeLiveLeaseEnumerationVerified:true,relatedControllerLeaseCount:0,
   activeControllerWorkerCount:0,otherMaintenanceWritesAbsentVerified:true,
   noUncertainExecutionOutcomeVerified:true},
  seats,originalHeartbeatChildren:seats.map(x=>({seat:x.seat,pid:x.pid}))
 };
}
function fixture(t,{denyApproval=false,failBeforeSignalAt=null,
 firstIdentityDriftAt=null,failAfterSignalAt=null,breakExitAt=null}={}){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-orphan-b-fixture-'));
 fs.mkdirSync(path.join(root,'requests'));
 const requestId='pc-'+randomUUID(),manifestRawSha256=d('d');
 const lease=acquireMaintenanceLock(root,'controller-install');
 const journal=createOrphanSixMaintenanceJournal({
  root,requestId,manifestRawSha256,lease
 });
 const original=sample(),sent=[],events=[],gone=new Set();
 const port={
  async verifyExactApproval({requestId:id,approvalManifestSha256:sha,scope}){
   events.push('approval');
   if(denyApproval)return {state:'UNVERIFIED'};
   assert.equal(id,requestId);assert.equal(sha,manifestRawSha256);
   assert.equal(scope,ORPHAN_GRACEFUL_SIX_SCOPE);
   return {state:'PRIVATE_SAME_HOST_B_ORIGIN_AND_APPROVAL_VERIFIED',
    manifestRawSha256,oneUseEffectClaimVerified:true,
    independentInstalledMaintainerVerified:true};
  },
  async readPrivateSnapshot(){events.push('snapshot');return original;},
  async attestPreSignal({seat,proposalId,afterIntentReadbackSha256}){
   events.push('presignal-'+seat+(afterIntentReadbackSha256?'-after-intent':''));
   if(seat===failBeforeSignalAt&&afterIntentReadbackSha256)
    throw Object.assign(Error('fixture'),{code:'ORPHAN_SIX_TEST_PRESIGNAL_FAILED'});
   const pin=original.seats[seat-1];
   return {source:'PRIVATE_SAME_HOST_B_PRESIGNAL_DOUBLE_READ',
    seat,proposalId,observedAtUtc:new Date().toISOString(),
    operatorClaimUninterruptedVerified:true,
    watchdogFenceUninterruptedVerified:true,
    nextSeatIdentityStillLiveVerified:!gone.has(seat),
    remainingOriginalSeatsUnchangedVerified:true,
    oldInstancePid:seat===firstIdentityDriftAt&&!afterIntentReadbackSha256?
      pin.pid+1000:pin.pid,
    oldInstanceBirth:pin.startedAtUtc,
    oldInstancePathSha256:pin.canonicalPathSha256};
  },
  async sendPrivateGracefulSignal({seat,proposalId,expectedIntentReadbackSha256}){
   events.push('signal-'+seat);sent.push(seat);
   assert.equal(typeof proposalId,'string');
   assert.match(expectedIntentReadbackSha256,/^[a-f0-9]{64}$/);
   if(seat===failAfterSignalAt)throw Error('no confirmation');
   gone.add(seat);
   return {status:'PRIVATE_SINGLE_CONSOLE_SIGNAL_SUBMITTED',seat,
    watchdogFenceUninterruptedVerified:true};
  },
  async attestSeatExit({seat}){
   events.push('exit-'+seat);
   const pin=original.seats[seat-1];
   return {source:'PRIVATE_SAME_HOST_B_WMI_DOUBLE_READ',
    observedAtUtc:new Date().toISOString(),seat,pinnedPid:pin.pid,
    pinnedBirth:pin.startedAtUtc,
    pinnedPathSha256:pin.canonicalPathSha256,
    oldInstanceExitedVerified:gone.has(seat)&&seat!==breakExitAt,
    unknownOrDuplicateListenerAbsentVerified:true,
    watchdogFenceUninterruptedVerified:true,
    operatorClaimUninterruptedVerified:true,
    otherFiveOrRemainingSeatsUnchangedVerified:true};
  },
  async verifyFinalOldSixAbsent(){
   events.push('all-absent');
   return {status:gone.size===6?'PRIVATE_SIX_OLD_INSTANCES_ABSENT':'UNKNOWN',
    watchdogFenceUninterruptedVerified:true,intakeDrainStillVerified:true};
  },
  async releaseFenceForWatchdog(){
   events.push('release-fence');
   return {status:'MAINTAINER_FENCE_RELEASE_READBACK_VERIFIED'};
  },
  async holdForRecovery(){events.push('hold-for-recovery');lease.holdForRecovery();}
 };
 // This fixture is temporary; it never points into operating E:.
 t.after(()=>{fs.rmSync(root,{recursive:true,force:true});});
 const run=()=>runOrphanSixGracefulB({
  requestId,approvalManifestSha256:manifestRawSha256,lease,journal,port
 });
 return {root,requestId,manifestRawSha256,lease,journal,port,run,events,sent,gone};
}
test('six-seat synthetic B executes fixed one-use sequence and returns POSTCHECK_PENDING',async t=>{
 const f=fixture(t);const r=await f.run();
 assert.equal(r.status,'POSTCHECK_PENDING');
 assert.equal(r.code,'ORPHAN_SIX_WAITING_R6_RUNTIME_READBACK');
 assert.equal(r.operationalRecoveryVerified,false);
 assert.equal(r.verifiedExitedSeatCount,6);
 assert.equal(r.attemptedSignalCount,6);
 assert.deepEqual(f.sent,[1,2,3,4,5,6]);
 assert.deepEqual(f.events.slice(-2),['all-absent','release-fence']);
 const j=f.journal.read().record;
 assert.equal(j.phase,'WAITING_WATCHDOG');
 assert.equal(j.stoppedCount,6);assert.equal(j.intentCount,6);
 assert.equal(fs.existsSync(path.join(f.root,'leases/controller-install/RECOVERY_REQUIRED.json')),false);
 // A successful handoff does not allow same requestId to resend signals.
 const again=await f.run();
 assert.equal(again.status,'RECOVERY_REQUIRED');
 assert.equal(again.attemptedSignalCount,0);
 assert.deepEqual(f.sent,[1,2,3,4,5,6]);
});
test('private approval denied means no signal and no journal creation',async t=>{
 const f=fixture(t,{denyApproval:true}),r=await f.run();
 assert.equal(r.status,'BLOCKED');
 assert.equal(r.attemptedSignalCount,0);
 assert.equal(f.journal.read(),null);
 assert.deepEqual(f.sent,[]);
});
test('changed first original-seat PID blocks before any durable stop intent',async t=>{
 const f=fixture(t,{firstIdentityDriftAt:1}),r=await f.run();
 assert.equal(r.status,'BLOCKED');
 assert.equal(r.code,'ORPHAN_SIX_PRESIGNAL_IDENTITY_CHANGED');
 assert.equal(r.attemptedSignalCount,0);
 assert.deepEqual(f.sent,[]);
 const record=f.journal.read().record;
 assert.equal(record.phase,'RECOVERY_REQUIRED');
 assert.equal(record.intentCount,0);
 assert.equal(record.stoppedCount,0);
 assert.equal(f.events.some(e=>e.includes('after-intent')),false);
});

test('after durable intent, presignal failure preserves lock and forbids replay',async t=>{
 const f=fixture(t,{failBeforeSignalAt:1}),r=await f.run();
 assert.equal(r.status,'RECOVERY_REQUIRED');
 assert.deepEqual(f.sent,[]);
 assert.equal(f.journal.read().record.phase,'RECOVERY_REQUIRED');
 assert.equal(f.journal.read().record.intentCount,1);
 assert.equal(fs.existsSync(path.join(f.root,'leases/controller-install/RECOVERY_REQUIRED.json')),true);
 assert.equal((await f.run()).status,'RECOVERY_REQUIRED');
 assert.deepEqual(f.sent,[]);
});
test('a signal with unknown outcome never causes duplicate signal on retry',async t=>{
 const f=fixture(t,{failAfterSignalAt:3}),r=await f.run();
 assert.equal(r.status,'RECOVERY_REQUIRED');
 assert.equal(r.attemptedSignalCount,3);
 assert.deepEqual(f.sent,[1,2,3]);
 assert.equal(f.journal.read().record.phase,'RECOVERY_REQUIRED');
 assert.equal(f.journal.read().record.stoppedCount,2);
 assert.equal(f.journal.read().record.intentCount,3);
 assert.equal((await f.run()).attemptedSignalCount,0);
 assert.deepEqual(f.sent,[1,2,3]);
});
test('no WMI seat-exit readback retains original one-use recovery marker',async t=>{
 const f=fixture(t,{breakExitAt:4}),r=await f.run();
 assert.equal(r.status,'RECOVERY_REQUIRED');
 assert.deepEqual(f.sent,[1,2,3,4]);
 assert.equal(f.journal.read().record.intentCount,4);
 assert.equal(f.journal.read().record.stoppedCount,3);
 assert.equal(f.events.includes('release-fence'),false);
});
test('the journal refuses replays and unowned or mismatched CAS writes',t=>{
 const f=fixture(t);
 const input={schema:'ZGMINI_ORPHAN_GRACEFUL_SIX_JOURNAL_V1',
  requestId:f.requestId,manifestRawSha256:f.manifestRawSha256,
  proposalId:d('e'),status:'CANDIDATE_ONLY',phase:'PREPARED',
  intentCount:0,stoppedCount:0,nextSeat:1,
  code:'ORPHAN_GRACEFUL_INITIAL_SOURCE_JOURNAL'};
 const first=f.journal.commit(input,null);
 assert.equal(first.status,'EXACT_CAS_READBACK_VERIFIED');
 assert.throws(()=>f.journal.commit(input,null),/ORPHAN_SIX_JOURNAL_ALREADY_CLAIMED/);
 assert.throws(()=>f.journal.commit({...input,code:'CHANGED'},d('f')),
  /ORPHAN_SIX_JOURNAL_CAS_MISMATCH/);
 const receipt=f.journal.commit({...input,code:'STILL_PREPARED'},first.readbackSha256);
 assert.equal(receipt.previousSha256,first.readbackSha256);
 assert.equal(f.journal.read().record.code,'STILL_PREPARED');
});
test('the original controller-install lock protects all journal CAS transitions',t=>{
 const f=fixture(t);
 const input={schema:'ZGMINI_ORPHAN_GRACEFUL_SIX_JOURNAL_V1',
  requestId:f.requestId,manifestRawSha256:f.manifestRawSha256,
  proposalId:d('e'),status:'CANDIDATE_ONLY',phase:'PREPARED',
  intentCount:0,stoppedCount:0,nextSeat:1,
  code:'ORPHAN_GRACEFUL_INITIAL_SOURCE_JOURNAL'};
 f.lease.release();
 assert.throws(()=>f.journal.commit(input,null),/ORPHAN_SIX_INSTALL_LEASE_UNVERIFIED/);
 assert.equal(f.journal.read(),null);
});
test('operator ports and lease are mandatory; no operating default effect',async()=>{
 const x=await runOrphanSixGracefulB({});
 assert.equal(x.status,'BLOCKED');
 assert.equal(x.code,'ORPHAN_SIX_MAINTAINER_BINDINGS_MISSING');
 assert.equal(x.attemptedSignalCount,undefined);
});
test('store rejects private input, symlink or unrecognized journal status',t=>{
 const f=fixture(t);
 const input={schema:'ZGMINI_ORPHAN_GRACEFUL_SIX_JOURNAL_V1',
  requestId:f.requestId,manifestRawSha256:f.manifestRawSha256,
  proposalId:d('e'),status:'SUCCEEDED',phase:'PREPARED',
  intentCount:0,stoppedCount:0,nextSeat:1,code:'FAKE_PASS'};
 assert.throws(()=>f.journal.commit(input,null),/ORPHAN_SIX_JOURNAL_RECORD_INVALID/);
 assert.throws(()=>f.journal.commit({...input,status:'CANDIDATE_ONLY',pid:42},null),
  /ORPHAN_SIX_JOURNAL_RECORD_INVALID/);
});

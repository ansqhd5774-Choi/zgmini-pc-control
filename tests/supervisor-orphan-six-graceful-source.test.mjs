// Controller orphan six-seat graceful recovery: source-only, synthetic
// state-machine fixtures, zero Windows/Runner/Watchdog/lease effects.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {assessOrphanGracefulSixPreflight,advanceOrphanGracefulSixSourceJournal,
 initialOrphanGracefulSixSourceJournal,ORPHAN_GRACEFUL_SIX_SCOPE,
 ORPHAN_GRACEFUL_SIX_SCHEMA} from '../tools/supervisor-orphan-six-graceful-source.mjs';

const at='2026-11-27T03:00:02.000Z',now=Date.parse('2026-11-27T03:00:03.000Z');
const h=x=>x.repeat(64);
const seats=()=>Array.from({length:6},(_,i)=>({
 seat:i+1,pid:51101+i,startedAtUtc:'2026-11-27T02:20:00.000Z',
 canonicalPathSha256:String.fromCharCode(97+i).repeat(64),
 consoleAttached:true,consoleMemberCount:1,workerPresent:false,alive:true
}));
const sample=()=>({
 schema:'ZGMINI_ORPHAN_SIX_PRIVATE_B_SNAPSHOT_V1',
 observedAtUtc:at,
 installed:{controllerSourceSha:'d'.repeat(40),controllerFilesVerified:true},
 preimage:{ownerRawSha256:h('a'),heartbeatRawSha256:h('b'),hostRawSha256:h('c')},
 approval:{scope:ORPHAN_GRACEFUL_SIX_SCOPE,
  source:'PRIVATE_B_MANIFEST_BYTES_ALREADY_ATTESTED',approved:true,
  manifestRawSha256:h('d'),ownerRawSha256:h('a'),
  heartbeatRawSha256:h('b'),hostRawSha256:h('c'),
  controllerSourceSha:'d'.repeat(40)},
 oldOwner:{pid:50000,deadVerified:true,sameBootVerified:true,
  sixOriginalListenerIdentitiesVerified:true,lastHeartbeatAt:'2026-11-27T02:40:00.000Z'},
 operator:{source:'PRIVATE_INDEPENDENT_WINDOWS_B',notRunnerDescendantVerified:true,
  oneUseEffectClaimVerified:true,originalMaintenanceLeaseOwnedVerified:true,
  watchdogRecoverySectionExcludedVerified:true},
 watchdog:{ownerIdentityVerified:true,sourceVerified:true,
  noPromotionPendingVerified:true,blockedOnOldLiveRunnerVerified:true},
 resources:{intakePauseAcknowledged:true,drainCompleteVerified:true,
  completeLiveLeaseEnumerationVerified:true,relatedControllerLeaseCount:0,
  activeControllerWorkerCount:0,otherMaintenanceWritesAbsentVerified:true,
  noUncertainExecutionOutcomeVerified:true},
 seats:seats(),originalHeartbeatChildren:seats().map(x=>({seat:x.seat,pid:x.pid}))
});
const preflight=x=>assessOrphanGracefulSixPreflight(x,{now});
const observe=(extra={})=>({observedAtUtc:at,...extra});
const intent=(seat,extra={})=>observe({
 source:'PRIVATE_B_JOURNAL_EXACT_CAS_READBACK',
 nextSeat:seat,durableIntentReadback:true,
 sameOneUseClaimVerified:true,nextSeatIdentityStillLiveVerified:true,
 watchdogFenceUninterruptedVerified:true,...extra
});
const readback=(seat,x,extra={})=>observe({
 source:'PRIVATE_SAME_HOST_B_WMI_DOUBLE_READ',seat,
 pinnedPid:x.pid,pinnedBirth:x.startedAtUtc,
 pinnedPathSha256:x.canonicalPathSha256,
 oldInstanceExitedVerified:true,unknownOrDuplicateListenerAbsentVerified:true,
 watchdogFenceUninterruptedVerified:true,
 operatorClaimUninterruptedVerified:true,
 otherFiveOrRemainingSeatsUnchangedVerified:true,...extra
});
const after=extra=>observe({
 source:'PRIVATE_SAME_HOST_B_WATCHDOG_AND_RUNNER_READBACK',
 oldSixAbsentVerified:true,newSupervisorOwnerVerified:true,
 freshHeartbeatVerified:true,sixNewRunnerSeatsVerified:true,
 watchdogR6HealthyVerified:true,standbyTwoReadyVerified:true,
 smokeJobPassVerified:true,...extra
});
function transition(prior,event,proof,snapshot=sample(),clock=now){
 return advanceOrphanGracefulSixSourceJournal({
  prior,event,proof,snapshot,now:clock
 });
}
test('B proposal is inert even with synthetically perfect source flags',()=>{
 const result=preflight(sample());
 assert.equal(result.schema,ORPHAN_GRACEFUL_SIX_SCHEMA);
 assert.equal(result.status,'CANDIDATE_ONLY');
 assert.equal(result.code,'ORPHAN_GRACEFUL_SIX_PINNED_SOURCE_PROPOSAL');
 assert.equal(result.verifiedSeatCount,6);
 assert.match(result.proposalId,/^[a-f0-9]{64}$/);
 for(const key of ['effectAuthorized','runnerStopAuthorized','runnerStartAuthorized',
  'supervisorSpawnAuthorized','leaseMutationAuthorized',
  'watchdogPromotionAuthorized','operationalWrites','consoleSignalsSent'])
  assert.equal(result[key],key==='operationalWrites'||key==='consoleSignalsSent'?0:false,key);
 assert.doesNotMatch(JSON.stringify(result),/5110|50000|E:\\|Runner.Listener|2026-11-27T02:20/);
});
test('preflight fails closed for missing approval, old Owner, watchdog, leases and console proof',()=>{
 const edits=[
  x=>{x.observedAtUtc='2026-11-27T02:59:40.000Z'},
  x=>{x.preimage.ownerRawSha256='bad'},
  x=>{x.approval.approved=false},
  x=>{x.approval.source='GITHUB_ISSUE_BODY'},
  x=>{x.approval.ownerRawSha256=h('f')},
  x=>{x.installed.controllerFilesVerified=false},
  x=>{x.oldOwner.deadVerified=false},
  x=>{x.oldOwner.sameBootVerified=false},
  x=>{x.operator.notRunnerDescendantVerified=false},
  x=>{x.operator.oneUseEffectClaimVerified=false},
  x=>{x.operator.originalMaintenanceLeaseOwnedVerified=false},
  x=>{x.operator.watchdogRecoverySectionExcludedVerified=false},
  x=>{x.watchdog.ownerIdentityVerified=false},
  x=>{x.watchdog.noPromotionPendingVerified=false},
  x=>{x.watchdog.blockedOnOldLiveRunnerVerified=false},
  x=>{x.resources.intakePauseAcknowledged=false},
  x=>{x.resources.drainCompleteVerified=false},
  x=>{x.resources.relatedControllerLeaseCount=1},
  x=>{x.resources.activeControllerWorkerCount=1},
  x=>{x.resources.completeLiveLeaseEnumerationVerified=false},
  x=>{x.resources.noUncertainExecutionOutcomeVerified=false},
  x=>{x.seats[0].alive=false},
  x=>{x.seats[0].consoleAttached=false},
  x=>{x.seats[0].consoleMemberCount=2},
  x=>{x.seats[0].workerPresent=true},
  x=>{x.seats[1].pid=x.seats[0].pid},
  x=>{x.seats[1].seat=1},
  x=>{x.seats[0].canonicalPathSha256='bad'},
  x=>{x.seats[0].startedAtUtc='2026-11-27T02:45:00.000Z'},
  x=>{x.originalHeartbeatChildren[0].pid=99999},
  x=>{x.originalHeartbeatChildren.pop()}
 ];
 edits.forEach((edit,i)=>{
  const input=sample();edit(input);
  const result=preflight(input);
  assert.equal(result.status,'BLOCKED','gate '+i);
  assert.equal(result.runnerStopAuthorized,false);
  assert.equal(result.consoleSignalsSent,0);
 });
});
test('all six seat transitions require durable intent then private exit readback',()=>{
 const input=sample(),proposal=preflight(input);
 let journal=initialOrphanGracefulSixSourceJournal(proposal);
 assert.equal(journal.phase,'PREPARED');
 for(const seat of input.seats){
  const next=transition(journal,'DURABLE_STOP_INTENT',intent(seat.seat),input);
  assert.equal(next.phase,'STOP_INTENT_RECORDED');
  assert.equal(next.intentCount,seat.seat);
  assert.equal(next.stoppedCount,seat.seat-1);
  assert.equal(next.effectAuthorized,false);
  const verified=transition(next,'PRIVATE_SEAT_EXIT_READBACK',readback(seat.seat,seat),input);
  assert.equal(verified.stoppedCount,seat.seat);
  assert.equal(verified.phase,seat.seat===6?'WAITING_WATCHDOG':'SEAT_EXIT_VERIFIED');
  assert.equal(verified.nextSeat,seat.seat+1);
  assert.equal(verified.consoleSignalsSent,0);
  journal=verified;
 }
 const finished=transition(journal,'FINAL_WATCHDOG_READBACK',after(),input);
 assert.equal(finished.phase,'SOURCE_FINAL_CANDIDATE');
 assert.equal(finished.status,'CANDIDATE_ONLY');
 assert.equal(finished.code,'ORPHAN_GRACEFUL_SOURCE_SEQUENCE_VERIFIED_ONLY');
 assert.equal(finished.runnerStopAuthorized,false);
 assert.equal(finished.operationalWrites,0);
});
test('duplicate stop intent, early postcheck, missing or wrong exit cannot advance',()=>{
 const input=sample();const initial=initialOrphanGracefulSixSourceJournal(preflight(input));
 assert.equal(transition(initial,'PRIVATE_SEAT_EXIT_READBACK',
  readback(1,input.seats[0]),input).status,'BLOCKED');
 const pending=transition(initial,'DURABLE_STOP_INTENT',intent(1),input);
 assert.equal(pending.phase,'STOP_INTENT_RECORDED');
 assert.equal(transition(pending,'DURABLE_STOP_INTENT',intent(1),input).status,'BLOCKED');
 assert.equal(transition(pending,'FINAL_WATCHDOG_READBACK',after(),input).status,'BLOCKED');
 for(const proof of [
  readback(2,input.seats[0]),
  readback(1,input.seats[0],{pinnedPid:99999}),
  readback(1,input.seats[0],{pinnedBirth:'2026-11-27T02:20:01Z'}),
  readback(1,input.seats[0],{pinnedPathSha256:h('f')}),
  readback(1,input.seats[0],{oldInstanceExitedVerified:false}),
  readback(1,input.seats[0],{otherFiveOrRemainingSeatsUnchangedVerified:false}),
  readback(1,input.seats[0],{watchdogFenceUninterruptedVerified:false})
 ]){
  assert.equal(transition(pending,'PRIVATE_SEAT_EXIT_READBACK',proof,input).status,
   'BLOCKED');
 }
});
test('fresh per-phase proof is needed, even when original preimage is historical',()=>{
 const input=sample();
 let journal=initialOrphanGracefulSixSourceJournal(preflight(input));
 journal=transition(journal,'DURABLE_STOP_INTENT',intent(1),input);
 const later=Date.parse('2026-11-27T03:01:10.000Z');
 assert.equal(preflight(input).status,'CANDIDATE_ONLY');
 const stale=transition(journal,'PRIVATE_SEAT_EXIT_READBACK',
  readback(1,input.seats[0]),input,later);
 assert.equal(stale.status,'RECOVERY_REQUIRED');
 assert.equal(stale.code,'ORPHAN_GRACEFUL_FRESH_PRIVATE_READBACK_MISSING');
 assert.equal(stale.consoleSignalsSent,0);
 assert.equal(stale.nextAction,'RECONCILE_DURABLE_ORIGINAL_JOURNAL_NO_SIGNAL_RETRY');
 const fresh=transition(journal,'PRIVATE_SEAT_EXIT_READBACK',
  readback(1,input.seats[0],{observedAtUtc:'2026-11-27T03:01:09.000Z'}),
  input,later);
 assert.equal(fresh.phase,'SEAT_EXIT_VERIFIED');
});
test('original B pins cannot drift after an intent, even with matching current count',()=>{
 const input=sample(),first=initialOrphanGracefulSixSourceJournal(preflight(input));
 const waiting=transition(first,'DURABLE_STOP_INTENT',intent(1),input);
 const edited=sample();
 edited.preimage.heartbeatRawSha256=h('e');
 edited.approval.heartbeatRawSha256=h('e');
 assert.equal(transition(waiting,'PRIVATE_SEAT_EXIT_READBACK',
  readback(1,edited.seats[0]),edited).status,'BLOCKED');
 const spoofed={...waiting,stoppedCount:6,nextSeat:7,intentCount:1};
 assert.equal(transition(spoofed,'FINAL_WATCHDOG_READBACK',after(),input).status,'BLOCKED');
});
test('final sequence refuses missing fresh heartbeat, R6 or both Standby slots',()=>{
 const input=sample();let j=initialOrphanGracefulSixSourceJournal(preflight(input));
 for(const seat of input.seats){
  j=transition(j,'DURABLE_STOP_INTENT',intent(seat.seat),input);
  j=transition(j,'PRIVATE_SEAT_EXIT_READBACK',readback(seat.seat,seat),input);
 }
 for(const evidence of [
  after({oldSixAbsentVerified:false}),
  after({newSupervisorOwnerVerified:false}),
  after({freshHeartbeatVerified:false}),
  after({sixNewRunnerSeatsVerified:false}),
  after({watchdogR6HealthyVerified:false}),
  after({standbyTwoReadyVerified:false}),
  after({smokeJobPassVerified:false})
 ]){
  const r=transition(j,'FINAL_WATCHDOG_READBACK',evidence,input);
  assert.equal(r.status,'BLOCKED');
  assert.equal(r.operationalWrites,0);
 }
});
test('source contract has no OS/PC/GitHub/maintenance actuation',()=>{
 const code=fs.readFileSync(
  new URL('../tools/supervisor-orphan-six-graceful-source.mjs',import.meta.url),'utf8');
 for(const pattern of [/\bspawn\s*\(/,/\bexecFile\s*\(/,/\btaskkill\b/,
  /GenerateConsoleCtrlEvent/,/Stop-Process/,/writeFileSync/,
  /renameSync/,/mkdirSync/,/unlinkSync/,/workflow_dispatch/,/fetch\s*\(/])
  assert.doesNotMatch(code,pattern);
 assert.match(code,/effectAuthorized:false/);
 assert.match(code,/runnerStopAuthorized:false/);
 assert.match(code,/operationalWrites:0/);
});

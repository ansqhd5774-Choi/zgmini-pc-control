// Source-only six-seat graceful-stop plan for orphan Controller recovery.
// This module cannot stop/start a Runner, claim a lease, publish a heartbeat,
// run the Watchdog, authenticate an Issue, or install itself.
// A separately approved independent Windows B maintainer must eventually
// authenticate the raw approval bytes and perform every protected effect.
import {createHash} from 'node:crypto';

export const ORPHAN_GRACEFUL_SIX_SCOPE='SEPARATELY_APPROVED_ORPHAN_GRACEFUL_SIX_B';
export const ORPHAN_GRACEFUL_SIX_SCHEMA='ZGMINI_ORPHAN_GRACEFUL_SIX_SOURCE_V1';
const sha64=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const sha40=x=>typeof x==='string'&&/^[a-f0-9]{40}$/.test(x);
const pid=x=>Number.isSafeInteger(x)&&x>0;
const time=x=>typeof x==='string'&&Number.isFinite(Date.parse(x))&&
 /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(x);
const hash=x=>createHash('sha256').update(x).digest('hex');
const zero=Object.freeze({
 schema:ORPHAN_GRACEFUL_SIX_SCHEMA,
 effectAuthorized:false,runnerStopAuthorized:false,
 runnerStartAuthorized:false,supervisorSpawnAuthorized:false,
 leaseMutationAuthorized:false,watchdogPromotionAuthorized:false,
 operationalWrites:0,consoleSignalsSent:0,providerCalls:0,d1Writes:0
});
const deny=code=>Object.freeze({...zero,status:'BLOCKED',code,
 verifiedSeatCount:0,proposalId:null,phase:'NOT_PREPARED'});
const ok=(code,patch={})=>Object.freeze({...zero,status:'CANDIDATE_ONLY',code,
 ...patch});

function privateIdentity(p){
 return [p.seat,p.pid,p.startedAtUtc,p.canonicalPathSha256];
}
function strongPrivatePreflight(snapshot,now,{pinnedHistorical=false}={}){
 const s=snapshot;
 if(!s||s.schema!=='ZGMINI_ORPHAN_SIX_PRIVATE_B_SNAPSHOT_V1'||
    !Number.isFinite(now)||!time(s.observedAtUtc)||
    Date.parse(s.observedAtUtc)>now||
    (!pinnedHistorical&&now-Date.parse(s.observedAtUtc)>5000))
  return {code:'ORPHAN_GRACEFUL_OBSERVATION_STALE'};
 if(!sha40(s.installed?.controllerSourceSha)||
    s.installed?.controllerFilesVerified!==true||
    !sha64(s.preimage?.ownerRawSha256)||
    !sha64(s.preimage?.heartbeatRawSha256)||
    !sha64(s.preimage?.hostRawSha256))
  return {code:'ORPHAN_GRACEFUL_INSTALLED_OR_CAS_UNKNOWN'};
 const a=s.approval;
 // These are model inputs, not authorizations; a real independent B must
 // authenticate the bytes/actor/origin and obtain a one-use effect claim.
 if(a?.scope!==ORPHAN_GRACEFUL_SIX_SCOPE||
    a?.source!=='PRIVATE_B_MANIFEST_BYTES_ALREADY_ATTESTED'||
    a?.approved!==true||!sha64(a.manifestRawSha256)||
    a?.ownerRawSha256!==s.preimage.ownerRawSha256||
    a?.heartbeatRawSha256!==s.preimage.heartbeatRawSha256||
    a?.hostRawSha256!==s.preimage.hostRawSha256||
    a?.controllerSourceSha!==s.installed.controllerSourceSha)
  return {code:'ORPHAN_GRACEFUL_B_APPROVAL_CAS_UNKNOWN'};
 if(s.oldOwner?.deadVerified!==true||
    s.oldOwner?.sameBootVerified!==true||
    s.oldOwner?.sixOriginalListenerIdentitiesVerified!==true||
    !pid(s.oldOwner.pid)||!time(s.oldOwner.lastHeartbeatAt)||
    Date.parse(s.oldOwner.lastHeartbeatAt)>Date.parse(s.observedAtUtc))
  return {code:'ORPHAN_GRACEFUL_OLD_OWNER_UNVERIFIED'};
 const op=s.operator,wd=s.watchdog,r=s.resources;
 if(op?.source!=='PRIVATE_INDEPENDENT_WINDOWS_B'||
    op?.notRunnerDescendantVerified!==true||
    op?.oneUseEffectClaimVerified!==true||
    op?.originalMaintenanceLeaseOwnedVerified!==true||
    op?.watchdogRecoverySectionExcludedVerified!==true||
    wd?.ownerIdentityVerified!==true||
    wd?.sourceVerified!==true||
    wd?.noPromotionPendingVerified!==true||
    wd?.blockedOnOldLiveRunnerVerified!==true)
  return {code:'ORPHAN_GRACEFUL_MAINTAINER_OR_WATCHDOG_FENCE_UNVERIFIED'};
 if(r?.intakePauseAcknowledged!==true||
    r?.drainCompleteVerified!==true||
    r?.completeLiveLeaseEnumerationVerified!==true||
    r?.relatedControllerLeaseCount!==0||
    r?.activeControllerWorkerCount!==0||
    r?.otherMaintenanceWritesAbsentVerified!==true||
    r?.noUncertainExecutionOutcomeVerified!==true)
  return {code:'ORPHAN_GRACEFUL_DRAIN_OR_RESOURCE_UNVERIFIED'};
 if(!Array.isArray(s.seats)||s.seats.length!==6||
    !Array.isArray(s.originalHeartbeatChildren)||
    s.originalHeartbeatChildren.length!==6)
  return {code:'ORPHAN_GRACEFUL_SIX_SEAT_SET_INVALID'};
 const seenSeats=new Set(),seenPids=new Set(),seenBirths=new Set();
 const original=new Map();
 for(const h of s.originalHeartbeatChildren){
  if(!Number.isInteger(h?.seat)||h.seat<1||h.seat>6||
     !pid(h.pid)||original.has(h.seat))
   return {code:'ORPHAN_GRACEFUL_HEARTBEAT_SEAT_INVALID'};
  original.set(h.seat,h.pid);
 }
 const ordered=[...s.seats].sort((a,b)=>a.seat-b.seat);
 for(const p of ordered){
  if(!Number.isInteger(p?.seat)||p.seat<1||p.seat>6||
     seenSeats.has(p.seat)||!pid(p.pid)||seenPids.has(p.pid)||
     !time(p.startedAtUtc)||Date.parse(p.startedAtUtc)>=Date.parse(s.oldOwner.lastHeartbeatAt)||
     !sha64(p.canonicalPathSha256)||
     p.consoleAttached!==true||p.consoleMemberCount!==1||
     p.workerPresent!==false||p.alive!==true||
     original.get(p.seat)!==p.pid)
   return {code:'ORPHAN_GRACEFUL_LISTENER_IDENTITY_OR_CONSOLE_UNVERIFIED'};
  seenSeats.add(p.seat);seenPids.add(p.pid);
  seenBirths.add(p.startedAtUtc+':'+p.pid);
 }
 if(seenSeats.size!==6||seenPids.size!==6||seenBirths.size!==6)
  return {code:'ORPHAN_GRACEFUL_SIX_UNIQUE_IDENTITIES_UNVERIFIED'};
 // Only the synthetic/source-only proposal identity is returned. Raw PID,
 // birth time, path and nonce MUST NOT appear in logs or GitHub results.
 const opaque=hash(JSON.stringify([
  a.manifestRawSha256,s.preimage.ownerRawSha256,
  s.preimage.heartbeatRawSha256,s.preimage.hostRawSha256,
  s.installed.controllerSourceSha,
  ...ordered.map(privateIdentity)
 ]));
 return {ordered,opaque,code:null};
}

// Structural review only; flags from an Issue cannot mint OS effect authority.
// The real B must atomically re-attest immediately before EACH seat signal,
// preserve a phase journal and recheck all active jobs/Watchdog changes.
export function assessOrphanGracefulSixPreflight(snapshot,{now=Date.now()}={}){
 const p=strongPrivatePreflight(snapshot,now);
 if(p.code)return deny(p.code);
 return ok('ORPHAN_GRACEFUL_SIX_PINNED_SOURCE_PROPOSAL',{
  phase:'PREPARED',verifiedSeatCount:6,proposalId:p.opaque,
  nextSeat:1,nextAction:'INDEPENDENT_APPROVED_B_DURABLE_INTENT_REQUIRED'
 });
}
const STAGES=new Set(['PREPARED','STOP_INTENT_RECORDED',
  'SEAT_EXIT_VERIFIED','WAITING_WATCHDOG','RECOVERY_REQUIRED','SOURCE_FINAL_CANDIDATE']);
const events=new Set(['DURABLE_STOP_INTENT','PRIVATE_SEAT_EXIT_READBACK',
  'FINAL_WATCHDOG_READBACK']);

// Pure journal reducer: never emits OS signals, even when its test inputs
// claim approval. An unknown/partial transition fails closed; it can never
// auto-resend a stop signal or release a maintenance lease.
export function advanceOrphanGracefulSixSourceJournal({
 prior,event,proof,snapshot,now=Date.now()
}={}){
 // Snapshot is the immutable B-pinned ORIGINAL six-seat preimage, not a
 // claim that all six still live after some have already exited. Each event
 // instead needs a separate fresh private same-host readback below.
 const p=strongPrivatePreflight(snapshot,now,{pinnedHistorical:true});
 if(p.code)return deny(p.code);
 if(!time(proof?.observedAtUtc)||Date.parse(proof.observedAtUtc)>now||
    now-Date.parse(proof.observedAtUtc)>5000)
  return Object.freeze({...zero,status:'RECOVERY_REQUIRED',
   code:'ORPHAN_GRACEFUL_FRESH_PRIVATE_READBACK_MISSING',
   phase:'RECOVERY_REQUIRED',stoppedCount:prior?.stoppedCount??0,
   intentCount:prior?.intentCount??0,
   nextAction:'RECONCILE_DURABLE_ORIGINAL_JOURNAL_NO_SIGNAL_RETRY'});
 if(!prior||prior.schema!==ORPHAN_GRACEFUL_SIX_SCHEMA||
    !STAGES.has(prior.phase)||prior.status!=='CANDIDATE_ONLY'||
    prior.proposalId!==p.opaque||
    prior.verifiedSeatCount!==6||
    !Number.isInteger(prior.stoppedCount)||prior.stoppedCount<0||
    prior.stoppedCount>6||!Number.isInteger(prior.intentCount)||
    prior.intentCount<0||prior.intentCount>6||
    !Number.isInteger(prior.nextSeat)||prior.nextSeat<1||prior.nextSeat>7||
    prior.stoppedCount>prior.intentCount||
    prior.intentCount-prior.stoppedCount>1||
    prior.nextSeat!==prior.stoppedCount+1)
  return deny('ORPHAN_GRACEFUL_JOURNAL_CAS_UNVERIFIED');
 if(!events.has(event))return deny('ORPHAN_GRACEFUL_EVENT_UNKNOWN');
 const fixed={phase:prior.phase,proposalId:prior.proposalId,
  verifiedSeatCount:6,stoppedCount:prior.stoppedCount,
  intentCount:prior.intentCount,nextSeat:prior.nextSeat};
 // Neither action is executable. The approved B must persist/read back this
 // intent BEFORE it may send its one and only OS control signal.
 if(event==='DURABLE_STOP_INTENT'){
  if(prior.phase!=='PREPARED'&&prior.phase!=='SEAT_EXIT_VERIFIED')
   return deny('ORPHAN_GRACEFUL_UNEXPECTED_INTENT_PHASE');
  if(prior.stoppedCount===6||prior.intentCount!==prior.stoppedCount||
     proof?.source!=='PRIVATE_B_JOURNAL_EXACT_CAS_READBACK'||
     proof?.nextSeat!==prior.nextSeat||proof?.durableIntentReadback!==true||
     proof?.sameOneUseClaimVerified!==true||
     proof?.nextSeatIdentityStillLiveVerified!==true||
     proof?.watchdogFenceUninterruptedVerified!==true)
   return deny('ORPHAN_GRACEFUL_INTENT_CAS_UNVERIFIED');
  return ok('ORPHAN_GRACEFUL_SIGNAL_INTENT_RECORDED_SOURCE_ONLY',{
   ...fixed,phase:'STOP_INTENT_RECORDED',intentCount:prior.intentCount+1,
   nextAction:'INDEPENDENT_APPROVED_B_MAY_REATTEST_BEFORE_SIGNAL'
  });
 }
 if(event==='PRIVATE_SEAT_EXIT_READBACK'){
  if(prior.phase!=='STOP_INTENT_RECORDED'||
     prior.intentCount!==prior.stoppedCount+1||
     proof?.source!=='PRIVATE_SAME_HOST_B_WMI_DOUBLE_READ'||
     proof?.seat!==prior.nextSeat||
     proof?.pinnedPid===undefined||proof.pinnedPid!==p.ordered[prior.stoppedCount].pid||
     proof?.pinnedBirth!==p.ordered[prior.stoppedCount].startedAtUtc||
     proof?.pinnedPathSha256!==p.ordered[prior.stoppedCount].canonicalPathSha256||
     proof?.oldInstanceExitedVerified!==true||
     proof?.unknownOrDuplicateListenerAbsentVerified!==true||
     proof?.watchdogFenceUninterruptedVerified!==true||
     proof?.operatorClaimUninterruptedVerified!==true||
     proof?.otherFiveOrRemainingSeatsUnchangedVerified!==true)
   return deny('ORPHAN_GRACEFUL_SEAT_EXIT_READBACK_UNVERIFIED');
  const stoppedCount=prior.stoppedCount+1;
  return ok('ORPHAN_GRACEFUL_SEAT_EXIT_SOURCE_ONLY',{
   ...fixed,stoppedCount,nextSeat:stoppedCount+1,
   phase:stoppedCount===6?'WAITING_WATCHDOG':'SEAT_EXIT_VERIFIED',
   nextAction:stoppedCount===6?
    'INDEPENDENT_B_RELEASE_FENCE_AND_VERIFY_WATCHDOG':
    'INDEPENDENT_APPROVED_B_DURABLE_INTENT_REQUIRED'
  });
 }
 if(prior.phase!=='WAITING_WATCHDOG'||prior.stoppedCount!==6||
    prior.intentCount!==6||
    proof?.source!=='PRIVATE_SAME_HOST_B_WATCHDOG_AND_RUNNER_READBACK'||
    proof?.oldSixAbsentVerified!==true||
    proof?.newSupervisorOwnerVerified!==true||
    proof?.freshHeartbeatVerified!==true||
    proof?.sixNewRunnerSeatsVerified!==true||
    proof?.watchdogR6HealthyVerified!==true||
    proof?.standbyTwoReadyVerified!==true||
    proof?.smokeJobPassVerified!==true)
  return deny('ORPHAN_GRACEFUL_POSTRECOVERY_READBACK_UNVERIFIED');
 return ok('ORPHAN_GRACEFUL_SOURCE_SEQUENCE_VERIFIED_ONLY',{
  ...fixed,phase:'SOURCE_FINAL_CANDIDATE',stoppedCount:6,nextSeat:7,
  nextAction:'INDEPENDENT_RUNTIME_RECEIPT_REQUIRED'
 });
}
export function initialOrphanGracefulSixSourceJournal(candidate){
 if(candidate?.status!=='CANDIDATE_ONLY'||
    candidate?.code!=='ORPHAN_GRACEFUL_SIX_PINNED_SOURCE_PROPOSAL'||
    !sha64(candidate.proposalId))
  return deny('ORPHAN_GRACEFUL_INITIAL_CANDIDATE_INVALID');
 return ok('ORPHAN_GRACEFUL_INITIAL_SOURCE_JOURNAL',{
  phase:'PREPARED',proposalId:candidate.proposalId,
  verifiedSeatCount:6,stoppedCount:0,intentCount:0,nextSeat:1,
  nextAction:'INDEPENDENT_APPROVED_B_DURABLE_INTENT_REQUIRED'
 });
}

// One-shot orphan-six coordinator for the existing independent B maintainer.
// No CLI, PC request route, listener PID arguments, Windows signal API, or
// automatic recovery/retry. The installed B receiver (not this module) must
// authenticate the approved Issue/manifest, construct PRIVATE same-host ports,
// acquire the existing controller-install lease, and pin its installed source.
// A test-created port is NOT an authorization to change the operating PC.
import {assessOrphanGracefulSixPreflight,initialOrphanGracefulSixSourceJournal,
 advanceOrphanGracefulSixSourceJournal} from './supervisor-orphan-six-graceful-source.mjs';

const SCHEMA='ZGMINI_ORPHAN_GRACEFUL_SIX_JOURNAL_V1';
const SCOPE='SEPARATELY_APPROVED_ORPHAN_GRACEFUL_SIX_B';
const reqId=x=>typeof x==='string'&&/^pc-[a-f0-9-]{36}$/.test(x);
const sha64=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const fail=x=>{throw Object.assign(new Error(x),{code:x});};
const code=x=>typeof x==='string'&&/^[A-Z][A-Z0-9_]{2,79}$/.test(x)?
 x:'ORPHAN_SIX_EXECUTION_OUTCOME_UNKNOWN';
const reported=(status,reason,extra={})=>Object.freeze({
 schema:'ZGMINI_ORPHAN_GRACEFUL_SIX_EXECUTION_V1',
 status,code:reason,operationalRecoveryVerified:false,
 runnerStarts:0,automaticRetries:0,providerCalls:0,d1Writes:0,
 ...extra
});
const essential=['verifyExactApproval','verifyFreshOwnerEffectDecision',
 'readPrivateSnapshot','attestPreSignal',
 'attestSeatExit','sendPrivateGracefulSignal','verifyFinalOldSixAbsent',
 'releaseFenceForWatchdog','holdForRecovery'];
function stateRecord(source,requestId,digest){
 return {
  schema:SCHEMA,requestId,manifestRawSha256:digest,proposalId:source.proposalId,
  status:source.status,phase:source.phase,
  intentCount:source.intentCount,stoppedCount:source.stoppedCount,
  nextSeat:source.nextSeat,code:source.code
 };
}
function checkReceipt(receipt,expectedPhase){
 if(receipt?.status!=='EXACT_CAS_READBACK_VERIFIED'||
    receipt?.phase!==expectedPhase||!sha64(receipt.readbackSha256))
  fail('ORPHAN_SIX_DURABLE_CAS_READBACK_UNVERIFIED');
}
function verifyPresignal(p,seat,proposalId,instant){
 if(p?.source!=='PRIVATE_SAME_HOST_B_PRESIGNAL_DOUBLE_READ'||
    p?.seat!==seat||p?.proposalId!==proposalId||
    p?.operatorClaimUninterruptedVerified!==true||
    p?.watchdogFenceUninterruptedVerified!==true||
    p?.nextSeatIdentityStillLiveVerified!==true||
    p?.remainingOriginalSeatsUnchangedVerified!==true||
    typeof p?.observedAtUtc!=='string'||
    !Number.isFinite(Date.parse(p.observedAtUtc))||
    Date.parse(p.observedAtUtc)>instant||
    instant-Date.parse(p.observedAtUtc)>5000)
  fail('ORPHAN_SIX_PRESIGNAL_LIVE_BOUNDARY_UNVERIFIED');
}
function sourceStep(prior,event,proof,snapshot,now){
 const out=advanceOrphanGracefulSixSourceJournal({
  prior,event,proof,snapshot,now
 });
 if(out.status!=='CANDIDATE_ONLY')fail(code(out.code));
 return out;
}
// The function is invoked only in an already-authenticated maintainer context,
// not from a user Issue, a generic pc-job, or a GitHub Action. It still fails
// closed if any port, one-use claim or original raw CAS evidence is missing.
export async function runOrphanSixGracefulB({
 requestId,approvalManifestSha256,lease,journal,port,
 now=()=>Date.now()
}={}){
 if(!reqId(requestId)||!sha64(approvalManifestSha256)||
    !lease?.owner||lease.owner.pid!==process.pid||
    typeof lease.owner.nonce!=='string'||lease.owner.nonce.length<16||
    !journal||typeof journal.read!=='function'||
    typeof journal.commit!=='function'||!port||
    essential.some(k=>typeof port[k]!=='function')||
    typeof now!=='function')
  return reported('BLOCKED','ORPHAN_SIX_MAINTAINER_BINDINGS_MISSING');
 let last=null, lastHash=null, snapshot=null;
 let attemptedSignalCount=0;
 try{
  // A prior attempt, including PREPARED, is NEVER an invitation to
  // automatically replay any seat signal. Human-controlled reconciliation
  // must inspect the real journal + controller-install lock.
  const previous=journal.read();
  if(previous!==null)
   return reported('RECOVERY_REQUIRED','ORPHAN_SIX_EXISTING_JOURNAL_RECONCILE_FIRST',
    {attemptedSignalCount:0,nextAction:'READ_ORIGINAL_JOURNAL_NO_REPLAY'});
  const approved=await port.verifyExactApproval({requestId,approvalManifestSha256,
   scope:SCOPE,leaseOwner:lease.owner});
  if(approved?.state!=='PRIVATE_SAME_HOST_B_ORIGIN_AND_APPROVAL_VERIFIED'||
     approved?.manifestRawSha256!==approvalManifestSha256||
     approved?.oneUseEffectClaimVerified!==true||
     approved?.independentInstalledMaintainerVerified!==true)
   fail('ORPHAN_SIX_ORIGIN_OR_APPROVAL_UNVERIFIED');
  snapshot=await port.readPrivateSnapshot({requestId,approvalManifestSha256});
  if(snapshot?.approval?.manifestRawSha256!==approvalManifestSha256)
   fail('ORPHAN_SIX_PRIVATE_APPROVAL_PREIMAGE_CHANGED');
  const proposal=assessOrphanGracefulSixPreflight(snapshot,{now:now()});
  if(proposal.status!=='CANDIDATE_ONLY')
   fail(code(proposal.code));
  last=initialOrphanGracefulSixSourceJournal(proposal);
  if(last.status!=='CANDIDATE_ONLY')fail(code(last.code));
  let receipt=journal.commit(stateRecord(last,requestId,approvalManifestSha256),null);
  checkReceipt(receipt,last.phase);
  lastHash=receipt.readbackSha256;
  // Stop each pre-pinned seat exactly once. Never forward a PID/path from an
  // Issue or accept fresh PIDs into the one-use proposal.
  for(let seat=1;seat<=6;seat++){
   const originalPin=snapshot.seats.find(x=>x.seat===seat);
   if(!originalPin)fail('ORPHAN_SIX_PIN_MISSING');
   const first=await port.attestPreSignal({seat,proposalId:proposal.proposalId});
   verifyPresignal(first,seat,proposal.proposalId,now());
   // Reject an already changed instance BEFORE recording an irreversible
   // stop intent. Repeat this identity check after the durable CAS below.
   if(first.oldInstancePid!==originalPin.pid||
      first.oldInstanceBirth!==originalPin.startedAtUtc||
      first.oldInstancePathSha256!==originalPin.canonicalPathSha256)
    fail('ORPHAN_SIX_PRESIGNAL_IDENTITY_CHANGED');
   // Prepare a candidate; only the following actual journal.commit/readback
   // makes it a DURABLE intent. No signal can precede that verified commit.
   const proposed=sourceStep(last,'DURABLE_STOP_INTENT',{
    ...first,source:'PRIVATE_B_JOURNAL_EXACT_CAS_READBACK',
    nextSeat:seat,durableIntentReadback:true,
    sameOneUseClaimVerified:true},snapshot,now());
   receipt=journal.commit(stateRecord(proposed,requestId,approvalManifestSha256),lastHash);
   checkReceipt(receipt,'STOP_INTENT_RECORDED');
   lastHash=receipt.readbackSha256;
   last=proposed;
   // Check exact SAME old seat and exclusive Watchdog fence AGAIN after
   // durable intent and immediately before any irreversible console event.
   const lastProof=await port.attestPreSignal({seat,
    proposalId:proposal.proposalId,afterIntentReadbackSha256:lastHash});
   verifyPresignal(lastProof,seat,proposal.proposalId,now());
   if(lastProof.oldInstancePid!==originalPin.pid||
      lastProof.oldInstanceBirth!==originalPin.startedAtUtc||
      lastProof.oldInstancePathSha256!==originalPin.canonicalPathSha256)
    fail('ORPHAN_SIX_PRESIGNAL_IDENTITY_CHANGED');
   // A source-only CANDIDATE is never a durable effect authorization.
   // The installed independent maintainer must re-read canonical OWNER
   // APPROVE/REVOKE (complete pages, unedited, exact SHA) for EVERY seat,
   // including after prior signals. A stale/cached/unknown readback blocks.
   const decision=await port.verifyFreshOwnerEffectDecision({
    seat,proposalId:proposal.proposalId,requestId,
    approvalManifestSha256,afterIntentReadbackSha256:lastHash
   });
   const checkedAt=Date.parse(decision?.observedAtUtc);
   const instant=now();
   if(decision?.source!=='PRIVATE_B_FRESH_CANONICAL_OWNER_EFFECT_DECISION'||
      decision?.status!=='CURRENT_OWNER_APPROVE_VERIFIED'||
      decision?.seat!==seat||decision?.proposalId!==proposal.proposalId||
      decision?.requestId!==requestId||
      decision?.manifestRawSha256!==approvalManifestSha256||
      decision?.intentReadbackSha256!==lastHash||
      decision?.completeCanonicalCommentsReadbackVerified!==true||
      decision?.latestOwnerDecisionApprovedUnrevokedVerified!==true||
      decision?.unchangedOwnerCommentVerified!==true||
      decision?.watchdogFenceUninterruptedVerified!==true||
      !Number.isFinite(checkedAt)||!Number.isFinite(instant)||
      checkedAt>instant||instant-checkedAt>5000)
    fail('ORPHAN_SIX_FRESH_OWNER_EFFECT_APPROVAL_UNVERIFIED');
   // The one-use private B adapter owns the actual Windows signaling and
   // must compare PID/birth/console group at the instant of the effect.
   // RETURNING "SENT" does not prove exit or Runner graceful handling.
   attemptedSignalCount++;
   const signal=await port.sendPrivateGracefulSignal({
    seat,proposalId:proposal.proposalId,expectedIntentReadbackSha256:lastHash
   });
   if(signal?.status!=='PRIVATE_SINGLE_CONSOLE_SIGNAL_SUBMITTED'||
      signal?.seat!==seat||
      signal?.watchdogFenceUninterruptedVerified!==true)
    fail('ORPHAN_SIX_SIGNAL_DELIVERY_OUTCOME_UNKNOWN');
   const exit=await port.attestSeatExit({seat,proposalId:proposal.proposalId});
   // Original snapshot is intentionally historical; only THIS current
   // double-read may prove the old birth/path is gone while others persist.
   const exited=sourceStep(last,'PRIVATE_SEAT_EXIT_READBACK',exit,snapshot,now());
   receipt=journal.commit(stateRecord(exited,requestId,approvalManifestSha256),lastHash);
   checkReceipt(receipt,exited.phase);
   lastHash=receipt.readbackSha256;
   last=exited;
  }
  if(last.phase!=='WAITING_WATCHDOG'||last.stoppedCount!==6)
   fail('ORPHAN_SIX_ALL_SEATS_NOT_VERIFIED_EXITED');
  const allGone=await port.verifyFinalOldSixAbsent({proposalId:proposal.proposalId,
   expectedJournalSha256:lastHash});
  if(allGone?.status!=='PRIVATE_SIX_OLD_INSTANCES_ABSENT'||
     allGone?.watchdogFenceUninterruptedVerified!==true||
     allGone?.intakeDrainStillVerified!==true)
   fail('ORPHAN_SIX_OLD_SIX_ABSENCE_UNVERIFIED');
  // WATCHDOG must be allowed to promote after the final 6 exits. The
  // independent maintainer is responsible for exact lock release and lease
  // readback, then separately re-observes Supervisor/R6/standby/smoke.
  // Never return PASS here: Watchdog and 2 standby READY remain unproven.
  const handoff=await port.releaseFenceForWatchdog({
   proposalId:proposal.proposalId,expectedJournalSha256:lastHash,
   allSixOriginalExitedVerified:true
  });
  if(handoff?.status!=='MAINTAINER_FENCE_RELEASE_READBACK_VERIFIED')
   fail('ORPHAN_SIX_WATCHDOG_FENCE_RELEASE_UNVERIFIED');
  return reported('POSTCHECK_PENDING','ORPHAN_SIX_WAITING_R6_RUNTIME_READBACK',{
   attemptedSignalCount,verifiedExitedSeatCount:6,
   nextAction:'READ_FRESH_WATCHDOG_R6_TWO_STANDBY_AND_RUNNER_SMOKE'});
 }catch(error){
  const reason=code(error?.code);
  const uncertain=last?.intentCount>0||attemptedSignalCount>0;
  if(last){
   try{
    const current=journal.read();
    if(current?.sha256===lastHash){
     const marker={
      ...current.record,status:'RECOVERY_REQUIRED',phase:'RECOVERY_REQUIRED',
      code:'ORPHAN_SIX_RUNTIME_RECONCILIATION_REQUIRED'
     };
     const saved=journal.commit(marker,lastHash);
     checkReceipt(saved,'RECOVERY_REQUIRED');
    }
   }catch{/* leave original verified intent/lock intact; no replay */}
  }
  if(uncertain){
   try{await port.holdForRecovery({requestId,reason});}catch{/* fail closed */}
  }
  return reported(uncertain?'RECOVERY_REQUIRED':'BLOCKED',reason,{
   attemptedSignalCount,
   nextAction:uncertain?'RECONCILE_ORIGINAL_JOURNAL_AND_LEASE_NO_SIGNAL_REPLAY':
    'REVALIDATE_PRIVATE_B_APPROVAL_NO_OPERATION'
  });
 }
}

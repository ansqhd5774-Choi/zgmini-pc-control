// No-spawn orphan Supervisor monitoring contract (source-only).
// The installed Supervisor still spawns six run.cmd wrappers unconditionally.
// This module cannot start it, rewrite a lease, capture a nonce or emit a
// heartbeat. A future separately approved independent B must attest every
// private Windows process identity immediately before any operational effect.
const seats=Object.freeze([1,2,3,4,5,6]);
const sha64=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const sha40=x=>typeof x==='string'&&/^[a-f0-9]{40}$/.test(x);
const pid=x=>Number.isSafeInteger(x)&&x>0;
const iso=x=>typeof x==='string'&&Number.isFinite(Date.parse(x));
const base={
 schema:'ZGMINI_ORPHAN_NO_SPAWN_MONITOR_CONTRACT_V1',
 effectAuthorized:false,controllerJobAdmissionVerified:false,
 heartbeatWriteAuthorized:false,supervisorSpawnAuthorized:false,
 runnerStopAuthorized:false,leaseMutationAuthorized:false,
 watchdogPromotionAuthorized:false,operationalWrites:0,
 providerCalls:0,d1Writes:0
};
const deny=code=>Object.freeze({...base,status:'BLOCKED',code,
 monitoringCandidate:false,exactSeatIdentityCount:0});
export function assessNoSpawnMonitorSnapshot({
 now=Date.now(),observedAt,preimage,installed,oldOwner,newOwner,
 watcher,privateLineage,controllerSeatPins,liveWmi,
 gitHubRoster,lease,relatedLeases,installation,
 activeControllerWorkers
}={}){
 if(!Number.isFinite(now)||!iso(observedAt)||Date.parse(observedAt)>now||
    now-Date.parse(observedAt)>15000)
  return deny('NO_SPAWN_MONITOR_OBSERVATION_STALE');
 if(!sha40(installed?.controllerSourceSha)||
    installed.controllerSourceSha!==preimage?.controllerSourceSha||
    !sha64(preimage?.ownerRecordSha256)||
    !sha64(preimage?.hostManifestSha256)||
    !sha64(preimage?.heartbeatSha256)||
    preimage.stableAtRead!==true||
    installed.controllerFilesVerified!==true)
  return deny('NO_SPAWN_MONITOR_ORIGINAL_CAS_UNVERIFIED');
 if(oldOwner?.deadVerified!==true||
    oldOwner?.sameBootVerified!==true||
    oldOwner?.historicalSixSeatsVerified!==true||
    !pid(oldOwner.pid)||
    !iso(oldOwner?.lastHeartbeatAt))
  return deny('NO_SPAWN_MONITOR_OLD_OWNER_UNVERIFIED');
 if(!pid(newOwner?.pid)||newOwner.pid===oldOwner.pid||
    newOwner.aliveVerified!==true||
    newOwner.sameBootVerified!==true||
    newOwner.recoveryMode!=='ADOPT_EXISTING_SIX_NO_SPAWN'||
    !iso(newOwner.startedAtUtc)||
    Date.parse(newOwner.startedAtUtc)>Date.parse(observedAt))
  return deny('NO_SPAWN_MONITOR_NEW_OWNER_IDENTITY_UNVERIFIED');
 if(watcher?.watchdogOwnerVerified!==true||
    watcher?.installedR6SourceVerified!==true||
    watcher?.singleWatchdogOwnerVerified!==true||
    installation?.independentMaintainerVerified!==true||
    installation?.controllerSourceUnchanged!==true)
  return deny('NO_SPAWN_MONITOR_WATCHDOG_OR_MAINTAINER_UNVERIFIED');
 // This signal requires a trusted PRIVATE Windows comparison, not a claimed
 // Issue body flag or the public hash of the historical owner record.
 if(privateLineage?.source!=='PRIVATE_APPROVED_WINDOWS_B_ATTESTATION'||
    privateLineage?.inheritedNonceMatchesOldOwner!==true||
    privateLineage?.newOwnerNonceMatchesInherited!==true||
    privateLineage?.newOwnerNoSpawnSourceVerified!==true||
    privateLineage?.sixOriginalListenerBirthTimesPinned!==true)
  return deny('NO_SPAWN_MONITOR_PRIVATE_NONCE_LINEAGE_UNVERIFIED');
 if(!sha64(lease?.newOwnerBytesSha256)||
    lease?.newOwnerPid!==newOwner.pid||
    lease?.newOwnerMatchesLiveProcess!==true||
    lease?.sameOwnerNonceContinuityVerified!==true||
    lease?.claimExactCasReadback!==true||
    lease?.singleRecoveryOperatorVerified!==true||
    lease?.uninterruptedRecoveryLeaseVerified!==true)
  return deny('NO_SPAWN_MONITOR_NEW_OWNER_LEASE_CAS_UNVERIFIED');
 if(relatedLeases!==0||installation?.installLeaseHeld!==false||
    installation?.workflowState!=='active'||
    gitHubRoster?.fixedSixOnline!==true)
  return deny('NO_SPAWN_MONITOR_RESOURCE_OR_ROSTER_UNVERIFIED');
 if(!Array.isArray(controllerSeatPins)||controllerSeatPins.length!==6||
    !Array.isArray(liveWmi?.rows)||liveWmi.rows.length!==6||
    liveWmi.source!=='WIN32_PROCESS_PRIVATE_SAME_HOST'||
    liveWmi.completeControllerRootsVerified!==true||
    liveWmi.extraControllerListenerCount!==0||
    liveWmi.unknownControllerPathCount!==0)
  return deny('NO_SPAWN_MONITOR_SIX_WMI_IDENTITY_UNVERIFIED');
 const original=new Map(),seen=new Set(),seenPid=new Set();
 for(const row of controllerSeatPins){
  if(!seats.includes(row?.seat)||original.has(row.seat)||!pid(row?.pid)||
     !iso(row?.startedAtUtc)||!sha64(row?.canonicalPathSha256))
    return deny('NO_SPAWN_MONITOR_PINNED_SEAT_INVALID');
  original.set(row.seat,row);
 }
 const ownerStart=Date.parse(newOwner.startedAtUtc);
 for(const row of liveWmi.rows){
  if(!seats.includes(row?.seat)||seen.has(row.seat)||
     !pid(row?.pid)||seenPid.has(row.pid)||
     row.alive!==true||!iso(row?.startedAtUtc)||
     !sha64(row?.canonicalPathSha256))
   return deny('NO_SPAWN_MONITOR_WMI_SEAT_INVALID');
  const pin=original.get(row.seat);
  if(!pin||row.pid!==pin.pid||
     row.startedAtUtc!==pin.startedAtUtc||
     row.canonicalPathSha256!==pin.canonicalPathSha256||
     Date.parse(row.startedAtUtc)>=ownerStart-1000)
   return deny('NO_SPAWN_MONITOR_LISTENER_REPLACED_OR_SPAWNED');
  seen.add(row.seat);seenPid.add(row.pid);
 }
 if(seen.size!==6)return deny('NO_SPAWN_MONITOR_SIX_SEAT_GAP');
 if(!Number.isSafeInteger(activeControllerWorkers)||
    activeControllerWorkers<0||activeControllerWorkers>6)
  return deny('NO_SPAWN_MONITOR_WORKERS_UNVERIFIED');
 // A worker may start after adoption. It does not imply a safe stop or
 // that an unrelated old pending request has been processed.
 return Object.freeze({...base,status:'CANDIDATE_ONLY',
  code:'NO_SPAWN_MONITOR_ALL_SIX_IDENTITIES_CONTINUOUS',
  monitoringCandidate:true,exactSeatIdentityCount:6,
  activeControllerWorkers});
}
export function decideNoSpawnMonitorFailure({previous,latest}={}){
 if(previous?.status!=='CANDIDATE_ONLY'||
    previous?.exactSeatIdentityCount!==6)
  return Object.freeze({status:'HOLD',code:'NO_VERIFIED_BASELINE',
   stopRunners:false,spawnRunners:false,heartbeatWriteAuthorized:false});
 if(latest?.status!=='CANDIDATE_ONLY'||
    latest?.exactSeatIdentityCount!==6)
  return Object.freeze({status:'FAIL_CLOSED',
   code:'CONTINUITY_LOST_WITH_SIX_SEATS_PRESERVED',
   stopRunners:false,spawnRunners:false,heartbeatWriteAuthorized:false});
 return Object.freeze({status:'CONTINUE_CANDIDATE',
  code:'IDENTITIES_REMAIN_CONTINUOUS_NOT_HEARTBEAT_AUTHORIZATION',
  stopRunners:false,spawnRunners:false,heartbeatWriteAuthorized:false});
}

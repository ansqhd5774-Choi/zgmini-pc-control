// Pure Supervisor continuity candidate for six existing Windows Runner seats.
// NEVER performs a lease rewrite, reuses a credential, spawns/stops a process,
// or authorizes a recovery B. An operator must later prove the private
// inherited Runner nonce and exact Windows identity in an approved CAS path.
const sha40=x=>typeof x==='string'&&/^[a-f0-9]{40}$/.test(x);
const sha64=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const validPid=x=>Number.isSafeInteger(x)&&x>0;
const validTime=x=>typeof x==='string'&&Number.isFinite(Date.parse(x));
const seatNumbers=Object.freeze([1,2,3,4,5,6]);
const deny=(code,counts=null)=>Object.freeze({
 schema:'ZGMINI_SUPERVISOR_ORPHAN_CONTINUITY_PREFLIGHT_V1',
 status:'BLOCKED',code,
 evidence:'ISOLATED_SOURCE_CANDIDATE_NOT_OPERATING_AUTHORIZATION',
 existingListenerCount:counts?.listeners??null,
 activeWorkerCount:counts?.workers??null,
 oldOwnerNonceContinued:false,controllerJobAdmissionVerified:false,
 effectAuthorized:false,supervisorSpawnAuthorized:false,
 runnerStopAuthorized:false,leaseMutationAuthorized:false,
 operationalWrites:0,providerCalls:0,d1Writes:0
});
export function assessOrphanOwnerContinuity({
 observedAt,now,oldOwner,oldOwnerAlive,oldSupervisorIdentityProven,
 oldHeartbeat,controllerSourceSha,installedControllerSourceSha,
 currentBootAt,ownerBytesSha256,expectedOwnerBytesSha256,
 hostBytesSha256,expectedHostBytesSha256,
 watchdogOwnerVerified,watchdogSourceMatch,watchdogBlockedOldRunners,
 maintenanceReceiverReady,installLeaseHeld,relatedLeaseCount,
 allSixRunnersOnline,runnerSeatProof,
 inheritedNonceLocalProof,approvalManifestAuthenticated=false
}={}){
 const denyWith=code=>deny(code);
 // A current Agent must still attest old PID death, same Windows boot,
 // the exact 40-byte source identity and unmodified old-owner/host bytes.
 if(!sha40(controllerSourceSha)||controllerSourceSha!==installedControllerSourceSha||
    !sha64(ownerBytesSha256)||ownerBytesSha256!==expectedOwnerBytesSha256||
    !sha64(hostBytesSha256)||hostBytesSha256!==expectedHostBytesSha256)
  return denyWith('CONTINUITY_SOURCE_OR_OWNER_CAS_UNVERIFIED');
 if(!validPid(oldOwner?.pid)||typeof oldOwner?.nonce!=='string'||
    !/^[0-9a-f-]{36}$/i.test(oldOwner.nonce)||
    !Number.isFinite(oldOwner?.bootAt)||!Number.isFinite(currentBootAt)||
    Math.abs(oldOwner.bootAt-currentBootAt)>=10000||
    oldOwnerAlive!==false||oldSupervisorIdentityProven!==true)
  return denyWith('CONTINUITY_OLD_OWNER_DEATH_OR_BOOT_UNVERIFIED');
 if(!validTime(observedAt)||!Number.isFinite(now)||!validTime(oldHeartbeat?.at)||
    !validPid(oldHeartbeat?.pid)||oldHeartbeat.pid!==oldOwner.pid||
    oldHeartbeat.sourceSha!==controllerSourceSha||
    oldHeartbeat.mode!=='LISTENING'||
    !Array.isArray(oldHeartbeat.children)||oldHeartbeat.children.length!==6)
  return denyWith('CONTINUITY_OLD_SIX_SEAT_HEARTBEAT_UNVERIFIED');
 const observedMs=Date.parse(observedAt),oldMs=Date.parse(oldHeartbeat.at);
 if(observedMs>now||now-observedMs>120000||oldMs>observedMs||
    observedMs-oldMs<45000||observedMs-oldMs>86400000)
  return denyWith('CONTINUITY_EVIDENCE_AGE_UNVERIFIED');
 const pids=new Set(),seats=new Set();
 for(const child of oldHeartbeat.children){
  if(!seatNumbers.includes(child?.seat)||!validPid(child?.pid)||
     pids.has(child.pid)||seats.has(child.seat))
   return denyWith('CONTINUITY_OLD_HEARTBEAT_CHILD_UNVERIFIED');
  pids.add(child.pid);seats.add(child.seat);
 }
 if(watchdogOwnerVerified!==true||watchdogSourceMatch!==true||
    watchdogBlockedOldRunners!==true||maintenanceReceiverReady!==true)
  return denyWith('CONTINUITY_WATCHDOG_OR_MAINTAINER_UNVERIFIED');
 if(installLeaseHeld!==false||relatedLeaseCount!==0||
    allSixRunnersOnline!==true)
  return denyWith('CONTINUITY_SHARED_LEASE_OR_RUNNER_ROSTER_UNVERIFIED');
 if(!Array.isArray(runnerSeatProof)||runnerSeatProof.length!==6)
  return denyWith('CONTINUITY_WMI_SIX_SEAT_UNVERIFIED');
 const rows=new Set();let workers=0;
 for(const row of runnerSeatProof){
  if(!seatNumbers.includes(row?.seat)||rows.has(row.seat)||
     row.listenerCount!==1||!Number.isSafeInteger(row.workerCount)||
     row.workerCount<0||row.workerCount>1||
     row.canonicalControllerSource!==true||
     row.livePidWithCreationTimeVerified!==true)
    return denyWith('CONTINUITY_WMI_SEAT_IDENTITY_UNVERIFIED');
  rows.add(row.seat);workers+=row.workerCount;
 }
 if(workers!==0)
  return deny('CONTINUITY_WORKER_PRESENT',{listeners:6,workers});
 // A same-nonce takeover must not be assumed from WMI executable paths.
 // Its proof requires a trusted *private* Windows lineage attestation,
 // never a GitHub issue body, job log, environment dump or synthetic claim.
 if(inheritedNonceLocalProof?.method!=='PRIVATE_WINDOWS_SUPERVISOR_LAUNCH_LINEAGE'||
    inheritedNonceLocalProof.verified!==true||
    inheritedNonceLocalProof.seatCount!==6||
    inheritedNonceLocalProof.oldOwnerMatches===false)
  return denyWith('CONTINUITY_INHERITED_RUNNER_NONCE_UNVERIFIED');
 if(approvalManifestAuthenticated!==true)
  return denyWith('CONTINUITY_EFFECT_APPROVAL_NOT_ESTABLISHED');
 // The proposal is still NOT an effect grant. Implementing a private
 // one-shot operator would require atomic owner/lease CAS, same-boot identity,
 // a no-spawn Supervisor, rollback, and an actual Runner job PASS readback.
 return Object.freeze({
  ...deny('CONTINUITY_CANDIDATE_ONLY',{listeners:6,workers:0}),
  status:'CANDIDATE_ONLY',code:'CONTINUITY_SAME_NONCE_OWNER_REPLACEMENT_PLAUSIBLE',
  oldOwnerNonceContinued:false,controllerJobAdmissionVerified:false
 });
}

// Legacy Runner environments are immutable. New-nonce owner creation cannot
// authenticate them. Continuing an attested old nonce *may* satisfy the
// installed assertSupervisorOwner contract, but this source file does not
// output, reuse, escrow, import or approve a token.
export function compareContinuityStrategies({
 existingRunnerNonceMatchesNewOwner,
 oldPidProvenDead,originalSixSeatsVerified,
 newSupervisorWouldSpawnSix
}={}){
 return Object.freeze({
  sameNonceCode:oldPidProvenDead===true&&originalSixSeatsVerified===true&&
    existingRunnerNonceMatchesNewOwner===true?
    'CODE_PATH_PLAUSIBLE_NOT_AUTHORIZED':'SAME_NONCE_EFFECT_UNVERIFIED',
  newNonceCode:existingRunnerNonceMatchesNewOwner===false?
    'OLD_RUNNER_ADMISSION_WOULD_FAIL':'NEW_NONCE_NOT_EVALUATED',
  duplicateRisk:newSupervisorWouldSpawnSix!==false,
  effectAuthorized:false,operationalWrites:0
 });
}

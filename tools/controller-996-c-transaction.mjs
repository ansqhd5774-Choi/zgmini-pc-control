// #996 INTAKE_PAUSED: verified C recovery transaction contract.
// SOURCE-ONLY until a separate fixed-root original Windows adapter verifies
// signed approval and physical evidence. There is deliberately NO CLI, GitHub
// mutation, filesystem mutation, install, retry or lease deletion in this file.
// Injected ports are test-only for deterministic failure simulation.

export const RECOVERY_996=Object.freeze({
 requestId:'pc-update-0010b2cf-9bca-40cf-89c5-b750fa42b404',
 issueNumber:996,controllerSha:'badad9124157879d7a645b64f2768113d632355b',
 targetSha:'9db6fff689c488a59fe8771f013b7c5d3bafc0a8',
 maintainerSha:'16064e29fea0e53e7769a24d93d75b6f5292cfc0',
});
const validSha=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const fail=(code)=>Object.freeze({
 schema:'ZGMINI_CONTROLLER_996_C_TRANSACTION_V1',status:'NOT_STARTED',code,
  workflowEnables:0,leaseArchives:0,backlogReplays:0,originalRetries:0,
  controllerInstalls:0,executionAuthorized:false,
});
const STOP='STATE_UNKNOWN_PRESERVE_C_CLAIM_AND_ORIGINAL_LEASE';
const expectedEvidence=['ledger','owner','recoveryMarker','backlog','stagedHost',
 'controllerHost','maintainerManifest','protectedSnapshot'];

/**
 * Deliberately strict -- external strings/booleans are NOT proof. The future
 * native adapter must authenticate Git objects, local bytes and workflow
 * provenance independently. This function expresses one-shot ordering only.
 */
export function validate996CContract({preflight,approval}={}){
 const id=RECOVERY_996;
 if(!preflight||!approval||approval.approved!==true||approval.grade!=='C'||
  approval.operation!=='RECONCILE_INTAKE_PAUSED_ONLY'||
  approval.requestId!==id.requestId||approval.issueNumber!==id.issueNumber||
  approval.controllerSha!==id.controllerSha||approval.targetSha!==id.targetSha||
  approval.maintainerSha!==id.maintainerSha||
  approval.executionScope!=='ORIGINAL_WINDOWS_ONE_SHOT'||
  approval.userConsentReceiptVerified!==true||
  approval.committedManifestVerified!==true)
  return fail('EXPLICIT_PINNED_C_APPROVAL_UNVERIFIED');
 if(preflight.schema!=='ZGMINI_CONTROLLER_996_INTAKE_EVIDENCE_V1'||
  preflight.requestId!==id.requestId||preflight.issueNumber!==id.issueNumber||
  preflight.ledger?.firstFail!=='INTAKE_PAUSED'||
  preflight.ledger?.code!=='RUNNER_SET_DRIFT'||
  preflight.ledger?.status!=='RECOVERY_REQUIRED'||
  preflight.ledger?.phase!=='RECOVERY_REQUIRED'||
  preflight.controller?.sourceSha!==id.controllerSha||
  preflight.maintainer?.sourceSha!==id.maintainerSha||
  preflight.workflow?.state!=='disabled_manually')
  return fail('ORIGINAL_WINDOWS_EVIDENCE_MISMATCH');
 const checks=[
  preflight.installLock?.ownerDeadProven===true,
  preflight.installLock?.ownerNonceMatched===true,
  preflight.installLock?.recoveryClaimAbsent===true,
  preflight.controller?.hostFilesVerified===true,
  preflight.controller?.switchNeverStarted===true,
  preflight.controller?.supervisorIdentityVerified===true,
  preflight.stage?.exists===true,preflight.stage?.bytesVerified===true,
  preflight.stage?.snapshotAbsent===true,
  preflight.backlog?.pauseWindowOpen===true,
  preflight.backlog?.pauseOwnedByRequest===true,
  preflight.backlog?.replaysUntampered===true,
  preflight.workflow?.pausedByRequest===true,
  preflight.protection?.beforeAndNowVerified===true,
  preflight.protection?.unchanged===true,
  preflight.maintainer?.filesVerified===true,
  preflight.otherControllerLeaseCount===0,
  Array.isArray(preflight.runners)&&Array.from({length:6},(_,i)=>`zgmini-pc-0${i+1}`)
   .every(n=>preflight.runners.filter(r=>r?.name===n&&r?.status==='online'&&r?.busy===false).length===1),
 ];
 if(checks.some(ok=>!ok))return fail('C_PRECONDITION_UNPROVEN');
 const digests=preflight.digests??{};
 if(Object.keys(digests).length!==expectedEvidence.length||
  expectedEvidence.some(k=>!validSha(digests[k])||
   digests[k]!==approval.evidenceSha256?.[k]))
  return fail('C_RAW_EVIDENCE_CAS_MISMATCH');
 if(!Array.isArray(approval.allowedEffects)||approval.allowedEffects.join(',')!==[
   'ENABLE_EXISTING_PC_JOB_WORKFLOW_ONCE',
   'CLOSE_VERIFIED_ORIGINAL_PAUSE_WINDOW_ONCE',
   'READ_ONLY_DISPOSITION_NO_REPLAY',
   'ARCHIVE_ONLY_ORIGINAL_INSTALL_LEASE_AFTER_POSTCHECK',
  ].join(','))return fail('C_EFFECT_BOUNDARY_MISMATCH');
 return Object.freeze({schema:'ZGMINI_CONTROLLER_996_C_TRANSACTION_V1',
  status:'REVIEWED_CONTRACT_ONLY',code:'NATIVE_C_ADAPTER_REQUIRED',
  executionAuthorized:false,sourceOnly:true,
  intendedOrder:['FRESH_CAS','ATOMIC_CLAIM','FRESH_CAS_WITH_OWN_CLAIM',
   'DURABLE_PREPARED_RECORD','WORKFLOW_ENABLE_ONCE','WORKFLOW_ACTIVE_READBACK',
   'BACKLOG_CLOSE_CAS','FULL_ORIGINAL_DISPOSITION_READBACK',
   'INDEPENDENT_PROTECTED_POSTCHECK','DURABLE_PRE_ARCHIVE_RECORD',
   'ORIGINAL_LEASE_ARCHIVE',
   'FINAL_READBACK_AND_COMPLETE'],
 });
}

/**
 * Simulator/proof of ordering only. No production adapter may call this
 * until the signed consent, immutable original evidence and native ports have
 * been independently reviewed. Failures AFTER claim leave the claim intact:
 * especially a timed-out workflow enable must NEVER be retried blindly.
 */
export async function simulate996CTransaction({preflight,approval,ports}={}){
 const contract=validate996CContract({preflight,approval});
 if(contract.status!=='REVIEWED_CONTRACT_ONLY')return contract;
 if(!ports||typeof ports!=='object')return fail('C_NATIVE_ADAPTER_NOT_IMPLEMENTED');
 const names=['freshReadback','reserveClaim','freshWithOwnClaim','recordPrepared',
  'enableWorkflowOnce','workflowActiveReadback','closeBacklogCas',
  'fullBacklogDispositionReadback','independentProtectedPostcheck',
  'recordPreArchive','archiveOriginalLease','finalReadback','completeRecord'];
 if(names.some(n=>typeof ports[n]!=='function'))return fail('C_NATIVE_ADAPTER_INCOMPLETE');
 const counters={workflowEnables:0,leaseArchives:0,backlogReplays:0,
  originalRetries:0,controllerInstalls:0};
 const checkpoint={
  schema:'ZGMINI_CONTROLLER_996_C_TRANSACTION_V1',
  status:'STATE_UNKNOWN',code:STOP,step:'NOT_STARTED',
  originalRequestId:RECOVERY_996.requestId,
  executionAuthorized:false,...counters,
 };
 let claimAttempted=false;
 for(const [index,name] of names.entries()){
  checkpoint.step=name;
  try{
   // The adapter's return contract is exact Boolean success. Ambiguity, a
   // thrown error, an unresolved write or malformed return is NOT success.
   if(name==='reserveClaim')claimAttempted=true;
   if(name==='enableWorkflowOnce')counters.workflowEnables++;
   if(name==='archiveOriginalLease')counters.leaseArchives++;
   const result=await ports[name]({requestId:RECOVERY_996.requestId,
    issueNumber:996,sourceEvidence:preflight,approvedManifest:approval});
   if(result!==true)throw Error('UNCERTAIN_OUTCOME');
   // The one-shot limit includes ATTEMPTS, not only confirmed completions.
   Object.assign(checkpoint,counters);
  }catch{
   // No rollback or retry on ambiguous mutations. External operator must
   // inspect claim, original lease, workflow and backlog independently.
   return Object.freeze({...checkpoint,status:'STATE_UNKNOWN',
    code:claimAttempted?STOP:'C_NOT_STARTED_UNVERIFIED',
    failedStep:name,step:index+1,retryAuthorized:false,
    claimMustRemain:claimAttempted,workflowEnables:counters.workflowEnables,
    leaseArchives:counters.leaseArchives});
  }
 }
 return Object.freeze({...checkpoint,status:'SIMULATED_TRANSACTION_PASS',
  code:'NO_REAL_WINDOWS_EFFECT',step:'COMPLETE',
  workflowEnables:1,leaseArchives:1,claimMustRemain:false});
}

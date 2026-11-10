// #996 INTAKE_PAUSED: verified C recovery transaction contract.
// SOURCE-ONLY until a separate fixed-root original Windows adapter verifies
// signed approval and physical evidence. There is deliberately NO CLI, GitHub
// mutation, filesystem mutation, install, retry or lease deletion in this file.
// Injected ports are test-only for deterministic failure simulation.
import {createHash} from 'node:crypto';

export const RECOVERY_996=Object.freeze({
 requestId:'pc-update-0010b2cf-9bca-40cf-89c5-b750fa42b404',
 issueNumber:996,controllerSha:'badad9124157879d7a645b64f2768113d632355b',
 targetSha:'9db6fff689c488a59fe8771f013b7c5d3bafc0a8',
 maintainerSha:'16064e29fea0e53e7769a24d93d75b6f5292cfc0',
});
const validSha=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const fail=(code)=>Object.freeze({
 schema:'ZGMINI_CONTROLLER_996_C_TRANSACTION_V1',status:'NOT_STARTED',code,
  workflowEnables:0,leaseArchives:0,ownClaimArchives:0,
  backlogReplays:0,originalRetries:0,
  controllerInstalls:0,executionAuthorized:false,
});
const STOP='STATE_UNKNOWN_PRESERVE_C_CLAIM_AND_ORIGINAL_LEASE';
// Only the seven raw files emitted by the actual ORIGINAL_WINDOWS_OBSERVATION_V1.
// In particular there is NO historical `protectedSnapshot`: #996 failed before
// backup(), which is the first step persisting PROTECTED_BEFORE.json.
const expectedEvidence=['ledger','owner','recoveryMarker','backlog','controllerHost',
 'stagedHost','maintainerManifest'];
const expectedChecks=['ledgerPinned','ownerMatched','ownerDead',
 'recoveryClaimAbsent','stageOnly','stagedFilesVerified',
 'installedControllerVerified','maintainerVerified','backlogOpen',
 'workflowDisabled','originalIssuePinned','dedicatedRunnersReady',
 'supervisorVerified','runnerListComplete','noOtherControllerLeases',
 'stableRawDigests','workflowDisableActorVerified','protectedBaselineVerified'];
const unprovenChecks=['workflowDisableActorVerified','protectedBaselineVerified'];
const writerFiles=['config.json','quota-runner.cmd','run-local.cmd'];
const protectedTasks=['ZGMINI-PC-Local-Core','ZGMINI-PC-Local-Korea'];
const allowedEffects=['ENABLE_EXISTING_PC_JOB_WORKFLOW_ONCE',
 'CLOSE_VERIFIED_ORIGINAL_PAUSE_WINDOW_ONCE','READ_ONLY_DISPOSITION_NO_REPLAY',
 'ARCHIVE_ONLY_ORIGINAL_INSTALL_LEASE_AFTER_POSTCHECK'];

/**
 * Deliberately strict -- external strings/booleans are NOT proof. The future
 * native adapter must authenticate Git objects, local bytes and workflow
 * provenance independently. This function expresses one-shot ordering only.
 */
export function validate996CContract({preflight,protectedAttestation,approval}={}){
 const id=RECOVERY_996;
 if(!preflight||!approval||approval.approved!==true||approval.grade!=='C'||
  approval.operation!=='RECONCILE_INTAKE_PAUSED_ONLY'||
  approval.requestId!==id.requestId||approval.issueNumber!==id.issueNumber||
  approval.controllerSha!==id.controllerSha||approval.targetSha!==id.targetSha||
  approval.maintainerSha!==id.maintainerSha||
  approval.executionScope!=='ORIGINAL_WINDOWS_ONE_SHOT'||
  approval.authorizationMode!=='PHASE_SCOPED_EVIDENCE_EXCEPTION'||
  approval.acceptsUnprovenGitHubDisableActor===undefined||
  approval.acceptsUnprovenGitHubDisableActor!==true||
  approval.acceptsMissingHistoricalProtectedBaseline!==true||
  approval.acceptsNoAllActorsImmutabilityProof!==true||
  !Array.isArray(approval.acceptedGaps)||
  approval.acceptedGaps.join(',')!==unprovenChecks.join(',')||
  approval.userConsentReceiptVerified!==true||
  approval.committedManifestVerified!==true)
  return fail('EXPLICIT_PINNED_C_APPROVAL_UNVERIFIED');
 if(preflight.schema!=='ZGMINI_CONTROLLER_996_ORIGINAL_WINDOWS_OBSERVATION_V1'||
  preflight.requestId!==id.requestId||preflight.issueNumber!==id.issueNumber||
  !Number.isFinite(Date.parse(preflight.observedAt))||
  preflight.observedAt!==approval.evidenceObservedAt||
  preflight.status!=='C_EVIDENCE_GAPS'||
  preflight.firstFailedCheck!=='workflowDisableActorVerified'||
  preflight.protectedBaselineSha256!==null||
  preflight.independentRunnersObserved!==1||
  preflight.backlogPauseWindowCount!==1||
  preflight.operationalWrites!==0||preflight.issuePosts!==0||
  preflight.pcRetries!==0||preflight.executionAuthorized!==false||
  !validSha(preflight.protectionNowFingerprint)||
  preflight.protectionNowFingerprint!==approval.protectionNowFingerprint)
  return fail('ORIGINAL_WINDOWS_EVIDENCE_MISMATCH');
 // Supplementary read-only proof records each of the three Writer files and
 // two Task XML hashes. It must independently reproduce the aggregate from
 // the first Windows observation without inventing a historical baseline.
 const p=protectedAttestation,items=p?.items;
 const files=items?.files,tasks=items?.taskSha256,enabled=items?.taskEnabled;
 if(p?.schema!=='ZGMINI_CONTROLLER_996_PROTECTED_ITEMS_READONLY_V1'||
  p.requestId!==id.requestId||p.issueNumber!==996||
  p.status!=='CURRENT_ITEMS_MATCH_OBSERVATION'||
  !Number.isFinite(Date.parse(p.observedAt))||
  p.observedAt!==approval.protectedItemsObservedAt||
  p.currentFingerprint!==preflight.protectionNowFingerprint||
  p.originalObservationFingerprint!==preflight.protectionNowFingerprint||
  p.fingerprintMatch!==true||p.allFivePresent!==true||
  p.historicalBaselineAvailable!==false||p.allActorsImmutableProven!==false||
  p.operationalWrites!==0||p.issuePosts!==0||p.pcRetries!==0||
  p.executionAuthorized!==false||
  !files||!tasks||!enabled||
  Object.keys(files).length!==writerFiles.length||
  Object.keys(tasks).length!==protectedTasks.length||
  Object.keys(enabled).length!==protectedTasks.length||
  writerFiles.some(k=>!validSha(files[k])||
   files[k]!==approval.protectedItemsSha256?.files?.[k])||
  protectedTasks.some(k=>!validSha(tasks[k])||
   typeof enabled[k]!=='boolean'||
   tasks[k]!==approval.protectedItemsSha256?.tasks?.[k]||
   enabled[k]!==approval.protectedTaskEnabled?.[k]))
  return fail('CURRENT_PROTECTED_ITEMS_UNPROVEN');
 const calculated=createHash('sha256').update(Buffer.from(JSON.stringify({
  files:Object.fromEntries(writerFiles.map(k=>[k,files[k]])),
  tasks:Object.fromEntries(protectedTasks.map(k=>[k,tasks[k]])),
 }))).digest('hex');
 if(calculated!==p.currentFingerprint)
  return fail('CURRENT_PROTECTED_AGGREGATE_MISMATCH');
 const checks=preflight.checks;
 if(!checks||typeof checks!=='object'||Array.isArray(checks)||
  Object.keys(checks).length!==expectedChecks.length||
  expectedChecks.some(k=>!Object.hasOwn(checks,k)||
   checks[k]!==(!unprovenChecks.includes(k))))
  return fail('C_PRECONDITION_UNPROVEN');
 // A claimed phase-only causal proof is NOT a GitHub audit, nor proof that
 // other processes did not touch the protected files. The eventual native
 // adapter must reproduce it against the pinned maintainer source and ledger.
 const causal=approval.phaseScopedSourceProof;
 if(!causal||causal.maintainerSourceSha!==id.maintainerSha||
  causal.failureFirstPhase!=='INTAKE_PAUSED'||
  causal.failureCode!=='RUNNER_SET_DRIFT'||
  causal.reachedBackup!==false||causal.reachedControllerSwitch!==false||
  causal.claimsIndependentDisableActorAudit!==false||
  causal.claimsAllActorsProtectedImmutability!==false)
  return fail('C_PHASE_CAUSAL_PROOF_UNVERIFIED');
 const digests=preflight.digests??{};
 if(Object.keys(digests).length!==expectedEvidence.length||
  expectedEvidence.some(k=>!validSha(digests[k])||
   digests[k]!==approval.evidenceSha256?.[k]))
  return fail('C_RAW_EVIDENCE_CAS_MISMATCH');
 if(!Array.isArray(approval.allowedEffects)||
   approval.allowedEffects.join(',')!==allowedEffects.join(','))
  return fail('C_EFFECT_BOUNDARY_MISMATCH');
 return Object.freeze({schema:'ZGMINI_CONTROLLER_996_C_TRANSACTION_V1',
  status:'REVIEWED_CONTRACT_ONLY',code:'NATIVE_C_ADAPTER_REQUIRED',
  executionAuthorized:false,sourceOnly:true,
  evidenceChecksPassed:16,evidenceChecksUnproven:unprovenChecks,
  intendedOrder:['FRESH_CAS','ATOMIC_CLAIM','FRESH_CAS_WITH_OWN_CLAIM',
   'DURABLE_PREPARED_RECORD','WORKFLOW_ENABLE_ONCE','WORKFLOW_ACTIVE_READBACK',
   'BACKLOG_CLOSE_CAS','FULL_ORIGINAL_DISPOSITION_READBACK',
   'INDEPENDENT_PROTECTED_POSTCHECK','DURABLE_PRE_ARCHIVE_RECORD',
   'ORIGINAL_LEASE_ARCHIVE',
   'FINAL_READBACK_AND_COMPLETE','ARCHIVE_OWN_RECOVERY_CLAIM',
   'FINAL_OWN_CLAIM_READBACK'],
 });
}

/**
 * Simulator/proof of ordering only. No production adapter may call this
 * until the signed consent, immutable original evidence and native ports have
 * been independently reviewed. Failures AFTER claim leave the claim intact:
 * especially a timed-out workflow enable must NEVER be retried blindly.
 */
export async function simulate996CTransaction({preflight,protectedAttestation,approval,ports}={}){
 const contract=validate996CContract({preflight,protectedAttestation,approval});
 if(contract.status!=='REVIEWED_CONTRACT_ONLY')return contract;
 if(!ports||typeof ports!=='object')return fail('C_NATIVE_ADAPTER_NOT_IMPLEMENTED');
 const names=['freshReadback','reserveClaim','freshWithOwnClaim','recordPrepared',
  'enableWorkflowOnce','workflowActiveReadback','closeBacklogCas',
  'fullBacklogDispositionReadback','independentProtectedPostcheck',
  'recordPreArchive','archiveOriginalLease','finalReadback','completeRecord',
  'archiveOwnClaim','finalOwnClaimReadback'];
 if(names.some(n=>typeof ports[n]!=='function'))return fail('C_NATIVE_ADAPTER_INCOMPLETE');
 const counters={workflowEnables:0,leaseArchives:0,ownClaimArchives:0,backlogReplays:0,
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
   if(name==='archiveOwnClaim')counters.ownClaimArchives++;
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
    claimMustRemain:claimAttempted&&index<13,
    claimDisposition:!claimAttempted?'NOT_CREATED':index>=13?
     'MAY_BE_ARCHIVED_REQUIRE_INDEPENDENT_READBACK':'PRESERVE_IN_PLACE',
    workflowEnables:counters.workflowEnables,
    leaseArchives:counters.leaseArchives,
    ownClaimArchives:counters.ownClaimArchives});
  }
 }
 return Object.freeze({...checkpoint,status:'SIMULATED_TRANSACTION_PASS',
  code:'NO_REAL_WINDOWS_EFFECT',step:'COMPLETE',
  workflowEnables:1,leaseArchives:1,ownClaimArchives:1,
  claimMustRemain:false,claimDisposition:'SIMULATED_ARCHIVED'});
}

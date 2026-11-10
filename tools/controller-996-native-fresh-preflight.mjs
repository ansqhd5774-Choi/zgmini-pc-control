// #996 original Windows physical preflight, immediately BEFORE a future C
// transaction. This is intentionally separate from immutable, historical
// R1/R2 observations in the owner consent manifest: the observedAt values
// change on every fresh read and must not be silently substituted there.
// This module has no claim, Workflow, backlog, GitHub mutation or CLI path.
import {collect996WindowsEvidence,REQUEST_996}
 from './controller-996-windows-observer.mjs';
import {collect996ProtectedItems}
 from './controller-996-protection-attestation.mjs';
import {review996ProtectedR2Evidence}
 from './controller-996-r2-evidence-review.mjs';

const R1_AT='2026-11-10T03:02:02.041Z';
const R2_AT='2026-11-10T04:06:43.338Z';
const FINGERPRINT='877bcd2a2abbf34452c09fc96a15b28d0309a32b45687f8dace37ae5e29abb86';
const RAW=Object.freeze({
 ledger:'c6276bcf78ee96d8858e91621c85437abb5377108fe6c5b5681bf9b617743930',
 owner:'d6329b4d82530f9a1ca574647f050fff9243b698bb9dd314975b19ed171e40bc',
 recoveryMarker:'4dc51f7e3a1cd84ce94ddf993e4a1cfbb319b050447dfbb5ccf0c38434a0b09b',
 backlog:'d48698b6bfe152fdcbea5adf582364334dc8633742cce02e6a1299718304a780',
 controllerHost:'32403a79fb407cabe8426de7507116847178f734da68a289cc12fa8cf4ca36c9',
 stagedHost:'9903d822bca20ae14dcf5a2f6a0d1f44869f29b3c274e9a4a2de226d401069b3',
 maintainerManifest:'a5ed876c520a844a33bdf6cc137ac8015f686ed416aff6370389440ad6e3cba5',
});
const PROVEN=['ledgerPinned','ownerMatched','ownerDead',
 'recoveryClaimAbsent','stageOnly','stagedFilesVerified',
 'installedControllerVerified','maintainerVerified','backlogOpen',
 'workflowDisabled','originalIssuePinned','dedicatedRunnersReady',
 'supervisorVerified','runnerListComplete','noOtherControllerLeases',
 'stableRawDigests'];
const UNPROVEN=['workflowDisableActorVerified','protectedBaselineVerified'];
const TASKS=['ZGMINI-PC-Local-Core','ZGMINI-PC-Local-Korea'];
const need=(ok,code)=>{if(!ok)throw Object.assign(Error(code),{code});};
const time=t=>typeof t==='string'?Date.parse(t):NaN;
const fail=(code)=>Object.freeze({
 schema:'ZGMINI_CONTROLLER_996_NATIVE_FRESH_PREFLIGHT_V1',
 status:'C_FRESH_READBACK_UNVERIFIED',code,executionAuthorized:false,
 operationalWrites:0,workflowEnables:0,issuePosts:0,pcRetries:0,
});

function comparePhysicalReadback({r1,r2,ownClaim=null}={}){
 const owned=ownClaim!==null;
 if(owned&&(!ownClaim||ownClaim.requestId!==REQUEST_996.requestId||
  ownClaim.issueNumber!==996||ownClaim.pid!==process.pid||
  typeof ownClaim.nonce!=='string'||
  !/^[a-zA-Z0-9-]{1,80}$/.test(ownClaim.nonce)||
  !Number.isFinite(time(ownClaim.at))||
  time(ownClaim.at)>time(r1?.observedAt)))
  return fail('C_FRESH_OWN_CLAIM_UNVERIFIED');
 if(r1?.schema!=='ZGMINI_CONTROLLER_996_ORIGINAL_WINDOWS_OBSERVATION_V1'||
  r1.requestId!==REQUEST_996.requestId||r1.issueNumber!==996||
  r1.status!=='C_EVIDENCE_GAPS'||
  r1.firstFailedCheck!==(owned?'recoveryClaimAbsent':
   'workflowDisableActorVerified')||
  !Number.isFinite(time(r1.observedAt))||time(r1.observedAt)<time(R1_AT)||
  r1.protectionNowFingerprint!==FINGERPRINT||
  r1.protectedBaselineSha256!==null||
  r1.backlogPauseWindowCount!==1||
  !Number.isSafeInteger(r1.independentRunnersObserved)||
  r1.independentRunnersObserved<0||
  r1.operationalWrites!==0||r1.issuePosts!==0||r1.pcRetries!==0||
  r1.executionAuthorized!==false)
  return fail('C_FRESH_R1_ORIGINAL_CONTEXT_INVALID');
 if(!r1.checks||Object.keys(r1.checks).length!==PROVEN.length+UNPROVEN.length||
  PROVEN.some(k=>r1.checks[k]!==(owned&&k==='recoveryClaimAbsent'?false:true))||
  UNPROVEN.some(k=>r1.checks[k]!==false))
  return fail('C_FRESH_R1_PRECONDITION_DRIFT');
 if(!r1.digests||Object.keys(r1.digests).length!==Object.keys(RAW).length||
  Object.keys(RAW).some(k=>r1.digests[k]!==RAW[k]))
  return fail('C_FRESH_R1_ORIGINAL_RAW_DIGEST_DRIFT');
 const r2review=review996ProtectedR2Evidence(r2);
 if(r2review.status!=='CURRENT_PROTECTION_MATCHES_R1'||
  !Number.isFinite(time(r2?.observedAt))||
  time(r2.observedAt)<time(R2_AT)||
  time(r2.observedAt)<time(r1.observedAt))
  return fail('C_FRESH_R2_PROTECTION_OR_READ_ORDER_UNVERIFIED');
 // The original R2 pinned both Task XML hashes and both enabled states.
 if(TASKS.some(n=>r2.items.taskEnabled[n]!==true))
  return fail('C_FRESH_R2_PROTECTED_TASK_DISABLED');
 return Object.freeze({
  schema:'ZGMINI_CONTROLLER_996_NATIVE_FRESH_PREFLIGHT_V1',
  status:owned?'FRESH_OWN_CLAIM_R1_R2_MATCH_PINNED':
   'FRESH_ORIGINAL_WINDOWS_R1_R2_MATCH_PINNED',
  code:'READONLY_PROOF_NOT_C_EXECUTION_AUTHORITY',
  requestId:REQUEST_996.requestId,issueNumber:996,
  r1ObservedAt:r1.observedAt,r2ObservedAt:r2.observedAt,
  originalR1ObservedAt:R1_AT,originalR2ObservedAt:R2_AT,
  rawDigestsVerified:Object.keys(RAW).length,checksVerified:PROVEN.length,
  historicalGapsUnproven:UNPROVEN,
  ownCClaimVerified:owned,
  protectedFingerprint:r2review.protectedFingerprint,
  protectedTasksEnabled:r2review.enabledTasks,
  executionAuthorized:false,operationalWrites:0,workflowEnables:0,
  issuePosts:0,pcRetries:0,
 });
}

export function review996FreshWindowsReadback({r1,r2}={}){
 return comparePhysicalReadback({r1,r2});
}

// One verified own C claim replaces exactly recoveryClaimAbsent.
// No other R1 guard may be waived. Do not call after Workflow PUT or
// backlog close, when the baseline R1 phase guards no longer apply.
export function review996OwnedClaimWindowsReadback({r1,r2,ownClaim}={}){
 if(!ownClaim)return fail('C_FRESH_OWN_CLAIM_UNVERIFIED');
 return comparePhysicalReadback({r1,r2,ownClaim});
}

export function create996NativeFreshPreflight({testOnly=false,
 readR1=collect996WindowsEvidence,readR2=collect996ProtectedItems}={}){
 if(testOnly){
  need(process.platform!=='win32'&&readR1!==collect996WindowsEvidence&&
   readR2!==collect996ProtectedItems&&typeof readR1==='function'&&
   typeof readR2==='function','C_FRESH_TEST_PORT_REJECTED');
 }else{
  need(process.platform==='win32'&&!process.env.GITHUB_ACTIONS&&
   !process.env.RUNNER_NAME&&readR1===collect996WindowsEvidence&&
   readR2===collect996ProtectedItems,'C_FRESH_ORIGINAL_WINDOWS_ONLY');
 }
 return Object.freeze({
  read(){
   let r1,r2;
   try{r1=readR1();r2=readR2();}
   catch(e){return fail(/^C_[A-Z0-9_]+$/.test(e?.code??'')?
    e.code:'C_FRESH_READ_IO_OR_ORIGIN_UNKNOWN');}
   return review996FreshWindowsReadback({r1,r2});
  },
 });
}

export function create996NativeOwnedClaimPreflight({testOnly=false,
 claimStore,readR1=collect996WindowsEvidence,
 readR2=collect996ProtectedItems}={}){
 need(claimStore&&typeof claimStore.ownClaimReadback==='function',
  'C_FRESH_CLAIM_READ_PORT_REQUIRED');
 if(testOnly){
  need(process.platform!=='win32'&&readR1!==collect996WindowsEvidence&&
   readR2!==collect996ProtectedItems&&typeof readR1==='function'&&
   typeof readR2==='function','C_FRESH_TEST_PORT_REJECTED');
 }else{
  need(process.platform==='win32'&&!process.env.GITHUB_ACTIONS&&
   !process.env.RUNNER_NAME&&readR1===collect996WindowsEvidence&&
   readR2===collect996ProtectedItems,'C_FRESH_ORIGINAL_WINDOWS_ONLY');
 }
 return Object.freeze({
  read(){
   let ownClaim,r1,r2;
   try{ownClaim=claimStore.ownClaimReadback();r1=readR1();r2=readR2();}
   catch(e){return fail(/^C_[A-Z0-9_]+$/.test(e?.code??'')?
    e.code:'C_FRESH_OWNED_READ_IO_OR_ORIGIN_UNKNOWN');}
   return review996OwnedClaimWindowsReadback({r1,r2,ownClaim});
  },
 });
}

// #996 read-only composition of independently observed R1/R2 and immutable
// GitHub owner C approval provenance. This is NOT a C execution entrypoint.
// It cannot create claims, archive leases, enable Workflow or write backlog.
import {review996ProtectedR2Evidence} from './controller-996-r2-evidence-review.mjs';
import {review996CConsent} from './controller-996-c-consent-verifier.mjs';
import {validate996CContract} from './controller-996-c-transaction.mjs';

// These anchors were published as the ORIGINAL_WINDOWS_OBSERVATION_V1 and
// PROTECTED_ITEMS_READONLY_V1 results. They are historical pins, NOT an
// assertion that a new Windows observation has already taken place.
const PINNED=Object.freeze({
 requestId:'pc-update-0010b2cf-9bca-40cf-89c5-b750fa42b404',
 r1At:'2026-11-10T03:02:02.041Z',
 r2At:'2026-11-10T04:06:43.338Z',
 fingerprint:'877bcd2a2abbf34452c09fc96a15b28d0309a32b45687f8dace37ae5e29abb86',
 raw:Object.freeze({
  ledger:'c6276bcf78ee96d8858e91621c85437abb5377108fe6c5b5681bf9b617743930',
  owner:'d6329b4d82530f9a1ca574647f050fff9243b698bb9dd314975b19ed171e40bc',
  recoveryMarker:'4dc51f7e3a1cd84ce94ddf993e4a1cfbb319b050447dfbb5ccf0c38434a0b09b',
  backlog:'d48698b6bfe152fdcbea5adf582364334dc8633742cce02e6a1299718304a780',
  controllerHost:'32403a79fb407cabe8426de7507116847178f734da68a289cc12fa8cf4ca36c9',
  stagedHost:'9903d822bca20ae14dcf5a2f6a0d1f44869f29b3c274e9a4a2de226d401069b3',
  maintainerManifest:'a5ed876c520a844a33bdf6cc137ac8015f686ed416aff6370389440ad6e3cba5',
 }),
 writer:Object.freeze({
  'config.json':'0be419f66002bbf0016aceac4c89a8307d1a81d42bd4e9ef637a3633a4775453',
 }),
 writerStatus:Object.freeze({
  'config.json':'PRESENT','quota-runner.cmd':'ABSENT','run-local.cmd':'ABSENT',
 }),
 tasks:Object.freeze({
  'ZGMINI-PC-Local-Core':'dd81987c7efa4b1e343af30329a580613bb920dec89c1aa7a436ef935f0bb028',
  'ZGMINI-PC-Local-Korea':'1797e5def9fc92551132ca69f60bb5320bb346c687988be3e4ff3eb76ef5fdc1',
 }),
 taskEnabled:Object.freeze({
  'ZGMINI-PC-Local-Core':true,'ZGMINI-PC-Local-Korea':true,
 }),
});
const exactObject=(actual,expected)=>actual&&
 typeof actual==='object'&&!Array.isArray(actual)&&
 Object.keys(actual).length===Object.keys(expected).length&&
 Object.keys(expected).every(key=>Object.hasOwn(actual,key)&&
  actual[key]===expected[key]);

const fail=(code)=>Object.freeze({
 schema:'ZGMINI_CONTROLLER_996_C_APPROVAL_READINESS_V1',
 status:'C_NOT_READY',code,executionAuthorized:false,operationalWrites:0,
 workflowEnables:0,issuePosts:0,pcRetries:0,
});

/**
 * A signed owner manifest can attest to the pinned historical values, but
 * must not masquerade as a raw R1 or R2 Windows measurement. This successor
 * to the fixture-based readiness composition never accepts fabricated
 * historical observation objects. Its result is evidence review only;
 * create996NativeFreshPreflight must independently read the live Windows PC.
 */
export function review996NativePinnedConsentReadiness({ownerConsentEvidence}={}){
 const reviewed=review996CConsent(ownerConsentEvidence);
 if(reviewed.status!=='CONSENT_PROVENANCE_REVIEWED_ONLY')
  return fail(reviewed.code);
 let manifest;
 try{
  manifest=JSON.parse(ownerConsentEvidence.operatorManifestBytes.toString('utf8'));
 }catch{return fail('C_PINNED_MANIFEST_JSON_UNREADABLE');}
 if(manifest.requestId!==PINNED.requestId||
  manifest.evidenceObservedAt!==PINNED.r1At||
  manifest.protectedItemsObservedAt!==PINNED.r2At||
  manifest.protectionNowFingerprint!==PINNED.fingerprint||
  !exactObject(manifest.evidenceSha256,PINNED.raw)||
  !exactObject(manifest.protectedWriterFileStatus,PINNED.writerStatus)||
  !exactObject(manifest.protectedItemsSha256?.files,PINNED.writer)||
  !exactObject(manifest.protectedItemsSha256?.tasks,PINNED.tasks)||
  !exactObject(manifest.protectedTaskEnabled,PINNED.taskEnabled))
  return fail('C_SIGNED_HISTORICAL_R1_R2_PIN_MISMATCH');
 return Object.freeze({
  schema:'ZGMINI_CONTROLLER_996_C_PINNED_CONSENT_READINESS_V1',
  status:'READONLY_PINNED_OWNER_C_CONSENT_REVIEWED',
  code:'FRESH_ORIGINAL_WINDOWS_R1_R2_READBACK_STILL_REQUIRED',
  originalRequestId:PINNED.requestId,
  manifestSha256:reviewed.manifestSha256,
  manifestCommitSha:reviewed.manifestCommitSha,
  consentCommentId:reviewed.consentCommentId,
  protectedFingerprint:PINNED.fingerprint,
  historicalR1ObservedAt:PINNED.r1At,
  historicalR2ObservedAt:PINNED.r2At,
  pinnedHistoricalRawDigests:7,
  verifiedPresentWriterFiles:1,
  verifiedProtectedTasks:2,
  explicitlyUnprovenChecks:reviewed.acceptedUnprovenChecks,
  allowedEffects:reviewed.allowedEffects,
  historicalRawWindowsObjectsProvided:false,
  liveWindowsReobserved:false,
  executionAuthorized:false,operationalWrites:0,
  workflowEnables:0,issuePosts:0,pcRetries:0,
 });
}

export function review996NativeApprovalReadiness({originalObservation,
 protectedObservation,ownerConsentEvidence}={}){
 const r2=review996ProtectedR2Evidence(protectedObservation);
 if(r2.status!=='CURRENT_PROTECTION_MATCHES_R1')
  return fail(r2.code);
 const reviewed=review996CConsent(ownerConsentEvidence);
 if(reviewed.status!=='CONSENT_PROVENANCE_REVIEWED_ONLY')
  return fail(reviewed.code);
 // review996CConsent() has already verified these exact bytes came from the
 // pinned immutable Git object and matched the owner's single consent comment.
 let manifest;
 try{manifest=JSON.parse(ownerConsentEvidence.operatorManifestBytes.toString('utf8'));}
 catch{return fail('C_MANIFEST_JSON_UNREADABLE');}
 const approval={...manifest,userConsentReceiptVerified:true,
  committedManifestVerified:true};
 const contract=validate996CContract({preflight:originalObservation,
  protectedAttestation:protectedObservation,approval});
 if(contract.status!=='REVIEWED_CONTRACT_ONLY')
  return fail(contract.code);
 return Object.freeze({schema:'ZGMINI_CONTROLLER_996_C_APPROVAL_READINESS_V1',
  status:'READONLY_APPROVAL_AND_R1_R2_CONTRACT_REVIEWED',
  code:'FRESH_NATIVE_FINAL_PREFLIGHT_AND_OPERATOR_STILL_REQUIRED',
  originalRequestId:originalObservation.requestId,
  protectedFingerprint:r2.protectedFingerprint,
  manifestSha256:reviewed.manifestSha256,
  manifestCommitSha:reviewed.manifestCommitSha,
  consentCommentId:reviewed.consentCommentId,
  verifiedPresentWriterFiles:r2.presentWriterFiles,
  verifiedProtectedTasks:r2.protectedTasksVerified,
  explicitlyUnprovenChecks:contract.evidenceChecksUnproven,
  allowedEffects:reviewed.allowedEffects,
  executionAuthorized:false,operationalWrites:0,workflowEnables:0,
  issuePosts:0,pcRetries:0,
 });
}

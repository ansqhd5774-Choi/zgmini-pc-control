// #996 read-only composition of independently observed R1/R2 and immutable
// GitHub owner C approval provenance. This is NOT a C execution entrypoint.
// It cannot create claims, archive leases, enable Workflow or write backlog.
import {review996ProtectedR2Evidence} from './controller-996-r2-evidence-review.mjs';
import {review996CConsent} from './controller-996-c-consent-verifier.mjs';
import {validate996CContract} from './controller-996-c-transaction.mjs';

const fail=(code)=>Object.freeze({
 schema:'ZGMINI_CONTROLLER_996_C_APPROVAL_READINESS_V1',
 status:'C_NOT_READY',code,executionAuthorized:false,operationalWrites:0,
 workflowEnables:0,issuePosts:0,pcRetries:0,
});

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

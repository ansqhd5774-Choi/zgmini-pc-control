// Pure owner-resume review. This file does not read PC storage, trust supplied
// checkpoint evidence as an attestation, or authorize/retry any operation.
// GitHub return verification is performed by owner-return-review.mjs.
import {readAndReviewOwnerReturn} from './owner-return-review.mjs';

const ALLOWED_REPOS = new Set([
  'ansqhd5774-Choi/zgmini-pc-control',
  'ansqhd5774-Choi/zgmini',
]);
const SHA = /^[0-9a-f]{40}$/;
const REF = /^[a-zA-Z0-9_./:#-]{1,180}$/;
const NEXT = Object.freeze({
  SOURCE_VERIFIED:'COLLECT_RAW',
  RAW_STORED:'CALCULATE_FROM_LOCAL_RAW',
  CALCULATED:'STORE_LOCAL_RESULT',
  RESULT_STORED:'PUBLISH_APPROVED_RESULT',
  D1_VERIFIED:'VERIFY_PUBLIC_API',
  API_VERIFIED:'VERIFY_PC_AND_MOBILE_UI',
  UI_VERIFIED:null,
});
export const OWNER_RESUME_STAGES = Object.freeze(Object.keys(NEXT));

const reject = code => {throw new Error('OWNER_RESUME_'+code);};
const validRef = value => typeof value==='string' && REF.test(value);
const validSha = value => typeof value==='string' && SHA.test(value);
const validIssue = value => Number.isSafeInteger(value)&&value>0;
const isObject = value => value!==null && typeof value==='object' && !Array.isArray(value);
const needs = (base,state,nextEvidence) => Object.freeze({
  ...base,state,nextEvidence,nextFunctionStep:null,
});

function baseReview(value) {
  if(!isObject(value)||!validIssue(value.originIssue)||
     !['NO_RETURNED_RESULT','RETURN_EVIDENCE_REVIEWABLE'].includes(value.state)||
     value.executionAuthorized!==false||
     value.ownerChatReceived!=='UNKNOWN')
    reject('RETURN_REVIEW_INVALID');
  if(value.state==='RETURN_EVIDENCE_REVIEWABLE'&&
     (value.resultReceiptCompared!==true||
      !validIssue(value.incidentIssue)||
      typeof value.resultId!=='string'))
    reject('RETURN_RECEIPT_NOT_VERIFIED');
  return {
    originIssue:value.originIssue,
    returnState:value.state,
    returnedIncident:value.state==='RETURN_EVIDENCE_REVIEWABLE'?
      value.incidentIssue:null,
    ownerChatReceived:'UNKNOWN',
    runtimeVerified:false,
    sourceInstallVerified:false,
    evidenceAuthenticatedByThisFunction:false,
    executionAuthorized:false,
    operationalWrites:0,
    automaticPcRetries:0,
  };
}

function sourceChecked(source) {
  if(!isObject(source)||!ALLOWED_REPOS.has(source.repository)||
     !validSha(source.runtimeSha)||!validSha(source.configSha)||
     !validRef(source.evidenceRef))
    reject('SOURCE_EVIDENCE_INVALID');
  return source;
}
function approvalChecked(approval) {
  if(!isObject(approval)||!validSha(approval.sourceSha)||
     !validRef(approval.evidenceRef))
    reject('APPROVAL_EVIDENCE_INVALID');
  return approval;
}
function checkpointChecked(checkpoint) {
  if(!isObject(checkpoint)||!Object.hasOwn(NEXT,checkpoint.stage)||
     !validSha(checkpoint.sourceSha)||!validRef(checkpoint.evidenceRef))
    reject('CHECKPOINT_EVIDENCE_INVALID');
  return checkpoint;
}

// The three evidence objects are supplied by the owner from independently
// verified readbacks; this pure function checks their consistency, NOT origin.
// An Issue comment, checkpoint name, or a boolean cannot certify Windows/D1.
// No result of this function is permission to install, collect, publish or retry.
export function reviewOwnerNextStep({
  returnReview,sourceEvidence,approvalEvidence,lastValidCheckpoint,
}={}) {
  const base=baseReview(returnReview);
  if(returnReview.state==='NO_RETURNED_RESULT')
    return needs(base,'NO_CENTRAL_RESULT','REVIEW_INDEPENDENT_FUNCTION_PROGRESS');
  if(sourceEvidence===undefined || approvalEvidence===undefined)
    return needs(base,'SOURCE_APPROVAL_EVIDENCE_REQUIRED',
      'READ_CURRENT_SOURCE_AND_APPROVAL');
  const source=sourceChecked(sourceEvidence);
  const approval=approvalChecked(approvalEvidence);
  if(source.runtimeSha!==source.configSha||
     source.runtimeSha!==approval.sourceSha)
    return needs(base,'SOURCE_APPROVAL_RECONCILIATION_REQUIRED',
      'READ_SOURCE_INSTALL_AND_APPROVAL_PROVENANCE');
  if(lastValidCheckpoint===undefined)
    return needs(base,'CHECKPOINT_EVIDENCE_REQUIRED',
      'READ_LAST_VALID_FUNCTION_CHECKPOINT');
  const checkpoint=checkpointChecked(lastValidCheckpoint);
  if(checkpoint.sourceSha!==source.runtimeSha)
    return needs(base,'CHECKPOINT_SOURCE_REVIEW_REQUIRED',
      'VERIFY_CHECKPOINT_COMPATIBILITY_WITH_CURRENT_SOURCE');

  // This stage is only a proposed next review target, not a claim that the
  // provided readbacks are authenticated or that the step is approved.
  const next=NEXT[checkpoint.stage];
  return Object.freeze({
    ...base,
    state:next===null?'FUNCTION_COMPLETION_REVIEWABLE':
      'NEXT_FUNCTION_STEP_REVIEWABLE',
    lastValidStage:checkpoint.stage,
    sourceEvidenceRef:source.evidenceRef,
    approvalEvidenceRef:approval.evidenceRef,
    checkpointEvidenceRef:checkpoint.evidenceRef,
    nextEvidence:'OWNER_VERIFY_EVIDENCE_AND_EXISTING_APPROVALS',
    nextFunctionStep:next,
  });
}

// Only the original control Issue number is an unconstrained locator in this
// bridge. readAndReviewOwnerReturn requires complete authenticated GitHub IO.
// Function/PC evidence is independently supplied and must still be read back.
export async function readAndReviewOwnerNextStep({
  originIssueNumber,io,sourceEvidence,approvalEvidence,lastValidCheckpoint,
}={}) {
  const returnReview=await readAndReviewOwnerReturn({originIssueNumber,io});
  return reviewOwnerNextStep({
    returnReview,sourceEvidence,approvalEvidence,lastValidCheckpoint,
  });
}

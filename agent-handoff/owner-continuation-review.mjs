// Read-only advisory for the original function owner after a central result return.
// A verified GitHub PR/CI receipt is NOT a verified PC runtime checkpoint.
// Owner-plan and source snapshots are external inputs; this code never authenticates
// their PC provenance, grants approval, selects an executable command, or wakes a chat.
import {readAndReviewOwnerReturn} from './owner-return-review.mjs';

const SHA=/^[a-f0-9]{40}$/;
const STEP=/^[a-z][a-z0-9_-]{1,63}$/;
const STATES=new Set(['DONE','READY','BLOCKED','DEFERRED']);
const fail=code=>{throw Object.assign(new Error(code),{code});};
const validRef=x=>typeof x==='string'&&x.length>0&&x.length<=512&&
  !/[\r\n\x00-\x1f]/.test(x);
const base=review=>({
  originIssue:review.originIssue,
  returnState:review.state,
  lastKnownHandoffCheckpoint:review.lastKnownCheckpoint??null,
  ownerChatReceived:'UNKNOWN',
  ownerCheckpointAuthenticated:false,
  ownerSourceAuthenticated:false,
  runtimeVerified:false,
  approvalVerified:false,
  executionAuthorized:false,
  operationalWrites:0,
  automaticPcRetries:0,
});
const result=(review,state,fields={})=>Object.freeze({
  ...base(review),state,...fields,
});

// The owner supplies the ordered, function-specific stages and their real
// evidence references. Do not substitute a generic workflow or a handoff
// checkpoint ('OTHER', etc.) for that owner's last completed feature stage.
export function reviewOwnerContinuation({returnReview,ownerPlan,sourceReadback}={}){
  if(!returnReview||!Number.isSafeInteger(returnReview.originIssue)||
     returnReview.originIssue<1||!['NO_RETURNED_RESULT',
       'RETURN_EVIDENCE_REVIEWABLE'].includes(returnReview.state))
    fail('OWNER_RESUME_RETURN_INVALID');

  if(returnReview.state==='NO_RETURNED_RESULT')
    return result(returnReview,'NO_CENTRAL_RETURN',{
      nextAction:'CONTINUE_INDEPENDENT_OWNER_WORK',
      candidateNextStep:null,lastClaimedDoneStep:null,
    });

  if(!ownerPlan)return result(returnReview,'OWNER_PLAN_EVIDENCE_REQUIRED',{
    nextAction:'READ_LAST_VALID_OWNER_CHECKPOINT',
    candidateNextStep:null,lastClaimedDoneStep:null,
  });

  if(ownerPlan.originIssue!==returnReview.originIssue||
     !Array.isArray(ownerPlan.steps)||ownerPlan.steps.length<1||
     ownerPlan.steps.length>24)
    fail('OWNER_RESUME_PLAN_INVALID');

  const ids=new Set();
  let lastDone=null,candidate=null,nonDoneSeen=false;
  for(const step of ownerPlan.steps){
    if(!step||typeof step!=='object'||Array.isArray(step)||
       typeof step.id!=='string'||!STEP.test(step.id)||
       ids.has(step.id)||!STATES.has(step.status))
      fail('OWNER_RESUME_STEP_INVALID');
    ids.add(step.id);
    if(step.status==='DONE'){
      // A DONE stage must cite its own saved/runtime result; a claim alone is
      // not a completed checkpoint. Provenance still requires owner verification.
      if(nonDoneSeen)fail('OWNER_RESUME_NONCONTIGUOUS_DONE');
      if(!validRef(step.evidenceRef)||!SHA.test(step.sourceSha||''))
        fail('OWNER_RESUME_DONE_EVIDENCE_MISSING');
      lastDone=step;
    }else{
      nonDoneSeen=true;
      if(!candidate)candidate=step;
    }
  }
  const selected={
    candidateNextStep:candidate?.id??null,
    lastClaimedDoneStep:lastDone?.id??null,
    lastClaimedDoneEvidence:lastDone?.evidenceRef??null,
    nextAction:'OWNER_REVIEW_FUNCTION_EVIDENCE',
  };

  if(!sourceReadback)
    return result(returnReview,'OWNER_SOURCE_EVIDENCE_REQUIRED',selected);
  if(sourceReadback.originIssue!==returnReview.originIssue||
     !SHA.test(sourceReadback.currentSourceSha||'')||
     !SHA.test(sourceReadback.approvedSourceSha||'')||
     !validRef(sourceReadback.sourceEvidenceRef)||
     !validRef(sourceReadback.approvalEvidenceRef))
    fail('OWNER_RESUME_SOURCE_INPUT_INVALID');

  if(sourceReadback.currentSourceSha!==sourceReadback.approvedSourceSha)
    return result(returnReview,'OWNER_SOURCE_PAIR_REVIEW_REQUIRED',{
      ...selected,currentSourceSha:sourceReadback.currentSourceSha,
      approvedSourceSha:sourceReadback.approvedSourceSha,
      nextAction:'RECONCILE_CURRENT_SOURCE_AND_APPROVAL',
    });

  // An older but valid checkpoint is preserved; its source change demands
  // feature-specific impact review, never automatic deletion or reexecution.
  if(lastDone&&lastDone.sourceSha!==sourceReadback.currentSourceSha)
    return result(returnReview,'OWNER_CHECKPOINT_IMPACT_REVIEW_REQUIRED',{
      ...selected,currentSourceSha:sourceReadback.currentSourceSha,
      nextAction:'REVIEW_CHECKPOINT_SOURCE_IMPACT',
    });

  if(!candidate)return result(returnReview,'OWNER_PLAN_DONE_CLAIMED',{
    ...selected,currentSourceSha:sourceReadback.currentSourceSha,
    nextAction:'VERIFY_FINAL_RUNTIME_AND_PUBLIC_OUTPUT',
  });

  if(candidate.status==='BLOCKED'||candidate.status==='DEFERRED')
    return result(returnReview,'OWNER_NEXT_STEP_NOT_READY',{
      ...selected,currentSourceSha:sourceReadback.currentSourceSha,
      candidateStatus:candidate.status,
      nextAction:'REVIEW_STEP_SPECIFIC_CONDITION',
    });

  return result(returnReview,'OWNER_NEXT_STEP_REVIEWABLE',{
    ...selected,currentSourceSha:sourceReadback.currentSourceSha,
    candidateStatus:candidate.status,
    nextAction:'OWNER_VALIDATE_APPROVAL_AND_RUNTIME_BEFORE_EXECUTION',
  });
}

// IO must be the already-authorized, complete authenticated GitHub adapter.
// This wrapper only joins the two read-only reviews. It does NOT fetch
// current Windows state or attest owner-supplied checkpoint/source evidence.
export async function readAndReviewOwnerContinuation({
  originIssueNumber,io,ownerPlan,sourceReadback,
}={}){
  const returnReview=await readAndReviewOwnerReturn({originIssueNumber,io});
  return reviewOwnerContinuation({returnReview,ownerPlan,sourceReadback});
}

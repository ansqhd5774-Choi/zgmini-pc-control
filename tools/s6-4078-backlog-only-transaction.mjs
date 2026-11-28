// Fixed #4078 backlog replay coordinator for the independent approved maintainer.
// No default IO ports, CLI, GitHub credentials or standalone approval authority.
// The existing B/C owner must supply independently authenticated, CAS-protected ports.
import {FIXED,inspectS64078PinnedReadback} from './s6-4078-backlog-only-plan.mjs';

const BLOCK=code=>({status:'BLOCKED',code,originalIssueNumber:FIXED.originalIssue,
 replayIssueNumber:null,operationalSuccess:false});
const UNKNOWN=(code,phase)=>({status:'RECOVERY_REQUIRED',code,phase,
 originalIssueNumber:FIXED.originalIssue,replayIssueNumber:null,
 operationalSuccess:false,next:'READ_ORIGINAL_CLAIM_AND_REPLAY_LEDGER_NO_RETRY'});
const required=['readEvidence','verifyIndependentAuthority','acquireExclusiveClaim',
 'assertClaimOwned','writePostingCas','postExactOriginal','readPostedIssue',
 'writeDoneCas','archiveClaim'];
const exactApproval=a=>a?.authorized===true&&
 a.effect==='S6_4078_BACKLOG_ONLY_REPLAY'&&
 a.s6RequestId===FIXED.s6RequestId&&
 a.originalIssueNumber===FIXED.originalIssue&&
 a.originalRequestId===FIXED.originalRequestId&&
 a.originalBodySha256===FIXED.originalBodySha256&&
 a.independentWindowsOperator===true&&
 a.originalClaimAndLeasePreserved===true&&
 typeof a.approvalSourceSha==='string'&&/^[0-9a-f]{40}$/.test(a.approvalSourceSha);

/**
 * The caller must implement durable CAS before returning from writePostingCas.
 * A POSTING marker survives all exceptions, including unknown GitHub POST
 * outcomes. Never erase it and never retry this transaction automatically.
 * No result here claims that a PC job ran or that a JSON/TXT pair exists.
 */
export async function executeApprovedS64078Replay(ports={}){
 if(required.some(k=>typeof ports[k]!=='function'))
  return BLOCK('S6_4078_INDEPENDENT_PORT_UNAVAILABLE');
 let before,approval;
 try{
  before=await ports.readEvidence();
  const pre=inspectS64078PinnedReadback(before);
  if(pre.status!=='SOURCE_PREFLIGHT_ELIGIBLE')return pre;
  approval=await ports.verifyIndependentAuthority(before,pre);
  if(!exactApproval(approval))return BLOCK('S6_4078_APPROVED_EFFECT_UNVERIFIED');
 }catch{return BLOCK('S6_4078_PRE_EFFECT_READBACK_UNKNOWN');}
 let phase='CLAIM_ATTEMPT',claim;
 try{
  claim=await ports.acquireExclusiveClaim({
   s6RequestId:FIXED.s6RequestId,originalIssueNumber:FIXED.originalIssue,
   approvalSourceSha:approval.approvalSourceSha
  });
  if(typeof claim?.nonce!=='string'||!/^[0-9a-f-]{36}$/.test(claim.nonce))
   throw Error('S6_4078_CLAIM_UNVERIFIED');
  phase='CLAIM_ACQUIRED';
  await ports.assertClaimOwned(claim);
  const fresh=await ports.readEvidence();
  const freshPlan=inspectS64078PinnedReadback(fresh);
  if(freshPlan.status!=='SOURCE_PREFLIGHT_ELIGIBLE')throw Error('S6_4078_EVIDENCE_CHANGED');
  if(freshPlan.backlogSha256!==before.localReadback.backlogSha256||
     freshPlan.journalSha256!==before.localReadback.journalSha256||
     fresh.originalIssue.body!==before.originalIssue.body||
     fresh.s6Issue.body!==before.s6Issue.body||
     fresh.s6Issue.state!==before.s6Issue.state||
     fresh.s6Issue.state_reason!==before.s6Issue.state_reason)
   throw Error('S6_4078_EVIDENCE_CHANGED');
  const freshApproval=await ports.verifyIndependentAuthority(fresh,freshPlan);
  if(!exactApproval(freshApproval)||
     freshApproval.approvalSourceSha!==approval.approvalSourceSha)
   throw Error('S6_4078_APPROVAL_CHANGED');
  await ports.assertClaimOwned(claim);
  // Durable intent is written *before* any GitHub API POST. If this write's
  // return is uncertain, preserving the claim prevents a second attempt.
  phase='POSTING_ATTEMPT';
  // Preserve the common Public replay ledger contract (#4334/#4335).
  // A later pause must recognize exactly this dispatch, not treat it as
  // another original. POSTING also retains evidence when POST ACK is lost.
  const marker={status:'POSTING',publicReplay:true,postingAt:new Date().toISOString(),
   originalRequestId:FIXED.originalRequestId,
   originalBodySha256:FIXED.originalBodySha256,
   originalIssueNumber:FIXED.originalIssue};
  await ports.writePostingCas({claim,
   expectedBacklogSha256:freshPlan.backlogSha256,
   expectedJournalSha256:freshPlan.journalSha256,marker});
  phase='POSTING_DURABLE';
  await ports.assertClaimOwned(claim);
  // The adapter must bind the POST to the same authenticated GitHub account.
  // Do not reconstruct or normalize the original issue body.
  phase='GITHUB_POST_ATTEMPT';
  const posted=await ports.postExactOriginal({claim,
   // Public A intake on the control repository requires the exact pc-job title.
   title:'pc-job',
   body:fresh.originalIssue.body,labels:['pc-job'],
   originalIssueNumber:FIXED.originalIssue,
   originalRequestId:FIXED.originalRequestId});
  if(!Number.isSafeInteger(posted?.number)||posted.number<=FIXED.originalIssue)
   throw Error('S6_4078_REPLAY_ISSUE_UNVERIFIED');
  phase='REPLAY_ISSUE_CREATED';
  await ports.assertClaimOwned(claim);
  // A successful POST response with only an issue number is not provenance.
  // Read back this *exact* Issue, rather than searching another request or
  // trusting an uncoupled workflow run to prove an issue body was preserved.
  phase='POSTED_ISSUE_READBACK_ATTEMPT';
  const actual=await ports.readPostedIssue({claim,number:posted.number});
  if(actual?.number!==posted.number||actual?.title!=='pc-job'||
     actual?.body!==fresh.originalIssue.body||
     actual?.state!=='open'||actual?.user?.login!=='ansqhd5774-Choi'||
     actual?.user?.id!==327938088||!Number.isFinite(Date.parse(actual?.created_at))||
     Date.parse(actual.created_at)<Date.parse(marker.postingAt)-2000||
     actual?.pull_request||
     !Array.isArray(actual.labels)||
     !actual.labels.some(label=>(typeof label==='string'?label:label?.name)==='pc-job'))
   throw Error('S6_4078_POSTED_ISSUE_MISMATCH');
  await ports.assertClaimOwned(claim);
  phase='DONE_CAS_ATTEMPT';
  await ports.writeDoneCas({claim,originalIssueNumber:FIXED.originalIssue,
   originalRequestId:FIXED.originalRequestId,
   expectedStatus:'POSTING',replayIssueNumber:posted.number,
   expectedMarker:marker,doneMarker:{...marker,status:'DONE',replayIssueNumber:posted.number}});
  phase='DISPATCH_RECORDED';
  await ports.archiveClaim(claim);
  return {status:'DISPATCH_RECORDED',code:'S6_4078_REPLAY_ISSUE_POSTED',
   originalIssueNumber:FIXED.originalIssue,replayIssueNumber:posted.number,
   operationalSuccess:false,
   next:'VERIFY_EXACT_ACTIONS_RUN_AND_PC_RESULT_PAIR'};
 }catch{
  // Even CLAIM_ATTEMPT is uncertain: never hide a possibly written claim.
  return UNKNOWN('S6_4078_REPLAY_OUTCOME_UNKNOWN_NO_RETRY',phase);
 }
}

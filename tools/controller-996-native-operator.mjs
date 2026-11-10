// #996 fixed-scope original Windows C recovery coordinator. NO CLI.
// This is an UNDEPLOYED source candidate. No method is invoked on import.
// The real path authenticates the owner GitHub consent and physical reads
// before the first write. A failed/uncertain write NEVER retries or rolls back.
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {RECOVERY_996} from './controller-996-c-transaction.mjs';
import {create996NativeGitHubReadOnly} from './controller-996-native-github-readonly.mjs';
import {create996NativeConsentReader} from './controller-996-native-consent-reader.mjs';
import {review996NativeApprovalReadiness} from './controller-996-native-approval-readiness.mjs';
import {create996NativeFreshPreflight,create996NativeOwnedClaimPreflight}
 from './controller-996-native-fresh-preflight.mjs';
import {create996NativeClaimStore} from './controller-996-native-claims.mjs';
import {create996NativeWorkflowGateway} from './controller-996-native-workflow.mjs';
import {create996NativeCooperativeWriterGate} from './controller-996-native-writer-gate.mjs';
import {create996NativeBacklogGate} from './controller-996-native-backlog.mjs';
import {read996OriginalBacklogEvidence} from './controller-996-backlog-readback.mjs';
import {create996NativePostcheck} from './controller-996-native-postcheck.mjs';
import {collect996ProtectedItems} from './controller-996-protection-attestation.mjs';
import {review996ProtectedR2Evidence} from './controller-996-r2-evidence-review.mjs';

const REQ=RECOVERY_996.requestId;
const ORIGINAL_OWNER_SHA='d6329b4d82530f9a1ca574647f050fff9243b698bb9dd314975b19ed171e40bc';
const RECOVERY_MARKER_SHA='4dc51f7e3a1cd84ce94ddf993e4a1cfbb319b050447dfbb5ccf0c38434a0b09b';
const BACKLOG_ORIGINAL_SHA='d48698b6bfe152fdcbea5adf582364334dc8633742cce02e6a1299718304a780';
const FP='877bcd2a2abbf34452c09fc96a15b28d0309a32b45687f8dace37ae5e29abb86';
const APPROVAL='READONLY_APPROVAL_AND_R1_R2_CONTRACT_REVIEWED';
const POSTCHECK='READONLY_PHASE_PHYSICAL_STATE_MATCHES_PINNED';
const IDENTITY='ansqhd5774-Choi';
const REPO='ansqhd5774-Choi/zgmini-pc-control';
const SHA40=/^[a-f0-9]{40}$/;
const SHA64=/^[a-f0-9]{64}$/;
const need=(ok,code)=>{if(!ok)throw Object.assign(Error(code),{code});};
const hash=v=>createHash('sha256').update(v).digest('hex');
const failure=(code,step,attempts,claimAttempted)=>Object.freeze({
 schema:'ZGMINI_CONTROLLER_996_NATIVE_OPERATOR_V1',
 status:!claimAttempted?'C_NOT_STARTED':
  attempts.ownClaimArchiveAttempts>0?
   'STATE_UNKNOWN_CHECK_ARCHIVED_C_CLAIM':
   attempts.originalLeaseArchiveAttempts>0?
    'STATE_UNKNOWN_CHECK_ARCHIVED_ORIGINAL_LEASE':
   'STATE_UNKNOWN_PRESERVE_C_CLAIM_AND_ORIGINAL_LEASE',
 code,failedStep:step,requestId:REQ,originalIssue:996,
 retryAuthorized:false,claimMayExist:claimAttempted,
 originalLeaseMayBeArchived:attempts.originalLeaseArchiveAttempts>0,
 ownClaimMayBeArchived:attempts.ownClaimArchiveAttempts>0,
 ...attempts,controllerInstalls:0,originalPcJobRetries:0,issuePosts:0,
});
const positive=(result,status,code)=>need(result?.status===status,code);
const safeCode=e=>/^[A-Z0-9_]{4,100}$/.test(e?.code??'')?
 e.code:'C_NATIVE_STAGE_OUTCOME_UNKNOWN';

function createOriginalBindings(){
 const github=create996NativeGitHubReadOnly();
 const consent=create996NativeConsentReader({githubReader:github});
 const claim=create996NativeClaimStore();
 const workflow=create996NativeWorkflowGateway({claimStore:claim});
 const writer=create996NativeCooperativeWriterGate({claimStore:claim});
 const backlog=create996NativeBacklogGate({claimStore:claim,
  workflowGateway:workflow,
  proveExclusiveWriter:args=>writer.proveExclusiveWriter(args)});
 const preflight=create996NativeFreshPreflight();
 const ownedPreflight=create996NativeOwnedClaimPreflight({claimStore:claim});
 const postcheck=create996NativePostcheck();
 return Object.freeze({
  approval({manifestCommitSha,originalObservation,protectedObservation}){
   const evidence=consent.readOnce({manifestCommitSha});
   return review996NativeApprovalReadiness({originalObservation,
    protectedObservation,ownerConsentEvidence:evidence});
  },
  fresh:()=>preflight.read(),
  reserveClaim:()=>claim.reserveClaim(),
  ownedFresh:()=>ownedPreflight.read(),
  record:(name,details)=>claim.recordOnce(name,details),
  prepareWorkflow:()=>workflow.prepareEnableIntent(),
  beforeWorkflowPut(){
   // A NEW authentication round, current protected Task/Writer read and
   // disabled Workflow read are required after the durable intent and
   // immediately before the only PUT. No "signed boolean" substitute.
   const read=create996NativeGitHubReadOnly();
   const auth=read.authenticateReadOnly();
   need(auth.actor===IDENTITY&&auth.repository===REPO&&
    auth.private===true,'C_OPERATOR_GITHUB_IDENTITY_DRIFT');
   // The installed 7 cooperating Writer sources and the still-open
   // original backlog must be pinned BEFORE re-enabling admission. A
   // later guard just before backlog rename remains independently required.
   const owner=claim.ownClaimReadback();
   need(writer.proveExclusiveWriter({requestId:REQ,
    ownerNonce:owner.nonce})===true,
    'C_OPERATOR_PRE_PUT_WRITER_SOURCE_UNVERIFIED');
   const r2=review996ProtectedR2Evidence(collect996ProtectedItems());
   need(r2.status==='CURRENT_PROTECTION_MATCHES_R1'&&
    r2.protectedFingerprint===FP&&r2.enabledTasks===2,
    'C_OPERATOR_PRE_PUT_PROTECTED_DRIFT');
   need(workflow.readState()==='disabled_manually',
    'C_OPERATOR_PRE_PUT_WORKFLOW_DRIFT');
   return true;
  },
  enableWorkflow:ticket=>workflow.enableOnce(ticket),
  verifyWorkflow:()=>workflow.verifyActiveReadback(),
  closeBacklog:()=>backlog.closeOnce(),
  async originalDispositions(nextSha){
   const closed=backlog.readClosed(nextSha);
   // Re-authenticate the GitHub origin after the one-shot Workflow PUT:
   // the earlier approval session is not proof of current caller identity.
   const read=create996NativeGitHubReadOnly();
   const auth=read.authenticateReadOnly();
   need(auth.actor===IDENTITY&&auth.repository===REPO&&auth.private===true,
    'C_OPERATOR_POST_PUT_GITHUB_ORIGIN_UNVERIFIED');
   return read996OriginalBacklogEvidence({api:route=>read.get(route),
    pausedAt:closed.pausedAt,resumedAt:closed.resumedAt,
    replays:closed.replays});
  },
  postcheck:phase=>postcheck.inspect({phase}),
  archiveOriginal:()=>claim.archiveOriginalLease({
   ownerSha:ORIGINAL_OWNER_SHA,recoveryMarkerSha:RECOVERY_MARKER_SHA}),
  archiveOwn:()=>claim.archiveOwnClaim(),
 });
}

function summarizeReconciliation(data){
 positive(data,'READONLY_RESULTS_RECONCILED',
  'C_OPERATOR_ORIGINAL_DISPOSITIONS_UNVERIFIED');
 need(data.listingComplete===true&&data.commentsComplete===true&&
  data.issueScans===2&&data.issuePosts===0&&data.pcRetries===0&&
  Array.isArray(data.entries)&&data.originalIssueCount===data.entries.length,
  'C_OPERATOR_DISPOSITION_COVERAGE_UNVERIFIED');
 const rows=[],ids=new Set();
 for(const entry of data.entries){
  need(Number.isSafeInteger(entry?.originIssue)&&entry.originIssue>0&&
   !ids.has(entry.originIssue)&&entry.requestId&&
   typeof entry.disposition==='string'&&
   typeof entry.verification?.status==='string',
   'C_OPERATOR_DISPOSITION_IDENTITY_UNVERIFIED');
  ids.add(entry.originIssue);
  rows.push({issue:entry.originIssue,requestId:entry.requestId,
   disposition:entry.disposition,
   verification:entry.verification.status,
   resultStatus:entry.verification.resultStatus??null,
   resultCode:entry.verification.resultCode??null,
   summaryOnly:entry.verification.summaryOnly??null});
 }
 const verifiedPass=rows.filter(r=>r.verification==='RESULT_PAIR_VERIFIED'&&
  r.resultStatus==='PASS'&&r.summaryOnly!==true).length;
 const summary=Object.freeze({originalIssueCount:rows.length,
  verifiedPass,ownerReplanRequired:rows.length-verifiedPass,
  dispositionSha256:hash(Buffer.from(JSON.stringify(rows)))});
 return summary;
}

/** A real call requires the original Windows and internally constructed
 * native ports. Test ports are available ONLY under an isolated Linux temp
 * root. This function does not provide any command-line entry point. */
export function create996NativeOperator({testOnly=false,
 testRoot=null,bindings=null}={}){
 if(testOnly){
  need(process.platform!=='win32'&&typeof testRoot==='string'&&
   path.isAbsolute(testRoot)&&
   path.resolve(testRoot).startsWith(path.resolve(os.tmpdir())+path.sep)&&
   path.basename(testRoot).startsWith('zgmini-996-test-')&&bindings,
   'C_OPERATOR_TEST_PORT_REJECTED');
 }else{
  need(process.platform==='win32'&&!process.env.GITHUB_ACTIONS&&
   !process.env.RUNNER_NAME&&testRoot===null&&bindings===null,
   'C_OPERATOR_ORIGINAL_WINDOWS_ONLY');
 }
 const ports=testOnly?bindings:createOriginalBindings();
 const methods=['approval','fresh','reserveClaim','ownedFresh','record',
  'prepareWorkflow','beforeWorkflowPut','enableWorkflow','verifyWorkflow',
  'closeBacklog','originalDispositions','postcheck','archiveOriginal','archiveOwn'];
 need(methods.every(k=>typeof ports[k]==='function'),
  'C_OPERATOR_NATIVE_PORTS_MISSING');
 let spent=false;
 return Object.freeze({
  async run({manifestCommitSha,originalObservation,protectedObservation}={}){
   const attempts={workflowPutAttempts:0,backlogCloseAttempts:0,
    originalLeaseArchiveAttempts:0,ownClaimArchiveAttempts:0};
   if(spent)return failure('C_OPERATOR_ALREADY_ATTEMPTED','START',attempts,false);
   spent=true; // no repeat even if the first preflight was interrupted
   let step='APPROVAL',claimAttempted=false;
   try{
    need(SHA40.test(manifestCommitSha),
     'C_OPERATOR_PINNED_APPROVAL_COMMIT_REQUIRED');
    const ready=await ports.approval({manifestCommitSha,originalObservation,
     protectedObservation});
    positive(ready,APPROVAL,'C_OPERATOR_OWNER_CONSENT_UNVERIFIED');
    need(SHA64.test(ready.manifestSha256)&&
     ready.manifestCommitSha===manifestCommitSha&&
     ready.originalRequestId===REQ&&
     ready.protectedFingerprint===FP&&
     ready.executionAuthorized===false,
     'C_OPERATOR_APPROVAL_IDENTITY_INVALID');
    step='FRESH_PREFLIGHT';
    const fresh=await ports.fresh();
    positive(fresh,'FRESH_ORIGINAL_WINDOWS_R1_R2_MATCH_PINNED',
     'C_OPERATOR_FRESH_READBACK_UNVERIFIED');
    need(fresh.rawDigestsVerified===7&&fresh.checksVerified===16&&
     fresh.protectedFingerprint===FP&&fresh.protectedTasksEnabled===2,
     'C_OPERATOR_FRESH_EVIDENCE_INCOMPLETE');
    step='RESERVE_C_CLAIM';claimAttempted=true;
    const claim=await ports.reserveClaim();
    need(claim?.requestId===REQ&&claim.issueNumber===996&&
     claim.pid===process.pid&&typeof claim.nonce==='string'&&
     /^[a-zA-Z0-9-]{1,80}$/.test(claim.nonce),
     'C_OPERATOR_OWN_CLAIM_NOT_RESERVED');
    step='OWNED_CLAIM_PREFLIGHT';
    const ownFresh=await ports.ownedFresh();
    positive(ownFresh,
     'FRESH_OWN_CLAIM_R1_R2_MATCH_PINNED',
     'C_OPERATOR_OWN_CLAIM_READBACK_UNVERIFIED');
    need(ownFresh.ownCClaimVerified===true&&
     ownFresh.protectedFingerprint===FP,
     'C_OPERATOR_OWN_CLAIM_OWNER_DRIFT');
    step='PREPARED_MARKER';
    need(SHA64.test(await ports.record('PREPARED',{
     manifestSha256:ready.manifestSha256,manifestCommitSha,
     evidenceFingerprint:FP,ownerNonce:claim.nonce})),
     'C_OPERATOR_PREPARED_MARKER_UNVERIFIED');
    step='WORKFLOW_ENABLE_INTENT';
    const ticket=await ports.prepareWorkflow();
    need(ticket&&typeof ticket==='object',
     'C_OPERATOR_WORKFLOW_TICKET_MISSING');
    step='PRE_PUT_REVALIDATION';
    need(await ports.beforeWorkflowPut()===true,
     'C_OPERATOR_PRE_PUT_REVALIDATION_UNVERIFIED');
    step='WORKFLOW_ENABLE_ONCE';attempts.workflowPutAttempts++;
    need(await ports.enableWorkflow(ticket)===true,
     'C_OPERATOR_WORKFLOW_PUT_ACK_UNVERIFIED');
    step='WORKFLOW_ACTIVE_READBACK';
    need(await ports.verifyWorkflow()===true,
     'C_OPERATOR_WORKFLOW_ACTIVE_UNVERIFIED');
    step='BACKLOG_CLOSE_ONCE';attempts.backlogCloseAttempts++;
    const closed=await ports.closeBacklog();
    need(closed?.originalSha===BACKLOG_ORIGINAL_SHA&&
     SHA64.test(closed.nextSha)&&
     Number.isFinite(Date.parse(closed.resumeAt)),
     'C_OPERATOR_BACKLOG_CLOSE_UNVERIFIED');
    step='ORIGINAL_JOB_DISPOSITIONS';
    const dispositions=summarizeReconciliation(
     await ports.originalDispositions(closed.nextSha));
    step='BACKLOG_PHASE_POSTCHECK';
    const post=await ports.postcheck('BACKLOG_CLOSED');
    positive(post,POSTCHECK,'C_OPERATOR_BACKLOG_POSTCHECK_FAILED');
    need(post.phase==='BACKLOG_CLOSED'&&
     post.originalLeaseArchived===false&&post.ownClaimArchived===false&&
     post.backlogSha256===closed.nextSha,
     'C_OPERATOR_BACKLOG_POSTCHECK_SHA_DRIFT');
    step='PRE_ARCHIVE_MARKER';
    need(SHA64.test(await ports.record('PRE_ARCHIVE',{...dispositions,
     backlogSha256:closed.nextSha,ownerNonce:claim.nonce})),
     'C_OPERATOR_PRE_ARCHIVE_MARKER_UNVERIFIED');
    step='ORIGINAL_LEASE_ARCHIVE_INTENT';
    need(SHA64.test(await ports.record('ORIGINAL_LEASE_ARCHIVE_ATTEMPTED',{
     ownerSha256:ORIGINAL_OWNER_SHA,recoveryMarkerSha256:RECOVERY_MARKER_SHA,
     ownerNonce:claim.nonce})),
     'C_OPERATOR_ORIGINAL_LEASE_INTENT_UNVERIFIED');
    step='ORIGINAL_LEASE_ARCHIVE_ONCE';attempts.originalLeaseArchiveAttempts++;
    need(await ports.archiveOriginal()===true,
     'C_OPERATOR_ORIGINAL_LEASE_ARCHIVE_UNVERIFIED');
    step='ORIGINAL_LEASE_POSTCHECK';
    const archived=await ports.postcheck('ORIGINAL_LEASE_ARCHIVED');
    positive(archived,POSTCHECK,
     'C_OPERATOR_ORIGINAL_LEASE_POSTCHECK_FAILED');
    need(archived.phase==='ORIGINAL_LEASE_ARCHIVED'&&
     archived.originalLeaseArchived===true&&
     archived.ownClaimArchived===false&&archived.backlogSha256===closed.nextSha,
     'C_OPERATOR_ORIGINAL_LEASE_STATE_DRIFT');
    step='COMPLETE_MARKER';
    need(SHA64.test(await ports.record('COMPLETE',{
     status:'INTAKE_RECOVERED_ORIGINAL_INSTALL_ABORTED',
     ...dispositions,backlogSha256:closed.nextSha})),
     'C_OPERATOR_COMPLETE_MARKER_UNVERIFIED');
    step='OWN_CLAIM_ARCHIVE_INTENT';
    need(SHA64.test(await ports.record('OWN_CLAIM_ARCHIVE_ATTEMPTED',
     {ownerNonce:claim.nonce})),
     'C_OPERATOR_OWN_CLAIM_INTENT_UNVERIFIED');
    step='OWN_CLAIM_ARCHIVE_ONCE';attempts.ownClaimArchiveAttempts++;
    need(await ports.archiveOwn()===true,
     'C_OPERATOR_OWN_CLAIM_ARCHIVE_UNVERIFIED');
    step='FINAL_INDEPENDENT_POSTCHECK';
    const final=await ports.postcheck('FINAL_ARCHIVED');
    positive(final,POSTCHECK,'C_OPERATOR_FINAL_POSTCHECK_FAILED');
    need(final.phase==='FINAL_ARCHIVED'&&
     final.originalLeaseArchived===true&&final.ownClaimArchived===true&&
     final.backlogSha256===closed.nextSha,
     'C_OPERATOR_FINAL_STATE_NOT_VERIFIED');
    return Object.freeze({schema:'ZGMINI_CONTROLLER_996_NATIVE_OPERATOR_V1',
     status:testOnly?'SIMULATED_NATIVE_OPERATOR_SEQUENCE':
      'C_NATIVE_RECOVERY_PHYSICALLY_VERIFIED',
     code:testOnly?'NO_REAL_WINDOWS_EFFECT':
      'ORIGINAL_JOBS_OWNER_REPLAN_SEPARATE',
     requestId:REQ,originalIssue:996,
     completionRecordStatus:'INTAKE_RECOVERED_ORIGINAL_INSTALL_ABORTED',
     ...dispositions,...attempts,controllerInstalls:0,
     originalPcJobRetries:0,issuePosts:0,retryAuthorized:false,
     postcheckContractPassed:true,physicalPostcheckVerified:!testOnly,
     simulated:testOnly,
     originalJobStatusesAllPass:dispositions.ownerReplanRequired===0});
   }catch(e){
    return failure(safeCode(e),step,attempts,claimAttempted);
   }
  },
 });
}

// #4078 S6 intake pause: immutable, source-only evidence gate.
// This module deliberately has no mutation or execution path.
import {createHash} from 'node:crypto';
export const FIXED=Object.freeze({
 originalIssue:4078,s6Issue:4069,
 originalRequestId:'pc-usbreadthr2-resource-window-20261127-01',
 s6RequestId:'pc-s6-63afb126-72dc-4ec5-a721-4819771fa9ee',
 originalCreatedAt:'2026-11-26T19:14:52Z',
 originalBodySha256:'ebacec26ec6477d49bfc598e5f87116fe44d202c33479601ef7acc4b0ad7f8d7',
 s6BodySha256:'cc4e478d06f00c9b7dd8a80f81108e70c50ebae2559a0d188dd515e493bef6f9'
});
const sha=b=>createHash('sha256').update(b).digest('hex');
const blocked=code=>({status:'BLOCKED',code,mutationAuthorized:false,operationalWrites:0});
export function inspectS64078BacklogOnly(e){
 if(e?.s6Issue?.number!==FIXED.s6Issue||e.s6Issue.state!=='open'||
    e.s6Issue.user?.login!=='ansqhd5774-Choi')
  return blocked('S6_ORIGINAL_ISSUE_UNVERIFIED');
 if(typeof e.s6Issue.body!=='string'||sha(e.s6Issue.body)!==FIXED.s6BodySha256)
  return blocked('S6_ORIGINAL_BODY_CAS_FAILED');
 let s6;try{s6=JSON.parse(e.s6Issue.body);}catch{return blocked('S6_BODY_INVALID');}
 if(s6.schema!=='ZGMINI_PC_MAINTENANCE_REQUEST_V1'||
    s6.requestId!==FIXED.s6RequestId||s6.operation!=='controller-s6-failover-once')
  return blocked('S6_ORIGINAL_SCOPE_DRIFT');
 const original=e?.originalIssue;
 if(original?.number!==FIXED.originalIssue||original.state!=='open'||
   original.user?.login!=='ansqhd5774-Choi'||
   !original.labels?.some(x=>(typeof x==='string'?x:x.name)==='pc-job')||
   original.created_at!==FIXED.originalCreatedAt||
   typeof original.body!=='string'||sha(original.body)!==FIXED.originalBodySha256)
  return blocked('BACKLOG_4078_ORIGINAL_CAS_FAILED');
 const journal=e?.journal;
 if(journal?.requestId!==FIXED.s6RequestId||
   journal?.phase!=='RECOVERY_REQUIRED'||
   journal?.failedAt!=='WATCHDOG_RELEASE_OUTCOME_UNVERIFIED'||
   journal?.failedCode!=='S6_PORT_PROMOTION_UNVERIFIED')
  return blocked('S6_JOURNAL_PHASE_DRIFT');
 const backlog=e?.backlog;
 if(backlog?.schema!=='ZGMINI_PC_BACKLOG_V1'||
   backlog.requestId!==FIXED.s6RequestId||
   !Array.isArray(backlog.windows)||backlog.windows.length!==1||
   !backlog.replays||typeof backlog.replays!=='object'||
   Array.isArray(backlog.replays)||Object.hasOwn(backlog.replays,'4078'))
  return blocked('S6_BACKLOG_OR_REPLAY_DRIFT');
 const window=backlog.windows[0];
 const start=Date.parse(window?.pausedAt??''),end=Date.parse(window?.resumedAt??'');
 const opened=Date.parse(FIXED.originalCreatedAt);
 if(!Number.isFinite(start)||!Number.isFinite(end)||end<start||
    opened<start-2000||opened>end)
  return blocked('BACKLOG_4078_PAUSE_WINDOW_UNVERIFIED');
 if(e?.workflowState!=='active'||e?.runtimeState!=='HEALTHY'||
    e?.sixRunnersOnline!==true||e?.watchdogReady!==true||
    e?.protectedStateUnchanged!==true)
  return blocked('S6_CURRENT_PROTECTION_UNVERIFIED');
 if(e?.existingPcJobRuns!==0||e?.existingResultPairs!==0||
    e?.existingReplayIssues!==0||e?.resultSearchComplete!==true)
  return blocked('BACKLOG_4078_DUPLICATE_OR_SEARCH_UNKNOWN');
 if(e?.ownerAndLeaseCasVerified!==true||e?.backlogBytesCasVerified!==true||
    e?.s6JournalBytesCasVerified!==true)
  return blocked('S6_ORIGINAL_LOCAL_CAS_UNVERIFIED');
 return {
  status:'SOURCE_PREFLIGHT_ELIGIBLE',code:'S6_4078_BACKLOG_ONLY_CANDIDATE_VERIFIED',
  originalIssueNumber:FIXED.originalIssue,originalRequestId:FIXED.originalRequestId,
  s6IssueNumber:FIXED.s6Issue,originalBodySha256:FIXED.originalBodySha256,
  mutationAuthorized:false,operationalWrites:0,
  next:'SEPARATE_APPROVED_OWNER_BACKLOG_ONLY_EFFECT_REQUIRED'
 };
}

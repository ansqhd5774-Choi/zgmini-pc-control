// Pure, exact-incident B admission. No filesystem and no command execution.
import {INCIDENT_ID,PREPARED_SHA,FINGERPRINT} from './recovery-1063-core.mjs';
import {APPROVAL_SHA256,APPROVAL_FILE} from './recovery-1063-approval.mjs';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA40=/^[0-9a-f]{40}$/;
const need=(ok,code)=>{if(!ok)throw Object.assign(new Error(code),{code});};
export const RECOVERY_TITLE='pc-writer-b-1063-reconcile';
export const RECOVERY_LABEL='pc-writer-b-1063-recovery';
export const RECOVERY_SCHEMA='ZGMINI_PC_WRITER_B_1063_RECOVERY_REQUEST_V1';

export function validateRecoveryEvent(event,env,controlSha){
 need(env.GITHUB_REPOSITORY==='ansqhd5774-Choi/zgmini-pc-control'&&
  env.GITHUB_ACTOR==='ansqhd5774-Choi'&&
  env.GITHUB_EVENT_NAME==='issues'&&
  env.GITHUB_EVENT_ACTION==='opened'&&env.GITHUB_RUN_ATTEMPT==='1'&&
  event.repository?.full_name===env.GITHUB_REPOSITORY&&
  event.repository?.private===true&&
  event.sender?.login===env.GITHUB_ACTOR&&
  event.issue?.user?.login===env.GITHUB_ACTOR&&
  event.issue?.title===RECOVERY_TITLE&&
  event.issue?.labels?.some(x=>x.name===RECOVERY_LABEL)&&
  env.GITHUB_SHA===controlSha&&SHA40.test(controlSha),
  'WRITER_B_1063_EVENT_DENIED');
 let request;try{request=JSON.parse(event.issue.body);}catch{
  throw Object.assign(new Error('WRITER_B_1063_REQUEST_JSON_INVALID'),
   {code:'WRITER_B_1063_REQUEST_JSON_INVALID'});}
 need(request?.schema===RECOVERY_SCHEMA&&
  request.operation==='pc-writer-b-1063-reconcile'&&
  request.incidentRequestId===INCIDENT_ID&&
  UUID.test(request.requestId??'')&&
  request.requestId!==INCIDENT_ID&&
  request.approvedPreparedSha===PREPARED_SHA&&
  request.expectedJournalSha256===FINGERPRINT.journal&&
  request.approvalManifestPath===APPROVAL_FILE&&
  request.approvalManifestSha256===APPROVAL_SHA256&&
  Object.keys(request).sort().join('|')===
   ['approvalManifestPath','approvalManifestSha256','approvedPreparedSha',
    'expectedJournalSha256','incidentRequestId','operation','requestId',
    'schema'].sort().join('|'),
  'WRITER_B_1063_REQUEST_SCOPE_DENIED');
 return request;
}

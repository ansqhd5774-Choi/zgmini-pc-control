// Narrow recovery authority for the W06 Task already claimed by original #3895.
// Reuses the exact committed B approval; never authorizes a new Task or command.
import {readCommittedTaskCreateB} from './trusted-approval.mjs';
import {ISSUE_TITLE,ISSUE_LABEL,REQUEST_SCHEMA} from './contract.mjs';

export const RECOVERY_TITLE='pc-writer-task-recover-once';
export const RECOVERY_SCHEMA='ZGMINI_PC_TASK_RECOVERY_B_REQUEST_V1';
export const RECOVERY_RESULT_SCHEMA='ZGMINI_PC_TASK_RECOVERY_B_RESULT_V1';
export const ORIGIN='ce21eaa3-7768-4cb8-88d9-0911941d966c';
export const APPROVAL_PATH='approvals/task-create-b/w06-cnn-minute-approved-20261126.json';
export const APPROVAL_SHA='946c7f139b2dc0b9361b1d25142dd15db33b446caf48264e30748b18e48ea1e3';
export const DISABLED_XML_SHA='7f8e58d7849f604f8bebfdc1ce7382e40ff5a9e61ffe7ab5853c576f1eabe59d';
const REPO='ansqhd5774-Choi/zgmini-pc-control',OWNER='ansqhd5774-Choi';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const stop=c=>{throw Object.assign(Error(c),{code:c});};
const need=(v,c)=>{if(!v)stop(c);};
const exactKeys=(x,expected)=>x&&typeof x==='object'&&!Array.isArray(x)&&
 Object.keys(x).length===expected.length&&expected.every(k=>Object.hasOwn(x,k));

export function authorizeTaskRecoveryB({event,env,controlRoot,read=readCommittedTaskCreateB}={}){
 const issue=event?.issue;
 need(env?.GITHUB_REPOSITORY===REPO&&env?.GITHUB_EVENT_NAME==='issues'&&
  env.GITHUB_EVENT_ACTION==='opened'&&env.GITHUB_ACTOR===OWNER&&
  env.GITHUB_RUN_ATTEMPT==='1'&&event?.action==='opened'&&
  event.repository?.full_name===REPO&&event.repository.private===true&&
  event.sender?.login===OWNER&&issue?.user?.login===OWNER&&
  issue?.title===RECOVERY_TITLE&&!issue.pull_request&&
  issue.labels?.some(x=>x?.name===ISSUE_LABEL)&&
  Number.isSafeInteger(issue.number)&&issue.number>0,
  'TASK_RECOVERY_B_ORIGIN_STOP');
 let req;
 try{req=JSON.parse(issue.body)}catch{stop('TASK_RECOVERY_B_REQUEST_JSON_STOP')}
 need(exactKeys(req,['schema','requestId','operation','originRequestId',
  'approvalManifestPath','approvalManifestSha256'])&&
  req.schema===RECOVERY_SCHEMA&&req.operation==='recover-existing-disabled-once'&&
  UUID.test(req.requestId??'')&&req.requestId!==ORIGIN&&
  req.originRequestId===ORIGIN&&req.approvalManifestPath===APPROVAL_PATH&&
  req.approvalManifestSha256===APPROVAL_SHA,
  'TASK_RECOVERY_B_EXACT_SCOPE_STOP');
 // The original approval is verified by existing Git provenance, raw SHA and
 // full APPROVED_B effects contract, not by a new/Issue-supplied manifest.
 const originalRequest={schema:REQUEST_SCHEMA,requestId:ORIGIN,
  operation:'task-create-once',approvalManifestPath:APPROVAL_PATH,
  approvalManifestSha256:APPROVAL_SHA};
 const originEvent={...event,issue:{...issue,title:ISSUE_TITLE,
  body:JSON.stringify(originalRequest)}};
 const originalProof=read({event:originEvent,env,controlRoot});
 need(originalProof?.request?.requestId===ORIGIN&&
  originalProof.manifest?.scope==='W06_ONE_TASK_CREATE_AND_ENABLE_WITH_CNN_RUNTIME_EFFECTS',
  'TASK_RECOVERY_B_APPROVAL_STOP');
 return Object.freeze({request:Object.freeze(req),originProof:originalProof});
}

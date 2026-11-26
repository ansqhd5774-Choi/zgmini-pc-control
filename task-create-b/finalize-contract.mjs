// Source-only contract: finish the already ENABLED W06 Task recovery.
// This operation never calls schtasks /Change, /Create, /Delete or providers.
import {createHash} from 'node:crypto';
import {authorizeTaskRecoveryB,RECOVERY_SCHEMA,ORIGIN,
 APPROVAL_PATH,APPROVAL_SHA} from './recovery-contract.mjs';
const REPO='ansqhd5774-Choi/zgmini-pc-control',OWNER='ansqhd5774-Choi';
export const TITLE='pc-writer-task-finalize-once';
export const SCHEMA='ZGMINI_PC_TASK_FINALIZE_B_REQUEST_V1';
export const RESULT_SCHEMA='ZGMINI_PC_TASK_FINALIZE_B_RESULT_V1';
export const RECOVERY_ID='5b012ae0-5a2b-4fb9-92a6-72754de915c3';
export const ENABLED_XML_SHA='c3032991cdd2111fb74e6f319021e4a8a962f64d42d13a224bd37169b8d92f71';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const stop=c=>{throw Object.assign(Error(c),{code:c})};
const need=(v,c)=>{if(!v)stop(c)};
const exact=(x,keys)=>x&&typeof x==='object'&&!Array.isArray(x)&&
 Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
export function authorizeW06Finalize({event,env,controlRoot,read}={}){
 const issue=event?.issue;
 need(env?.GITHUB_REPOSITORY===REPO&&env.GITHUB_EVENT_NAME==='issues'&&
  env.GITHUB_EVENT_ACTION==='opened'&&env.GITHUB_ACTOR===OWNER&&
  env.GITHUB_RUN_ATTEMPT==='1'&&event?.action==='opened'&&
  event.repository?.full_name===REPO&&event.repository.private===true&&
  event.sender?.login===OWNER&&issue?.user?.login===OWNER&&
  issue.title===TITLE&&!issue.pull_request&&Number.isSafeInteger(issue.number)&&
  issue.number>0&&issue.labels?.some(x=>x.name==='pc-writer-b-install'),
  'TASK_FINALIZE_B_ORIGIN_STOP');
 let req;
 try{req=JSON.parse(issue.body)}catch{stop('TASK_FINALIZE_B_BODY_STOP')}
 need(exact(req,['schema','requestId','operation','recoveryRequestId',
  'originalCreateRequestId','approvalManifestPath','approvalManifestSha256'])&&
  req.schema===SCHEMA&&req.operation==='finalize-already-enabled-once'&&
  UUID.test(req.requestId??'')&&req.requestId!==RECOVERY_ID&&
  req.recoveryRequestId===RECOVERY_ID&&req.originalCreateRequestId===ORIGIN&&
  req.approvalManifestPath===APPROVAL_PATH&&req.approvalManifestSha256===APPROVAL_SHA,
  'TASK_FINALIZE_B_EXACT_SCOPE_STOP');
 // Validate the original immutable approved source/effect with the same
 // trusted source reader used for the actual Task B recovery.
 const oldRequest={schema:RECOVERY_SCHEMA,requestId:RECOVERY_ID,
  operation:'recover-existing-disabled-once',originRequestId:ORIGIN,
  approvalManifestPath:APPROVAL_PATH,approvalManifestSha256:APPROVAL_SHA};
 const originalEvent={...event,issue:{...issue,
  title:'pc-writer-task-recover-once',body:JSON.stringify(oldRequest)}};
 const proof=authorizeTaskRecoveryB({event:originalEvent,env,controlRoot,read});
 need(proof.request.requestId===RECOVERY_ID&&
  proof.originProof.manifest.scope==='W06_ONE_TASK_CREATE_AND_ENABLE_WITH_CNN_RUNTIME_EFFECTS',
  'TASK_FINALIZE_B_APPROVAL_STOP');
 return Object.freeze({request:Object.freeze(req),originalProof:proof});
}

export function verifyW06FinalizationReady(x,m){
 need(x?.taskPresent===true&&x.taskXmlSha256===ENABLED_XML_SHA&&
  x.wrapperExact===true&&x.originalJournalExact===true&&
  x.originalOwnerLockExact===true&&x.originalBackupsMatch===true&&
  x.savedCandidateExact===true&&x.protectedUnchanged===true&&
  x.disabledTaskExact===false&&x.enabledTaskExact===true&&
  x.installedSourceSha===m.installedSourceSha&&
  x.configSourceSha===m.installedSourceSha&&
  x.sidecarSourceSha256===m.sidecarSourceSha256&&
  x.coreTaskXmlSha256===m.coreTaskXmlSha256,
  'TASK_FINALIZE_B_PREIMAGE_CAS_STOP');
 return true;
}
export async function applyW06Finalization(proof,io){
 const m=proof?.originalProof?.originProof?.manifest;
 const req=proof?.request;
 need(m&&req&&io&&['snapshot','claimOnce','finishOnce','readback'].every(k=>
  typeof io[k]==='function'),'TASK_FINALIZE_B_PORT_STOP');
 const base={schema:RESULT_SCHEMA,requestId:req.requestId,
  recoveryRequestId:RECOVERY_ID,originalCreateRequestId:ORIGIN,
  status:'TASK_FINALIZE_B_STATE_UNKNOWN',code:'TASK_FINALIZE_B_NOT_STARTED',
  installed:null,taskChanges:0,otherTaskChanges:0,providerCalls:0,
  sqliteWrites:0,d1Writes:0};
 let attempted=false,finalizationAttempted=false;
 try{
  verifyW06FinalizationReady(await io.snapshot(),m);
  attempted=true;
  await io.claimOnce(req.requestId);
  verifyW06FinalizationReady(await io.snapshot(),m);
  finalizationAttempted=true;
  await io.finishOnce(RECOVERY_ID);
  need(await io.readback(req.requestId)===true,
   'TASK_FINALIZE_B_POSTCHECK_STOP');
  return {...base,status:'TASK_FINALIZE_B_FINALIZED_VERIFIED',
   code:'TASK_FINALIZE_B_EXACT_OWNER_RELEASE_PASS',installed:true};
 }catch(e){
  const code=/^TASK_FINALIZE_B_[A-Z0-9_]{3,100}$/.test(e?.code??'')?
   e.code:'TASK_FINALIZE_B_PORT_UNVERIFIED_STOP';
  return {...base,status:attempted?'TASK_FINALIZE_B_RECOVERY_REQUIRED':
   'TASK_FINALIZE_B_PREFLIGHT_STOP',code,
   finalizationAttempted,completion:'UNVERIFIED_NO_AUTOMATIC_RETRY'};
 }
}

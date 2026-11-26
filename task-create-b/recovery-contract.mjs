// W06 owner-journal Task recovery: fixed-effect, existing disabled Task only.
// No Issue-supplied command, path, scheduler, source or cleanup policy.
import {createHash} from 'node:crypto';
import {TASK,INSTALLED_SOURCE,SOURCE_ROOT,WRAPPER} from './contract.mjs';

export const RECOVERY_TITLE='pc-writer-task-recover-once';
export const RECOVERY_LABEL='pc-writer-b-install';
export const RECOVERY_REQUEST_SCHEMA='ZGMINI_PC_TASK_RECOVERY_B_REQUEST_V1';
export const RECOVERY_APPROVAL_SCHEMA='ZGMINI_PC_TASK_RECOVERY_B_APPROVAL_V1';
export const RECOVERY_RESULT_SCHEMA='ZGMINI_PC_TASK_RECOVERY_B_RESULT_V1';
export const RECOVERY_MANIFEST='approvals/task-create-b/w06-cnn-minute-recovery-20261126.json';
export const ORIGINAL_REQUEST='ce21eaa3-7768-4cb8-88d9-0911941d966c';
export const DISABLED_TASK_SHA256='7f8e58d7849f604f8bebfdc1ce7382e40ff5a9e61ffe7ab5853c576f1eabe59d';
export const CORE_SHA256='dd81987c7efa4b1e343af30329a580613bb920dec89c1aa7a436ef935f0bb028';
export const SIDECAR_SHA256='eb3c43bf8fba6ea4e51f3e84b77f9ec13000db9d9e38077ffd914950d7080b6b';
export const LAUNCHER_SHA256='73c8cf4381fd328182a9fad0a7cb5753cf9093e58524f0c9a04be4df7032d733';
export const DISABLED_TEMPLATE_SHA256='afdc7ebf437091fa1d20770d2346f2174f1dcb6991c14670e5854c56cc6d1b69';
export const ENABLED_TEMPLATE_SHA256='d7d027664b426e5bd9c8c77da2532fedd25b81863320ac676965e2986d31e957';
const OWNER='ansqhd5774-Choi';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SHA64=/^[a-f0-9]{64}$/;
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const exact=(o,names)=>o&&typeof o==='object'&&!Array.isArray(o)&&
 Object.keys(o).length===names.length&&names.every(n=>Object.hasOwn(o,n));
const stop=code=>{throw Object.assign(Error(code),{code});};
const need=(ok,code)=>{if(!ok)stop(code);};
const approved=new WeakSet();
const requestKeys=['schema','requestId','operation','approvalManifestPath','approvalManifestSha256'];
const manifestKeys=['schema','status','scope','taskName','ownerRequestId','installedSourceSha',
 'sourceRoot','wrapperPath','taskDisabledXmlSha256','coreTaskXmlSha256',
 'sidecarSourceSha256','launcherSha256','disabledTemplateSha256','enabledTemplateSha256',
 'allowTaskEnable','allowTaskCreate','allowTaskDelete','allowOtherTaskChanges',
 'allowScheduledCnnHttpRequests','allowScheduledSqliteWrites','allowScheduledD1Writes','runCount'];

export function authorizeRecoveryB({event,manifestBytes,manifestCommitted=false}={}){
 const i=event?.issue;
 need(event?.action==='opened'&&event?.repository?.full_name==='ansqhd5774-Choi/zgmini-pc-control'&&
  event.repository.private===true&&event.sender?.login===OWNER&&
  i?.title===RECOVERY_TITLE&&i.user?.login===OWNER&&
  !i.pull_request&&i.labels?.some(x=>x.name===RECOVERY_LABEL)&&
  manifestCommitted===true&&Buffer.isBuffer(manifestBytes)&&
  manifestBytes.length>200&&manifestBytes.length<=8192,'TASK_RECOVERY_B_OWNER_OR_COMMIT_STOP');
 let request,m;
 try{request=JSON.parse(i.body);m=JSON.parse(manifestBytes.toString('utf8'));}
 catch{stop('TASK_RECOVERY_B_JSON_STOP');}
 need(exact(request,requestKeys)&&request.schema===RECOVERY_REQUEST_SCHEMA&&
  UUID.test(request.requestId??'')&&request.requestId!==ORIGINAL_REQUEST&&
  request.operation==='task-recover-once'&&request.approvalManifestPath===RECOVERY_MANIFEST&&
  SHA64.test(request.approvalManifestSha256??'')&&sha(manifestBytes)===request.approvalManifestSha256,
  'TASK_RECOVERY_B_REQUEST_STOP');
 need(exact(m,manifestKeys)&&m.schema===RECOVERY_APPROVAL_SCHEMA&&
  m.status==='APPROVED_B'&&m.scope==='W06_EXISTING_DISABLED_TASK_OWNER_RECOVERY_ONCE'&&
  m.taskName===TASK&&m.ownerRequestId===ORIGINAL_REQUEST&&
  m.installedSourceSha===INSTALLED_SOURCE&&m.sourceRoot===SOURCE_ROOT&&
  m.wrapperPath===WRAPPER&&m.taskDisabledXmlSha256===DISABLED_TASK_SHA256&&
  m.coreTaskXmlSha256===CORE_SHA256&&m.sidecarSourceSha256===SIDECAR_SHA256&&
  m.launcherSha256===LAUNCHER_SHA256&&
  m.disabledTemplateSha256===DISABLED_TEMPLATE_SHA256&&
  m.enabledTemplateSha256===ENABLED_TEMPLATE_SHA256&&
  m.allowTaskEnable===true&&m.allowTaskCreate===false&&
  m.allowTaskDelete===false&&m.allowOtherTaskChanges===false&&
  m.allowScheduledCnnHttpRequests===true&&m.allowScheduledSqliteWrites===true&&
  m.allowScheduledD1Writes===true&&m.runCount===1,
  'TASK_RECOVERY_B_SCOPE_STOP');
 const proof=Object.freeze({request:Object.freeze(request),manifest:Object.freeze(m)});
 approved.add(proof);
 return proof;
}

const required=['observe','claimRecoveryOnce','enableExisting','verifyEnabled',
 'verifyProtected','releaseOriginalOwnerLock'];
// Only a read-only precheck and one task activation are permitted.
// All failures after first attempted change retain original lock and one-shot claim.
export async function applyRecoveryB(proof,io){
 need(approved.has(proof),'TASK_RECOVERY_B_AUTH_STOP');
 need(io&&required.every(x=>typeof io[x]==='function'),'TASK_RECOVERY_B_PORT_STOP');
 const result={schema:RECOVERY_RESULT_SCHEMA,requestId:proof.request.requestId,
  ownerRequestId:ORIGINAL_REQUEST,taskName:TASK,status:'TASK_RECOVERY_B_STATE_UNKNOWN',
  code:'TASK_RECOVERY_B_UNSTARTED',installed:null,taskChanges:null,
  otherTaskChanges:0,installerProviderCalls:0,installerSqliteWrites:0,
  installerD1Writes:0,scheduledRuntimeEffects:'UNVERIFIED_UNTIL_NATURAL_TICKS'};
 let claimed=false,claimAttempted=false,enableAttempted=false;
 try{
  need(await io.observe(proof)===true,'TASK_RECOVERY_B_PREIMAGE_STOP');
  claimAttempted=true;
  await io.claimRecoveryOnce(proof);
  claimed=true;
  need(await io.observe(proof)===true,'TASK_RECOVERY_B_RECHECK_STOP');
  enableAttempted=true;
  await io.enableExisting(proof);
  need(await io.verifyEnabled(proof)===true,'TASK_RECOVERY_B_ENABLE_READBACK_STOP');
  need(await io.verifyProtected(proof)===true,'TASK_RECOVERY_B_PROTECTED_DRIFT_STOP');
  await io.releaseOriginalOwnerLock(proof);
  return {...result,status:'TASK_RECOVERY_B_ENABLED_VERIFIED',
   code:'TASK_RECOVERY_B_OWNER_CAS_NATIVE_ENABLE_PASS',installed:true,taskChanges:1};
 }catch(e){
  const code=/^TASK_RECOVERY_B_[A-Z0-9_]{3,90}$/.test(e?.code??'')?
   e.code:'TASK_RECOVERY_B_NATIVE_UNVERIFIED_STOP';
  if(!claimAttempted)return {...result,status:'TASK_RECOVERY_B_PREFLIGHT_STOP',
   code,installed:false,taskChanges:0};
  return {...result,status:'TASK_RECOVERY_B_RECOVERY_REQUIRED',
   code:enableAttempted?code:claimed?'TASK_RECOVERY_B_CLAIM_RECHECK_UNKNOWN':
    'TASK_RECOVERY_B_CLAIM_OUTCOME_UNKNOWN',
   installed:null,taskChanges:null};
 }
}

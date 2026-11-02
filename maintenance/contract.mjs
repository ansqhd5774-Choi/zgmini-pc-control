import {createHash} from 'node:crypto';

export const CONTROL_REPOSITORY='ansqhd5774-Choi/zgmini-pc-control';
export const UPDATE_SCHEMA='ZGMINI_PC_CONTROLLER_UPDATE_V1';
export const UPDATE_LABEL='pc-controller-update';
const sha40=/^[a-f0-9]{40}$/;
const sha256=/^[a-f0-9]{64}$/;
const id=/^[a-z0-9][a-z0-9-]{7,79}$/;
const chat=/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/;
const required=(condition,code)=>{if(!condition)throw Object.assign(new Error(code),{code});};
const keys=(value,expected)=>value&&typeof value==='object'&&!Array.isArray(value)&&
  Object.keys(value).length===expected.length&&expected.every(k=>Object.hasOwn(value,k));
export const digest=value=>createHash('sha256').update(value).digest('hex');
export const errorCode=error=>/^[A-Z0-9_]{1,80}$/.test(error?.code??'')?error.code:'AUTOMATION_INTERNAL_ERROR';

// The actor and explicit per-SHA contract are independent of what happens to be on main.
// This does NOT execute a command, accept a download URL, or change operational source.
export function validateContract(raw,{actor,labels,allowedActor='ansqhd5774-Choi'}={}){
 required(actor===allowedActor,'UPDATE_ACTOR_NOT_ALLOWED');
 required(labels?.includes(UPDATE_LABEL),'UPDATE_LABEL_REQUIRED');
 required(keys(raw,['schema','requestId','chatId','controlRepository','installedSha','targetSha','approval','changedFiles','tests','recovery']),'UPDATE_FIELDS');
 required(raw.schema===UPDATE_SCHEMA,'UPDATE_SCHEMA');
 required(id.test(raw.requestId),'UPDATE_REQUEST_ID');
 required(chat.test(raw.chatId),'UPDATE_CHAT_ID');
 required(raw.controlRepository===CONTROL_REPOSITORY,'UPDATE_REPOSITORY');
 required(sha40.test(raw.installedSha)&&sha40.test(raw.targetSha)&&raw.installedSha!==raw.targetSha,'UPDATE_SHA');
 const a=raw.approval;
 required(keys(a,['approvalId','scope','basis','approvedBy']),'UPDATE_APPROVAL_FIELDS');
 required(id.test(a.approvalId)&&['A_READONLY_CONTROLLER','ONE_TIME_MAINTENANCE_BOOTSTRAP'].includes(a.scope)&&a.approvedBy===allowedActor&&
    typeof a.basis==='string'&&a.basis.length>=15&&a.basis.length<=300,'UPDATE_APPROVAL_REQUIRED');
 const t=raw.tests;
 required(keys(t,['status','sourceSha','passed','failed','evidence']),'UPDATE_TEST_FIELDS');
 required(t.status==='PASS'&&t.sourceSha===raw.targetSha&&Number.isSafeInteger(t.passed)&&t.passed>=1&&t.failed===0&&
    typeof t.evidence==='string'&&t.evidence.length>=12&&t.evidence.length<=250,'UPDATE_TEST_EVIDENCE_REQUIRED');
 required(keys(raw.recovery,['backup','partialFailure']),'UPDATE_RECOVERY_FIELDS');
 required(raw.recovery.backup==='HASHED_CONTROLLER_CONFIG_HOST'&&raw.recovery.partialFailure==='STOP_AUDIT_BEFORE_RETRY','UPDATE_RECOVERY_CONTRACT');
 required(Array.isArray(raw.changedFiles)&&raw.changedFiles.length>0&&raw.changedFiles.length<=80,'UPDATE_FILE_COUNT');
 const seen=new Set();
 for(const file of raw.changedFiles){
  required(keys(file,['path','sha256']),'UPDATE_FILE_FIELDS');
  const common=/^(?:controller\/[a-z0-9-]+\.mjs|config\/operations\.json|tests\/[a-z0-9-]+\.test\.mjs|docs\/[A-Z0-9_-]+\.md|README\.md|AGENTS\.md)$/;
  const bootstrap=/^(?:maintenance\/[a-z0-9-]+\.mjs|tools\/(?:install|update|bootstrap-maintenance)\.mjs|\.github\/workflows\/pc-job\.yml)$/;
  required(typeof file.path==='string'&&(common.test(file.path)||
    (a.scope==='ONE_TIME_MAINTENANCE_BOOTSTRAP'&&bootstrap.test(file.path))),'UPDATE_FILE_NOT_ALLOWLISTED');
  required(sha256.test(file.sha256)&&!seen.has(file.path),'UPDATE_FILE_HASH_OR_DUPLICATE');
  seen.add(file.path);
 }
 return Object.freeze(raw);
}

// Exact allowlist: operational writes, workflow changes, updater binaries and other
// repository changes are not automatically approved by a read-only controller update.
export function verifyChanges(request,actualChanges){
 const wanted=new Map(request.changedFiles.map(f=>[f.path,f.sha256]));
 const actual=new Map();
 for(const change of actualChanges){
  if(change.path.startsWith('results/')&&change.status==='A')continue; // remote report append only, never deployed
  required(change.status==='A'||change.status==='M','UPDATE_REMOVAL_NOT_ALLOWED');
  required(!actual.has(change.path),'UPDATE_DUPLICATE_DIFF');
  actual.set(change.path,change.sha256);
 }
 required(actual.size===wanted.size,'UPDATE_CHANGED_FILE_SET');
 for(const [path,hash] of wanted)required(actual.get(path)===hash,'UPDATE_CHANGED_FILE_HASH');
 return true;
}

/** A-grade changes may add a fixed read-only operation, never change an
 * existing operation, open a write capability, or alter a protected policy. */
export function verifyOperationPolicy(before,after){
 const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
 required(obj(before)&&obj(after)&&obj(before.operations)&&obj(after.operations),
  'UPDATE_CONFIG_POLICY_INVALID');
 required(before.seats===6&&after.seats===6&&
  before.mutationsEnabled===false&&after.mutationsEnabled===false,
  'UPDATE_CONFIG_WRITE_OR_SEAT_CHANGE');
 const keys=Object.keys(before).filter(x=>x!=='operations').sort();
 const afterKeys=Object.keys(after).filter(x=>x!=='operations').sort();
 required(JSON.stringify(keys)===JSON.stringify(afterKeys),
  'UPDATE_CONFIG_TOP_LEVEL_FIELDS_CHANGED');
 for(const key of keys)required(JSON.stringify(before[key])===JSON.stringify(after[key]),
  'UPDATE_CONFIG_PROTECTED_FIELD_CHANGED');
 for(const [name,operation] of Object.entries(before.operations)){
  required(Object.hasOwn(after.operations,name)&&
   JSON.stringify(operation)===JSON.stringify(after.operations[name]),
   'UPDATE_EXISTING_OPERATION_CHANGED');
 }
 for(const [name,operation] of Object.entries(after.operations)){
  if(Object.hasOwn(before.operations,name))continue;
  required(/^[a-z][a-z0-9-]{2,60}$/.test(name)&&obj(operation)&&
   Object.keys(operation).sort().join(',')==='grade,resource,timeoutSeconds'&&
   operation.grade==='A'&&operation.resource==='light'&&
   Number.isSafeInteger(operation.timeoutSeconds)&&
   operation.timeoutSeconds>=1&&operation.timeoutSeconds<=90,
   'UPDATE_NEW_OPERATION_NOT_READONLY_A');
 }
 return true;
}

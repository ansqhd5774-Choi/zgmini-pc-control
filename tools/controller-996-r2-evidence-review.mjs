// #996 source-only review of an operator-copied original-Windows R2 response.
// Recompute the protected fingerprint independently from the public digests.
// A JSON response is NOT an authenticated live PC proof or a C authorization.
import {createHash} from 'node:crypto';

const REQUEST='pc-update-0010b2cf-9bca-40cf-89c5-b750fa42b404';
const PIN='877bcd2a2abbf34452c09fc96a15b28d0309a32b45687f8dace37ae5e29abb86';
const FILES=['config.json','quota-runner.cmd','run-local.cmd'];
const TASKS=['ZGMINI-PC-Local-Core','ZGMINI-PC-Local-Korea'];
const SHA=v=>typeof v==='string'&&/^[0-9a-f]{64}$/.test(v);
const sha=v=>createHash('sha256').update(v).digest('hex');
const fail=code=>Object.freeze({schema:'ZGMINI_CONTROLLER_996_R2_REVIEW_V1',
 status:'EVIDENCE_UNVERIFIED',code,executionAuthorized:false,
 operationalWrites:0,issuePosts:0,pcRetries:0});

export function review996ProtectedR2Evidence(r){
 if(r?.schema!=='ZGMINI_CONTROLLER_996_PROTECTED_ITEMS_READONLY_V1'||
  r.requestId!==REQUEST||r.issueNumber!==996||
  !Number.isFinite(Date.parse(r.observedAt))||
  r.status!=='CURRENT_ITEMS_MATCH_OBSERVATION'||
  r.currentFingerprint!==PIN||r.originalObservationFingerprint!==PIN||
  r.fingerprintMatch!==true)return fail('C_R2_IDENTITY_OR_FINGERPRINT_INVALID');
 if(r.operationalWrites!==0||r.issuePosts!==0||r.pcRetries!==0||
  r.executionAuthorized!==false||r.historicalBaselineAvailable!==false||
  r.allActorsImmutableProven!==false)return fail('C_R2_AUTHORITY_OR_HISTORICAL_GAP_DRIFT');
 const x=r.items;
 if(!x||typeof x!=='object'||!x.files||!x.writerFileStatus||
  !x.taskSha256||!x.taskEnabled)return fail('C_R2_ITEMS_MISSING');
 if(Object.keys(x.writerFileStatus).length!==FILES.length||
  Object.keys(x.taskSha256).length!==TASKS.length||
  Object.keys(x.taskEnabled).length!==TASKS.length)
  return fail('C_R2_ITEM_SET_DRIFT');
 const files={},tasks={};let present=0;
 for(const name of FILES){
  const state=x.writerFileStatus[name];
  if(state==='PRESENT'){
   if(!SHA(x.files[name]))return fail('C_R2_WRITER_HASH_MISSING');
   files[name]=x.files[name];present++;
  }else if(state==='ABSENT'){
   if(Object.hasOwn(x.files,name))return fail('C_R2_ABSENT_FILE_HAS_HASH');
  }else return fail('C_R2_WRITER_PRESENCE_UNPROVEN');
 }
 if(Object.keys(x.files).length!==present||
  r.presentWriterFileCount!==present||
  r.allFivePresent!==(present===3))return fail('C_R2_FILE_COUNT_DRIFT');
 for(const name of TASKS){
  if(!SHA(x.taskSha256[name])||typeof x.taskEnabled[name]!=='boolean')
   return fail('C_R2_PROTECTED_TASK_UNVERIFIED');
  tasks[name]=x.taskSha256[name];
 }
 if(sha(Buffer.from(JSON.stringify({files,tasks})))!==PIN)
  return fail('C_R2_AGGREGATE_RECOMPUTE_MISMATCH');
 return Object.freeze({schema:'ZGMINI_CONTROLLER_996_R2_REVIEW_V1',
  status:'CURRENT_PROTECTION_MATCHES_R1',
  protectedFingerprint:PIN,presentWriterFiles:present,
  absentWriterFiles:FILES.length-present,enabledTasks:TASKS.filter(t=>x.taskEnabled[t]).length,
  protectedTasksVerified:TASKS.length,
  historicalBaselineAvailable:false,workflowDisableActorVerified:false,
  executionAuthorized:false,operationalWrites:0,issuePosts:0,pcRetries:0});
}

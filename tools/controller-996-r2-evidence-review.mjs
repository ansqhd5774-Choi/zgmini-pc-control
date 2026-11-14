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

const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&
 JSON.stringify(Object.keys(value).sort())===JSON.stringify([...keys].sort());
function canonicalItems(x){
 if(!exact(x,['files','writerFileStatus','taskSha256','taskEnabled'])||
  !exact(x.writerFileStatus,FILES)||!exact(x.taskSha256,TASKS)||!exact(x.taskEnabled,TASKS)||
  !x.files||typeof x.files!=='object'||Array.isArray(x.files))return null;
 const files={},tasks={};
 for(const name of FILES){
  if(x.writerFileStatus[name]==='PRESENT'){
   if(!SHA(x.files[name]))return null;files[name]=x.files[name];
  }else if(x.writerFileStatus[name]!=='ABSENT'||Object.hasOwn(x.files,name))return null;
 }
 if(Object.keys(x.files).length!==Object.keys(files).length)return null;
 for(const name of TASKS){if(!SHA(x.taskSha256[name])||x.taskEnabled[name]!==true)return null;tasks[name]=x.taskSha256[name];}
 return {files,tasks};
}
// Data validation only. Authority comes from the separate Owner consent to
// the exact complete C manifest; no caller boolean can authorize a write.
export function validate996ManifestProtectionBaseline(b){
 if(!exact(b,['schema','historicalFingerprint','fingerprint','items','evidence'])||
  b.schema!=='ZGMINI_CONTROLLER_996_MANIFEST_PROTECTION_BASELINE_V1'||
  b.historicalFingerprint!==PIN||!SHA(b.fingerprint))return false;
 const items=canonicalItems(b.items);
 if(!items||sha(Buffer.from(JSON.stringify(items)))!==b.fingerprint)return false;
 return Array.isArray(b.evidence)&&b.evidence.length>=1&&b.evidence.length<=4&&b.evidence.every(e=>
  exact(e,['repository','issueNumber','commit','path','sha256'])&&
  e.repository==='ansqhd5774-Choi/zgmini-pc-control'&&
  Number.isSafeInteger(e.issueNumber)&&e.issueNumber>0&&
  /^[a-f0-9]{40}$/.test(e.commit??'')&&SHA(e.sha256)&&
  /^results\/[a-zA-Z0-9][a-zA-Z0-9_-]{1,119}\.json$/.test(e.path??''));
}
export function review996ManifestProtectedEvidence(r,baseline){
 if(!validate996ManifestProtectionBaseline(baseline))return fail('C_R2_MANIFEST_BASELINE_INVALID');
 if(r?.schema!=='ZGMINI_CONTROLLER_996_PROTECTED_ITEMS_READONLY_V1'||
  r.requestId!==REQUEST||r.issueNumber!==996||!Number.isFinite(Date.parse(r.observedAt))||
  r.operationalWrites!==0||r.issuePosts!==0||r.pcRetries!==0||r.executionAuthorized!==false||
  r.historicalBaselineAvailable!==false||r.allActorsImmutableProven!==false)
  return fail('C_R2_MANIFEST_OBSERVATION_INVALID');
 const items=canonicalItems(r.items);
 if(!items||sha(Buffer.from(JSON.stringify(items)))!==r.currentFingerprint||
  r.currentFingerprint!==baseline.fingerprint||
  JSON.stringify(items)!==JSON.stringify(canonicalItems(baseline.items))||
  FILES.some(name=>r.items.writerFileStatus[name]!==baseline.items.writerFileStatus[name]))
  return fail('C_R2_MANIFEST_BASELINE_MISMATCH');
 return Object.freeze({schema:'ZGMINI_CONTROLLER_996_R2_REVIEW_V1',
  status:'CURRENT_PROTECTION_MATCHES_MANIFEST_BASELINE',protectedFingerprint:baseline.fingerprint,
  historicalFingerprint:PIN,historicalFingerprintMatches:baseline.fingerprint===PIN,
  enabledTasks:2,protectedTasksVerified:2,baselineAuthority:'EXACT_OWNER_MANIFEST_CONSENT_REQUIRED',
  evidenceAuthenticated:false,executionAuthorized:false,operationalWrites:0,issuePosts:0,pcRetries:0});
}

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
  // The actual original R2 observed both tasks enabled. A disabled Task
  // cannot be relabeled as the same protected operational state, even when
  // the Task XML bytes remain SHA-identical to a supplied manifest.
  if(!SHA(x.taskSha256[name])||x.taskEnabled[name]!==true)
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

// Reusable B-grade VERSIONED-BUNDLE approval parser and dry-run planner.
// This module has no filesystem, network, shell, Task Scheduler or write access.
// Trusted profiles MUST come from the pinned, separately approved receiver;
// they must never be supplied by a user Issue or an untrusted source bundle.
import {createHash} from 'node:crypto';
import path from 'node:path';

export const SCHEMA='ZGMINI_PC_VERSIONED_BUNDLE_APPROVAL_V1';
export const SCOPE='PC_WRITER_APPROVED_VERSIONED_BUNDLE_ACTIVATION_ONLY';
const SHA40=/^[0-9a-f]{40}$/;
const SHA64=/^[0-9a-f]{64}$/;
const SOURCE_REPO='ansqhd5774-Choi/zgmini';
// The existing configured-theme package includes fixed, hash-pinned .js
// Node modules alongside .mjs/.json/.md; launcher/script files remain denied.
const BUNDLE_EXT=/\.(?:mjs|js|json|md)$/i;
const LAUNCHER_EXT=/\.(?:cmd|vbs)$/i;
const DEVICE=/^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i;

function requireThat(ok,code){if(!ok){const e=Error(code);e.code=code;throw e;}}
function fields(value,keys,code){
 requireThat(value!==null&&typeof value==='object'&&!Array.isArray(value),code);
 const got=Object.keys(value).sort(),want=[...keys].sort();
 requireThat(got.length===want.length&&got.every((key,i)=>key===want[i]),code);
}
function exactSha(value,length=64){return (length===40?SHA40:SHA64).test(value??'');}
function safeName(segment){return /^[a-z0-9_.-]+$/i.test(segment)&&segment!=='.'&&segment!=='..'&&
 !/[. ]$/.test(segment)&&!DEVICE.test(segment);}
function validBundlePath(file){
 return typeof file==='string'&&file.length<=240&&!file.includes('\\')&&
 file.split('/').every(safeName)&&BUNDLE_EXT.test(file);
}
function validLauncherName(name){return typeof name==='string'&&!name.includes('/')&&
 !name.includes('\\')&&safeName(name)&&LAUNCHER_EXT.test(name);}
const noDuplicateCase=(arr,code)=>requireThat(new Set(arr.map(x=>x.toLowerCase())).size===arr.length,code);
const sha256=text=>createHash('sha256').update(text).digest('hex');

/**
 * @param {object} approval Raw manifest parsed by the receiver AFTER its raw-byte
 *   SHA check and exact Git-approval provenance check.
 * @param {object} trustedProfiles A trusted map of profileId -> fixed local path,
 *   scheduler name and launcher allowlist, pinned with the B receiver.
 */
export function buildVersionedBundlePlan(approval,trustedProfiles){
 fields(approval,['schema','status','scope','sourceRepository','sourceBranch',
  'sourceSha','profileId','bundle','activation','effects'],'B_MANIFEST_FIELDS');
 requireThat(approval.schema===SCHEMA&&approval.status==='APPROVED'&&approval.scope===SCOPE,'B_SCOPE');
 requireThat(approval.sourceRepository===SOURCE_REPO&&exactSha(approval.sourceSha,40),'B_SOURCE');
 requireThat(typeof approval.sourceBranch==='string'&&/^[a-z0-9][a-z0-9/_-]{0,127}$/i.test(approval.sourceBranch)&&
  !approval.sourceBranch.includes('..')&&!approval.sourceBranch.includes('//'),'B_SOURCE_BRANCH');
 requireThat(typeof approval.profileId==='string'&&/^[a-z0-9][a-z0-9_-]{1,62}$/i.test(approval.profileId),'B_PROFILE_ID');
 const profile=trustedProfiles&&Object.hasOwn(trustedProfiles,approval.profileId)
  ?trustedProfiles[approval.profileId]:null;
 requireThat(!!profile&&typeof profile==='object','B_PROFILE_NOT_REGISTERED');
 fields(profile,['id','home','taskName','taskTime','requiredLaunchers','optionalLaunchers',
  'activeRecord','maxFiles','maxBundleBytes'],'B_PROFILE_CONTRACT');
 requireThat(profile.id===approval.profileId&&typeof profile.home==='string'&&
  /^E:\\ZGmini\\data\\pc-writer\\[a-z0-9_-]+$/i.test(profile.home)&&
  path.win32.isAbsolute(profile.home),'B_PROFILE_HOME');
 requireThat(typeof profile.taskName==='string'&&/^ZGMINI-PC-[A-Za-z0-9-]{1,100}$/.test(profile.taskName)&&
  /^\d{2}:\d{2}$/.test(profile.taskTime),'B_PROFILE_TASK');
 requireThat(Array.isArray(profile.requiredLaunchers)&&profile.requiredLaunchers.every(validLauncherName)&&
  Array.isArray(profile.optionalLaunchers)&&profile.optionalLaunchers.every(validLauncherName),'B_PROFILE_LAUNCHERS');
 const known=[...profile.requiredLaunchers,...profile.optionalLaunchers];
 noDuplicateCase(known,'B_PROFILE_LAUNCHER_DUPLICATE');
 requireThat(typeof profile.activeRecord==='string'&&safeName(profile.activeRecord)&&
  profile.activeRecord.endsWith('.json'),'B_PROFILE_ACTIVE');
 requireThat(Number.isSafeInteger(profile.maxFiles)&&profile.maxFiles>0&&profile.maxFiles<=256&&
  Number.isSafeInteger(profile.maxBundleBytes)&&profile.maxBundleBytes>0&&profile.maxBundleBytes<=32*1024*1024,
  'B_PROFILE_LIMITS');

 fields(approval.bundle,['version','files','sourceTreeGitOid','zipSha256'],'B_BUNDLE_FIELDS');
 // Git tree object ID is a 40-character SHA-1 OID, not a SHA-256 digest.
 requireThat(exactSha(approval.bundle.sourceTreeGitOid,40)&&exactSha(approval.bundle.zipSha256),
  'B_SOURCE_EVIDENCE');
 requireThat(Array.isArray(approval.bundle.files)&&approval.bundle.files.length>0&&
  approval.bundle.files.length<=profile.maxFiles,'B_FILE_COUNT');
 let total=0;
 for(const f of approval.bundle.files){
  fields(f,['path','sha256','bytes'],'B_FILE_FIELDS');
  requireThat(validBundlePath(f.path),'B_UNSAFE_BUNDLE_PATH');
  requireThat(exactSha(f.sha256)&&Number.isSafeInteger(f.bytes)&&f.bytes>=0,'B_FILE_HASH_SIZE');
  total+=f.bytes;
 }
 requireThat(Number.isSafeInteger(total)&&total<=profile.maxBundleBytes,'B_BUNDLE_SIZE');
 noDuplicateCase(approval.bundle.files.map(f=>f.path),'B_FILE_CASE_COLLISION');
 // The package builder hashes a native JS-lexicographic ordering, not locale collation.
 const sorted=[...approval.bundle.files].sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
 const hashManifest=Object.fromEntries(sorted.map(f=>[f.path,f.sha256]));
 const expectedVersion=sha256(JSON.stringify(hashManifest)).slice(0,16);
 requireThat(approval.bundle.version===expectedVersion,'B_VERSION_DIGEST');

 fields(approval.activation,['task','launchers','activeRecord'],'B_ACTIVATION_FIELDS');
 const task=approval.activation.task;
 fields(task,['name','time','beforeXmlSha256','requiredState'],'B_TASK_FIELDS');
 requireThat(task.name===profile.taskName&&task.time===profile.taskTime&&
  task.requiredState==='READY'&&exactSha(task.beforeXmlSha256),'B_TASK_PREIMAGE');
 const ls=approval.activation.launchers;
 requireThat(Array.isArray(ls)&&ls.length<=known.length,'B_LAUNCHER_COUNT');
 for(const l of ls){
  fields(l,['name','beforeSha256','afterSha256'],'B_LAUNCHER_FIELDS');
  requireThat(known.some(x=>x.toLowerCase()===l.name.toLowerCase())&&
   exactSha(l.beforeSha256)&&exactSha(l.afterSha256)&&
   l.beforeSha256!==l.afterSha256,'B_LAUNCHER_NOT_APPROVED');
 }
 noDuplicateCase(ls.map(l=>l.name),'B_LAUNCHER_CASE_COLLISION');
 requireThat(profile.requiredLaunchers.every(name=>ls.some(l=>l.name.toLowerCase()===name.toLowerCase())),
  'B_REQUIRED_LAUNCHER_MISSING');
 const record=approval.activation.activeRecord;
 fields(record,['name','beforeSha256','afterSha256'],'B_ACTIVE_FIELDS');
 requireThat(record.name===profile.activeRecord&&
  (record.beforeSha256===null||exactSha(record.beforeSha256))&&exactSha(record.afterSha256)&&
  record.beforeSha256!==record.afterSha256,'B_ACTIVE_PREIMAGE');
 fields(approval.effects,['taskDefinitionChanges','newTasks','providerCalls','dbWrites',
  'd1Writes','secretReads','otherOperationalFiles'],'B_EFFECT_FIELDS');
 requireThat(Object.values(approval.effects).every(x=>x===false),'B_UNSAFE_EFFECTS');

 // A plan is not authorization. The trusted receiver must use actual Windows
 // filesystem preimage checks/CAS, ACL-preserving backups, writer lock, journal,
 // rollback and exact Task XML re-read before any mutation.
 return Object.freeze({status:'PLAN_ONLY',operation:'pc-writer-versioned-bundle-activate',
  profileId:profile.id,sourceSha:approval.sourceSha,home:profile.home,
  bundleVersion:expectedVersion,fileCount:approval.bundle.files.length,totalBytes:total,
  fileListSha256:sha256(JSON.stringify(sorted)),
  launcherNames:ls.map(x=>x.name),activeRecord:record.name,taskName:task.name,
  taskXmlBeforeSha256:task.beforeXmlSha256,
  allowedEffects:['STAGE_IMMUTABLE_VERSION','REPLACE_APPROVED_LAUNCHERS','WRITE_ACTIVE_RECORD'],
  runtimeRequired:['PINNED_APPROVAL_RAW_SHA','PINNED_SOURCE_BYTE_VERIFICATION',
   'SAFE_PATH_NO_REPARSE','SAME_WRITER_B_LOCK','ACTUAL_PREIMAGE_SHA_CAS',
   'TASK_READY_AND_XML_UNCHANGED','SAME_DIR_ACL_BACKUPS_AND_FSYNC',
   'RECOVERABLE_JOURNAL_AND_ROLLBACK','ACTUAL_READBACK_AND_RESULT_2_OF_2']});
}

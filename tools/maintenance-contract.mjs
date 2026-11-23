// ZGMINI PC controller update admission and transition contract (pure ESM).
// This module NEVER runs shell, downloads source, installs code or edits a PC.
import {createHash,randomUUID} from "node:crypto";
import path from "node:path";
import {CONVERSATION_TRACE_ID} from './source-bundle-register.mjs';
export {SOURCE_BUNDLE_OPERATION,SOURCE_BUNDLE_ISSUE_TITLE,
  validateSourceBundleIssueEnvelope,validateSourceBundleBApproval}
  from './source-bundle-register.mjs';

// A recovery may drain jobs before the first Controller-byte mutation. Recheck
// the exact preapproved live protected state both before intake pause and just
// before a previous Controller is restored. No mutation or baseline rewriting.
export function recoveryProtectedSnapshotStillPinned(pinned,current){
 const record=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
 return record(pinned)&&record(current)&&record(pinned.files)&&
  record(pinned.tasks)&&record(current.files)&&record(current.tasks)&&
  JSON.stringify(pinned)===JSON.stringify(current);
}

// Existing Controller recovery must never roll back or silently bless an
// unrelated live Writer config update. A separately approved independent
// recovery may retain its *exact* current SHA only when all other protected
// observations match the original B baseline. This is a pure decision helper;
// neither a file write nor an operational recovery authorization.
export function selectPreservedRecoveryProtection(original,current,
 {approvedCurrentWriterConfigSha256=null}={}){
 const deny=code=>({allowed:false,code,baseline:null,preservedWriterConfig:false});
 const record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
 if(!record(original)||!record(current)||!record(original.files)||
    !record(current.files)||!record(original.tasks)||!record(current.tasks))
  return deny('RECOVERY_PROTECTION_SCHEMA_UNVERIFIED');
 // Even an otherwise unchanged baseline must match an explicitly pinned
 // approved live Writer SHA. Never ignore an approval CAS on the fast path.
 if(approvedCurrentWriterConfigSha256!==null&&
    (typeof approvedCurrentWriterConfigSha256!=='string'||
     !/^[a-f0-9]{64}$/.test(approvedCurrentWriterConfigSha256)||
     current.files['config.json']!==approvedCurrentWriterConfigSha256))
  return deny('RECOVERY_WRITER_CONFIG_CAS_NOT_VERIFIED');
 if(JSON.stringify(original)===JSON.stringify(current))
  return {allowed:true,code:'RECOVERY_ORIGINAL_PROTECTION_UNCHANGED',
   baseline:original,preservedWriterConfig:false};
 if(typeof approvedCurrentWriterConfigSha256!=='string'||
    !/^[a-f0-9]{64}$/.test(approvedCurrentWriterConfigSha256))
  return deny('RECOVERY_PROTECTION_DRIFT_NOT_APPROVED');
 const oldConfig=original.files['config.json'];
 const currentConfig=current.files['config.json'];
 if(!/^[a-f0-9]{64}$/.test(oldConfig??'')||
    currentConfig!==approvedCurrentWriterConfigSha256||
    oldConfig===currentConfig)
  return deny('RECOVERY_WRITER_CONFIG_CAS_NOT_VERIFIED');
 const expected={...original,files:{...original.files,
  'config.json':approvedCurrentWriterConfigSha256}};
 if(JSON.stringify(current)!==JSON.stringify(expected))
  return deny('RECOVERY_OTHER_PROTECTED_STATE_DRIFT');
 return {allowed:true,code:'RECOVERY_CURRENT_WRITER_CONFIG_PRESERVED',
  baseline:current,preservedWriterConfig:true};
}

export const CONTROL_REPOSITORY="ansqhd5774-Choi/zgmini-pc-control";
export const CONTROL_ACTOR="ansqhd5774-Choi";
export const UPDATE_SCHEMA="ZGMINI_PC_UPDATE_V1";
export const MAINTENANCE_ISSUE_SCHEMA="ZGMINI_PC_MAINTENANCE_REQUEST_V1";
export const INSTALLABLE_FILES=Object.freeze([
  "config/operations.json",
  "controller/common.mjs","controller/engine.mjs","controller/entry.mjs",
  "controller/fear-greed-archive-readonly.mjs",
  "controller/operations.mjs","controller/supervisor.mjs",
  "controller/upload.mjs","controller/worker.mjs",
]);
// The dirty-check covers files read in-place by this Controller installation.
// Unrelated local scripts are excluded. Scripts changed between pinned Git
// SHAs still pass the independent infrastructure-diff approval gate.
export const CONTROL_UPDATE_SENSITIVE_PATHS=Object.freeze([
  'controller','config','.github/workflows','approvals/controller-updates',
]);
export const CONTROLLER_POST_OPERATIONS=Object.freeze([
  'core-status','source-audit','fear-greed-archive-status',
]);

const ISSUE_KEYS=[
  "schema","requestId","chatId","operation","controlRepository",
  "targetControllerSha","approvalManifestSha256",
];
// The installed maintenance handoff permits exactly its original six tools.
// Keep the R54 B admission fixed and self-contained in this existing file.
// No imported R54 helper or Writer application code may be made a bootstrap
// dependency of the live maintainer.
export const R54_B_ISSUE_TITLE='pc-theme-nine-r54-sixfile-install';
export const R54_B_OPERATION='theme-nine-r54-sixfile-install';
export const R54_B_MANIFEST_SCOPE='R54_FIXED_SIXFILE_SOURCE_ONLY';
const R54_B_SOURCE_SCHEMA='ZGMINI_R54_SIXFILE_B_ONE_TIME_TASK_HOLD_V2';
export const R54_B_TASK_EXCEPTION=Object.freeze({
 mode:'DISABLE_RESTORE_SAME_TASK_ONCE',
 taskName:'ZGMINI-PC-Theme-Nine-R54-Public',
 preserveOriginalXml:true,
 preserveOriginalEnabledState:true,
 waitForNaturalExit:true,
 noForceTermination:true,
 noOtherTaskChanges:true,
 restoreOnlyAfterSixFileIntegrity:true,
 noAutomaticRetry:true,
});
export const R54_B_SOURCE_FILES=Object.freeze([
 Object.freeze({path:'scripts/pc-writer/theme-nine-r54-public-connect.mjs',
  old:'c6e4699d62bdef991911561623e37c205fd8bb6e5aa69907c3e93e36908fd31e',
  next:'8698389663d2e71c5684c4bcc2dd1e9b0a68d06cc002769b1d2a8e3e68289d3d'}),
 Object.freeze({path:'scripts/pc-writer/theme-nine-r51-stage-current.mjs',
  old:'fe079b1e2e5d2f824f6e0ff251bd2a01677fe1a477072c619b614402fbd90ae4',
  next:'5a50761756be6081c71df7aa30869ed43547fbb867e476b7c581072939c27560'}),
 Object.freeze({path:'scripts/pc-writer/theme-nine-r51-provisional-overlay.mjs',
  old:'dfc326e2738c1b8b82451510104ac6ad502e2a9876e0a3a76d939c412e907bb7',
  next:'7378d04bccea4c68ab93ce3b1b829b5bc0a742db49b88d1e7530482c4ea8b6cc'}),
 Object.freeze({path:'scripts/pc-writer/theme-nine-r54-public-record.mjs',
  old:'f2a688da40d7b5ee90ed2a27a40af05b9c63116284930f1cc26041064737d012',
  next:'85686106412b2c4a5af51ce5de6b844729bad02441cf9bab1e51ae369a3a4a27'}),
 Object.freeze({path:'scripts/pc-writer/theme-nine-r48-d1-publication.mjs',
  old:'7a10fe41710dbc1a21c9f3e343c538cd96b6c5695b683f04dce48af85ede6e7e',
  next:'fc55ee3a2c998a4dfa7c5edd9230a68fab3954dd745b39bbe39a6177363bf45a'}),
 Object.freeze({path:'worker/theme-nine-r37-public.mjs',
  old:'e6768dd37ebe65b9015aeb37b4a088c568ab839f085936cec8305c56ea36ce33',
  next:'30326c94c7b6f0963329cc00f7a3649c906f8e884d6915a4da38005281bcfd85'}),
]);
export function validateR54BIssueEnvelope(request,{
 controlRepository=CONTROL_REPOSITORY,actor=null,allowedActors=[CONTROL_ACTOR],
}={}){
 if(controlRepository!==CONTROL_REPOSITORY||request?.controlRepository!==CONTROL_REPOSITORY
  ||actor!==CONTROL_ACTOR||!Array.isArray(allowedActors)
  ||!allowedActors.includes(CONTROL_ACTOR))
  throw Error('R54_B_ISSUE_ORIGIN_DENIED');
 requireKeys(request,ISSUE_KEYS,'R54_B_ISSUE_FIELDS_INVALID');
 if(request.schema!==MAINTENANCE_ISSUE_SCHEMA||request.operation!==R54_B_OPERATION)
  throw Error('R54_B_OPERATION_DENIED');
 requireString(request.requestId,REQUEST_ID,'R54_B_REQUEST_ID_INVALID');
 requireString(request.chatId,CHAT_ID,'R54_B_CHAT_ID_INVALID');
 requireSha(request.targetControllerSha,'R54_B_CONTROLLER_PIN_INVALID');
 requireDigest(request.approvalManifestSha256,'R54_B_MANIFEST_PIN_INVALID');
 return Object.freeze({...request});
}
export function validateR54BManifestRequest(request,manifestBytes,{
 controlRepository=CONTROL_REPOSITORY,actor=null,allowedActors=[CONTROL_ACTOR],
 installedSha=null,
}={}){
 const approved=validateR54BIssueEnvelope(request,{controlRepository,actor,allowedActors});
 if(!SHA40.test(String(installedSha??''))||installedSha!==approved.targetControllerSha)
  throw Error('R54_B_INSTALLED_CONTROLLER_DRIFT');
 if(!Buffer.isBuffer(manifestBytes)||manifestBytes.length===0||manifestBytes.length>32768
  ||sha256(manifestBytes)!==approved.approvalManifestSha256)
  throw Error('R54_B_MANIFEST_DIGEST_DENIED');
 let manifest;
 try{manifest=JSON.parse(manifestBytes.toString('utf8'));}
 catch{throw Error('R54_B_MANIFEST_JSON_INVALID');}
 requireKeys(manifest,['schema','status','scope','runCount',
  'noProviderCalls','noD1Writes','noControllerChanges','files','taskStateException'],
  'R54_B_MANIFEST_FIELDS_DENIED');
 const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 if(manifest?.schema!==R54_B_SOURCE_SCHEMA||manifest.status!=='APPROVED_B'
  ||manifest.scope!==R54_B_MANIFEST_SCOPE||manifest.runCount!==1
  ||manifest.noProviderCalls!==true||manifest.noD1Writes!==true
  ||manifest.noControllerChanges!==true
  ||!eq(manifest.taskStateException,R54_B_TASK_EXCEPTION)
  ||!eq(manifest.files,R54_B_SOURCE_FILES))
  throw Error('R54_B_MANIFEST_SCOPE_DENIED');
 return Object.freeze({request:approved,manifest:Object.freeze({...manifest})});
}
// Independent B-grade host registration. The ordinary controller-update issue
// and its eleven-field manifest remain unchanged.
export const R6_HOST_OPERATION="employment-r6-host-register";
export const R6_HOST_SCHEMA="ZGMINI_R6_HOST_B_APPLY_V1";
export const R6_HOST_SCOPE="PC_CONTROL_HOST_R6_ONLY";
export const R6_HOST_SOURCE_SHA="afdd8fab1c03b321e4b8b0853bb236c0800a0a14";
export const R6_HOST_SOURCE_MANIFEST_SHA256="42afb8fe4f0ecdeb551256ec897bb99b1e850420dd0f5bc7b74ec03db2f46c81";
export const R6_HOST_CANDIDATE_SHA256="ad8fcb8e2db72319475742414e72847cf97f388f09a5984601726d0d8ad32622";

/** The existing Controller recovery runbook is not a host B recovery path.
 * Classify only from freshly read live evidence and persisted BEFORE proofs.
 * The caller cannot infer installation PASS from a released/held lock alone. */
export function classifyR6HostRecovery(s){
 const fail=(code)=>({status:'RECOVERY_REQUIRED',code,action:'INSPECT_NO_MUTATION'});
 if(s.ledgerStatus!=='RECOVERY_REQUIRED'||s.installLeaseHeld!==true
   ||s.markerMatches!==true||s.ownerDead!==true)return fail('R6_RECOVERY_OWNER_OR_LEDGER_UNVERIFIED');
 if(s.protectedSame!==true||s.dbIdentitySame!==true)
  return fail('R6_RECOVERY_PROTECTED_OR_DB_IDENTITY_DRIFT');
 if(!['active','disabled_manually'].includes(s.workflowState))
  return fail('R6_RECOVERY_WORKFLOW_STATE_UNKNOWN');
 if((s.workflowState==='disabled_manually'||s.pauseAttempted===true)
   &&s.backlogExists!==true)
  return fail('R6_RECOVERY_PAUSE_WITHOUT_VERIFIED_BACKLOG');
 if(s.hostSha256===s.originalSha256)
  return {status:'ELIGIBLE',code:'R6_RECOVERY_ORIGINAL_HOST_VERIFIED',
   action:'RECONCILE_INTAKE',hostOutcome:s.rollbackMarkerValid?'ROLLED_BACK':'ORIGINAL_READBACK_NO_APPLY_PASS'};
 if(s.hostSha256!==s.proposedSha256)return fail('R6_RECOVERY_HOST_SHA_UNKNOWN');
 if(s.appliedMarkerValid===true)
  return {status:'ELIGIBLE',code:'R6_RECOVERY_APPLIED_MARKER_VERIFIED',
   action:'RECONCILE_INTAKE',hostOutcome:'APPLIED'};
 if(s.backupSha256===s.originalSha256&&s.journalValid===true
   &&s.workflowState==='disabled_manually')
  return {status:'ELIGIBLE',code:'R6_RECOVERY_ROLLBACK_BYTES_VERIFIED',
   action:'ROLLBACK_HOST',hostOutcome:null};
 return fail('R6_RECOVERY_BACKUP_OR_JOURNAL_NOT_VERIFIED');
}
/** Decide whether the original B recovery may advance after a process crash.
 * The caller must separately verify raw manifest/lease/ledger bytes, owner
 * death, Controller origin, protected state, DB identity and current host SHA. */
export function decideR6RecoveryReentry({mode,previous,decision,hostSha256,
 originalSha256,proposedSha256,archivedFinish=false}){
 const fail=()=>({allowed:false,code:'R6_RECOVERY_MODE_DOES_NOT_MATCH_ACTUAL_HOST'});
 if(!['rollback-host','reconcile-intake'].includes(mode))return fail();
 if(archivedFinish)return {allowed:true,operation:'FINALIZE_ARCHIVE',resumedRollback:false};
 if(decision?.status!=='ELIGIBLE')return fail();
 if(mode==='reconcile-intake')return decision.action==='RECONCILE_INTAKE'
  ?{allowed:true,operation:'RECONCILE_INTAKE',resumedRollback:false}:fail();
 if(decision.action==='ROLLBACK_HOST')return {allowed:true,
  operation:'ROLLBACK_HOST',resumedRollback:false};
 if(previous?.preHostSha256===proposedSha256
  &&hostSha256===originalSha256&&decision.action==='RECONCILE_INTAKE'
  &&decision.journalValid===true&&decision.backupReadbackVerified===true)
  return {allowed:true,operation:'RECONCILE_INTAKE',resumedRollback:true};
 return fail();
}
/** Exact same-request reservation match; PID liveness is checked separately. */
export function sameR6RecoveryClaim(claim,proof){
 return Boolean(claim&&proof&&Number.isSafeInteger(claim.pid)&&claim.pid>0
  &&/^[0-9a-f-]{36}$/.test(claim.nonce??'')
  &&Object.entries(proof).every(([key,value])=>claim[key]===value));
}
/** Read-only acknowledgement of an already archived recovery. It MUST NOT
 * authorize another archive, host restore, intake replay, or claim removal. */
export function verifyR6HistoricCompletion(x){
 if(x?.status!=='ARCHIVED_RECOVERY_EVIDENCE'
  ||x.recordStatus!=='RECOVERY_COMPLETED'||x.archiveVerified!==true
  ||x.originalLeaseAbsent!==true||x.ownerMarkerMatches!==true
  ||x.protectedSame!==true
  ||x.dbIdentitySame!==true||x.workflowActive!==true
  ||x.backlogVerified!==true)return false;
 const expected=x.hostOutcome==='APPLIED'?x.proposedSha256:
  ['ROLLED_BACK','ORIGINAL_READBACK_NO_APPLY_PASS'].includes(x.hostOutcome)
   ?x.originalSha256:null;
 return typeof expected==='string'&&/^[a-f0-9]{64}$/.test(expected)
  &&x.hostSha256===expected;
}
const R6_HOST_MANIFEST_KEYS=["schema","scope","sourceRepository","sourceBranch",
  "sourceSha","sourceManifestSha256","installedControllerSha",
  "hostOriginalSha256","proposedSha256","hostPath","candidatePath",
  "candidateSha256","stageBundle","backupDirectory","approval","checks","backup"];
const R6_HOST_CHECK_KEYS=["status","sourceManifestSha256","fileCount"];
const R6_HOST_BACKUP_KEYS=["strategy","rollback"];
const R6_HOST_ROLLBACK_KEYS=["kind","sha256"];
const MANIFEST_KEYS=[
  "schema","installedSha","targetSha","allowFiles","purpose","approval",
  "checks","backup","postOperation","postSourceBranch","postSourceSha",
];
const APPROVAL_KEYS=["grade","ref","scope"];
const CHECK_KEYS=["targetSha","status","manifestSha256"];
const BACKUP_KEYS=["strategy","rollback"];
const ROLLBACK_KEYS=["kind","sha"];
const FILE_KEYS=["path","sha256"];
const optionalManifestKeys=raw=>[...MANIFEST_KEYS,...
  ['infrastructureEvidence','controllerOnlyInstall','selectiveSource'].filter(k=>Object.hasOwn(raw,k))];
// The approval pins every deployed file and the updater checks the exact Git
// diff. New readonly adapters must not require replacing this maintainer just
// to append another filename. Keep paths confined to controller modules.
const installablePath=p=>p==='config/operations.json'||(typeof p==='string'&&/^controller\/[a-z][a-z0-9-]*\.mjs$/.test(p));
// Source-only colocated Node tests are never Controller runtime modules.
// They must be covered by source CI but not staged, approved, or deployed
// into the live six-seat Controller. Nothing else is silently excluded.
export const isControllerSourceTestPath=p=>typeof p==='string'&&
  /^controller\/[a-z][a-z0-9-]*\.test\.mjs$/.test(p);
export function deployableControllerTreePaths(paths){
  if(!Array.isArray(paths)||paths.length<5||
     new Set(paths).size!==paths.length||
     paths.some(p=>!installablePath(p)&&!isControllerSourceTestPath(p)))
    throw Error('TARGET_TREE_PATH');
  const deployed=paths.filter(p=>!isControllerSourceTestPath(p));
  if(deployed.length<5)throw Error('TARGET_TREE_PATH');
  return deployed;
}

const PURPOSE_SCOPE=Object.freeze({
  "fear-greed-archive-status":"FEAR_GREED_ARCHIVE_READONLY",
  "employment-r6-readonly-adapter":"EMPLOYMENT_R6_READONLY_RUNNER",
  "pc-controller-safety-fix":"PC_CONTROL_CONTROLLER_UPDATE",
  "pc-controller-maintenance":"PC_CONTROL_CONTROLLER_UPDATE",
  "pc-controller-heavy-readonly":"PC_CONTROL_HEAVY_READONLY_UPDATE",
  "pc-controller-moderate-readonly":"PC_CONTROL_MODERATE_READONLY_UPDATE",
});
const REPORTABLE_FAILURES=new Set([
  "RESOURCE_WAIT_MEMORY","RESOURCE_WAIT_LOCK","LEASE_BUSY","APPROVAL_NOT_FOUND",
  "APPROVAL_SCOPE_MISMATCH","SOURCE_DRIFT","MANIFEST_DRIFT",
  "BACKUP_FAILED","INSTALL_FAILED","POSTCHECK_TIMEOUT",
  "POSTCHECK_FAILED","RUNNER_OFFLINE","WORKER_RESULT_MISSING",
  "UPDATE_PROTECTED_STATE_DRIFT","UPDATE_INSTALLED_SHA_MISMATCH",
  "UPDATE_ROLLBACK_READBACK_FAILED",
]);
const SHA40=/^[a-f0-9]{40}$/;
const SHA256=/^[a-f0-9]{64}$/;
const UUID="[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}";
const REQUEST_ID=new RegExp("^pc-(?:update-)?"+UUID+"$");
// Conversation correlation is not authority. Keep it bounded and data-only,
// while accepting the safe trace labels already used by ordinary PC jobs.
const CHAT_ID=CONVERSATION_TRACE_ID;
const sha256=value=>createHash("sha256").update(value).digest("hex");
export function readAllMaintenancePages(readPage,{maxPages=100}={}){
 const out=[];
 for(let page=1;page<=maxPages;page++){
  const rows=readPage(page);if(!Array.isArray(rows))throw Error('PAGINATION_RESPONSE_INVALID');
  out.push(...rows);if(rows.length<100)return out;
 }
 throw Error('PAGINATION_INCOMPLETE');
}

function requireKeys(object,expected,code){
  if(!object||typeof object!=="object"||Array.isArray(object))throw Error(code);
  const actual=Object.keys(object).sort();
  if(actual.length!==expected.length||actual.some((x,i)=>x!==[...expected].sort()[i]))throw Error(code);
}
function requireString(value,pattern,code){
  if(typeof value!=="string"||!pattern.test(value))throw Error(code);
  return value;
}
function requireSha(value,code){return requireString(value,SHA40,code);}
function requireDigest(value,code){return requireString(value,SHA256,code);}

/** Deterministic manifest hash; paths are validated and sorted before use. */
export function manifestFingerprint(files){
  if(!Array.isArray(files)||files.length<1){
    throw Error("UPDATE_FILE_MANIFEST_INVALID");
  }
  const seen=new Set();
  const normalized=files.map(file=>{
    requireKeys(file,FILE_KEYS,"UPDATE_FILE_ENTRY_INVALID");
    if(!installablePath(file.path)||seen.has(file.path))throw Error("UPDATE_FILE_PATH_NOT_ALLOWED");
    seen.add(file.path);
    return {path:file.path,sha256:requireDigest(file.sha256,"UPDATE_FILE_SHA256_INVALID")};
  }).sort((a,b)=>a.path.localeCompare(b.path));
  return {files:normalized,sha256:sha256(JSON.stringify(normalized))};
}

/** Exact approved source changes must not mutate the six-seat controller's
 * operating policy. Even B-grade read-only diagnosis approval does not grant
 * permission to change existing operations, providers or write controls. */
export function controllerAdmissionForPurpose(purpose){
  if(purpose==='pc-controller-heavy-readonly')return {resourceProfile:'HEAVY_READONLY_240_1536'};
  if(purpose==='pc-controller-moderate-readonly')return {resourceProfile:'MODERATE_READONLY_180_1024'};
  // Historical R6 manifests retain their exact, narrow scope. New features use
  // the resource profile above, never a new hardcoded operation-name exception.
  if(purpose==='employment-r6-readonly-adapter')return {resourceProfile:'LEGACY_R6_ONLY'};
  return {resourceProfile:'LIGHT_READONLY_90'};
}
export function validateControllerConfigTransition(previous,next,{resourceProfile='LIGHT_READONLY_90'}={}){
  const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
  if(!object(previous)||!object(next)||!object(previous.operations)||
    !object(next.operations))throw Error('CONTROLLER_CONFIG_INVALID');
  if(previous.seats!==6||next.seats!==6||
    previous.mutationsEnabled!==false||next.mutationsEnabled!==false){
    throw Error('CONTROLLER_CONFIG_WRITE_OR_SEATS_CHANGED');
  }
  const protectedKeys=x=>Object.keys(x).filter(key=>key!=='operations').sort();
  const keys=protectedKeys(previous);
  if(JSON.stringify(keys)!==JSON.stringify(protectedKeys(next))||
    keys.some(key=>JSON.stringify(previous[key])!==JSON.stringify(next[key]))){
    throw Error('CONTROLLER_CONFIG_PROTECTED_POLICY_CHANGED');
  }
  for(const [name,definition] of Object.entries(previous.operations)){
    if(!Object.hasOwn(next.operations,name)||
      JSON.stringify(definition)!==JSON.stringify(next.operations[name])){
      throw Error('CONTROLLER_EXISTING_OPERATION_CHANGED');
    }
  }
  for(const [name,definition] of Object.entries(next.operations)){
    if(Object.hasOwn(previous.operations,name))continue;
    const allowedLight=object(definition)
      &&Object.keys(definition).sort().join(',')==='grade,resource,timeoutSeconds'
      &&definition.grade==='A'&&definition.resource==='light'
      &&Number.isSafeInteger(definition.timeoutSeconds)
      &&definition.timeoutSeconds>=1&&definition.timeoutSeconds<=90;
    const heavyShape=object(definition)
      &&Object.keys(definition).sort().join(',')==='grade,minimumFreeMiB,resource,timeoutSeconds'
      &&definition.grade==='A'&&definition.resource==='heavy'
      &&definition.timeoutSeconds===240&&definition.minimumFreeMiB===1536;
    // Uses the existing exclusive heavy lease (maxHeavyJobs remains one).
    // The smaller memory gate is opt-in through an exact B-grade purpose;
    // it is never enabled for existing operations or by ordinary pc-job input.
    const moderateShape=object(definition)
      &&Object.keys(definition).sort().join(',')==='grade,minimumFreeMiB,resource,timeoutSeconds'
      &&definition.grade==='A'&&definition.resource==='heavy'
      &&Number.isSafeInteger(definition.timeoutSeconds)
      &&definition.timeoutSeconds>=91&&definition.timeoutSeconds<=180
      &&definition.minimumFreeMiB===1024;
    const approvedHeavy=heavyShape&&(resourceProfile==='HEAVY_READONLY_240_1536'||
      (resourceProfile==='LEGACY_R6_ONLY'&&name==='employment-r6-candidate-stage-readonly'));
    const approvedModerate=moderateShape&&resourceProfile==='MODERATE_READONLY_180_1024';
    if(!/^[a-z][a-z0-9-]{2,60}$/.test(name)||!(allowedLight||approvedHeavy||approvedModerate)){
      throw Error('CONTROLLER_NEW_OPERATION_NOT_READONLY_A');
    }
  }
  return true;
}

/**
 * Accept a maintenance request ONLY with independent, locally trusted context.
 * approvedTargets is an installation-time immutable SHA allowlist, not a value
 * supplied by the Issue body. Absence of that allowlist is a hard stop.
 */
export function validateMaintenanceRequest(request,{
  controlRepository=CONTROL_REPOSITORY,actor=null,allowedActors=[CONTROL_ACTOR],
}={}){
  if(controlRepository!==CONTROL_REPOSITORY||request?.controlRepository!==CONTROL_REPOSITORY){
    throw Error("UPDATE_CONTROL_REPOSITORY_NOT_ALLOWED");
  }
  if(actor!==CONTROL_ACTOR||!Array.isArray(allowedActors)
    ||!allowedActors.includes(CONTROL_ACTOR))throw Error("UPDATE_ACTOR_NOT_ALLOWED");
  requireKeys(request,ISSUE_KEYS,"UPDATE_ISSUE_FIELDS_INVALID");
  if(request.schema!==MAINTENANCE_ISSUE_SCHEMA)throw Error("UPDATE_ISSUE_SCHEMA_NOT_SUPPORTED");
  requireString(request.requestId,REQUEST_ID,"UPDATE_REQUEST_ID_INVALID");
  requireString(request.chatId,CHAT_ID,"UPDATE_CHAT_ID_INVALID");
  if(request.operation!=="controller-update")throw Error("UPDATE_OPERATION_NOT_ALLOWED");
  requireSha(request.targetControllerSha,"UPDATE_TARGET_SHA_INVALID");
  requireDigest(request.approvalManifestSha256,"UPDATE_MANIFEST_PIN_INVALID");
  return Object.freeze({...request});
}

// Exact #2960 installed-state reconciliation: a distinct request may be
// admitted only by the existing independent maintenance receiver. No generic
// commands, issue-selected recovery IDs or source SHA are accepted.
export const INSTALLED_RECOVERY_OPERATION='controller-installed-recovery';
export const INSTALLED_RECOVERY_ISSUE_TITLE='pc-controller-installed-recovery';
export const INSTALLED_RECOVERY_ORIGINAL_ID='pc-update-e8767e20-6bad-4418-97c6-561cf79a8213';
export const INSTALLED_RECOVERY_SOURCE_SHA='e6c96e8d19bd9084b8021c7df31678f56ef1b388';
export const INSTALLED_RECOVERY_CONTROLLER_SHA='b9a423cf38d0967d6ed336912a66433f79502d3d';
export const INSTALLED_RECOVERY_MANIFEST_PATH=
 'approvals/maintenance-recoveries/'+INSTALLED_RECOVERY_ORIGINAL_ID+'.installed.json';
export function validateInstalledRecoveryIssueEnvelope(request,{
 controlRepository=CONTROL_REPOSITORY,actor=null,allowedActors=[CONTROL_ACTOR],
}={}){
 if(controlRepository!==CONTROL_REPOSITORY||request?.controlRepository!==CONTROL_REPOSITORY||
   actor!==CONTROL_ACTOR||!Array.isArray(allowedActors)||!allowedActors.includes(CONTROL_ACTOR))
  throw Error('INSTALLED_RECOVERY_ACTOR_DENIED');
 requireKeys(request,ISSUE_KEYS,'INSTALLED_RECOVERY_ISSUE_FIELDS_INVALID');
 if(request.schema!==MAINTENANCE_ISSUE_SCHEMA||
   request.operation!==INSTALLED_RECOVERY_OPERATION)
  throw Error('INSTALLED_RECOVERY_OPERATION_DENIED');
 requireString(request.requestId,REQUEST_ID,'INSTALLED_RECOVERY_REQUEST_ID_INVALID');
 if(request.requestId===INSTALLED_RECOVERY_ORIGINAL_ID)
  throw Error('INSTALLED_RECOVERY_ORIGINAL_REPLAY_DENIED');
 requireString(request.chatId,CHAT_ID,'INSTALLED_RECOVERY_CHAT_ID_INVALID');
 if(request.targetControllerSha!==INSTALLED_RECOVERY_CONTROLLER_SHA)
  throw Error('INSTALLED_RECOVERY_TARGET_DENIED');
 requireDigest(request.approvalManifestSha256,'INSTALLED_RECOVERY_MANIFEST_PIN_INVALID');
 return Object.freeze({...request});
}
export function prepareInstalledRecoveryRequest(approvedRawBytes,{chatId}={}){
 const raw=JSON.parse(Buffer.from(approvedRawBytes).toString('utf8'));
 if(raw?.schema!=='ZGMINI_PC_INSTALLED_RECOVERY_APPROVAL_V1'||
   raw.approved!==true||raw.operation!=='RECONCILE_INSTALLED'||
   raw.requestId!==INSTALLED_RECOVERY_ORIGINAL_ID||raw.issueNumber!==2960||
   raw.sourceSha!==INSTALLED_RECOVERY_SOURCE_SHA||
   raw.targetControllerSha!==INSTALLED_RECOVERY_CONTROLLER_SHA)
   throw Error('INSTALLED_RECOVERY_APPROVAL_UNVERIFIED');
 return validateInstalledRecoveryIssueEnvelope({
  schema:MAINTENANCE_ISSUE_SCHEMA,requestId:'pc-'+randomUUID(),
  chatId:chatId??('chat-'+randomUUID()),operation:INSTALLED_RECOVERY_OPERATION,
  controlRepository:CONTROL_REPOSITORY,
  targetControllerSha:INSTALLED_RECOVERY_CONTROLLER_SHA,
  approvalManifestSha256:sha256(approvedRawBytes),
 },{actor:CONTROL_ACTOR});
}

// Client-side construction, not new authority. Existing manifest/actor/source
// validation still decides admission. Callers no longer handcraft UUID fields.
export function prepareControllerUpdateRequest(manifestBytes,{installedSha,chatId}={}){
  const raw=JSON.parse(manifestBytes.toString());
  const request={schema:MAINTENANCE_ISSUE_SCHEMA,
    requestId:'pc-update-'+randomUUID(),chatId:chatId??('chat-'+randomUUID()),
    operation:'controller-update',controlRepository:CONTROL_REPOSITORY,
    targetControllerSha:raw.targetSha,approvalManifestSha256:sha256(manifestBytes)};
  validateUpdateRequest(request,manifestBytes,{actor:CONTROL_ACTOR,installedSha});
  return Object.freeze(request);
}

/** Strict pre-admission for the single, pinned R6 host B request. The seven
 * Issue keys deliberately match controller-update but the operation differs;
 * this function cannot authorize a Controller switch or arbitrary commands. */
export function validateR6HostIssueEnvelope(request,{
  controlRepository=CONTROL_REPOSITORY,actor=null,allowedActors=[CONTROL_ACTOR],
}={}){
  if(controlRepository!==CONTROL_REPOSITORY||request?.controlRepository!==CONTROL_REPOSITORY)
    throw Error("R6_HOST_CONTROL_REPOSITORY_NOT_ALLOWED");
  if(actor!==CONTROL_ACTOR||!Array.isArray(allowedActors)
    ||!allowedActors.includes(CONTROL_ACTOR))throw Error("R6_HOST_ACTOR_NOT_ALLOWED");
  requireKeys(request,ISSUE_KEYS,"R6_HOST_ISSUE_FIELDS_INVALID");
  if(request.schema!==MAINTENANCE_ISSUE_SCHEMA)throw Error("R6_HOST_ISSUE_SCHEMA_INVALID");
  requireString(request.requestId,REQUEST_ID,"R6_HOST_REQUEST_ID_INVALID");
  requireString(request.chatId,CHAT_ID,"R6_HOST_CHAT_ID_INVALID");
  if(request.operation!==R6_HOST_OPERATION)throw Error("R6_HOST_OPERATION_NOT_ALLOWED");
  requireSha(request.targetControllerSha,"R6_HOST_TARGET_CONTROLLER_SHA_INVALID");
  requireDigest(request.approvalManifestSha256,"R6_HOST_MANIFEST_PIN_INVALID");
  return Object.freeze({...request});
}

/** Validate a GitHub-main approved manifest's *raw bytes*, then pin it to the
 * live installed Controller SHA supplied independently by the maintainer.
 * Windows ownership, active lease, source readback, PR merge status and host
 * byte CAS MUST still be verified by the B-grade updater at execution time. */
export function validateR6HostRegistrationRequest(request,manifestBytes,{
  controlRepository=CONTROL_REPOSITORY,actor=null,allowedActors=[CONTROL_ACTOR],
  installedSha=null,
}={}){
  const approvedRequest=validateR6HostIssueEnvelope(request,
    {controlRepository,actor,allowedActors});
  if(!SHA40.test(String(installedSha??""))||installedSha!==approvedRequest.targetControllerSha)
    throw Error("R6_HOST_INSTALLED_CONTROLLER_SHA_DRIFT");
  if(!(typeof manifestBytes==="string"||Buffer.isBuffer(manifestBytes)))
    throw Error("R6_HOST_MANIFEST_BYTES_REQUIRED");
  const bytes=Buffer.isBuffer(manifestBytes)?manifestBytes:Buffer.from(manifestBytes,"utf8");
  if(bytes.length===0||bytes.length>32768)throw Error("R6_HOST_MANIFEST_TOO_LARGE");
  if(sha256(bytes)!==approvedRequest.approvalManifestSha256)
    throw Error("R6_HOST_MANIFEST_PIN_MISMATCH");
  let manifest;
  try{manifest=JSON.parse(bytes.toString("utf8"));}
  catch{throw Error("R6_HOST_MANIFEST_JSON_INVALID");}
  requireKeys(manifest,R6_HOST_MANIFEST_KEYS,"R6_HOST_MANIFEST_FIELDS_INVALID");
  if(manifest.schema!==R6_HOST_SCHEMA||manifest.scope!==R6_HOST_SCOPE)
    throw Error("R6_HOST_MANIFEST_SCHEMA_OR_SCOPE_INVALID");
  if(manifest.sourceRepository!=="ansqhd5774-Choi/zgmini"
    ||manifest.sourceBranch!=="codex/employment-1y-reader-r1"
    ||manifest.sourceSha!==R6_HOST_SOURCE_SHA
    ||manifest.sourceManifestSha256!==R6_HOST_SOURCE_MANIFEST_SHA256)
    throw Error("R6_HOST_SOURCE_PIN_MISMATCH");
  if(manifest.installedControllerSha!==installedSha)
    throw Error("R6_HOST_INSTALLED_CONTROLLER_SHA_DRIFT");
  requireDigest(manifest.hostOriginalSha256,"R6_HOST_ORIGINAL_SHA_INVALID");
  requireDigest(manifest.proposedSha256,"R6_HOST_PROPOSED_SHA_INVALID");
  if(manifest.hostOriginalSha256===manifest.proposedSha256)
    throw Error("R6_HOST_NO_EFFECT_OR_INVALID_PROPOSAL");
  if(manifest.candidateSha256!==R6_HOST_CANDIDATE_SHA256)
    throw Error("R6_HOST_CANDIDATE_SHA_MISMATCH");
  const fixedHost="E:/ZGmini/automation/pc-control/host.json";
  const fixedCandidate="E:/ZGmini/data/employment-r6-candidate-isolated-20261103/EMPLOYMENT_R6_CANDIDATE.sqlite";
  const fixedStage=`E:/ZGmini/automation/pc-control/source-bundles/r6-bundle-${R6_HOST_SOURCE_SHA}`;
  const fixedBackup=`E:/ZGmini/automation/pc-control/backups/r6-host-${approvedRequest.requestId}`;
  if(manifest.hostPath!==fixedHost||manifest.candidatePath!==fixedCandidate
    ||manifest.stageBundle!==fixedStage||manifest.backupDirectory!==fixedBackup)
    throw Error("R6_HOST_PATH_SCOPE_INVALID");
  requireKeys(manifest.approval,APPROVAL_KEYS,"R6_HOST_APPROVAL_FIELDS_INVALID");
  if(manifest.approval.grade!=="B"||manifest.approval.scope!==R6_HOST_SCOPE
    ||!/^https:\/\/github\.com\/ansqhd5774-Choi\/zgmini-pc-control\/pull\/[1-9]\d*$/.test(manifest.approval.ref))
    throw Error("R6_HOST_B_APPROVAL_REQUIRED");
  requireKeys(manifest.checks,R6_HOST_CHECK_KEYS,"R6_HOST_CHECKS_FIELDS_INVALID");
  if(manifest.checks.status!=="PASS"||manifest.checks.fileCount!==16
    ||manifest.checks.sourceManifestSha256!==R6_HOST_SOURCE_MANIFEST_SHA256)
    throw Error("R6_HOST_SOURCE_CHECKS_NOT_VERIFIED");
  requireKeys(manifest.backup,R6_HOST_BACKUP_KEYS,"R6_HOST_BACKUP_FIELDS_INVALID");
  requireKeys(manifest.backup.rollback,R6_HOST_ROLLBACK_KEYS,"R6_HOST_ROLLBACK_FIELDS_INVALID");
  if(manifest.backup.strategy!=="VERSIONED_SNAPSHOT"
    ||manifest.backup.rollback.kind!=="RESTORE_HOST_SHA256"
    ||manifest.backup.rollback.sha256!==manifest.hostOriginalSha256)
    throw Error("R6_HOST_ROLLBACK_CONTRACT_INVALID");
  return Object.freeze({request:approvedRequest,manifest:Object.freeze({
    ...manifest,approval:Object.freeze({...manifest.approval}),
    checks:Object.freeze({...manifest.checks}),
    backup:Object.freeze({...manifest.backup,
      rollback:Object.freeze({...manifest.backup.rollback})}),
  })});
}

/**
 * The Issue pins exact manifest file BYTES. Never trust parsed JSON alone:
 * a different byte representation or post-approval edit must be rejected.
 */
export function validateUpdateRequest(issue,manifestBytes,{
  controlRepository=CONTROL_REPOSITORY,actor=null,allowedActors=[CONTROL_ACTOR],
  installedSha=null,approvedTargets=null,
}={}){
  const request=validateMaintenanceRequest(issue,{controlRepository,actor,allowedActors});
  if(!(typeof manifestBytes==="string"||Buffer.isBuffer(manifestBytes))){
    throw Error("UPDATE_MANIFEST_BYTES_REQUIRED");
  }
  if(Buffer.byteLength(manifestBytes)>32768)throw Error("UPDATE_MANIFEST_TOO_LARGE");
  if(sha256(manifestBytes)!==request.approvalManifestSha256){
    throw Error("UPDATE_MANIFEST_PIN_MISMATCH");
  }
  let raw;
  try{raw=JSON.parse(manifestBytes.toString());}
  catch{throw Error("UPDATE_MANIFEST_JSON_INVALID");}
  requireKeys(raw,optionalManifestKeys(raw),"UPDATE_MANIFEST_FIELDS_INVALID");
  if(raw.schema!==UPDATE_SCHEMA)throw Error("UPDATE_SCHEMA_NOT_SUPPORTED");
  requireSha(raw.installedSha,"UPDATE_INSTALLED_SHA_INVALID");
  requireSha(raw.targetSha,"UPDATE_TARGET_SHA_INVALID");
  if(raw.targetSha!==request.targetControllerSha)throw Error("UPDATE_TARGET_MANIFEST_MISMATCH");
  if(raw.installedSha===raw.targetSha)throw Error("UPDATE_TARGET_EQUALS_INSTALLED");
  if(!SHA40.test(String(installedSha??""))||installedSha!==raw.installedSha){
    throw Error("UPDATE_INSTALLED_SOURCE_DRIFT");
  }
  // Optional immutable local pin (for a first bootstrap or particularly sensitive
  // change). Ordinary later approvals may use a separate verified B manifest and
  // authenticated maintenance Issue without another PC-local command.
  if(approvedTargets!==null && (!Array.isArray(approvedTargets)||!approvedTargets.includes(raw.targetSha))){
    throw Error("UPDATE_TARGET_NOT_APPROVED");
  }
  const manifest=manifestFingerprint(raw.allowFiles);
  if(!Object.hasOwn(PURPOSE_SCOPE,raw.purpose))throw Error("UPDATE_PURPOSE_NOT_ALLOWED");
  requireKeys(raw.approval,APPROVAL_KEYS,"UPDATE_APPROVAL_FIELDS_INVALID");
  if(raw.approval.grade!=="B"
    ||raw.approval.scope!==PURPOSE_SCOPE[raw.purpose]
    ||!/^https:\/\/github\.com\/ansqhd5774-Choi\/zgmini-pc-control\/pull\/[1-9]\d*$/.test(raw.approval.ref)){
    throw Error("UPDATE_B_APPROVAL_REQUIRED");
  }
  requireKeys(raw.checks,CHECK_KEYS,"UPDATE_CHECKS_FIELDS_INVALID");
  if(raw.checks.status!=="PASS"||raw.checks.targetSha!==raw.targetSha
    ||raw.checks.manifestSha256!==manifest.sha256){
    throw Error("UPDATE_TARGET_CHECKS_NOT_VERIFIED");
  }
  requireKeys(raw.backup,BACKUP_KEYS,"UPDATE_BACKUP_FIELDS_INVALID");
  requireKeys(raw.backup.rollback,ROLLBACK_KEYS,"UPDATE_ROLLBACK_FIELDS_INVALID");
  if(raw.backup.strategy!=="VERSIONED_SNAPSHOT"
    ||raw.backup.rollback.kind!=="RESTORE_INSTALLED_SHA"
    ||raw.backup.rollback.sha!==raw.installedSha){
    throw Error("UPDATE_ROLLBACK_NOT_VERIFIED");
  }
   if(!CONTROLLER_POST_OPERATIONS.includes(raw.postOperation)){
    throw Error("UPDATE_POST_OPERATION_NOT_ALLOWED");
  }
  // Explicit controller/config-only install does not stage unrelated merged
  // scripts/workflows; live workflow changes remain outside this exception.
  if(Object.hasOwn(raw,'controllerOnlyInstall')&&
    (raw.controllerOnlyInstall!==true||
     !['pc-controller-maintenance','pc-controller-heavy-readonly'].includes(raw.purpose)||
     Object.hasOwn(raw,'infrastructureEvidence')))
    throw Error('CONTROLLER_ONLY_INSTALL_SCOPE_INVALID');
  // Selective source is a separate B-approved Controller overlay, not a way to
  // reinterpret an unapproved main tree or to introduce extra operation effects.
  if(Object.hasOwn(raw,'selectiveSource')){
    const x=raw.selectiveSource;
    if(!x||typeof x!=='object'||Array.isArray(x))
      throw Error('SELECTIVE_SOURCE_FIELDS_INVALID');
    requireKeys(x,['schema','branch','mainSha','customPaths'],
      'SELECTIVE_SOURCE_FIELDS_INVALID');
    if(x.schema!=='ZGMINI_CONTROLLER_SELECTIVE_SOURCE_V1'||
      raw.controllerOnlyInstall!==true||raw.purpose!=='pc-controller-maintenance'||
      Object.hasOwn(raw,'infrastructureEvidence'))
      throw Error('SELECTIVE_SOURCE_SCOPE_INVALID');
    requireSha(x.mainSha,'SELECTIVE_SOURCE_MAIN_SHA_INVALID');
    if(typeof x.branch!=='string'||
      !/^codex\/[a-z0-9][a-z0-9-]{3,94}$/.test(x.branch))
      throw Error('SELECTIVE_SOURCE_BRANCH_INVALID');
    if(!Array.isArray(x.customPaths)||x.customPaths.length>manifest.files.length||
      new Set(x.customPaths).size!==x.customPaths.length||
      x.customPaths.some(p=>!manifest.files.some(f=>f.path===p)))
      throw Error('SELECTIVE_SOURCE_CUSTOM_PATH_INVALID');
  }
  if(typeof raw.postSourceBranch!=="string"
    ||!(/^(?:main|codex\/[a-z0-9][a-z0-9./_-]{2,100})$/.test(raw.postSourceBranch))
    ||raw.postSourceBranch.includes(".."))throw Error("UPDATE_POST_SOURCE_BRANCH_INVALID");
  requireSha(raw.postSourceSha,"UPDATE_POST_SOURCE_SHA_INVALID");
  if(raw.infrastructureEvidence){
    const e=raw.infrastructureEvidence;
    requireKeys(e,['schema','approvalRef','files'],'UPDATE_INFRA_FIELDS_INVALID');
    if(e.schema!=='ZGMINI_NON_DEPLOYED_INFRA_ACK_V1'||!/^https:\/\/github\.com\/ansqhd5774-Choi\/zgmini-pc-control\/pull\/[1-9]\d*$/.test(e.approvalRef)||!Array.isArray(e.files)||!e.files.length)
      throw Error('UPDATE_INFRA_EVIDENCE_INVALID');
    const seen=new Set();for(const f of e.files){
      requireKeys(f,FILE_KEYS,'UPDATE_INFRA_FILE_INVALID');
      if(!/^(\.github|scripts)\/[a-zA-Z0-9_./-]+$/.test(f.path)||f.path.split('/').some(x=>x==='..'||x==='.')||seen.has(f.path))throw Error('UPDATE_INFRA_FILE_INVALID');
      requireDigest(f.sha256,'UPDATE_INFRA_HASH_INVALID');seen.add(f.path);
    }
  }
  const normalized=Object.freeze({
    schema:UPDATE_SCHEMA,installedSha:raw.installedSha,
    targetSha:raw.targetSha,allowFiles:manifest.files.map(file=>Object.freeze(file)),
    purpose:raw.purpose,approval:Object.freeze({...raw.approval}),
    checks:Object.freeze({...raw.checks}),
    backup:Object.freeze({strategy:"VERSIONED_SNAPSHOT",rollback:Object.freeze({...raw.backup.rollback})}),
    postOperation:raw.postOperation,postSourceBranch:raw.postSourceBranch,
    postSourceSha:raw.postSourceSha,
    ...(raw.controllerOnlyInstall===true?{controllerOnlyInstall:true}:{}),
    ...(raw.selectiveSource?{selectiveSource:Object.freeze({
      schema:raw.selectiveSource.schema,branch:raw.selectiveSource.branch,
      mainSha:raw.selectiveSource.mainSha,
      customPaths:Object.freeze([...raw.selectiveSource.customPaths].sort())
    })}:{}),
    ...(raw.infrastructureEvidence?{infrastructureEvidence:structuredClone(raw.infrastructureEvidence)}:{}),
  });
  return Object.freeze({request,manifest:normalized});
}

export function requestFingerprint(validated){
  // A caller must pass the normalized pair from validateUpdateRequest().
  requireKeys(validated,["request","manifest"],"UPDATE_VALIDATED_PAIR_REQUIRED");
  requireKeys(validated.request,ISSUE_KEYS,"UPDATE_ISSUE_FIELDS_INVALID");
  requireKeys(validated.manifest,optionalManifestKeys(validated.manifest),"UPDATE_MANIFEST_FIELDS_INVALID");
  return sha256(JSON.stringify(validated));
}
export function validateInfrastructureDelta(paths,evidence,readBytes){
 const changed=paths.filter(p=>p.startsWith('.github/')||p.startsWith('scripts/')).sort();
 if(!changed.length&&!evidence)return true;
 if(!evidence||JSON.stringify(changed)!==JSON.stringify(evidence.files.map(f=>f.path).sort()))throw Error('UNAPPROVED_INFRA_CHANGE');
 for(const f of evidence.files)if(sha256(readBytes(f.path))!==f.sha256)throw Error('UPDATE_INFRA_HASH_MISMATCH');
 return true;
}

// Current main behavior: explicit controller-only approvals compare exactly
// installed controller/config paths, without unapproved workflow mutations.
/** A reviewed, immutable main pin authorizes ONE exact installed-tree overlay.
 * The committed target must have installedSha as its sole parent and the
 * installed->target Git diff must equal allowFiles (verified by the operator).
 * A main PR must contain this exact pin. No Issue-controlled path is read. */
export function validateControllerSelectivePin(manifest,pin){
 const x=manifest?.selectiveSource;
 if(!x||!pin||typeof pin!=='object'||Array.isArray(pin))
   throw Error('SELECTIVE_PIN_MISSING');
 requireKeys(pin,['schema','installedSha','targetSha','sourceMainSha',
   'targetBranch','customPaths','allowFiles','approvalRef'],
   'SELECTIVE_PIN_FIELDS_INVALID');
 if(pin.schema!=='ZGMINI_CONTROLLER_SELECTIVE_PIN_V1'||
   pin.installedSha!==manifest.installedSha||
   pin.targetSha!==manifest.targetSha||
   pin.sourceMainSha!==x.mainSha||
   pin.targetBranch!==x.branch||
   pin.approvalRef!==manifest.approval.ref||
   !Array.isArray(pin.customPaths)||
   JSON.stringify([...pin.customPaths].sort())!==JSON.stringify(x.customPaths)||
   JSON.stringify(manifestFingerprint(pin.allowFiles).files)!==
     JSON.stringify(manifestFingerprint(manifest.allowFiles).files))
   throw Error('SELECTIVE_PIN_MISMATCH');
 return true;
}


// Extract only JavaScript import specifiers, excluding strings, comments,
// regular expressions and literal patch templates. No code execution.
export function controllerModuleSpecifiers(source){
 if(typeof source!=='string')throw Object.assign(Error('CONTROLLER_IMPORT_SOURCE_INVALID'),{code:'CONTROLLER_IMPORT_SOURCE_INVALID'});
 const tokens=[];
 const add=(type,value)=>tokens.push({type,value});
 let i=0;
 while(i<source.length){
  const ch=source[i],next=source[i+1];
  if(/\s/.test(ch)){i++;continue;}
  if(ch==='/'&&next==='/'){i+=2;while(i<source.length&&source[i]!=='\n')i++;continue;}
  if(ch==='/'&&next==='*'){
   i+=2;const close=source.indexOf('*/',i);
   if(close<0)throw Object.assign(Error('CONTROLLER_IMPORT_SOURCE_INVALID'),{code:'CONTROLLER_IMPORT_SOURCE_INVALID'});
   i=close+2;continue;
  }
  if(ch==="'"||ch==='"'||ch.charCodeAt(0)===96){
   const quote=ch,template=ch.charCodeAt(0)===96;let value='';i++;let closed=false;
   while(i<source.length){
    const c=source[i++];
    if(c==='\\'){if(i<source.length){const escaped=source[i++];value+='\\'+escaped;}continue;}
    if(c===quote){closed=true;break;}
    value+=c;
   }
   if(!closed)throw Object.assign(Error('CONTROLLER_IMPORT_SOURCE_INVALID'),{code:'CONTROLLER_IMPORT_SOURCE_INVALID'});
   if(!template)add('string',value);
   continue;
  }
  if(ch==='/'&&tokens.length&&['=','(',':',',','[','!','?',';','return','=>','{','&','|','+','-','*','%','^','~','<','>'].includes(tokens.at(-1).value)){
   i++;let escaped=false,inClass=false,closed=false;
   while(i<source.length){
    const c=source[i++];
    if(escaped){escaped=false;continue;}
    if(c==='\\'){escaped=true;continue;}
    if(c==='['){inClass=true;continue;}
    if(c===']'){inClass=false;continue;}
    if(c==='/'&&!inClass){closed=true;break;}
   }
   if(!closed)throw Object.assign(Error('CONTROLLER_IMPORT_SOURCE_INVALID'),{code:'CONTROLLER_IMPORT_SOURCE_INVALID'});
   while(i<source.length&&/[a-z]/i.test(source[i]))i++;
   add('regex','');continue;
  }
  if(/[a-zA-Z_$]/.test(ch)){
   const begin=i++;while(i<source.length&&/[a-zA-Z0-9_$]/.test(source[i]))i++;
   add('word',source.slice(begin,i));continue;
  }
  if(ch==='='&&next==='>'){add('punc','=>');i+=2;continue;}
  add('punc',ch);i++;
 }
 const out=[];
 for(let j=0;j<tokens.length;j++){
  const word=tokens[j].value;
  if(word==='from'&&tokens[j+1]?.type==='string')out.push(tokens[j+1].value);
  if(word!=='import')continue;
  if(tokens[j+1]?.type==='string')out.push(tokens[j+1].value);
  else if(tokens[j+1]?.value==='('&&tokens[j+2]?.type==='string'&&tokens[j+3]?.value===')')
   out.push(tokens[j+2].value);
 }
 return out;
}

// Reject unresolved dependencies in the exact deployed target tree, including
// transitive imports; no mutation, scripts or runtime imports occur here.
// The runtime entry and operation dispatcher must remain import-complete even
// when the exact approved change only touches config or an unrelated adapter.
// Verify against the approved target tree, never against current main.
export function controllerImportScanRoots(changedPaths){
 if(!Array.isArray(changedPaths)||changedPaths.some(p=>typeof p!=='string'))
  throw Object.assign(Error('CONTROLLER_IMPORT_INPUT_INVALID'),{code:'CONTROLLER_IMPORT_INPUT_INVALID'});
 return [...new Set(['controller/entry.mjs','controller/operations.mjs',
  ...changedPaths.filter(p=>p.startsWith('controller/')&&p.endsWith('.mjs'))])];
}

export function validateControllerImportClosure(paths,changedPaths,readSource){
 if(!Array.isArray(paths)||!Array.isArray(changedPaths)||typeof readSource!=='function')
  throw Object.assign(Error('CONTROLLER_IMPORT_INPUT_INVALID'),{code:'CONTROLLER_IMPORT_INPUT_INVALID'});
 const files=new Set(paths),pending=changedPaths.filter(p=>p.startsWith('controller/')&&p.endsWith('.mjs'));
 const seen=new Set();
 while(pending.length){
  const current=pending.pop();if(seen.has(current))continue;seen.add(current);
  if(!files.has(current))throw Object.assign(Error('CONTROLLER_IMPORT_MISSING'),{code:'CONTROLLER_IMPORT_MISSING'});
  const source=readSource(current);
  for(const spec of controllerModuleSpecifiers(source)){
   if(!spec.startsWith('.'))continue;
   const resolved=path.posix.normalize(path.posix.join(path.posix.dirname(current),spec));
   if(!resolved.startsWith('controller/')||!files.has(resolved))
    throw Object.assign(Error('CONTROLLER_IMPORT_MISSING'),{code:'CONTROLLER_IMPORT_MISSING'});
   if(resolved.endsWith('.mjs')&&!seen.has(resolved))pending.push(resolved);
  }
 }
 return {status:'VERIFIED',checkedModules:seen.size};
}

export function validateControllerOnlyInstallDelta(paths,allowFiles){
 if(!Array.isArray(paths)||!Array.isArray(allowFiles)||
  paths.some(p=>typeof p!=='string'||p.includes('..')))
  throw Error('CONTROLLER_ONLY_DIFF_INVALID');
 if(paths.includes('.github/workflows/pc-job.yml'))
  throw Error('CONTROLLER_ONLY_LIVE_WORKFLOW_CHANGED');
 const installed=paths.filter(p=>(p.startsWith('controller/')||
  p.startsWith('config/'))&&!isControllerSourceTestPath(p)).sort();
 const declared=allowFiles.map(f=>f.path).sort();
 if(JSON.stringify(installed)!==JSON.stringify(declared))
  throw Error('ALLOWFILE_DIFF_MISMATCH');
 return true;
}

/** Pure idempotency lookup against ONE existing request-ledger record. */
export function dedupeUpdateRequest(existingRecord,validated){
  const fingerprint=requestFingerprint(validated);
  if(existingRecord==null||existingRecord.requestId!==validated.request.requestId){
    return {status:"NEW",fingerprint};
  }
  if(existingRecord.fingerprint!==fingerprint)throw Error("DUPLICATE_REQUEST_PAYLOAD_CHANGED");
  return {status:"DUPLICATE_REUSED_NO_EXECUTION",fingerprint};
}

export function newUpdateLedger(validated){
  return Object.freeze({
    requestId:validated.request.requestId,
    fingerprint:requestFingerprint(validated),
    installedSha:validated.manifest.installedSha,targetSha:validated.manifest.targetSha,
    postOperation:validated.manifest.postOperation,
    postSourceSha:validated.manifest.postSourceSha,
    manifestSha256:validated.manifest.checks.manifestSha256,
    phase:"READY",lastPass:"REQUEST_VALIDATED",firstFail:null,
    protectedBeforeSha256:null,backupSha256:null,
  });
}

function requireEvidence(evidence,keys){requireKeys(evidence,keys,"UPDATE_TRANSITION_EVIDENCE_INVALID");}
function next(ledger,fields){return Object.freeze({...ledger,...fields});}
function rollbackRequired(ledger,code){
  return next(ledger,{phase:"ROLLBACK_REQUIRED",firstFail:code});
}

/**
 * Evidence-only state machine. No event invokes an executable or mutates a PC.
 * Failure after installation always requires a verified rollback checkpoint.
 */
export function transitionLedger(ledger,event,evidence={}){
  if(!ledger||typeof ledger!=="object"||typeof event!=="string"){
    throw Error("UPDATE_LEDGER_INVALID");
  }
  if(event==="FAIL"){
    requireEvidence(evidence,["code"]);
    const supplied=requireString(evidence.code,/^[A-Z][A-Z0-9_]{2,80}$/,"UPDATE_FAILURE_CODE_INVALID");
    const code=REPORTABLE_FAILURES.has(supplied)?supplied:"UPDATE_FAILURE_UNCLASSIFIED";
    if(["COMMITTED","ROLLED_BACK","BLOCKED"].includes(ledger.phase))throw Error("UPDATE_TRANSITION_NOT_ALLOWED");
    return ["APPLIED","POSTCHECK_VERIFIED","ROLLBACK_REQUIRED"].includes(ledger.phase)
      ?rollbackRequired(ledger,code)
      :next(ledger,{phase:"BLOCKED",firstFail:code});
  }
  if(event==="PREFLIGHT_PASS"&&ledger.phase==="READY"){
    requireEvidence(evidence,["installedSha","manifestSha256","protectedBeforeSha256"]);
    if(evidence.installedSha!==ledger.installedSha
      ||evidence.manifestSha256!==ledger.manifestSha256){
      throw Error("UPDATE_PREFLIGHT_SOURCE_DRIFT");
    }
    requireDigest(evidence.protectedBeforeSha256,"UPDATE_PROTECTED_HASH_INVALID");
    return next(ledger,{phase:"PREFLIGHT_VERIFIED",lastPass:"PREFLIGHT_VERIFIED",
      protectedBeforeSha256:evidence.protectedBeforeSha256});
  }
  if(event==="BACKUP_PASS"&&ledger.phase==="PREFLIGHT_VERIFIED"){
    requireEvidence(evidence,["backupSha256","rollbackSha"]);
    requireDigest(evidence.backupSha256,"UPDATE_BACKUP_HASH_INVALID");
    if(evidence.rollbackSha!==ledger.installedSha)throw Error("UPDATE_BACKUP_TARGET_MISMATCH");
    return next(ledger,{phase:"BACKUP_VERIFIED",lastPass:"BACKUP_VERIFIED",
      backupSha256:evidence.backupSha256});
  }
  if(event==="APPLY_PASS"&&ledger.phase==="BACKUP_VERIFIED"){
    requireEvidence(evidence,["actualInstalledSha","protectedAfterSha256"]);
    if(evidence.actualInstalledSha!==ledger.targetSha){
      return rollbackRequired(ledger,"UPDATE_INSTALLED_SHA_MISMATCH");
    }
    if(evidence.protectedAfterSha256!==ledger.protectedBeforeSha256){
      return rollbackRequired(ledger,"UPDATE_PROTECTED_STATE_DRIFT");
    }
    return next(ledger,{phase:"APPLIED",lastPass:"INSTALLED_SHA_VERIFIED"});
  }
  if(event==="POSTCHECK_PASS"&&ledger.phase==="APPLIED"){
    requireEvidence(evidence,["status","actualExecutionSha","postOperation","requestedSourceSha"]);
    if(evidence.status!=="PASS"||evidence.actualExecutionSha!==ledger.targetSha
      ||evidence.postOperation!==ledger.postOperation
      ||evidence.requestedSourceSha!==ledger.postSourceSha){
      return rollbackRequired(ledger,"UPDATE_POSTCHECK_FAILED");
    }
    return next(ledger,{phase:"POSTCHECK_VERIFIED",lastPass:"POSTCHECK_VERIFIED"});
  }
  if(event==="COMMIT"&&ledger.phase==="POSTCHECK_VERIFIED"){
    requireEvidence(evidence,[]);
    return next(ledger,{phase:"COMMITTED",lastPass:"UPDATE_COMMITTED"});
  }
  if(event==="ROLLBACK_PASS"&&ledger.phase==="ROLLBACK_REQUIRED"){
    requireEvidence(evidence,["restoredSha","protectedAfterRollbackSha256"]);
    if(evidence.restoredSha!==ledger.installedSha
      ||evidence.protectedAfterRollbackSha256!==ledger.protectedBeforeSha256){
      throw Error("UPDATE_ROLLBACK_READBACK_FAILED");
    }
    return next(ledger,{phase:"ROLLED_BACK",lastPass:"ROLLBACK_VERIFIED"});
  }
  throw Error("UPDATE_TRANSITION_NOT_ALLOWED");
}


// Terminal execution evidence shared by normal update and independent recovery.
const PC_REPO='ansqhd5774-Choi/zgmini-pc-control';
const POSTCHECK_STEP='Execute fixed host allowlist entry';
export function validateConfirmedPostcheckFailure({original,manifest,approval,issue,run,job}={}){
 const spec=approval?.confirmedPostcheckFailure;
 const keys=['issueNumber','runId','jobId','runnerName'];
 if(!spec||typeof spec!=='object'||Array.isArray(spec)||
    Object.keys(spec).sort().join('|')!==keys.sort().join('|')||
    !Number.isSafeInteger(spec.issueNumber)||spec.issueNumber<1||
    !Number.isSafeInteger(spec.runId)||spec.runId<1||
    !Number.isSafeInteger(spec.jobId)||spec.jobId<1||
    !/^zgmini-pc-0[1-6]$/.test(spec.runnerName??''))
   return false;
 if(original?.status!=='RECOVERY_REQUIRED'||original.firstFail!=='POSTCHECK_PENDING'||
    original.postIssueNumber!==spec.issueNumber||
    !/^pc-update-[0-9a-f-]{36}$/.test(original.requestId??'')||
    !/^[0-9a-f]{40}$/.test(original.targetSha??'')||
    !manifest||typeof manifest!=='object')
   return false;
 const title='PC Update '+original.requestId+' postcheck';
 let body;try{body=JSON.parse(issue?.body??'');}catch{return false;}
 if(issue?.number!==spec.issueNumber||issue.title!==title||
    issue.user?.login!=='ansqhd5774-Choi'||
    !issue.labels?.some(x=>x.name==='pc-job')||
    body.schema!=='ZGMINI_PC_JOB_V1'||
    body.requestId!==original.requestId+'-postcheck'||
    body.operation!==manifest.postOperation||
    body.sourceRepository!=='ansqhd5774-Choi/zgmini'||
    body.sourceBranch!==manifest.postSourceBranch||
    body.sourceSha!==manifest.postSourceSha)return false;
 const issued=Date.parse(issue.created_at??''),started=Date.parse(run?.created_at??'');
 if(!Number.isFinite(issued)||!Number.isFinite(started)||
    started<issued||started-issued>900000)return false;
 if(run?.id!==spec.runId||run.event!=='issues'||run.status!=='completed'||
    run.conclusion!=='failure'||run.display_title!==title||
    job?.id!==spec.jobId||job.run_id!==spec.runId||
    job.status!=='completed'||job.conclusion!=='failure'||
    job.runner_name!==spec.runnerName||job.name!=='approved-pc-job')return false;
 const steps=job.steps?.filter(x=>x.name===POSTCHECK_STEP);
 return Array.isArray(steps)&&steps.length===1&&
    steps[0].status==='completed'&&steps[0].conclusion==='failure';
}

export function verifiedRunningPostcheckFailure({ledger,manifest,issue,run,job}={}){
 if(ledger?.status!=='RUNNING'||ledger.phase!=='POSTCHECK_PENDING'||
    ledger.postIssueNumber!==issue?.number)return false;
 // Adapt the already verified active phase to the same strict evidence predicate;
 // this does not change a stored ledger, create approval, or execute rollback.
 return validateConfirmedPostcheckFailure({
  original:{...ledger,status:'RECOVERY_REQUIRED',firstFail:'POSTCHECK_PENDING'},
  manifest,approval:{confirmedPostcheckFailure:{issueNumber:issue.number,
   runId:run?.id,jobId:job?.id,runnerName:job?.runner_name}},issue,run,job});
}

// ZGMINI PC controller update admission and transition contract (pure ESM).
// This module NEVER runs shell, downloads source, installs code or edits a PC.
import {createHash} from "node:crypto";

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

const ISSUE_KEYS=[
  "schema","requestId","chatId","operation","controlRepository",
  "targetControllerSha","approvalManifestSha256",
];
const MANIFEST_KEYS=[
  "schema","installedSha","targetSha","allowFiles","purpose","approval",
  "checks","backup","postOperation","postSourceBranch","postSourceSha",
];
const APPROVAL_KEYS=["grade","ref","scope"];
const CHECK_KEYS=["targetSha","status","manifestSha256"];
const BACKUP_KEYS=["strategy","rollback"];
const ROLLBACK_KEYS=["kind","sha"];
const FILE_KEYS=["path","sha256"];
// The approval pins every deployed file and the updater checks the exact Git
// diff. New readonly adapters must not require replacing this maintainer just
// to append another filename. Keep paths confined to controller modules.
const installablePath=p=>p==='config/operations.json'||(typeof p==='string'&&/^controller\/[a-z][a-z0-9-]*\.mjs$/.test(p));
const PURPOSE_SCOPE=Object.freeze({
  "fear-greed-archive-status":"FEAR_GREED_ARCHIVE_READONLY",
  "employment-r6-readonly-adapter":"EMPLOYMENT_R6_READONLY_RUNNER",
  "pc-controller-safety-fix":"PC_CONTROL_CONTROLLER_UPDATE",
  "pc-controller-maintenance":"PC_CONTROL_CONTROLLER_UPDATE",
  "pc-controller-heavy-readonly":"PC_CONTROL_HEAVY_READONLY_UPDATE",
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
const CHAT_ID=new RegExp("^chat-"+UUID+"$");
const sha256=value=>createHash("sha256").update(value).digest("hex");

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
    const approvedHeavy=heavyShape&&(resourceProfile==='HEAVY_READONLY_240_1536'||
      (resourceProfile==='LEGACY_R6_ONLY'&&name==='employment-r6-candidate-stage-readonly'));
    if(!/^[a-z][a-z0-9-]{2,60}$/.test(name)||!(allowedLight||approvedHeavy)){
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
  requireKeys(raw,MANIFEST_KEYS,"UPDATE_MANIFEST_FIELDS_INVALID");
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
  if(!["core-status","source-audit","fear-greed-archive-status"].includes(raw.postOperation)){
    throw Error("UPDATE_POST_OPERATION_NOT_ALLOWED");
  }
  if(typeof raw.postSourceBranch!=="string"
    ||!(/^(?:main|codex\/[a-z0-9][a-z0-9./_-]{2,100})$/.test(raw.postSourceBranch))
    ||raw.postSourceBranch.includes(".."))throw Error("UPDATE_POST_SOURCE_BRANCH_INVALID");
  requireSha(raw.postSourceSha,"UPDATE_POST_SOURCE_SHA_INVALID");
  const normalized=Object.freeze({
    schema:UPDATE_SCHEMA,installedSha:raw.installedSha,
    targetSha:raw.targetSha,allowFiles:manifest.files.map(file=>Object.freeze(file)),
    purpose:raw.purpose,approval:Object.freeze({...raw.approval}),
    checks:Object.freeze({...raw.checks}),
    backup:Object.freeze({strategy:"VERSIONED_SNAPSHOT",rollback:Object.freeze({...raw.backup.rollback})}),
    postOperation:raw.postOperation,postSourceBranch:raw.postSourceBranch,
    postSourceSha:raw.postSourceSha,
  });
  return Object.freeze({request,manifest:normalized});
}

export function requestFingerprint(validated){
  // A caller must pass the normalized pair from validateUpdateRequest().
  requireKeys(validated,["request","manifest"],"UPDATE_VALIDATED_PAIR_REQUIRED");
  requireKeys(validated.request,ISSUE_KEYS,"UPDATE_ISSUE_FIELDS_INVALID");
  requireKeys(validated.manifest,MANIFEST_KEYS,"UPDATE_MANIFEST_FIELDS_INVALID");
  return sha256(JSON.stringify(validated));
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

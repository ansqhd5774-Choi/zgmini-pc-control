#!/usr/bin/env node
// Independent, pull-only PC maintainer. Never imported by the Core supervisor.
// GitHub Issues are requests, not executable commands or approval manifests.
import crypto from "node:crypto";
import {execFile as nodeExecFile,execFileSync} from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {fileURLToPath,pathToFileURL} from "node:url";

import {validateMaintenanceRequest,validateUpdateRequest,
  authenticateControllerBIssue,CI_CONTROLLER_ACTOR,installedControllerBPolicy,
  validateR6HostIssueEnvelope,validateR6HostRegistrationRequest,
  validateR54BIssueEnvelope,validateR54BManifestRequest,
  R54_B_ISSUE_TITLE,R54_B_OPERATION,R54_B_SOURCE_FILES,
  SOURCE_BUNDLE_OPERATION,SOURCE_BUNDLE_ISSUE_TITLE,
  validateSourceBundleIssueEnvelope,validateSourceBundleBApproval,
  S6_ONCE_ISSUE_TITLE,S6_ONCE_OPERATION,
  validateS6OnceIssueEnvelope,validateS6OnceBManifest} from "./maintenance-contract.mjs";
import {acquireMaintenanceLock} from "./maintenance-lock.mjs";
import {ORPHAN_SIX_B_TITLE} from "./supervisor-orphan-six-b-admission.mjs";
import {receiveOrphanSixBApprovalSource} from "./supervisor-orphan-six-b-receiver-source.mjs";

const CONTROL_REPOSITORY="ansqhd5774-Choi/zgmini-pc-control";
const ISSUE_TITLE="pc-controller-update";
const R6_HOST_ISSUE_TITLE="pc-r6-host-register";
const ISSUE_LABEL="pc-maintenance";
const ALLOWED_ACTORS=Object.freeze(["ansqhd5774-Choi"]);
// Exact one-instance recovery admission belongs to the Receiver, not to the
// four source files pinned by the historical approved recovery manifest.
export const INSTALLED_RECOVERY_OPERATION='controller-installed-recovery';
export const INSTALLED_RECOVERY_ISSUE_TITLE='pc-controller-installed-recovery';
export const INSTALLED_RECOVERY_ORIGINAL_ID='pc-update-e8767e20-6bad-4418-97c6-561cf79a8213';
export const INSTALLED_RECOVERY_SOURCE_SHA='e6c96e8d19bd9084b8021c7df31678f56ef1b388';
export const INSTALLED_RECOVERY_CONTROLLER_SHA='b9a423cf38d0967d6ed336912a66433f79502d3d';
export const INSTALLED_RECOVERY_MANIFEST_PATH=
 'approvals/maintenance-recoveries/'+INSTALLED_RECOVERY_ORIGINAL_ID+'.installed.json';
// These exact historical installed-state cases require separate approval.
// #3516 uses its independently attested operating A rather than a fake postcheck.
export const W04_INSTALLED_RECOVERY_ORIGINAL_ID='pc-update-71ea39dc-7048-4e10-9d11-d4be7f6c3ec0';
export const W04_INSTALLED_RECOVERY_SOURCE_SHA='fcb098d20fb9a6c48f371786c69f7f1fdf5bc34a';
export const W04_INSTALLED_RECOVERY_CONTROLLER_SHA='6b3c9c0ce77354d81babe4c9ea7785663c6c2cb4';
export const W04_3516_INSTALLED_RECOVERY_ORIGINAL_ID='pc-update-c087fa10-88e2-42e3-bc60-c758ab93f0c1';
export const W04_3516_INSTALLED_RECOVERY_SOURCE_SHA='ec9009be720f3da33c3300a81aaf54be1e18c683';
export const W04_3516_INSTALLED_RECOVERY_CONTROLLER_SHA='83679b013ac9a9820331d93311ec97e572b18e13';
const INSTALLED_RECOVERY_CASES=Object.freeze([
 Object.freeze({originalId:INSTALLED_RECOVERY_ORIGINAL_ID,
  sourceSha:INSTALLED_RECOVERY_SOURCE_SHA,controllerSha:INSTALLED_RECOVERY_CONTROLLER_SHA,
  issueNumber:2960,proof:Object.freeze({issueNumber:2982,runId:45186420113,
   jobId:137733094098,runnerName:'zgmini-pc-04',
   resultPath:'results/45186420113-1-seat-4.json'})}),
 Object.freeze({originalId:W04_INSTALLED_RECOVERY_ORIGINAL_ID,
  sourceSha:W04_INSTALLED_RECOVERY_SOURCE_SHA,controllerSha:W04_INSTALLED_RECOVERY_CONTROLLER_SHA,
  issueNumber:3409,proof:Object.freeze({issueNumber:3438,runId:45457196689,
   jobId:138669741465,runnerName:'zgmini-pc-03',
   resultPath:'results/45457196689-1-seat-3.json'})}),
 Object.freeze({originalId:W04_3516_INSTALLED_RECOVERY_ORIGINAL_ID,
  sourceSha:W04_3516_INSTALLED_RECOVERY_SOURCE_SHA,
  controllerSha:W04_3516_INSTALLED_RECOVERY_CONTROLLER_SHA,
  issueNumber:3516,proof:Object.freeze({issueNumber:3528,runId:45579963186,
   jobId:139087219551,runnerName:'zgmini-pc-03',
   resultPath:'results/pc-process-inventory-45579963186-1-operating.json'})}),
]);
const recoveryCaseForTarget=sha=>INSTALLED_RECOVERY_CASES.find(c=>c.controllerSha===sha)??null;
const recoveryCaseForApproval=a=>{
 const fixed=recoveryCaseForTarget(a?.targetControllerSha);
 return fixed&&a?.requestId===fixed.originalId&&a?.sourceSha===fixed.sourceSha&&
  a?.issueNumber===fixed.issueNumber?fixed:null;
};
// This is a read-only local preclaim check, not a source downloader or an
// alternative operator. Do not create the one-shot effect claim if the pinned
// source commit or running recovery tool is absent from the operating checkout.
export function verifyInstalledRecoveryLocalSource(fixed,approval,{
 readFile=fs.readFileSync,lstat=fs.lstatSync,
 git=args=>execFileSync('git',args,{cwd:'E:/ZGmini/projects/zgmini-pc-control',
  windowsHide:true,timeout:10000,stdio:'pipe',maxBuffer:2_000_000,
  env:{...process.env,GIT_OPTIONAL_LOCKS:'0',GIT_TERMINAL_PROMPT:'0'}}),
}={}){
 const filepath='E:/ZGmini/projects/zgmini-pc-control/tools/maintenance-recovery.mjs';
 const pinned=approval?.files?.find(f=>f?.path==='tools/maintenance-recovery.mjs');
 if(!fixed||!pinned||!(/^[a-f0-9]{64}$/).test(pinned.sha256))return false;
 try{
  const stat=lstat(filepath);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size<1||stat.size>131072)return false;
  if(sha256(readFile(filepath))!==pinned.sha256)return false;
  git(['--no-optional-locks','merge-base','--is-ancestor',fixed.sourceSha,'HEAD']);
  const source=git(['--no-optional-locks','show',
   fixed.sourceSha+':tools/maintenance-recovery.mjs']);
  return sha256(source)===pinned.sha256;
 }catch{return false;}
}
const INSTALLED_RECOVERY_FIELDS=['schema','requestId','chatId','operation',
 'controlRepository','targetControllerSha','approvalManifestSha256'];
const RECOVERY_ID=/^pc-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
export function validateInstalledRecoveryIssueEnvelope(request,{
 controlRepository=CONTROL_REPOSITORY,actor=null,allowedActors=ALLOWED_ACTORS,
}={}){
 if(controlRepository!==CONTROL_REPOSITORY||request?.controlRepository!==CONTROL_REPOSITORY||
    actor!==ALLOWED_ACTORS[0]||!Array.isArray(allowedActors)||
    !allowedActors.includes(ALLOWED_ACTORS[0]))
  throw coded('INSTALLED_RECOVERY_ACTOR_DENIED');
 if(!request||typeof request!=='object'||Array.isArray(request)||
    Object.keys(request).length!==INSTALLED_RECOVERY_FIELDS.length||
    INSTALLED_RECOVERY_FIELDS.some(key=>!Object.hasOwn(request,key)))
  throw coded('INSTALLED_RECOVERY_ISSUE_FIELDS_INVALID');
 if(request.schema!=='ZGMINI_PC_MAINTENANCE_REQUEST_V1'||
    request.operation!==INSTALLED_RECOVERY_OPERATION)
  throw coded('INSTALLED_RECOVERY_OPERATION_DENIED');
 if(typeof request.requestId!=='string'||!RECOVERY_ID.test(request.requestId)||
    INSTALLED_RECOVERY_CASES.some(c=>c.originalId===request.requestId))
  throw coded('INSTALLED_RECOVERY_REQUEST_ID_INVALID');
 if(typeof request.chatId!=='string'||!/^chat-[a-z0-9-]{1,75}$/.test(request.chatId))
  throw coded('INSTALLED_RECOVERY_CHAT_ID_INVALID');
 if(!recoveryCaseForTarget(request.targetControllerSha))
  throw coded('INSTALLED_RECOVERY_TARGET_DENIED');
 if(typeof request.approvalManifestSha256!=='string'||
    !/^[a-f0-9]{64}$/.test(request.approvalManifestSha256))
  throw coded('INSTALLED_RECOVERY_MANIFEST_PIN_INVALID');
 return Object.freeze({...request});
}
export function prepareInstalledRecoveryRequest(approvedRawBytes,{chatId}={}){
 const raw=JSON.parse(Buffer.from(approvedRawBytes).toString('utf8'));
 const fixed=recoveryCaseForApproval(raw);
 if(!fixed||raw?.schema!=='ZGMINI_PC_INSTALLED_RECOVERY_APPROVAL_V1'||
    raw.approved!==true||raw.operation!=='RECONCILE_INSTALLED')
  throw coded('INSTALLED_RECOVERY_APPROVAL_UNVERIFIED');
 return validateInstalledRecoveryIssueEnvelope({
  schema:'ZGMINI_PC_MAINTENANCE_REQUEST_V1',
  requestId:'pc-'+crypto.randomUUID(),chatId:chatId??('chat-'+crypto.randomUUID()),
  operation:INSTALLED_RECOVERY_OPERATION,controlRepository:CONTROL_REPOSITORY,
  targetControllerSha:fixed.controllerSha,
  approvalManifestSha256:crypto.createHash('sha256').update(approvedRawBytes).digest('hex'),
 },{actor:ALLOWED_ACTORS[0]});
}

const SHA40=/^[a-f0-9]{40}$/;
const REQUEST_ID=/^[a-z0-9][a-z0-9-]{7,79}$/;
const MAX_BODY_BYTES=16_384;
const MAX_MANIFEST_BYTES=65_536;
const MAX_RESULT_BYTES=16_384;
const FIXED_LEASE_ROOT="E:/ZGmini/automation/pc-control/leases";
const TERMINAL=new Set(["SUCCEEDED","FAILED","BLOCKED","UNKNOWN",
  "PASS","ROLLED_BACK","RECOVERY_REQUIRED"]);
const sha256=value=>crypto.createHash("sha256").update(value).digest("hex");
const coded=(code)=>Object.assign(new Error(code),{code});
const safeCode=value=>typeof value==="string"&&/^[A-Z][A-Z0-9_]{0,79}$/.test(value)
  ?value:"UNSPECIFIED_FAILURE";
const isSha=value=>typeof value==="string"&&SHA40.test(value);
const safeString=(value,pattern)=>typeof value==="string"&&pattern.test(value)?value:null;

function defaultExecFile(file,args,options={}){
  return new Promise((resolve,reject)=>{
    nodeExecFile(file,args,{windowsHide:true,shell:false,encoding:"utf8",maxBuffer:2_000_000,
      ...options},(error,stdout,stderr)=>{
      if(error){error.stdout=stdout;error.stderr=stderr;reject(error);return;}
      resolve({stdout,stderr});
    });
  });
}
function safeUpdaterEnv(source=process.env){
  // The updater is an out-of-band Windows process, never an Actions job.
  // GitHub auth, service tokens, NODE_OPTIONS and arbitrary host env are withheld.
  const permitted=["PATH","Path","SystemRoot","WINDIR","USERPROFILE","APPDATA",
    "LOCALAPPDATA","TEMP","TMP","TMPDIR","HOME","HOMEDRIVE","HOMEPATH"];
  const env={};
  for(const key of permitted)if(typeof source[key]==="string")env[key]=source[key];
  env.ZGMINI_PC_MAINTENANCE_MODE="OUT_OF_BAND";
  return env;
}

function parseJsonOutput(value,code){
  const output=typeof value==="string"?value:value?.stdout;
  if(typeof output!=="string"||Buffer.byteLength(output)>2_000_000)throw coded(code);
  try{return JSON.parse(output);}catch{throw coded(code);}
}

// The independent S6 updater deliberately exits 2 on RECOVERY_REQUIRED
// (tools/update.mjs CLI). node:child_process.execFile rejects that exit even
// when the coordinator successfully emits its structured phase result.
// Recover ONLY this exact, already-failed signal, never a successful effect;
// arbitrary child stderr/stdout or other exit codes remain outcome UNKNOWN.
const S6_RECOVERY_FAILED_PHASES=new Set([
 "CLAIMED","INSTALL_LEASE_ACQUIRE_ATTEMPT","INSTALL_LEASE_ACQUIRED",
 "INTAKE_PAUSE_ATTEMPT","INTAKE_PAUSED","DRAINED",
 "OLD_TREE_STOP_ATTEMPT","OLD_TREE_STOP_SUBMITTED","OLD_TREE_STOP_VERIFIED",
 "INTAKE_RESUME_ATTEMPT","INTAKE_RESUMED",
 "OWNED_LEASE_RELEASE_ATTEMPT","OWNED_LEASE_RELEASED",
 "WATCHDOG_RELEASE_OBSERVED","FAST_PROMOTION_OBSERVED",
 "WATCHDOG_RELEASE_OUTCOME_UNVERIFIED","BACKLOG_RECONCILE_ATTEMPT",
 "BACKLOG_RECONCILED"
]);
export function parseS6NonzeroRecoveryReport(error,requestId){
 if(error?.code!==2||error?.killed===true||error?.signal!=null||
   typeof error?.stdout!=="string"||
   Buffer.byteLength(error.stdout)>MAX_RESULT_BYTES)return null;
 let raw;try{raw=JSON.parse(error.stdout);}catch{return null;}
 if(!raw||typeof raw!=="object"||Array.isArray(raw)||
   raw.schema!=="ZGMINI_S6_ONCE_RESULT_V1"||
   raw.requestId!==requestId||
   raw.status!=="RECOVERY_REQUIRED"||
   raw.code!=="S6_ONCE_RUNTIME_OUTCOME_RECONCILE"||
   raw.operationalEffectUnverified!==true||
   raw.failoverTested!==false||raw.promotionApproved!==false||
   raw.mutationAttempted!==true||
   typeof raw.leaseReleaseAcknowledged!=="boolean"||
   !S6_RECOVERY_FAILED_PHASES.has(raw.failedAt)||
   typeof raw.failedCode!=="string"||
   raw.failedCode!==safeCode(raw.failedCode)||
   raw.failedCode==="UNSPECIFIED_FAILURE")return null;
 // Never propagate raw child output, host paths, claim details, or process IDs.
 return Object.freeze({
  schema:"ZGMINI_S6_ONCE_RESULT_V1",requestId,status:"RECOVERY_REQUIRED",
  code:"S6_ONCE_RUNTIME_OUTCOME_RECONCILE",
  operationalEffectUnverified:true,failoverTested:false,
  promotionApproved:false,mutationAttempted:true,
  failedAt:raw.failedAt,failedCode:raw.failedCode,
  leaseReleaseAcknowledged:raw.leaseReleaseAcknowledged
 });
}

function parseIssueBody(body){
  // The seven-key Issue envelope permits no JSON key aliases or duplicates.
  // Require literal canonical names so JSON.parse's last-key-wins behavior
  // cannot conceal a changed or duplicated security-sensitive value.
  const expected=["schema","requestId","chatId","operation","controlRepository",
    "targetControllerSha","approvalManifestSha256"];
  const parsed=JSON.parse(body);
  if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))
    throw coded("ISSUE_CONTRACT_INVALID");
  const keys=[];
  let depth=0,inString=false,escaped=false,start=0;
  for(let i=0;i<body.length;i++){
    const char=body[i];
    if(inString){
      if(escaped){escaped=false;continue;}
      if(char==="\\"){escaped=true;continue;}
      if(char==='"'){
        inString=false;
        let next=i+1;
        while(/\s/.test(body[next]??""))next++;
        if(depth===1&&body[next]===":"){
          const token=body.slice(start,i+1),key=JSON.parse(token);
          if(token!==JSON.stringify(key))throw coded("ISSUE_CONTRACT_INVALID");
          keys.push(key);
        }
      }
    }else if(char==='"'){inString=true;start=i;}
    else if(char==="{")depth++;
    else if(char==="}")depth--;
  }
  if(keys.length!==expected.length)throw coded("ISSUE_CONTRACT_INVALID");
  for(const key of expected){
    if(keys.filter(value=>value===key).length!==1)throw coded("ISSUE_CONTRACT_INVALID");
  }
  return parsed;
}

function writeOnce(file,contents){
  try{fs.writeFileSync(file,contents,{encoding:"utf8",flag:"wx",mode:0o600});return true;}
  catch(error){
    if(error?.code!=="EEXIST")throw coded("MAINTENANCE_STATE_WRITE_FAILED");
    if(fs.readFileSync(file,"utf8")!==contents)throw coded("MAINTENANCE_STATE_CONFLICT");
    return false;
  }
}

function atomicReplace(file,contents){
  const tmp=file+"."+process.pid+"."+crypto.randomBytes(6).toString("hex")+".tmp";
  try{
    fs.writeFileSync(tmp,contents,{encoding:"utf8",flag:"wx",mode:0o600});
    fs.renameSync(tmp,file);
  }catch{throw coded("MAINTENANCE_STATE_WRITE_FAILED");}
  finally{try{if(fs.existsSync(tmp))fs.unlinkSync(tmp);}catch{/* only our temporary file */}}
}

function assertTrustedRoot(root){
  if(typeof root!=="string"||!path.isAbsolute(root)||path.parse(root).root===root)
    throw coded("MAINTENANCE_ROOT_REQUIRED");
  const normalized=path.resolve(root);
  if(!fs.existsSync(normalized)||!fs.statSync(normalized).isDirectory())
    throw coded("MAINTENANCE_ROOT_NOT_FOUND");
  return normalized;
}

function issueIsTrusted(issue,{allowedActors,title,label}){
  const actor=issue?.author?.login;
  const labels=issue?.labels;
  return Number.isSafeInteger(issue?.number)&&issue.number>0
    &&issue.title===title&&issue.state==="OPEN"
    &&typeof actor==="string"&&!actor.toLowerCase().endsWith("[bot]")
    &&allowedActors.some(name=>name.toLowerCase()===actor.toLowerCase())
    &&Array.isArray(labels)&&labels.some(item=>item?.name===label);
}

function commentMarker(id){return `<!-- zgmini-pc-maintenance-result:${id} -->`;}
export function failedUpdaterResult(request,error,status){
 let output=null;try{output=parseJsonOutput(error?.stdout,'UPDATE_OUTPUT_INVALID');}catch{}
 const exact=output?.status==='AUTOMATION_BLOCKED'&&/^[A-Z][A-Z0-9_]{0,79}$/.test(output?.code??'');
 const untouched=exact&&output.failureStage==='PRE_INSTALL'&&status?.ledger===null&&
  status?.installLock?.held===false&&!status?.ledgerReadbackCode&&!status?.lockReadbackCode&&!status?.installedReadbackCode;
 return normalizedResult(request,{status:untouched?'BLOCKED':'UNKNOWN',
  firstFail:exact?output.code:'UPDATE_OUTCOME_UNKNOWN',actualControllerSha:status?.actualControllerSha,
  lastPass:untouched?'PRE_INSTALL_REJECTED':'NONE'},exact?output.code:'UPDATE_OUTCOME_UNKNOWN');
}
const SHA256=/^[a-f0-9]{64}$/;
const R54_SOURCE_STATES=new Set(['OLD','NEXT','UNKNOWN','MISSING']);
function safeR54SourceInventory(request,from){
  if(request.operation!==R54_B_OPERATION||!Array.isArray(from.sourceInventory)
    ||from.sourceInventory.length!==R54_B_SOURCE_FILES.length)return null;
  const rows=[];
  for(let i=0;i<R54_B_SOURCE_FILES.length;i++){
    const pin=R54_B_SOURCE_FILES[i],row=from.sourceInventory[i];
    if(!row||row.path!==pin.path||row.expectedOld!==pin.old
      ||row.approvedNext!==pin.next||!R54_SOURCE_STATES.has(row.state)
      ||!(row.actual===null||typeof row.actual==='string'&&SHA256.test(row.actual))
      ||(row.state==='MISSING')!==(row.actual===null))return null;
    rows.push({path:pin.path,state:row.state,actual:row.actual,
      expectedOld:pin.old,approvedNext:pin.next});
  }
  return rows;
}
export function normalizedResult(request,result,code){
  const from=result&&typeof result==="object"?result:{};
  const status=from.status==="PASS"?"SUCCEEDED"
    :from.status==="ROLLED_BACK"?"FAILED"
    :from.status==="RECOVERY_REQUIRED"?"UNKNOWN"
    :["SUCCEEDED","FAILED","BLOCKED","UNKNOWN"].includes(from.status)
      ?from.status:"UNKNOWN";
  const inventory=safeR54SourceInventory(request,from);
  // Delivery reconstructs the report from the durable, already normalized
  // request ledger. Preserve only the bounded S6 state across both passes.
  const s6Stage=from.schema==='ZGMINI_S6_ONCE_RESULT_V1'?from.status:
    from.schema==='ZGMINI_PC_MAINTENANCE_RESULT_V1'?from.s6ExecutionStatus:null;
  const s6State=request.operation===S6_ONCE_OPERATION&&
    from.requestId===request.requestId&&
    ['POSTCHECK_PENDING','RECOVERY_REQUIRED','STATE_UNKNOWN','BLOCKED'].includes(s6Stage)
      ?s6Stage:null;
  const s6Phase=from.s6LastPhase??from.lastPhase;
  return {
    schema:"ZGMINI_PC_MAINTENANCE_RESULT_V1",
    requestId:request.requestId,targetControllerSha:request.targetControllerSha,
    status,code:safeCode(code??from.code??"UNKNOWN_OUTCOME"),
    lastPass:safeCode(from.lastPass??"NONE"),
    firstFail:safeCode(from.firstFail??(request.operation===R54_B_OPERATION
      &&status==='BLOCKED'?(code??from.code):'NONE')),
    actualControllerSha:isSha(from.actualControllerSha??from.actualInstalledSha)
      ?(from.actualControllerSha??from.actualInstalledSha):null,
    recoverySha:isSha(from.recoverySha)?from.recoverySha:null,
    // Missing postcheck evidence is UNKNOWN, not observed protection drift.
    protectedStateUnchanged:typeof from.protectedStateUnchanged==='boolean'
      ?from.protectedStateUnchanged:null,
    workflowEnabled:typeof from.workflowEnabled==='boolean'
      ?from.workflowEnabled:null,
    ...(from.originalFailureCode?{originalFailureCode:safeCode(from.originalFailureCode),
      rollbackFailureCode:from.rollbackFailureCode?safeCode(from.rollbackFailureCode):null}:{}),
    ...(from.status==='ROLLED_BACK'?{operationalRecovery:
      from.protectedStateUnchanged===true&&from.workflowEnabled===true&&
      isSha(from.recoverySha)&&from.recoverySha===from.actualInstalledSha
       ?'PREVIOUS_VERSION_VERIFIED':'UNVERIFIED'}:{}),
    ...(inventory?{sourceInventory:inventory}:{}),
    ...(s6State?{s6ExecutionStatus:s6State,
        s6LeaseReleaseAcknowledged:from.leaseReleaseAcknowledged===true||
          from.s6LeaseReleaseAcknowledged===true,
        s6LastPhase:typeof s6Phase==='string'&&
          /^[A-Z0-9_]{1,64}$/.test(s6Phase)?s6Phase:null}:{}),
    ...((status==='SUCCEEDED'||
       (from.failureOperation==='stopOwnSupervisor'&&
        (from.code==='RUNNERS_NOT_IDLE'||from.originalFailureCode==='RUNNERS_NOT_IDLE')))
      &&from.supervisorIdleWait
      &&Number.isSafeInteger(from.supervisorIdleWait.retryCount)
      &&from.supervisorIdleWait.retryCount>=0
      &&Number.isSafeInteger(from.supervisorIdleWait.elapsedMs)
      &&from.supervisorIdleWait.elapsedMs>=0
      &&typeof from.supervisorIdleWait.observedBusy==='boolean'
      ?{supervisorIdleWait:{
        retryCount:from.supervisorIdleWait.retryCount,
        elapsedMs:from.supervisorIdleWait.elapsedMs,
        observedBusy:from.supervisorIdleWait.observedBusy}}:{}),
  };
}
// Publish a CI-native installation attestation only from an explicitly
// Owner-approved B manifest AND a verified successful original updater result.
// Do not trust extra fields supplied by the child stdout, Issue or CI bot.
export function attachApprovedNativeBReceipt(result,validated,actor){
 const pin=validated?.manifest?.ciNativeApproval;
 if(!pin)return result;
 if(actor!=="ansqhd5774-Choi"||
    validated?.request?.operation!=='controller-update'||
    validated.request.requestId!==result?.requestId||
    validated.request.targetControllerSha!==result.targetControllerSha||
    validated.manifest.purpose!=='pc-controller-maintenance'||
    validated.manifest.controllerOnlyInstall!==true||
    !validated.manifest.selectiveSource||
    pin.schema!=='ZGMINI_CI_NATIVE_B_POLICY_APPROVAL_V1'||
    !['A_READONLY','B_WRITER_SOURCE'].includes(pin.effect)||
    !SHA256.test(pin.nativePolicySha256)||
    result.status!=='SUCCEEDED'||
    result.actualControllerSha!==validated.request.targetControllerSha||
    result.protectedStateUnchanged!==true)
  return result;
 return {...result,ciNativeEffect:pin.effect,
  ciNativePolicySha256:pin.nativePolicySha256};
}
function resultComment(result,uploadStatus=null){
  return [commentMarker(result.requestId),
    "ZGMINI PC maintenance result (out-of-band)",
    `REQUEST_ID: ${result.requestId}`,
    `STATUS: ${result.status}`,
    `CODE: ${result.code}`,
    `LAST_PASS: ${result.lastPass}`,
    `FIRST_FAIL: ${result.firstFail}`,
    `TARGET_CONTROLLER_SHA: ${result.targetControllerSha}`,
    `ACTUAL_CONTROLLER_SHA: ${result.actualControllerSha??"UNVERIFIED"}`,
    `RECOVERY_SHA: ${result.recoverySha??"NONE"}`,
    ...(result.operationalRecovery?[`OPERATIONAL_RECOVERY: ${result.operationalRecovery}`]:[]),
    ...(result.s6ExecutionStatus?[`S6_EXECUTION_STATUS: ${result.s6ExecutionStatus}`,`S6_LEASE_RELEASE_ACKNOWLEDGED: ${result.s6LeaseReleaseAcknowledged}`,`S6_LAST_PHASE: ${result.s6LastPhase??'UNVERIFIED'}`]:[]),
    ...(result.originalFailureCode?[`ORIGINAL_FAILURE_CODE: ${result.originalFailureCode}`,
      `ROLLBACK_FAILURE_CODE: ${result.rollbackFailureCode??'NONE'}`]:[]),
    `PROTECTED_STATE_UNCHANGED: ${result.protectedStateUnchanged??'UNVERIFIED'}`,
    ...(result.ciNativeEffect?[`CI_NATIVE_EFFECT: ${result.ciNativeEffect}`,
      `CI_NATIVE_POLICY_SHA256: ${result.ciNativePolicySha256}`]:[]),
    `WORKFLOW_ENABLED: ${result.workflowEnabled??'UNVERIFIED'}`,
    ...(result.sourceInventory?.filter(row=>row.state!=='OLD').map(row=>
      `R54_SOURCE_DRIFT: ${row.path} ${row.state} ${row.actual??'MISSING'}`)??[]),
    ...(uploadStatus?[`REPORT_UPLOAD: ${uploadStatus}`,
      `RESULT_JSON: results/maintenance-${result.requestId}.json`,
      `RESULT_TXT: results/maintenance-${result.requestId}.txt`]:[])].join("\n");
}

/**
 * All side effects are injectable. Tests never access GitHub or a real PC.
 * The agent has no power to run user-supplied commands or arbitrary file paths.
 */
export function createMaintenanceAgent({
  stateDir,repo=CONTROL_REPOSITORY,title=ISSUE_TITLE,label=ISSUE_LABEL,
  allowedActors=ALLOWED_ACTORS,execFileImpl=defaultExecFile,
  ghBinary="C:/Program Files/GitHub CLI/gh.exe",nodeBinary=process.execPath,
  leaseRoot=FIXED_LEASE_ROOT,leaseAttempts=120,leaseWaitMs=500,
  updateScript=path.join(path.dirname(fileURLToPath(import.meta.url)),"update.mjs"),
  verifyInstalledSource=()=>{},verifyRecoverySource=verifyInstalledRecoveryLocalSource,
  // Only an independently authenticated installed B integration may replace
  // this default. The existing seven-file maintainer cannot attest the new
  // orphan-six private installed CAS and must remain read-only/fail-closed.
  orphanSixInstalledReadback=async()=>{throw coded('ORPHAN_SIX_B_PRIVATE_INSTALLED_CAS_NOT_WIRED');},
  installedShaFromStatus=result=>result?.actualControllerSha,
  ghTimeoutMs=20_000,updateTimeoutMs=0,
  now=()=>new Date().toISOString(),
}={}){
  const root=assertTrustedRoot(stateDir);
  if(repo!==CONTROL_REPOSITORY||!Array.isArray(allowedActors)||!allowedActors.length
    ||typeof updateScript!=="string"||!path.isAbsolute(updateScript)
    ||typeof leaseRoot!=="string"||!path.isAbsolute(leaseRoot)
    ||!Number.isInteger(leaseAttempts)||leaseAttempts<1||leaseAttempts>120
    ||!Number.isInteger(leaseWaitMs)||leaseWaitMs<0||leaseWaitMs>500
    ||typeof orphanSixInstalledReadback!=='function'){
    throw coded("MAINTENANCE_AGENT_CONFIG_INVALID");
  }
  const requestsDir=path.join(root,"requests"),approvedDir=path.join(root,"approved");
  // Reports are reconstructed from the durable request ledger when needed.
  // Do not create per-request TXT/JSON in E:; existing historical reports
  // remain untouched until an independently approved retention cleanup.
  for(const dir of [requestsDir,approvedDir])fs.mkdirSync(dir,{recursive:true});

  async function exec(file,args,timeout,environment=process.env){
    // Never use a shell. The entire command vector is fixed by this module.
    return execFileImpl(file,args,{shell:false,windowsHide:true,timeout,
      env:environment,maxBuffer:2_000_000});
  }
  async function github(args){return exec(ghBinary,args,ghTimeoutMs);}
  async function githubJson(args,code){
    try{return parseJsonOutput(await github(args),code);}
    catch{throw coded(code);}
  }
  async function updater(args){
    // Check the immutable installed maintainer files again at the point of use:
    // the long-lived receiver must never execute a drifted updater.
    verifyInstalledSource();
    return exec(nodeBinary,[updateScript,...args],updateTimeoutMs,safeUpdaterEnv());
  }
  async function updaterStatus(id,operation="controller-update"){
    const subcommand=operation===S6_ONCE_OPERATION?'s6-once-status'
      :operation===R54_B_OPERATION?'r54-b-status'
      :operation===SOURCE_BUNDLE_OPERATION?'source-bundle-status'
      :operation==="employment-r6-host-register"?"host-r6-status":"status";
    try{return parseJsonOutput(await updater([subcommand,"--request-id",id]),"UPDATE_STATUS_INVALID");}
    catch{throw coded("UPDATE_STATUS_UNAVAILABLE");}
  }
  async function acquireUploadLease(){
    const dir=path.join(leaseRoot,"result-upload"),ownerFile=path.join(dir,"owner.json");
    if(!fs.existsSync(leaseRoot)||!fs.statSync(leaseRoot).isDirectory())
      throw coded("REPORT_UPLOAD_LEASE_ROOT_UNAVAILABLE");
    for(let attempt=0;attempt<leaseAttempts;attempt++){
      try{
        // Same atomic directory mutex used by controller/common.mjs exclusive().
        // Never steal or garbage-collect another worker's lease.
        fs.mkdirSync(dir);
      }catch(error){
        if(error?.code!=="EEXIST")throw coded("REPORT_UPLOAD_LEASE_FAILED");
        if(attempt+1<leaseAttempts){
          await new Promise(resolve=>setTimeout(resolve,leaseWaitMs));
          continue;
        }
        throw coded("REPORT_UPLOAD_MUTEX_BUSY");
      }
      const nonce=crypto.randomUUID(),owner={pid:process.pid,nonce,at:now(),
        bootAt:Date.now()-os.uptime()*1000};
      try{
        fs.writeFileSync(ownerFile,JSON.stringify(owner)+"\n",{flag:"wx",mode:0o600});
        return {dir,ownerFile,nonce};
      }catch{
        // We created the directory but not its owner file. Remove only an
        // empty directory owned by this failed attempt; never remove peers.
        try{fs.rmdirSync(dir);}catch{/* fail closed */}
        throw coded("REPORT_UPLOAD_LEASE_FAILED");
      }
    }
    throw coded("REPORT_UPLOAD_MUTEX_BUSY");
  }
  function releaseUploadLease(lease){
    try{
      const owner=JSON.parse(fs.readFileSync(lease.ownerFile,"utf8"));
      if(owner.nonce!==lease.nonce||owner.pid!==process.pid)
        throw coded("REPORT_UPLOAD_MUTEX_OWNERSHIP_LOST");
      fs.unlinkSync(lease.ownerFile);
      fs.rmdirSync(lease.dir);
    }catch{throw coded("REPORT_UPLOAD_MUTEX_RELEASE_FAILED");}
  }
  async function repositoryAllowed(){
    const info=await githubJson(["repo","view",repo,"--json","isPrivate,nameWithOwner"],
      "GITHUB_REPOSITORY_CHECK_FAILED");
    if(info?.nameWithOwner!==repo||info?.isPrivate!==true)
      throw coded("GITHUB_PRIVATE_REPOSITORY_REQUIRED");
  }
  async function issueDetails(number){
    if(!Number.isSafeInteger(number)||number<=0)throw coded("INVALID_ISSUE_NUMBER");
    return githubJson(["issue","view",String(number),"--repo",repo,
      "--json","number,title,state,body,author,labels,comments"],"GITHUB_ISSUE_READ_FAILED");
  }
  async function manifestBytes(request){
    const approvedPath=request.operation===S6_ONCE_OPERATION
      ?`approvals/controller-s6/${request.approvalManifestSha256}.json`
      :request.operation===R54_B_OPERATION
      ?'approvals/theme-nine-r54/sixfile-source.json'
      :request.operation===SOURCE_BUNDLE_OPERATION
      ?`approvals/source-bundles/${request.approvalManifestSha256}.json`
      :request.operation==="employment-r6-host-register"
      ?"approvals/host-r6/afdd8fab1c03b321e4b8b0853bb236c0800a0a14.json"
      :`approvals/controller-updates/${request.targetControllerSha}.json`;
    const resource=`repos/${repo}/contents/${approvedPath}?ref=main`;
    const data=await githubJson(["api",resource],"APPROVAL_MANIFEST_READ_FAILED");
    if(data?.encoding!=="base64"||data?.type!=="file"
      ||typeof data.content!=="string"||data.content.length>MAX_MANIFEST_BYTES*2){
      throw coded("APPROVAL_MANIFEST_INVALID");
    }
    const encoded=data.content.replace(/\s/g,"");
    if(!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded))throw coded("APPROVAL_MANIFEST_INVALID");
    const bytes=Buffer.from(encoded,"base64");
    if(bytes.length===0||bytes.length>MAX_MANIFEST_BYTES
      ||sha256(bytes)!==request.approvalManifestSha256){
      throw coded("APPROVAL_MANIFEST_HASH_MISMATCH");
    }
    return bytes;
  }
  function isMissingRemoteFile(error){
    return error?.code==="HTTP_404"||error?.status===404
      ||/\bHTTP 404\b/.test(String(error?.stderr??""));
  }
  async function uploadOneResult(requestId,extension,contents){
    if(!REQUEST_ID.test(requestId)||!["json","txt"].includes(extension)
      ||Buffer.byteLength(contents)>MAX_RESULT_BYTES){
      throw coded("REPORT_UPLOAD_INPUT_INVALID");
    }
    const resource=`repos/${repo}/contents/results/maintenance-${requestId}.${extension}`;
    let exists=false;
    try{
      const current=parseJsonOutput(await github(["api",resource+"?ref=main"]),
        "REPORT_UPLOAD_READ_INVALID");
      if(current?.type!=="file"||current?.encoding!=="base64"
        ||typeof current.content!=="string")throw coded("REPORT_UPLOAD_REMOTE_INVALID");
      const remote=Buffer.from(current.content.replace(/\s/g,""),"base64");
      if(!remote.equals(Buffer.from(contents,"utf8")))
        throw coded("REPORT_REMOTE_CONTENT_CONFLICT");
      exists=true;
    }catch(error){
      if(error?.code==="REPORT_REMOTE_CONTENT_CONFLICT"
        ||error?.code==="REPORT_UPLOAD_REMOTE_INVALID")throw error;
      if(!isMissingRemoteFile(error))throw coded("REPORT_UPLOAD_REMOTE_READ_FAILED");
    }
    if(!exists){
      const message=`PC maintenance ${requestId} ${extension} result`;
      const encoded=Buffer.from(contents,"utf8").toString("base64");
      try{
        // Create-only PUT: deliberately omit the existing-file SHA. A race
        // cannot overwrite an already uploaded job's report.
        await github(["api",resource,"--method","PUT",
          "--raw-field",`message=${message}`,
          "--raw-field","branch=main",
          "--raw-field",`content=${encoded}`]);
      }catch{
        // An upload timeout is ambiguous. Re-read below before reporting.
      }
      let after;
      try{after=parseJsonOutput(await github(["api",resource+"?ref=main"]),
        "REPORT_UPLOAD_READBACK_INVALID");}
      catch{throw coded("REPORT_UPLOAD_READBACK_PENDING");}
      if(after?.type!=="file"||after?.encoding!=="base64"
        ||typeof after.content!=="string")throw coded("REPORT_UPLOAD_READBACK_PENDING");
      if(!Buffer.from(after.content.replace(/\s/g,""),"base64")
        .equals(Buffer.from(contents,"utf8"))){
        throw coded("REPORT_REMOTE_CONTENT_CONFLICT");
      }
    }
  }
  async function deliverReports(entry,operation){
    if(["VERIFIED","REPORT_UPLOAD_BLOCKED"].includes(entry.reportUploadStatus))return entry;
    let lease=null,code="REPORT_UPLOAD_PENDING",status="REPORT_UPLOAD_PENDING";
    try{
      lease=await acquireUploadLease();
      // The ledger is already durably committed *before* delivery. Reconstruct
      // the same redacted bytes after crash/restart, without accumulating logs
      // on E:. No source/manifest/provider/DB payload enters GitHub reports.
      if(!entry.result||entry.result.requestId!==entry.requestId)
        throw coded("MAINTENANCE_RESULT_LEDGER_INVALID");
      // Operation comes from the newly authenticated Issue envelope, not an
      // unpinned ledger field. Older ledgers intentionally lack operation.
      let safeResult=normalizedResult({requestId:entry.requestId,
        targetControllerSha:entry.targetControllerSha,operation},entry.result,entry.result.code);
      if(safeResult.status!==entry.result.status)
        throw coded("MAINTENANCE_RESULT_LEDGER_INVALID");
      // A successful Owner-B attestation has already been bound to its
      // validated manifest before ledger commit. Reconstruct the exact
      // bounded fields during crash-safe readback; normalizer drops unknown
      // child stdout fields and must never silently strip this trusted proof.
      const native=entry.result;
      if(entry.actor==="ansqhd5774-Choi"&&operation==='controller-update'&&
         entry.status==='SUCCEEDED'&&safeResult.status==='SUCCEEDED'&&
         safeResult.actualControllerSha===entry.targetControllerSha&&
         safeResult.protectedStateUnchanged===true&&
         ['A_READONLY','B_WRITER_SOURCE'].includes(native.ciNativeEffect)&&
         SHA256.test(native.ciNativePolicySha256??'')&&
         SHA256.test(entry.bodyDigest??'')&&SHA256.test(entry.fingerprint??'')){
        safeResult={...safeResult,ciNativeEffect:native.ciNativeEffect,
          ciNativePolicySha256:native.ciNativePolicySha256};
      }
      await uploadOneResult(entry.requestId,"json",JSON.stringify(safeResult,null,2)+"\n");
      await uploadOneResult(entry.requestId,"txt",resultComment(safeResult)+"\r\n");
      status="VERIFIED";code="REPORT_UPLOAD_VERIFIED";
    }catch(error){
      code=safeCode(error?.code??error?.message);
      if(code==="REPORT_REMOTE_CONTENT_CONFLICT")status="REPORT_UPLOAD_BLOCKED";
    }
    finally{
      if(lease){
        try{releaseUploadLease(lease);}
        catch{status="REPORT_UPLOAD_PENDING";code="REPORT_UPLOAD_MUTEX_RELEASE_FAILED";}
      }
    }
    const updated={...entry,reportUploadStatus:status,reportUploadCode:code};
    persistLedger(updated);
    return updated;
  }
  function ledgerPath(id){
    if(!REQUEST_ID.test(id))throw coded("INVALID_REQUEST_ID");
    return path.join(requestsDir,sha256(id)+".json");
  }
  function loadLedger(id){
    const file=ledgerPath(id);
    if(!fs.existsSync(file))return null;
    try{
      const ledger=JSON.parse(fs.readFileSync(file,"utf8"));
      if(ledger.requestId!==id||!Number.isSafeInteger(ledger.issueNumber)
        ||typeof ledger.bodyDigest!=="string"||typeof ledger.fingerprint!=="string"){
        throw Error("invalid ledger");
      }
      return ledger;
    }catch{throw coded("MAINTENANCE_LEDGER_INVALID");}
  }
  // Exact B effect, independent of requestId/chatId. Store the exclusive
  // claim alongside the existing durable request ledger; the receiver lease
  // serializes real admission and 'wx' closes the two-receiver race.
  // An uncertain first attempt stays owned by its original Issue until
  // its ledger is reconciled. No automatic retry or stale claim cleanup.
  function claimControllerEffect(request,issue,approved){
    if(request.operation!=="controller-update")return {created:true};
    const manifest=approved?.manifest;
    if(!isSha(manifest?.installedSha)||!isSha(manifest?.targetSha)||
       manifest.targetSha!==request.targetControllerSha)
      throw coded("MAINTENANCE_EFFECT_MANIFEST_INVALID");
    const key=sha256(JSON.stringify({operation:request.operation,
      installedSha:manifest.installedSha,targetSha:manifest.targetSha,manifest}));
    const file=path.join(requestsDir,"effect-"+key+".json");
    const record={schema:"ZGMINI_PC_MAINTENANCE_EFFECT_V1",key,
      requestId:request.requestId,issueNumber:issue.number,
      actor:issue.author.login,createdAt:now()};
    try{
      fs.writeFileSync(file,JSON.stringify(record,null,2)+"\n",
        {encoding:"utf8",flag:"wx",mode:0o600});
      return {created:true,record};
    }catch(error){
      if(error?.code!=="EEXIST")throw coded("MAINTENANCE_EFFECT_CLAIM_WRITE_FAILED");
    }
    let other;
    try{other=JSON.parse(fs.readFileSync(file,"utf8"));}
    catch{throw coded("MAINTENANCE_EFFECT_CLAIM_INVALID");}
    if(other?.schema!=="ZGMINI_PC_MAINTENANCE_EFFECT_V1"||
       other.key!==key||!REQUEST_ID.test(other.requestId??"")||
       !Number.isSafeInteger(other.issueNumber)||other.issueNumber<=0||
       !allowedActors.includes(other.actor))
      throw coded("MAINTENANCE_EFFECT_CLAIM_INVALID");
    if(other.requestId===request.requestId&&
       other.issueNumber===issue.number&&other.actor===issue.author.login)
      return {created:true,record:other};
    return {created:false,record:other};
  }

  function claim(request,issue,fingerprint,bodyDigest){
    const file=ledgerPath(request.requestId);
    const entry={schema:"ZGMINI_PC_MAINTENANCE_LEDGER_V1",requestId:request.requestId,
      issueNumber:issue.number,actor:issue.author.login,fingerprint,bodyDigest,
      targetControllerSha:request.targetControllerSha,
      status:"RUNNING",createdAt:now(),result:null};
    try{
      fs.writeFileSync(file,JSON.stringify(entry,null,2)+"\n",{encoding:"utf8",flag:"wx",mode:0o600});
      return {entry,created:true};
    }catch(error){
      if(error?.code!=="EEXIST")throw coded("MAINTENANCE_STATE_WRITE_FAILED");
      return {entry:loadLedger(request.requestId),created:false};
    }
  }
  function persistLedger(entry){
    atomicReplace(ledgerPath(entry.requestId),JSON.stringify(entry,null,2)+"\n");
  }
  async function acknowledgeAcceptedRequest(entry){
    // One bounded, best-effort receipt on this original Issue. It is not a
    // heartbeat or a success result, and delivery failure must not block apply.
    const body=`<!-- zgmini-pc-maintenance-progress:${entry.requestId} -->\n`+
      `유지보수 요청 접수·실행 준비 확인 (설치 완료 아님)\n`+
      `REQUEST_ID: ${entry.requestId}\nOBSERVED_AT: ${now()}\n`+
      `LAST_PASS: REQUEST_MANIFEST_AND_UNIQUE_CLAIM_VALIDATED\n`+
      `TARGET_CONTROLLER_SHA: ${entry.targetControllerSha}\n`+
      `NEXT: 기존 요청의 실행·사후검사·결과 JSON/TXT를 확인합니다. 새 요청을 중복 제출하지 마세요.`;
    let progressReceiptStatus='UNCONFIRMED';
    try{
      await exec(ghBinary,['issue','comment',String(entry.issueNumber),'--repo',repo,'--body',body],Math.min(ghTimeoutMs,3000));
      progressReceiptStatus='POSTED';
    }catch{/* Reporting is observational, never a new admission requirement. */}
    const next={...entry,progressReceiptAttempted:true,progressReceiptStatus};
    try{persistLedger(next);return next;}catch{return entry;}
  }
  function persistResult(entry,result){
    const updated={...entry,status:result.status,result,completedAt:now(),
      reportUploadStatus:"REPORT_UPLOAD_PENDING",reportUploadCode:"REPORT_UPLOAD_PENDING"};
    persistLedger(updated);
    return updated;
  }
  async function ensureComment(issueNumber,result,uploadStatus){
    // A timed-out gh comment may already be present. Always re-read first.
    const fresh=await issueDetails(issueNumber);
    const marker=commentMarker(result.requestId);
    if((fresh.comments??[]).some(c=>typeof c?.body==="string"&&c.body.includes(marker)
      &&allowedActors.some(actor=>actor.toLowerCase()===String(c?.author?.login??"").toLowerCase())))
      return "ALREADY_POSTED";
    try{
      await github(["issue","comment",String(issueNumber),"--repo",repo,
        "--body",resultComment(result,uploadStatus)]);
      return "POSTED";
    }catch{
      // The next poll will re-check the marker, never immediately retry.
      return "COMMENT_OUTCOME_UNKNOWN";
    }
  }
  async function commentOnceAndRecord(entry){
    if(entry.commentPosted===true||!entry.result)return;
    const posted=await ensureComment(entry.issueNumber,entry.result,
      entry.reportUploadStatus??"REPORT_UPLOAD_PENDING");
    if(posted==="POSTED"||posted==="ALREADY_POSTED"){
      persistLedger({...entry,commentPosted:true,
        commentUploadStatus:entry.reportUploadStatus??"REPORT_UPLOAD_PENDING"});
    }
  }
  async function uploadCompletionCommentOnce(entry){
    if(entry.reportUploadStatus!=="VERIFIED"||entry.commentUploadStatus!=="REPORT_UPLOAD_PENDING"
      ||entry.deliveryCommentPosted===true||entry.commentPosted!==true)return;
    const marker=`<!-- zgmini-pc-maintenance-upload:${entry.requestId} -->`;
    const fresh=await issueDetails(entry.issueNumber);
    const present=(fresh.comments??[]).some(c=>typeof c?.body==="string"
      &&c.body.includes(marker)
      &&allowedActors.some(actor=>actor.toLowerCase()===String(c?.author?.login??"").toLowerCase()));
    if(!present){
      const body=[marker,"REPORT_UPLOAD_VERIFIED",
        `RESULT_JSON: results/maintenance-${entry.requestId}.json`,
        `RESULT_TXT: results/maintenance-${entry.requestId}.txt`].join("\n");
      try{await github(["issue","comment",String(entry.issueNumber),"--repo",repo,
        "--body",body]);}
      catch{return;}
    }
    persistLedger({...entry,deliveryCommentPosted:true});
  }
  async function reconcileRunning(entry,request){
    let status;
    try{status=await updaterStatus(entry.requestId,request.operation);}
    catch{return entry;}
    const current=status?.ledger?.result??status?.result??status?.ledger;
    if(!current||!TERMINAL.has(current.status)){
      const elapsed=Date.now()-Date.parse(entry.createdAt);
      const noInstallEvidence=!current&&!status?.installLock?.held;
      // Crash between Issue claim and updater invocation leaves no updater
      // ledger. Surface UNKNOWN after a grace period; NEVER install again.
      if((noInstallEvidence&&elapsed>120000)||(current&&elapsed>3600000)){
        const result=normalizedResult(request,{status:'UNKNOWN',firstFail:'UPDATE_OUTCOME_UNKNOWN',
          actualControllerSha:status?.actualControllerSha},'UPDATE_OUTCOME_UNKNOWN');
        return persistResult(entry,result);
      }
      return entry;
    }
    const result=normalizedResult(request,{...current,
      actualControllerSha:current.actualControllerSha??status.actualControllerSha},current.code);
    return persistResult(entry,result);
  }
  async function rejectAdmission(issue,reason){
    const code=/^(?:UPDATE|R6_HOST|R54_B|SOURCE_BUNDLE|S6_ONCE|ISSUE)_[A-Z0-9_]{1,70}$/.test(reason??'')
      ?reason:'ISSUE_CONTRACT_INVALID';
    const digest=sha256(typeof issue.body==='string'?issue.body:'');
    const marker=`<!-- zgmini-pc-maintenance-rejected:${issue.number}:${digest} -->`;
    const body=[marker,'REQUEST_REJECTED_BEFORE_EXECUTION',`CODE: ${code}`,
      'PHASE: REQUEST_ADMISSION','EXECUTION_STARTED: false','PC_OPERATIONAL_EFFECTS: 0',
      'NEXT: CORRECT_REQUEST_ENVELOPE_WITH_EXISTING_APPROVAL_NO_INSTALL_REPLAY'].join('\n');
    const outcome={status:'BLOCKED',code,issueNumber:issue.number,
      phase:'REQUEST_ADMISSION',executionStarted:false,operationalWrites:0};
    const fresh=await issueDetails(issue.number);
    if(!issueIsTrusted(fresh,{allowedActors,title:issue.title,label})||fresh.body!==issue.body)
      return {...outcome,feedback:'ISSUE_CHANGED_BEFORE_REJECTION'};
    const present=x=>(x.comments??[]).some(c=>c?.body===body&&
      allowedActors.some(a=>a.toLowerCase()===String(c.author?.login??'').toLowerCase()));
    if(present(fresh))return {...outcome,feedback:'VERIFIED'};
    try{await github(['issue','comment',String(issue.number),'--repo',repo,'--body',body]);}
    catch{/* Reconcile a lost response; never retry the PC or blindly post. */}
    return {...outcome,feedback:present(await issueDetails(issue.number))?'VERIFIED':'COMMENT_OUTCOME_UNKNOWN'};
  }
  // Separate fixed recovery lane. This deliberately does not reuse the
  // original #2960 controller-update request or its durable request ledger.
  // Check the *structure* of the exact already approved installed recovery
  // before an immutable one-shot claim is created. The pinned independent
  // operator still rechecks the live bytes, provenance and source digests.
  function completeInstalledRecoveryApproval(approval){
    const fixed=recoveryCaseForApproval(approval);
    const digestPattern=/^[a-f0-9]{64}$/;
    const filePaths=['tools/maintenance-recovery.mjs','tools/update.mjs',
      'tools/maintenance-contract.mjs','controller/fixed-readonly-bytes.mjs'];
    const casKeys=['ledgerSha256','ownerSha256','markerSha256','backlogSha256',
      'snapshotSha256','protectionSha256','writerSha256'];
    const files=approval?.files,cas=approval?.casDigests;
    const proof=approval?.proof;
    return approval?.schema==='ZGMINI_PC_INSTALLED_RECOVERY_APPROVAL_V1'&&
      approval.approved===true&&approval.operation==='RECONCILE_INSTALLED'&&
      fixed!==null&&approval.requestId===fixed.originalId&&
      approval.issueNumber===fixed.issueNumber&&
      approval.sourceSha===fixed.sourceSha&&
      approval.targetControllerSha===fixed.controllerSha&&
      digestPattern.test(approval.approvedCurrentWriterConfigSha256??'')&&
      Array.isArray(files)&&files.length===filePaths.length&&
      filePaths.every(name=>files.filter(x=>x?.path===name&&
        digestPattern.test(x?.sha256??'')).length===1)&&
      cas!==null&&typeof cas==='object'&&!Array.isArray(cas)&&
      Object.keys(cas).length===casKeys.length&&
      casKeys.every(key=>digestPattern.test(cas[key]??''))&&
      cas.writerSha256===approval.approvedCurrentWriterConfigSha256&&
      proof?.issueNumber===fixed.proof.issueNumber&&
      proof?.runId===fixed.proof.runId&&proof?.jobId===fixed.proof.jobId&&
      proof?.runnerName===fixed.proof.runnerName&&
      proof?.resultPath===fixed.proof.resultPath&&
      digestPattern.test(proof?.resultSha256??'');
  }
  async function processInstalledRecoveryIssue(issue){
    if(!issueIsTrusted(issue,{allowedActors,title:INSTALLED_RECOVERY_ISSUE_TITLE,label}))
      return {status:'IGNORED',issueNumber:issue?.number};
    if(typeof issue.body!=='string'||Buffer.byteLength(issue.body)>MAX_BODY_BYTES)
      return rejectAdmission(issue,'ISSUE_BODY_INVALID');
    let request;
    try{
      request=validateInstalledRecoveryIssueEnvelope(parseIssueBody(issue.body),
        {actor:issue.author.login,allowedActors,controlRepository:repo});
    }catch(error){return rejectAdmission(issue,error?.message);}
    const fixed=recoveryCaseForTarget(request.targetControllerSha);
    if(!fixed)return {status:'BLOCKED',code:'INSTALLED_RECOVERY_TARGET_DENIED',
      requestId:request.requestId,executionStarted:false};
    const bodyDigest=sha256(issue.body),fingerprint=sha256(JSON.stringify(request));
    const prior=loadLedger(request.requestId);
    if(prior){
      if(prior.issueNumber!==issue.number||prior.bodyDigest!==bodyDigest||
         prior.fingerprint!==fingerprint||prior.actor!==issue.author.login)
        return {status:'BLOCKED',code:'REQUEST_ID_REUSE_CONFLICT',issueNumber:issue.number};
      // A receiver crash or timeout can occur *after* lease archive. Never
      // auto-execute a RUNNING or UNKNOWN recovery a second time.
      if(prior.result){
        const stored=await deliverReports(prior,request.operation);
        await commentOnceAndRecord(stored);
        await uploadCompletionCommentOnce(loadLedger(request.requestId));
      }
      return {status:prior.status,code:'DUPLICATE_REQUEST_SUPPRESSED',
        requestId:request.requestId,executionStarted:false};
    }
    // Approval comes from the same authenticated private GitHub repository;
    // the real operator repeats exact local/source/CAS/owner validation.
    let approval;
    try{
      const response=await githubJson(['api',
        `repos/${repo}/contents/approvals/maintenance-recoveries/${fixed.originalId}.installed.json?ref=main`],
        'INSTALLED_RECOVERY_APPROVAL_READ_FAILED');
      if(response?.type!=='file'||response.encoding!=='base64'||
        typeof response.content!=='string')throw coded('INSTALLED_RECOVERY_APPROVAL_INVALID');
      if(response.content.length>MAX_MANIFEST_BYTES*2)
        throw coded('INSTALLED_RECOVERY_APPROVAL_INVALID');
      const encoded=response.content.replace(/\s/g,'');
      if(!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded))
        throw coded('INSTALLED_RECOVERY_APPROVAL_INVALID');
      const raw=Buffer.from(encoded,'base64');
      if(!raw.length||raw.length>MAX_MANIFEST_BYTES||
         sha256(raw)!==request.approvalManifestSha256)
        throw coded('INSTALLED_RECOVERY_APPROVAL_HASH_MISMATCH');
      approval=JSON.parse(raw.toString('utf8'));
      if(!completeInstalledRecoveryApproval(approval)||
         approval.targetControllerSha!==request.targetControllerSha)
        throw coded('INSTALLED_RECOVERY_APPROVAL_SCOPE_INVALID');
    }catch(error){
      return {status:'BLOCKED',code:safeCode(error?.code??error?.message),
        requestId:request.requestId,executionStarted:false};
    }
    // A missing commit/tool is a local precondition failure, not an UNKNOWN
    // recovery outcome. No irreversible one-shot claim before source proof.
    try{
      verifyInstalledSource();
      if(verifyRecoverySource(fixed,approval)!==true)
        throw coded('INSTALLED_RECOVERY_LOCAL_SOURCE_UNAVAILABLE');
    }catch{
      return {status:'BLOCKED',code:'INSTALLED_RECOVERY_LOCAL_SOURCE_UNAVAILABLE',
       requestId:request.requestId,executionStarted:false,operationalWrites:0};
    }
    const held=claim(request,issue,fingerprint,bodyDigest);
    if(!held.created)return {status:'UNKNOWN',code:'INSTALLED_RECOVERY_CLAIM_UNCERTAIN',
      requestId:request.requestId,executionStarted:false};
    // A second request ID must not replay the same approved lease archival.
    const effectFile=path.join(requestsDir,'effect-'+sha256(
      'INSTALLED_RECOVERY:'+fixed.originalId)+'.json');
    try{
      fs.writeFileSync(effectFile,JSON.stringify({requestId:request.requestId,
        issueNumber:issue.number,originalRequestId:fixed.originalId})+'\n',
        {encoding:'utf8',flag:'wx',mode:0o600});
    }catch(error){
      const result=normalizedResult(request,{status:error?.code==='EEXIST'?'BLOCKED':'UNKNOWN',
        firstFail:'INSTALLED_RECOVERY_EFFECT_CLAIM_UNAVAILABLE'},
        'INSTALLED_RECOVERY_EFFECT_CLAIM_UNAVAILABLE');
      const stored=await deliverReports(persistResult(held.entry,result),request.operation);
      await commentOnceAndRecord(stored);
      return {status:result.status,code:result.code,requestId:request.requestId};
    }
    let result;
    try{
      verifyInstalledSource();
      // Fixed source/script/arguments; no Issue-supplied shell, path, SHA or
      // original ID. Child must independently attest Windows operator lineage.
      const script='E:/ZGmini/projects/zgmini-pc-control/tools/maintenance-recovery.mjs';
      const output=parseJsonOutput(await exec(nodeBinary,[script,'reconcile-installed',
        '--request-id',fixed.originalId,
        '--source-sha',fixed.sourceSha],updateTimeoutMs,safeUpdaterEnv()),
        'INSTALLED_RECOVERY_RESULT_INVALID');
      if(output?.status==='RECOVERED_INSTALLED_STATE'&&
         output.code==='INSTALLED_RUNTIME_RECOVERED_HISTORIC_POSTCHECK_UNKNOWN'&&
         output.leaseArchived===true&&output.requestId===fixed.originalId&&
         output.installedSha===fixed.controllerSha)
        result=normalizedResult(request,{status:'SUCCEEDED',
          actualControllerSha:output.installedSha},output.code);
      else result=normalizedResult(request,{status:'UNKNOWN',
        firstFail:'INSTALLED_RECOVERY_OUTCOME_UNVERIFIED'},
        'INSTALLED_RECOVERY_OUTCOME_UNVERIFIED');
    }catch(error){
      // Preserve claim on any unknown outcome. Inspect the original lease and
      // completion record; never repeat this recovery on the next poll.
      result=normalizedResult(request,{status:'UNKNOWN',
        firstFail:'INSTALLED_RECOVERY_OUTCOME_UNKNOWN'},
        'INSTALLED_RECOVERY_OUTCOME_UNKNOWN');
    }
    const stored=await deliverReports(persistResult(held.entry,result),request.operation);
    await commentOnceAndRecord(stored);
    return {status:result.status,code:result.code,requestId:request.requestId,
      originalRequestId:fixed.originalId};
  }
  async function processS6OnceIssue(issue){
    // S6 is a new B operational effect. A valid source/manifest/read-only
    // preflight is never sufficient authority to stop live processes.
    if(!issueIsTrusted(issue,{allowedActors,title:S6_ONCE_ISSUE_TITLE,label}))
      return {status:'IGNORED',issueNumber:issue?.number};
    if(typeof issue.body!=='string'||Buffer.byteLength(issue.body)>MAX_BODY_BYTES)
      return rejectAdmission(issue,'S6_ONCE_ISSUE_BODY_INVALID');
    let request;
    try{
      request=validateS6OnceIssueEnvelope(parseIssueBody(issue.body),{
        actor:issue.author.login,allowedActors,controlRepository:repo});
    }catch(error){return rejectAdmission(issue,error?.code??error?.message);}
    const bodyDigest=sha256(issue.body),fingerprint=sha256(JSON.stringify(request));
    const prior=loadLedger(request.requestId);
    if(prior){
      if(prior.issueNumber!==issue.number||prior.bodyDigest!==bodyDigest||
         prior.fingerprint!==fingerprint||prior.actor!==issue.author.login)
        return {status:'BLOCKED',code:'REQUEST_ID_REUSE_CONFLICT',
          requestId:request.requestId,executionStarted:false};
      // Never replay a possibly executed S6 stop, even if only its receiver
      // progress record remains after a crash. Delivery alone may resume.
      if(TERMINAL.has(prior.status)&&prior.result){
        const delivered=await deliverReports(prior,request.operation);
        await commentOnceAndRecord(delivered);
        await uploadCompletionCommentOnce(loadLedger(request.requestId));
      }
      return {status:prior.status,code:'DUPLICATE_REQUEST_SUPPRESSED',
        requestId:request.requestId,executionStarted:false};
    }
    let readonly,bytes;
    try{
      readonly=parseJsonOutput(await updater(['s6-once-status','--request-id',
        request.requestId]),'S6_ONCE_STATUS_UNVERIFIED');
      if(readonly?.status!=='READONLY'||
         readonly.code!=='S6_ONCE_LIVE_PREIMAGE_OBSERVED'||
         readonly.installAttempted!==false||
         readonly.operationalWrites!==0||
         readonly.actualControllerSha!==request.targetControllerSha||
         readonly.installLock?.held!==false||!readonly.s6Live)
        throw coded('S6_ONCE_LIVE_PREIMAGE_UNVERIFIED');
      bytes=await manifestBytes(request);
      validateS6OnceBManifest(request,bytes,{actor:issue.author.login,
        allowedActors,controlRepository:repo,live:readonly.s6Live});
    }catch(error){
      return {status:'BLOCKED',code:safeCode(error?.code??error?.message),
        requestId:request.requestId,executionStarted:false,operationalWrites:0};
    }
    // Only an exact B Issue and pinned raw manifest may reach the independent
    // Windows maintainer. Its own command rechecks all pins and active CAS.
    const packageFile=path.join(approvedDir,request.requestId+'.json');
    try{
      writeOnce(packageFile,JSON.stringify({issue:request,
        manifest:JSON.parse(bytes.toString('utf8')),
        manifestRawBase64:bytes.toString('base64'),
        issueNumber:issue.number,actor:issue.author.login},null,2)+'\n');
    }catch{
      return {status:'STATE_UNKNOWN',code:'S6_ONCE_PACKAGE_WRITE_UNVERIFIED',
        requestId:request.requestId,executionStarted:false};
    }
    const held=claim(request,issue,fingerprint,bodyDigest);
    if(!held.created)return {status:'STATE_UNKNOWN',
      code:'S6_ONCE_CLAIM_OUTCOME_UNVERIFIED',requestId:request.requestId,
      executionStarted:false};
    held.entry=await acknowledgeAcceptedRequest(held.entry);
    let result;
    try{
      // Exit 2 with a pinned RECOVERY_REQUIRED JSON is an observed failure
      // phase, not a missing child response. Do not retry this one-shot B.
      let executed;
      try{
        executed=parseJsonOutput(await updater(['s6-once-apply','--request-id',
          request.requestId,'--manifest-file',packageFile]),'S6_ONCE_OUTPUT_INVALID');
      }catch(error){
        executed=parseS6NonzeroRecoveryReport(error,request.requestId);
        if(executed===null)throw error;
      }
      if(executed?.schema!=='ZGMINI_S6_ONCE_RESULT_V1'||
         executed.requestId!==request.requestId||
         !['POSTCHECK_PENDING','RECOVERY_REQUIRED','STATE_UNKNOWN','BLOCKED'].includes(executed.status)||
         executed.failoverTested!==false||executed.promotionApproved!==false||
         (executed.status==='POSTCHECK_PENDING'&&
          (executed.code!=='S6_ONCE_PROMOTION_OBSERVED_A_JOB_PENDING'||
           executed.leaseReleaseAcknowledged!==true||
           executed.lastPhase!=='PROMOTED_READBACK_VERIFIED')))
        throw coded('S6_ONCE_RESULT_UNVERIFIED');
      // Promotion observation without an independent A job is never SUCCESS.
      // The once-only claim survives an uncertain upload or execution response.
      result=normalizedResult(request,{...executed,
        // A failed S6 effect has no authenticated post-effect installed SHA.
        // Only the independently observed promoted state can carry target.
        actualControllerSha:executed.status==='POSTCHECK_PENDING'?
          request.targetControllerSha:null,
        // This is the failure boundary (not a verified completed phase).
        lastPhase:executed.status==='RECOVERY_REQUIRED'?
          (executed.failedAt??null):executed.lastPhase,
        lastPass:executed.status==='POSTCHECK_PENDING'?
          'PROMOTED_READBACK_VERIFIED':'NONE',
        firstFail:executed.status==='RECOVERY_REQUIRED'?
          (executed.failedCode??executed.code):'NONE'},executed.code);
    }catch(error){
      // The one-shot operation may have started. Never retry or downgrade
      // UNKNOWN based on a missing/malformed response. Preserve only a fixed
      // failure category, not the child error, stdout, or host details.
      const firstFail=error?.code==='S6_ONCE_OUTPUT_INVALID'
        ?'S6_ONCE_OUTPUT_INVALID'
        :error?.code==='S6_ONCE_RESULT_UNVERIFIED'
        ?'S6_ONCE_RESULT_UNVERIFIED':'S6_ONCE_UPDATER_RESPONSE_UNKNOWN';
      result=normalizedResult(request,{status:'UNKNOWN',
        firstFail},'S6_ONCE_OUTCOME_UNKNOWN');
    }
    const stored=await deliverReports(persistResult(held.entry,result),request.operation);
    await commentOnceAndRecord(stored);
    return {status:result.status,code:result.code,requestId:request.requestId,
      s6ExecutionStatus:result.s6ExecutionStatus??null,
      reportUploadStatus:stored.reportUploadStatus};
  }
  async function processOrphanSixBSourceIssue(issue){
    if(!issueIsTrusted(issue,{allowedActors,title:ORPHAN_SIX_B_TITLE,label}))
      return {status:'IGNORED',issueNumber:issue?.number};
    // This inlet checks canonical GitHub approval evidence only. It does not
    // claim an effect, write an approval package, signal a Runner or call apply.
    const readOriginalOneUseClaim=async requestId=>{
      if(!/^pc-[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(requestId))
        throw coded('ORPHAN_SIX_B_CLAIM_ID_INVALID');
      const file=path.join(requestsDir,'orphan-six-'+sha256(requestId)+'.json');
      let st;
      try{st=fs.lstatSync(file);}catch(error){
        if(error?.code==='ENOENT')return null;
        throw coded('ORPHAN_SIX_B_CLAIM_READ_UNVERIFIED');
      }
      if(!st.isFile()||st.isSymbolicLink()||st.nlink!==1||
         st.size<10||st.size>8192)
        throw coded('ORPHAN_SIX_B_CLAIM_READ_UNVERIFIED');
      const bytes=fs.readFileSync(file);
      const after=fs.lstatSync(file);
      if(after.ino!==st.ino||after.size!==st.size||
         after.mtimeMs!==st.mtimeMs||bytes.length!==st.size)
        throw coded('ORPHAN_SIX_B_CLAIM_READ_UNVERIFIED');
      let entry;try{entry=JSON.parse(bytes.toString('utf8'));}catch{
        throw coded('ORPHAN_SIX_B_CLAIM_READ_UNVERIFIED');
      }
      if(entry?.schema!=='ZGMINI_ORPHAN_GRACEFUL_SIX_JOURNAL_V1'||
         entry.requestId!==requestId)
        throw coded('ORPHAN_SIX_B_CLAIM_READ_UNVERIFIED');
      return entry; // Any prior intent, including UNKNOWN, blocks resubmission.
    };
    const result=await receiveOrphanSixBApprovalSource({
      issue,readOriginalOneUseClaim,
      getMainManifest:async (rel,ref)=>{
        if(ref!=='main'||!/^approvals\/controller-orphan-six\/[a-f0-9]{64}\.json$/.test(rel))
          throw coded('ORPHAN_SIX_B_APPROVAL_PATH_INVALID');
        const data=await githubJson(['api',`repos/${repo}/contents/${rel}?ref=main`],
          'ORPHAN_SIX_B_APPROVAL_READ_FAILED');
        if(data?.type!=='file'||data.encoding!=='base64'||
           typeof data.content!=='string'||data.content.length>32768)
          throw coded('ORPHAN_SIX_B_APPROVAL_RESPONSE_INVALID');
        const raw64=data.content.replace(/\s/g,'');
        if(!/^[A-Za-z0-9+/]*={0,2}$/.test(raw64))
          throw coded('ORPHAN_SIX_B_APPROVAL_ENCODING_INVALID');
        return Buffer.from(raw64,'base64'); // receiver checks exact byte hash.
      },
      getPullRequest:async number=>{
        if(!Number.isSafeInteger(number)||number<=0)
          throw coded('ORPHAN_SIX_B_PR_NUMBER_INVALID');
        return githubJson(['api',`repos/${repo}/pulls/${number}`],
          'ORPHAN_SIX_B_PR_READ_FAILED');
      },
      getOwnerEffectComments:async number=>{
        if(!Number.isSafeInteger(number)||number!==issue.number)
          throw coded('ORPHAN_SIX_B_COMMENT_ISSUE_MISMATCH');
        // gh api --paginate follows the canonical Link header. --slurp
        // returns all pages; never silently treat a single page as complete.
        const pages=await githubJson(['api',
          `repos/${repo}/issues/${number}/comments?per_page=100`,
          '--paginate','--slurp'],'ORPHAN_SIX_B_COMMENTS_READ_FAILED');
        if(!Array.isArray(pages)||pages.length<1||pages.length>11||
           pages.some(p=>!Array.isArray(p)||p.length>100))
          throw coded('ORPHAN_SIX_B_COMMENT_PAGES_UNVERIFIED');
        const items=pages.flat();
        if(items.length>1000)throw coded('ORPHAN_SIX_B_COMMENTS_LIMIT_UNVERIFIED');
        return {source:'GITHUB_CANONICAL_ISSUE_COMMENTS_API',
          complete:true,issueNumber:number,items};
      },
      getInstalledReadback:async()=>orphanSixInstalledReadback()
    });
    return {status:result.status,code:result.code,
      requestId:result.requestId??null,issueNumber:issue.number,
      approvalSourceVerified:result.approvalSourceVerified===true,
      executionStarted:false,effectAuthorized:false,
      runnerStopAuthorized:false,operationalWrites:0,automaticRetries:0};
  }
  async function processIssue(issue){
    if(issue?.title===ORPHAN_SIX_B_TITLE)
      return processOrphanSixBSourceIssue(issue);
    if(issue?.title===S6_ONCE_ISSUE_TITLE)return processS6OnceIssue(issue);
    if(issue?.title===INSTALLED_RECOVERY_ISSUE_TITLE)
      return processInstalledRecoveryIssue(issue);
    const ciOrigin=issue?.title===ISSUE_TITLE&&issue.state==='OPEN'&&
      Number.isSafeInteger(issue.number)&&issue.number>0&&
      [CI_CONTROLLER_ACTOR,'app/github-actions'].includes(issue.author?.login)&&
      issue.labels?.some(x=>x.name===label);
    let ciPolicy=null;
    if(ciOrigin){
      try{
        // The installed seven-file source must still match its existing CAS.
        verifyInstalledSource();
        const file=path.join(root,'MAINTENANCE_INSTALL.json'),stat=fs.lstatSync(file);
        if(!stat.isFile()||stat.isSymbolicLink()||stat.size<1||stat.size>131072)
          throw coded('CI_INSTALLED_POLICY_UNVERIFIED');
        ciPolicy=installedControllerBPolicy(JSON.parse(fs.readFileSync(file,'utf8')));
      }catch{
        return {status:'BLOCKED',code:'CI_INSTALLED_POLICY_UNVERIFIED',issueNumber:issue.number};
      }
    }
    const ciCandidate=ciOrigin&&ciPolicy!==null;
    if(![ISSUE_TITLE,R6_HOST_ISSUE_TITLE,R54_B_ISSUE_TITLE,SOURCE_BUNDLE_ISSUE_TITLE].includes(issue?.title)
      ||(!ciCandidate&&!issueIsTrusted(issue,{allowedActors,title:issue.title,label})))
      return {status:"IGNORED",issueNumber:issue?.number};
    let ciAuthorization=null;
    if(ciCandidate){
      const actual=await githubJson(["api",`repos/${repo}/issues/${issue.number}`],"GITHUB_ISSUE_READ_FAILED");
      if(actual.number!==issue.number||actual.body!==issue.body)
        return {status:"BLOCKED",code:"CI_ISSUE_READBACK_MISMATCH",issueNumber:issue.number};
      const checked=await authenticateControllerBIssue(actual,{policy:ciPolicy,
        getJson:route=>githubJson(["api",`repos/${repo}/${route}`],"CI_IDENTITY_READ_FAILED"),
        readJobLogs:async jobId=>(await github(["api",`repos/${repo}/actions/jobs/${jobId}/logs`])).stdout,
      });
      if(checked.state!=='CI_WORKLOAD_IDENTITY_VERIFIED_ONLY')
        return {status:checked.state==='QUEUED'?'QUEUED':checked.state==='EVIDENCE_MISSING'?'STATE_UNKNOWN':'BLOCKED',
          code:checked.code,issueNumber:issue.number};
      ciAuthorization=checked.authorization;
      // Record the actual authenticated actor, not the owner or GraphQL app alias.
      issue={...issue,author:{...issue.author,login:actual.user.login}};
    }
    if(typeof issue.body!=="string"||Buffer.byteLength(issue.body)>MAX_BODY_BYTES){
      return rejectAdmission(issue,'ISSUE_BODY_INVALID');
    }
    let request;
    try{
      const parsed=parseIssueBody(issue.body);
      request=parsed.operation==="employment-r6-host-register"
        ?validateR6HostIssueEnvelope(parsed,{actor:issue.author.login,allowedActors,controlRepository:repo})
        :parsed.operation===SOURCE_BUNDLE_OPERATION
        ?validateSourceBundleIssueEnvelope(parsed,{actor:issue.author.login,controlRepository:repo})
        :parsed.operation===R54_B_OPERATION
        ?validateR54BIssueEnvelope(parsed,{actor:issue.author.login,allowedActors,controlRepository:repo})
        :validateMaintenanceRequest(parsed,{actor:issue.author.login,allowedActors,controlRepository:repo,ciAuthorization});
      if((request.operation==="employment-r6-host-register")!==(issue.title===R6_HOST_ISSUE_TITLE))
        throw coded("ISSUE_TITLE_OPERATION_MISMATCH");
      if((request.operation===R54_B_OPERATION)!==(issue.title===R54_B_ISSUE_TITLE))
        throw coded("ISSUE_TITLE_OPERATION_MISMATCH");
      if((request.operation===SOURCE_BUNDLE_OPERATION)!==(issue.title===SOURCE_BUNDLE_ISSUE_TITLE))
        throw coded("ISSUE_TITLE_OPERATION_MISMATCH");
    }catch(error){
      return rejectAdmission(issue,error?.code??error?.message);
    }
    if(!REQUEST_ID.test(request.requestId)){
      return {status:"BLOCKED",code:"INVALID_REQUEST_ID",issueNumber:issue.number};
    }
    const bodyDigest=sha256(issue.body),fingerprint=sha256(JSON.stringify(request));
    const prior=loadLedger(request.requestId);
    if(prior){
      if(prior.issueNumber!==issue.number||prior.bodyDigest!==bodyDigest
        ||prior.fingerprint!==fingerprint||prior.actor!==issue.author.login){
        return {status:"BLOCKED",code:"REQUEST_ID_REUSE_CONFLICT",issueNumber:issue.number};
      }
      const settled=prior.status==="RUNNING"?await reconcileRunning(prior,request):prior;
      if(TERMINAL.has(settled.status)&&settled.result){
        const delivered=await deliverReports(settled,request.operation);
        await commentOnceAndRecord(delivered);
        await uploadCompletionCommentOnce(loadLedger(request.requestId));
      }
      return {status:settled.status,code:"DUPLICATE_REQUEST_SUPPRESSED",
        reportUploadStatus:loadLedger(request.requestId).reportUploadStatus,
        requestId:request.requestId};
    }

    let approvedBytes,approved;
    try{
      approvedBytes=await manifestBytes(request);
      const preflight=await updaterStatus(request.requestId,request.operation);
      if(preflight?.installedReadbackCode||preflight?.ledgerReadbackCode||
        preflight?.lockReadbackCode)throw coded('UPDATE_STATUS_RECOVERY_REQUIRED');
      if(preflight?.ledger)throw coded('UPDATE_EXISTING_LEDGER_RECONCILE_FIRST');
      if(typeof preflight?.installLock?.held!=='boolean')
        throw coded('UPDATE_LOCK_STATUS_UNVERIFIED');
      if(preflight?.installLock?.held){
        return {status:preflight.installLock.recoveryRequired?'AUTOMATION_BLOCKED':'QUEUED',
          code:preflight.installLock.recoveryRequired?'MAINTENANCE_RECOVERY_HOLD':'MAINTENANCE_INSTALL_IN_PROGRESS',
          requestId:request.requestId};
      }
      const installedSha=installedShaFromStatus(preflight);
      if(!isSha(installedSha))throw coded("INSTALLED_CONTROLLER_SHA_UNVERIFIED");
      const args={actor:issue.author.login,allowedActors,controlRepository:repo,installedSha,ciAuthorization};
      approved=request.operation===R54_B_OPERATION
        ?validateR54BManifestRequest(request,approvedBytes,{...args})
        :request.operation===SOURCE_BUNDLE_OPERATION
        ?validateSourceBundleBApproval(request,approvedBytes,{actor:issue.author.login,installedSha})
        :request.operation==="employment-r6-host-register"
        ?validateR6HostRegistrationRequest(request,approvedBytes,args)
        :validateUpdateRequest(request,approvedBytes,args);
    }catch(error){
      const code=safeCode(error?.code??error?.message);
      const blocked=claim(request,issue,fingerprint,bodyDigest);
      if(!blocked.created)return {status:"BLOCKED",code:"DUPLICATE_REQUEST_SUPPRESSED"};
      const result=normalizedResult(request,{status:"BLOCKED",firstFail:code},code);
      const stored=await deliverReports(persistResult(blocked.entry,result),request.operation);
      await commentOnceAndRecord(stored);
      return {status:"BLOCKED",code,reportUploadStatus:stored.reportUploadStatus,
        requestId:request.requestId};
    }

    // Distinct request IDs cannot replay an identical approved B effect.
    // This atomic existing-ledger claim runs after approval/CAS validation and
    // before the first package or updater action. Never release by timeout.
    const effect=claimControllerEffect(request,issue,approved);
    if(!effect.created)return {status:"BLOCKED",code:"DUPLICATE_EFFECT_SUPPRESSED",
      requestId:request.requestId,originalIssueNumber:effect.record.issueNumber,
      originalRequestId:effect.record.requestId,executionStarted:false,
      operationalWrites:0};
    // Request values never choose a path or command. Only a pinned manifest is
    // stored under this trusted maintenance root for the separate updater.
    const packageFile=path.join(approvedDir,request.requestId+".json");
    // Preserve the pinned manifest's exact JSON field/file order: the updater
    // independently compares its parsed raw bytes against this package. The
    // contract's normalized copy may sort allowFiles and is only for admission.
    const packageData={issue:request,manifest:JSON.parse(approvedBytes.toString("utf8")),
      manifestRawBase64:approvedBytes.toString("base64"),
      issueNumber:issue.number,actor:issue.author.login};
    writeOnce(packageFile,JSON.stringify(packageData,null,2)+"\n");
    const held=claim(request,issue,fingerprint,bodyDigest);
    if(!held.created)return {status:"RUNNING",code:"DUPLICATE_REQUEST_SUPPRESSED"};
    held.entry=await acknowledgeAcceptedRequest(held.entry);
    let result;
    try{
      const command=request.operation===R54_B_OPERATION?'r54-b-apply'
        :request.operation===SOURCE_BUNDLE_OPERATION?'source-bundle-apply'
        :request.operation==="employment-r6-host-register"?"host-r6-apply":"apply";
      const executed=parseJsonOutput(await updater([command,"--request-id",request.requestId,
        "--manifest-file",packageFile]),"UPDATE_OUTPUT_INVALID");
      result=normalizedResult(request,executed,executed.code);
      // Owner-pinned policy effect can be carried only on an actual
      // verified B success; old installations remain unprivileged.
      result=attachApprovedNativeBReceipt(result,approved,issue.author.login);
    }catch(error){
      // Never retry an ambiguous apply. Query the independent updater ledger.
      let status=null;
      try{status=await updaterStatus(request.requestId,request.operation);}catch{/* unknown outcome */}
      const current=status?.ledger?.result??status?.result??status?.ledger;
      result=current&&TERMINAL.has(current.status)
        ?normalizedResult(request,{...current,
          actualControllerSha:current.actualControllerSha??status.actualControllerSha},current.code)
        :failedUpdaterResult(request,error,status);
    }
    const stored=await deliverReports(persistResult(held.entry,result),request.operation);
    await commentOnceAndRecord(stored);
    return {status:result.status,code:result.code,
      reportUploadStatus:stored.reportUploadStatus,requestId:request.requestId};
  }
  // Memory-only optimization. A restart or an edited Issue always takes the
  // complete authenticated path; no local file can authorize a new B operation.
  const settledIssueCache=new Map();
  const CACHE_TERMINAL=new Set(["SUCCEEDED","FAILED","BLOCKED"]);
  function safelyDeliveredLedger(issue,requestId){
    if(!REQUEST_ID.test(requestId)||!issueIsTrusted(issue,
      {allowedActors,title:issue?.title,label})||typeof issue.body!=="string")return false;
    const file=ledgerPath(requestId);
    try{
      // A cache decision must never trust symlinks, oversized or incomplete state.
      const stat=fs.lstatSync(file);
      if(!stat.isFile()||stat.size>65_536)return false;
      const ledger=loadLedger(requestId);
      return ledger?.schema==="ZGMINI_PC_MAINTENANCE_LEDGER_V1"
        &&ledger.issueNumber===issue.number&&ledger.actor===issue.author.login
        &&ledger.bodyDigest===sha256(issue.body)
        &&typeof ledger.fingerprint==="string"&&SHA256.test(ledger.fingerprint)
        &&CACHE_TERMINAL.has(ledger.status)&&ledger.result?.requestId===requestId
        &&ledger.result?.status===ledger.status
        &&ledger.result?.targetControllerSha===ledger.targetControllerSha
        &&ledger.reportUploadStatus==="VERIFIED"&&ledger.commentPosted===true
        &&(ledger.commentUploadStatus==="VERIFIED"
          ||(ledger.commentUploadStatus==="REPORT_UPLOAD_PENDING"
            &&ledger.deliveryCommentPosted===true));
    }catch{return false;}
  }
  async function pollOnce(){
    await repositoryAllowed();
    const summaries=await githubJson(["issue","list","--repo",repo,"--state","open",
      "--label",label,"--limit","1000","--json","number,title,updatedAt"],"GITHUB_ISSUE_LIST_FAILED");
    if(!Array.isArray(summaries))throw coded("GITHUB_ISSUE_LIST_INVALID");
    const seen=new Set(),results=[];
    // New requests are served first. RUNNING and recovery work is still checked
    // in the same pass, without introducing a new queue or admission gate.
    const newestFirst=[...summaries].sort((a,b)=>(b?.number??0)-(a?.number??0));
    for(const entry of newestFirst){
      const number=entry?.number;
      if(!Number.isSafeInteger(number)||number<=0||seen.has(number))continue;
      // Summary filtering avoids unnecessary reads; processIssue still verifies
      // the full Issue actor, label, request body and approval before applying.
      if(![ISSUE_TITLE,R6_HOST_ISSUE_TITLE,R54_B_ISSUE_TITLE,SOURCE_BUNDLE_ISSUE_TITLE,
        INSTALLED_RECOVERY_ISSUE_TITLE,S6_ONCE_ISSUE_TITLE,
        ORPHAN_SIX_B_TITLE].includes(entry?.title))continue;
      seen.add(number);
      const cached=settledIssueCache.get(number);
      const updatedAt=entry?.updatedAt;
      if(cached&&entry.title===cached.title&&typeof updatedAt==="string"
        &&updatedAt.length>0&&updatedAt===cached.updatedAt
        &&safelyDeliveredLedger(cached.issue,cached.requestId))continue;
      // If the Issue changed, the process restarted, or the ledger is uncertain,
      // return to full actor/body/label validation and pending delivery recovery.
      settledIssueCache.delete(number);
      try{
        const issue=await issueDetails(number);
        const result=await processIssue(issue);
        results.push(result);
        if(typeof updatedAt==="string"&&updatedAt.length>0
          &&typeof result?.requestId==="string"
          &&safelyDeliveredLedger(issue,result.requestId)){
          settledIssueCache.set(number,{title:entry.title,updatedAt,
            requestId:result.requestId,issue});
        }
      }catch(error){results.push({issueNumber:number,status:"BLOCKED",
        code:safeCode(error?.code??error?.message)});}
    }
    return results;
  }
  return {pollOnce,processIssue,loadLedger,updaterStatus};
}

function verifyInstalledTools(root){
  const installed=JSON.parse(fs.readFileSync(path.join(root,"MAINTENANCE_INSTALL.json"),"utf8"));
  const expected=["tools/maintenance-contract.mjs","tools/maintenance-apply.mjs",
    "tools/maintenance-agent.mjs","tools/maintenance-lock.mjs","tools/update.mjs",
    "tools/maintenance-ancestry.vbs","tools/source-bundle-register.mjs"];
  if(installed.schema!=="ZGMINI_PC_MAINTENANCE_INSTALL_V1"
    ||Object.keys(installed.files??{}).length!==expected.length)throw coded("MAINTENANCE_SELF_MANIFEST_INVALID");
  for(const [rel,hash] of Object.entries(installed.files)){
    if(!expected.includes(rel)||!(/^[a-f0-9]{64}$/).test(hash)
      ||sha256(fs.readFileSync(path.join(root,rel)))!==hash)throw coded("MAINTENANCE_SELF_DRIFT");
  }
}

export function attestReceiverOrigin(root,owner,{platform=process.platform,
  appData=process.env.APPDATA,
  cscript=(args)=>execFileSync('cscript.exe',args,{windowsHide:true,
    encoding:'utf8',timeout:12000,maxBuffer:4096})}={}){
  if(platform!=='win32'||typeof appData!=='string'||!path.isAbsolute(appData))
    throw coded('MAINTENANCE_ORIGIN_UNKNOWN');
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'MAINTENANCE_INSTALL.json'),'utf8'));
  const startup=path.join(appData,'Microsoft/Windows/Start Menu/Programs/Startup/ZGMINI_PC_MAINTENANCE.vbs');
  if(!/^[a-f0-9]{64}$/.test(manifest.startupSha256??'')||
    sha256(fs.readFileSync(startup))!==manifest.startupSha256)
    throw coded('MAINTENANCE_ORIGIN_UNKNOWN');
  const script=path.join(root,'tools/maintenance-ancestry.vbs');
  let result;
  try{result=String(cscript(['//NoLogo',script,'CAPTURE',String(owner.pid)])).trim();}
  catch{throw coded('MAINTENANCE_ORIGIN_UNKNOWN');}
  const matches=/^ATTESTED\|([0-9]{14}\.[0-9]{6}[+-][0-9]{3})\|([0-9]{1,9})\|(S-1-[0-9-]{4,100})$/.exec(result);
  if(!matches||owner.pid!==process.pid||!/^[0-9a-f-]{36}$/.test(owner.nonce??''))
    throw coded('MAINTENANCE_ORIGIN_UNKNOWN');
  const evidence={schema:'ZGMINI_PC_RECEIVER_ORIGIN_V1',sourceSha:manifest.sourceSha,
    startupSha256:manifest.startupSha256,pid:owner.pid,nonce:owner.nonce,
    bootAt:owner.bootAt,created:matches[1],session:matches[2],sid:matches[3],
    attestedAt:new Date().toISOString()};
  const dir=path.join(root,'receivers');fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,owner.nonce+'.json'),JSON.stringify(evidence)+'\n',{flag:'wx',mode:0o600});
  return evidence;
}

export function cooperativeStopRequested(root,owner){
 const file=path.join(root,'STOP_REQUEST.json');
 if(!fs.existsSync(file)||fs.existsSync(path.join(root,'leases/controller-install')))return false;
 let request;try{request=JSON.parse(fs.readFileSync(file,'utf8'));}catch{return false;}
 const installed=JSON.parse(fs.readFileSync(path.join(root,'MAINTENANCE_INSTALL.json'),'utf8'));
 if(request.schema!=='ZGMINI_MAINTENANCE_STOP_V1'||request.pid!==owner.pid||request.nonce!==owner.nonce||request.sourceSha!==installed.sourceSha)return false;
 fs.renameSync(file,path.join(root,'STOP_HANDLED-'+owner.nonce+'.json'));return true;
}

export async function main(args=process.argv.slice(2)){
  const mode=args.length===1&&["--once","--poll"].includes(args[0])?args[0]:null;
  if(!mode)throw coded("MAINTENANCE_USAGE_INVALID");
  const root=assertTrustedRoot(process.env.ZGMINI_PC_MAINTENANCE_ROOT);
  verifyInstalledTools(root);
  let lease;
  try{lease=acquireMaintenanceLock(root,'receiver');}
  catch(error){if(error?.code==='MAINTENANCE_LOCK_BUSY_OR_RECOVERY_REQUIRED')return;throw error;}
  try{
    attestReceiverOrigin(root,lease.owner);
    const agent=createMaintenanceAgent({stateDir:root,verifyInstalledSource:()=>verifyInstalledTools(root)});
    do{
      if(cooperativeStopRequested(root,lease.owner))break;
      try{const results=await agent.pollOnce();atomicReplace(path.join(root,'RECEIVER_STATUS.json'),JSON.stringify({at:new Date().toISOString(),pid:process.pid,status:'LISTENING',results})+'\n');}
      catch(error){
        if(mode==='--once')throw error;
        // A temporary GitHub outage must not permanently terminate the user
        // Startup receiver. Fixed next-poll delay, no automatic job retry.
        process.stderr.write('MAINTENANCE_POLL_WAIT: '+safeCode(error?.code??error?.message)+'\n');
        atomicReplace(path.join(root,'RECEIVER_STATUS.json'),JSON.stringify({at:new Date().toISOString(),pid:process.pid,status:'POLL_WAIT',code:safeCode(error?.code??error?.message)})+'\n');
      }
      if(mode==='--once'||cooperativeStopRequested(root,lease.owner))break;
      await new Promise(resolve=>setTimeout(resolve,60_000));
    }while(true);
  }finally{lease.release();}
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  main().catch(error=>{
    process.stderr.write("MAINTENANCE_AGENT: "+safeCode(error?.code??error?.message)+"\n");
    process.exitCode=2;
  });
}



// Read-only fixed-root operational summary. No Issue creation or execution.
import fs from 'node:fs';import path from 'node:path';
import {execFileSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {maintenanceLockStatus} from './maintenance-lock.mjs';
import {maintenanceNextAction,dedicatedPcRunnerRows,readMaintenanceRecoveryStatus} from './update.mjs';
const control='E:/ZGmini/automation/pc-control',maintenance='E:/ZGmini/automation/pc-maintenance';
const repo='ansqhd5774-Choi/zgmini-pc-control',gh='C:/Program Files/GitHub CLI/gh.exe';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const hash=b=>createHash('sha256').update(b).digest('hex');
// Only the six ZGMINI operating seats determine Controller runtime health.
// Independently registered handoff/other runners must not falsify this status.
export function dedicatedPcRunnersOnline(rows){
 return dedicatedPcRunnerRows(rows,{requireOnline:true})!==null;
}
// Only these six operational seats belong in a shared-repository status report.
// The current GitHub job uses these fixed labels, not arbitrary registration
// metadata. A routing candidate at this snapshot does not prove assignment
// or receipt of an earlier queued job.
const operatingNames=Object.freeze(Array.from({length:6},(_,i)=>`zgmini-pc-0${i+1}`));
const requiredRoutingLabels=Object.freeze(['self-hosted','windows','x64','zgmini-pc-control']);
export function operatingPcRunnerEvidence(rows){
 if(!Array.isArray(rows))return null;
 return operatingNames.map(name=>{
  const matches=rows.filter(x=>x?.name===name);
  if(matches.length!==1)return {
   name,registration:matches.length===0?'MISSING':'DUPLICATE',status:null,busy:null,
   routeLabelState:'UNKNOWN',missingRouteLabels:[],assignmentCandidateAtObservation:null,
  };
  const row=matches[0];
  const status=row.status==='online'||row.status==='offline'?row.status:null;
  const busy=typeof row.busy==='boolean'?row.busy:null;
  const labels=Array.isArray(row.labels)&&row.labels.every(x=>typeof x?.name==='string')?
   new Set(row.labels.map(x=>x.name.toLowerCase())):null;
  const missingRouteLabels=labels===null?[]:
   requiredRoutingLabels.filter(label=>!labels.has(label));
  const routeLabelState=labels===null?'UNKNOWN':
   missingRouteLabels.length?'MISSING':'MATCHED';
  const assignmentCandidateAtObservation=status==='offline'||busy===true||
   routeLabelState==='MISSING'?false:
   status==='online'&&busy===false&&routeLabelState==='MATCHED'?true:null;
  return {name,registration:'SINGLE',status,busy,routeLabelState,
   missingRouteLabels,assignmentCandidateAtObservation};
 });
}
export function verifyMaintenanceManifest(installed,rootDir,readBytes=fs.readFileSync){
 // Verified final pre-upgrade Windows six-file source (464 POSTFF V2).
 // A newer source must carry its seventh runtime module, even if its manifest
 // falsely shrinks to six internally consistent file hashes.
 const legacySixSource='4f076a0228f8ba9598e85b7d0f64f161b6b7c8a4';
 const original=['tools/maintenance-contract.mjs','tools/maintenance-apply.mjs',
  'tools/maintenance-agent.mjs','tools/maintenance-lock.mjs',
  'tools/update.mjs','tools/maintenance-ancestry.vbs'];
 const next=[...original,'tools/source-bundle-register.mjs'];
 const files=installed?.files;
 if(installed?.schema!=='ZGMINI_PC_MAINTENANCE_INSTALL_V1'
  ||!files||typeof files!=='object'||Array.isArray(files))return false;
 const keys=Object.keys(files),expected=keys.length===6&&installed.sourceSha===legacySixSource
  ?original:keys.length===7&&/^[a-f0-9]{40}$/.test(installed.sourceSha??'')?next:null;
 if(!expected||!keys.every(p=>expected.includes(p)))return false;
 return expected.every(p=>/^[a-f0-9]{64}$/.test(files[p]??'')
  &&hash(readBytes(path.join(rootDir,p)))===files[p]);
}
const need=(b,c)=>{if(!b)throw Object.assign(Error(c),{code:c});};
const live=pid=>{if(!Number.isSafeInteger(pid)||pid<=0)return null;try{process.kill(pid,0);return true;}catch(e){return e.code==='ESRCH'?false:null;}};

const watchdogRoot='E:/ZGmini/automation/pc-watchdog';
const WATCHDOG_STATES=new Set(['HEALTHY','PAUSED','PAUSED_WORKFLOW','STARTING',
 'BLOCKED','BLOCKED_LIVE_OR_UNKNOWN','BLOCKED_RESTART_LIMIT','BLOCKED_SPAWN_ERROR',
 'BLOCKED_STANDBY_SETUP','BLOCKED_STANDBY_NOT_READY',
 'BLOCKED_OLD_RUNNER_CHILD_UNVERIFIED','BLOCKED_STANDBY_IPC_DELIVERY_UNKNOWN']);
/**
 * Fixed-layout, read-only supplement to Controller/Runner status.
 * The watchdog state file is historical until timestamp and PID are checked.
 * A PAUSE marker does not mean existing Runner listeners were stopped.
 * Never returns source text, guardian marker text, raw lease names or secrets.
 * No control flow in summarizeAutomation() depends on this supplement.
 */
export function inspectWatchdogReadOnly({filesystem=fs,watchdogHome=watchdogRoot,
 controllerHome=control,maintenanceHome=maintenance,clock=Date.now,
 pidAlive=live}={}){
 const diagnostics=[];
 const fixedJson=(file,code,maxBytes)=>{
  try{
   const st=filesystem.lstatSync(file);
   if(!st.isFile()||st.isSymbolicLink()||st.size<1||st.size>maxBytes)throw Error('UNVERIFIED');
   const value=JSON.parse(filesystem.readFileSync(file,'utf8'));
   if(!value||typeof value!=='object'||Array.isArray(value))throw Error('INVALID_JSON');
   return value;
  }catch{diagnostics.push(code);return null;}
 };
 const present=(file,code)=>{
  try{
   const st=filesystem.lstatSync(file);
   if(st.isSymbolicLink())throw Error('SYMLINK_UNVERIFIED');
   return true;
  }catch(e){
   if(e?.code==='ENOENT')return false;
   diagnostics.push(code);return null;
  }
 };
 const stateFile=fixedJson(path.join(watchdogHome,'STATUS.json'),
  'WATCHDOG_STATUS_UNVERIFIED',16384);
 const receiver=fixedJson(path.join(watchdogHome,'receiver','owner.json'),
  'WATCHDOG_RECEIVER_UNVERIFIED',4096);
 const flags={
  guardianStop:present(path.join(watchdogHome,'GUARDIAN_STOP.txt'),'GUARDIAN_STOP_UNVERIFIED'),
  watchdogPause:present(path.join(watchdogHome,'PAUSE'),'WATCHDOG_PAUSE_UNVERIFIED'),
  controllerDrain:present(path.join(controllerHome,'DRAIN'),'CONTROLLER_DRAIN_UNVERIFIED'),
  controllerInstallLease:present(path.join(maintenanceHome,'leases','controller-install'),'CONTROLLER_INSTALL_LEASE_UNVERIFIED'),
 };
 let otherControllerLeases=null;
 try{
  const leaseRoot=path.join(controllerHome,'leases'),st=filesystem.lstatSync(leaseRoot);
  if(!st.isDirectory()||st.isSymbolicLink())throw Error('LEASE_DIRECTORY_UNVERIFIED');
  otherControllerLeases=filesystem.readdirSync(leaseRoot).some(x=>
   x!=='supervisor'&&!x.startsWith('supervisor.dead-'));
 }catch{diagnostics.push('OTHER_CONTROLLER_LEASES_UNVERIFIED');}
 const state=WATCHDOG_STATES.has(stateFile?.state)?stateFile.state:null;
 const blockedCode=state==='BLOCKED'&&typeof stateFile?.code==='string'&&
  /^[A-Z_]{1,64}$/.test(stateFile.code)?stateFile.code:null;
 const at=typeof stateFile?.at==='string'&&
  /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(stateFile.at)&&
  Number.isFinite(Date.parse(stateFile.at))&&
  new Date(Date.parse(stateFile.at)).toISOString()===stateFile.at?stateFile.at:null;
 const now=clock();
 const elapsed=at!==null&&Number.isFinite(now)?now-Date.parse(at):null;
 const fresh=elapsed===null?null:elapsed>=0&&elapsed<60000;
 const pid=Number.isSafeInteger(stateFile?.pid)&&stateFile.pid>0?stateFile.pid:null;
 const ownerPid=Number.isSafeInteger(receiver?.pid)&&receiver.pid>0?receiver.pid:null;
 const inhibitors=[
  ['GUARDIAN_STOP',flags.guardianStop],
  ['WATCHDOG_PAUSE',flags.watchdogPause],
  ['CONTROLLER_DRAIN',flags.controllerDrain],
  ['CONTROLLER_INSTALL_LEASE',flags.controllerInstallLease],
  ['OTHER_CONTROLLER_LEASES',otherControllerLeases],
 ].filter(([,value])=>value===true).map(([name])=>name);
 // The Watchdog itself publishes R6's second slot. Do not infer two READY
 // children from the first slot or from a historical, unowned status file.
 const validRole=value=>['READY','STARTING','PROMOTING','UNVERIFIED'].includes(value)?
  value:null;
 const validPid=value=>Number.isSafeInteger(value)&&value>0?value:null;
 const firstRole=validRole(stateFile?.standbyRole),firstPid=validPid(stateFile?.standbyPid);
 const secondRole=validRole(stateFile?.secondStandbyRole);
 const secondPid=validPid(stateFile?.secondStandbyPid);
 const readyCount=Number.isSafeInteger(stateFile?.standbyReadyCount)&&
  stateFile.standbyReadyCount>=0&&stateFile.standbyReadyCount<=2?
   stateFile.standbyReadyCount:null;
 const hasTwoSlotRecord=stateFile!==null&&
  ['secondStandbyRole','secondStandbyPid','standbyReadyCount'].some(key=>
   Object.hasOwn(stateFile,key));
 const processAlive=pid===null?null:pidAlive(pid);
 const receiverPidMatches=pid===null||ownerPid===null?null:pid===ownerPid;
 const standbyPairReadyAtObservation=!hasTwoSlotRecord?null:
  state==='HEALTHY'&&fresh===true&&processAlive===true&&
  receiverPidMatches===true&&firstRole==='READY'&&secondRole==='READY'&&
  readyCount===2&&firstPid!==null&&secondPid!==null&&
  firstPid!==secondPid&&firstPid!==pid&&secondPid!==pid&&
  pidAlive(firstPid)===true&&pidAlive(secondPid)===true;
 return {evidenceScope:'READONLY_WATCHDOG_MARKERS_NOT_RECOVERY_AUTHORIZATION',
  observedAt:at,state,blockedCode,fresh,processAlive,receiverPidMatches,
  guardianStop:flags.guardianStop,watchdogPause:flags.watchdogPause,
  controllerDrain:flags.controllerDrain,
  controllerInstallLease:flags.controllerInstallLease,
  otherControllerLeases,inhibitors,diagnostics,
  ...(firstRole!==null?{standbyRole:firstRole,standbyPid:firstPid}:{}),
  ...(hasTwoSlotRecord?{
   secondStandbyRole:secondRole,secondStandbyPid:secondPid,
   standbyReadyCount:readyCount,standbyPairReadyAtObservation
  }:{} )};
}

/** Non-sensitive Supervisor evidence; does not alter health or recovery verdicts. */
export function summarizeSupervisorReadOnly({supervisor=null,owner=null,state}){
 const pid=x=>Number.isSafeInteger(x)&&x>0?x:null;
 const rawAt=supervisor?.at;
 const heartbeatAt=typeof rawAt==='string'&&
  /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(rawAt)&&
  Number.isFinite(Date.parse(rawAt))&&
  new Date(Date.parse(rawAt)).toISOString()===rawAt?rawAt:null;
 return {heartbeatAt,statusPid:pid(supervisor?.pid),ownerPid:pid(owner?.pid),
  ownerProcessAlive:state.supervisorAlive??null,
  identityVerified:state.supervisorIdentityVerified===true,
  heartbeatFresh:heartbeatAt===null?null:state.supervisorFresh===true,
  childrenVerified:Array.isArray(supervisor?.children)?state.supervisorChildrenVerified===true:null,
  childCount:Array.isArray(supervisor?.children)?supervisor.children.length:null,
  mode:supervisor?.mode==='LISTENING'?'LISTENING':null};
}

export function summarizeAutomation(s){
 const base=maintenanceNextAction(s);
 const localHealthy=s.controllerFilesVerified===true&&s.supervisorAlive===true&&s.supervisorIdentityVerified===true&&
  s.supervisorFresh===true&&s.supervisorChildrenVerified===true&&s.workflowState==='active';
 const healthy=localHealthy&&s.runnerSetOnline===true;
 const permissionOnly=localHealthy&&s.runnerSetOnline===null&&
  s.runnerQueryError==='HTTP_403_FORBIDDEN';
 const receiverVerified=s.maintenanceFilesVerified===true&&
  s.receiverIdentityVerified===true&&s.receiverFresh===true;
 // Public repository receiver is deliberately metadata-only. Do not report
 // its authenticated SOURCE_ONLY poll as a broken install or as B LISTENING.
 const fullReceiver=receiverVerified&&s.receiverListening===true&&
  s.receiverSourceOnly!==true;
 const sourceOnlyReceiver=receiverVerified&&s.receiverSourceOnly===true&&
  s.receiverListening!==true;
 return {...base,localControllerState:localHealthy?'HEALTHY':'UNVERIFIED',
  runnerRegistryState:s.runnerSetOnline===true?'ALL_SIX_ONLINE':s.runnerSetOnline===false?'NOT_ALL_ONLINE':'UNVERIFIED',
  runtimeState:healthy?'HEALTHY':'UNVERIFIED',
  controllerState:healthy?'HEALTHY':'UNVERIFIED',
  maintenanceState:fullReceiver?'HEALTHY':sourceOnlyReceiver?'SOURCE_ONLY_VERIFIED':'UNVERIFIED',
  // SOURCE_ONLY never supplies B effects or whole-automation readiness.
  automationState:healthy&&fullReceiver?'HEALTHY':'PARTIAL_OR_UNVERIFIED',
  installedOperations:s.installedOperations??[],
  // A roster-only permission failure never becomes a required next action.
  // Keep the existing normal path; do not diagnose local Controller again.
  next:base.state==='NO_ACTIVE_INSTALL_LEASE'&&!healthy&&!permissionOnly?
    'DIAGNOSE_CURRENT_RUNTIME_WITHOUT_REPLAYING_OLD_UPDATE':base.next,
  intakeToolPermission:'NOT_TESTED_BY_PC_STATUS',
  intakeNote:'GitHub read access and Runner health do not prove this chat may submit a maintenance request.'};
}

// Fixed non-sensitive observations from the installed automation status.
// Neither PID, nonce, owner path, command line nor environment is included.
export function safeRuntimeSignals(state){
 const names=['controllerFilesVerified','supervisorAlive','supervisorIdentityVerified',
  'supervisorFresh','supervisorChildrenVerified','runnerSetOnline'];
 const flags=Object.fromEntries(names.map(k=>[k,
  typeof state?.[k]==='boolean'?state[k]:null]));
 return {...flags,workflowActive:state?.workflowState==='active'?true:
  ['disabled_manually','disabled_inactivity'].includes(state?.workflowState)?false:null};
}

// Normalize only error classes from gh stderr: never export raw messages,
// URLs, credentials or execution paths. A 403 does NOT prove six offline seats.
// Scoped to the owner-opened operating-PC inventory workflow and the fixed
// GitHub Runner roster GET. Workflow GITHUB_TOKEN is intentionally kept for
// issue/result uploads; it cannot grant repository Administration:read.
// The fixed read may use the PC user's previously authorized gh OAuth only
// in this trusted context. Never read or return credentials.
export function scopedRunnerRosterCliOptions(route,env=process.env){
 if(route!=='actions/runners?per_page=100'||
  env?.GITHUB_ACTIONS!=='true'||
  env?.GITHUB_EVENT_NAME!=='issues'||
  env?.GITHUB_REPOSITORY!==repo||
  env?.GITHUB_ACTOR!=='ansqhd5774-Choi'||
  env?.GITHUB_WORKFLOW_REF!==repo+'/.github/workflows/pc-process-inventory-readonly.yml@refs/heads/main'||
  !operatingNames.includes(env?.RUNNER_NAME)||
  typeof env?.GITHUB_TOKEN!=='string'||!env.GITHUB_TOKEN||
  (typeof env?.GH_TOKEN==='string'&&env.GH_TOKEN.length>0))return {};
 const {GITHUB_TOKEN:workflowToken,...cliEnv}=env;
 return {env:cliEnv};
}
export function classifyRunnerQueryError(error){
 const msg=String(error?.stderr??error?.message??'');
 if(/\bHTTP\s*403\b|\b403\s+Forbidden\b/i.test(msg))return 'HTTP_403_FORBIDDEN';
 if(/\bHTTP\s*401\b|\b401\s+Unauthorized\b/i.test(msg))return 'HTTP_401_UNAUTHORIZED';
 if(/\bHTTP\s*404\b|\b404\s+Not Found\b/i.test(msg))return 'HTTP_404_NOT_FOUND';
 if(/\bHTTP\s*429\b|\b429\s+Too Many Requests\b/i.test(msg))return 'HTTP_429_LIMITED';
 if(error?.code==='ETIMEDOUT')return 'REQUEST_TIMEOUT';
 return 'RUNNER_QUERY_ERROR_OTHER';
}
// Compact read-only reconciliation of the original maintenance request.
// Distinguishes observed artifacts from a verified installation or recovery.
export function summarizeRequestedRecoveryEvidence(state){
 if(!state||state.status!=='STATUS')return null;
 const artifacts=state.artifacts;
 const code=typeof state.ledger?.code==='string'&&/^[A-Z0-9_]{1,96}$/.test(state.ledger.code)
  ?state.ledger.code:null;
 const sha=typeof state.actualControllerSha==='string'&&/^[a-f0-9]{40}$/.test(state.actualControllerSha)
  ?state.actualControllerSha:null;
 return {
  requestId:artifacts?.requestId??null,
  actualControllerSha:sha,
  installedReadbackCode:state.installedReadbackCode??null,
  ledgerReadbackCode:state.ledgerReadbackCode??null,
  lockReadbackCode:state.lockReadbackCode??null,
  artifactReadbackCode:state.artifactReadbackCode??null,
  historicalStatus:state.ledger?.status??null,
  historicalCode:code,
  historicalPhase:typeof state.ledger?.phase==='string'?state.ledger.phase:null,
  postIssueNumber:Number.isSafeInteger(state.ledger?.postIssueNumber)?state.ledger.postIssueNumber:null,
  leaseHeld:state.installLock?.held??null,
  recoveryRequired:state.installLock?.recoveryRequired??null,
  artifacts:artifacts?.artifacts??null,
  backlog:artifacts?.backlog??null,
  installLease:artifacts?.lease??null,
  guidance:state.guidance??null,
  installSuccessProven:false,
  recoveryComplete:false,
  originalRequestRetried:false,
  operationalWrites:0,
 };
}

// Observe the existing durable request, not just the last GitHub comment.
// Elapsed time never turns an advancing/unknown operation into a failure.
export function summarizeRequestProgress(ledger){
 if(!ledger)return {requestId:null,status:null,code:null,phase:null,
  executionState:'NOT_OBSERVED',next:'READ_ORIGINAL_ISSUE_AND_REQUEST_LEDGER',
  executionAuthorized:false,observationOnly:true};
 const token=v=>typeof v==='string'&&/^[A-Z0-9_]{1,96}$/.test(v)?v:null;
 const status=token(ledger.status),phase=token(ledger.phase);
 const code=token(ledger.code),upload=token(ledger.reportUploadStatus);
 const completed=['PASS','SUCCEEDED'].includes(status);
 const recovery=['RECOVERY_REQUIRED','STATE_UNKNOWN','UNKNOWN'].includes(status);
 const failed=['FAILED','BLOCKED','ROLLED_BACK'].includes(status);
 const deliveryPending=completed&&upload!==null&&upload!=='VERIFIED';
 const executionState=deliveryPending?'COMPLETED_RESULT_DELIVERY_PENDING':
  completed?'COMPLETED_REPORTED':recovery?'RECONCILE_REQUIRED':
  failed?'TERMINAL_STOP':status==='RUNNING'?'RUNNING':status==='QUEUED'?'QUEUED':'UNCLASSIFIED';
 return {requestId:typeof ledger.requestId==='string'&&/^pc-[a-z0-9-]{8,76}$/.test(ledger.requestId)?ledger.requestId:null,
  status,code,phase,lastPass:token(ledger.lastPass),firstFail:token(ledger.firstFail),
  updatedAt:typeof ledger.updatedAt==='string'&&ledger.updatedAt.length<=40&&Number.isFinite(Date.parse(ledger.updatedAt))?ledger.updatedAt:null,
  postIssueNumber:Number.isSafeInteger(ledger.postIssueNumber)&&ledger.postIssueNumber>0?ledger.postIssueNumber:null,
  reportUploadStatus:upload,executionState,
  next:completed?'READ_ORIGINAL_RESULT_PAIR_AND_CONTINUE':recovery?
   'RECONCILE_EXISTING_REQUEST_NO_NEW_APPLY':failed?'FIX_REPORTED_FIRST_FAILURE':
   status==='RUNNING'?'FOLLOW_EXISTING_PHASE_NO_DUPLICATE_REQUEST':'READ_EXISTING_RECEIVER_AND_REQUEST_STATE',
  executionAuthorized:false,observationOnly:true};
}

export function collectAutomationStatus(args=process.argv.slice(2)){
 need(process.platform==='win32','STATUS_WINDOWS_REQUIRED');
 need(args.length===0||(args.length===2&&args[0]==='--request-id'&&/^pc-[a-z0-9-]{8,76}$/.test(args[1])),'STATUS_ARGS');
 const codes=[];let runnerQueryError=null;
 const observe=(label,f)=>{try{return f();}catch(error){
  codes.push(label);
  if(label==='RUNNERS_QUERY_UNAVAILABLE')runnerQueryError=classifyRunnerQueryError(error);
  return null;}};
 const host=observe('CONTROLLER_MANIFEST_UNAVAILABLE',()=>read(control+'/host.json'));
 const installed=observe('MAINTENANCE_MANIFEST_UNAVAILABLE',()=>read(maintenance+'/MAINTENANCE_INSTALL.json'));
 const maintenanceVerified=observe('MAINTENANCE_FILES_UNVERIFIED',()=>{
  return verifyMaintenanceManifest(installed,maintenance);
 });
 const receiver=observe('RECEIVER_STATUS_UNAVAILABLE',()=>read(maintenance+'/RECEIVER_STATUS.json'));
 const receiverOwner=observe('RECEIVER_OWNER_UNAVAILABLE',()=>read(maintenance+'/leases/receiver/owner.json'));
 const verified=observe('CONTROLLER_FILES_UNVERIFIED',()=>{
  need(Object.keys(host?.controllerFiles??{}).length>=5,'FILES_MISSING');
  return Object.entries(host.controllerFiles).every(([p,h])=>{
   need(/^(controller\/[a-z0-9-]+\.mjs|config\/operations\.json)$/.test(p),'FILE_PATH');
   return hash(fs.readFileSync(path.join(control,p)))===h;
  });
 });
 const supervisor=observe('SUPERVISOR_STATUS_UNAVAILABLE',()=>read(control+'/SUPERVISOR_STATUS.json'));
 const owner=observe('SUPERVISOR_OWNER_UNAVAILABLE',()=>read(control+'/leases/supervisor/owner.json'));
 const lock=observe('INSTALL_LEASE_UNAVAILABLE',()=>maintenanceLockStatus(maintenance,'controller-install'));
 const github=route=>JSON.parse(execFileSync(gh,['api',`repos/${repo}/${route}`],{encoding:'utf8',windowsHide:true,timeout:30000,maxBuffer:2e6,...scopedRunnerRosterCliOptions(route)}));
 const rows=observe('RUNNERS_QUERY_UNAVAILABLE',()=>github('actions/runners?per_page=100').runners);
 const workflow=observe('WORKFLOW_QUERY_UNAVAILABLE',()=>github('actions/workflows/pc-job.yml').state);
 const operations=observe('INSTALLED_OPERATIONS_UNAVAILABLE',()=>Object.keys(read(control+'/config/operations.json').operations));
 const watchdog=inspectWatchdogReadOnly();
 const ledger=args.length?observe('REQUEST_LEDGER_UNAVAILABLE',()=>read(maintenance+'/ledger/'+args[1]+'.json')):null;
 // Reuse the already implemented fixed-root artifact and recovery readback.
 // Individual failures are collected rather than aborting the other probes.
 const recovery=args.length?observe('RECOVERY_EVIDENCE_UNAVAILABLE',
  ()=>readMaintenanceRecoveryStatus(args[1])):null;
 const state={actualControllerSha:host?.controllerSourceSha??null,
  installedReadbackCode:verified===true?null:'CONTROLLER_FILES_UNVERIFIED',
  lockReadbackCode:lock?null:'INSTALL_LEASE_UNAVAILABLE',
  ledgerReadbackCode:args.length&&!ledger?'REQUEST_LEDGER_UNAVAILABLE':null,
  installLock:lock??{held:true,recoveryRequired:true},ledger,
  controllerFilesVerified:verified===true,supervisorAlive:live(owner?.pid),
  supervisorIdentityVerified:Boolean(owner?.nonce&&owner.pid===supervisor?.pid&&supervisor.sourceSha===host?.controllerSourceSha),
  supervisorFresh:Date.now()-Date.parse(supervisor?.at??'')>=0&&Date.now()-Date.parse(supervisor?.at??'')<45000,
  supervisorChildrenVerified:supervisor?.mode==='LISTENING'&&supervisor?.children?.length===6&&Array.from({length:6},(_,i)=>i+1).every(seat=>supervisor.children.filter(c=>c.seat===seat&&c.alive===true&&live(c.pid)===true).length===1),
  runnerSetOnline:Array.isArray(rows)?dedicatedPcRunnersOnline(rows):null,
  runnerQueryError,workflowState:workflow,installedOperations:operations};
 Object.assign(state,{maintenanceFilesVerified:maintenanceVerified===true,
  receiverIdentityVerified:Boolean(receiverOwner?.nonce&&receiver?.pid===receiverOwner.pid&&live(receiverOwner.pid)===true),
  receiverFresh:Date.now()-Date.parse(receiver?.at??'')>=0&&Date.now()-Date.parse(receiver?.at??'')<180000,
  receiverListening:receiver?.status==='LISTENING',
  receiverSourceOnly:receiver?.status==='PUBLIC_SOURCE_ONLY'});
 return {schema:'ZGMINI_PC_AUTOMATION_STATUS_V1',observedAt:new Date().toISOString(),
  freshnessSeconds:45,collectorSource:'tools/automation-status.mjs',...summarizeAutomation(state),
  actualControllerSha:state.actualControllerSha,maintenanceSourceSha:installed?.sourceSha??null,
  installLock:state.installLock,workflowState:workflow,
  runtimeSignals:safeRuntimeSignals(state),
  receiverObservedAt:receiver?.at??null,receiverStatus:receiver?.status??null,maintenanceFilesVerified:state.maintenanceFilesVerified,
  runners:rows===null?null:operatingPcRunnerEvidence(rows),
  supervisor:summarizeSupervisorReadOnly({supervisor,owner,state}),
  watchdog,
  runnerQueryError,
  historicalRequest:args.length?summarizeRequestProgress(ledger):null,
  recoveryEvidence:args.length?summarizeRequestedRecoveryEvidence(recovery):null,
  diagnostics:codes,operationalWrites:0,providerCalls:0,dbD1Writes:0};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{console.log(JSON.stringify(collectAutomationStatus(process.argv.slice(2))));}catch(e){console.log(JSON.stringify({status:'AUTOMATION_BLOCKED',code:e.code??'STATUS_FAILED',operationalWrites:0}));process.exitCode=2;}
}

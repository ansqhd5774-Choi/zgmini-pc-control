// Fixed one-shot Windows read-only process/operating-mode inventory.
// Never read process command lines, full environment, secrets, user profiles, credentials or DB content.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {parseOriginProof} from '../watchdog-b/activation-first-fail-readonly.mjs';
import {fileURLToPath} from 'node:url';
import {authenticate,validateSeat} from './pc-host-inventory-readonly.mjs';
import {uploadResultPairAtomic} from '../writer-config-b/result-pair-atomic.mjs';
import {collectAutomationStatus} from './automation-status.mjs';
import {installedControllerBPolicy} from './maintenance-contract.mjs';
import {inspectCiControllerBReceiptRootReadonly} from './ci-controller-b-receipt-root-readonly.mjs';
import {inspectCiControllerBActivationReadonly} from './ci-controller-b-activation-readonly.mjs';
import {inspectReceiptCOperatorServiceReadonly,inspectReceiptCFixedPathsReadonly} from './ci-controller-b-c-operator-readonly.mjs';
import {inspectProviderActivity} from '../controller/provider-activity-runtime-readonly.mjs';
import {inspectHttp32TwoHostCheckpoints} from '../controller/http32-two-host-checkpoints-readonly.mjs';
import {inspectSidecarSourceGate} from '../controller/fear-greed-archive-readonly.mjs';
import {inspectCnnGitPredicatesReadonly} from '../controller/cnn-sidecar-git-predicates-readonly.mjs';
import {inspectSidecarBManifestPreimageReadonly,inspectSidecarBResourceFlagsReadonly,inspectSidecarBCoreReadinessReadonly} from '../sidecar-b/operating-probe.mjs';
import {maintenanceLockStatus} from './maintenance-lock.mjs';
import {readMaintenanceRecoveryStatus,protectedSnapshot,backlogPauseWindows} from './update.mjs';
import {readFixedReadonlyBytes} from '../controller/fixed-readonly-bytes.mjs';
import {createHash} from 'node:crypto';
import {inspectTask as inspectMarketParquetTask} from './marketparquet-task-source-readonly.mjs';
import {inspectW03PaidPrivateReadonly,inspectD05PaidThemeFinalOutputsReadonly,inspectD05ConfiguredRegistrationReadonly} from './w03-paid-private-readonly.mjs';
import {validateRunnerJobRefs,inspectRunnerJobHistory} from './runner-job-history-readonly.mjs';
import {inspectW06TaskCadenceReadonly,PROBE as W06_TASK_CADENCE_PROBE} from '../controller/w06-cnn-task-cadence-readonly.mjs';
import {inspectW043409SourcePreflightReadonly} from './w04-3409-source-preflight-readonly.mjs';
import {inspect3409ArchivedReceiptReadonly} from './w04-3409-archive-receipt-readonly.mjs';
import {inspect3516ArchivedReceiptReadonly} from './w04-3516-archive-receipt-readonly.mjs';
import {inspect3409OperatorFileSafetyReadonly} from './w04-3409-operator-file-safety-readonly.mjs';

export const TITLE='pc-process-inventory-readonly';
export const SCHEMA='ZGMINI_PC_PROCESS_INVENTORY_REQUEST_V1';
export const ROLE_OPERATION='process-inventory-readonly';
const REPO='ansqhd5774-Choi/zgmini-pc-control';
const TARGET2960='pc-update-e8767e20-6bad-4418-97c6-561cf79a8213';
const PROBE2960='w05-2960-maintenance-status-readonly';
const TARGET3409='pc-update-71ea39dc-7048-4e10-9d11-d4be7f6c3ec0';
const PROBE3409='w04-3409-maintenance-status-readonly';
const ER1_TARGET='pc-update-f4ad863b-608b-4c04-b23c-921a8b4823fe';
const ER1_PROBE='w04-3587-postcheck-link-readonly';
const ER1_CONTROLLER_SHA='502aac841475fa94b7cc9d56c028fd38b0554831';
const ER1_POSTCHECK_ISSUE=3590,ER1_POSTCHECK_RUN=45617472368,ER1_POSTCHECK_JOB=139216506442;
const TARGET3516='pc-update-c087fa10-88e2-42e3-bc60-c758ab93f0c1';
const PROBE3516='w04-3516-maintenance-status-readonly';
const CONTROLLER3516='83679b013ac9a9820331d93311ec97e572b18e13';
const BEFORE3516='6b3c9c0ce77354d81babe4c9ea7785663c6c2cb4';
const D05_WRITER_PROBE='d05-writer-checkpoint-readonly';
const D05_PRIVATE_RECEIPT_PROBE='d05-private-final-events-readonly';
const D05_THEME_PROBE='d05-theme-final-outputs-readonly';
const D05_REGISTERED_PROBE='d05-configured-registration-readonly';
const C3160_PROBE='c3160-rollback-cas-readonly';
const CNN_STATIC_GUARD_PROBE='cnn-sidecar-static-guard-readonly';
const CNN_GIT_PREDICATES_PROBE='cnn-sidecar-git-predicates-readonly';
const CNN_B_PINS_PROBE='cnn-sidecar-b-preimage-pins-readonly';
const CNN_B_RESOURCE_PROBE='cnn-sidecar-b-resource-readonly';
const CNN_B_CORE_PROBE='cnn-sidecar-b-core-readonly';
const W06_FIXED_TASK_PROBE=W06_TASK_CADENCE_PROBE;
const MAX_BYTES=32768;
const R3_WATCHDOG_PREIMAGE_PROBE='controller-standby-watchdog-preimage-readonly';
const R3_WMI_PROBE='controller-standby-runner-wmi-readonly';
const R4_RUNTIME_PROBE='controller-standby-r4-runtime-readonly';
const R5_RUNTIME_PROBE='controller-standby-r5-runtime-readonly';
const S6_PREIMAGE_PROBE='controller-s6-once-approval-preimage-readonly';
const S6_NEXT_PREIMAGE_PROBE='controller-s6-next-preimage-readonly';
const S6_PREDRAIN_INPUTS_PROBE='controller-s6-predrain-inputs-readonly';
const S6_JOURNAL_PROBE='controller-s6-once-journal-readonly';
const S6_RECEIVER_LEDGER_PROBE='controller-s6-once-receiver-ledger-readonly';
const S6_ACTIVE_INTAKE_PROBE='controller-s6-active-receiver-intake-readonly';
const S6_ACTIVE_INTAKE_REQUEST='pc-s6-63afb126-72dc-4ec5-a721-4819771fa9ee';
const S6_ACTIVE_INTAKE_ISSUE=4069;
const S6_JOURNAL_REQUEST='pc-s6-d7c0a971-5219-4a3a-9dce-30b0543b0e72';
const S6_JOURNAL_APPROVAL_SHA='b8fed5bebec6a473730ed0b09ede5b5dc173db53af5cfc1e619e34a45bb8aefd';
const S6_INSTALLED_MAINTAINER='05ef3bd6b5dc753c5abfbecccacc09375eb18d10';
// Both source IDs have identical authorized 7 runtime file bytes; the later
// 7-to-7 handoff changed CI B policy only. Never accept an arbitrary SHA.
const S6_CURRENT_MAINTAINER_SOURCES=new Set([
 '20a2939d419675ede3e8ab38a3ea3b70756981ac',
 '5a85f803fd9cb280561395f88a3544ee8e7d4660'
]);
const R4_GUARDIAN_ORIGIN_PROBE='controller-standby-r4-guardian-origin-readonly';
const CI_RECEIPT_ROOT_PROBE='ci-controller-b-receipt-root-readonly';
const CI_CONTROLLER_B_ACTIVATION_PROBE='ci-controller-b-activation-readonly';
const CI_CONTROLLER_B_POLICY_CAS_PROBE='ci-controller-b-policy-cas-readonly';
// Existing A only: observe whether the same fixed WMI process-path query
// used by the candidate Watchdog can classify installed Runner executables.
// This single instant is NOT an owner/child-exit proof and cannot promote Standby.
export function classifyR3RunnerWmiRows(raw,{
 controllerRoot='E:/ZGmini/automation/pc-control',
 canonicalize=fs.realpathSync.native
}={}){
 const base={schema:'ZGMINI_R3_STANDBY_RUNNER_WMI_A_V1',
  evidence:'SINGLE_INSTANT_WMI_NOT_PROMOTION_AUTHORIZATION',
  promotionApproved:false,operationalWrites:0,providerCalls:0,d1Writes:0};
 const unknown=(code)=>({...base,status:'STATE_UNKNOWN',code,
  controllerListenerCount:null,controllerWorkerCount:null,unknownPathCount:null,
  unknownListenerCount:null,unknownWorkerCount:null,
  missingWmiPathCount:null,nonAbsoluteWmiPathCount:null,
  canonicalizationFailedCount:null,
  unknownSession0Count:null,unknownServiceAncestorCount:null,
  unknownSession0ServiceAncestorCount:null,serviceObservationUnavailableCount:null});
 if(!raw||!Array.isArray(raw.rows)||raw.rows.length>256)
  return unknown('STANDBY_WMI_ROWS_UNVERIFIED');
 let root;
 try{root=path.win32.normalize(canonicalize(controllerRoot)).toLowerCase();}
 catch{return unknown('STANDBY_WMI_CONTROLLER_ROOT_UNVERIFIED');}
 if(!path.win32.isAbsolute(root)||!root.endsWith('\\')&&root.length<5)
  return unknown('STANDBY_WMI_CONTROLLER_ROOT_UNVERIFIED');
 const prefix=root.replace(/[\\]+$/,'')+'\\runners\\';
 const seen=new Set();let listeners=0,workers=0,unknownPaths=0;
 let unknownListenerCount=0,unknownWorkerCount=0;
 let missingWmiPathCount=0,nonAbsoluteWmiPathCount=0,canonicalizationFailedCount=0;
 let unknownSession0Count=0,unknownServiceAncestorCount=0;
 let unknownSession0ServiceAncestorCount=0,serviceObservationUnavailableCount=0;
 const uncertain=(name,kind,row)=>{
  const session0=row.sessionId===0,serviceAncestor=row.serviceAncestor===true;
  if(session0)unknownSession0Count++;
  if(serviceAncestor)unknownServiceAncestorCount++;
  if(session0&&serviceAncestor)unknownSession0ServiceAncestorCount++;
  if(row.serviceObservationAvailable!==true)serviceObservationUnavailableCount++;
  unknownPaths++;
  if(name==='runner.listener.exe')unknownListenerCount++;
  else unknownWorkerCount++;
  if(kind==='MISSING')missingWmiPathCount++;
  else if(kind==='NON_ABSOLUTE')nonAbsoluteWmiPathCount++;
  else canonicalizationFailedCount++;
 };
 for(const row of raw.rows){
  const name=typeof row?.name==='string'?row.name.toLowerCase():'';
  if(!Number.isSafeInteger(row?.pid)||row.pid<1||seen.has(row.pid)||
   !['runner.listener.exe','runner.worker.exe'].includes(name))
   return unknown('STANDBY_WMI_PROCESS_SHAPE_INVALID');
  seen.add(row.pid);
  if(typeof row.executablePath!=='string'||!row.executablePath){
   uncertain(name,'MISSING',row);continue;
  }
  if(!path.win32.isAbsolute(row.executablePath)){
   uncertain(name,'NON_ABSOLUTE',row);continue;
  }
  let exe;
  try{exe=path.win32.normalize(canonicalize(row.executablePath)).toLowerCase();}
  catch{uncertain(name,'CANONICALIZATION',row);continue;}
  if(!path.win32.isAbsolute(exe)){uncertain(name,'NON_ABSOLUTE',row);continue;}
  if(exe.startsWith(prefix)){
   if(name==='runner.listener.exe')listeners++;
   else workers++;
  }
 }
 if(unknownPaths)return {...base,status:'STATE_UNKNOWN',code:'STANDBY_WMI_EXECUTABLE_PATH_UNVERIFIED',
  controllerListenerCount:listeners,controllerWorkerCount:workers,unknownPathCount:unknownPaths,
  unknownListenerCount,unknownWorkerCount,missingWmiPathCount,
  nonAbsoluteWmiPathCount,canonicalizationFailedCount,
  unknownSession0Count,unknownServiceAncestorCount,
  unknownSession0ServiceAncestorCount,serviceObservationUnavailableCount};
 return {...base,status:'PASS',code:'STANDBY_WMI_EXECUTABLE_PATHS_CLASSIFIED',
  controllerListenerCount:listeners,controllerWorkerCount:workers,unknownPathCount:0,
  unknownListenerCount:0,unknownWorkerCount:0,missingWmiPathCount:0,
  nonAbsoluteWmiPathCount:0,canonicalizationFailedCount:0,
  unknownSession0Count:0,unknownServiceAncestorCount:0,
  unknownSession0ServiceAncestorCount:0,serviceObservationUnavailableCount:0};
}
export function inspectR3RunnerWmiReadonly({
 run=spawnSync,filesystem=fs,env=process.env,
 controllerRoot='E:/ZGmini/automation/pc-control',
 canonicalize=fs.realpathSync.native
}={}){
 const unknown=(code)=>({schema:'ZGMINI_R3_STANDBY_RUNNER_WMI_A_V1',
  status:'STATE_UNKNOWN',code,promotionApproved:false,
  evidence:'SINGLE_INSTANT_WMI_NOT_PROMOTION_AUTHORIZATION',
  controllerListenerCount:null,controllerWorkerCount:null,unknownPathCount:null,
  unknownListenerCount:null,unknownWorkerCount:null,missingWmiPathCount:null,
  nonAbsoluteWmiPathCount:null,canonicalizationFailedCount:null,
  unknownSession0Count:null,unknownServiceAncestorCount:null,
  unknownSession0ServiceAncestorCount:null,serviceObservationUnavailableCount:null,
  operationalWrites:0,providerCalls:0,d1Writes:0});
 if(process.platform!=='win32'||typeof env.SystemRoot!=='string'||
   !/^[a-z]:[\\/]windows$/i.test(env.SystemRoot))
  return unknown('STANDBY_WMI_WINDOWS_SCOPE_UNVERIFIED');
 const ps=path.win32.join(env.SystemRoot,'System32','WindowsPowerShell','v1.0','powershell.exe');
 try{if(!filesystem.statSync(ps).isFile())return unknown('STANDBY_WMI_POWERSHELL_UNAVAILABLE');}
 catch{return unknown('STANDBY_WMI_POWERSHELL_UNAVAILABLE');}
 const cmd=[
  "$ErrorActionPreference='Stop'",
  "$all=@(Get-CimInstance -ClassName Win32_Process -ErrorAction Stop)",
  "if($all.Count -gt 4096){throw 'PROCESS_SCOPE_EXCEEDED'}",
  "$byPid=@{};foreach($p in $all){$byPid[[int]$p.ProcessId]=$p}",
  "$svc=@();$serviceObservationAvailable=$false",
  "try{$svc=@(Get-CimInstance -ClassName Win32_Service -Filter \"Name LIKE 'actions.runner.%'\" -ErrorAction Stop | Where-Object {$_.State -eq 'Running' -and [int]$_.ProcessId -gt 0});$serviceObservationAvailable=$true}catch{}",
  "$svcByPid=@{};foreach($sv in $svc){if([string]$sv.Name -match '(?i)^actions\\.runner\\.'){$svcByPid[[int]$sv.ProcessId]=$true}}",
  "$rows=@(foreach($p in $all | Where-Object {$_.Name -in @('Runner.Listener.exe','Runner.Worker.exe')}){$seen=@{};$parent=[int]$p.ParentProcessId;$serviceAncestor=$false;for($depth=0;$depth -lt 8;$depth++){if($parent -le 0 -or $seen.ContainsKey($parent)){break};$seen[$parent]=$true;if($svcByPid.ContainsKey($parent)){$serviceAncestor=$true;break};if(!$byPid.ContainsKey($parent)){break};$next=[int]$byPid[$parent].ParentProcessId;if($next -eq $parent){break};$parent=$next};$session=if($null -eq $p.SessionId){-1}else{[int]$p.SessionId};[pscustomobject]@{pid=[int]$p.ProcessId;name=[string]$p.Name;executablePath=[string]$p.ExecutablePath;sessionId=$session;serviceAncestor=$serviceAncestor;serviceObservationAvailable=$serviceObservationAvailable}})",
  "[pscustomobject]@{rows=$rows}|ConvertTo-Json -Compress -Depth 4"
 ].join(';');
 let result;
 try{result=run(ps,['-NoLogo','-NoProfile','-NonInteractive','-Command',cmd],
  {windowsHide:true,timeout:15000,maxBuffer:65536,encoding:'utf8',shell:false});}
 catch{return unknown('STANDBY_WMI_PROBE_UNAVAILABLE');}
 if(result.error||result.status!==0||typeof result.stdout!=='string'||
    Buffer.byteLength(result.stdout)>65536)
  return unknown('STANDBY_WMI_PROBE_UNAVAILABLE');
 try{return classifyR3RunnerWmiRows(JSON.parse(result.stdout.replace(/^\uFEFF/,'').trim()),
    {controllerRoot,canonicalize});}
 catch{return unknown('STANDBY_WMI_RESULT_UNVERIFIED');}
}

// One additional scope of the existing approved A inventory; no job,
// schedule, service or runtime source changes. No raw bytes or credentials
// are exported, and any read uncertainty stays explicitly unverified.
export function inspectR3WatchdogPreimageReadonly({
 filesystem=fs,watchdogHome='E:/ZGmini/automation/pc-watchdog'
}={}){
 const unknown=(code)=>({schema:'ZGMINI_R3_WATCHDOG_PREIMAGE_A_V1',
  status:'STATE_UNKNOWN',code,sourceSha256:null,manifestSha256:null,
  declaredSha256:null,scope:'UNVERIFIED',installedMatch:false,
  operationalWrites:0,providerCalls:0,d1Writes:0});
 const root=path.resolve(watchdogHome);
 try{
  const dir=filesystem.lstatSync(root);
  if(!dir.isDirectory()||dir.isSymbolicLink())return unknown('WATCHDOG_PREIMAGE_ROOT_UNSAFE');
  const files=['runner-watchdog.mjs','INSTALL.json'];
  const readBytes=(name,max)=>{
   const filename=path.join(root,name),st=filesystem.lstatSync(filename);
   if(!st.isFile()||st.isSymbolicLink()||st.nlink!==1||
     st.size<10||st.size>max)throw Error('WATCHDOG_PREIMAGE_UNSAFE_FILE');
   const bytes=filesystem.readFileSync(filename);
   if(!Buffer.isBuffer(bytes)||bytes.length!==st.size)
    throw Error('WATCHDOG_PREIMAGE_CHANGED_DURING_READ');
   const after=filesystem.lstatSync(filename);
   if(after.size!==st.size||after.mtimeMs!==st.mtimeMs||
     after.ino!==st.ino)throw Error('WATCHDOG_PREIMAGE_CHANGED_DURING_READ');
   return bytes;
  };
  const source=readBytes(files[0],262144);
  const manifest=readBytes(files[1],16384);
  const sourceSha256=createHash('sha256').update(source).digest('hex');
  const manifestSha256=createHash('sha256').update(manifest).digest('hex');
  const installed=JSON.parse(manifest.toString('utf8'));
  const declaredSha256=/^[a-f0-9]{64}$/.test(installed?.sha256??'')?
    installed.sha256:null;
  const scope=['RUNNER_RECOVERY_ONLY','RUNNER_RECOVERY_AND_MAINTENANCE_HANDOFF_V1']
   .includes(installed?.scope)?installed.scope:'UNVERIFIED';
  const installedMatch=declaredSha256!==null&&sourceSha256===declaredSha256&&
   scope!=='UNVERIFIED';
  return {schema:'ZGMINI_R3_WATCHDOG_PREIMAGE_A_V1',
   status:installedMatch?'PASS':'STATE_UNKNOWN',
   code:installedMatch?'WATCHDOG_PREIMAGE_SOURCE_AND_MANIFEST_MATCH':
    'WATCHDOG_PREIMAGE_SOURCE_OR_SCOPE_UNVERIFIED',
   sourceSha256,manifestSha256,declaredSha256,scope,installedMatch,
   operationalWrites:0,providerCalls:0,d1Writes:0};
 }catch(error){return unknown(error.message==='WATCHDOG_PREIMAGE_CHANGED_DURING_READ'?
  'WATCHDOG_PREIMAGE_CHANGED_DURING_READ':'WATCHDOG_PREIMAGE_READ_UNVERIFIED');}
}
// Fixed operating A readback after the approved R4 two-file stage. It does
// not restart Watchdog, run providers, modify leases or claim failover success.
export function assessR4StandbyRuntimeSnapshot(snapshot,{
 now=Date.now(),pidAlive=pid=>{
  try{process.kill(pid,0);return true;}catch(e){return e?.code==='ESRCH'?false:null;}
 }
}={}){
 const proof={schema:'ZGMINI_R4_STANDBY_RUNTIME_A_V1',status:'STATE_UNKNOWN',
  code:'WATCHDOG_R4_RUNTIME_UNVERIFIED',installedMatch:false,
  controllerTargetMatch:false,naturalRestartObserved:false,
  statusFresh:false,watchdogOwnerVerified:false,standbyIpcReady:false,
  activeSupervisorVerified:false,failoverTested:false,promotionApproved:false,
  operationalWrites:0,providerCalls:0,d1Writes:0};
 const result=(code,patch={})=>({...proof,...patch,code});
 const x=snapshot??{},manifest=x.install,host=x.controllerHost,status=x.status,owner=x.owner;
 const installedMatch=manifest?.standby?.mode==='ACTIVE_1_STANDBY_1'&&
  manifest.standby.approved===true&&
  manifest.approvedTargetSourceSha==='f9c2760ae92ce98ca20784e4a26150edbd0e3578'&&
  manifest.sha256==='9150a024bcb979b69a9d908c75b8eb7cec6794d22506384a28b64a722074951b'&&
  x.sourceSha256===manifest.sha256&&
  manifest.scope==='RUNNER_RECOVERY_AND_MAINTENANCE_HANDOFF_V1';
 // The W06 selective Controller B #3788 changed only the preimage
 // approval helper, leaving the R4 standby/ownership executable set intact.
 // Accept that one attested successor, but never an arbitrary newer SHA.
 const w06ControllerFiles={
  'controller/common.mjs':'91e4ceb5d26412893cc047670a420338aa8ef293e95498f852ac0a2f5edd6cc6',
  'controller/engine.mjs':'6112b5a357d6ecba2ffb299857c2649ee51ca97e1e7755162efd69337976769f',
  'controller/operations.mjs':'d4a76910806cba861b3253f5fd24eccc8968fcbaa66133999483034b2f661cd3',
  'controller/entry.mjs':'407ea8693ab48a03b04ec77fe63f86d05537a37661b42c9ddcd55f5b36aa01d7',
  'controller/supervisor.mjs':'5ec0952872adcaa16eb14adec614f024bac7264deb5b59fb68b9080f0edb0344',
  'controller/standby.mjs':'e18c09b7e9b90fc483d5200e1e0c4741d2e4f93e049328566d710e37c21be7e7',
  'controller/preimage-manifest-contract.mjs':'c59d5d36f0024b7a4b1781ea6eef9351f6275db33c8799bec05bf99abebbfcc1'
 };
 const controllerTargetMatch=host?.controllerSourceSha===
  'b91340d5047daf753e1c17a5c966e4d2aecea586'||
  (host?.controllerSourceSha==='182bb46f2838306ba40d8b4ec32bac40ab75b69a'&&
   !!host.controllerFiles&&typeof host.controllerFiles==='object'&&
   !Array.isArray(host.controllerFiles)&&
   Object.entries(w06ControllerFiles).every(([name,digest])=>
    host.controllerFiles[name]===digest));
 if(!installedMatch||!controllerTargetMatch)
  return result('WATCHDOG_R4_STAGE_OR_CONTROLLER_SOURCE_UNVERIFIED',{
   installedMatch,controllerTargetMatch});
 const stageAt=Date.parse(manifest.upgradedAt),ownerAt=Date.parse(owner?.at),
  statusAt=Date.parse(status?.at);
 const validTime=Number.isFinite(now)&&Number.isFinite(stageAt)&&
  Number.isFinite(ownerAt)&&Number.isFinite(statusAt)&&
  stageAt<=now&&ownerAt<=now&&statusAt<=now&&statusAt>=ownerAt;
 const restarted=validTime&&ownerAt>=stageAt;
 const statusFresh=validTime&&now-statusAt>=0&&now-statusAt<=60000;
 const base={installedMatch:true,controllerTargetMatch:true,
  naturalRestartObserved:restarted,statusFresh};
 if(!restarted)return result('WATCHDOG_R4_NATURAL_RESTART_PENDING',base);
 if(!Number.isSafeInteger(owner?.pid)||owner.pid<=0||
   typeof owner.nonce!=='string'||owner.nonce.length<16||
   status?.pid!==owner.pid||pidAlive(owner.pid)!==true)
  return result('WATCHDOG_R4_PROCESS_OWNER_UNVERIFIED',base);
 const own={...base,watchdogOwnerVerified:true};
 if(!statusFresh||status.state!=='HEALTHY')
  return result('WATCHDOG_R4_HEALTH_STATUS_UNVERIFIED',own);
 if(!Number.isSafeInteger(status.supervisorPid)||status.supervisorPid<=0||
  status.supervisorPid===owner.pid||pidAlive(status.supervisorPid)!==true)
  return result('WATCHDOG_R4_ACTIVE_SUPERVISOR_UNVERIFIED',own);
 const active={...own,activeSupervisorVerified:true};
 if(status.standbyRole!=='READY'||!Number.isSafeInteger(status.standbyPid)||
  status.standbyPid<=0||status.standbyPid===owner.pid||
  status.standbyPid===status.supervisorPid||
  pidAlive(status.standbyPid)!==true)
  return result('WATCHDOG_R4_STANDBY_IPC_UNVERIFIED',active);
 return {...proof,...active,status:'PASS',
  code:'WATCHDOG_R4_ACTIVE_HEALTHY_STANDBY_IPC_READY',
  standbyIpcReady:true,failoverTested:false,promotionApproved:false};
}
export function inspectR4StandbyRuntimeReadonly({
 filesystem=fs,watchdogHome='E:/ZGmini/automation/pc-watchdog',
 controllerHome='E:/ZGmini/automation/pc-control',
 now=Date.now(),pidAlive
}={}){
 const unknown=code=>({schema:'ZGMINI_R4_STANDBY_RUNTIME_A_V1',
  status:'STATE_UNKNOWN',code,installedMatch:false,
  controllerTargetMatch:false,naturalRestartObserved:false,statusFresh:false,
  watchdogOwnerVerified:false,standbyIpcReady:false,
  activeSupervisorVerified:false,failoverTested:false,promotionApproved:false,
  operationalWrites:0,providerCalls:0,d1Writes:0});
 try{
  const readFixed=(root,name,max)=>{
   const directory=path.resolve(root),dir=filesystem.lstatSync(directory);
   if(!dir.isDirectory()||dir.isSymbolicLink())throw Error('ROOT');
   const filename=path.join(directory,name),st=filesystem.lstatSync(filename);
   if(!st.isFile()||st.isSymbolicLink()||st.nlink!==1||
    st.size<10||st.size>max)throw Error('FILE');
   const bytes=filesystem.readFileSync(filename);
   if(!Buffer.isBuffer(bytes)||bytes.length!==st.size)throw Error('CHANGED');
   const after=filesystem.lstatSync(filename);
   if(after.ino!==st.ino||after.mtimeMs!==st.mtimeMs||
    after.size!==st.size)throw Error('CHANGED');
   return bytes;
  };
  const source=readFixed(watchdogHome,'runner-watchdog.mjs',262144),
   install=JSON.parse(readFixed(watchdogHome,'INSTALL.json',16384).toString('utf8')),
   owner=JSON.parse(readFixed(watchdogHome,'receiver/owner.json',16384).toString('utf8')),
   status=JSON.parse(readFixed(watchdogHome,'STATUS.json',16384).toString('utf8')),
   controllerHost=JSON.parse(readFixed(controllerHome,'host.json',32768).toString('utf8'));
  return assessR4StandbyRuntimeSnapshot({
   sourceSha256:createHash('sha256').update(source).digest('hex'),
   install,owner,status,controllerHost
  },{now,...(pidAlive?{pidAlive}:{})});
 }catch{return unknown('WATCHDOG_R4_RUNTIME_READ_UNVERIFIED');}
}


/** R5 two-passive runtime: fixed read-only bytes and live IPC proof. */
export function assessR5StandbyRuntimeSnapshot(snapshot,{
 now=Date.now(),pidAlive=pid=>{
  try{process.kill(pid,0);return true;}catch(e){return e?.code==='ESRCH'?false:null;}
 }
}={}){
 const proof={schema:'ZGMINI_R5_STANDBY_RUNTIME_A_V1',status:'STATE_UNKNOWN',
  code:'WATCHDOG_R5_RUNTIME_UNVERIFIED',installedMatch:false,
  controllerTargetMatch:false,naturalRestartObserved:false,
  statusFresh:false,watchdogOwnerVerified:false,firstStandbyIpcReady:false,
  secondStandbyIpcReady:false,standbyReadyCount:0,
  activeSupervisorVerified:false,failoverTested:false,promotionApproved:false,
  operationalWrites:0,providerCalls:0,d1Writes:0};
 const result=(code,patch={})=>({...proof,...patch,code});
 const x=snapshot??{},manifest=x.install,host=x.controllerHost,status=x.status,owner=x.owner;
 const installedMatch=manifest?.standby?.mode==='ACTIVE_1_STANDBY_2'&&
  manifest.standby.approved===true&&
  manifest.approvedTargetSourceSha==='45807c661ee7f5f11a20b5780e6fd31116b24f84'&&
  manifest.sha256==='9137447231d354d9999cdadbbb5b2a6dee7f0bf869df61881742902ac445128f'&&
  x.sourceSha256===manifest.sha256&&
  manifest.scope==='RUNNER_RECOVERY_AND_MAINTENANCE_HANDOFF_V1';
 // Read-only diagnosis accepts only verified installed Controller rosters.
 // R5 B's historical approval pin remains immutable in standby-r5-contract.mjs.
 const w06ControllerFiles={
  'controller/common.mjs':'91e4ceb5d26412893cc047670a420338aa8ef293e95498f852ac0a2f5edd6cc6',
  'controller/engine.mjs':'6112b5a357d6ecba2ffb299857c2649ee51ca97e1e7755162efd69337976769f',
  'controller/operations.mjs':'d4a76910806cba861b3253f5fd24eccc8968fcbaa66133999483034b2f661cd3',
  'controller/entry.mjs':'407ea8693ab48a03b04ec77fe63f86d05537a37661b42c9ddcd55f5b36aa01d7',
  'controller/supervisor.mjs':'5ec0952872adcaa16eb14adec614f024bac7264deb5b59fb68b9080f0edb0344',
  'controller/standby.mjs':'e18c09b7e9b90fc483d5200e1e0c4741d2e4f93e049328566d710e37c21be7e7',
  'controller/preimage-manifest-contract.mjs':'c59d5d36f0024b7a4b1781ea6eef9351f6275db33c8799bec05bf99abebbfcc1'
 };
 // #4036: the independently approved R2 Controller update replaced exactly
 // operations.mjs and added a private read-only module. Check every pinned
 // digest; no generic future Controller SHA, missing file or weakened IPC gate.
 const breadthR2ControllerFiles={
  ...w06ControllerFiles,
  'controller/operations.mjs':'bac7412c51c156d31b68f725f2532011cccf38359fe18e66a4d3851aa3a2b803',
  'controller/us-breadth-r2-private-readonly.mjs':'e5f1d87626c0fb192831f4fc76fc9e13931af6105a38e503f90f7e656d180fb1'
 };
 // Compare the untrusted source ID as a literal; never index an Object
 // with it (prototype keys such as "__proto__" must fail closed).
 const roster=host?.controllerSourceSha==='182bb46f2838306ba40d8b4ec32bac40ab75b69a'
  ?w06ControllerFiles
  :host?.controllerSourceSha==='3c7d4cfefacf072fd35cb19706b352c64c5e4fd2'
   ?breadthR2ControllerFiles:null;
 const controllerTargetMatch=!!roster&&
  !!host.controllerFiles&&typeof host.controllerFiles==='object'&&
  !Array.isArray(host.controllerFiles)&&
  Object.entries(roster).every(([name,digest])=>
   host.controllerFiles[name]===digest);
 if(!installedMatch||!controllerTargetMatch)
  return result('WATCHDOG_R5_STAGE_OR_CONTROLLER_SOURCE_UNVERIFIED',{
   installedMatch,controllerTargetMatch});
 const stageAt=Date.parse(manifest.upgradedAt),ownerAt=Date.parse(owner?.at),
  statusAt=Date.parse(status?.at);
 const validTime=Number.isFinite(now)&&Number.isFinite(stageAt)&&
  Number.isFinite(ownerAt)&&Number.isFinite(statusAt)&&
  stageAt<=now&&ownerAt<=now&&statusAt<=now&&statusAt>=ownerAt;
 const restarted=validTime&&ownerAt>=stageAt;
 const statusFresh=validTime&&now-statusAt>=0&&now-statusAt<=60000;
 const base={installedMatch:true,controllerTargetMatch:true,
  naturalRestartObserved:restarted,statusFresh};
 if(!restarted)return result('WATCHDOG_R5_NATURAL_RESTART_PENDING',base);
 if(!Number.isSafeInteger(owner?.pid)||owner.pid<=0||
   typeof owner.nonce!=='string'||owner.nonce.length<16||
   status?.pid!==owner.pid||pidAlive(owner.pid)!==true)
  return result('WATCHDOG_R5_PROCESS_OWNER_UNVERIFIED',base);
 // Fixed, non-sensitive state names from the installed R5 Watchdog only.
 // Emit this classification after verifying its live owner. Never publish a
 // raw, unrecognized state, PID, path, owner nonce or heartbeat timestamp.
 const knownStates=new Set([
  'HEALTHY','PAUSED','PAUSED_WORKFLOW','STARTING',
  'BLOCKED_LIVE_OR_UNKNOWN','BLOCKED_STANDBY_SETUP',
  'BLOCKED_STANDBY_PROMOTION_OUTCOME_UNKNOWN','BLOCKED_STANDBY_NOT_READY',
  'BLOCKED_OLD_RUNNER_CHILD_UNVERIFIED','BLOCKED_OLD_RUNNER_EXECUTABLE_UNVERIFIED',
  'BLOCKED_RESTART_LIMIT','BLOCKED_STANDBY_IPC_DELIVERY_UNKNOWN',
  'BLOCKED_SPAWN_ERROR','BLOCKED'
 ]);
 const watchdogHealthState=!statusFresh?'STALE_OR_UNVERIFIED':
  knownStates.has(status.state)?status.state:'UNRECOGNIZED';
 const own={...base,watchdogOwnerVerified:true,watchdogHealthState};
 if(!statusFresh||status.state!=='HEALTHY')
  return result('WATCHDOG_R5_HEALTH_STATUS_UNVERIFIED',own);
 if(!Number.isSafeInteger(status.supervisorPid)||status.supervisorPid<=0||
  status.supervisorPid===owner.pid||pidAlive(status.supervisorPid)!==true)
  return result('WATCHDOG_R5_ACTIVE_SUPERVISOR_UNVERIFIED',own);
 const active={...own,activeSupervisorVerified:true};
 if(status.standbyRole!=='READY'||!Number.isSafeInteger(status.standbyPid)||
  status.standbyPid<=0||status.standbyPid===owner.pid||
  status.standbyPid===status.supervisorPid||
  pidAlive(status.standbyPid)!==true)
  return result('WATCHDOG_R5_STANDBY_IPC_UNVERIFIED',active);
 const first={...active,firstStandbyIpcReady:true,standbyReadyCount:1};
 if(status.secondStandbyRole!=='READY'||!Number.isSafeInteger(status.secondStandbyPid)||
   status.secondStandbyPid<=0||status.standbyReadyCount!==2||
   new Set([owner.pid,status.supervisorPid,status.standbyPid,
     status.secondStandbyPid]).size!==4||
   pidAlive(status.secondStandbyPid)!==true)
  return result('WATCHDOG_R5_SECOND_STANDBY_IPC_UNVERIFIED',first);
 return {...proof,...first,status:'PASS',
  code:'WATCHDOG_R5_ACTIVE_HEALTHY_TWO_STANDBY_IPC_READY',
  secondStandbyIpcReady:true,standbyReadyCount:2,
  failoverTested:false,promotionApproved:false};
}
export function inspectR5StandbyRuntimeReadonly({
 filesystem=fs,watchdogHome='E:/ZGmini/automation/pc-watchdog',
 controllerHome='E:/ZGmini/automation/pc-control',
 now=Date.now(),pidAlive
}={}){
 const unknown=code=>({schema:'ZGMINI_R5_STANDBY_RUNTIME_A_V1',
  status:'STATE_UNKNOWN',code,installedMatch:false,
  controllerTargetMatch:false,naturalRestartObserved:false,statusFresh:false,
  watchdogOwnerVerified:false,firstStandbyIpcReady:false,
  secondStandbyIpcReady:false,standbyReadyCount:0,
  activeSupervisorVerified:false,failoverTested:false,promotionApproved:false,
  operationalWrites:0,providerCalls:0,d1Writes:0});
 try{
  const readFixed=(root,name,max)=>{
   const directory=path.resolve(root),dir=filesystem.lstatSync(directory);
   if(!dir.isDirectory()||dir.isSymbolicLink())throw Error('ROOT');
   const filename=path.join(directory,name),st=filesystem.lstatSync(filename);
   if(!st.isFile()||st.isSymbolicLink()||st.nlink!==1||
    st.size<10||st.size>max)throw Error('FILE');
   const bytes=filesystem.readFileSync(filename);
   if(!Buffer.isBuffer(bytes)||bytes.length!==st.size)throw Error('CHANGED');
   const after=filesystem.lstatSync(filename);
   if(after.ino!==st.ino||after.mtimeMs!==st.mtimeMs||
    after.size!==st.size)throw Error('CHANGED');
   return bytes;
  };
  const source=readFixed(watchdogHome,'runner-watchdog.mjs',262144),
   install=JSON.parse(readFixed(watchdogHome,'INSTALL.json',16384).toString('utf8')),
   owner=JSON.parse(readFixed(watchdogHome,'receiver/owner.json',16384).toString('utf8')),
   status=JSON.parse(readFixed(watchdogHome,'STATUS.json',16384).toString('utf8')),
   controllerHost=JSON.parse(readFixed(controllerHome,'host.json',32768).toString('utf8'));
  return assessR5StandbyRuntimeSnapshot({
   sourceSha256:createHash('sha256').update(source).digest('hex'),
   install,owner,status,controllerHost
  },{now,...(pidAlive?{pidAlive}:{})});
 }catch{return unknown('WATCHDOG_R5_RUNTIME_READ_UNVERIFIED');}
}


// Exact read-only prerequisite for a potential *separately authorized* R4
// Guardian handoff. Reuse the historical WMI helper in PROBE mode only;
// never call ACTIVATE or release any lease from this A operation.
const GUARDIAN_R4_HELPER_SHA='ba4890ca8c8dd7ba4d885d88aff000443a58d1a8b1c9d01f386e10b3e0aa3bbe';
export function classifyR4GuardianOrigin({runtime,probeOutput,originOutput}={}){
 const base={schema:'ZGMINI_R4_GUARDIAN_ORIGIN_A_V1',
  status:'STATE_UNKNOWN',code:'WATCHDOG_R4_GUARDIAN_ORIGIN_UNVERIFIED',
  stageVerified:false,naturalRestartObserved:false,
  guardianProbePassed:false,originMismatches:[],
  activationApproved:false,activationExecuted:false,promotionApproved:false,
  operationalWrites:0,providerCalls:0,d1Writes:0};
 const out=(code,patch={})=>({...base,...patch,code});
 if(runtime?.installedMatch!==true||runtime?.controllerTargetMatch!==true)
  return out('WATCHDOG_R4_STAGE_OR_CONTROLLER_SOURCE_UNVERIFIED');
 const basis={stageVerified:true,naturalRestartObserved:runtime.naturalRestartObserved===true};
 if(basis.naturalRestartObserved)
  return {...out('WATCHDOG_R4_ALREADY_RESTARTED',basis),status:'READ_ONLY_OBSERVED'};
 let mismatches;
 try{mismatches=parseOriginProof(originOutput);}
 catch{return out('WATCHDOG_R4_GUARDIAN_ORIGIN_INVALID',basis);}
 const passed=String(probeOutput??'').trim()==='WATCHDOG_ROTATION_VERIFIED';
 if(passed&&mismatches.some(x=>x!=='COMMAND_EXACT'))
  return out('WATCHDOG_R4_GUARDIAN_PROOFS_CONFLICT',{
   ...basis,originMismatches:mismatches});
 return {...out(passed?'WATCHDOG_R4_GUARDIAN_WMI_PROBE_VERIFIED':
  'WATCHDOG_R4_GUARDIAN_WMI_PROBE_DENIED',{
  ...basis,guardianProbePassed:passed,originMismatches:mismatches}),
  status:'READ_ONLY_OBSERVED'};
}
export function inspectR4GuardianOriginReadonly({
 filesystem=fs,run=spawnSync,
 runtime=inspectR4StandbyRuntimeReadonly(),
 watchdogHome='E:/ZGmini/automation/pc-watchdog'
}={}){
 const unknown=code=>({...classifyR4GuardianOrigin(),code});
 if(runtime?.installedMatch!==true||runtime?.controllerTargetMatch!==true||
   runtime.naturalRestartObserved===true)
  return classifyR4GuardianOrigin({runtime});
 try{
  const ownerPath=path.join(watchdogHome,'receiver/owner.json');
  const st=filesystem.lstatSync(ownerPath);
  if(!st.isFile()||st.isSymbolicLink()||st.nlink!==1||st.size>2048||
     st.size<10)throw Error('OWNER');
  const owner=JSON.parse(filesystem.readFileSync(ownerPath,'utf8'));
  if(!Number.isSafeInteger(owner?.pid)||owner.pid<=0)
   throw Error('OWNER');
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../watchdog-b');
  const guardian=path.join(root,'guardian-rotate.vbs');
  const origin=path.join(root,'guardian-origin-readonly.vbs');
  if(createHash('sha256').update(filesystem.readFileSync(guardian)).digest('hex')!==
     GUARDIAN_R4_HELPER_SHA)
   return unknown('WATCHDOG_R4_GUARDIAN_HELPER_SOURCE_DRIFT');
  const invoke=args=>run('C:/Windows/System32/cscript.exe',
   ['//NoLogo',...args],{windowsHide:true,encoding:'utf8',
     timeout:15000,maxBuffer:2048});
  const evidence=invoke([origin,String(owner.pid)]);
  const proof=invoke([guardian,'PROBE',String(owner.pid)]);
  if(evidence?.error||proof?.error||evidence?.status!==0||
     typeof evidence.stdout!=='string'||typeof proof.stdout!=='string')
   return unknown('WATCHDOG_R4_GUARDIAN_WMI_UNAVAILABLE');
  return classifyR4GuardianOrigin({runtime,
   probeOutput:proof.stdout,originOutput:evidence.stdout});
 }catch{return unknown('WATCHDOG_R4_GUARDIAN_ORIGIN_READ_UNVERIFIED');}
}

const KNOWN_PROCESSES=new Set([
 'runner.listener.exe','runner.worker.exe','node.exe','wscript.exe','cscript.exe',
 'powershell.exe','pwsh.exe','cmd.exe','conhost.exe','git.exe','gh.exe','python.exe',
 'pythonw.exe','dism.exe','dismhost.exe','oscdimg.exe','wrangler.exe'
]);
const PS_SCRIPT=[
 "$ErrorActionPreference = 'Stop'",
 "$names = @('Runner.Listener.exe','Runner.Worker.exe','node.exe','wscript.exe','cscript.exe','powershell.exe','pwsh.exe','cmd.exe','conhost.exe','git.exe','gh.exe','python.exe','pythonw.exe','dism.exe','dismhost.exe','oscdimg.exe','wrangler.exe')",
 "$processes = @(Get-CimInstance -ClassName Win32_Process -ErrorAction Stop)",
 "$filtered = @($processes | Where-Object { $names -contains $_.Name })",
 "$counts = @($filtered | Group-Object Name | Sort-Object Name | ForEach-Object { [pscustomobject]@{name=[string]$_.Name;count=[int]$_.Count} })",
 "$selected = @($filtered | Sort-Object @{Expression={ if ($_.Name -match '(?i)^Runner\\.') {0} elseif ($_.Name -match '(?i)^(wscript|cscript)\\.exe$') {1} elseif ($_.Name -match '(?i)^node\\.exe$') {2} elseif ($_.Name -match '(?i)^(powershell|pwsh)\\.exe$') {3} elseif ($_.Name -match '(?i)^cmd\\.exe$') {4} else {5} }},Name,ProcessId | Select-Object -First 60 | ForEach-Object {",
 " [pscustomobject]@{name=[string]$_.Name;pid=[int]$_.ProcessId;ppid=[int]$_.ParentProcessId;session=[int]$_.SessionId;workingSetMiB=[int][math]::Floor(([double]$_.WorkingSetSize)/1048576);privateCommitMiB=[int][math]::Floor(([double]$_.PageFileUsage)/1024)}",
 "})",
 "$byPid=@{}; foreach($p in $processes){$byPid[[int]$p.ProcessId]=$p}",
 "$memoryRows=@(foreach($p in $processes){ $n=[string]$p.Name; $kind='OTHER_PROCESSES'; if($n -ieq 'Runner.Listener.exe'){$kind='RUNNER_LISTENER'} elseif($n -ieq 'Runner.Worker.exe'){$kind='RUNNER_WORKER'} elseif($n -ieq 'node.exe'){ $kind='NODE_NONRUNNER'; $parentId=[int]$p.ParentProcessId; for($depth=0;$depth -lt 12;$depth++){if(!$byPid.ContainsKey($parentId)){break}; $ancestor=$byPid[$parentId];if($ancestor.Name -in @('Runner.Listener.exe','Runner.Worker.exe')){$kind='NODE_RUNNER_DESCENDANT';break};$nextId=[int]$ancestor.ParentProcessId;if($nextId -eq $parentId){break};$parentId=$nextId} } elseif($n -in @('wscript.exe','cscript.exe','powershell.exe','pwsh.exe','cmd.exe','conhost.exe','git.exe','gh.exe','python.exe','pythonw.exe')){$kind='SUPPORT_PROCESSES'}; [pscustomobject]@{kind=$kind;name=$n;pid=[int]$p.ProcessId;ppid=[int]$p.ParentProcessId;session=$p.SessionId;workingSetMiB=[int][math]::Floor(([double]$p.WorkingSetSize)/1048576);privateCommitMiB=[int][math]::Floor(([double]$p.PageFileUsage)/1024);workingSetUnknown=($null -eq $p.WorkingSetSize);privateCommitUnknown=($null -eq $p.PageFileUsage)} })",
 "$memoryGroups=@($memoryRows | Group-Object kind | Sort-Object Name | ForEach-Object { $items=$_.Group; [pscustomobject]@{kind=[string]$_.Name;count=[int]$_.Count;workingSetMiB=[int]($items | Measure-Object workingSetMiB -Sum).Sum;privateCommitMiB=[int]($items | Measure-Object privateCommitMiB -Sum).Sum;zeroWorkingSetCount=@($items | Where-Object { $_.workingSetMiB -eq 0 }).Count;unknownWorkingSetCount=@($items | Where-Object { $_.workingSetUnknown }).Count;unknownPrivateCommitCount=@($items | Where-Object { $_.privateCommitUnknown }).Count} })",
 "$windowsSystemNames=@('System','Registry','Memory Compression','svchost.exe','smss.exe','csrss.exe','wininit.exe','winlogon.exe','services.exe','lsass.exe','fontdrvhost.exe','dwm.exe','explorer.exe','sihost.exe','SearchHost.exe','ShellExperienceHost.exe','RuntimeBroker.exe','audiodg.exe','taskhostw.exe','dllhost.exe','WUDFHost.exe','ctfmon.exe','ApplicationFrameHost.exe','SearchIndexer.exe','StartMenuExperienceHost.exe','Widgets.exe','MoUsoCoreWorker.exe')",
 "$browserNames=@('chrome.exe','msedge.exe','firefox.exe','brave.exe','opera.exe','vivaldi.exe','msedgewebview2.exe')",
 "$ideNames=@('Code.exe','Cursor.exe','Windsurf.exe','Codex.exe','devenv.exe','idea64.exe','pycharm64.exe','webstorm64.exe')",
 "$securityNames=@('MsMpEng.exe','SecurityHealthService.exe','SecurityHealthSystray.exe','Sense.exe')",
 "$collabNames=@('Teams.exe','ms-teams.exe','outlook.exe','WINWORD.EXE','EXCEL.EXE','POWERPNT.EXE','ONENOTE.EXE','Zoom.exe','slack.exe','Discord.exe')",
 "$otherRows=@($memoryRows | Where-Object { $_.kind -eq 'OTHER_PROCESSES' } | ForEach-Object { $k='UNCLASSIFIED_OTHER'; if($_.name -in $windowsSystemNames){$k='WINDOWS_CORE_UI'} elseif($_.name -in $browserNames){$k='BROWSER_WEBVIEW'} elseif($_.name -in $ideNames){$k='IDE_EDITOR'} elseif($_.name -in $securityNames){$k='SECURITY_TOOLS'} elseif($_.name -in $collabNames){$k='OFFICE_COLLAB'}; [pscustomobject]@{category=$k;pid=$_.pid;ppid=$_.ppid;session=$_.session;workingSetMiB=[int]$_.workingSetMiB;privateCommitMiB=[int]$_.privateCommitMiB} })",
 "$otherSubgroups=@($otherRows | Group-Object category | Sort-Object Name | ForEach-Object { $items=$_.Group; [pscustomobject]@{category=[string]$_.Name;count=[int]$_.Count;workingSetMiB=[int]($items | Measure-Object workingSetMiB -Sum).Sum;privateCommitMiB=[int]($items | Measure-Object privateCommitMiB -Sum).Sum} })",
 "$browserAttribution=@($processes | Where-Object { $_.Name -in $browserNames } | ForEach-Object { $parentId=[int]$_.ParentProcessId; $runnerChild=$false; for($depth=0;$depth -lt 12;$depth++){if(!$byPid.ContainsKey($parentId)){break}; $ancestor=$byPid[$parentId];if($ancestor.Name -in @('Runner.Listener.exe','Runner.Worker.exe')){$runnerChild=$true;break};$nextId=[int]$ancestor.ParentProcessId;if($nextId -eq $parentId){break};$parentId=$nextId}; $scope=if($runnerChild){'RUNNER_DESCENDANT'}elseif($null -eq $_.SessionId){'UNKNOWN_SESSION_NONRUNNER'}elseif([int]$_.SessionId -eq 0){'SESSION_ZERO_NONRUNNER'}else{'NONZERO_SESSION_NONRUNNER'}; [pscustomobject]@{class=$scope;workingSetMiB=[int][math]::Floor(([double]$_.WorkingSetSize)/1048576);privateCommitMiB=[int][math]::Floor(([double]$_.PageFileUsage)/1024)} } | Group-Object class | Sort-Object Name | ForEach-Object { $items=$_.Group; [pscustomobject]@{class=[string]$_.Name;count=[int]$_.Count;workingSetMiB=[int]($items | Measure-Object workingSetMiB -Sum).Sum;privateCommitMiB=[int]($items | Measure-Object privateCommitMiB -Sum).Sum} })",
 "$unclassifiedRows=@($otherRows | Where-Object { $_.category -eq 'UNCLASSIFIED_OTHER' } | ForEach-Object { $parentId=[int]$_.ppid; $runnerChild=$false; for($depth=0;$depth -lt 12;$depth++){if(!$byPid.ContainsKey($parentId)){break};$ancestor=$byPid[$parentId];if($ancestor.Name -in @('Runner.Listener.exe','Runner.Worker.exe')){$runnerChild=$true;break};$nextId=[int]$ancestor.ParentProcessId;if($nextId -eq $parentId){break};$parentId=$nextId}; $scope=if($runnerChild){'RUNNER_DESCENDANT'}elseif($null -eq $_.session){'UNKNOWN_SESSION_NONRUNNER'}elseif([int]$_.session -eq 0){'SESSION_ZERO_NONRUNNER'}else{'NONZERO_SESSION_NONRUNNER'};[pscustomobject]@{class=$scope;workingSetMiB=[int]$_.workingSetMiB;privateCommitMiB=[int]$_.privateCommitMiB} })",
 "$unclassifiedAttribution=@($unclassifiedRows | Group-Object class | Sort-Object Name | ForEach-Object { $items=$_.Group; [pscustomobject]@{class=[string]$_.Name;count=[int]$_.Count;workingSetMiB=[int]($items | Measure-Object workingSetMiB -Sum).Sum;privateCommitMiB=[int]($items | Measure-Object privateCommitMiB -Sum).Sum} })",
 "$otherTopMemory=@($otherRows | Sort-Object @{Expression='workingSetMiB';Descending=$true},@{Expression='privateCommitMiB';Descending=$true} | Select-Object -First 8 | ForEach-Object { [pscustomobject]@{category=$_.category;workingSetMiB=$_.workingSetMiB;privateCommitMiB=$_.privateCommitMiB} })",
 "$services=@()",
 "$serviceStatus='OK'",
 "try { $services=@(Get-CimInstance -ClassName Win32_Service -ErrorAction Stop | Where-Object { $_.Name -match '(?i)^(actions\\.runner\\.|zgmini)' } | Sort-Object Name | Select-Object -First 24 | ForEach-Object { [pscustomobject]@{ name=[string]$_.Name;state=[string]$_.State;startMode=[string]$_.StartMode } }) } catch { $serviceStatus='UNAVAILABLE' }",
 "$tasks=@()",
 "$taskStatus='OK'",
 "try { $tasks=@(Get-ScheduledTask -ErrorAction Stop | Where-Object { $_.TaskName -match '(?i)^ZGMINI[-_ ]' } | Sort-Object TaskName | Select-Object -First 48 | ForEach-Object { [pscustomobject]@{name=[string]$_.TaskName;state=[string]$_.State} }) } catch { $taskStatus='UNAVAILABLE' }",
 "$startup=@()",
 "$startupStatus='OK'",
 "try { $folder=Join-Path $env:APPDATA 'Microsoft\\Windows\\Start Menu\\Programs\\Startup'; if (Test-Path -LiteralPath $folder -PathType Container) { $startup=@(Get-ChildItem -LiteralPath $folder -File -ErrorAction Stop | Where-Object { $_.Name -match '(?i)^ZGMINI[-_. ]' } | Select-Object -First 24 | ForEach-Object { [string]$_.Name }) } } catch { $startupStatus='UNAVAILABLE' }",
 "$w05PidRows=@($processes | Where-Object { [int]$_.ProcessId -eq 14356 })",
 "$w05PidEvidence=[ordered]@{pid=14356;state='UNKNOWN';startedAtUtc=$null}",
 "if($w05PidRows.Count -eq 0){$w05PidEvidence.state='NOT_PRESENT'} elseif($w05PidRows.Count -eq 1){try{if($null -ne $w05PidRows[0].CreationDate){$w05PidEvidence.startedAtUtc=$w05PidRows[0].CreationDate.ToUniversalTime().ToString('o');$w05PidEvidence.state='OBSERVED'}}catch{$w05PidEvidence.state='UNKNOWN'}}",
 "$result=[ordered]@{schema='ZGMINI_PC_PROCESS_PROBE_V1';observedAtUtc=(Get-Date).ToUniversalTime().ToString('o');totalProcessCount=$processes.Count;selectedProcessCount=$filtered.Count;processCounts=@($counts);processes=@($selected);memoryGroups=@($memoryGroups);otherSubgroups=@($otherSubgroups);browserAttribution=@($browserAttribution);unclassifiedAttribution=@($unclassifiedAttribution);otherTopMemory=@($otherTopMemory);services=@($services);serviceStatus=$serviceStatus;tasks=@($tasks);taskStatus=$taskStatus;startup=@($startup);startupStatus=$startupStatus;w05PidEvidence=$w05PidEvidence}",
 "$result | ConvertTo-Json -Compress -Depth 8"
].join('; ');

function fail(code){const err=new Error(code);err.code=code;throw err;}
function simple(s,max=100){return String(s??'').replace(/[^a-zA-Z0-9 ._()-]/g,'?').slice(0,max);}
function smallInt(v,limit=2147483647){return Number.isSafeInteger(v)&&v>=0&&v<=limit?v:null;}
function safeList(a,max){return Array.isArray(a)?a.slice(0,max):[];}
export function authenticateProcess(event,env,role){
 // Reuse exact event/actor/run provenance checks by validating a transformed
 // fixed schema: never accept extra or arbitrary command arguments.
 if(!['operating','handoff'].includes(role))fail('ROLE_INVALID');
 let raw;
 try{raw=JSON.parse(event?.issue?.body??'');}catch{fail('REQUEST_JSON_INVALID');}
 const keys=Object.keys(raw||{}).sort().join(',');
 const basic=keys==='operation,requestId,role,schema';
 const withJobs=keys==='operation,requestId,role,runnerJobRefs,schema';
 const withW05=keys==='operation,probe,requestId,role,schema';
  const isOperator=withW05&&raw.probe==='w05-operator-topology-readonly';
  const is2960=withW05&&raw.probe===PROBE2960;
   const is3409=withW05&&raw.probe===PROBE3409;
   const isEr1Postcheck=withW05&&raw.probe===ER1_PROBE;
  const is3516=withW05&&raw.probe===PROBE3516;
  const isD05Writer=withW05&&raw.probe===D05_WRITER_PROBE;
  const isD05PrivateReceipt=withW05&&raw.probe===D05_PRIVATE_RECEIPT_PROBE;
  const isD05Theme=withW05&&raw.probe===D05_THEME_PROBE;
  const isD05Registration=withW05&&raw.probe===D05_REGISTERED_PROBE;
  const is3160=withW05&&raw.probe===C3160_PROBE;
   const isCnnStaticGuard=withW05&&raw.probe===CNN_STATIC_GUARD_PROBE;
  const isCnnGitPredicates=withW05&&raw.probe===CNN_GIT_PREDICATES_PROBE;
  const isCnnBPins=withW05&&raw.probe===CNN_B_PINS_PROBE;
  const isCnnBResources=withW05&&raw.probe===CNN_B_RESOURCE_PROBE;
  const isCnnBCore=withW05&&raw.probe===CNN_B_CORE_PROBE;
   const isW06Task=withW05&&raw.probe===W06_FIXED_TASK_PROBE;
  const isR3Watchdog=withW05&&raw.probe===R3_WATCHDOG_PREIMAGE_PROBE;
 const isR3Wmi=withW05&&raw.probe===R3_WMI_PROBE;
 const isR4Runtime=withW05&&raw.probe===R4_RUNTIME_PROBE;
 const isR5Runtime=withW05&&raw.probe===R5_RUNTIME_PROBE;
 const isS6Preimage=withW05&&raw.probe===S6_PREIMAGE_PROBE;
 const isS6NextPreimage=withW05&&raw.probe===S6_NEXT_PREIMAGE_PROBE;
 const isS6Predrain=withW05&&raw.probe===S6_PREDRAIN_INPUTS_PROBE;
 const isS6Journal=withW05&&raw.probe===S6_JOURNAL_PROBE;
 const isS6ReceiverLedger=withW05&&raw.probe===S6_RECEIVER_LEDGER_PROBE;
  const isS6ActiveIntake=withW05&&raw.probe===S6_ACTIVE_INTAKE_PROBE;
 const isR4GuardianOrigin=withW05&&raw.probe===R4_GUARDIAN_ORIGIN_PROBE;
 const isCiReceiptRoot=withW05&&raw.probe===CI_RECEIPT_ROOT_PROBE;
 const isCiActivation=withW05&&raw.probe===CI_CONTROLLER_B_ACTIVATION_PROBE;
 const isCiPolicyCas=withW05&&raw.probe===CI_CONTROLLER_B_POLICY_CAS_PROBE;
 const allowedOperatingProbe=isOperator||is2960||is3409||isEr1Postcheck||is3516||
  isD05Writer||isD05PrivateReceipt||isD05Theme||isD05Registration||is3160||
  isCnnStaticGuard||isCnnGitPredicates||isCnnBPins||isCnnBResources||
  isCnnBCore||isW06Task||isR3Watchdog||isR3Wmi||isR4Runtime||isR5Runtime||isS6Preimage||isS6NextPreimage||isS6Predrain||isS6Journal||isS6ReceiverLedger||isS6ActiveIntake||isR4GuardianOrigin||isCiPolicyCas;
 const acceptedProbe=(role==='operating'&&allowedOperatingProbe)||
  (role==='handoff'&&(isCiReceiptRoot||isCiActivation));
 if(!raw||(!basic&&!withJobs&&!withW05)||
   raw.schema!==SCHEMA||raw.operation!==ROLE_OPERATION||raw.role!==role||
   (withJobs&&role!=='operating')||
   (withW05&&!acceptedProbe))
  fail('REQUEST_SCOPE_INVALID');
 const runnerJobRefs=withJobs?validateRunnerJobRefs(raw.runnerJobRefs):null;
 const normalized=structuredClone(event);
 normalized.issue.title='pc-host-inventory-readonly';
 normalized.issue.body=JSON.stringify({schema:'ZGMINI_PC_HOST_INVENTORY_REQUEST_V1',
  operation:'host-inventory-readonly',requestId:raw.requestId,role});
 if(event.issue.title!==TITLE)fail('ISSUE_TITLE_INVALID');
 const verified=authenticate(normalized,env,role);
 return {...verified,...(runnerJobRefs?{runnerJobRefs}:{}),
  ...(isOperator?{w05OperatorTopology:true}:{}),
   ...(is2960?{w052960MaintenanceStatus:true}:{}),
    ...(is3409?{w043409MaintenanceStatus:true}:{}),
    ...(isEr1Postcheck?{w043587PostcheckLink:true}:{}),
   ...(is3516?{w043516MaintenanceStatus:true}:{}),
   ...(isD05Writer?{d05WriterCheckpoint:true}:{}),
   ...(isD05PrivateReceipt?{d05PrivateFinalReceipt:true}:{}),
   ...(isD05Theme?{d05ThemeFinalOutputs:true}:{}),
   ...(isD05Registration?{d05ConfiguredRegistrations:true}:{}),
   ...(is3160?{c3160RecoveryCas:true}:{}),
   ...(isCnnStaticGuard?{cnnSidecarStaticGuard:true}:{}),
   ...(isCnnGitPredicates?{cnnSidecarGitPredicates:true}:{}),
   ...(isCnnBPins?{cnnSidecarBPreimagePins:true}:{}),
   ...(isCnnBResources?{cnnSidecarBResources:true}:{}),
   ...(isCnnBCore?{cnnSidecarBCore:true}:{}),
    ...(isW06Task?{w06TaskCadence:true}:{}),
   ...(isR3Watchdog?{watchdogR3Preimage:true}:{}),
  ...(isR3Wmi?{standbyRunnerWmi:true}:{}),
  ...(isR4Runtime?{watchdogR4Runtime:true}:{}),
  ...(isR5Runtime?{watchdogR5Runtime:true}:{}),
   ...(isS6Preimage?{s6ApprovalPreimage:true}:{}),
   ...(isS6NextPreimage?{s6NextPreimage:true}:{}),
   ...(isS6Predrain?{s6PredrainInputs:true}:{}),
   ...(isS6Journal?{s6OnceJournal:true}:{}),
   ...(isS6ReceiverLedger?{s6ReceiverLedger:true}:{}),
    ...(isS6ActiveIntake?{s6ActiveIntake:true}:{}),
  ...(isR4GuardianOrigin?{watchdogR4GuardianOrigin:true}:{}),
  ...(isCiReceiptRoot?{ciControllerBReceiptRoot:true}:{}),
  ...(isCiActivation?{ciControllerBActivation:true}:{}),
  ...(isCiPolicyCas?{ciControllerBPolicyCas:true}:{})};
}
export function sanitizeProbe(raw){
 if(!raw||raw.schema!=='ZGMINI_PC_PROCESS_PROBE_V1')fail('PROBE_SCHEMA_INVALID');
 const processes=safeList(raw.processes,60).map(p=>{
   const name=simple(p?.name,60);
   if(!KNOWN_PROCESSES.has(name.toLowerCase()))fail('PROBE_PROCESS_NOT_ALLOWLISTED');
   if(smallInt(p.pid)===null||smallInt(p.ppid)===null)fail('PROBE_PID_INVALID');
   return {name,pid:p.pid,ppid:p.ppid,session:smallInt(p.session,1000),
    workingSetMiB:smallInt(p.workingSetMiB,200000),
    privateCommitMiB:smallInt(p.privateCommitMiB,200000)};
 });
 const processCounts=safeList(raw.processCounts,24).map(p=>{
  const name=simple(p?.name,60);
  if(!KNOWN_PROCESSES.has(name.toLowerCase())||smallInt(p.count,100000)===null)
   fail('PROBE_PROCESS_COUNT_INVALID');
  return {name,count:p.count};
 });
 // Aggregates all processes without exporting private application names,
 // paths, command lines or an unbounded process list.
 const allowedKinds=new Set(['RUNNER_LISTENER','RUNNER_WORKER',
  'NODE_RUNNER_DESCENDANT','NODE_NONRUNNER','SUPPORT_PROCESSES','OTHER_PROCESSES']);
 const memoryGroups=safeList(raw.memoryGroups,6).map(g=>{
  if(!allowedKinds.has(g?.kind))fail('PROBE_MEMORY_GROUP_NOT_ALLOWLISTED');
  const row={kind:g.kind};
  for(const k of ['count','workingSetMiB','privateCommitMiB','zeroWorkingSetCount',
   'unknownWorkingSetCount','unknownPrivateCommitCount']){
    const v=smallInt(g?.[k],2000000);
    if(v===null)fail('PROBE_MEMORY_GROUP_VALUE_INVALID');
    row[k]=v;
  }
  if(row.zeroWorkingSetCount>row.count||row.unknownWorkingSetCount>row.count||
     row.unknownPrivateCommitCount>row.count)fail('PROBE_MEMORY_GROUP_COUNT_INVALID');
  return row;
 });
 if(new Set(memoryGroups.map(g=>g.kind)).size!==memoryGroups.length)
  fail('PROBE_MEMORY_GROUP_DUPLICATE');
 const counted=memoryGroups.reduce((acc,g)=>acc+g.count,0);
 const memoryGroupCoverage=memoryGroups.length===0?'UNAVAILABLE':
   counted===raw.totalProcessCount?'COUNT_COMPLETE':'COUNT_PARTIAL';

 // The original full CIM snapshot stays on the host. Export fixed broad
 // categories only, never arbitrary process names, commands, PIDs or paths.
 const categoryKinds=new Set(['WINDOWS_CORE_UI','BROWSER_WEBVIEW',
  'IDE_EDITOR','SECURITY_TOOLS','OFFICE_COLLAB','UNCLASSIFIED_OTHER']);
 const sanitizeOtherRow=(g,hasCount)=>{
  if(!categoryKinds.has(g?.category))fail('PROBE_OTHER_CATEGORY_NOT_ALLOWLISTED');
  const row={category:g.category};
  for(const k of hasCount?['count','workingSetMiB','privateCommitMiB']:
   ['workingSetMiB','privateCommitMiB']){
   const n=smallInt(g?.[k],2000000);
   if(n===null)fail('PROBE_OTHER_METRIC_INVALID');
   row[k]=n;
  }
  return row;
 };
 const otherSubgroups=safeList(raw.otherSubgroups,6).map(g=>sanitizeOtherRow(g,true));
 if(new Set(otherSubgroups.map(g=>g.category)).size!==otherSubgroups.length)
  fail('PROBE_OTHER_CATEGORY_DUPLICATE');
 const otherCount=memoryGroups.find(g=>g.kind==='OTHER_PROCESSES')?.count;
 const otherSubgroupCount=otherSubgroups.reduce((acc,g)=>acc+g.count,0);
 const otherSubgroupCoverage=otherSubgroups.length===0?'UNAVAILABLE':
  otherCount===otherSubgroupCount?'COUNT_COMPLETE':'COUNT_PARTIAL';
 // Aggregate only fixed browser session/Runner-ancestry classes; no process
 // names, PID, command lines, usernames or per-browser identifiers leave PC.
 const browserClasses=new Set(['RUNNER_DESCENDANT','SESSION_ZERO_NONRUNNER',
  'NONZERO_SESSION_NONRUNNER','UNKNOWN_SESSION_NONRUNNER']);
 const browserAttribution=raw.browserAttribution===undefined?[]:
  safeList(raw.browserAttribution,4).map(g=>{
   if(!browserClasses.has(g?.class))fail('PROBE_BROWSER_CLASS_DENIED');
   const row={class:g.class};
   for(const k of ['count','workingSetMiB','privateCommitMiB']){
    const value=smallInt(g?.[k],2000000);
    if(value===null)fail('PROBE_BROWSER_METRIC_INVALID');
    row[k]=value;
   }
   if(row.count===0)fail('PROBE_BROWSER_ZERO_GROUP');
   return row;
  });
 if(raw.browserAttribution!==undefined){
  if(!Array.isArray(raw.browserAttribution)||
   raw.browserAttribution.length>4||
   new Set(browserAttribution.map(g=>g.class)).size!==browserAttribution.length)
    fail('PROBE_BROWSER_GROUP_INVALID');
  const expected=otherSubgroups.find(g=>g.category==='BROWSER_WEBVIEW')??
   {count:0,workingSetMiB:0,privateCommitMiB:0};
  for(const key of ['count','workingSetMiB','privateCommitMiB'])
   if(browserAttribution.reduce((acc,g)=>acc+g[key],0)!==expected[key])
    fail('PROBE_BROWSER_TOTAL_MISMATCH');
 }
 const browserAttributionCoverage=raw.browserAttribution===undefined?
  'UNAVAILABLE':'COUNT_COMPLETE';
 // Attribution uses existing private PID/parent/session values on the PC;
 // only fixed group totals leave the host, never identities or command lines.
 const unclassifiedClasses=new Set(['RUNNER_DESCENDANT','SESSION_ZERO_NONRUNNER',
  'NONZERO_SESSION_NONRUNNER','UNKNOWN_SESSION_NONRUNNER']);
 const unclassifiedAttribution=raw.unclassifiedAttribution===undefined?[]:
  safeList(raw.unclassifiedAttribution,4).map(g=>{
   if(!unclassifiedClasses.has(g?.class))fail('PROBE_UNCLASSIFIED_CLASS_DENIED');
   const row={class:g.class};
   for(const k of ['count','workingSetMiB','privateCommitMiB']){
    const value=smallInt(g?.[k],2000000);
    if(value===null)fail('PROBE_UNCLASSIFIED_METRIC_INVALID');
    row[k]=value;
   }
   if(row.count===0)fail('PROBE_UNCLASSIFIED_ZERO_GROUP');
   return row;
  });
 if(raw.unclassifiedAttribution!==undefined){
  if(!Array.isArray(raw.unclassifiedAttribution)||
   raw.unclassifiedAttribution.length>4||
   new Set(unclassifiedAttribution.map(g=>g.class)).size!==unclassifiedAttribution.length)
    fail('PROBE_UNCLASSIFIED_GROUP_INVALID');
  const expected=otherSubgroups.find(g=>g.category==='UNCLASSIFIED_OTHER')??
   {count:0,workingSetMiB:0,privateCommitMiB:0};
  for(const key of ['count','workingSetMiB','privateCommitMiB'])
   if(unclassifiedAttribution.reduce((acc,g)=>acc+g[key],0)!==expected[key])
    fail('PROBE_UNCLASSIFIED_TOTAL_MISMATCH');
 }
 const unclassifiedAttributionCoverage=raw.unclassifiedAttribution===undefined?
  'UNAVAILABLE':'COUNT_COMPLETE';
 const otherTopMemory=safeList(raw.otherTopMemory,8).map(g=>sanitizeOtherRow(g,false));
 const services=safeList(raw.services,24).map(s=>{
  const name=simple(s?.name,110);
  if(!/^(actions\.runner\.|zgmini)/i.test(name))fail('PROBE_SERVICE_NOT_ALLOWLISTED');
  return {name,state:simple(s.state,32),startMode:simple(s.startMode,32)};
 });
 const tasks=safeList(raw.tasks,48).map(t=>{
  const name=simple(t?.name,110);
  if(!/^ZGMINI[-_ ]/i.test(name))fail('PROBE_TASK_NOT_ALLOWLISTED');
  return {name,state:simple(t.state,32)};
 });
 const startup=safeList(raw.startup,24).map(n=>{
   const name=simple(n,110);
   if(!/^ZGMINI[-_. ]/i.test(name))fail('PROBE_STARTUP_NOT_ALLOWLISTED');
   return name;
 });
 const mode=x=>x==='OK'?'OK':'UNAVAILABLE';
 return {observedAtUtc:/^\d{4}-\d\d-\d\dT/.test(raw.observedAtUtc||'')?
    String(raw.observedAtUtc).slice(0,32):null,
  totalProcessCount:smallInt(raw.totalProcessCount,100000),
  selectedProcessCount:smallInt(raw.selectedProcessCount,100000),
  processes,processCounts,memoryGroups,memoryGroupCoverage,
  otherSubgroups,otherSubgroupCoverage,browserAttribution,browserAttributionCoverage,
  unclassifiedAttribution,unclassifiedAttributionCoverage,otherTopMemory,
  services,serviceStatus:mode(raw.serviceStatus),
  tasks,taskStatus:mode(raw.taskStatus),startup,startupStatus:mode(raw.startupStatus),
  processListTruncated:smallInt(raw.selectedProcessCount,100000)>processes.length};
}

const SHA40=/^[a-f0-9]{40}$/;
const asSha=x=>typeof x==='string'&&SHA40.test(x)?x:null;
const asBool=x=>typeof x==='boolean'?x:null;
// Only fixed, bounded fields leave the operating PC. Never return a full
// owner/lease/claim object, source path, nonce, credential or environment.
const SIGNAL_KEYS=['controllerFilesVerified','supervisorAlive',
 'supervisorIdentityVerified','supervisorFresh','supervisorChildrenVerified',
 'runnerSetOnline','workflowActive'];
export function sanitizeRuntimeSignals(input){
 const result={};
 for(const k of SIGNAL_KEYS){
  const x=input?.[k];
  result[k]=typeof x==='boolean'?x:null;
 }
 return result;
}
// Exact six operating seats. Never publish raw runner objects, GitHub IDs,
// IP addresses, command lines, or arbitrary diagnostic strings.
const REQUIRED_OPERATING_RUNNERS=Array.from({length:6},(_,i)=>'zgmini-pc-0'+(i+1));
export function sanitizeDedicatedRunnerEvidence(raw){
 const diag=Array.isArray(raw?.diagnostics)?raw.diagnostics:[];
 const unavailable=diag.includes('RUNNERS_QUERY_UNAVAILABLE');
 const items=Array.isArray(raw?.runners)?raw.runners:null;
 const queryState=unavailable?'QUERY_UNAVAILABLE':items?'QUERY_RETURNED':'QUERY_UNVERIFIED';
 const failureReasons=new Set(['HTTP_403_FORBIDDEN','HTTP_401_UNAUTHORIZED',
  'HTTP_404_NOT_FOUND','HTTP_429_LIMITED','REQUEST_TIMEOUT','RUNNER_QUERY_ERROR_OTHER']);
 const queryFailureReason=unavailable&&failureReasons.has(raw?.runnerQueryError)
  ?raw.runnerQueryError:null;
 const rows=REQUIRED_OPERATING_RUNNERS.map(name=>{
  const matches=items?items.filter(x=>x?.name===name):[];
  const observed=matches.length===1?matches[0]:null;
  return {name,status:!items?'UNVERIFIED':matches.length===0?'MISSING':
   matches.length>1?'DUPLICATE':observed?.status==='online'?'online':
   observed?.status==='offline'?'offline':'UNVERIFIED',
   busy:observed&&typeof observed.busy==='boolean'?observed.busy:null};
 });
 const allSixOnline=queryState==='QUERY_RETURNED'&&
  rows.every(x=>x.status==='online');
 return {queryState,queryFailureReason,allSixOnline:queryState==='QUERY_RETURNED'?allSixOnline:null,
  returnedRowCount:items&&Number.isSafeInteger(items.length)?items.length:null,
  runners:rows,operationalWrites:0,providerCalls:0,d1Writes:0};
}
export function sanitizeMaintenanceStatus(raw){
 const diagnostics=Array.isArray(raw?.diagnostics)?raw.diagnostics:[];
 const lockKnown=Boolean(raw?.installLock&&typeof raw.installLock==='object'&&
  !diagnostics.includes('INSTALL_LEASE_UNAVAILABLE'));
 const sourceSha=asSha(raw?.maintenanceSourceSha);
 const sourceVerified=asBool(raw?.maintenanceFilesVerified);
 const held=lockKnown?asBool(raw.installLock.held):null;
 const recoveryRequired=lockKnown?asBool(raw.installLock.recoveryRequired):null;
 const observedAt=typeof raw?.observedAt==='string'&&
  /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}/.test(raw.observedAt)?
  raw.observedAt.slice(0,32):null;
 return {
  status:sourceSha&&sourceVerified===true&&held!==null&&
   recoveryRequired!==null?'PASS':'STATE_UNKNOWN',
  code:sourceSha?'MAINTENANCE_SOURCE_READONLY':'MAINTENANCE_SOURCE_UNVERIFIED',
  observedAtUtc:observedAt,maintenanceSourceSha:sourceSha,
  maintenanceFilesVerified:sourceVerified,
  actualControllerSha:asSha(raw?.actualControllerSha),
  controllerFilesVerified:asBool(raw?.controllerFilesVerified),
  installLockReadbackVerified:lockKnown,
  installLockHeld:held,installLockRecoveryRequired:recoveryRequired,
  receiverStatus:raw?.receiverStatus==='LISTENING'?'LISTENING':'UNVERIFIED',
  workflowState:['active','disabled_manually','disabled_inactivity'].includes(raw?.workflowState)
   ?raw.workflowState:'UNVERIFIED',
  // Existing collectAutomationStatus computes HEALTHY only when the actual
  // Controller file hashes, supervisor heartbeat, six dedicated Runner
  // children and PC Job state are all verified. Do not infer from Issue PASS.
  runtimeState:raw?.runtimeState==='HEALTHY'?'HEALTHY':'UNVERIFIED',
  maintenanceState:raw?.maintenanceState==='HEALTHY'?'HEALTHY':'UNVERIFIED',
  automationState:raw?.automationState==='HEALTHY'?'HEALTHY':'PARTIAL_OR_UNVERIFIED',
  runtimeSignals:sanitizeRuntimeSignals(raw?.runtimeSignals),
  dedicatedRunnerEvidence:sanitizeDedicatedRunnerEvidence(raw),
  operationalWrites:0,providerCalls:0,d1Writes:0
 };
}

/** Fixed #2960 request only. Never release leases, infer ownership or expose raw journal. */
function projectFixedMaintenanceStatus(raw,{requestId,schema,codePrefix}){
 const tok=v=>typeof v==='string'&&/^[A-Z0-9_]{1,96}$/.test(v)?v:null;
 const file=v=>['PRESENT','ABSENT','UNKNOWN','UNSAFE','UNVERIFIED'].includes(v)?v:'UNKNOWN';
 const num=v=>Number.isSafeInteger(v)&&v>=0&&v<=100000?v:null;
 const flag=v=>typeof v==='boolean'?v:null;
 const h=raw?.historicalRequest?.requestId===requestId?raw.historicalRequest:null;
 const e=raw?.recoveryEvidence?.requestId===requestId?raw.recoveryEvidence:null;
 const b=e?.backlog,l=e?.installLease,good=Boolean(h&&e);
 return {schema,requestId,
  status:good?'READ_ONLY_OBSERVED':'STATE_UNKNOWN',
  code:good?codePrefix+'_STATUS_OBSERVED':codePrefix+'_EVIDENCE_INCOMPLETE',
  actualControllerSha:asSha(raw?.actualControllerSha),
  workflowState:['active','disabled_manually','disabled_inactivity'].includes(raw?.workflowState)?
   raw.workflowState:'UNVERIFIED',
  historicalRequest:h?{status:tok(h.status),code:tok(h.code),phase:tok(h.phase),
   lastPass:tok(h.lastPass),firstFail:tok(h.firstFail),
   updatedAt:typeof h.updatedAt==='string'&&Number.isFinite(Date.parse(h.updatedAt))?
    h.updatedAt.slice(0,40):null,
   postIssueNumber:num(h.postIssueNumber),executionState:tok(h.executionState)}:null,
  recoveryEvidence:e?{
   historicalStatus:tok(e.historicalStatus),historicalCode:tok(e.historicalCode),
   historicalPhase:tok(e.historicalPhase),
   installedReadbackCode:tok(e.installedReadbackCode),
   ledgerReadbackCode:tok(e.ledgerReadbackCode),
   lockReadbackCode:tok(e.lockReadbackCode),
   artifactReadbackCode:tok(e.artifactReadbackCode),
   leaseHeld:flag(e.leaseHeld),recoveryRequired:flag(e.recoveryRequired),
   postIssueNumber:num(e.postIssueNumber),
   backlog:b?{file:file(b.file),windows:num(b.windows),
    openWindows:num(b.openWindows),replayCount:num(b.replayCount)}:null,
   installLease:l?{directory:file(l.directory),ownerFile:file(l.ownerFile),
    recoveryMarker:file(l.recoveryMarker),ownerMarkerMatch:flag(l.ownerMarkerMatch)}:null}:null,
  leaseBoundToOriginalRequest:null,recoveryEligible:false,
  protectedStateUnchanged:null,operationalWrites:0,providerCalls:0,d1Writes:0};
}
export function project2960MaintenanceStatus(raw){
 return projectFixedMaintenanceStatus(raw,{requestId:TARGET2960,
  schema:'ZGMINI_W05_2960_MAINTENANCE_READONLY_V1',codePrefix:'W05_2960'});
}
export function project3409MaintenanceStatus(raw){
 return projectFixedMaintenanceStatus(raw,{requestId:TARGET3409,
  schema:'ZGMINI_W04_3409_MAINTENANCE_READONLY_V1',codePrefix:'W04_3409'});
}
// #3587 ER1: project exactly one historical local maintenance record.
// No request-controlled paths, raw ledger publication, mutation or new operation.
export function projectEr1PostcheckLinkReadonly(raw){
 const unknown=code=>({schema:'ZGMINI_ER1_POSTCHECK_LINK_READONLY_V1',
  requestId:ER1_TARGET,status:'STATE_UNKNOWN',code,reportedRunJobLinked:null,
  runId:null,jobId:null,postIssueNumber:null,reportedStatus:null,
  postSourceMetadataMatched:null,exactRunJobMatched:false,
  operationalWrites:0,providerCalls:0,d1Writes:0});
 if(!raw||typeof raw!=='object'||Array.isArray(raw))
  return unknown('ER1_LEDGER_UNAVAILABLE');
 if(raw.requestId!==ER1_TARGET||raw.issueNumber!==3587||
  raw.targetSha!==ER1_CONTROLLER_SHA||raw.postIssueNumber!==ER1_POSTCHECK_ISSUE)
  return unknown('ER1_LEDGER_IDENTITY_UNVERIFIED');
 const link=raw.postcheckLink;
 if(!link||typeof link!=='object'||Array.isArray(link)||
  link.schema!=='ZGMINI_MAINTENANCE_POSTCHECK_LINK_V1'||
  link.requestId!==ER1_TARGET||link.issueNumber!==ER1_POSTCHECK_ISSUE)
  return unknown('ER1_POSTCHECK_LINK_IDENTITY_UNVERIFIED');
 const positive=n=>Number.isSafeInteger(n)&&n>0?n:null;
 const runId=positive(link.runId),jobId=positive(link.jobId);
 const reportedRunJobLinked=typeof link.reportedRunJobLinked==='boolean'?
  link.reportedRunJobLinked:null;
 const reportedStatus=['PASS','FAIL','BLOCKED'].includes(link.reportedStatus)?
  link.reportedStatus:null;
 const postSourceMetadataMatched=typeof link.postSourceVerified==='boolean'?
  link.postSourceVerified:null;
 const observedAtUtc=typeof link.observedAtUtc==='string'&&
  link.observedAtUtc.length<=40&&Number.isFinite(Date.parse(link.observedAtUtc))?
  link.observedAtUtc:null;
 const exactRunJobMatched=reportedRunJobLinked===true&&
  runId===ER1_POSTCHECK_RUN&&jobId===ER1_POSTCHECK_JOB&&
  reportedStatus==='PASS';
 return {schema:'ZGMINI_ER1_POSTCHECK_LINK_READONLY_V1',requestId:ER1_TARGET,
  status:exactRunJobMatched?'PASS':'PARTIAL',
  code:exactRunJobMatched?'ER1_LOCAL_RUN_JOB_LINK_MATCHED':'ER1_LOCAL_RUN_JOB_LINK_UNVERIFIED',
  postIssueNumber:ER1_POSTCHECK_ISSUE,reportedRunJobLinked,runId,jobId,
  reportedStatus,postSourceMetadataMatched,observedAtUtc,exactRunJobMatched,
  // The source SHA's existence in the claimed repository is NOT attested here.
  sourceCommitExistenceVerified:null,
  operationalWrites:0,providerCalls:0,d1Writes:0};
}
function inspectEr1PostcheckLinkReadonly(){
 const root='E:/ZGmini/automation/pc-maintenance';
 const file=path.join(root,'ledger',ER1_TARGET+'.json');
 const observed=readFixedReadonlyBytes(file,
  {verifiedRoot:root,minBytes:1,maxBytes:131072});
 if(observed.ok!==true)return projectEr1PostcheckLinkReadonly(null);
 try{return projectEr1PostcheckLinkReadonly(JSON.parse(observed.bytes.toString('utf8')));}
 catch{return projectEr1PostcheckLinkReadonly(null);}
}

// Fixed #3516 recovery observation, never a substitute for the original postcheck.
// Identity mismatches leave a bounded STATE_UNKNOWN report rather than false PASS.
export function project3516MaintenanceStatus(raw){
 const out=projectFixedMaintenanceStatus(raw,{requestId:TARGET3516,
  schema:'ZGMINI_W04_3516_MAINTENANCE_READONLY_V1',codePrefix:'W04_3516'});
 if(out.status==='READ_ONLY_OBSERVED'&&
   (out.actualControllerSha!==CONTROLLER3516||
    out.historicalRequest?.postIssueNumber!==3519||
    out.recoveryEvidence?.postIssueNumber!==3519))
  return {...out,status:'STATE_UNKNOWN',code:'W04_3516_IDENTITY_UNVERIFIED'};
 return out;
}
// Compare only the exact #2960 approved protected snapshot, never dump its
// file hashes, local paths, secrets or current operating configuration.
// Null means the baseline/current observation cannot be compared, not drift.
export function compare2960ProtectedBaseline(original,current){
 const record=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
 if(!record(original)||!record(current)||!record(original.files)||
  !record(original.tasks)||!record(current.files)||!record(current.tasks))
  return null;
 return JSON.stringify(original)===JSON.stringify(current);
}
// Scope classification is NOT a Writer CAS approval. It only distinguishes
// a possible single Writer config SHA change from other protected-state drift.
export function classify2960ProtectionDifference(original,current){
 const same=compare2960ProtectedBaseline(original,current);
 if(same===null)return 'UNVERIFIED';
 if(same)return 'UNCHANGED';
 const before=original.files['config.json'],after=current.files['config.json'];
 if(typeof before==='string'&&typeof after==='string'&&
  /^[a-f0-9]{64}$/.test(before)&&/^[a-f0-9]{64}$/.test(after)&&before!==after){
  const candidate={...original,files:{...original.files,'config.json':after}};
  if(JSON.stringify(candidate)===JSON.stringify(current))return 'WRITER_CONFIG_ONLY';
 }
 return 'OTHER_PROTECTED_DRIFT';
}
function inspect2960ProtectedBaselineReadonly(){
 const unknown={unchanged:null,differenceClass:'UNVERIFIED'};
 const original=path.join('E:/ZGmini/automation/pc-control','backups',
  'controller-update-'+TARGET2960,'PROTECTED_BEFORE.json');
 try{
  const stat=fs.lstatSync(original);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size<=0||stat.size>65536)
   return unknown;
  const bytes=fs.readFileSync(original);
  if(bytes.length!==stat.size)return unknown;
  const baseline=JSON.parse(bytes.toString('utf8')),current=protectedSnapshot();
  return {unchanged:compare2960ProtectedBaseline(baseline,current),
   differenceClass:classify2960ProtectionDifference(baseline,current)};
 }catch{return unknown;}
}

// #2960's install owner does not store a requestId. Correlate the existing
// recovery marker with the exact original journal and its timestamp; this is
// not a release decision, nor proof of a completed original postcheck.
function assessFixedOriginalLeaseLineage(ledger,owner,marker,{requestId,issueNumber,postIssueNumber,targetSha=null}){
 const validOwner=Number.isSafeInteger(owner?.pid)&&owner.pid>0&&
  /^[a-f0-9-]{36}$/.test(owner?.nonce??'');
 const originalLedger=ledger?.requestId===requestId&&ledger.issueNumber===issueNumber&&
  ledger.status==='RECOVERY_REQUIRED'&&
  ledger.firstFail==='POSTCHECK_PENDING'&&ledger.postIssueNumber===postIssueNumber&&
  (targetSha===null||ledger.targetSha===targetSha);
 const ownerMarker=Boolean(validOwner&&marker?.requestOwnerPid===owner.pid&&
  marker?.nonce===owner.nonce);
 const changed=Date.parse(ledger?.updatedAt??'');
 const marked=Date.parse(marker?.at??'');
 const owned=Date.parse(owner?.at??'');
 const chronology=Number.isFinite(changed)&&Number.isFinite(marked)&&
  Number.isFinite(owned)&&owned<=marked&&
  Math.abs(changed-marked)<5000;
 return {originalLedgerMatches:originalLedger,ownerMarkerMatches:ownerMarker,
  recoveryTimelineMatches:chronology,
  correlated:originalLedger&&ownerMarker&&chronology};
}
export function assess2960OriginalLeaseLineage(ledger,owner,marker){
 return assessFixedOriginalLeaseLineage(ledger,owner,marker,{
  requestId:TARGET2960,issueNumber:2960,postIssueNumber:2965});
}
export function assess3409OriginalLeaseLineage(ledger,owner,marker){
 return assessFixedOriginalLeaseLineage(ledger,owner,marker,{
  requestId:TARGET3409,issueNumber:3409,postIssueNumber:3410,
  targetSha:'6b3c9c0ce77354d81babe4c9ea7785663c6c2cb4'});
}
export function assess3516OriginalLeaseLineage(ledger,owner,marker){
 return assessFixedOriginalLeaseLineage(ledger,owner,marker,{
  requestId:TARGET3516,issueNumber:3516,postIssueNumber:3519,
  targetSha:CONTROLLER3516});
}
/** Only exact #3409 intake pause windows; never raw backlog or credentials. */
export function project3409PauseWindows(backlog){
 if(backlog?.schema!=='ZGMINI_PC_BACKLOG_V1'||backlog.requestId!==TARGET3409)return null;
 try{return backlogPauseWindows(backlog).map(window=>({
  pausedAtUtc:new Date(Date.parse(window.pausedAt)).toISOString(),
  resumedAtUtc:window.resumedAt===null?null:
   new Date(Date.parse(window.resumedAt)).toISOString()
 }));}catch{return null;}
}
// CAS digests are for a separately approved independent recovery manifest.
// Only hashes/booleans leave the Windows host; neither lease identity values
// nor raw Writer configuration, snapshots, keys or Task XML are published.
function inspectFixedRecoveryCasReadonly(requestId,assessLineage,expectedBeforeSha=null,include3409Windows=false){
 const unknown=code=>({status:'UNVERIFIED',code,leaseLineageCorrelated:null,
  ownerAlive:null,casDigests:null,recoveryEligible:false});
 const maintenance='E:/ZGmini/automation/pc-maintenance';
 const control='E:/ZGmini/automation/pc-control';
 const data='E:/ZGmini/data';
 const backup=path.join(control,'backups','controller-update-'+requestId);
 const specs={
  ledger:[path.join(maintenance,'ledger',requestId+'.json'),maintenance,131072],
  owner:[path.join(maintenance,'leases/controller-install/owner.json'),maintenance,4096],
  marker:[path.join(maintenance,'leases/controller-install/RECOVERY_REQUIRED.json'),maintenance,4096],
  backlog:[path.join(maintenance,'backlog',requestId+'.json'),maintenance,131072],
  snapshot:[path.join(backup,'snapshot/host.json'),control,65536],
  protection:[path.join(backup,'PROTECTED_BEFORE.json'),control,65536],
  writer:[path.join(data,'pc-writer/config.json'),data,131072]
 };
 const bytes={};
 for(const [key,[file,root,maxBytes]] of Object.entries(specs)){
  const v=readFixedReadonlyBytes(file,{verifiedRoot:root,minBytes:1,maxBytes});
  if(v.ok!==true)return unknown('FIXED_'+key.toUpperCase()+'_UNVERIFIED');
  bytes[key]=v.bytes;
 }
 let ledger,owner,marker,backlog;
 try{
  ledger=JSON.parse(bytes.ledger.toString('utf8'));
  owner=JSON.parse(bytes.owner.toString('utf8'));
  marker=JSON.parse(bytes.marker.toString('utf8'));
  backlog=JSON.parse(bytes.backlog.toString('utf8'));
 }catch{return unknown('RECOVERY_JSON_UNVERIFIED');}
 if(backlog?.requestId!==requestId||backlog?.schema!=='ZGMINI_PC_BACKLOG_V1')
  return unknown('RECOVERY_BACKLOG_IDENTITY_UNVERIFIED');
 if(expectedBeforeSha!==null){
   let savedHost;
   try{savedHost=JSON.parse(bytes.snapshot.toString('utf8'));}catch{return unknown('FIXED_SNAPSHOT_JSON_UNVERIFIED');}
   if(savedHost?.controllerSourceSha!==expectedBeforeSha)return unknown('FIXED_SNAPSHOT_SHA_UNVERIFIED');
  }
  const lineage=assessLineage(ledger,owner,marker);
 let ownerAlive=null;
 if(Number.isSafeInteger(owner?.pid)&&owner.pid>0){
  try{process.kill(owner.pid,0);ownerAlive=true;}
  catch(e){if(e?.code==='ESRCH')ownerAlive=false;}
 }
 const sha=value=>createHash('sha256').update(value).digest('hex');
 const casDigests=Object.fromEntries(Object.entries(bytes).map(
  ([key,value])=>[key+'Sha256',sha(value)]));
 return {status:lineage.correlated?'LINEAGE_CORRELATED':'LINEAGE_UNVERIFIED',
  code:lineage.correlated?'ORIGINAL_RECOVERY_TIMELINE_MATCH':
   'ORIGINAL_RECOVERY_TIMELINE_NOT_VERIFIED',
  leaseLineageCorrelated:lineage.correlated,
  originalLedgerMatches:lineage.originalLedgerMatches,
  ownerMarkerMatches:lineage.ownerMarkerMatches,
  recoveryTimelineMatches:lineage.recoveryTimelineMatches,
  ownerAlive,casDigests,
  ...(include3409Windows?{pauseWindows:project3409PauseWindows(backlog)}:{}),
  recoveryEligible:false};
}

function inspect2960RecoveryCasReadonly(){
 return inspectFixedRecoveryCasReadonly(TARGET2960,assess2960OriginalLeaseLineage);
}
function inspect3409RecoveryCasReadonly(){
 return inspectFixedRecoveryCasReadonly(TARGET3409,assess3409OriginalLeaseLineage,
  '3c20e036ffa56a9a9670916d68c30451d6a699bc',true);
}
function inspect3516RecoveryCasReadonly(){
 return inspectFixedRecoveryCasReadonly(TARGET3516,assess3516OriginalLeaseLineage,
  BEFORE3516);
}

/** Exact #2960 receipt only: skip 32-KiB general inventory payload. */
export function compact2960ProcessResult(base,status){
 return {...base,observedAtUtc:new Date().toISOString(),
  status:status?.status==='READ_ONLY_OBSERVED'?'PASS':'PARTIAL',
  code:status?.code??'W05_2960_EVIDENCE_INCOMPLETE',
  w052960MaintenanceStatus:status??project2960MaintenanceStatus(null)};
}
function inspect2960MaintenanceStatusReadonly(){
 try{
  const existing=project2960MaintenanceStatus(
   collectAutomationStatus(['--request-id',TARGET2960]));
  const protection=existing.status==='READ_ONLY_OBSERVED'?
   inspect2960ProtectedBaselineReadonly():
   {unchanged:null,differenceClass:'UNVERIFIED'};
  return {...existing,protectedStateUnchanged:protection.unchanged,
   protectedDifferenceClass:protection.differenceClass,
   recoveryCas:existing.status==='READ_ONLY_OBSERVED'?
    inspect2960RecoveryCasReadonly():null};
 }catch{return project2960MaintenanceStatus(null);}
}

/** Fixed #3409 receipt only: no dynamic path, request or recovery mutation. */
export function compact3409ProcessResult(base,status){
 return {...base,observedAtUtc:new Date().toISOString(),
  status:status?.status==='READ_ONLY_OBSERVED'?'PASS':'PARTIAL',
  code:status?.code??'W04_3409_EVIDENCE_INCOMPLETE',
  w043409MaintenanceStatus:status??project3409MaintenanceStatus(null)};
}
export function compact3516ProcessResult(base,status){
 return {...base,observedAtUtc:new Date().toISOString(),
  status:status?.status==='READ_ONLY_OBSERVED'?'PASS':'PARTIAL',
  code:status?.code??'W04_3516_EVIDENCE_INCOMPLETE',
  w043516MaintenanceStatus:status??project3516MaintenanceStatus(null)};
}
function inspect3409ProtectedBaselineReadonly(){
 const unknown={unchanged:null,differenceClass:'UNVERIFIED'};
 const control='E:/ZGmini/automation/pc-control';
 const file=path.join(control,'backups','controller-update-'+TARGET3409,'PROTECTED_BEFORE.json');
 try{
  const saved=readFixedReadonlyBytes(file,{verifiedRoot:control,minBytes:1,maxBytes:65536});
  if(saved.ok!==true)return unknown;
  const baseline=JSON.parse(saved.bytes.toString('utf8'));
  const current=protectedSnapshot();
  return {unchanged:compare2960ProtectedBaseline(baseline,current),
   differenceClass:classify2960ProtectionDifference(baseline,current)};
 }catch{return unknown;}
}
function inspect3409MaintenanceStatusReadonly(){
 try{
  const result=project3409MaintenanceStatus(
   collectAutomationStatus(['--request-id',TARGET3409]));
  // A completed original recovery may have archived its install lease;
  // never require that old lease to remain available for archive readback.
  const recoveryArchive=inspect3409ArchivedReceiptReadonly();
  const operatorFileSafety=inspect3409OperatorFileSafetyReadonly();
  if(result.status!=='READ_ONLY_OBSERVED')
   return {...result,recoveryArchive,operatorFileSafety};
  const protectedCheck=inspect3409ProtectedBaselineReadonly();
  return {...result,protectedStateUnchanged:protectedCheck.unchanged,
   protectedDifferenceClass:protectedCheck.differenceClass,
   recoveryCas:recoveryArchive.status==='ARCHIVE_VERIFIED'?null:
    inspect3409RecoveryCasReadonly(),
   recoveryArchive,operatorFileSafety,
   sourcePreflight:inspectW043409SourcePreflightReadonly()};
 }catch{return project3409MaintenanceStatus(null);}
}

// Installed-target and lease CAS only. No mutation or generic request path.
function inspect3516MaintenanceStatusReadonly(){
 try{
  const observed=project3516MaintenanceStatus(
   collectAutomationStatus(['--request-id',TARGET3516]));
  // Archive verification survives when the historical maintenance ledger is
  // no longer classified as active after a valid independent C reconciliation.
  const recoveryArchive=inspect3516ArchivedReceiptReadonly();
  if(observed.status!=='READ_ONLY_OBSERVED')return {...observed,recoveryArchive};
  const control='E:/ZGmini/automation/pc-control';
  const protectedFile=path.join(control,'backups',
   'controller-update-'+TARGET3516,'PROTECTED_BEFORE.json');
  let unchanged=null,differenceClass='UNVERIFIED';
  try{
   const saved=readFixedReadonlyBytes(protectedFile,
    {verifiedRoot:control,minBytes:1,maxBytes:65536});
   if(saved.ok===true){
    const baseline=JSON.parse(saved.bytes.toString('utf8'));
    const current=protectedSnapshot();
    unchanged=compare2960ProtectedBaseline(baseline,current);
    differenceClass=classify2960ProtectionDifference(baseline,current);
   }
  }catch{/* Absence remains unverified, not a permitted install. */}
  return {...observed,protectedStateUnchanged:unchanged,
   protectedDifferenceClass:differenceClass,
   recoveryCas:recoveryArchive.status==='ARCHIVE_VERIFIED'?null:
    inspect3516RecoveryCasReadonly(),recoveryArchive};
 }catch{return {...project3516MaintenanceStatus(null),
  recoveryArchive:inspect3516ArchivedReceiptReadonly()};}
}

const D05_STAGE_STATUSES=new Set(['LOCAL_STORED','UNCHANGED','PREVIOUS_RELEASE_PRESERVED',
 'READY','VERIFIED','BACKLOG','PENDING','FAILED','PARTIAL','UNPROVEN',
 'APPENDED_VERIFIED_LOCAL_ONLY','NOOP_SAME_EVENT']);
const D05_WRITER_MODES=new Set(['PUBLISH','DRY_RUN']);
const D05_WRITER_CODES=new Set(['VERIFIED','VERIFIED_WITH_GAPS','FAILED','DRY_RUN_PASS','DRY_RUN_PARTIAL']);
const safeD05Value=v=>typeof v==='string'&&D05_STAGE_STATUSES.has(v)?v:null;
const safeD05Iso=v=>typeof v==='string'&&/^20\d\d-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(v)&&
 Number.isFinite(Date.parse(v))?new Date(v).toISOString():null;
const D05_TIMING_SCOPE='ATTEMPT_OUTPUT_CALLBACKS_ONLY_NOT_FULL_CORE_OR_WRITER';
const d05TimingInt=(n,max)=>Number.isSafeInteger(n)&&n>=0&&n<=max;
const d05TimingStage=v=>typeof v==='string'&&/^[a-z][a-z0-9-]{0,64}$/.test(v);
const D05_VISIBLE_TIMING_STAGES=new Set([
 'market','market-publication','composite-archive-local',
 'composite-observed-publication','us-breadth-calculation',
 'us-breadth-publication','korea-calculation','korea-publication',
 'rate-sentiment-calculation','rate-sentiment-publication',
 'api-connection-health-snapshot','market-calendar-er1-future',
 'market-calendar-r44-delta','market-calendar-taxonomy',
 'asset-r10-sidecars-publication','inflation-19-publication',
 'inflation-7-publication','cnn-observed-archive',
 'employment-r6-one-year-publication','arrows','feed-publication',
 'projection-publication','projection-build','w05-stored-sidecar',
 'other-stages',
]);
const d05VisibleTimingStage=v=>D05_VISIBLE_TIMING_STAGES.has(v)?v:'other-stages';
// Existing one-file D05 scope: emit bounded stage timings only, never raw
// feed keys, source inputs, file paths, credential values or report bodies.
export function projectD05WriterTiming(raw){
 if(raw===undefined||raw===null)return {status:'NOT_RECORDED'};
 const invalid=()=>({status:'UNVERIFIED'});
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||raw.scope!==D05_TIMING_SCOPE||
  !d05TimingInt(raw.samples,20000)||!d05TimingInt(raw.totalMeasuredMs,1_728_000_000_000)||
  !Array.isArray(raw.slowest)||raw.slowest.length>12||
  !raw.byStage||typeof raw.byStage!=='object'||Array.isArray(raw.byStage))
  return invalid();
 const stages=Object.entries(raw.byStage);
 if(stages.length>33||stages.some(([name,v])=>!d05TimingStage(name)||
  !v||typeof v!=='object'||Array.isArray(v)||!d05TimingInt(v.samples,20000)||
  !d05TimingInt(v.totalMs,1_728_000_000_000)||!d05TimingInt(v.failed,20000)||
  v.failed>v.samples))return invalid();
 const slowest=raw.slowest.map(v=>v&&d05TimingStage(v.stage)&&
  d05TimingInt(v.elapsedMs,86_400_000)&&typeof v.success==='boolean'?
  {stage:d05VisibleTimingStage(v.stage),elapsedMs:v.elapsedMs,success:v.success}:null);
 if(slowest.includes(null)||slowest.length>raw.samples||
  stages.reduce((n,[,v])=>n+v.samples,0)!==raw.samples||
  stages.reduce((n,[,v])=>n+v.totalMs,0)!==raw.totalMeasuredMs)
  return invalid();
 return {status:'OBSERVED_LOCAL_CHECKPOINT',scope:D05_TIMING_SCOPE,
  samples:raw.samples,totalMeasuredMs:raw.totalMeasuredMs,
  byStage:stages.map(([stage,v])=>({stage:d05VisibleTimingStage(stage),samples:v.samples,
   totalMs:v.totalMs,failed:v.failed})).sort((a,b)=>b.totalMs-a.totalMs),
  slowest};
}
/** Fixed 1-file read only. Never include raw Writer report, inputs, paths or secrets. */
export function projectD05WriterCheckpoint(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return {
  status:'STATE_UNKNOWN',code:'D05_WRITER_CHECKPOINT_INVALID',recoveryEligible:false};
 const at=safeD05Iso(raw.at),writerStatus=D05_WRITER_CODES.has(raw.status)?raw.status:null;
 const mode=D05_WRITER_MODES.has(raw.mode)?raw.mode:null;
 const market=safeD05Value(raw.market?.status);
 const archive=safeD05Value(raw.compositeObserved?.status);
 const lineage=safeD05Value(raw.d05PrivateLineageStatus);
 const writerSource=typeof raw.source==='string'&&/^[a-f0-9]{40}$/.test(raw.source)?raw.source:null;
 const dataComplete=Boolean(at&&mode&&writerStatus);
 return {status:dataComplete?'READ_ONLY_OBSERVED':'STATE_UNKNOWN',
  code:dataComplete?'D05_WRITER_CHECKPOINT_OBSERVED':'D05_WRITER_CHECKPOINT_FIELDS_UNVERIFIED',
  writerAt:at,writerMode:mode,writerStatus,writerSource,
  marketStage:market,compositeArchiveStage:archive,d05PrivateLineageStage:lineage,
  writerStageTiming:projectD05WriterTiming(raw.writerStageTiming),
  // Null means no stage was reported, not that a calculation failed.
  // Market reporting may advance to VERIFIED after publication; archive is the only fixed stage gate here.
  // This does not attest the exclusive Writer witness, output append, or full D05 input lineage.
  archiveAppendConditionMet:archive==='LOCAL_STORED',
  actualLineageAppendProven:lineage==='APPENDED_VERIFIED_LOCAL_ONLY',
  localArchiveNewEventProven:archive==='LOCAL_STORED',
  fullD05InputLineageVerified:false,publicD1Verified:false,
  recoveryEligible:false,providerCalls:0,d1Writes:0,operationalWrites:0};
}
export function inspectD05WriterCheckpointReadonly({
 fileSystem=fs,root='E:/ZGmini/data',
}={}){
 let trusted;
 try{trusted=fileSystem.realpathSync.native(root);}
 catch{return {status:'STATE_UNKNOWN',code:'D05_DATA_ROOT_UNAVAILABLE',
  recoveryEligible:false};}
 const file=path.join(root,'pc-writer','local-writer-last-run.json');
 const r=readFixedReadonlyBytes(file,{fileSystem,verifiedRoot:trusted,minBytes:2,maxBytes:131072});
 if(!r.ok)return {status:'STATE_UNKNOWN',code:'D05_WRITER_FILE_'+
  (['MISSING','UNREADABLE','CHANGED_DURING_READ','UNSAFE_FILE','SIZE_INVALID','SHORT_READ']
   .includes(r.reason)?r.reason:'UNVERIFIED'),recoveryEligible:false};
 try{return projectD05WriterCheckpoint(JSON.parse(r.bytes.toString('utf8')));}
 catch{return {status:'STATE_UNKNOWN',code:'D05_WRITER_JSON_INVALID',
  recoveryEligible:false};}
}

/**
 * D05 #3178: read ONLY the last local paid-theme run and its immutable private
 * final-calculation receipt. Never return scores, source records, paths or keys.
 * No provider calls, re-computation, database access or filesystem writes.
 */
export function inspectD05PrivateFinalReceiptReadonly({
 fileSystem=fs,root='E:/ZGmini/data',now=Date.now()
}={}){
 const pending=code=>({status:'PARTIAL',code,receiptMatched:false,
  operationalWrites:0,providerCalls:0,d1Writes:0});
 const digest=b=>createHash('sha256').update(b).digest('hex');
 const SHA=/^[a-f0-9]{64}$/;
 const day=s=>typeof s==='string'&&/^20\d{2}-\d{2}-\d{2}$/.test(s)&&
  Number.isFinite(Date.parse(s+'T00:00:00Z'))&&
  new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
 const iso=s=>typeof s==='string'&&Number.isFinite(Date.parse(s))&&
  new Date(s).toISOString()===s&&Date.parse(s)<=now;
 let real;
 try{real=fileSystem.realpathSync.native(root);}
 catch{return pending('D05_PRIVATE_DATA_ROOT_UNAVAILABLE');}
 const run=readFixedReadonlyBytes(path.join(root,'pc-writer','marketparquet-paid','theme-last-run.json'),
  {fileSystem,verifiedRoot:real,minBytes:2,maxBytes:2097152});
 if(!run.ok)return pending('D05_PRIVATE_RUN_REPORT_'+run.reason);
 let report;
 try{report=JSON.parse(run.bytes.toString('utf8'));}
 catch{return pending('D05_PRIVATE_RUN_REPORT_INVALID');}
 const marker=report?.d05PrivateFinalOutputReadback;
 if(marker?.status!=='LOCAL_PRIVATE_FINAL_THEME_EVENTS_VERIFIED')
  return pending(marker?.status==='UNPROVEN_PRIVATE_FINAL_OUTPUT'?
   'D05_PRIVATE_OUTPUT_UNPROVEN':marker?.status==='NO_VERIFIED_PRIVATE_FINAL_OUTPUT'?
   'D05_PRIVATE_OUTPUT_NOT_VERIFIED':'D05_PRIVATE_RECEIPT_NOT_RECORDED');
 if(!SHA.test(marker.finalEventBodySha256??'')||
  !SHA.test(marker.privateBodySha256??'')||
  !iso(marker.calculatedAt)||!day(marker.confirmedObservationDate)||
  !Number.isSafeInteger(marker.scoreCount)||marker.scoreCount<1||marker.scoreCount>256||
  report.confirmedDate!==marker.confirmedObservationDate||
  report.privateStored?.status!=='PRIVATE_STORED_READBACK_VERIFIED'||
  report.privateStored?.bodySha256!==marker.privateBodySha256||
  report.privateStored?.count!==marker.scoreCount)
  return pending('D05_PRIVATE_RUN_RECEIPT_MISMATCH');
 const file=path.join(root,'pc-writer','marketparquet-paid','derived',
  'd05-private-final-theme-'+marker.finalEventBodySha256+'.json');
 const stored=readFixedReadonlyBytes(file,{fileSystem,verifiedRoot:real,
  minBytes:2,maxBytes:131072});
 if(!stored.ok)return pending('D05_PRIVATE_RECEIPT_FILE_'+stored.reason);
 if(digest(stored.bytes)!==marker.finalEventBodySha256)
  return pending('D05_PRIVATE_RECEIPT_HASH_MISMATCH');
 let parsed;
 try{parsed=JSON.parse(stored.bytes.toString('utf8'));}
 catch{return pending('D05_PRIVATE_RECEIPT_JSON_INVALID');}
 if(parsed?.schema!=='ZGMINI_D05_PRIVATE_THEME_FINAL_EVENTS_R1'||
  parsed.privateBodySha256!==marker.privateBodySha256||
  !SHA.test(parsed.sourceVersion??'')||!SHA.test(parsed.registrySha256??'')||
  parsed.calculatedAt!==marker.calculatedAt||
  parsed.confirmedObservationDate!==marker.confirmedObservationDate||
  !Array.isArray(parsed.events)||parsed.events.length!==marker.scoreCount||
  !parsed.events.every(e=>e&&typeof e.scoreId==='string'&&
   e.scoreId.startsWith('theme:')&&e.phase==='CONFIRMED'&&
   e.calculatedAt===marker.calculatedAt&&
   e.asOfDate===marker.confirmedObservationDate))
  return pending('D05_PRIVATE_RECEIPT_CONTENT_MISMATCH');
 return {status:'PASS',code:'D05_PRIVATE_FINAL_RECEIPT_READBACK_VERIFIED',
  calculatedAt:marker.calculatedAt,
  confirmedObservationDate:marker.confirmedObservationDate,
  scoreCount:marker.scoreCount,
  privateBodySha256:marker.privateBodySha256,
  finalEventBodySha256:marker.finalEventBodySha256,
  receiptMatched:true,localOnly:true,
  operationalWrites:0,providerCalls:0,d1Writes:0};
}

export function compactD05WriterResult(base,status){
 return {...base,observedAtUtc:new Date().toISOString(),
  status:status?.status==='READ_ONLY_OBSERVED'?'PASS':'PARTIAL',
  code:status?.code??'D05_WRITER_CHECKPOINT_UNVERIFIED',
  d05WriterCheckpoint:status??{status:'STATE_UNKNOWN',
   code:'D05_WRITER_CHECKPOINT_UNVERIFIED',recoveryEligible:false}};
}

// Narrow existing operating-PC A probe for the exact prior installed-policy CAS.
// Returns only validated fixed identifiers and raw-manifest hash; never policy
// bytes, arbitrary filesystem paths, execution authority, or owner information.
export function inspectCiControllerBPolicyCasReadonly(filesystem=fs){
 const unavailable={schema:'ZGMINI_CI_CONTROLLER_B_POLICY_CAS_READONLY_V1',
  status:'STATE_UNKNOWN',code:'CI_POLICY_CAS_NOT_VERIFIED',policyCas:null,
  executionAuthorized:false,operationalWrites:0,providerCalls:0,d1Writes:0};
 try{
  const fixed='E:/ZGmini/automation/pc-maintenance/MAINTENANCE_INSTALL.json';
  const stat=filesystem.lstatSync(fixed);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size<1||stat.size>131072)
   return unavailable;
  const bytes=filesystem.readFileSync(fixed);
  if(!Buffer.isBuffer(bytes)||bytes.length!==stat.size)return unavailable;
  const installed=JSON.parse(bytes.toString('utf8'));
  const policy=installedControllerBPolicy(installed);
  if(!policy)return unavailable;
  return {...unavailable,status:'PASS',code:'CI_POLICY_CAS_READONLY_OBSERVED',
   policyCas:{sourceSha:installed.sourceSha,
    installedManifestSha256:createHash('sha256').update(bytes).digest('hex'),
    workflowId:policy.workflowId,workflowBlobSha:policy.workflowBlobSha,
    fixedWorkflowPathVerified:true,enabledShapeVerified:true}};
 }catch{return unavailable;}
}

// Fixed existing install-root A readback. Never returns policy bytes, filesystem
// paths, owner identity, credentials or issuer authority. Only the independent
// maintenance handoff can install the actual receiver policy.
export function inspectCiControllerBReceiverReadOnly(filesystem=fs){
 // Preserve historical V2 verification and add a separate exact post-guard
 // install pin, without disclosing policy bytes or widening execution authority.
 const approvedSource='08c0df1c4315019d85502dca2b0e4fd980eef48a';
 const approvedWorkflowPin='d3c175329a7ac955f5b45ce2b13dad78ce272d9a';
 const receiptGuardSource='73f70de98b030d4bac0af48ac50023ec1bd7ce1f';
 const receiptGuardWorkflowPin='b568bbc5de05b2d6fff75419b88322b3e2de020c';
 const result=(policyState,manifestReadable,approvedV2PinMatches=null,approvedReceiptGuardPinMatches=null)=>({
  schema:'ZGMINI_CI_CONTROLLER_B_RECEIVER_READONLY_V1',
  policyState,manifestReadable,approvedV2PinMatches,approvedReceiptGuardPinMatches,
  executionAuthorized:false,
  installedSourceIntegrityAsserted:false,operationalWrites:0,providerCalls:0,d1Writes:0
 });
 try{
  const fixed='E:/ZGmini/automation/pc-maintenance/MAINTENANCE_INSTALL.json';
  const stat=filesystem.lstatSync(fixed);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size<1||stat.size>131072)
   return result('UNVERIFIED',false);
  const manifest=JSON.parse(filesystem.readFileSync(fixed,'utf8'));
  if(manifest?.schema!=='ZGMINI_PC_MAINTENANCE_INSTALL_V1'||
    !SHA40.test(manifest.sourceSha??'')||
    typeof manifest.files!=='object'||manifest.files===null||Array.isArray(manifest.files))
   return result('UNVERIFIED',false);
  if(!Object.hasOwn(manifest,'ciControllerBPolicy'))
   return result('ABSENT_IN_INSTALLED_MANIFEST',true);
  try{
   const policy=installedControllerBPolicy(manifest);
   if(!policy)return result('UNVERIFIED',true);
   return result('PRESENT_FORMAT_ONLY',true,
    manifest.sourceSha===approvedSource&&
    policy.workflowBlobSha===approvedWorkflowPin&&policy.workflowId===430972394,
    manifest.sourceSha===receiptGuardSource&&
    policy.workflowBlobSha===receiptGuardWorkflowPin&&policy.workflowId===430972394);
  }catch{return result('INVALID',true);}
 }catch{return result('UNVERIFIED',false);}
}

function collectMaintenanceStatusReadonly(){
 try{return sanitizeMaintenanceStatus(collectAutomationStatus([]));}
 catch{return sanitizeMaintenanceStatus(null);}
}


// Fixed #2505 installed-Controller recovery snapshot, using the existing
// independent operating-PC process-inventory route. Never reads raw data,
// exports owner/lease bytes, or grants any rollback/install authorization.
const C2505_ID='pc-update-8f413b02-4bb7-4d99-b71f-64d9c51a294a';
const C2505_TARGET='0f1effad0c58e8b7bd684aa638521180183ca902';
const C2505_PHASES=new Set(['RECEIVED','VALIDATED','STAGED','INTAKE_PAUSED',
 'DRAINED','BACKED_UP','SUPERVISOR_STOPPED','SWITCHED','RECONNECTED',
 'INTAKE_RESUMED','BACKLOG_RECONCILED','POSTCHECK_PENDING','RECOVERY_REQUIRED',
 'PASS','BLOCKED','ROLLED_BACK']);
const C2505_STATES=new Set(['PRESENT','ABSENT','UNKNOWN','UNSAFE','UNVERIFIED']);
const c2505Unknown=code=>({schema:'ZGMINI_C2505_RECOVERY_READONLY_V1',
 requestId:C2505_ID,status:'STATE_UNKNOWN',code,actualControllerSha:null,
 originalRequestRetried:false,recoveryEligible:false,installSuccessProven:false,
 operationalWrites:0,providerCalls:0,d1Writes:0});
const c2505State=x=>C2505_STATES.has(x)?x:'UNKNOWN';
const c2505Bool=x=>typeof x==='boolean'?x:null;
export function project2505RecoveryReadonly(raw){
 const ledger=raw?.ledger,a=raw?.artifacts;
 if(raw?.status!=='STATUS'||ledger?.requestId!==C2505_ID||
    ledger?.issueNumber!==2505||ledger?.targetSha!==C2505_TARGET)
  return c2505Unknown('C2505_LEDGER_IDENTITY_UNVERIFIED');
 if(a?.schema!=='ZGMINI_PC_UPDATE_ARTIFACT_READBACK_V1'||
    a.requestId!==C2505_ID)
  return c2505Unknown('C2505_ARTIFACT_IDENTITY_UNVERIFIED');
 const backup={};
 for(const key of ['backupRoot','stageRoot','snapshotRoot','stagedHost',
  'originalHost','protectedBefore','previousHost'])
  backup[key]=c2505State(a.artifacts?.[key]);
 const backlog={file:c2505State(a.backlog?.file),
  windows:Number.isSafeInteger(a.backlog?.windows)&&a.backlog.windows>=0&&
   a.backlog.windows<=64?a.backlog.windows:null,
  openWindows:Number.isSafeInteger(a.backlog?.openWindows)&&
   a.backlog.openWindows>=0&&a.backlog.openWindows<=64?a.backlog.openWindows:null,
  replayCount:Number.isSafeInteger(a.backlog?.replayCount)&&
   a.backlog.replayCount>=0&&a.backlog.replayCount<=10000?a.backlog.replayCount:null};
 const lease={directory:c2505State(a.lease?.directory),
  ownerFile:c2505State(a.lease?.ownerFile),
  recoveryMarker:c2505State(a.lease?.recoveryMarker),
  ownerMarkerMatch:c2505Bool(a.lease?.ownerMarkerMatch),
  held:c2505Bool(raw.installLock?.held),
  recoveryRequired:c2505Bool(raw.installLock?.recoveryRequired),
  // Matching owner/marker is NOT proof that this is #2505's own lease.
  ownerRequestIdentityVerified:null};
 const validStates=Object.values(backup).every(v=>v==='PRESENT'||v==='ABSENT')&&
  [backlog.file,lease.directory,lease.ownerFile,lease.recoveryMarker]
   .every(v=>v==='PRESENT'||v==='ABSENT');
 const countsValid=backlog.file!=='PRESENT'||backlog.windows!==null&&
  backlog.openWindows!==null&&backlog.replayCount!==null&&
  backlog.openWindows<=backlog.windows;
 const observed=raw.installedReadbackCode===null&&
  raw.ledgerReadbackCode===null&&raw.lockReadbackCode===null&&
  raw.artifactReadbackCode===null&&a.status==='OBSERVED'&&validStates&&
  countsValid&&lease.held!==null&&lease.recoveryRequired!==null&&
  (lease.recoveryMarker!=='PRESENT'||lease.ownerMarkerMatch===true);
 return {schema:'ZGMINI_C2505_RECOVERY_READONLY_V1',requestId:C2505_ID,
  status:observed?'READ_ONLY_OBSERVED':'STATE_UNKNOWN',
  code:observed?'C2505_FIXED_ARTIFACTS_OBSERVED':'C2505_FIXED_ARTIFACTS_UNVERIFIED',
  actualControllerSha:asSha(raw.actualControllerSha),
  expectedTargetSha:C2505_TARGET,
  ledgerStatus:C2505_PHASES.has(ledger.status)?ledger.status:null,
  ledgerPhase:C2505_PHASES.has(ledger.phase)?ledger.phase:null,
  ledgerFirstFail:C2505_PHASES.has(ledger.firstFail)?ledger.firstFail:null,
  postIssueNumber:ledger.postIssueNumber===2506?2506:null,
  ledgerWorkflowEnabled:c2505Bool(ledger.workflowEnabled),
  ledgerIntakePaused:c2505Bool(ledger.intakePaused),
  backup,backlog,lease,
  originalRequestRetried:false,recoveryEligible:false,installSuccessProven:false,
  operationalWrites:0,providerCalls:0,d1Writes:0};
}
export function inspect2505RecoveryReadonly(
 read=()=>readMaintenanceRecoveryStatus(C2505_ID)){
 try{
  const first=project2505RecoveryReadonly(read());
  const second=project2505RecoveryReadonly(read());
  return JSON.stringify(first)===JSON.stringify(second)?second:
   c2505Unknown('C2505_DOUBLE_READ_CHANGED');
 }catch{return c2505Unknown('C2505_READBACK_FAILED');}
}

// Exact #2505 Writer B source-only causal proof, without modifying files.
// Writer B #2497 source was installed before #2505; #2537 is the last
// verified later Writer B source. The official B adapter edits only "source".
const C2505_WRITER_BEFORE='7965b337cf69a6d48cb152b1594833d64266a677';
const C2505_WRITER_LAST='a96c35cbf43877e9f3f640e77c10dbe47ab5b067';
export function project2505WriterSourceOnlyDelta(raw,originalSha256){
 const result=(code,sourceMatched=null,reversesToOriginal=null)=>({
  code,sourceMatched,reversesToOriginal,
  safeToReplaceProtectedBefore:false,recoveryEligible:false});
 if(!Buffer.isBuffer(raw)||raw.length<1||raw.length>65536||
    typeof originalSha256!=='string'||!/^[a-f0-9]{64}$/.test(originalSha256))
  return result('C2505_WRITER_SOURCE_BYTES_UNVERIFIED');
 let config,text,matches;
 try{
  text=raw.toString('utf8');
  config=JSON.parse(text);
  matches=[...text.matchAll(/"source"\s*:\s*"([a-f0-9]{40})"/gi)];
 }catch{return result('C2505_WRITER_SOURCE_JSON_UNVERIFIED');}
 if(!config||Array.isArray(config)||typeof config!=='object'||
    matches.length!==1||matches[0][1]!==config.source)
  return result('C2505_WRITER_SOURCE_FIELD_AMBIGUOUS');
 if(config.source!==C2505_WRITER_LAST)
  return result('C2505_WRITER_SOURCE_NOT_LAST_RECEIPT',false,null);
 const m=matches[0],swapped=m[0].replace(C2505_WRITER_LAST,C2505_WRITER_BEFORE);
 if(swapped===m[0])return result('C2505_WRITER_SOURCE_REVERSE_INVALID',true,null);
 const reverse=text.slice(0,m.index)+swapped+text.slice(m.index+m[0].length);
 const reversed=createHash('sha256').update(Buffer.from(reverse,'utf8'))
  .digest('hex')===originalSha256;
 return result(reversed?'C2505_WRITER_SOURCE_ONLY_REVERSED_EXACT':
  'C2505_WRITER_SOURCE_ONLY_REVERSE_DIFFERS',true,reversed);
}

// #2505 deep byte evidence on the already approved independent read-only PC
// inventory. No process termination, lock release, GitHub writes or secret output.
export function inspect2505RecoveryByteProof({
 fileSystem=fs,
 maintenanceRoot='E:/ZGmini/automation/pc-maintenance',
 controlRoot='E:/ZGmini/automation/pc-control',
 writerDataRoot='E:/ZGmini/data/pc-writer',
 protectedProbe=protectedSnapshot,
 pidProbe=pid=>{try{process.kill(pid,0);return true;}catch(e){return e?.code==='ESRCH'?false:null;}}
}={}){
 const unknown=code=>({status:'STATE_UNKNOWN',code,
  snapshotFilesVerified:null,previousHostMatchesSnapshot:null,
  protectedBaselineMatchesCurrent:null,writerSourceOnlyDelta:null,
  protectedDifferenceScopes:null,
  protectedDifferenceClass:'UNVERIFIED',casDigests:null,
  writerConfigModifiedAtUtc:null,ownerMarkerMatches:null,
  ownerPidPresent:null,leaseTimelineAligned:null,currentTargetMatches:null,
  leaseBoundToOriginalRequest:null,recoveryEligible:false,
  operationalWrites:0,providerCalls:0,d1Writes:0});
 const root=path.join(controlRoot,'backups','controller-update-'+C2505_ID);
 const fixed={
  ledger:path.join(maintenanceRoot,'ledger',C2505_ID+'.json'),
  owner:path.join(maintenanceRoot,'leases/controller-install/owner.json'),
  marker:path.join(maintenanceRoot,'leases/controller-install/RECOVERY_REQUIRED.json'),
  currentHost:path.join(controlRoot,'host.json'),
  snapshotHost:path.join(root,'snapshot/host.json'),
  previousHost:path.join(root,'previous-host.json'),
  protectedBefore:path.join(root,'PROTECTED_BEFORE.json'),
  backlog:path.join(maintenanceRoot,'backlog',C2505_ID+'.json'),
  writerConfig:path.join(writerDataRoot,'config.json')
 };
 const readFixed=(file,max=131072)=>{
  const st=fileSystem.lstatSync(file);
  if(!st.isFile()||st.isSymbolicLink()||st.size<=0||st.size>max)
   throw Error('FIXED_FILE_INVALID');
  const bytes=fileSystem.readFileSync(file);
  if(!Buffer.isBuffer(bytes)||bytes.length!==st.size)throw Error('FIXED_BYTES_INVALID');
  return bytes;
 };
 try{
  const start=Object.fromEntries(Object.entries(fixed).map(([k,p])=>[k,readFixed(p)]));
  const parse=k=>JSON.parse(start[k].toString('utf8'));
  const ledger=parse('ledger'),owner=parse('owner'),marker=parse('marker');
  const nowHost=parse('currentHost'),savedHost=parse('snapshotHost');
  const baseline=parse('protectedBefore');
  const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
  const casDigests={ledgerSha256:sha256(start.ledger),
   ownerSha256:sha256(start.owner),markerSha256:sha256(start.marker),
   snapshotHostSha256:sha256(start.snapshotHost),
   protectedBeforeSha256:sha256(start.protectedBefore),
   backlogSha256:sha256(start.backlog),
   currentWriterConfigSha256:sha256(start.writerConfig)};
  const writerStat=fileSystem.lstatSync(fixed.writerConfig);
  const writerConfigModifiedAtUtc=Number.isFinite(writerStat.mtimeMs)?
   new Date(writerStat.mtimeMs).toISOString():null;
  const writerSourceOnlyDelta=project2505WriterSourceOnlyDelta(
   start.writerConfig,baseline?.files?.['config.json']);
  if(ledger.requestId!==C2505_ID||ledger.issueNumber!==2505||
    ledger.targetSha!==C2505_TARGET||ledger.firstFail!=='POSTCHECK_PENDING'||
    ledger.status!=='RECOVERY_REQUIRED')return unknown('C2505_ORIGINAL_LEDGER_UNVERIFIED');
  const files=savedHost.controllerFiles;
  if(savedHost.controllerSourceSha!==ledger.installedShaBefore||
    typeof files!=='object'||!files||Array.isArray(files)||
    Object.keys(files).length<5||Object.keys(files).length>160)
    return unknown('C2505_SNAPSHOT_MANIFEST_UNVERIFIED');
  let snapshotFilesVerified=true;
  for(const [rel,expected] of Object.entries(files)){
   if(!/^(?:controller\/[a-z0-9-]+\.mjs|config\/operations\.json)$/.test(rel)||
      !/^[a-f0-9]{64}$/.test(expected)||
      createHash('sha256').update(readFixed(path.join(root,'snapshot',rel),2097152))
       .digest('hex')!==expected){snapshotFilesVerified=false;break;}
  }
  const previousHostMatchesSnapshot=start.previousHost.equals(start.snapshotHost);
  const ownerMarkerMatches=Number.isSafeInteger(owner.pid)&&owner.pid>0&&
   typeof owner.nonce==='string'&&/^[a-f0-9-]{36}$/i.test(owner.nonce)&&
   marker.requestOwnerPid===owner.pid&&marker.nonce===owner.nonce;
  const pidPresent=ownerMarkerMatches?pidProbe(owner.pid):null;
  const created=Date.parse(owner.at),updated=Date.parse(ledger.updatedAt),
   marked=Date.parse(marker.at);
  // Chronology is useful evidence only: owner/marker have no request ID.
  const leaseTimelineAligned=Number.isFinite(created)&&Number.isFinite(updated)&&
   Number.isFinite(marked)&&created<=updated&&updated<=marked&&marked-updated<=60000;
  let protectedBaselineMatchesCurrent=null,protectedDifferenceScopes=null;
  let protectedDifferenceClass='UNVERIFIED';
  try{
   const currentProtected=protectedProbe();
   protectedBaselineMatchesCurrent=JSON.stringify(currentProtected)===JSON.stringify(baseline);
   // The current protection snapshot and our pinned Writer byte hash must
   // refer to exactly the same observation. Otherwise fail closed.
   if(currentProtected?.files?.['config.json']!==casDigests.currentWriterConfigSha256)
    return unknown('C2505_WRITER_CONFIG_READBACK_DRIFT');
   // Only these six previously protected fixed names may be reported.
   // Do not disclose hashes, raw task XML, configured paths or arbitrary keys.
   const known=[
    ['files','config.json','WRITER_CONFIG'],
    ['files','quota-runner.cmd','WRITER_QUOTA_RUNNER'],
    ['files','run-local.cmd','WRITER_LOCAL_RUNNER'],
    ['tasks','ZGMINI-PC-Local-Core','LOCAL_CORE_TASK'],
    ['tasks','ZGMINI-PC-Local-Korea','LOCAL_KOREA_TASK'],
    ['tasks','ZGMINI-PC-Iran-Progress-R13','RETIRED_IRAN_TASK']
   ];
   const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
   if(!plain(baseline?.files)||!plain(baseline?.tasks)||
      !plain(currentProtected?.files)||!plain(currentProtected?.tasks)){
    protectedDifferenceClass='UNVERIFIED_STRUCTURE';
   }else{
    protectedDifferenceScopes=known.filter(([group,name])=>
     baseline[group][name]!==currentProtected[group][name]).map(([, ,label])=>label);
    const unexpected=Object.entries({files:new Set(known.filter(x=>x[0]==='files').map(x=>x[1])),
      tasks:new Set(known.filter(x=>x[0]==='tasks').map(x=>x[1]))}).some(([group,allowed])=>
       [...Object.keys(baseline[group]),...Object.keys(currentProtected[group])].some(k=>!allowed.has(k)));
    protectedDifferenceClass=unexpected?'UNVERIFIED_EXTRA_KEYS':
     protectedBaselineMatchesCurrent?'MATCHED':
     protectedDifferenceScopes.length?'KNOWN_SCOPES':'UNCLASSIFIED_DIFFERENCE';
   }
  }catch{/* Scheduler read unavailable, not drift */}
  const currentTargetMatches=nowHost.controllerSourceSha===C2505_TARGET;
  const stable=Object.entries(fixed).every(([k,p])=>readFixed(p).equals(start[k]));
  if(!stable||fileSystem.lstatSync(fixed.writerConfig).mtimeMs!==writerStat.mtimeMs)
   return unknown('C2505_PROOF_FILES_CHANGED');
  return {status:'READ_ONLY_OBSERVED',code:'C2505_BYTE_PROOF_OBSERVED',
   snapshotFilesVerified,previousHostMatchesSnapshot,
   protectedBaselineMatchesCurrent,protectedDifferenceScopes,
   protectedDifferenceClass,casDigests,writerConfigModifiedAtUtc,
   writerSourceOnlyDelta,
   ownerMarkerMatches,
   ownerPidPresent:typeof pidPresent==='boolean'?pidPresent:null,
   leaseTimelineAligned,currentTargetMatches,
   // Only the original B operator could attest exact request-owner lineage.
   leaseBoundToOriginalRequest:null,recoveryEligible:false,
   operationalWrites:0,providerCalls:0,d1Writes:0};
 }catch{return unknown('C2505_BYTE_PROOF_UNAVAILABLE');}
}

// A fixed historical Controller B failure: independently sample only local
// journal + staged/backlog/lease metadata through the existing A-grade PC
// process inventory. No new operation, receiver handoff, B effect or PC writes.
const C2094_ID='pc-update-dbed28c1-a59b-403b-84c6-8cf190930cb5';
const C2094_ISSUE=2094;
const C2094_BEFORE='f7f1559bc0ef15bb9b375982d048369c474c490f';
const C2094_TARGET='ead5d2d585ff2ce2a6df5f9b6cf720f65d90b49b';
const C2094_SAFE_STATES=new Set(['PRESENT','ABSENT','UNKNOWN','UNSAFE']);
const C2094_SAFE_PHASES=new Set(['RECEIVED','VALIDATED','STAGED','INTAKE_PAUSED',
 'DRAINED','BACKED_UP','SUPERVISOR_STOPPED','SWITCHED','RECONNECTED',
 'INTAKE_RESUMED','BACKLOG_RECONCILED','POSTCHECK_PENDING','PASS','BLOCKED',
 'ROLLED_BACK','RECOVERY_REQUIRED']);
const C2094_SAFE_CODES=new Set(['WORKFLOW_DISABLE_NOT_CONFIRMED',
 'WORKFLOW_ENABLE_NOT_CONFIRMED','BACKLOG_OR_RECOVERY_NOT_VERIFIED']);
const c2094Unknown=code=>({schema:'ZGMINI_C2094_STAGE_A_V1',
 status:'STATE_UNKNOWN',code,ledgerStatus:null,ledgerPhase:null,
 ledgerFirstFail:null,ledgerFailureOperation:null,
 backup:null,backlog:null,lease:null,actualControllerSha:null,
 restorationVerified:false,recoveryEligible:false,
 operationalWrites:0,providerCalls:0,d1Writes:0});
const stageState=v=>C2094_SAFE_STATES.has(v)?v:'UNKNOWN';
const goodInt=(v,max)=>Number.isSafeInteger(v)&&v>=0&&v<=max?v:null;
export function summarize2094StageStatus(observed){
 if(observed?.status!=='STATUS'||observed.ledgerReadbackCode||
    observed.installedReadbackCode||observed.lockReadbackCode)
  return c2094Unknown('C2094_STATUS_READBACK_UNVERIFIED');
 const ledger=observed.ledger;
 if(ledger?.requestId!==C2094_ID||ledger?.issueNumber!==C2094_ISSUE
    ||ledger?.targetSha!==C2094_TARGET
    ||ledger?.installedShaBefore!==C2094_BEFORE)
  return c2094Unknown('C2094_LEDGER_IDENTITY_UNVERIFIED');
 const a=observed.artifacts;
 if(!a||a.schema!=='ZGMINI_PC_UPDATE_ARTIFACT_READBACK_V1'
    ||a.requestId!==C2094_ID)
  return c2094Unknown('C2094_ARTIFACT_READBACK_UNAVAILABLE');
 const aFiles=a.artifacts??{},b=a.backlog??{},l=a.lease??{};
 const backup={backupRoot:stageState(aFiles.backupRoot),
  stageRoot:stageState(aFiles.stageRoot),
  stagedHost:stageState(aFiles.stagedHost),
  snapshotRoot:stageState(aFiles.snapshotRoot),
  originalHost:stageState(aFiles.originalHost),
  protectedBefore:stageState(aFiles.protectedBefore),
  previousHost:stageState(aFiles.previousHost)};
 const backlog={file:stageState(b.file),windows:goodInt(b.windows,64),
  openWindows:goodInt(b.openWindows,64),replayCount:goodInt(b.replayCount,10000)};
 const lease={directory:stageState(l.directory),ownerFile:stageState(l.ownerFile),
  recoveryMarker:stageState(l.recoveryMarker),
  ownerMarkerMatch:typeof l.ownerMarkerMatch==='boolean'?l.ownerMarkerMatch:null,
  held:observed.installLock?.held===true?true:observed.installLock?.held===false?false:null};
 const verified=a.status==='OBSERVED'&&observed.artifactReadbackCode===null
  &&Object.values(backup).every(v=>!['UNKNOWN','UNSAFE'].includes(v))
  &&![backlog.file,lease.directory,lease.ownerFile,lease.recoveryMarker]
   .some(v=>['UNKNOWN','UNSAFE'].includes(v))
  &&(backlog.file!=='PRESENT'||backlog.windows!==null
    &&backlog.openWindows!==null&&backlog.replayCount!==null
    &&backlog.openWindows<=backlog.windows)
  &&lease.held!==null
  &&(lease.directory!=='PRESENT'||lease.ownerFile==='PRESENT')
  &&(lease.recoveryMarker!=='PRESENT'||lease.ownerMarkerMatch===true);
 return {schema:'ZGMINI_C2094_STAGE_A_V1',
  status:verified?'READ_ONLY_OBSERVED':'STATE_UNKNOWN',
  code:verified?'C2094_PINNED_ARTIFACTS_OBSERVED':'C2094_ARTIFACTS_UNVERIFIED',
  ledgerStatus:C2094_SAFE_PHASES.has(ledger.status)?ledger.status:null,
  ledgerPhase:C2094_SAFE_PHASES.has(ledger.phase)?ledger.phase:null,
  ledgerFirstFail:C2094_SAFE_PHASES.has(ledger.firstFail)?ledger.firstFail:null,
  ledgerFailureOperation:typeof ledger.failureOperation==='string'
   &&/^[a-zA-Z]{1,40}$/.test(ledger.failureOperation)?ledger.failureOperation:null,
  recordedCode:C2094_SAFE_CODES.has(ledger.code)?ledger.code:null,
  workflowEnabled:typeof ledger.workflowEnabled==='boolean'?ledger.workflowEnabled:null,
  backup,backlog,lease,
  actualControllerSha:observed.actualControllerSha===C2094_BEFORE?C2094_BEFORE:null,
  restorationVerified:false,recoveryEligible:false,
  operationalWrites:0,providerCalls:0,d1Writes:0};
}
export function inspect2094StageReadonly(read=()=>readMaintenanceRecoveryStatus(C2094_ID)){
 try{
  const first=summarize2094StageStatus(read());
  const second=summarize2094StageStatus(read());
  return JSON.stringify(first)===JSON.stringify(second)?second
   :c2094Unknown('C2094_DOUBLE_READ_CHANGED');
 }catch{return c2094Unknown('C2094_STAGE_READ_FAILED');}
}

const C996_ID='pc-update-0010b2cf-9bca-40cf-89c5-b750fa42b404';
const C996_TARGET='9db6fff689c488a59fe8771f013b7c5d3bafc0a8';
const C1501_ID='pc-update-95a0c24a-e0eb-4ad5-a250-559750f8450b';
const C1501_TARGET='b2ff49dd14a09ebeba482e2ae9a84530e00f094f';
const MAINTENANCE_ROOT='E:/ZGmini/automation/pc-maintenance';
const sha256=b=>createHash('sha256').update(b).digest('hex');
const c996Unknown=code=>({status:'STATE_UNKNOWN',code,
 ownerPid:null,ownerMarkerIdentityMatched:false,ledger996Matched:false,
 ledgerMarkerTimeMatched:false,unchangedAcrossReads:false,
 ownerSha256:null,markerSha256:null,ledgerSha256:null,
 operationalWrites:0,providerCalls:0,d1Writes:0});
// Return a bounded read-only correlation result. Neither the raw owner nonce,
// original ledger/body, absolute paths nor recovery marker is published.
export function classify996LeaseCorrelation({lockBefore,lockAfter,first,second}={},
 {requestId=C996_ID,issueNumber=996,targetSha=C996_TARGET}={}){
 if(lockBefore?.held!==true||lockBefore?.recoveryRequired!==true||
    lockAfter?.held!==true||lockAfter?.recoveryRequired!==true)
  return c996Unknown('C996_ACTIVE_RECOVERY_LEASE_NOT_VERIFIED');
 if(!first||!second||!['owner','marker','ledger'].every(k=>
    Buffer.isBuffer(first[k])&&Buffer.isBuffer(second[k])&&
    first[k].length>0&&first[k].length<=32768&&
    first[k].equals(second[k])))
  return c996Unknown('C996_ORIGINAL_SNAPSHOT_UNVERIFIED');
 let owner,marker,ledger;
 try{
  owner=JSON.parse(first.owner.toString('utf8'));
  marker=JSON.parse(first.marker.toString('utf8'));
  ledger=JSON.parse(first.ledger.toString('utf8'));
 }catch{return c996Unknown('C996_ORIGINAL_JSON_UNVERIFIED');}
 const pid=Number.isSafeInteger(owner?.pid)&&owner.pid>0?owner.pid:null;
 const nonceOk=typeof owner?.nonce==='string'&&
  /^[a-f0-9]{8}-[a-f0-9-]{27,}$/i.test(owner.nonce);
 const ownerMarkerIdentityMatched=Boolean(pid&&nonceOk&&marker?.nonce===owner.nonce&&
  marker?.requestOwnerPid===pid&&lockBefore.ownerPid===pid&&lockAfter.ownerPid===pid);
 const ledger996Matched=ledger?.requestId===requestId&&ledger?.issueNumber===issueNumber&&
  ledger?.targetSha===targetSha;
 const tLedger=Date.parse(ledger?.updatedAt??''),tMarker=Date.parse(marker?.at??''),
  tOwner=Date.parse(owner?.at??'');
 const ledgerMarkerTimeMatched=Number.isFinite(tLedger)&&
  Number.isFinite(tMarker)&&Number.isFinite(tOwner)&&
  Math.abs(tLedger-tMarker)<5000&&tOwner<=tMarker;
 const matched=ownerMarkerIdentityMatched&&ledger996Matched&&ledgerMarkerTimeMatched;
 return {status:matched?'CORRELATED':'STATE_UNKNOWN',
  code:matched?'C996_LEASE_IDENTITY_CORRELATED':'C996_LEASE_IDENTITY_UNPROVEN',
  ownerPid:ownerMarkerIdentityMatched?pid:null,
  ownerMarkerIdentityMatched,ledger996Matched,ledgerMarkerTimeMatched,
  unchangedAcrossReads:true,
  ownerSha256:sha256(first.owner),markerSha256:sha256(first.marker),
  ledgerSha256:sha256(first.ledger),
  operationalWrites:0,providerCalls:0,d1Writes:0};
}
export function inspect996LeaseCorrelation({
 read=fs.readFileSync,stat=fs.lstatSync,
 lock=()=>maintenanceLockStatus(MAINTENANCE_ROOT,'controller-install')}={}){
 try{
  const before=lock();
  if(before?.held!==true||before?.recoveryRequired!==true)
   return c996Unknown('C996_ACTIVE_RECOVERY_LEASE_NOT_VERIFIED');
  const fixed={
   owner:path.join(MAINTENANCE_ROOT,'leases/controller-install/owner.json'),
   marker:path.join(MAINTENANCE_ROOT,'leases/controller-install/RECOVERY_REQUIRED.json'),
   ledger:path.join(MAINTENANCE_ROOT,'ledger',C996_ID+'.json')
  };
  const snapshot=()=>Object.fromEntries(Object.entries(fixed).map(([k,f])=>{
   const st=stat(f);
   if(!st.isFile()||st.size<1||st.size>32768)
    throw Error('C996_FIXED_ORIGINAL_FILE_INVALID');
   return [k,read(f)];
  }));
  const first=snapshot(),second=snapshot(),after=lock();
  return classify996LeaseCorrelation({lockBefore:before,lockAfter:after,first,second});
 }catch{return c996Unknown('C996_ORIGINAL_FILES_UNAVAILABLE');}
}

// Fixed #1501 probe uses the same double-read, exact-identity and timestamp
// evidence as #996. This is an independent read-only comparison, not evidence
// that an old recovery issue remains the owner of a CURRENT lease.
const as1501=row=>{
 const {ledger996Matched,...rest}=row;
 return {...rest,code:rest.code.replace(/^C996_/,'C1501_'),
  ledger1501Matched:ledger996Matched};
};
export function classify1501LeaseCorrelation(snapshot){
 return as1501(classify996LeaseCorrelation(snapshot,
  {requestId:C1501_ID,issueNumber:1501,targetSha:C1501_TARGET}));
}
const SAFE_RECOVERY_PHASES=new Set([
 'RECEIVED','VALIDATED','STAGED','INTAKE_PAUSED','DRAINED','BACKED_UP',
 'SUPERVISOR_STOPPED','SWITCHED','RECONNECTED','INTAKE_RESUMED',
 'BACKLOG_RECONCILED','POSTCHECK_PENDING','PASS','BLOCKED','ROLLED_BACK',
 'RECOVERY_REQUIRED']);
const SAFE_RECOVERY_STATUS=new Set(['RUNNING','UNKNOWN','PASS','BLOCKED',
 'ROLLED_BACK','RECOVERY_REQUIRED']);
const safeOperation=s=>typeof s==='string'&&/^[a-zA-Z][a-zA-Z0-9]{0,63}$/.test(s)?s:null;
const safeFlag=x=>typeof x==='boolean'?x:null;
// A PID probe cannot prove process identity, because Windows can recycle PIDs.
// Never interpret a visible PID as ownership of the original maintenance lease.
function pidObservation(pid,signal=process.kill){
 if(!Number.isSafeInteger(pid)||pid<=0)return 'UNKNOWN';
 try{signal(pid,0);return 'PID_PRESENT_IDENTITY_UNVERIFIED';}
 catch(e){return e?.code==='ESRCH'?'PID_NOT_PRESENT':'UNKNOWN';}
}
export function classify1501RecoveryCheckpoint({lockBefore,lockAfter,first,second},
 {signal=process.kill,backupPresent=null,backlogPresent=null}={}){
 const correlation=classify1501LeaseCorrelation({lockBefore,lockAfter,first,second});
 const empty={...correlation,ledgerPhase:null,ledgerFirstFail:null,
  ledgerStatus:null,ledgerFailureOperation:null,ledgerIntakePaused:null,
  ledgerWorkflowEnabled:null,ownerPidObservation:'UNKNOWN',
  backupPresent:null,backlogPresent:null,eligibleForAutomaticRelease:false};
 if(correlation.status!=='CORRELATED')return empty;
 let ledger;
 try{ledger=JSON.parse(first.ledger.toString('utf8'));}catch{return empty;}
 return {...empty,
  ledgerPhase:SAFE_RECOVERY_PHASES.has(ledger.phase)?ledger.phase:null,
  ledgerFirstFail:SAFE_RECOVERY_PHASES.has(ledger.firstFail)?ledger.firstFail:null,
  ledgerStatus:SAFE_RECOVERY_STATUS.has(ledger.status)?ledger.status:null,
  ledgerFailureOperation:safeOperation(ledger.failureOperation),
  ledgerIntakePaused:safeFlag(ledger.intakePaused),
  ledgerWorkflowEnabled:safeFlag(ledger.workflowEnabled),
  ownerPidObservation:pidObservation(correlation.ownerPid,signal),
  backupPresent:safeFlag(backupPresent),backlogPresent:safeFlag(backlogPresent),
  eligibleForAutomaticRelease:false};
}
function fixedPathExists(p,stat=fs.lstatSync){
 try{stat(p);return true;}catch(e){return e?.code==='ENOENT'?false:null;}
}
export function inspect1501LeaseCorrelation({
 read=fs.readFileSync,stat=fs.lstatSync,
 lock=()=>maintenanceLockStatus(MAINTENANCE_ROOT,'controller-install'),
 signal=process.kill}={}){
 try{
  const before=lock();
  if(before?.held!==true||before?.recoveryRequired!==true)
   return as1501(c996Unknown('C996_ACTIVE_RECOVERY_LEASE_NOT_VERIFIED'));
  const fixed={
   owner:path.join(MAINTENANCE_ROOT,'leases/controller-install/owner.json'),
   marker:path.join(MAINTENANCE_ROOT,'leases/controller-install/RECOVERY_REQUIRED.json'),
   ledger:path.join(MAINTENANCE_ROOT,'ledger',C1501_ID+'.json')
  };
  const snapshot=()=>Object.fromEntries(Object.entries(fixed).map(([k,f])=>{
   const st=stat(f);
   if(!st.isFile()||st.isSymbolicLink()||st.size<1||st.size>32768)
    throw Error('C1501_FIXED_ORIGINAL_FILE_INVALID');
   const bytes=read(f);
   if(!Buffer.isBuffer(bytes)||bytes.length!==st.size)throw Error('C1501_FILE_READ_MISMATCH');
   return [k,bytes];
  }));
  const first=snapshot(),second=snapshot(),after=lock();
  const data=classify1501RecoveryCheckpoint({lockBefore:before,lockAfter:after,
   first,second},{
    signal,backupPresent:fixedPathExists(
     path.join('E:/ZGmini/automation/pc-control/backups','controller-update-'+C1501_ID),stat),
    backlogPresent:fixedPathExists(
     path.join(MAINTENANCE_ROOT,'backlog',C1501_ID+'.json'),stat)});
  return data;
 }catch{return as1501(c996Unknown('C996_ORIGINAL_FILES_UNAVAILABLE'));}
}

// #1841 partial Controller-switch recovery: exact immutable-intent evidence.
// Reuse the existing fixed Windows read-only inventory; never change a lease.
const C1841_ID='pc-update-7acb05d3-2860-4d19-8e30-55fe78892b12';
const C1841_TARGET='2f569c18e09a55e54e81052985a80f6a8765d680';
const as1841=row=>{
 const {ledger996Matched,...rest}=row;
 return {...rest,code:rest.code.replace(/^C996_/,'C1841_'),
  ledger1841Matched:ledger996Matched};
};
export function classify1841RecoveryCheckpoint(snapshot,
 {signal=process.kill,backupPresent=null,backlogPresent=null}={}){
 const correlated=as1841(classify996LeaseCorrelation(snapshot,
  {requestId:C1841_ID,issueNumber:1841,targetSha:C1841_TARGET}));
 const base={...correlated,ledgerPhase:null,ledgerFirstFail:null,
  ledgerStatus:null,ledgerFailureOperation:null,ledgerIntakePaused:null,
  ledgerWorkflowEnabled:null,ownerPidObservation:'UNKNOWN',
  backupPresent:null,backlogPresent:null,eligibleForAutomaticRelease:false};
 // An old original ledger is NOT proof that the CURRENT held lease belongs
 // to that request. Return its bounded phase separately from lease identity.
 if(correlated.ledger1841Matched!==true||correlated.unchangedAcrossReads!==true)
  return base;
 let ledger;try{ledger=JSON.parse(snapshot.first.ledger.toString('utf8'));}
 catch{return base;}
 return {...base,
  ledgerPhase:SAFE_RECOVERY_PHASES.has(ledger.phase)?ledger.phase:null,
  ledgerFirstFail:SAFE_RECOVERY_PHASES.has(ledger.firstFail)?ledger.firstFail:null,
  ledgerStatus:SAFE_RECOVERY_STATUS.has(ledger.status)?ledger.status:null,
  ledgerFailureOperation:safeOperation(ledger.failureOperation),
  ledgerIntakePaused:safeFlag(ledger.intakePaused),
  ledgerWorkflowEnabled:safeFlag(ledger.workflowEnabled),
  ownerPidObservation:correlated.status==='CORRELATED'
   ?pidObservation(correlated.ownerPid,signal):'UNKNOWN',
  backupPresent:safeFlag(backupPresent),backlogPresent:safeFlag(backlogPresent)};
}
export function inspect1841LeaseCorrelation({
 read=fs.readFileSync,stat=fs.lstatSync,
 lock=()=>maintenanceLockStatus(MAINTENANCE_ROOT,'controller-install'),
 signal=process.kill}={}){
 try{
  const before=lock();
  if(before?.held!==true||before?.recoveryRequired!==true)
   return classify1841RecoveryCheckpoint({lockBefore:before,lockAfter:before});
  const files={owner:path.join(MAINTENANCE_ROOT,'leases/controller-install/owner.json'),
   marker:path.join(MAINTENANCE_ROOT,'leases/controller-install/RECOVERY_REQUIRED.json'),
   ledger:path.join(MAINTENANCE_ROOT,'ledger',C1841_ID+'.json')};
  const snap=()=>Object.fromEntries(Object.entries(files).map(([key,file])=>{
   const st=stat(file);
   if(!st.isFile()||st.isSymbolicLink()||st.size<1||st.size>32768)
    throw Error('C1841_FIXED_SOURCE_UNSAFE');
   const bytes=read(file);
   if(!Buffer.isBuffer(bytes)||bytes.length!==st.size)
    throw Error('C1841_FILE_READ_MISMATCH');
   return [key,bytes];
  }));
  const first=snap(),second=snap(),after=lock();
  return classify1841RecoveryCheckpoint({lockBefore:before,lockAfter:after,first,second},{
   signal,backupPresent:fixedPathExists(
    path.join('E:/ZGmini/automation/pc-control/backups','controller-update-'+C1841_ID),stat),
   backlogPresent:fixedPathExists(
    path.join(MAINTENANCE_ROOT,'backlog',C1841_ID+'.json'),stat)});
 }catch{return as1841(c996Unknown('C996_ORIGINAL_FILES_UNAVAILABLE'));}
}
// Fixed W05 #2821 BACKED_UP incident: capture only exact recovery CAS
// digests and bounded booleans using the already-approved operating-PC A read.
// This is not approval, not an install, and never releases the install lease.
const W05_2821_ID='pc-update-c09a58ae-4d2d-4f70-ae66-aa64d976ee51';
const W05_2821_OLD='2f3ebcf3518a5e9b694bafbb7e6331840a6a4a25';
const W05_2821_TARGET='08f0b656faa9ad5c46a813a0cdda4b43107eefbd';
// Fixed local Windows checkout preflight for the already-approved #2821 rollback.
// Observes exact source bytes only; this is NOT independent operator identity,
// not six-Runner verification, and never starts recovery or changes a lease.
const W05_2821_SOURCE='fda563c93f4680709788ba782ad1918abf74ff2d';
const W05_2821_OWNER_SHA='eb6c203bef862af8f24e95c6dc5b0c890c33d14e2ebfdef6bfb43df3548c98a0';
const W05_2821_OWNER_PID=14356;
// A fixed, read-only chronology result cannot prove a live process owns an
// old lease. It can only refute identity when the PID began after owner.at.
export function classifyW052821OwnerPidChronology(cas,candidate){
 const unknown=code=>({status:'STATE_UNKNOWN',code,recoveryEligible:false});
 if(cas?.code!=='W05_2821_FIXED_RECOVERY_CAS'||
    cas?.firstFail!=='BACKED_UP'||cas?.ownerMarkerSame!==true||
    cas?.ownerPid!==W05_2821_OWNER_PID||
    cas?.digests?.ownerSha256!==W05_2821_OWNER_SHA)
   return unknown('W05_OWNER_LEASE_CAS_UNVERIFIED');
 const ownerTime=Date.parse(cas.ownerAtUtc??'');
 if(!Number.isFinite(ownerTime))return unknown('W05_OWNER_LEASE_TIME_UNVERIFIED');
 if(candidate?.pid!==W05_2821_OWNER_PID)
   return unknown('W05_OWNER_PROCESS_ID_UNVERIFIED');
 if(candidate.state==='NOT_PRESENT')
   return cas.ownerAlive===true?unknown('W05_OWNER_PID_SNAPSHOT_CHANGED'):
    {status:'READ_ONLY_OBSERVED',code:'W05_OWNER_PID_NOT_PRESENT',
     ownerAtUtc:new Date(ownerTime).toISOString(),recoveryEligible:false};
 if(candidate.state!=='OBSERVED')
   return unknown('W05_OWNER_PROCESS_START_UNVERIFIED');
 const processTime=Date.parse(candidate.startedAtUtc??'');
 if(!Number.isFinite(processTime))
   return unknown('W05_OWNER_PROCESS_START_UNVERIFIED');
 return {status:'READ_ONLY_OBSERVED',
  code:processTime>ownerTime+5000?'W05_OWNER_PID_REUSED_AFTER_LEASE':
   'W05_OWNER_PID_IDENTITY_UNVERIFIED',
  ownerAtUtc:new Date(ownerTime).toISOString(),
  processStartedAtUtc:new Date(processTime).toISOString(),
  recoveryEligible:false};
}

const W05_2821_ROLLBACK_FILES=[
 ['tools/controller-rollback-recovery.mjs','414064c4853d674b3aea078158342ad854722fb03864fa8fd214a2f974dcf677'],
 ['tools/update.mjs','8505e7e98bd95297944e57262fbfe510ffecccd9ec3d90e46c37265d7e09a8cc'],
 ['tools/maintenance-apply.mjs','39d35b0c2bb3516c7f15f0ad3a79bb90654557991d85c92b721773c87372f400'],
 ['tools/maintenance-contract.mjs','cdaf63cef96d872cccb2a2fc33cab37eba7d1a91301b7f382c338374e2bf335e'],
 ['tools/maintenance-lock.mjs','d53be9486c2c86c816969cc80a3f1c97623f2ee10aae6882ae9fc7ed4dc5fecd']
];
export function inspectW052821CheckoutReadonly({
 checkoutRoot='E:/ZGmini/projects/zgmini-pc-control',
 fileSystem=fs,expected=W05_2821_ROLLBACK_FILES
}={}){
 const exact=(rel,max)=>{
  const p=path.join(checkoutRoot,rel),st=fileSystem.lstatSync(p);
  if(!st.isFile()||st.isSymbolicLink()||st.size<1||st.size>max)
   throw Error('UNSAFE_FILE');
  const bytes=fileSystem.readFileSync(p);
  if(!Buffer.isBuffer(bytes)||bytes.length!==st.size)throw Error('FILE_CHANGED');
  return bytes;
 };
 try{
  // A junction is valid: follow only the fixed root, not untrusted inputs.
  if(!fileSystem.statSync(checkoutRoot).isDirectory())
   return 'W05_PROJECT_ROOT_UNAVAILABLE';
 }catch{return 'W05_PROJECT_ROOT_UNAVAILABLE';}
 let approval;
 try{
  approval=JSON.parse(exact(
   'approvals/maintenance-recoveries/'+W05_2821_ID+'.rollback.json',8192).toString('utf8'));
 }catch(e){return e?.code==='ENOENT'?
  'W05_APPROVAL_MISSING':'W05_APPROVAL_UNREADABLE';}
 if(approval.schema!=='ZGMINI_PC_ROLLBACK_APPROVAL_V1'||
    approval.approved!==true||approval.requestId!==W05_2821_ID||
    approval.sourceSha!==W05_2821_SOURCE||
    !Array.isArray(approval.files)||approval.files.length!==5||
    expected.length!==5||
    !expected.every(([rel,digest])=>approval.files.filter(f=>
     f.path===rel&&f.sha256===digest).length===1))
  return 'W05_CHECKOUT_APPROVAL_DRIFT';
 for(const [rel,digest] of expected){
  let bytes;
  try{bytes=exact(rel,2097152);}
  catch(e){return e?.code==='ENOENT'?
   'W05_SOURCE_MISSING':'W05_SOURCE_UNREADABLE';}
  if(createHash('sha256').update(bytes).digest('hex')!==digest)
   return 'W05_CHECKOUT_SOURCE_DRIFT';
 }
 return 'W05_CHECKOUT_BYTES_VERIFIED';
}

export function inspectW052821RecoveryCasReadonly({
 maintenanceRoot='E:/ZGmini/automation/pc-maintenance',
 controlRoot='E:/ZGmini/automation/pc-control',
 read=fs.readFileSync,stat=fs.lstatSync,protectedProbe=protectedSnapshot,
 lock=null,isAlive=pid=>{try{process.kill(pid,0);return true;}catch(e){
  return e?.code==='ESRCH'?false:null;}}
}={}){
 const unknown=code=>({status:'STATE_UNKNOWN',code,recoveryEligible:false,
  operationalWrites:0,providerCalls:0,d1Writes:0});
 const readExact=(file,cap=131072)=>{
  const st=stat(file);
  if(!st.isFile()||st.isSymbolicLink()||st.size<1||st.size>cap)
   throw Error('W05_READONLY_FILE_UNSAFE');
  const bytes=read(file);
  if(!Buffer.isBuffer(bytes)||bytes.length!==st.size)
   throw Error('W05_READONLY_BYTES_CHANGED');
  return bytes;
 };
 try{
  const lockStatus=()=>typeof lock==='function'?lock():
   maintenanceLockStatus(maintenanceRoot,'controller-install');
  const before=lockStatus();
  if(before?.held!==true||before?.recoveryRequired!==true)
   return unknown('W05_2821_RECOVERY_LEASE_NOT_HELD');
  const backup=path.join(controlRoot,'backups','controller-update-'+W05_2821_ID);
  const fixed={
   ledger:path.join(maintenanceRoot,'ledger',W05_2821_ID+'.json'),
   owner:path.join(maintenanceRoot,'leases/controller-install/owner.json'),
   marker:path.join(maintenanceRoot,'leases/controller-install/RECOVERY_REQUIRED.json'),
   currentHost:path.join(controlRoot,'host.json'),
   snapshotHost:path.join(backup,'snapshot/host.json'),
   protection:path.join(backup,'PROTECTED_BEFORE.json')
  };
  const capture=()=>Object.fromEntries(Object.entries(fixed).map(
   ([k,p])=>[k,readExact(p)]));
  const first=capture(),second=capture(),after=lockStatus();
  if(Object.keys(first).some(k=>!first[k].equals(second[k]))||
    after?.held!==true||after?.recoveryRequired!==true)
   return unknown('W05_2821_RECOVERY_EVIDENCE_CHANGED');
  const ledger=JSON.parse(first.ledger.toString('utf8'));
  if(ledger.requestId!==W05_2821_ID||ledger.issueNumber!==2821||
     ledger.installedShaBefore!==W05_2821_OLD||
     ledger.targetSha!==W05_2821_TARGET)
   return unknown('W05_2821_ORIGINAL_LEDGER_IDENTITY_DRIFT');
  const owner=JSON.parse(first.owner.toString('utf8'));
  const marker=JSON.parse(first.marker.toString('utf8'));
  const host=JSON.parse(first.snapshotHost.toString('utf8'));
  const baseline=JSON.parse(first.protection.toString('utf8'));
  const files=host.controllerFiles;
  if(host.controllerSourceSha!==W05_2821_OLD||
     !files||typeof files!=='object'||Array.isArray(files)||
     Object.keys(files).length<1||Object.keys(files).length>160)
   return unknown('W05_2821_SNAPSHOT_MANIFEST_INVALID');
  let backupFilesVerified=true;
  for(const [rel,hash] of Object.entries(files)){
   if(!/^(?:controller\/[a-z0-9-]+\.mjs|config\/operations\.json)$/.test(rel)||
      !/^[a-f0-9]{64}$/.test(hash)||
      createHash('sha256').update(
       readExact(path.join(backup,'snapshot',rel),2097152)).digest('hex')!==hash){
    backupFilesVerified=false;break;
   }
  }
  let protectionSame=null;
  try{protectionSame=JSON.stringify(protectedProbe())===JSON.stringify(baseline);}
  catch{/* Protection readback is unknown, never treated as equal. */}
  const ownerMarkerSame=Number.isSafeInteger(owner.pid)&&owner.pid>0&&
   /^[a-f0-9-]{36}$/i.test(owner.nonce??'')&&
   marker.requestOwnerPid===owner.pid&&marker.nonce===owner.nonce;
  const pidAlive=ownerMarkerSame?isAlive(owner.pid):null;
  const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
  const digests={ledgerSha256:hash(first.ledger),ownerSha256:hash(first.owner),
   markerSha256:hash(first.marker),snapshotHostSha256:hash(first.snapshotHost),
   protectionSha256:hash(first.protection)};
  return {status:'READ_ONLY_OBSERVED',code:'W05_2821_FIXED_RECOVERY_CAS',
   phase:['BACKED_UP','RECOVERY_REQUIRED'].includes(ledger.phase)?ledger.phase:null,
   firstFail:ledger.firstFail==='BACKED_UP'?'BACKED_UP':null,
   ownerMarkerSame,ownerAlive:typeof pidAlive==='boolean'?pidAlive:null,
   ownerPid:ownerMarkerSame?owner.pid:null,
   ownerAtUtc:typeof owner.at==='string'&&Number.isFinite(Date.parse(owner.at))?
    new Date(owner.at).toISOString():null,
   hostSame:first.currentHost.equals(first.snapshotHost),
   backupFilesVerified,protectionSame,digests,
   checkoutCode:inspectW052821CheckoutReadonly(),
   // A matching owner nonce is not independent proof of install-request lineage.
   leaseBoundToRequest:null,recoveryEligible:false,
   operationalWrites:0,providerCalls:0,d1Writes:0};
 }catch{return unknown('W05_2821_RECOVERY_FILES_UNAVAILABLE');}
}

// One fixed read-only capture for #3160 BACKED_UP. Never asserts rollback authority.
const C3160_ID='pc-update-56444e31-5488-48df-aea9-474d259cb198';
export function inspect3160RecoveryCasReadonly({
 maintenanceRoot='E:/ZGmini/automation/pc-maintenance',
 controlRoot='E:/ZGmini/automation/pc-control',
 read=fs.readFileSync,stat=fs.lstatSync,protectedProbe=protectedSnapshot,
 lock=()=>maintenanceLockStatus(maintenanceRoot,'controller-install'),
 pidProbe=pid=>{try{process.kill(pid,0);return true;}
  catch(e){return e?.code==='ESRCH'?false:null;}}
}={}){
 const unknown=code=>({requestId:C3160_ID,status:'STATE_UNKNOWN',code,
  recoveryEligible:false,operationalWrites:0,providerCalls:0,d1Writes:0});
 const exact=(p,cap=131072)=>{
  const st=stat(p);
  if(!st.isFile()||st.isSymbolicLink()||st.size<1||st.size>cap)
   throw Error('C3160_FILE_UNSAFE');
  const b=read(p);
  if(!Buffer.isBuffer(b)||b.length!==st.size)throw Error('C3160_FILE_CHANGED');
  return b;
 };
 const hash=b=>createHash('sha256').update(b).digest('hex');
 try{
  const l1=lock();
  if(l1?.held!==true||l1?.recoveryRequired!==true)
   return unknown('C3160_INSTALL_LEASE_NOT_VERIFIED');
  const backup=path.join(controlRoot,'backups','controller-update-'+C3160_ID);
  const fixed={
   ledger:path.join(maintenanceRoot,'ledger',C3160_ID+'.json'),
   owner:path.join(maintenanceRoot,'leases/controller-install/owner.json'),
   marker:path.join(maintenanceRoot,'leases/controller-install/RECOVERY_REQUIRED.json'),
   currentHost:path.join(controlRoot,'host.json'),
   snapshotHost:path.join(backup,'snapshot/host.json'),
   protection:path.join(backup,'PROTECTED_BEFORE.json'),
   backlog:path.join(maintenanceRoot,'backlog',C3160_ID+'.json')
  };
  const capture=()=>Object.fromEntries(Object.entries(fixed).map(([k,p])=>[k,exact(p)]));
  const a=capture(),b=capture(),l2=lock();
  if(l2?.held!==true||l2?.recoveryRequired!==true||
   Object.keys(a).some(k=>!a[k].equals(b[k])))
   return unknown('C3160_ORIGINAL_CAS_CHANGED');
  const ledger=JSON.parse(a.ledger),owner=JSON.parse(a.owner),
   marker=JSON.parse(a.marker),snapshot=JSON.parse(a.snapshotHost),
   baseline=JSON.parse(a.protection),backlog=JSON.parse(a.backlog);
  if(ledger.requestId!==C3160_ID||ledger.issueNumber!==3160||
   ledger.installedShaBefore!=='4396d2bb326d86b8ce9e27c528519bf0090b8e9e'||
   ledger.targetSha!=='56a3d9d7420709714a45dac37aeab74d055f4265'||
   ledger.status!=='RECOVERY_REQUIRED'||ledger.firstFail!=='BACKED_UP')
   return unknown('C3160_LEDGER_IDENTITY_OR_PHASE_DRIFT');
  const files=snapshot.controllerFiles;
  if(snapshot.controllerSourceSha!==ledger.installedShaBefore||!files||
   typeof files!=='object'||Array.isArray(files)||
   Object.keys(files).length<1||Object.keys(files).length>160)
   return unknown('C3160_SNAPSHOT_HOST_INVALID');
  if(backlog.schema!=='ZGMINI_PC_BACKLOG_V1'||backlog.requestId!==C3160_ID||
   !Array.isArray(backlog.windows)||backlog.windows.length<1||
   backlog.windows.length>64||!backlog.replays||
   typeof backlog.replays!=='object'||Array.isArray(backlog.replays))
   return unknown('C3160_BACKLOG_INVALID');
  let backupFilesVerified=true,liveFilesVerified=true;
  for(const [p,d] of Object.entries(files)){
   if(!/^(?:controller\/[a-z0-9-]+\.mjs|config\/operations\.json)$/.test(p)||
    !/^[a-f0-9]{64}$/.test(d))return unknown('C3160_SNAPSHOT_FILES_INVALID');
   const check=f=>{const x=exact(f,2097152),y=exact(f,2097152);
    return x.equals(y)&&hash(x)===d;};
   if(!check(path.join(backup,'snapshot',p)))backupFilesVerified=false;
   if(!check(path.join(controlRoot,p)))liveFilesVerified=false;
  }
  const ownerMarkerMatches=Number.isSafeInteger(owner.pid)&&owner.pid>0&&
   /^[a-f0-9-]{36}$/i.test(owner.nonce??'')&&
   marker.requestOwnerPid===owner.pid&&marker.nonce===owner.nonce;
  let protectionDifference='UNVERIFIED',writerConfigSha256=null;
  try{const live=protectedProbe();
   protectionDifference=classify2960ProtectionDifference(baseline,live);
   const h=live?.files?.['config.json'];
   writerConfigSha256=/^[a-f0-9]{64}$/.test(h??'')?h:null;
  }catch{}
  const pid=ownerMarkerMatches?pidProbe(owner.pid):null;
  return {requestId:C3160_ID,status:'READ_ONLY_OBSERVED',
   code:'C3160_EXACT_BACKED_UP_CAS',
   ledgerStatus:ledger.status,ledgerFirstFail:ledger.firstFail,
   ownerMarkerMatches,ownerPidObservation:pid===false?'PID_NOT_PRESENT':
    pid===true?'PID_PRESENT_IDENTITY_UNVERIFIED':'UNKNOWN',
   snapshotHostSameAsCurrent:a.snapshotHost.equals(a.currentHost),
   backupFilesVerified,liveFilesVerified,protectionDifference,writerConfigSha256,
   backlog:{windows:backlog.windows.length,
    openWindows:backlog.windows.filter(w=>w?.resumedAt===null).length,
    replayCount:Object.keys(backlog.replays).length},
   digests:{ledgerSha256:hash(a.ledger),ownerSha256:hash(a.owner),
    markerSha256:hash(a.marker),snapshotHostSha256:hash(a.snapshotHost),
    protectionSha256:hash(a.protection),backlogSha256:hash(a.backlog),
    currentHostSha256:hash(a.currentHost)},
   recoveryEligible:false,operationalWrites:0,providerCalls:0,d1Writes:0};
 }catch{return unknown('C3160_ORIGINAL_FILES_UNAVAILABLE');}
}

// Fixed #3160 ENOENT preflight: observe only approved non-secret file presence,
// checkout commit proof and recovery claim. Never call recovery, modify a lease,
// or infer that this Actions runner is an independent Windows operator.
export function inspect3160RollbackPreflightReadonly({
 checkoutRoot='E:/ZGmini/projects/zgmini-pc-control',
 maintenanceRoot='E:/ZGmini/automation/pc-maintenance',
 read=fs.readFileSync,stat=fs.lstatSync,list=fs.readdirSync,
 gitCheck=(cwd,rel)=>spawnSync('git',['show','HEAD:'+rel],{
  cwd,encoding:null,windowsHide:true,timeout:12000,maxBuffer:32768}),
 gitAvailable=()=>spawnSync('git',['--version'],{
  encoding:'utf8',windowsHide:true,timeout:8000,maxBuffer:1024})
}={}){
 const rel='approvals/maintenance-recoveries/'+C3160_ID+'.rollback.json';
 const states=['PRESENT','ABSENT','UNVERIFIED','UNSAFE'];
 const fixedFile=(p,cap=32768)=>{
  try{
   const st=stat(p);
   if(!st.isFile()||st.isSymbolicLink()||st.size<1||st.size>cap)
    return {state:'UNSAFE',bytes:null};
   const a=read(p),b=read(p);
   if(!Buffer.isBuffer(a)||!Buffer.isBuffer(b)||a.length!==st.size||!a.equals(b))
    return {state:'UNVERIFIED',bytes:null};
   return {state:'PRESENT',bytes:a};
  }catch(e){return {state:e?.code==='ENOENT'?'ABSENT':'UNVERIFIED',bytes:null};}
 };
 const dirState=p=>{
  try{const x=stat(p);return x.isDirectory()&&!x.isSymbolicLink()?'PRESENT':'UNSAFE';}
  catch(e){return e?.code==='ENOENT'?'ABSENT':'UNVERIFIED';}
 };
 const approval=fixedFile(path.join(checkoutRoot,rel),8192);
 const approvedPackage=fixedFile(path.join(maintenanceRoot,'approved',C3160_ID+'.json'),131072);
 const claim=dirState(path.join(maintenanceRoot,'leases/controller-recovery'));
 let approvalIdentity='UNVERIFIED';
 if(approval.state==='ABSENT')approvalIdentity='MISSING';
 if(approval.bytes){
  try{
   const a=JSON.parse(approval.bytes.toString('utf8'));
   approvalIdentity=a.schema==='ZGMINI_PC_ROLLBACK_APPROVAL_V1'&&a.approved===true&&
    a.requestId===C3160_ID&&
    a.sourceSha==='a19ce199142d64b0aa6de800f1c2c6d9b07c141c'&&
    a.ledgerSha256==='9359ea893172168cc96c67990310f2b9f87141ea6765571abbdc8f73a3444c71'
    ?'EXPECTED_IDENTITY':'IDENTITY_DRIFT';
  }catch{approvalIdentity='INVALID_JSON';}
 }
 let gitAvailableState='UNVERIFIED',checkoutHeadApproval='UNVERIFIED';
 try{
  const g=gitAvailable();
  gitAvailableState=g?.error?.code==='ENOENT'?'ABSENT':
   g?.status===0?'AVAILABLE':'UNVERIFIED';
  if(gitAvailableState==='AVAILABLE'){
   const head=gitCheck(checkoutRoot,rel);
   checkoutHeadApproval=head?.status===0&&Buffer.isBuffer(head.stdout)?
    approval.bytes?.equals(head.stdout)===true?'MATCHES_LOCAL_APPROVAL':
     'HEAD_PRESENT_BUT_DIFFERS':
    head?.error?.code==='ENOENT'?'GIT_EXECUTABLE_ABSENT':
     'NOT_READABLE_FROM_HEAD';
  }
 }catch{}
 const tool=fixedFile(path.join(checkoutRoot,'tools/controller-rollback-recovery.mjs'),2097152);
 let toolHashMatch=null;
 if(tool.bytes)toolHashMatch=createHash('sha256').update(tool.bytes).digest('hex')===
  '414064c4853d674b3aea078158342ad854722fb03864fa8fd214a2f974dcf677';
 let recoveryRecordCount=null;
 try{
  const names=list(path.join(maintenanceRoot,'recovery'));
  if(Array.isArray(names)&&names.length<=3000)
   recoveryRecordCount=names.filter(x=>
    x.startsWith(C3160_ID+'-rollback-')&&
    /^[a-z0-9-]+\.json$/.test(x)).length;
 }catch{}
 const localApproval=states.includes(approval.state)?approval.state:'UNVERIFIED';
 const localApprovedPackage=states.includes(approvedPackage.state)?approvedPackage.state:'UNVERIFIED';
 return {schema:'ZGMINI_C3160_OPERATOR_PREFLIGHT_READONLY_V1',
  requestId:C3160_ID,status:'READ_ONLY_OBSERVED',
  localApproval,approvalIdentity,localApprovedPackage,
  gitAvailable:gitAvailableState,checkoutHeadApproval,
  localRecoveryTool:tool.state,localRecoveryToolShaVerified:toolHashMatch,
  recoveryClaim:claim,recoveryRecordCount,
  // No conclusion about human operator identity or safe rollback execution.
  recoveryEligible:false,operationalWrites:0,providerCalls:0,d1Writes:0};
}

// Fixed read-only HTTP request log projection. The source module is the
// already-tested Controller A adapter, loaded from the exact Git checkout.
// No caller input, secrets, URLs, query paths, or raw log lines are returned.
const HTTP_OBSERVATION_ROOT='E:/ZGmini/data';
const HOST=/^(?=.{4,180}$)[a-z0-9-]+(?:\.[a-z0-9-]+)+$/;
const HTTP_CODE=/^(?:[1-5][0-9]{2}|NETWORK_ERROR|PROVIDER_QUOTA_GUARD)$/;
const HOST_STATE=new Set(['normal','failed','unknown']);
const HOST_REASON=new Set([
 'NOT_REPEATED','ESTIMATED_CADENCE_OVERDUE','NO_VERIFIED_SCHEDULE_OVER_36H',
 'LAST_HTTP_ERROR','QUOTA_OR_UNCLASSIFIED','RECENT_2XX',
 'RECENT_2XX_CADENCE_UNVERIFIED','MONTHLY_BFS_2XX_IN_OBSERVED_WINDOW',
 'EVIDENCE_UNKNOWN']);
const safeIso=v=>typeof v==='string'&&Number.isFinite(Date.parse(v))
 ?new Date(v).toISOString():null;
const unknownHostEvidence=code=>({status:'STATE_UNKNOWN',code,
 source:'PC_COLLECTION_EVENTS_FETCH_WRAPPER',monitoredCount:null,
 rosterComplete:false,http:null,hosts:[],providerCalls:0,operationalWrites:0,d1Writes:0});
export function projectObservedProviderHosts(raw){
 if(!raw||raw.source!=='PC_COLLECTION_EVENTS_FETCH_WRAPPER'||
  raw.scope!=='FIXED_LOCAL_JSONL_ONLY'||
  !Number.isSafeInteger(raw.monitoredHostCount)||raw.monitoredHostCount<0||
  !Number.isSafeInteger(raw.monitoredHostsReturned)||
  raw.monitoredHostsReturned<0||raw.monitoredHostsReturned>64||
  !Array.isArray(raw.hosts)||raw.hosts.length>64)
  return unknownHostEvidence('OBSERVED_HOST_INPUT_INVALID');
 const rows=raw.hosts.filter(x=>x?.monitored===true);
 const seen=new Set(),hosts=[];
 for(const x of rows){
  if(!HOST.test(x.host??'')||seen.has(x.host)||
    !HOST_STATE.has(x.monitoringState)||!HOST_REASON.has(x.reason)||
    !x.lastRunStatuses||typeof x.lastRunStatuses!=='object'||
    Object.keys(x.lastRunStatuses).length>20||
    Object.entries(x.lastRunStatuses).some(([k,v])=>!HTTP_CODE.test(k)||
      !Number.isSafeInteger(v)||v<0)||
    (x.lastAttemptAt!==null&&!safeIso(x.lastAttemptAt))||
    (x.last2xxRunAt!==null&&!safeIso(x.last2xxRunAt)))
    return unknownHostEvidence('OBSERVED_HOST_ITEM_INVALID');
  seen.add(x.host);
  hosts.push({host:x.host,monitoringState:x.monitoringState,reason:x.reason,
   lastAttemptAt:safeIso(x.lastAttemptAt),last2xxRunAt:safeIso(x.last2xxRunAt),
   lastRunStatuses:Object.fromEntries(Object.entries(x.lastRunStatuses).sort())});
 }
 hosts.sort((a,b)=>a.host.localeCompare(b.host));
 // Omitted one-off hosts do not make the repeating cohort incomplete:
 // only omission of a monitored host prevents an exact monitored roster.
 const complete=rows.length===raw.monitoredHostsReturned&&
  rows.length===raw.monitoredHostCount;
 const counts={normal:hosts.filter(x=>x.monitoringState==='normal').length,
  failed:hosts.filter(x=>x.monitoringState==='failed').length,
  unknown:hosts.filter(x=>x.monitoringState==='unknown').length,total:hosts.length};
 const consistent=raw.http?.normal===counts.normal&&raw.http?.failed===counts.failed&&
  raw.http?.unknown===counts.unknown&&raw.http?.total===raw.monitoredHostCount;
 return {status:complete&&consistent&&raw.status==='PASS'?'PASS':'STATE_UNKNOWN',
  code:complete&&consistent?'OBSERVED_HTTP_COHORT_READBACK':'OBSERVED_HTTP_COHORT_PARTIAL',
  source:'PC_COLLECTION_EVENTS_FETCH_WRAPPER',
  scope:'OBSERVED_REPEATED_HTTP_HOSTS_NOT_APPROVED_API_ENDPOINTS',
  observedAt:safeIso(raw.now),windowDays:raw.windowDays===14?14:null,
  monitoredCount:raw.monitoredHostCount,rosterComplete:complete&&consistent,
  http:consistent?counts:null,hosts,
  sourceCoverage:raw.status==='PASS'?'PASS':'PARTIAL_OR_UNKNOWN',
  providerCalls:0,operationalWrites:0,d1Writes:0};
}
function readObservedProviderHosts(){
 try{return projectObservedProviderHosts(inspectProviderActivity(HTTP_OBSERVATION_ROOT));}
 catch{return unknownHostEvidence('HTTP_DIAGNOSTIC_READ_FAILED');}
}

// Read the ORIGINAL #1501 immutable-intent backlog only. Summary never
// contains request bodies, URL paths, owner nonces, or credentials.
const C1501_BACKLOG_FILE=path.join(MAINTENANCE_ROOT,'backlog',C1501_ID+'.json');
const BACKLOG_LIMIT=1024*1024;
const backlogUnknown=code=>({status:'STATE_UNKNOWN',code,
 schema:'ZGMINI_PC_BACKLOG_WINDOW_READONLY_V1',originalRequestIssue:1501,
 windowCount:null,openWindowCount:null,replayCount:null,
 windows:[],replays:[],rosterTruncated:false,
 stateHash:null,mutationAllowed:false,operationalWrites:0,providerCalls:0,d1Writes:0});
const validBacklogTime=s=>typeof s==='string'&&Number.isFinite(Date.parse(s))
 ?new Date(s).toISOString():null;
export function classify1501BacklogBytes(first,second){
 if(!Buffer.isBuffer(first)||!Buffer.isBuffer(second)||first.length===0||
  first.length>BACKLOG_LIMIT||!first.equals(second))
  return backlogUnknown('C1501_BACKLOG_SNAPSHOT_CHANGED_OR_UNREADABLE');
 let v;try{v=JSON.parse(first.toString('utf8'));}catch{
  return backlogUnknown('C1501_BACKLOG_JSON_INVALID');}
 if(v?.schema!=='ZGMINI_PC_BACKLOG_V1')
  return backlogUnknown('C1501_BACKLOG_SCHEMA_INVALID');
 const raw=Array.isArray(v.windows)?v.windows:[{pausedAt:v.pausedAt,resumedAt:v.resumedAt}];
 if(raw.length<1||raw.length>8)
  return backlogUnknown('C1501_BACKLOG_WINDOWS_INVALID');
 const windows=[];
 for(let i=0;i<raw.length;i++){
  const pausedAt=validBacklogTime(raw[i]?.pausedAt);
  const resumedAt=raw[i]?.resumedAt==null?null:validBacklogTime(raw[i].resumedAt);
  if(!pausedAt||(raw[i]?.resumedAt!=null&&!resumedAt)||
   (resumedAt&&Date.parse(resumedAt)<Date.parse(pausedAt))||
   (i>0&&Date.parse(pausedAt)<Date.parse(windows.at(-1).pausedAt)))
   return backlogUnknown('C1501_BACKLOG_WINDOW_INVALID');
  windows.push({index:i+1,pausedAt,resumedAt});
 }
 const replays=v.replays??{};
 if(!replays||typeof replays!=='object'||Array.isArray(replays)||
   Object.keys(replays).length>2000)
  return backlogUnknown('C1501_BACKLOG_REPLAYS_INVALID');
 const permitted=new Set(['DONE','SKIPPED_RESULT_PRESENT','POSTING']);
 const rows=[];
 let done=0,skipped=0,posting=0,other=0;
 for(const [key,item] of Object.entries(replays)){
  if(!/^[1-9][0-9]{0,9}$/.test(key)||typeof item!=='object'||item===null||
   Array.isArray(item))return backlogUnknown('C1501_BACKLOG_REPLAY_ITEM_INVALID');
  const state=permitted.has(item.status)?item.status:'OTHER_UNVERIFIED';
  if(state==='DONE')done++;else if(state==='SKIPPED_RESULT_PRESENT')skipped++;
  else if(state==='POSTING')posting++;else other++;
  rows.push({issueNumber:Number(key),status:state});
 }
 rows.sort((a,b)=>a.issueNumber-b.issueNumber);
 const open=windows.filter(w=>w.resumedAt===null).length;
 return {schema:'ZGMINI_PC_BACKLOG_WINDOW_READONLY_V1',status:'PASS',
  code:'C1501_BACKLOG_WINDOW_READBACK_VERIFIED',originalRequestIssue:1501,
  stateHash:sha256(first),windowCount:windows.length,openWindowCount:open,
  windows,replayCount:rows.length,
  replayCounts:{done,skippedResultPresent:skipped,posting,otherUnverified:other},
  replays:rows.slice(0,32),rosterTruncated:rows.length>32,
  mutationAllowed:false,operationalWrites:0,providerCalls:0,d1Writes:0};
}
export function inspect1501BacklogReadonly({
 correlation=inspect1501LeaseCorrelation,
 stat=fs.lstatSync,read=fs.readFileSync}={}){
 if(correlation()?.status!=='CORRELATED')
  return backlogUnknown('C1501_BACKLOG_OWNER_UNVERIFIED');
 try{
  const dir=stat(path.dirname(C1501_BACKLOG_FILE));
  if(!dir.isDirectory()||dir.isSymbolicLink())
   return backlogUnknown('C1501_BACKLOG_UNSAFE_DIRECTORY');
  const item=stat(C1501_BACKLOG_FILE);
  if(!item.isFile()||item.isSymbolicLink()||
   item.size<=0||item.size>BACKLOG_LIMIT)
   return backlogUnknown('C1501_BACKLOG_UNSAFE_FILE');
  const first=read(C1501_BACKLOG_FILE),second=read(C1501_BACKLOG_FILE);
  if(!Buffer.isBuffer(first)||first.length!==item.size)
   return backlogUnknown('C1501_BACKLOG_READ_SIZE_DRIFT');
  return classify1501BacklogBytes(first,second);
 }catch{return backlogUnknown('C1501_BACKLOG_UNAVAILABLE');}
}

// Three exact observed HTTP hosts only; method/path remains one-way hashed.
// No full URL, credentials, paths, body, or other providers are published.
const FIXED_TARGET_HOSTS=['data.sec.gov','data.alpaca.markets','cdn.www.census.gov'];
const FIXED_ENDPOINT_LOG='E:/ZGmini/data/pc-writer/provider-endpoint-events.jsonl';
const FIXED_ENDPOINT_MAX_BYTES=8*1024*1024;
const FIXED_ENDPOINT_MAX_ROWS=16000;
const HASH32=/^[a-f0-9]{32}$/;
const ENDPOINT_STATUS=/^(?:[1-5][0-9]{2}|NETWORK_ERROR|PROVIDER_QUOTA_GUARD)$/;
const endpointUnknown=(code)=>({status:'STATE_UNKNOWN',code,
 scope:'FIXED_THREE_OBSERVED_HOSTS_ONLY',source:'PC_ENDPOINT_PATH_HASH_LOG',
 hosts:[],endpointCoverageVerified:false,providerCalls:0,operationalWrites:0,d1Writes:0});
export function projectTargetEndpointStatus(lines,now=Date.now(),{partialTail=false,rowsTruncated=false}={}){
 if(!Number.isSafeInteger(now)||now<0||!Array.isArray(lines)||lines.length>FIXED_ENDPOINT_MAX_ROWS)
  return endpointUnknown('ENDPOINT_INPUT_INVALID');
 const from=now-14*86400000;
 const matched=new Map(FIXED_TARGET_HOSTS.map(host=>[host,new Map()]));
 let invalid=0,seenEvents=0;
 for(const line of lines){
  if(typeof line!=='string'||line.length>200000){invalid++;continue;}
  if(!line.trim())continue;
  let record;try{record=JSON.parse(line);}catch{invalid++;continue;}
  const at=Date.parse(record?.at??'');
  if(!Number.isFinite(at)||at>now+60000){invalid++;continue;}
  if(at<from)continue;
  if(record.endpointPaths===null||typeof record.endpointPaths!=='object'||
    Array.isArray(record.endpointPaths)){invalid++;continue;}
  seenEvents++;
  for(const host of FIXED_TARGET_HOSTS){
   const routes=record.endpointPaths[host];
   if(routes===undefined)continue;
   if(!routes||typeof routes!=='object'||Array.isArray(routes)||
     Object.keys(routes).length>128){invalid++;continue;}
   const dest=matched.get(host);
   for(const [hash,row] of Object.entries(routes)){
    if(!HASH32.test(hash)||!row||!Number.isSafeInteger(row.requests)||
      row.requests<1||row.requests>50000||!row.statuses||
      typeof row.statuses!=='object'||Array.isArray(row.statuses)||
      Object.keys(row.statuses).length>20){invalid++;continue;}
    const statuses=Object.entries(row.statuses);
    if(!statuses.length||statuses.some(([k,v])=>!ENDPOINT_STATUS.test(k)||
      !Number.isSafeInteger(v)||v<0)||
      statuses.reduce((sum,[,v])=>sum+v,0)!==row.requests){invalid++;continue;}
    const old=dest.get(hash);
    const successful=statuses.some(([k,v])=>k.startsWith('2')&&v>0);
    const failed404=statuses.some(([k,v])=>k==='404'&&v>0);
    const merged={hash,lastAt:at,lastStatuses:Object.fromEntries(statuses),
      totalRequests:(old?.totalRequests??0)+row.requests,
      last2xxAt:successful?Math.max(old?.last2xxAt??0,at):(old?.last2xxAt??null),
      last404At:failed404?Math.max(old?.last404At??0,at):(old?.last404At??null)};
    if(old&&at<old.lastAt){
      merged.lastAt=old.lastAt;merged.lastStatuses=old.lastStatuses;
    }
    dest.set(hash,merged);
   }
  }
 }
 const hosts=FIXED_TARGET_HOSTS.map(host=>{
  const all=[...matched.get(host).values()].sort((a,b)=>a.hash.localeCompare(b.hash));
  const safe=all.slice(0,40);
  return {host,endpointCount:all.length,returnedCount:safe.length,
   truncated:all.length>40,
   endpointHashes:safe.map(row=>({hash:row.hash,
    lastAt:new Date(row.lastAt).toISOString(),
    lastStatuses:row.lastStatuses,totalRequests:row.totalRequests,
    last2xxAt:row.last2xxAt?new Date(row.last2xxAt).toISOString():null,
    last404At:row.last404At?new Date(row.last404At).toISOString():null}))};
 });
 const partial=partialTail||rowsTruncated||invalid>0||hosts.some(h=>h.truncated);
 const observed=hosts.some(h=>h.endpointCount>0);
 return {status:observed&&!partial?'OBSERVED':'STATE_UNKNOWN',
  code:!observed?'ENDPOINT_NO_OBSERVATIONS':partial?'ENDPOINT_PARTIAL':'ENDPOINT_HASH_STATUS_READBACK',
  scope:'FIXED_THREE_OBSERVED_HOSTS_ONLY',source:'PC_ENDPOINT_PATH_HASH_LOG',
  windowDays:14,seenEvents,invalidEvents:invalid,
  partialTail,rowsTruncated,
  endpointCoverageVerified:false,hosts,
  providerCalls:0,operationalWrites:0,d1Writes:0};
}
function readTargetEndpointStatus(){
 try{
  const root=path.dirname(FIXED_ENDPOINT_LOG);
  const d=fs.lstatSync(root),f=fs.lstatSync(FIXED_ENDPOINT_LOG);
  if(!d.isDirectory()||d.isSymbolicLink()||!f.isFile()||f.isSymbolicLink()||
    f.size<1)return endpointUnknown('ENDPOINT_LOG_UNAVAILABLE');
  const fd=fs.openSync(FIXED_ENDPOINT_LOG,'r');
  let buffer,partialTail=false,changed=false;
  try{
   const before=fs.fstatSync(fd),length=Math.min(before.size,FIXED_ENDPOINT_MAX_BYTES);
   partialTail=before.size>length;buffer=Buffer.alloc(length);
   let used=0;
   while(used<length){
    const n=fs.readSync(fd,buffer,used,length-used,before.size-length+used);
    if(n<=0)throw Error('SHORT_READ');
    used+=n;
   }
   const after=fs.fstatSync(fd);
   changed=before.size!==after.size||before.mtimeMs!==after.mtimeMs;
  }finally{fs.closeSync(fd);}
  if(changed)return endpointUnknown('ENDPOINT_LOG_CHANGED');
  let lines=buffer.toString('utf8').split('\n');
  if(partialTail)lines.shift();
  lines.pop();
  const rowsTruncated=lines.length>FIXED_ENDPOINT_MAX_ROWS;
  if(rowsTruncated)lines=lines.slice(-FIXED_ENDPOINT_MAX_ROWS);
  return projectTargetEndpointStatus(lines,Date.now(),{partialTail,rowsTruncated});
 }catch{return endpointUnknown('ENDPOINT_LOG_UNAVAILABLE');}
}


// Fixed W05 #2821 independent-operator ancestry *observation* through the
// existing operating-PC A runner. This never invokes OPERATOR authorization,
// emulates a login, changes the installed .vbs, or makes a recovery eligible.
// Only bounded process IDs and first failing check codes are exported.
const W05_OPERATOR_TOPOLOGY_PS=[
 "$ErrorActionPreference='Stop'",
 "$all=@(Get-CimInstance -ClassName Win32_Process -ErrorAction Stop)",
 "$by=@{};foreach($p in $all){$by[[int]$p.ProcessId]=$p}",
 "$candidates=@($all | Where-Object {($_.Name -eq 'powershell.exe' -or $_.Name -eq 'pwsh.exe') -and [int]$_.SessionId -gt 0} | Sort-Object ProcessId)",
 "$output=@()",
 "foreach($start in ($candidates | Select-Object -First 6)){",
 " $item=$start;$session=[int]$start.SessionId;$sidRef=$null;$childBorn=$null;$seen=@{};$reason='DEPTH_EXCEEDED'",
 " for($n=0;$n -lt 32;$n++){",
 "  $processId=[int]$item.ProcessId",
 "  if($processId -le 0 -or $seen.ContainsKey($processId)){$reason='INVALID_OR_CYCLIC_PID';break}",
 "  $seen[$processId]=$true",
 "  if([int]$item.SessionId -ne $session){$reason='SESSION_MISMATCH';break}",
 "  $exe=[string]$item.ExecutablePath",
 "  if([string]::IsNullOrWhiteSpace($exe)){$reason='EXECUTABLE_PATH_UNAVAILABLE';break}",
 "  $name=[System.IO.Path]::GetFileName($exe).ToLowerInvariant()",
 "  if($name -eq 'runner.listener.exe' -or $name -eq 'runner.worker.exe'){$reason='RUNNER_ANCESTRY';break}",
 "  if($null -eq $item.CreationDate){$reason='CREATION_TIME_UNAVAILABLE';break}",
 "  $born=[datetime]$item.CreationDate",
 "  if($null -ne $childBorn -and $born.ToUniversalTime() -gt $childBorn.ToUniversalTime()){$reason='PARENT_NEWER_THAN_CHILD';break}",
 "  $sid=$null",
 "  try{$owner=Invoke-CimMethod -InputObject $item -MethodName GetOwnerSid -ErrorAction Stop;if([int]$owner.ReturnValue -eq 0){$sid=[string]$owner.Sid}}catch{}",
 "  if([string]::IsNullOrWhiteSpace($sid)){$reason='SID_UNAVAILABLE';break}",
 "  if($null -eq $sidRef){$sidRef=$sid}elseif($sid -ne $sidRef){$reason='SID_MISMATCH';break}",
 "  if($name -eq 'explorer.exe'){$reason='EXPLORER_CHAIN_CANDIDATE';break}",
 "  $parentId=[int]$item.ParentProcessId",
 "  if($parentId -le 0 -or -not $by.ContainsKey($parentId)){$reason='PARENT_UNAVAILABLE';break}",
 "  $childBorn=$born;$item=$by[$parentId]",
 " }",
 " $output+=@{pid=[int]$start.ProcessId;reason=$reason}",
 "}",
 "@{schema='ZGMINI_W05_OPERATOR_TOPOLOGY_PROBE_V1';candidateTotal=[int]$candidates.Count;cases=@($output)} | ConvertTo-Json -Compress -Depth 4"
].join('; ');
const W05_OPERATOR_REASONS=new Set([
 'DEPTH_EXCEEDED','INVALID_OR_CYCLIC_PID','SESSION_MISMATCH',
 'EXECUTABLE_PATH_UNAVAILABLE','RUNNER_ANCESTRY',
 'CREATION_TIME_UNAVAILABLE','PARENT_NEWER_THAN_CHILD','SID_UNAVAILABLE',
 'SID_MISMATCH','EXPLORER_CHAIN_CANDIDATE','PARENT_UNAVAILABLE'
]);
export function sanitizeW05OperatorTopologyProbe(raw){
 if(raw?.schema!=='ZGMINI_W05_OPERATOR_TOPOLOGY_PROBE_V1'||
   !Number.isSafeInteger(raw.candidateTotal)||raw.candidateTotal<0||
   raw.candidateTotal>50000||!Array.isArray(raw.cases)||
   raw.cases.length>6||raw.cases.length>raw.candidateTotal||
   (raw.candidateTotal<=6&&raw.cases.length!==raw.candidateTotal))
  fail('W05_OPERATOR_PROBE_SCHEMA_INVALID');
 const seen=new Set(),cases=raw.cases.map(row=>{
  if(!row||Object.keys(row).sort().join(',')!=='pid,reason'||
    !Number.isSafeInteger(row.pid)||row.pid<=0||
    seen.has(row.pid)||!W05_OPERATOR_REASONS.has(row.reason))
   fail('W05_OPERATOR_PROBE_RESULT_INVALID');
  seen.add(row.pid);
  return {pid:row.pid,firstBoundary:row.reason};
 });
 return {status:cases.length?'PASS':'STATE_UNKNOWN',
   code:cases.length?'W05_OPERATOR_CANDIDATE_TOPOLOGY_COLLECTED':'W05_OPERATOR_NO_SHELL_CANDIDATES',
   candidateTotal:raw.candidateTotal,casesTruncated:raw.candidateTotal>6,
   cases,independentOperatorAttested:false,recoveryEligible:false};
}
export function collectW05OperatorTopology(ctx,env=process.env,{
 platform=os.platform,hostname=os.hostname,exists=fs.existsSync,spawn=spawnSync
}={}){
 const base={schema:'ZGMINI_W05_OPERATOR_TOPOLOGY_RESULT_V1',role:'operating',
  requestId:ctx.requestId,issueNumber:ctx.issueNumber,runId:ctx.runId,
  attempt:ctx.attempt,observedAtUtc:new Date().toISOString(),
  host:hostname().toUpperCase(),runnerName:String(env.RUNNER_NAME||''),
  independentOperatorAttested:false,recoveryEligible:false,
  operationalWrites:0,providerCalls:0,d1Writes:0,automaticRetries:0,
  commandLinesCaptured:false,ownerSidsCaptured:false};
 const seat=validateSeat('operating',base.host,base.runnerName,env.COMPUTERNAME);
 if(platform()!=='win32'||base.host!=='PC'||seat!=='MATCH')
  return {...base,status:'BLOCKED',code:platform()!=='win32'?'W05_WINDOWS_REQUIRED':
   seat==='MATCH'?'W05_OPERATING_PC_REQUIRED':seat};
 const powershell=path.win32.join(env.SystemRoot||'C:\\Windows',
   'System32\\WindowsPowerShell\\v1.0\\powershell.exe');
 if(!exists(powershell))return {...base,status:'STATE_UNKNOWN',code:'W05_POWERSHELL_UNAVAILABLE'};
 const encoded=Buffer.from(W05_OPERATOR_TOPOLOGY_PS,'utf16le').toString('base64');
 const proc=spawn(powershell,['-NoLogo','-NoProfile','-NonInteractive','-EncodedCommand',encoded],
  {encoding:'utf8',windowsHide:true,timeout:30000,maxBuffer:12288,shell:false,env:{...env}});
 if(proc.error||proc.status!==0)
  return {...base,status:'STATE_UNKNOWN',code:
   proc.error?.code==='ETIMEDOUT'?'W05_OPERATOR_WMI_TIMEOUT':'W05_OPERATOR_WMI_UNAVAILABLE'};
 try{
  const rows=sanitizeW05OperatorTopologyProbe(JSON.parse(proc.stdout.replace(/^\uFEFF/,'').trim()));
  return {...base,...rows};
 }catch{return {...base,status:'STATE_UNKNOWN',code:'W05_OPERATOR_WMI_REPORT_INVALID'};}
}
export function w05OperatorTopologyText(r){
 return ['schema='+r.schema,'requestId='+r.requestId,'runId='+r.runId,
  'attempt='+r.attempt,'role='+r.role,'host='+r.host,'runner='+r.runnerName,
  'status='+r.status,'code='+r.code,
  'candidateTotal='+(r.candidateTotal??'UNKNOWN'),
  ...(r.cases??[]).map(x=>'candidate.'+x.pid+'='+x.firstBoundary),
  'independentOperatorAttested=false','recoveryEligible=false',
  'operationalWrites=0','automaticRetries=0',''].join('\r\n');
}

// Reuse the reviewed Controller's bounded static inspection through this existing
// operating-PC read-only workflow. The installed Controller is not modified.
// Never return raw private Sidecar code, ledger failure messages, paths or hashes.
const CNN_SIDECAR_DATA_ROOT='E:/ZGmini/data';
const CNN_STATIC_FILES=new Set([
 'archive-run.mjs','run-original-then-archive.vbs',
 'archive-core-r10.mjs','verified-checks-r10.mjs']);
const CNN_STATIC_KINDS=new Set([
 'SOURCE_APPROVAL_REFERENCE','GIT_REFERENCE','CLEAN_TREE_REFERENCE',
 'ARCHIVE_LAUNCH_REFERENCE']);
const CNN_STATIC_CONCEPTS=new Set([
 'SOURCE','APPROVAL','APPROVED','CONFIG','GIT','HEAD','SHA','DIRTY',
 'BRANCH','MISMATCH','MISSING','UNAVAILABLE','DRIFT','REPO','PATH',
 'CHECKOUT','WORKTREE','ARCHIVE','LOCK','PERMISSION','CLEAN']);
export function projectCnnSidecarStaticGuard(raw){
 const rows=raw?.scriptStatus;
 const scriptPinsVerified=raw?.ledgerStatus==='READ'&&Array.isArray(rows)&&
  rows.length===CNN_STATIC_FILES.size&&
  new Set(rows.map(x=>x?.file)).size===CNN_STATIC_FILES.size&&
  rows.every(x=>CNN_STATIC_FILES.has(x?.file)&&x?.status==='MATCH'&&
   x?.modifiedAfterLedger===false);
 const validCandidates=Array.isArray(raw?.sourceGuardCandidates)&&
  raw.sourceGuardCandidates.length<=16&&raw.sourceGuardCandidates.every(x=>
   CNN_STATIC_FILES.has(x?.file)&&Number.isSafeInteger(x?.line)&&
   x.line>=1&&x.line<=10000&&CNN_STATIC_KINDS.has(x?.kind));
 const validOrigins=Array.isArray(raw?.ledgerOriginCandidates)&&
  raw.ledgerOriginCandidates.length<=4&&
  raw.ledgerOriginCandidates.every(name=>CNN_STATIC_FILES.has(name));
 const validReason=Array.isArray(raw?.reasonConcepts)&&
  raw.reasonConcepts.length<=12&&
  raw.reasonConcepts.every(v=>CNN_STATIC_CONCEPTS.has(v));
 const validSite=['NONE','UNIQUE','MULTIPLE','NOT_CHECKED'].includes(raw?.matchingErrorSite);
 const verified=scriptPinsVerified&&validCandidates&&validOrigins&&validReason&&validSite;
 return {schema:'ZGMINI_CNN_SIDECAR_STATIC_GUARD_READONLY_V1',
  status:verified?'PASS':'STATE_UNKNOWN',
  code:verified?'CNN_STATIC_GUARD_CANDIDATES_COLLECTED':'CNN_STATIC_GUARD_UNVERIFIED',
  evidence:'PINNED_STATIC_CANDIDATES_NOT_RUNTIME_CAUSAL_PROOF',
  scriptPinsVerified:Boolean(scriptPinsVerified),ledgerStatus:
   raw?.ledgerStatus==='READ'?'READ':'UNVERIFIED',
  matchingErrorSite:verified?raw.matchingErrorSite:'NOT_CHECKED',
  ledgerOriginCandidates:verified?[...new Set(raw.ledgerOriginCandidates)]:[],
  sourceGuardCandidates:verified?raw.sourceGuardCandidates.map(x=>
   ({file:x.file,line:x.line,kind:x.kind})):[],
  reasonConcepts:verified?[...new Set(raw.reasonConcepts)]:[],
  // Without a second verified ledger byte snapshot no temporal stability claim.
  sameLedgerSnapshotVerified:false,sidecarFailureResolved:false,
  operationalWrites:0,providerCalls:0,d1Writes:0};
}


/**
 * Single-point operating Runner A observation for preparing the separate
 * Owner-approved S6 B manifest. This is NOT the independent maintainer's
 * s6-once-status: the B receiver must re-attest origin, all six Runner
 * seats idle, active intake, exact CAS and current installed bytes.
 * No subprocess stop, writes, keys, paths, environment or credentials.
 */
export function projectS6ApprovalPreimageReadonly(raw,{now=Date.now(),sourceVersion='ORIGINAL'}={}){
 const base={schema:'ZGMINI_S6_APPROVAL_PREIMAGE_A_V1',
  status:'STATE_UNKNOWN',code:'S6_APPROVAL_PREIMAGE_UNVERIFIED',
  independentOperatorAttested:false,bAuthorization:false,
  failoverTested:false,promotionApproved:false,operationalWrites:0,
  providerCalls:0,d1Writes:0};
 const sha40=x=>typeof x==='string'&&/^[a-f0-9]{40}$/.test(x);
 const sha64=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
 const pid=x=>Number.isSafeInteger(x)&&x>0;
 const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
 const wd=raw?.wd,owner=raw?.owner,sup=raw?.supervisor;
 const at=Date.parse(wd?.at??'');
 const unknown=code=>({...base,code});
 if(!obj(raw)||!obj(wd)||!obj(owner)||!obj(sup))
  return unknown('S6_A_ROSTER_UNAVAILABLE');
 // The source version is selected only by the authenticated fixed A probe.
 const maintainerAllowed=sourceVersion==='CURRENT'?
  S6_CURRENT_MAINTAINER_SOURCES.has(raw.maintainerSourceSha):
  raw.maintainerSourceSha===S6_INSTALLED_MAINTAINER;
 if(!maintainerAllowed||raw.maintainerFilesVerified!==true)
  return unknown('S6_A_MAINTAINER_SOURCE_UNVERIFIED');
 if(raw.controllerFilesVerified!==true||!sha40(raw.controllerSha)||
    raw.installLockHeld!==false)
  return unknown('S6_A_CONTROLLER_OR_LEASE_UNVERIFIED');
 if(!sha64(raw.watchdogSourceSha256)||!sha64(raw.watchdogActualSha256)||
    raw.watchdogActualSha256!==raw.watchdogSourceSha256||
    raw.watchdogMode!=='ACTIVE_1_STANDBY_2'||raw.watchdogApproved!==true)
  return unknown('S6_A_WATCHDOG_SOURCE_UNVERIFIED');
 // Keep every original S6 safety condition; split only A error categories.
 if(wd.state!=='HEALTHY'||wd.standbyRole!=='READY'||
    wd.secondStandbyRole!=='READY'||wd.standbyReadyCount!==2)
  return unknown('S6_A_WATCHDOG_STANDBY_STATE_UNVERIFIED');
 if(!pid(wd.pid)||!pid(wd.standbyPid)||!pid(wd.secondStandbyPid)||
    !pid(raw.receiverPid)||wd.pid!==raw.receiverPid||
    new Set([wd.pid,wd.standbyPid,wd.secondStandbyPid]).size!==3)
  return unknown('S6_A_WATCHDOG_OWNER_IDENTITY_UNVERIFIED');
 if(!Number.isFinite(now)||!Number.isFinite(at)||now-at<0||now-at>=45000)
  return unknown('S6_A_WATCHDOG_HEARTBEAT_UNVERIFIED');
 if(!pid(owner.pid)||owner.pid!==sup.pid||
    !/^[a-f0-9-]{36}$/.test(owner.nonce??'')||
    sup.mode!=='LISTENING'||sup.sourceSha!==raw.controllerSha||
    !Array.isArray(sup.children)||sup.children.length!==6||
    !sha64(raw.ownerSha256))
  return unknown('S6_A_SUPERVISOR_OWNER_UNVERIFIED');
 if(!sha64(raw.protectedSha256))
  return unknown('S6_A_PROTECTED_SNAPSHOT_UNVERIFIED');
 return {...base,status:'PASS',code:'S6_APPROVAL_PREIMAGE_CANDIDATE_ONLY',
  observedAtUtc:new Date(now).toISOString(),
  sixIdleRunnersVerified:false,workflowActiveVerified:false,
  // Exact values are confined to the authenticated *private* A result JSON.
  // Never echo them in the public TXT summary or an Issue comment.
  s6Live:{installedControllerSha:raw.controllerSha,
   installedMaintainerSha:raw.maintainerSourceSha,
   watchdogSourceSha256:raw.watchdogSourceSha256,
   protectedSha256:raw.protectedSha256,
   ownerSha256:raw.ownerSha256,
   watchdogPid:wd.pid,standbyPids:[wd.standbyPid,wd.secondStandbyPid]}};
}
export function inspectS6ApprovalPreimageReadonly({
 io=fs,now=Date.now(),protect=protectedSnapshot,
 maintenance=collectMaintenanceStatusReadonly,sourceVersion='ORIGINAL'
}={}){
 const unknown=code=>({...projectS6ApprovalPreimageReadonly(null,{now}),
  ...(code?{code}: {})});
 let stage='MAINTENANCE_STATUS';
 try{
  const rd=(p,maxBytes=131072)=>{
   const st=io.lstatSync(p);
   if(!st.isFile()||st.isSymbolicLink()||st.nlink!==1||
      st.size<=0||st.size>maxBytes)throw Error('S6_A_FILE_UNVERIFIED');
   return io.readFileSync(p);
  };
  const get=p=>JSON.parse(rd(p).toString('utf8'));
  const maint=maintenance();
  const maintRoot='E:/ZGmini/automation/pc-maintenance';
  const wdRoot='E:/ZGmini/automation/pc-watchdog';
  const ctl='E:/ZGmini/automation/pc-control';
  stage='WATCHDOG_INSTALL';
  const wdInstall=get(path.join(wdRoot,'INSTALL.json'));
  stage='WATCHDOG_STATUS';
  const wd=get(path.join(wdRoot,'STATUS.json'));
  stage='WATCHDOG_OWNER';
  const wdOwner=get(path.join(wdRoot,'receiver/owner.json'));
  stage='SUPERVISOR_OWNER';
  const ownerRaw=rd(path.join(ctl,'leases/supervisor/owner.json'));
  const owner=JSON.parse(ownerRaw.toString('utf8'));
  stage='SUPERVISOR_STATUS';
  const sup=get(path.join(ctl,'SUPERVISOR_STATUS.json'));
  stage='MAINTAINER_INSTALL';
  const maintInstall=get(path.join(maintRoot,'MAINTENANCE_INSTALL.json'));
  stage='MAINTAINER_FILES';
  const localFiles=Object.entries(maintInstall.files??{});
  if(localFiles.length!==7||localFiles.some(([rel,hash])=>
    !/^tools\/[a-z0-9.-]+$/.test(rel)||
    !/^[a-f0-9]{64}$/.test(hash)||
    // Existing 7-file maintainer contract admits source modules up to 2 MB;
    // update.mjs was 213203 bytes at approved source 05ef3bd, larger
    // than the 128 KiB bound intended only for small status JSON.
    createHash('sha256').update(rd(path.join(maintRoot,rel),2_000_000)).digest('hex')!==hash))
   return unknown('S6_A_MAINTAINER_FILES_UNVERIFIED');
  const sha=x=>createHash('sha256').update(x).digest('hex');
  stage='WATCHDOG_BYTES';
  const wdRaw=rd(path.join(wdRoot,'runner-watchdog.mjs'));
  stage='PROTECTED_SNAPSHOT';
  const protectedSha256=sha(JSON.stringify(protect()));
  return projectS6ApprovalPreimageReadonly({
   maintainerSourceSha:maintInstall.sourceSha,
   maintainerFilesVerified:maint.maintenanceFilesVerified===true,
   controllerFilesVerified:maint.runtimeSignals?.controllerFilesVerified===true,
   controllerSha:maint.actualControllerSha,
   installLockHeld:maint.installLockReadbackVerified===true?maint.installLockHeld:null,
   watchdogSourceSha256:wdInstall.sha256,
   watchdogActualSha256:sha(wdRaw),
   watchdogMode:wdInstall.standby?.mode,
   watchdogApproved:wdInstall.standby?.approved,
   wd,receiverPid:wdOwner.pid,owner,sup:undefined,
   supervisor:sup,ownerSha256:sha(ownerRaw),protectedSha256
  },{now,sourceVersion});
 }catch{return unknown('S6_A_'+stage+'_READ_UNVERIFIED');}
}


/**
 * Only the immutable #3947 S6 one-shot journal is read. This is an A
 * observation of a failed/unknown B effect, NOT a replay or recovery port.
 * Never return the claim nonce, owner PID, raw hashes, arbitrary paths or
 * raw phase files. A live healthy Controller does not establish promotion.
 */
const S6_JOURNAL_PHASES=new Set([
 'CLAIMED','INSTALL_LEASE_ACQUIRE_ATTEMPT','INSTALL_LEASE_ACQUIRED',
 'INTAKE_PAUSE_ATTEMPT','INTAKE_PAUSED','DRAINED','OLD_TREE_STOP_ATTEMPT',
 'OLD_TREE_STOP_SUBMITTED','OLD_TREE_STOP_VERIFIED',
 'INTAKE_RESUME_ATTEMPT','INTAKE_RESUMED','OWNED_LEASE_RELEASE_ATTEMPT',
 'OWNED_LEASE_RELEASED','WATCHDOG_RELEASE_OBSERVED',
 'FAST_PROMOTION_OBSERVED','WATCHDOG_RELEASE_OUTCOME_UNVERIFIED',
 'BACKLOG_RECONCILE_ATTEMPT','BACKLOG_RECONCILED',
 'PROMOTED_READBACK_VERIFIED','RECOVERY_REQUIRED'
]);
export function projectS6OnceJournalReadonly(raw){
 const base={schema:'ZGMINI_S6_ONCE_JOURNAL_A_V1',
  requestId:S6_JOURNAL_REQUEST,status:'STATE_UNKNOWN',
  code:'S6_ONCE_JOURNAL_UNVERIFIED',claimPresent:null,
  journalPhase:null,failedAt:null,failedCode:null,
  mutationAttempted:null,leaseReleaseAcknowledged:null,
  priorOwnerByteMatch:null,backlogState:'UNVERIFIED',
  effectExecuted:null,successEstablished:false,
  recoveryAuthorized:false,originalRequestRetried:false,
  operationalWrites:0,providerCalls:0,d1Writes:0};
 const invalid=(code)=>({...base,code});
 if(raw?.approvalValid!==true||typeof raw.ownerByteMatch!=='boolean')
  return invalid('S6_ONCE_APPROVAL_OR_OWNER_CAS_UNVERIFIED');
 const owner={priorOwnerByteMatch:raw.ownerByteMatch};
 if(raw.claimPresent===false&&raw.journal===null&&raw.backlog===null)
  return {...base,...owner,status:'READ_ONLY_OBSERVED',
   code:'S6_ONCE_CLAIM_ABSENT_AT_OBSERVATION',claimPresent:false,
   backlogState:'ABSENT'};
 if(raw.claimPresent!==true)
  return invalid('S6_ONCE_CLAIM_STATUS_UNVERIFIED');
 if(raw.claimValid!==true)
  return invalid('S6_ONCE_CLAIM_IDENTITY_UNVERIFIED');
 const journal=raw.journal;
 if(journal===null)
  return {...base,...owner,claimPresent:true,
   code:'S6_ONCE_CLAIM_WITHOUT_JOURNAL',
   backlogState:raw.backlog===null?'ABSENT':'UNVERIFIED'};
 if(journal?.schema!=='ZGMINI_S6_ONCE_JOURNAL_V1'||
    journal.requestId!==S6_JOURNAL_REQUEST||
    !S6_JOURNAL_PHASES.has(journal.phase))
  return invalid('S6_ONCE_JOURNAL_IDENTITY_UNVERIFIED');
 const failedAt=typeof journal.failedAt==='string'&&
  S6_JOURNAL_PHASES.has(journal.failedAt)?journal.failedAt:null;
 const failedCode=typeof journal.code==='string'&&
  /^S6_[A-Z0-9_]{1,90}$/.test(journal.code)?journal.code:null;
 const backlog=raw.backlog;
 if(backlog!==null&&(backlog.schema!=='ZGMINI_PC_BACKLOG_V1'||
    backlog.requestId!==S6_JOURNAL_REQUEST||
    !Array.isArray(backlog.windows)||backlog.windows.length<1||
    typeof backlog.pausedAt!=='string'))
  return invalid('S6_ONCE_BACKLOG_IDENTITY_UNVERIFIED');
 const backlogState=backlog===null?'ABSENT':
  backlog.resumedAt?'RESUMED':'PAUSED';
 return {...base,...owner,status:'READ_ONLY_OBSERVED',
  code:'S6_ONCE_JOURNAL_PHASE_OBSERVED',claimPresent:true,
  journalPhase:journal.phase,failedAt,failedCode,
  mutationAttempted:typeof journal.mutationAttempted==='boolean'?
   journal.mutationAttempted:null,
  leaseReleaseAcknowledged:
   typeof journal.leaseReleaseAcknowledged==='boolean'?
   journal.leaseReleaseAcknowledged:null,
  backlogState};
}
/**
 * Check exact immutable GitHub approval bytes in a reusable Windows checkout.
 * Git's existing worktree can retain CRLF when .gitattributes is introduced
 * after the original checkout. Only CRLF -> LF canonicalization is permitted,
 * and only when the original approved SHA-256 then matches exactly.
 * This is read-only diagnostic evidence, NOT an alternate B authorization.
 */
export function s6OncePinnedApprovalCheckoutBytes(raw){
 if(!Buffer.isBuffer(raw)||raw.length<1||raw.length>32768)return null;
 const digest=b=>createHash('sha256').update(b).digest('hex');
 if(digest(raw)===S6_JOURNAL_APPROVAL_SHA)return raw;
 const canonical=[];
 let changed=false;
 for(let i=0;i<raw.length;i++){
  const b=raw[i];
  if(b===13){
   if(raw[i+1]!==10)return null;
   changed=true;
   continue;
  }
  canonical.push(b);
 }
 if(!changed)return null;
 const bytes=Buffer.from(canonical);
 return digest(bytes)===S6_JOURNAL_APPROVAL_SHA?bytes:null;
}

export function inspectS6OnceJournalReadonly({
 io=fs,maintenanceHome='E:/ZGmini/automation/pc-maintenance',
 controllerHome='E:/ZGmini/automation/pc-control',
 sourceRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
}={}){
 const unknown=code=>({...projectS6OnceJournalReadonly(null),code});
 let stage='APPROVAL';
 try{
  const file=(p,max=32768)=>{
   const st=io.lstatSync(p);
   if(!st.isFile()||st.isSymbolicLink()||st.nlink!==1||
      st.size<1||st.size>max)throw Error('S6_A_FIXED_FILE_UNVERIFIED');
   const bytes=io.readFileSync(p);
   if(!Buffer.isBuffer(bytes)||bytes.length!==st.size)
    throw Error('S6_A_FIXED_BYTES_CHANGED');
   return bytes;
  };
  const read=p=>JSON.parse(file(p).toString('utf8'));
  const approvalFile=path.join(sourceRoot,'approvals/controller-s6',
   S6_JOURNAL_APPROVAL_SHA+'.json');
  const bytes=s6OncePinnedApprovalCheckoutBytes(file(approvalFile));
  const sha=x=>createHash('sha256').update(x).digest('hex');
  if(bytes===null)
   return unknown('S6_ONCE_APPROVAL_BYTES_UNVERIFIED');
  const approved=JSON.parse(bytes.toString('utf8'));
  if(approved.schema!=='ZGMINI_PC_S6_ONCE_B_APPROVAL_V1'||
     approved.requestId!==S6_JOURNAL_REQUEST||
     approved.approval?.approved!==true||
     !/^[a-f0-9]{64}$/.test(approved.ownerSha256??''))
   return unknown('S6_ONCE_APPROVAL_IDENTITY_UNVERIFIED');
  stage='CONTROLLER_OWNER';
  const originalOwner=file(path.join(controllerHome,'leases/supervisor/owner.json'));
  const ownerByteMatch=sha(originalOwner)===approved.ownerSha256;
  stage='LEDGER_DIR';
  const ledger=path.join(maintenanceHome,'ledger');
  const ls=io.lstatSync(ledger);
  if(!ls.isDirectory()||ls.isSymbolicLink())
   return unknown('S6_ONCE_LEDGER_ROOT_UNVERIFIED');
  const owned=path.join(ledger,'S6_ONCE_'+S6_JOURNAL_REQUEST);
  let dir;
  try{dir=io.lstatSync(owned);}
  catch(error){
   if(error?.code==='ENOENT')
    return projectS6OnceJournalReadonly({approvalValid:true,
     ownerByteMatch,claimPresent:false,journal:null,backlog:null});
   throw error;
  }
  if(!dir.isDirectory()||dir.isSymbolicLink())
   return unknown('S6_ONCE_CLAIM_DIR_UNVERIFIED');
  stage='CLAIM';
  const claim=read(path.join(owned,'claim.json'));
  const claimValid=claim.schema==='ZGMINI_S6_CLAIM_V1'&&
   claim.requestId===S6_JOURNAL_REQUEST&&
   typeof claim.nonce==='string'&&/^[0-9a-f-]{36}$/.test(claim.nonce);
  const optional=(name,stageName)=>{
   stage=stageName;
   try{return read(path.join(owned,name));}
   catch(error){if(error?.code==='ENOENT')return null;throw error;}
  };
  const journal=optional('journal.json','JOURNAL');
  const backlog=optional('backlog.json','BACKLOG');
  return projectS6OnceJournalReadonly({approvalValid:true,
   ownerByteMatch,claimPresent:true,claimValid,journal,backlog});
 }catch{return unknown('S6_ONCE_'+stage+'_READ_UNVERIFIED');}
}

/**
 * Read-only reconciliation of the original #3947 receiver acceptance claim
 * with the separate one-shot effect claim. This fixed A diagnostic never
 * decides whether a new B attempt is authorized or safe to replay.
 */
export function projectS6ReceiverLedgerReadonly(receiver,port){
 const base={schema:'ZGMINI_S6_RECEIVER_LEDGER_A_V1',
  requestId:S6_JOURNAL_REQUEST,issueNumber:3947,status:'STATE_UNKNOWN',
  code:'S6_RECEIVER_LEDGER_UNVERIFIED',receiverClaimPresent:null,
  receiverResultStatus:null,receiverResultCode:null,
  receiverUploadVerified:null,portClaimPresent:null,
  portStatus:null,portCode:null,portOwnerByteMatch:null,
  historicalEffectEstablished:false,replayAuthorized:false,
  operationalWrites:0,providerCalls:0,d1Writes:0};
 const fail=code=>({...base,code});
 if(receiver===null)return fail('S6_RECEIVER_CLAIM_ABSENT_AT_OBSERVATION');
 if(!receiver||typeof receiver!=='object'||Array.isArray(receiver)
   ||receiver.schema!=='ZGMINI_PC_MAINTENANCE_LEDGER_V1'
   ||receiver.requestId!==S6_JOURNAL_REQUEST||receiver.issueNumber!==3947
   ||receiver.targetControllerSha!=='182bb46f2838306ba40d8b4ec32bac40ab75b69a'
   ||receiver.status!=='UNKNOWN'||receiver.result?.status!=='UNKNOWN'
   ||receiver.result?.requestId!==S6_JOURNAL_REQUEST
   ||receiver.result?.code!=='S6_ONCE_OUTCOME_UNKNOWN'
   ||receiver.result?.firstFail!=='S6_ONCE_OUTCOME_UNKNOWN'
   ||typeof receiver.fingerprint!=='string'
   ||!/^[a-f0-9]{64}$/.test(receiver.fingerprint)
   ||typeof receiver.bodyDigest!=='string'
   ||!/^[a-f0-9]{64}$/.test(receiver.bodyDigest)
   ||receiver.actor!=='ansqhd5774-Choi')
  return fail('S6_RECEIVER_LEDGER_IDENTITY_OR_RESULT_UNVERIFIED');
 if(!port||port.requestId!==S6_JOURNAL_REQUEST||
    port.status!=='READ_ONLY_OBSERVED'||
    port.code!=='S6_ONCE_CLAIM_ABSENT_AT_OBSERVATION'||
    port.claimPresent!==false||port.priorOwnerByteMatch!==true)
  return {...base,receiverClaimPresent:true,
   receiverResultStatus:'UNKNOWN',receiverResultCode:'S6_ONCE_OUTCOME_UNKNOWN',
   receiverUploadVerified:receiver.reportUploadStatus==='VERIFIED',
   portClaimPresent:port?.claimPresent===false?false:null,
   portStatus:port?.status==='READ_ONLY_OBSERVED'?port.status:null,
   portCode:'S6_PORT_JOURNAL_CORRELATION_UNVERIFIED',
   portOwnerByteMatch:port?.priorOwnerByteMatch===true?true:null,
   code:'S6_RECEIVER_PORT_CORRELATION_UNVERIFIED'};
 return {...base,status:'READ_ONLY_OBSERVED',
  code:'S6_RECEIVER_UNKNOWN_PORT_CLAIM_ABSENT_AT_OBSERVATION',
  receiverClaimPresent:true,receiverResultStatus:'UNKNOWN',
  receiverResultCode:'S6_ONCE_OUTCOME_UNKNOWN',
  receiverUploadVerified:receiver.reportUploadStatus==='VERIFIED',
  portClaimPresent:false,portStatus:'READ_ONLY_OBSERVED',
  portCode:'S6_ONCE_CLAIM_ABSENT_AT_OBSERVATION',
  portOwnerByteMatch:true};
}
export function inspectS6ReceiverLedgerReadonly({
 io=fs,maintenanceHome='E:/ZGmini/automation/pc-maintenance',
 inspectPort=()=>inspectS6OnceJournalReadonly()
}={}){
 const unknown=code=>projectS6ReceiverLedgerReadonly(null,null);
 try{
  const parent=path.join(maintenanceHome,'requests');
  for(const dir of [maintenanceHome,parent]){
   const st=io.lstatSync(dir);
   if(!st.isDirectory()||st.isSymbolicLink())return {
    ...unknown(),code:'S6_RECEIVER_DIRECTORY_UNVERIFIED'};
  }
  const name=createHash('sha256').update(S6_JOURNAL_REQUEST).digest('hex')+'.json';
  const filename=path.join(parent,name);
  let stat;
  try{stat=io.lstatSync(filename);}
  catch(e){
   if(e?.code==='ENOENT')return projectS6ReceiverLedgerReadonly(null,null);
   return {...unknown(),code:'S6_RECEIVER_CLAIM_READ_UNVERIFIED'};
  }
  if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1
    ||stat.size<1||stat.size>32768)
   return {...unknown(),code:'S6_RECEIVER_LEDGER_FILE_UNVERIFIED'};
  const buf=io.readFileSync(filename);
  if(!Buffer.isBuffer(buf)||buf.length!==stat.size)
   return {...unknown(),code:'S6_RECEIVER_LEDGER_BYTES_UNVERIFIED'};
  const receiver=JSON.parse(buf.toString('utf8'));
  const port=inspectPort();
  return projectS6ReceiverLedgerReadonly(receiver,port);
 }catch{
  return {...unknown(),code:'S6_RECEIVER_LEDGER_READ_UNVERIFIED'};
 }
}

/**
 * Exact #4069 receiver preclaim diagnosis for the already-approved S6 B request.
 * The independent Windows maintainer writes fixed, bounded result codes to
 * RECEIVER_STATUS.json even when a PRECLAIM guard returns before Issue ACK.
 * Only A observation is performed: no claim, lease, pause, retry or stop.
 * No raw input strings, paths, PIDs, nonce, command or environment are returned.
 */
export function projectS6ActiveReceiverIntakeReadonly({
 receiver=null,owner=null,ownerAlive=false,ledger=null,ledgerPresent=false
}={},now=Date.now()){
 const base={schema:'ZGMINI_S6_ACTIVE_RECEIVER_INTAKE_A_V1',
  requestId:S6_ACTIVE_INTAKE_REQUEST,issueNumber:S6_ACTIVE_INTAKE_ISSUE,
  status:'STATE_UNKNOWN',code:'S6_INTAKE_RECEIVER_UNVERIFIED',
  receiverFresh:false,receiverOwnerVerified:false,receiverPollState:null,
  targetInLatestPoll:false,preclaimStatus:null,preclaimCode:null,
  receiverClaimPresent:null,receiverClaimStatus:null,
  operationalEffectProven:false,replayAuthorized:false,
  operationalWrites:0,providerCalls:0,d1Writes:0};
 const fail=(code,extra={})=>({...base,...extra,code});
 const correctPid=Number.isSafeInteger(receiver?.pid)&&receiver.pid>0&&
  receiver.pid===owner?.pid&&ownerAlive===true&&
  typeof owner?.nonce==='string'&&/^[a-f0-9-]{36}$/.test(owner.nonce);
 if(!correctPid)return fail('S6_INTAKE_RECEIVER_OWNER_UNVERIFIED');
 const time=receiver.at;
 const validTime=typeof time==='string'&&
  /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(time)&&
  Number.isFinite(Date.parse(time))&&new Date(Date.parse(time)).toISOString()===time;
 const fresh=validTime&&Number.isFinite(now)&&
  now-Date.parse(time)>=0&&now-Date.parse(time)<180000;
 const verified={receiverOwnerVerified:true,receiverFresh:fresh};
 if(!fresh)return fail('S6_INTAKE_RECEIVER_POLL_STALE_OR_UNVERIFIED',verified);
 if(receiver.status!=='LISTENING')return fail('S6_INTAKE_RECEIVER_NOT_LISTENING',{
  ...verified,receiverPollState:'OTHER'});
 if(!Array.isArray(receiver.results)||receiver.results.length>1000)
  return fail('S6_INTAKE_POLL_RESULTS_UNVERIFIED',{...verified,receiverPollState:'LISTENING'});
 let claimPresent=false,claimStatus=null;
 if(ledgerPresent){
  if(!ledger||ledger.schema!=='ZGMINI_PC_MAINTENANCE_LEDGER_V1'||
     ledger.requestId!==S6_ACTIVE_INTAKE_REQUEST||
     ledger.issueNumber!==S6_ACTIVE_INTAKE_ISSUE)
   return fail('S6_INTAKE_RECEIVER_CLAIM_IDENTITY_UNVERIFIED',verified);
  claimPresent=true;
  claimStatus=['QUEUED','RUNNING','BLOCKED','STATE_UNKNOWN','UNKNOWN',
   'POSTCHECK_PENDING','RECOVERY_REQUIRED','SUCCEEDED','FAILED'].includes(ledger.status)
   ?ledger.status:'UNVERIFIED';
 }
 const info={...verified,receiverPollState:'LISTENING',
  receiverClaimPresent:claimPresent,receiverClaimStatus:claimStatus};
 const entries=receiver.results.filter(x=>x?.requestId===S6_ACTIVE_INTAKE_REQUEST);
 if(entries.length===0)return {...base,...info,status:'READ_ONLY_OBSERVED',
  code:'S6_INTAKE_NOT_FOUND_IN_LAST_POLL'};
 if(entries.length!==1)return fail('S6_INTAKE_RESULT_DUPLICATED',info);
 const entry=entries[0];
 if(!['BLOCKED','STATE_UNKNOWN','UNKNOWN','RUNNING','POSTCHECK_PENDING',
   'RECOVERY_REQUIRED','SUCCEEDED','FAILED'].includes(entry.status)||
   typeof entry.code!=='string'||
   !/^(?:S6_[A-Z0-9_]{1,88}|DUPLICATE_REQUEST_SUPPRESSED|REQUEST_ID_REUSE_CONFLICT)$/.test(entry.code))
  return fail('S6_INTAKE_RESULT_UNVERIFIED',info);
 return {...base,...info,status:'READ_ONLY_OBSERVED',
  code:'S6_INTAKE_RECEIVER_CODE_OBSERVED',
  targetInLatestPoll:true,preclaimStatus:entry.status,preclaimCode:entry.code};
}
export function inspectS6ActiveReceiverIntakeReadonly({
 io=fs,maintenanceHome='E:/ZGmini/automation/pc-maintenance',
 now=Date.now(),isAlive=pid=>{try{process.kill(pid,0);return true;}catch{return false;}}
}={}){
 const unknown=code=>({...projectS6ActiveReceiverIntakeReadonly(),code});
 try{
  const read=(file,max)=>{
   const st=io.lstatSync(file);
   if(!st.isFile()||st.isSymbolicLink()||st.nlink!==1||
      st.size<1||st.size>max)throw Error('FILE_UNVERIFIED');
   const bytes=io.readFileSync(file);
   if(!Buffer.isBuffer(bytes)||bytes.length!==st.size)
    throw Error('BYTES_UNVERIFIED');
   return JSON.parse(bytes.toString('utf8'));
  };
  const status=read(path.join(maintenanceHome,'RECEIVER_STATUS.json'),262144);
  const owner=read(path.join(maintenanceHome,'leases/receiver/owner.json'),4096);
  const dir=path.join(maintenanceHome,'requests');
  const st=io.lstatSync(dir);
  if(!st.isDirectory()||st.isSymbolicLink())
   return unknown('S6_INTAKE_RECEIVER_LEDGER_DIR_UNVERIFIED');
  const hash=createHash('sha256').update(S6_ACTIVE_INTAKE_REQUEST).digest('hex');
  const fp=path.join(dir,hash+'.json');
  let ledger=null,ledgerPresent=false;
  try{ledger=read(fp,65536);ledgerPresent=true;}
  catch(error){if(error?.code!=='ENOENT')
   return unknown('S6_INTAKE_RECEIVER_LEDGER_READ_UNVERIFIED');}
  return projectS6ActiveReceiverIntakeReadonly({
   receiver:status,owner,ownerAlive:isAlive(owner.pid),
   ledger,ledgerPresent
  },now);
 }catch{return unknown('S6_INTAKE_RECEIVER_FILE_READ_UNVERIFIED');}
}

/**
 * A-only bounded PRE_DRAIN input observation. Reuses precisely the maintainer
 * filter and pc-job state counters without importing the B coordinator.
 * Current counts are not historical evidence or permission to retry a B.
 */
const S6_PRE_DRAIN_STATUSES=Object.freeze(['in_progress','queued','waiting']);
export function projectS6PreDrainInputsReadonly({relatedLeaseCount=null,workflowCounts=null}={},now=Date.now()){
 const valid=n=>Number.isSafeInteger(n)&&n>=0&&n<=100000;
 const leaseOk=valid(relatedLeaseCount)&&relatedLeaseCount<=10000;
 const counts=workflowCounts&&typeof workflowCounts==='object'&&!Array.isArray(workflowCounts)
  ?workflowCounts:{};
 const observedCounts=Object.fromEntries(S6_PRE_DRAIN_STATUSES.map(k=>[
  k,valid(counts[k])?counts[k]:null
 ]));
 const workflowOk=S6_PRE_DRAIN_STATUSES.every(k=>observedCounts[k]!==null);
 const count=workflowOk?S6_PRE_DRAIN_STATUSES.reduce((sum,k)=>sum+observedCounts[k],0):null;
 const known=leaseOk&&workflowOk&&Number.isFinite(now);
 const status=known?'PASS':'STATE_UNKNOWN';
 return {schema:'ZGMINI_S6_PRE_DRAIN_INPUTS_A_V1',status,
  code:known?'S6_PRE_DRAIN_INPUTS_OBSERVED_ONLY':
   !leaseOk?'S6_PRE_DRAIN_LEASE_COUNT_UNVERIFIED':
   'S6_PRE_DRAIN_WORKFLOW_COUNT_UNVERIFIED',
  observedAtUtc:Number.isFinite(now)?new Date(now).toISOString():null,
  relatedLeaseCount:leaseOk?relatedLeaseCount:null,
  relatedLeasesAbsent:leaseOk?relatedLeaseCount===0:null,
  workflowCounts:observedCounts,pendingWorkCount:count,
  inputClearAtObservation:known?relatedLeaseCount===0&&count===0:null,
  independentlyAttested:false,historicalBlockerIdentified:false,
  bAuthorization:false,replayAuthorized:false,failoverTested:false,
  operationalWrites:0,providerCalls:0,d1Writes:0};
}
export function inspectS6PreDrainInputsReadonly({
 filesystem=fs,run=spawnSync,env=process.env,now=Date.now(),
 leaseRoot='E:/ZGmini/automation/pc-control/leases'
}={}){
 let relatedLeaseCount=null,workflowCounts={};
 // Exactly the same lease names are excluded in the independent S6 B port.
 try{
  const stat=filesystem.lstatSync(leaseRoot);
  if(stat.isDirectory()&&!stat.isSymbolicLink()){
   const names=filesystem.readdirSync(leaseRoot);
   if(Array.isArray(names)&&names.length<=10000&&
     names.every(name=>typeof name==='string'&&name.length>=1&&name.length<=255))
    relatedLeaseCount=names.filter(x=>x!=='supervisor'&&
     !x.startsWith('supervisor.dead-')).length;
  }
 }catch{/* unknown is not zero; keep the other observation independent */}
 const token=env?.GITHUB_TOKEN;
 if(typeof token==='string'&&token.length>=8){
  // Only three literal read-only GitHub API GETs. Never accept a URL,
  // filename or runner command from an Issue and never expose stdout.
  for(const state of S6_PRE_DRAIN_STATUSES){
   const endpoint='repos/ansqhd5774-Choi/zgmini-pc-control/actions/workflows/'+
    'pc-job.yml/runs?status='+state+'&per_page=1';
   try{
    const result=run('C:/Program Files/GitHub CLI/gh.exe',
     ['api','-X','GET',endpoint],{encoding:'utf8',windowsHide:true,
      timeout:12000,maxBuffer:65536,env:{...env,GH_TOKEN:token}});
    if(result?.status!==0||result?.error||typeof result.stdout!=='string'||
      result.stdout.length<2||result.stdout.length>65536)continue;
    const data=JSON.parse(result.stdout);
    if(Number.isSafeInteger(data?.total_count)&&data.total_count>=0&&
       data.total_count<=100000&&Array.isArray(data.workflow_runs)&&
       data.workflow_runs.length<=1)workflowCounts[state]=data.total_count;
   }catch{/* workflow count is unknown on auth/host errors, never fabricate 0 */}
  }
 }
 return projectS6PreDrainInputsReadonly({relatedLeaseCount,workflowCounts},now);
}

export function collect(role,ctx,env=process.env){
 const host=os.hostname().toUpperCase();
 const runnerName=String(env.RUNNER_NAME||'');
 const identity=validateSeat(role,host,runnerName,env.COMPUTERNAME);
 const base={schema:'ZGMINI_PC_PROCESS_INVENTORY_RESULT_V1',role,
  requestId:ctx.requestId,issueNumber:ctx.issueNumber,runId:ctx.runId,
  attempt:ctx.attempt,observedAtUtc:new Date().toISOString(),
  host,runnerName,
  runnerLabel:role==='operating'?'zgmini-pc-control':'zgmini-handoff-ci-isolated',
  operationalWrites:0,providerCalls:0,d1Writes:0,automaticRetries:0,
  commandLinesCaptured:false,environmentValuesCaptured:false};
 if(identity!=='MATCH'||(role==='operating'&&host!=='PC')){
  return {...base,status:'BLOCKED',code:identity==='MATCH'?'HOST_NOT_CANONICAL':identity};
 }
 if(ctx.w06TaskCadence===true){
  const observed=inspectW06TaskCadenceReadonly();
  return {...base,status:observed.status,code:observed.code,w06TaskCadence:observed};
 }
 if(ctx.ciControllerBPolicyCas===true){
  const observed=inspectCiControllerBPolicyCasReadonly();
  return {...base,status:observed.status,code:observed.code,
   ciControllerBPolicyCas:observed};
 }
 if(ctx.ciControllerBActivation===true){
  const observed=inspectCiControllerBActivationReadonly({
   enabled:env.ZGMINI_CI_CONTROLLER_B_ENABLED,
   policy:env.ZGMINI_CI_CONTROLLER_B_POLICY});
  return {...base,status:observed.status,code:observed.code,
   ciControllerBActivation:observed};
 }
 if(ctx.ciControllerBReceiptRoot===true){
  const observed=inspectCiControllerBReceiptRootReadonly({
   root:env.ZGMINI_CI_CONTROLLER_B_RECEIPT_ROOT,
   volatileRoots:[env.RUNNER_TEMP,env.GITHUB_WORKSPACE,env.TEMP,env.TMP],
   filesystem:fs,platform:os.platform()});
  return {...base,status:observed.status,code:observed.code,
   ciControllerBReceiptRoot:observed,
   ciControllerBCOperatorPreflight:inspectReceiptCOperatorServiceReadonly(),
   ciControllerBCFixedPathPreflight:inspectReceiptCFixedPathsReadonly()};
 }
 if(ctx.watchdogR4GuardianOrigin===true){
  const proof=inspectR4GuardianOriginReadonly();
  return {...base,status:proof.status,code:proof.code,watchdogR4GuardianOrigin:proof};
 }
 if(ctx.s6ActiveIntake===true){
   const evidence=inspectS6ActiveReceiverIntakeReadonly();
   return {...base,status:evidence.status,code:evidence.code,s6ActiveIntake:evidence};
  }
  if(ctx.s6ReceiverLedger===true){
  const evidence=inspectS6ReceiverLedgerReadonly();
  return {...base,status:evidence.status,code:evidence.code,
   s6ReceiverLedger:evidence};
 }
 if(ctx.s6OnceJournal===true){
  const evidence=inspectS6OnceJournalReadonly();
  return {...base,status:evidence.status,code:evidence.code,
   s6OnceJournal:evidence};
 }
 if(ctx.s6PredrainInputs===true){
  const proof=inspectS6PreDrainInputsReadonly({env});
  return {...base,status:proof.status,code:proof.code,s6PredrainInputs:proof};
 }
 if(ctx.s6NextPreimage===true){
  const evidence=inspectS6ApprovalPreimageReadonly({sourceVersion:'CURRENT'});
  return {...base,status:evidence.status,code:evidence.code,
   s6NextPreimage:evidence};
 }
 if(ctx.s6ApprovalPreimage===true){
  const evidence=inspectS6ApprovalPreimageReadonly();
  return {...base,status:evidence.status,code:evidence.code,
   s6ApprovalPreimage:evidence};
 }
 if(ctx.watchdogR5Runtime===true){
  const proof=inspectR5StandbyRuntimeReadonly();
  return {...base,status:proof.status,code:proof.code,watchdogR5Runtime:proof};
 }
 if(ctx.watchdogR4Runtime===true){
  const proof=inspectR4StandbyRuntimeReadonly();
  return {...base,status:proof.status,code:proof.code,watchdogR4Runtime:proof};
 }
 if(ctx.standbyRunnerWmi===true){
  const proof=inspectR3RunnerWmiReadonly();
  return {...base,status:proof.status,code:proof.code,standbyRunnerWmi:proof};
 }
 if(ctx.watchdogR3Preimage===true){
  const proof=inspectR3WatchdogPreimageReadonly();
  return {...base,status:proof.status,code:proof.code,watchdogR3Preimage:proof};
 }
 if(ctx.cnnSidecarBCore===true){
  const observed=inspectSidecarBCoreReadinessReadonly();
  return {...base,status:observed.status,code:observed.code,
   cnnSidecarBCore:observed};
 }
 if(ctx.cnnSidecarBResources===true){
  const observed=inspectSidecarBResourceFlagsReadonly();
  return {...base,status:observed.status,code:observed.code,
   cnnSidecarBResources:observed};
 }
 if(ctx.cnnSidecarBPreimagePins===true){
  const observed=inspectSidecarBManifestPreimageReadonly();
  return {...base,status:observed.status,code:observed.code,
   cnnSidecarBPreimagePins:observed};
 }
 if(ctx.cnnSidecarGitPredicates===true){
  const observed=inspectCnnGitPredicatesReadonly(CNN_SIDECAR_DATA_ROOT);
  return {...base,status:observed.status,code:observed.code,
   cnnSidecarGitPredicates:observed};
 }
 if(ctx.cnnSidecarStaticGuard===true){
   const observed=projectCnnSidecarStaticGuard(
    inspectSidecarSourceGate(CNN_SIDECAR_DATA_ROOT));
   return {...base,status:observed.status,code:observed.code,
    cnnSidecarStaticGuard:observed};
  }
  if(ctx.c3160RecoveryCas===true){
  const result=inspect3160RecoveryCasReadonly();
  const preflight=inspect3160RollbackPreflightReadonly();
  return {...base,c3160LocalPreflight:preflight,status:result.status==='READ_ONLY_OBSERVED'?'PASS':'PARTIAL',
   code:result.status==='READ_ONLY_OBSERVED'?'C3160_CAS_CAPTURED':'C3160_CAS_UNVERIFIED',
   c3160RecoveryCas:result,maintenance:collectMaintenanceStatusReadonly()};
 }
 if(ctx.w052960MaintenanceStatus===true)
  return compact2960ProcessResult(base,inspect2960MaintenanceStatusReadonly());
 if(ctx.w043409MaintenanceStatus===true)
  return compact3409ProcessResult(base,inspect3409MaintenanceStatusReadonly());
 if(ctx.w043587PostcheckLink===true){
  const observed=inspectEr1PostcheckLinkReadonly();
  return {...base,status:observed.status,code:observed.code,er1PostcheckLink:observed};
 }
 if(ctx.w043516MaintenanceStatus===true)
  return compact3516ProcessResult(base,inspect3516MaintenanceStatusReadonly());
 if(ctx.d05WriterCheckpoint===true)
  return compactD05WriterResult(base,inspectD05WriterCheckpointReadonly());
 if(ctx.d05PrivateFinalReceipt===true){
  const receipt=inspectD05PrivateFinalReceiptReadonly();
  return {...base,status:receipt.status,code:receipt.code,d05PrivateFinalReceipt:receipt};
 }
 if(ctx.d05ThemeFinalOutputs===true)
  return inspectD05PaidThemeFinalOutputsReadonly().then(result=>({...base,
   status:result.status,code:result.code,d05ThemeFinalOutputs:result}));
 if(ctx.d05ConfiguredRegistrations===true){
  const result=inspectD05ConfiguredRegistrationReadonly();
  return {...base,status:result.status,code:result.code,
   d05ConfiguredRegistrations:result};
 }
 const withMaintenance=role==='operating'?{...base,
  maintenance:collectMaintenanceStatusReadonly(),
  ciControllerBReceiver:inspectCiControllerBReceiverReadOnly(),
  ...(ctx.w052960MaintenanceStatus?{
   w052960MaintenanceStatus:inspect2960MaintenanceStatusReadonly()}:{}),
  c2505RecoveryCheckpoint:inspect2505RecoveryReadonly(),
  c2505ByteProof:inspect2505RecoveryByteProof(),
  c2094StageEvidence:inspect2094StageReadonly(),
  c996LeaseCorrelation:inspect996LeaseCorrelation(),
  c1501LeaseCorrelation:inspect1501LeaseCorrelation(),
   c1841RecoveryCheckpoint:inspect1841LeaseCorrelation(),
  w052821RecoveryCas:inspectW052821RecoveryCasReadonly(),
  observedHttpHostRoster:readObservedProviderHosts(),
  marketParquetTaskSource:inspectMarketParquetTask(),
  w03PaidPrivate:inspectW03PaidPrivateReadonly(),
  http32TwoHostCheckpoints:inspectHttp32TwoHostCheckpoints(),
  c1501Backlog:inspect1501BacklogReadonly(),
  targetEndpointStatus:readTargetEndpointStatus(),
  ...(Array.isArray(ctx.runnerJobRefs)?
   {runnerJobHistory:inspectRunnerJobHistory(ctx.runnerJobRefs)}:{})}:base;
 const ps=path.win32.join(env.SystemRoot||'C:\\Windows',
  'System32\\WindowsPowerShell\\v1.0\\powershell.exe');
 if(os.platform()!=='win32'||!fs.existsSync(ps))
  return {...withMaintenance,status:'PARTIAL',code:'POWERSHELL_NOT_AVAILABLE'};
 const encoded=Buffer.from(PS_SCRIPT,'utf16le').toString('base64');
 const proc=spawnSync(ps,['-NoLogo','-NoProfile','-NonInteractive',
  '-EncodedCommand',encoded],{encoding:'utf8',windowsHide:true,timeout:45000,
  maxBuffer:MAX_BYTES,shell:false,env:{...env}});
 if(proc.error||proc.status!==0)
   return {...withMaintenance,status:'PARTIAL',code:proc.error?.code==='ETIMEDOUT'?
    'PROCESS_PROBE_TIMEOUT':'PROCESS_PROBE_UNAVAILABLE'};
 try{
  const parsed=JSON.parse(proc.stdout.replace(/^\uFEFF/,'').trim());
  const snapshot=sanitizeProbe(parsed);
  const w05OwnerPidChronology=role==='operating'?
   classifyW052821OwnerPidChronology(withMaintenance.w052821RecoveryCas,
    parsed.w05PidEvidence):null;
  return {...withMaintenance,
   ...(role==='operating'?{w05OwnerPidChronology}:{}),
   status:'PASS',code:'PROCESS_INVENTORY_COLLECTED',snapshot};
 }catch{return {...withMaintenance,status:'PARTIAL',code:'PROCESS_REPORT_INVALID'};}
}
// Preserve the complete approved evidence schema while staying inside the
// existing atomic result-pair 32 KiB limit. Never drop verification fields.
export function serializeProcessResult(result){return JSON.stringify(result)+'\n';}
export function toText(r){
 return ['schema='+r.schema,'requestId='+r.requestId,'role='+r.role,
  'runId='+r.runId,'attempt='+r.attempt,'host='+r.host,
  'runner='+r.runnerName,'status='+r.status,'code='+r.code,
  'observedAtUtc='+r.observedAtUtc,
  'totalProcessCount='+(r.snapshot?.totalProcessCount??'UNKNOWN'),
  'selectedProcessCount='+(r.snapshot?.selectedProcessCount??'UNKNOWN'),
  'memoryGroupCoverage='+(r.snapshot?.memoryGroupCoverage??'UNAVAILABLE'),
  'otherSubgroupCoverage='+(r.snapshot?.otherSubgroupCoverage??'UNAVAILABLE'),
  'maintenanceStatus='+(r.maintenance?.status??'NOT_APPLICABLE'),
  ...(r.s6PredrainInputs?[
   's6PredrainLeaseCount='+(r.s6PredrainInputs.relatedLeaseCount??'UNKNOWN'),
   's6PredrainPendingWorkCount='+(r.s6PredrainInputs.pendingWorkCount??'UNKNOWN'),
   's6PredrainInProgress='+(r.s6PredrainInputs.workflowCounts.in_progress??'UNKNOWN'),
   's6PredrainQueued='+(r.s6PredrainInputs.workflowCounts.queued??'UNKNOWN'),
   's6PredrainWaiting='+(r.s6PredrainInputs.workflowCounts.waiting??'UNKNOWN'),
   's6PredrainClear='+(r.s6PredrainInputs.inputClearAtObservation??'UNKNOWN')]:[]),
  ...(r.w043516MaintenanceStatus?[
   'w043516Status='+r.w043516MaintenanceStatus.status,
   'w043516HistoricalPhase='+(r.w043516MaintenanceStatus.historicalRequest?.phase??'UNKNOWN'),
   'w043516LeaseHeld='+(r.w043516MaintenanceStatus.recoveryEvidence?.leaseHeld??'UNKNOWN'),
   'w043516RecoveryRequired='+(r.w043516MaintenanceStatus.recoveryEvidence?.recoveryRequired??'UNKNOWN'),
   'w043516Protection='+(r.w043516MaintenanceStatus.protectedDifferenceClass??'UNVERIFIED'),
   'w043516LeaseCorrelation='+(r.w043516MaintenanceStatus.recoveryCas?.status??'UNVERIFIED'),
   'w043516RecoveryArchive='+(r.w043516MaintenanceStatus.recoveryArchive?.status??'UNVERIFIED'),
   'w043516ArchiveRecord='+(r.w043516MaintenanceStatus.recoveryArchive?.archiveRecordVerified??'UNVERIFIED')]:[]),
  ...(r.er1PostcheckLink?[
   'er1PostcheckLink='+r.er1PostcheckLink.code,
   'er1ReportedRunJobLinked='+(r.er1PostcheckLink.reportedRunJobLinked??'UNVERIFIED'),
   'er1ExactRunJobMatched='+r.er1PostcheckLink.exactRunJobMatched]:[]),
  ...(r.w043409MaintenanceStatus?[
   'w043409Status='+r.w043409MaintenanceStatus.status,
   'w043409HistoricalPhase='+(r.w043409MaintenanceStatus.historicalRequest?.phase??'UNKNOWN'),
   'w043409LeaseHeld='+(r.w043409MaintenanceStatus.recoveryEvidence?.leaseHeld??'UNKNOWN'),
   'w043409RecoveryRequired='+(r.w043409MaintenanceStatus.recoveryEvidence?.recoveryRequired??'UNKNOWN'),
   'w043409Protection='+(r.w043409MaintenanceStatus.protectedDifferenceClass??'UNVERIFIED'),
   'w043409LeaseCorrelation='+(r.w043409MaintenanceStatus.recoveryCas?.status??'UNVERIFIED'),
   'w043409PauseWindows='+(r.w043409MaintenanceStatus.recoveryCas?.pauseWindows?.length??'UNVERIFIED')]:[]),
  'c2505Recovery='+(r.c2505RecoveryCheckpoint?.status??'NOT_APPLICABLE'),
  'c2505RecoveryCode='+(r.c2505RecoveryCheckpoint?.code??'NOT_APPLICABLE'),
  'c2505ByteProof='+(r.c2505ByteProof?.status??'NOT_APPLICABLE'),
  'marketParquetTaskStatus='+(r.marketParquetTaskSource?.status??'NOT_APPLICABLE'),
  'w03PaidPrivateStatus='+(r.w03PaidPrivate?.status??'NOT_APPLICABLE'),
  'w03PaidPrivateCode='+(r.w03PaidPrivate?.code??'NOT_APPLICABLE'),
  'w03PaidPrivatePoints='+(r.w03PaidPrivate?.historyPoints??'UNKNOWN'),
  ...(r.d05ThemeFinalOutputs?[
   'd05ThemeFinalOutputs='+r.d05ThemeFinalOutputs.code,
   'd05ThemeCount='+(r.d05ThemeFinalOutputs.distinctThemeCount??'UNKNOWN'),
   'd05DailyPoints='+(r.d05ThemeFinalOutputs.dailyFinalScorePoints??'UNKNOWN'),
   'd05LatestCalculatedAt='+(r.d05ThemeFinalOutputs.latestCalculatedAt??'UNKNOWN'),
   'd05CurrentReceiptMatched='+(r.d05ThemeFinalOutputs.currentReceiptMatched??'UNKNOWN'),
   'd05ArchiveScanComplete='+(r.d05ThemeFinalOutputs.archiveScanComplete??'UNKNOWN')]:[]),
  ...(r.d05PrivateFinalReceipt?[
   'd05PrivateReceipt='+r.d05PrivateFinalReceipt.code,
   'd05PrivateCalculatedAt='+(r.d05PrivateFinalReceipt.calculatedAt??'UNKNOWN'),
   'd05PrivateScoreCount='+(r.d05PrivateFinalReceipt.scoreCount??'UNKNOWN'),
   'd05PrivateReceiptSha='+(r.d05PrivateFinalReceipt.finalEventBodySha256??'UNKNOWN'),
   'd05PrivateReceiptMatched='+r.d05PrivateFinalReceipt.receiptMatched]:[]),
  ...(r.d05ConfiguredRegistrations?[
   'd05ConfiguredRegistry='+r.d05ConfiguredRegistrations.code,
   'd05ConfiguredDefinitionCount='+(r.d05ConfiguredRegistrations.registeredDefinitionCount??'UNKNOWN'),
   'd05ConfiguredInventoryHash='+(r.d05ConfiguredRegistrations.registryManifestSha256??'UNKNOWN')]:[]),
  ...(r.cnnSidecarGitPredicates?[
    'cnnSidecarGitPredicates='+r.cnnSidecarGitPredicates.code,
    'cnnHeadMatchesConfig='+r.cnnSidecarGitPredicates.gitHeadMatchesConfig,
    'cnnTrackedTreeClean='+r.cnnSidecarGitPredicates.trackedTreeClean,
    'cnnFailurePredicateResolved=false']:[]),
  ...(r.cnnSidecarStaticGuard?[
    'cnnSidecarStaticGuard='+r.cnnSidecarStaticGuard.code,
    'cnnSourceGuardCandidates='+r.cnnSidecarStaticGuard.sourceGuardCandidates.length,
    'cnnSidecarFailureResolved=false']:[]),
   ...(r.c3160RecoveryCas?[
   'c3160RecoveryCas='+r.c3160RecoveryCas.code,
   'c3160BacklogOpen='+(r.c3160RecoveryCas.backlog?.openWindows??'UNKNOWN')]:[]),
  ...(r.c3160LocalPreflight?[
   'c3160LocalApproval='+r.c3160LocalPreflight.localApproval,
   'c3160RecoveryClaim='+r.c3160LocalPreflight.recoveryClaim]:[]),
  ...(r.standbyRunnerWmi?[
   'standbyRunnerWmi='+r.standbyRunnerWmi.code,
   'wmiControllerListenerCount='+(r.standbyRunnerWmi.controllerListenerCount??'UNKNOWN'),
   'wmiControllerWorkerCount='+(r.standbyRunnerWmi.controllerWorkerCount??'UNKNOWN'),
   'wmiUnknownPathCount='+(r.standbyRunnerWmi.unknownPathCount??'UNKNOWN'),
   'wmiUnknownListenerCount='+(r.standbyRunnerWmi.unknownListenerCount??'UNKNOWN'),
   'wmiUnknownWorkerCount='+(r.standbyRunnerWmi.unknownWorkerCount??'UNKNOWN'),
   'wmiMissingPathCount='+(r.standbyRunnerWmi.missingWmiPathCount??'UNKNOWN'),
   'wmiNonAbsolutePathCount='+(r.standbyRunnerWmi.nonAbsoluteWmiPathCount??'UNKNOWN'),
   'wmiCanonicalizationFailedCount='+(r.standbyRunnerWmi.canonicalizationFailedCount??'UNKNOWN'),
   'wmiUnknownSession0Count='+(r.standbyRunnerWmi.unknownSession0Count??'UNKNOWN'),
   'wmiUnknownServiceAncestorCount='+(r.standbyRunnerWmi.unknownServiceAncestorCount??'UNKNOWN'),
   'wmiUnknownSession0ServiceAncestorCount='+(r.standbyRunnerWmi.unknownSession0ServiceAncestorCount??'UNKNOWN'),
   'wmiServiceObservationUnavailableCount='+(r.standbyRunnerWmi.serviceObservationUnavailableCount??'UNKNOWN'),
   'standbyPromotionApproved=false']:[]),
  ...(r.watchdogR4GuardianOrigin?[
   'watchdogR4GuardianOrigin='+r.watchdogR4GuardianOrigin.code,
   'guardianProbePassed='+r.watchdogR4GuardianOrigin.guardianProbePassed,
   'guardianOriginMismatchCodes='+r.watchdogR4GuardianOrigin.originMismatches.join(','),
   'guardianActivationExecuted=false']:[]),
  ...(r.s6OnceJournal?[
   's6OnceJournal='+r.s6OnceJournal.code,
   's6ClaimPresent='+r.s6OnceJournal.claimPresent,
   's6JournalPhase='+(r.s6OnceJournal.journalPhase??'UNVERIFIED'),
   's6BacklogState='+r.s6OnceJournal.backlogState,
   's6SuccessEstablished=false']:[]),
  ...(r.s6ApprovalPreimage?[
   's6ApprovalPreimage='+r.s6ApprovalPreimage.code,
   's6ApprovalCandidateOnly='+r.s6ApprovalPreimage.status,
   's6IndependentAttested=false','s6BEffectAuthorized=false']:[]),
  ...(r.watchdogR5Runtime?[
   'watchdogR5Runtime='+r.watchdogR5Runtime.code,
   'watchdogR5InstalledMatch='+r.watchdogR5Runtime.installedMatch,
   'watchdogR5NaturalRestart='+r.watchdogR5Runtime.naturalRestartObserved,
   'watchdogR5StatusFresh='+r.watchdogR5Runtime.statusFresh,
   'watchdogR5StandbyReadyCount='+r.watchdogR5Runtime.standbyReadyCount,
   'watchdogR5FailoverTested=false']:[]),
  ...(r.watchdogR4Runtime?[
   'watchdogR4Runtime='+r.watchdogR4Runtime.code,
   'watchdogR4InstalledMatch='+r.watchdogR4Runtime.installedMatch,
   'watchdogR4NaturalRestart='+r.watchdogR4Runtime.naturalRestartObserved,
   'watchdogR4StatusFresh='+r.watchdogR4Runtime.statusFresh,
   'watchdogR4StandbyIpcReady='+r.watchdogR4Runtime.standbyIpcReady,
   'watchdogR4FailoverTested=false']:[]),
  ...(r.watchdogR3Preimage?[
   'watchdogR3Preimage='+r.watchdogR3Preimage.code,
   'watchdogSourceSha256='+(r.watchdogR3Preimage.sourceSha256??'UNKNOWN'),
   'watchdogManifestSha256='+(r.watchdogR3Preimage.manifestSha256??'UNKNOWN'),
   'watchdogSourceMatchesManifest='+r.watchdogR3Preimage.installedMatch
  ]:[]),
  ...(r.ciControllerBActivation?[
   'ciControllerBActivation='+r.ciControllerBActivation.code,
   'ciPublisherDisabled='+r.ciControllerBActivation.variableEnabledVerified,
   'ciBusinessPolicyConfigured='+r.ciControllerBActivation.policyConfigured,
   'ciBusinessPolicyFormatObserved='+r.ciControllerBActivation.policyShapeVerified,
   'ciActivationAuthorized=false']:[]),
  ...(r.ciControllerBReceiptRoot?[
   'ciReceiptRoot='+r.ciControllerBReceiptRoot.code,
   'ciReceiptRootConfigured='+r.ciControllerBReceiptRoot.configured,
   'ciReceiptRootReadable='+r.ciControllerBReceiptRoot.readable,
   'ciReceiptRootDurableAcrossRunsVerified=false']:[]),
  ...(r.ciControllerBCOperatorPreflight?[
   'ciReceiptCOperator='+r.ciControllerBCOperatorPreflight.code,
   'ciReceiptCAccountCandidate='+r.ciControllerBCOperatorPreflight.cAccountCandidate
  ]:[]),
  ...(r.ciControllerBCFixedPathPreflight?[
   'ciReceiptCFixedPath='+r.ciControllerBCFixedPathPreflight.code,
   'ciReceiptCParent='+r.ciControllerBCFixedPathPreflight.parent,
   'ciReceiptCRoot='+r.ciControllerBCFixedPathPreflight.receiptRoot,
   'ciReceiptCFixedTargetVacantObserved='+r.ciControllerBCFixedPathPreflight.fixedTargetVacantObserved
  ]:[]),
  'maintenanceSourceSha='+(r.maintenance?.maintenanceSourceSha??'UNKNOWN'),
  'installLockHeld='+(r.maintenance?.installLockHeld??'UNKNOWN'),
  'c2094StageEvidence='+(r.c2094StageEvidence?.status??'NOT_APPLICABLE'),
  'c2094StageCode='+(r.c2094StageEvidence?.code??'NOT_APPLICABLE'),
  'c996LeaseCorrelation='+(r.c996LeaseCorrelation?.status??'NOT_APPLICABLE'),
  'c996LeaseCorrelationCode='+(r.c996LeaseCorrelation?.code??'NOT_APPLICABLE'),
   'c1841RecoveryCheckpoint='+(r.c1841RecoveryCheckpoint?.status??'NOT_APPLICABLE'),
  'w05OwnerPidChronology='+(r.w05OwnerPidChronology?.code??'NOT_APPLICABLE'),
  ...(r.runnerJobHistory?.length?[
   'runnerJobHistoryCases='+r.runnerJobHistory.length,
   ...r.runnerJobHistory.map(j=>'runnerJob.'+j.runId+'='+
    j.classification+':exactReferences='+j.exactReferences)
  ]:[]),
  'operationalWrites=0','automaticRetries=0',''].join('\r\n');
}
async function main(){
 const env=process.env,role=process.argv[2];
 const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
 const ctx=authenticateProcess(event,env,role);
 const targeted=ctx.w05OperatorTopology===true;
 const result=await (targeted?collectW05OperatorTopology(ctx,env):collect(role,ctx,env));
 const stem=targeted?'results/w05-operator-topology-'+ctx.runId+'-'+ctx.attempt+'-'+role:
  'results/pc-process-inventory-'+ctx.runId+'-'+ctx.attempt+'-'+role;
 const outputs=[[stem+'.json',serializeProcessResult(result)],
  [stem+'.txt',targeted?w05OperatorTopologyText(result):toText(result)]];
 const headers={authorization:'Bearer '+env.GITHUB_TOKEN,accept:'application/vnd.github+json',
  'X-GitHub-Api-Version':'2022-11-28','content-type':'application/json'};
 let uploaded;
 try{
  uploaded=await uploadResultPairAtomic({outputs,headers,
   message:'results(ops): fixed process snapshot '+role+' '+ctx.runId});
 }catch(error){
  // Sanitized transport diagnosis only; the result pair is not declared
  // uploaded, and the original fail-closed behavior is preserved.
  if(error?.message==='CONFIG_B_PAIR_REMOTE_STOP'){
   console.error('PROCESS_RESULT_PAIR_REMOTE_STOP stage='+
    (typeof error.remoteStage==='string'&&/^(GET|POST)_[A-Z_]{2,40}$/.test(error.remoteStage)?
     error.remoteStage:'UNKNOWN')+' httpStatus='+
    (Number.isInteger(error.remoteStatus)?error.remoteStatus:'UNKNOWN'));
  }
  throw error;
 }
 if(uploaded.delivery!=='RESULT_PAIR_READBACK_VERIFIED')fail(uploaded.delivery);
 const ack=await fetch('https://api.github.com/repos/'+REPO+'/issues/'+ctx.issueNumber+'/comments',
  {method:'POST',headers,body:JSON.stringify({body:
   '<!-- zgmini-pc-process:'+ctx.runId+':'+role+' -->\n'+(targeted?'W05 operator topology ':'Process inventory ')+
    role+': '+result.status+' / '+result.code+'; exact result pair '+stem+
    '.json and '+stem+'.txt verified; operationalWrites=0; retries=0.'})});
 if(!ack.ok)fail('COMMENT_NOT_VERIFIED');
 console.log((targeted?'W05_OPERATOR_TOPOLOGY_VERIFIED':'PROCESS_INVENTORY_VERIFIED')+
  ' role='+role+' status='+result.status+' code='+result.code);
 if(result.status!=='PASS')process.exitCode=2;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();

// Trusted read-only operating PC probe for the exact CNN Sidecar file.
// Never disables tasks, kills processes or reads SQLite/credentials.
// Any unavailable observation fails closed before the one-shot claim.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {sha256,TARGET,PREIMAGE} from './contract.mjs';
import {decodeTaskXmlBytes,coreReadyForMaintenance}
 from '../writer-b/windows-guards.mjs';
import {maintenanceLockStatus} from '../tools/maintenance-lock.mjs';

const DATA=String.raw`E:\ZGmini\data`;
const WRITER=path.win32.join(DATA,'pc-writer');
const SOURCE=String.raw`E:\ZGmini\projects\zgmini-earnings-history-pc-release`;
const WRAPPER=path.win32.join(WRITER,'archive-sidecar-r7','run-original-then-archive.vbs');
const TASK='ZGMINI-PC-Local-Core';
const CORE_LOCK=path.win32.join(WRITER,'local-cycle.lock');
const SHARED_LOCK=path.win32.join(WRITER,'writer-source-install.lock');
const STOP=code=>{throw Object.assign(Error(code),{code});};
const need=(ok,code)=>{if(!ok)STOP(code);};
const SHA40=/^[0-9a-f]{40}$/;
function exec(file,args,encoding=null){
 need(fs.existsSync(file),'SIDECAR_B_PROBE_EXECUTABLE_STOP');
 const out=spawnSync(file,args,{encoding,shell:false,windowsHide:true,
  timeout:15000,maxBuffer:131072,
  env:{...process.env,GIT_TERMINAL_PROMPT:'0',GIT_OPTIONAL_LOCKS:'0'}});
 need(out.status===0&&!out.error,'SIDECAR_B_PROBE_COMMAND_STOP');
 return out.stdout;
}
function fileBytes(file,root,max){
 const st=fs.lstatSync(file);
 need(st.isFile()&&!st.isSymbolicLink()&&st.size>0&&st.size<=max,
  'SIDECAR_B_PROBE_REGULAR_STOP');
 const base=fs.realpathSync.native(root);
 const full=fs.realpathSync.native(file);
 const relative=path.win32.relative(base,full);
 need(relative&&relative!=='..'&&
  !relative.startsWith('..'+path.win32.sep)&&
  !path.win32.isAbsolute(relative),'SIDECAR_B_PROBE_REDIRECT_STOP');
 return fs.readFileSync(file);
}
function git(root,args){
 const exe=[
  String.raw`C:\Program Files\Git\cmd\git.exe`,
  String.raw`C:\Program Files\Git\bin\git.exe`
 ].find(x=>fs.existsSync(x));
 need(!!exe,'SIDECAR_B_PROBE_GIT_STOP');
 return exec(exe,['--no-optional-locks','-C',root,...args],'utf8').trim();
}
function observedHead(){
 const root=fs.realpathSync.native(SOURCE);
 const sourceStat=fs.lstatSync(SOURCE);
 need(sourceStat.isDirectory()&&!sourceStat.isSymbolicLink(),
  'SIDECAR_B_PROBE_SOURCE_ROOT_STOP');
 const head=git(root,['rev-parse','--verify','HEAD']);
 need(SHA40.test(head),'SIDECAR_B_PROBE_SOURCE_HEAD_STOP');
 need(git(root,['status','--porcelain','--untracked-files=all'])==='',
  'SIDECAR_B_PROBE_SOURCE_DIRTY_STOP');
 return head;
}
function configSource(){
 const cfg=JSON.parse(fileBytes(path.win32.join(WRITER,'config.json'),WRITER,131072));
 const value=[cfg?.source?.sha,cfg?.source?.commit,cfg?.source?.commitSha,
  cfg?.source,cfg?.sourceSha].find(x=>typeof x==='string'&&SHA40.test(x));
 need(!!value,'SIDECAR_B_PROBE_CONFIG_STOP');
 return value;
}
function taskXML(){
 const exe=path.win32.join(process.env.SystemRoot??String.raw`C:\Windows`,
  'System32','schtasks.exe');
 const bytes=exec(exe,['/Query','/TN',TASK,'/XML']);
 decodeTaskXmlBytes(bytes);
 return sha256(bytes);
}
function taskQuiet(){
 const exe=path.win32.join(process.env.SystemRoot??String.raw`C:\Windows`,
  'System32','cscript.exe');
 // Reuse the established, fixed JScript COM process/Task inventory.
 const script=path.win32.resolve(path.win32.dirname(
  new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1')),
  '..','r17-writer-b','r17-b-windows-probe.js');
 const raw=exec(exe,['//NoLogo',script],'utf8');
 let task;try{task=JSON.parse(raw.trim());}catch{
  STOP('SIDECAR_B_PROBE_TASK_JSON_STOP');
 }
 need(task?.ok===true,'SIDECAR_B_PROBE_TASK_STOP');
 return coreReadyForMaintenance(task,fs.existsSync(CORE_LOCK));
}
function sidecarActive(){
 // PowerShell WMI returns only a numeric count, never a command line.
 const exe=path.win32.join(process.env.SystemRoot??String.raw`C:\Windows`,
  'System32','WindowsPowerShell','v1.0','powershell.exe');
 const script=String.raw`$ErrorActionPreference='Stop';`+
  String.raw`$all=@(Get-CimInstance Win32_Process -ErrorAction Stop | `+
  String.raw`Where-Object { $_.Name -in @('node.exe','wscript.exe','cscript.exe') }); `+
  String.raw`if(@($all | Where-Object { -not $_.CommandLine }).Count -gt 0) `+
  String.raw`{ Write-Output 'UNKNOWN'; exit 7 }; `+
  String.raw`$p=@($all | Where-Object `+
  String.raw`{ $_.CommandLine -match '(?i)archive-run\.mjs|run-original-then-archive\.vbs' }); `+
  String.raw`Write-Output $p.Count`;
 const raw=exec(exe,['-NoProfile','-NonInteractive','-Command',script],'utf8').trim();
 need(/^\d{1,5}$/.test(raw),'SIDECAR_B_PROBE_PROCESS_STOP');
 return Number(raw)>0;
}

// A pure projection for regression: unknown fields are NOT coalesced to ready.
export function classifyProtectedSidecarSnapshot(s,manifest,requestId){
 need(s&&manifest&&typeof requestId==='string',
  'SIDECAR_B_PROBE_SCOPE_STOP');
 need(s.head===manifest.installedHead&&
  s.configSource===manifest.installedConfigSource&&
  s.head===s.configSource&&
  s.taskDefinitionSha256===manifest.taskDefinitionSha256&&
  s.wrapperSha256===manifest.wrapperSha256&&
  s.targetSha256===manifest.beforeSha256&&
  s.clean===true&&s.sourceApproved===true,
  'SIDECAR_B_PROBE_LINEAGE_STOP');
 need(s.coreQuiet===true&&s.sidecarActive===false&&
  s.maintenanceBusy===false&&s.lockOwner===requestId,
  'SIDECAR_B_PROBE_RESOURCE_STOP');
 return {
  target:TARGET,regularFile:true,realPathMatches:true,
  beforeSha256:s.targetSha256,head:s.head,configSource:s.configSource,
  taskDefinitionSha256:s.taskDefinitionSha256,
  wrapperSha256:s.wrapperSha256,active:false,
  leaseOwned:true,sharedInstallLockOwned:true,sourceApproved:true
 };
}
export function createOperatingSidecarProbe({manifest,requestId,sourceApproved}){
 need(process.platform==='win32'&&sourceApproved===true,
  'SIDECAR_B_PROBE_APPROVAL_STOP');
 need(manifest&&typeof requestId==='string',
  'SIDECAR_B_PROBE_SCOPE_STOP');
 return ()=>classifyProtectedSidecarSnapshot({
  head:observedHead(),configSource:configSource(),
  taskDefinitionSha256:taskXML(),
  wrapperSha256:sha256(fileBytes(WRAPPER,WRITER,131072)),
  targetSha256:sha256(fileBytes(TARGET,WRITER,131072)),
  clean:true,sourceApproved,
  coreQuiet:taskQuiet(),sidecarActive:sidecarActive(),
  maintenanceBusy:maintenanceLockStatus(DATA,'controller-install').held,
  lockOwner:fs.readFileSync(SHARED_LOCK,'utf8')
 },manifest,requestId);
}


// Source-only preflight for an approved exact one-file B manifest. This does
// not claim a lease, pause a Task, run the Sidecar or authorize installation.
const SHA64=/^[0-9a-f]{64}$/;
export function projectSidecarBManifestPreimageReadonly(raw){
 const empty={schema:'ZGMINI_CNN_SIDECAR_B_PREIMAGE_PINS_V1',
  status:'STATE_UNKNOWN',code:'CNN_B_PREIMAGE_PINS_UNVERIFIED',
  head:null,configSource:null,taskDefinitionSha256:null,
  wrapperSha256:null,beforeSha256:null,
  operationalWrites:0,providerCalls:0,d1Writes:0};
 if(!raw||!SHA40.test(raw.head??'')||
    raw.head!==raw.configSource||
    !SHA64.test(raw.taskDefinitionSha256??'')||
    !SHA64.test(raw.wrapperSha256??'')||
    raw.targetSha256!==PREIMAGE)return empty;
 return {...empty,status:'PASS',code:'CNN_B_PREIMAGE_PINS_COLLECTED',
  head:raw.head,configSource:raw.configSource,
  taskDefinitionSha256:raw.taskDefinitionSha256,
  wrapperSha256:raw.wrapperSha256,beforeSha256:raw.targetSha256};
}
export function inspectSidecarBManifestPreimageReadonly(){
 if(process.platform!=='win32')return projectSidecarBManifestPreimageReadonly(null);
 try{
  const head=observedHead(),config=configSource();
  if(head!==config)return projectSidecarBManifestPreimageReadonly(null);
  return projectSidecarBManifestPreimageReadonly({
   head,configSource:config,
   taskDefinitionSha256:taskXML(),
   wrapperSha256:sha256(fileBytes(WRAPPER,WRITER,131072)),
   targetSha256:sha256(fileBytes(TARGET,WRITER,131072))
  });
 }catch{return projectSidecarBManifestPreimageReadonly(null);}
}


// Classify only the four present-tense Windows resource predicates of the
// approved one-file B probe. This does NOT claim/release locks, pause the
// scheduler, enumerate command lines into results, or reconstruct past states.
export function projectSidecarBResourceFlagsReadonly(raw) {
 const empty={schema:'ZGMINI_CNN_SIDECAR_B_RESOURCES_V1',
  status:'STATE_UNKNOWN',code:'CNN_B_RESOURCE_SNAPSHOT_UNVERIFIED',
  coreQuiet:null,sidecarActive:null,controllerInstallBusy:null,
  sharedWriterLockPresent:null,currentPreflightReadyIgnoringLease:null,
  priorRuntimeFailure:'NOT_OBSERVED_BY_THIS_PROBE',
  operationalWrites:0,providerCalls:0,d1Writes:0};
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return empty;
 const names=['coreQuiet','sidecarActive','controllerInstallBusy','sharedWriterLockPresent'];
 const flags=Object.fromEntries(names.map(n=>[n,typeof raw[n]==='boolean'?raw[n]:null]));
 const complete=names.every(n=>flags[n]!==null);
 const ready=complete?(flags.coreQuiet===true&&flags.sidecarActive===false&&
  flags.controllerInstallBusy===false&&flags.sharedWriterLockPresent===false):null;
 return {...empty,...flags,
  status:complete?'PASS':'STATE_UNKNOWN',
  code:complete?'CNN_B_RESOURCE_SNAPSHOT_COLLECTED':'CNN_B_RESOURCE_SNAPSHOT_PARTIAL',
  currentPreflightReadyIgnoringLease:ready};
}

export function inspectSidecarBResourceFlagsReadonly() {
 if(process.platform!=='win32')return projectSidecarBResourceFlagsReadonly(null);
 const observe=reader=>{
  try{const x=reader();return typeof x==='boolean'?x:null;}
  catch{return null;}
 };
 return projectSidecarBResourceFlagsReadonly({
  coreQuiet:observe(taskQuiet),
  sidecarActive:observe(sidecarActive),
  controllerInstallBusy:observe(()=>{
   const value=maintenanceLockStatus(DATA,'controller-install')?.held;
   return typeof value==='boolean'?value:null;
  }),
  sharedWriterLockPresent:observe(()=>fs.existsSync(SHARED_LOCK))
 });
}


// Deepen only the observed false Core-idle condition using the same fixed
// Windows Task COM probe as production B; no Task mutation or raw command lines.
export function projectSidecarBCoreReadinessReadonly(raw){
 const empty={schema:'ZGMINI_CNN_B_CORE_READINESS_V1',
  status:'STATE_UNKNOWN',code:'CNN_B_CORE_READINESS_UNVERIFIED',
  taskEnabled:null,taskState:null,taskInstanceCount:null,
  coreProcessCount:null,unknownCoreProcessLines:null,
  coreCycleLockPresent:null,coreQuiet:null,
  previousInstallCondition:'NOT_OBSERVED_BY_THIS_PROBE',
  operationalWrites:0,providerCalls:0,d1Writes:0};
 const count=x=>Number.isSafeInteger(x)&&x>=0&&x<=10000?x:null;
 if(!raw||raw.ok!==true)return empty;
 const taskState=count(raw.state),instances=count(raw.instances),
  processes=count(raw.relatedProcesses),unknown=count(raw.unknownProcessLines);
 if(typeof raw.enabled!=='boolean'||taskState===null||taskState>4||
  instances===null||processes===null||unknown===null||
  typeof raw.coreCycleLockPresent!=='boolean')return empty;
 const coreQuiet=coreReadyForMaintenance({
  enabled:raw.enabled,state:taskState,instances,relatedProcesses:processes,
  unknownProcessLines:unknown},raw.coreCycleLockPresent);
 return {...empty,status:'PASS',code:'CNN_B_CORE_READINESS_COLLECTED',
  taskEnabled:raw.enabled,taskState,taskInstanceCount:instances,
  coreProcessCount:processes,unknownCoreProcessLines:unknown,
  coreCycleLockPresent:raw.coreCycleLockPresent,coreQuiet};
}

export function inspectSidecarBCoreReadinessReadonly(){
 if(process.platform!=='win32')return projectSidecarBCoreReadinessReadonly(null);
 try{
  const exe=path.win32.join(process.env.SystemRoot??'C:\\Windows',
   'System32','cscript.exe');
  const script=path.win32.resolve(path.win32.dirname(
   new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1')),
   '..','r17-writer-b','r17-b-windows-probe.js');
  const result=JSON.parse(exec(exe,['//NoLogo',script],'utf8').trim());
  return projectSidecarBCoreReadinessReadonly({
   ...result,coreCycleLockPresent:fs.existsSync(CORE_LOCK)});
 }catch{return projectSidecarBCoreReadinessReadonly(null);}
}

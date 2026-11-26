// W06 fixed read-only Windows Task cadence/action evidence. No Task mutation,
// provider, SQLite, D1 or launch of any Task action. Never return raw actions.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {decodeTaskXmlBytes} from '../writer-b/windows-guards.mjs';
import {hasOnlyApprovedMinuteTrigger,hasOnlyApprovedSingleExec} from '../task-create-b/windows-adapter.mjs';

export const PROBE='w06-cnn-task-cadence-readonly';
const TASK_B='ZGMINI-PC-CNN-Minute';
const TASK_B_REQUEST='ce21eaa3-7768-4cb8-88d9-0911941d966c';
const TASK_B_HOME=String.raw`E:\ZGmini\data\pc-writer`;
const TASK_B_SOURCE=String.raw`E:\ZGmini\projects\zgmini-earnings-history-pc-release`;
const TASK_B_WRAPPER=path.win32.join(TASK_B_HOME,'run-local-cnn-minute.vbs');
const TASK_B_WRAPPER_SHA='73c8cf4381fd328182a9fad0a7cb5753cf9093e58524f0c9a04be4df7032d733';
const TASK_B_CORE_SHA='dd81987c7efa4b1e343af30329a580613bb920dec89c1aa7a436ef935f0bb028';
const hex=bytes=>createHash('sha256').update(bytes).digest('hex');
// Evaluate the effective scheduler privilege independently from XML.
// Task Scheduler may omit a default RunLevel when reserializing an XML Task.
export function classifyW06TaskRunLevel(xml,nativeValue){
 const raw=[...String(xml).matchAll(/<RunLevel>([^<]{1,64})<\/RunLevel>/gi)]
  .map(m=>m[1].trim());
 const xmlLevel=raw.length===0?'OMITTED':raw.length!==1?'AMBIGUOUS':
  raw[0]==='LeastPrivilege'?'LEAST_PRIVILEGE':
  raw[0]==='HighestAvailable'?'HIGHEST_AVAILABLE':'OTHER';
 const native=String(nativeValue??'').trim().toLowerCase();
 const effectiveLevel=['limited','leastprivilege','0'].includes(native)?'LIMITED':
  ['highest','highestavailable','1'].includes(native)?'HIGHEST':'UNVERIFIED';
 return {xmlLevel,effectiveLevel,
  nativeLeastPrivilege:effectiveLevel==='UNVERIFIED'?null:effectiveLevel==='LIMITED'};
}

// Fixed-shape diagnostics only; never return command/arguments, account IDs,
// XML, wrapper source, backup bytes, lock payload or provider credentials.
export function assessW06TaskBXmlReadonly(xml,coreXml,{systemRoot=String.raw`C:\Windows`}={}){
 const one=(src,tag)=>[...src.matchAll(new RegExp('<'+tag+'>([^<]+)<\\/'+tag+'>','gi'))]
  .map(x=>x[1].replaceAll('&quot;','"').replaceAll('&amp;','&'));
 const cmd=one(xml,'Command'),args=one(xml,'Arguments'),dirs=one(xml,'WorkingDirectory');
 const user=one(xml,'UserId'),coreUser=one(coreXml,'UserId');
 const expectedCmd=path.win32.join(systemRoot,'System32','wscript.exe');
 const samePath=(actual,expected)=>typeof actual==='string'&&
  path.win32.normalize(actual).toLowerCase()===path.win32.normalize(expected).toLowerCase();
 return {
  oneTimeTrigger:hasOnlyApprovedMinuteTrigger(xml),
  oneExecAction:hasOnlyApprovedSingleExec(xml),
  commandExact:cmd.length===1&&samePath(cmd[0],expectedCmd),
  argumentsExact:args.length===1&&args[0]==='"'+TASK_B_WRAPPER+'"',
  workingDirExact:dirs.length===1&&samePath(dirs[0],TASK_B_SOURCE),
  principalMatchesCore:user.length===1&&coreUser.length===1&&user[0]===coreUser[0],
  logonInteractiveToken:xml.includes('<LogonType>InteractiveToken</LogonType>'),
  runLevelLeastPrivilege:xml.includes('<RunLevel>LeastPrivilege</RunLevel>'),
  ignoreNew:xml.includes('<MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>'),
  limitPT30M:xml.includes('<ExecutionTimeLimit>PT30M</ExecutionTimeLimit>'),
  explicitSettingsEnabled:xml.match(/<Settings(?:\s[^>]*)?>[\s\S]*?<Enabled>(true|false)<\/Enabled>/i)?.[1]??'OMITTED'
 };
}
const recoveryFailure=code=>({
 status:'STATE_UNKNOWN',code,operation:'W06_TASK_B_FIXED_READ_ONLY_RECONCILIATION',
 taskPresent:true,taskMutation:0,providerCalls:0,sqliteWrites:0,d1Writes:0
});
function safeReadExact(file,max=131072,filesystem=fs){
 try{const stat=filesystem.lstatSync(file);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size<1||stat.size>max)return null;
  const bytes=filesystem.readFileSync(file);
  return Buffer.isBuffer(bytes)&&bytes.length===stat.size?bytes:null;
 }catch{return null;}
}
export function inspectW06TaskBRecoveryReadonly({
 systemRoot=process.env.SystemRoot||String.raw`C:\Windows`,
 filesystem=fs,run=spawnSync
}={}){
 const schtasks=path.win32.join(systemRoot,'System32','schtasks.exe');
 const query=name=>{
  const x=run(schtasks,['/Query','/TN',name,'/XML'],{
   shell:false,windowsHide:true,timeout:15000,maxBuffer:262144,encoding:null});
  if(x?.error||x?.status!==0||!Buffer.isBuffer(x?.stdout))
   throw Error('TASK_XML_QUERY_FAILED');
  return {bytes:x.stdout,xml:decodeTaskXmlBytes(x.stdout)};
 };
 try{
  if(!filesystem.existsSync(schtasks))return recoveryFailure('W06_B_NATIVE_TASK_QUERY_UNAVAILABLE');
  const task=query(TASK_B),core=query('ZGMINI-PC-Local-Core');
  const dir=path.win32.join(TASK_B_HOME,'task-create-b',TASK_B_REQUEST);
  const root=filesystem.lstatSync(dir);
  if(!root.isDirectory()||root.isSymbolicLink())
   return recoveryFailure('W06_B_JOURNAL_ROOT_UNSAFE');
  const backup=safeReadExact(path.win32.join(dir,'ZGMINI-PC-Local-Core.xml'),131072,filesystem);
  const launcher=safeReadExact(TASK_B_WRAPPER,8192,filesystem);
  const lock=safeReadExact(path.win32.join(TASK_B_HOME,'writer-source-install.lock'),256,filesystem);
  const journal=safeReadExact(path.win32.join(dir,'journal.jsonl'),65536,filesystem);
  // Fixed, read-only TaskScheduler CIM property; never mutate the Task.
  // No principal or execution arguments leave the operating PC.
  let nativeRunLevel=null;
  try{
   const powershell=path.win32.join(systemRoot,'System32',
    'WindowsPowerShell','v1.0','powershell.exe');
   if(filesystem.existsSync(powershell)){
    const ps="$ErrorActionPreference='Stop';"+
     "$t=@(Get-ScheduledTask -TaskName 'ZGMINI-PC-CNN-Minute' -ErrorAction Stop);"+
     "if($t.Count -ne 1 -or $t[0].TaskPath -ne '\\'){throw 'TASK_SCOPE_STOP'};"+
     "[Console]::Out.Write([string]$t[0].Principal.RunLevel)";
    const level=run(powershell,['-NoProfile','-NonInteractive','-Command',ps],{
     shell:false,windowsHide:true,timeout:15000,maxBuffer:1024,encoding:null});
    if(!level?.error&&level?.status===0&&Buffer.isBuffer(level.stdout))
     nativeRunLevel=level.stdout.toString('utf8');
   }
  }catch{/* Keep unverified: never infer a safe privilege from missing evidence. */}
  const runLevel=classifyW06TaskRunLevel(task.xml,nativeRunLevel);
  return {
   status:'PASS',code:'W06_B_DISABLED_TASK_RECOVERY_SHAPE_READ',
   operation:'W06_TASK_B_FIXED_READ_ONLY_RECONCILIATION',
   taskPresent:true,taskXmlSha256:hex(task.bytes),
   definition:assessW06TaskBXmlReadonly(task.xml,core.xml,{systemRoot}),
   runLevel,
   launcherPresent:launcher!==null,launcherShaMatches:launcher!==null&&hex(launcher)===TASK_B_WRAPPER_SHA,
   journalPresent:journal!==null,coreBackupPresent:backup!==null,
   coreBackupShaMatches:backup!==null&&hex(backup)===TASK_B_CORE_SHA,
   lockPresent:lock!==null,lockRequestMatches:lock!==null&&lock.toString('utf8')===TASK_B_REQUEST,
   taskMutation:0,providerCalls:0,sqliteWrites:0,d1Writes:0
  };
 }catch{return recoveryFailure('W06_B_RECOVERY_READBACK_UNVERIFIED');}
}

const SCRIPT=[
 "$ErrorActionPreference='Stop'",
 "$tasks=@(Get-ScheduledTask -ErrorAction Stop | Where-Object {$_.TaskName -match '(?i)^ZGMINI[-_ ]'} | Sort-Object TaskName)",
 "if($tasks.Count -gt 48){throw 'TASK_SCOPE_TOO_LARGE'}",
 "$rows=@(foreach($t in $tasks){",
 " $actions=@($t.Actions);$exec=@($actions | Where-Object {$_.CimClass.CimClassName -eq 'MSFT_TaskExecAction'});$actionKind='UNKNOWN';$cnnMinuteLiteral=$false",
 " if($actions.Count -eq 1 -and $exec.Count -eq 1){$cmd=[string]$exec[0].Execute;$argsText=[string]$exec[0].Arguments;$leaf=[IO.Path]::GetFileName($cmd).ToLowerInvariant();if($leaf -eq 'node.exe'){$actionKind='NODE'}elseif($leaf -in @('wscript.exe','cscript.exe')){$actionKind='SCRIPT_HOST'}elseif($leaf -in @('cmd.exe','powershell.exe','pwsh.exe')){$actionKind='SHELL'}else{$actionKind='OTHER'};$cnnMinuteLiteral=($argsText -match '(?i)(?:^|\\s)--cnn-minute(?:\\s|$)' -and $argsText -match '(?i)(?:^|[\\\\/])local-cycle\\.mjs(?:\\s|\\x22|$)')}",
 " $intervals=@();$unverifiedIntervals=0;$triggers=@($t.Triggers)",
 " foreach($trigger in $triggers){$raw=$trigger.Repetition.Interval;if($null -eq $raw -or [string]$raw -eq ''){continue};try{$span=if($raw -is [timespan]){$raw}else{[System.Xml.XmlConvert]::ToTimeSpan([string]$raw)};$seconds=[double]$span.TotalSeconds;if($seconds -lt 1 -or $seconds -gt 31536000 -or $seconds -ne [math]::Floor($seconds)){throw 'INTERVAL_INVALID'};$intervals+=([int]$seconds)}catch{$unverifiedIntervals++}}",
 " $infoAvailable=$false;$lastRunUtc=$null;$nextRunUtc=$null;$lastTaskResult=$null",
 " try{$info=Get-ScheduledTaskInfo -InputObject $t -ErrorAction Stop;$infoAvailable=$true;if($null -ne $info.LastRunTime -and $info.LastRunTime.Year -ge 2000){$lastRunUtc=$info.LastRunTime.ToUniversalTime().ToString('o')};if($null -ne $info.NextRunTime -and $info.NextRunTime.Year -ge 2000){$nextRunUtc=$info.NextRunTime.ToUniversalTime().ToString('o')};$lastTaskResult=[long]$info.LastTaskResult}catch{}",
 " [pscustomobject]@{name=[string]$t.TaskName;state=[string]$t.State;enabled=[bool]$t.Settings.Enabled;triggerCount=[int]$triggers.Count;intervalsSeconds=@($intervals | Sort-Object -Unique);unverifiedIntervals=[int]$unverifiedIntervals;actionKind=$actionKind;cnnMinuteLiteral=[bool]$cnnMinuteLiteral;infoAvailable=[bool]$infoAvailable;lastRunUtc=$lastRunUtc;nextRunUtc=$nextRunUtc;lastTaskResult=$lastTaskResult}",
 "})",
 "[pscustomobject]@{schema='ZGMINI_W06_CNN_TASK_CADENCE_RAW_V1';observedAtUtc=(Get-Date).ToUniversalTime().ToString('o');tasks=@($rows)} | ConvertTo-Json -Compress -Depth 6"
].join(';');
const iso=s=>typeof s==='string'&&/^20\d\d-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/i.test(s)&&!Number.isNaN(Date.parse(s))?new Date(s).toISOString():null;
const int=(n,min,max)=>Number.isSafeInteger(n)&&n>=min&&n<=max?n:null;
const failure=code=>({schema:'ZGMINI_W06_CNN_TASK_CADENCE_A_V1',status:'STATE_UNKNOWN',code,
 tasks:[],taskCount:null,unknownTaskCount:null,cnnMinuteTaskNames:[],
 evidence:'TASK_DEFINITION_AND_LAST_RESULT_NOT_NATURAL_60S_EXECUTION_PROOF',
 operationalWrites:0,providerCalls:0,d1Writes:0});
export function projectW06TaskCadence(raw){
 if(!raw||raw.schema!=='ZGMINI_W06_CNN_TASK_CADENCE_RAW_V1'||
   !Array.isArray(raw.tasks)||raw.tasks.length>48||!iso(raw.observedAtUtc))
  return failure('W06_TASK_PROBE_RESULT_INVALID');
 const names=new Set(),tasks=[];let unknown=0;
 for(const x of raw.tasks){
  if(!x||typeof x.name!=='string'||!/^ZGMINI[-_ ][A-Za-z0-9._ -]{1,90}$/i.test(x.name)||
     names.has(x.name.toLowerCase())||!Array.isArray(x.intervalsSeconds)||
     x.intervalsSeconds.length>8||!['NODE','SCRIPT_HOST','SHELL','OTHER','UNKNOWN'].includes(x.actionKind)||
     typeof x.enabled!=='boolean'||typeof x.cnnMinuteLiteral!=='boolean'||
     typeof x.infoAvailable!=='boolean'||int(x.triggerCount,0,64)===null||
     int(x.unverifiedIntervals,0,64)===null||
     (x.lastTaskResult!==null&&int(x.lastTaskResult,-2147483648,4294967295)===null))
   return failure('W06_TASK_PROBE_ROW_INVALID');
  const seconds=[...new Set(x.intervalsSeconds)];
  if(seconds.some(n=>int(n,1,31536000)===null)||seconds.length!==x.intervalsSeconds.length)
   return failure('W06_TASK_INTERVAL_INVALID');
  const last=x.lastRunUtc===null?null:iso(x.lastRunUtc);
  const next=x.nextRunUtc===null?null:iso(x.nextRunUtc);
  if((x.lastRunUtc!==null&&!last)||(x.nextRunUtc!==null&&!next))
   return failure('W06_TASK_TIME_INVALID');
  names.add(x.name.toLowerCase());
  const state=['Ready','Running','Disabled','Queued','Unknown'].includes(x.state)?x.state:'UNKNOWN';
  const row={name:x.name,state,enabled:x.enabled,
   triggerCount:x.triggerCount,repetitionIntervalsSeconds:seconds.sort((a,b)=>a-b),
   unverifiedIntervals:x.unverifiedIntervals,actionKind:x.actionKind,
   cnnMinuteLiteral:x.cnnMinuteLiteral,infoAvailable:x.infoAvailable,
   lastRunUtc:last,nextRunUtc:next,lastTaskResult:x.lastTaskResult};
  if(state==='UNKNOWN'||x.unverifiedIntervals>0||!x.infoAvailable||x.actionKind==='UNKNOWN')unknown++;
  tasks.push(row);
 }
 const candidates=tasks.filter(x=>x.enabled&&x.repetitionIntervalsSeconds.includes(60)&&
   x.cnnMinuteLiteral).map(x=>x.name);
 return {...failure(unknown?'W06_TASK_CADENCE_PARTIAL':'W06_TASK_CADENCE_COLLECTED'),
  status:unknown?'PARTIAL':'PASS',observedAtUtc:iso(raw.observedAtUtc),
  tasks,taskCount:tasks.length,unknownTaskCount:unknown,
  cnnMinuteTaskNames:candidates};
}
export function inspectW06TaskCadenceReadonly({platform=process.platform,
 systemRoot=process.env.SystemRoot||'C:\\Windows',exists=fs.existsSync,run=spawnSync}={}){
 if(platform!=='win32'||!/^[a-z]:[\\/]windows$/i.test(systemRoot))
  return failure('W06_TASK_WINDOWS_SCOPE_UNVERIFIED');
 const ps=path.win32.join(systemRoot,'System32','WindowsPowerShell','v1.0','powershell.exe');
 if(!exists(ps))return failure('W06_TASK_POWERSHELL_UNAVAILABLE');
 let observed;
 try{observed=run(ps,['-NoLogo','-NoProfile','-NonInteractive','-EncodedCommand',
  Buffer.from(SCRIPT,'utf16le').toString('base64')],{shell:false,windowsHide:true,
  timeout:25000,maxBuffer:65536,encoding:'utf8'});}
 catch{return failure('W06_TASK_PROBE_UNAVAILABLE');}
 if(observed?.error||observed?.status!==0||typeof observed?.stdout!=='string'||
   Buffer.byteLength(observed.stdout)>65536)
  return failure('W06_TASK_PROBE_UNAVAILABLE');
 try{
  const projected=projectW06TaskCadence(JSON.parse(observed.stdout.replace(/^\uFEFF/,'').trim()));
  if(projected.tasks?.some(x=>x.name===TASK_B))
   return {...projected,taskRecovery:inspectW06TaskBRecoveryReadonly({systemRoot})};
  return projected;
 }
 catch{return failure('W06_TASK_PROBE_PARSE_INVALID');}
}

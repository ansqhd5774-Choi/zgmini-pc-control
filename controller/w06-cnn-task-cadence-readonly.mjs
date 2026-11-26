// W06 fixed read-only Windows Task cadence/action evidence. No Task mutation,
// provider, SQLite, D1 or launch of any Task action. Never return raw actions.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

export const PROBE='w06-cnn-task-cadence-readonly';
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
 try{return projectW06TaskCadence(JSON.parse(observed.stdout.replace(/^\uFEFF/,'').trim()));}
 catch{return failure('W06_TASK_PROBE_PARSE_INVALID');}
}

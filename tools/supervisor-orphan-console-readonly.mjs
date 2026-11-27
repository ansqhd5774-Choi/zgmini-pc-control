// Fixed Windows read-only console-cohort observation for orphan Runner diagnosis.
// No console control event, process termination, lease write, or Owner adoption.
// Only aggregate membership is returned: private PIDs never leave this module.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const schema='ZGMINI_ORPHAN_CONSOLE_COHORT_A_V1';
const internal=new WeakMap();
export function readPrivateOrphanConsoleEvidence(summary){return internal.get(summary)??null;}
const base={schema,operationalWrites:0,providerCalls:0,d1Writes:0,
 signalEmitted:false,runnerTerminationAuthorized:false,
 supervisorSpawnAuthorized:false,ownerAdoptionAuthorized:false};
const unknown=code=>({...base,status:'STATE_UNKNOWN',code,
 inspectedSeatCount:0,consoleAttachedSeatCount:0,
 distinctConsoleGroupCount:null,sharedListenerConsoleGroupCount:null,
 extraConsoleMemberCount:null});
const positive=n=>Number.isSafeInteger(n)&&n>0;

export function projectOrphanConsoleCohort(raw,{observedAtUtc=null}={}){
 if(raw?.schema!==schema||raw.stable!==true||
    !positive(raw.inspectorPid)||!Array.isArray(raw.rows)||
    raw.rows.length!==6)return unknown('ORPHAN_CONSOLE_SNAPSHOT_UNVERIFIED');
 const seats=new Set(),pids=new Set();
 for(const row of raw.rows){
  if(!Number.isSafeInteger(row?.seat)||row.seat<1||row.seat>6||
     seats.has(row.seat)||!positive(row.pid)||pids.has(row.pid)||
     !['ATTACHED','UNAVAILABLE'].includes(row.mode)||
     !Array.isArray(row.members)||row.members.length>64||
     row.members.some(x=>!positive(x))||
     new Set(row.members).size!==row.members.length)
   return unknown('ORPHAN_CONSOLE_ROWS_INVALID');
  seats.add(row.seat);pids.add(row.pid);
 }
 if(seats.size!==6)return unknown('ORPHAN_CONSOLE_SIX_SEATS_UNVERIFIED');
 const unavailable=raw.rows.filter(r=>r.mode==='UNAVAILABLE');
 if(unavailable.length||raw.rows.some(r=>r.mode==='ATTACHED'&&
    !r.members.includes(r.pid)))
  return {...unknown('ORPHAN_CONSOLE_ATTACH_OR_MEMBERSHIP_UNVERIFIED'),
   inspectedSeatCount:6,consoleAttachedSeatCount:6-unavailable.length};
 const groups=new Map();
 for(const row of raw.rows){
  const members=row.members.filter(p=>p!==raw.inspectorPid).sort((a,b)=>a-b);
  const key=members.join(':');
  if(!groups.has(key))groups.set(key,{members,listenerCount:0});
  groups.get(key).listenerCount++;
 }
 let shared=0,others=0,largest=0;
 for(const g of groups.values()){
  if(g.listenerCount>1)shared++;
  others+=g.members.filter(p=>!pids.has(p)).length;
  largest=Math.max(largest,g.members.length);
 }
 const output={...base,status:'PASS',code:'ORPHAN_CONSOLE_COHORT_READONLY_OBSERVED',
  inspectedSeatCount:6,consoleAttachedSeatCount:6,
  distinctConsoleGroupCount:groups.size,sharedListenerConsoleGroupCount:shared,
  extraConsoleMemberCount:others,maxConsoleMemberCount:largest,
  // This is ONE observation. Neither Windows console group ownership nor
  // safe CTRL_C_EVENT routing, job drain, or termination authority is proven.
  gracefulShutdownSupported:null};
 // The only host-private link to WMI PID/birth observations. A public JSON
 // summary cannot be used to reconstruct or spoof this WeakMap entry.
 if(typeof observedAtUtc==='string'&&Number.isFinite(Date.parse(observedAtUtc))&&
    raw.rows.every(row=>typeof row.birth==='string'&&
     Number.isFinite(Date.parse(row.birth))&&
     new Date(row.birth).toISOString()===new Date(Date.parse(row.birth)).toISOString())){
  internal.set(output,Object.freeze({
   observedAtUtc,
   rows:Object.freeze(raw.rows.map(row=>Object.freeze({
    seat:row.seat,pid:row.pid,startedAtUtc:new Date(row.birth).toISOString(),
    members:Object.freeze(row.members.filter(p=>p!==raw.inspectorPid))
   })))
  }));
 }
 return output;
}

// A separate PowerShell observer briefly attaches to the target console.
// GetConsoleProcessList is observational; GenerateConsoleCtrlEvent is NEVER called.
// It is deliberately fail-closed if any PID, creation-time, path or seat changes.
const query=String.raw`
$ErrorActionPreference='Stop'
$raw=@(Get-CimInstance -ClassName Win32_Process -Filter "Name='Runner.Listener.exe'" -ErrorAction Stop)
$items=@()
foreach($p in $raw){
 $m=[regex]::Match([string]$p.ExecutablePath,'(?i)^E:\\ZGmini\\automation\\pc-control\\runners\\(0[1-6])\\(?:bin\\)?Runner\.Listener\.exe$')
 if($m.Success){
  $items+= [pscustomobject]@{seat=[int]$m.Groups[1].Value;pid=[int]$p.ProcessId;birth=([datetime]$p.CreationDate).ToUniversalTime().ToString('o')}
 }
}
if($items.Count -ne 6 -or @($items | Select-Object -ExpandProperty seat -Unique).Count -ne 6){
 [pscustomobject]@{schema='ZGMINI_ORPHAN_CONSOLE_COHORT_A_V1';stable=$false;inspectorPid=[int]$PID;rows=@()} | ConvertTo-Json -Compress -Depth 6
 exit 0
}
$code=@'
using System;
using System.Runtime.InteropServices;
public static class ZgminiReadonlyConsole {
 [DllImport("kernel32.dll",SetLastError=true)] public static extern bool FreeConsole();
 [DllImport("kernel32.dll",SetLastError=true)] public static extern bool AttachConsole(uint processId);
 [DllImport("kernel32.dll",SetLastError=true)] public static extern uint GetConsoleProcessList([Out] uint[] processList,uint count);
}
'@
Add-Type -TypeDefinition $code -ErrorAction Stop
$groups=@()
foreach($item in $items){
 [void][ZgminiReadonlyConsole]::FreeConsole()
 $mode='UNAVAILABLE'
 $members=@()
 try {
  if([ZgminiReadonlyConsole]::AttachConsole([uint32]$item.pid)){
   $buffer=[uint32[]]::new(64)
   $n=[ZgminiReadonlyConsole]::GetConsoleProcessList($buffer,[uint32]$buffer.Length)
   if($n -gt 0 -and $n -le $buffer.Length){
    $members=@($buffer[0..([int]$n-1)] | ForEach-Object {[int]$_})
    $mode='ATTACHED'
   }
  }
 } finally {[void][ZgminiReadonlyConsole]::FreeConsole()}
 $groups+=[pscustomobject]@{seat=$item.seat;pid=$item.pid;birth=$item.birth;mode=$mode;members=@($members)}
}
$latest=@(Get-CimInstance -ClassName Win32_Process -Filter "Name='Runner.Listener.exe'" -ErrorAction Stop)
$stable=$true
foreach($item in $items){
 $matching=@($latest | Where-Object {[int]$_.ProcessId -eq $item.pid})
 if($matching.Count -ne 1 -or ([datetime]$matching[0].CreationDate).ToUniversalTime().ToString('o') -ne $item.birth){$stable=$false;break}
}
[pscustomobject]@{schema='ZGMINI_ORPHAN_CONSOLE_COHORT_A_V1';stable=$stable;inspectorPid=[int]$PID;rows=@($groups)} | ConvertTo-Json -Compress -Depth 6
`;

export function inspectOrphanConsoleCohortReadonly({
 platform=process.platform,env=process.env,filesystem=fs,run=spawnSync,
 now=()=>new Date().toISOString()
}={}){
 if(platform!=='win32'||typeof env.SystemRoot!=='string'||
    !/^[a-z]:[\\/]windows$/i.test(env.SystemRoot))
  return unknown('ORPHAN_CONSOLE_WINDOWS_ENV_UNVERIFIED');
 const exe=path.win32.join(env.SystemRoot,'System32','WindowsPowerShell',
  'v1.0','powershell.exe');
 try{if(!filesystem.statSync(exe).isFile())
  return unknown('ORPHAN_CONSOLE_READER_MISSING');}
 catch{return unknown('ORPHAN_CONSOLE_READER_MISSING');}
 try{
  const out=run(exe,['-NoLogo','-NoProfile','-NonInteractive','-Command',query],
   {windowsHide:true,timeout:20000,maxBuffer:32768,encoding:'utf8',shell:false});
  if(out?.error||out?.status!==0||typeof out.stdout!=='string'||
     Buffer.byteLength(out.stdout)>32768)
   return unknown('ORPHAN_CONSOLE_QUERY_UNVERIFIED');
  return projectOrphanConsoleCohort(JSON.parse(out.stdout.replace(/^\uFEFF/,'').trim()),
   {observedAtUtc:now()});
 }catch{return unknown('ORPHAN_CONSOLE_QUERY_UNVERIFIED');}
}

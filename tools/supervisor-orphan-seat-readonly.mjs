// Fixed operating-PC orphan Runner seat inventory.
// Observational only: it never claims that a seat is idle or may be terminated,
// never emits process IDs, executable paths, environment variables or nonce.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const CONTROL_ROOT='E:/ZGmini/automation/pc-control';
const seatIds=Object.freeze(['01','02','03','04','05','06']);
const base=Object.freeze({
 schema:'ZGMINI_ORPHAN_SEAT_MAP_A_V1',
 evidence:'ONE_INSTANT_WMI_COUNTS_NOT_LEASE_OR_JOB_IDLE_AUTHORIZATION',
 recoveryAuthorized:false,supervisorSpawnAuthorized:false,
 runnerTerminationAuthorized:false,seatIdleProven:false,
 operationalWrites:0,providerCalls:0,d1Writes:0
});
const denial=code=>({...base,status:'STATE_UNKNOWN',code,
 controllerListenerCount:null,controllerWorkerCount:null,
 registeredServiceExceptionCount:null,seats:[]});
const int=x=>Number.isSafeInteger(x)&&x>0;
export function projectOrphanSeatMap(rows,{
 controllerRoot=CONTROL_ROOT,canonicalize=fs.realpathSync.native
}={}){
 if(!Array.isArray(rows)||rows.length<6||rows.length>256)
  return denial('ORPHAN_SEAT_WMI_ROWS_UNVERIFIED');
 let root;
 try{root=path.win32.normalize(canonicalize(controllerRoot)).toLowerCase();}
 catch{return denial('ORPHAN_SEAT_CONTROLLER_ROOT_UNVERIFIED');}
 if(!path.win32.isAbsolute(root)||root.length<9)
  return denial('ORPHAN_SEAT_CONTROLLER_ROOT_UNVERIFIED');
 const prefix=root.replace(/[\\]+$/,'')+'\\runners\\';
 const seats=Object.fromEntries(seatIds.map(id=>[id,{listenerCount:0,workerCount:0}]));
 const ids=new Set();
 let serviceCount=0;
 for(const row of rows){
  if(!int(row?.pid)||ids.has(row.pid)||
    !/^runner\.(listener|worker)\.exe$/i.test(row.name??''))
   return denial('ORPHAN_SEAT_WMI_IDENTITY_INVALID');
  ids.add(row.pid);
  const listener=/^runner\.listener\.exe$/i.test(row.name);
  if((row.executablePath===''||row.executablePath===null)&&
    listener&&row.sessionId===0&&
    row.serviceObservationAvailable===true&&row.serviceAncestor===true){
   if(++serviceCount>1)return denial('ORPHAN_SEAT_SERVICE_AMBIGUOUS');
   continue;
  }
  let file;
  try{
   if(typeof row.executablePath!=='string'||
     !path.win32.isAbsolute(row.executablePath))throw Error('PATH');
   file=path.win32.normalize(canonicalize(row.executablePath)).toLowerCase();
  }catch{return denial('ORPHAN_SEAT_EXECUTABLE_PATH_UNVERIFIED');}
  if(!path.win32.isAbsolute(file)||!file.startsWith(prefix))
   return denial('ORPHAN_SEAT_UNEXPECTED_RUNNER_ROOT');
  const rel=file.slice(prefix.length);
  const match=/^(0[1-6])\\(?:bin\\)?runner\.(listener|worker)\.exe$/.exec(rel);
  if(!match)return denial('ORPHAN_SEAT_UNEXPECTED_RUNNER_LAYOUT');
  const counter=match[2]==='listener'?'listenerCount':'workerCount';
  seats[match[1]][counter]++;
  if(seats[match[1]][counter]>1)
   return denial('ORPHAN_SEAT_DUPLICATE_CONTROLLER_PROCESS');
 }
 const fixed=seatIds.map(id=>({seat:Number(id),...seats[id]}));
 if(fixed.some(item=>item.listenerCount!==1))
  return denial('ORPHAN_SEAT_SIX_LISTENERS_NOT_UNIQUE');
 return {...base,status:'PASS',code:'ORPHAN_SEAT_COUNTS_OBSERVED',
  controllerListenerCount:6,
  controllerWorkerCount:fixed.reduce((sum,item)=>sum+item.workerCount,0),
  registeredServiceExceptionCount:serviceCount,seats:fixed};
}

export function inspectOrphanSeatMapReadonly({
 run=spawnSync,filesystem=fs,env=process.env,
 platform=process.platform,canonicalize=fs.realpathSync.native
}={}){
 if(platform!=='win32'||typeof env.SystemRoot!=='string'||
   !/^[a-z]:[\\/]windows$/i.test(env.SystemRoot))
  return denial('ORPHAN_SEAT_WINDOWS_ENV_UNVERIFIED');
 const powershell=path.win32.join(env.SystemRoot,'System32','WindowsPowerShell',
  'v1.0','powershell.exe');
 try{if(!filesystem.statSync(powershell).isFile())
  return denial('ORPHAN_SEAT_WMI_READER_UNAVAILABLE');}
 catch{return denial('ORPHAN_SEAT_WMI_READER_UNAVAILABLE');}
 // The caller does not provide any command, process identifier, script, root,
 // or service filter. Only CIM read methods are used; no mutation operators.
 const command=[
  "$ErrorActionPreference='Stop'",
  "$all=@(Get-CimInstance -ClassName Win32_Process -ErrorAction Stop)",
  "if($all.Count -gt 4096){throw 'PROCESS_SCOPE_EXCEEDED'}",
  "$byPid=@{};foreach($p in $all){$byPid[[int]$p.ProcessId]=$p}",
  "$svc=@(Get-CimInstance -ClassName Win32_Service -Filter \"Name LIKE 'actions.runner.%'\" -ErrorAction Stop | Where-Object {$_.State -eq 'Running' -and [int]$_.ProcessId -gt 0})",
  "$svcByPid=@{};foreach($sv in $svc){if([string]$sv.Name -match '(?i)^actions\\.runner\\.'){ $svcByPid[[int]$sv.ProcessId]=$true }}",
  "$rows=@(foreach($p in $all | Where-Object {$_.Name -in @('Runner.Listener.exe','Runner.Worker.exe')}){$seen=@{};$parent=[int]$p.ParentProcessId;$serviceAncestor=$svcByPid.ContainsKey([int]$p.ProcessId);for($depth=0;$depth -lt 8 -and !$serviceAncestor;$depth++){if($parent -le 0 -or $seen.ContainsKey($parent)){break};$seen[$parent]=$true;if($svcByPid.ContainsKey($parent)){$serviceAncestor=$true;break};if(!$byPid.ContainsKey($parent)){break};$next=[int]$byPid[$parent].ParentProcessId;if($next -eq $parent){break};$parent=$next};$session=if($null -eq $p.SessionId){-1}else{[int]$p.SessionId};[pscustomobject]@{pid=[int]$p.ProcessId;name=[string]$p.Name;executablePath=[string]$p.ExecutablePath;sessionId=$session;serviceAncestor=$serviceAncestor;serviceObservationAvailable=$true}})",
  "[pscustomobject]@{rows=$rows}|ConvertTo-Json -Compress -Depth 4"
 ].join(';');
 let result;
 try{result=run(powershell,['-NoLogo','-NoProfile','-NonInteractive',
  '-Command',command],{windowsHide:true,timeout:15000,maxBuffer:65536,
   encoding:'utf8',shell:false});}
 catch{return denial('ORPHAN_SEAT_WMI_QUERY_UNVERIFIED');}
 if(result?.error||result?.status!==0||typeof result?.stdout!=='string'||
   Buffer.byteLength(result.stdout)>65536)
  return denial('ORPHAN_SEAT_WMI_QUERY_UNVERIFIED');
 try{
  const obj=JSON.parse(result.stdout.replace(/^\uFEFF/,'').trim());
  return projectOrphanSeatMap(obj?.rows,{controllerRoot:CONTROL_ROOT,canonicalize});
 }catch{return denial('ORPHAN_SEAT_WMI_RESPONSE_UNVERIFIED');}
}

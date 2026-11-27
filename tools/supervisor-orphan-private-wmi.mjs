// Windows-only private process-birth evidence for orphan Supervisor recovery.
// This is a fixed READ, not a privileged B actor, approval, nonce probe or
// install tool. The sensitive PID/path/birth tuples are held in a WeakMap;
// they are never serialized to an Issue, job receipt, stdout or GitHub log.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {projectOrphanSeatMap} from './supervisor-orphan-seat-readonly.mjs';

const ROOT='E:/ZGmini/automation/pc-control';
const internal=new WeakMap();
const sha256=s=>createHash('sha256').update(s).digest('hex');
const pid=x=>Number.isSafeInteger(x)&&x>0;
const stamp=x=>typeof x==='string'&&
 /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(x)&&
 Number.isFinite(Date.parse(x))&&new Date(x).toISOString()===x;
const base={schema:'ZGMINI_ORPHAN_PRIVATE_WMI_READ_V1',
 effectAuthorized:false,adoptionAuthorized:false,nonceVerified:false,
 leaseMutationAuthorized:false,heartbeatWriteAuthorized:false,
 supervisorSpawnAuthorized:false,runnerStopAuthorized:false,
 operationalWrites:0,providerCalls:0,d1Writes:0};
const deny=code=>Object.freeze({...base,status:'STATE_UNKNOWN',code,
 exactSeatCount:0,workerCount:null,originalPinsCompared:false});
const safeCanon=(file,canonicalize)=>{
 const full=canonicalize(file);
 if(typeof full!=='string'||!path.win32.isAbsolute(full))throw Error('PATH');
 return path.win32.normalize(full).toLowerCase();
};

// This returns a PUBLIC, sanitized summary. Private identity tuples are
// accessible only with readPrivateOrphanWmiEvidence(result) in the same
// process. Caller-provided pin data cannot by itself authorize a B effect.
export function projectPrivateOrphanWmiEvidence(rows,{
 controllerRoot=ROOT,canonicalize=fs.realpathSync.native,
 originalHeartbeatAt,observedAt=new Date().toISOString(),
 originalSeatPins=null
}={}){
 if(!stamp(observedAt)||!stamp(originalHeartbeatAt)||
    Date.parse(originalHeartbeatAt)>Date.parse(observedAt))
  return deny('ORPHAN_PRIVATE_WMI_TIME_REFERENCE_UNVERIFIED');
 const publicMap=projectOrphanSeatMap(rows,{controllerRoot,canonicalize});
 if(publicMap.status!=='PASS')return deny('ORPHAN_PRIVATE_WMI_SIX_SEAT_SCOPE_UNVERIFIED');
 let root;
 try{root=safeCanon(controllerRoot,canonicalize);}
 catch{return deny('ORPHAN_PRIVATE_WMI_CANONICAL_ROOT_UNVERIFIED');}
 const prefix=root.replace(/[\\]+$/,'')+'\\runners\\';
 const listener=[],workers=[];
 try{
  for(const row of rows){
   if(!pid(row?.pid)||!stamp(row?.startedAtUtc)||
      Date.parse(row.startedAtUtc)>Date.parse(observedAt))
    throw Error('BIRTH');
   // Registered service exception was proven independently by the
   // existing fixed Win32_Service ancestry classifier. It is never
   // interpreted as one of the six Controller-owned Runner seats.
   if((row.executablePath===''||row.executablePath===null)&&
      /^Runner\.Listener\.exe$/i.test(row.name)&&row.sessionId===0&&
      row.serviceObservationAvailable===true&&row.serviceAncestor===true)
    continue;
   const exe=safeCanon(row.executablePath,canonicalize);
   if(!exe.startsWith(prefix))throw Error('UNBOUND');
   const relative=exe.slice(prefix.length);
   const match=/^(0[1-6])\\(?:bin\\)?runner\.(listener|worker)\.exe$/.exec(relative);
   if(!match)throw Error('LAYOUT');
   const item={seat:Number(match[1]),pid:row.pid,
    startedAtUtc:row.startedAtUtc,canonicalPathSha256:sha256(exe)};
   if(match[2]==='listener'){
    if(Date.parse(item.startedAtUtc)>Date.parse(originalHeartbeatAt))
     throw Error('NEW_LISTENER');
    listener.push(item);
   }else workers.push(item);
  }
 }catch{return deny('ORPHAN_PRIVATE_WMI_PROCESS_BIRTH_OR_PATH_UNVERIFIED');}
 listener.sort((a,b)=>a.seat-b.seat);
 workers.sort((a,b)=>a.seat-b.seat);
 if(listener.length!==6||listener.some((v,i)=>v.seat!==i+1)||
    workers.length!==publicMap.controllerWorkerCount)
  return deny('ORPHAN_PRIVATE_WMI_PROCESS_MAPPING_UNVERIFIED');
 let compared=false;
 if(originalSeatPins!==null){
  if(!Array.isArray(originalSeatPins)||originalSeatPins.length!==6)
   return deny('ORPHAN_PRIVATE_WMI_ORIGINAL_PINS_INVALID');
  const sorted=[...originalSeatPins].sort((a,b)=>a.seat-b.seat);
  for(let i=0;i<6;i++){
   const p=sorted[i],c=listener[i];
   if(p?.seat!==c.seat||p.pid!==c.pid||
      p.startedAtUtc!==c.startedAtUtc||
      p.canonicalPathSha256!==c.canonicalPathSha256)
    return deny('ORPHAN_PRIVATE_WMI_ORIGINAL_IDENTITY_CHANGED');
  }
  compared=true;
 }
 const out=Object.freeze({...base,status:'PASS',
  code:compared?'ORPHAN_PRIVATE_WMI_SUPPLIED_PINS_MATCH':
   'ORPHAN_PRIVATE_WMI_NEW_OBSERVATION_ONLY',
  exactSeatCount:6,workerCount:workers.length,
  originalPinsCompared:compared});
 // Non-enumerable private record; public serialization exposes only counts.
 internal.set(out,Object.freeze({
  source:'WIN32_PROCESS_PRIVATE_SAME_HOST',
  rows:Object.freeze(listener.map(x=>Object.freeze({...x,alive:true}))),
  workers:Object.freeze(workers.map(x=>Object.freeze({...x}))),
  completeControllerRootsVerified:true,extraControllerListenerCount:0,
  unknownControllerPathCount:0,
  observedAt,originalPinsCompared:compared
 }));
 return out;
}

// A fabricated public summary or JSON payload cannot be used to extract
// private rows; only the exact object made by this module has a WeakMap entry.
export function readPrivateOrphanWmiEvidence(summary){
 return internal.get(summary)??null;
}

export function inspectPrivateOrphanWmiReadonly({
 run=spawnSync,filesystem=fs,env=process.env,
 platform=process.platform,hostname=os.hostname(),
 canonicalize=fs.realpathSync.native,
 originalHeartbeatAt,originalSeatPins=null,
 now=()=>new Date().toISOString()
}={}){
 if(platform!=='win32'||String(hostname).toUpperCase()!=='PC'||
    typeof env.SystemRoot!=='string'||
    !/^[a-z]:[\\/]windows$/i.test(env.SystemRoot))
  return deny('ORPHAN_PRIVATE_WMI_APPROVED_WINDOWS_HOST_REQUIRED');
 const powershell=path.win32.join(env.SystemRoot,'System32',
  'WindowsPowerShell','v1.0','powershell.exe');
 try{if(!filesystem.statSync(powershell).isFile())
  return deny('ORPHAN_PRIVATE_WMI_READER_UNAVAILABLE');}
 catch{return deny('ORPHAN_PRIVATE_WMI_READER_UNAVAILABLE');}
 // The query is fixed. No Issue text, user script/command, PID, executable
 // path or nonce is interpolated; no Win32_Process methods are invoked.
 const script=[
  "$ErrorActionPreference='Stop'",
  "$all=@(Get-CimInstance -ClassName Win32_Process -ErrorAction Stop)",
  "if($all.Count -gt 4096){throw 'PROCESS_SCOPE_EXCEEDED'}",
  "$byPid=@{};foreach($p in $all){$byPid[[int]$p.ProcessId]=$p}",
  "$svc=@(Get-CimInstance -ClassName Win32_Service -Filter \"Name LIKE 'actions.runner.%'\" -ErrorAction Stop | Where-Object {$_.State -eq 'Running' -and [int]$_.ProcessId -gt 0})",
  "$svcByPid=@{};foreach($sv in $svc){if([string]$sv.Name -match '(?i)^actions\\.runner\\.'){ $svcByPid[[int]$sv.ProcessId]=$true }}",
  "$rows=@(foreach($p in $all | Where-Object {$_.Name -in @('Runner.Listener.exe','Runner.Worker.exe')}){",
  "if($null -eq $p.CreationDate){throw 'PROCESS_BIRTH_UNKNOWN'}",
  "$started=([DateTime]$p.CreationDate).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.fffZ')",
  "$seen=@{};$parent=[int]$p.ParentProcessId;$serviceAncestor=$svcByPid.ContainsKey([int]$p.ProcessId)",
  "for($depth=0;$depth -lt 8 -and !$serviceAncestor;$depth++){if($parent -le 0 -or $seen.ContainsKey($parent)){break};$seen[$parent]=$true;if($svcByPid.ContainsKey($parent)){$serviceAncestor=$true;break};if(!$byPid.ContainsKey($parent)){break};$next=[int]$byPid[$parent].ParentProcessId;if($next -eq $parent){break};$parent=$next}",
  "$session=if($null -eq $p.SessionId){-1}else{[int]$p.SessionId}",
  "[pscustomobject]@{pid=[int]$p.ProcessId;name=[string]$p.Name;executablePath=[string]$p.ExecutablePath;sessionId=$session;serviceAncestor=$serviceAncestor;serviceObservationAvailable=$true;startedAtUtc=$started}",
  "})",
  "[pscustomobject]@{rows=$rows}|ConvertTo-Json -Compress -Depth 4"
 ].join(';');
 let raw;
 try{raw=run(powershell,['-NoLogo','-NoProfile','-NonInteractive',
  '-Command',script],{windowsHide:true,timeout:15000,maxBuffer:131072,
  encoding:'utf8',shell:false});}
 catch{return deny('ORPHAN_PRIVATE_WMI_QUERY_UNVERIFIED');}
 if(raw?.error||raw?.status!==0||typeof raw?.stdout!=='string'||
    Buffer.byteLength(raw.stdout)>131072)
  return deny('ORPHAN_PRIVATE_WMI_QUERY_UNVERIFIED');
 try{
  const observedAt=now();
  const parsed=JSON.parse(raw.stdout.replace(/^\uFEFF/,'').trim());
  return projectPrivateOrphanWmiEvidence(parsed?.rows,{
   controllerRoot:ROOT,canonicalize,observedAt,
   originalHeartbeatAt,originalSeatPins
  });
 }catch{return deny('ORPHAN_PRIVATE_WMI_RESPONSE_UNVERIFIED');}
}

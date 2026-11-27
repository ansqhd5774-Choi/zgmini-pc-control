// Fixed Windows-only A observation of the six ORIGINAL Controller Runner.Listener
// binaries. No Runner signal, process/lease mutation, credential read or B
// authorization. Version metadata is NOT proof of a graceful shutdown handler.
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

export const ORPHAN_SIX_BINARY_PROBE='controller-orphan-six-runner-binary-readonly';
const SCHEMA='ZGMINI_ORPHAN_SIX_RUNNER_BINARY_A_V1';
const SHA64=/^[a-f0-9]{64}$/;
const VERSION=/^[0-9]{1,5}(?:\.[0-9]{1,5}){2,3}$/;
const ZERO=Object.freeze({
 schema:SCHEMA,status:'STATE_UNKNOWN',code:'ORPHAN_SIX_BINARY_UNVERIFIED',
 controllerListenerCount:0,version:null,versionUniform:false,binaryUniform:false,
 exactSixSeatPathsVerified:false,liveRunnerGracefulShutdownVerified:false,
 workerDrainVerified:false,effectAuthorized:false,runnerStopAuthorized:false,
 signalEmitted:false,operationalWrites:0,providerCalls:0,d1Writes:0
});
const unknown=code=>Object.freeze({...ZERO,code});
const seat=x=>Number.isInteger(x)&&x>=1&&x<=6;
const pid=x=>Number.isSafeInteger(x)&&x>0;
const birth=x=>typeof x==='string'&&
 /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{7}Z$/.test(x)&&
 Number.isFinite(Date.parse(x))&&
 new Date(x).toISOString()===x.slice(0,23)+'Z';

// Project a PRIVATE same-host WMI/file-version result into a bounded public
// diagnostic. No PID, birth, path, WMI command line or per-seat binary bytes.
export function projectOrphanSixRunnerBinaryReadonly(raw){
 if(raw?.schema!==SCHEMA||raw.stable!==true||
    !Array.isArray(raw.rows)||raw.rows.length!==6)
  return unknown('ORPHAN_SIX_BINARY_SOURCE_UNVERIFIED');
 const seenSeats=new Set(),seenPids=new Set(),versions=new Set(),binaries=new Set();
 for(const r of raw.rows){
  if(!seat(r?.seat)||!pid(r.pid)||!birth(r.birth)||
     seenSeats.has(r.seat)||seenPids.has(r.pid)||
     typeof r.version!=='string'||!VERSION.test(r.version)||
     typeof r.sha256!=='string'||!SHA64.test(r.sha256))
   return unknown('ORPHAN_SIX_BINARY_SEAT_OR_VERSION_INVALID');
  seenSeats.add(r.seat);seenPids.add(r.pid);
  versions.add(r.version);binaries.add(r.sha256);
 }
 if(seenSeats.size!==6||[1,2,3,4,5,6].some(i=>!seenSeats.has(i)))
  return unknown('ORPHAN_SIX_BINARY_SIX_SEATS_UNVERIFIED');
 const versionUniform=versions.size===1,binaryUniform=binaries.size===1;
 const common={...ZERO,controllerListenerCount:6,
  exactSixSeatPathsVerified:true,versionUniform,binaryUniform,
  // Release version can be displayed. An executable's OS-shutdown semantics
  // and CI source provenance must be verified separately for this build.
  version:versionUniform?[...versions][0]:null};
 return Object.freeze({...common,status:versionUniform&&binaryUniform?'PASS':'STATE_UNKNOWN',
  code:versionUniform&&binaryUniform?'ORPHAN_SIX_BINARY_SIX_IDENTICAL_READONLY':
   'ORPHAN_SIX_BINARY_SIX_BUILDS_DIVERGENT'});
}

// Host-private fixed read. Reject alias/replacement during hashing, and
// recheck each WMI PID+creation time after reading the file. Read-only only.
const POWERSHELL=String.raw`
$ErrorActionPreference='Stop'
$items=@(Get-CimInstance -ClassName Win32_Process -Filter "Name='Runner.Listener.exe'" -ErrorAction Stop)
$rows=@()
foreach($p in $items){
 $name=[string]$p.ExecutablePath
 $match=[regex]::Match($name,'(?i)^E:\\ZGmini\\automation\\pc-control\\runners\\(0[1-6])\\(?:bin\\)?Runner\.Listener\.exe$')
 if(-not $match.Success){continue}
 $seat=[int]$match.Groups[1].Value
 $item=Get-Item -LiteralPath $name -ErrorAction Stop
 if(($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or
    $item.PSIsContainer){throw 'BINARY_ALIAS'}
 $size=[int64]$item.Length
 $write=$item.LastWriteTimeUtc.Ticks
 $ver=[string]$item.VersionInfo.FileVersion
 $hash=[string](Get-FileHash -LiteralPath $name -Algorithm SHA256 -ErrorAction Stop).Hash
 $again=Get-Item -LiteralPath $name -ErrorAction Stop
 if($again.Length -ne $size -or $again.LastWriteTimeUtc.Ticks -ne $write -or
    ($again.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'BINARY_CHANGED'}
 $same=Get-CimInstance -ClassName Win32_Process -Filter "ProcessId=$($p.ProcessId)" -ErrorAction Stop
 if($null -eq $same -or [string]$same.ExecutablePath -ine $name -or
    ([datetime]$same.CreationDate).ToUniversalTime().Ticks -ne
    ([datetime]$p.CreationDate).ToUniversalTime().Ticks){throw 'WMI_CHANGED'}
 $rows+= [pscustomobject]@{seat=$seat;pid=[int]$p.ProcessId;
   birth=([datetime]$p.CreationDate).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.fffffffZ');
   version=$ver;sha256=$hash.ToLowerInvariant()}
}
[pscustomobject]@{schema='ZGMINI_ORPHAN_SIX_RUNNER_BINARY_A_V1';
 stable=$true;rows=@($rows)} | ConvertTo-Json -Compress -Depth 5
`;
export function inspectOrphanSixRunnerBinaryReadonly({
 platform=process.platform,hostname=os.hostname(),systemRoot=process.env.SystemRoot,
 run=spawnSync
}={}){
 if(platform!=='win32'||String(hostname).toUpperCase()!=='PC'||
    typeof systemRoot!=='string'||!/^[A-Za-z]:[\\/]Windows$/i.test(systemRoot))
  return unknown('ORPHAN_SIX_BINARY_OPERATING_WINDOWS_REQUIRED');
 const exe=path.win32.join(systemRoot,'System32','WindowsPowerShell',
  'v1.0','powershell.exe');
 let result;
 try{result=run(exe,['-NoLogo','-NoProfile','-NonInteractive',
  '-Command',POWERSHELL],{shell:false,windowsHide:true,
   encoding:'utf8',timeout:45000,maxBuffer:32768});}
 catch{return unknown('ORPHAN_SIX_BINARY_READ_FAILED');}
 if(result?.error||result?.status!==0||
    typeof result.stdout!=='string'||Buffer.byteLength(result.stdout)>32768)
  return unknown('ORPHAN_SIX_BINARY_READ_FAILED');
 try{return projectOrphanSixRunnerBinaryReadonly(
  JSON.parse(result.stdout.replace(/^\uFEFF/,'').trim()));}
 catch{return unknown('ORPHAN_SIX_BINARY_JSON_UNVERIFIED');}
}

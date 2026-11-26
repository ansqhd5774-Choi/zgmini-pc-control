// Source-only, read-only diagnosis for Supervisor death with six live Runners.
// This is NOT an adoption actuator, authorization, lease rewriter, process
// starter, or a replacement for a separately approved Windows recovery B.
import path from 'node:path';

const names=Object.freeze(Array.from({length:6},(_,i)=>'zgmini-pc-0'+(i+1)));
const sha40=x=>typeof x==='string'&&/^[0-9a-f]{40}$/.test(x);
const pid=x=>Number.isSafeInteger(x)&&x>0;
const timestamp=x=>typeof x==='string'?Date.parse(x):NaN;

export function assessOrphanRunnerPreflight({
 oldOwner,oldHeartbeat,oldSupervisorAlive,controllerFilesVerified,
 installedControllerSha,expectedControllerSha,watchdogInstalledMatch,
 watchdogOwnerVerified,workflowState,installLeaseHeld,relatedLeasesAbsent,
 githubRunners,wmiRows,controllerRoot,canonicalize,now=Date.now(),
 pidAlive=()=>null
}={}){
 const base={schema:'ZGMINI_ORPHAN_RUNNER_READONLY_PREFLIGHT_V1',
  status:'BLOCKED',code:'ORPHAN_EVIDENCE_UNAVAILABLE',
  controllerListenerCount:0,serviceListenerExceptions:0,workerCount:0,
  promotionAuthorized:false,runnerTerminationAuthorized:false,
  supervisorSpawnAuthorized:false,leaseMutationAuthorized:false,
  controllerJobAdmissionVerified:false,runnerTokenRebindRequired:true,
  operationalWrites:0,providerCalls:0,d1Writes:0};
 const fail=(code,extra={})=>({...base,code,...extra});
 if(!sha40(installedControllerSha)||installedControllerSha!==expectedControllerSha||
   controllerFilesVerified!==true||watchdogInstalledMatch!==true||
   watchdogOwnerVerified!==true)
  return fail('ORPHAN_SOURCE_OR_WATCHDOG_CAS_UNVERIFIED');
 if(workflowState!=='active'||installLeaseHeld!==false||
   relatedLeasesAbsent!==true)
  return fail('ORPHAN_SHARED_RESOURCE_NOT_CLEAR');
 if(!pid(oldOwner?.pid)||typeof oldOwner?.nonce!=='string'||
   oldOwner.nonce.length<16||oldSupervisorAlive!==false||
   pidAlive(oldOwner.pid)!==false)
  return fail('ORPHAN_OLD_SUPERVISOR_DEATH_UNVERIFIED');
 if(!pid(oldHeartbeat?.pid)||oldHeartbeat.pid!==oldOwner.pid||
   oldHeartbeat.sourceSha!==installedControllerSha||
   oldHeartbeat.mode!=='LISTENING'||
   !Array.isArray(oldHeartbeat.children)||oldHeartbeat.children.length!==6)
  return fail('ORPHAN_OLD_SIX_SEAT_LEDGER_UNVERIFIED');
 const oldAt=timestamp(oldHeartbeat.at);
 if(!Number.isFinite(now)||!Number.isFinite(oldAt)||oldAt>now||
   now-oldAt<45000||now-oldAt>86400000)
  return fail('ORPHAN_OLD_HEARTBEAT_AGE_UNVERIFIED');
 const oldSeats=new Set(),oldChildPids=new Set();
 for(const child of oldHeartbeat.children){
  if(!Number.isInteger(child?.seat)||child.seat<1||child.seat>6||
    !pid(child.pid)||oldSeats.has(child.seat)||oldChildPids.has(child.pid))
   return fail('ORPHAN_OLD_SIX_SEAT_LEDGER_UNVERIFIED');
  oldSeats.add(child.seat);oldChildPids.add(child.pid);
 }
 if(!Array.isArray(githubRunners)||githubRunners.length!==6||
   names.some(name=>githubRunners.filter(r=>r?.name===name&&
     r.status==='online').length!==1))
  return fail('ORPHAN_GITHUB_SIX_SEAT_UNVERIFIED');
 if(!Array.isArray(wmiRows)||wmiRows.length<6||wmiRows.length>256||
   typeof canonicalize!=='function')
  return fail('ORPHAN_WMI_READONLY_INPUT_UNVERIFIED');
 let root;
 try{root=path.win32.normalize(canonicalize(controllerRoot)).toLowerCase();}
 catch{return fail('ORPHAN_CONTROLLER_ROOT_UNVERIFIED');}
 if(!path.win32.isAbsolute(root)||root.length<9)
  return fail('ORPHAN_CONTROLLER_ROOT_UNVERIFIED');
 const prefix=root.replace(/[\\]+$/,'')+'\\runners\\';
 const seen=new Set(),seats=new Set();
 let services=0,workers=0;
 for(const row of wmiRows){
  if(!pid(row?.pid)||seen.has(row.pid)||
    !/^(Runner\.Listener|Runner\.Worker)\.exe$/i.test(row.name??'')||
    pidAlive(row.pid)!==true)
   return fail('ORPHAN_WMI_PROCESS_IDENTITY_UNVERIFIED');
  seen.add(row.pid);
  if((row.executablePath===''||row.executablePath===null)&&
    /^Runner\.Listener\.exe$/i.test(row.name)&&row.sessionId===0&&
    row.serviceObservationAvailable===true&&row.serviceAncestor===true){
   if(++services>1)return fail('ORPHAN_UNBOUND_SERVICE_LISTENER');
   continue;
  }
  let file;
  try{if(typeof row.executablePath!=='string')throw Error('PATH');
   file=path.win32.normalize(canonicalize(row.executablePath)).toLowerCase();
  }catch{return fail('ORPHAN_WMI_EXECUTABLE_UNVERIFIED');}
  if(!path.win32.isAbsolute(file)||!file.startsWith(prefix))
   return fail('ORPHAN_EXTERNAL_OR_UNKNOWN_RUNNER');
  const rel=file.slice(prefix.length);
  const match=/^(0[1-6])\\bin\\runner\.(listener|worker)\.exe$/.exec(rel);
  if(!match)return fail('ORPHAN_UNEXPECTED_RUNNER_EXECUTABLE_PATH');
  if(match[2]==='listener'){
   if(seats.has(match[1]))return fail('ORPHAN_DUPLICATE_LISTENER_SEAT');
   seats.add(match[1]);
  }else workers++;
 }
 if(seats.size!==6||names.some((_,i)=>!seats.has('0'+(i+1))))
  return fail('ORPHAN_CONTROLLER_LISTENER_SEAT_GAP',
   {controllerListenerCount:seats.size,serviceListenerExceptions:services,
    workerCount:workers});
 // Even perfect read-only evidence DOES NOT prove adoption, pid reuse,
 // prior parentage, active request lease continuity or new Supervisor safety.
 // A separate Windows source, CAS/rollback/lease contract and explicit effect
 // approval are necessary before creating any new Supervisor or child.
 return {...base,status:'OBSERVED_ONLY',
  code:'ORPHAN_SIX_LISTENERS_REQUIRE_NONCE_REBIND',
  controllerListenerCount:6,serviceListenerExceptions:services,
  workerCount:workers};
}

// Source-only no-spawn orphan Supervisor heartbeat actuator.
// NOT an executable, installed Controller, B approval or ownership handoff.
// Only a separately approved independent Windows maintainer may provide a
// trusted, same-host live attestor and an exact fixed-path heartbeat writer.
// It cannot acquire/mutate leases, start/stop Runners or read old nonces.
import {assessNoSpawnMonitorSnapshot} from './orphan-no-spawn-monitor-contract.mjs';

const result=(status,code)=>Object.freeze({
 schema:'ZGMINI_ORPHAN_NO_SPAWN_HEARTBEAT_ACTOR_V1',status,code,
 runnerStarts:0,runnerStops:0,leaseMutations:0,
 watchdogPromotions:0,providerCalls:0,d1Writes:0,
 operatingRecoveryVerified:false
});
const fail=code=>result('FAIL_CLOSED',code);
const validPid=n=>Number.isSafeInteger(n)&&n>0;

// This fingerprint is private process memory. Never log/return the historical
// owner PID, old nonce, new PID, Listener paths or their process birth times.
function exactContinuityFingerprint(sample){
 const p=sample?.controllerSeatPins;
 const w=sample?.liveWmi?.rows;
 if(!Array.isArray(p)||p.length!==6||!Array.isArray(w)||w.length!==6)
  throw Error('NO_SPAWN_ACTOR_SEAT_INPUT');
 const items=rows=>rows.map(x=>[x.seat,x.pid,x.startedAtUtc,
   x.canonicalPathSha256]).sort((a,b)=>a[0]-b[0]);
 return JSON.stringify([
  sample.preimage?.ownerRecordSha256,
  sample.preimage?.hostManifestSha256,
  sample.preimage?.heartbeatSha256,
  sample.installed?.controllerSourceSha,
  sample.oldOwner?.pid,
  sample.newOwner?.pid,
  sample.newOwner?.startedAtUtc,
  sample.lease?.newOwnerBytesSha256,
  items(p),items(w)
 ]);
}

// Heartbeat is compatible with the existing Watchdog's owner-pid/at checks.
// Six children here are the surviving *Listener instances*, not newly
// launched cmd.exe wrappers. Their exact identity must be re-attested.
function heartbeatFrom(sample,now){
 return {
  at:new Date(now).toISOString(),
  pid:sample.newOwner.pid,
  sourceSha:sample.installed.controllerSourceSha,
  mode:'LISTENING',
  adoptionMode:'ADOPT_EXISTING_SIX_NO_SPAWN',
  children:sample.liveWmi.rows.map(x=>({
   seat:x.seat,pid:x.pid,alive:true
  })).sort((a,b)=>a.seat-b.seat),
  restartCounts:{}
 };
}

export function createNoSpawnHeartbeatActor({
 attest,writeStatus,now=()=>Date.now()
}={}){
 if(typeof attest!=='function'||typeof writeStatus!=='function'||
    typeof now!=='function')
  throw Error('NO_SPAWN_ACTOR_PRIVATE_BINDINGS_REQUIRED');
 let baseline=null,terminal=null,busy=false,timer=null;
 function halt(code){
  if(!terminal)terminal=fail(code);
  if(timer){clearInterval(timer);timer=null;}
  return terminal;
 }
 async function verifiedSample(){
  // The attestor must run on the operating Windows host, not read an Issue
  // body or accept caller-supplied synthetic approval/nonce assertions.
  const sample=await attest();
  const instant=now();
  const assessed=assessNoSpawnMonitorSnapshot({...sample,now:instant,
   monitorPhase:baseline===null?'INITIAL_OWNER_ADOPTION':
    'ESTABLISHED_MONITOR_RENEWAL'});
  if(assessed.status!=='CANDIDATE_ONLY'||
     assessed.exactSeatIdentityCount!==6||
     !validPid(sample?.newOwner?.pid)||sample.newOwner.pid!==process.pid)
   throw Error('NO_SPAWN_ACTOR_LIVE_ATTESTATION_REJECTED');
  return {sample,instant,fingerprint:exactContinuityFingerprint(sample)};
 }
 async function tick(){
  if(terminal)return terminal;
  if(busy)return halt('NO_SPAWN_ACTOR_OVERLAPPING_ATTESTATION');
  busy=true;
  try{
   const first=await verifiedSample();
   if(terminal)return terminal;
   if(baseline!==null&&first.fingerprint!==baseline)
    return halt('NO_SPAWN_ACTOR_PINNED_IDENTITY_DRIFT');
   // A second complete private read immediately before the heartbeat
   // rejects CAS/Listener/Owner changes that occur during the first read.
   const last=await verifiedSample();
   if(terminal)return terminal;
   if(first.fingerprint!==last.fingerprint||
      (baseline!==null&&last.fingerprint!==baseline)||
      last.instant<first.instant)
    return halt('NO_SPAWN_ACTOR_PREWRITE_CAS_CHANGED');
   const heartbeat=heartbeatFrom(last.sample,last.instant);
   // No broad write delegation: the independent operator must bind this
   // callback to exactly SUPERVISOR_STATUS.json, with atomic write/readback.
   const written=await writeStatus(heartbeat);
   if(written!==true)return halt('NO_SPAWN_ACTOR_HEARTBEAT_WRITE_UNVERIFIED');
   if(terminal)return terminal;
   if(baseline===null)baseline=last.fingerprint;
   return result('MONITORING','NO_SPAWN_ACTOR_VERIFIED_HEARTBEAT_WRITTEN');
  }catch{
   return halt('NO_SPAWN_ACTOR_ATTESTATION_OR_WRITE_FAILED');
  }finally{busy=false;}
 }
 async function start(){
  if(terminal)return terminal;
  if(timer)return result('MONITORING','NO_SPAWN_ACTOR_ALREADY_MONITORING');
  const first=await tick();
  if(first.status==='MONITORING'&&!terminal&&!timer){
   timer=setInterval(()=>{void tick();},15000);
   timer.unref?.();
  }
  return first;
 }
 function stop(){
  // Stop is terminal and prevents an in-flight asynchronous proof from
  // publishing a heartbeat after shutdown. Never touch inherited Runners.
  halt('NO_SPAWN_ACTOR_STOPPED');
  return result('STOPPED','NO_SPAWN_ACTOR_HEARTBEAT_STOPPED');
 }
 return Object.freeze({tick,start,stop,state:()=>terminal??result(
  baseline===null?'READY':'MONITORING',
  baseline===null?'NO_SPAWN_ACTOR_NO_HEARTBEAT_YET':'NO_SPAWN_ACTOR_ACTIVE')});
}

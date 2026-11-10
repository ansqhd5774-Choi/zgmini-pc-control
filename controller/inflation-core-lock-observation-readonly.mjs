// Bounded, read-only observation of the existing Core Task and its E: lock.
// A Task/Node/lock correlation is diagnostic evidence only, NOT B approval.
// No Issue field selects a task, path, command, interval, or executable.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {inspectCoreRuntimeSource} from './core-runtime-source-readonly.mjs';

const DATA_ROOT=String.raw`E:\ZGmini\data\pc-writer`;
const CORE_LOCK=path.win32.join(DATA_ROOT,'local-cycle.lock');
const TASKS=Object.freeze(['ZGMINI-PC-Local-Core','ZGMINI-PC-Local-Korea']);
const WINDOW_MS=210_000; // existing A/heavy <=240s Controller profile
const INTERVAL_MS=5_000;
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const norm=value=>path.win32.normalize(value).replace(/\\+$/,'').toLowerCase();

function unknown(code,details={}){
 return {status:'STATE_UNKNOWN',code,
  scope:'CORE_TASK_TO_E_LOCK_DIAGNOSTIC_ONLY',
  authorizesB:false,taskRuntimeHomeVerified:false,
  operationalWrites:0,providerCalls:0,d1Writes:0,sqliteOpened:false,
  ...details};
}

// Injected dependencies permit a fully isolated fixture on non-Windows CI.
// The installed entrypoint uses only fixed paths and existing read-only probes.
export async function observeInflationCoreLock({
 platform=process.platform,
 queryTask,
 sample=inspectCoreRuntimeSource,
 realpath=fs.realpathSync.native,
 exists=fs.existsSync,
 clock=Date.now,
 wait=delay,
 windowMs=WINDOW_MS,
 intervalMs=INTERVAL_MS,
}={}){
 if(platform!=='win32'||typeof queryTask!=='function'||
  typeof sample!=='function'||typeof realpath!=='function'||
  typeof exists!=='function'||typeof clock!=='function'||
  typeof wait!=='function'||!Number.isInteger(windowMs)||
  windowMs<0||windowMs>WINDOW_MS||
  !Number.isInteger(intervalMs)||intervalMs<1||intervalMs>WINDOW_MS)
  return unknown('INFL_CORE_OBSERVER_CONTRACT_UNAVAILABLE');

 const taskXmlSha256={};
 try{
  for(const name of TASKS){
   const bytes=queryTask(name);
   if(!Buffer.isBuffer(bytes)||bytes.length<40||bytes.length>262144)
    return unknown('INFL_CORE_TASK_XML_UNAVAILABLE');
   taskXmlSha256[name]=sha256(bytes);
  }
  if(!path.win32.isAbsolute(realpath(DATA_ROOT)))
   return unknown('INFL_CORE_DATA_ROOT_UNVERIFIED');
 }catch{return unknown('INFL_CORE_TASK_OR_DATA_ROOT_UNAVAILABLE');}

 const start=clock();
 if(!Number.isFinite(start))return unknown('INFL_CORE_CLOCK_UNAVAILABLE');
 const deadline=start+windowMs;
 let samples=0,activeTaskSamples=0,lockPresentSamples=0,
  linkedNodeSamples=0,ownerVerifiedSamples=0,
  lockCanonicalMatches=0,lockCanonicalUnknown=0;
 const codes={};
 do{
  let observation;
  try{observation=sample();}catch{observation=null;}
  samples++;
  const code=typeof observation?.code==='string'&&
   /^[A-Z0-9_]{1,100}$/.test(observation.code)?observation.code:
   'INFL_CORE_SAMPLE_UNAVAILABLE';
  codes[code]=(codes[code]??0)+1;
  if(observation?.runningTaskInstances>0||
     ['CORE_LINKED_NODE_NOT_OBSERVED','CORE_MULTIPLE_LINKED_NODES']
      .includes(code))activeTaskSamples++;
  if(observation?.runtimeSourceVerified===true)linkedNodeSamples++;
  if(observation?.lockOwner?.status==='VERIFIED_ACTIVE_CORE'&&
     observation.runtimeSourceVerified===true){
   ownerVerifiedSamples++;
   try{
    // The file itself is observed while held by a Task-linked Node PID.
    const canonicalFile=norm(realpath(CORE_LOCK));
    const canonicalRoot=norm(realpath(DATA_ROOT));
    if(canonicalFile===norm(path.win32.join(canonicalRoot,'local-cycle.lock')))
     lockCanonicalMatches++;
    else lockCanonicalUnknown++;
   }catch{lockCanonicalUnknown++;}
  }
  try{if(exists(CORE_LOCK))lockPresentSamples++;}
  catch{/* no inference from an unreadable file */}
  if(ownerVerifiedSamples>0&&lockCanonicalMatches>0)break;
  const remaining=deadline-clock();
  if(!Number.isFinite(remaining)||remaining<=0)break;
  await wait(Math.min(intervalMs,remaining));
 }while(clock()<deadline);

 const details={durationMs:Math.max(0,clock()-start),samples,
  activeTaskSamples,lockPresentSamples,linkedNodeSamples,
  ownerVerifiedSamples,lockCanonicalMatches,lockCanonicalUnknown,
  taskXmlSha256,codes,
  koreaRuntimeVerified:false,
  // The Core Task environment is not inferred from the Runner environment.
  taskRuntimeHomeVerified:false};
 if(ownerVerifiedSamples>0&&lockCanonicalMatches>0)
  return {...unknown('INFL_CORE_TASK_LINKED_E_LOCK_OBSERVED',details),
   status:'PASS'};
 if(lockPresentSamples>0&&activeTaskSamples===0)
  return unknown('INFL_CORE_LOCK_PRESENT_TASK_ENGINE_GAP',details);
 if(activeTaskSamples>0&&linkedNodeSamples===0)
  return unknown('INFL_CORE_TASK_NODE_LINEAGE_GAP',details);
 if(ownerVerifiedSamples>0)
  return unknown('INFL_CORE_LOCK_CANONICAL_UNVERIFIED',details);
 return unknown('INFL_CORE_OWNER_NOT_OBSERVED',details);
}

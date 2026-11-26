// Bounded passive observation before acquiring a B installation lease.
// No Task changes, lock claims, provider calls, operational writes or retries.
import {setTimeout as pauseDefault} from 'node:timers/promises';
import {performance} from 'node:perf_hooks';
import {inspectSidecarBResourceFlagsReadonly} from './operating-probe.mjs';

const STOP=code=>{throw Object.assign(new Error(code),{code});};
// Seven-minute passive window covers the observed five-minute Core cycle.
// No Task, lease, provider or operational write changes.
const WINDOW_MS=420_000;
const STEP_MS=5_000;

export async function awaitNaturalSidecarIdle({
 observe=inspectSidecarBResourceFlagsReadonly,
 pause=pauseDefault,
 clock=()=>performance.now(),
 windowMs=WINDOW_MS,
 stepMs=STEP_MS,
}={}){
 if(typeof observe!=='function'||typeof pause!=='function'||
  typeof clock!=='function'||!Number.isInteger(windowMs)||
  windowMs<0||windowMs>WINDOW_MS||!Number.isInteger(stepMs)||
  stepMs<1||stepMs>STEP_MS)
  STOP('SIDECAR_B_IDLE_WINDOW_CONTRACT_STOP');
 const start=clock();
 if(!Number.isFinite(start))STOP('SIDECAR_B_IDLE_WINDOW_CLOCK_STOP');
 const deadline=start+windowMs;
 const evidence={samples:0,coreActiveSamples:0,sidecarActiveSamples:0,
  controllerBusySamples:0,writerBusySamples:0};
 const stopWithEvidence=code=>{
  const error=Object.assign(new Error(code),{code});
  error.idleObservation={...evidence,windowMs};
  throw error;
 };
 for(;;){
  let flags;
  try{flags=observe();}catch{STOP('SIDECAR_B_IDLE_WINDOW_OBSERVATION_STOP');}
  if(flags?.status!=='PASS'||flags.coreQuiet===null||
   flags.sidecarActive===null||flags.controllerInstallBusy===null||
   flags.sharedWriterLockPresent===null)
   STOP('SIDECAR_B_IDLE_WINDOW_OBSERVATION_STOP');
  evidence.samples++;
  if(flags.coreQuiet===false)evidence.coreActiveSamples++;
  if(flags.sidecarActive===true)evidence.sidecarActiveSamples++;
  if(flags.controllerInstallBusy===true)evidence.controllerBusySamples++;
  if(flags.sharedWriterLockPresent===true)evidence.writerBusySamples++;
  // Another shared writer/Controller owner is not a natural Core cycle.
  // Never hold a lease or wait while another installation owns resources.
  if(flags.controllerInstallBusy!==false||
   flags.sharedWriterLockPresent!==false)
   stopWithEvidence('SIDECAR_B_PROBE_RESOURCE_STOP');
  if(flags.currentPreflightReadyIgnoringLease===true&&
   flags.coreQuiet===true&&flags.sidecarActive===false)return;
  const remaining=deadline-clock();
  if(!Number.isFinite(remaining)||remaining<=0)
   stopWithEvidence('SIDECAR_B_PROBE_RESOURCE_STOP');
  await pause(Math.min(stepMs,remaining));
 }
}

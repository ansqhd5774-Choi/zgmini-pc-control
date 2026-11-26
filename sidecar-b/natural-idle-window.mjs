// Bounded passive observation before acquiring a B installation lease.
// No Task changes, lock claims, provider calls, operational writes or retries.
import {setTimeout as pauseDefault} from 'node:timers/promises';
import {performance} from 'node:perf_hooks';
import {inspectSidecarBResourceFlagsReadonly} from './operating-probe.mjs';

const STOP=code=>{throw Object.assign(new Error(code),{code});};
// W06: 4-minute window missed the verified quiet interval of a 5-minute Core cycle.
// Passive/read-only only; source, Task, lock, receiver and B approval unchanged.
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
 for(;;){
  let flags;
  try{flags=observe();}catch{STOP('SIDECAR_B_IDLE_WINDOW_OBSERVATION_STOP');}
  if(flags?.status!=='PASS'||flags.coreQuiet===null||
   flags.sidecarActive===null||flags.controllerInstallBusy===null||
   flags.sharedWriterLockPresent===null)
   STOP('SIDECAR_B_IDLE_WINDOW_OBSERVATION_STOP');
  // Another shared writer/Controller owner is not a natural Core cycle.
  // Never hold a lease or wait while another installation owns resources.
  if(flags.controllerInstallBusy!==false||
   flags.sharedWriterLockPresent!==false)
   STOP('SIDECAR_B_PROBE_RESOURCE_STOP');
  if(flags.currentPreflightReadyIgnoringLease===true&&
   flags.coreQuiet===true&&flags.sidecarActive===false)return;
  const remaining=deadline-clock();
  if(!Number.isFinite(remaining)||remaining<=0)
   STOP('SIDECAR_B_PROBE_RESOURCE_STOP');
  await pause(Math.min(stepMs,remaining));
 }
}

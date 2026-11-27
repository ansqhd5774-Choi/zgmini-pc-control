import test from 'node:test';
import assert from 'node:assert/strict';
import {awaitNaturalCoreIdle,MAX_CORE_IDLE_WAIT_MS,
 MAX_POST_PREPARE_IDLE_WAIT_MS} from './core-idle-window.mjs';
import {coreReadyForMaintenance,coreMaintenanceWindowBlockCode} from './windows-guards.mjs';

const ready={enabled:true,state:3,instances:0,
 relatedProcesses:0,unknownProcessLines:0};
const running={...ready,state:4,relatedProcesses:2};
function harness(observations){
 let t=0,index=0;
 const calls={samples:0,sleeps:0};
 const opts={
  sample:async()=>{
   calls.samples++;
   return observations[Math.min(index++,observations.length-1)];
  },
  wait:async ms=>{assert.equal(ms,1500);calls.sleeps++;t+=ms;},
  clock:()=>t,
  isReady:coreReadyForMaintenance,
  blockCode:coreMaintenanceWindowBlockCode,
 };
 return {opts,calls};
}

test('Core runs first, then two consecutive READY samples allow a later pause',async()=>{
 const {opts,calls}=harness([
  {probe:running,lock:true},
  {probe:ready,lock:false},{probe:ready,lock:false}
 ]);
 const out=await awaitNaturalCoreIdle(opts,{windowMs:6000});
 assert.deepEqual(out,{status:'CORE_PREPAUSE_IDLE',samples:3});
 assert.equal(calls.samples,3);
 assert.equal(calls.sleeps,2);
});

test('one READY sample interrupted by Core activity is never enough',async()=>{
 const {opts,calls}=harness([
  {probe:ready,lock:false},{probe:running,lock:true},
  {probe:ready,lock:false},{probe:running,lock:true}
 ]);
 await assert.rejects(awaitNaturalCoreIdle(opts,{windowMs:6000}),
  {code:'WRITER_B_CORE_ACTIVE_WINDOW_DEFERRED'});
 assert.equal(calls.samples,4);
});

test('live Core lock/process remains busy: six-minute policy defers without Task writes',async()=>{
 const {opts,calls}=harness([{probe:running,lock:true}]);
 await assert.rejects(awaitNaturalCoreIdle(opts,{windowMs:4500}),
  {code:'WRITER_B_CORE_ACTIVE_WINDOW_DEFERRED'});
 assert.equal(calls.samples,3);
});

test('unknown scheduler state does not become an idle pass',async()=>{
 const {opts}=harness([{probe:{...ready,state:0},lock:false}]);
 await assert.rejects(awaitNaturalCoreIdle(opts,{windowMs:1500}),
  {code:'WRITER_B_CORE_WINDOW_UNVERIFIED_DEFERRED'});
});

test('bounded invalid input and frozen clock cannot create infinite waiting',async()=>{
 const {opts}=harness([{probe:running,lock:true}]);
 await assert.rejects(awaitNaturalCoreIdle(opts,{windowMs:360001}),
  {code:'WRITER_B_CORE_IDLE_WAIT_CONTRACT_STOP'});
 const frozen={...opts,wait:async()=>{}};
 await assert.rejects(awaitNaturalCoreIdle(frozen,{windowMs:1500}),
  {code:'WRITER_B_CORE_ACTIVE_WINDOW_DEFERRED'});
});

test('read-only sample failure propagates without Task mutation',async()=>{
 const {opts}=harness([]);
 opts.sample=()=>{throw Object.assign(new Error('probe unavailable'),
  {code:'WRITER_B_TASK_PROBE_STOP'});};
 await assert.rejects(awaitNaturalCoreIdle(opts,{windowMs:1500}),
  {code:'WRITER_B_TASK_PROBE_STOP'});
});

test('safe timeout evidence counts intermittent READY and ACTIVE without exposing probes',async()=>{
 const {opts}=harness([
  {probe:ready,lock:false},{probe:running,lock:true},
  {probe:ready,lock:false},{probe:running,lock:true}
 ]);
 await assert.rejects(awaitNaturalCoreIdle(opts,{windowMs:6000}),error=>{
  assert.equal(error.code,'WRITER_B_CORE_ACTIVE_WINDOW_DEFERRED');
  assert.deepEqual(error.idleObservation,{windowMs:6000,samples:4,
   readySamples:2,activeSamples:2,otherSamples:0,maxReadyStreak:1});
  assert.equal(JSON.stringify(error).includes('relatedProcesses'),false);
  return true;
 });
});

test('post-prepare natural idle is bounded to 90 seconds inside 12-minute job',async()=>{
 assert.equal(MAX_CORE_IDLE_WAIT_MS,360000);
 assert.equal(MAX_POST_PREPARE_IDLE_WAIT_MS,90000);
 // 12-minute Actions timeout must retain room for prep, final Core drain,
 // restoration and result upload; do not add a second six-minute wait.
 assert.ok(MAX_CORE_IDLE_WAIT_MS+MAX_POST_PREPARE_IDLE_WAIT_MS+90000
  <12*60000);
 const {opts,calls}=harness([{probe:running,lock:true}]);
 await assert.rejects(awaitNaturalCoreIdle(opts,
  {windowMs:MAX_POST_PREPARE_IDLE_WAIT_MS}),
  {code:'WRITER_B_CORE_ACTIVE_WINDOW_DEFERRED'});
 assert.equal(calls.samples,60);
 assert.equal(calls.sleeps,60);
});

// The bounded failure evidence identifies the last blocker, not the historical
// cause of any earlier sample. No process metadata may escape this field.
test('idle failure captures only last numeric task and lock observation',async()=>{
 const probe={enabled:true,state:4,instances:1,relatedProcesses:2,
  unknownProcessLines:0,privateCommandLine:'never-export'};
 const options={sample:async()=>({probe,lock:true}),wait:async()=>{},
  clock:(()=>{let t=0;return()=>t+=1500;})(),isReady:()=>false,
  blockCode:()=> 'WRITER_B_CORE_ACTIVE_WINDOW_DEFERRED'};
 await assert.rejects(awaitNaturalCoreIdle(options,{windowMs:6000}),err=>{
  assert.deepEqual(err.idleObservation.lastBlocker,{enabled:true,state:4,
   instances:1,relatedProcesses:2,unknownProcessLines:0,cycleLockPresent:true});
  assert.doesNotMatch(JSON.stringify(err.idleObservation),/privateCommandLine|never-export/);
  return true;
 });
});

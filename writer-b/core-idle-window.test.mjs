import test from 'node:test';
import assert from 'node:assert/strict';
import {awaitNaturalCoreIdle} from './core-idle-window.mjs';
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

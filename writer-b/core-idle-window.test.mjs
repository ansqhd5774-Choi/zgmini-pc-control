import test from 'node:test';
import assert from 'node:assert/strict';
import {awaitNaturalCoreIdle,MAX_CORE_IDLE_WAIT_MS,
 MAX_POST_PREPARE_IDLE_WAIT_MS,isReservedCoreMaintenance,coreDrainWaitMs,
 EXTENDED_CORE_DRAIN_MS} from './core-idle-window.mjs';
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

test('extended reserve never promotes legacy mode and leaves time for restore',()=>{
 assert.equal(coreDrainWaitMs(undefined),90000);
 assert.equal(coreDrainWaitMs('PAUSE_NEW_STARTS_DRAIN_360S_V1'),360000);
 assert.equal(coreDrainWaitMs('PAUSE_NEW_STARTS_DRAIN_1200S_V1'),1200000);
 assert.equal(EXTENDED_CORE_DRAIN_MS,1200000);
 assert.equal(isReservedCoreMaintenance(undefined),false);
 assert.equal(isReservedCoreMaintenance('PAUSE_NEW_STARTS_DRAIN_360S_V1'),true);
 assert.equal(isReservedCoreMaintenance('PAUSE_NEW_STARTS_DRAIN_1200S_V1'),true);
 for(const mode of [null,'PAUSE_NEW_STARTS_DRAIN_1800S_V1',
  'PAUSE_NEW_STARTS_DRAIN_999S_V1']){
  assert.equal(isReservedCoreMaintenance(mode),false);
  assert.throws(()=>coreDrainWaitMs(mode),
   {code:'WRITER_B_MAINTENANCE_APPROVAL_STOP'});
 }
 // The 30-minute Actions job retains 10 minutes for staging and cleanup.
 assert.ok(EXTENDED_CORE_DRAIN_MS+10*60000<=30*60000);
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

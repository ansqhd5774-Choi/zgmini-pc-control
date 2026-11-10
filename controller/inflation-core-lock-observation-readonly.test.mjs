import test from 'node:test';
import assert from 'node:assert/strict';
import {observeInflationCoreLock} from './inflation-core-lock-observation-readonly.mjs';

function fixture(rows,{windowMs=10,intervalMs=2}={}){
 let now=0,ix=0;
 const calls=[];
 const ctx={
  platform:'win32',queryTask:name=>{calls.push(['task',name]);
   return Buffer.from('<Task>'+name.repeat(5)+'</Task>');},
  realpath:value=>value,
  exists:()=>true,clock:()=>now,
  wait:async ms=>{calls.push(['wait',ms]);now+=ms;},
  sample:()=>{calls.push(['sample']);return rows[Math.min(ix++,rows.length-1)];},
  windowMs,intervalMs,
 };
 return {ctx,calls};
}
const absent={status:'STATE_UNKNOWN',code:'CORE_NO_ACTIVE_TASK_ENGINE',
 lockOwner:{status:'ABSENT'}};
const engine={status:'STATE_UNKNOWN',code:'CORE_LINKED_NODE_NOT_OBSERVED',
 runningTaskInstances:1,lockOwner:{status:'UNVERIFIED'}};
const active={status:'PASS',code:'CORE_RUNTIME_SOURCE_VERIFIED',
 runningTaskInstances:1,runtimeSourceVerified:true,
 lockOwner:{status:'VERIFIED_ACTIVE_CORE'}};

test('observes Task-linked E lock without any scheduling or data writes',async()=>{
 const f=fixture([absent,engine,active]);
 const got=await observeInflationCoreLock(f.ctx);
 assert.equal(got.status,'PASS');
 assert.equal(got.code,'INFL_CORE_TASK_LINKED_E_LOCK_OBSERVED');
 assert.equal(got.samples,3);
 assert.equal(got.taskRuntimeHomeVerified,false);
 assert.equal(got.koreaRuntimeVerified,false);
 assert.equal(got.authorizesB,false);
 assert.equal(got.operationalWrites,0);
 assert.equal(got.providerCalls,0);
 assert.equal(got.d1Writes,0);
 assert.deepEqual(f.calls.filter(x=>x[0]==='task').map(x=>x[1]),
  ['ZGMINI-PC-Local-Core','ZGMINI-PC-Local-Korea']);
 assert.doesNotMatch(JSON.stringify(got),/pid|commandline|secret/i);
});

test('a lock without an observed Task Engine is not a pass',async()=>{
 const f=fixture([absent]);
 const got=await observeInflationCoreLock(f.ctx);
 assert.equal(got.status,'STATE_UNKNOWN');
 assert.equal(got.code,'INFL_CORE_LOCK_PRESENT_TASK_ENGINE_GAP');
 assert.equal(got.authorizesB,false);
});

test('Task Engine without a linked Node is a distinct unknown',async()=>{
 const f=fixture([engine]);
 const got=await observeInflationCoreLock(f.ctx);
 assert.equal(got.code,'INFL_CORE_TASK_NODE_LINEAGE_GAP');
});

test('an existing Core snapshot lineage-gap code counts as an active engine',async()=>{
 const f=fixture([{status:'STATE_UNKNOWN',code:'CORE_LINKED_NODE_NOT_OBSERVED'}]);
 const got=await observeInflationCoreLock(f.ctx);
 assert.equal(got.code,'INFL_CORE_TASK_NODE_LINEAGE_GAP');
 assert.equal(got.activeTaskSamples,5);
});

test('unresolved physical lock path remains unknown',async()=>{
 const f=fixture([active]);
 f.ctx.realpath=value=>value.endsWith('local-cycle.lock')?
  String.raw`C:\not-the-same\local-cycle.lock`:value;
 const got=await observeInflationCoreLock(f.ctx);
 assert.equal(got.code,'INFL_CORE_LOCK_CANONICAL_UNVERIFIED');
 assert.equal(got.status,'STATE_UNKNOWN');
});

test('unavailable source, Task, root or platform cannot pass',async()=>{
 for(const modify of [
  f=>{f.platform='linux';},
  f=>{f.queryTask=()=>Buffer.from('bad');},
  f=>{f.queryTask=()=>{throw Error('access denied');};},
  f=>{f.realpath=()=>{throw Error('unavailable');};},
  f=>{f.windowMs=330001;},
 ]){
  const f=fixture([active]);modify(f.ctx);
  const got=await observeInflationCoreLock(f.ctx);
  assert.notEqual(got.status,'PASS');
  assert.equal(got.authorizesB,false);
 }
});

test('failed sample reports safe bounded status and never assumes ownership',async()=>{
 const f=fixture([absent]);f.ctx.sample=()=>{throw Error('raw secret');};
 const got=await observeInflationCoreLock(f.ctx);
 assert.equal(got.status,'STATE_UNKNOWN');
 assert.equal(got.codes.INFL_CORE_SAMPLE_UNAVAILABLE,5);
 assert.doesNotMatch(JSON.stringify(got),/raw secret/);
});

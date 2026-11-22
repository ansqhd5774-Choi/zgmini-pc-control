import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectCoreRuntimeSource} from '../controller/core-runtime-source-readonly.mjs';
import {observeInflationCoreLock} from '../controller/inflation-core-lock-observation-readonly.mjs';

// Cross-module source-only fixture: a Task Engine owns one Node process and
// that Node holds the fixed local-cycle.lock. No Windows API or PC file is read.
function linkedCoreFixture(){
 const started=Date.parse('2026-11-14T00:00:00.000Z');
 const lock={state:'PRESENT',pid:130,at:started,fingerprint:'a'.repeat(64)};
 const snapshot={ok:true,engines:[120],runningInstances:1,processes:[
  {pid:120,parentPid:0,name:'taskeng.exe',createdAtMs:started-9000},
  {pid:130,parentPid:120,name:'node.exe',sourceMarker:'E',
   relativeRoot:'fixture',createdAtMs:started-1000},
 ]};
 const source=inspectCoreRuntimeSource({
  platform:'win32',systemRoot:String.raw`C:\Windows`,
  probe:()=>({status:0,stdout:JSON.stringify(snapshot)}),
  exists:()=>true,realpath:value=>value,
  lstat:()=>({isFile:()=>true,isSymbolicLink:()=>false,size:64}),
  read:()=>Buffer.alloc(64,65),
  readLock:()=>lock,
  sourceIdentity:()=>({status:'VERIFIED',sourceSha:'a'.repeat(40),
   approvedSourceSha:'a'.repeat(40),files:[]}),
 });
 return {source,started};
}
function inflationFixture(sample,started){
 let now=started+1000;
 return {
  platform:'win32',
  queryTask:()=>Buffer.alloc(64,88),
  realpath:value=>value,
  exists:()=>true,
  clock:()=>now,wait:async ms=>{now+=ms;},
  windowMs:0,intervalMs:1,
  sample:()=>sample,
 };
}

test('actual Core-source producer exposes verified lock owner to inflation observer',async()=>{
 const {source,started}=linkedCoreFixture();
 assert.equal(source.status,'PASS');
 assert.equal(source.runtimeSourceVerified,true);
 assert.equal(source.lockOwner?.status,'VERIFIED_ACTIVE_CORE');
 assert.equal(source.runningTaskInstances,1);
 const result=await observeInflationCoreLock(inflationFixture(source,started));
 assert.equal(result.status,'PASS');
 assert.equal(result.code,'INFL_CORE_TASK_LINKED_E_LOCK_OBSERVED');
 assert.equal(result.ownerVerifiedSamples,1);
 assert.equal(result.authorizesB,false);
 assert.equal(result.operationalWrites,0);
 assert.equal(result.providerCalls,0);
 assert.equal(result.d1Writes,0);
 assert.doesNotMatch(JSON.stringify(result),/secret|commandline/i);
});

test('old producer without lockOwner cannot falsely pass the new observer',async()=>{
 const {source,started}=linkedCoreFixture();
 const {lockOwner,...oldProducerShape}=source;
 assert.equal(lockOwner.status,'VERIFIED_ACTIVE_CORE');
 const result=await observeInflationCoreLock(
  inflationFixture(oldProducerShape,started));
 assert.equal(result.status,'STATE_UNKNOWN');
 assert.equal(result.code,'INFL_CORE_OWNER_NOT_OBSERVED');
 assert.equal(result.ownerVerifiedSamples,0);
 assert.equal(result.authorizesB,false);
});

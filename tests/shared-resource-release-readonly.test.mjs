import test from 'node:test';
import assert from 'node:assert/strict';
import {
 classifySharedResourceSamples,inspectSharedResourceReleaseReadonly,
} from '../controller/shared-resource-release-readonly.mjs';

const source='a'.repeat(40),taskXml='b'.repeat(64);
const task={ok:true,enabled:true,state:3,instances:0,
 relatedProcesses:0,unknownProcessLines:0};
function snapshot(ms=10000,extra={}){
 return {task:{...task},taskXmlSha256:taskXml,configSourceSha:source,
   coreLock:false,writerLock:false,observedAtMs:ms,...extra};
}

test('two natural idle observations yield only a candidate; never replan',()=>{
 const result=classifySharedResourceSamples(snapshot(),snapshot(11500));
 assert.equal(result.status,'PASS');
 assert.equal(result.resources['writer-source'].state,'CANDIDATE_CLEAR_NOT_AUTHORIZED');
 assert.equal(result.releaseVerified,false);
 assert.equal(result.runtimeSourceVerified,false);
 assert.equal(result.approvalVerified,false);
 assert.equal(result.ownerReplanAuthorized,false);
 assert.equal(result.automaticPcRetries,0);
 assert.equal(result.operationalWrites,0);
 assert.ok(!JSON.stringify(result).includes('READY_FOR_OWNER_REPLAN'));
});

test('active Core or protected Writer lock means observed busy',()=>{
 const busy=[
  snapshot(11500,{writerLock:true}),
  snapshot(11500,{coreLock:true}),
  snapshot(11500,{task:{...task,instances:1,state:4}}),
 ];
 for(const second of busy){
  const r=classifySharedResourceSamples(snapshot(),second);
  assert.equal(r.resources['writer-source'].state,'OBSERVED_BUSY');
  assert.equal(r.releaseVerified,false);
 }
});

test('disabled, queued or inconclusive Task state is never free',()=>{
 for(const partial of [
  {enabled:false,state:1}, {state:2}, {unknownProcessLines:1},
 ]){
  const r=classifySharedResourceSamples(snapshot(),
    snapshot(11500,{task:{...task,...partial}}));
  assert.equal(r.resources['writer-source'].state,'UNVERIFIED');
 }
});

test('source or scheduler definition drift prohibits clear candidate',()=>{
 for(const change of [
  {configSourceSha:'c'.repeat(40)},
  {taskXmlSha256:'d'.repeat(64)},
 ]){
  const r=classifySharedResourceSamples(snapshot(),snapshot(11500,change));
  assert.equal(r.sourceStable,false);
  assert.equal(r.resources['writer-source'].state,'UNVERIFIED');
 }
});

test('same-time, old-time and malformed evidence fail closed',()=>{
 for(const second of [
  snapshot(10000),snapshot(200),snapshot(50000),
  snapshot(11500,{task:{...task,unknownProcessLines:-1}}),
  snapshot(11500,{configSourceSha:'invalid'}),
 ]){
  assert.equal(classifySharedResourceSamples(snapshot(),second).status,'STATE_UNKNOWN');
 }
});

test('unverified resource types remain unknown even when Writer candidate clear',()=>{
 const r=classifySharedResourceSamples(snapshot(),snapshot(11500));
 for(const key of ['controller-install','pc-job-heavy-memory','result-upload'])
  assert.equal(r.resources[key].state,'UNVERIFIED');
});

test('A operation takes two samples and performs no automatic execution',async()=>{
 let calls=0,waited=[];
 const out=await inspectSharedResourceReleaseReadonly({platform:'win32',
  sample:()=>snapshot(10000+calls++*1500),wait:async ms=>waited.push(ms)});
 assert.deepEqual(waited,[1500]);
 assert.equal(calls,2);
 assert.equal(out.resources['writer-source'].state,'CANDIDATE_CLEAR_NOT_AUTHORIZED');
 assert.equal(out.providerCalls,0);
 assert.equal(out.d1Writes,0);
});

test('probe failure and non-Windows environment return state unknown',async()=>{
 const failed=await inspectSharedResourceReleaseReadonly({platform:'win32',
  sample:()=>{throw Error('secret data');},wait:async()=>{}});
 assert.equal(failed.code,'SHARED_RESOURCE_READONLY_PROBE_UNAVAILABLE');
 assert.equal(failed.releaseVerified,false);
 assert.doesNotMatch(JSON.stringify(failed),/secret data/);
 const linux=await inspectSharedResourceReleaseReadonly({platform:'linux',
  sample:()=>{throw Error('MUST_NOT_RUN');}});
 assert.equal(linux.code,'SHARED_RESOURCE_WINDOWS_REQUIRED');
});

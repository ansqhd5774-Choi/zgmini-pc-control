import test from 'node:test';
import assert from 'node:assert/strict';
import {projectD05WriterTiming,projectD05WriterCheckpoint}
 from '../tools/pc-process-inventory-readonly.mjs';

const validTiming=()=>({
 scope:'ATTEMPT_OUTPUT_CALLBACKS_ONLY_NOT_FULL_CORE_OR_WRITER',
 samples:3,totalMeasuredMs:6050,
 byStage:{
  market:{samples:1,totalMs:6000,failed:0},
  'feed-publication':{samples:1,totalMs:30,failed:0},
  secret:{samples:1,totalMs:20,failed:1},
 },
 slowest:[
  {stage:'market',elapsedMs:6000,success:true},
  {stage:'feed-publication',elapsedMs:30,success:true},
  {stage:'secret',elapsedMs:20,success:false},
 ],
 rawInputs:'PRIVATE_MARKET_SOURCE',credential:'HIDDEN',
});

test('existing one-file D05 Writer reader returns bounded timings without raw key leakage',()=>{
 const timing=projectD05WriterTiming(validTiming());
 assert.equal(timing.status,'OBSERVED_LOCAL_CHECKPOINT');
 assert.equal(timing.samples,3);
 assert.equal(timing.totalMeasuredMs,6050);
 assert.equal(timing.byStage.length,3);
 assert.equal(timing.slowest[0].stage,'market');
 assert.equal(timing.byStage.find(x=>x.totalMs===20).stage,'other-stages');
 assert.equal(timing.slowest[2].stage,'other-stages');
 assert.doesNotMatch(JSON.stringify(timing),/secret|PRIVATE_MARKET_SOURCE|HIDDEN|credential/i);
 assert.ok(Buffer.byteLength(JSON.stringify(timing))<8192);
});

test('old Writer checkpoint stays PASS with timing not recorded, never fabricated',()=>{
 const raw={at:'2026-11-24T02:46:24.023Z',status:'VERIFIED',mode:'PUBLISH',
  source:'a'.repeat(40),market:{status:'VERIFIED'},
  compositeObserved:{status:'UNCHANGED'}};
 const old=projectD05WriterCheckpoint(raw);
 assert.equal(old.status,'READ_ONLY_OBSERVED');
 assert.equal(old.writerStageTiming.status,'NOT_RECORDED');
 assert.equal(old.compositeArchiveStage,'UNCHANGED');
 assert.equal(old.localArchiveNewEventProven,false);
 const recent=projectD05WriterCheckpoint({...raw,writerStageTiming:validTiming()});
 assert.equal(recent.status,'READ_ONLY_OBSERVED');
 assert.equal(recent.writerStageTiming.status,'OBSERVED_LOCAL_CHECKPOINT');
 assert.equal(recent.publicD1Verified,false);
 assert.equal(recent.recoveryEligible,false);
});

test('untrusted or oversized Writer timing fails closed without invalidating other outputs',()=>{
 for(const bad of [
  {...validTiming(),scope:'PRIVATE_DIAGNOSTIC'},
  {...validTiming(),samples:900000},
  {...validTiming(),byStage:{market:{samples:3,totalMs:1,failed:4}}},
  {...validTiming(),slowest:Array.from({length:13},()=>validTiming().slowest[0])},
  {...validTiming(),slowest:[{stage:'PASSWORD',elapsedMs:20,success:true}]},
  {...validTiming(),totalMeasuredMs:1},
 ])assert.equal(projectD05WriterTiming(bad).status,'UNVERIFIED');
 const out=projectD05WriterCheckpoint({
  at:'2026-11-24T02:46:24.023Z',status:'VERIFIED',mode:'PUBLISH',
  source:'a'.repeat(40),writerStageTiming:{scope:'PRIVATE_SECRET'},
 });
 assert.equal(out.status,'READ_ONLY_OBSERVED');
 assert.equal(out.writerStageTiming.status,'UNVERIFIED');
 assert.doesNotMatch(JSON.stringify(out),/PRIVATE_SECRET/);
});

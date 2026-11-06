import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {inspectUsBreadthR17Runtime} from '../controller/us-breadth-r17-runtime-readonly.mjs';

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(),'r17-runtime-fixture-'));
  fs.mkdirSync(path.join(root,'pc-writer'));
  t.after(() => fs.rmSync(root,{recursive:true,force:true}));
  const write = (name,value) => fs.writeFileSync(path.join(root,'pc-writer',name),JSON.stringify(value));
  return {root,write};
}

const correctOutput = () => ({
  version:1,phase:'PROVISIONAL',status:'PROVISIONAL',market:'usa',universe:'SP500',
  source:'ALPACA_IEX_15MIN_SPLIT',referenceSource:'ALPACA_IEX_1DAY_SPLIT',
  methodologyVersion:'OBSERVED_ISSUE_DIRECTION_COUNTS_R1',
  observationDate:'2026-11-06',priorDate:'2026-11-05',
  slotEndUtc:'2026-11-06T14:45:00Z',collectedAt:'2026-11-06T14:48:00Z',
  expectedCount:500,observedCount:490,missingCount:10,
  sessionPriceObservedCount:493,referenceObservedCount:497,freshWithin30m:488,coverage:0.98,
  counts:{rising:300,falling:180,unchanged:10},collectionStatus:'COMPLETE',
});

test('stored R17 collection validates counters without claiming current slot or exposing raw bars',t=>{
  const f=fixture(t);
  f.write('local-cycle-last-run.json',{
    status:'COMPLETE',lane:'core',usProvisional:{status:'LOCAL_READY',slotEndUtc:'2026-11-06T14:45:00Z'},
    usProvisionalEarlyPublication:{status:'VERIFIED'},
  });
  f.write('local-us-breadth-iex-provisional.json',{
    attemptStatus:'LOCAL_READY',attemptedAt:'2026-11-06T14:49:00Z',lastAttemptSlot:'2026-11-06:2026-11-06T14:45:00Z',
    raw:{members:['DO_NOT_EXPOSE_TICKER'],apiKey:'DO_NOT_EXPOSE_SECRET'},output:correctOutput(),
  });
  f.write('local-us-breadth-provisional-early-last-run.json',{
    status:'VERIFIED',inputStatus:'READY',publication:{status:'VERIFIED'},slotEndUtc:'2026-11-06T14:45:00Z',
  });
  const result=inspectUsBreadthR17Runtime(f.root,{now:new Date('2026-11-06T14:50:00Z')});
  assert.equal(result.status,'PASS');
  assert.equal(result.evidenceStatus,'LOCAL_READY_STORED');
  assert.equal(result.currentSlotVerified,false);
  assert.equal(result.cycleSlotMatch,'MATCH');
  assert.equal(result.storedFreshness,'RECENT_30M_SESSION_UNVERIFIED');
  assert.equal(result.slotAgeMinutes,5);
  assert.equal(result.cycle.usProvisional,'LOCAL_READY');
  assert.equal(result.sidecar.expectedCount,500);
  assert.equal(result.sidecar.observedCount,490);
  assert.equal(result.sidecar.missingCount,10);
  assert.equal(result.sidecar.coverage,0.98);
  assert.equal(result.sidecar.observationDate,'2026-11-06');
  assert.equal(result.sidecar.collectedAt,'2026-11-06T14:48:00Z');
  assert.equal(result.sidecar.sha256.length,64);
  assert.equal(result.earlyPublication.publicationStatus,'VERIFIED');
  assert.equal(result.operationalWrites,0);
  assert.equal(result.providerCalls,0);
  assert.equal(result.d1Writes,0);
  assert.doesNotMatch(JSON.stringify(result),/DO_NOT_EXPOSE_TICKER|DO_NOT_EXPOSE_SECRET/);
});

test('old LOCAL_READY sidecar is only historical saved evidence, never current',t=>{
  const f=fixture(t);
  f.write('local-cycle-last-run.json',{
    status:'COMPLETE',lane:'core',usProvisional:{status:'OUTSIDE_NY_SESSION',slotEndUtc:'2026-11-09T15:00:00Z'},
  });
  f.write('local-us-breadth-iex-provisional.json',{attemptStatus:'LOCAL_READY',output:correctOutput()});
  const result=inspectUsBreadthR17Runtime(f.root,{now:new Date('2026-11-09T16:00:00Z')});
  assert.equal(result.evidenceStatus,'LOCAL_READY_STORED');
  assert.equal(result.storedFreshness,'STALE_OVER_30M');
  assert.equal(result.cycleSlotMatch,'MISMATCH');
  assert.equal(result.currentSlotVerified,false);
});

test('a cycle without slot timestamp keeps cycle reconciliation unavailable',t=>{
  const f=fixture(t);
  f.write('local-cycle-last-run.json',{status:'COMPLETE',lane:'core',usProvisional:{status:'OUTSIDE_NY_SESSION'}});
  f.write('local-us-breadth-iex-provisional.json',{attemptStatus:'LOCAL_READY',output:correctOutput()});
  const result=inspectUsBreadthR17Runtime(f.root,{now:new Date('2026-11-06T14:47:00Z')});
  assert.equal(result.cycleSlotMatch,'UNAVAILABLE');
  assert.equal(result.storedFreshness,'RECENT_30M_SESSION_UNVERIFIED');
  assert.equal(result.currentSlotVerified,false);
});

test('absence before first eligible NY 15-minute slot is not a runtime failure',t=>{
  const f=fixture(t);
  f.write('local-cycle-last-run.json',{status:'COMPLETE',lane:'core',usProvisional:{status:'OUTSIDE_NY_SESSION'}});
  const result=inspectUsBreadthR17Runtime(f.root,{now:new Date('2026-11-06T12:26:00Z')});
  assert.equal(result.status,'PASS');
  assert.equal(result.evidenceStatus,'NOT_YET_ELIGIBLE');
  assert.equal(result.sidecar.state,'MISSING');
  assert.equal(result.cycle.usProvisional,'OUTSIDE_NY_SESSION');
});

test('a count mismatch is reported without falsely proving LOCAL_READY',t=>{
  const f=fixture(t);
  const output=correctOutput();output.missingCount=9;
  f.write('local-us-breadth-iex-provisional.json',{attemptStatus:'LOCAL_READY',output});
  const result=inspectUsBreadthR17Runtime(f.root,{now:new Date('2026-11-06T15:00:00Z')});
  assert.equal(result.status,'PASS');
  assert.equal(result.evidenceStatus,'INVALID_OUTPUT');
  assert.equal(result.sidecar.outputValid,false);
  assert.equal(result.sidecar.missingCount,9);
});

test('approved source contract, counter coverage and dates must match valid readback',t=>{
  const invalidCases=[
    x=>{x.source='SOME_OTHER_PROVIDER';},
    x=>{x.referenceSource='SOME_OTHER_REFERENCE';},
    x=>{x.methodologyVersion='UNAPPROVED_METHOD';},
    x=>{x.coverage=0.9;},
    x=>{x.sessionPriceObservedCount=489;},
    x=>{x.referenceObservedCount=489;},
    x=>{x.freshWithin30m=491;},
    x=>{x.observationDate='2026-11-31';},
    x=>{x.counts.extraUndocumentedCount=0;},
  ];
  for (const change of invalidCases) {
    const f=fixture(t);
    const output=correctOutput();change(output);
    f.write('local-us-breadth-iex-provisional.json',{attemptStatus:'LOCAL_READY',output});
    const result=inspectUsBreadthR17Runtime(f.root,{now:new Date('2026-11-06T14:50:00Z')});
    assert.equal(result.evidenceStatus,'INVALID_OUTPUT');
    assert.equal(result.sidecar.outputValid,false);
    assert.equal(result.currentSlotVerified,false);
  }
});

test('malformed or oversized sidecar does not disclose content or throw',t=>{
  const f=fixture(t);
  fs.writeFileSync(path.join(f.root,'pc-writer','local-us-breadth-iex-provisional.json'),'{DO_NOT_EXPOSE_BAD_JSON');
  const result=inspectUsBreadthR17Runtime(f.root,{now:new Date('2026-11-06T15:00:00Z')});
  assert.equal(result.status,'PASS');
  assert.equal(result.evidenceStatus,'SIDECAR_INVALID_JSON');
  assert.equal(result.sidecar.state,'INVALID_JSON');
  assert.doesNotMatch(JSON.stringify(result),/DO_NOT_EXPOSE_BAD_JSON/);
});


test('IEX failure code is safely included without exposing raw provider error or secrets',t=>{
  const f=fixture(t);
  f.write('local-cycle-last-run.json',{
    status:'PUBLICATION_NOT_VERIFIED',lane:'core',
    usProvisional:{status:'FAILED_PREVIOUS_PROVISIONAL_PRESERVED',code:'US_PROVISIONAL_HTTP_403'},
  });
  f.write('local-us-breadth-iex-provisional.json',{
    attemptStatus:'FAILED',lastAttemptSlot:'2026-11-06:600',output:correctOutput(),
    raw:{secret:'DO_NOT_EXPOSE_SECRET'},
  });
  const result=inspectUsBreadthR17Runtime(f.root,{now:new Date('2026-11-06T16:05:00Z')});
  assert.equal(result.status,'PASS');
  assert.equal(result.evidenceStatus,'LAST_ATTEMPT_UNVERIFIED');
  assert.equal(result.cycle.usProvisional,'FAILED_PREVIOUS_PROVISIONAL_PRESERVED');
  assert.equal(result.cycle.usProvisionalCode,'US_PROVISIONAL_HTTP_403');
  assert.doesNotMatch(JSON.stringify(result),/DO_NOT_EXPOSE_SECRET/);

  f.write('local-cycle-last-run.json',{
    status:'PUBLICATION_NOT_VERIFIED',lane:'core',
    usProvisional:{status:'FAILED_PREVIOUS_PROVISIONAL_PRESERVED',
      code:'US_PROVISIONAL_HTTP_403\\nDO_NOT_EXPOSE_KEY'},
  });
  const tainted=inspectUsBreadthR17Runtime(f.root,{now:new Date('2026-11-06T16:05:00Z')});
  assert.equal(tainted.cycle.usProvisionalCode,null);
  assert.doesNotMatch(JSON.stringify(tainted),/DO_NOT_EXPOSE_KEY/);
});


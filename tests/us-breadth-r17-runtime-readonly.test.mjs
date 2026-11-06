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
  slotEndUtc:'2026-11-06T14:45:00Z',collectedAt:'2026-11-06T14:48:00Z',
  expectedCount:500,observedCount:490,missingCount:10,
  counts:{rising:300,falling:180,unchanged:10},collectionStatus:'COMPLETE',
});

test('saved R17 natural collection verifies exact counts without exposing raw bars',t=>{
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
  assert.equal(result.evidenceStatus,'LOCAL_READY_VERIFIED');
  assert.equal(result.cycle.usProvisional,'LOCAL_READY');
  assert.equal(result.sidecar.expectedCount,500);
  assert.equal(result.sidecar.observedCount,490);
  assert.equal(result.sidecar.missingCount,10);
  assert.equal(result.sidecar.sha256.length,64);
  assert.equal(result.earlyPublication.publicationStatus,'VERIFIED');
  assert.equal(result.operationalWrites,0);
  assert.equal(result.providerCalls,0);
  assert.equal(result.d1Writes,0);
  assert.doesNotMatch(JSON.stringify(result),/DO_NOT_EXPOSE_TICKER|DO_NOT_EXPOSE_SECRET/);
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

test('malformed or oversized sidecar does not disclose content or throw',t=>{
  const f=fixture(t);
  fs.writeFileSync(path.join(f.root,'pc-writer','local-us-breadth-iex-provisional.json'),'{DO_NOT_EXPOSE_BAD_JSON');
  const result=inspectUsBreadthR17Runtime(f.root,{now:new Date('2026-11-06T15:00:00Z')});
  assert.equal(result.status,'PASS');
  assert.equal(result.evidenceStatus,'SIDECAR_INVALID_JSON');
  assert.equal(result.sidecar.state,'INVALID_JSON');
  assert.doesNotMatch(JSON.stringify(result),/DO_NOT_EXPOSE_BAD_JSON/);
});

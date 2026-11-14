import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileTreasurySameCycle as check} from './treasury-three-lane-reconcile.mjs';
const requestId='pc-11111111-2222-4333-8444-555555555555';
const sourceSha='643b7c7c4372ffad552443fc312c6cb1b944e2fc';
const controlSha='8e2736a62a90798afe159ef4d96a8713265ca021';
const storedAt=Date.parse('2026-11-09T20:22:39.536Z');
const opts=()=>({expectedRequestId:requestId,expectedSourceSha:sourceSha,apiUrl:'https://zgmini.kr/api/release-calendar'});
const result=()=>({schema:'ZGMINI_PC_RESULT_V1',requestId,operation:'source-inventory-runtime-readonly',
  controlSourceSha:controlSha,actualExecutionSha:controlSha,requestedSourceSha:sourceSha,
  sourceRepository:'ansqhd5774-Choi/zgmini',sourceBranch:'main',status:'PASS',
  code:'SOURCE_INVENTORY_STORED_READONLY',exitCode:0,firstFail:null,providerCalls:0,
  d1Writes:0,operationalWrites:0,protectedStateUnchanged:true,
  result:{status:'PASS',code:'SOURCE_INVENTORY_STORED_READONLY',
    providerCalls:0,d1Writes:0,operationalWrites:0,
    core:{status:'PASS',code:'STORED_INVENTORY_READONLY',treasuryTawsInput:{
      status:'OBSERVED',storedAt,fromDate:'2025-11-10',toDate:'2026-11-09',
      rawRowCount:800,storedAwardedCount:436,eligibleAwardedRows:436,
      eligibleCountMatchesStored:true,textBytes:3050123,textSha256:'a'.repeat(64),
      scope:'ELIGIBLE_RESULT_COUNT_NOT_FULL_PARSER_REVALIDATION'}}}});
const d1=()=>({kind:'output',feed_key:'release-calendar',snapshot_key:'current',stored_at:storedAt,body:'SECRET_D1_BODY'});
const api=()=>({status:'READY',updatedAt:'2026-11-09T20:22:39.536Z',
  sources:{treasury:{status:'READY',checkedAt:'2026-11-09T20:22:39.536Z'}},
  events:[{source:'treasury',date:'2026-11-09',cusip:'SECRET_CUSIP'},
          {source:'treasury',date:'2026-11-09',type:'announcement'},
          {source:'bls',date:'2026-11-09'}]});
const code=(r=result(),d=d1(),a=api(),o=opts())=>check(r,d,a,o).code;
test('realistic same-cycle metadata gets only reviewable, not full D1/API/UI assertion',()=>{
  const v=check(result(),d1(),api(),opts());
  assert.equal(v.status,'METADATA_ALIGNED');
  assert.equal(v.code,'PC_D1_API_METADATA_SAME_CYCLE_REVIEWABLE');
  assert.equal(v.awardedRowsInPrivateInput,436);
  assert.equal(v.publiclyDisplayedTreasuryEvents,2); // raw 436 is NOT events count
  assert.equal(v.rawAwardedEqualsPublicEventCountRequired,false);
  assert.equal(v.featureCompletionApproved,false);
  assert.equal(v.d1BodyEqualityVerified,false);
  assert.equal(v.productionUiVerified,false);
});
test('wrong D1 key is rejected',()=>{const x=d1();x.feed_key='employment-r6';assert.equal(code(result(),x),'D1_EXACT_ROW_METADATA_REQUIRED');});
test('wrong D1 kind is rejected',()=>{const x=d1();x.kind='input';assert.equal(code(result(),x),'D1_EXACT_ROW_METADATA_REQUIRED');});
test('D1 metadata time not equal to API publication time is rejected',()=>{const x=d1();x.stored_at++;assert.equal(code(result(),x),'D1_API_STORED_AT_MISMATCH');});
test('API is stale even when D1 equals private input',()=>{const x=api();x.sources.treasury.checkedAt='2026-11-08T20:22:39.536Z';assert.equal(code(result(),d1(),x),'PUBLIC_API_TIMESTAMPS_INVALID_OR_STALE');});
test('private raw with a wrong storage UTC day is rejected before reconciliation',()=>{
  const x=result();x.result.core.treasuryTawsInput.storedAt+=86400000;
  assert.equal(code(x),'RAW_A_RECEIPT_NOT_REVIEWABLE');
});
test('private raw from another same UTC day cycle differs even when audit is valid',()=>{
  const x=result();x.result.core.treasuryTawsInput.storedAt+=1000;
  assert.equal(code(x),'PC_PRIVATE_RAW_AND_PUBLIC_CYCLE_MISMATCH');
});
test('public JSON READY without treasury source READY is not adequate',()=>{
  const x=api();x.sources.treasury.status='SOURCE_FAILED';
  assert.equal(code(result(),d1(),x),'PUBLIC_API_TREASURY_READY_AND_EVENTS_REQUIRED');
});
test('public API raw response must contain treasury events',()=>{
  const x=api();x.events=[{source:'cftc'}];
  assert.equal(code(result(),d1(),x),'PUBLIC_TREASURY_EVENTS_NOT_FOUND');
});
test('missing original request identity is rejected',()=>{
  assert.equal(code(result(),d1(),api(),{apiUrl:'https://zgmini.kr/api/release-calendar'}),'ORIGINAL_REQUEST_IDENTITY_REQUIRED');
});
test('incorrect public API origin is rejected',()=>{
  const x=opts();x.apiUrl='https://evil.example.com/api/release-calendar';
  assert.equal(code(result(),d1(),api(),x),'EXPECTED_PUBLIC_API_ORIGIN_MISSING');
});
test('private result bad counts means no reconciliation',()=>{
  const x=result();x.result.core.treasuryTawsInput.eligibleAwardedRows=435;
  assert.equal(code(x),'RAW_A_RECEIPT_NOT_REVIEWABLE');
});
test('unrelated history-WAL unknown can preserve limited aligned metadata, never PASS',()=>{
  const x=result();x.status='STATE_UNKNOWN';x.code='SOURCE_INVENTORY_PARTIAL_READONLY';
  x.firstFail='ALLOWLISTED_OPERATION';x.result.status='STATE_UNKNOWN';
  x.result.code='SOURCE_INVENTORY_PARTIAL_READONLY';
  x.result.history={status:'STATE_UNKNOWN',code:'WAL_SIDECARS_ABSENT_UNVERIFIED'};
  const v=check(x,d1(),api(),opts());
  assert.equal(v.status,'CORE_ONLY_METADATA_ALIGNED');
  assert.equal(v.historyWalIndependentEvidenceMissing,true);
  assert.equal(v.featureCompletionApproved,false);
});
test('no private and D1/API bodies leaked in bridge output',()=>{
  const output=JSON.stringify(check(result(),d1(),api(),opts()));
  assert.doesNotMatch(output,/SECRET_CUSIP|SECRET_D1_BODY/);
});
test('old observed 436 is not a fixed requirement for subsequent source date',()=>{
  const x=result();x.result.core.treasuryTawsInput.fromDate='2025-11-11';
  x.result.core.treasuryTawsInput.toDate='2026-11-10';
  x.result.core.treasuryTawsInput.storedAt=Date.parse('2026-11-10T02:00:01Z');
  x.result.core.treasuryTawsInput.storedAwardedCount=440;
  x.result.core.treasuryTawsInput.eligibleAwardedRows=440;
  const y=d1();y.stored_at=Date.parse('2026-11-10T02:00:01Z');
  const z=api();z.updatedAt='2026-11-10T02:00:01.000Z';
  z.sources.treasury.checkedAt=z.updatedAt;
  assert.equal(code(x,y,z),'PC_D1_API_METADATA_SAME_CYCLE_REVIEWABLE');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {W01_R2_KEY} from '../controller/inflation-r2-local-readonly.mjs';
import {verifyInflationR2D1Row} from '../controller/inflation-r2-d1-readback-readonly.mjs';

const config=JSON.parse(fs.readFileSync(new URL('../config/operations.json',import.meta.url),'utf8'));
const body=JSON.stringify({payload:{
 status:'READY',methodologyVersion:'INFLATION_R2_R29_56_IA',score:57.97,
 asOfDate:'2026-11-22',trend:[{label:'2026-11-22',value:57.97}]},
 projection:{status:'READY',sourceVersion:'core:1795350628537:r2',
 sourceStoredAt:1795350628537,builtAt:1795350660521}});
const row={body,stored_at:1795350660521};

test('R2 D1 operation is registered A light and fixed 90s',()=>{
 assert.equal(W01_R2_KEY,'detail:inflation:v1');
 assert.deepEqual(config.operations['inflation-r2-d1-readback-readonly'],
  {grade:'A',timeoutSeconds:90,resource:'light'});
});
test('D1 readback matches a separately verified local row',()=>{
 const reference=verifyInflationR2D1Row(row);
 assert.equal(reference.status,'PASS');
 const x=verifyInflationR2D1Row(row,{expectedLocal:{
  storedAt:reference.d1StoredAt,bodySha256:reference.d1BodySha256,
  score:reference.d1Score,asOfDate:reference.d1AsOfDate}});
 assert.equal(x.status,'PASS');
 assert.equal(x.localMatches,true);
 assert.equal(x.trendDateMatchesAsOf,true);
 assert.equal(x.trendValueMatchesScore,true);
 assert.equal(x.d1Writes,0);
});
test('D1 score/date/bytes mismatch is not a success',()=>{
 const x=verifyInflationR2D1Row(row,{expectedLocal:{
  storedAt:1795350660521,bodySha256:'f'.repeat(64),score:57.97,asOfDate:'2026-11-22'}});
 assert.equal(x.status,'PARTIAL');
 assert.equal(x.code,'W01_R2_D1_LOCAL_MISMATCH');
});
test('missing or invalid D1 records cannot pass',()=>{
 for(const row of [null,{body:'{}',stored_at:1795350660521},
  {body:'{',stored_at:1795350660521}]){
  assert.equal(verifyInflationR2D1Row(row).status,'STATE_UNKNOWN');
 }
});

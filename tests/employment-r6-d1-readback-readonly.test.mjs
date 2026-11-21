import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {verifyR6D1Row,R6_KEY,inspectEmploymentR6D1Readback} from '../controller/employment-r6-d1-readback-readonly.mjs';

const body={kind:'EMPLOYMENT_R6_ONE_YEAR_STORED_DISPLAY_R1',
 methodologyVersion:'EMP-R6-FORMULA-R2-CPS-2025-10',
 formulaHash:'sha256:04486846cd6063452d1c764116d3a31209f074d23a8764bf5b6ec8467095210e',
 sourceStoredAt:1795220421678,asOfDate:'2026-11-21',
 summary:{sourceFeatures:29,chartReadyFeatures:22},
 indicators:Array.from({length:29},(_,i)=>({id:'TEST_'+i}))};
const digest=createHash('sha256').update(JSON.stringify(body)).digest('hex');
const row={body:JSON.stringify(body),stored_at:1795220421700};
const checkpoint={localResultHash:digest,localResultReadback:'VERIFIED',
 sourceStoredAt:body.sourceStoredAt,asOfDate:body.asOfDate};

test('fixed-key R6 readback confirms local hash and withholds raw body',()=>{
 const result=verifyR6D1Row(row,checkpoint);
 assert.equal(R6_KEY,'detail:employment-r6:one-year:v1');
 assert.equal(result.status,'PASS');assert.equal(result.code,'R6_D1_LOCAL_MATCHED');
 assert.equal(result.matchedToLocal,true);assert.equal(result.d1BodyHash,digest);
 assert.equal(result.d1StoredAt,row.stored_at);
 assert.equal(result.providerCalls,0);assert.equal(result.operationalWrites,0);assert.equal(result.d1Writes,0);
 assert.equal(JSON.stringify(result).includes('TEST_1'),false);
});
test('stale or mismatched local checkpoint remains PARTIAL',()=>{
 for(const local of [
  {...checkpoint,localResultHash:'0'.repeat(64)},
  {...checkpoint,sourceStoredAt:1},
  {...checkpoint,localResultReadback:'MISSING'},
  null,
 ]){
  const result=verifyR6D1Row(row,local);
  assert.equal(result.code,'R6_D1_LOCAL_MISMATCH');
  assert.equal(result.status,'PARTIAL');assert.equal(result.matchedToLocal,false);
 }
});
test('bad D1 row and JSON are rejected',()=>{
 assert.equal(verifyR6D1Row(null,checkpoint).code,'R6_D1_ROW_INVALID');
 assert.equal(verifyR6D1Row({...row,body:'{'},checkpoint).code,'R6_D1_JSON_INVALID');
 assert.equal(verifyR6D1Row({...row,stored_at:-1},checkpoint).code,'R6_D1_ROW_INVALID');
});
test('wrong formula, future source timestamp and invalid indicator count fail closed',()=>{
 for(const patch of [
  {formulaHash:'sha256:'+'0'.repeat(64)},
  {sourceStoredAt:row.stored_at+1},
  {indicators:[]},
  {asOfDate:'2026/11/21'},
  {summary:{sourceFeatures:28}},
 ]){
  const result=verifyR6D1Row({...row,body:JSON.stringify({...body,...patch})},checkpoint);
  assert.equal(result.code,'R6_D1_CONTRACT_INVALID');
 }
});
test('invalid unapproved host input does not query D1',async()=>{
 let queried=false;
 const result=await inspectEmploymentR6D1Readback('',{
  queryFixed:async()=>{queried=true;return row;}});
 assert.equal(queried,false);
 assert.equal(result.status,'STATE_UNKNOWN');
});

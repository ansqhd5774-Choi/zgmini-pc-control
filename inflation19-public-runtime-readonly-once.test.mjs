import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectResults,EXPECTED_SOURCE} from './inflation19-public-runtime-readonly-once.mjs';
const ids=['1','3','4','5','6','7','8','9','10','11','12','13','14','18','19','21','25','26','31'];
const base={schemaVersion:'inflation-causal-public-19-r1-v1',sourceVersion:EXPECTED_SOURCE,status:'READY',score:null,
 indicators:ids.map(id=>({id,status:'READY',value:0,previousValue:1,observationDate:'2026-09-01',history:[]}))};
const market={domains:[{id:'inflation',indicators:[1,2,3,4]}]};
const html='물가 구성 지표 / 물가 관련 수집 원자료';
test('19 distinct ready inputs and original 4 independent rows remain',()=>{
 const r=inspectResults(base,market,html);assert.equal(r.status,'PASS');assert.equal(r.ready,19);assert.equal(r.existingScoreRows,4);
});
test('fail closed if missing input, wrong lineage or changed original score rows',()=>{
 assert.throws(()=>inspectResults({...base,status:'PARTIAL'},market,html));
 assert.throws(()=>inspectResults({...base,sourceVersion:'fake'},market,html));
 assert.throws(()=>inspectResults({...base,indicators:base.indicators.slice(1)},market,html));
 assert.throws(()=>inspectResults(base,{domains:[{id:'inflation',indicators:[1,2,3]}]},html));
});
test('HTTP alone is not browser confirmation when HTML markers missing',()=>{
 assert.equal(inspectResults(base,market,'no title').status,'PARTIAL');
});

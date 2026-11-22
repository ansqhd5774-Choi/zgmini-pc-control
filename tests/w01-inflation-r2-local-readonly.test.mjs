import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inspectInflationR2Row,W01_R2_KEY} from '../controller/inflation-r2-local-readonly.mjs';

const config=JSON.parse(readFileSync(new URL('../config/operations.json',import.meta.url),'utf8'));
const make=(date='2026-11-22',value=51)=>({
 body:JSON.stringify({
  payload:{status:'READY',methodologyVersion:'INFLATION_R2_R29_56_IA',
   score:51,asOfDate:'2026-11-22',trend:[
    {label:'2026-10-31',value:48},{label:date,value}]},
  projection:{status:'READY',sourceVersion:'core:1234',
   sourceStoredAt:1234,builtAt:1795345763749}}),
 stored_at:1795345763749
});

test('fixed key and A light registered',()=>{
 assert.equal(W01_R2_KEY,'detail:inflation:v1');
 assert.equal(config.operations['inflation-r2-local-readonly'].grade,'A');
 assert.equal(config.operations['inflation-r2-local-readonly'].resource,'light');
});

test('valid R2 detects corrected final point without changing prior observations',()=>{
 const row=make();
 const original=row.body;
 const result=inspectInflationR2Row(row);
 assert.equal(result.status,'PASS');
 assert.equal(result.code,'W01_R2_LOCAL_DATE_VALUE_MATCH');
 assert.equal(result.trendDateMatchesAsOf,true);
 assert.equal(result.trendValueMatchesScore,true);
 assert.equal(result.trendLength,2);
 assert.equal(row.body,original);
 assert.equal(result.operationalWrites,0);
});

test('old future month end and mismatched value are exposed, never silently repaired',()=>{
 const r=inspectInflationR2Row(make('2026-11-30',49));
 assert.equal(r.status,'PASS');
 assert.equal(r.code,'W01_R2_LOCAL_DATE_VALUE_MISMATCH');
 assert.equal(r.lastTrendLabel,'2026-11-30');
 assert.equal(r.lastTrendValue,49);
 assert.equal(r.trendDateMatchesAsOf,false);
 assert.equal(r.trendValueMatchesScore,false);
});

test('missing and malformed rows are non-success with no fabricated values',()=>{
 assert.equal(inspectInflationR2Row(null).code,'W01_R2_LOCAL_ROW_MISSING');
 assert.equal(inspectInflationR2Row({body:'{',stored_at:1}).code,'W01_R2_ROW_INVALID_JSON');
 const r=inspectInflationR2Row({body:JSON.stringify({payload:{trend:[]},projection:{}}),stored_at:123});
 assert.equal(r.status,'STATE_UNKNOWN');
});

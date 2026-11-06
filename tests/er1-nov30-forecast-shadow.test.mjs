import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectSavedForecast,PINNED_SOURCE} from
  '../er1-nov30-forecast-shadow.mjs';

const day=n=>'2026-11-'+String(n).padStart(2,'0');
const rows=Array.from({length:30},(_,i)=>{
  const date=day(i+1);
  return {day:date,storedAt:'2026-11-05T12:00:00Z',body:{date,
    pre:[{symbol:'S'+String(i).padStart(3,'0'),name:'Fixture'}],
    after:[],notSupplied:[]}};
});
const adapter=({savedDays})=>({coverage:{savedDays:savedDays.length,
  futureSymbols:24,futureIssuers:24,calendarRows:30,
  latestSourceStoredAt:'2026-11-05T12:00:00Z'},issuerRows:[{}]});
const score=()=>({status:'READY_SHADOW',previewOnly:true,
  method:'ER1_FORECAST_DRAFT',star3Count:1,
  coverage:{scoreableIssuers:2,estimateOnly:2,actualOnly:0,mixed:0},
  rankings:[{score:99},{score:42}]});
const run=all=>inspectSavedForecast({pcHome:'/tmp/fixture',asOf:'2026-11-06',
  privateGet:d=>all.find(x=>x.day===d&&Number(d.slice(8))>16)??null,
  coreGet:d=>all.find(x=>x.day===d&&Number(d.slice(8))<=16)??null,
  adapter,score});

test('the source checkout must be pinned to an exact commit',()=>{
  assert.match(PINNED_SOURCE,/^[0-9a-f]{40}$/);
});
test('fixed 30-day aggregate contains no raw rows or provider calls',async()=>{
  const out=await run(rows);
  assert.equal(out.status,'PASS');
  assert.equal(out.dayCount,30);
  assert.equal(out.privateDays,14);
  assert.equal(out.coreDays,16);
  assert.equal(out.scoreableIssuers,2);
  assert.equal(out.star3Count,1);
  assert.equal(out.scoreBins.from97To100,1);
  assert.equal(out.scoreBins.from40To60,1);
  assert.equal(out.providerCalls,0);
  assert.equal(out.coreWrites,0);
  assert.equal(out.d1Writes,0);
  assert.equal(out.writerWrites,0);
  assert.equal(out.rawRowsPublic,0);
  assert.equal(JSON.stringify(out).includes('Fixture'),false);
});
test('partial coverage cannot be reported as a verified score',async()=>{
  const out=await run(rows.slice(0,29));
  assert.equal(out.status,'PARTIAL');
  assert.equal(out.code,'ER1_FORECAST_SAVED_DAYS_INCOMPLETE');
  assert.equal(out.scoreableIssuers,0);
});

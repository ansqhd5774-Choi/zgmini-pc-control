import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {inspectR54PublicReadback,compareR54PublicEvidence,
 summarizeR54PublicBody} from '../controller/market-r54-d1-api-readback-readonly.mjs';

const day='2026-11-23',stamp='2026-11-23T01:20:38.781Z',stored=Date.parse(stamp);
const score=43.159125188536954,method='EMPLOYMENT_R54_STORED_4FACTOR_R1';
const event='R54_STORED_CALCULATION_EVENT_R1';
const local={status:'VERIFIED',eventVerified:true,currentStoredAt:stored,
 asOfDate:day,score,methodologyVersion:method,eventCalculatedAt:stamp,
 trendLastDate:day,datedSnapshotMatched:true};
const market=()=>({status:'SUCCESS',asOfDate:day,updatedAt:stamp,
 domains:[{id:'employment',score,status:'READY',methodologyVersion:method,
  asOfDate:day,indicators:Array.from({length:4},(_,i)=>({id:'employment-4'+(i+1)})),
  lastCalculationEvent:{kind:event,calculatedAt:stamp,methodologyVersion:method,
   factorObservationDates:Array.from({length:4},()=>({date:'2026-10-01'}))},
  trend:[{label:'2026-10-01',value:59.1},
   {label:day,value:score,pointKind:event,calculatedAt:stamp}]}],
 privateToken:'SECRET_NEVER_RETURN'});
const row=()=>({stored_at:stored,body:JSON.stringify(market())});
test('exact local, D1 current/day and public HTTP shape match, with no raw exposure',async()=>{
 const x=await inspectR54PublicReadback('/var/fixed/data',{
  localProbe:()=>({core:{r54StoredEvent:local}}),
  queryFixed:async date=>{assert.equal(date,day);return {current:row(),day:row()};},
  fetchFixed:async()=>({httpStatus:200,body:market()}),
 });
 assert.equal(x.status,'PASS');
 assert.equal(x.code,'R54_PUBLIC_D1_API_MATCHED');
 assert.equal(x.d1.status,'VERIFIED');
 assert.equal(x.api.status,'VERIFIED');
 assert.equal(x.providerCalls,0);assert.equal(x.d1Writes,0);assert.equal(x.operationalWrites,0);
 assert.doesNotMatch(JSON.stringify(x),/SECRET_NEVER_RETURN|privateToken/);
});
test('D1 missing date row never inherits local event success',()=>{
 const x=compareR54PublicEvidence(local,{current:row(),day:null},
  {httpStatus:200,body:market()});
 assert.equal(x.status,'PARTIAL');
 assert.equal(x.d1.status,'MISMATCH_OR_MISSING');
 assert.equal(x.api.matched,true);
});
test('public GET mismatches local and D1 independently',()=>{
 const body=market();body.domains[0].trend.pop();
 const x=compareR54PublicEvidence(local,{current:row(),day:row()},
  {httpStatus:200,body});
 assert.equal(x.status,'PARTIAL');
 assert.equal(x.d1.status,'VERIFIED');
 assert.equal(x.api.matched,false);
 assert.equal(x.code,'R54_API_D1_MISMATCH');
});
test('invalid, secret and stale market bodies never verify',()=>{
 for(const body of [{status:'PARTIAL'}, {...market(),asOfDate:'2026-11-24'},null]){
  const z=summarizeR54PublicBody(body);assert.equal(z.valid,false);
 }
 const remote={...row(),body:JSON.stringify({...market(),updatedAt:'2026-11-23T01:40:00.000Z'})};
 const x=compareR54PublicEvidence(local,{current:remote,day:remote},
  {httpStatus:200,body:market()});
 assert.equal(x.d1.currentMatched,false);
 assert.equal(x.status,'PARTIAL');
});
test('local event required before any D1 or public API access',async()=>{
 let n=0;
 const x=await inspectR54PublicReadback('/var/fixed/data',{
  localProbe:()=>({core:{r54StoredEvent:{status:'UNVERIFIED',eventVerified:false}}}),
  queryFixed:async()=>{n++;return {current:row(),day:row()};},
  fetchFixed:async()=>{n++;return {httpStatus:200,body:market()};},
 });
 assert.equal(x.code,'R54_LOCAL_EVENT_UNVERIFIED');assert.equal(n,0);
});
test('registered A operation is limited to one fixed read-only route',()=>{
 const operations=fs.readFileSync(new URL('../controller/operations.mjs',import.meta.url),'utf8');
 const config=JSON.parse(fs.readFileSync(new URL('../config/operations.json',import.meta.url),'utf8'));
 assert.match(operations,/inspectR54PublicReadback\(dataRoot\)/);
 assert.deepEqual(config['market-r54-d1-api-readback-readonly'],
  {grade:'A',timeoutSeconds:90,resource:'light'});
});

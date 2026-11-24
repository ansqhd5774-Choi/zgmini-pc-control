import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import {
 compareCnnPublicReadback,inspectCnnPublicReadback,CNN_PUBLIC_OPERATION
} from '../controller/cnn-public-d1-api-readback-readonly.mjs';

const DAY='2026-11-24', AT1=DAY+'T09:42:01.000Z', AT2=DAY+'T10:02:16.000Z';
const CT1=DAY+'T10:00:33.567Z', CT2=DAY+'T10:20:32.434Z';
const O=[{observedAt:AT1,score:16.9172161172161},
 {observedAt:AT2,score:16.4593406593407}];
const C=[{checkedAt:CT1,sourceObservedAt:AT1,score:O[0].score,sourceStoredAt:Date.parse(CT1)},
 {checkedAt:CT2,sourceObservedAt:AT2,score:O[1].score,sourceStoredAt:Date.parse(CT2)}];
const root=path.resolve('E:/ZGmini/data');
const row=(feed,points,stored_at)=>({body:JSON.stringify(feed==='observed'?
 {version:'CNN_OBSERVED_ARCHIVE_R1',date:DAY,observations:points}:
 {version:'CNN_VERIFIED_CHECKS_R1',date:DAY,checks:points}),stored_at});
function fixture(){
 const local={status:'PASS',sqliteOpened:true,local:{
  status:'READ',currentPublic:{status:'verified',observedAt:AT2,score:O[1].score},
  original:{recentDates:[{date:DAY,count:2,lastAt:AT2}]},
  checks:{recentDates:[{date:DAY,count:2,lastAt:CT2}]}
 }};
 const rows={observed:row('observed',O,Date.parse(CT2)),checks:row('checks',C,Date.parse(CT2))};
 const replies=Object.fromEntries(['1D','1W'].map(period=>[period,{httpStatus:200,body:{
  status:'READY',period,range:{start:'2026-11-16',end:DAY},points:O,
  checkedPoints:C.map(({checkedAt,sourceObservedAt,score})=>({checkedAt,sourceObservedAt,score}))
 }}]));
 return {local,rows,replies};
}
test('fixed operation is A-grade registered, no hidden provider/write permission',()=>{
 const config=JSON.parse(fs.readFileSync(new URL('../config/operations.json',import.meta.url),'utf8'));
 assert.equal(config.operations[CNN_PUBLIC_OPERATION].grade,'A');
 assert.equal(config.operations[CNN_PUBLIC_OPERATION].resource,'light');
 assert.equal(config.mutationsEnabled,false);
});
test('real same-day PC counts and last times match D1 and both public 1D/1W API sets',()=>{
 const f=fixture(),result=compareCnnPublicReadback(f.local,f.rows,f.replies,{day:DAY});
 assert.equal(result.status,'PASS');
 assert.equal(result.code,'CNN_SQLITE_D1_API_1D_1W_MATCHED');
 assert.equal(result.d1.observedCount,2);
 assert.equal(result.d1.checkedCount,2);
 assert.equal(result.sameDayMatched,true);
 assert.equal(result.publicPeriodsMatched,true);
 assert.equal(result.operationalWrites,0);
 assert.equal(result.providerCalls,0);
 assert.equal(result.d1Writes,0);
 assert.doesNotMatch(JSON.stringify(result),/sourceStoredAt|PRIVATE_SECRET|raw_body/);
});
test('read-only inspector accepts bounded fixed query mock and fixed API period',async()=>{
 const f=fixture(),seen=[];
 const result=await inspectCnnPublicReadback(root,{
  localProbe:()=>f.local,
  queryFixed:async day=>{seen.push(day);return f.rows;},
  fetchFixed:async period=>{seen.push(period);return f.replies[period];},
  clock:()=>Date.parse(DAY+'T10:45:00.000Z')
 });
 assert.equal(result.status,'PASS');assert.deepEqual(seen,[DAY,'1D','1W']);
});
test('missing D1 does not get reclassified as a provider failure',()=>{
 const f=fixture();f.rows.checks=null;
 const result=compareCnnPublicReadback(f.local,f.rows,f.replies,{day:DAY});
 assert.equal(result.status,'STATE_UNKNOWN');
 assert.equal(result.d1.status,'MISSING_OR_LAG');
 assert.equal(result.sameDayMatched,false);
});
test('source observation score mismatch is not hidden by matching counts',()=>{
 const f=fixture(),modified=[...O];modified[1]={...modified[1],score:17};
 f.rows.observed=row('observed',modified,Date.parse(CT2));
 const result=compareCnnPublicReadback(f.local,f.rows,f.replies,{day:DAY});
 assert.equal(result.sameDayMatched,false);assert.equal(result.d1.status,'MISMATCH');
});
test('verified checks do not count as new CNN observedAt records',()=>{
 const f=fixture();
 f.local.local.original.recentDates[0].count=1;
 const result=compareCnnPublicReadback(f.local,f.rows,f.replies,{day:DAY});
 assert.equal(result.d1.status,'MISMATCH');
 assert.equal(result.local.observedCount,1);
 assert.equal(result.local.checkedCount,2);
});
test('invalid verified check sourceStoredAt is refused',()=>{
 const f=fixture(),bad=C.map(x=>({...x}));bad[1].sourceStoredAt=Date.parse(CT2)+1000;
 f.rows.checks=row('checks',bad,Date.parse(CT2));
 const result=compareCnnPublicReadback(f.local,f.rows,f.replies,{day:DAY});
 assert.equal(result.d1.status,'INVALID');
});
test('duplicates with same observation timestamp are invalid',()=>{
 const f=fixture();
 f.rows.observed=row('observed',[O[0],O[0]],Date.parse(CT2));
 const result=compareCnnPublicReadback(f.local,f.rows,f.replies,{day:DAY});
 assert.equal(result.d1.status,'INVALID');
});
test('1D API missing latest source point fails even if D1 matched',()=>{
 const f=fixture();
 f.replies['1D'].body.points=[O[0]];
 const result=compareCnnPublicReadback(f.local,f.rows,f.replies,{day:DAY});
 assert.equal(result.sameDayMatched,true);
 assert.equal(result.publicPeriodsMatched,false);
 assert.equal(result.api.periods['1D'].observedMatch,false);
 assert.equal(result.api.periods['1W'].status,'MATCHED');
});
test('1W API stale range cannot pass by returning matching points',()=>{
 const f=fixture();
 f.replies['1W'].body.range.end='2026-11-23';
 const result=compareCnnPublicReadback(f.local,f.rows,f.replies,{day:DAY});
 assert.equal(result.api.periods['1W'].status,'MISMATCH_OR_UNVERIFIED');
 assert.equal(result.status,'STATE_UNKNOWN');
});
test('API outage never masquerades as bad D1 content',()=>{
 const f=fixture();f.replies['1D']={httpStatus:null,body:null};
 const result=compareCnnPublicReadback(f.local,f.rows,f.replies,{day:DAY});
 assert.equal(result.d1.status,'MATCHED');
 assert.equal(result.api.periods['1D'].status,'UNAVAILABLE');
});
test('local data missing date stops before remote read',async()=>{
 const f=fixture();f.local.local.checks.recentDates=[];let calls=0;
 const result=await inspectCnnPublicReadback(root,{
  localProbe:()=>f.local,
  queryFixed:async()=>{calls++;return f.rows;},fetchFixed:async period=>f.replies[period],
  clock:()=>Date.parse(DAY+'T10:40:00.000Z')
 });
 assert.equal(result.code,'CNN_LOCAL_DAY_INCOMPLETE');assert.equal(calls,0);
});
test('old source cannot be validated as a current 1D point',async()=>{
 const f=fixture();let calls=0;
 const result=await inspectCnnPublicReadback(root,{
  localProbe:()=>f.local,
  queryFixed:async()=>{calls++;return f.rows;},
  clock:()=>Date.parse('2026-12-01T10:00:00.000Z')
 });
 assert.equal(result.code,'CNN_CURRENT_STALE_FOR_1D');
 assert.equal(calls,0);
});
test('invalid root and D1 errors retain evidence boundaries and no network',async()=>{
 let calls=0;let result=await inspectCnnPublicReadback(null,{localProbe:()=>{calls++;}});
 assert.equal(result.code,'CNN_DATA_ROOT_INVALID');assert.equal(calls,0);
 const f=fixture();result=await inspectCnnPublicReadback(root,{
  localProbe:()=>f.local,queryFixed:async()=>{throw Error('NO CREDENTIAL');},
  clock:()=>Date.parse(DAY+'T10:40:00.000Z')
 });
 assert.equal(result.code,'CNN_APPROVED_D1_READ_UNVERIFIED');
 assert.equal(result.status,'STATE_UNKNOWN');assert.equal(result.d1Writes,0);
});

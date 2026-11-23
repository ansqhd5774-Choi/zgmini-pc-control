import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {verifyInflation19D1Row,INFL19_D1_KEY} from './inflation19-d1-readback-readonly.mjs';

const IDS=['1','3','4','5','6','7','8','9','10','11','12','13','14','18','19','21','25','26','31'];
const NOW=Date.parse('2026-11-23T14:00:00.000Z');
const SOURCE=Date.parse('2026-11-19T00:07:21.130Z');
const STORED=Date.parse('2026-11-19T01:00:00.000Z');
const VERSION='INFL19_PRESENTATION_'+'a'.repeat(64);
function fixture(){
 const payload={schemaVersion:'inflation-causal-public-19-r1-v1',status:'READY',
  score:null,sourceVersion:VERSION,sourceStoredAt:SOURCE,
  indicators:IDS.map((id,i)=>({id,series:'S'+id,unit:'지수',status:'READY',
   value:i+1,observationDate:'2026-09-01',
   sourceStoredAt:'2026-11-18T10:00:00.000Z',
   history:[{date:'2026-09-01',value:i+1}]}))};
 const saved={payload,projection:{status:'READY',sourceVersion:VERSION,
  sourceStoredAt:SOURCE,builtAt:STORED}};
 return {payload,row:{body:JSON.stringify(saved),stored_at:STORED}};
}
test('W01 fixed-key 19-row D1 readback verifies exact local value/date/version/sha',()=>{
 const {payload,row}=fixture();
 const v=verifyInflation19D1Row(row,{now:NOW,localPayload:structuredClone(payload)});
 assert.equal(v.status,'PASS');
 assert.equal(v.code,'INFL19_D1_READBACK_VERIFIED');
 assert.equal(v.key,INFL19_D1_KEY);
 assert.equal(v.ready,19);
 assert.equal(v.localMatches,true);
 assert.equal(v.d1StoredAt,STORED);
 assert.equal(v.d1BodySha256,createHash('sha256').update(row.body).digest('hex'));
 assert.deepEqual(v.indicators.map(x=>x.id),IDS);
 assert.deepEqual([v.providerCalls,v.operationalWrites,v.d1Writes,v.sqliteOpened],[0,0,0,false]);
 assert.equal(Object.hasOwn(v,'body'),false);
});
test('W01 D1 missing/storedAt mismatch does not claim success',()=>{
 const {row}=fixture();
 assert.equal(verifyInflation19D1Row(null,{now:NOW}).status,'PARTIAL');
 assert.equal(verifyInflation19D1Row({...row,stored_at:STORED+1},{now:NOW}).code,'INFL19_D1_CONTRACT_INVALID');
});
test('W01 D1 missing, reorder or invalid source rows stop safely',()=>{
 const {row}=fixture();
 const body=JSON.parse(row.body);
 body.payload.indicators[0].id='999';
 assert.equal(verifyInflation19D1Row({...row,body:JSON.stringify(body)},{now:NOW}).firstMismatchId,'1');
 body.payload.indicators[0].id='1';
 body.payload.indicators[0].value=null;
 assert.equal(verifyInflation19D1Row({...row,body:JSON.stringify(body)},{now:NOW}).status,'STATE_UNKNOWN');
});
test('W01 D1 local metadata drift is distinct from a data-value difference',()=>{
 const {payload,row}=fixture();
 const meta=structuredClone(payload);meta.sourceVersion='INFL19_PRESENTATION_'+'b'.repeat(64);
 const m=verifyInflation19D1Row(row,{now:NOW,localPayload:meta});
 assert.equal(m.status,'PARTIAL');assert.equal(m.code,'INFL19_D1_LOCAL_METADATA_DIFF');
 const changed=structuredClone(payload);changed.indicators[17].value+=1;
 const d=verifyInflation19D1Row(row,{now:NOW,localPayload:changed});
 assert.equal(d.status,'PARTIAL');
 assert.equal(d.code,'INFL19_D1_LOCAL_VALUE_DIFF');
 assert.deepEqual([d.firstMismatchId,d.firstMismatchField],['26','value']);
});
test('W01 common operation registers A/light and invokes read-only module only',()=>{
 const ops=JSON.parse(readFileSync(new URL('../config/operations.json',import.meta.url),'utf8')).operations;
 assert.equal(ops['inflation19-d1-readback-readonly'].grade,'A');
 assert.equal(ops['inflation19-d1-readback-readonly'].resource,'light');
 const controller=readFileSync(new URL('./operations.mjs',import.meta.url),'utf8');
 assert.match(controller,/request\.operation==='inflation19-d1-readback-readonly'/);
 assert.match(controller,/inspectInflation19D1Readback\(dataRoot\)/);
});

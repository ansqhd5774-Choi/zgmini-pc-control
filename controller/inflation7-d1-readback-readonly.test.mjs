import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyInflation7D1Row,INFL7_D1_KEY} from './inflation7-d1-readback-readonly.mjs';

const at='2026-11-21T05:01:37.821Z',ms=Date.parse(at),builtAt=ms+1000;
const ids=['2','16','22','23','24','28','29'];
const payload=()=>({
 schemaVersion:'inflation-causal-candidates-7-r1-v1',status:'PARTIAL',score:null,
 sourceVersion:'INFL7_PRESENTATION_'+'a'.repeat(64),sourceStoredAt:ms,
 indicators:ids.map(id=>id==='28'?{id,series:'Census',unit:'index',status:'PENDING',
   value:null,observationDate:null,sourceStoredAt:null,history:[]}:
   {id,series:'Series '+id,unit:'index',status:'READY',value:0,
    observationDate:'2026-11-01',sourceStoredAt:at,history:[{date:'2026-11-01',value:0}]})
});
const wrap=p=>({body:JSON.stringify({payload:p,projection:{
 status:'READY',builtAt,sourceVersion:p.sourceVersion,sourceStoredAt:p.sourceStoredAt}}),
 stored_at:builtAt});
test('fixed key and valid local D1 row preserve legitimate zero and one pending',()=>{
 assert.equal(INFL7_D1_KEY,'detail:inflation-causal-candidates-7:r1');
 const r=verifyInflation7D1Row(wrap(payload()),{now:builtAt+10});
 assert.equal(r.status,'PASS');assert.equal(r.ready,6);
 assert.equal(r.indicators[0].value,0);assert.equal(r.indicators[5].value,null);
 assert.match(r.d1BodySha256,/^[a-f0-9]{64}$/);
 assert.equal(r.providerCalls,0);assert.equal(r.d1Writes,0);
});
test('D1 missing row, wrong checkpoint, ungrounded pending, invalid values must not pass',()=>{
 assert.equal(verifyInflation7D1Row(null).status,'PARTIAL');
 const p=payload(),r=wrap(p);
 assert.equal(verifyInflation7D1Row({...r,stored_at:builtAt+1},{now:builtAt+10}).status,'STATE_UNKNOWN');
 p.indicators[5].value=1;
 assert.equal(verifyInflation7D1Row(wrap(p),{now:builtAt+10}).status,'STATE_UNKNOWN');
 p.indicators[5].value=null;p.indicators[0].value=NaN;
 assert.equal(verifyInflation7D1Row(wrap(p),{now:builtAt+10}).status,'STATE_UNKNOWN');
});
test('future checkpoint must never pass',()=>{
 assert.equal(verifyInflation7D1Row(wrap(payload()),{now:ms}).status,'STATE_UNKNOWN');
});

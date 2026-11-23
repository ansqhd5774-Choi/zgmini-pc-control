import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {
 compareSectorR3D1ApiReadback,inspectSectorR3D1ApiReadback
} from '../controller/sector-r3-d1-api-readback-readonly.mjs';
import {sectorR3StoredDisplayDigest} from '../controller/sector-r3-dated-ledger-readonly.mjs';

const IDS=['technology','communication','discretionary','industrials','financials','utilities','healthcare','materials','energy','staples','realEstate'];
const sha=s=>createHash('sha256').update(s).digest('hex');
const OBS='2026-11-20',STAMP=Date.parse('2026-11-21T02:25:18.300Z');
const KEY='2026-11-21';
function body(){
 const start=Date.parse(OBS+'T00:00:00Z');
 const history=Array.from({length:252},(_,i)=>Object.fromEntries([
  ['date',new Date(start-(251-i)*86400000).toISOString().slice(0,10)],
  ...IDS.map((id,j)=>[id,10+j])]));
 return {version:'SECTOR-FEAR-GREED-R3-PUBLIC-V1',status:'READY',
  observationDate:OBS,methodologyVersion:'test-formula',
  referenceObservations:252,sourceVersion:'test-source',
  sectors:IDS.map((id,j)=>({id,score:10+j,name:'PRIVATE_MUST_NOT_LOG'})),
  history,secretValue:'PRIVATE_NEVER_OUTPUT'};
}
function fixture(){
 const b=body(),text=JSON.stringify(b),sum={
  status:'READ',storedAt:STAMP,observationDate:OBS,
  bodySha256:sha(text),displayDigestSha256:sectorR3StoredDisplayDigest(b)
 };
 const local={status:'PASS',sqliteOpened:true,localCurrentMatchesDate:true,
  pcDate:{...sum,snapshotKey:KEY},localCurrent:{...sum,snapshotKey:'current'}};
 const d1={body:text,stored_at:STAMP};
 const api={httpStatus:200,snapshotAt:new Date(STAMP).toISOString(),
  body:{...b,phase:'CONFIRMED',confirmedObservationDate:OBS,updatedAt:new Date(STAMP).toISOString()}};
 return {local,d1,api};
}
test('same saved PC/D1 body SHA, storedAt, digest and CONFIRMED API => one event, not 1Y',()=>{
 const f=fixture(),r=compareSectorR3D1ApiReadback(f.local,f.d1,f.api);
 assert.equal(r.status,'PASS');
 assert.equal(r.code,'SECTOR_R3_PC_D1_API_CONFIRMED_MATCH');
 assert.equal(r.d1.status,'MATCHED');assert.equal(r.api.status,'MATCHED');
 assert.equal(r.sameEventVerified,true);assert.equal(r.oneYearPitVerified,false);
 assert.equal(r.providerCalls,0);assert.equal(r.d1Writes,0);
 assert.doesNotMatch(JSON.stringify(r),/PRIVATE_MUST_NOT_LOG|PRIVATE_NEVER_OUTPUT|test-source/);
});
test('mismatched stored body hash is not same event even if scores are identical',()=>{
 const f=fixture();f.d1.body=JSON.stringify({...body(),extra:'a different stored JSON body'});
 const r=compareSectorR3D1ApiReadback(f.local,f.d1,f.api);
 assert.equal(r.status,'PARTIAL');assert.equal(r.d1.status,'MISMATCH');
 assert.equal(r.sameEventVerified,false);
});
test('remote D1 stored newer is separate version and not a local same-event failure claim',()=>{
 const f=fixture();f.d1.stored_at=STAMP+60000;
 const r=compareSectorR3D1ApiReadback(f.local,f.d1,f.api);
 assert.equal(r.status,'PARTIAL');assert.equal(r.d1.status,'REMOTE_NEWER');
 assert.equal(r.sameEventVerified,false);
});
test('unavailable D1 never inferred from public UI values',()=>{
 const f=fixture();const r=compareSectorR3D1ApiReadback(f.local,null,f.api);
 assert.equal(r.status,'PARTIAL');assert.equal(r.d1.status,'MISSING');
 assert.equal(r.sameEventVerified,false);
});
test('PROVISIONAL API never counts as confirmed same-event display',()=>{
 const f=fixture();f.api.body.phase='PROVISIONAL';
 f.api.body.confirmedObservationDate=OBS;
 const r=compareSectorR3D1ApiReadback(f.local,f.d1,f.api);
 assert.equal(r.status,'PARTIAL');assert.equal(r.d1.status,'MATCHED');
 assert.equal(r.api.status,'PROVISIONAL');
 assert.equal(r.sameEventVerified,false);
});
test('wrong confirmed observation date or public digest fails closed',()=>{
 const f=fixture();f.api.body.confirmedObservationDate='2026-11-19';
 assert.equal(compareSectorR3D1ApiReadback(f.local,f.d1,f.api).sameEventVerified,false);
 const g=fixture();g.api.body.sectors[1].score=99;
 assert.equal(compareSectorR3D1ApiReadback(g.local,g.d1,g.api).sameEventVerified,false);
});
test('public response x-data-snapshot-at must equal exact D1/PC storedAt',()=>{
 const f=fixture();f.api.snapshotAt=new Date(STAMP+1000).toISOString();
 assert.equal(compareSectorR3D1ApiReadback(f.local,f.d1,f.api).status,'PARTIAL');
 f.api.snapshotAt=null;
 assert.equal(compareSectorR3D1ApiReadback(f.local,f.d1,f.api).sameEventVerified,false);
});
test('HTTP 503/stale response never masquerades as successful public proof',()=>{
 const f=fixture();f.api={httpStatus:503,body:{status:'unavailable'},snapshotAt:null};
 const r=compareSectorR3D1ApiReadback(f.local,f.d1,f.api);
 assert.equal(r.status,'PARTIAL');assert.equal(r.api.status,'UNAVAILABLE');
});
test('local date/current mismatch prevents comparing newer D1 against old local',()=>{
 const f=fixture();f.local.localCurrentMatchesDate=false;
 assert.equal(compareSectorR3D1ApiReadback(f.local,f.d1,f.api).code,
  'SECTOR_R3_LOCAL_UNVERIFIED');
});
test('bounded fixed D1 SQL and feed key with injected public evidence, no network',async()=>{
 const f=fixture(),root=path.resolve('E:/ZGmini/data');
 let calls=0,sql='';
 const r=await inspectSectorR3D1ApiReadback(root,{
  localProbe:()=>f.local,queryFixed:async (query,args)=>{
   calls++;sql=query;assert.deepEqual(args,['sector-fear-greed-r3']);return f.d1;
  },fetchFixed:async()=>f.api
 });
 assert.equal(calls,1);assert.match(sql,/WHERE kind='output' AND feed_key=\? AND snapshot_key='current'/);
 assert.equal(r.status,'PASS');assert.equal(r.operationalWrites,0);
});
test('invalid dataRoot stops before local or D1 read',async()=>{
 let calls=0;
 const r=await inspectSectorR3D1ApiReadback(null,{
  localProbe:()=>{calls++;throw Error('DO NOT READ');}
 });
 assert.equal(r.status,'STATE_UNKNOWN');assert.equal(r.code,'SECTOR_R3_DATA_ROOT_INVALID');
 assert.equal(calls,0);
});
test('D1 network/credential failure is STATE_UNKNOWN, not missing or fabricated',async()=>{
 const f=fixture(),r=await inspectSectorR3D1ApiReadback(path.resolve('E:/ZGmini/data'),{
  localProbe:()=>f.local,queryFixed:async()=>{throw Error('NO VALID SOURCE');},
  fetchFixed:async()=>f.api
 });
 assert.equal(r.status,'STATE_UNKNOWN');assert.equal(r.code,'SECTOR_R3_D1_READ_UNVERIFIED');
 assert.equal(r.sameEventVerified,false);
});
test('existing local dated output may exist but PIT remains explicitly unproven',()=>{
 const f=fixture();
 const r=compareSectorR3D1ApiReadback(f.local,f.d1,f.api);
 assert.equal(r.inputLineage,'NOT_ATTESTED');
 assert.equal(r.oneYearPitVerified,false);
});

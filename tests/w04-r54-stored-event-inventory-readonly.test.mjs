import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {inspectSourceInventory} from '../controller/source-inventory-runtime-readonly.mjs';

const day='2026-11-23',stamp=day+'T01:00:00.000Z',now=Date.parse(stamp);
const method='EMPLOYMENT_R54_STORED_4FACTOR_R1';
const eventKind='R54_STORED_CALCULATION_EVENT_R1';
const ids=['employment-41','employment-42','employment-43','employment-44'];
const sources=['BLS / UNRATE','BLS / PAYEMS','DOL ETA 539 / stored state claims',
 'DOL ETA 539 / stored state claims breadth'];
const weights=[0.3,0.3,0.2,0.2];
const scores=[48,42,58,36];
const score=scores.reduce((total,s,i)=>total+s*weights[i],0);
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');

function fixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'w04-r54-inventory-'));
 const data=path.join(root,'ZGmini','data');
 const storage=path.join(data,'pc-writer','storage');
 fs.mkdirSync(storage,{recursive:true});
 const coreName=path.join(storage,'core.sqlite');
 const core=new DatabaseSync(coreName);
 core.exec('CREATE TABLE market_public_snapshots_v1 (snapshot_key TEXT PRIMARY KEY,body TEXT NOT NULL,stored_at INTEGER NOT NULL)');
 const history=new DatabaseSync(path.join(storage,'history.sqlite'));
 history.exec('CREATE TABLE unrelated (name TEXT)');
 history.close();
 t.after(()=>{core.close();fs.rmSync(root,{recursive:true,force:true});});
 return {data,storage,core,coreName};
}
function makeBody(){
 const indicators=ids.map((id,i)=>({id,status:'READY',score:scores[i],source:sources[i],
  observationDate:'2026-10-31'}));
 return {status:'SUCCESS',asOfDate:day,updatedAt:stamp,
  domains:[{id:'employment',status:'READY',score,methodologyVersion:method,
   asOfDate:day,indicators,
   trend:[{label:'2026-10-01',value:42},
    {label:day,value:score,pointKind:eventKind,calculatedAt:stamp}],
   lastCalculationEvent:{kind:eventKind,methodologyVersion:method,
    calculatedAt:stamp,factorObservationDates:ids.map(id=>({id,date:'2026-10-31'}))}}],
  privateToken:'SECRET_NOT_TO_UPLOAD'};
}
function save(core,body,{dated=true}={}){
 const serialized=JSON.stringify(body);
 core.prepare('INSERT OR REPLACE INTO market_public_snapshots_v1 VALUES(?,?,?)').run('current',serialized,now);
 if(dated)core.prepare('INSERT OR REPLACE INTO market_public_snapshots_v1 VALUES(?,?,?)').run(day,serialized,now);
}

test('exact current/day stored R54 event is verified without printing raw rows',t=>{
 const f=fixture(t);save(f.core,makeBody());
 const before=sha(f.coreName),files=fs.readdirSync(f.storage).sort();
 const r=inspectSourceInventory(f.data);
 assert.equal(r.status,'PASS',JSON.stringify(r));
 assert.deepEqual(r.core.r54StoredEvent,{
  status:'VERIFIED',reason:'STORED_EVENT_CONFIRMED',currentStoredAt:now,
  asOfDate:day,methodologyVersion:method,score,eventCalculatedAt:stamp,
  datedSnapshotMatched:true,trendLastDate:day,eventVerified:true,
 });
 assert.equal(r.operationalWrites,0);assert.equal(r.providerCalls,0);assert.equal(r.d1Writes,0);
 assert.equal(sha(f.coreName),before);
 assert.deepEqual(fs.readdirSync(f.storage).sort(),files);
 assert.doesNotMatch(JSON.stringify(r),/SECRET_NOT_TO_UPLOAD|privateToken|BLS \/ UNRATE/);
});

test('a valid prior monthly point is not a stored calculation event',t=>{
 const f=fixture(t),body=makeBody();
 delete body.domains[0].lastCalculationEvent;
 body.domains[0].trend.pop();
 save(f.core,body);
 const e=inspectSourceInventory(f.data).core.r54StoredEvent;
 assert.equal(e.reason,'EVENT_NOT_STORED');
 assert.equal(e.eventVerified,false);
 assert.equal(e.trendLastDate,'2026-10-01');
});
test('current/day mismatches and invalid factor provenance cannot authenticate event',t=>{
 const f=fixture(t),body=makeBody();
 save(f.core,body,{dated:false});
 assert.equal(inspectSourceInventory(f.data).core.r54StoredEvent.eventVerified,false);
 f.core.prepare("INSERT OR REPLACE INTO market_public_snapshots_v1 VALUES(?,?,?)")
  .run(day,JSON.stringify(body),now);
 const broken=makeBody();
 broken.domains[0].indicators[0].score+=1;
 save(f.core,broken);
 const e=inspectSourceInventory(f.data).core.r54StoredEvent;
 assert.equal(e.reason,'EVENT_INCONSISTENT');
 assert.equal(e.eventVerified,false);
});
test('unsafe and missing current metadata fail closed',t=>{
 const f=fixture(t);
 const result=inspectSourceInventory(f.data);
 assert.equal(result.core.r54StoredEvent.reason,'SNAPSHOT_NOT_PRESENT');
 f.core.prepare('INSERT INTO market_public_snapshots_v1 VALUES(?,?,?)').run('current','SECRET_BAD_JSON',now);
 const invalid=inspectSourceInventory(f.data);
 assert.equal(invalid.core.r54StoredEvent.reason,'CURRENT_BODY_UNREADABLE');
 assert.doesNotMatch(JSON.stringify(invalid),/SECRET_BAD_JSON/);
});

test('malformed optional snapshot table never blocks unrelated fixed inventories',t=>{
 const f=fixture(t);
 f.core.exec('DROP TABLE market_public_snapshots_v1; CREATE TABLE market_public_snapshots_v1 (unrelated TEXT)');
 const result=inspectSourceInventory(f.data);
 assert.equal(result.status,'PASS');
 assert.deepEqual(result.core.r54StoredEvent,{
  status:'UNVERIFIED',reason:'SNAPSHOT_QUERY_FAILED',eventVerified:false,
 });
 assert.equal(result.operationalWrites,0);assert.equal(result.d1Writes,0);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {inspectSectorR3DatedLedger,sectorR3StoredDisplayDigest} from '../controller/sector-r3-dated-ledger-readonly.mjs';
const IDS=['technology','communication','discretionary','industrials','financials','utilities','healthcare','materials','energy','staples','realEstate'];
const sha=s=>createHash('sha256').update(s).digest('hex');
function body(date='2026-11-09'){
 const start=Date.parse(date+'T00:00:00Z');
 const history=Array.from({length:252},(_,i)=>{
  const d=new Date(start-(251-i)*86400000).toISOString().slice(0,10);
  return Object.fromEntries([['date',d],...IDS.map((id,j)=>[id,20+j])]);
 });
 return {version:'SECTOR-FEAR-GREED-R3-PUBLIC-V1',status:'READY',
  observationDate:date,methodologyVersion:'fixed-method',referenceObservations:252,
  sourceVersion:'fixed-source',sectors:IDS.map((id,j)=>({id,score:20+j,name:'SECRET_NAME'})),
  history,privateRaw:'SECRET_NEVER_EXPOSE'};
}
function fixture(t,{wal=false}={}){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'sector-r3-ledger-')),
  data=path.join(root,'data'),storage=path.join(data,'pc-writer','storage');
 fs.mkdirSync(storage,{recursive:true});
 const file=path.join(storage,'core.sqlite'),db=new DatabaseSync(file);
 if(wal)db.exec('PRAGMA journal_mode=WAL');
 db.exec('CREATE TABLE public_feed_snapshots_v1(kind TEXT,feed_key TEXT,snapshot_key TEXT,body TEXT,stored_at INTEGER,PRIMARY KEY(kind,feed_key,snapshot_key))');
 t.after(()=>{try{db.close();}catch{}fs.rmSync(root,{recursive:true,force:true});});
 const add=(key,payload,at)=>db.prepare('INSERT INTO public_feed_snapshots_v1 VALUES(?,?,?,?,?)').run('output','sector-fear-greed-r3',key,JSON.stringify(payload),at);
 return {data,file,db,add};
}
test('bounded dated/current readback returns only hashes with UTC key and no 1Y-PIT claim',t=>{
 const f=fixture(t),b=body(),at=Date.parse('2026-11-10T04:00:00Z');
 f.add('2026-11-10',b,at);f.add('current',b,at);
 const before=fs.readFileSync(f.file),r=inspectSectorR3DatedLedger(f.data);
 assert.equal(r.status,'PASS');assert.equal(r.datedKeyCount,1);
 assert.equal(r.firstSnapshotKey,'2026-11-10');
 assert.equal(r.pcDate.observationDate,'2026-11-09');
 assert.equal(r.pcDate.bodySha256,sha(JSON.stringify(b)));
 assert.equal(r.pcDate.displayDigestSha256,sectorR3StoredDisplayDigest(b));
 assert.equal(r.localCurrentMatchesDate,true);
 assert.equal(r.oneYearPitVerified,false);assert.equal(r.sameEventVerified,false);
 assert.equal(r.sqliteOpened,true);assert.equal(r.operationalWrites,0);
 assert.deepEqual(fs.readFileSync(f.file),before);
 assert.doesNotMatch(JSON.stringify(r),/SECRET_NEVER_EXPOSE|SECRET_NAME|fixed-method/);
});
test('date ranges count stored days, not 252 history points',t=>{
 const f=fixture(t),a=body('2026-11-08'),b=body('2026-11-09');
 f.add('2026-11-09',a,Date.parse('2026-11-09T02:00:00Z'));
 f.add('2026-11-10',b,Date.parse('2026-11-10T02:00:00Z'));
 f.add('current',b,Date.parse('2026-11-10T02:00:00Z'));
 const r=inspectSectorR3DatedLedger(f.data);
 assert.equal(r.status,'PASS');assert.equal(r.datedKeyCount,2);
 assert.equal(r.firstSnapshotKey,'2026-11-09');
 assert.equal(r.lastSnapshotKey,'2026-11-10');
});
test('invalid score history or divergent last score fails closed',t=>{
 const f=fixture(t),b=body();b.sectors[0].score=99;
 f.add('2026-11-10',b,Date.parse('2026-11-10T02:00:00Z'));
 f.add('current',b,Date.parse('2026-11-10T02:00:00Z'));
 const r=inspectSectorR3DatedLedger(f.data);
 assert.equal(r.status,'UNPROVEN');assert.equal(r.code,'SECTOR_R3_OUTPUT_BODY_INVALID');
 assert.equal(r.oneYearPitVerified,false);
});
test('UTC snapshot day mismatch rejects false same-event evidence',t=>{
 const f=fixture(t),b=body(),at=Date.parse('2026-11-09T02:00:00Z');
 f.add('2026-11-10',b,at);f.add('current',b,at);
 const r=inspectSectorR3DatedLedger(f.data);
 assert.equal(r.status,'UNPROVEN');assert.equal(r.code,'SECTOR_R3_STORED_DAY_MISMATCH');
});
test('missing date rows are not fabricated from current',t=>{
 const f=fixture(t);f.add('current',body(),Date.parse('2026-11-10T01:00:00Z'));
 const r=inspectSectorR3DatedLedger(f.data);
 assert.equal(r.status,'UNPROVEN');assert.equal(r.datedKeyCount,0);
});
test('SQLite WAL with an active writer preserves business rows (engine WAL/SHM read coordination allowed)',t=>{
 const f=fixture(t,{wal:true}),b=body(),at=Date.parse('2026-11-10T05:00:00Z');
 f.add('2026-11-10',b,at);f.add('current',b,at);
 const prior=fs.readFileSync(f.file);
 const r=inspectSectorR3DatedLedger(f.data);
 const count=f.db.prepare("SELECT COUNT(*) AS n FROM public_feed_snapshots_v1 WHERE feed_key='sector-fear-greed-r3'").get().n;
 assert.equal(r.status,'PASS');assert.equal(count,2);
 assert.deepEqual(fs.readFileSync(f.file),prior);
});
test('unexpected path symlink is rejected before SQLite open',t=>{
 const f=fixture(t),outside=path.join(path.dirname(f.data),'elsewhere.sqlite');
 f.db.close();fs.renameSync(f.file,outside);
 try{fs.symlinkSync(outside,f.file);}catch(e){if(e.code==='EPERM'){t.skip('symlinks unavailable');return;}throw e;}
 assert.equal(inspectSectorR3DatedLedger(f.data).code,'SECTOR_R3_DB_FILE_UNSAFE');
});

test('invalid data root fails without path exception',()=>{
 assert.equal(inspectSectorR3DatedLedger(null).code,'SECTOR_R3_DATA_ROOT_INVALID');
});

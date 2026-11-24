import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {inspectWriterPublicationEvidence,readER1LocalOutput,projectW05SavedSidecars}
 from '../controller/writer-publication-evidence-readonly.mjs';
const fixture=()=>{
 const d=fs.mkdtempSync(path.join(os.tmpdir(),'er1-meta-'));
 fs.mkdirSync(path.join(d,'pc-writer'));return{d,write:(p,o)=>fs.writeFileSync(
  path.join(d,'pc-writer',p),JSON.stringify(o)),close:()=>fs.rmSync(d,{recursive:true,force:true})};
};
test('ER1 writer months are whitelisted and global D1 VERIFIED is not per-feed proof',()=>{
 const f=fixture();try{
  f.write('local-writer-last-run.json',{at:'2026-11-08T00:00:00Z',source:'a'.repeat(40),
   mode:'PUBLISH',status:'VERIFIED',privateRaw:'SECRET',er1Future:{status:'UPDATED',
    months:[{month:'2026-11',status:'READY_OUTPUT',sqliteDays:16,privateDays:14,
     scoreableIssuers:123,rawEps:'SECRET'}]},failures:[]});
  f.write('local-publication-ledger.json',{status:'VERIFIED',source:'a'.repeat(40),
   at:Date.parse('2026-11-08T00:01:00Z'),secret:'SECRET'});
  const r=inspectWriterPublicationEvidence(f.d);
  assert.equal(r.status,'PASS');assert.equal(r.er1Future.months[0].sqliteDays,16);
  assert.equal(r.globalLedgerVerified,true);
  assert.equal(r.localOutputVerified,false);assert.equal(r.d1.productionVerified,false);
  assert.equal(r.output.bodySha256,null);assert.equal(r.sqliteOpened,false);
  assert.equal(JSON.stringify(r).includes('SECRET'),false);
 }finally{f.close();}
});
test('missing ledger gives metadata but does not claim publish success',()=>{
 const f=fixture();try{
  f.write('local-writer-last-run.json',{source:'a'.repeat(40),status:'VERIFIED',
   er1Future:{months:[{month:'2026-11',status:'UNCHANGED'}]}});
  const r=inspectWriterPublicationEvidence(f.d);
  assert.equal(r.status,'PASS');assert.equal(r.ledger.state,'MISSING');
  assert.equal(r.er1Future.months[0].sqliteDays,null);
  assert.equal(r.globalLedgerVerified,false);
 }finally{f.close();}
});
test('fixed ER1 SQLite output hash and stored_at can be read without modifying DB',()=>{
 const f=fixture();try{
  const dir=path.join(f.d,'pc-writer','storage');fs.mkdirSync(dir);
  const filename=path.join(dir,'core.sqlite');const db=new DatabaseSync(filename);
  db.exec('CREATE TABLE public_feed_snapshots_v1 (kind TEXT,feed_key TEXT,snapshot_key TEXT,stored_at INTEGER,body TEXT)');
  const body='{"published":42,"secret":"PRIVATE_NOT_RETURNED"}';
  db.prepare('INSERT INTO public_feed_snapshots_v1 VALUES (?,?,?,?,?)').run(
   'output','market-calendar:earnings-er1-score-2026-11-public',
   'current',1794100000000,body);
  db.close();
  const original=fs.readFileSync(filename);const before=fs.statSync(filename);
  const r=readER1LocalOutput(f.d);
  assert.equal(r.state,'READ');assert.equal(r.storedAt,1794100000000);
  assert.equal(r.bodySha256,createHash('sha256').update(body).digest('hex'));
  assert.equal(JSON.stringify(r).includes('PRIVATE_NOT_RETURNED'),false);
  assert.equal(fs.readFileSync(filename).equals(original),true);
  assert.equal(fs.statSync(filename).mtimeMs,before.mtimeMs);
 }finally{f.close();}
});
test('does not claim local output success when SQLite key absent',()=>{
 const f=fixture();try{
  const dir=path.join(f.d,'pc-writer','storage');fs.mkdirSync(dir);
  const db=new DatabaseSync(path.join(dir,'core.sqlite'));
  db.exec('CREATE TABLE public_feed_snapshots_v1 (kind TEXT,feed_key TEXT,snapshot_key TEXT,stored_at INTEGER,body TEXT)');
  db.close();
  const r=readER1LocalOutput(f.d);
  assert.equal(r.state,'NOT_FOUND');assert.equal(r.bodySha256,undefined);
 }finally{f.close();}
});
test('WAL-backed local output reader adds no DB, WAL or SHM write in fixture',()=>{
 const f=fixture();let writer;
 try{
  const dir=path.join(f.d,'pc-writer','storage');fs.mkdirSync(dir);
  const filename=path.join(dir,'core.sqlite');writer=new DatabaseSync(filename);
  writer.exec('PRAGMA journal_mode=WAL');
  writer.exec('CREATE TABLE public_feed_snapshots_v1 (kind TEXT,feed_key TEXT,snapshot_key TEXT,stored_at INTEGER,body TEXT)');
  writer.prepare('INSERT INTO public_feed_snapshots_v1 VALUES (?,?,?,?,?)').run(
   'output','market-calendar:earnings-er1-score-2026-11-public','current',1794100000000,'{"score":97}');
  const files=[filename,filename+'-wal',filename+'-shm'];
  const before=files.map(p=>fs.existsSync(p)?{size:fs.statSync(p).size,
   mtimeMs:fs.statSync(p).mtimeMs}:null);
  const r=readER1LocalOutput(f.d);
  assert.equal(r.state,'READ');
  const after=files.map(p=>fs.existsSync(p)?{size:fs.statSync(p).size,
   mtimeMs:fs.statSync(p).mtimeMs}:null);
  assert.deepEqual(after,before);
 }finally{writer?.close();f.close();}
});

function writeMonthlyFixture(f,{month='2027-04',body='{"score":97}',
 storedAt=1800000000000,readbackBody=body,readbackStoredAt=storedAt,
 writerMode='PUBLISH',writerStatus='VERIFIED',ledgerSource='a'.repeat(40),
 readbackStatus='MATCHED',ledgerStatus='VERIFIED'}={}){
 const dir=path.join(f.d,'pc-writer','storage');fs.mkdirSync(dir);
 const db=new DatabaseSync(path.join(dir,'core.sqlite'));
 db.exec('CREATE TABLE public_feed_snapshots_v1 (kind TEXT,feed_key TEXT,snapshot_key TEXT,stored_at INTEGER,body TEXT)');
 const key=`market-calendar:earnings-er1-score-${month}-public`;
 db.prepare('INSERT INTO public_feed_snapshots_v1 VALUES (?,?,?,?,?)').run('output',key,'current',storedAt,body);
 db.close();
 f.write('local-writer-last-run.json',{at:'2027-04-01T00:00:00.000Z',source:'a'.repeat(40),
  mode:writerMode,status:writerStatus,er1Future:{months:[{month,status:'READY_OUTPUT'}]}});
 f.write('local-publication-ledger.json',{source:ledgerSource,status:ledgerStatus,
  at:Date.parse('2027-04-01T00:02:00.000Z'),er1FeedReadbacks:[{
   key,status:readbackStatus,localStoredAt:storedAt,localBodySha256:createHash('sha256').update(body).digest('hex'),
   d1StoredAt:readbackStoredAt,d1BodySha256:readbackBody===null?null:createHash('sha256').update(readbackBody).digest('hex'),
   observedAt:'2027-04-01T00:01:00.000Z',sensitiveRaw:'DO_NOT_ECHO',
  }]});
 return key;
}

test('future monthly output is dynamically selected and exact Writer D1 ledger verifies',()=>{
 const f=fixture();try{
  const key=writeMonthlyFixture(f);
  const r=inspectWriterPublicationEvidence(f.d);
  assert.equal(r.status,'PASS');assert.equal(r.output.key,key);
  assert.equal(r.d1.perKeyReadback,'VERIFIED');
  assert.equal(r.d1.matchedToLocal,true);
  assert.equal(r.d1.productionVerified,false);
  assert.equal(r.d1.publicApiUiVerified,false);
  assert.equal(r.d1.evidenceState,'VERIFIED');
  assert.equal(r.d1.verificationScope,'AT_WRITER_PUBLISH_TIME');
  assert.equal(JSON.stringify(r).includes('DO_NOT_ECHO'),false);
 }finally{f.close();}
});

test('same D1 timestamp but different body SHA is never matched',()=>{
 const f=fixture();try{
  writeMonthlyFixture(f,{readbackBody:'{"score":85}',readbackStatus:'BODY_MISMATCH'});
  const r=inspectWriterPublicationEvidence(f.d);
  assert.equal(r.d1.perKeyReadback,'BODY_MISMATCH');
  assert.equal(r.d1.productionVerified,false);
  assert.equal(r.d1.evidenceState,'UNMATCHED');
 }finally{f.close();}
});

test('old matching evidence cannot become current proof after a DRY_RUN',()=>{
 const f=fixture();try{
  writeMonthlyFixture(f,{writerMode:'DRY_RUN'});
  const r=inspectWriterPublicationEvidence(f.d);
  assert.equal(r.d1.perKeyReadback,'MATCHED');
  assert.equal(r.d1.productionVerified,false);
  assert.equal(r.d1.evidenceState,'STALE');
 }finally{f.close();}
});

test('mismatched source or preserved remote newer is not verified',()=>{
 for(const options of [
  {ledgerSource:'b'.repeat(40)},
  {readbackStoredAt:1800000000001,readbackStatus:'REMOTE_NEWER_PRESERVED'}]){
  const f=fixture();try{
   writeMonthlyFixture(f,options);
   const r=inspectWriterPublicationEvidence(f.d);
   assert.equal(r.d1.matchedToLocal,false);
  }finally{f.close();}
 }
});

test('unrelated output failure does not veto this exact ER1 D1 readback',()=>{
 const f=fixture();try{
  writeMonthlyFixture(f,{writerStatus:'VERIFIED_WITH_GAPS',ledgerStatus:'PARTIAL'});
  const r=inspectWriterPublicationEvidence(f.d);
  assert.equal(r.globalLedgerVerified,false);
  assert.equal(r.d1.perKeyReadback,'VERIFIED');
  assert.equal(r.d1.matchedToLocal,true);
  assert.equal(r.d1.productionVerified,false);
 }finally{f.close();}
});

test('spoofed metadata status MATCHED without identical stored_at and SHA is rejected',()=>{
 const f=fixture();try{
  writeMonthlyFixture(f,{readbackBody:'{"score":85}',readbackStatus:'MATCHED'});
  const r=inspectWriterPublicationEvidence(f.d);
  assert.equal(r.d1.perKeyReadback,'MATCHED');
  assert.equal(r.d1.productionVerified,false);
  assert.equal(r.d1.evidenceState,'STALE');
 }finally{f.close();}
});


test('W05 fixed three-key receipts expose only last Writer readback metadata',()=>{
 const f=fixture();try{
  const base={at:'2026-11-24T05:15:46.993Z',source:'a'.repeat(40),
   mode:'PUBLISH',status:'VERIFIED',secret:'NEVER_EXPOSE_WRITER_PRIVATE',
   w05SavedSidecars:{
    wpsfd42:{key:'detail:earnings-recession-indicators:bls-wpsfd42:v1',
     status:'READBACK_VERIFIED',sourceVersion:'1'.repeat(64),
     sourceStoredAt:1795351641253,publishedAt:1795500000123,raw:'SECRET_WPS'},
    qfr:{key:'detail:earnings-recession-indicators:census-qfr-mfg-margin:v1',
     status:'ALREADY_STORED',sourceVersion:'2'.repeat(64),
     sourceStoredAt:1793112733108,publishedAt:1795500000123},
    bea:{status:'SKIPPED_SOURCE_STALE',raw:'SECRET_BEA'},
    attacker:{key:'other',secret:'SECRET_UNRELATED'},
   },failures:[]};
  f.write('local-writer-last-run.json',base);
  const r=inspectWriterPublicationEvidence(f.d);
  assert.equal(r.status,'PASS');
  assert.deepEqual(Object.keys(r.w05Sidecars.keys),['wpsfd42','qfr','bea']);
  assert.equal(r.w05Sidecars.writerSource,'a'.repeat(40));
  assert.equal(r.w05Sidecars.keys.wpsfd42.readbackAtWriter,true);
  assert.equal(r.w05Sidecars.keys.qfr.readbackAtWriter,true);
  assert.equal(r.w05Sidecars.keys.bea.evidence,'SKIPPED');
  assert.equal(r.w05Sidecars.keys.bea.readbackAtWriter,false);
  assert.equal(r.w05Sidecars.publicApiUiVerified,false);
  assert.equal(r.w05Sidecars.productionVerified,false);
  assert.equal(JSON.stringify(r).includes('SECRET'),false);
  assert.equal(JSON.stringify(r).includes('NEVER_EXPOSE'),false);
 }finally{f.close();}
});
test('W05 receipt rejects DRY_RUN, wrong key and invalid provenance',()=>{
 const key='detail:earnings-recession-indicators:bls-wpsfd42:v1';
 const row={key,status:'READBACK_VERIFIED',sourceVersion:'f'.repeat(64),
  sourceStoredAt:1795351641253};
 const raw={source:'a'.repeat(40),at:'2026-11-24T05:15:46Z',mode:'PUBLISH',
  status:'VERIFIED',w05SavedSidecars:{wpsfd42:row}};
 assert.equal(projectW05SavedSidecars({...raw,mode:'DRY_RUN'})
  .keys.wpsfd42.readbackAtWriter,false);
 assert.equal(projectW05SavedSidecars({...raw,w05SavedSidecars:{
  wpsfd42:{...row,key:'unrelated'}}}).keys.wpsfd42.readbackAtWriter,false);
 assert.equal(projectW05SavedSidecars({...raw,w05SavedSidecars:{
  wpsfd42:{...row,sourceVersion:'not-a-hash'}}}).keys.wpsfd42.readbackAtWriter,false);
 assert.equal(projectW05SavedSidecars({...raw,at:null})
  .keys.wpsfd42.readbackAtWriter,false);
});
test('W05 per-key failure survives a globally VERIFIED_WITH_GAPS Writer run',()=>{
 const f=fixture();try{
  f.write('local-writer-last-run.json',{
   source:'a'.repeat(40),at:'2026-11-24T05:20:00Z',mode:'PUBLISH',
   status:'VERIFIED_WITH_GAPS',failures:[
    {id:'w05-saved-sidecar:bea',reason:'W05_SAVED_REMOTE_READBACK_MISSING',
     debugSecret:'PRIVATE_BEA_PAYLOAD'},
    {id:'other-secret',reason:'PRIVATE_UNRELATED'},
   ],w05SavedSidecars:{},
  });
  const r=inspectWriterPublicationEvidence(f.d);
  assert.equal(r.w05Sidecars.keys.bea.evidence,'WRITER_FAILED');
  assert.equal(r.w05Sidecars.keys.bea.failureReason,
   'W05_SAVED_REMOTE_READBACK_MISSING');
  assert.equal(r.w05Sidecars.keys.qfr.evidence,'NOT_RECORDED');
  assert.equal(JSON.stringify(r).includes('PRIVATE_'),false);
 }finally{f.close();}
});

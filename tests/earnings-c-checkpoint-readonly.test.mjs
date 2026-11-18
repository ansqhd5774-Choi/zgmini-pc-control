// W05: one bounded, fixed-key read-only receipt in the existing A operation.
// Tests run against synthetic SQLite, never the PC's persistent DB or D1.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {inspectEarningsCCheckpoint} from '../controller/earnings-c-checkpoint-readonly.mjs';
import {inspectSourceInventory} from '../controller/source-inventory-runtime-readonly.mjs';

const SERIES=['WPSFD4','WPSFD41','PRS85006111'];
const CONTRACT='EARNINGS_COMPANION_R3C_BLS_DIRECT_V1';
const SCHEMA='earnings-companion-c-r4-v1';
const AT='2026-10-26T17:02:53.996Z';
const sha=x=>createHash('sha256').update(x,'utf8').digest('hex');

function tables(db){
 db.exec("CREATE TABLE api_history_chunks_v1("+
  "provider TEXT NOT NULL,dataset TEXT NOT NULL,chunk_sha256 TEXT NOT NULL,"+
  "first_observation_date TEXT,last_observation_date TEXT,row_count INTEGER NOT NULL,"+
  "payload_json TEXT NOT NULL,first_seen_at TEXT NOT NULL,"+
  "PRIMARY KEY(provider,dataset,chunk_sha256));"+
  "CREATE TABLE api_history_snapshots_v1("+
  "provider TEXT NOT NULL,dataset TEXT NOT NULL,snapshot_sha256 TEXT NOT NULL,"+
  "as_of TEXT NOT NULL,retrieved_at TEXT NOT NULL,status TEXT NOT NULL,"+
  "history_mode TEXT,row_count INTEGER NOT NULL,latest_observation_date TEXT,"+
  "chunk_hashes_json TEXT NOT NULL,provenance_json TEXT NOT NULL,"+
  "PRIMARY KEY(provider,dataset,snapshot_sha256));");
}
function seed(db,id,{retrievedAt=AT,change=0,responseHash='a'.repeat(64)}={}){
 const quarterly=id==='PRS85006111';
 const periods=quarterly?['2025-Q1','2025-Q2','2025-Q3','2025-Q4','2026-Q1','2026-Q2']:
  ['2025-01-01','2025-02-01','2025-03-01','2025-04-01','2025-05-01','2025-06-01',
   '2025-07-01','2025-08-01','2025-09-01','2025-10-01','2025-11-01','2025-12-01',
   '2026-01-01','2026-02-01','2026-03-01','2026-04-01','2026-05-01','2026-06-01',
   '2026-07-01','2026-08-01','2026-09-01'];
 const rows=periods.map((p,i)=>({
   seriesID:id,observationDate:p,year:p.slice(0,4),
   period:(quarterly?'Q0'+(i%4+1):'M'+String(i%12+1).padStart(2,'0')),
   rawValue:String(i+100+change),value:i+100+change,
   frequency:quarterly?'QUARTERLY':'MONTHLY',
   rawUnit:quarterly?'PERCENT_YEAR_OVER_YEAR':'INDEX',
   seasonalAdjustment:'SA',annualRateFlag:false,footnotes:[],
   releaseDate:null,availableAt:null,vintageId:null
 }));
 const json=JSON.stringify(rows),chunkHash=sha(json),
   frequency=quarterly?'QUARTERLY':'MONTHLY';
 const idString=JSON.stringify({contract:CONTRACT,provider:'BLS',dataset:id,
   frequency,seasonalAdjustment:'SA',chunks:[chunkHash]});
 const snapshotHash=sha(idString);
 const provenance=JSON.stringify({contract:CONTRACT,authority:'US_BLS',
  transportProvider:'BLS_DIRECT_API',seriesID:id,retrievedAt,
  responseSha256:responseHash,officialVintageId:null,frequency,
  seasonalAdjustment:'SA',rawUnit:quarterly?'PERCENT_YEAR_OVER_YEAR':'INDEX',
  periodStart:periods[0],periodEnd:periods.at(-1)});
 db.prepare("INSERT INTO api_history_chunks_v1 VALUES(?,?,?,?,?,?,?,?)")
  .run('BLS',id,chunkHash,periods[0],periods.at(-1),rows.length,json,retrievedAt);
 db.prepare("INSERT INTO api_history_snapshots_v1 VALUES(?,?,?,?,?,?,?,?,?,?,?)")
  .run('BLS',id,snapshotHash,retrievedAt.slice(0,10),retrievedAt,
  'READY_DIRECT_BLS',CONTRACT,rows.length,periods.at(-1),
  JSON.stringify([chunkHash]),provenance);
 return snapshotHash;
}
function filled(){
 const db=new DatabaseSync(':memory:');tables(db);
 const hashes=SERIES.map(id=>seed(db,id));
 const expected=sha([SCHEMA,...SERIES.map((id,i)=>id+'|'+hashes[i]).sort()].join('\n'));
 return {db,expected};
}

test('fixed 3-series receipt matches the exact R4 SHA identity and source time',()=>{
 const {db,expected}=filled();
 try{
  db.exec('PRAGMA query_only=ON');
  const r=inspectEarningsCCheckpoint(db);
  assert.equal(r.status,'PASS');
  assert.equal(r.code,'BLS_C_SOURCE_CHECKPOINT_VERIFIED');
  assert.equal(r.sourceVersion,expected);
  assert.equal(r.sourceStoredAt,Date.parse(AT));
  assert.equal(r.cohortRetrievedAt,AT);
  assert.equal(r.seriesVerified,3);
  assert.equal(r.snapshotsVerified,3);
  assert.equal(r.newerIncomplete,false);
  assert.doesNotMatch(JSON.stringify(r),/apiKey|rawValue|payloadJson|footnotes/);
 }finally{db.close();}
});

test('newer incomplete one-source capture preserves the previous exact version',()=>{
 const {db,expected}=filled();
 try{
  const next='2026-10-26T19:00:00.000Z';
  seed(db,'WPSFD4',{retrievedAt:next,change:3,responseHash:'b'.repeat(64)});
  db.exec('PRAGMA query_only=ON');
  const out=inspectEarningsCCheckpoint(db);
  assert.equal(out.status,'PASS');
  assert.equal(out.newerIncomplete,true);
  assert.equal(out.cohortRetrievedAt,AT);
  assert.equal(out.sourceVersion,expected);
  assert.equal(out.snapshotsVerified,4);
  assert.equal(out.sourceStoredAt,Date.parse(AT));
 }finally{db.close();}
});

test('tampered chunk is never labeled a verified checkpoint',()=>{
 const {db}=filled();
 try{
  db.prepare("UPDATE api_history_chunks_v1 SET payload_json='[]' WHERE dataset='WPSFD4'").run();
  db.exec('PRAGMA query_only=ON');
  const out=inspectEarningsCCheckpoint(db);
  assert.equal(out.status,'STATE_UNKNOWN');
  assert.equal(out.code,'BLS_C_SOURCE_CHECKPOINT_INVALID');
  assert.equal(out.sourceVersion,null);
 }finally{db.close();}
});

test('uninstalled source tables are NOT_STORED, not a fabricated zero version',()=>{
 const db=new DatabaseSync(':memory:');
 try{
  db.exec('PRAGMA query_only=ON');
  const r=inspectEarningsCCheckpoint(db);
  assert.equal(r.status,'NOT_STORED');
  assert.equal(r.sourceVersion,null);
  assert.equal(r.seriesVerified,0);
 }finally{db.close();}
});

test('existing A source inventory exposes the receipt without affecting other families or writing DB',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zg-w05-inventory-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const storage=path.join(root,'ZGmini','data','pc-writer','storage');
 fs.mkdirSync(storage,{recursive:true});
 const corePath=path.join(storage,'core.sqlite');
 const historyPath=path.join(storage,'history.sqlite');
 const core=new DatabaseSync(corePath);tables(core);
 const hashes=SERIES.map(id=>seed(core,id));
 const expected=sha([SCHEMA,...SERIES.map((id,i)=>id+'|'+hashes[i]).sort()].join('\n'));
 core.close();
 const history=new DatabaseSync(historyPath);history.exec('CREATE TABLE unchanged(value INTEGER)');history.close();
 const before=fs.readFileSync(corePath),otherBefore=fs.readFileSync(historyPath);
 const output=inspectSourceInventory(path.join(root,'ZGmini','data'));
 assert.equal(output.status,'PASS');
 assert.equal(output.core.earningsCompanionC.status,'PASS');
 assert.equal(output.core.earningsCompanionC.sourceVersion,expected);
 assert.equal(output.core.employment,null);
 assert.equal(output.history.earningsCompanionC.status,'NOT_STORED');
 assert.equal(output.providerCalls,0);
 assert.equal(output.operationalWrites,0);
 assert.equal(output.d1Writes,0);
 assert.deepEqual(fs.readFileSync(corePath),before);
 assert.deepEqual(fs.readFileSync(historyPath),otherBefore);
});

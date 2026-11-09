import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {DatabaseSync} from 'node:sqlite';
import {inspectSourceInventory} from '../controller/source-inventory-runtime-readonly.mjs';

function fixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zg-inventory-'));
 const data=path.join(root,'ZGmini','data');
 const storage=path.join(data,'pc-writer','storage');
 fs.mkdirSync(storage,{recursive:true});
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 return {root,data,storage};
}
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function database(storage,kind='core'){
 const name=path.join(storage,kind+'.sqlite');
 const db=new DatabaseSync(name);
 return {name,db};
}

test('counts distinct active source keys without returning raw data or writes',t=>{
 const {data,storage}=fixture(t),{name,db}=database(storage);
 db.exec(`CREATE TABLE market_input_batches_v1(batch_key TEXT PRIMARY KEY,body TEXT,stored_at INTEGER);
  INSERT INTO market_input_batches_v1 VALUES('macro:2026-11-08','SECRET',1),('macro:2026-11-09','SECRET2',2),('rates:2026-11-09','HIDDEN',3);
  CREATE TABLE market_score_employment_r4_shadow_current_v1(provider TEXT,provider_series_id TEXT,geography_type TEXT,geography_code TEXT,retrieved_at TEXT);
  INSERT INTO market_score_employment_r4_shadow_current_v1 VALUES('BLS','CES123','US','USA','2026-11-09T01:00:00Z'),('BLS','CES123','US','USA','2026-11-09T01:01:00Z'),('DOL','IC001','STATE','NY','2026-11-09T01:02:00Z');
  CREATE TABLE market_score_employment_r6_raw_snapshot_v1(snapshot_id TEXT,release_group TEXT,provider TEXT,request_key TEXT,retrieved_at TEXT);
  INSERT INTO market_score_employment_r6_raw_snapshot_v1 VALUES('s1','EMP','BLS','K1','2026-11-09T01:00:00Z'),('s1','EMP','BLS','K1','2026-11-09T01:00:00Z'),('s2','EMP','BLS','K1','2026-11-09T01:01:00Z');
  CREATE TABLE market_score_breadth_b1_r3_current_v1(trade_date TEXT,ticker TEXT);
  INSERT INTO market_score_breadth_b1_r3_current_v1 VALUES('2026-11-05','OLD'),('2026-11-06','AAA'),('2026-11-06','BBB');
  CREATE TABLE market_score_breadth_b1_r3_universe_v1(trade_date TEXT,member_count INTEGER);
  INSERT INTO market_score_breadth_b1_r3_universe_v1 VALUES('2026-11-06',502);
  CREATE TABLE market_score_earnings_e1_r3_universe_v1(period_end TEXT,security_count INTEGER,issuer_count INTEGER,retrieved_at TEXT);
  INSERT INTO market_score_earnings_e1_r3_universe_v1 VALUES('2026-09-30',503,500,'2026-11-09T01:00:00Z');
  CREATE TABLE c1_r3_source_snapshots_v1(score_date TEXT,source_key TEXT,provider TEXT);
  INSERT INTO c1_r3_source_snapshots_v1 VALUES('2026-11-09','BEA:PCE','BEA'),('2026-11-09','FRED:RSX','FRED');
  CREATE TABLE public_feed_snapshots_v1(kind TEXT,feed_key TEXT,snapshot_key TEXT);
  INSERT INTO public_feed_snapshots_v1 VALUES('output','release-calendar','current');`);
 const encoded='gzip:'+gzipSync(JSON.stringify({series:{SENSITIVE_SERIES_A:[1],SENSITIVE_SERIES_B:[2]},external:{SECRET_SOURCE:{value:1}}})).toString('base64');
 db.prepare("UPDATE market_input_batches_v1 SET body=? WHERE batch_key='macro:2026-11-09'").run(encoded);
 db.close();const history=database(storage,'history');history.db.exec('CREATE TABLE irrelevant(x)');history.db.close();
 const before=hash(name),files=fs.readdirSync(storage).sort();
 const r=inspectSourceInventory(data);
 assert.equal(r.status,'PASS',JSON.stringify(r));
 assert.equal(r.core.employment.observationRows,3);
 assert.equal(r.core.batch.knownFamilies.macro.latestBodyKeys.rootSeriesKeys,2);
 assert.equal(r.core.batch.knownFamilies.macro.latestBodyKeys.externalKeys,1);
 assert.equal(r.core.coverageStatus,'ALL_TARGET_TABLES_PRESENT');
 assert.equal(r.core.employment.uniqueProviderSeriesGeography,2);
 assert.equal(r.core.employmentR6.snapshots,2);
 assert.equal(r.core.employmentR6.uniqueReleaseRequests,1);
 assert.equal(r.core.breadth.latestUniqueTickers,2);
 assert.equal(r.core.earningsUniverse.reportedIssuerCount,500);
 assert.equal(r.core.consumption.uniqueSourceKeys,2);
 assert.equal(r.core.publicFeeds.countedAsRawInput,false);
 assert.equal(r.overallUniqueSourceCount,null);
 assert.equal(r.operationalWrites,0);
 assert.equal(r.providerCalls,0);
 assert.equal(r.d1Writes,0);
 assert.equal(hash(name),before);
 assert.deepEqual(fs.readdirSync(storage).sort(),files);
 assert.doesNotMatch(JSON.stringify(r),/CES123|AAA|PCE|SECRET|HIDDEN|SENSITIVE_SERIES/);
 assert.ok(Buffer.byteLength(JSON.stringify(r))<24000);
});

test('WAL with missing sidecars does not open or alter SQLite',t=>{
 const {data,storage}=fixture(t),{name,db}=database(storage);
 db.exec('PRAGMA journal_mode=WAL;CREATE TABLE v(x);INSERT INTO v VALUES(1)');db.close();
 for(const suffix of ['-wal','-shm'])try{fs.unlinkSync(name+suffix);}catch{}
 const before=hash(name),files=fs.readdirSync(storage).sort();
 const r=inspectSourceInventory(data);
 assert.equal(r.status,'STATE_UNKNOWN');
 assert.equal(r.core.code,'WAL_SIDECARS_ABSENT_UNVERIFIED');
 assert.equal(r.core.sqliteOpened,false);
 assert.equal(hash(name),before);
 assert.deepEqual(fs.readdirSync(storage).sort(),files);
});

test('opens an existing WAL snapshot read-only while keeping logical data unchanged',t=>{
 const {data,storage}=fixture(t),{name,db}=database(storage);
 db.exec('PRAGMA journal_mode=WAL;CREATE TABLE irrelevant(x);INSERT INTO irrelevant VALUES(7)');
 assert.ok(fs.existsSync(name+'-wal'));
 assert.ok(fs.existsSync(name+'-shm'));
 const count=db.prepare('SELECT COUNT(*) AS n FROM irrelevant').get().n;
 const before=hash(name);
 const r=inspectSourceInventory(data);
 assert.equal(r.core.status,'PASS',JSON.stringify(r));
 assert.equal(r.core.sqliteOpened,true);
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM irrelevant').get().n,count);
 assert.equal(hash(name),before);
 db.close();
});

test('missing tables are unknown, never reported as zero input series',t=>{
 const {data,storage}=fixture(t);
 const core=database(storage);core.db.exec('CREATE TABLE irrelevant(x)');core.db.close();
 const history=database(storage,'history');history.db.exec('CREATE TABLE irrelevant(x)');history.db.close();
 const r=inspectSourceInventory(data);
 assert.equal(r.status,'PASS',JSON.stringify(r));
 assert.equal(r.core.tableAvailability.employment,false);
 assert.equal(r.core.coverageStatus,'NO_TARGET_TABLES');
 assert.equal(r.core.employment,null);
 assert.equal(r.overallUniqueSourceCount,null);
});

test('reports a fixed first-failing table without exposing SQLite SQL/error text',t=>{
 const {data,storage}=fixture(t);
 const core=database(storage);
 core.db.exec('CREATE TABLE market_input_batches_v1(batch_key TEXT,body TEXT)');core.db.close();
 const history=database(storage,'history');history.db.exec('CREATE TABLE irrelevant(x)');history.db.close();
 const r=inspectSourceInventory(data);
 assert.equal(r.core.status,'STATE_UNKNOWN');
 assert.equal(r.core.code,'READONLY_QUERY_FAILED');
 assert.equal(r.core.firstFail,'BATCH');
 assert.doesNotMatch(JSON.stringify(r),/no such column|SELECT .* FROM/i);
});

test('rejects unapproved roots and does not create SQLite files',t=>{
 const {root,data,storage}=fixture(t);
 const r=inspectSourceInventory(root);
 assert.equal(r.status,'BLOCKED');
 assert.equal(r.sqliteOpened,undefined);
 assert.deepEqual(fs.readdirSync(storage),[]);
 assert.equal(inspectSourceInventory(data).status,'STATE_UNKNOWN');
 assert.deepEqual(fs.readdirSync(storage),[]);
});

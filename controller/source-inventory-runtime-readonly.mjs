// Fixed A-grade inventory of *stored* operational inputs. Never returns raw
// values, provider credentials, security identifiers, or observation bodies.
// DECLARED/ENABLED/CALENDAR_ELIGIBLE are separate audits, not inferred here.
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {gunzipSync} from 'node:zlib';

const DB_NAMES=Object.freeze(['core','history']);
const TABLES=Object.freeze({
 batch:'market_input_batches_v1',
 employment:'market_score_employment_r4_shadow_current_v1',
 employmentR6:'market_score_employment_r6_raw_snapshot_v1',
 breadth:'market_score_breadth_b1_r3_current_v1',
 breadthUniverse:'market_score_breadth_b1_r3_universe_v1',
 earningsUniverse:'market_score_earnings_e1_r3_universe_v1',
 consumption:'c1_r3_source_snapshots_v1',
 feeds:'public_feed_snapshots_v1',
});
const BATCH_KEYS=Object.freeze(['macro','credit','supply','fundFlows','bisDsr','bisTc','rates']);
const SQLITE_MAGIC='SQLite format 3\0';
const MAX_DB_BYTES=64*1024**3;
const integer=x=>Number.isSafeInteger(x)&&x>=0?x:null;
const stamp=x=>typeof x==='string'&&/^20\d\d-\d\d-\d\d(?:T[\d:.]+Z)?$/.test(x)?x:null;
const noWrite=()=>({providerCalls:0,d1Writes:0,operationalWrites:0});
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
function savedBatchKeyCounts(encoded){
 try{
  if(typeof encoded!=='string'||encoded.length>2_000_000)return {status:'SIZE_REJECTED'};
  const decoded=encoded.startsWith('gzip:')?
   gunzipSync(Buffer.from(encoded.slice(5),'base64'),{maxOutputLength:32_000_000}).toString('utf8'):encoded;
  if(Buffer.byteLength(decoded)>32_000_000)return {status:'SIZE_REJECTED'};
  const body=JSON.parse(decoded);
  if(!object(body))return {status:'INVALID_SHAPE'};
  const keys=x=>object(x)?Object.keys(x).length:null;
  return {status:'OBSERVED_KEYS_NOT_ACTIVE_SERIES_PROOF',
   rootSeriesKeys:keys(body.series),rateR2SeriesKeys:keys(body.rateR2?.series),
   externalKeys:keys(body.external),providerSummaryKeys:keys(body.providerSummary)};
 }catch{return {status:'UNREADABLE_OR_INVALID'};}
}

function safePath(p,root,filesystem){
 try{
  const s=filesystem.lstatSync(p),real=filesystem.realpathSync(p);
  const rel=path.relative(root,real);
  return !s.isSymbolicLink()&&rel&&rel!=='..'&&!rel.startsWith('..'+path.sep)&&
   !path.isAbsolute(rel)?{real,stat:s}:null;
 }catch{return null;}
}

// WAL read-only connections can create a missing -shm file. Preserve the
// existing R6 preflight restriction: both sidecars must already be ordinary
// files before any SQLite handle is opened. A normal checkpoint may remove
// them, so missing sidecars mean STATE_UNKNOWN, not database corruption.
function preflight(file,root,filesystem){
 const entry=safePath(file,root,filesystem);
 if(!entry)return {status:'UNKNOWN',code:'DB_MISSING_OR_UNSAFE'};
 if(!entry.stat.isFile()||entry.stat.size<100||entry.stat.size>MAX_DB_BYTES)
  return {status:'UNKNOWN',code:'DB_SIZE_OR_TYPE_DENIED'};
 let fd,header;
 try{
  fd=filesystem.openSync(entry.real,'r');header=Buffer.alloc(20);
  if(filesystem.readSync(fd,header,0,20,0)!==20)throw Error('HEADER_SHORT');
 }catch{return {status:'UNKNOWN',code:'DB_HEADER_UNREADABLE'};}
 finally{if(fd!==undefined)filesystem.closeSync(fd);}
 if(header.toString('ascii',0,16)!==SQLITE_MAGIC||
    ![1,2].includes(header[18])||![1,2].includes(header[19]))
  return {status:'UNKNOWN',code:'DB_HEADER_INVALID'};
 if(header[18]===2||header[19]===2){
  if(!['-wal','-shm'].every(ext=>{
   const side=safePath(file+ext,root,filesystem);
   return side?.stat.isFile()&&!side.stat.isSymbolicLink();
  }))return {status:'UNKNOWN',code:'WAL_SIDECARS_ABSENT_UNVERIFIED'};
 }
 return {status:'READY',code:'READONLY_OPEN_APPROVED',path:entry.real};
}

function inspectDb(file,root,{filesystem=fs,openDatabase=f=>new DatabaseSync(f,{readOnly:true,timeout:4000})}={}){
 const gate=preflight(file,root,filesystem);
 if(gate.status!=='READY')return {status:'STATE_UNKNOWN',code:gate.code,sqliteOpened:false};
 let db,queryStage='OPEN_READONLY';
 try{
  db=openDatabase(gate.path);
  queryStage='READONLY_PRAGMAS';
  db.exec('PRAGMA query_only=ON');
  db.exec('PRAGMA busy_timeout=4000');
  queryStage='TABLE_DISCOVERY';
  const tables=new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r=>r.name));
  const has=key=>tables.has(TABLES[key]);
  const row=sql=>db.prepare(sql).get();
  const found=Object.values(TABLES).filter(name=>tables.has(name)).length;
  const out={status:'PASS',code:'STORED_INVENTORY_READONLY',sqliteOpened:true,
   coverageStatus:found===0?'NO_TARGET_TABLES':found===Object.keys(TABLES).length?'ALL_TARGET_TABLES_PRESENT':'PARTIAL_TABLE_SET',
   observedTableCount:found,targetTableCount:Object.keys(TABLES).length,
   tableAvailability:Object.fromEntries(Object.entries(TABLES).map(([k,v])=>[k,tables.has(v)])),
   batch:null,employment:null,employmentR6:null,breadth:null,breadthUniverse:null,
   earningsUniverse:null,consumption:null,publicFeeds:null};
  if(has('batch')){
   queryStage='BATCH';
   const all=row('SELECT COUNT(*) AS n,MAX(stored_at) AS latest FROM market_input_batches_v1');
   const known={};
   for(const key of BATCH_KEYS){
    const x=db.prepare('SELECT COUNT(*) AS n,MAX(stored_at) AS latest FROM market_input_batches_v1 WHERE batch_key LIKE ?').get(key+':%');
    const saved=db.prepare('SELECT body FROM market_input_batches_v1 WHERE batch_key LIKE ? ORDER BY stored_at DESC LIMIT 1').get(key+':%');
    known[key]={storedBatches:integer(x.n),latestStoredAt:integer(x.latest),
     latestBodyKeys:saved?savedBatchKeyCounts(saved.body):{status:'NOT_STORED'}};
   }
   out.batch={storedBatches:integer(all.n),latestStoredAt:integer(all.latest),knownFamilies:known,
    distinctSeriesInsideBodies:'NOT_INSPECTED'};
  }
  if(has('employment')){
   queryStage='EMPLOYMENT_R4';
   const x=row('SELECT COUNT(*) AS n,MAX(retrieved_at) AS latest FROM market_score_employment_r4_shadow_current_v1');
   const keys=row('SELECT COUNT(*) AS n FROM (SELECT provider,provider_series_id,geography_type,geography_code FROM market_score_employment_r4_shadow_current_v1 GROUP BY provider,provider_series_id,geography_type,geography_code)');
   out.employment={observationRows:integer(x.n),uniqueProviderSeriesGeography:integer(keys.n),latestRetrievedAt:stamp(x.latest)};
  }
  if(has('employmentR6')){
   queryStage='EMPLOYMENT_R6';
   const x=row('SELECT COUNT(*) AS n,COUNT(DISTINCT snapshot_id) AS snapshots,MAX(retrieved_at) AS latest FROM market_score_employment_r6_raw_snapshot_v1');
   const keys=row('SELECT COUNT(*) AS n FROM (SELECT release_group,provider,request_key FROM market_score_employment_r6_raw_snapshot_v1 GROUP BY release_group,provider,request_key)');
   out.employmentR6={storedChunks:integer(x.n),snapshots:integer(x.snapshots),uniqueReleaseRequests:integer(keys.n),latestRetrievedAt:stamp(x.latest)};
  }
  if(has('breadth')){
   queryStage='BREADTH';
   const date=row('SELECT MAX(trade_date) AS d FROM market_score_breadth_b1_r3_current_v1')?.d;
   const x=date?db.prepare('SELECT COUNT(*) AS n,COUNT(DISTINCT ticker) AS u FROM market_score_breadth_b1_r3_current_v1 WHERE trade_date=?').get(date):{n:0,u:0};
   out.breadth={latestTradeDate:stamp(date),latestRows:integer(x.n),latestUniqueTickers:integer(x.u)};
  }
  if(has('breadthUniverse')){
   queryStage='BREADTH_UNIVERSE';
   const x=row('SELECT trade_date,member_count FROM market_score_breadth_b1_r3_universe_v1 ORDER BY trade_date DESC LIMIT 1');
   out.breadthUniverse={latestTradeDate:stamp(x?.trade_date),reportedMemberCount:integer(x?.member_count)};
  }
  if(has('earningsUniverse')){
   queryStage='EARNINGS_UNIVERSE';
   const x=row('SELECT period_end,security_count,issuer_count,retrieved_at FROM market_score_earnings_e1_r3_universe_v1 ORDER BY period_end DESC LIMIT 1');
   out.earningsUniverse={latestPeriodEnd:stamp(x?.period_end),reportedSecurityCount:integer(x?.security_count),reportedIssuerCount:integer(x?.issuer_count),retrievedAt:stamp(x?.retrieved_at)};
  }
  if(has('consumption')){
   queryStage='CONSUMPTION';
   const d=row('SELECT MAX(score_date) AS d FROM c1_r3_source_snapshots_v1')?.d;
   const x=d?db.prepare('SELECT COUNT(*) AS n,COUNT(DISTINCT source_key) AS u,COUNT(DISTINCT provider) AS providers FROM c1_r3_source_snapshots_v1 WHERE score_date=?').get(d):{n:0,u:0,providers:0};
   out.consumption={latestScoreDate:stamp(d),storedRows:integer(x.n),uniqueSourceKeys:integer(x.u),uniqueProviders:integer(x.providers)};
  }
  if(has('feeds')){
   queryStage='PUBLIC_FEEDS';
   const x=row("SELECT COUNT(DISTINCT feed_key) AS n FROM public_feed_snapshots_v1 WHERE kind='output' AND snapshot_key='current'");
   out.publicFeeds={currentOutputFeedKeys:integer(x.n),countedAsRawInput:false};
  }
  return out;
 }catch{
  return {status:'STATE_UNKNOWN',code:'READONLY_QUERY_FAILED',firstFail:queryStage,sqliteOpened:!!db};
 }finally{try{db?.close();}catch{}}
}

/** Fixed dataRoot is supplied by the installed Controller, never by Issue JSON. */
export function inspectSourceInventory(dataRoot,opts={}){
 const filesystem=opts.fileSystem??fs;
 const result={status:'BLOCKED',code:'SOURCE_INVENTORY_DATA_ROOT_DENIED',
  scope:'STORED_PC_SQLITE_ONLY',overallUniqueSourceCount:null,
  declaredEnabledCalendarMapping:'NOT_INSPECTED',core:null,history:null,...noWrite()};
 if(typeof dataRoot!=='string'||!path.isAbsolute(dataRoot))return result;
 const real=(()=>{try{return filesystem.realpathSync(dataRoot)}catch{return null}})();
 if(!real||path.basename(real).toLowerCase()!=='data'||path.basename(path.dirname(real)).toLowerCase()!=='zgmini')return result;
 const pc=safePath(path.join(real,'pc-writer'),real,filesystem);
 const storage=pc&&safePath(path.join(real,'pc-writer','storage'),real,filesystem);
 if(!pc?.stat.isDirectory()||!storage?.stat.isDirectory())return result;
 for(const kind of DB_NAMES)result[kind]=inspectDb(path.join(storage.real,kind+'.sqlite'),real,opts);
 result.status=result.core?.status==='PASS'&&result.history?.status==='PASS'?'PASS':'STATE_UNKNOWN';
 result.code=result.status==='PASS'?'SOURCE_INVENTORY_STORED_READONLY':'SOURCE_INVENTORY_PARTIAL_READONLY';
 result.sqliteOpened=!!result.core?.sqliteOpened||!!result.history?.sqliteOpened;
 return result;
}

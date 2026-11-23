// D05/S01 fixed, non-sensitive inventory of the existing sector R3 output rows.
// This reads PC local SQLite only. It does not infer a historical 1Y PIT lineage.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {openSqliteReadonly} from './common.mjs';

const FEED='sector-fear-greed-r3';
const VERSION='SECTOR-FEAR-GREED-R3-PUBLIC-V1';
const IDS=Object.freeze(['technology','communication','discretionary','industrials',
 'financials','utilities','healthcare','materials','energy','staples','realEstate']);
const MAX_BODY_BYTES=1_800_000;
const MAX_DB_BYTES=64*1024**3;
const hash=x=>createHash('sha256').update(x).digest('hex');
const fail=(code,sqliteOpened=false)=>({status:'UNPROVEN',code,sqliteOpened,
 providerCalls:0,d1Writes:0,operationalWrites:0,
 sameEventVerified:false,oneYearPitVerified:false});
const day=x=>typeof x==='string'&&/^20\d{2}-\d{2}-\d{2}$/.test(x)&&
 Number.isFinite(Date.parse(x+'T00:00:00Z'))&&
 new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;
const score=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=100;
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);

// Exactly the public-derived digest projection in zgmini
// lib/score-history/sector-r3-dated-readback-r1.mjs. Never return the body.
export function sectorR3StoredDisplayDigest(body){
 if(!object(body)||body.version!==VERSION||body.status!=='READY'||!day(body.observationDate)||
  !Array.isArray(body.sectors)||body.sectors.length!==IDS.length||
  !Array.isArray(body.history)||body.history.length!==252||
  body.sectors.some((s,i)=>s?.id!==IDS[i]||!score(s.score)))return null;
 let prior=null;
 for(const h of body.history){
  if(!object(h)||!day(h.date)||(prior!==null&&h.date<=prior)||
    IDS.some(id=>!score(h[id])))return null;
  prior=h.date;
 }
 if(prior!==body.observationDate||body.sectors.some(s=>
  s.score!==body.history[251][s.id]))return null;
 const selected={version:body.version,observationDate:body.observationDate,
  methodologyVersion:body.methodologyVersion,
  referenceObservations:body.referenceObservations,
  sourceVersion:body.sourceVersion,
  scores:body.sectors.map(({id,score})=>[id,score])};
 return hash(JSON.stringify(selected));
}

function project(row,snapshotKey){
 if(!row||typeof row.body!=='string'||Buffer.byteLength(row.body,'utf8')>MAX_BODY_BYTES||
  !Number.isSafeInteger(row.stored_at)||row.stored_at<=0||
  !Number.isFinite(new Date(row.stored_at).getTime()))return null;
 let body;try{body=JSON.parse(row.body);}catch{return null;}
 const displayDigestSha256=sectorR3StoredDisplayDigest(body);
 if(!displayDigestSha256)return null;
 return {status:'READ',snapshotKey,storedAt:row.stored_at,
  observationDate:body.observationDate,
  bodySha256:hash(Buffer.from(row.body,'utf8')),displayDigestSha256};
}

export function inspectSectorR3DatedLedger(dataRoot,{fileSystem=fs,
 openDatabase=openSqliteReadonly}={}){
 let db;
 try{
  if(typeof dataRoot!=='string'||!path.isAbsolute(dataRoot))
   return fail('SECTOR_R3_DATA_ROOT_INVALID');
  const dbFile=path.join(dataRoot,'pc-writer','storage','core.sqlite');
  const root=fileSystem.realpathSync.native(dataRoot);
  const stat=fileSystem.lstatSync(dbFile);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size<100||
   stat.size>MAX_DB_BYTES)return fail('SECTOR_R3_DB_FILE_UNSAFE');
  const resolved=fileSystem.realpathSync.native(dbFile);
  const rel=path.relative(root,resolved);
  if(!rel||rel==='..'||rel.startsWith('..'+path.sep)||path.isAbsolute(rel))
   return fail('SECTOR_R3_DB_PATH_UNSAFE');
  db=openDatabase(dbFile);
  const summary=db.prepare("SELECT COUNT(*) AS n, MIN(snapshot_key) AS first_key, MAX(snapshot_key) AS last_key FROM public_feed_snapshots_v1 WHERE kind='output' AND feed_key=? AND snapshot_key GLOB '????-??-??'").get(FEED);
  if(!Number.isSafeInteger(summary?.n)||summary.n<0||summary.n>5000)
   return fail('SECTOR_R3_DATE_KEY_COUNT_INVALID',true);
  if(summary.n===0)return {...fail('SECTOR_R3_DATE_ROWS_NOT_STORED',true),
   datedKeyCount:0,firstSnapshotKey:null,lastSnapshotKey:null};
  if(!day(summary.first_key)||!day(summary.last_key))
   return fail('SECTOR_R3_DATE_KEY_INVALID',true);
  const read=key=>db.prepare("SELECT body,stored_at FROM public_feed_snapshots_v1 WHERE kind='output' AND feed_key=? AND snapshot_key=? LIMIT 1").get(FEED,key);
  const latest=project(read(summary.last_key),summary.last_key);
  const current=project(read('current'),'current');
  if(!latest||!current)return fail('SECTOR_R3_OUTPUT_BODY_INVALID',true);
  const utcDay=new Date(latest.storedAt).toISOString().slice(0,10);
  if(utcDay!==latest.snapshotKey||latest.observationDate>latest.snapshotKey)
   return fail('SECTOR_R3_STORED_DAY_MISMATCH',true);
  return {status:'PASS',code:'SECTOR_R3_DATED_LEDGER_READONLY',
   evidenceLevel:'LOCAL_OUTPUT_SNAPSHOT_ONLY_NOT_INPUT_PIT',
   feed:'sector-fear-greed-r3',datedKeyCount:summary.n,
   firstSnapshotKey:summary.first_key,lastSnapshotKey:summary.last_key,
   pcDate:latest,localCurrent:current,
   localCurrentMatchesDate:latest.storedAt===current.storedAt&&
    latest.bodySha256===current.bodySha256,
   inputLineage:'NOT_ATTESTED_BY_THIS_OPERATION',
   d1CurrentReadback:'NOT_PERFORMED',publicApiReadback:'NOT_PERFORMED',
   sameEventVerified:false,oneYearPitVerified:false,sqliteOpened:true,
   providerCalls:0,d1Writes:0,operationalWrites:0};
 }catch(e){
  if(e?.code==='ENOENT')return fail('SECTOR_R3_DB_NOT_FOUND');
  return fail('SECTOR_R3_SQLITE_READ_UNVERIFIED',Boolean(db));
 }finally{
  if(db){try{db.exec('ROLLBACK');}catch{}try{db.close();}catch{}}
 }
}

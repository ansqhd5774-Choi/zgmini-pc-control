// Fixed-scope W04 raw snapshot / collector-run attestation.
// Reuses the existing native read-only, query_only, single-snapshot SQLite reader.
// Does not open the candidate database, fetch providers or publish raw bytes.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {openSqliteReadonly} from './common.mjs';

const RAW='market_score_employment_r6_raw_snapshot_v1';
const RUNS='market_score_employment_r4_shadow_runs_v1';
const RAW_COLS=['snapshot_id','chunk_index','chunk_count','release_group','provider',
 'request_key','retrieved_at','created_at','body_sha256','detail_json','body_chunk'];
const RUN_COLS=['provider','status','completed_at','detail_json'];
const HASH=/^[0-9a-f]{64}$/i;
const MAX_SNAPSHOTS=4000;
const MAX_CHUNKS=4096;
const MAX_BODY_BYTES=32*1024*1024;
const MAX_TOTAL_BYTES=512*1024*1024;
const MAX_RUNS=20000;
const noWrite=()=>({operationalWrites:0,providerCalls:0,d1Writes:0});
const safeJson=value=>{
 if(typeof value!=='string'||Buffer.byteLength(value)>40000)return null;
 try{const parsed=JSON.parse(value);
  return parsed&&typeof parsed==='object'&&!Array.isArray(parsed)?parsed:null;
 }catch{return null;}
};
const columnsExist=(db,table,columns)=>{
 if(!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table))
  return false;
 const existing=new Set(db.prepare('PRAGMA table_info('+table+')').all().map(x=>x.name));
 return columns.every(x=>existing.has(x));
};
const sha=value=>createHash('sha256').update(value).digest('hex');

// All snapshot chunks, body hashes and receipt links are checked on the PC.
// Only bounded aggregate counts cross the Controller output boundary.
export function auditFixedR6RawRunSnapshot(db,{checkedAt=new Date().toISOString()}={}){
 if(!Number.isFinite(Date.parse(checkedAt))||new Date(checkedAt).toISOString()!==checkedAt)
  throw Error('R6_RAW_AUDIT_CHECKED_AT_INVALID');
 if(!columnsExist(db,RAW,RAW_COLS)||!columnsExist(db,RUNS,RUN_COLS))
  return {status:'SCHEMA_UNAVAILABLE',checkedAt,
   metadataKeys:null,bodyVerifiedKeys:null,runCertifiedKeys:null,
   invalidBodyKeys:null,validWithoutRunKeys:null};
 const verified=new Map();
 let metadataKeys=0,totalBytes=0,group=null;
 const finish=()=>{
  if(!group)return;
  const h=group.head;
  if(!group.valid||group.count!==h.chunk_count||!HASH.test(String(h.snapshot_id??''))
   ||!HASH.test(String(h.body_sha256??''))||!Number.isSafeInteger(h.chunk_count)
   ||h.chunk_count<1||h.chunk_count>MAX_CHUNKS
   ||!String(h.provider??'').trim()||!String(h.request_key??'').trim()
   ||!String(h.release_group??'').trim())return;
  const retrieved=Date.parse(h.retrieved_at??''),created=Date.parse(h.created_at??'');
  const detail=safeJson(h.detail_json);
  if(!Number.isFinite(retrieved)||!Number.isFinite(created)||created<retrieved
   ||created>Date.parse(checkedAt)||retrieved>Date.parse(checkedAt)
   ||detail?.responseHash!==h.body_sha256
   ||sha([h.release_group,h.provider,h.request_key,h.body_sha256].join('|'))!==h.snapshot_id)
   return;
  if(group.hasher.digest('hex')!==h.body_sha256)return;
  verified.set(h.snapshot_id,{provider:h.provider,release_group:h.release_group,
   body_sha256:h.body_sha256,retrieved_at:h.retrieved_at});
 };
 const rows=db.prepare('SELECT snapshot_id,chunk_index,chunk_count,release_group,provider,'+
  'request_key,retrieved_at,created_at,body_sha256,detail_json,body_chunk '+
  'FROM '+RAW+' WHERE retrieved_at<=? ORDER BY snapshot_id,chunk_index').iterate(checkedAt);
 for(const row of rows){
  if(!group||row.snapshot_id!==group.id){
   finish();metadataKeys++;
   if(metadataKeys>MAX_SNAPSHOTS)throw Error('R6_RAW_AUDIT_SNAPSHOT_CAP');
   group={id:row.snapshot_id,head:row,count:0,bytes:0,valid:true,
    hasher:createHash('sha256')};
  }
  const h=group.head;
  if(!Number.isSafeInteger(row.chunk_index)||row.chunk_index!==group.count
   ||row.chunk_count!==h.chunk_count||row.release_group!==h.release_group
   ||row.provider!==h.provider||row.request_key!==h.request_key
   ||row.retrieved_at!==h.retrieved_at||row.created_at!==h.created_at
   ||row.body_sha256!==h.body_sha256||row.detail_json!==h.detail_json
   ||typeof row.body_chunk!=='string')group.valid=false;
  group.count++;
  if(typeof row.body_chunk==='string'){
   const bytes=Buffer.byteLength(row.body_chunk,'utf8');
   group.bytes+=bytes;totalBytes+=bytes;
   if(group.bytes>MAX_BODY_BYTES||totalBytes>MAX_TOTAL_BYTES)
    throw Error('R6_RAW_AUDIT_BYTE_CAP');
   if(group.valid)group.hasher.update(row.body_chunk,'utf8');
  }
 }
 finish();
 const certified=new Set();
 let runCount=0;
 const runs=db.prepare('SELECT provider,status,completed_at,detail_json FROM '+RUNS+
  ' WHERE completed_at<=?').iterate(checkedAt);
 for(const run of runs){
  runCount++;
  if(runCount>MAX_RUNS)throw Error('R6_RAW_AUDIT_RUN_CAP');
  const completed=Date.parse(run.completed_at??'');
  if(!['SUCCESS','PARTIAL'].includes(run.status)||!Number.isFinite(completed)
   ||completed>Date.parse(checkedAt))continue;
  const details=safeJson(run.detail_json);
  if(!Array.isArray(details?.rawSnapshots)||details.rawSnapshots.length>MAX_SNAPSHOTS)
   continue;
  for(const item of details.rawSnapshots){
   const snap=verified.get(item?.snapshotId);
   if(snap&&item.bodySha256===snap.body_sha256
    &&run.provider==='EMPLOYMENT_R6_'+snap.release_group
    &&Date.parse(snap.retrieved_at)<=completed)certified.add(item.snapshotId);
  }
 }
 return {status:'HASH_AND_RUN_LINKS_VERIFIED_NOT_PIT',checkedAt,metadataKeys,
  bodyVerifiedKeys:verified.size,runCertifiedKeys:certified.size,
  invalidBodyKeys:metadataKeys-verified.size,
  validWithoutRunKeys:verified.size-certified.size};
}

// The fixed PC data root is supplied by the installed Controller, not Issue JSON.
export function inspectEmploymentR6RawRunLight(dataRoot,{
 filesystem=fs,openDatabase=openSqliteReadonly,now=()=>new Date(),
}={}){
 const base={status:'BLOCKED',code:'R6_RAW_AUDIT_ROOT_DENIED',
  sqliteOpened:false,scope:'W04_R6_RAW_RUN_FIXED_AGGREGATE_ONLY',
  dbIdentityTag:null,attestation:null,...noWrite()};
 if(typeof dataRoot!=='string'||!path.isAbsolute(dataRoot))return base;
 let file,stat;
 try{
  const root=filesystem.realpathSync(dataRoot);
  if(path.basename(root).toLowerCase()!=='data'
   ||path.basename(path.dirname(root)).toLowerCase()!=='zgmini')return base;
  const link=path.join(root,'pc-writer','storage','core.sqlite');
  stat=filesystem.lstatSync(link);
  file=filesystem.realpathSync(link);
  const relative=path.relative(root,file);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size<100||stat.size>64*1024**3
   ||!relative||relative==='..'||relative.startsWith('..'+path.sep)
   ||path.isAbsolute(relative))return base;
 }catch{return base;}
 let db,stage='OPEN_READONLY';
 try{
  const checkedAt=now().toISOString();
  db=openDatabase(file);base.sqliteOpened=true;
  stage='HASH_AND_RUNS_READONLY';
  const attestation=auditFixedR6RawRunSnapshot(db,{checkedAt});
  const dbIdentityTag=sha(JSON.stringify([file,String(stat.dev),String(stat.ino),
   String(stat.birthtimeMs)])).slice(0,16);
  if(attestation.status!=='HASH_AND_RUN_LINKS_VERIFIED_NOT_PIT')
   return {...base,status:'STATE_UNKNOWN',code:'R6_RAW_AUDIT_SCHEMA_UNAVAILABLE',
    attestation,dbIdentityTag};
  return {...base,status:'PASS',code:'R6_RAW_RUN_AGGREGATE_READONLY',
   dbIdentityTag,attestation};
 }catch{
  return {...base,status:'STATE_UNKNOWN',code:'R6_RAW_AUDIT_QUERY_FAILED',firstFail:stage};
 }finally{try{db?.close();}catch{}}
}

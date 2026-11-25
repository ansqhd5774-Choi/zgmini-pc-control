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
const MAX_MISSING_WEEK_BINS=700;
// The W04 57-week gap fits in the existing sanitized 32 KiB result contract.
// Bound week-count output to 64 rows; never return raw keys or raw history.
const MAX_PUBLIC_MISSING_WEEKS=64;
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
const FAILURE_CODES=['CHUNK_OR_COUNT_INVALID','HASH_FORMAT_INVALID',
 'SOURCE_FIELDS_INVALID','TIME_INVALID','RESPONSE_HASH_MISSING',
 'RESPONSE_HASH_VALUE_MISMATCH',
 'SNAPSHOT_ID_MISMATCH','BODY_SHA_MISMATCH'];
const MAX_INVALID_REASON_ROWS=32;
// Exact legacy R4 BED parser algorithm; never replace the immutable HTTP hash.
const stableJson=value=>JSON.stringify(stableValue(value));
function stableValue(value,depth=0){
 if(depth>100)throw Error('R6_CANONICAL_DEPTH');
 if(value==null||typeof value!=='object')return value;
 if(Array.isArray(value))return value.map(x=>stableValue(x,depth+1));
 return Object.fromEntries(Object.keys(value).sort().map(k=>[k,stableValue(value[k],depth+1)]));
}


// All snapshot chunks, body hashes and receipt links are checked on the PC.
// Only bounded counts and snapshot-local ordinals/reason codes leave the PC;
// no raw body, snapshot hash, provider key, path or detailed timestamp leaves.
export function auditFixedR6RawRunSnapshot(db,{checkedAt=new Date().toISOString(),includeInvalidLineage=false}={}){
 if(!Number.isFinite(Date.parse(checkedAt))||new Date(checkedAt).toISOString()!==checkedAt)
  throw Error('R6_RAW_AUDIT_CHECKED_AT_INVALID');
 if(!columnsExist(db,RAW,RAW_COLS)||!columnsExist(db,RUNS,RUN_COLS))
  return {status:'SCHEMA_UNAVAILABLE',checkedAt,
   metadataKeys:null,bodyVerifiedKeys:null,runCertifiedKeys:null,
   invalidBodyKeys:null,validWithoutRunKeys:null,
   invalidReasonCounts:null,invalidReasonOrdinals:null,invalidReasonTruncated:null};
 const verified=new Map();
 const legacy=new Map();
 const legacyProof={examined:0,canonicalMatched:0,canonicalMismatched:0,
  invalidJson:0,bodyOrIdInvalid:0,runLinked:0,
  scope:'LEGACY_BED_CANONICAL_COMPATIBILITY_NOT_PIT'};

 // Internal-only identities for bounded lineage aggregates; never return raw hashes or keys.
 const invalidHeads=includeInvalidLineage?new Map():null;
 const invalidReasonCounts=Object.fromEntries(FAILURE_CODES.map(code=>[code,0]));
 const invalidReasonOrdinals=[];
 // Diagnostic-only: inspect both independent integrity checks even when
 // responseHash has the historical BED canonical-vs-HTTP mismatch.
 // Do not promote these snapshots into verified or certified sets.
 const mismatchIntegrity={
  checked:0,bodyShaMatched:0,bodyShaMismatched:0,
  idMatched:0,idMismatched:0,
 };
 let metadataKeys=0,totalBytes=0,group=null;
 const markInvalid=reason=>{
  invalidReasonCounts[reason]++;
  if(invalidHeads)invalidHeads.set(group.id,{reason,provider:String(group.head.provider??''),
   releaseGroup:String(group.head.release_group??''),retrievedAt:String(group.head.retrieved_at??''),
   bodySha:String(group.head.body_sha256??'')});
  // Ordinal is valid only for this checkedAt/read transaction. It is not
  // a stable record identity, source hash, or approval to repair HISTORY.
  if(invalidReasonOrdinals.length<MAX_INVALID_REASON_ROWS)
   invalidReasonOrdinals.push({ordinal:metadataKeys,reason});
 };
 const finish=()=>{
  if(!group)return;
  const h=group.head;
  if(!group.valid||group.count!==h.chunk_count
   ||!Number.isSafeInteger(h.chunk_count)||h.chunk_count<1
   ||h.chunk_count>MAX_CHUNKS)return markInvalid('CHUNK_OR_COUNT_INVALID');
  if(!HASH.test(String(h.snapshot_id??''))
   ||!HASH.test(String(h.body_sha256??'')))return markInvalid('HASH_FORMAT_INVALID');
  if(!String(h.provider??'').trim()||!String(h.request_key??'').trim()
   ||!String(h.release_group??'').trim())return markInvalid('SOURCE_FIELDS_INVALID');
  const retrieved=Date.parse(h.retrieved_at??''),created=Date.parse(h.created_at??'');
  if(!Number.isFinite(retrieved)||!Number.isFinite(created)||created<retrieved
   ||created>Date.parse(checkedAt)||retrieved>Date.parse(checkedAt))
   return markInvalid('TIME_INVALID');
  const detail=safeJson(h.detail_json);
  if(!detail||!Object.hasOwn(detail,'responseHash')||detail.responseHash==null)
   return markInvalid('RESPONSE_HASH_MISSING');
  if(detail.responseHash!==h.body_sha256){
   if(includeInvalidLineage){
    mismatchIntegrity.checked++;
    if(sha([h.release_group,h.provider,h.request_key,h.body_sha256].join('|'))===h.snapshot_id)
     mismatchIntegrity.idMatched++;
    else mismatchIntegrity.idMismatched++;
    const bodyMatched=group.hasher.digest('hex')===h.body_sha256;
    if(bodyMatched)mismatchIntegrity.bodyShaMatched++;
    else mismatchIntegrity.bodyShaMismatched++;
    if(h.provider==='BLS_BED'&&h.release_group==='BLS_BED'){
     legacyProof.examined++;
     const idMatched=sha([h.release_group,h.provider,h.request_key,h.body_sha256].join('|'))===h.snapshot_id;
     if(!bodyMatched||!idMatched)legacyProof.bodyOrIdInvalid++;
     else try{
      const payload=JSON.parse(group.bodyParts.join(''));
      if(!payload||payload.status!=='REQUEST_SUCCEEDED'||!Array.isArray(payload.Results?.series))
       legacyProof.invalidJson++;
      else if(sha(stableJson(payload))!==detail.responseHash)legacyProof.canonicalMismatched++;
      else{
       legacyProof.canonicalMatched++;
       legacy.set(h.snapshot_id,{provider:h.provider,release_group:h.release_group,
        body_sha256:h.body_sha256,retrieved_at:h.retrieved_at});
      }
     }catch{legacyProof.invalidJson++;}
    }
   }
   return markInvalid('RESPONSE_HASH_VALUE_MISMATCH');
  }
  if(sha([h.release_group,h.provider,h.request_key,h.body_sha256].join('|'))!==h.snapshot_id)
   return markInvalid('SNAPSHOT_ID_MISMATCH');
  if(group.hasher.digest('hex')!==h.body_sha256)
   return markInvalid('BODY_SHA_MISMATCH');
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
    hasher:createHash('sha256'),bodyParts:includeInvalidLineage&&row.provider==='BLS_BED'&&row.release_group==='BLS_BED'?[]:null};
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
   if(group.valid){group.hasher.update(row.body_chunk,'utf8');group.bodyParts?.push(row.body_chunk);}
  }
 }
 finish();
 const certified=new Set();
 const legacyLinked=new Set();
 const invalidRunRevisions=includeInvalidLineage?new Map():null;
 const hasRunRevision=includeInvalidLineage&&columnsExist(db,RUNS,['collector_revision']);
 let runCount=0;
 const runs=db.prepare('SELECT provider,status,completed_at,detail_json'+
  (hasRunRevision?',collector_revision':'')+' FROM '+RUNS+
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
   if(invalidRunRevisions){
    const bad=invalidHeads.get(item?.snapshotId);
    if(bad&&item.bodySha256===bad.bodySha
     &&run.provider==='EMPLOYMENT_R6_'+bad.releaseGroup
     &&Date.parse(bad.retrievedAt)<=completed){
     const declared=String(run.collector_revision??'').trim();
     const revision=hasRunRevision&&/^[A-Za-z0-9._-]{1,64}$/.test(declared)
      ?declared:'UNKNOWN';
     const values=invalidRunRevisions.get(item.snapshotId)??new Set();
     values.add(revision);invalidRunRevisions.set(item.snapshotId,values);
    }
   }
   const old=legacy.get(item?.snapshotId);
   if(old&&item.bodySha256===old.body_sha256&&run.provider==='EMPLOYMENT_R6_'+old.release_group
    &&Date.parse(old.retrieved_at)<=completed)legacyLinked.add(item.snapshotId);
   const snap=verified.get(item?.snapshotId);
   if(snap&&item.bodySha256===snap.body_sha256
    &&run.provider==='EMPLOYMENT_R6_'+snap.release_group
    &&Date.parse(snap.retrieved_at)<=completed)certified.add(item.snapshotId);
  }
 }
 legacyProof.runLinked=legacyLinked.size;
 const missingHistoryLineage=includeInvalidLineage?auditMissingHistoryLineage(db,verified,certified,checkedAt):null;
 const invalidLineageCounts=new Map();
 if(invalidHeads)for(const [id,bad] of invalidHeads){
  const revisions=invalidRunRevisions.get(id);
  const collectorRevision=!revisions?.size?'UNLINKED':revisions.size===1?[...revisions][0]:'AMBIGUOUS';
  const month=/^20\d\d-(?:0[1-9]|1[0-2])/.test(bad.retrievedAt)
   ?bad.retrievedAt.slice(0,7):'UNKNOWN';
  const provider=/^[A-Za-z0-9_]{1,32}$/.test(bad.provider)?bad.provider:'OTHER';
  const releaseGroup=/^[A-Za-z0-9_]{1,64}$/.test(bad.releaseGroup)?bad.releaseGroup:'OTHER';
  const key=JSON.stringify([bad.reason,provider,releaseGroup,month,collectorRevision]);
  invalidLineageCounts.set(key,(invalidLineageCounts.get(key)??0)+1);
 }
 const invalidLineage=invalidHeads?[...invalidLineageCounts].map(([key,count])=>{
  const [reason,provider,releaseGroup,retrievedMonth,collectorRevision]=JSON.parse(key);
  return {reason,provider,releaseGroup,retrievedMonth,collectorRevision,count};
 }).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))):null;
 if(invalidLineage&&invalidLineage.length>64)throw Error('R6_RAW_AUDIT_LINEAGE_GROUP_CAP');
 return {status:'HASH_AND_RUN_LINKS_VERIFIED_NOT_PIT',checkedAt,metadataKeys,
  bodyVerifiedKeys:verified.size,runCertifiedKeys:certified.size,
  invalidBodyKeys:metadataKeys-verified.size,
  validWithoutRunKeys:verified.size-certified.size,
  invalidReasonCounts,invalidReasonOrdinals,
  invalidReasonTruncated:metadataKeys-verified.size>invalidReasonOrdinals.length,
  ...(invalidLineage?{
   invalidLineageGroups:invalidLineage,invalidLineageScope:'DIAGNOSTIC_NOT_PIT',
   mismatchIntegrity:{...mismatchIntegrity,scope:'INDEPENDENT_HASH_CHECKS_NOT_PIT'},
   legacyBedProof:legacyProof,missingHistoryLineage,
  }:{})};
}


function auditMissingHistoryLineage(db,verified,certified,checkedAt){
 const current='market_score_employment_r4_shadow_current_v1';
 const history='market_score_employment_r4_shadow_history_v1';
 const keys=['logical_series_id','geography_type','geography_code','observation_date'];
 const columns=[...keys,'provider','source_hash','retrieved_at','available_at','provenance_json'];
 if(!columnsExist(db,current,columns)||!columnsExist(db,history,keys))
  return {status:'SCHEMA_UNAVAILABLE',scope:'MISSING_HISTORY_KEY_SOURCE_LINKS_NOT_PIT'};
 const links=new Map();
 for(const id of certified){const v=verified.get(id),key=v.provider+'|'+v.body_sha256;
  const times=links.get(key)??[];times.push(Date.parse(v.retrieved_at));links.set(key,times);}
 const groups=new Map(),missingWeeks=new Map();let total=0,invalidClaimWeeks=0;
 const query='SELECT c.* FROM '+current+' c WHERE c.observation_date<=? AND NOT EXISTS (SELECT 1 FROM '+history+
  ' h WHERE '+keys.map(k=>'h.'+k+'=c.'+k).join(' AND ')+')';
 for(const row of db.prepare(query).iterate(checkedAt.slice(0,10))){
  if(++total>100000)throw Error('R6_HISTORY_LINEAGE_ROW_CAP');
  const provider=/^[A-Za-z0-9_]{1,32}$/.test(row.provider??'')?row.provider:'OTHER';
  const series=/^[A-Za-z0-9_]{1,64}$/.test(row.logical_series_id??'')?row.logical_series_id:'OTHER';
  const key=provider+'|'+series;
  const g=groups.get(key)??{provider,logicalSeriesId:series,missingHistoryKeys:0,
   rawRunLinked:0,metadataInvalid:0,rawRunLinkMissing:0,
   availableTimeMissing:0,availableTimeAfterRetrieval:0};
  g.missingHistoryKeys++;
  // Expose bounded week counts for the known W04 Current-only claims gap;
  // do not claim historic availability or PIT completeness.
  if(provider==='DOL_ETA'&&series==='STATE_INITIAL_CLAIMS'){
   const week=String(row.observation_date??'');
   const ms=/^20\d{2}-\d{2}-\d{2}$/.test(week)
    ?Date.parse(week+'T00:00:00.000Z'):NaN;
   if(Number.isFinite(ms)&&new Date(ms).toISOString().slice(0,10)===week){
    const bins=missingWeeks.get(key)??new Map();
    if(!bins.has(week)&&bins.size>=MAX_MISSING_WEEK_BINS)
     throw Error('R6_MISSING_WEEK_BIN_CAP');
    bins.set(week,(bins.get(week)??0)+1);
    missingWeeks.set(key,bins);
   }else invalidClaimWeeks++;
  }
  const p=safeJson(row.provenance_json),rt=Date.parse(row.retrieved_at??'');
  if(!p||!HASH.test(String(row.source_hash??''))||p.rawRecordHash!==row.source_hash
   ||!HASH.test(String(p.responseHash??''))||!Number.isFinite(rt)||rt>Date.parse(checkedAt))g.metadataInvalid++;
  else if((links.get(row.provider+'|'+p.responseHash)??[]).some(t=>t===rt))g.rawRunLinked++;
  else g.rawRunLinkMissing++;
  const at=Date.parse(row.available_at??'');
  if(!Number.isFinite(at))g.availableTimeMissing++;
  else if(at>rt)g.availableTimeAfterRetrieval++;
  groups.set(key,g);
 }
 if(groups.size>64)throw Error('R6_HISTORY_LINEAGE_GROUP_CAP');
 const outputGroups=[...groups.values()].sort((a,b)=>
  (a.provider+'|'+a.logicalSeriesId).localeCompare(b.provider+'|'+b.logicalSeriesId));
 for(const group of outputGroups){
  if(group.provider!=='DOL_ETA'||group.logicalSeriesId!=='STATE_INITIAL_CLAIMS')continue;
  const ordered=[...(missingWeeks.get('DOL_ETA|STATE_INITIAL_CLAIMS')??new Map())]
   .sort(([a],[b])=>a.localeCompare(b));
  Object.assign(group,{
   observedMissingWeeks:ordered.length,
   earliestMissingWeek:ordered[0]?.[0]??null,
   latestMissingWeek:ordered.at(-1)?.[0]??null,
   latestMissingWeekCounts:ordered.slice(-MAX_PUBLIC_MISSING_WEEKS).reverse()
    .map(([week,missingKeys])=>({week,missingKeys})),
   missingWeekCountsTruncated:ordered.length>MAX_PUBLIC_MISSING_WEEKS,
   invalidWeekDateKeys:invalidClaimWeeks,
   weekScope:'CURRENT_ONLY_KEYS_NOT_PIT',
  });
 }
 return {status:'OBSERVED',scope:'MISSING_HISTORY_KEY_SOURCE_LINKS_NOT_PIT',
  missingHistoryKeys:total,groups:outputGroups,
  rawRecordValuesReparsed:false,pitAttested:false,repairAuthorized:false};
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
  const attestation=auditFixedR6RawRunSnapshot(db,{checkedAt,includeInvalidLineage:true});
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

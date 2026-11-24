// Fixed-scope A-grade diagnosis for R6 DOL/BED partial collections.
// Never fetches provider data, changes SQLite, or publishes to D1.
import fs from 'node:fs';
import path from 'node:path';
import {openSqliteReadonly} from './common.mjs';
import {createHash} from 'node:crypto';

const SQLITE_MAGIC='SQLite format 3\0';
const MAX_DB_BYTES=64*1024**3;
const MODES=Object.freeze(['BACKFILL','ONE_YEAR','RELEASE']);
// Literal, non-sensitive stage identifiers shared by the Worker and Controller.
export const R6_READONLY_STAGES=Object.freeze(['OPEN_READONLY','READONLY_PRAGMAS',
 'TABLE_DISCOVERY','RUN_SUMMARY','NATIONAL_RAW_RUN_COMPARISON',
 'ETA539_METADATA','ETA539_RAW_CURRENT_PARITY','STATE_CLAIMS_51_COVERAGE']);
const PROVIDERS=Object.freeze({
 dol:'EMPLOYMENT_R6_DOL_UI_WEEKLY_CLAIMS',
 bed:'EMPLOYMENT_R6_BLS_BED',
});
const TABLES=Object.freeze([
 'market_score_employment_r4_shadow_runs_v1',
 'market_score_employment_r6_raw_snapshot_v1',
 'market_score_employment_r4_shadow_current_v1',
]);
// W04 PIT-04-08: schema-only view of the two fixed Core lineage tables.
// Ordinals are the indices of these constants, never names read from SQLite.
// No arbitrary SQL, DB contents, raw hashes, paths or source bodies leave the PC.
const PIT_SCHEMA_REQUIRED=Object.freeze({
 raw:Object.freeze(['snapshot_id','chunk_index','chunk_count','release_group','provider',
  'request_key','retrieved_at','created_at','body_sha256','detail_json','body_chunk']),
 runs:Object.freeze(['provider','status','completed_at','detail_json']),
});
const PIT_SCHEMA_TABLES=Object.freeze({
 raw:'market_score_employment_r6_raw_snapshot_v1',
 runs:'market_score_employment_r4_shadow_runs_v1',
});
function fixedSchemaColumns(db,tables,table,required){
 const tablePresent=tables.has(table);
 const existing=tablePresent?new Set(db.prepare(`PRAGMA table_info(${table})`).all().map(row=>row.name)):new Set();
 const missingOrdinals=required.flatMap((column,index)=>existing.has(column)?[]:[index]);
 return {tablePresent,requiredCount:required.length,
  presentCount:required.length-missingOrdinals.length,missingOrdinals};
}
function inspectPitRawSchema(db,tables,file,filesystem){
 const raw=fixedSchemaColumns(db,tables,PIT_SCHEMA_TABLES.raw,PIT_SCHEMA_REQUIRED.raw);
 const runs=fixedSchemaColumns(db,tables,PIT_SCHEMA_TABLES.runs,PIT_SCHEMA_REQUIRED.runs);
 const identity=filesystem.statSync(file);
 // A metadata-only identity marker, NOT a digest of any SQLite contents.
 // Stable for the same physical file, not proof of a frozen transaction.
 const dbIdentityTag=createHash('sha256').update(JSON.stringify([
  file,String(identity.dev),String(identity.ino),String(identity.birthtimeMs),
 ])).digest('hex').slice(0,16);
 const reason=!raw.tablePresent?'RAW_TABLE_MISSING'
  :!runs.tablePresent?'RUNS_TABLE_MISSING'
  :raw.missingOrdinals.length?'RAW_REQUIRED_COLUMNS_MISSING'
  :runs.missingOrdinals.length?'RUNS_REQUIRED_COLUMNS_MISSING'
  :'REQUIRED_SCHEMA_PRESENT';
 return {kind:'EMPLOYMENT_R6_PIT_SCHEMA_ONLY_V1',reason,
  checkedAt:new Date().toISOString(),dbIdentityTag,raw,runs};
}
const CORE_STATES=Object.freeze([
 'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
]);
const DOL_IDS=new Set(['INITIAL_CLAIMS','INITIAL_CLAIMS_4W','CONTINUED_CLAIMS','INSURED_UNEMPLOYMENT_RATE','STATE_INITIAL_CLAIMS']);
// Synchronize with the installed R6 national-claims collector's fixed failure categories.
// Preserve only recognized codes; never expose unbounded provider/error text.
const FAILURE_CODES=new Set([
 'SERIES_PARTIAL','DOL_ETA539_SOURCE_FAILED','ROW_REJECTED','NO_OBSERVATIONS','DOL_RELEASE_OBSERVATION_STALE',
 'DOL_NATIONAL_HTTP_FAILED','DOL_NATIONAL_REQUEST_FAILED','DOL_NATIONAL_NO_VALID_ROWS',
 'DOL_NATIONAL_SERIES_INCOMPLETE','DOL_NATIONAL_INVALID_DATA',
 'DOL_NATIONAL_SOURCE_UNAVAILABLE','DOL_NATIONAL_RESPONSE_FORMAT_UNSUPPORTED',
]);
const safeInt=x=>Number.isSafeInteger(x)&&x>=0?x:null;
// Project ONLY fixed, public-safe metadata from an already-stored National
// HTTP attempt. The body, error message, URL, query, raw digest, and tokens
// remain sealed in PC SQLite and never leave this A-grade read-only diagnosis.
const NATIONAL_FORMATS=new Set(['NATIONAL_XML','WEEK_FRAGMENT','HTML','OTHER_MARKUP','TEXT','EMPTY','UNAVAILABLE','SOURCE_UNAVAILABLE']);
const NATIONAL_TYPES=new Set(['application/xml','text/xml','text/html','text/plain','OTHER','MISSING']);
const NATIONAL_FAILURES=new Set(['DOL_NATIONAL_HTTP_FAILED','DOL_NATIONAL_REQUEST_FAILED',
 'DOL_NATIONAL_NO_VALID_ROWS','DOL_NATIONAL_SERIES_INCOMPLETE','DOL_NATIONAL_INVALID_DATA',
 'DOL_NATIONAL_SOURCE_UNAVAILABLE','DOL_NATIONAL_RESPONSE_FORMAT_UNSUPPORTED']);
function safeNationalResponse(value){
 if(!object(value))return null;
 const count=value.parsedNationalSeriesCount;
 return {
  httpStatus:Number.isSafeInteger(value.httpStatus)&&value.httpStatus>=100&&value.httpStatus<=599?value.httpStatus:null,
  contentTypeCategory:NATIONAL_TYPES.has(value.contentTypeCategory)?value.contentTypeCategory:'UNKNOWN',
  responseFormat:NATIONAL_FORMATS.has(value.responseFormat)?value.responseFormat:'UNKNOWN',
  bodyPresent:Number.isSafeInteger(value.bodyCharLength)?value.bodyCharLength>0:null,
  parsedNationalSeriesCount:Number.isSafeInteger(count)&&count>=0&&count<=4?count:null,
  requestFailureCode:NATIONAL_FAILURES.has(value.requestFailureCode)?value.requestFailureCode:null,
  validationFailureCode:NATIONAL_FAILURES.has(value.validationFailureCode)?value.validationFailureCode:null,
  latestNationalObservationDate:date(value.latestNationalObservationDate),
 };
}

const date=x=>typeof x==='string'&&/^20\d{2}-\d{2}-\d{2}$/.test(x)?x:null;
const stamp=x=>typeof x==='string'&&/^20\d{2}-\d{2}-\d{2}T[\d:.]+Z$/.test(x)?x:null;
const noWrite=()=>({providerCalls:0,d1Writes:0,operationalWrites:0});
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
function safeJson(text){
 if(typeof text!=='string'||Buffer.byteLength(text)>40000)return null;
 try{const value=JSON.parse(text);return object(value)?value:null;}catch{return null;}
}
function safeEntry(file,root,filesystem){
 try{
  const stat=filesystem.lstatSync(file),real=filesystem.realpathSync(file);
  const relative=path.relative(root,real);
  return !stat.isSymbolicLink()&&relative&&relative!=='..'&&
   !relative.startsWith('..'+path.sep)&&!path.isAbsolute(relative)?{stat,real}:null;
 }catch{return null;}
}
// A normal read-only SQLite open may create WAL sidecars. Check their exact state.
function preflight(file,root,filesystem){
 const entry=safeEntry(file,root,filesystem);
 if(!entry?.stat.isFile()||entry.stat.size<100||entry.stat.size>MAX_DB_BYTES)
  return {status:'STATE_UNKNOWN',code:'R6_EVIDENCE_DB_MISSING_OR_UNSAFE'};
 let fd,header;
 try{
  fd=filesystem.openSync(entry.real,'r');header=Buffer.alloc(20);
  if(filesystem.readSync(fd,header,0,20,0)!==20)throw Error('SHORT_HEADER');
 }catch{return {status:'STATE_UNKNOWN',code:'R6_EVIDENCE_HEADER_UNREADABLE'};}
 finally{if(fd!==undefined)filesystem.closeSync(fd);}
 if(header.toString('ascii',0,16)!==SQLITE_MAGIC||![1,2].includes(header[18])||![1,2].includes(header[19]))
  return {status:'STATE_UNKNOWN',code:'R6_EVIDENCE_HEADER_INVALID'};
 if(header[18]===2||header[19]===2){
  const sidecars=['-wal','-shm'].map(ext=>{
   try{
    filesystem.lstatSync(file+ext);
    return safeEntry(file+ext,root,filesystem)?.stat.isFile()?'VALID':'UNSAFE';
   }catch(error){return error?.code==='ENOENT'?'ABSENT':'UNSAFE';}
  });
  // File presence is not a health test. SQLite may rebuild coordination files;
  // never follow unsafe entries, but let the native reader validate normal WAL.
  if(sidecars.includes('UNSAFE'))
   return {status:'STATE_UNKNOWN',code:'R6_EVIDENCE_WAL_SIDECARS_PARTIAL_OR_UNSAFE'};
 }
 return {status:'PASS',path:entry.real};
}
function summarizeRun(row,provider){
 if(!row)return {status:'NOT_STORED'};
 const detail=safeJson(row.detail_json);
 const missing=Array.isArray(detail?.missingSeries)?detail.missingSeries:[];
 const safeMissing=provider==='dol'?missing.filter(x=>DOL_IDS.has(x)):
  missing.filter(x=>typeof x==='string'&&/^BDS[A-Z0-9]{5,35}$/.test(x));
 return {
  status:['SUCCESS','PARTIAL','FAIL'].includes(row.status)?row.status:'UNKNOWN',
  completedAt:stamp(row.completed_at),
  failureCode:FAILURE_CODES.has(row.failure_code)?row.failure_code:row.failure_code==null?null:'OTHER',
  providerRequests:safeInt(row.provider_requests),collectedRows:safeInt(row.collected_rows),
  inserted:safeInt(row.inserted_count),revised:safeInt(row.revised_count),rejected:safeInt(row.rejected_count),
  missingSeriesCount:Array.isArray(detail?.missingSeries)?missing.length:null,
  knownMissingSeries:safeMissing.slice(0,12),
  latestInitialClaimsObservationDate:provider==='dol'?date(detail?.latestInitialClaimsObservationDate):null,
  ...(provider==='dol'?{nationalResponse:safeNationalResponse(detail?.nationalResponseEvidence)}:{}),
 };
}
const day=x=>Date.parse(x+'T00:00:00Z');
const DAY_MS=86400000;
const WEEK_MS=7*DAY_MS;
function tenYearStart(week){
 const d=new Date(`${week}T00:00:00Z`),month=d.getUTCMonth(),dayOfMonth=d.getUTCDate();
 d.setUTCFullYear(d.getUTCFullYear()-10);
 if(month===1&&dayOfMonth===29&&d.getUTCMonth()!==1)d.setUTCDate(28);
 return d.getTime();
}
function fullTenYearRawCoverage(weeks,complete){
 const latest=weeks.at(-1)?.week;
 if(!latest)return {status:'INSUFFICIENT_RAW_WEEKS',observedRawWeeks:0,requiredRawWeeks:null,referenceWeeks:null};
 const latestMs=day(latest),referenceWeeks=Math.floor((latestMs-tenYearStart(latest))/WEEK_MS);
 const requiredRawWeeks=referenceWeeks+56;
 const result={status:'INSUFFICIENT_RAW_WEEKS',observedRawWeeks:weeks.length,
  requiredRawWeeks,requiredRows:requiredRawWeeks*51,referenceWeeks,
  firstRequiredWeek:new Date(latestMs-(requiredRawWeeks-1)*WEEK_MS).toISOString().slice(0,10),
  latestRequiredWeek:latest,firstFailureWeek:null};
 // Enumerate fixed calendar weeks, including the first missing of 576 rows.
 // Keep the approved invalid-value and four-week-base failures unchanged.
 const byWeek=new Map(weeks.map(w=>[w.week,w]));
 const firstRequiredMs=latestMs-(requiredRawWeeks-1)*WEEK_MS;
 for(let i=0;i<requiredRawWeeks;i++){
  const expectedMs=firstRequiredMs+i*WEEK_MS;
  const expectedWeek=new Date(expectedMs).toISOString().slice(0,10);
  const w=byWeek.get(expectedWeek);
  if(!w)return {...result,status:weeks.length<requiredRawWeeks?
   'INSUFFICIENT_RAW_WEEKS':'NONCONSECUTIVE_10Y_WEEKS',firstFailureWeek:expectedWeek};
  if(w.invalidValues!==0)
   return {...result,status:'STATE_CLAIMS_VALUE_INVALID',firstFailureWeek:expectedWeek};
  if(!complete(w))
   return {...result,status:'REGION_51_COVERAGE_GAP',firstFailureWeek:expectedWeek};
  if(i>=55){
   const priorWeek=new Date(expectedMs-52*WEEK_MS).toISOString().slice(0,10);
   const prior=byWeek.get(priorWeek);
   if(prior?.invalidPriorRegions!==0)
    return {...result,status:'PRIOR_4W_INVALID_BASE',firstFailureWeek:expectedWeek};
   if(prior?.zeroPriorRegions!==0)
    return {...result,status:'PRIOR_4W_ZERO_BASE',firstFailureWeek:expectedWeek};
  }
 }
 return {...result,status:'RAW_PRECONDITIONS_COMPLETE'};
}

// W04 PIT-04-07: fixed, aggregate-only ETA539 raw c3 <-> stored Current audit.
// One immutable, hash-verified stored snapshot; no provider access, raw export,
// History mutation, backdating, or claim that this is historical TRUE_PIT.
// Reuse the established fixed R6 raw/run attestation's 32 MiB / 4096-chunk
// limits. ETA539 saves the full provider CSV, not only selected 60 weeks.
const ETA539_MAX_RAW=32*1024*1024;
const ETA539_MAX_CHUNKS=4096;
const ETA539_CURRENT_TABLE='market_score_employment_r4_shadow_current_v1';
const eta539Digest=s=>createHash('sha256').update(s).digest('hex');
function eta539CsvLine(line){
 const cells=[];let value='',quoted=false;
 for(let i=0;i<line.length;i++){
  const c=line[i];
  if(quoted){if(c==='"'&&line[i+1]==='"'){value+='"';i++;}
   else if(c==='"')quoted=false;else value+=c;}
  else if(c==='"')quoted=true;
  else if(c===','){cells.push(value);value='';}
  else value+=c;
 }
 if(quoted)return null;
 cells.push(value);
 return cells;
}
function eta539Date(value,{week=false}={}){
 const s=String(value??'').trim();
 let m=s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
 if(m)m=[m[0],m[3],m[1],m[2]];
 else m=s.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
 if(!m)return null;
 const year=Number(m[1]),month=Number(m[2]),dayOfMonth=Number(m[3]);
 if(year<1900||year>2199||month<1||month>12||dayOfMonth<1||dayOfMonth>31)return null;
 const d=new Date(Date.UTC(year,month-1,dayOfMonth));
 if(d.getUTCFullYear()!==year||d.getUTCMonth()!==month-1
   ||d.getUTCDate()!==dayOfMonth||(week&&d.getUTCDay()!==6))return null;
 return d.toISOString().slice(0,10);
}
function eta539ClaimValue(text){
 const s=String(text??'').trim();
 if(!/^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(s))return null;
 const n=Number(s.replace(/,/g,''));
 return Number.isSafeInteger(n)&&n>=0?n:null;
}
function inspectEta539RawCurrentParity(db){
 const base={kind:'W04_ETA539_C3_RAW_CURRENT_PARITY_V1',status:'UNVERIFIED',
  rawPitAttested:false,repairAuthorized:false};
 const fail=status=>({...base,status});
 const columns=table=>new Set(db.prepare('PRAGMA table_info('+table+')').all().map(x=>x.name));
 const rawTable='market_score_employment_r6_raw_snapshot_v1';
 const rawCols=columns(rawTable),curCols=columns(ETA539_CURRENT_TABLE);
 const requiredRaw=['snapshot_id','chunk_index','chunk_count','release_group','provider',
  'request_key','retrieved_at','body_sha256','body_chunk'];
 const requiredCurrent=['logical_series_id','geography_type','geography_code',
  'observation_date','value','provider','provider_series_id','source_hash','source_revision','retrieved_at'];
 if(requiredRaw.some(k=>!rawCols.has(k))||requiredCurrent.some(k=>!curCols.has(k)))
  return fail('SCHEMA_UNSUPPORTED');
 const head=db.prepare("SELECT snapshot_id,chunk_count,release_group,provider,request_key,retrieved_at,body_sha256 FROM "+
   rawTable+" WHERE release_group='DOL_UI_WEEKLY_CLAIMS' "+
   "AND request_key IN ('DOL_ETA539:60w','DOL_ETA539:112w','DOL_ETA539:530w','DOL_ETA539:600w') "+
   "AND chunk_index=0 ORDER BY retrieved_at DESC LIMIT 1").get();
 if(!head)return fail('RAW_SNAPSHOT_NOT_STORED');
 // Classify actual metadata failure, rather than treating an oversized
 // provider CSV as corrupt. No source IDs, body hashes or dates are exposed.
 if(typeof head.snapshot_id!=='string'||!NATIONAL_RAW_HASH.test(head.snapshot_id))
  return fail('RAW_SNAPSHOT_ID_INVALID');
 if(!Number.isSafeInteger(head.chunk_count)||head.chunk_count<1
   ||head.chunk_count>ETA539_MAX_CHUNKS)return fail('RAW_CHUNK_COUNT_OUT_OF_BOUNDS');
 if(!NATIONAL_RAW_HASH.test(head.body_sha256??''))return fail('RAW_BODY_SHA_FORMAT_INVALID');
 if(!Number.isFinite(Date.parse(head.retrieved_at??'')))return fail('RAW_RETRIEVED_AT_INVALID');
 const chunks=db.prepare('SELECT chunk_index,chunk_count,body_sha256,body_chunk FROM '+
   rawTable+' WHERE snapshot_id=? ORDER BY chunk_index LIMIT 4097').all(head.snapshot_id);
 if(chunks.length!==head.chunk_count||chunks.some((c,i)=>c.chunk_index!==i
   ||c.chunk_count!==head.chunk_count||c.body_sha256!==head.body_sha256
   ||typeof c.body_chunk!=='string'))return fail('RAW_CHUNKS_INVALID');
 const bytes=chunks.reduce((n,c)=>n+Buffer.byteLength(c.body_chunk),0);
 if(bytes>ETA539_MAX_RAW)return fail('RAW_SIZE_LIMIT');
 const raw=chunks.map(c=>c.body_chunk).join('');
 if(eta539Digest(raw)!==head.body_sha256.toLowerCase()
   ||eta539Digest([head.release_group,head.provider,head.request_key,
     head.body_sha256.toLowerCase()].join('|'))!==head.snapshot_id.toLowerCase())
  return fail('RAW_BODY_OR_ID_HASH_MISMATCH');
 const lines=raw.replace(/\r/g,'').split('\n').filter(x=>x.trim());
 if(lines.length<2||lines.length>500000)return fail('RAW_ROW_COUNT_INVALID');
 const header=eta539CsvLine(lines[0])?.map(x=>x.trim().toLowerCase());
 if(!header||new Set(header).size!==header.length
   ||['st','rptdate','c2','c3'].some(k=>!header.includes(k)))return fail('RAW_HEADER_INVALID');
 const col=Object.fromEntries(['st','rptdate','c2','c3'].map(k=>[k,header.indexOf(k)]));
 const rows=new Map();let invalidLatest=0,ambiguousLatest=0,invalidDates=0;
 const cutoff=head.retrieved_at.slice(0,10),core=new Set(CORE_STATES);
 for(const line of lines.slice(1)){
  const fields=eta539CsvLine(line);
  if(!fields||fields.length!==header.length)return fail('RAW_CSV_INVALID');
  const st=String(fields[col.st]??'').trim().toUpperCase();
  if(!core.has(st))continue;
  const week=eta539Date(fields[col.c2],{week:true});
  const report=eta539Date(fields[col.rptdate]);
  if(!week||!report){invalidDates++;continue;}
  if(week>cutoff||report>cutoff)continue;
  const value=eta539ClaimValue(fields[col.c3]),key=st+'|'+week;
  const previous=rows.get(key);
  if(!previous||report>previous.report||(report===previous.report)){
   rows.set(key,{st,week,report,value,ambiguous:report===previous?.report&&
     (previous.value!==value||previous.ambiguous)});
  }
 }
 const weeks=new Map();
 for(const record of rows.values()){
  if(record.value===null){invalidLatest++;continue;}
  if(record.ambiguous){ambiguousLatest++;continue;}
  const bucket=weeks.get(record.week)??new Map();
  bucket.set(record.st,record);weeks.set(record.week,bucket);
 }
 const allWeeks=[...weeks.keys()].sort((a,b)=>b.localeCompare(a));
 const selected=allWeeks.filter(w=>weeks.get(w).size===CORE_STATES.length).slice(0,60);
 if(!selected.length)return {...fail('NO_COMPLETE_WEEK_IN_SNAPSHOT'),
  latestSnapshotStoredAt:stamp(head.retrieved_at),invalidLatest,ambiguousLatest,invalidDates};
 const holders=selected.map(()=>'?').join(',');
 const current=db.prepare("SELECT geography_code,observation_date,value,provider,provider_series_id,"+
   "source_hash,source_revision,retrieved_at FROM "+ETA539_CURRENT_TABLE+
   " WHERE logical_series_id='STATE_INITIAL_CLAIMS' AND geography_type='STATE'"+
   ' AND observation_date IN ('+holders+')').all(...selected);
 const byKey=new Map(current.map(c=>[c.geography_code+'|'+c.observation_date,c]));
 const counts={MATCH:0,CURRENT_NEWER_THAN_RAW:0,MISSING_CURRENT:0,OTHER_SOURCE:0,
  VALUE_DIFFERENT:0,HASH_DIFFERENT:0,REVISION_DIFFERENT:0};
 // A later Current retrieved_at is not historical PIT proof, but it need not
 // conceal a content/hash/revision disagreement with the immutable Raw body.
 // Keep the existing disjoint counts and supply an independent nested tally.
 const newerCurrentComparison={VALUE_HASH_REVISION_MATCH:0,VALUE_DIFFERENT:0,
  HASH_DIFFERENT:0,REVISION_DIFFERENT:0};
 for(const week of selected){
  for(const item of weeks.get(week).values()){
   const cur=byKey.get(item.st+'|'+item.week);
   if(!cur){counts.MISSING_CURRENT++;continue;}
   if(cur.provider!=='DOL_ETA'||cur.provider_series_id!=='ETA539:C3'){
    counts.OTHER_SOURCE++;continue;
   }
   const expectedHash=eta539Digest(JSON.stringify({reflectedWeek:item.week,reportDate:item.report,
    st:item.st,value:item.value}));
   const expectedRevision='ETA539:RPTDATE:'+item.report;
   const reason=typeof cur.value!=='number'||!Number.isFinite(cur.value)
      ||cur.value!==item.value?'VALUE_DIFFERENT'
    :cur.source_hash!==expectedHash?'HASH_DIFFERENT'
    :cur.source_revision!==expectedRevision?'REVISION_DIFFERENT':'MATCH';
   if(Date.parse(cur.retrieved_at)>Date.parse(head.retrieved_at)){
    counts.CURRENT_NEWER_THAN_RAW++;
    newerCurrentComparison[reason==='MATCH'?'VALUE_HASH_REVISION_MATCH':reason]++;
   }else counts[reason]++;
  }
 }
 const checked=selected.length*CORE_STATES.length;
 if(Object.values(counts).reduce((a,b)=>a+b,0)!==checked
   ||Object.values(newerCurrentComparison).reduce((a,b)=>a+b,0)!==counts.CURRENT_NEWER_THAN_RAW)
  return fail('PARITY_COUNT_INCONSISTENT');
 return {...base,status:'SNAPSHOT_SCOPE_CLASSIFIED_NOT_PIT',
  snapshotRequestKey:head.request_key,latestSnapshotStoredAt:stamp(head.retrieved_at),
  completeWeeksInSnapshot:allWeeks.filter(w=>weeks.get(w).size===CORE_STATES.length).length,
  checkedWeeks:selected.length,checkedKeys:checked,invalidLatest,ambiguousLatest,invalidDates,
  counts,newerCurrentComparison,
  comparisonScope:'SINGLE_STORED_SNAPSHOT_CONTENT_ONLY_NOT_HISTORICAL_PIT'};
}

function coverage(rows){
 if(!Array.isArray(rows))return {status:'UNKNOWN'};
 const weeks=rows.map(r=>({week:date(r.observation_date),count:safeInt(r.row_count),regions:safeInt(r.region_count),
  unknown:safeInt(r.unknown_code_count),zeroPriorRegions:safeInt(r.zero_prior_region_count),
  invalidValues:safeInt(r.invalid_value_count),invalidPriorRegions:safeInt(r.invalid_prior_region_count)})).filter(x=>x.week);
 weeks.sort((a,b)=>a.week.localeCompare(b.week));
 const complete=x=>x?.count===51&&x?.regions===51&&x?.unknown===0&&x?.invalidValues===0;
 let latestCandidate=null,earliestBreak=null,latestBreak=null,eligible=0;
 for(let i=55;i<weeks.length;i++){
  const current=weeks.slice(i-3,i+1),previous=weeks.slice(i-55,i-51);
  const consecutive=group=>group.every((x,j)=>j===0||day(x.week)-day(group[j-1].week)===7*86400000);
  let reason=null;
  if(current.length!==4||previous.length!==4||!consecutive(current)||!consecutive(previous)||
     current.some((x,j)=>day(x.week)-day(previous[j].week)!==52*7*86400000))reason='WEEK_ALIGNMENT_GAP';
  else if([...current,...previous].some(x=>x.invalidValues!==0))reason='STATE_CLAIMS_VALUE_INVALID';
  else if([...current,...previous].some(x=>!complete(x)))reason='REGION_51_COVERAGE_GAP';
  // R6 rejects missing/invalid and zero four-week PRIOR bases, but allows an
  // individual genuine zero claim. The prior window ends at previous[3].
  else if(previous[3].invalidPriorRegions!==0)reason='PRIOR_4W_INVALID_BASE';
  else if(previous[3].zeroPriorRegions!==0)reason='PRIOR_4W_ZERO_BASE';
  if(reason){if(!earliestBreak)earliestBreak={week:weeks[i].week,reason};latestBreak={week:weeks[i].week,reason};}
  else{latestCandidate=weeks[i].week;eligible++;}
 }
 const last=weeks.at(-1);
 const first=weeks[0];
 const latestComplete=weeks.filter(complete).at(-1)?.week??null;
 return {status:'OBSERVED',sampledWeeks:weeks.length,firstWeek:first?.week??null,lastWeek:last?.week??null,
  complete51Weeks:weeks.filter(complete).length,incompleteWeeks:weeks.filter(x=>!complete(x)).length,
  latestComplete51Week:latestComplete,latestStrict52WeekCandidate:latestCandidate,
  strict52WeekCandidateCount:eligible,firstWindowBreak:earliestBreak,latestWindowBreak:latestBreak,
  fullTenYearRawCoverage:fullTenYearRawCoverage(weeks,complete),
  recentIncompleteWeeks:weeks.filter(x=>!complete(x)).slice(-8).reverse().map(x=>({
   week:x.week,regions:x.regions,rows:x.count,unknownCodes:x.unknown,invalidValues:x.invalidValues})),
  note:'COUNT_ONLY_NOT_PIT_OR_FORMULA_VERIFICATION'};
}


// The generic R6 audit expects detail.responseHash; ETA538 PDF raw uses an
// original binary SHA and a separate Base64-text SHA. Check both identities
// and exact four CURRENT row links without publishing PDF bytes or values.
// This is not an independent reparse of the four statistics from the PDF.
const ETA538_IDS=Object.freeze({
 INITIAL_CLAIMS:'DOL:ETA538:InitialClaims:SA',
 INITIAL_CLAIMS_4W:'DOL:ETA538:InitialClaims:SA4WK',
 CONTINUED_CLAIMS:'DOL:ETA538:ContinuedClaims:SA',
 INSURED_UNEMPLOYMENT_RATE:'DOL:ETA538:IUR:SA',
});
const ETA538_RAW_TABLE='market_score_employment_r6_raw_snapshot_v1';
const ETA538_CURRENT_TABLE='market_score_employment_r4_shadow_current_v1';
const eta538Sha=value=>createHash('sha256').update(value).digest('hex');
const eta538Fail=code=>({status:code,releaseDate:null,verifiedNationalRows:0,
 originalPdfSha256Matched:false,valuesReparsed:false,pitAttested:false});
export function auditStoredEta538PdfRawLinkage(db){
 const requiredRaw=['snapshot_id','chunk_index','chunk_count','release_group',
  'provider','request_key','retrieved_at','body_sha256','body_chunk',
  'detail_json','content_type'];
 const requiredCurrent=['provider','geography_type','geography_code',
  'logical_series_id','observation_date','provider_series_id','unit','value',
  'source_hash','provenance_json'];
 const have=table=>new Set(db.prepare('PRAGMA table_info('+table+')').all()
  .map(x=>x.name));
 const rawCols=have(ETA538_RAW_TABLE),currentCols=have(ETA538_CURRENT_TABLE);
 if(!requiredRaw.every(k=>rawCols.has(k))||
    !requiredCurrent.every(k=>currentCols.has(k)))
  return eta538Fail('SCHEMA_UNAVAILABLE');
 const keyPrefix='DOL_ETA538_PDF:';
 const first=db.prepare("SELECT * FROM "+ETA538_RAW_TABLE+
  " WHERE release_group='DOL_UI_WEEKLY_CLAIMS' AND provider='DOL_ETA'"+
  " AND request_key LIKE 'DOL_ETA538_PDF:%' AND chunk_index=0"+
  " ORDER BY retrieved_at DESC LIMIT 1").get();
 if(!first)return eta538Fail('NOT_STORED');
 const releaseDate=String(first.request_key??'').slice(keyPrefix.length);
 if(!/^20\d{2}-\d{2}-\d{2}$/.test(releaseDate)||
  first.request_key!==keyPrefix+releaseDate||
  !Number.isSafeInteger(first.chunk_count)||first.chunk_count<1||
  first.chunk_count>128)return eta538Fail('PDF_HEAD_INVALID');
 const detail=safeJson(first.detail_json);
 if(!detail||detail.schema!=='W04_DOL_ETA538_PDF_BASE64_SNAPSHOT_V1'||
  detail.bodyEncoding!=='BASE64_PDF_BYTES'||
  detail.originalContentType!=='application/pdf'||
  detail.sourceReleaseDate!==releaseDate||
  detail.sourceUrl!=='https://oui.doleta.gov/press/'+releaseDate.slice(0,4)+'/'+
   releaseDate.slice(5,7)+releaseDate.slice(8,10)+releaseDate.slice(2,4)+'.pdf'||
  first.content_type!=='application/pdf'||
  !/^[0-9a-f]{64}$/.test(detail.originalBodySha256??'')||
  !/^[0-9a-f]{64}$/.test(detail.bodyTextSha256??'')||
  !Number.isSafeInteger(detail.originalBodyBytes)||
  detail.originalBodyBytes<80||detail.originalBodyBytes>8000000||
  !detail.sourceObservationWeeks||typeof detail.sourceObservationWeeks!=='object')
  return eta538Fail('PDF_METADATA_INVALID');
 const parts=db.prepare("SELECT * FROM "+ETA538_RAW_TABLE+
  " WHERE snapshot_id=? ORDER BY chunk_index LIMIT 129").all(first.snapshot_id);
 if(parts.length!==first.chunk_count)return eta538Fail('PDF_CHUNKS_INVALID');
 let encoded='',total=0;
 for(let i=0;i<parts.length;i++){
  const row=parts[i];
  if(row.chunk_index!==i||row.chunk_count!==first.chunk_count||
   row.snapshot_id!==first.snapshot_id||row.body_sha256!==first.body_sha256||
   row.request_key!==first.request_key||row.detail_json!==first.detail_json||
   row.retrieved_at!==first.retrieved_at||
   typeof row.body_chunk!=='string'||row.body_chunk.length>120000)
   return eta538Fail('PDF_CHUNKS_INVALID');
  encoded+=row.body_chunk;total+=row.body_chunk.length;
  if(total>10666672)return eta538Fail('PDF_SIZE_INVALID');
 }
 if(!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded))
  return eta538Fail('PDF_BASE64_INVALID');
 const bytes=Buffer.from(encoded,'base64'),bodyTextHash=eta538Sha(encoded);
 if(bytes.toString('base64')!==encoded||
  bytes.length!==detail.originalBodyBytes||
  bodyTextHash!==first.body_sha256||bodyTextHash!==detail.bodyTextSha256||
  eta538Sha(bytes)!==detail.originalBodySha256||
  eta538Sha('DOL_UI_WEEKLY_CLAIMS|DOL_ETA|'+first.request_key+'|'+bodyTextHash)!==first.snapshot_id||
  !bytes.subarray(0,8).toString('latin1').startsWith('%PDF-')||
  !bytes.subarray(Math.max(0,bytes.length-1024)).toString('latin1').includes('%%EOF'))
  return eta538Fail('PDF_BYTES_OR_HASH_MISMATCH');
 const rows=db.prepare('SELECT * FROM '+ETA538_CURRENT_TABLE+
  " WHERE provider='DOL_ETA' AND geography_type='NATIONAL'"+
  " AND geography_code='US'"+
  " AND json_extract(provenance_json,'$.rawSnapshotId')=?"+
  ' ORDER BY logical_series_id LIMIT 6').all(first.snapshot_id);
 if(rows.length!==4)return eta538Fail('PDF_NATIONAL_ROW_COUNT_INVALID');
 const keys=Object.keys(ETA538_IDS);
 if(Object.keys(detail.sourceObservationWeeks).length!==4||
  keys.some(k=>!/^20\d{2}-\d{2}-\d{2}$/.test(detail.sourceObservationWeeks[k]??''))||
  new Set(rows.map(x=>x.logical_series_id)).size!==4)
  return eta538Fail('PDF_NATIONAL_ROW_IDENTITY_INVALID');
 for(const row of rows){
  if(!Object.hasOwn(ETA538_IDS,row.logical_series_id)||
   row.provider_series_id!==ETA538_IDS[row.logical_series_id]||
   row.observation_date!==detail.sourceObservationWeeks[row.logical_series_id]||
   typeof row.value!=='number'||!Number.isFinite(row.value)||row.value<0)
   return eta538Fail('PDF_NATIONAL_ROW_IDENTITY_INVALID');
  const provenance=safeJson(row.provenance_json);
  const canonical={logicalSeriesId:row.logical_series_id,
   observationDate:row.observation_date,providerSeriesId:row.provider_series_id,
   value:row.value,unit:row.unit,releaseDate};
  const digest=eta538Sha(JSON.stringify(canonical));
  if(!provenance||
   provenance.originalPdfSha256!==detail.originalBodySha256||
   provenance.responseHash!==bodyTextHash||
   provenance.rawSnapshotId!==first.snapshot_id||
   provenance.rawRecordHash!==digest||row.source_hash!==digest||
   provenance.sourceKind!=='ETA538_ADVANCE_RELEASE_PDF')
   return eta538Fail('PDF_NATIONAL_ROW_HASH_LINK_INVALID');
 }
 return {status:'PDF_BYTES_AND_FOUR_ROW_HASH_LINKS_VERIFIED_NOT_VALUE_REPARSE',
  releaseDate,verifiedNationalRows:4,originalPdfSha256Matched:true,
  observationWeeks:Object.fromEntries(keys.map(k=>[k,detail.sourceObservationWeeks[k]])),
  valuesReparsed:false,pitAttested:false};
}

// W04 fixed-scope National RAW-vs-run audit. Link only by the original
// response BODY digest stored in the run (never by a coincidental date).
// Raw XML, exact digest and individual values must never leave this operation.
const NATIONAL_RAW_MAX_CHUNKS=24;
const NATIONAL_RAW_MAX_CHARS=2_880_000;
const NATIONAL_RAW_HASH=/^[a-f0-9]{64}$/i;
const NATIONAL_RAW_SERIES=Object.freeze({
 INITIAL_CLAIMS:['InitialClaims','SA'],
 INITIAL_CLAIMS_4W:['InitialClaims','SA4WK'],
 CONTINUED_CLAIMS:['ContinuedClaims','SA'],
 INSURED_UNEMPLOYMENT_RATE:['IUR','SA'],
});
function rawTag(block,tag){
 const match=String(block).match(new RegExp('<'+tag+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/'+tag+'>','i'));
 return match?match[1]:null;
}
function rawWeekDate(value){
 const m=String(value??'').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
 if(!m)return null;
 const y=Number(m[3]),month=Number(m[1]),d=Number(m[2]);
 if(y<1900||y>2199||month<1||month>12||d<1||d>31)return null;
 const time=new Date(Date.UTC(y,month-1,d));
 if(time.getUTCFullYear()!==y||time.getUTCMonth()!==month-1||time.getUTCDate()!==d
    ||time.getUTCDay()!==6)return null;
 return time.toISOString().slice(0,10);
}
function rawNationalDates(xml,retrievedAt){
 if(!/^\s*(?:<\?xml[^>]*\?>\s*)?<r539cyNational(?:\s[^>]*)?>/i.test(xml)
    ||!/<\/r539cyNational\s*>\s*(?:<!--[\s\S]*?-->\s*)*$/i.test(xml))return null;
 const observed=Object.fromEntries(Object.keys(NATIONAL_RAW_SERIES).map(k=>[k,null]));
 let latestWeekEnded=null,weekBlocks=0,invalidWeekDates=0;
 for(const match of xml.matchAll(/<week(?:\s[^>]*)?>([\s\S]*?)<\/week>/gi)){
  weekBlocks++;
  const block=match[1],date=rawWeekDate(rawTag(block,'weekEnded'));
  if(!date){invalidWeekDates++;continue;}
  if(!latestWeekEnded||date>latestWeekEnded)latestWeekEnded=date;
  if(retrievedAt&&date>retrievedAt.slice(0,10))continue;
  for(const [id,[outer,inner]] of Object.entries(NATIONAL_RAW_SERIES)){
   const value=rawTag(rawTag(block,outer),inner);
   if(value==null||!String(value).trim())continue;
   const parsed=Number(String(value).replace(/,/g,'').trim());
   if(!Number.isFinite(parsed)||parsed<0||(id==='INSURED_UNEMPLOYMENT_RATE'&&parsed>100))continue;
   if(!observed[id]||date>observed[id])observed[id]=date;
  }
 }
 return {latestWeekEnded,latestNumericDates:observed,weekBlocks,invalidWeekDates};
}
function auditStoredNationalRun(db,mode){
 const base={status:'NOT_VERIFIED',latestWeekEnded:null,latestNumericDates:null,
  recordedLatestDates:null,weekBlocks:null,invalidWeekDates:null,linkedByRawBodySha:false};
 const run=db.prepare("SELECT detail_json FROM market_score_employment_r4_shadow_runs_v1 WHERE provider='EMPLOYMENT_R6_DOL_UI_WEEKLY_CLAIMS' AND json_extract(detail_json,'$.mode')=? ORDER BY completed_at DESC LIMIT 1").get(mode);
 if(!run)return {...base,status:'RUN_NOT_STORED'};
 const detail=safeJson(run.detail_json);
 const bodySha=detail?.nationalResponseEvidence?.bodySha256;
 if(typeof bodySha!=='string'||!NATIONAL_RAW_HASH.test(bodySha))return {...base,status:'RUN_BODY_HASH_NOT_STORED'};
 // Historical fixture DBs may lack immutable source-key columns. Report
 // unsupported evidence, never silently convert this to a source failure.
 const columns=new Set(db.prepare("PRAGMA table_info(market_score_employment_r6_raw_snapshot_v1)").all().map(x=>x.name));
 if(!['snapshot_id','body_sha256','body_chunk','chunk_index','chunk_count',
      'request_key','release_group','retrieved_at'].every(k=>columns.has(k)))
  return {...base,status:'RAW_SCHEMA_UNSUPPORTED'};
 const head=db.prepare("SELECT snapshot_id,chunk_count,retrieved_at FROM market_score_employment_r6_raw_snapshot_v1 WHERE body_sha256=? AND release_group='DOL_UI_WEEKLY_CLAIMS' AND request_key LIKE 'DOL_NATIONAL:%' AND chunk_index=0 ORDER BY retrieved_at DESC LIMIT 1").get(bodySha.toLowerCase());
 if(!head)return {...base,status:'MATCHING_RAW_NOT_STORED'};
 if(typeof head.snapshot_id!=='string'||!Number.isSafeInteger(head.chunk_count)
    ||head.chunk_count<1||head.chunk_count>NATIONAL_RAW_MAX_CHUNKS)return {...base,status:'RAW_CHUNK_BOUNDS_FAILED'};
 const chunks=db.prepare("SELECT chunk_index,body_chunk,chunk_count,body_sha256 FROM market_score_employment_r6_raw_snapshot_v1 WHERE snapshot_id=? ORDER BY chunk_index LIMIT 25").all(head.snapshot_id);
 if(chunks.length!==head.chunk_count||chunks.some((c,i)=>c.chunk_index!==i
     ||c.chunk_count!==head.chunk_count||c.body_sha256!==bodySha.toLowerCase()
     ||typeof c.body_chunk!=='string'))
  return {...base,status:'RAW_CHUNKS_INCOMPLETE'};
 let length=0;
 for(const chunk of chunks){
  length+=chunk.body_chunk.length;
  if(length>NATIONAL_RAW_MAX_CHARS)return {...base,status:'RAW_BODY_BOUNDS_FAILED'};
 }
 const xml=chunks.map(x=>x.body_chunk).join('');
 if(createHash('sha256').update(xml).digest('hex')!==bodySha.toLowerCase())
  return {...base,status:'RAW_BODY_HASH_MISMATCH'};
 const raw=rawNationalDates(xml,head.retrieved_at);
 if(!raw)return {...base,status:'RAW_XML_ROOT_INVALID'};
 const recorded=Object.fromEntries(Object.keys(NATIONAL_RAW_SERIES).map(id=>
  [id,date(detail?.latestNationalSeriesObservationDates?.[id])]));
 const comparisons=Object.keys(NATIONAL_RAW_SERIES).map(id=>{
  const a=raw.latestNumericDates[id],b=recorded[id];
  return a&&b?(a>b?1:a<b?-1:0):null;
 });
 const state=comparisons.some(x=>x===1)?'RAW_NEWER_THAN_RUN_PARSER'
  :comparisons.some(x=>x===-1)?'RAW_OLDER_THAN_RUN_PARSER'
  :comparisons.every(x=>x===0)?'RAW_EQUALS_RUN_PARSER'
  :'RAW_OR_RUN_DATES_INCOMPLETE';
 return {status:state,latestWeekEnded:raw.latestWeekEnded,
  latestNumericDates:raw.latestNumericDates,recordedLatestDates:recorded,
  weekBlocks:raw.weekBlocks,invalidWeekDates:raw.invalidWeekDates,
  linkedByRawBodySha:true};
}

/** Path is supplied by the installed Controller, never by Issue JSON. */
export function inspectEmploymentR6CollectionEvidence(dataRoot,{
 filesystem=fs,openDatabase=openSqliteReadonly,onStage=null,
}={}){
 const result={status:'BLOCKED',code:'R6_EVIDENCE_DATA_ROOT_DENIED',sqliteOpened:false,
  scope:'R6_DOL_BED_FIXED_SQLITE_DIAGNOSTIC',dol:null,bed:null,eta539:null,stateClaims:null,pitRawSchema:null,eta539RawCurrentParity:null,eta538Pdf:null,...noWrite()};
 if(typeof dataRoot!=='string'||!path.isAbsolute(dataRoot))return result;
 const root=(()=>{try{return filesystem.realpathSync(dataRoot);}catch{return null;}})();
 if(!root||path.basename(root).toLowerCase()!=='data'||path.basename(path.dirname(root)).toLowerCase()!=='zgmini')return result;
 const pc=safeEntry(path.join(root,'pc-writer'),root,filesystem);
 const storage=safeEntry(path.join(root,'pc-writer','storage'),root,filesystem);
 if(!pc?.stat.isDirectory()||!storage?.stat.isDirectory())return result;
 const gate=preflight(path.join(storage.real,'core.sqlite'),root,filesystem);
 if(gate.status!=='PASS')return {...result,status:'STATE_UNKNOWN',code:gate.code};
 const runRead=()=>{
 let db,stage='OPEN_READONLY';
 // Fixed stage labels only. Optional progress is diagnostic, never a prerequisite.
 const markStage=value=>{stage=value;if(typeof onStage==='function')try{onStage(value);}catch{}};
 try{
   markStage('OPEN_READONLY');
   db=openDatabase(gate.path);result.sqliteOpened=true;
  markStage('READONLY_PRAGMAS');db.exec('PRAGMA query_only=ON');db.exec('PRAGMA busy_timeout=4000');
  markStage('TABLE_DISCOVERY');
  const tables=new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(x=>x.name));
  result.pitRawSchema=inspectPitRawSchema(db,tables,gate.path,filesystem);
  if(TABLES.some(t=>!tables.has(t)))return {...result,status:'STATE_UNKNOWN',code:'R6_EVIDENCE_TABLE_MISSING',
   missingTableCount:TABLES.filter(t=>!tables.has(t)).length};
  const query=db.prepare(`SELECT status,completed_at,provider_requests,collected_rows,inserted_count,revised_count,rejected_count,failure_code,detail_json
   FROM market_score_employment_r4_shadow_runs_v1 WHERE provider=? AND json_extract(detail_json,'$.mode')=?
   ORDER BY completed_at DESC LIMIT 1`);
  markStage('RUN_SUMMARY');
  for(const [key,provider] of Object.entries(PROVIDERS)){
   result[key]={};
   for(const mode of MODES)result[key][mode]=summarizeRun(query.get(provider,mode),key);
  }
  markStage('NATIONAL_RAW_RUN_COMPARISON');
  result.nationalRaw=Object.fromEntries(MODES.map(mode=>[mode,auditStoredNationalRun(db,mode)]));
  result.eta538Pdf=auditStoredEta538PdfRawLinkage(db);
  markStage('ETA539_METADATA');
  const snapshots=db.prepare(`SELECT request_key,retrieved_at,chunk_count,http_status,
   json_extract(detail_json,'$.historyWeeks') AS history_weeks,
   json_extract(detail_json,'$.parserMeta.latestCompleteWeek') AS latest_complete_week,
   json_extract(detail_json,'$.parserMeta.coreCount') AS core_count,
   json_array_length(detail_json,'$.parserMeta.selectedWeeks') AS selected_weeks,
   json_extract(detail_json,'$.parserMeta.selectedWeeks[0]') AS first_selected_week
   FROM market_score_employment_r6_raw_snapshot_v1
   WHERE release_group='DOL_UI_WEEKLY_CLAIMS' AND chunk_index=0
     AND request_key IN ('DOL_ETA539:530w','DOL_ETA539:600w','DOL_ETA539:112w','DOL_ETA539:60w')
   ORDER BY retrieved_at DESC LIMIT 4`).all();
  result.eta539=snapshots.length?snapshots.map(r=>({
   mode:['DOL_ETA539:530w','DOL_ETA539:600w'].includes(r.request_key)?'BACKFILL':r.request_key==='DOL_ETA539:112w'?'ONE_YEAR':'RELEASE',
   snapshotStoredAt:stamp(r.retrieved_at),httpStatus:safeInt(r.http_status),
   historyWeeks:safeInt(r.history_weeks),selectedWeeks:safeInt(r.selected_weeks),
   firstSelectedWeek:date(r.first_selected_week),latestCompleteWeek:date(r.latest_complete_week),coreCount:safeInt(r.core_count),
  })):[{status:'NOT_STORED'}];
  markStage('ETA539_RAW_CURRENT_PARITY');
  result.eta539RawCurrentParity=inspectEta539RawCurrentParity(db);
  markStage('STATE_CLAIMS_51_COVERAGE');
  // All geography labels are fixed source constants; only aggregates leave the DB.
  const countryMarkers=CORE_STATES.map(()=>'?').join(',');
  const weekly=db.prepare(`WITH recent_weeks AS (
    SELECT observation_date FROM market_score_employment_r4_shadow_current_v1
    WHERE logical_series_id='STATE_INITIAL_CLAIMS' AND geography_type='STATE'
    GROUP BY observation_date ORDER BY observation_date DESC LIMIT 600
   ), region_windows AS (
    SELECT c.observation_date,c.geography_code,c.value AS claim_value,
     SUM(c.value) OVER (PARTITION BY c.geography_code ORDER BY c.observation_date
       ROWS BETWEEN 3 PRECEDING AND CURRENT ROW) AS prior_four_week_total,
     COUNT(*) OVER (PARTITION BY c.geography_code ORDER BY c.observation_date
       ROWS BETWEEN 3 PRECEDING AND CURRENT ROW) AS prior_four_row_count,
     SUM(CASE WHEN typeof(c.value) NOT IN ('integer','real') OR c.value<0
         OR c.value>9007199254740991 OR c.value!=CAST(c.value AS INTEGER)
       THEN 1 ELSE 0 END) OVER (
       PARTITION BY c.geography_code ORDER BY c.observation_date
       ROWS BETWEEN 3 PRECEDING AND CURRENT ROW) AS prior_four_invalid_value_count
    FROM market_score_employment_r4_shadow_current_v1 AS c
    INNER JOIN recent_weeks AS w ON w.observation_date=c.observation_date
    WHERE c.logical_series_id='STATE_INITIAL_CLAIMS' AND c.geography_type='STATE'
   )
   SELECT observation_date,COUNT(*) AS row_count,
    COUNT(DISTINCT geography_code) AS region_count,
    SUM(CASE WHEN geography_code NOT IN (${countryMarkers}) THEN 1 ELSE 0 END) AS unknown_code_count,
    SUM(CASE WHEN typeof(claim_value) NOT IN ('integer','real') OR claim_value<0
       OR claim_value>9007199254740991 OR claim_value!=CAST(claim_value AS INTEGER)
      THEN 1 ELSE 0 END) AS invalid_value_count,
    SUM(CASE WHEN prior_four_row_count<>4 OR prior_four_invalid_value_count>0
      THEN 1 ELSE 0 END) AS invalid_prior_region_count,
    SUM(CASE WHEN prior_four_week_total=0 THEN 1 ELSE 0 END) AS zero_prior_region_count
   FROM region_windows
   GROUP BY observation_date ORDER BY observation_date DESC LIMIT 600`).all(...CORE_STATES);
  const stateClaims=coverage(weekly);
  const rawGap=stateClaims.fullTenYearRawCoverage;
  if(rawGap?.status==='REGION_51_COVERAGE_GAP'&&date(rawGap.firstFailureWeek)){
   // Restrict query to a single missing week and the fixed public state codes.
   const present=db.prepare(`SELECT DISTINCT geography_code
    FROM market_score_employment_r4_shadow_current_v1
    WHERE logical_series_id='STATE_INITIAL_CLAIMS' AND geography_type='STATE'
     AND observation_date=? AND geography_code IN (${countryMarkers})`
   ).all(rawGap.firstFailureWeek,...CORE_STATES);
   const have=new Set(present.map(r=>r.geography_code));
   rawGap.missingRegionCodes=CORE_STATES.filter(code=>!have.has(code));
  }
  result.stateClaims=stateClaims;
  result.status='PASS';result.code='R6_DOL_BED_STORED_EVIDENCE_READONLY';
  return result;
 }catch{
  return {...result,status:'STATE_UNKNOWN',code:'R6_EVIDENCE_QUERY_FAILED',firstFail:stage};
 }finally{try{db?.close();}catch{}}
 };
 const response=runRead();
 return response;
}

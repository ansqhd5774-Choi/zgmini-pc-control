// Fixed-scope A-grade diagnosis for R6 DOL/BED partial collections.
// Never fetches provider data, changes SQLite, or publishes to D1.
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';

const SQLITE_MAGIC='SQLite format 3\0';
const MAX_DB_BYTES=64*1024**3;
const MODES=Object.freeze(['BACKFILL','ONE_YEAR','RELEASE']);
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
  // One missing sidecar, a symlink, or any unreadable sidecar is not a clean shutdown.
  if(sidecars.includes('UNSAFE')||sidecars[0]!==sidecars[1])
   return {status:'STATE_UNKNOWN',code:'R6_EVIDENCE_WAL_SIDECARS_PARTIAL_OR_UNSAFE'};
  if(sidecars[0]==='ABSENT')
   return {status:'PASS',path:entry.real,immutable:true,originalStat:entry.stat};
  // A normal read-only open can mutate -shm; immutable reads miss uncheckpointed WAL.
  // Do not access the operational live-WAL pair without an isolated snapshot.
  return {status:'STATE_UNKNOWN',code:'R6_EVIDENCE_WAL_LIVE_SNAPSHOT_UNSAFE'};
 }
 return {status:'PASS',path:entry.real};
}
// Only accept immutable results if the main file and the absent sidecars stayed
// unchanged for the entire read; immutable SQLite bypasses file-change detection.
function stableImmutable(gate,root,filesystem){
 const current=safeEntry(gate.path,root,filesystem);
 if(!current?.stat.isFile()||current.real!==gate.path)return false;
 if(!['size','dev','ino','mtimeMs','ctimeMs'].every(k=>current.stat[k]===gate.originalStat[k]))
  return false;
 return ['-wal','-shm'].every(ext=>{
  try{filesystem.lstatSync(gate.path+ext);return false;}
  catch(error){return error?.code==='ENOENT';}
 });
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
 filesystem=fs,openDatabase=file=>new DatabaseSync(file,{readOnly:true,timeout:4000}),
}={}){
 const result={status:'BLOCKED',code:'R6_EVIDENCE_DATA_ROOT_DENIED',sqliteOpened:false,
  scope:'R6_DOL_BED_FIXED_SQLITE_DIAGNOSTIC',dol:null,bed:null,eta539:null,stateClaims:null,pitRawSchema:null,...noWrite()};
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
 try{
  const target=gate.immutable?pathToFileURL(gate.path):gate.path;
  if(gate.immutable){target.searchParams.set('mode','ro');target.searchParams.set('immutable','1');}
  db=openDatabase(gate.immutable?target.href:target);result.sqliteOpened=true;
  stage='READONLY_PRAGMAS';db.exec('PRAGMA query_only=ON');db.exec('PRAGMA busy_timeout=4000');
  stage='TABLE_DISCOVERY';
  const tables=new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(x=>x.name));
  result.pitRawSchema=inspectPitRawSchema(db,tables,gate.path,filesystem);
  if(TABLES.some(t=>!tables.has(t)))return {...result,status:'STATE_UNKNOWN',code:'R6_EVIDENCE_TABLE_MISSING',
   missingTableCount:TABLES.filter(t=>!tables.has(t)).length};
  const query=db.prepare(`SELECT status,completed_at,provider_requests,collected_rows,inserted_count,revised_count,rejected_count,failure_code,detail_json
   FROM market_score_employment_r4_shadow_runs_v1 WHERE provider=? AND json_extract(detail_json,'$.mode')=?
   ORDER BY completed_at DESC LIMIT 1`);
  stage='RUN_SUMMARY';
  for(const [key,provider] of Object.entries(PROVIDERS)){
   result[key]={};
   for(const mode of MODES)result[key][mode]=summarizeRun(query.get(provider,mode),key);
  }
  stage='NATIONAL_RAW_RUN_COMPARISON';
  result.nationalRaw=Object.fromEntries(MODES.map(mode=>[mode,auditStoredNationalRun(db,mode)]));
  stage='ETA539_METADATA';
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
  stage='STATE_CLAIMS_51_COVERAGE';
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
 if(gate.immutable&&!stableImmutable(gate,root,filesystem))
  return {status:'STATE_UNKNOWN',code:'R6_EVIDENCE_IMMUTABLE_RACE',
   sqliteOpened:result.sqliteOpened,scope:result.scope,dol:null,bed:null,
   eta539:null,stateClaims:null,pitRawSchema:null,...noWrite()};
 return response;
}

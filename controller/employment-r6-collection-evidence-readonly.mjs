// Fixed-scope A-grade diagnosis for R6 DOL/BED partial collections.
// Never fetches provider data, changes SQLite, or publishes to D1.
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';

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
const CORE_STATES=Object.freeze([
 'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
]);
const DOL_IDS=new Set(['INITIAL_CLAIMS','INITIAL_CLAIMS_4W','CONTINUED_CLAIMS','INSURED_UNEMPLOYMENT_RATE','STATE_INITIAL_CLAIMS']);
const FAILURE_CODES=new Set(['SERIES_PARTIAL','DOL_ETA539_SOURCE_FAILED','ROW_REJECTED','NO_OBSERVATIONS','DOL_RELEASE_OBSERVATION_STALE']);
const safeInt=x=>Number.isSafeInteger(x)&&x>=0?x:null;
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
// WAL mode read-only SQLite may create -shm; sidecars must pre-exist.
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
  if(!['-wal','-shm'].every(ext=>safeEntry(file+ext,root,filesystem)?.stat.isFile()))
   return {status:'STATE_UNKNOWN',code:'R6_EVIDENCE_WAL_SIDECARS_ABSENT'};
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
 };
}
const day=x=>Date.parse(x+'T00:00:00Z');
function coverage(rows){
 if(!Array.isArray(rows))return {status:'UNKNOWN'};
 const weeks=rows.map(r=>({week:date(r.observation_date),count:safeInt(r.row_count),regions:safeInt(r.region_count),
  unknown:safeInt(r.unknown_code_count),nonpositive:safeInt(r.nonpositive_count)})).filter(x=>x.week);
 weeks.sort((a,b)=>a.week.localeCompare(b.week));
 const complete=x=>x?.count===51&&x?.regions===51&&x?.unknown===0;
 let latestCandidate=null,earliestBreak=null,latestBreak=null,eligible=0;
 for(let i=55;i<weeks.length;i++){
  const current=weeks.slice(i-3,i+1),previous=weeks.slice(i-55,i-51);
  const consecutive=group=>group.every((x,j)=>j===0||day(x.week)-day(group[j-1].week)===7*86400000);
  let reason=null;
  if(current.length!==4||previous.length!==4||!consecutive(current)||!consecutive(previous)||
     current.some((x,j)=>day(x.week)-day(previous[j].week)!==52*7*86400000))reason='WEEK_ALIGNMENT_GAP';
  else if([...current,...previous].some(x=>!complete(x)))reason='REGION_51_COVERAGE_GAP';
  else if(previous.some(x=>x.nonpositive!==0))reason='PRIOR_4W_NONPOSITIVE';
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
  recentIncompleteWeeks:weeks.filter(x=>!complete(x)).slice(-8).reverse().map(x=>({week:x.week,regions:x.regions,rows:x.count,unknownCodes:x.unknown})),
  note:'COUNT_ONLY_NOT_PIT_OR_FORMULA_VERIFICATION'};
}

/** Path is supplied by the installed Controller, never by Issue JSON. */
export function inspectEmploymentR6CollectionEvidence(dataRoot,{
 filesystem=fs,openDatabase=file=>new DatabaseSync(file,{readOnly:true,timeout:4000}),
}={}){
 const result={status:'BLOCKED',code:'R6_EVIDENCE_DATA_ROOT_DENIED',sqliteOpened:false,
  scope:'R6_DOL_BED_FIXED_SQLITE_DIAGNOSTIC',dol:null,bed:null,eta539:null,stateClaims:null,...noWrite()};
 if(typeof dataRoot!=='string'||!path.isAbsolute(dataRoot))return result;
 const root=(()=>{try{return filesystem.realpathSync(dataRoot);}catch{return null;}})();
 if(!root||path.basename(root).toLowerCase()!=='data'||path.basename(path.dirname(root)).toLowerCase()!=='zgmini')return result;
 const pc=safeEntry(path.join(root,'pc-writer'),root,filesystem);
 const storage=safeEntry(path.join(root,'pc-writer','storage'),root,filesystem);
 if(!pc?.stat.isDirectory()||!storage?.stat.isDirectory())return result;
 const gate=preflight(path.join(storage.real,'core.sqlite'),root,filesystem);
 if(gate.status!=='PASS')return {...result,status:'STATE_UNKNOWN',code:gate.code};
 let db,stage='OPEN_READONLY';
 try{
  db=openDatabase(gate.path);result.sqliteOpened=true;
  stage='READONLY_PRAGMAS';db.exec('PRAGMA query_only=ON');db.exec('PRAGMA busy_timeout=4000');
  stage='TABLE_DISCOVERY';
  const tables=new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(x=>x.name));
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
  stage='ETA539_METADATA';
  const snapshots=db.prepare(`SELECT request_key,retrieved_at,chunk_count,http_status,
   json_extract(detail_json,'$.historyWeeks') AS history_weeks,
   json_extract(detail_json,'$.parserMeta.latestCompleteWeek') AS latest_complete_week,
   json_extract(detail_json,'$.parserMeta.coreCount') AS core_count,
   json_array_length(detail_json,'$.parserMeta.selectedWeeks') AS selected_weeks,
   json_extract(detail_json,'$.parserMeta.selectedWeeks[0]') AS first_selected_week
   FROM market_score_employment_r6_raw_snapshot_v1
   WHERE release_group='DOL_UI_WEEKLY_CLAIMS' AND chunk_index=0
     AND request_key IN ('DOL_ETA539:600w','DOL_ETA539:112w','DOL_ETA539:60w')
   ORDER BY retrieved_at DESC LIMIT 3`).all();
  result.eta539=snapshots.length?snapshots.map(r=>({
   mode:r.request_key==='DOL_ETA539:600w'?'BACKFILL':r.request_key==='DOL_ETA539:112w'?'ONE_YEAR':'RELEASE',
   snapshotStoredAt:stamp(r.retrieved_at),httpStatus:safeInt(r.http_status),
   historyWeeks:safeInt(r.history_weeks),selectedWeeks:safeInt(r.selected_weeks),
   firstSelectedWeek:date(r.first_selected_week),latestCompleteWeek:date(r.latest_complete_week),coreCount:safeInt(r.core_count),
  })):[{status:'NOT_STORED'}];
  stage='STATE_CLAIMS_51_COVERAGE';
  // All geography labels are fixed source constants; only aggregates leave the DB.
  const countryMarkers=CORE_STATES.map(()=>'?').join(',');
  const weekly=db.prepare(`SELECT observation_date,COUNT(*) AS row_count,
   COUNT(DISTINCT geography_code) AS region_count,
   SUM(CASE WHEN geography_code NOT IN (${countryMarkers}) THEN 1 ELSE 0 END) AS unknown_code_count,
   SUM(CASE WHEN value<=0 THEN 1 ELSE 0 END) AS nonpositive_count
   FROM market_score_employment_r4_shadow_current_v1
   WHERE logical_series_id='STATE_INITIAL_CLAIMS' AND geography_type='STATE'
   GROUP BY observation_date ORDER BY observation_date DESC LIMIT 160`).all(...CORE_STATES);
  result.stateClaims=coverage(weekly);
  result.status='PASS';result.code='R6_DOL_BED_STORED_EVIDENCE_READONLY';
  return result;
 }catch{
  return {...result,status:'STATE_UNKNOWN',code:'R6_EVIDENCE_QUERY_FAILED',firstFail:stage};
 }finally{try{db?.close();}catch{}}
}

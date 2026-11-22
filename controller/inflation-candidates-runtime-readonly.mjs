// Fixed A/light inspection of seven proposed inflation inputs (six collectors).
// This module deliberately does not load provider credentials, query providers,
// open SQLite or infer a Core execution from a stored snapshot.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

const ROOT_PARTS=Object.freeze(['pc-writer','inflation-causal-candidates-r1']);
const CHECKPOINT='core-attempts-r1.json';
const CHECKPOINT_SCHEMA='ZGMINI_INFLATION_CANDIDATE_CORE_R1';
const GROUPS=Object.freeze(['cpi','ppi','fed','census','treasury','eia']);
const SNAPSHOTS=Object.freeze({
  bls:{file:'bls-cpi-ppi3.json',provider:'BLS',limit:8_000_000},
  fed:{file:'fed-g17-manufacturing-ip.json',provider:'FEDERAL_RESERVE_G17',limit:8_000_000},
  census:{file:'census-m3-manufacturing-inventories.json',provider:'US_CENSUS_M3',limit:8_000_000},
  treasury:{file:'treasury-mts-customs-duties.json',provider:'US_TREASURY_MTS',limit:8_000_000},
  eia:{file:'eia-us-regular-gasoline-weekly.json',provider:'EIA',limit:8_000_000},
});
const INDICATORS=Object.freeze([
  {id:22,group:'cpi',snapshot:'bls',sourceSeriesId:'CUSR0000SEHA'},
  {id:23,group:'cpi',snapshot:'bls',sourceSeriesId:'CUSR0000SEHC01'},
  {id:24,group:'ppi',snapshot:'bls',sourceSeriesId:'WPSFD4'},
  {id:16,group:'treasury',snapshot:'treasury'},
  {id:28,group:'census',snapshot:'census'},
  {id:29,group:'fed',snapshot:'fed'},
  {id:2,group:'eia',snapshot:'eia'},
]);
const fail=code=>Object.assign(new Error(code),{code});
const iso=v=>typeof v==='string'&&v.length<=32&&Number.isFinite(Date.parse(v))&&
  new Date(v).toISOString()===v;
const day=v=>typeof v==='string'&&/^(?:19|20)\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(v)&&
  Number.isFinite(Date.parse(`${v}T00:00:00Z`))&&
  new Date(`${v}T00:00:00Z`).toISOString().slice(0,10)===v;
const version=v=>typeof v==='string'&&v.length>0&&v.length<=100&&/^[A-Za-z0-9._-]+$/.test(v);
const failureCode=v=>typeof v==='string'&&
  /^(?:INFL_CANDIDATE|BLS_CANDIDATE|TREASURY_CUSTOMS|CENSUS_M3|FED_G17|EIA_REGULAR)_[A-Z0-9_]{1,90}$/.test(v);

function regularDirectory(location){
  try{const stat=fs.lstatSync(location);
    return stat.isDirectory()&&!stat.isSymbolicLink()? 'PRESENT':'UNSAFE';
  }catch(e){return e.code==='ENOENT'?'MISSING':'UNSAFE';}
}

function fixedFile(directory,name,maxBytes){
  const location=path.join(directory,name);
  try{
    const stat=fs.lstatSync(location);
    if(!stat.isFile()||stat.isSymbolicLink())return {availability:'UNSAFE'};
    if(stat.size<1||stat.size>maxBytes)return {availability:'INVALID'};
    const bytes=fs.readFileSync(location);
    if(bytes.length<1||bytes.length>maxBytes)return {availability:'INVALID'};
    const sha256=createHash('sha256').update(bytes).digest('hex');
    let data;try{data=JSON.parse(bytes.toString('utf8'));}catch{return {availability:'INVALID'};}
    return {availability:'PRESENT',sha256,data};
  }catch(e){return {availability:e.code==='ENOENT'?'MISSING':'UNSAFE'};}
}

function rowsFor(doc,indicator){
  return indicator.snapshot==='bls'?doc?.series?.[indicator.sourceSeriesId]:doc?.observations;
}

function validRows(rows,indicator){
  if(!Array.isArray(rows)||rows.length<1||rows.length>20_000)return false;
  const seen=new Set();
  for(const item of rows){
    if(!item||typeof item!=='object'||!day(item.date)||seen.has(item.date))return false;
    seen.add(item.date);
    if(indicator.snapshot==='treasury'){
      if(typeof item.netUsdDecimal!=='string'||!/^[-]?\d+(?:\.\d+)?$/.test(item.netUsdDecimal)||
        item.netUsdDecimal.length>30)return false;
    }else if(typeof item.value!=='number'||!Number.isFinite(item.value)||
      (indicator.snapshot==='bls'||indicator.snapshot==='census'?item.value<0:item.value<=0))return false;
  }
  return true;
}

function validHeader(doc,meta){
  return doc&&typeof doc==='object'&&!Array.isArray(doc)&&doc.schemaVersion===1&&
    doc.provider===meta.provider&&version(doc.sourceVersion)&&iso(doc.sourceStoredAt);
}

function safeCheckpoint(snapshot){
  if(snapshot.availability!=='PRESENT')return {status:snapshot.availability};
  const doc=snapshot.data;
  if(doc?.schema!==CHECKPOINT_SCHEMA||!doc.processed||!doc.attempted||
    typeof doc.processed!=='object'||typeof doc.attempted!=='object'||
    Array.isArray(doc.processed)||Array.isArray(doc.attempted)||
    [...Object.keys(doc.processed),...Object.keys(doc.attempted)].some(g=>!GROUPS.includes(g)))
    return {status:'INVALID'};
  const byGroup={};
  for(const group of GROUPS){
    const p=doc.processed[group],a=doc.attempted[group];
    if(p&&(typeof p.eventKey!=='string'||p.eventKey.length>240||!day(p.observationDate)))return {status:'INVALID'};
    if(a&&(typeof a.eventKey!=='string'||a.eventKey.length>240||!iso(a.at)||
      (a.failureCode!==undefined&&!failureCode(a.failureCode))))return {status:'INVALID'};
    // The event key may contain provider-specific details. Expose only its
    // fixed category to distinguish a consumed recovery from a dated release.
    const attemptType=!a?'NONE':a.eventKey===`legacy-parser-recovery:${group}`?
      'LEGACY_PARSER_RECOVERY':a.eventKey===`bootstrap:${group}`?
      'BOOTSTRAP':a.eventKey.startsWith('release:')?'OFFICIAL_RELEASE':'OTHER';
    byGroup[group]={processed:!!p,processedObservationDate:p?.observationDate??null,
      attempted:!!a,lastAttemptedAt:a?.at??null,failureCode:a?.failureCode??null,
      attemptType};
  }
  return {status:'PRESENT_VALID',fileSha256:snapshot.sha256,groups:byGroup};
}

const CANDIDATE_CYCLE_STATES=new Set(['DISABLED','DISABLED_PROVIDERS_UNAVAILABLE',
  'NO_VERIFIED_RELEASE_DUE','PARTIAL_PREVIOUS_INPUTS_PRESERVED',
  'PARTIAL_CREDENTIALS_UNAVAILABLE','COMPLETE','UNCHANGED_WAITING_NEW_OBSERVATION',
  'FAILED_PREVIOUS_INPUTS_PRESERVED']);
function safeCycle(dataRoot){
  // Read only the existing fixed Core report. Never return source objects,
  // arbitrary errors, provider env, request URLs, event keys or observations.
  const dir=path.join(dataRoot,'pc-writer');
  if(regularDirectory(dir)!=='PRESENT')return {availability:'MISSING'};
  const found=fixedFile(dir,'local-cycle-last-run.json',131072);
  if(found.availability!=='PRESENT')return {availability:found.availability};
  const doc=found.data,run=doc?.inflationCandidates;
  if(!run||typeof run!=='object'||Array.isArray(run))
    return {availability:'PRESENT',status:'NOT_RECORDED'};
  const safeGroups=v=>Array.isArray(v)?v.filter(x=>typeof x==='string'&&GROUPS.includes(x)).slice(0,6):[];
  const completed=Array.isArray(run.completed)?run.completed.slice(0,8):[];
  const failed=Array.isArray(run.failed)?run.failed.slice(0,8):[];
  const censusCompleted=completed.find(x=>x?.group==='census');
  const censusFailed=failed.find(x=>x?.group==='census');
  const censusCode=typeof censusFailed?.code==='string'&&failureCode(censusFailed.code)?
    censusFailed.code:null;
  const status=CANDIDATE_CYCLE_STATES.has(run.status)?run.status:'UNREPORTED';
  return {availability:'PRESENT',cycleAt:iso(doc?.at)?doc.at:null,status,
    censusDue:safeGroups(run.due).includes('census'),
    censusSkipped:safeGroups(run.skipped).includes('census'),
    censusCompleted:!!censusCompleted,censusFailed:!!censusFailed,
    censusFailureCode:censusCode};
}

export function inspectInflationCandidatesRuntimeReadonly(dataRoot){
  if(typeof dataRoot!=='string'||!path.isAbsolute(dataRoot))
    throw fail('INFL_CANDIDATES_READONLY_DATA_ROOT_DENIED');
  let root;try{root=fs.realpathSync(dataRoot);}catch{
    throw fail('INFL_CANDIDATES_READONLY_DATA_ROOT_DENIED');
  }
  if(!fs.statSync(root).isDirectory())
    throw fail('INFL_CANDIDATES_READONLY_DATA_ROOT_DENIED');
  let directory=root,locationStatus='PRESENT';
  for(const segment of ROOT_PARTS){
    directory=path.join(directory,segment);
    locationStatus=regularDirectory(directory);
    if(locationStatus!=='PRESENT')break;
  }
  const saved={};
  for(const [name,meta] of Object.entries(SNAPSHOTS))
    saved[name]=locationStatus==='PRESENT'?fixedFile(directory,meta.file,meta.limit):
      {availability:locationStatus};
  const checkpoint=safeCheckpoint(locationStatus==='PRESENT'?fixedFile(directory,CHECKPOINT,32768):
    {availability:locationStatus});
  const indicators=INDICATORS.map(indicator=>{
    const {id,group,snapshot,sourceSeriesId}=indicator;
    const found=saved[snapshot],meta=SNAPSHOTS[snapshot];
    const base={id,group,sourceSeriesId:sourceSeriesId??null,status:'UNKNOWN',
      observationCount:0,latestObservationDate:null,sourceStoredAt:null,
      sourceVersion:null,fileSha256:null};
    if(found.availability!=='PRESENT')return {...base,status:found.availability};
    if(!validHeader(found.data,meta))return {...base,status:'INVALID'};
    const rows=rowsFor(found.data,indicator);
    if(!validRows(rows,indicator))return {...base,status:'INVALID'};
    if(snapshot==='eia'&&(!Array.isArray(found.data.missing)||
      found.data.missing.some(r=>!day(r?.date)||r.status!=='NOT_REPORTED')))
      return {...base,status:'INVALID'};
    return {...base,status:'PRESENT_VALID',observationCount:rows.length,
      latestObservationDate:rows.reduce((max,r)=>r.date>max?r.date:max,''),
      sourceStoredAt:found.data.sourceStoredAt,sourceVersion:found.data.sourceVersion,
      fileSha256:found.sha256};
  });
  const groups=GROUPS.map(group=>{
    const entries=indicators.filter(i=>i.group===group);
    return {group,indicatorIds:entries.map(i=>i.id),
      status:entries.every(i=>i.status==='PRESENT_VALID')?'PRESENT_VALID':
        entries.some(i=>i.status==='UNSAFE')?'UNSAFE':
        entries.some(i=>i.status==='INVALID')?'INVALID':'MISSING',
      checkpoint:checkpoint.status==='PRESENT_VALID'?checkpoint.groups[group]:null};
  });
  return {status:'PASS',code:'INFLATION_CANDIDATES_RUNTIME_READONLY_EVIDENCE',
    operationalReadiness:'NOT_ASSERTED',evidenceScope:'LOCAL_SNAPSHOT_AND_CHECKPOINT_ONLY',
    candidateDirectoryStatus:locationStatus,indicatorCount:7,collectorGroupCount:6,
    presentValidCount:indicators.filter(i=>i.status==='PRESENT_VALID').length,
    indicators,groups,checkpointStatus:checkpoint.status,
    checkpointSha256:checkpoint.fileSha256??null,
    candidateCycle:safeCycle(root),
    providerCalls:0,d1Writes:0,operationalWrites:0,sqliteOpened:false};
}

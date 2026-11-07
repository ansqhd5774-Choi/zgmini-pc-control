// Fixed-scope, read-only Inflation19 Core/Writer evidence for the shared A/light runner.
// Do not read providers.env, credentials, raw series, SQLite, or live providers.
import fs from 'node:fs';
import path from 'node:path';

const GROUPS=Object.freeze(['bls8','electricity','sce','gas']);
const IDS=Object.freeze(['1','3','4','5','6','7','8','9','10','11','12','13','14','18','19','21','25','26','31']);
const GROUP_SET=new Set(GROUPS);
const CYCLE_STATES=new Set(['DISABLED','DISABLED_PROVIDERS_UNAVAILABLE',
 'SKIPPED_KOREA_LANE','FAILED_PREVIOUS_INPUTS_PRESERVED',
 'NO_VERIFIED_RELEASE_DUE','COMPLETE','PARTIAL_PREVIOUS_CHECKPOINT_PRESERVED',
 'UNCHANGED_AWAITING_NEXT_DUE']);
const WRITER_STATES=new Set(['READBACK_VERIFIED','ALREADY_STORED',
 'SKIPPED_INPUTS_NOT_READY','UNCHANGED_VERIFIED','SKIPPED_METADATA_ONLY',
 'REMOTE_NEWER_PRESERVED']);
const COLLECTOR_STATES=new Set(['SAVED_READBACK','STORED','UNCHANGED',
 'UNCHANGED_VALID_INPUT_PRESERVED','UNCHANGED_WAITING_NEXT_DUE']);
const TOP_LEVEL_STATES=new Set(['COMPLETE','VERIFIED','VERIFIED_WITH_GAPS',
 'COMPLETE_WITH_COLLECTION_GAPS','PUBLICATION_NOT_VERIFIED',
 'FAILED','DRY_RUN_PASS','DRY_RUN_PARTIAL','PARTIAL','STOP']);
const REPORTS=Object.freeze([
 ['cycle',['local-cycle-last-run.json'],131072],
 ['checkpoint',['inflation-causal-r1','recurring-checkpoint-r1.json'],65536],
 ['writer',['local-writer-last-run.json'],131072],
 ['projection',['inflation-causal-r1','public-19-summary-projection-r1.json'],65536],
]);

function fail(code){throw Object.assign(new Error(code),{code});}
const record=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const integer=x=>Number.isSafeInteger(x)&&x>=0&&x<=10000?x:null;
const timeMillis=x=>Number.isSafeInteger(x)&&x>0&&x<=8640000000000000?x:null;
const instant=x=>{
 if(typeof x==='number')x=timeMillis(x)!==null?new Date(x).toISOString():null;
 return typeof x==='string'&&x.length>=20&&x.length<=35&&
  !Number.isNaN(Date.parse(x))&&new Date(x).toISOString()===x?x:null;
};
const day=x=>typeof x==='string'&&/^20\d\d-\d\d-\d\d$/.test(x)&&
 !Number.isNaN(Date.parse(x+'T00:00:00.000Z'))&&
 new Date(x+'T00:00:00.000Z').toISOString().slice(0,10)===x?x:null;
const observationDate=x=>typeof x==='string'&&/^20\d\d-\d\d(?:-\d\d)?$/.test(x)&&
 !Number.isNaN(Date.parse(x.length===7?x+'-01T00:00:00.000Z':x+'T00:00:00.000Z'))&&
 new Date(x.length===7?x+'-01T00:00:00.000Z':x+'T00:00:00.000Z').toISOString().slice(0,x.length)===x?x:null;
const allow=(set,x)=>set.has(x)?x:'UNREPORTED';
const errorCode=x=>typeof x==='string'&&/^INFL19_[A-Z0-9_]{1,90}$/.test(x)&&
 !/(TOKEN|SECRET|PASSWORD|AUTH|KEY|URL|CREDENTIAL)/.test(x)?x:'UNREPORTED';
const publishCode=x=>typeof x==='string'&&
 (/^(?:INFL19|INFLATION_CAUSAL)_[A-Z0-9_]{1,90}$/.test(x)||x==='OUTPUT_STAGE_FAILED')&&
 !/(TOKEN|SECRET|PASSWORD|AUTH|KEY|URL|CREDENTIAL)/.test(x)?x:'UNREPORTED';
const version=x=>typeof x==='string'&&/^INFL19_PRESENTATION_[a-f0-9]{64}$/.test(x)?x:null;

function regularPath(root,parts,maxBytes){
 let current=root;
 for(let i=0;i<parts.length;i++){
  current=path.join(current,parts[i]);
  let entry;
  try{entry=fs.lstatSync(current);}catch(error){
   if(error.code==='ENOENT')return {availability:'MISSING'};
   return {availability:'UNREADABLE'};
  }
  if(entry.isSymbolicLink()||
   (i<parts.length-1&&!entry.isDirectory())||
   (i===parts.length-1&&!entry.isFile()))
   return {availability:'UNSAFE_ENTRY'};
  if(i===parts.length-1){
   if(entry.size<1||entry.size>maxBytes)return {availability:'SIZE_REJECTED'};
   try{
    const bytes=fs.readFileSync(current);
    if(bytes.length>maxBytes||bytes.length<1)return {availability:'SIZE_REJECTED'};
    const parsed=JSON.parse(bytes.toString('utf8'));
    if(!record(parsed))return {availability:'INVALID_SHAPE'};
    return {availability:'PRESENT',modifiedAt:entry.mtime.toISOString(),data:parsed};
   }catch{return {availability:'INVALID_JSON'};}
  }
 }
 return {availability:'MISSING'};
}

function cycleState(file){
 if(file.availability!=='PRESENT')return {availability:file.availability};
 const raw=file.data.inflationRecurring;
 if(!record(raw))return {availability:'PRESENT',modifiedAt:file.modifiedAt,
  cycleStatus:'UNREPORTED',status:'NOT_RECORDED'};
 const byGroup={};
 for(const group of GROUPS)byGroup[group]={outcome:'NOT_RECORDED'};
 for(const [field,outcome] of [['updated','UPDATED'],['unchanged','UNCHANGED'],
  ['failed','FAILED']]){
  if(!Array.isArray(raw[field]))continue;
  for(const item of raw[field].slice(0,16)){
   if(!record(item)||!GROUP_SET.has(item.source))continue;
   byGroup[item.source]={outcome,
    ...(outcome==='FAILED'?{code:errorCode(item.code)}:
     {collectorStatus:allow(COLLECTOR_STATES,item.status),
      providerRequests:integer(item.providerRequests)})};
  }
 }
 if(Array.isArray(raw.skipped))for(const group of raw.skipped.slice(0,8)){
  if(GROUP_SET.has(group)&&byGroup[group].outcome==='NOT_RECORDED')
   byGroup[group]={outcome:'SKIPPED'};
 }
 return {availability:'PRESENT',modifiedAt:file.modifiedAt,
  cycleStatus:allow(TOP_LEVEL_STATES,file.data.status),
  cycleAt:instant(file.data.at),
  collectionExit:integer(file.data.collectionExit),
  publicationExit:integer(file.data.publicationExit),
  status:allow(CYCLE_STATES,raw.status),providerRequests:integer(raw.providerRequests),
  byGroup};
}

function checkpointState(file){
 if(file.availability!=='PRESENT')return {availability:file.availability};
 const raw=file.data;
 if(raw.schema!=='ZGMINI_INFL19_RECURRING_R1'||!record(raw.processed)||
  (raw.attempted!==undefined&&!record(raw.attempted)))
  return {availability:'INVALID_CONTRACT',modifiedAt:file.modifiedAt};
 const byGroup={};
 for(const key of GROUPS){
  const attempt=raw.attempted?.[key];
  byGroup[key]={processedEvent:day(raw.processed[key]),
   attemptedEvent:day(attempt?.eventKey),attemptedAt:instant(attempt?.at)};
 }
 return {availability:'PRESENT',modifiedAt:file.modifiedAt,byGroup};
}

function writerState(file){
 if(file.availability!=='PRESENT')return {availability:file.availability};
 const failed=Array.isArray(file.data.failures)?file.data.failures.find(x=>
  record(x)&&x.id==='inflation-19-publication'):null;
 const inflationFailure=failed?publishCode(failed.reason):null;
 const raw=file.data.inflation19;
 if(!record(raw))return {availability:'PRESENT',modifiedAt:file.modifiedAt,
  writerStatus:allow(TOP_LEVEL_STATES,file.data.status),
  status:failed?'FAILED_STAGE':'NOT_RECORDED',inflationFailure};
 return {availability:'PRESENT',modifiedAt:file.modifiedAt,
  writerAt:instant(file.data.at),
  writerStatus:allow(TOP_LEVEL_STATES,file.data.status),
  status:allow(WRITER_STATES,raw.status),inflationFailure,
  readyCount:integer(raw.ready),
  d1Writes:integer(raw.d1Writes),sourceStoredAt:timeMillis(raw.sourceStoredAt),
  sourceVersion:version(raw.sourceVersion)};
}

function projectionState(file){
 if(file.availability!=='PRESENT')return {availability:file.availability};
 const payload=file.data.payload;
 if(!record(payload)||!Array.isArray(payload.indicators)||payload.indicators.length!==19)
  return {availability:'INVALID_CONTRACT',modifiedAt:file.modifiedAt};
 const perId=[];
 for(let i=0;i<IDS.length;i++){
  const row=payload.indicators[i];
  if(!record(row)||row.id!==IDS[i]||!['READY','PENDING','STALE'].includes(row.status))
   return {availability:'INVALID_CONTRACT',modifiedAt:file.modifiedAt};
  perId.push({id:IDS[i],status:row.status,observationDate:observationDate(row.observationDate),
   sourceStoredAt:instant(row.sourceStoredAt)});
 }
 return {availability:'PRESENT',modifiedAt:file.modifiedAt,
  stagingOnly:true,readyCount:perId.filter(r=>r.status==='READY').length,
  sourceStoredAt:timeMillis(payload.sourceStoredAt),sourceVersion:version(payload.sourceVersion),
  perId};
}

export function inspectInflation19RuntimeReadonly(dataRoot){
 if(typeof dataRoot!=='string'||!path.isAbsolute(dataRoot))fail('INFL19_READONLY_DATA_ROOT_DENIED');
 let canonical;
 try{canonical=fs.realpathSync(dataRoot);}catch{fail('INFL19_READONLY_DATA_ROOT_UNAVAILABLE');}
 if(!fs.statSync(canonical).isDirectory())fail('INFL19_READONLY_DATA_ROOT_DENIED');
 const home=path.join(canonical,'pc-writer');
 let homeStat;
 try{homeStat=fs.lstatSync(home);}catch{fail('INFL19_READONLY_HOME_UNAVAILABLE');}
 if(!homeStat.isDirectory()||homeStat.isSymbolicLink())fail('INFL19_READONLY_HOME_DENIED');
 const reads=Object.fromEntries(REPORTS.map(([name,parts,max])=>
  [name,regularPath(home,parts,max)]));
 const cycle=cycleState(reads.cycle),checkpoint=checkpointState(reads.checkpoint),
  writer=writerState(reads.writer),projection=projectionState(reads.projection);
 return {status:'PASS',code:'INFL19_RUNTIME_READONLY_EVIDENCE',
  operationalReadiness:'NOT_ASSERTED',cycle,checkpoint,writer,projection,
  providerCalls:0,d1Writes:0,operationalWrites:0,sqliteOpened:false};
}

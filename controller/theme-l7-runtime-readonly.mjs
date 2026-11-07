// Existing seven-theme (L7/R178) operational evidence only. This reads a fixed
// source/ledger inventory; it never executes the collector, calculates scores,
// accesses credentials, edits a task, or publishes a D1 record.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

const SUBDIR=['theme-market-history-r131','marketparquet-r167'];
const SOURCE_NAMES=[
 'r181-primary-cycle.mjs',
 'r179-publish-core.mjs',
 'r171-publish.mjs',
];
const LEDGER_NAMES=[
 'R181_PRIMARY_LAST_RUN.json',
 'ZGMINI_R179_PUBLICATION_LAST_RUN.json',
 'R183_PUBLICATION_RETRY_LAST_RUN.json',
];
const TASK='ZGMINI-PC-GetMarketHistory-ETF';
const STAMP_FIELDS=['startedAt','finishedAt','sourceStoredAt','publishedAt',
 'updatedAt','lastRunAt'];
const DATE_FIELDS=['observationDate','latestCommonDate','confirmedThrough',
 'sourceDate','latestDate'];
const code=x=>typeof x==='string'&&/^[A-Z][A-Z0-9_:-]{0,79}$/.test(x)?x:null;
const date=x=>typeof x==='string'&&/^\d{4}-\d\d-\d\d$/.test(x)&&
 !Number.isNaN(Date.parse(x+'T00:00:00Z'))&&
 new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x?x:null;
const stamp=x=>typeof x==='string'&&x.length<=40&&
 Number.isFinite(Date.parse(x))?x:null;
const sha=b=>createHash('sha256').update(b).digest('hex');
const reject=x=>{throw Object.assign(new Error(x),{code:x});};

// These are labels, not permission to return arbitrary strings. The PC ledger
// structures are not asserted in advance; safe candidates and their types are
// discovered without returning raw JSON, secrets, URLs or price observations.
const DIAGNOSTIC_FIELDS=Object.freeze({
 reason:'code',reasonCode:'code',stopReason:'code',stopCode:'code',
 errorCode:'code',failureCode:'code',resultCode:'code',mismatchCode:'code',
 sourcePreflightReason:'code',code:'code',firstFail:'stage',lastPass:'stage',
 failureStage:'stage',failedStage:'stage',childStage:'stage',
 publisherStage:'stage',stage:'stage',phase:'stage',
 expectedObservationDate:'date',actualObservationDate:'date',
 expectedDate:'date',actualDate:'date',confirmedObservationDate:'date',
 observedDate:'date',modelVersion:'version',
 expectedModelVersion:'version',actualModelVersion:'version',
 reason_code:'code',stop_reason:'code',stop_code:'code',error_code:'code',
 failure_code:'code',result_code:'code',mismatch_code:'code',
 source_preflight_reason:'code',first_fail:'stage',last_pass:'stage',
 last_success_stage:'stage',failure_stage:'stage',failed_stage:'stage',
 child_stage:'stage',publisher_stage:'stage',
 expected_observation_date:'date',actual_observation_date:'date',
 expected_date:'date',actual_date:'date',confirmed_observation_date:'date',
 observed_date:'date',model_version:'version',
 expected_model_version:'version',actual_model_version:'version',
});
const DIAGNOSTIC_CONTAINERS=new Set([
 'diagnostic','diagnostics','details','detail','comparison','rolling',
 'expected','actual','failure','error','cause','result','publication',
 'child','publisher','stop','source','context','summary','review',
]);
const CODE_TERMS=/(?:^|_)(?:STOP|FAIL|FAILED|ERROR|MISMATCH|INVALID|MISSING|UNAVAILABLE|BLOCKED|SKIP|SKIPPED|STALE|EMPTY|DRIFT|CONFLICT|REVIEW|TIMEOUT|DENIED|REJECTED)(?:_|$)/;
const STAGE_TERMS=/(?:^|_)(?:COLLECT|FETCH|SOURCE|CALCULATE|COMPUTE|SAVE|STORE|PUBLISH|PUBLISHER|WRITE|READ|READBACK|VERIFY|PREVIEW|PRECHECK|START|END|DONE|PASS|STOP|FAIL|CHILD)(?:_|$)/;
// Never echo a freeform uppercase string merely because it includes FAILURE.
// Every component must be an explicitly approved diagnostic word.
const SAFE_WORDS=new Set([
 'R178','R179','R181','R183','L7','V1','V2','V3','D1','API',
 'PUBLIC','PRIVATE','SOURCE','COLLECT','COLLECTOR','FETCH','FETCHER',
 'CALCULATE','CALCULATION','COMPUTE','SAVE','SAVED','STORE','STORED',
 'PUBLISH','PUBLISHER','PUBLICATION','WRITE','WRITER','READ','READBACK',
 'VERIFY','VERIFIED','PREVIEW','PRECHECK','PREFLIGHT','START','STARTED',
 'FINISH','FINISHED','END','DONE','PASS','STOP','FAIL','FAILED','FAILURE',
 'ERROR','MISMATCH','INVALID','MISSING','UNAVAILABLE','BLOCKED',
 'SKIP','SKIPPED','STALE','EMPTY','DRIFT','CONFLICT','REVIEW','TIMEOUT',
 'DENIED','REJECTED','CHILD','PARENT','PRIMARY','SECONDARY','RETRY',
 'ROLLING','OBSERVATION','DATE','MODEL','VERSION','DATA','HASH','SHA256',
 'CHECKPOINT','READONLY','STATUS','VALUE','VALUES','LATEST','EXPECTED',
 'ACTUAL','INSERT','UPDATE','UPDATED','NORMALIZED','DAY','DAILY','GET',
 'CORE','RUN','RESULT','SAFE','NO','COMMON','THROUGH','UNREPORTED',
]);
const safeWords=x=>x.split('_').length<=8&&
 x.split('_').every(word=>SAFE_WORDS.has(word));
const modelVersion=x=>typeof x==='string'&&x.length<=48&&
 /^(?:R\d{1,4}|V\d{1,4})(?:[._-](?:R\d{1,4}|V\d{1,4}|[A-Z]{1,12}))?$/.test(x)&&
 !/(?:TOKEN|SECRET|PASSWORD|CREDENTIAL|ACCESS|BEARER|AUTH|PRIVATE|PRICE|URL|KEY)/.test(x)?x:null;
function diagnosticValue(kind,value){
 if(kind==='date')return date(value);
 if(kind==='version')return modelVersion(value);
 const valid=code(value);
 if(!valid)return null;
 return safeWords(valid)&&(kind==='code'?CODE_TERMS:STAGE_TERMS).test(valid)?valid:null;
}
function valueType(value){
 if(value===null)return 'null';
 if(Array.isArray(value))return 'array';
 return typeof value;
}
function diagnosticState(raw){
 const fields=[];
 const values=[];
 let scanned=0;
 let truncated=false;
 const walk=(node,prefix,depth)=>{
  if(depth>3||!node||typeof node!=='object'||Array.isArray(node))return;
  for(const [name,value] of Object.entries(node)){
   if(++scanned>96||fields.length>=24){truncated=true;break;}
   const full=prefix?prefix+'.'+name:name;
   const kind=Object.hasOwn(DIAGNOSTIC_FIELDS,name)?DIAGNOSTIC_FIELDS[name]:null;
   if(kind){
    fields.push({path:full,type:valueType(value)});
    const safe=diagnosticValue(kind,value);
    if(safe!==null&&values.length<16)values.push({path:full,value:safe});
   }
   if(depth<3&&DIAGNOSTIC_CONTAINERS.has(name)&&
      value&&typeof value==='object'&&!Array.isArray(value))
    walk(value,full,depth+1);
   if(truncated)break;
  }
 };
 walk(raw,'',0);
 return {status:values.length?'SAFE_VALUES_FOUND':fields.length?
  'CANDIDATES_WITHOUT_SAFE_VALUE':'UNKNOWN',fields,values,truncated};
}

function child(base,name){
 const target=path.join(base,name);
 if(!fs.existsSync(target))return null;
 const entry=fs.lstatSync(target);
 if(entry.isSymbolicLink()||!entry.isFile())reject('L7_READONLY_ENTRY_NOT_REGULAR');
 return {target,bytes:entry.size,modifiedAt:entry.mtime.toISOString()};
}

function sourceState(base,name){
 const entry=child(base,name);
 if(!entry)return {present:false};
 // A source fingerprint is not executable approval. Never return source text.
 if(entry.bytes>8*1024*1024)reject('L7_SOURCE_OVERSIZED');
 return {present:true,sha256:sha(fs.readFileSync(entry.target)),
  bytes:entry.bytes,modifiedAt:entry.modifiedAt};
}

function ledgerState(base,name){
 const entry=child(base,name);
 if(!entry)return {present:false};
 if(entry.bytes>65536)return {present:true,status:'UNREADABLE_SIZE_LIMIT'};
 let raw;
 try{raw=JSON.parse(fs.readFileSync(entry.target,'utf8'));}
 catch{return {present:true,status:'UNREADABLE_JSON'};}
 if(!raw||typeof raw!=='object'||Array.isArray(raw))
  return {present:true,status:'UNREADABLE_SHAPE'};
 const dates={};
 for(const field of DATE_FIELDS){const value=date(raw[field]);if(value)dates[field]=value;}
 const times={};
 for(const field of STAMP_FIELDS){const value=stamp(raw[field]);if(value)times[field]=value;}
 return {present:true,status:code(raw.status)??'UNREPORTED',
  resultCode:code(raw.code),dates,times,modifiedAt:entry.modifiedAt,
  diagnostic:diagnosticState(raw)};
}

function taskState(queryTask){
 if(typeof queryTask!=='function')return {status:'NOT_QUERIED'};
 let xml;
 try{xml=queryTask(TASK);}catch{return {status:'QUERY_UNAVAILABLE'};}
 const bytes=Buffer.isBuffer(xml)?xml:Buffer.from(String(xml??''),'utf8');
 if(bytes.length<30||bytes.length>512*1024)
  return {status:'QUERY_INVALID_SIZE'};
 // schtasks /XML may return UTF-16LE bytes on a Korean Windows host.
 const utf16=bytes[0]===0xff&&bytes[1]===0xfe||
  (bytes.length>=4&&bytes[1]===0&&bytes[3]===0);
 const source=utf16?new TextDecoder('utf-16le').decode(bytes):bytes.toString('utf8');
 const command=source.match(/<(?:\w+:)?Command>([\s\S]*?)<\/(?:\w+:)?Command>/i)?.[1]??'';
 const args=source.match(/<(?:\w+:)?Arguments>([\s\S]*?)<\/(?:\w+:)?Arguments>/i)?.[1]??'';
 const enabled=source.match(/<(?:\w+:)?Enabled>\s*(true|false)\s*<\/(?:\w+:)?Enabled>/i)?.[1];
 if(!command)return {status:'QUERY_NO_ACTION'};
 return {status:'XML_READ',enabled:enabled?enabled.toLowerCase()==='true':null,
  referencesKnownCollector:(command+' '+args).includes(SOURCE_NAMES[0]),
  referencesExistingRoot:(command+' '+args).toLowerCase().includes('theme-market-history-r131'),
  actionSha256:sha(Buffer.from(command+'\n'+args))};
}

export function inspectThemeL7RuntimeReadonly({dataRoot,queryTask}={}){
 if(typeof dataRoot!=='string'||!path.isAbsolute(dataRoot))
  reject('L7_DATA_ROOT_INVALID');
 let root;
 try{root=fs.realpathSync(dataRoot);}catch{reject('L7_DATA_ROOT_UNAVAILABLE');}
 if(!fs.statSync(root).isDirectory())reject('L7_DATA_ROOT_NOT_DIRECTORY');
 const parent=path.join(root,...SUBDIR);
 // Read only the known subtree; a missing old installation is a finding,
 // not grounds to create replacement C:/E: source or archive directories.
 let folder='MISSING';
 let inspected=parent;
 if(fs.existsSync(parent)){
  const real=fs.realpathSync(parent);
  const relative=path.relative(root,real);
  if(!relative||relative==='..'||relative.startsWith('..'+path.sep)||
   path.isAbsolute(relative)||!fs.statSync(real).isDirectory())
   reject('L7_SOURCE_DIRECTORY_REDIRECT');
  inspected=real;
  folder='PRESENT';
 }
 const sources=Object.fromEntries(SOURCE_NAMES.map(name=>[
  name,folder==='PRESENT'?sourceState(inspected,name):{present:false}]));
 const ledgers=Object.fromEntries(LEDGER_NAMES.map(name=>[
  name,folder==='PRESENT'?ledgerState(inspected,name):{present:false}]));
 return {status:'PASS',code:'L7_RUNTIME_READONLY_INVENTORY',
  operationalReadiness:'NOT_ASSERTED',sourceDirectory:folder,
  sources,ledgers,task:taskState(queryTask),
  collectionAndPublicationNotExecuted:true,providerCalls:0,d1Writes:0,
  operationalWrites:0,sqliteOpened:false};
}

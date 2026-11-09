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
// A one-file, one-version source inspection approved for the R181 STOP
// investigation. Unexpected PC source bytes are never inspected or echoed.
const APPROVED_R181_SHA='be0303b112d6f4471137aa134bf98f696a8a8dfe60d1d13502646c5e0b509d62';
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
// Privacy-preserving *hints* for legacy free-form STOP reasons. This is not a
// statement that the collector ran or that a root cause has been proven.
// Never return raw reason text, URL, credentials, observations, or identifiers.
const REASON_HINTS=Object.freeze([
 ['L7_HINT_RATE_LIMIT',/(?:^|[^0-9])429(?:[^0-9]|$)|\b(?:rate[ _-]*limit|quota[ _-]*(?:exceeded|limit))\b/i],
 ['L7_HINT_AUTH_DENIED',/(?:^|[^0-9])(?:401|403)(?:[^0-9]|$)|\b(?:unauthorized|forbidden|access[ _-]*denied|EACCES|EPERM)\b/i],
 ['L7_HINT_FILE_MISSING',/\b(?:ENOENT|file[ _-]*not[ _-]*found|no[ _-]*such[ _-]*file)\b/i],
 ['L7_HINT_NETWORK_FAILURE',/\b(?:ETIMEDOUT|ECONNRESET|ENOTFOUND|connection[ _-]*refused|fetch[ _-]*failed|timed?[ _-]*out)\b/i],
 ['L7_HINT_SOURCE_EMPTY',/\b(?:no[ _-]*new[ _-]*data|source[ _-]*not[ _-]*ready|no[ _-]*records|missing[ _-]*observation|empty[ _-]*source)\b/i],
 ['L7_HINT_DATE_MISMATCH',/\b(?:NON_SPY_DATE|calendar[ _-]*mismatch|observation[ _-]*date[ _-]*mismatch|DATE_MISMATCH)\b/i],
 ['L7_HINT_PUBLISH_MISMATCH',/\b(?:PUBLIC_API_ROLLING_MISMATCH|D1_READBACK_MISMATCH|PUBLISHER_CHILD_FAILED_REVIEW)\b/i],
]);
function safeReasonHint(value){
 if(typeof value!=='string'||value.length>512||!value.trim())return null;
 // A token or URL in a free-form string makes classification too ambiguous.
 if(/https?:\/\/|\b(?:token|secret|password|credential|bearer|authorization|api[_-]?key)\b|[?&][A-Za-z_]+=/.test(value.toLowerCase()))return null;
 const matched=REASON_HINTS.filter(([,pattern])=>pattern.test(value));
 return matched.length===1?matched[0][0]:null;
}

// Existing production R181 ledgers sometimes have a free-form reason that does
// not match any single safe category. Expose only approved *individual words*
// (never a substring, code suffix, raw reason, or a digest of that reason).
// This is observational evidence, not a claim about the underlying first fail.
const REASON_SIGNAL_WORDS=new Set([
 'NO','NEW','NOT','READY','COMPLETE','INCOMPLETE','PRIMARY','SECONDARY',
 'SOURCE','PROVIDER','GMH','MARKETPARQUET','ETF','ETFS','SPY','COVERAGE',
 'DATE','DAY','CALENDAR','SESSION','MARKET','CLOSED','OPEN','WEEKEND',
 'HOLIDAY','OBSERVATION','LATEST','ROLLING','HISTORY','STALE','FRESH',
 'MISSING','EMPTY','RECORD','RECORDS','ROWS','DATA','RAW','STORED',
 'STOP','SKIP','SKIPPED','BLOCKED','DENIED','UNAVAILABLE','INVALID',
 'FAILED','FAILURE','ERROR','MISMATCH','CHECKPOINT','FILE','PATH',
 'FETCH','REQUEST','RESPONSE','NETWORK','TIMEOUT','QUOTA','LIMIT',
 'AUTH','ACCESS','PUBLISH','PUBLICATION','PUBLISHER','READBACK',
 'D1','API','HTTP','R181','R179','R183','R178',
]);
const SENSITIVE_REASON=/(?:https?:\/\/|[\\/@]|\b(?:token|secret|password|passwd|credential|bearer|authorization|api[_-]?key|private[_-]?key|connection[_-]?string)\b|[?&][A-Za-z_]+=)/i;
function safeReasonSignals(value){
 if(typeof value!=='string'||!value.trim()||value.length>512||
   SENSITIVE_REASON.test(value))return null;
 const words=value.replace(/([a-z])([A-Z])/g,'$1 $2')
  .split(/[^A-Za-z0-9]+/).filter(Boolean).map(x=>x.toUpperCase());
 const signals=[];
 for(const word of words){
  if(REASON_SIGNAL_WORDS.has(word)&&!signals.includes(word))signals.push(word);
  if(signals.length>=12)break;
 }
 // Use fixed vocabulary and a bounded array; unknown words are never echoed.
 return {path:'reason',status:signals.length?'FIXED_SIGNALS':'NO_FIXED_SIGNALS',
  signals:signals.sort()};
}

function safeR181HttpCode(raw){
 const value=raw?.reason;
 if(typeof value!=='string'||value.length>512||SENSITIVE_REASON.test(value))return null;
 // Extract an HTTP status only when explicitly attached to the approved
 // R181/SPY/HTTP reason prefix; never expose a number from arbitrary prose.
 const m=value.match(/(?:^|[^A-Z0-9])R181[_ -]SPY[_ -]HTTP[_ -]([1-5]\d\d)(?=$|[^0-9])/i);
 if(!m)return null;
 const status=Number(m[1]);
 return {source:'R181_SPY_HTTP',status,group:status>=500?'SERVER_5XX':
  status>=400?'CLIENT_4XX':status>=300?'REDIRECT_3XX':
   status>=200?'SUCCESS_2XX':'INFORMATIONAL_1XX'};
}

// Only line positions and fixed syntactic categories are returned; source
// text, identifiers, string literals, URLs, arguments, paths and comments
// are never copied from this private PC file to the result.
export function safeR181SourceStructure(source){
 if(typeof source!=='string'||Buffer.byteLength(source,'utf8')>8192||source.includes('\0'))
  return {status:'UNREADABLE_SOURCE',sites:[],truncated:false};
 const sites=[];
 const lines=source.split(/\r?\n/);
 let truncated=false;
 for(let i=0;i<lines.length;i++){
  const line=lines[i].trim();
  if(!line||line.startsWith('//')||line.startsWith('*'))continue;
  const kinds=[];
  if(/\b(?:reason|stopReason|stop_reason)\s*[:=]/.test(line))kinds.push('REASON_ASSIGNMENT');
  if(/\b(?:statusCode|status|httpStatus|responseStatus)\b/.test(line)&&
     /\b(?:res|response|http|fetch|status|code)\b/i.test(line))kinds.push('HTTP_STATUS_CHECK');
  if(/\bcatch\s*\(/.test(line))kinds.push('CATCH_CLAUSE');
  if(/\bthrow\b/.test(line))kinds.push('THROW_STATEMENT');
  if(/(?:R181[_-]SPY[_-]HTTP|SPY[_-]HTTP)/.test(line))
   kinds.push('R181_SPY_HTTP_MARKER');
  if(!kinds.length)continue;
  if(sites.length>=16){truncated=true;break;}
  sites.push({line:i+1,kinds});
 }
 return {status:'STRUCTURE_ONLY',sites,truncated};
}

// A narrowly bounded, de-identified control-flow view for the approved R181
// source. No identifiers, literal values, comments, expressions within
// templates, URLs, request arguments or environment names leave the host.
// Consistent local identifier labels preserve just enough structure to identify
// where the HTTP failure was caught and written into the STOP ledger.
const SOURCE_KEYWORDS=new Set([
 'const','let','var','if','else','try','catch','finally','throw','new',
 'return','await','async','function','true','false','null','undefined',
 'typeof','in','of','while','for','break','continue','switch','case',
 'default','Error','JSON','Promise','Boolean','Number','String',
 'reason','status','statusCode','message','error','response','res',
 'fetch','http','httpStatus','responseStatus',
]);
const R181_CONTEXT_WINDOWS=Object.freeze([[7,19],[81,98]]);
function redactR181Flow(source,interested){
 if(typeof source!=='string'||Buffer.byteLength(source,'utf8')>8192||
  source.includes('\0'))return {status:'UNREADABLE_SOURCE',lines:[]};
 const identifiers=new Map();
 const lines=[];
 let number=1, output='', state='CODE', quote='', escaped=false;
 const emit=x=>{if(interested(number)&&output.length<240)output+=x;};
 const flush=()=>{
  if(interested(number))lines.push({line:number,pattern:output.trim().slice(0,240)});
  number++;output='';
 };
 const lex=x=>{
  if(SOURCE_KEYWORDS.has(x))return x;
  if(!identifiers.has(x))identifiers.set(x,'ID'+(identifiers.size+1));
  return identifiers.get(x);
 };
 for(let i=0;i<source.length;i++){
  const c=source[i],next=source[i+1]??'';
  if(c==='\r'&&next==='\n')continue;
  if(c==='\n'){
   flush();
   if(state==='LINE_COMMENT')state='CODE';
   continue;
  }
  if(state==='LINE_COMMENT')continue;
  if(state==='BLOCK_COMMENT'){
   if(c==='*'&&next==='/'){state='CODE';i++;}
   continue;
  }
  if(state==='STRING'){
   if(escaped){escaped=false;continue;}
   if(c==='\\'){escaped=true;continue;}
   if(c===quote){state='CODE';}
   continue;
  }
  if(c==='/'&&next==='/'){state='LINE_COMMENT';i++;continue;}
  if(c==='/'&&next==='*'){state='BLOCK_COMMENT';i++;continue;}
  if(c==='\''||c==='"'||c==='`'){
   quote=c;state='STRING';escaped=false;emit(c==='`'?' TPL ':' STR ');
   continue;
  }
  if(/[A-Za-z_$]/.test(c)){
   let j=i+1;
   while(j<source.length&&/[A-Za-z0-9_$]/.test(source[j]))j++;
   emit(' '+lex(source.slice(i,j))+' ');i=j-1;continue;
  }
  if(/[0-9]/.test(c)){
   let j=i+1;
   while(j<source.length&&/[A-Za-z0-9_.]/.test(source[j]))j++;
   emit(' NUM ');i=j-1;continue;
  }
  if(/[{}()[\];:,.=+*?!<>|&%^\-/]/.test(c))emit(c);
  else if(/\s/.test(c))emit(' ');
  else emit(' ? ');
 }
 if(output&&interested(number))lines.push({line:number,pattern:output.trim().slice(0,240)});
 return {status:'REDACTED_ERROR_FLOW',lines};
}

export function safeR181ErrorFlow(source){
 return redactR181Flow(source,line=>
  R181_CONTEXT_WINDOWS.some(([from,to])=>line>=from&&line<=to));
}

// Extra, source-only evidence for the explicitly approved R181 20..80 failure
// segment. Site selection runs on *redacted tokens*, never on literal text:
// credentials, comments and quoted HTTP strings cannot select a source line.
// This cannot prove which branch ran or identify a runtime HTTP response.
export function safeR181HttpErrorFlow(source){
 const view=redactR181Flow(source,()=>true);
 if(view.status==='UNREADABLE_SOURCE')
  return {status:'UNREADABLE_SOURCE',sites:[],lines:[],truncated:false};
 const candidates=view.lines.filter(({line,pattern})=>line>=20&&line<=80&&
  (/\b(?:throw|catch|fetch|http|httpStatus|responseStatus)\b/.test(pattern)||
   /\.\s*(?:status|statusCode)\b/.test(pattern)||
   /\b(?:response|res)\b/.test(pattern)));
 const score=pattern=>/\b(?:throw|catch)\b/.test(pattern)?4:
  /\.\s*(?:status|statusCode)\b/.test(pattern)?3:
  /\b(?:fetch|http|httpStatus|responseStatus)\b/.test(pattern)?2:1;
 const sites=candidates.sort((a,b)=>score(b.pattern)-score(a.pattern)||a.line-b.line)
  .slice(0,8).map(x=>x.line).sort((a,b)=>a-b);
 const selected=new Set();
 for(const site of sites)for(const line of [site-1,site,site+1])
  if(line>=20&&line<=80)selected.add(line);
 const lines=view.lines.filter(x=>selected.has(x.line)).slice(0,24);
 return {status:'STATIC_SOURCE_FLOW_ONLY',sites,lines,
  truncated:candidates.length>sites.length||selected.size>24};
}

function valueType(value){
 if(value===null)return 'null';
 if(Array.isArray(value))return 'array';
 return typeof value;
}
function diagnosticState(raw){
 const fields=[];
 const values=[];
 const reasonProfiles=[];
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
    // The field is kept, but legacy prose may be outside the safe-code
    // vocabulary. Report only one explicit non-sensitive classification hint.
    else if((name==='reason'||name==='stopReason'||name==='stop_reason')&&
      values.length<16){
     const hint=safeReasonHint(value);
     if(hint)values.push({path:full+'.categoryHint',value:hint});
    }
    if((name==='reason'||name==='stopReason'||name==='stop_reason')&&
      reasonProfiles.length<4){
     const profile=safeReasonSignals(value);
     if(profile)reasonProfiles.push({...profile,path:full});
    }
   }
   if(depth<3&&DIAGNOSTIC_CONTAINERS.has(name)&&
      value&&typeof value==='object'&&!Array.isArray(value))
    walk(value,full,depth+1);
   if(truncated)break;
  }
 };
 walk(raw,'',0);
 return {status:values.length?'SAFE_VALUES_FOUND':fields.length?
  'CANDIDATES_WITHOUT_SAFE_VALUE':'UNKNOWN',fields,values,reasonProfiles,
  truncated};
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
 const bytes=fs.readFileSync(entry.target);
 const digest=sha(bytes);
 const result={present:true,sha256:digest,bytes:entry.bytes,
  modifiedAt:entry.modifiedAt};
 if(name===SOURCE_NAMES[0]){
  result.safeSourceInspection=digest===APPROVED_R181_SHA&&bytes.length<=8192?
   safeR181SourceStructure(bytes.toString('utf8')):
   {status:'SOURCE_PIN_OR_SIZE_MISMATCH',sites:[],truncated:false};
  result.safeErrorFlow=digest===APPROVED_R181_SHA&&bytes.length<=8192?
   safeR181ErrorFlow(bytes.toString('utf8')):
   {status:'SOURCE_PIN_OR_SIZE_MISMATCH',lines:[]};
  result.safeHttpErrorFlow=digest===APPROVED_R181_SHA&&bytes.length<=8192?
   safeR181HttpErrorFlow(bytes.toString('utf8')):
   {status:'SOURCE_PIN_OR_SIZE_MISMATCH',sites:[],lines:[],truncated:false};
 }
 return result;
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
  diagnostic:diagnosticState(raw),
  ...(name===LEDGER_NAMES[0]?{safeHttpFailure:safeR181HttpCode(raw)}:{})};
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

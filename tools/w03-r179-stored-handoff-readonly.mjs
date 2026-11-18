// W03 R181 -> R179 protected input handoff. A-class, NO calculation or publication.
// Pin the PC-only R179/R171 code and attest the actual bounded storage format
// before any future approved one-shot compute/publish command is attempted.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

export const REPO='ansqhd5774-Choi/zgmini-pc-control';
export const TITLE='w03-r179-stored-handoff-readonly';
export const SCHEMA='ZGMINI_W03_R179_HANDOFF_A_V1';
export const OUTPUT='ZGMINI_W03_R179_HANDOFF_RESULT_V1';
export const DIR='E:\\ZGmini\\data\\theme-market-history-r131\\marketparquet-r167';
export const SHA179='f9ea0a1bfaf52909b7a434b65ba93887f56660bc979a3cb7e0992597bc9f3b68';
export const SHA171='d6b921acd2b935360a4f1df2ce7329b4fdde0d999dddd5ee3f7f6169c9046ba8';
const SHA181='be0303b112d6f4471137aa134bf98f696a8a8dfe60d1d13502646c5e0b509d62';
const OWNER='ansqhd5774-Choi';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const SHA40=/^[a-f0-9]{40}$/;
const DIGEST=b=>createHash('sha256').update(b).digest('hex');
const err=code=>{throw Object.assign(Error(code),{code});};
const need=(yes,code)=>{if(!yes)err(code);};
const date=s=>typeof s==='string'&&/^\d{4}-\d\d-\d\d$/.test(s)&&
 Number.isFinite(Date.parse(s+'T00:00:00Z'))&&
 new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s?s:null;
export function authorize(event,env){
 need(env?.GITHUB_REPOSITORY===REPO&&env.GITHUB_EVENT_NAME==='issues'&&
 env.GITHUB_EVENT_ACTION==='opened'&&env.GITHUB_RUN_ATTEMPT==='1'&&
 env.GITHUB_ACTOR===OWNER&&SHA40.test(env.GITHUB_SHA??'')&&
 event?.repository?.full_name===REPO&&event.repository.private===true&&
 event.sender?.login===OWNER&&event.issue?.user?.login===OWNER&&
 !event.issue.pull_request&&event.issue.title===TITLE&&
 event.issue.labels?.some(x=>x.name==='pc-writer-b-install')&&
 Number.isSafeInteger(event.issue.number)&&event.issue.number>0,
 'W03_R179_AUTH_EVENT_STOP');
 let r;try{r=JSON.parse(event.issue.body);}catch{err('W03_R179_AUTH_JSON_STOP');}
 const keys=['schema','operation','requestId','chatId','controlRepository','controlSourceSha','r179ExpectedSha256','r171ExpectedSha256','r181ExpectedSha256'];
 need(r&&typeof r==='object'&&!Array.isArray(r)&&
 Object.keys(r).sort().join(',')===keys.sort().join(',')&&
 r.schema===SCHEMA&&r.operation===TITLE&&r.controlRepository===REPO&&
 r.controlSourceSha===env.GITHUB_SHA&&r.r179ExpectedSha256===SHA179&&
 r.r171ExpectedSha256===SHA171&&r.r181ExpectedSha256===SHA181&&
 UUID.test(r.requestId??'')&&UUID.test(r.chatId??''),
 'W03_R179_AUTH_REQUEST_STOP');
 return r;
}
export function classifyR179StaticSource(s){
 // Only a static code signal. A CLI string in comments cannot authorize execution.
 return {
  signalLevel:'STATIC_SOURCE_ONLY_NOT_EXECUTION_AUTHORIZATION',
  sqliteToken:/\b(?:better-sqlite3|sqlite3|node:sqlite)\b/i.test(s),
  parquetToken:/\b(?:parquet|hyparquet)\b/i.test(s),
  jsonToken:/\bJSON\.(?:parse|stringify)\b/.test(s),
  wranglerToken:/\bwrangler\b/i.test(s),
  d1Token:/\b(?:D1|public_feed_snapshots_v1)\b/.test(s),
  dryRunFlagPresent:s.includes('--dry-run'),
  computeOnlyFlagPresent:s.includes('--compute-only'),
  readOnlyFlagPresent:s.includes('--read-only'),
 };
}
function fixedFile(name,{max=65536,read=fs.readFileSync,stat=fs.lstatSync,real=fs.realpathSync.native}={}){
 const file=path.win32.join(DIR,name);
 let st;try{st=stat(file);}catch{return {status:'MISSING',bytes:null,sha:null};}
 need(st.isFile()&&!st.isSymbolicLink()&&st.size>0&&st.size<=max,
  'W03_R179_SOURCE_SCOPE_STOP');
 need(path.win32.dirname(real(file)).toLowerCase()===real(DIR).toLowerCase(),
  'W03_R179_SOURCE_ESCAPE_STOP');
 const a=read(file),b=read(file);
 need(Buffer.isBuffer(a)&&Buffer.isBuffer(b)&&a.length===st.size&&a.equals(b),
  'W03_R179_SOURCE_CONCURRENT_DRIFT_STOP');
 return {status:'PRESENT',bytes:a.length,sha:DIGEST(a),content:a};
}
function staticSource(name,expected,bytes,io){
 const f=fixedFile(name,{max:32768,...io});
 if(f.status==='MISSING')return {status:'MISSING',pinMatch:false};
 const match=f.sha===expected&&f.bytes===bytes;
 return {status:match?'PIN_MATCH':'PIN_DRIFT',pinMatch:match,
  bytes:f.bytes,static:match?classifyR179StaticSource(f.content.toString('utf8')):null};
}
const summaryKeys=['R181_PRIMARY_LAST_RUN.json',
 'ZGMINI_R179_PUBLICATION_LAST_RUN.json',
 'R183_PUBLICATION_RETRY_LAST_RUN.json'];
function ledger(name,io={}){
 const f=fixedFile(name,{max:65536,...io});
 if(f.status==='MISSING')return {status:'MISSING'};
 let o;try{o=JSON.parse(f.content.toString('utf8'));}catch{return{status:'INVALID_JSON'};}
 const status=typeof o?.status==='string'&&/^[A-Z0-9_]{1,80}$/.test(o.status)?
  o.status:'UNKNOWN';
 const dates=Object.fromEntries(['observationDate','observedDate','baseObservationDate',
  'confirmedObservationDate'].map(k=>[k,date(o?.[k])]));
 return {status,dates,modifiedAt:null};
}
export function countStorageNames(names){
 // Never return a filename/path, price row, SQL or private asset ID.
 need(Array.isArray(names)&&names.length<=4000,'W03_R179_STORAGE_INVENTORY_BOUND_STOP');
 const counts={sqlite:0,db:0,parquet:0,json:0,ndjson:0,csv:0,other:0};
 const dateSet=new Set();
 for(const name of names){
  if(typeof name!=='string'||name.length>255)continue;
  const ext=name.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
  if(Object.hasOwn(counts,ext))counts[ext]++;
  else counts.other++;
  const match=name.match(/^etf_daily_(\d{4}-\d{2}-\d{2})\.parquet$/i);
  if(match&&date(match[1]))dateSet.add(match[1]);
 }
 return {counts,datedParquetFiles:dateSet.size,
  earliestDatedFile:[...dateSet].sort()[0]??null,
  latestDatedFile:[...dateSet].sort().at(-1)??null,
  requiresContentValidation:true};
}
function inventory(io={}){
 // No recursion and no data payloads. Only fixed directory direct-child types.
 const readdir=io.readdir??fs.readdirSync;
 const list=readdir(DIR,{withFileTypes:true});
 need(Array.isArray(list)&&list.length<=4000,'W03_R179_STORAGE_INVENTORY_BOUND_STOP');
 return countStorageNames(list.filter(x=>x.isFile()&&!x.isSymbolicLink()).map(x=>x.name));
}
export function inspectPcR179Handoff(io={}){
 need(process.platform==='win32','W03_R179_WINDOWS_ONLY_STOP');
 const sources={
  r181:staticSource('r181-primary-cycle.mjs',SHA181,7089,io),
  r179:staticSource('r179-publish-core.mjs',SHA179,10822,io),
  r171:staticSource('r171-publish.mjs',SHA171,6389,io)
 };
 const ledgers=Object.fromEntries(summaryKeys.map(n=>[n,ledger(n,io)]));
 const storage=inventory(io);
 const sourceVerified=Object.values(sources).every(x=>x.pinMatch===true);
 const lastStatus=ledgers['ZGMINI_R179_PUBLICATION_LAST_RUN.json'].status;
 return {schema:'ZGMINI_W03_R179_HANDOFF_PAYLOAD_V1',
  status:sourceVerified?'SOURCES_PINNED_READONLY':'SOURCE_DRIFT_OR_MISSING',
  sources,ledgers,storage,lastPublicationStatus:lastStatus,
  nextGate:sourceVerified?'STORED_RAW_CONTENT_252_AND_RIGHTS_BEFORE_COMPUTE':
   'CURRENT_R179_SOURCE_PREIMAGE_REQUIRED',
  rightsAttested:false,sourceRawShaVerified:false,
  sqliteCheckpointVerified:false,history252Verified:false,
  publisherExecuted:false,d1Readback:false,providerCalls:0,
  sqliteOpened:false,pcWrites:0,d1Writes:0};
}
export function execute({event,env,inspect=inspectPcR179Handoff}={}){
 const request=authorize(event,env);
 const payload=inspect();
 need(payload?.schema==='ZGMINI_W03_R179_HANDOFF_PAYLOAD_V1'&&
  payload.providerCalls===0&&payload.sqliteOpened===false&&
  payload.pcWrites===0&&payload.d1Writes===0&&
  payload.publisherExecuted===false,'W03_R179_OUTPUT_CONTRACT_STOP');
 return {schema:OUTPUT,requestId:request.requestId,status:'PASS',
  code:'W03_R179_STORED_HANDOFF_READONLY',
  controlSha:env.GITHUB_SHA,details:payload};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 let result;
 try{
  result=execute({event:JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH,'utf8')),
   env:process.env});
 }catch(e){result={schema:OUTPUT,status:'STOP',
  code:/^W03_R179_[A-Z0-9_]{3,100}$/.test(e?.code??'')?
   e.code:'W03_R179_UNCLASSIFIED_STOP',requestId:null,details:null};}
 try{
  need(typeof process.env.RUNNER_TEMP==='string'&&path.isAbsolute(process.env.RUNNER_TEMP),
   'W03_R179_RESULT_DIR_STOP');
  fs.writeFileSync(path.join(process.env.RUNNER_TEMP,'w03-r179-handoff.json'),
   JSON.stringify(result)+'\n',{flag:'wx'});
 }catch{process.exitCode=1;}
 process.stdout.write(result.status+' '+result.code+'\n');
 if(result.status!=='PASS')process.exitCode=1;
}
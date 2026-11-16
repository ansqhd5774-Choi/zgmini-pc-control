// Sanitized create-only result pair for W03 R179 input/compute handoff.
// Authentication and source inspection never receive GitHub write token.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {authorize,OUTPUT,REPO} from './w03-r179-stored-handoff-readonly.mjs';
const MAX_RUN=/^\d{1,18}$/;
const SHA40=/^[a-f0-9]{40}$/;
const CODE=/^W03_R179_[A-Z0-9_]{3,100}$/;
const STATUS=new Set(['SOURCES_PINNED_READONLY','SOURCE_DRIFT_OR_MISSING']);
const SOURCE=new Set(['PIN_MATCH','PIN_DRIFT','MISSING']);
const LEDGER=new Set(['MISSING','INVALID_JSON','UNKNOWN','LOCAL_PRIMARY_STORED',
 'PRIMARY_RAW_STORED','NO_NEW_COMPLETE_PRIMARY_DATE','STOP',
 'PUBLIC_API_ROLLING_MISMATCH','PUBLISHER_CHILD_FAILED_REVIEW',
 'READY','COMPLETE','FAILED']);
const BOOLS=['sqliteToken','parquetToken','jsonToken','wranglerToken',
 'd1Token','dryRunFlagPresent','computeOnlyFlagPresent','readOnlyFlagPresent'];
const DATE_KEYS=['observationDate','observedDate','baseObservationDate',
 'confirmedObservationDate'];
const ATTEST=['rightsAttested','sourceRawShaVerified','sqliteCheckpointVerified',
 'history252Verified','publisherExecuted','d1Readback','sqliteOpened'];
const EXT_KEYS=['sqlite','db','parquet','json','ndjson','csv','other'];
const days=x=>x===null||typeof x==='string'&&/^\d{4}-\d\d-\d\d$/.test(x)&&
 Number.isFinite(Date.parse(x+'T00:00:00Z'))&&
 new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;
const no=code=>{throw Object.assign(Error(code),{code});};
const requireTrue=(v,code)=>{if(!v)no(code);};
const base=(req,env)=>({schema:OUTPUT,requestId:req.requestId,
 status:'STATE_UNKNOWN',code:'W03_R179_RESULT_UNVERIFIED_STOP',
 runId:MAX_RUN.test(env?.GITHUB_RUN_ID??'')?env.GITHUB_RUN_ID:null,
 details:null,sourceOnly:true,providerCalls:0,pcWrites:0,d1Writes:0,
 retry:'NO_AUTOMATIC_REEXECUTION'});
export function sanitize(raw,req,env){
 const out=base(req,env);
 if(raw?.schema!==OUTPUT||![req.requestId,null].includes(raw.requestId))return out;
 if(raw.status==='STOP'&&CODE.test(raw.code??''))
  return {...out,status:'STOP',code:raw.code};
 if(raw.status!=='PASS'||raw.code!=='W03_R179_STORED_HANDOFF_READONLY'||
  raw.requestId!==req.requestId||raw.controlSha!==req.controlSourceSha||
  !SHA40.test(raw.controlSha??''))return out;
 const a=raw.details;
 if(a?.schema!=='ZGMINI_W03_R179_HANDOFF_PAYLOAD_V1'||!STATUS.has(a.status)||
  a.providerCalls!==0||a.pcWrites!==0||a.d1Writes!==0||
  !ATTEST.every(k=>a[k]===false)||
  !a.sources||!a.ledgers||!a.storage)return out;
 const sources={};
 for(const k of ['r181','r179','r171']){
  const s=a.sources[k];
  if(!SOURCE.has(s?.status)||typeof s.pinMatch!=='boolean'||
   (s.status==='PIN_MATCH')!==s.pinMatch)return out;
  if(s.status!=='MISSING'&&(!Number.isSafeInteger(s.bytes)||s.bytes<1||
   s.bytes>32768))return out;
  let signals=null;
  if(s.pinMatch){
   signals=s.static;
   if(signals?.signalLevel!=='STATIC_SOURCE_ONLY_NOT_EXECUTION_AUTHORIZATION'||
    !BOOLS.every(b=>typeof signals[b]==='boolean'))return out;
   signals={signalLevel:signals.signalLevel,
    ...Object.fromEntries(BOOLS.map(k=>[k,signals[k]]))};
  }
  sources[k]={status:s.status,pinMatch:s.pinMatch,
   bytes:s.status==='MISSING'?null:s.bytes,static:signals};
 }
 const ledgers={};
 for(const k of ['R181_PRIMARY_LAST_RUN.json',
  'ZGMINI_R179_PUBLICATION_LAST_RUN.json','R183_PUBLICATION_RETRY_LAST_RUN.json']){
  const v=a.ledgers[k];
  if(!v||!LEDGER.has(v.status))return out;
  const d={};
  for(const name of DATE_KEYS){
   if(!days(v.dates?.[name]))return out;
   d[name]=v.dates[name];
  }
  ledgers[k]={status:v.status,dates:d};
 }
 const st=a.storage;
 if(!st.counts||!EXT_KEYS.every(k=>Number.isSafeInteger(st.counts[k])&&
   st.counts[k]>=0&&st.counts[k]<=4000)||
  !Number.isSafeInteger(st.datedParquetFiles)||
  st.datedParquetFiles<0||st.datedParquetFiles>4000||
  !days(st.earliestDatedFile)||!days(st.latestDatedFile)||
  st.requiresContentValidation!==true)return out;
 const storage={counts:Object.fromEntries(EXT_KEYS.map(k=>[k,st.counts[k]])),
  datedParquetFiles:st.datedParquetFiles,
  earliestDatedFile:st.earliestDatedFile,
  latestDatedFile:st.latestDatedFile,
  requiresContentValidation:true};
 const allowedNext=a.status==='SOURCES_PINNED_READONLY'?
  'STORED_RAW_CONTENT_252_AND_RIGHTS_BEFORE_COMPUTE':
  'CURRENT_R179_SOURCE_PREIMAGE_REQUIRED';
 if(a.nextGate!==allowedNext||
  a.lastPublicationStatus!==ledgers['ZGMINI_R179_PUBLICATION_LAST_RUN.json'].status||
  (a.status==='SOURCES_PINNED_READONLY'&&
   !Object.values(sources).every(x=>x.pinMatch)))return out;
 return {...out,status:'PASS',code:'W03_R179_STORED_HANDOFF_READONLY',
  details:{status:a.status,sources,ledgers,storage,
   lastPublicationStatus:a.lastPublicationStatus,nextGate:allowedNext,
   rightsAttested:false,sourceRawShaVerified:false,
   sqliteCheckpointVerified:false,history252Verified:false,
   publisherExecuted:false,d1Readback:false,providerCalls:0,
   sqliteOpened:false,pcWrites:0,d1Writes:0}};
}
function asText(r){return [
 'REQUEST_ID='+r.requestId,'STATUS='+r.status,'CODE='+r.code,
 'RUN_ID='+(r.runId??'UNKNOWN'),'SAFE_DETAILS='+JSON.stringify(r.details??{}),
 'PROVIDER_CALLS=0','SOURCE_ONLY=true','SQLITE_OPENED=false',
 'PC_WRITES=0','D1_WRITES=0','RETRY='+r.retry,''].join('\n');}
async function readback(fetchApi,url,headers,bytes){
 try{
  const response=await fetchApi(url+'?ref=main',{headers});
  if(response.status!==200)return false;
  const json=await response.json();
  return json?.encoding==='base64'&&typeof json.content==='string'&&
   Buffer.from(json.content.replace(/\s/g,''),'base64').equals(Buffer.from(bytes));
 }catch{return false;}
}
export async function publish({event,env,raw,fetchApi=fetch}){
 const req=authorize(event,env);
 requireTrue(typeof env.GITHUB_TOKEN==='string'&&
  env.GITHUB_TOKEN.length>=20&&MAX_RUN.test(env.GITHUB_RUN_ID??''),
  'W03_R179_REPORT_AUTH_STOP');
 let parsed=null;
 try{parsed=typeof raw==='string'&&Buffer.byteLength(raw)<=12000?
  JSON.parse(raw):null;}catch{}
 const report=sanitize(parsed,req,env);
 const headers={accept:'application/vnd.github+json',
  authorization:'Bearer '+env.GITHUB_TOKEN,
  'x-github-api-version':'2022-11-28','content-type':'application/json',
  'user-agent':'zgmini-w03-r179-input-handoff'};
 let stored=0,verified=0;
 for(const [ext,txt] of [['json',JSON.stringify(report,null,2)+'\n'],
  ['txt',asText(report)]]){
  const url='https://api.github.com/repos/'+REPO+
   '/contents/results/w03-r179-handoff-'+req.requestId+'.'+ext;
  try{
   const x=await fetchApi(url,{method:'PUT',headers,
    body:JSON.stringify({message:'proof: R179 pinned input handoff',
     content:Buffer.from(txt).toString('base64')})});
   if(x.status===201)stored++;
  }catch{/* no automatic retry of lost acknowledgment */}
  if(await readback(fetchApi,url,headers,txt))verified++;
 }
 const status=verified===2?report.status:'STATE_UNKNOWN';
 const msg='<!-- w03-r179-handoff:'+req.requestId+' -->\n'+
  'W03 R179 saved input A: '+status+' / '+report.code+
  '; JSON/TXT '+verified+'/2 readback; created '+stored+'/2; run '+
  (report.runId??'UNKNOWN')+'; provider/SQLite/D1 writes 0; do not replay.\n';
 const posted=await fetchApi('https://api.github.com/repos/'+REPO+
  '/issues/'+event.issue.number+'/comments',{method:'POST',headers,
   body:JSON.stringify({body:msg})});
 requireTrue(posted.status===201,'W03_R179_REPORT_COMMENT_STOP');
 return {status,verified,stored};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const event=JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH,'utf8'));
  let raw='{}';try{raw=fs.readFileSync(path.join(process.env.RUNNER_TEMP,
   'w03-r179-handoff.json'),'utf8');}catch{}
  const result=await publish({event,env:process.env,raw});
  process.stdout.write(result.status+' '+result.verified+'/2\n');
 }catch{process.stderr.write('W03_R179_REPORT_UNKNOWN_NO_REEXECUTION\n');
  process.exitCode=1;}
}
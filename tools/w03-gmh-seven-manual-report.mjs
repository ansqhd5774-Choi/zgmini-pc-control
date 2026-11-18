// W03 manual-only output pair; never publishes the raw GMH hourly bars.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {authorize,APPROVED_SOURCE_SHA,REPO,OUTPUT}
 from './w03-gmh-seven-manual-once.mjs';
const STATUS=new Set(['PRIVATE_GMH_HISTORY_COLLECTED',
 'CHECKPOINT_READY_TO_RESUME']);
const CODE=/^W03_GMH_MANUAL_[A-Z0-9_]{3,80}$/;
const RUN=/^\d{1,18}$/;
const SHA=/^[a-f0-9]{40}$/;
const stop=code=>{throw Object.assign(Error(code),{code});};
const need=(ok,code)=>{if(!ok)stop(code);};
const base=(req,env)=>({schema:OUTPUT,status:'STATE_UNKNOWN',
 code:'W03_GMH_MANUAL_RESULT_UNVERIFIED',
 requestId:req.requestId,
 runId:RUN.test(env.GITHUB_RUN_ID??'')?env.GITHUB_RUN_ID:null,
 sourceCommit:APPROVED_SOURCE_SHA,controlSha:env.GITHUB_SHA,
 providerCalls:null,rawPagesStored:null,completedSymbols:null,
 pendingSymbols:null,manifestFiles:null,
 d1Writes:0,publicWrites:0,schedulerChanges:0,
 rawPriceExposed:false,retry:'NO_AUTOMATIC_REEXECUTION'});
const count=(x,max)=>Number.isSafeInteger(x)&&x>=0&&x<=max;
export function sanitize(raw,req,env){
 const o=base(req,env);
 if(raw?.schema!==OUTPUT||raw.requestId!==req.requestId||
  raw.sourceCommit!==APPROVED_SOURCE_SHA||
  raw.controlSha!==req.controlSourceSha||
  !SHA.test(raw.controlSha??'')||
  raw.d1Writes!==0||raw.publicWrites!==0||
  raw.schedulerChanges!==0||raw.rawPriceExposed!==false||
  raw.retry!=='NO_AUTOMATIC_REEXECUTION')return o;
 if(raw.status==='STOP'&&CODE.test(raw.code??'')){
  return {...o,status:'STOP',code:raw.code,
   providerCalls:count(raw.providerCalls,4)?raw.providerCalls:null,
   rawPagesStored:count(raw.rawPagesStored,4)?raw.rawPagesStored:null};
 }
 if(raw.status!=='PASS'||raw.code!=='W03_GMH_MANUAL_PRIVATE_RAW_CHECKPOINT'||
  !STATUS.has(raw.sourceStatus)||
  !count(raw.providerCalls,4)||!count(raw.rawPagesStored,4)||
  !count(raw.completedSymbols,14)||
  !count(raw.pendingSymbols,14)||
  raw.completedSymbols+raw.pendingSymbols!==14||
  !count(raw.manifestFiles,256)||
  (raw.sourceStatus==='PRIVATE_GMH_HISTORY_COLLECTED'&&
   raw.pendingSymbols!==0))return o;
 return {...o,status:'PASS',code:raw.code,sourceStatus:raw.sourceStatus,
  providerCalls:raw.providerCalls,rawPagesStored:raw.rawPagesStored,
  completedSymbols:raw.completedSymbols,
  pendingSymbols:raw.pendingSymbols,manifestFiles:raw.manifestFiles};
}
async function readback(fetchApi,url,headers,contents){
 try{
  const r=await fetchApi(url+'?ref=main',{headers});
  if(r.status!==200)return false;
  const v=await r.json();
  return v.encoding==='base64'&&typeof v.content==='string'&&
   Buffer.from(v.content.replace(/\s/g,''),'base64').equals(Buffer.from(contents));
 }catch{return false;}
}
export async function report({event,env,raw,fetchApi=fetch}){
 const req=authorize(event,env);
 need(typeof env.GITHUB_TOKEN==='string'&&env.GITHUB_TOKEN.length>=20&&
  RUN.test(env.GITHUB_RUN_ID??''),'W03_GMH_MANUAL_REPORT_AUTH');
 let parsed;
 try{parsed=typeof raw==='string'&&Buffer.byteLength(raw)<=5000?
  JSON.parse(raw):null;}catch{parsed=null;}
 const value=sanitize(parsed,req,env);
 const headers={accept:'application/vnd.github+json',
  authorization:'Bearer '+env.GITHUB_TOKEN,
  'x-github-api-version':'2022-11-28',
  'content-type':'application/json','user-agent':'zgmini-w03-gmh-manual'};
 const txt=[
  'REQUEST_ID='+req.requestId,'STATUS='+value.status,'CODE='+value.code,
  'RUN_ID='+value.runId,'COMPLETED_SYMBOLS='+(value.completedSymbols??'UNKNOWN'),
  'PENDING_SYMBOLS='+(value.pendingSymbols??'UNKNOWN'),
  'PROVIDER_CALLS='+(value.providerCalls??'UNKNOWN'),
  'MANIFEST_FILES='+(value.manifestFiles??'UNKNOWN'),
  'PRIVATE_ONLY=true','D1_WRITES=0','PUBLIC_WRITES=0',
  'TASK_CHANGES=0','RAW_PRICE_EXPOSED=false',
  'RETRY=NO_AUTOMATIC_REEXECUTION',''].join('\n');
 let stored=0,verified=0;
 for(const [ext,contents] of [['json',JSON.stringify(value,null,2)+'\n'],
  ['txt',txt]]){
  const url='https://api.github.com/repos/'+REPO+
   '/contents/results/w03-gmh-seven-manual-'+req.requestId+'.'+ext;
  try{
   const r=await fetchApi(url,{method:'PUT',headers,body:JSON.stringify({
    message:'evidence: W03 GMH seven manual-only saved raw checkpoint',
    content:Buffer.from(contents).toString('base64')})});
   if(r.status===201)stored++;
  }catch{}
  if(await readback(fetchApi,url,headers,contents))verified++;
 }
 const note='<!-- w03-gmh-seven-manual:'+req.requestId+' -->\n'+
  'W03 GMH 14-symbol manual-only history: '+
  (verified===2?value.status:'STATE_UNKNOWN')+' / '+value.code+
  '; completed symbols '+(value.completedSymbols??'UNKNOWN')+'/14'+
  '; calls '+(value.providerCalls??'UNKNOWN')+
  '; created '+stored+'/2, JSON/TXT readback '+verified+'/2'+
  '; run '+value.runId+
  '; D1/public/Task writes 0; no automatic replay.\n';
 const r=await fetchApi('https://api.github.com/repos/'+REPO+
  '/issues/'+event.issue.number+'/comments',{method:'POST',headers,
   body:JSON.stringify({body:note})});
 need(r.status===201,'W03_GMH_MANUAL_REPORT_COMMENT');
 return {status:verified===2?value.status:'STATE_UNKNOWN',stored,verified};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const env=process.env,event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
  let raw='{}';
  try{raw=fs.readFileSync(path.join(env.RUNNER_TEMP,'w03-gmh-manual-result.json'),
   'utf8');}catch{}
  const x=await report({event,env,raw});
  process.stdout.write('W03_GMH_MANUAL_REPORT '+x.status+' '+x.verified+'/2\n');
 }catch{process.stderr.write('W03_GMH_MANUAL_REPORT_UNVERIFIED\n');
  process.exitCode=1;}
}

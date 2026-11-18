#!/usr/bin/env node
// Report exact forbidden provider Task disable and protected GMH readback.
// Never promote it to successful raw data collection or D1 publication.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {authorize,REQUEST_SCHEMA,OPERATION}
 from './marketparquet-task-retire-once.mjs';
const REPO='ansqhd5774-Choi/zgmini-pc-control';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA64=/^[a-f0-9]{64}$/i;
const RUN=/^\d{1,18}$/;
const CODE=/^MP_RETIRE_[A-Z0-9_]{3,100}$/;
const stop=c=>{throw Object.assign(Error(c),{code:c});};
const need=(ok,c)=>{if(!ok)stop(c);};
function verifyEvent(event,env){
 need(env?.GITHUB_REPOSITORY===REPO&&env.GITHUB_EVENT_NAME==='issues'&&
  env.GITHUB_EVENT_ACTION==='opened'&&env.GITHUB_RUN_ATTEMPT==='1'&&
  env.GITHUB_ACTOR==='ansqhd5774-Choi'&&RUN.test(env.GITHUB_RUN_ID??'')&&
  event?.repository?.full_name===REPO&&event.repository.private===true&&
  event.sender?.login==='ansqhd5774-Choi'&&
  event.issue?.user?.login==='ansqhd5774-Choi'&&
  event.issue?.title===OPERATION&&!event.issue.pull_request&&
  event.issue.labels?.some(l=>l.name==='pc-writer-b-install')&&
  Number.isSafeInteger(event.issue.number)&&event.issue.number>0,
  'MP_RETIRE_REPORT_EVENT_STOP');
 let r;try{r=JSON.parse(event.issue.body);}catch{
  stop('MP_RETIRE_REPORT_REQUEST_STOP');}
 need(r?.schema===REQUEST_SCHEMA&&r.operation===OPERATION&&
  r.controlRepository===REPO&&UUID.test(r.requestId??'')&&
  UUID.test(r.chatId??'')&&
  /^approvals\/marketparquet-retire\/[a-z0-9-]{6,80}\.json$/.test(r.approvalManifestPath??'')&&
  SHA64.test(r.approvalManifestSha256??''),
  'MP_RETIRE_REPORT_REQUEST_STOP');
 return r;
}
export function sanitizeMpRetireResult(raw,request,env){
 const base={schema:'ZGMINI_MP_TASK_RETIRE_RECEIPT_V1',requestId:request.requestId,status:'STATE_UNKNOWN',code:'MP_RETIRE_RESULT_UNVERIFIED_STOP',taskDisabled:false,protectedTaskUnchanged:false,providerCalls:null,d1Writes:null,noFutureHttpGuaranteed:false,runId:RUN.test(env?.GITHUB_RUN_ID??'')?env.GITHUB_RUN_ID:null,retry:'NO_REEXECUTE'};
 if(!raw||typeof raw!=='object'||!CODE.test(raw.code??''))return base;
 if(raw.status==='PASS'&&raw.code==='MP_RETIRE_EXACT_TASK_DISABLED_READBACK_VERIFIED'&&raw.requestId===request.requestId&&raw.controlSha===env.GITHUB_SHA&&raw.taskDisabled===true&&raw.protectedTaskUnchanged===true&&raw.providerCalls===0&&raw.d1Writes===0&&raw.sourceWrites===0&&raw.sqliteWrites===0&&raw.noFutureHttpGuaranteed===false&&[raw.beforeXmlSha256,raw.afterXmlSha256,raw.entrySha256,raw.protectedTaskXmlSha256].every(x=>SHA64.test(x??'')))return {...base,status:'PASS',code:raw.code,taskDisabled:true,protectedTaskUnchanged:true,providerCalls:0,d1Writes:0,controlSha:raw.controlSha,beforeXmlSha256:raw.beforeXmlSha256,afterXmlSha256:raw.afterXmlSha256,entrySha256:raw.entrySha256,protectedTaskXmlSha256:raw.protectedTaskXmlSha256};
 if(raw.status==='PREFLIGHT_STOP'&&raw.taskDisabled===false)return {...base,status:raw.status,code:raw.code,providerCalls:0,d1Writes:0};
 return base;
}
function asText(r){return Object.entries(r).map(([k,v])=>k+'='+String(v)).join('\n')+'\n';}
async function readback(fetchApi,url,headers,bytes){
 try{
  const r=await fetchApi(url+'?ref=main',{method:'GET',headers});
  if(r.status!==200)return false;
  const v=await r.json();
  return v?.encoding==='base64'&&typeof v.content==='string'&&
   Buffer.from(v.content.replace(/\s/g,''),'base64')
    .equals(Buffer.from(bytes));
 }catch{return false;}
}
export async function publishMpRetireReceipt({event,env,raw,fetchApi=fetch}){
 const req=verifyEvent(event,env);
 need(typeof env.GITHUB_TOKEN==='string'&&env.GITHUB_TOKEN.length>=20,
  'MP_RETIRE_REPORT_TOKEN_STOP');
 let data=null;
 try{data=typeof raw==='string'&&Buffer.byteLength(raw)<=4096?
  JSON.parse(raw):null;}catch{}
 const out=sanitizeMpRetireResult(data,req,env);
 const headers={accept:'application/vnd.github+json',
  authorization:'Bearer '+env.GITHUB_TOKEN,
  'x-github-api-version':'2022-11-28','content-type':'application/json',
  'user-agent':'zgmini-marketparquet-retire'};
 let created=0,verified=0;
 for(const [ext,body] of [
  ['json',JSON.stringify(out,null,2)+'\n'],
  ['txt',asText(out)]]){
  const url='https://api.github.com/repos/'+REPO+
   '/contents/results/marketparquet-retire-'+req.requestId+'.'+ext;
  try{
   const r=await fetchApi(url,{method:'PUT',headers,
    body:JSON.stringify({message:'evidence: exact MarketParquet Task retirement',
     content:Buffer.from(body).toString('base64')})});
   if(r.status===201)created++;
  }catch{}
  if(await readback(fetchApi,url,headers,body))verified++;
 }
 const status=verified===2?out.status:'STATE_UNKNOWN';
 const comment='<!-- w03-marketparquet-retire:'+req.requestId+' -->\n'+
  'Exact existing MarketParquet exact Task retire request: '+status+' / '+out.code+
  '; JSON/TXT readback '+verified+'/2, created '+created+
  '/2; run '+out.runId+
  '; only exact forbidden provider task disable; source and GMH task protected; no replay.\n';
 const posted=await fetchApi('https://api.github.com/repos/'+REPO+
  '/issues/'+event.issue.number+'/comments',{method:'POST',headers,
   body:JSON.stringify({body:comment})});
 need(posted.status===201,'MP_RETIRE_REPORT_COMMENT_STOP');
 return {status,created,verified};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const env=process.env,event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
  let raw='{}';try{raw=fs.readFileSync(path.join(env.RUNNER_TEMP,
   'mp-task-retire-result.json'),'utf8');}catch{}
  const result=await publishMpRetireReceipt({event,env,raw});
  process.stdout.write('MP_RETIRE_REPORT '+result.status+' '+result.verified+'/2\n');
 }catch{
  process.stderr.write('MP_RETIRE_REPORT_STATE_UNKNOWN_NO_REPLAY\n');
  process.exitCode=1;
 }
}

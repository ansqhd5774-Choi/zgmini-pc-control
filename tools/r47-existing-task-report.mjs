#!/usr/bin/env node
// Report exactly one fixed Windows Task Run acceptance as an unverified START.
// Never promote it to successful raw data collection or D1 publication.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {authorizeExistingR47Task,REQUEST_SCHEMA,OPERATION}
 from './r47-existing-task-once.mjs';
const REPO='ansqhd5774-Choi/zgmini-pc-control';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA64=/^[a-f0-9]{64}$/i;
const RUN=/^\d{1,18}$/;
const CODE=/^R47_TASK_[A-Z0-9_]{3,100}$/;
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
  'R47_TASK_REPORT_EVENT_STOP');
 let r;try{r=JSON.parse(event.issue.body);}catch{
  stop('R47_TASK_REPORT_REQUEST_STOP');}
 need(r?.schema===REQUEST_SCHEMA&&r.operation===OPERATION&&
  r.controlRepository===REPO&&UUID.test(r.requestId??'')&&
  UUID.test(r.chatId??'')&&
  /^approvals\/r47-task-once\/r47-task-[a-z0-9-]{6,64}\.json$/.test(r.approvalManifestPath??'')&&
  SHA64.test(r.approvalManifestSha256??''),
  'R47_TASK_REPORT_REQUEST_STOP');
 return r;
}
export function sanitizeR47TaskResult(raw,request,env){
 const base={schema:'ZGMINI_R47_TASK_ONCE_RECEIPT_V1',
  requestId:request.requestId,status:'STATE_UNKNOWN',
  code:'R47_TASK_RESULT_UNVERIFIED_STOP',
  taskRunRequested:null,collectorVerified:false,
  providerCalls:null,sqliteWrites:null,d1Writes:null,
  runId:RUN.test(env?.GITHUB_RUN_ID??'')?env.GITHUB_RUN_ID:null,
  retry:'NO_REEXECUTE'};
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||
  !CODE.test(raw.code??''))return base;
 if(raw.requestId!==request.requestId&&raw.requestId!==undefined)return base;
 if(raw.status==='RUN_REQUEST_ACCEPTED'&&
  raw.code==='R47_TASK_SCHEDULER_ACCEPTED'&&
  raw.taskRunRequested===true&&raw.collectorVerified===false&&
  raw.providerCalls===null&&raw.sqliteWrites===null&&raw.d1Writes===null&&
  raw.requestId===request.requestId&&
  /^[a-f0-9]{40}$/.test(raw.controlSha??'')&&
  raw.controlSha===env.GITHUB_SHA)
  return {...base,status:raw.status,code:raw.code,
   taskRunRequested:true,controlSha:raw.controlSha};
 if(raw.status==='PREFLIGHT_STOP'&&raw.taskRunRequested===false)
  return {...base,status:'PREFLIGHT_STOP',code:raw.code,
   taskRunRequested:false,providerCalls:0,sqliteWrites:0,d1Writes:0};
 if(raw.status==='STATE_UNKNOWN')
  return {...base,status:'STATE_UNKNOWN',code:raw.code,
   taskRunRequested:raw.taskRunRequested===true?true:null};
 return base;
}
function asText(r){return [
 'REQUEST_ID='+r.requestId,
 'STATUS='+r.status,
 'CODE='+r.code,
 'TASK_RUN_REQUESTED='+r.taskRunRequested,
 'COLLECTOR_VERIFIED=false',
 'PROVIDER_CALLS='+r.providerCalls,
 'SQLITE_WRITES='+r.sqliteWrites,
 'D1_WRITES='+r.d1Writes,
 'RUN_ID='+r.runId,
 'NO_AUTOMATIC_REPLAY=true',''].join('\n');}
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
export async function publishR47TaskReceipt({event,env,raw,fetchApi=fetch}){
 const req=verifyEvent(event,env);
 need(typeof env.GITHUB_TOKEN==='string'&&env.GITHUB_TOKEN.length>=20,
  'R47_TASK_REPORT_TOKEN_STOP');
 let data=null;
 try{data=typeof raw==='string'&&Buffer.byteLength(raw)<=4096?
  JSON.parse(raw):null;}catch{}
 const out=sanitizeR47TaskResult(data,req,env);
 const headers={accept:'application/vnd.github+json',
  authorization:'Bearer '+env.GITHUB_TOKEN,
  'x-github-api-version':'2022-11-28','content-type':'application/json',
  'user-agent':'zgmini-r47-task-once'};
 let created=0,verified=0;
 for(const [ext,body] of [
  ['json',JSON.stringify(out,null,2)+'\n'],
  ['txt',asText(out)]]){
  const url='https://api.github.com/repos/'+REPO+
   '/contents/results/r47-task-once-'+req.requestId+'.'+ext;
  try{
   const r=await fetchApi(url,{method:'PUT',headers,
    body:JSON.stringify({message:'evidence: fixed R47 existing task one-shot request',
     content:Buffer.from(body).toString('base64')})});
   if(r.status===201)created++;
  }catch{}
  if(await readback(fetchApi,url,headers,body))verified++;
 }
 const status=verified===2?out.status:'STATE_UNKNOWN';
 const comment='<!-- w03-r47-task-once:'+req.requestId+' -->\n'+
  'Exact existing R47 Windows Task RUN request: '+status+' / '+out.code+
  '; JSON/TXT readback '+verified+'/2, created '+created+
  '/2; run '+out.runId+
  '; task registration unchanged; collection and DB status unverified; no replay.\n';
 const posted=await fetchApi('https://api.github.com/repos/'+REPO+
  '/issues/'+event.issue.number+'/comments',{method:'POST',headers,
   body:JSON.stringify({body:comment})});
 need(posted.status===201,'R47_TASK_REPORT_COMMENT_STOP');
 return {status,created,verified};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const env=process.env,event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
  let raw='{}';try{raw=fs.readFileSync(path.join(env.RUNNER_TEMP,
   'r47-existing-task-result.json'),'utf8');}catch{}
  const result=await publishR47TaskReceipt({event,env,raw});
  process.stdout.write('R47_TASK_REPORT '+result.status+' '+result.verified+'/2\n');
 }catch{
  process.stderr.write('R47_TASK_REPORT_STATE_UNKNOWN_NO_REPLAY\n');
  process.exitCode=1;
 }
}

#!/usr/bin/env node
// Create-only sanitized receipt for R179 7/10 guard minimal B patch.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {OP,REQUEST_SCHEMA,REPO,BEFORE_SHA} from './w03-r179-seven-readback-b.mjs';
const SHA64=/^[a-f0-9]{64}$/;
const SHA40=/^[a-f0-9]{40}$/;
const RUN=/^\d{1,18}$/;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const CODE=/^(?:W03_R179_B_|R17_B_)[A-Z0-9_]{3,100}$/;
const STATUSES=new Set(['SETUP_STOP','PREFLIGHT_STOP','STOP_RESTORED',
 'RECOVERY_REQUIRED','APPLIED_VERIFIED']);
const need=(condition,code)=>{if(!condition)throw Object.assign(Error(code),{code});};
export function sanitize(raw,request,env){
 const base={schema:'ZGMINI_W03_R179_GUARD_B_RESULT_V1',
  requestId:request.requestId,status:'STATE_UNKNOWN',
  code:'W03_R179_B_RESULT_UNVERIFIED',
  applied:false,changedFileCount:0,changedByteCount:0,
  backupVerified:false,sourceOnly:true,
  beforeSha256:null,afterSha256:null,
  controlSha:SHA40.test(env?.GITHUB_SHA??'')?env.GITHUB_SHA:null,
  runId:RUN.test(env?.GITHUB_RUN_ID??'')?env.GITHUB_RUN_ID:null,
  providerCalls:0,sqliteWrites:0,d1Writes:0,taskChanges:0,
  otherSourceWrites:0,retry:'NO_AUTOMATIC_REEXECUTION'};
 if(!raw||!STATUSES.has(raw.status)||!CODE.test(raw.code??'')||
  !(raw.requestId===request.requestId||
   raw.requestId===null&&raw.status==='SETUP_STOP'))return base;
 if(raw.status==='APPLIED_VERIFIED'){
  if(raw.applied!==true||raw.changedFileCount!==1||
   raw.changedByteCount!==-2||raw.backupVerified!==true||
   raw.beforeSha256!==BEFORE_SHA||!SHA64.test(raw.afterSha256??'')||
   raw.controlSha!==env.GITHUB_SHA||
   raw.manifestSha256!==request.approvalManifestSha256||
   raw.providerCalls!==0||raw.sqliteWrites!==0||raw.d1Writes!==0||
   raw.taskChanges!==0||raw.otherSourceWrites!==0)
   return base;
  return {...base,status:raw.status,code:raw.code,applied:true,
   changedFileCount:1,changedByteCount:-2,backupVerified:true,
   beforeSha256:raw.beforeSha256,afterSha256:raw.afterSha256};
 }
 return {...base,status:raw.status,code:raw.code,
  beforeSha256:raw.beforeSha256===BEFORE_SHA?BEFORE_SHA:null};
}
const asText=x=>[
 'REQUEST_ID='+x.requestId,'STATUS='+x.status,'CODE='+x.code,
 'RUN_ID='+(x.runId??'UNKNOWN'),'APPLIED='+x.applied,
 'BEFORE_SHA256='+(x.beforeSha256??'NONE'),
 'AFTER_SHA256='+(x.afterSha256??'NONE'),
 'CHANGED_FILE_COUNT='+x.changedFileCount,
 'CHANGED_BYTE_COUNT='+x.changedByteCount,
 'BACKUP_VERIFIED='+x.backupVerified,
 'PUBLISHER_EXECUTED=false','D1_WRITES=0',
 'PROVIDER_CALLS=0','RETRY='+x.retry,''].join('\n');
async function readback(fetchApi,url,headers,bytes){
 try{
  const r=await fetchApi(url+'?ref=main',{method:'GET',headers});
  if(r.status!==200)return false;
  const j=await r.json();
  return j?.encoding==='base64'&&typeof j.content==='string'&&
   Buffer.from(j.content.replace(/\s/g,''),'base64').equals(Buffer.from(bytes));
 }catch{return false;}
}
export async function publish({event,env,raw,fetchApi=fetch}){
 need(env?.GITHUB_REPOSITORY===REPO&&env.GITHUB_EVENT_NAME==='issues'&&
  env.GITHUB_EVENT_ACTION==='opened'&&env.GITHUB_ACTOR==='ansqhd5774-Choi'&&
  RUN.test(env.GITHUB_RUN_ID??'')&&typeof env.GITHUB_TOKEN==='string'&&
  env.GITHUB_TOKEN.length>=20&&event?.repository?.full_name===REPO&&
  event.repository.private===true&&
  event.issue?.title===OP&&event.issue.user?.login==='ansqhd5774-Choi'&&
  event.issue.labels?.some(x=>x.name==='pc-writer-b-install'),
  'W03_R179_B_REPORT_EVENT_DENIED');
 let req;try{req=JSON.parse(event.issue.body);}catch{}
 need(req?.schema===REQUEST_SCHEMA&&req?.operation===OP&&
  req.controlRepository===REPO&&
  UUID.test(req.requestId??'')&&
  SHA64.test(req.approvalManifestSha256??''),
  'W03_R179_B_REPORT_REQUEST_STOP');
 let item;try{item=typeof raw==='string'&&Buffer.byteLength(raw)<8192?
  JSON.parse(raw):null;}catch{item=null;}
 const result=sanitize(item,req,env);
 const headers={authorization:'Bearer '+env.GITHUB_TOKEN,
  accept:'application/vnd.github+json',
  'x-github-api-version':'2022-11-28',
  'content-type':'application/json','user-agent':'zgmini-r179-b-guard'};
 let created=0,verified=0;
 for(const [ext,bytes] of [['json',JSON.stringify(result,null,2)+'\n'],
  ['txt',asText(result)]]){
  const url='https://api.github.com/repos/'+REPO+
   '/contents/results/w03-r179-guard-b-'+req.requestId+'.'+ext;
  try{
   const v=await fetchApi(url,{method:'PUT',headers,
    body:JSON.stringify({message:'receipt: W03 pinned R179 seven readback B',
     content:Buffer.from(bytes).toString('base64')})});
   if(v.status===201)created++;
  }catch{/* ambiguous ACK cannot authorize another request */}
  if(await readback(fetchApi,url,headers,bytes))verified++;
 }
 const status=verified===2?result.status:'STATE_UNKNOWN';
 const msg='<!-- w03-r179-guard-b:'+req.requestId+' -->\n'+
  'W03 R179 readback guard B: '+status+' / '+result.code+
  ', applied='+result.applied+', JSON/TXT='+verified+'/2, created='+
  created+'/2, run='+result.runId+'. No automatic replay, D1 writes 0.\n';
 const posted=await fetchApi('https://api.github.com/repos/'+REPO+
  '/issues/'+event.issue.number+'/comments',{method:'POST',headers,
   body:JSON.stringify({body:msg})});
 need(posted.status===201,'W03_R179_B_REPORT_COMMENT_STOP');
 return {status,verified,created};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const env=process.env;
  const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
  let raw='{}';
  try{raw=fs.readFileSync(path.join(env.RUNNER_TEMP,
   'w03-r179-b-result.json'),'utf8');}catch{}
  const x=await publish({event,env,raw});
  process.stdout.write('W03_R179_GUARD_B_REPORT '+x.status+' '+x.verified+'/2\n');
 }catch{
  process.stderr.write('W03_R179_GUARD_B_REPORT_UNKNOWN_NO_REEXECUTION\n');
  process.exitCode=1;
 }
}
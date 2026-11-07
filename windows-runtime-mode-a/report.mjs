#!/usr/bin/env node
// Create-only, bounded JSON/TXT result receiver; token is never passed to A probe.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {A_RESULT,verifyARequest} from './run.mjs';

const REPO='ansqhd5774-Choi/zgmini-pc-control';
const ID=/^[0-9]{1,18}$/;
const SHA64=/^[a-f0-9]{64}$/;
const SHA40=/^[a-f0-9]{40}$/;
const KEY=/^[a-zA-Z][a-zA-Z0-9_-]{0,47}$/;
const CODE=/^A_RUNTIME_[A-Z0-9_]{1,100}$/;
const MODES=new Set(['FIRST_SINGLE_CMD_UPGRADE','REPEATABLE_ACTIVE_RUNTIME',
 'INSTALL_PREIMAGE_NOT_FOUND','INSTALL_PREIMAGE_UNVERIFIED',
 'ACTIVE_PREIMAGE_UNVERIFIED','STATE_UNKNOWN_CHANGED_DURING_READ',
 'STATE_UNKNOWN','NOT_APPLICABLE']);
const need=(ok,code)=>{if(!ok)throw Object.assign(new Error(code),{code});};
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const flag=x=>typeof x==='boolean'?x:null;
const bounded=(v,max=128)=>Number.isSafeInteger(v)&&v>=0&&v<=max?v:null;

function cleanFile(v){
 if(!plain(v)||typeof v.exists!=='boolean')return {exists:null,status:'UNVERIFIED'};
 const x={exists:v.exists};
 if(typeof v.status==='string'&&v.status==='SIZE_LIMIT')x.status='SIZE_LIMIT';
 if(v.exists&&SHA64.test(v.sha256??'')&&bounded(v.sizeBytes,8388608)!==null){
  x.sha256=v.sha256;x.sizeBytes=v.sizeBytes;
 }
 return x;
}
function cleanTask(v){
 if(!plain(v))return {status:'UNVERIFIED'};
 const statuses=new Set(['XML_READ','NOT_QUERIED','QUERY_UNAVAILABLE',
  'QUERY_INVALID_SIZE','QUERY_NO_ACTION']);
 const x={status:statuses.has(v.status)?v.status:'UNVERIFIED'};
 if(SHA64.test(v.xmlSha256??''))x.xmlSha256=v.xmlSha256;
 for(const k of ['enabled','expectedCommandPresent','expectedHourPresent'])
  if(typeof v[k]==='boolean'||v[k]===null)x[k]=v[k];
 return x;
}
function cleanProfile(p){
 if(!plain(p)||!KEY.test(p.profileId??''))return null;
 const out={profileId:p.profileId,status:p.status==='DONE'?'DONE':'BLOCKED',
  rootExists:flag(p.rootExists),runtimeMode:MODES.has(p.runtimeMode)?p.runtimeMode:'UNVERIFIED',
  files:{},tasks:{}};
 if(out.status==='BLOCKED'&&CODE.test(p.code??''))out.code=p.code;
 for(const [key,value] of Object.entries(plain(p.files)?p.files:{}))
  if(KEY.test(key)&&Object.keys(out.files).length<32)out.files[key]=cleanFile(value);
 for(const [key,value] of Object.entries(plain(p.tasks)?p.tasks:{}))
  if(KEY.test(key)&&Object.keys(out.tasks).length<4)out.tasks[key]=cleanTask(value);
 return out;
}
export function sanitizeAReport(raw,req,env){
 const fallback={schema:'ZGMINI_APPROVED_RUNTIME_A_RESULT_V1',
  requestId:req.requestId,status:'STATE_UNKNOWN',code:'A_RUNTIME_RESULT_UNVERIFIED',
  runId:ID.test(env?.GITHUB_RUN_ID??'')?env.GITHUB_RUN_ID:null,
  manifestSha256:req.approvalManifestSha256,sourceSha:req.sourceSha,
  fileHashesComplete:false,taskChecksComplete:false,
  operationalWrites:0,retry:'NO_AUTO_RETRY_READ_ONLY_RECONCILE',profiles:[]};
 if(!plain(raw)||raw.requestId!==req.requestId||
  !['DONE','BLOCKED'].includes(raw.status))return fallback;
 const blocked=raw.status==='BLOCKED';
 const blockedCode=CODE.test(raw.code??'')?raw.code:'A_RUNTIME_EXECUTION_STOP';
 const safeBlocked={...fallback,status:'BLOCKED',code:blockedCode};
 if(raw.schema!=='ZGMINI_APPROVED_RUNTIME_A_LOCAL_RESULT_V1'||
  raw.operationalWrites!==0||raw.providerCalls!==0||raw.d1Writes!==0||
  !SHA40.test(raw.controlSha??'')||!SHA64.test(raw.registrySha256??'')||
  raw.registrySha256!==req.approvalManifestSha256||
  raw.requestedSourceSha!==req.sourceSha||
  !Array.isArray(raw.profiles)||raw.profiles.length>4)
  return blocked?safeBlocked:fallback;
 const profiles=raw.profiles.map(cleanProfile);
 if(profiles.some(x=>x===null))return blocked?safeBlocked:fallback;
 const report={...fallback,status:blocked?'BLOCKED':'DONE',
  code:blocked?blockedCode:raw.code==='A_RUNTIME_FILE_AND_TASK_READONLY'?
   raw.code:'A_RUNTIME_PARTIAL',controlSha:raw.controlSha,
  fileHashesComplete:flag(raw.fileHashesComplete)===true,
  taskChecksComplete:flag(raw.taskChecksComplete)===true,
  registeredCount:bounded(raw.registeredCount),
  selectedCount:bounded(raw.selectedCount),profiles};
 return Buffer.byteLength(JSON.stringify(report))<=32768?report:fallback;
}
export function textAReport(r){
 return [`SCHEMA=${r.schema}`,`REQUEST_ID=${r.requestId}`,
  `STATUS=${r.status}`,`CODE=${r.code}`,`RUN_ID=${r.runId??'UNKNOWN'}`,
  `MANIFEST_SHA256=${r.manifestSha256}`,`SOURCE_SHA=${r.sourceSha}`,
  `FILE_HASHES_COMPLETE=${r.fileHashesComplete}`,
  `TASK_CHECKS_COMPLETE=${r.taskChecksComplete}`,
  `SELECTED_PROFILES=${r.selectedCount??0}`,
  `OPERATIONAL_WRITES=${r.operationalWrites}`,
  `RETRY=${r.retry}`,''].join('\n');
}
async function readback(fetchApi,url,headers,content){
 try{
  const r=await fetchApi(url+'?ref=main',{method:'GET',headers});
  if(r.status!==200)return false;
  const data=await r.json();
  return data?.encoding==='base64'&&Buffer.from(String(data.content??'')
   .replace(/\s/g,''),'base64').equals(Buffer.from(content));
 }catch{return false;}
}
export async function uploadAReport({event,env,rawResult,fetchApi=fetch}){
 const req=verifyARequest(event,env);
 need(typeof env.GITHUB_TOKEN==='string'&&env.GITHUB_TOKEN.length>=20&&
  ID.test(env.GITHUB_RUN_ID??''),'A_RUNTIME_REPORT_AUTH_STOP');
 let local;
 try{local=typeof rawResult==='string'&&Buffer.byteLength(rawResult)<=32768?
  JSON.parse(rawResult):null;}catch{local=null;}
 const r=sanitizeAReport(local,req,env);
 const headers={accept:'application/vnd.github+json',
  authorization:'Bearer '+env.GITHUB_TOKEN,
  'x-github-api-version':'2022-11-28','content-type':'application/json',
  'user-agent':'zgmini-approved-runtime-a-once'};
 let created=0,verified=0;
 for(const [ext,content] of [['json',JSON.stringify(r,null,2)+'\n'],
  ['txt',textAReport(r)]]){
  const url=`https://api.github.com/repos/${REPO}/contents/results/approved-runtime-a-${req.requestId}.${ext}`;
  try{
   const response=await fetchApi(url,{method:'PUT',headers,
    body:JSON.stringify({message:'chore(pc): record approved A inventory once',
     content:Buffer.from(content).toString('base64')})});
   if(response.status===201)created++;
  }catch{/* Ambiguous delivery: read-only reconcile, never re-execute. */}
  if(await readback(fetchApi,url,headers,content))verified++;
 }
 const delivery=verified===2?'RESULT_PAIR_READBACK_VERIFIED':'RESULT_PAIR_UNVERIFIED';
 const finalStatus=verified===2?r.status:'STATE_UNKNOWN';
 const comment=`<!-- approved-runtime-a:${req.requestId} -->\n`+
  `Approved A inventory: **${finalStatus}** (${r.code})\n`+
  `Results: ${verified}/2 readback, ${created}/2 create-only, ${delivery}\n`+
  `Run: ${r.runId??'UNKNOWN'}; no operational writes; no auto retry.\n`;
 const response=await fetchApi(`https://api.github.com/repos/${REPO}/issues/${event.issue.number}/comments`,
  {method:'POST',headers,body:JSON.stringify({body:comment})});
 need(response.status===201,'A_RUNTIME_REPORT_COMMENT_STOP');
 return {status:finalStatus,delivery,created,verified};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const env=process.env,event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
  let local;try{local=fs.readFileSync(path.join(env.RUNNER_TEMP,A_RESULT),'utf8');}
  catch{local='';}
  const result=await uploadAReport({event,env,rawResult:local});
  console.log(`A_RUNTIME_REPORT ${result.delivery} ${result.verified}/2`);
 }catch{
  console.error('A_RUNTIME_REPORT_UNVERIFIED_READ_ONLY_RECONCILE');
  process.exitCode=1;
 }
}

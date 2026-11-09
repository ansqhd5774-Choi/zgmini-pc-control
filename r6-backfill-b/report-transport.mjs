#!/usr/bin/env node
// GitHub-only R6 B one-shot result transport. The trusted Windows host never
// receives GITHUB_TOKEN; this reporter never imports a collector/DB adapter.
// Result delivery is separate from provider/SQLite execution state.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {R6_ONE_SHOT} from './contract.mjs';
import {sanitizeR6BackfillResult} from './report.mjs';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SHA40=/^[a-f0-9]{40}$/;
const SHA64=/^[a-f0-9]{64}$/;
const RUN=/^\d{1,18}$/;
const CODE=/^R6_B_[A-Z0-9_]{1,92}$/;
const GOOD=new Set(['SUCCESS','PARTIAL','FAIL','NOOP']);
const need=(ok,code)=>{if(!ok)throw Object.assign(Error(code),{code});};
const safeCode=x=>CODE.test(x??'')?x:'R6_B_RESULT_UNVERIFIED_STOP';

export function validateR6BReportEvent(event,env){
 need(env?.GITHUB_REPOSITORY===R6_ONE_SHOT.repository&&
  env.GITHUB_EVENT_NAME==='issues'&&env.GITHUB_EVENT_ACTION==='opened'&&
  env.GITHUB_ACTOR===R6_ONE_SHOT.owner&&env.GITHUB_RUN_ATTEMPT==='1'&&
  SHA40.test(env.GITHUB_SHA??'')&&RUN.test(env.GITHUB_RUN_ID??'')&&
  event?.action==='opened'&&event.repository?.full_name===R6_ONE_SHOT.repository&&
  event.repository.private===true&&event.sender?.login===R6_ONE_SHOT.owner&&
  event.issue?.user?.login===R6_ONE_SHOT.owner&&
  event.issue?.title===R6_ONE_SHOT.issueTitle&&
  event.issue?.labels?.some(x=>x?.name===R6_ONE_SHOT.issueLabel)&&
  Number.isSafeInteger(event.issue.number)&&event.issue.number>0&&
  !event.issue.pull_request,'R6_B_REPORT_EVENT_STOP');
 let req;
 try{req=JSON.parse(event.issue.body);}catch{need(false,'R6_B_REPORT_REQUEST_JSON_STOP');}
 const keys=['approvalManifestSha256','chatId','controlSha','operation','requestId','schema','sourceSha'];
 need(req&&typeof req==='object'&&!Array.isArray(req)&&
  Object.keys(req).sort().join('|')===keys.sort().join('|')&&
  req.schema===R6_ONE_SHOT.schema&&req.operation==='employment-r6-backfill-once'&&
  UUID.test(req.requestId??'')&&UUID.test(req.chatId??'')&&
  SHA40.test(req.sourceSha??'')&&SHA40.test(req.controlSha??'')&&
  SHA64.test(req.approvalManifestSha256??''),'R6_B_REPORT_REQUEST_STOP');
 // This checks transport identity only; approval pins and actual B authority
 // are validated independently by the pinned Windows host before any effect.
 return req;
}

export function sanitizeR6BTransportResult(raw,requestId,runId){
 const base={schema:'ZGMINI_R6_BACKFILL_B_RESULT_V1',requestId,
  status:'STATE_UNKNOWN',code:'R6_B_RESULT_UNVERIFIED_STOP',
  providerRequests:null,blsRequests:null,dolRequests:null,groupResults:[],
  d1Writes:null,schedulerWrites:null,effectsVerified:false,
  runId:RUN.test(runId??'')?runId:null,retry:'NO_AUTO_RETRY'};
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||raw.requestId!==requestId)
  return base;
 if((raw.schema==='ZGMINI_R6_B_WINDOWS_HOST_V1'||
  raw.schema==='ZGMINI_R6_BACKFILL_B_RESULT_V1')&&
  raw.status==='BLOCKED'&&CODE.test(raw.code??'')&&
  raw.effectsVerified!==true&&raw.allowProviderCalls!==true&&
  raw.allowDbWrites!==true&&raw.providerRequests!==undefined&&
  [0,null].includes(raw.providerRequests)){
  return {...base,status:'BLOCKED',code:raw.code,providerRequests:raw.providerRequests};
 }
 if(raw.schema!=='ZGMINI_R6_BACKFILL_B_RESULT_V1'||
  !GOOD.has(raw.status)||raw.effectsVerified!==true||
  !CODE.test(raw.code??''))return base;
 const reviewed=sanitizeR6BackfillResult({
  requestId,status:raw.status,failureCode:raw.code,
  groupResults:raw.groupResults,providerRequests:raw.providerRequests,
  blsRequests:raw.blsRequests,dolRequests:raw.dolRequests,
  d1Writes:raw.d1Writes,schedulerWrites:raw.schedulerWrites,
 });
 if(reviewed.status!==raw.status||reviewed.effectsVerified!==true)return base;
 return {...base,...reviewed,runId:base.runId,retry:'NO_AUTO_RETRY'};
}

export function readR6BLocalResult({env,io=fs}={}){
 const temp=env?.RUNNER_TEMP;
 if(typeof temp!=='string'||!path.isAbsolute(temp))return '{}';
 try{
  const raw=io.readFileSync(path.join(temp,'r6-b-result.json'),'utf8');
  return Buffer.byteLength(raw)<=8192?raw:'{}';
 }catch{return '{}';}
}

function txtResult(r){
 return [
  `REQUEST_ID=${r.requestId}`,`STATUS=${r.status}`,`CODE=${r.code}`,
  `PROVIDER_REQUESTS=${r.providerRequests??'UNKNOWN'}`,
  `BLS_REQUESTS=${r.blsRequests??'UNKNOWN'}`,
  `DOL_REQUESTS=${r.dolRequests??'UNKNOWN'}`,
  `EFFECTS_VERIFIED=${r.effectsVerified===true?'true':'false'}`,
  `D1_WRITES=${r.d1Writes??'UNKNOWN'}`,
  `SCHEDULER_WRITES=${r.schedulerWrites??'UNKNOWN'}`,
  `RUN_ID=${r.runId??'UNKNOWN'}`,'RETRY=NO_AUTO_RETRY','',
 ].join('\n');
}

export async function uploadR6BReport({event,env,rawResult,
 apiFetch=fetch,atomicUpload}={}){
 const request=validateR6BReportEvent(event,env);
 need(typeof env.GITHUB_TOKEN==='string'&&env.GITHUB_TOKEN.length>=20,
  'R6_B_REPORT_TOKEN_STOP');
 let parsed=null;
 try{
  if(typeof rawResult==='string'&&Buffer.byteLength(rawResult)<=8192)
   parsed=JSON.parse(rawResult);
 }catch{/* Retain STATE_UNKNOWN. */}
 const result=sanitizeR6BTransportResult(parsed,request.requestId,env.GITHUB_RUN_ID);
 const basename=`results/employment-r6-backfill-${request.requestId}`;
 const outputs=[[`${basename}.json`,JSON.stringify(result,null,2)+'\n'],
  [`${basename}.txt`,txtResult(result)]];
 const headers={accept:'application/vnd.github+json',
  authorization:`Bearer ${env.GITHUB_TOKEN}`,
  'x-github-api-version':'2022-11-28','content-type':'application/json',
  'user-agent':'zgmini-employment-r6-b-one-shot'};
 // Reuse the existing verified single-commit CAS pair publisher. Never put a
 // token in the host step and never retry an uncertain remote write.
 const uploader=atomicUpload??(await import('../writer-config-b/result-pair-atomic.mjs'))
  .uploadResultPairAtomic;
 const posted=await uploader({outputs,headers,fetchApi:apiFetch,
  message:'chore(employment-r6): record bounded B one-shot result'});
 const verified=posted?.verified===2&&
  posted.delivery==='RESULT_PAIR_READBACK_VERIFIED';
 const publicStatus=verified?result.status:'STATE_UNKNOWN';
 const publicCode=verified?result.code:'R6_B_RESULT_PAIR_UNVERIFIED_STOP';
 const comment=`<!-- zgmini-r6-b:${request.requestId} -->\n`+
  `Employment R6 B evidence: **${publicStatus}** (${publicCode})\n`+
  `DELIVERY: ${posted?.delivery??'RESULT_PAIR_UNVERIFIED'}\n`+
  `RESULT_CREATED: ${posted?.created??'UNKNOWN'}/2; `+
  `RESULT_READBACK: ${posted?.verified??'UNKNOWN'}/2\n`+
  `RUN_ID: ${result.runId??'UNKNOWN'}; RETRY: NO_AUTO_RETRY\n`;
 const reply=await apiFetch(
  `https://api.github.com/repos/${R6_ONE_SHOT.repository}/issues/`+
  `${event.issue.number}/comments`,{method:'POST',headers,
   body:JSON.stringify({body:comment})});
 need(reply?.status===201,'R6_B_REPORT_COMMENT_UNVERIFIED_STOP');
 return {status:publicStatus,code:publicCode,
  delivery:posted?.delivery??'RESULT_PAIR_UNVERIFIED',
  created:posted?.created??null,verified:posted?.verified??0};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const env=process.env;
  const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
  const rawResult=readR6BLocalResult({env});
  const result=await uploadR6BReport({event,env,rawResult});
  process.stdout.write(`R6_B_REPORT ${result.delivery} `+
   `CREATED=${result.created}/2 READBACK=${result.verified}/2\n`);
 }catch{
  process.stderr.write('R6_B_REPORT_UNVERIFIED_READ_ONLY_RECONCILE\n');
  process.exitCode=1;
 }
}

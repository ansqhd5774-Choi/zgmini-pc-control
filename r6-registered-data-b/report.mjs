#!/usr/bin/env node
// BLS registered R6 one-shot evidence: create-only remote JSON/TXT and one
// originating Issue comment. This reporter cannot execute provider or DB work.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {R6_B_REPO,R6_B_TITLE,R6_B_LABEL,R6_B_SCHEMA,R6_B_RESULT} from './operation.mjs';

const OWNER='ansqhd5774-Choi';
const REQUEST_OPERATION='employment-r6-registered-data-once';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const SHA40=/^[a-f0-9]{40}$/i;
const SHA64=/^[a-f0-9]{64}$/i;
const RUN=/^\d{1,18}$/;
// The installed R6/D1 helpers may return bounded standard error codes too.
const CODE=/^[A-Z][A-Z0-9_]{0,95}$/;
const GROUPS=new Set(['BLS_EMPLOYMENT_SITUATION','BLS_JOLTS','BLS_ECI',
 'BLS_STATE_MSA','BLS_BED','DOL_UI_WEEKLY_CLAIMS']);
const GROUP_STATUS=new Set(['SUCCESS','PARTIAL','FAIL','SKIPPED_BLS_BUDGET','SKIPPED_LOCKED']);
const STATUSES=new Set(['SUCCESS','PARTIAL','NOOP','BLOCKED','STATE_UNKNOWN']);
const stop=code=>{throw Object.assign(new Error(code),{code});};
const need=(yes,code)=>{if(!yes)stop(code);};

export function validateR6BReportEvent(event,env){
 need(env?.GITHUB_REPOSITORY===R6_B_REPO&&env.GITHUB_EVENT_NAME==='issues'&&
  env.GITHUB_EVENT_ACTION==='opened'&&env.GITHUB_ACTOR===OWNER&&
  env.GITHUB_RUN_ATTEMPT==='1'&&SHA40.test(env.GITHUB_SHA??'')&&
  event?.action==='opened'&&event.repository?.full_name===R6_B_REPO&&
  event.repository.private===true&&event.sender?.login===OWNER&&
  event.issue?.user?.login===OWNER&&!event.issue.pull_request&&
  event.issue?.title===R6_B_TITLE&&
  event.issue.labels?.some(x=>x.name===R6_B_LABEL)&&
  Number.isSafeInteger(event.issue.number)&&event.issue.number>0,
 'R6_B_REPORT_EVENT_STOP');
 let request;
 try{request=JSON.parse(event.issue.body);}catch{stop('R6_B_REPORT_JSON_STOP');}
 need(request&&typeof request==='object'&&!Array.isArray(request)&&
  Object.keys(request).sort().join('|')===
   ['schema','requestId','chatId','operation','approvalManifestSha256'].sort().join('|')&&
  request.schema===R6_B_SCHEMA&&request.operation===REQUEST_OPERATION&&
  UUID.test(request.requestId??'')&&UUID.test(request.chatId??'')&&
  SHA64.test(request.approvalManifestSha256??''),'R6_B_REPORT_REQUEST_STOP');
 return request;
}

function safeGroups(rows){
 if(!Array.isArray(rows)||rows.length>6)return null;
 const seen=new Set();
 const result=[];
 for(const row of rows){
  if(!row||typeof row!=='object'||Array.isArray(row)||
   !GROUPS.has(row.groupName)||seen.has(row.groupName)||
   !GROUP_STATUS.has(row.status)||
   !Number.isSafeInteger(row.providerRequests)||row.providerRequests<0||
   row.providerRequests>16)return null;
  seen.add(row.groupName);
  if(row.failureCode!=null&&!/^([A-Z][A-Z0-9_]{0,95})$/.test(row.failureCode))return null;
  result.push({groupName:row.groupName,status:row.status,
   providerRequests:row.providerRequests,
   ...(row.failureCode?{failureCode:row.failureCode}:{})});
 }
 return result;
}

export function sanitizeR6BResult(raw,request,env){
 const base={schema:'ZGMINI_R6_REGISTERED_DATA_B_RESULT_V1',
  requestId:request.requestId,approvalManifestSha256:request.approvalManifestSha256,
  status:'STATE_UNKNOWN',code:'R6_B_RESULT_UNVERIFIED_STOP',
  sourceSha:null,mode:null,providerRequests:null,blsRequests:null,
  dolRequests:null,groupResults:[],sqlite:'UNVERIFIED',publication:'UNVERIFIED',
  sourceStoredAt:null,sourceFeatures:null,chartReadyFeatures:null,
  lastPass:null,firstFail:null,
  runId:RUN.test(env?.GITHUB_RUN_ID??'')?env.GITHUB_RUN_ID:null,
  retry:'READ_EXISTING_REQUEST_NO_REEXECUTE'};
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||
  !STATUSES.has(raw.status)||!CODE.test(raw.code??'')||
  (raw.requestId!==request.requestId&&
   !(raw.status==='BLOCKED'&&raw.requestId==null)))return base;
 const simple={...base,status:raw.status,code:raw.code,
  lastPass:['SOURCE_VERIFIED','REGISTERED_KEY_PRESENT','ONE_SHOT_CLAIMED',
   'PUBLISH_READBACK'].includes(raw.lastPass)?raw.lastPass:null,
  firstFail:['PREFLIGHT','COLLECT_OR_PUBLISH','CORE_LOCK_RELEASE']
   .includes(raw.firstFail)?raw.firstFail:null};
 if(!['SUCCESS','PARTIAL','NOOP'].includes(raw.status))return simple;
 const sourceOk=SHA40.test(raw.sourceSha??'');
 const validCount=x=>Number.isSafeInteger(x)&&x>=0;
 const groups=safeGroups(raw.groupResults);
 const modeOk=['ONE_YEAR','BACKFILL'].includes(raw.mode);
 const blsCap=raw.mode==='ONE_YEAR'?7:14;
 if(!sourceOk||!modeOk||!validCount(raw.providerRequests)||
  !validCount(raw.blsRequests)||!validCount(raw.dolRequests)||
  raw.blsRequests>blsCap||raw.dolRequests>2||
  raw.providerRequests!==raw.blsRequests+raw.dolRequests||!groups||
  groups.reduce((sum,g)=>sum+g.providerRequests,0)!==raw.providerRequests)return base;
 if(raw.status==='NOOP'){
  if(raw.code!=='R6_B_ALREADY_COLLECTED'||raw.providerRequests!==0||
   raw.sqlite!=='UNCHANGED'||raw.publication!=='NOT_ATTEMPTED')return base;
  return {...simple,sourceSha:raw.sourceSha,mode:raw.mode,
   providerRequests:0,blsRequests:0,dolRequests:0,
   groupResults:groups,sqlite:'UNCHANGED',publication:'NOT_ATTEMPTED'};
 }
 const validNumber=x=>Number.isSafeInteger(x)&&x>=0&&x<=100000;
 if(!((raw.status==='SUCCESS'&&raw.code==='R6_B_COLLECT_PUBLISH_VERIFIED')||
   (raw.status==='PARTIAL'&&raw.code==='R6_B_PARTIAL_PUBLISH_VERIFIED'))||
  raw.sqlite!=='COLLECTOR_RECORDED'||
  !['VERIFIED','UNCHANGED'].includes(raw.publication)||
  !validNumber(raw.sourceFeatures)||!validNumber(raw.chartReadyFeatures)||
  raw.chartReadyFeatures>raw.sourceFeatures||raw.sourceFeatures>100||
  !(Number.isSafeInteger(raw.sourceStoredAt)&&raw.sourceStoredAt>0))return base;
 return {...simple,sourceSha:raw.sourceSha,mode:raw.mode,
  providerRequests:raw.providerRequests,blsRequests:raw.blsRequests,
  dolRequests:raw.dolRequests,groupResults:groups,
  sqlite:'COLLECTOR_RECORDED',publication:raw.publication,
  sourceStoredAt:raw.sourceStoredAt,
  sourceFeatures:raw.sourceFeatures,chartReadyFeatures:raw.chartReadyFeatures};
}

export function r6BTextResult(result){return [
 `REQUEST_ID=${result.requestId}`,
 `STATUS=${result.status}`,
 `CODE=${result.code}`,
 `APPROVAL_MANIFEST_SHA256=${result.approvalManifestSha256}`,
 `SOURCE_SHA=${result.sourceSha??'UNVERIFIED'}`,
 `MODE=${result.mode??'UNVERIFIED'}`,
 `PROVIDER_REQUESTS=${result.providerRequests??'UNVERIFIED'}`,
 `BLS_REQUESTS=${result.blsRequests??'UNVERIFIED'}`,
 `DOL_REQUESTS=${result.dolRequests??'UNVERIFIED'}`,
 `SQLITE=${result.sqlite}`,
 `PUBLICATION=${result.publication}`,
 `SOURCE_STORED_AT=${result.sourceStoredAt??'UNVERIFIED'}`,
 `SOURCE_FEATURES=${result.sourceFeatures??'UNVERIFIED'}`,
 `CHART_READY_FEATURES=${result.chartReadyFeatures??'UNVERIFIED'}`,
 `LAST_PASS=${result.lastPass??'UNVERIFIED'}`,
 `FIRST_FAIL=${result.firstFail??'NONE'}`,
 `RUN_ID=${result.runId??'UNVERIFIED'}`,
 'RETRY=READ_EXISTING_REQUEST_NO_REEXECUTE','',
].join('\n');}

export async function deliverR6BReport({event,env,rawResult,fetchApi=fetch,
 pairUploader=async args=>(await import('../writer-config-b/result-pair-atomic.mjs'))
  .uploadResultPairAtomic(args)}={}){
 const request=validateR6BReportEvent(event,env);
 need(typeof env.GITHUB_TOKEN==='string'&&env.GITHUB_TOKEN.length>=20&&
  RUN.test(env.GITHUB_RUN_ID??''),'R6_B_REPORT_AUTH_STOP');
 let parsed=null;
 try{if(typeof rawResult==='string'&&Buffer.byteLength(rawResult)<8192)
   parsed=JSON.parse(rawResult);}catch{/* preserve STATE_UNKNOWN */}
 const result=sanitizeR6BResult(parsed,request,env);
 const headers={accept:'application/vnd.github+json',
  authorization:`Bearer ${env.GITHUB_TOKEN}`,
  'x-github-api-version':'2022-11-28','content-type':'application/json',
  'user-agent':'zgmini-r6-registered-data-b-once'};
 const prefix=`results/employment-r6-registered-${request.requestId}`;
 const pair=await pairUploader({fetchApi,headers,
  message:'chore(r6): record one-shot registered BLS evidence',
  outputs:[[prefix+'.json',JSON.stringify(result,null,2)+'\n'],
   [prefix+'.txt',r6BTextResult(result)]]});
 const verified=pair?.verified===2?2:0;
 const status=verified===2?result.status:'STATE_UNKNOWN';
 const delivery=verified===2?'RESULT_PAIR_READBACK_VERIFIED':
  (typeof pair?.delivery==='string'&&/^[A-Z0-9_]{1,100}$/.test(pair.delivery)?
   pair.delivery:'RESULT_PAIR_UNVERIFIED');
 const body=`<!-- r6-registered-data-b:${request.requestId} -->\n`+
  `R6 BLS registered data one-shot: **${status}** `+
  `(${verified===2?result.code:'R6_B_RESULT_DELIVERY_UNVERIFIED'})\n`+
  `DELIVERY: ${delivery}; CREATED: ${pair?.created??'UNKNOWN'}/2; `+
  `READBACK: ${verified}/2\n`+
  `RUN_ID: ${result.runId??'UNKNOWN'}; NO_REEXECUTE\n`;
 const res=await fetchApi(`https://api.github.com/repos/${R6_B_REPO}/issues/`+
  `${event.issue.number}/comments`,{method:'POST',headers,
  body:JSON.stringify({body})});
 need(res?.status===201,'R6_B_REPORT_COMMENT_STOP');
 return {status,delivery,created:pair?.created??null,verified};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const env=process.env;
  const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
  let rawResult='{}';
  try{rawResult=fs.readFileSync(path.join(env.RUNNER_TEMP,R6_B_RESULT),'utf8');}
  catch{/* setup stop: do not claim B provider execution */}
  const done=await deliverR6BReport({event,env,rawResult});
  process.stdout.write(`R6_B_REPORT ${done.delivery} ${done.verified}/2\n`);
  if(done.verified!==2)process.exitCode=1;
 }catch{
  process.stderr.write('R6_B_REPORT_UNVERIFIED_READ_ONLY_RECONCILE\n');
  process.exitCode=1;
 }
}

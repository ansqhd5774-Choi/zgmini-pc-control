#!/usr/bin/env node
// Create-only sanitized B result delivery. Token is confined to this process.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {ACTOR,CONTROL_REPOSITORY,REQUEST_SCHEMA,TITLE,LABEL,OPERATION,
 authorizeRequest} from './contract.mjs';
import {uploadResultPairAtomic} from './result-pair-atomic.mjs';

const CODE=/^CONFIG_B_[A-Z0-9_]{1,100}$/;
const SHA40=/^[0-9a-f]{40}$/i;
const SHA64=/^[0-9a-f]{64}$/i;
const RUN=/^\d{1,18}$/;
const STATUS=new Set(['CONFIG_B_APPLIED_VERIFIED','CONFIG_B_SETUP_STOP',
 'CONFIG_B_PREFLIGHT_STOP','CONFIG_B_STOP_UNTOUCHED',
 'CONFIG_B_STOP_RESTORED','CONFIG_B_RECOVERY_REQUIRED']);
const KEYS=['employmentR6AutoCollection','employmentR6OneYearAutoPublication'];
const stop=code=>{throw Object.assign(new Error(code),{code});};
const need=(ok,code)=>{if(!ok)stop(code);};

export function validateReportEvent(event,env){
 need(env?.GITHUB_REPOSITORY===CONTROL_REPOSITORY&&
  env.GITHUB_EVENT_NAME==='issues'&&env.GITHUB_EVENT_ACTION==='opened'&&
  env.GITHUB_ACTOR===ACTOR&&env.GITHUB_RUN_ATTEMPT==='1'&&
  event?.repository?.full_name===CONTROL_REPOSITORY&&
  event.repository.private===true&&event.sender?.login===ACTOR&&
  event.issue?.user?.login===ACTOR&&event.issue?.title===TITLE&&
  event.issue?.labels?.some(x=>x.name===LABEL)&&
  Number.isSafeInteger(event.issue.number)&&event.issue.number>0,
 'CONFIG_B_REPORT_EVENT_AUTH_STOP');
 const request=authorizeRequest(event);
 need(request.operation===OPERATION&&request.schema===REQUEST_SCHEMA,
 'CONFIG_B_REPORT_REQUEST_STOP');
 return request;
}

export function sanitizeReport(raw,request,env){
 const base={schema:'ZGMINI_WRITER_CONFIG_B_RESULT_V1',requestId:request.requestId,
  status:'CONFIG_B_STATE_UNKNOWN',code:'CONFIG_B_RESULT_UNVERIFIED_STOP',
  manifestSha256:request.approvalManifestSha256,controlSha:null,
  beforeSha256:null,afterSha256:null,backupVerified:false,
  changedKeys:[],installedSourceSha:null,verifiedInstalledFiles:0,
  runId:RUN.test(env?.GITHUB_RUN_ID??'')?env.GITHUB_RUN_ID:null,
  retry:'NO_REEXECUTE_READ_ONLY_RECONCILE'};
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||
  !STATUS.has(raw.status)||!CODE.test(raw.code??'')||
  (raw.requestId!==request.requestId&&
   !(raw.status==='CONFIG_B_SETUP_STOP'&&raw.requestId===null)))return base;
 if(raw.status==='CONFIG_B_APPLIED_VERIFIED'){
  const changed=raw.changedKeys;
  const validKeys=Array.isArray(changed)&&changed.length<=2&&
   changed.every((x,i)=>KEYS.includes(x)&&changed.indexOf(x)===i)&&
   changed.every((x,i)=>i===0||KEYS.indexOf(changed[i-1])<KEYS.indexOf(x));
  const isNoop=raw.code==='CONFIG_B_ALREADY_SET'&&changed?.length===0&&
   raw.backupVerified===false&&raw.beforeSha256===raw.afterSha256;
  const isChange=raw.code==='CONFIG_B_OPTINS_SET'&&
   changed?.length>=1&&raw.backupVerified===true;
  if(!validKeys||!(isNoop||isChange)||
   raw.manifestSha256!==request.approvalManifestSha256||
   !SHA40.test(raw.controlSha??'')||
   !SHA40.test(raw.installedSourceSha??'')||
   raw.verifiedInstalledFiles!==19||
   !SHA64.test(raw.beforeSha256??'')||
   !SHA64.test(raw.afterSha256??''))return base;
  return {...base,status:raw.status,code:raw.code,
   controlSha:raw.controlSha,installedSourceSha:raw.installedSourceSha,
   verifiedInstalledFiles:19,changedKeys:[...changed],
   beforeSha256:raw.beforeSha256,afterSha256:raw.afterSha256,
   backupVerified:raw.backupVerified};
 }
 return {...base,status:raw.status,code:raw.code};
}

function textReport(r){return [
 `REQUEST_ID=${r.requestId}`,`STATUS=${r.status}`,`CODE=${r.code}`,
 `CONTROL_SHA=${r.controlSha??'UNKNOWN'}`,
 `MANIFEST_SHA256=${r.manifestSha256}`,
 `CHANGED_KEY_NAMES=${r.changedKeys.join(',')||'NONE'}`,
 `BEFORE_SHA256=${r.beforeSha256??'UNKNOWN'}`,
 `AFTER_SHA256=${r.afterSha256??'UNKNOWN'}`,
 `BACKUP_VERIFIED=${r.backupVerified}`,
 `INSTALLED_SOURCE_SHA=${r.installedSourceSha??'UNKNOWN'}`,
 `VERIFIED_R6_FILES=${r.verifiedInstalledFiles}`,
 `RUN_ID=${r.runId??'UNKNOWN'}`,
 'RETRY=NO_REEXECUTE_READ_ONLY_RECONCILE','',
].join('\n');}

export async function uploadReport({event,env,rawResult,fetchApi=fetch}){
 const request=validateReportEvent(event,env);
 need(typeof env.GITHUB_TOKEN==='string'&&env.GITHUB_TOKEN.length>=20&&
  RUN.test(env.GITHUB_RUN_ID??''),'CONFIG_B_REPORT_AUTH_STOP');
 let parsed;
 try{parsed=typeof rawResult==='string'&&Buffer.byteLength(rawResult)<4096?
  JSON.parse(rawResult):null;}catch{parsed=null;}
 const report=sanitizeReport(parsed,request,env);
 const headers={accept:'application/vnd.github+json',
  authorization:'Bearer '+env.GITHUB_TOKEN,
  'x-github-api-version':'2022-11-28','content-type':'application/json',
  'user-agent':'zgmini-writer-config-b-once'};
 const prefix=`results/writer-config-b-${request.requestId}`;
 const pair=await uploadResultPairAtomic({fetchApi,headers,
  message:'chore(config-b): one-shot sanitized result pair',
  outputs:[[prefix+'.json',JSON.stringify(report,null,2)+'\n'],
   [prefix+'.txt',textReport(report)]]});
 const {created,verified}=pair;
 const delivery=verified===2?'RESULT_PAIR_READBACK_VERIFIED':
  'RESULT_DELIVERY_UNVERIFIED';
 const status=verified===2?report.status:'CONFIG_B_STATE_UNKNOWN';
 const comment=`<!-- writer-config-b:${request.requestId} -->\n`+
  `Writer config B evidence: **${status}** (${verified===2?report.code:'RESULT_PAIR_UNVERIFIED'})\n`+
  `DELIVERY: ${delivery}; CREATED: ${created}/2; READBACK: ${verified}/2\n`+
  `RUN_ID: ${report.runId??'UNKNOWN'}; NO_REEXECUTE\n`;
 const res=await fetchApi(`https://api.github.com/repos/${CONTROL_REPOSITORY}/issues/`+
  `${event.issue.number}/comments`,{method:'POST',headers,
   body:JSON.stringify({body:comment})});
 need(res.status===201,'CONFIG_B_REPORT_COMMENT_STOP');
 return {status,delivery,created,verified};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const env=process.env;
  const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
  const file=path.join(env.RUNNER_TEMP,'writer-config-b-result.json');
  const raw=fs.readFileSync(file,'utf8');
  const done=await uploadReport({event,env,rawResult:raw});
  process.stdout.write(`CONFIG_B_REPORT ${done.delivery} ${done.verified}/2\n`);
 }catch{
  process.stderr.write('CONFIG_B_REPORT_UNVERIFIED_READ_ONLY_RECONCILE\n');
  process.exitCode=1;
 }
}

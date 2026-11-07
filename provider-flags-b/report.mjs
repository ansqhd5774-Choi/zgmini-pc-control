#!/usr/bin/env node
// GitHub token lives only in this sanitized create-only reporter step.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {ACTOR,CONTROL_REPO,RESULT_SCHEMA,flagProfileForPath,issueRequest,verifyEvent} from './contract.mjs';

const stop=code=>{throw Object.assign(new Error(code),{code});};
const need=(ok,code)=>{if(!ok)stop(code);};
const SHA40=/^[a-f0-9]{40}$/i;
const SHA64=/^[a-f0-9]{64}$/i;
const CODE=/^PROVIDER_B_[A-Z0-9_]{1,100}$/;
const RUN=/^\d{1,18}$/;
const STATUS=new Set(['PROVIDER_B_APPLIED_VERIFIED','PROVIDER_B_SETUP_STOP',
  'PROVIDER_B_PREFLIGHT_STOP','PROVIDER_B_STOP_UNTOUCHED',
  'PROVIDER_B_STOP_RESTORED',
  'PROVIDER_B_RECOVERY_REQUIRED']);

export function sanitizeReport(raw,request,env){
  const base={schema:RESULT_SCHEMA,requestId:request.requestId,
    status:'PROVIDER_B_STATE_UNKNOWN',code:'PROVIDER_B_RESULT_UNVERIFIED_STOP',
    changedKeys:[],manifestSha256:request.approvalManifestSha256,
    controlSha:null,beforeSha256:null,afterSha256:null,backupVerified:false,
    runId:RUN.test(env?.GITHUB_RUN_ID??'')?env.GITHUB_RUN_ID:null,
    retry:'NO_REEXECUTE_READ_ONLY_RECONCILE'};
  if(!raw||typeof raw!=='object'||Array.isArray(raw)||!STATUS.has(raw.status)||
    !CODE.test(raw.code??''))return base;
  if(raw.requestId!==request.requestId&&
    !(raw.status==='PROVIDER_B_SETUP_STOP'&&raw.requestId===null))return base;
  if(raw.status==='PROVIDER_B_APPLIED_VERIFIED'){
    const flags=flagProfileForPath(request.approvalManifestPath)?.flags;
    if(!flags||!['PROVIDER_B_TWO_FLAGS_SET','PROVIDER_B_ALREADY_SET'].includes(raw.code)||
      raw.changedKeys?.length!==2||
      !flags.every((key,i)=>raw.changedKeys[i]===key)||
      raw.manifestSha256!==request.approvalManifestSha256||
      !SHA40.test(raw.controlSha??'')||
      !SHA64.test(raw.beforeSha256??'')||!SHA64.test(raw.afterSha256??'')||
      raw.backupVerified!==true)return base;
    return {...base,status:raw.status,code:raw.code,
      changedKeys:[...flags],controlSha:raw.controlSha,
      beforeSha256:raw.beforeSha256,afterSha256:raw.afterSha256,
      backupVerified:true};
  }
  return {...base,status:raw.status,code:raw.code};
}

function textReport(r){return [
  `REQUEST_ID=${r.requestId}`,`STATUS=${r.status}`,`CODE=${r.code}`,
  `CHANGED_KEY_NAMES=${r.changedKeys.join(',')||'NONE'}`,
  `CONTROL_SHA=${r.controlSha??'UNKNOWN'}`,
  `MANIFEST_SHA256=${r.manifestSha256}`,
  `BEFORE_SHA256=${r.beforeSha256??'UNKNOWN'}`,
  `AFTER_SHA256=${r.afterSha256??'UNKNOWN'}`,
  `BACKUP_VERIFIED=${r.backupVerified}`,
  `RUN_ID=${r.runId??'UNKNOWN'}`,
  'RETRY=NO_REEXECUTE_READ_ONLY_RECONCILE','',
].join('\n');}

async function sameReadback(fetchApi,url,headers,bytes){
  try{
    const response=await fetchApi(url+'?ref=main',{method:'GET',headers});
    if(response.status!==200)return false;
    const x=await response.json();
    return x?.encoding==='base64'&&
      Buffer.from(x.content.replace(/\s/g,''),'base64').equals(Buffer.from(bytes));
  }catch{return false;}
}

export async function uploadReport({event,env,rawResult,fetchApi=fetch}){
  const request=verifyEvent(event,env);
  need(typeof env.GITHUB_TOKEN==='string'&&env.GITHUB_TOKEN.length>=20&&
    RUN.test(env.GITHUB_RUN_ID??''),'PROVIDER_B_REPORT_AUTH_STOP');
  let parsed;
  try{parsed=typeof rawResult==='string'&&Buffer.byteLength(rawResult)<=2048?
    JSON.parse(rawResult):null;}catch{parsed=null;}
  const r=sanitizeReport(parsed,request,env);
  const headers={accept:'application/vnd.github+json',
    authorization:'Bearer '+env.GITHUB_TOKEN,
    'x-github-api-version':'2022-11-28','content-type':'application/json',
    'user-agent':'zgmini-provider-flags-b-once'};
  let created=0,verified=0;
  for(const [ext,content] of [['json',JSON.stringify(r,null,2)+'\n'],
    ['txt',textReport(r)]]){
    const url=`https://api.github.com/repos/${CONTROL_REPO}/contents/`+
      `results/provider-flags-b-${request.requestId}.${ext}`;
    try{
      const res=await fetchApi(url,{method:'PUT',headers,body:JSON.stringify({
        message:'chore(config-b): record one-shot sanitized provider flags result',
        content:Buffer.from(content).toString('base64')})});
      if(res.status===201)created++;
    }catch{/* Ambiguous PUT is not retried. */}
    if(await sameReadback(fetchApi,url,headers,content))verified++;
  }
  const delivery=verified===2?'RESULT_PAIR_READBACK_VERIFIED':
    'RESULT_DELIVERY_UNVERIFIED';
  const status=verified===2?r.status:'PROVIDER_B_STATE_UNKNOWN';
  const comment=`<!-- provider-flags-b:${request.requestId} -->\n`+
    `Provider flags B evidence: **${status}** (${verified===2?r.code:'RESULT_PAIR_UNVERIFIED'})\n`+
    `DELIVERY: ${delivery}; CREATED: ${created}/2; READBACK: ${verified}/2\n`+
    `RUN_ID: ${r.runId??'UNKNOWN'}; NO_REEXECUTE\n`;
  const res=await fetchApi(`https://api.github.com/repos/${CONTROL_REPO}/issues/`+
    `${event.issue.number}/comments`,{method:'POST',headers,body:JSON.stringify({body:comment})});
  need(res.status===201,'PROVIDER_B_REPORT_COMMENT_STOP');
  return {status,delivery,created,verified};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    const env=process.env,event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
    const local=fs.readFileSync(path.join(env.RUNNER_TEMP,'provider-flags-b-result.json'),'utf8');
    const report=await uploadReport({event,env,rawResult:local});
    process.stdout.write(`PROVIDER_B_REPORT ${report.delivery} ${report.verified}/2\n`);
  }catch{
    process.stderr.write('PROVIDER_B_REPORT_UNVERIFIED_READ_ONLY_RECONCILE\n');
    process.exitCode=1;
  }
}

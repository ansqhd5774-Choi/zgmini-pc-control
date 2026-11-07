#!/usr/bin/env node
// One-shot create-only evidence reporter. Token is never passed to the B executor.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {DIRECT_B_RESULT,verifyOpenedOwnerIssue} from './run.mjs';

const REPO='ansqhd5774-Choi/zgmini-pc-control';
const RUN=/^[0-9]{1,18}$/;
const SHA40=/^[0-9a-f]{40}$/;
const SHA64=/^[0-9a-f]{64}$/;
const CODE=/^DIRECT_B_[A-Z0-9_]{1,100}$/;
const VALID=new Set(['DIRECT_B_PREFLIGHT_STOP','DIRECT_B_EFFECT_BLOCKED',
  'DIRECT_B_EFFECT_UNKNOWN','DIRECT_B_EFFECT_PASS_NOT_PUBLISHED']);
const need=(x,code)=>{if(!x)throw Object.assign(Error(code),{code});};

export function sanitizeDirectBReport(raw,request,env){
  const base={schema:'ZGMINI_APPROVED_RUNTIME_B_RESULT_R1',
    requestId:request.requestId,status:'DIRECT_B_STATE_UNKNOWN',
    code:'DIRECT_B_RESULT_UNVERIFIED',
    mode:null,manifestSha256:request.approvalManifestSha256,
    controlSha:null,sourceSha:null,operationSucceeded:false,
    runtimeEffectProof:'NOT_ESTABLISHED',
    runId:RUN.test(env?.GITHUB_RUN_ID??'')?env.GITHUB_RUN_ID:null,
    retry:'NO_AUTO_RETRY_READ_ONLY_RECONCILE'};
  if(!raw||typeof raw!=='object'||Array.isArray(raw)||
    !VALID.has(raw.status)||!CODE.test(raw.code??''))return base;
  if(raw.requestId!==request.requestId&&
    !(raw.status==='DIRECT_B_PREFLIGHT_STOP'&&raw.requestId===null))return base;
  if(raw.status==='DIRECT_B_EFFECT_PASS_NOT_PUBLISHED'){
    if(raw.code!=='DIRECT_B_LOCAL_EFFECT_PASS'||raw.operationSucceeded!==true||
      raw.manifestSha256!==base.manifestSha256||
      !SHA40.test(raw.controlSha??'')||!SHA40.test(raw.sourceSha??'')||
      !['PIN_REGISTRY_CAS','VERSIONED_BUNDLE_ACTIVATE',
        'CONFIGURED_THEMES_REPEAT_UPGRADE'].includes(raw.mode))return base;
    return {...base,status:raw.status,code:raw.code,mode:raw.mode,
      sourceSha:raw.sourceSha,controlSha:raw.controlSha,operationSucceeded:true,
      runtimeEffectProof:'LOCAL_EXECUTOR_PASS_REPORT_PENDING'};
  }
  return {...base,status:raw.status,code:raw.code};
}

export function directBTextReport(r){return [
  `REQUEST_ID=${r.requestId}`,`STATUS=${r.status}`,`CODE=${r.code}`,
  `MODE=${r.mode??'NONE'}`,`MANIFEST_SHA256=${r.manifestSha256}`,
  `CONTROL_SHA=${r.controlSha??'UNKNOWN'}`,
  `SOURCE_SHA=${r.sourceSha??'UNKNOWN'}`,
  `OPERATION_SUCCEEDED=${r.operationSucceeded}`,
  `RUNTIME_EFFECT_PROOF=${r.runtimeEffectProof}`,
  `RUN_ID=${r.runId??'UNKNOWN'}`,
  `RETRY=${r.retry}`,'',
].join('\n');}

async function sameReadback(fetchApi,url,headers,bytes){
  try{
    const response=await fetchApi(url+'?ref=main',{method:'GET',headers});
    if(response.status!==200)return false;
    const body=await response.json();
    return body?.encoding==='base64'&&
      Buffer.from((body.content??'').replace(/\s/g,''),'base64')
        .equals(Buffer.from(bytes));
  }catch{return false;}
}

export async function uploadDirectBReport({event,env,rawResult,fetchApi=fetch}){
  const request=verifyOpenedOwnerIssue(event,env);
  need(typeof env.GITHUB_TOKEN==='string'&&env.GITHUB_TOKEN.length>=20&&
    RUN.test(env.GITHUB_RUN_ID??''),'DIRECT_B_REPORT_AUTH_STOP');
  let parsed;
  try{parsed=typeof rawResult==='string'&&Buffer.byteLength(rawResult)<=2048?
    JSON.parse(rawResult):null;}catch{parsed=null;}
  const r=sanitizeDirectBReport(parsed,request,env);
  const headers={accept:'application/vnd.github+json',
    authorization:'Bearer '+env.GITHUB_TOKEN,
    'x-github-api-version':'2022-11-28',
    'content-type':'application/json',
    'user-agent':'zgmini-approved-runtime-b-once'};
  let created=0,verified=0;
  for(const [ext,content] of [['json',JSON.stringify(r,null,2)+'\n'],
    ['txt',directBTextReport(r)]]){
    const url=`https://api.github.com/repos/${REPO}/contents/`+
      `results/approved-runtime-b-${request.requestId}.${ext}`;
    try{
      const res=await fetchApi(url,{method:'PUT',headers,body:JSON.stringify({
        message:'chore(runtime-b): record one-shot sanitized B result',
        content:Buffer.from(content).toString('base64')})});
      if(res.status===201)created++;
    }catch{/* Ambiguous PUT is never retried. */}
    if(await sameReadback(fetchApi,url,headers,content))verified++;
  }
  const delivery=verified===2?'RESULT_PAIR_READBACK_VERIFIED':
    'RESULT_DELIVERY_UNVERIFIED';
  const status=verified===2?r.status:'DIRECT_B_STATE_UNKNOWN';
  const comment=`<!-- approved-runtime-b:${request.requestId} -->\n`+
    `Approved runtime B: **${status}** `+
    `(${verified===2?r.code:'DIRECT_B_RESULT_PAIR_UNVERIFIED'})\n`+
    `RESULT DELIVERY: ${delivery}; CREATED: ${created}/2; `+
    `READBACK: ${verified}/2\n`+
    `LOCAL EFFECT: ${r.runtimeEffectProof}; RUN_ID: ${r.runId??'UNKNOWN'}; `+
    'NO AUTO RE-EXECUTION\n';
  const response=await fetchApi(`https://api.github.com/repos/${REPO}/issues/`+
    `${event.issue.number}/comments`,{method:'POST',headers,
    body:JSON.stringify({body:comment})});
  need(response.status===201,'DIRECT_B_REPORT_COMMENT_STOP');
  return {status,delivery,created,verified};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    const env=process.env;
    const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
    let local;
    try{local=fs.readFileSync(path.join(env.RUNNER_TEMP,DIRECT_B_RESULT),'utf8');}
    catch{local='';}
    const report=await uploadDirectBReport({event,env,rawResult:local});
    process.stdout.write(`DIRECT_B_REPORT ${report.delivery} ${report.verified}/2\n`);
  }catch{
    process.stderr.write('DIRECT_B_REPORT_UNVERIFIED_READ_ONLY_RECONCILE\n');
    process.exitCode=1;
  }
}

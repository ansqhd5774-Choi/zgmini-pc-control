#!/usr/bin/env node
// Sanitized create-only Sidecar B receipts. Token exists in reporter step only.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {sha256,TARGET} from './contract.mjs';
import {TITLE,LABEL,REQUEST_SCHEMA} from './admission.mjs';
import {uploadResultPairAtomic} from '../writer-config-b/result-pair-atomic.mjs';

const REPO='ansqhd5774-Choi/zgmini-pc-control';
const OWNER='ansqhd5774-Choi';
const SCHEMA='ZGMINI_CNN_SIDECAR_B_RESULT_V1';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const SHA40=/^[a-f0-9]{40}$/,SHA64=/^[a-f0-9]{64}$/;
const codeOk=/^SIDECAR_B_[A-Z0-9_]{3,100}$/;
const fail=c=>{throw Object.assign(Error(c),{code:c});};
const need=(ok,c)=>{if(!ok)fail(c);};
function requestFromEvent(event,env){
 need(env?.GITHUB_REPOSITORY===REPO&&
  env.GITHUB_EVENT_NAME==='issues'&&env.GITHUB_EVENT_ACTION==='opened'&&
  env.GITHUB_ACTOR===OWNER&&env.GITHUB_RUN_ATTEMPT==='1'&&
  event?.repository?.full_name===REPO&&
  event.repository.private===true&&event.sender?.login===OWNER&&
  event.issue?.user?.login===OWNER&&event.issue?.title===TITLE&&
  !event.issue.pull_request&&
  event.issue.labels?.some(x=>x.name===LABEL)&&
  Number.isSafeInteger(event.issue.number)&&event.issue.number>0,
  'SIDECAR_B_REPORT_ORIGIN_STOP');
 let req;
 try{req=JSON.parse(event.issue.body);}catch{fail('SIDECAR_B_REPORT_REQUEST_STOP');}
 need(req?.schema===REQUEST_SCHEMA&&UUID.test(req.requestId??'')&&
  SHA40.test(env.GITHUB_SHA??'')&&
  req.controlHead===env.GITHUB_SHA&&
  SHA64.test(req.approvalManifestSha256??''),
  'SIDECAR_B_REPORT_REQUEST_STOP');
 return req;
}
export function sanitizeSidecarBReport({raw,request,env,readCurrent}){
 const base={schema:SCHEMA,requestId:request.requestId,
  status:'SIDECAR_B_STATE_UNKNOWN',
  code:'SIDECAR_B_UNVERIFIED_RESULT_STOP',applied:false,
  changedFileCount:0,controlSha:env.GITHUB_SHA,
  manifestSha256:request.approvalManifestSha256,
  beforeSha256:null,afterSha256:null,backupVerified:false,
  retry:'READ_ONLY_RECONCILE_NO_REPLAY'};
 if(raw?.schema!==SCHEMA||!codeOk.test(raw.code??''))return base;
 if(raw.applied===true&&raw.status==='SIDECAR_B_APPLIED_VERIFIED'&&
  raw.code==='SIDECAR_B_EXACT_FILE_READBACK_PASS'&&
  raw.requestId===request.requestId&&
  raw.controlSha===env.GITHUB_SHA&&
  raw.manifestSha256===request.approvalManifestSha256&&
  raw.changedFileCount===1&&raw.backupVerified===true&&
  SHA64.test(raw.beforeSha256??'')&&SHA64.test(raw.afterSha256??'')&&
  raw.beforeSha256!==raw.afterSha256&&
  readCurrent()===raw.afterSha256)
  return {...base,status:raw.status,code:raw.code,applied:true,
   changedFileCount:1,beforeSha256:raw.beforeSha256,
   afterSha256:raw.afterSha256,backupVerified:true};
 if(raw.applied===false&&[
  'SIDECAR_B_PREFLIGHT_OR_RUNTIME_STOP','SIDECAR_B_RECOVERY_REQUIRED',
  'SIDECAR_B_STATE_UNKNOWN'
 ].includes(raw.status))
  return {...base,status:raw.status,code:raw.code};
 return base;
}
const asText=r=>[
 'SCHEMA='+r.schema,'REQUEST_ID='+r.requestId,'STATUS='+r.status,
 'CODE='+r.code,'APPLIED='+r.applied,
 'CONTROL_SHA='+r.controlSha,'MANIFEST_SHA256='+r.manifestSha256,
 'BEFORE_SHA256='+(r.beforeSha256??'UNKNOWN'),
 'AFTER_SHA256='+(r.afterSha256??'UNKNOWN'),
 'BACKUP_VERIFIED='+r.backupVerified,
 'CHANGED_FILE_COUNT='+r.changedFileCount,
 'RETRY='+r.retry,''].join('\n');
const apiHeaders=token=>({
 accept:'application/vnd.github+json',
 authorization:'Bearer '+token,
 'x-github-api-version':'2022-11-28',
 'content-type':'application/json',
 'user-agent':'zgmini-cnn-sidecar-b'});
export async function publishSidecarBReport({
 event,env,raw,fetchApi=fetch,readCurrent=()=>{
  try{return sha256(fs.readFileSync(TARGET));}catch{return null;}
 }
}){
 const request=requestFromEvent(event,env);
 need(typeof env.GITHUB_TOKEN==='string'&&env.GITHUB_TOKEN.length>=20,
  'SIDECAR_B_REPORT_TOKEN_STOP');
 const parsed=typeof raw==='string'&&Buffer.byteLength(raw)<4096?
  (()=>{try{return JSON.parse(raw);}catch{return null;}})():null;
 const result=sanitizeSidecarBReport({raw:parsed,request,env,readCurrent});
 const headers=apiHeaders(env.GITHUB_TOKEN),root='https://api.github.com/repos/'+REPO;
 // One Git ref CAS binds JSON and TXT atomically. A partial or unknown remote
 // outcome remains STATE_UNKNOWN; never re-run the Sidecar installation.
 const prefix='results/cnn-sidecar-b-'+request.requestId;
 const pair=await uploadResultPairAtomic({fetchApi,headers,
  message:'chore(sidecar-b): one-shot sanitized result pair',
  outputs:[[prefix+'.json',JSON.stringify(result,null,2)+'\n'],
   [prefix+'.txt',asText(result)]]});
 const {created,verified}=pair;
 const ok=verified===2;
 const body='<!-- cnn-sidecar-b:'+request.requestId+' -->\n'+
  'CNN Sidecar B verified result pair: '+(ok?result.status:'STATE_UNKNOWN')+
  ' / '+(ok?result.code:'SIDECAR_B_REPORT_READBACK_STOP')+
  '; JSON/TXT '+verified+'/2, created '+created+
  '/2. No automatic replay.';
 const comment=await fetchApi(root+'/issues/'+event.issue.number+'/comments',{
  method:'POST',headers,body:JSON.stringify({body})});
 need(comment.status===201,'SIDECAR_B_REPORT_COMMENT_STOP');
 return {status:ok?result.status:'SIDECAR_B_STATE_UNKNOWN',verified,created};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const env=process.env;
  const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
  let raw='{}';
  try{raw=fs.readFileSync(path.join(env.RUNNER_TEMP,'cnn-sidecar-b-result.json'),'utf8');}
  catch{}
  const r=await publishSidecarBReport({event,env,raw});
  process.stdout.write('SIDECAR_B_REPORT '+r.status+' '+r.verified+'/2\n');
 }catch{
  process.stderr.write('SIDECAR_B_REPORT_UNKNOWN_NO_REPLAY\n');
  process.exitCode=1;
 }
}

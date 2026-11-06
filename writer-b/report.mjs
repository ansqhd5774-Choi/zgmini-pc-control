#!/usr/bin/env node
// One-shot, bounded create-only GitHub result recovery for generic Writer B.
// Reporter has token access, but cannot call the Windows installer.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {CONTROL_REPO,ACTOR,ISSUE_LABEL,ISSUE_TITLE,
 REQUEST_SCHEMA,OPERATION} from './contract.mjs';

const SHA40=/^[a-f0-9]{40}$/i;
const SHA64=/^[a-f0-9]{64}$/i;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CODE=/^WRITER_B_[A-Z0-9_]{1,100}$/;
const stop=code=>{throw Object.assign(new Error(code),{code});};
const need=(ok,code)=>{if(!ok)stop(code);};

export function validateWriterBReportEvent(event,env){
 need(env?.GITHUB_REPOSITORY===CONTROL_REPO&&env.GITHUB_ACTOR===ACTOR&&
  env.GITHUB_EVENT_NAME==='issues'&&env.GITHUB_EVENT_ACTION==='opened'&&
  env.GITHUB_RUN_ATTEMPT==='1'&&SHA40.test(env.GITHUB_SHA??'')&&
  /^\d{1,18}$/.test(env.GITHUB_RUN_ID??'')&&
  event?.repository?.full_name===CONTROL_REPO&&event.repository.private===true&&
  event?.sender?.login===ACTOR&&event?.issue?.user?.login===ACTOR&&
  event.issue.title===ISSUE_TITLE&&
  event.issue.labels?.some(x=>x.name===ISSUE_LABEL)&&
  Number.isSafeInteger(event.issue.number)&&event.issue.number>0&&
  !event.issue.pull_request,'WRITER_B_REPORT_EVENT_STOP');
 let request;
 try{request=JSON.parse(event.issue.body);}catch{stop('WRITER_B_REPORT_REQUEST_JSON_STOP');}
 need(request?.schema===REQUEST_SCHEMA&&request.operation===OPERATION&&
  request.controlRepository===CONTROL_REPO&&UUID.test(request.requestId??'')&&
  UUID.test(request.chatId??'')&&SHA64.test(request.approvalManifestSha256??''),
  'WRITER_B_REPORT_REQUEST_STOP');
 return request;
}

export function sanitizeWriterBResult(raw,requestId,runId){
 const base={schema:'ZGMINI_PC_WRITER_SOURCE_B_RESULT_V1',requestId,
  status:'WRITER_B_STATE_UNKNOWN',code:'WRITER_B_RESULT_UNVERIFIED_STOP',
  sourceSha:null,mode:null,localOnly:null,baseHead:null,
  candidateSourceSha:null,manifestSha256:null,baseTreeOid:null,
  preparedTreeOid:null,provenanceSha256:null,
  runId:/^\d{1,18}$/.test(runId??'')?runId:null,
  retry:'READ_ONLY_RECONCILE_NO_REEXECUTE'};
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return base;
 if(raw.status==='WRITER_B_SETUP_STOP'&&CODE.test(raw.code??''))
  return {...base,status:raw.status,code:raw.code};
 if(raw.requestId!==requestId)return base;
 if(raw.status==='WRITER_B_INSTALLED_VERIFIED'&&SHA40.test(raw.sourceSha??'')&&
  raw.mode==='LOCAL_OVERLAY'&&raw.localOnly===true&&
  SHA40.test(raw.baseHead??'')&&SHA40.test(raw.candidateSourceSha??'')&&
  SHA40.test(raw.baseTreeOid??'')&&SHA40.test(raw.preparedTreeOid??'')&&
  SHA64.test(raw.manifestSha256??'')&&SHA64.test(raw.provenanceSha256??'')&&
  Array.isArray(raw.changedPaths)&&raw.changedPaths.length>0&&
  raw.changedPaths.length<=32&&raw.changedPaths.every(x=>
   typeof x==='string'&&/^(?:scripts\/pc-writer|lib|worker)\//.test(x)))
  return {...base,status:raw.status,code:'WRITER_B_INSTALL_VERIFIED',
   sourceSha:raw.sourceSha,changedPaths:raw.changedPaths,
   mode:'LOCAL_OVERLAY',localOnly:true,baseHead:raw.baseHead,
   candidateSourceSha:raw.candidateSourceSha,
   manifestSha256:raw.manifestSha256,baseTreeOid:raw.baseTreeOid,
   preparedTreeOid:raw.preparedTreeOid,provenanceSha256:raw.provenanceSha256};
 if(['WRITER_B_PREFLIGHT_STOP','WRITER_B_INSTALL_STOP_RESTORED',
  'WRITER_B_RECOVERY_REQUIRED'].includes(raw.status)&&CODE.test(raw.code??''))
  return {...base,status:raw.status,code:raw.code,
   recovery:raw.status==='WRITER_B_RECOVERY_REQUIRED'?
    'RECONCILE_EXACT_REQUEST_NO_RETRY':undefined};
 return base;
}

function textResult(result){return [
 `REQUEST_ID=${result.requestId}`,`STATUS=${result.status}`,
 `CODE=${result.code}`,`SOURCE_SHA=${result.sourceSha??'NONE'}`,
 `SOURCE_MODE=${result.mode??'UNKNOWN'}`,
 `LOCAL_ONLY=${result.localOnly===true?'true':'UNKNOWN'}`,
 `BASE_HEAD=${result.baseHead??'NONE'}`,
 `CANDIDATE_SOURCE_SHA=${result.candidateSourceSha??'NONE'}`,
 `MANIFEST_SHA256=${result.manifestSha256??'NONE'}`,
 `BASE_TREE_OID=${result.baseTreeOid??'NONE'}`,
 `PREPARED_TREE_OID=${result.preparedTreeOid??'NONE'}`,
 `PROVENANCE_SHA256=${result.provenanceSha256??'NONE'}`,
 `RUN_ID=${result.runId??'UNKNOWN'}`,
 'RETRY=READ_ONLY_RECONCILE_NO_REEXECUTE','',
].join('\n');}

async function readback(apiFetch,url,headers,expected){
 try{
  const response=await apiFetch(url+'?ref=main',{method:'GET',headers});
  if(response.status!==200)return false;
  const json=await response.json();
  return json?.encoding==='base64'&&typeof json.content==='string'&&
   Buffer.from(json.content.replace(/\s/g,''),'base64').equals(Buffer.from(expected));
 }catch{return false;}
}

export async function uploadWriterBReport({event,env,rawResult,apiFetch=fetch}){
 const req=validateWriterBReportEvent(event,env);
 need(typeof env.GITHUB_TOKEN==='string'&&env.GITHUB_TOKEN.length>=20,
  'WRITER_B_REPORT_TOKEN_STOP');
 let parsed;
 try{parsed=typeof rawResult==='string'&&Buffer.byteLength(rawResult)<=8192?
  JSON.parse(rawResult):null;}catch{parsed=null;}
 const result=sanitizeWriterBResult(parsed,req.requestId,env.GITHUB_RUN_ID);
 const json=JSON.stringify(result,null,2)+'\n';
 const txt=textResult(result);
 const headers={accept:'application/vnd.github+json',
  authorization:'Bearer '+env.GITHUB_TOKEN,
  'x-github-api-version':'2022-11-28','content-type':'application/json',
  'user-agent':'zgmini-writer-b-source-once'};
 let created=0,verified=0;
 for(const [ext,content] of [['json',json],['txt',txt]]){
  const url=`https://api.github.com/repos/${CONTROL_REPO}/contents/`+
    `results/writer-b-source-install-${req.requestId}.${ext}`;
  try{
   const response=await apiFetch(url,{method:'PUT',headers,
    body:JSON.stringify({message:'chore(writer-b): record exact one-shot result',
     content:Buffer.from(content).toString('base64')})});
   if(response.status===201)created++;
  }catch{/* Ambiguous PUT must never automatically retry. */}
  if(await readback(apiFetch,url,headers,content))verified++;
 }
 // The Windows installer may have succeeded locally, but a partial/unknown
 // remote evidence pair is NOT a verified GitHub installation record.
 // Never misreport delivery failure as installer rollback or auto-retry.
 const deliveryStatus=verified===2?'RESULT_PAIR_READBACK_VERIFIED':
  'RESULT_DELIVERY_UNVERIFIED';
 const publicStatus=verified===2?result.status:'WRITER_B_STATE_UNKNOWN';
 const publicCode=verified===2?result.code:'WRITER_B_RESULT_PAIR_READBACK_STOP';
 const comment=`<!-- zgmini-writer-b-install:${req.requestId} -->\n`+
  `Writer B evidence: **${publicStatus}** (${publicCode})\n`+
  `DELIVERY: ${deliveryStatus}\n`+
  `LOCAL_ONLY: ${verified===2&&result.localOnly===true?'true':'UNKNOWN'}; `+
  `REMOTE_SOURCE: NOT_PUBLISHED_BY_INSTALLER\n`+
  `RESULT_CREATED: ${created}/2; RESULT_READBACK: ${verified}/2\n`+
  `RUN_ID: ${result.runId??'UNKNOWN'}; RETRY: NO_REEXECUTE\n`;
 const reply=await apiFetch(
  `https://api.github.com/repos/${CONTROL_REPO}/issues/${event.issue.number}/comments`,
  {method:'POST',headers,body:JSON.stringify({body:comment})});
 need(reply.status===201,'WRITER_B_REPORT_COMMENT_STOP');
 return {status:result.status,code:result.code,deliveryStatus,created,verified};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const env=process.env;
  const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
  let result='{}';
  try{result=fs.readFileSync(path.join(env.RUNNER_TEMP??'',
   'writer-b-install-result.json'),'utf8');}catch{}
  const report=await uploadWriterBReport({event,env,rawResult:result});
  process.stdout.write(`WRITER_B_REPORT ${report.deliveryStatus} `+
   `CREATED=${report.created}/2 READBACK=${report.verified}/2\n`);
 }catch{
  process.stderr.write('WRITER_B_REPORT_UNVERIFIED_READ_ONLY_RECONCILE\n');
  process.exitCode=1;
 }
}

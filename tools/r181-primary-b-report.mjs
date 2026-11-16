#!/usr/bin/env node
// Create-only redacted B receipts, same existing Writer B workflow.
// Token is restricted to this reporter step, never passed to install.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {R181_PRIMARY_B_OPERATION,R181_PRIMARY_B_REQUEST_SCHEMA}
  from './r181-primary-b-transaction.mjs';

const REPO='ansqhd5774-Choi/zgmini-pc-control',ACTOR='ansqhd5774-Choi';
const SCHEMA='ZGMINI_R181_PRIMARY_B_RESULT_V1';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA40=/^[a-f0-9]{40}$/i,SHA64=/^[a-f0-9]{64}$/i;
const CODE=/^R181_(?:B_)?[A-Z0-9_]{3,100}$/,RUN=/^[0-9]{1,18}$/;
const STATUSES=new Set(['R181_PRIMARY_B_SETUP_STOP','R181_PRIMARY_B_PREFLIGHT_STOP',
  'R181_PRIMARY_B_STOP_RESTORED','R181_PRIMARY_B_APPLIED_VERIFIED',
  'R181_PRIMARY_B_RECOVERY_REQUIRED']);
const need=(okay,code)=>{if(!okay)throw Object.assign(Error(code),{code});};

function validateOrigin(event,env){
  need(env?.GITHUB_REPOSITORY===REPO&&env.GITHUB_EVENT_NAME==='issues'&&
    env.GITHUB_EVENT_ACTION==='opened'&&env.GITHUB_RUN_ATTEMPT==='1'&&
    env.GITHUB_ACTOR===ACTOR&&SHA40.test(env.GITHUB_SHA??'')&&
    RUN.test(env.GITHUB_RUN_ID??'')&&
    event?.repository?.full_name===REPO&&event.repository.private===true&&
    event.sender?.login===ACTOR&&event.issue?.user?.login===ACTOR&&
    event.issue?.title===R181_PRIMARY_B_OPERATION&&!event.issue.pull_request&&
    event.issue.labels?.some(l=>l.name==='pc-writer-b-install')&&
    Number.isSafeInteger(event.issue.number)&&event.issue.number>0,
    'R181_PRIMARY_B_REPORT_EVENT_STOP');
  let req;try{req=JSON.parse(event.issue.body);}catch{
    need(false,'R181_PRIMARY_B_REPORT_REQUEST_STOP');
  }
  need(req?.schema===R181_PRIMARY_B_REQUEST_SCHEMA&&
    req.operation===R181_PRIMARY_B_OPERATION&&
    req.controlRepository===REPO&&UUID.test(req.requestId??'')&&
    UUID.test(req.chatId??'')&&
    /^approvals\/r181-primary-b\/r181-primary-[a-z0-9-]{4,70}\.json$/.test(req.approvalManifestPath??'')&&
    SHA64.test(req.approvalManifestSha256??''),
    'R181_PRIMARY_B_REPORT_REQUEST_STOP');
  return req;
}
export function sanitizeR181BReport(raw,request,env){
  const base={schema:SCHEMA,requestId:request.requestId,
    status:'R181_PRIMARY_B_STATE_UNKNOWN',code:'R181_PRIMARY_B_RESULT_UNVERIFIED_STOP',
    applied:false,controlSha:null,
    manifestSha256:request.approvalManifestSha256,
    beforeSha256:null,afterSha256:null,backupVerified:false,
    changedFileCount:0,runId:RUN.test(env?.GITHUB_RUN_ID??'')?
      env.GITHUB_RUN_ID:null,retry:'NO_REEXECUTE_READ_ONLY_RECONCILE'};
  if(!raw||typeof raw!=='object'||Array.isArray(raw)||
    !STATUSES.has(raw.status)||!CODE.test(raw.code??''))return base;
  if(raw.requestId!==request.requestId&&
    !(raw.status==='R181_PRIMARY_B_SETUP_STOP'&&raw.requestId===null))return base;
  if(raw.status==='R181_PRIMARY_B_APPLIED_VERIFIED'){
    if(raw.applied!==true||raw.changedFileCount!==1||
      raw.backupVerified!==true||raw.changedByteCount!==3||
      !SHA64.test(raw.beforeSha256??'')||
      !SHA64.test(raw.afterSha256??'')||
      !SHA40.test(raw.controlSha??'')||
      raw.beforeSha256!=='da433fe2febea455343b66424b2b6e9d6680575f21f2552fc0be8d3bd95aa5c9'||
      raw.controlSha!==env.GITHUB_SHA||
      raw.manifestSha256!==request.approvalManifestSha256)
      return base;
    return {...base,status:raw.status,code:raw.code,
      applied:true,controlSha:raw.controlSha,
      beforeSha256:raw.beforeSha256,
      afterSha256:raw.afterSha256,
      backupVerified:true,changedFileCount:1};
  }
  return {...base,status:raw.status,code:raw.code};
}
function asText(r){return [
  'REQUEST_ID='+r.requestId,'STATUS='+r.status,'CODE='+r.code,
  'APPLIED='+r.applied,'CONTROL_SHA='+(r.controlSha??'NONE'),
  'MANIFEST_SHA256='+r.manifestSha256,
  'BEFORE_SHA256='+(r.beforeSha256??'UNKNOWN'),
  'AFTER_SHA256='+(r.afterSha256??'UNKNOWN'),
  'BACKUP_VERIFIED='+r.backupVerified,
  'CHANGED_FILE_COUNT='+r.changedFileCount,
  'RUN_ID='+(r.runId??'UNKNOWN'),
  'RETRY='+r.retry,''].join('\n');
}
async function readback(fetchApi,url,headers,bytes){
  try{
    const rsp=await fetchApi(url+'?ref=main',{method:'GET',headers});
    if(rsp.status!==200)return false;
    const v=await rsp.json();
    return v?.encoding==='base64'&&typeof v.content==='string'&&
      Buffer.from(v.content.replace(/\s/g,''),'base64')
        .equals(Buffer.from(bytes));
  }catch{return false;}
}
export async function publishR181BReport({event,env,raw,fetchApi=fetch}){
  const request=validateOrigin(event,env);
  need(typeof env.GITHUB_TOKEN==='string'&&env.GITHUB_TOKEN.length>=20,
    'R181_PRIMARY_B_REPORT_TOKEN_STOP');
  let data;try{
    data=typeof raw==='string'&&Buffer.byteLength(raw)<=4096?
      JSON.parse(raw):null;
  }catch{data=null;}
  const result=sanitizeR181BReport(data,request,env);
  const headers={accept:'application/vnd.github+json',
    authorization:'Bearer '+env.GITHUB_TOKEN,
    'x-github-api-version':'2022-11-28',
    'content-type':'application/json',
    'user-agent':'zgmini-r181-protected-b'};
  let verified=0,created=0;
  for(const [ext,body] of [
    ['json',JSON.stringify(result,null,2)+'\n'],['txt',asText(result)]]){
    const url='https://api.github.com/repos/'+REPO+
      '/contents/results/r181-primary-b-'+request.requestId+'.'+ext;
    try{
      const put=await fetchApi(url,{method:'PUT',headers,
        body:JSON.stringify({message:'report: approved W03 R181 B result',
          content:Buffer.from(body).toString('base64')})});
      if(put.status===201)created++;
    }catch{/* Unknown remote outcome: no retry. */}
    if(await readback(fetchApi,url,headers,body))verified++;
  }
  const delivered=verified===2;
  const status=delivered?result.status:'R181_PRIMARY_B_STATE_UNKNOWN';
  const comment='<!-- w03-r181-primary-b:'+request.requestId+' -->\n'+
    'R181 fixed-file B result: '+status+
    ' / '+(delivered?result.code:'R181_PRIMARY_B_RESULT_PAIR_UNVERIFIED_STOP')+
    '\nJSON/TXT readback: '+verified+'/2; created: '+created+
    '/2; run: '+(result.runId??'UNKNOWN')+
    '; no automatic retry.\n';
  const posted=await fetchApi('https://api.github.com/repos/'+REPO+
    '/issues/'+event.issue.number+'/comments',{method:'POST',headers,
      body:JSON.stringify({body:comment})});
  need(posted.status===201,'R181_PRIMARY_B_REPORT_COMMENT_STOP');
  return {status,verified,created};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    const env=process.env,
      event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
    let raw='{}';
    try{raw=fs.readFileSync(path.join(env.RUNNER_TEMP,
      'r181-primary-b-result.json'),'utf8');}catch{}
    const result=await publishR181BReport({event,env,raw});
    process.stdout.write('R181_PRIMARY_B_REPORT '+result.status+' '+result.verified+'/2\n');
  }catch{
    process.stderr.write('R181_PRIMARY_B_REPORT_UNKNOWN_NO_REEXECUTE\n');
    process.exitCode=1;
  }
}

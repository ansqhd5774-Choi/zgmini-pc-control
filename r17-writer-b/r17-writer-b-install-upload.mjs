#!/usr/bin/env node
// Private, create-only evidence recovery for ONE approved R17 Writer B install.
// The GitHub token is scoped to this reporter; it must never run the installer.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const REPO='ansqhd5774-Choi/zgmini-pc-control';
const OWNER='ansqhd5774-Choi';
const CANDIDATE='81c8ee543c164fc16c8c760d504b113428d01d4a';
const BASE='a23c12cc8dd3238fa59adb417a4fdd5fce1bd57e';
const SHA40=/^[a-f0-9]{40}$/;
const SHA64=/^[a-f0-9]{64}$/;
const REQUEST_ID=/^pc-r17-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const CHAT_ID=/^chat-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const CODE=/^R17_B_[A-Z0-9_]{1,80}$/;
const PHASES=new Set(['INIT','CLAIMED','BASELINE_SAVED','PREPARED',
  'CORE_DISABLED','CORE_DRAINED','SOURCE_SWITCHED','CONFIG_REGISTERED',
  'CORE_RESTORED','VERIFIED']);
const RECOVERY=new Set(['POST_RESTORE_VERIFICATION','JOURNAL_FAILED',
  'CORE_ALREADY_ENABLED','CORE_STATE_UNKNOWN','CONFIG_RESTORE_FAILED',
  'SOURCE_RESTORE_FAILED','CORE_RESTORE_FAILED']);
const MAX_REPORT_BYTES=8192;

function assert(condition,code){if(!condition)throw new Error(code);}
const record=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
function keysEqual(x,keys){return record(x)&&Object.keys(x).length===keys.length&&
  keys.every(key=>Object.hasOwn(x,key));}

export function validateEventForUpload(event,env){
  assert(env?.GITHUB_REPOSITORY===REPO&&env?.GITHUB_EVENT_NAME==='issues'&&
    env?.GITHUB_EVENT_ACTION==='opened'&&env?.GITHUB_ACTOR===OWNER&&
    env?.GITHUB_RUN_ATTEMPT==='1'&&
    /^zgmini-pc-0[1-6]$/.test(env?.RUNNER_NAME??'')&&
    /^\d{1,18}$/.test(env?.GITHUB_RUN_ID??'')&&
    SHA40.test(env?.R17_CONTROL_SHA??'')&&
    env?.GITHUB_SHA===env?.R17_CONTROL_SHA,
  'R17_B_REPORT_EVENT_CONTEXT_STOP');
  const issue=event?.issue;
  assert(event?.action==='opened'&&event?.repository?.private===true&&
    event?.repository?.full_name===REPO&&event?.sender?.login===OWNER&&
    issue?.user?.login===OWNER&&issue?.title==='pc-r17-writer-fivefile-install'&&
    !issue?.pull_request&&Number.isSafeInteger(issue?.number)&&issue.number>0&&
    issue?.labels?.some(label=>label?.name==='pc-r17-writer-b-install')&&
    typeof issue?.body==='string'&&Buffer.byteLength(issue.body,'utf8')<=4096,
  'R17_B_REPORT_EVENT_AUTHORIZATION_STOP');
  let request;
  try{request=JSON.parse(issue.body);}catch{throw new Error('R17_B_REPORT_BODY_STOP');}
  assert(keysEqual(request,['schema','requestId','chatId','operation',
    'controlRepository','candidateSourceSha','approvalManifestSha256'])&&
    request.schema==='ZGMINI_R17_WRITER_B_INSTALL_REQUEST_V1'&&
    REQUEST_ID.test(request.requestId??'')&&CHAT_ID.test(request.chatId??'')&&
    request.operation==='r17-writer-fivefile-install-once'&&
    request.controlRepository===REPO&&request.candidateSourceSha===CANDIDATE&&
    SHA64.test(request.approvalManifestSha256??''),
  'R17_B_REPORT_REQUEST_STOP');
  return request;
}

// Strict allowlist: never echo unvalidated input, config, XML, command output,
// provider data, file bytes, stack traces or credentials into GitHub evidence.
export function sanitizeInstallReport(raw,requestId,runId=null){
  const base={schema:'ZGMINI_R17_WRITER_B_INSTALL_RESULT_V1',requestId,
    status:'STATE_UNKNOWN',phase:'UNKNOWN',code:'R17_B_RESULT_UNVERIFIED',
    sourceSha:null,runId:/^\d{1,18}$/.test(runId??'')?runId:null,
    retry:'NO_REEXECUTE_READBACK_ONLY'};
  if(!record(raw))return base;
  if(raw.status==='R17_B_SETUP_STOP'&&keysEqual(raw,['status','errorCode'])&&
    CODE.test(raw.errorCode??''))
    return {...base,status:'R17_B_SETUP_STOP',phase:'SETUP',code:raw.errorCode};
  if(raw.requestId!==requestId)
    return {...base,code:'R17_B_RESULT_REQUEST_MISMATCH'};
  if(raw.status==='R17_B_INSTALLED_VERIFIED'&&
    keysEqual(raw,['status','phase','requestId','sourceSha'])&&
    raw.phase==='VERIFIED'&&SHA40.test(raw.sourceSha??'')&&raw.sourceSha!==BASE)
    return {...base,status:raw.status,phase:'VERIFIED',
      code:'R17_B_INSTALL_VERIFIED',sourceSha:raw.sourceSha};
  if(raw.status==='R17_B_INSTALL_STOP'&&
    keysEqual(raw,['status','phase','requestId','sourceSha','errorCode'])&&
    PHASES.has(raw.phase)&&raw.sourceSha===null&&CODE.test(raw.errorCode??''))
    return {...base,status:raw.status,phase:raw.phase,code:raw.errorCode};
  if(raw.status==='R17_B_RECOVERY_REQUIRED'&&
    keysEqual(raw,['status','phase','requestId','sourceSha','errorCode','recovery'])&&
    PHASES.has(raw.phase)&&raw.sourceSha===null&&CODE.test(raw.errorCode??'')&&
    Array.isArray(raw.recovery)&&raw.recovery.length>=1&&raw.recovery.length<=8&&
    raw.recovery.every(item=>RECOVERY.has(item)))
    return {...base,status:raw.status,phase:raw.phase,code:raw.errorCode,
      recovery:[...new Set(raw.recovery)]};
  return base;
}

export function readResultFile(file){
  try{
    const stat=fs.lstatSync(file);
    if(!stat.isFile()||stat.isSymbolicLink()||stat.size===0||
      stat.size>MAX_REPORT_BYTES)return '{}';
    return fs.readFileSync(file,'utf8');
  }catch{return '{}';}
}

function txtReport(result){
  const lines=[`REQUEST_ID=${result.requestId}`,`STATUS=${result.status}`,
    `PHASE=${result.phase}`,`CODE=${result.code}`,
    `SOURCE_SHA=${result.sourceSha??'NONE'}`,`RUN_ID=${result.runId??'UNKNOWN'}`,
    `RECOVERY=${result.recovery?.join(',')??'NONE'}`,
    'RETRY=NO_REEXECUTE_READBACK_ONLY'];
  return lines.join('\n')+'\n';
}

async function oneReadback(apiFetch,url,headers,expected){
  try{
    const response=await apiFetch(`${url}?ref=main`,{method:'GET',headers});
    if(response.status!==200)return false;
    const info=await response.json();
    if(info?.encoding!=='base64'||typeof info.content!=='string'||
      !/^[A-Za-z0-9+/=\r\n]+$/.test(info.content))return false;
    return Buffer.from(info.content.replace(/\s/g,''),'base64').equals(Buffer.from(expected));
  }catch{return false;}
}

export async function uploadInstallReport({event,env,readReport,apiFetch=fetch}={}){
  const request=validateEventForUpload(event,env);
  const token=env.GITHUB_TOKEN;
  assert(typeof token==='string'&&token.length>=20,'R17_B_REPORT_TOKEN_STOP');
  let raw;
  try{
    const value=readReport();
    raw=typeof value==='string'&&Buffer.byteLength(value,'utf8')<=MAX_REPORT_BYTES?
      JSON.parse(value):null;
  }catch{raw=null;}
  const result=sanitizeInstallReport(raw,request.requestId,env.GITHUB_RUN_ID);
  const json=JSON.stringify(result,null,2)+'\n';
  const txt=txtReport(result);
  const headers={accept:'application/vnd.github+json',
    authorization:`Bearer ${token}`,'x-github-api-version':'2022-11-28',
    'content-type':'application/json','user-agent':'zgmini-r17-writer-b-install-once'};
  const uploads=[
    [`results/r17-writer-b-install-${request.requestId}.json`,json],
    [`results/r17-writer-b-install-${request.requestId}.txt`,txt],
  ];
  let created=0,verified=0;
  for(const [relative,content] of uploads){
    const url=`https://api.github.com/repos/${REPO}/contents/${relative}`;
    try{
      // No sha: create-only. Never overwrite, never re-submit after ambiguity.
      const response=await apiFetch(url,{method:'PUT',headers,
        body:JSON.stringify({message:`chore(r17): record Writer B install ${request.requestId}`,
          content:Buffer.from(content).toString('base64')})});
      if(response.status===201)created++;
    }catch{/* Preserve state: uncertain PUT is never retried. */}
    if(await oneReadback(apiFetch,url,headers,content))verified++;
  }
  const issueBody=`<!-- zgmini-r17-writer-b-install:${request.requestId} -->\n`+
    `R17 Writer B one-shot install: **${result.status}** (${result.code})\n`+
    `PHASE: ${result.phase}\n`+
    `RESULT_CREATED: ${created}/2; RESULT_READBACK: ${verified}/2\n`+
    `RETRY: NO_REEXECUTE_READBACK_ONLY\n\n`+
    '```json\n'+json.trim()+'\n```';
  const reply=await apiFetch(
    `https://api.github.com/repos/${REPO}/issues/${event.issue.number}/comments`,
    {method:'POST',headers,body:JSON.stringify({body:issueBody})});
  assert(reply?.status===201,'R17_B_REPORT_COMMENT_STOP');
  return {status:result.status,code:result.code,created,verified};
}

async function main(){
  try{
    const env=process.env;
    const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
    const report=await uploadInstallReport({event,env,
      readReport:()=>readResultFile(path.join(env.RUNNER_TEMP??'',
        'r17-b-install-result.json'))});
    process.stdout.write(`R17_B_REPORT ${report.status} CREATED=${report.created}/2 READBACK=${report.verified}/2\n`);
  }catch{
    process.stderr.write('R17_B_REPORT_UNVERIFIED_MANUAL_READBACK_ONLY\n');
    process.exitCode=1;
  }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))
  await main();

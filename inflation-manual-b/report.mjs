#!/usr/bin/env node
// Token-isolated evidence reporter. Only status, request ID, bounded codes and
// hashes leave the Windows runner; raw BLS/Census and PC paths never do.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {CONTROL_REPO,verifyIssueEvent} from './contract.mjs';

const CODE=/^INFL_MANUAL_(?:B|STORE)_[A-Z0-9_]{1,95}$/;
const SHA64=/^[a-f0-9]{64}$/;
const fail=code=>{throw Object.assign(new Error(code),{code});};
const need=(x,code)=>{if(!x)fail(code);};
const validRun=x=>/^\d{1,18}$/.test(x??'');
const statusSet=new Set(['INFL_MANUAL_B_SAVED_VERIFIED',
 'INFL_MANUAL_B_RECOVERY_REQUIRED','INFL_MANUAL_B_PREFLIGHT_STOP']);

export function sanitizeManualBResult(raw,requestId,runId){
 const base={schema:'ZGMINI_INFLATION_OFFICIAL_MANUAL_B_RESULT_V1',
  requestId,status:'INFL_MANUAL_B_STATE_UNKNOWN',
  code:'INFL_MANUAL_B_RESULT_UNVERIFIED_STOP',
  runId:validRun(runId)?runId:null,retry:'NO_REEXECUTE_READ_ONLY_RECONCILE'};
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||
  raw.requestId!==requestId||!statusSet.has(raw.status)||
  !CODE.test(raw.code??''))return base;
 if(raw.status==='INFL_MANUAL_B_SAVED_VERIFIED'){
  need(raw.sourceSha256s&&SHA64.test(raw.sourceSha256s.bls)&&
   SHA64.test(raw.sourceSha256s.census)&&
   ['UNCHANGED','ARCHIVED_READBACK','SAVED_READBACK'].includes(raw.storedStatus)&&
   raw.committed&&typeof raw.committed==='object'&&
   Object.keys(raw.committed).every(k=>['bls','census'].includes(k)&&
    SHA64.test(raw.committed[k])),
   'INFL_MANUAL_B_REPORT_SUCCESS_SHAPE_STOP');
  return {...base,status:raw.status,code:raw.code,
   sourceSha256s:{bls:raw.sourceSha256s.bls,
    census:raw.sourceSha256s.census},storedStatus:raw.storedStatus,
   committed:Object.fromEntries(Object.entries(raw.committed))};
 }
 return {...base,status:raw.status,code:raw.code};
}

async function readback(fetchFn,url,headers,expected){
 try{const response=await fetchFn(url+'?ref=main',{headers});
  if(response.status!==200)return false;
  const data=await response.json();
  return data?.encoding==='base64'&&typeof data.content==='string'&&
   Buffer.from(data.content.replace(/\s/g,''),'base64')
    .equals(Buffer.from(expected));
 }catch{return false;}
}

export async function uploadManualBReport({event,env,rawResult,fetchFn=fetch}){
 const request=verifyIssueEvent(event,env);
 need(validRun(env.GITHUB_RUN_ID)&&
  typeof env.GITHUB_TOKEN==='string'&&env.GITHUB_TOKEN.length>=20,
  'INFL_MANUAL_B_REPORT_ENV_STOP');
 let parsed=null;
 try{if(typeof rawResult==='string'&&Buffer.byteLength(rawResult)<=8192)
  parsed=JSON.parse(rawResult);}catch{}
 let result;
 try{result=sanitizeManualBResult(parsed,request.requestId,
  env.GITHUB_RUN_ID);}
 catch{result=sanitizeManualBResult(null,request.requestId,env.GITHUB_RUN_ID);}
 const json=JSON.stringify(result,null,2)+'\n';
 const txt=[`REQUEST_ID=${request.requestId}`,`STATUS=${result.status}`,
  `CODE=${result.code}`,`RUN_ID=${result.runId}`,
  `BLS_SOURCE_SHA256=${result.sourceSha256s?.bls??'NONE'}`,
  `CENSUS_SOURCE_SHA256=${result.sourceSha256s?.census??'NONE'}`,
  `STORED_STATUS=${result.storedStatus??'UNKNOWN'}`,
  `BLS_DOCUMENT_SHA256=${result.committed?.bls??'NONE'}`,
  `CENSUS_DOCUMENT_SHA256=${result.committed?.census??'NONE'}`,
  'RETRY=NO_REEXECUTE_READ_ONLY_RECONCILE',''].join('\n');
 const headers={accept:'application/vnd.github+json',
  authorization:'Bearer '+env.GITHUB_TOKEN,
  'x-github-api-version':'2022-11-28',
  'content-type':'application/json','user-agent':'zgmini-inflation-manual-b'};
 let created=0,verified=0;
 for(const [extension,content] of [['json',json],['txt',txt]]){
  const url=`https://api.github.com/repos/${CONTROL_REPO}/contents/`+
   `results/inflation-official-manual-b-${request.requestId}.${extension}`;
  try{const response=await fetchFn(url,{method:'PUT',headers,
    body:JSON.stringify({message:'report(inflation): one-shot B result',
     content:Buffer.from(content).toString('base64')})});
   if(response.status===201)created++;
  }catch{/* No blind retry on ambiguous PUT. */}
  if(await readback(fetchFn,url,headers,content))verified++;
 }
 const delivery=verified===2?'RESULT_PAIR_READBACK_VERIFIED':
  'RESULT_DELIVERY_UNVERIFIED';
 const publicStatus=verified===2?result.status:'INFL_MANUAL_B_STATE_UNKNOWN';
 const publicCode=verified===2?result.code:'INFL_MANUAL_B_RESULT_PAIR_STOP';
 const comment=`<!-- zgmini-inflation-manual-b:${request.requestId} -->\n`+
  `Inflation manual B: **${publicStatus}** (${publicCode})\n`+
  `DELIVERY: ${delivery}; RESULT_CREATED: ${created}/2; `+
  `RESULT_READBACK: ${verified}/2\n`+
  `RUN_ID: ${result.runId}; RETRY: NO_REEXECUTE\n`;
 const response=await fetchFn(
  `https://api.github.com/repos/${CONTROL_REPO}/issues/${event.issue.number}/comments`,
  {method:'POST',headers,body:JSON.stringify({body:comment})});
 need(response.status===201,'INFL_MANUAL_B_REPORT_COMMENT_STOP');
 return {status:publicStatus,code:publicCode,delivery,created,verified};
}

export function readLocalManualBResult(env,fsOps=fs){
 if(typeof env?.RUNNER_TEMP!=='string'||!path.isAbsolute(env.RUNNER_TEMP))
  return '{}';
 try{return fsOps.readFileSync(path.join(env.RUNNER_TEMP,
  'inflation-manual-b-result.json'),'utf8');}catch{return '{}';}
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const env=process.env,event=JSON.parse(
  fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
  const result=await uploadManualBReport({event,env,
   rawResult:readLocalManualBResult(env)});
  process.stdout.write(`INFL_MANUAL_B_REPORT ${result.delivery} `+
   `CREATED=${result.created}/2 READBACK=${result.verified}/2\n`);
 }catch{process.stderr.write('INFL_MANUAL_B_REPORT_UNVERIFIED\n');
  process.exitCode=1;}
}

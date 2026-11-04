#!/usr/bin/env node
// R17 read-only preflight result recovery. Token is available ONLY in this upload step.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateEvent,OLD,stop,REPO} from './contract.mjs';

const RESULT_ROOT=String.raw`E:\ZGmini\automation\r17-writer-b-preflight`;
const SHA64=/^[a-f0-9]{64}$/;
const CODE=/^R17_B_[A-Z0-9_]{1,75}$/;
const simple=(x)=>typeof x==='string'&&x.length<96?x:'UNKNOWN';

export function sanitizeReport(raw,expectedRequestId){
 const source=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
 if(source.requestId!==expectedRequestId)
  return {schema:'ZGMINI_R17_WRITER_B_PREFLIGHT_RESULT_V1',requestId:expectedRequestId,
   status:'STATE_UNKNOWN',code:'R17_B_RESULT_REQUEST_MISMATCH',providerCalls:0,d1Writes:0,
   pcSourceWrites:0,operationalConfigWrites:0,taskWrites:0};
 const validPass=source.status==='PASS'&&source.code==='R17_B_PREFLIGHT_PASS'&&
  source.existingHashesMatched===2&&source.newlyAbsent===3&&
  source.candidateHashesMatched===3&&source.patchMatched===true&&
  source.configPinMatched===true&&source.taskXmlMatched===true&&
  source.installedHeadMatched===true&&
  OLD.every(p=>SHA64.test(source.oldTargetSha256?.[p]??''));
 const status=validPass?'PASS':source.status==='BLOCKED'?'BLOCKED':'STATE_UNKNOWN';
 const code=status==='PASS'?'R17_B_PREFLIGHT_PASS':
  status==='BLOCKED'&&CODE.test(source.code??'')?source.code:'R17_B_REPORT_UNVERIFIED';
 return {schema:'ZGMINI_R17_WRITER_B_PREFLIGHT_RESULT_V1',requestId:expectedRequestId,
  status,code,providerCalls:0,d1Writes:0,pcSourceWrites:0,
  operationalConfigWrites:0,taskWrites:0,
  ...(validPass?{oldTargetSha256:Object.fromEntries(OLD.map(p=>[p,source.oldTargetSha256[p]])),
   verifiedImportFiles:Number.isSafeInteger(source.verifiedImportFiles)?source.verifiedImportFiles:null}:{}),
  runId:/^\d{1,18}$/.test(source.runId??'')?source.runId:null};
}

export async function uploadReport({event,env,readReport,apiFetch=fetch}={}){
 const request=validateEvent(event,env);
 const token=env.GITHUB_TOKEN;
 if(typeof token!=='string'||token.length<20)stop('R17_B_UPLOAD_AUTH_STOP');
 let raw;
 try{raw=JSON.parse(readReport())}catch{raw={};}
 const result=sanitizeReport(raw,request.requestId);
 const json=JSON.stringify(result,null,2)+'\n';
 const txt=`REQUEST_ID=${result.requestId}\nSTATUS=${result.status}\nCODE=${result.code}\n`+
  `RUN_ID=${simple(result.runId)}\nPROVIDER_CALLS=0\nD1_WRITES=0\n`+
  'PC_SOURCE_WRITES=0\nCONFIG_WRITES=0\nTASK_WRITES=0\nRETRY=NO_REEXECUTE_READBACK_ONLY\n';
 const headers={accept:'application/vnd.github+json',authorization:`Bearer ${token}`,
  'x-github-api-version':'2022-11-28','content-type':'application/json',
  'user-agent':'zgmini-r17-writer-b-preflight'};
 const uploads=[
  [`results/r17-writer-b-preflight-${request.requestId}.json`,json],
  [`results/r17-writer-b-preflight-${request.requestId}.txt`,txt],
 ];
 let saved=0;
 for(const [relative,content] of uploads){
  const url=`https://api.github.com/repos/${REPO}/contents/${relative}`;
  try{const response=await apiFetch(url,{method:'PUT',headers,
    body:JSON.stringify({message:`chore(r17): record Writer B preflight ${request.requestId}`,
     content:Buffer.from(content).toString('base64')})});
   if(response.status===201)saved++;
  }catch{/* Do not retry a possibly accepted write; final issue comment is the fallback. */}
 }
 const body=`<!-- zgmini-r17-writer-b-preflight:${request.requestId} -->\n`+
  `R17 Writer B read-only preflight: **${result.status}** (${result.code})\n`+
  `RESULT_UPLOAD: ${saved}/2\n\n`+'```json\n'+json.trim()+'\n```';
 const reply=await apiFetch(`https://api.github.com/repos/${REPO}/issues/${event.issue.number}/comments`,
  {method:'POST',headers,body:JSON.stringify({body})});
 if(!reply.ok)stop('R17_B_UPLOAD_COMMENT_STOP');
 return {status:result.status,code:result.code,saved};
}

async function main(){
 try{
  const env=process.env;
  const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
  const request=validateEvent(event,env);
  const result=await uploadReport({event,env,
   readReport:()=>fs.readFileSync(path.join(RESULT_ROOT,`R17_B_PREFLIGHT_${request.requestId}.json`),'utf8')});
  process.stdout.write(`R17_B_UPLOAD ${result.status} FILES=${result.saved}/2\n`);
 }catch{process.stderr.write('R17_B_UPLOAD_UNVERIFIED_INSPECT_ISSUE_AND_LEDGER\n');process.exitCode=1;}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();

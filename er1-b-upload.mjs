#!/usr/bin/env node
// Sanitized result recovery only. GitHub token is passed to this step, NEVER scorer.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateIssue,CONTROL_REPO} from './er1-b-contract.mjs';
import {resultFileName} from './er1-b-entry.mjs';

const ROOT=String.raw`E:\ZGmini\automation\er1-one-shot`;
const CODE_RE=/^ER1_[A-Z0-9_]{1,75}$/;

export function sanitizeReport(value,expectedRequestId){
 const status=['PASS','BLOCKED','STATE_UNKNOWN'].includes(value?.status)?
  value.status:'STATE_UNKNOWN';
 const code=CODE_RE.test(value?.code??'')?value.code:'ER1_B_REPORT_UNKNOWN';
 const writes=[0,1,'UNKNOWN'].includes(value?.d1Writes)?value.d1Writes:'UNKNOWN';
 if(value?.requestId!==expectedRequestId)return {
  schema:'ZGMINI_ER1_PC_B_RESULT_V1',requestId:expectedRequestId,
  status:'STATE_UNKNOWN',code:'ER1_B_REPORT_REQUEST_MISMATCH',
  d1Writes:'UNKNOWN',operationalWrites:'UNKNOWN',providerCalls:0,
  rawEarningsExported:false};
 return {schema:'ZGMINI_ER1_PC_B_RESULT_V1',requestId:expectedRequestId,
  status,code,d1Writes:writes,
  operationalWrites:status==='PASS'?writes:
   status==='BLOCKED'?0:'UNKNOWN',
  providerCalls:0,rawEarningsExported:false};
}

export async function submitReport({event,env,readReport,request,apiFetch=fetch}={}){
 const actualRequest=request??validateIssue(event,env);
 const issueNo=event.issue.number;
 let raw;
 try{raw=JSON.parse(readReport())}catch{raw={}}
 const result=sanitizeReport(raw,actualRequest.requestId);
 const body=JSON.stringify(result,null,2)+'\n';
 const txt=`REQUEST_ID=${result.requestId}\nSTATUS=${result.status}\nCODE=${result.code}\n`+
  `D1_WRITES=${result.d1Writes}\nPROVIDER_REQUESTS=0\nRAW_EARNINGS_EXPORTED=NO\n`+
  'RETRY=NEVER_INSPECT_PC_AND_D1_FIRST\n';
 const token=env?.GITHUB_TOKEN;
 if(typeof token!=='string'||token.length<20)throw Error('ER1_B_UPLOAD_AUTH_MISSING');
 const headers={accept:'application/vnd.github+json',authorization:`Bearer ${token}`,
  'x-github-api-version':'2022-11-28','content-type':'application/json',
  'user-agent':'zgmini-er1-b-once'};
 let uploaded=0;
 const paths=[
  [`results/er1-b-${actualRequest.requestId}.json`,body],
  [`results/er1-b-${actualRequest.requestId}.txt`,txt],
 ];
 for(const [relative,value] of paths){
  const url=`https://api.github.com/repos/${CONTROL_REPO}/contents/${relative}`;
  try{const response=await apiFetch(url,{method:'PUT',headers,
   body:JSON.stringify({message:`chore(er1): record approved PC B result ${actualRequest.requestId}`,
    content:Buffer.from(value,'utf8').toString('base64')})});
   if(response.ok)uploaded++;
  }catch{/* No retry: issue comment below includes the whole sanitized result. */}
 }
 const comment=`<!-- zgmini-er1-b-result:${actualRequest.requestId} -->\n`+
  `ER1 B one-shot: **${result.status}** (${result.code})\n`+
  `RESULT_UPLOAD: ${uploaded}/2\n\n`+
  '```json\n'+body.trim()+'\n```\n';
 const response=await apiFetch(`https://api.github.com/repos/${CONTROL_REPO}/issues/${issueNo}/comments`,
  {method:'POST',headers,body:JSON.stringify({body:comment})});
 if(!response.ok)throw Error('ER1_B_ISSUE_REPORT_UPLOAD_FAILED');
 return {status:result.status,code:result.code,uploaded};
}

async function main(){
 try{
  const event=JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH,'utf8'));
  const request=validateIssue(event,process.env);
  const result=await submitReport({event,env:process.env,request,
   readReport:()=>fs.readFileSync(path.join(ROOT,resultFileName(request.requestId)),'utf8')});
  process.stdout.write(`ER1_REPORT_POSTED STATUS=${result.status} FILES=${result.uploaded}/2\n`);
 }catch{process.stderr.write('ER1_B_ISSUE_REPORT_FAILED_INSPECT_PC_LEDGER\n');
  process.exitCode=1;}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))
 await main();

#!/usr/bin/env node
// Recover only sanitized, bounded A-grade SHA evidence to private GitHub.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {authorizePreviewRequest,resultPath} from './preview-entry.mjs';

const REPO='ansqhd5774-Choi/zgmini-pc-control';
const HASH=/^[0-9a-f]{64}$/i;
const CODE=/^WRITER_B_(?:PREVIEW|INSERT)_[A-Z0-9_]+$/;
const RESULT='ZGMINI_WRITER_B_INSERT_PREVIEW_RESULT_V1';
const MARKER=(num,id)=>`<!-- writer-b-insert-preview:${num}:${id} -->`;
const headers=token=>({accept:'application/vnd.github+json',
 authorization:`Bearer ${token}`,'x-github-api-version':'2022-11-28',
 'content-type':'application/json','user-agent':'zgmini-writer-b-insert-preview'});
const ok=r=>r&&r.status>=200&&r.status<300;
export function sanitizePreview(raw,req,num){
 const safe={schema:RESULT,requestId:req.requestId,chatId:req.chatId,
  issueNumber:num,status:'BLOCKED',code:'WRITER_B_PREVIEW_RESULT_UNVERIFIED',
  pcSourceWrites:0,taskWrites:0,dbWrites:0,d1Writes:0,providerCalls:0};
 if(raw?.schema!==RESULT||raw.requestId!==req.requestId||
  raw.chatId!==req.chatId||raw.issueNumber!==num|| 
  ['pcSourceWrites','taskWrites','dbWrites','d1Writes','providerCalls']
   .some(k=>raw[k]!==0))return safe;
 if(raw.status==='BLOCKED'&&CODE.test(raw.code??''))
  return {...safe,code:raw.code};
 if(raw.status!=='PASS_READONLY'||raw.code!=='WRITER_B_INSERT_PREVIEW_VERIFIED'||
  !HASH.test(raw.beforeSha256??'')||!HASH.test(raw.afterSha256??'')||
  !HASH.test(raw.taskXmlSha256??'')||
  !/^[a-f0-9]{40}$/i.test(raw.baseHead??'')||
  !/^scripts\/pc-writer\/[a-z0-9][a-z0-9._-]{0,127}\.mjs$/i.test(raw.filePath??'')||
  !Number.isInteger(raw.insertions)||raw.insertions<1||raw.insertions>16)return safe;
 return {...safe,status:'PASS_READONLY',code:raw.code,
  beforeSha256:raw.beforeSha256,afterSha256:raw.afterSha256,
  taskXmlSha256:raw.taskXmlSha256,baseHead:raw.baseHead,
  filePath:raw.filePath,insertions:raw.insertions};
}

export async function uploadPreview({event,env,readReport,apiFetch=fetch}={}){
 const req=authorizePreviewRequest(event,env);
 if(typeof env.GITHUB_TOKEN!=='string'||env.GITHUB_TOKEN.length<20)
  throw Error('WRITER_B_PREVIEW_UPLOAD_AUTH_STOP');
 let raw;
 try{
  const t=readReport();
  if(typeof t!=='string'||Buffer.byteLength(t)>4096)throw Error('BAD');
  raw=JSON.parse(t);
 }catch{raw={};}
 const report=sanitizePreview(raw,req,event.issue.number);
 const json=JSON.stringify(report,null,2)+'\n';
 const marker=MARKER(event.issue.number,req.requestId);
 const base=`https://api.github.com/repos/${REPO}`;
 const h=headers(env.GITHUB_TOKEN);
 const prior=await apiFetch(`${base}/issues/${event.issue.number}/comments?per_page=100`,
  {method:'GET',headers:h});
 if(!ok(prior))throw Error('WRITER_B_PREVIEW_COMMENT_STATE_UNKNOWN');
 const comments=await prior.json();
 if(!Array.isArray(comments)||comments.length>=100)
  throw Error('WRITER_B_PREVIEW_COMMENT_STATE_UNKNOWN');
 if(comments.some(c=>c.user?.login==='github-actions[bot]'&&
  c.user?.type==='Bot'&&typeof c.body==='string'&&c.body.includes(marker)))
  return {status:report.status,alreadyReported:true};
 const prefix=`results/writer-b-insert-preview-${event.issue.number}-${req.requestId}`;
 const txt=`STATUS=${report.status}\nCODE=${report.code}\nAFTER_SHA256=${report.afterSha256??'UNVERIFIED'}\nTASK_XML_SHA256=${report.taskXmlSha256??'UNVERIFIED'}\nPC_SOURCE_WRITES=0\n`;
 let saved=0;
 for(const [filename,content] of [[prefix+'.json',json],[prefix+'.txt',txt]]){
  try{
   const response=await apiFetch(`${base}/contents/${filename}`,{
    method:'PUT',headers:h,body:JSON.stringify({
     message:`chore(writer-b): read-only insertion preview ${req.requestId}`,
     content:Buffer.from(content).toString('base64')})});
   if(response.status===201)saved++;
  }catch{}
 }
 const body=`${marker}\n**${report.status} — ${report.code}**\nRESULT_UPLOAD: ${saved}/2\n\n`+
  '```json\n'+json.trim()+'\n```';
 const comment=await apiFetch(`${base}/issues/${event.issue.number}/comments`,{
  method:'POST',headers:h,body:JSON.stringify({body})});
 if(!ok(comment))throw Error('WRITER_B_PREVIEW_UPLOAD_COMMENT_UNVERIFIED');
 return {status:report.status,files:saved};
}

async function main(){
 try{
  const env=process.env;
  const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
  const r=await uploadPreview({event,env,readReport:()=>
   fs.readFileSync(resultPath(env),'utf8')});
  process.stdout.write(`WRITER_B_PREVIEW_REPORT ${r.status} FILES=${r.files??0}/2\n`);
 }catch{
  process.stderr.write('WRITER_B_PREVIEW_REPORT_UNVERIFIED_NO_RETRY\n');
  process.exitCode=1;
 }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))
 await main();

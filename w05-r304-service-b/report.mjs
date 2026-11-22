#!/usr/bin/env node
// Exact W05 B one-shot sanitized result-pair publisher. Never uploads raw BLS payloads or keys.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {sha256,validateIssue,CONTROL_REPO,expect,fail} from './contract.mjs';
import {readApprovalBytes} from './approval-bytes.mjs';
const JSON_NAME='W05_R304_B_RESULT.json';
const FIELDS=['schema','status','code','requestId','sourceSha','provider','series',
 'providerCalls','dbWrites','d1Writes','schedulerChanges','automaticRetries',
 'rows','observationAt','retrievedAt','firstSeenAt','snapshotSha256','chunkSha256'];
const ALLOWED_STATUSES=new Set(['PASS','BLOCKED','RUNTIME_FAILED','STATE_UNKNOWN']);
const PREFIX='ZGMINI_W05_R304_SERVICE_B_RESULT_V1';
const API=`https://api.github.com/repos/${CONTROL_REPO}`;
const safeName=value=>typeof value==='string'&&/^pc-w05-r304-[a-f0-9-]{36}$/.test(value);
export function sanitizedReport(report,requestId,{expectedSourceSha=null}={}){
 expect(report&&typeof report==='object'&&!Array.isArray(report),'W05_B_REPORT_SHAPE_STOP');
 expect(report.schema===PREFIX&&report.requestId===requestId&&
   ALLOWED_STATUSES.has(report.status)&&
   typeof report.code==='string'&&/^W05_B_[A-Z0-9_]{1,90}$/.test(report.code)&&
   report.d1Writes===0&&report.schedulerChanges===0&&report.automaticRetries===0&&
   report.provider==='BLS'&&report.series==='WPSFD42'&&
   (report.sourceSha===null||(typeof report.sourceSha==='string'&&/^[a-f0-9]{40}$/.test(report.sourceSha)&&report.sourceSha!=='0'.repeat(40)))&&
   (report.status!=='PASS'||report.sourceSha!==null)&&
   (expectedSourceSha===null||report.sourceSha===null||report.sourceSha===expectedSourceSha)&&
   (report.providerCalls===1||report.providerCalls==='NOT_CONFIRMED')&&
   ['COMMITTED_IDEMPOTENT','NOT_CONFIRMED'].includes(report.dbWrites)&&
   (report.rows===undefined||(Number.isInteger(report.rows)&&report.rows>=1&&report.rows<=400))&&
   (report.observationAt===undefined||/^\d{4}-(0[1-9]|1[0-2])-01$/.test(report.observationAt))&&
   (report.retrievedAt===undefined||(typeof report.retrievedAt==='string'&&
     Number.isFinite(Date.parse(report.retrievedAt))))&&
   (report.firstSeenAt===undefined||(typeof report.firstSeenAt==='string'&&
     Number.isFinite(Date.parse(report.firstSeenAt))))&&
   (report.snapshotSha256===undefined||/^[a-f0-9]{64}$/.test(report.snapshotSha256))&&
   (report.chunkSha256===undefined||/^[a-f0-9]{64}$/.test(report.chunkSha256))&&
   Object.keys(report).every(k=>FIELDS.includes(k)),
  'W05_B_REPORT_CONTRACT_STOP');
 return report;
}
function headers(token){
 return {'authorization':`Bearer ${token}`,'accept':'application/vnd.github+json',
  'x-github-api-version':'2022-11-28','content-type':'application/json',
  'user-agent':'zgmini-w05-r304-once'};
}
export async function writeAndVerify(url,body,env,apiFetch){
 const data=Buffer.from(body,'utf8');
 // Never update existing results or rerun the provider/SQLite effect.
 // PUT failure may be an already-created file or an ambiguous response.
 try{
  const response=await apiFetch(url,{method:'PUT',headers:headers(env.GITHUB_TOKEN),
   body:JSON.stringify({message:'evidence(w05): record R3-04 one-shot B result',
    content:data.toString('base64')})});
  if(response.status!==201)fail('W05_B_REMOTE_RESULT_CREATE_STOP');
 }catch{/* Only exact authenticated GET can reconcile this state. */}
 let read;
 try{read=await apiFetch(url+'?ref=main',{method:'GET',headers:headers(env.GITHUB_TOKEN)})}
 catch{fail('W05_B_REMOTE_RESULT_READBACK_STOP')}
 if(!read.ok)fail('W05_B_REMOTE_RESULT_READBACK_STOP');
 let fetched;
 try{fetched=await read.json()}
 catch{fail('W05_B_REMOTE_RESULT_READBACK_STOP')}
 expect(fetched?.encoding==='base64'&&typeof fetched?.content==='string',
  'W05_B_REMOTE_RESULT_READBACK_STOP');
 const encoded=fetched.content.replace(/\s/g,'');
 expect(/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)&&encoded.length%4===0,
  'W05_B_REMOTE_RESULT_READBACK_STOP');
 const raw=Buffer.from(encoded,'base64');
 expect(raw.equals(data),'W05_B_REMOTE_RESULT_HASH_STOP');
}
export async function upload(env=process.env,apiFetch=fetch){
 expect(typeof env.GITHUB_TOKEN==='string'&&env.GITHUB_TOKEN.length>20&&
  env.GITHUB_REPOSITORY===CONTROL_REPO,'W05_B_REPORT_AUTH_STOP');
 const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
 const req=validateIssue(event,env);
 expect(safeName(req.requestId),'W05_B_REPORT_REQUEST_STOP');
 const input=path.join(env.RUNNER_TEMP,JSON_NAME);
 let result;
 try {
  if(!fs.existsSync(input))fail('W05_B_LOCAL_RESULT_MISSING_STOP');
  const raw=readApprovalBytes();
  expect(sha256(raw)===req.approvalSha256,'W05_B_REPORT_MANIFEST_PIN_STOP');
  const expectedSourceSha=JSON.parse(raw.toString('utf8')).installedSourceSha;
  expect(typeof expectedSourceSha==='string'&&/^[a-f0-9]{40}$/.test(expectedSourceSha),
   'W05_B_REPORT_SOURCE_PIN_STOP');
  result=sanitizedReport(JSON.parse(fs.readFileSync(input,'utf8')),req.requestId,{expectedSourceSha});
 }catch(e){
  // Never upload an unverified local payload or claim an effect result.
  // An unreadable/malformed result after a possible DB commit is STATE_UNKNOWN.
  const code=e?.code==='W05_B_LOCAL_RESULT_MISSING_STOP'?
   'W05_B_LOCAL_RESULT_MISSING_STOP':'W05_B_LOCAL_RESULT_UNVERIFIED_STOP';
  result={schema:PREFIX,requestId:req.requestId,status:'STATE_UNKNOWN',
   code,sourceSha:null,provider:'BLS',
   series:'WPSFD42',providerCalls:'NOT_CONFIRMED',
   dbWrites:'NOT_CONFIRMED',d1Writes:0,schedulerChanges:0,automaticRetries:0};
 }
 const stem=`results/w05-r304-service-${req.requestId}`;
 const json=JSON.stringify(result,null,2)+'\n';
 const txt=[
  'REQUEST_ID='+req.requestId,
  'STATUS='+result.status,'CODE='+result.code,
  'SOURCE_SHA='+(result.sourceSha||'NONE'),
  'SERIES=WPSFD42','PROVIDER_CALLS='+result.providerCalls,
  'DB_WRITES='+result.dbWrites,'D1_WRITES=0','SCHEDULER_CHANGES=0',
  'ROWS='+(result.rows??'UNKNOWN'),
  'OBSERVATION_AT='+(result.observationAt??'UNKNOWN'),
  'RETRIEVED_AT='+(result.retrievedAt??'UNKNOWN'),
  'FIRST_SEEN_AT='+(result.firstSeenAt??'UNKNOWN'),
  'SNAPSHOT_SHA256='+(result.snapshotSha256??'NONE'),
  'CHUNK_SHA256='+(result.chunkSha256??'NONE'),
  'RETRY=NO_REEXECUTE',
 ].join('\n')+'\n';
 await writeAndVerify(`${API}/contents/${stem}.json`,json,env,apiFetch);
 await writeAndVerify(`${API}/contents/${stem}.txt`,txt,env,apiFetch);
 const text=`W05 R3-04 B result: **${result.status}** (${result.code})\n`+
   'DELIVERY: RESULT_PAIR_READBACK_VERIFIED\n'+
   'RESULT_CREATED: 2/2; RESULT_READBACK: 2/2\n'+
   'RETRY: NO_REEXECUTE\n'+
   `[JSON](https://github.com/${CONTROL_REPO}/blob/main/${stem}.json) / `+
   `[TXT](https://github.com/${CONTROL_REPO}/blob/main/${stem}.txt)`;
 const comment=await apiFetch(`${API}/issues/${event.issue.number}/comments`,{
  method:'POST',headers:headers(env.GITHUB_TOKEN),body:JSON.stringify({body:text})});
 expect(comment.status===201,'W05_B_RESULT_COMMENT_STOP');
 return {status:'RESULT_PAIR_READBACK_VERIFIED',requestId:req.requestId};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 if(process.argv.length!==2)fail('W05_B_REPORT_ARGUMENTS_STOP');
 await upload();
}

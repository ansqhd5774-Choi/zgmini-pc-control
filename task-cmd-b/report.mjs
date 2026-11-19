#!/usr/bin/env node
// Fixed R47 B one-shot result writer. Create-only GitHub JSON/TXT and
// byte-identical remote readback before posting a success result comment.
import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {R47_B_ISSUE} from './approval-intake.mjs';
const stop=code=>{throw Object.assign(new Error(code),{code});};
const need=(ok,code)=>{if(!ok)stop(code);};
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const CODE=/^TASK_CMD_B_[A-Z0-9_]{1,100}$/;
const SHA=/^[a-f0-9]{64}$/;
const sum=b=>createHash('sha256').update(b).digest('hex');
function api(method,endpoint,token,body){
 return new Promise((resolve,reject)=>{
  const payload=body===undefined?null:Buffer.from(JSON.stringify(body));
  const req=https.request({protocol:'https:',hostname:'api.github.com',
   method,path:endpoint,timeout:25000,headers:{
    'user-agent':'zgmini-task-cmd-b-once',
    'accept':'application/vnd.github+json',
    'x-github-api-version':'2022-11-28',
    'authorization':`Bearer ${token}`,
    ...(payload?{'content-type':'application/json',
     'content-length':String(payload.length)}:{})}},
   res=>{const chunks=[];let size=0;
    res.on('data',x=>{size+=x.length;if(size<=300000)chunks.push(x)});
    res.on('end',()=>{if(size>300000)return reject(Error('RESPONSE_SIZE'));
     let parsed;try{parsed=JSON.parse(Buffer.concat(chunks).toString('utf8'))}
     catch{return reject(Error('RESPONSE_JSON'))}
     if(res.statusCode<200||res.statusCode>=300)return reject(Error('RESPONSE_STATUS'));
     resolve(parsed);
    });
   });
  req.on('error',reject);req.on('timeout',()=>req.destroy(Error('TIMEOUT')));
  if(payload)req.write(payload);req.end();
 });
}
export function buildR47Report({event,env,local}){
 const issue=event?.issue;
 need(env?.GITHUB_REPOSITORY===R47_B_ISSUE.repository&&
  env.GITHUB_EVENT_NAME==='issues'&&env.GITHUB_EVENT_ACTION==='opened'&&
  env.GITHUB_ACTOR===R47_B_ISSUE.actor&&env.GITHUB_RUN_ATTEMPT==='1'&&
  env.GITHUB_WORKFLOW==='ZGMINI Approved Runtime B Once'&&
  event?.repository?.full_name===R47_B_ISSUE.repository&&
  event?.repository?.private===true&&
  event?.sender?.login===R47_B_ISSUE.actor&&
  issue?.user?.login===R47_B_ISSUE.actor&&
  issue?.title===R47_B_ISSUE.title&&
  issue?.labels?.some(x=>x.name===R47_B_ISSUE.label)&&
  Number.isSafeInteger(issue?.number)&&issue.number>0,
  'TASK_CMD_B_REPORT_EVENT_STOP');
 let request;
 try{request=JSON.parse(issue.body)}catch{stop('TASK_CMD_B_REPORT_REQUEST_STOP')}
 need(UUID.test(request?.requestId??'')&&
  request?.schema===R47_B_ISSUE.requestSchema&&
  request?.operation===R47_B_ISSUE.operation&&
  SHA.test(request?.approvalManifestSha256??'')&&
  /^\d{1,18}$/.test(env.GITHUB_RUN_ID??''),
  'TASK_CMD_B_REPORT_REQUEST_STOP');
 const phases=env.R47_PIN_OUTCOME==='success'&&
  env.R47_CANDIDATE_OUTCOME==='success'&&
  env.R47_APPLY_OUTCOME==='success';
 const localPass=local?.status==='PASS'&&
  local?.code==='TASK_CMD_B_ONEFILE_CAS_READBACK_VERIFIED'&&
  local?.requestId===request.requestId;
 const state=phases&&localPass?'PASS':
  (local?.status==='STOP'&&CODE.test(local?.code??'')?'STOP':'STATE_UNKNOWN');
 const code=state==='PASS'?'TASK_CMD_B_ONEFILE_CAS_READBACK_VERIFIED':
  (state==='STOP'?local.code:'TASK_CMD_B_RESULT_UNVERIFIED_STOP');
 return Object.freeze({schema:'ZGMINI_R47_CMD_B_RESULT_V1',
  requestId:request.requestId,issueNumber:issue.number,
  runId:String(env.GITHUB_RUN_ID),runAttempt:1,
  controlSha:env.GITHUB_SHA??null,
  approvalManifestSha256:request.approvalManifestSha256,
  status:state,code,sourceEffectFiles:state==='PASS'?1:0,
  providerCalls:0,sqliteWrites:0,d1Writes:0,
  taskDefinitionChanges:0,replay:'FORBIDDEN'});
}
export async function createAndReadback(relative,bytes,token,apiCall=api){
 const prefix=`/repos/${R47_B_ISSUE.repository}`;
 const endpoint=`${prefix}/contents/${relative}`;
 // Only reconcile exact immutable bytes after an existing/ambiguous PUT.
 // Never overwrite or repeat the B effect to repair evidence delivery.
 try{
  await apiCall('PUT',endpoint,token,{message:`record exact R47 CMD B result ${relative}`,
   content:bytes.toString('base64'),branch:'main'});
 }catch{/* Existing or uncertain: exact authenticated GET is required below. */}
 let value;
 try{value=await apiCall('GET',endpoint+'?ref=main',token)}
 catch{stop('TASK_CMD_B_REMOTE_READBACK_STOP')}
 need(value?.encoding==='base64'&&typeof value.content==='string'&&
  Buffer.from(value.content.replace(/\s/g,''),'base64').equals(bytes),
  'TASK_CMD_B_REMOTE_READBACK_STOP');
}
export async function publishR47Report({event,env,local,token}){
 need(typeof token==='string'&&token.length>20,
  'TASK_CMD_B_REPORT_TOKEN_STOP');
 const report=buildR47Report({event,env,local});
 const b=Buffer.from(JSON.stringify(report)+'\n','utf8');
 const txt=Buffer.from(
  `STATUS=${report.status}\nCODE=${report.code}\nREQUEST_ID=${report.requestId}\n`+
  `RUN_ID=${report.runId}\nMANIFEST_SHA256=${report.approvalManifestSha256}\n`+
  `RESULT_SHA256=${sum(b)}\n`,'utf8');
 const root=`results/task-cmd-b-${report.requestId}`;
 await createAndReadback(root+'.json',b,token);
 await createAndReadback(root+'.txt',txt,token);
 await api('POST',`/repos/${R47_B_ISSUE.repository}/issues/${report.issueNumber}/comments`,
  token,{body:`R47_CMD_B_RESULT_READBACK_V1\nstatus: ${report.status}\ncode: ${report.code}\nrequestId: ${report.requestId}\nrunId: ${report.runId}\nJSON/TXT: 2/2 raw-byte verified\noperationalEffect: ${report.status==='PASS'?'EXACT_ONEFILE_READBACK_VERIFIED':'NOT_VERIFIED'}\n`});
 return report;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const env=process.env;
  const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
  let local=null;
  try{local=JSON.parse(fs.readFileSync(path.join(env.RUNNER_TEMP,
   'task-cmd-b-result.json'),'utf8'));}catch{}
  const result=await publishR47Report({event,env,local,token:env.GITHUB_TOKEN});
  process.stdout.write(JSON.stringify({status:result.status,code:result.code})+'\n');
 }catch(e){
  process.stdout.write(JSON.stringify({status:'STATE_UNKNOWN',
   code:CODE.test(e?.code??'')?e.code:
    'TASK_CMD_B_REPORT_READBACK_UNVERIFIED_STOP'})+'\n');
  process.exitCode=1;
 }
}

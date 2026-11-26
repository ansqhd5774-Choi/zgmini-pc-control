#!/usr/bin/env node
// Sanitized create-only Task B JSON/TXT: no principal, XML, command lines,
// private data or credentials may be uploaded.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {uploadResultPairAtomic} from '../writer-config-b/result-pair-atomic.mjs';
import {readCommittedTaskCreateB} from './trusted-approval.mjs';
import {createOperatingTaskCreateBPort} from './windows-adapter.mjs';
import {ISSUE_TITLE,ISSUE_LABEL,REQUEST_SCHEMA,RESULT_SCHEMA,TASK} from './contract.mjs';
const REPO='ansqhd5774-Choi/zgmini-pc-control',OWNER='ansqhd5774-Choi';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const HASH=/^[a-f0-9]{64}$/;
const CODE=/^TASK_CREATE_B_[A-Z0-9_]{3,100}$/;
const stop=c=>{throw Object.assign(Error(c),{code:c});};
const need=(v,c)=>{if(!v)stop(c);};
const headers=token=>({
 accept:'application/vnd.github+json',authorization:'Bearer '+token,
 'x-github-api-version':'2022-11-28','content-type':'application/json',
 'user-agent':'zgmini-task-create-b'});

function readRequest(event,env){
 need(env?.GITHUB_REPOSITORY===REPO&&env.GITHUB_EVENT_NAME==='issues'&&
  env.GITHUB_EVENT_ACTION==='opened'&&env.GITHUB_ACTOR===OWNER&&
  env.GITHUB_RUN_ATTEMPT==='1'&&event?.repository?.full_name===REPO&&
  event.repository.private===true&&event.sender?.login===OWNER&&
  event.issue?.user?.login===OWNER&&event.issue?.title===ISSUE_TITLE&&
  !event.issue.pull_request&&
  event.issue.labels?.some(x=>x.name===ISSUE_LABEL)&&
  Number.isSafeInteger(event.issue.number)&&event.issue.number>0,
  'TASK_CREATE_B_REPORT_ORIGIN_STOP');
 let req;try{req=JSON.parse(event.issue.body);}
 catch{stop('TASK_CREATE_B_REPORT_REQUEST_STOP');}
 need(req.schema===REQUEST_SCHEMA&&req.operation==='task-create-once'&&
  UUID.test(req.requestId??'')&&
  HASH.test(req.approvalManifestSha256??''),
  'TASK_CREATE_B_REPORT_REQUEST_STOP');
 return req;
}
export function sanitizeTaskCreateB(raw,request,{verified=false}={}){
 const base={schema:RESULT_SCHEMA,requestId:request.requestId,
  taskName:TASK,status:'TASK_CREATE_B_STATE_UNKNOWN',
  code:'TASK_CREATE_B_RESULT_UNVERIFIED_STOP',
  installed:null,taskChanges:null,otherTaskChanges:0,
  installerProviderCalls:0,installerSqliteWrites:0,installerD1Writes:0,
  scheduledRuntimeEffects:'UNVERIFIED_UNTIL_NATURAL_TICKS',
  retry:'READ_ONLY_RECONCILE_NO_REEXECUTE'};
 if(raw?.schema!==RESULT_SCHEMA||raw.requestId!==request.requestId||
  raw.taskName!==TASK||!CODE.test(raw.code??''))return base;
 if(raw.status==='TASK_CREATE_B_INSTALLED_VERIFIED'&&
  raw.code==='TASK_CREATE_B_ONE_TASK_ENABLE_READBACK_PASS'&&
  raw.created===true&&raw.taskChanges===1&&
  raw.otherTaskChanges===0&&verified===true)
  return {...base,status:raw.status,code:raw.code,
   installed:true,taskChanges:1};
 if(['TASK_CREATE_B_PREFLIGHT_STOP','TASK_CREATE_B_INSTALL_STOP_RESTORED'].includes(raw.status)&&
  raw.created===false&&raw.taskChanges===0)
  return {...base,status:raw.status,code:raw.code,
   installed:false,taskChanges:0};
 if(raw.status==='TASK_CREATE_B_RECOVERY_REQUIRED')
  return {...base,status:raw.status,code:raw.code,
   installed:null,taskChanges:null};
 return base;
}
const plain=x=>[
 'SCHEMA='+x.schema,'REQUEST_ID='+x.requestId,'TASK='+x.taskName,
 'STATUS='+x.status,'CODE='+x.code,'INSTALLED='+x.installed,
 'TASK_CHANGES='+(x.taskChanges??'UNKNOWN'),
 'OTHER_TASK_CHANGES='+x.otherTaskChanges,
 'SCHEDULED_RUNTIME='+x.scheduledRuntimeEffects,'RETRY='+x.retry,''].join('\n');

export async function reportTaskCreateB({event,env,raw,fetchApi=fetch,
 controlRoot}={}){
 const req=readRequest(event,env);
 need(typeof env.GITHUB_TOKEN==='string'&&env.GITHUB_TOKEN.length>=20,
  'TASK_CREATE_B_REPORT_TOKEN_STOP');
 let parsed;try{parsed=JSON.parse(raw);}catch{parsed=null;}
 let verified=false;
 if(parsed?.status==='TASK_CREATE_B_INSTALLED_VERIFIED'){
  try{
   const proof=readCommittedTaskCreateB({event,env,controlRoot});
   const port=createOperatingTaskCreateBPort(proof);
   const observed=await port.observe();
   verified=observed.taskExists===true&&observed.wrapperExists===true&&
    observed.installedSourceSha===proof.manifest.installedSourceSha&&
    observed.configSourceSha===proof.manifest.installedSourceSha&&
    await port.taskReadback({name:TASK,enabled:true,
     definitionTemplateSha256:proof.manifest.enabledTemplateSha256})===true&&
    await port.launcherReadback(proof.manifest.wrapperPath,
     proof.manifest.launcherSha256)===true;
  }catch{verified=false;}
 }
 const report=sanitizeTaskCreateB(parsed,req,{verified});
 const prefix='results/task-create-b-'+req.requestId;
 const pair=await uploadResultPairAtomic({
  fetchApi,headers:headers(env.GITHUB_TOKEN),
  message:'chore(task-create-b): exact once redacted B result pair',
  outputs:[[prefix+'.json',JSON.stringify(report,null,2)+'\n'],
   [prefix+'.txt',plain(report)]]});
 const body='<!-- task-create-b:'+req.requestId+' -->\n'+
  'W06 exact Task B: '+report.status+'/'+report.code+
  '; JSON/TXT '+pair.verified+'/2. No automatic re-execution. '+
  'Natural CNN HTTP/SQLite/D1/API/UI is separately unverified.';
 const response=await fetchApi('https://api.github.com/repos/'+REPO+
  '/issues/'+event.issue.number+'/comments',{
   method:'POST',headers:headers(env.GITHUB_TOKEN),body:JSON.stringify({body})});
 need(response.status===201,'TASK_CREATE_B_REPORT_COMMENT_STOP');
 return {status:report.status,verified:pair.verified,created:pair.created};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const env=process.env;
  const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
  let raw='{}';
  try{raw=fs.readFileSync(path.join(env.RUNNER_TEMP,
   'task-create-b-result.json'),'utf8');}catch{}
  const result=await reportTaskCreateB({env,event,raw,
   controlRoot:path.join(env.GITHUB_WORKSPACE,'writer-b-control')});
  process.stdout.write('TASK_CREATE_B_REPORT '+result.status+' '+result.verified+'/2\n');
 }catch{
  process.stderr.write('TASK_CREATE_B_REPORT_UNKNOWN_NO_REPLAY\n');
  process.exitCode=1;
 }
}

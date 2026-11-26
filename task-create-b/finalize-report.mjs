#!/usr/bin/env node
// Create-only redacted original-owned W06 B finalize receipt. No raw Task, ID or
// credential content beyond pre-authorized UUID/Task name.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {uploadResultPairAtomic} from '../writer-config-b/result-pair-atomic.mjs';
import {TASK} from './contract.mjs';
import {authorizeW06Finalize,RESULT_SCHEMA,RECOVERY_ID} from './finalize-contract.mjs';
import {createW06FinalizationPort} from './finalize-windows.mjs';
import {ORIGIN} from './recovery-contract.mjs';
const REPO='ansqhd5774-Choi/zgmini-pc-control';
const CODE=/^TASK_FINALIZE_B_[A-Z0-9_]{3,100}$/;
const need=(v,c)=>{if(!v)throw Object.assign(Error(c),{code:c})};
const headers=t=>({accept:'application/vnd.github+json',
 authorization:'Bearer '+t,'x-github-api-version':'2022-11-28',
 'content-type':'application/json','user-agent':'zgmini-w06-task-finalize-b'});
export function sanitizeW06Finalization(raw,req,{verified=false}={}){
 const base={schema:RESULT_SCHEMA,requestId:req.requestId,
  recoveryRequestId:RECOVERY_ID,originalCreateRequestId:ORIGIN,taskName:TASK,
  status:'TASK_FINALIZE_B_STATE_UNKNOWN',code:'TASK_FINALIZE_B_RESULT_UNVERIFIED_STOP',
  installed:null,taskChanges:0,otherTaskChanges:0,ownerLockReleased:null,
  installerProviderCalls:0,installerSqliteWrites:0,installerD1Writes:0,
  scheduledRuntimeEffects:'UNVERIFIED_UNTIL_NATURAL_TICKS',
  retry:'READ_ONLY_RECONCILE_NO_REEXECUTE'};
 if(raw?.schema!==RESULT_SCHEMA||raw.requestId!==req.requestId||
  raw.recoveryRequestId!==RECOVERY_ID||raw.originalCreateRequestId!==ORIGIN||
  !CODE.test(raw.code??''))return base;
 if(raw.status==='TASK_FINALIZE_B_FINALIZED_VERIFIED'&&
  raw.code==='TASK_FINALIZE_B_EXACT_OWNER_RELEASE_PASS'&&
  raw.installed===true&&raw.taskChanges===0&&verified===true)
  return {...base,status:raw.status,code:raw.code,installed:true,
   ownerLockReleased:true};
 if(['TASK_FINALIZE_B_PREFLIGHT_STOP','TASK_FINALIZE_B_RECOVERY_REQUIRED'].includes(raw.status))
  return {...base,status:raw.status,code:raw.code};
 return base;
}
export async function reportW06Finalization({event,env,raw,controlRoot,fetchApi=fetch}={}){
 const proof=authorizeW06Finalize({event,env,controlRoot});
 need(typeof env.GITHUB_TOKEN==='string'&&env.GITHUB_TOKEN.length>=20,
  'TASK_FINALIZE_B_REPORT_TOKEN_STOP');
 let parsed;try{parsed=JSON.parse(raw)}catch{parsed=null}
 let verified=false;
 if(parsed?.status==='TASK_FINALIZE_B_FINALIZED_VERIFIED'){
  try{verified=await createW06FinalizationPort(proof).readback(proof.request.requestId)}
  catch{verified=false}
 }
 const report=sanitizeW06Finalization(parsed,proof.request,{verified});
 const prefix='results/task-finalize-b-'+proof.request.requestId;
 const plain=['SCHEMA='+report.schema,'REQUEST_ID='+report.requestId,
  'RECOVERY_REQUEST_ID='+report.recoveryRequestId,
  'ORIGINAL_CREATE_ID='+report.originalCreateRequestId,'TASK='+report.taskName,
  'STATUS='+report.status,'CODE='+report.code,
  'INSTALLED='+report.installed,'OWNER_LOCK_RELEASED='+report.ownerLockReleased,
  'TASK_CHANGES=0','OTHER_TASK_CHANGES=0',
  'SCHEDULED_RUNTIME='+report.scheduledRuntimeEffects,
  'RETRY='+report.retry,''].join('\n');
 const pair=await uploadResultPairAtomic({
  fetchApi,headers:headers(env.GITHUB_TOKEN),
  message:'chore(W06): exact finalization B result pair',
  outputs:[[prefix+'.json',JSON.stringify(report,null,2)+'\n'],[prefix+'.txt',plain]]});
 const body='<!-- task-finalize-b:'+proof.request.requestId+' -->\n'+
  'W06 B owner-lock finalization: '+report.status+'/'+report.code+
  '; JSON/TXT '+pair.verified+'/2. No Task mutation or automatic re-execution. '+
  'CNN HTTP/SQLite/D1/API/UI need independent natural tick evidence.';
 const response=await fetchApi('https://api.github.com/repos/'+REPO+
  '/issues/'+event.issue.number+'/comments',{
   method:'POST',headers:headers(env.GITHUB_TOKEN),body:JSON.stringify({body})});
 need(response.status===201,'TASK_FINALIZE_B_REPORT_COMMENT_STOP');
 return {status:report.status,verified:pair.verified};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const env=process.env,event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
  let raw='{}';try{raw=fs.readFileSync(path.join(env.RUNNER_TEMP,
   'task-finalize-b-result.json'),'utf8')}catch{}
  const x=await reportW06Finalization({event,env,raw,
   controlRoot:path.join(env.GITHUB_WORKSPACE,'writer-b-control')});
  process.stdout.write('TASK_FINALIZE_B_REPORT '+x.status+' '+x.verified+'/2\n');
 }catch{
  process.stderr.write('TASK_FINALIZE_B_REPORT_UNVERIFIED_NO_RETRY\n');
  process.exitCode=1;
 }
}

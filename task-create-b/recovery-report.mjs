#!/usr/bin/env node
// Private create-only JSON/TXT for one exact W06 retained Task recovery.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {uploadResultPairAtomic} from '../writer-config-b/result-pair-atomic.mjs';
import {createOperatingTaskCreateBPort} from './windows-adapter.mjs';
import {TASK} from './contract.mjs';
import {authorizeTaskRecoveryB,RECOVERY_RESULT_SCHEMA,ORIGIN}
 from './recovery-contract.mjs';

const REPO='ansqhd5774-Choi/zgmini-pc-control';
const HOME='E:\\ZGmini\\data\\pc-writer';
const COMPLETED=path.win32.join(HOME,'task-create-b',ORIGIN,'recovery-completed.json');
const CODE=/^TASK_RECOVERY_B_[A-Z0-9_]{3,100}$/;
const stop=c=>{throw Object.assign(Error(c),{code:c});};
const need=(v,c)=>{if(!v)stop(c);};
const headers=t=>({accept:'application/vnd.github+json',
 authorization:'Bearer '+t,'x-github-api-version':'2022-11-28',
 'content-type':'application/json','user-agent':'zgmini-w06-task-recovery-b'});
export function sanitizeRecoveryB(raw,request,verified){
 const base={schema:RECOVERY_RESULT_SCHEMA,requestId:request.requestId,
  originRequestId:ORIGIN,taskName:TASK,
  status:'TASK_RECOVERY_B_STATE_UNKNOWN',code:'TASK_RECOVERY_B_RESULT_UNVERIFIED_STOP',
  installed:null,taskChanges:null,otherTaskChanges:0,
  installerProviderCalls:0,installerSqliteWrites:0,installerD1Writes:0,
  scheduledRuntimeEffects:'UNVERIFIED_UNTIL_NATURAL_TICKS',
  retry:'READ_ONLY_RECONCILE_NO_REEXECUTE'};
 if(raw?.schema!==RECOVERY_RESULT_SCHEMA||raw.requestId!==request.requestId||
  raw.originRequestId!==ORIGIN||raw.taskName!==TASK||!CODE.test(raw.code??''))
  return base;
 if(raw.status==='TASK_RECOVERY_B_INSTALLED_VERIFIED'&&
  raw.code==='TASK_RECOVERY_B_ONE_ENABLE_READBACK_PASS'&&
  raw.installed===true&&raw.taskChanges===1&&verified===true)
  return {...base,status:raw.status,code:raw.code,installed:true,taskChanges:1};
 if(raw.status==='TASK_RECOVERY_B_RECOVERY_REQUIRED'||
    raw.status==='TASK_RECOVERY_B_PREFLIGHT_STOP')
  return {...base,status:raw.status,code:raw.code};
 return base;
}
function completedExact(requestId){
 try{
  const stat=fs.lstatSync(COMPLETED);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size<1||stat.size>2048)return false;
  const x=JSON.parse(fs.readFileSync(COMPLETED,'utf8'));
  return x.schema==='ZGMINI_TASK_RECOVERY_COMPLETE_V1'&&
   x.requestId===requestId&&x.originRequestId===ORIGIN&&x.status==='VERIFIED';
 }catch{return false}
}
async function independentReadback(proof){
 try{
  if(!completedExact(proof.request.requestId))return false;
  const p=createOperatingTaskCreateBPort(proof.originProof);
  const s=await p.observe(),m=proof.originProof.manifest;
  return s.taskExists===true&&s.wrapperExists===true&&
   s.installedSourceSha===m.installedSourceSha&&
   s.configSourceSha===m.installedSourceSha&&
   s.coreTaskXmlSha256===m.coreTaskXmlSha256&&
   s.sidecarSourceSha256===m.sidecarSourceSha256&&
   await p.launcherReadback(m.wrapperPath,m.launcherSha256)===true&&
   await p.taskReadback({name:TASK,enabled:true,
    definitionTemplateSha256:m.enabledTemplateSha256})===true&&
   await p.verifyProtectedUnchanged()===true;
 }catch{return false}
}
export async function reportRecoveryB({event,env,controlRoot,raw,fetchApi=fetch}){
 const proof=authorizeTaskRecoveryB({event,env,controlRoot});
 need(typeof env.GITHUB_TOKEN==='string'&&env.GITHUB_TOKEN.length>=20,
  'TASK_RECOVERY_B_REPORT_TOKEN_STOP');
 let parsed;try{parsed=JSON.parse(raw)}catch{parsed=null}
 const verified=parsed?.status==='TASK_RECOVERY_B_INSTALLED_VERIFIED'&&
  await independentReadback(proof);
 const data=sanitizeRecoveryB(parsed,proof.request,verified);
 const prefix='results/task-recovery-b-'+proof.request.requestId;
 const plain=['SCHEMA='+data.schema,'REQUEST_ID='+data.requestId,
  'ORIGIN_REQUEST_ID='+data.originRequestId,'TASK='+data.taskName,
  'STATUS='+data.status,'CODE='+data.code,'INSTALLED='+data.installed,
  'TASK_CHANGES='+(data.taskChanges??'UNKNOWN'),
  'OTHER_TASK_CHANGES='+data.otherTaskChanges,
  'SCHEDULED_RUNTIME='+data.scheduledRuntimeEffects,'RETRY='+data.retry,''].join('\n');
 const pair=await uploadResultPairAtomic({fetchApi,
  headers:headers(env.GITHUB_TOKEN),
  message:'chore(W06): exact retained Task recovery result pair',
  outputs:[[prefix+'.json',JSON.stringify(data,null,2)+'\n'],[prefix+'.txt',plain]]});
 const body='<!-- task-recovery-b:'+proof.request.requestId+' -->\n'+
  'W06 retained Task recovery: '+data.status+'/'+data.code+
  '; JSON/TXT '+pair.verified+'/2. No automatic re-execution. '+
  'Natural CNN HTTP/SQLite/D1/API/UI is separately unverified.';
 const response=await fetchApi('https://api.github.com/repos/'+REPO+
  '/issues/'+event.issue.number+'/comments',{
   method:'POST',headers:headers(env.GITHUB_TOKEN),body:JSON.stringify({body})});
 need(response.status===201,'TASK_RECOVERY_B_REPORT_COMMENT_STOP');
 return {status:data.status,verified:pair.verified};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const env=process.env;
  const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
  let raw='{}';
  try{raw=fs.readFileSync(path.join(env.RUNNER_TEMP,
   'task-recovery-b-result.json'),'utf8')}catch{}
  const x=await reportRecoveryB({event,env,raw,
   controlRoot:path.join(env.GITHUB_WORKSPACE,'writer-b-control')});
  process.stdout.write('TASK_RECOVERY_B_REPORT '+x.status+' '+x.verified+'/2\n');
 }catch{
  process.stderr.write('TASK_RECOVERY_B_REPORT_UNKNOWN_NO_REPLAY\n');
  process.exitCode=1;
 }
}

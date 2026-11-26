#!/usr/bin/env node
// Redacted one-shot evidence: original owner lock recovery, never raw Task XML.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readCommittedW06Recovery} from './recovery-entry.mjs';
import {RECOVERY_RESULT_SCHEMA} from './recovery-contract.mjs';
import {createOperatingTaskCreateBPort} from './windows-adapter.mjs';
import {TASK,INSTALLED_SOURCE,WRAPPER} from './contract.mjs';
import {ENABLED_TEMPLATE_SHA256,LAUNCHER_SHA256} from './recovery-contract.mjs';
import {uploadResultPairAtomic} from '../writer-config-b/result-pair-atomic.mjs';
const REPO='ansqhd5774-Choi/zgmini-pc-control';
const OWNER='ansqhd5774-Choi';
const need=(ok,code)=>{if(!ok)throw Object.assign(Error(code),{code});};
const h=token=>({accept:'application/vnd.github+json',
 authorization:'Bearer '+token,'x-github-api-version':'2022-11-28',
 'content-type':'application/json','user-agent':'zgmini-w06-owner-task-recovery'});
function sanitize(proof,raw,verified){
 const base={schema:RECOVERY_RESULT_SCHEMA,requestId:proof.request.requestId,
  ownerRequestId:proof.manifest.ownerRequestId,taskName:TASK,
  status:'TASK_RECOVERY_B_STATE_UNKNOWN',code:'TASK_RECOVERY_B_REPORT_UNVERIFIED',
  installed:null,taskChanges:null,otherTaskChanges:0,
  installerProviderCalls:0,installerSqliteWrites:0,installerD1Writes:0,
  scheduledRuntimeEffects:'UNVERIFIED_UNTIL_NATURAL_TICKS',
  retry:'READ_ONLY_RECONCILE_NO_REEXECUTE'};
 if(raw?.schema!==RECOVERY_RESULT_SCHEMA||
  raw.requestId!==proof.request.requestId||
  raw.ownerRequestId!==proof.manifest.ownerRequestId||
  raw.taskName!==TASK||!/^TASK_RECOVERY_B_[A-Z0-9_]{3,90}$/.test(raw.code??''))
  return base;
 if(raw.status==='TASK_RECOVERY_B_ENABLED_VERIFIED'&&
  raw.code==='TASK_RECOVERY_B_OWNER_CAS_NATIVE_ENABLE_PASS'&&
  raw.installed===true&&raw.taskChanges===1&&verified===true)
  return {...base,status:raw.status,code:raw.code,installed:true,taskChanges:1};
 if(raw.status==='TASK_RECOVERY_B_PREFLIGHT_STOP'&&
  raw.installed===false&&raw.taskChanges===0)
  return {...base,status:raw.status,code:raw.code,installed:false,taskChanges:0};
 if(raw.status==='TASK_RECOVERY_B_RECOVERY_REQUIRED')
  return {...base,status:raw.status,code:raw.code};
 return base;
}
export async function reportW06RecoveryB({event,env,raw,controlRoot,fetchApi=fetch}={}){
 need(env?.GITHUB_REPOSITORY===REPO&&
  env.GITHUB_EVENT_ACTION==='opened'&&
  env.GITHUB_EVENT_NAME==='issues'&&
  env.GITHUB_ACTOR===OWNER&&env.GITHUB_RUN_ATTEMPT==='1'&&
  typeof env.GITHUB_TOKEN==='string'&&env.GITHUB_TOKEN.length>=20,
  'TASK_RECOVERY_B_REPORT_ENV_STOP');
 const proof=readCommittedW06Recovery({event,env,controlRoot});
 let source;try{source=JSON.parse(raw);}catch{source=null;}
 let verified=false;
 if(source?.status==='TASK_RECOVERY_B_ENABLED_VERIFIED'){
  try{
   const port=createOperatingTaskCreateBPort(proof);
   const state=await port.observe();
   verified=state.taskExists===true&&state.wrapperExists===true&&
    state.installedSourceSha===INSTALLED_SOURCE&&
    state.configSourceSha===INSTALLED_SOURCE&&
    await port.taskReadback({name:TASK,enabled:true,
     definitionTemplateSha256:ENABLED_TEMPLATE_SHA256})===true&&
    await port.launcherReadback(WRAPPER,LAUNCHER_SHA256)===true;
  }catch{verified=false;}
 }
 const result=sanitize(proof,source,verified),prefix='results/task-recovery-b-'+proof.request.requestId;
 const plain=['SCHEMA='+result.schema,'REQUEST_ID='+result.requestId,
  'OWNER_REQUEST_ID='+result.ownerRequestId,'TASK='+TASK,
  'STATUS='+result.status,'CODE='+result.code,
  'INSTALLED='+result.installed,
  'TASK_CHANGES='+(result.taskChanges??'UNKNOWN'),
  'SCHEDULED_RUNTIME='+result.scheduledRuntimeEffects,
  'RETRY='+result.retry,''].join('\n');
 const pair=await uploadResultPairAtomic({fetchApi,headers:h(env.GITHUB_TOKEN),
  message:'chore(W06): one-shot owner Task recovery evidence pair',
  outputs:[[prefix+'.json',JSON.stringify(result,null,2)+'\n'],
   [prefix+'.txt',plain]]});
 const response=await fetchApi('https://api.github.com/repos/'+REPO+
  '/issues/'+event.issue.number+'/comments',{
   method:'POST',headers:h(env.GITHUB_TOKEN),
   body:JSON.stringify({body:'<!-- w06-task-owner-recovery:'+proof.request.requestId+' -->\n'+
    'W06 original-owner Task recovery: '+result.status+'/'+result.code+
    '; exact JSON/TXT '+pair.verified+'/2. No automatic replay. '+
    'Natural CNN HTTP/SQLite/D1/API/UI proof remains separate.'})});
 need(response.status===201,'TASK_RECOVERY_B_COMMENT_STOP');
 return {status:result.status,verified:pair.verified};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const env=process.env,event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
  let raw='{}';
  try{raw=fs.readFileSync(path.join(env.RUNNER_TEMP,'task-recovery-b-result.json'),'utf8');}
  catch{/* A missing output never claims recovery success. */}
  const r=await reportW06RecoveryB({event,env,raw,
   controlRoot:path.join(env.GITHUB_WORKSPACE,'writer-b-control')});
  process.stdout.write('W06_TASK_RECOVERY_REPORT '+r.status+' '+r.verified+'/2\n');
 }catch{
  process.stderr.write('W06_TASK_RECOVERY_REPORT_UNVERIFIED_NO_REPLAY\n');
  process.exitCode=1;
 }
}

#!/usr/bin/env node
// Fixed existing W06 Task activation, only through approved original B owner.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {authorizeTaskRecoveryB,RECOVERY_RESULT_SCHEMA} from './recovery-contract.mjs';
import {createW06RecoveryOperatingPort} from './recovery-windows.mjs';
import {recoverW06TaskB} from './recovery-transaction.mjs';

const stop=c=>{throw Object.assign(Error(c),{code:c});};
const need=(v,c)=>{if(!v)stop(c);};
const safe=e=>/^TASK_RECOVERY_B_[A-Z0-9_]{3,100}$/.test(e?.code??'')?
 e.code:'TASK_RECOVERY_B_RUNTIME_UNKNOWN_STOP';
export async function executeW06RecoveryB({event,env,controlRoot}){
 need(process.platform==='win32','TASK_RECOVERY_B_WINDOWS_ONLY_STOP');
 const proof=authorizeTaskRecoveryB({event,env,controlRoot});
 const io=createW06RecoveryOperatingPort(proof);
 return recoverW06TaskB(proof,io);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const env=process.env;
 let result={schema:RECOVERY_RESULT_SCHEMA,status:'TASK_RECOVERY_B_STATE_UNKNOWN',
  code:'TASK_RECOVERY_B_RUNTIME_UNKNOWN_STOP',installed:null,taskChanges:null,
  otherTaskChanges:0,scheduledRuntimeEffects:'UNVERIFIED_UNTIL_NATURAL_TICKS'};
 try{
  need(typeof env.GITHUB_WORKSPACE==='string'&&
   typeof env.GITHUB_EVENT_PATH==='string'&&
   typeof env.RUNNER_TEMP==='string'&&path.isAbsolute(env.RUNNER_TEMP),
   'TASK_RECOVERY_B_ENTRY_ENV_STOP');
  const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
  result=await executeW06RecoveryB({event,env,
   controlRoot:path.join(env.GITHUB_WORKSPACE,'writer-b-control')});
 }catch(e){result={...result,code:safe(e)}}
 try{fs.writeFileSync(path.join(env.RUNNER_TEMP,'task-recovery-b-result.json'),
  JSON.stringify(result)+'\n',{flag:'wx'});}
 catch{process.exitCode=1}
 process.stdout.write(result.status+' '+result.code+'\n');
 if(result.status!=='TASK_RECOVERY_B_INSTALLED_VERIFIED')process.exitCode=1;
}

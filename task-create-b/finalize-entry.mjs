#!/usr/bin/env node
// Complete original W06 B receipt/owned lock only. Never schedules or runs Task.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {authorizeW06Finalize,RESULT_SCHEMA} from './finalize-contract.mjs';
import {createW06FinalizationPort} from './finalize-windows.mjs';
import {applyW06Finalization} from './finalize-contract.mjs';
const need=(v,c)=>{if(!v)throw Object.assign(Error(c),{code:c})};
const safe=e=>/^TASK_FINALIZE_B_[A-Z0-9_]{3,100}$/.test(e?.code??'')?
 e.code:'TASK_FINALIZE_B_ENTRY_UNKNOWN_STOP';
export async function executeW06Finalize({event,env,controlRoot}){
 need(process.platform==='win32','TASK_FINALIZE_B_WINDOWS_ONLY_STOP');
 const proof=authorizeW06Finalize({event,env,controlRoot});
 const io=createW06FinalizationPort(proof);
 return applyW06Finalization(proof,io);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const env=process.env;
 let out={schema:RESULT_SCHEMA,status:'TASK_FINALIZE_B_STATE_UNKNOWN',
  code:'TASK_FINALIZE_B_ENTRY_UNKNOWN_STOP',installed:null,taskChanges:0,
  otherTaskChanges:0,providerCalls:0,sqliteWrites:0,d1Writes:0};
 try{
  need(typeof env.GITHUB_WORKSPACE==='string'&&
   typeof env.GITHUB_EVENT_PATH==='string'&&
   typeof env.RUNNER_TEMP==='string'&&path.isAbsolute(env.RUNNER_TEMP),
   'TASK_FINALIZE_B_ENV_STOP');
  const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
  out=await executeW06Finalize({event,env,
   controlRoot:path.join(env.GITHUB_WORKSPACE,'writer-b-control')});
 }catch(e){out={...out,code:safe(e)}}
 try{
  fs.writeFileSync(path.join(env.RUNNER_TEMP,'task-finalize-b-result.json'),
   JSON.stringify(out)+'\n',{flag:'wx'});
 }catch{process.exitCode=1}
 process.stdout.write(out.status+' '+out.code+'\n');
 if(out.status!=='TASK_FINALIZE_B_FINALIZED_VERIFIED')process.exitCode=1;
}

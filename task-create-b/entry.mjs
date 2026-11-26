#!/usr/bin/env node
// Fixed B Task creation receiver; no Issue-controlled OS arguments.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readCommittedTaskCreateB} from './trusted-approval.mjs';
import {loadW06TaskCandidate} from './candidate.mjs';
import {createOperatingTaskCreateBPort} from './windows-adapter.mjs';
import {applyTaskCreateB} from './transaction.mjs';
import {RESULT_SCHEMA} from './contract.mjs';
const stop=c=>{throw Object.assign(Error(c),{code:c});};
const need=(v,c)=>{if(!v)stop(c);};
const safe=e=>/^TASK_CREATE_B_[A-Z0-9_]{3,100}$/.test(e?.code??'')?
 e.code:'TASK_CREATE_B_RUNTIME_UNVERIFIED_STOP';

export async function executeW06TaskCreateB({event,env,controlRoot,candidateRoot}){
 need(process.platform==='win32','TASK_CREATE_B_WINDOWS_ONLY_STOP');
 const proof=readCommittedTaskCreateB({event,env,controlRoot});
 const io=createOperatingTaskCreateBPort(proof);
 // Read the approved Core principal before loading a candidate, then recheck
 // every protected source/config/Task preimage while holding the B install lease.
 const identity=await io.observe();
 need(identity.taskExists===false&&identity.wrapperExists===false&&
  identity.installedSourceSha===proof.manifest.installedSourceSha&&
  identity.configSourceSha===proof.manifest.installedSourceSha,
  'TASK_CREATE_B_PREVIEW_PREIMAGE_STOP');
 const candidate=await loadW06TaskCandidate(proof,{
  root:candidateRoot,account:io.operatingAccount(),now:new Date()});
 return applyTaskCreateB(proof,candidate,io);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const env=process.env;
 let result={schema:RESULT_SCHEMA,status:'TASK_CREATE_B_PREFLIGHT_STOP',
  code:'TASK_CREATE_B_RUNTIME_UNVERIFIED_STOP',created:false,
  taskChanges:0,otherTaskChanges:0,providerCalls:0,sqliteWrites:0,d1Writes:0};
 try{
  need(typeof env.GITHUB_WORKSPACE==='string'&&
   typeof env.GITHUB_EVENT_PATH==='string'&&
   typeof env.RUNNER_TEMP==='string'&&path.isAbsolute(env.RUNNER_TEMP),
   'TASK_CREATE_B_ENTRY_ENV_STOP');
  const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
  result=await executeW06TaskCreateB({event,env,
   controlRoot:path.join(env.GITHUB_WORKSPACE,'writer-b-control'),
   candidateRoot:path.join(env.GITHUB_WORKSPACE,'task-b-candidate')});
 }catch(e){
  result={...result,status:'TASK_CREATE_B_PREFLIGHT_STOP',code:safe(e)};
 }
 try{fs.writeFileSync(path.join(env.RUNNER_TEMP,'task-create-b-result.json'),
  JSON.stringify(result)+'\n',{flag:'wx'});}
 catch{process.exitCode=1;}
 process.stdout.write(result.status+' '+result.code+'\n');
 if(result.status!=='TASK_CREATE_B_INSTALLED_VERIFIED')process.exitCode=1;
}

#!/usr/bin/env node
// Existing disabled W06 minute Task only: source-pinned, one owner recovery.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {authorizeRecoveryB,applyRecoveryB,RECOVERY_MANIFEST,
 RECOVERY_RESULT_SCHEMA} from './recovery-contract.mjs';
import {makeW06TaskRecoveryPort} from './recovery-operating.mjs';
const REPO='ansqhd5774-Choi/zgmini-pc-control';
const need=(ok,code)=>{if(!ok)throw Object.assign(Error(code),{code});};
const SHA40=/^[a-f0-9]{40}$/;
const GIT=['C:\\Program Files\\Git\\cmd\\git.exe',
 'C:\\Program Files\\Git\\bin\\git.exe'].find(x=>fs.existsSync(x));
const runGit=(root,args)=>{
 need(!!GIT,'TASK_RECOVERY_B_GIT_MISSING_STOP');
 const p=spawnSync(GIT,['--no-optional-locks','-C',root,...args],{
  shell:false,windowsHide:true,encoding:'utf8',timeout:15000,
  env:{...process.env,GIT_TERMINAL_PROMPT:'0',GIT_OPTIONAL_LOCKS:'0'}});
 need(p.status===0&&!p.error,'TASK_RECOVERY_B_GIT_SCOPE_STOP');
 return p.stdout.trim();
};
export function readCommittedW06Recovery({event,env,controlRoot,io=fs,git=runGit}={}){
 need(env?.GITHUB_REPOSITORY===REPO&&SHA40.test(env.GITHUB_SHA??'')&&
  typeof controlRoot==='string'&&path.isAbsolute(controlRoot)&&
  git(controlRoot,['rev-parse','HEAD'])===env.GITHUB_SHA,
  'TASK_RECOVERY_B_CONTROL_SOURCE_STOP');
 let body;
 try{body=JSON.parse(event.issue.body);}
 catch{throw Object.assign(Error('TASK_RECOVERY_B_REQUEST_JSON_STOP'),
  {code:'TASK_RECOVERY_B_REQUEST_JSON_STOP'});}
 need(body?.approvalManifestPath===RECOVERY_MANIFEST,
  'TASK_RECOVERY_B_APPROVAL_PATH_STOP');
 const file=path.join(controlRoot,'approvals','task-create-b',
  'w06-cnn-minute-recovery-20261126.json');
 const dir=path.dirname(file);
 const stat=io.lstatSync(file),statDir=io.lstatSync(dir);
 need(stat.isFile()&&!stat.isSymbolicLink()&&
  statDir.isDirectory()&&!statDir.isSymbolicLink()&&
  stat.size>200&&stat.size<=8192,
  'TASK_RECOVERY_B_MANIFEST_FILE_STOP');
 const rootReal=io.realpathSync.native(controlRoot),
  dirReal=io.realpathSync.native(dir),fileReal=io.realpathSync.native(file);
 need(path.win32.normalize(dirReal).toLowerCase()===
  path.win32.normalize(path.join(rootReal,'approvals','task-create-b')).toLowerCase()&&
  path.win32.normalize(fileReal).toLowerCase()===
  path.win32.normalize(path.join(dirReal,path.basename(file))).toLowerCase(),
  'TASK_RECOVERY_B_MANIFEST_REDIRECT_STOP');
 for(const args of [
  ['ls-files','--error-unmatch','--',RECOVERY_MANIFEST],
  ['diff','--quiet','HEAD','--',RECOVERY_MANIFEST],
  ['diff','--cached','--quiet','HEAD','--',RECOVERY_MANIFEST]
 ])git(controlRoot,args);
 return authorizeRecoveryB({
  event,manifestBytes:io.readFileSync(file),manifestCommitted:true});
}

export async function executeW06Recovery({event,env,controlRoot}={}){
 need(process.platform==='win32','TASK_RECOVERY_B_WINDOWS_ONLY_STOP');
 const proof=readCommittedW06Recovery({event,env,controlRoot});
 return applyRecoveryB(proof,makeW06TaskRecoveryPort(proof));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const env=process.env;
 let result={schema:RECOVERY_RESULT_SCHEMA,
  requestId:null,status:'TASK_RECOVERY_B_STATE_UNKNOWN',
  code:'TASK_RECOVERY_B_UNVERIFIED_STOP',installed:null,taskChanges:null};
 try{
  need(typeof env.GITHUB_WORKSPACE==='string'&&
   typeof env.GITHUB_EVENT_PATH==='string'&&
   typeof env.RUNNER_TEMP==='string'&&path.isAbsolute(env.RUNNER_TEMP),
   'TASK_RECOVERY_B_ENTRY_ENV_STOP');
  const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
  result=await executeW06Recovery({event,env,
   controlRoot:path.join(env.GITHUB_WORKSPACE,'writer-b-control')});
 }catch(e){
  const code=/^TASK_RECOVERY_B_[A-Z0-9_]{3,90}$/.test(e?.code??'')?
   e.code:'TASK_RECOVERY_B_RUNTIME_UNVERIFIED_STOP';
  result={...result,code};
 }
 try{
  fs.writeFileSync(path.join(env.RUNNER_TEMP,'task-recovery-b-result.json'),
   JSON.stringify(result)+'\n',{flag:'wx'});
 }catch{process.exitCode=1;}
 process.stdout.write(result.status+' '+result.code+'\n');
 if(result.status!=='TASK_RECOVERY_B_ENABLED_VERIFIED')process.exitCode=1;
}

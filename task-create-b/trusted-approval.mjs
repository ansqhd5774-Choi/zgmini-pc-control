// Read-only manifest provenance. No Issue-supplied bytes, commands or paths.
// The operating adapter may call authorizeTaskCreateB only with these bytes.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {authorizeTaskCreateB} from './contract.mjs';

const REPO='ansqhd5774-Choi/zgmini-pc-control';
const APPROVAL=/^approvals\/task-create-b\/w06-cnn-minute-[a-z0-9-]{8,60}\.json$/;
const SHA40=/^[a-f0-9]{40}$/;
const STOP=c=>{throw Object.assign(Error(c),{code:c});};
const need=(v,c)=>{if(!v)STOP(c);};
const gitBins=[String.raw`C:\Program Files\Git\cmd\git.exe`,
 String.raw`C:\Program Files\Git\bin\git.exe`];
const git=(root,args)=>{
 const exe=gitBins.find(x=>fs.existsSync(x));
 need(!!exe,'TASK_CREATE_B_GIT_MISSING_STOP');
 return spawnSync(exe,['--no-optional-locks','-C',root,...args],{
  shell:false,encoding:'utf8',windowsHide:true,timeout:15000,
  env:{...process.env,GIT_TERMINAL_PROMPT:'0',GIT_OPTIONAL_LOCKS:'0'}
 });
};

export function readCommittedTaskCreateB({controlRoot,event,env,runGit=git,io=fs}={}){
 need(env?.GITHUB_REPOSITORY===REPO&&SHA40.test(env?.GITHUB_SHA??'')&&
  typeof controlRoot==='string'&&path.isAbsolute(controlRoot)&&
  typeof runGit==='function','TASK_CREATE_B_CONTROL_SCOPE_STOP');
 const head=runGit(controlRoot,['rev-parse','HEAD']);
 need(head?.status===0&&head.stdout?.trim()===env.GITHUB_SHA,
  'TASK_CREATE_B_CONTROL_HEAD_STOP');
 let body;
 try{body=JSON.parse(event?.issue?.body);}catch{
  STOP('TASK_CREATE_B_REQUEST_JSON_STOP');
 }
 const relative=body?.approvalManifestPath;
 need(APPROVAL.test(relative??''),'TASK_CREATE_B_APPROVAL_PATH_STOP');
 const dir=path.join(controlRoot,'approvals','task-create-b');
 const file=path.join(dir,path.basename(relative));
 let rootReal,dirReal,fileReal,stat,dirStat;
 try{
  rootReal=io.realpathSync.native(controlRoot);
  dirReal=io.realpathSync.native(dir);
  fileReal=io.realpathSync.native(file);
  stat=io.lstatSync(file);dirStat=io.lstatSync(dir);
 }catch{STOP('TASK_CREATE_B_APPROVAL_FILE_STOP');}
 need(dirStat.isDirectory()&&!dirStat.isSymbolicLink()&&
  stat.isFile()&&!stat.isSymbolicLink()&&
  stat.size>200&&stat.size<=8192,
  'TASK_CREATE_B_APPROVAL_FILE_STOP');
 need(path.win32.normalize(dirReal).toLowerCase()===
  path.win32.normalize(path.join(rootReal,'approvals','task-create-b')).toLowerCase()&&
  path.win32.normalize(fileReal).toLowerCase()===
  path.win32.normalize(path.join(dirReal,path.basename(file))).toLowerCase(),
  'TASK_CREATE_B_APPROVAL_REDIRECT_STOP');
 for(const args of [
  ['ls-files','--error-unmatch','--',relative],
  ['diff','--quiet','HEAD','--',relative],
  ['diff','--cached','--quiet','HEAD','--',relative]
 ]){
  need(runGit(controlRoot,args).status===0,'TASK_CREATE_B_APPROVAL_COMMIT_STOP');
 }
 const bytes=io.readFileSync(file);
 return authorizeTaskCreateB({event,manifestBytes:bytes,manifestCommitted:true});
}

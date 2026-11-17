#!/usr/bin/env node
// Read-only pinned R47 source resolution before checkout: exact Issue actor,
// existing control SHA, approval manifest bytes SHA. No PC/Task access.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {approveExactR47B} from './approval-intake.mjs';
const stop=code=>{throw Object.assign(new Error(code),{code});};
const need=(ok,code)=>{if(!ok)stop(code);};
const SHA40=/^[a-f0-9]{40}$/;
const PATH=/^approvals\/task-cmd-b\/[a-z0-9][a-z0-9._-]{0,90}\.json$/;
function gitHead(root){
 const exe=[String.raw`C:\Program Files\Git\cmd\git.exe`,
  String.raw`C:\Program Files\Git\bin\git.exe`].find(x=>fs.existsSync(x));
 need(exe,'TASK_CMD_B_GIT_NOT_FOUND_STOP');
 const r=spawnSync(exe,['-C',root,'rev-parse','HEAD'],
  {encoding:'utf8',shell:false,windowsHide:true,timeout:20000});
 need(r.status===0&&!r.error,'TASK_CMD_B_CONTROL_SHA_READ_STOP');
 const sha=r.stdout.trim();
 need(SHA40.test(sha),'TASK_CMD_B_CONTROL_SHA_INVALID_STOP');return sha;
}
export function prepareR47SourcePin({controlRoot,event,env,read=fs.readFileSync,
 lstat=fs.lstatSync,realpath=fs.realpathSync.native,head=gitHead}){
 let request;
 try{request=JSON.parse(event?.issue?.body)}catch{stop('TASK_CMD_B_REQUEST_JSON_STOP')}
 need(PATH.test(request?.approvalManifestPath??''),
  'TASK_CMD_B_APPROVAL_PATH_STOP');
 const root=path.join(controlRoot,'approvals','task-cmd-b');
 const dir=lstat(root);
 need(dir.isDirectory()&&!dir.isSymbolicLink(),
  'TASK_CMD_B_APPROVAL_DIRECTORY_STOP');
 const file=path.join(controlRoot,...request.approvalManifestPath.split('/'));
 const st=lstat(file);
 need(st.isFile()&&!st.isSymbolicLink()&&st.size>200&&st.size<=16384,
  'TASK_CMD_B_APPROVAL_FILE_STOP');
 const prefix=realpath(root).toLowerCase()+path.sep;
 need(realpath(file).toLowerCase().startsWith(prefix),
  'TASK_CMD_B_APPROVAL_REALPATH_STOP');
 const auth=approveExactR47B({event,env,manifestBytes:read(file),
  controlSha:head(controlRoot)});
 return auth.manifest.sourceSha;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  need(process.platform==='win32','TASK_CMD_B_WINDOWS_ONLY_STOP');
  const root=process.env.GITHUB_WORKSPACE;
  need(typeof root==='string'&&root.length>0,'TASK_CMD_B_WORKSPACE_STOP');
  const event=JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH,'utf8'));
  const sourceSha=prepareR47SourcePin({
   controlRoot:path.join(root,'r47-control'),event,env:process.env});
  need(typeof process.env.GITHUB_OUTPUT==='string'&&
   path.isAbsolute(process.env.GITHUB_OUTPUT),
   'TASK_CMD_B_GITHUB_OUTPUT_STOP');
  fs.appendFileSync(process.env.GITHUB_OUTPUT,`sourceSha=${sourceSha}\n`);
 }catch(e){
  process.stdout.write(JSON.stringify({status:'STOP',
   code:/^TASK_CMD_B_[A-Z0-9_]+$/.test(e?.code??'')?e.code:
    'TASK_CMD_B_SOURCE_PIN_UNVERIFIED_STOP'})+'\n');
  process.exitCode=1;
 }
}

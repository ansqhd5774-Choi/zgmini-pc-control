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
const gitExe=()=>[String.raw`C:\Program Files\Git\cmd\git.exe`,
 String.raw`C:\Program Files\Git\bin\git.exe`].find(x=>fs.existsSync(x));
function rawGit(root,args){
 const exe=gitExe();need(exe,'TASK_CMD_B_GIT_NOT_FOUND_STOP');
 const r=spawnSync(exe,['-C',root,...args],
  {encoding:null,shell:false,windowsHide:true,timeout:20000,maxBuffer:131072,
   env:{...process.env,GIT_TERMINAL_PROMPT:'0',GIT_CONFIG_NOSYSTEM:'1'}});
 need(r.status===0&&!r.error,'TASK_CMD_B_CONTROL_GIT_READ_STOP');
 return r.stdout;
}
function gitHead(root){
 const sha=rawGit(root,['rev-parse','HEAD']).toString('utf8').trim();
 need(SHA40.test(sha),'TASK_CMD_B_CONTROL_SHA_INVALID_STOP');return sha;
}
export function gitApprovedR47Blob(root,relative){
 need(PATH.test(relative),'TASK_CMD_B_APPROVAL_PATH_STOP');
 const listing=rawGit(root,['ls-tree','HEAD','--',relative])
  .toString('utf8').trim();
 const match=/^100644 blob ([a-f0-9]{40})\t(.+)$/.exec(listing);
 need(match&&match[2]===relative,
  'TASK_CMD_B_APPROVAL_GIT_MODE_STOP');
 // Read tracked object bytes rather than the Windows working tree's EOL-
 // converted file. SHA256 now pins the exact reviewed GitHub source bytes.
 const bytes=rawGit(root,['cat-file','blob',`HEAD:${relative}`]);
 need(bytes.length>200&&bytes.length<=16384,
  'TASK_CMD_B_APPROVAL_GIT_BYTES_STOP');
 return bytes;
}
export function prepareR47SourcePin({controlRoot,event,env,
 readBlob=gitApprovedR47Blob,head=gitHead}){
 let request;
 try{request=JSON.parse(event?.issue?.body)}catch{stop('TASK_CMD_B_REQUEST_JSON_STOP')}
 need(PATH.test(request?.approvalManifestPath??''),
  'TASK_CMD_B_APPROVAL_PATH_STOP');
 const controlSha=head(controlRoot);
 const bytes=readBlob(controlRoot,request.approvalManifestPath);
 const auth=approveExactR47B({event,env,manifestBytes:bytes,controlSha});
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

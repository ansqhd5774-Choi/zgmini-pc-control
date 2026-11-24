// Obtain the Sidecar B approval only from an exact, clean, committed control
// checkout. An Issue body may identify a manifest, but cannot supply approval
// bytes or an arbitrary command/source. This is a read-only preflight module.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {authorizeSidecarIssue} from './admission.mjs';

const REPO='ansqhd5774-Choi/zgmini-pc-control';
const SHA40=/^[a-f0-9]{40}$/;
const APPROVAL=/^approvals\/sidecar-b\/[a-z0-9][a-z0-9._-]{0,95}\.json$/;
const fail=code=>{throw Object.assign(Error(code),{code});};
const need=(ok,code)=>{if(!ok)fail(code);};
const gitBins=[
 'C:\\Program Files\\Git\\cmd\\git.exe',
 'C:\\Program Files\\Git\\bin\\git.exe'
];
const git=(root,args)=>{
 const exe=gitBins.find(f=>fs.existsSync(f));
 need(!!exe,'SIDECAR_B_CONTROL_GIT_MISSING_STOP');
 return spawnSync(exe,['-C',root,...args],{
  encoding:'utf8',shell:false,windowsHide:true,timeout:15000
 });
};
function committedManifest(root,relative,runGit){
 need(APPROVAL.test(relative??''),'SIDECAR_B_APPROVAL_PATH_STOP');
 const parent=path.join(root,'approvals','sidecar-b');
 const file=path.join(root,...relative.split('/'));
 // Check the parent and leaf independently: no junction/symlink traversal.
 let baseReal,dirReal,fileReal,stat,dirStat;
 try{
  baseReal=fs.realpathSync.native(root);
  dirReal=fs.realpathSync.native(parent);
  fileReal=fs.realpathSync.native(file);
  stat=fs.lstatSync(file);
  dirStat=fs.lstatSync(parent);
 }catch{fail('SIDECAR_B_APPROVAL_FILE_STOP');}
 need(dirStat.isDirectory()&&!dirStat.isSymbolicLink()&&
  stat.isFile()&&!stat.isSymbolicLink()&&
  stat.size>200&&stat.size<=8192,'SIDECAR_B_APPROVAL_FILE_STOP');
 need(path.win32.normalize(dirReal).toLowerCase()===
  path.win32.normalize(path.join(baseReal,'approvals','sidecar-b')).toLowerCase()&&
  path.win32.normalize(fileReal).toLowerCase()===
  path.win32.normalize(path.join(dirReal,path.basename(file))).toLowerCase(),
  'SIDECAR_B_APPROVAL_REDIRECT_STOP');
 need(runGit(root,['ls-files','--error-unmatch','--',relative]).status===0,
  'SIDECAR_B_APPROVAL_UNTRACKED_STOP');
 need(runGit(root,['diff','--quiet','HEAD','--',relative]).status===0&&
  runGit(root,['diff','--cached','--quiet','HEAD','--',relative]).status===0,
  'SIDECAR_B_APPROVAL_DIRTY_STOP');
 return fs.readFileSync(file);
}
export function readCommittedSidecarApproval({
 controlRoot,event,env,runGit=git
}){
 need(env?.GITHUB_REPOSITORY===REPO&&
  SHA40.test(env.GITHUB_SHA??'')&&
  typeof controlRoot==='string'&&path.isAbsolute(controlRoot)&&
  typeof runGit==='function','SIDECAR_B_CONTROL_SCOPE_STOP');
 const head=runGit(controlRoot,['rev-parse','HEAD']);
 need(head?.status===0&&head.stdout?.trim()===env.GITHUB_SHA,
  'SIDECAR_B_CONTROL_HEAD_STOP');
 let req;
 try{req=JSON.parse(event?.issue?.body);}catch{
  fail('SIDECAR_B_REQUEST_JSON_STOP');
 }
 const manifestBytes=committedManifest(controlRoot,
  req?.approvalManifestPath,runGit);
 return authorizeSidecarIssue({
  event,env,manifestBytes,controlHead:env.GITHUB_SHA
 });
}

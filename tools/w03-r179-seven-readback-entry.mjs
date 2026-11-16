#!/usr/bin/env node
// Exact authenticated PC-only R179 single-file B, no automatic R171 execution.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {authorize,runApprovedGuard} from './w03-r179-seven-readback-b.mjs';
import {createR179ProtectedIO} from './w03-r179-seven-readback-windows-io.mjs';
const REPO='ansqhd5774-Choi/zgmini-pc-control';
const RESULT='w03-r179-b-result.json';
const GIT=/^[a-f0-9]{40}$/;
const MANIFEST=/^approvals\/w03-r179-guard\/r179-readback-[a-z0-9-]{5,72}\.json$/;
const CODE=[
 'tools/w03-r179-seven-readback-b.mjs',
 'tools/w03-r179-seven-readback-windows-io.mjs',
 'tools/w03-r179-seven-readback-entry.mjs',
 'tools/w03-r179-seven-readback-report.mjs',
 '.github/workflows/pc-writer-b-source-once.yml',
 'r17-writer-b/r17-b-claim.mjs',
];
const fail=code=>{throw Object.assign(Error(code),{code});};
const need=(c,code)=>{if(!c)fail(code);};
function gitExecutable(){
 const x=['C:\\Program Files\\Git\\cmd\\git.exe',
  'C:\\Program Files\\Git\\bin\\git.exe'].find(x=>fs.existsSync(x));
 need(x,'W03_R179_B_GIT_NOT_FOUND_STOP');
 return x;
}
function git(root,args){
 return spawnSync(gitExecutable(),['-C',root,...args],{
  encoding:'utf8',shell:false,windowsHide:true,timeout:15000});
}
function verifyCode(root,pin){
 need(GIT.test(pin??''),'W03_R179_B_CODE_PIN_INVALID');
 need(git(root,['merge-base','--is-ancestor',pin,'HEAD']).status===0,
  'W03_R179_B_CODE_NOT_ANCESTOR_STOP');
 need(git(root,['diff','--quiet',pin,'HEAD','--',...CODE]).status===0,
  'W03_R179_B_CODE_CHANGED_STOP');
 need(git(root,['diff','--quiet','HEAD','--',...CODE]).status===0,
  'W03_R179_B_DIRTY_CODE_STOP');
}
function manifest(root,relative){
 need(MANIFEST.test(relative??''),'W03_R179_B_MANIFEST_PATH_STOP');
 need(git(root,['ls-files','--error-unmatch','--',relative]).status===0,
  'W03_R179_B_MANIFEST_NOT_COMMITTED_STOP');
 need(git(root,['diff','--quiet','HEAD','--',relative]).status===0,
  'W03_R179_B_MANIFEST_DIRTY_STOP');
 const home=path.join(root,'approvals','w03-r179-guard');
 const file=path.join(home,path.win32.basename(relative));
 const parent=fs.lstatSync(home),info=fs.lstatSync(file);
 need(parent.isDirectory()&&!parent.isSymbolicLink()&&
  info.isFile()&&!info.isSymbolicLink()&&
  info.size>=200&&info.size<=4096,
  'W03_R179_B_MANIFEST_SCOPE_STOP');
 need(path.dirname(fs.realpathSync.native(file)).toLowerCase()===
  fs.realpathSync.native(home).toLowerCase(),
  'W03_R179_B_MANIFEST_REDIRECT_STOP');
 return fs.readFileSync(file);
}
export async function runEntry({event,env,root,
 getManifest=manifest,makeIO=createR179ProtectedIO,
 code=verifyCode}={}){
 need(process.platform==='win32','W03_R179_B_WINDOWS_ONLY_STOP');
 need(env?.GITHUB_REPOSITORY===REPO&&
  typeof root==='string'&&path.isAbsolute(root),
  'W03_R179_B_CONTROL_CHECKOUT_STOP');
 const head=git(root,['rev-parse','HEAD']);
 need(head.status===0&&head.stdout.trim()===env.GITHUB_SHA,
  'W03_R179_B_CONTROL_HEAD_DRIFT_STOP');
 let body;try{body=JSON.parse(event.issue.body);}catch{
  fail('W03_R179_B_REQUEST_JSON_STOP');}
 const proof=authorize({event,env,manifestBytes:getManifest(root,body.approvalManifestPath)});
 code(root,proof.manifest.controlSourceSha);
 return {...await runApprovedGuard(proof,makeIO()),
  requestId:proof.request.requestId,
  controlSha:proof.head,manifestSha256:proof.manifestSha256};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 let out;
 try{
  const env=process.env;
  out=await runEntry({
   event:JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8')),env,
   root:path.join(env.GITHUB_WORKSPACE??'','writer-b-control')});
 }catch(e){out={status:'SETUP_STOP',code:/^W03_R179_B_[A-Z0-9_]{3,100}$/.test(e?.code??'')?
  e.code:'W03_R179_B_SETUP_UNCLASSIFIED_STOP',applied:false,requestId:null};}
 try{
  need(typeof process.env.RUNNER_TEMP==='string'&&
   path.isAbsolute(process.env.RUNNER_TEMP),
   'W03_R179_B_RESULT_DIR_STOP');
  fs.writeFileSync(path.join(process.env.RUNNER_TEMP,RESULT),
   JSON.stringify(out)+'\n',{flag:'wx'});
 }catch{process.exitCode=1;}
 process.stdout.write(out.status+' '+out.code+'\n');
 if(out.status!=='APPLIED_VERIFIED')process.exitCode=1;
}
#!/usr/bin/env node
// Pinned Windows B receiver prototype. No caller-supplied commands or paths.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {authorize,authorizeRequest,isApprovedManifestPath} from './contract.mjs';
import {applyApprovedConfig} from './transaction.mjs';

const RESULT='writer-config-b-result.json';
const stop=code=>{throw Object.assign(new Error(code),{code});};
const need=(ok,code)=>{if(!ok)stop(code);};
const publicCode=error=>/^CONFIG_B_[A-Z0-9_]{1,100}$/.test(error?.code??'')?
  error.code:'CONFIG_B_UNEXPECTED_STOP';

function regular(file,parent,limit=8192){
 const root=fs.realpathSync.native(parent).toLowerCase()+path.sep;
 const stat=fs.lstatSync(file);
 need(stat.isFile()&&!stat.isSymbolicLink()&&stat.size>=200&&
  stat.size<=limit&&fs.realpathSync.native(file).toLowerCase().startsWith(root),
 'CONFIG_B_MANIFEST_WORKTREE_SCOPE_STOP');
 return fs.readFileSync(file);
}
function gitBinary(){
 const candidate=[String.raw`C:\Program Files\Git\cmd\git.exe`,
  String.raw`C:\Program Files\Git\bin\git.exe`].find(fs.existsSync);
 need(candidate,'CONFIG_B_GIT_UNAVAILABLE_STOP');
 return candidate;
}
function gitHead(root){
 const r=spawnSync(gitBinary(),['-C',root,'rev-parse','HEAD'],{
  encoding:'utf8',shell:false,windowsHide:true,timeout:15000});
 need(r.status===0&&/^[a-f0-9]{40}$/i.test(r.stdout.trim()),
  'CONFIG_B_GIT_HEAD_STOP');
 return r.stdout.trim();
}
function gitBlob(root,relativePath){
 const r=spawnSync(gitBinary(),['-C',root,'show','HEAD:'+relativePath],{
  encoding:'buffer',shell:false,windowsHide:true,timeout:15000,maxBuffer:16384});
 need(r.status===0&&Buffer.isBuffer(r.stdout)&&
  r.stdout.length>=200&&r.stdout.length<=8192,
  'CONFIG_B_GIT_MANIFEST_STOP');
 return r.stdout;
}
function checkoutMatches(worktree,blob){
 if(worktree.equals(blob))return true;
 if(blob.includes(13))return false;
 return worktree.equals(Buffer.from(blob.toString('utf8').replace(/\n/g,'\r\n')));
}
export function loadAuthorization({env=process.env,readFile=fs.readFileSync,
  controlRoot,head=gitHead,blob=gitBlob}={}){
 need(typeof controlRoot==='string'&&controlRoot.length>0,
  'CONFIG_B_CONTROL_ROOT_STOP');
 const event=JSON.parse(readFile(env.GITHUB_EVENT_PATH,'utf8'));
 const request=authorizeRequest(event);
 need(isApprovedManifestPath(request.approvalManifestPath),
  'CONFIG_B_APPROVAL_PATH_STOP');
 const manifestPath=path.join(controlRoot,...request.approvalManifestPath.split('/'));
 const worktree=regular(manifestPath,path.join(controlRoot,'approvals','writer-config'));
 need(head(controlRoot)===env.GITHUB_SHA,'CONFIG_B_CONTROL_SHA_STOP');
 const raw=blob(controlRoot,request.approvalManifestPath);
 need(Buffer.isBuffer(raw)&&checkoutMatches(worktree,raw),
  'CONFIG_B_MANIFEST_WORKTREE_DRIFT_STOP');
 return authorize({event,env,manifestBytes:raw});
}

async function main(){
 need(process.platform==='win32','CONFIG_B_WINDOWS_HOST_STOP');
 const root=path.join(process.env.GITHUB_WORKSPACE??'','writer-config-b-control');
 const auth=loadAuthorization({controlRoot:root});
 return applyApprovedConfig(auth);
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 let result;
 try{result=await main();}
 catch(error){result={status:'CONFIG_B_SETUP_STOP',code:publicCode(error),requestId:null};}
 const temp=process.env.RUNNER_TEMP;
 try{
  need(typeof temp==='string'&&path.isAbsolute(temp),'CONFIG_B_TEMP_DIR_STOP');
  fs.writeFileSync(path.join(temp,RESULT),JSON.stringify(result)+'\n',{flag:'wx'});
 }catch{process.exitCode=1;}
 process.stdout.write(result.status+' '+result.code+'\n');
 if(result.status!=='CONFIG_B_APPLIED_VERIFIED')process.exitCode=1;
}

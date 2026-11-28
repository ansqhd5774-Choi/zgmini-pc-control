#!/usr/bin/env node
// CI-native Writer B source-only execution adapter. Not an Owner Issue,
// Controller installer, provider collector, or policy activation path.
// The independent scope remains disabled until an explicitly installed
// nativeWriterBExecutionEnabled grant and exact adapter SHA are present.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {readNativeScope,observeNativeReceiver} from './native-receiver-observe.mjs';
import {authorizeWriterBNative} from '../writer-b/contract.mjs';
import {makeWindowsBAdapter} from '../writer-b/windows-adapter.mjs';
import {performWriterBInstall} from '../writer-b/installer.mjs';
import {sanitizeWriterBResult} from '../writer-b/report.mjs';

const REPO='ansqhd5774-Choi/zgmini-pc-control';
const SELF=fileURLToPath(import.meta.url);
const INSTALLED_ROOT='E:\\ZGmini\\automation\\pc-control';
const fail=code=>{throw Object.assign(new Error(code),{code});};
const need=(yes,code)=>{if(!yes)fail(code);};
const HASH=/^[a-f0-9]{40}$/;
const SAFE_CODE=/^WRITER_B_[A-Z0-9_]{1,100}$/;
const FILE=/^approvals\/writer-updates\/[a-z0-9][a-z0-9._-]{0,95}\.json$/;

function safeApprovedManifest(root,relative){
 need(typeof root==='string'&&path.isAbsolute(root)&&
  FILE.test(relative??''),'WRITER_B_NATIVE_APPROVAL_PATH_STOP');
 let cursor=path.resolve(root);
 for(const part of relative.split('/').slice(0,-1)){
  const st=fs.lstatSync(cursor);
  need(st.isDirectory()&&!st.isSymbolicLink(),'WRITER_B_NATIVE_REPARSE_POINT_STOP');
  cursor=path.join(cursor,part);
 }
 const dir=fs.lstatSync(cursor);
 need(dir.isDirectory()&&!dir.isSymbolicLink(),'WRITER_B_NATIVE_REPARSE_POINT_STOP');
 const pathname=path.join(root,...relative.split('/'));
 const st=fs.lstatSync(pathname);
 need(st.isFile()&&!st.isSymbolicLink()&&st.size>200&&st.size<=65536,
  'WRITER_B_NATIVE_APPROVAL_SOURCE_STOP');
 return fs.readFileSync(pathname);
}
function gitHead(root){
 need(typeof root==='string'&&path.isAbsolute(root)&&
  fs.lstatSync(root).isDirectory()&&!fs.lstatSync(root).isSymbolicLink(),
  'WRITER_B_NATIVE_CHECKOUT_MISSING_STOP');
 const result=spawnSync('git',['-C',root,'rev-parse','HEAD'],{
  encoding:'utf8',shell:false,windowsHide:true,timeout:15000});
 const head=result.status===0?result.stdout.trim():'';
 need(HASH.test(head),'WRITER_B_NATIVE_CHECKOUT_SHA_STOP');
 return head;
}
async function getJson(route,token){
 need(typeof route==='string'&&
  /^(?:actions\/runs\/[0-9]+\/attempts\/[0-9]+|contents\/\.github\/workflows\/[a-z0-9-]+\.yml\?ref=[a-f0-9]{40})$/.test(route),
  'WRITER_B_NATIVE_GITHUB_READ_ROUTE_STOP');
 const res=await fetch('https://api.github.com/repos/'+REPO+'/'+route,{
  method:'GET',signal:AbortSignal.timeout(12000),headers:{
   Accept:'application/vnd.github+json',
   Authorization:'Bearer '+token,
   'X-GitHub-Api-Version':'2022-11-28'
  }});
 need(res.ok,'WRITER_B_NATIVE_GITHUB_READ_STOP');
 const body=await res.text();
 need(body.length<150000,'WRITER_B_NATIVE_GITHUB_READ_BOUND_STOP');
 return JSON.parse(body);
}

// Read only the installed Controller's fixed host metadata, not candidate checkout
// or event data. Missing or changing metadata cannot authorize Public Writer B.
// The Writer's original CAS/lease checks remain in the existing installer.
export function readInstalledControllerSha(io=fs){
 try{
  for(let at=INSTALLED_ROOT;;){
   const st=io.lstatSync(at);
   if(!st.isDirectory()||st.isSymbolicLink())return null;
   const parent=path.win32.dirname(at);
   if(parent===at)break;
   at=parent;
  }
  const file=path.win32.join(INSTALLED_ROOT,'host.json');
  const fixed=()=>{
   const before=io.lstatSync(file);
   if(!before.isFile()||before.isSymbolicLink()||before.size<2||before.size>1048576)return null;
   const raw=io.readFileSync(file);
   const after=io.lstatSync(file);
   if(!Buffer.isBuffer(raw)||raw.length!==before.size||!after.isFile()||
      after.isSymbolicLink()||after.size!==before.size||after.mtimeMs!==before.mtimeMs)return null;
   return raw;
  };
  const a=fixed(),b=fixed();
  if(!a||!b||!a.equals(b))return null;
  const sha=JSON.parse(a.toString('utf8'))?.controllerSourceSha;
  return typeof sha==='string'&&HASH.test(sha)?sha:null;
 }catch{return null;}
}

async function prepare(env){
 need(process.platform==='win32','WRITER_B_NATIVE_WINDOWS_ONLY_STOP');
 need(env.GITHUB_EVENT_NAME==='workflow_dispatch'&&
  env.GITHUB_REPOSITORY===REPO&&env.GITHUB_ACTOR==='github-actions[bot]'&&
  env.GITHUB_RUN_ATTEMPT==='1'&&
  env.ZGMINI_CI_NATIVE_WRITER_B_EXEC_ENABLED==='true',
  'WRITER_B_NATIVE_EXECUTION_DISABLED_STOP');
 const eventStat=fs.lstatSync(env.GITHUB_EVENT_PATH);
 need(eventStat.isFile()&&!eventStat.isSymbolicLink()&&
  eventStat.size>0&&eventStat.size<=32768,
  'WRITER_B_NATIVE_EVENT_FILE_STOP');
 const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
 need(typeof env.GITHUB_TOKEN==='string'&&env.GITHUB_TOKEN.length>=20&&
  env.GITHUB_TOKEN.length<1024,'WRITER_B_NATIVE_TOKEN_STOP');
 const scope=readNativeScope('B_WRITER_SOURCE');
 const observation=await observeNativeReceiver({
  effect:'B_WRITER_SOURCE',event,env,
  ports:{readNativeScope:()=>scope,getJson:route=>getJson(route,env.GITHUB_TOKEN)}
 });
 const controlRoot=env.GITHUB_WORKSPACE;
 const controlHead=gitHead(controlRoot);
 const auth=authorizeWriterBNative({observation,scope,env,controlHead,
  adapterBytes:fs.readFileSync(SELF),
  installedControllerSha:scope.policy.repositoryVisibility==='public'?
   readInstalledControllerSha():undefined});
 const reviewed=safeApprovedManifest(controlRoot,auth.manifestPath);
 need(reviewed.equals(scope.approvalBytes),'WRITER_B_NATIVE_CHECKOUT_APPROVAL_DRIFT_STOP');
 return {auth,controlRoot};
}
function safeResultTemp(env,auth,sanitized){
 const dir=env.RUNNER_TEMP;
 need(typeof dir==='string'&&path.isAbsolute(dir)&&
  fs.lstatSync(dir).isDirectory()&&!fs.lstatSync(dir).isSymbolicLink(),
  'WRITER_B_NATIVE_RESULT_TEMP_STOP');
 const basename='zgmini-ci-native-writer-b-'+env.GITHUB_RUN_ID+'-'+auth.requestId;
 const receipt={schema:'ZGMINI_CI_NATIVE_WRITER_B_RECEIPT_V1',
  runId:env.GITHUB_RUN_ID,attempt:1,
  ...sanitized};
 const json=JSON.stringify(receipt,null,2)+'\n';
 const txt=['REQUEST_ID='+auth.requestId,'RUN_ID='+env.GITHUB_RUN_ID,
  'STATUS='+sanitized.status,'CODE='+sanitized.code,
  'MANIFEST_SHA256='+auth.manifestSha256,
  'SOURCE_SHA='+(sanitized.sourceSha??'NONE'),
  'LOCAL_ONLY='+(sanitized.localOnly===true?'true':'UNKNOWN'),
  'RETRY=NO_REEXECUTE'].join('\n')+'\n';
 need(Buffer.byteLength(json)<=8192&&Buffer.byteLength(txt)<=8192,
  'WRITER_B_NATIVE_RECEIPT_SIZE_STOP');
 for(const [ext,data] of [['json',json],['txt',txt]]){
  fs.writeFileSync(path.join(dir,basename+'.'+ext),data,{flag:'wx'});
 }
}
async function main(){
 const mode=process.argv[2];
 need(mode==='--preflight'||mode==='--execute',
  'WRITER_B_NATIVE_MODE_STOP');
 const env=process.env;
 const {auth,controlRoot}=await prepare(env);
 if(mode==='--preflight'){
  need(typeof env.GITHUB_OUTPUT==='string'&&
   path.isAbsolute(env.GITHUB_OUTPUT),'WRITER_B_NATIVE_OUTPUT_STOP');
  fs.appendFileSync(env.GITHUB_OUTPUT,
   'candidateSourceSha='+auth.manifest.candidateSourceSha+'\n');
  console.log('WRITER_B_NATIVE_PREFLIGHT_PIN_VERIFIED');
  return 0;
 }
 const candidateRoot=path.join(controlRoot,'writer-b-candidate');
 need(gitHead(candidateRoot)===auth.manifest.candidateSourceSha,
  'WRITER_B_NATIVE_CANDIDATE_DRIFT_STOP');
 // Original Writer B source/CAS/lease/rollback transaction reused exactly.
 // Only an authenticated, in-process native grant reaches the coordinator.
 const raw=await performWriterBInstall(auth,
  makeWindowsBAdapter(auth,{candidateRoot,controlRoot}));
 const sanitized=sanitizeWriterBResult(raw,auth.requestId,
  env.GITHUB_RUN_ID,auth.manifestSha256);
 safeResultTemp(env,auth,sanitized);
 console.log(JSON.stringify({status:sanitized.status,code:sanitized.code,
  requestId:auth.requestId,readback:'LOCAL_RECEIPT_PAIR_ONLY'}));
 return sanitized.status==='WRITER_B_INSTALLED_VERIFIED'?0:1;
}
if(process.argv[1]&&path.resolve(process.argv[1])===SELF){
 try{process.exitCode=await main();}
 catch(error){
  // Do not publish exception text, environment, absolute paths, raw approval,
  // local source or provider data. Unknown post-claim outcomes are never retried.
  console.error(SAFE_CODE.test(error?.code??'')?
   error.code:'WRITER_B_NATIVE_SETUP_UNVERIFIED_STOP');
  process.exitCode=1;
 }
}

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
const fail=code=>{throw Object.assign(new Error(code),{code});};
const need=(yes,code)=>{if(!yes)fail(code);};
const HASH=/^[a-f0-9]{40}$/;
const SAFE_CODE=/^WRITER_B_[A-Z0-9_]{1,100}$/;
const FILE=/^approvals\/writer-updates\/[a-z0-9][a-z0-9._-]{0,95}\.json$/;

// The installed Controller identity comes from fixed operating-host metadata,
// never an event input, the PR checkout, or the native policy itself.
// Public Writer B re-reads this on both preflight and execution admissions.
const INSTALLED_CONTROLLER_ROOT='E:\\ZGmini\\automation\\pc-control';
export function readInstalledControllerSha({
 root=INSTALLED_CONTROLLER_ROOT,io=fs
}={}){
 const stop=()=>fail('WRITER_B_NATIVE_INSTALLED_CONTROLLER_UNVERIFIED_STOP');
 if(typeof root!=='string'||!path.isAbsolute(root)||root.includes('\0'))stop();
 const resolved=path.resolve(root);
 for(let cursor=resolved;;){
  let st;
  try{st=io.lstatSync(cursor);}catch{stop();}
  if(!st.isDirectory()||st.isSymbolicLink())stop();
  const parent=path.dirname(cursor);
  if(parent===cursor)break;
  cursor=parent;
 }
 const filename=path.join(resolved,'host.json');
 let before,after,a,b;
 try{
  before=io.lstatSync(filename);
  if(!before.isFile()||before.isSymbolicLink()||
   before.size<2||before.size>65536||before.nlink!==1)stop();
  a=io.readFileSync(filename);b=io.readFileSync(filename);
  after=io.lstatSync(filename);
 }catch{stop();}
 if(!Buffer.isBuffer(a)||!Buffer.isBuffer(b)||!a.equals(b)||
  a.length!==before.size||after.size!==before.size||
  after.mtimeMs!==before.mtimeMs||after.ino!==before.ino)stop();
 let metadata;
 try{metadata=JSON.parse(a.toString('utf8'));}catch{stop();}
 if(!metadata||typeof metadata!=='object'||Array.isArray(metadata)||
  !HASH.test(metadata.controllerSourceSha??''))stop();
 return metadata.controllerSourceSha;
}

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
// The nested checkout must be its own exact Git worktree, not an arbitrary
// directory that inherits the parent repository HEAD. Tracked source drift
// is rejected; the separately checked-out candidate is not a tracked change.
function gitControlHead(root){
 const head=gitHead(root);
 const read=args=>spawnSync('git',['-C',root,...args],{
  encoding:'utf8',shell:false,windowsHide:true,timeout:15000});
 const top=read(['rev-parse','--show-toplevel']);
 const comparable=v=>process.platform==='win32'?path.resolve(v).toLowerCase():path.resolve(v);
 need(top.status===0&&comparable(top.stdout.trim())===comparable(root),
  'WRITER_B_NATIVE_CHECKOUT_ROOT_STOP');
 const status=read(['status','--porcelain','--untracked-files=no']);
 need(status.status===0&&status.stdout.trim()==='','WRITER_B_NATIVE_CHECKOUT_DIRTY_STOP');
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

export function selectNativeWriterControlRoot({workspace,ownRoot,policy,mode,env,readHead}){
 need(typeof workspace==='string'&&path.isAbsolute(workspace)&&typeof ownRoot==='string'&&
  path.isAbsolute(ownRoot),'WRITER_B_NATIVE_CHECKOUT_MISSING_STOP');
 const origin=path.resolve(workspace),actual=path.resolve(ownRoot);
 const pinned=policy?.repositoryVisibility==='public'&&policy.nativeWriterBControlMode==='PINNED_CHECKOUT_V1';
 // Existing Private/legacy contracts keep the original HEAD check.
 const read=readHead??(pinned?gitControlHead:gitHead);
 const dispatchControlHead=read(origin);
 need(dispatchControlHead===env.GITHUB_SHA,'WRITER_B_NATIVE_SOURCE_OR_HOST_STOP');
 need(policy?.nativeWriterBControlMode===undefined||pinned,'WRITER_B_NATIVE_SOURCE_OR_HOST_STOP');
 const expected=mode==='--resolve-control'||!pinned?origin:path.join(origin,'writer-b-control');
 const comparable=v=>process.platform==='win32'?v.toLowerCase():v;
 need(comparable(actual)===comparable(expected),'WRITER_B_NATIVE_SOURCE_OR_HOST_STOP');
 const controlHead=read(actual);
 if(mode==='--resolve-control'){
  need(pinned&&HASH.test(policy.nativeWriterBControlSha??''),'WRITER_B_NATIVE_SOURCE_OR_HOST_STOP');
 }else need(controlHead===policy.nativeWriterBControlSha,'WRITER_B_NATIVE_SOURCE_OR_HOST_STOP');
 return {controlRoot:actual,controlHead,dispatchControlHead};
}

async function prepare(env,mode){
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
 const {controlRoot,controlHead,dispatchControlHead}=selectNativeWriterControlRoot({
  workspace:env.GITHUB_WORKSPACE,ownRoot:path.resolve(path.dirname(SELF),'..'),
  policy:scope.policy,mode,env});
 if(mode==='--resolve-control'){
  need(observation.state==='CONTRACT_MATCH_ONLY'&&
   observation.code==='CI_NATIVE_RECEIVER_INDEPENDENT_EVIDENCE_MATCH'&&
   scope.policy.nativeWriterBExecutionEnabled===true,'WRITER_B_NATIVE_INDEPENDENT_GRANT_STOP');
  return {pinnedControlSha:scope.policy.nativeWriterBControlSha};
 }
 // The private legacy receiver keeps its existing admission contract.
 const installedControllerSha=scope.policy?.repositoryVisibility==='public'
  ?readInstalledControllerSha():undefined;
 const auth=authorizeWriterBNative({observation,scope,env,controlHead,
  installedControllerSha,dispatchControlHead,adapterBytes:fs.readFileSync(SELF)});
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
// A refused native preflight never reaches the installer. An execute-stage
// exception, however, has an UNKNOWN effect until the existing journal is
// reconciled. Publish only fixed, bounded metadata; never the exception text.
export function recordNativeWriterBFailure({
 env,mode,error,io=fs
}={}){
 const code=SAFE_CODE.test(error?.code??'')?error.code:
  'WRITER_B_NATIVE_SETUP_UNVERIFIED_STOP';
 if(!['--preflight','--execute'].includes(mode)||
  !/^[1-9][0-9]{0,18}$/.test(env?.GITHUB_RUN_ID??'')||
  env.GITHUB_RUN_ATTEMPT!=='1')
  return Object.freeze({recorded:false,code});
 const stage=mode==='--preflight'?'preflight':'execute';
 const dir=env.RUNNER_TEMP,base='zgmini-ci-native-writer-b-'+
  env.GITHUB_RUN_ID+'-setup-'+stage;
 try{
  if(typeof dir!=='string'||!path.isAbsolute(dir))throw Error('TEMP');
  const root=io.lstatSync(dir);
  if(!root.isDirectory()||root.isSymbolicLink())throw Error('TEMP');
  const report=Object.freeze({
   schema:'ZGMINI_CI_NATIVE_WRITER_B_FAILURE_V1',
   runId:env.GITHUB_RUN_ID,attempt:1,stage,
   status:stage==='preflight'?'WRITER_B_SETUP_STOP':'WRITER_B_STATE_UNKNOWN',
   code,requestId:null,installEffect:stage==='preflight'?'NOT_STARTED':'UNVERIFIED',
   retry:'READ_ONLY_RECONCILE_NO_REEXECUTE'
  });
  const json=JSON.stringify(report)+'\n';
  const txt=['RUN_ID='+report.runId,'STAGE='+stage,'STATUS='+report.status,
   'CODE='+code,'REQUEST_ID=UNVERIFIED','INSTALL_EFFECT='+report.installEffect,
   'RETRY=READ_ONLY_RECONCILE_NO_REEXECUTE',''].join('\n');
  if(Buffer.byteLength(json)>1024||Buffer.byteLength(txt)>1024)
   throw Error('SIZE');
  for(const [ext,body] of [['json',json],['txt',txt]])
   io.writeFileSync(path.join(dir,base+'.'+ext),body,{flag:'wx',mode:0o600});
  return Object.freeze({recorded:true,code});
 }catch{
  return Object.freeze({recorded:false,code});
 }
}
async function main(){
 const mode=process.argv[2];
 need(mode==='--preflight'||mode==='--execute'||mode==='--resolve-control',
  'WRITER_B_NATIVE_MODE_STOP');
 const env=process.env;
 const {auth,controlRoot,pinnedControlSha}=await prepare(env,mode);
 if(mode==='--resolve-control'){
  need(typeof env.GITHUB_OUTPUT==='string'&&path.isAbsolute(env.GITHUB_OUTPUT),
   'WRITER_B_NATIVE_OUTPUT_STOP');
  fs.appendFileSync(env.GITHUB_OUTPUT,'controlSha='+pinnedControlSha+'\n');
  console.log('WRITER_B_NATIVE_CONTROL_PIN_RESOLVED');return 0;
 }
 if(mode==='--preflight'){
  need(typeof env.GITHUB_OUTPUT==='string'&&
   path.isAbsolute(env.GITHUB_OUTPUT),'WRITER_B_NATIVE_OUTPUT_STOP');
  fs.appendFileSync(env.GITHUB_OUTPUT,
   'candidateSourceSha='+auth.manifest.candidateSourceSha+'\n');
  console.log('WRITER_B_NATIVE_PREFLIGHT_PIN_VERIFIED');
  return 0;
 }
 const candidateRoot=path.join(env.GITHUB_WORKSPACE,'writer-b-candidate');
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
  const receipt=recordNativeWriterBFailure({
   env:process.env,mode:process.argv[2],error
  });
  console.error(receipt.code);
  if(!receipt.recorded)console.error('WRITER_B_NATIVE_RESULT_RECEIPT_UNVERIFIED_STOP');
  process.exitCode=1;
 }
}

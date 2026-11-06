// Fixed one-file B installation for the previously approved calendar source.
// No Controller, scheduler, DB, network, or provider operation is performed.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const HERE=path.dirname(fileURLToPath(import.meta.url));
const REPO='ansqhd5774-Choi/zgmini-pc-control';
const TITLE='pc-calendar-cache-hotfix-install-once';
const LABEL='pc-calendar-cache-hotfix-b-install';
const APPROVAL_SHA='8fe6885877b9c36b584eb51e949565ad60737da2b503d321d7a77958d4852fb9';
const SOURCE_ROOT=String.raw`E:\ZGmini\projects\zgmini-earnings-history-pc-release`;
const BACKUP_ROOT=String.raw`E:\ZGmini\data\pc-writer\calendar-b-backups`;
const SHARED_LOCK=String.raw`E:\ZGmini\data\pc-writer\writer-source-install.lock`;
const CYCLE_LOCK=String.raw`E:\ZGmini\data\pc-writer\local-cycle.lock`;
const FILE='scripts/pc-writer/release-calendar.mjs';
const BEFORE='e428c40301ce34f2cadd06d15dcb9d73f554ef989bd9379cef68b2cd461a1a94';
const AFTER='3fa8e1039fcedd3b2fb07b888996f845c6b7102505acdba7608818cb56238871';
const UUID='[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}';
const REQUEST=new RegExp('^pc-calendar-cache-'+UUID+'$');
const CHAT=new RegExp('^chat-'+UUID+'$');
const SHA40=/^[a-f0-9]{40}$/;
const RESULT_JSON='calendar-cache-b-result.json';
const RESULT_TXT='calendar-cache-b-result.txt';
const stop=code=>{throw Error(code);};
const need=(condition,code)=>{if(!condition)stop(code);};
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const exact=(obj,keys)=>obj&&typeof obj==='object'&&!Array.isArray(obj)&&
 Object.keys(obj).length===keys.length&&keys.every(key=>Object.hasOwn(obj,key));
const resultCode=error=>/^CAL_CACHE_B_[A-Z0-9_]+$/.test(error?.message??'')
 ?error.message:'CAL_CACHE_B_UNEXPECTED_FAILURE';
const resolveFile=(root)=>path.join(root,...FILE.split('/'));

export function verifyRequest(event,env){
 need(env.GITHUB_REPOSITORY===REPO&&env.GITHUB_EVENT_NAME==='issues'&&
  env.GITHUB_EVENT_ACTION==='opened'&&env.GITHUB_ACTOR==='ansqhd5774-Choi'&&
  env.GITHUB_RUN_ATTEMPT==='1'&&SHA40.test(env.GITHUB_SHA??''),
  'CAL_CACHE_B_EVENT_CONTEXT_STOP');
 const issue=event?.issue;
 need(event?.action==='opened'&&event?.repository?.private===true&&
  event.repository.full_name===REPO&&event?.sender?.login===env.GITHUB_ACTOR&&
  issue?.user?.login===env.GITHUB_ACTOR&&issue?.title===TITLE&&
  !issue?.pull_request&&Number.isSafeInteger(issue?.number)&&issue.number>0&&
  issue.labels?.some(label=>label.name===LABEL),
  'CAL_CACHE_B_ISSUE_AUTHORIZATION_STOP');
 need(typeof issue.body==='string'&&Buffer.byteLength(issue.body)<=4096,
  'CAL_CACHE_B_ISSUE_BODY_STOP');
 let request;try{request=JSON.parse(issue.body);}catch{stop('CAL_CACHE_B_ISSUE_JSON_STOP');}
 need(exact(request,['schema','requestId','chatId','operation','controlRepository',
  'controlSha','approvalManifestSha256'])&&
  request.schema==='ZGMINI_RELEASE_CALENDAR_CACHE_HOTFIX_B_REQUEST_V1'&&
  REQUEST.test(request.requestId??'')&&CHAT.test(request.chatId??'')&&
  request.operation==='release-calendar-cache-hotfix-install-once'&&
  request.controlRepository===REPO&&request.controlSha===env.GITHUB_SHA&&
  request.approvalManifestSha256===APPROVAL_SHA,
  'CAL_CACHE_B_REQUEST_SCOPE_STOP');
 return {request,issueNumber:issue.number};
}

export function verifyApproval(bytes){
 need(Buffer.isBuffer(bytes)&&hash(bytes)===APPROVAL_SHA,
  'CAL_CACHE_B_APPROVAL_SHA_STOP');
 let m;try{m=JSON.parse(bytes.toString('utf8'));}catch{stop('CAL_CACHE_B_APPROVAL_JSON_STOP');}
 need(exact(m,['schema','status','scope','sourceRoot','backupRoot','file','changes'])&&
  m.schema==='ZGMINI_RELEASE_CALENDAR_CACHE_HOTFIX_B_APPROVAL_V1'&&
  m.status==='APPROVED_B_INSTALL_ONCE'&&
  m.scope==='RELEASE_CALENDAR_CACHE_HOTFIX_ONE_FILE_ONLY'&&
  m.sourceRoot===SOURCE_ROOT&&m.backupRoot===BACKUP_ROOT&&
  exact(m.file,['path','beforeSha256','afterSha256'])&&
  m.file.path===FILE&&m.file.beforeSha256===BEFORE&&m.file.afterSha256===AFTER&&
  exact(m.changes,['controller','scheduler','config','db','providerCalls','publishing'])&&
  Object.values(m.changes).every(value=>value===false),
  'CAL_CACHE_B_APPROVAL_SCOPE_STOP');
 return m;
}

function bounded(root,file){
 let st;try{st=fs.lstatSync(file);}catch{stop('CAL_CACHE_B_FILE_MISSING_STOP');}
 need(st.isFile()&&!st.isSymbolicLink()&&st.size>0&&st.size<=2_000_000,
  'CAL_CACHE_B_FILE_TYPE_STOP');
 const rootReal=fs.realpathSync.native(root).toLowerCase();
 const fileReal=fs.realpathSync.native(file).toLowerCase();
 need(fileReal.startsWith(rootReal+path.sep),'CAL_CACHE_B_FILE_PATH_STOP');
 return fs.readFileSync(file);
}
function writeNew(file,bytes){
 const fd=fs.openSync(file,'wx');
 try{fs.writeFileSync(fd,bytes);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
}
function replace(target,bytes,requestId){
 const stage=target+'.cal-cache-'+requestId+'.tmp';
 writeNew(stage,bytes);
 need(hash(fs.readFileSync(stage))===hash(bytes),'CAL_CACHE_B_STAGE_SHA_STOP');
 try{fs.renameSync(stage,target);}finally{
  if(fs.existsSync(stage)&&hash(fs.readFileSync(stage))===hash(bytes))fs.unlinkSync(stage);
 }
}
function claimLock(file,content,code){
 let fd;
 try{fd=fs.openSync(file,'wx');fs.writeFileSync(fd,content);fs.fsyncSync(fd);}
 catch{
  if(fd!==undefined){
   const own=fs.fstatSync(fd);
   fs.closeSync(fd);
   try{
    const st=fs.lstatSync(file),actual=fs.readFileSync(file,'utf8');
    if(st.dev===own.dev&&st.ino===own.ino&&
      content.startsWith(actual)&&actual.length<=content.length)fs.unlinkSync(file);
   }catch{}
  }
  stop(code);
 }
 fs.closeSync(fd);
 return ()=>{try{if(fs.readFileSync(file,'utf8')===content)fs.unlinkSync(file);}catch{}};
}

// Wait only for the existing Core owner to finish. Never remove, replace,
// or claim its lock while it is present; abort if the bounded window expires.
function waitForCoreQuiet(file,waitMs,tick=ms=>Atomics.wait(
 new Int32Array(new SharedArrayBuffer(4)),0,0,ms)){
 need(Number.isSafeInteger(waitMs)&&waitMs>=0&&waitMs<=180000,
  'CAL_CACHE_B_WAIT_SCOPE_STOP');
 if(waitMs===0)return;
 const deadline=Date.now()+waitMs;
 while(fs.existsSync(file)){
  const remaining=deadline-Date.now();
  need(remaining>0,'CAL_CACHE_B_CYCLE_BUSY_TIMEOUT_STOP');
  tick(Math.min(1500,remaining));
 }
}

/** Only fixture callers may override paths; runLive always pins production paths. */
export function installOneFile({requestId,sourceRoot,backupRoot,sharedLock,cycleLock,
 payloadRoot=path.join(HERE,'..','payload'),simulateFailureAfterReplace=false,
 simulateRollbackFailure=false,waitCycleMs=0,waitCycleTick}={}){
 need(REQUEST.test(requestId??''),'CAL_CACHE_B_INSTALL_REQUEST_STOP');
 need(path.isAbsolute(sourceRoot)&&path.isAbsolute(backupRoot),
  'CAL_CACHE_B_ROOT_STOP');
 // Every byte check happens before requesting a writer/source lock.
 const target=resolveFile(sourceRoot),candidate=resolveFile(payloadRoot);
 const original=bounded(sourceRoot,target),updated=bounded(payloadRoot,candidate);
 need(hash(original)===BEFORE,'CAL_CACHE_B_BEFORE_SHA_STOP');
 need(hash(updated)===AFTER,'CAL_CACHE_B_PAYLOAD_SHA_STOP');
 let releaseShared,releaseCycle,backupDir,transactionStarted=false;
 let preserveLocks=false;
 try{
  waitForCoreQuiet(cycleLock,waitCycleMs,waitCycleTick);
  releaseShared=claimLock(sharedLock,requestId,'CAL_CACHE_B_SHARED_LOCK_BUSY_STOP');
  releaseCycle=claimLock(cycleLock,JSON.stringify({pid:process.pid,at:Date.now(),
   kind:'calendar-cache-onefile',requestId}),'CAL_CACHE_B_CYCLE_BUSY_STOP');
  need(hash(bounded(sourceRoot,target))===BEFORE,'CAL_CACHE_B_BEFORE_CHANGED_STOP');
  fs.mkdirSync(backupRoot,{recursive:true});
  backupDir=path.join(backupRoot,requestId);
  fs.mkdirSync(backupDir);
  const backup=resolveFile(backupDir);
  fs.mkdirSync(path.dirname(backup),{recursive:true});
  writeNew(backup,original);
  need(hash(bounded(backupDir,backup))===BEFORE,'CAL_CACHE_B_BACKUP_VERIFY_STOP');
  const state=path.join(backupDir,'state.json');
  writeNew(state,Buffer.from(JSON.stringify({requestId,phase:'BACKUP_VERIFIED',
   file:FILE,beforeSha256:BEFORE})+'\n'));
  transactionStarted=true;
  replace(target,updated,requestId);
  need(hash(bounded(sourceRoot,target))===AFTER,'CAL_CACHE_B_AFTER_SHA_STOP');
  if(simulateFailureAfterReplace)stop('CAL_CACHE_B_SIMULATED_APPLY_STOP');
  fs.renameSync(state,path.join(backupDir,'state.preverified.json'));
  writeNew(state,Buffer.from(JSON.stringify({requestId,phase:'VERIFIED',
   file:FILE,afterSha256:AFTER})+'\n'));
  return {status:'SUCCEEDED',code:'CAL_CACHE_B_ONEFILE_INSTALLED_VERIFIED',
   phase:'VERIFIED',fileCount:1,beforeVerified:1,afterVerified:1,backupVerified:1,
   controllerChanged:false,schedulerChanged:false,dbChanged:false,providerCalls:0};
 }catch(error){
  if(transactionStarted){
   try{
    if(simulateRollbackFailure)stop('CAL_CACHE_B_SIMULATED_ROLLBACK_STOP');
    const current=hash(bounded(sourceRoot,target));
    need(current===BEFORE||current===AFTER,'CAL_CACHE_B_ROLLBACK_DRIFT_STOP');
    const restored=bounded(backupDir,resolveFile(backupDir));
    need(hash(restored)===BEFORE,'CAL_CACHE_B_ROLLBACK_BACKUP_STOP');
    if(current!==BEFORE)replace(target,restored,requestId);
    need(hash(bounded(sourceRoot,target))===BEFORE,'CAL_CACHE_B_ROLLBACK_VERIFY_STOP');
    writeNew(path.join(backupDir,'rollback-result.json'),Buffer.from(JSON.stringify({
     requestId,phase:'ROLLED_BACK',cause:resultCode(error)})+'\n'));
   }catch{
    preserveLocks=true;
    try{writeNew(path.join(backupDir,'recovery-required.json'),Buffer.from(JSON.stringify({
     requestId,phase:'RECOVERY_REQUIRED',code:'CAL_CACHE_B_ROLLBACK_FAILED'})+'\n'));}catch{}
    stop('CAL_CACHE_B_RECOVERY_REQUIRED_STOP');
   }
   const rolled=Error('CAL_CACHE_B_ROLLED_BACK_VERIFIED');
   rolled.triggerCode=resultCode(error);
   throw rolled;
  }
  throw error;
 }finally{
  if(!preserveLocks){releaseCycle?.();releaseShared?.();}
 }
}

export function resultText(r){
 return ['STATUS='+r.status,'CODE='+r.code,'PHASE='+(r.phase??'NONE'),
  'REQUEST_ID='+(r.requestId??'unknown'),'SOURCE_SHA='+(r.controlSha??'unknown'),
  'FILES_VERIFIED='+String(r.afterVerified??0),
  'BACKUPS_VERIFIED='+String(r.backupVerified??0),
  'TRIGGER_CODE='+(r.triggerCode??'none'),
  'RECOVERY_NOTE='+(r.recoveryNote??'none'),
  'RETRY=NO_REEXECUTE_READBACK_ONLY'].join('\n')+'\n';
}

export function runLive(env=process.env){
 let requestId='unknown';
 const result={schema:'ZGMINI_RELEASE_CALENDAR_CACHE_HOTFIX_B_RESULT_V1',
  requestId,status:'BLOCKED',code:'CAL_CACHE_B_NOT_STARTED',phase:'NONE',
  controlSha:SHA40.test(env.GITHUB_SHA??'')?env.GITHUB_SHA:'unknown',
  retry:'NO_REEXECUTE_READBACK_ONLY'};
 try{
  need(process.platform==='win32','CAL_CACHE_B_WINDOWS_ONLY_STOP');
  need(env.GITHUB_EVENT_PATH&&env.RUNNER_TEMP,'CAL_CACHE_B_RUNNER_ENV_STOP');
  const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
  const accepted=verifyRequest(event,env);
  requestId=accepted.request.requestId;
  Object.assign(result,{requestId,issueNumber:accepted.issueNumber});
  verifyApproval(fs.readFileSync(path.join(HERE,'approval.json')));
  Object.assign(result,installOneFile({requestId,sourceRoot:SOURCE_ROOT,
   backupRoot:BACKUP_ROOT,sharedLock:SHARED_LOCK,cycleLock:CYCLE_LOCK,
   waitCycleMs:180000}));
 }catch(error){
  const code=resultCode(error),recovery=code==='CAL_CACHE_B_RECOVERY_REQUIRED_STOP',
   rolled=code==='CAL_CACHE_B_ROLLED_BACK_VERIFIED';
  Object.assign(result,{requestId,code,
   status:recovery?'RECOVERY_REQUIRED':rolled?'ROLLED_BACK':'BLOCKED',
   phase:recovery?'RECOVERY_REQUIRED':rolled?'ROLLED_BACK_VERIFIED':'NOT_VERIFIED'});
  if(rolled)result.triggerCode=error.triggerCode;
  if(recovery)result.recoveryNote='OWNED_LOCKS_PRESERVED_VERIFY_BEFORE_RETRY';
 }
 return result;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const result=runLive(),output=process.env.RUNNER_TEMP??os.tmpdir();
 try{
  fs.writeFileSync(path.join(output,RESULT_JSON),JSON.stringify(result,null,2)+'\n');
  fs.writeFileSync(path.join(output,RESULT_TXT),resultText(result));
 }catch{process.stderr.write('CAL_CACHE_B_RESULT_WRITE_STOP\n');process.exitCode=2;}
 if(result.status!=='SUCCEEDED')process.exitCode=1;
}

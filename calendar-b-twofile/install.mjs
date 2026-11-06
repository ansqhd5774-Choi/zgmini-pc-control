// One-shot, two-file, approved release-calendar installation on a self-hosted
// Windows GitHub runner. No arbitrary shell, scheduler, Controller, or DB access.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const HERE=path.dirname(fileURLToPath(import.meta.url));
const REPO='ansqhd5774-Choi/zgmini-pc-control';
const TITLE='pc-calendar-twofile-install-once';
const LABEL='pc-calendar-twofile-b-install';
const APPROVAL_SHA='d43a1fceef8ea606bad083d662f4a5a8d5738cfbcc8d54126169777d12c29c02';
const SOURCE_ROOT=String.raw`E:\ZGmini\projects\zgmini-earnings-history-pc-release`;
const BACKUP_ROOT=String.raw`E:\ZGmini\data\pc-writer\calendar-b-backups`;
const SHARED_LOCK=String.raw`E:\ZGmini\data\pc-writer\writer-source-install.lock`;
const CYCLE_LOCK=String.raw`E:\ZGmini\data\pc-writer\local-cycle.lock`;
const FILES=Object.freeze({
 'lib/release-calendar.mjs':{
  before:'97800cfbe226be56c3f10e9fa4a37a8967a7e84ad5ba2f098477f7fb3447aefe',
  after:'d12028f9b9c66d63a10d1e1b93d0846b5bf8d9e7c49fed2be6efefd9694f8d0b'},
 'scripts/pc-writer/release-calendar.mjs':{
  before:'75861acfb5481572cbfb4d769647cc77fb991f5b44cf909851172ebb93566eda',
  after:'e428c40301ce34f2cadd06d15dcb9d73f554ef989bd9379cef68b2cd461a1a94'},
});
const UUID='[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}';
const REQUEST=new RegExp('^pc-calendar-'+UUID+'$');
const CHAT=new RegExp('^chat-'+UUID+'$');
const SHA40=/^[a-f0-9]{40}$/;
const SHA64=/^[a-f0-9]{64}$/;
const RESULT_NAME='calendar-b-install-result.json';
const RESULT_TXT='calendar-b-install-result.txt';
const safeCode=e=>/^CAL_B_[A-Z0-9_]+$/.test(e?.message??'')?e.message:'CAL_B_UNEXPECTED_FAILURE';
const stop=code=>{throw Error(code);};
const need=(condition,code)=>{if(!condition)stop(code);};
const hash=b=>createHash('sha256').update(b).digest('hex');
const relpath=(root,rel)=>path.join(root,...rel.split('/'));
const exactKeys=(obj,keys)=>obj&&typeof obj==='object'&&!Array.isArray(obj)&&
 Object.keys(obj).length===keys.length&&keys.every(key=>Object.hasOwn(obj,key));

export function verifyRequest(event,env){
 need(env.GITHUB_REPOSITORY===REPO&&env.GITHUB_EVENT_NAME==='issues'&&
  env.GITHUB_EVENT_ACTION==='opened'&&env.GITHUB_ACTOR==='ansqhd5774-Choi'&&
  env.GITHUB_RUN_ATTEMPT==='1'&&SHA40.test(env.GITHUB_SHA??''),
  'CAL_B_EVENT_CONTEXT_STOP');
 const issue=event?.issue;
 need(event?.action==='opened'&&event?.repository?.private===true&&
  event.repository.full_name===REPO&&event?.sender?.login===env.GITHUB_ACTOR&&
  issue?.user?.login===env.GITHUB_ACTOR&&issue?.title===TITLE&&
  !issue?.pull_request&&Number.isSafeInteger(issue?.number)&&issue.number>0&&
  issue.labels?.some(label=>label.name===LABEL),
  'CAL_B_ISSUE_AUTHORIZATION_STOP');
 need(typeof issue.body==='string'&&Buffer.byteLength(issue.body)<=4096,
  'CAL_B_ISSUE_BODY_STOP');
 let request;try{request=JSON.parse(issue.body);}catch{stop('CAL_B_ISSUE_JSON_STOP');}
 need(exactKeys(request,['schema','requestId','chatId','operation','controlRepository',
  'controlSha','approvalManifestSha256'])&&
  request.schema==='ZGMINI_RELEASE_CALENDAR_2FILE_B_REQUEST_V1'&&
  REQUEST.test(request.requestId??'')&&CHAT.test(request.chatId??'')&&
  request.operation==='release-calendar-twofile-install-once'&&
  request.controlRepository===REPO&&request.controlSha===env.GITHUB_SHA&&
  request.approvalManifestSha256===APPROVAL_SHA,
  'CAL_B_REQUEST_SCOPE_STOP');
 return {request,issueNumber:issue.number};
}

export function verifyApproval(raw){
 need(Buffer.isBuffer(raw)&&hash(raw)===APPROVAL_SHA,'CAL_B_APPROVAL_SHA_STOP');
 let m;try{m=JSON.parse(raw.toString('utf8'));}catch{stop('CAL_B_APPROVAL_JSON_STOP');}
 need(exactKeys(m,['schema','status','scope','sourceRoot','backupRoot','files','changes'])&&
  m.schema==='ZGMINI_RELEASE_CALENDAR_2FILE_B_APPROVAL_V1'&&
  m.status==='APPROVED_B_INSTALL_ONCE'&&m.scope==='RELEASE_CALENDAR_TWO_FILE_ONLY'&&
  m.sourceRoot===SOURCE_ROOT&&m.backupRoot===BACKUP_ROOT&&
  exactKeys(m.files,Object.keys(FILES)),
  'CAL_B_APPROVAL_SCOPE_STOP');
 for(const [file,values] of Object.entries(FILES))
  need(exactKeys(m.files[file],['beforeSha256','afterSha256'])&&
   m.files[file].beforeSha256===values.before&&
   m.files[file].afterSha256===values.after,'CAL_B_APPROVAL_FILE_STOP');
 need(exactKeys(m.changes,['controller','scheduler','config','db','providerCalls','publishing'])&&
  Object.values(m.changes).every(x=>x===false),'CAL_B_APPROVAL_EFFECT_STOP');
 return m;
}

function boundedFile(file,root){
 let st;try{st=fs.lstatSync(file);}catch{stop('CAL_B_FILE_MISSING_STOP');}
 need(st.isFile()&&!st.isSymbolicLink()&&st.size>0&&st.size<=2_000_000,
  'CAL_B_FILE_TYPE_STOP');
 const rootReal=fs.realpathSync.native(root).toLowerCase();
 const fileReal=fs.realpathSync.native(file).toLowerCase();
 need(fileReal.startsWith(rootReal+path.sep),'CAL_B_FILE_PATH_STOP');
 return fs.readFileSync(file);
}
function syncWrite(file,bytes){
 const fd=fs.openSync(file,'wx');
 try{fs.writeFileSync(fd,bytes);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
}
function replaceFile(target,bytes,requestId){
 const temp=target+'.cal-b-'+requestId+'.tmp';
 syncWrite(temp,bytes);
 need(hash(fs.readFileSync(temp))===hash(bytes),'CAL_B_STAGE_SHA_STOP');
 try{fs.renameSync(temp,target);}finally{
  if(fs.existsSync(temp)&&hash(fs.readFileSync(temp))===hash(bytes))fs.unlinkSync(temp);
 }
}
function lockExclusive(file,content,code){
 let fd;
 try{fd=fs.openSync(file,'wx');fs.writeFileSync(fd,content);fs.fsyncSync(fd);}
 catch{
  if(fd!==undefined){
   const own=fs.fstatSync(fd);
   fs.closeSync(fd);
   try{
    const stat=fs.lstatSync(file),actual=fs.readFileSync(file,'utf8');
    if(stat.dev===own.dev&&stat.ino===own.ino&&
       content.startsWith(actual)&&actual.length<=content.length)
      fs.unlinkSync(file);
   }catch{}
  }
  stop(code);
 }
 fs.closeSync(fd);
 return ()=>{
  // Never delete another actor's lock if ownership changed after our claim.
  try{if(fs.readFileSync(file,'utf8')===content)fs.unlinkSync(file);}catch{}
 };
}

/** Fixed two-file transaction. Paths are injectable only for isolated tests;
 *  the GitHub entry below always supplies the immutable E: production paths. */
export function installTwoFiles({requestId,sourceRoot,backupRoot,sharedLock,cycleLock,
 payloadRoot=path.join(HERE,'payload'),simulateFailureAt=null,
 simulateRollbackFailure=false}={}){
 need(REQUEST.test(requestId??''),'CAL_B_INSTALL_REQUEST_ID_STOP');
 need(path.isAbsolute(sourceRoot)&&path.isAbsolute(backupRoot),'CAL_B_ROOT_STOP');
 // Read-only preflight, scoped to exactly the two approved operational files.
 const current=new Map(),candidates=new Map();
 for(const [file,h] of Object.entries(FILES)){
  const present=boundedFile(relpath(sourceRoot,file),sourceRoot);
  const candidate=boundedFile(relpath(payloadRoot,file),payloadRoot);
  need(hash(present)===h.before,'CAL_B_BEFORE_SHA_STOP');
  need(hash(candidate)===h.after,'CAL_B_PAYLOAD_SHA_STOP');
  current.set(file,present);candidates.set(file,candidate);
 }
 let releaseShared,releaseCycle;
 let backupDir=null;
 let transactionStarted=false;
 let preserveLocksForRecovery=false;
 try{
  // The same source-install mutex used by the already successful R17 B lane.
  releaseShared=lockExclusive(sharedLock,requestId,'CAL_B_SHARED_LOCK_BUSY_STOP');
  releaseCycle=lockExclusive(cycleLock,JSON.stringify({pid:process.pid,at:Date.now(),
   kind:'calendar-b-twofile',requestId}),'CAL_B_CYCLE_BUSY_STOP');
  // Eliminate preflight-to-write drift after both locks have been claimed.
  for(const [file,h] of Object.entries(FILES))
   need(hash(boundedFile(relpath(sourceRoot,file),sourceRoot))===h.before,
    'CAL_B_BEFORE_CHANGED_STOP');
  fs.mkdirSync(backupRoot,{recursive:true});
  backupDir=path.join(backupRoot,requestId);
  fs.mkdirSync(backupDir); // A preexisting request journal is never reused.
  for(const [file,original] of current){
   const target=relpath(backupDir,file);fs.mkdirSync(path.dirname(target),{recursive:true});
   syncWrite(target,original);
   need(hash(boundedFile(target,backupDir))===FILES[file].before,
    'CAL_B_BACKUP_VERIFY_STOP');
  }
  const journal=path.join(backupDir,'state.json');
  syncWrite(journal,Buffer.from(JSON.stringify({requestId,phase:'BACKUPS_VERIFIED',
   paths:Object.keys(FILES),before:Object.fromEntries(Object.entries(FILES)
    .map(([p,h])=>[p,h.before]))})+'\n'));
  transactionStarted=true;
  for(const [file,bytes] of candidates){
   replaceFile(relpath(sourceRoot,file),bytes,requestId);
   need(hash(boundedFile(relpath(sourceRoot,file),sourceRoot))===FILES[file].after,
    'CAL_B_AFTER_SHA_STOP');
   if(simulateFailureAt===file)stop('CAL_B_SIMULATED_APPLY_STOP');
  }
  fs.renameSync(journal,path.join(backupDir,'state.preverified.json'));
  syncWrite(path.join(backupDir,'state.json'),Buffer.from(JSON.stringify({
   requestId,phase:'VERIFIED',files:Object.fromEntries(Object.entries(FILES)
    .map(([p,h])=>[p,h.after]))})+'\n'));
  return {status:'SUCCEEDED',code:'CAL_B_TWOFILE_INSTALLED_VERIFIED',phase:'VERIFIED',
   fileCount:2,beforeVerified:2,afterVerified:2,backupVerified:2,
   controllerChanged:false,schedulerChanged:false,dbChanged:false,providerCalls:0};
 }catch(error){
  if(transactionStarted){
   try{
    if(simulateRollbackFailure)stop('CAL_B_SIMULATED_ROLLBACK_STOP');
    // Automatic rollback only for verified original/target bytes; preserve any
    // unknown third-party change for manual recovery without overwriting it.
    for(const [file,h] of Object.entries(FILES)){
     const target=relpath(sourceRoot,file),now=hash(boundedFile(target,sourceRoot));
     need(now===h.before||now===h.after,'CAL_B_ROLLBACK_EXTERNAL_DRIFT_STOP');
     const original=boundedFile(relpath(backupDir,file),backupDir);
     need(hash(original)===h.before,'CAL_B_ROLLBACK_BACKUP_SHA_STOP');
     if(now!==h.before)replaceFile(target,original,requestId);
     need(hash(boundedFile(target,sourceRoot))===h.before,'CAL_B_ROLLBACK_VERIFY_STOP');
    }
    if(backupDir)syncWrite(path.join(backupDir,'rollback-result.json'),
     Buffer.from(JSON.stringify({requestId,phase:'ROLLED_BACK',cause:safeCode(error)})+'\n'));
   }catch{
    preserveLocksForRecovery=true;
    try{if(backupDir)syncWrite(path.join(backupDir,'recovery-required.json'),
     Buffer.from(JSON.stringify({requestId,phase:'RECOVERY_REQUIRED',
      code:'CAL_B_ROLLBACK_FAILED',note:'LOCKS_PRESERVED_NO_AUTOMATIC_RETRY'})+'\n'));}catch{}
    stop('CAL_B_RECOVERY_REQUIRED_STOP');
   }
   const rolled=Error('CAL_B_ROLLED_BACK_VERIFIED');
   rolled.triggerCode=safeCode(error);
   throw rolled;
  }
  throw error;
 }finally{
  // A failed rollback is not safe to release to another installer. Existing
  // Core may treat a dead PID as stale on its next cycle; this lock cannot
  // replace operator recovery or a separately verified task pause.
  if(!preserveLocksForRecovery){releaseCycle?.();releaseShared?.();}
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
 const result={schema:'ZGMINI_RELEASE_CALENDAR_2FILE_B_RESULT_V1',
  requestId,status:'BLOCKED',code:'CAL_B_NOT_STARTED',phase:'NONE',
  controlSha:SHA40.test(env.GITHUB_SHA??'')?env.GITHUB_SHA:'unknown',
  retry:'NO_REEXECUTE_READBACK_ONLY'};
 try{
  need(process.platform==='win32','CAL_B_WINDOWS_ONLY_STOP');
  need(env.GITHUB_EVENT_PATH&&env.RUNNER_TEMP,'CAL_B_RUNNER_ENV_STOP');
  const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
  const accepted=verifyRequest(event,env);
  requestId=accepted.request.requestId;
  Object.assign(result,{requestId,issueNumber:accepted.issueNumber});
  verifyApproval(fs.readFileSync(path.join(HERE,'approval.json')));
  const applied=installTwoFiles({requestId,sourceRoot:SOURCE_ROOT,backupRoot:BACKUP_ROOT,
   sharedLock:SHARED_LOCK,cycleLock:CYCLE_LOCK});
  Object.assign(result,applied);
 }catch(error){
  const code=safeCode(error);
  const recovery=code==='CAL_B_RECOVERY_REQUIRED_STOP',rolled=code==='CAL_B_ROLLED_BACK_VERIFIED';
  Object.assign(result,{requestId,code,
   status:recovery?'RECOVERY_REQUIRED':rolled?'ROLLED_BACK':'BLOCKED',
   phase:recovery?'RECOVERY_REQUIRED':rolled?'ROLLED_BACK_VERIFIED':'NOT_VERIFIED'});
  if(rolled)result.triggerCode=error.triggerCode;
  if(recovery)result.recoveryNote='LOCKS_LEFT_IN_PLACE_BUT_CORE_MAY_RECLAIM_DEAD_PID';
 }
 return result;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const result=runLive();
 const output=process.env.RUNNER_TEMP??os.tmpdir();
 try{
  fs.writeFileSync(path.join(output,RESULT_NAME),JSON.stringify(result,null,2)+'\n');
  fs.writeFileSync(path.join(output,RESULT_TXT),resultText(result));
 }catch{process.stderr.write('CAL_B_RESULT_WRITE_STOP\n');process.exitCode=2;}
 if(result.status!=='SUCCEEDED')process.exitCode=1;
}

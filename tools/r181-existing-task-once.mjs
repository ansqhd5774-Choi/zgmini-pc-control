#!/usr/bin/env node
// One-time, approved RUN of an EXISTING Windows Task Scheduler job.
// Never creates, registers, modifies, disables or changes a task or schedule.
// Task completion, collector HTTP and SQLite outcomes require independent
// readback of R181's operational ledger; this stage only requests one run.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {acquireInstallLock,createInstallJournal,releaseInstallClaim}
  from '../r17-writer-b/r17-b-claim.mjs';

export const OPERATION='r181-existing-task-run-once';
export const REQUEST_SCHEMA='ZGMINI_R181_TASK_ONCE_REQUEST_V1';
export const APPROVAL_SCHEMA='ZGMINI_R181_TASK_ONCE_APPROVAL_V1';
export const TASK='ZGMINI-PC-GetMarketHistory-ETF';
export const TARGET='E:\\ZGmini\\data\\theme-market-history-r131\\marketparquet-r167\\r181-primary.mjs';
export const CYCLE='E:\\ZGmini\\data\\theme-market-history-r131\\marketparquet-r167\\r181-primary-cycle.mjs';
export const TARGET_AFTER_SHA='1779d0141bb8ef7eaeb6ccfa3fc6616ad6baa83f3a81f9e59089ac2761e0d171';
export const CYCLE_SHA='be0303b112d6f4471137aa134bf98f696a8a8dfe60d1d13502646c5e0b509d62';
export const ACTION_SHA='4bdbfeaa9dff719ba6e8c48a4b0c94c8deef70e3b8e849de73c4a73fd18965fe';
const REPO='ansqhd5774-Choi/zgmini-pc-control',OWNER='ansqhd5774-Choi';
const ROOT='E:\\ZGmini\\data\\pc-writer\\r181-task-run-once';
const SHARED='E:\\ZGmini\\data\\pc-writer\\writer-source-install.lock';
const RESULT='r181-existing-task-result.json';
const SCHEMA='ZGMINI_R181_TASK_ONCE_RESULT_V1';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA40=/^[a-f0-9]{40}$/i,SHA64=/^[a-f0-9]{64}$/i;
const MANIFEST=/^approvals\/r181-task-once\/r181-task-[a-z0-9-]{6,64}\.json$/;
const stop=code=>{throw Object.assign(Error(code),{code});};
const need=(yes,code)=>{if(!yes)stop(code);};
const digest=b=>createHash('sha256').update(b).digest('hex');
const exact=(x,keys)=>x&&typeof x==='object'&&!Array.isArray(x)&&
 Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
const REQUEST_KEYS=['schema','requestId','chatId','operation','controlRepository',
 'approvalManifestPath','approvalManifestSha256'];
const APPROVAL_KEYS=['schema','status','scope','operation','controlSourceSha',
 'taskName','actionSha256','helperAfterSha256','cycleSha256','maxLaunches',
 'allowProviderCalls','allowSqliteWrites','allowD1Writes','allowTaskRegistrationChanges',
 'allowScheduleChanges','allowOtherOperations'];
const REVIEWED_FILES=[
 'tools/r181-existing-task-once.mjs',
 'tools/r181-existing-task-report.mjs',
 'r17-writer-b/r17-b-claim.mjs',
 '.github/workflows/pc-writer-b-source-once.yml',
];
function gitExe(){
 const p=['C:\\Program Files\\Git\\cmd\\git.exe',
  'C:\\Program Files\\Git\\bin\\git.exe'].find(p=>fs.existsSync(p));
 need(!!p,'R181_TASK_GIT_NOT_FOUND_STOP');return p;
}
function runGit(root,args){
 return spawnSync(gitExe(),['-C',root,...args],
  {shell:false,encoding:'utf8',windowsHide:true,timeout:15000});
}
function verifyControlRoot(root,env){
 need(process.platform==='win32','R181_TASK_WINDOWS_ONLY_STOP');
 need(typeof root==='string'&&path.isAbsolute(root),
  'R181_TASK_CONTROL_ROOT_STOP');
 const sha=runGit(root,['rev-parse','HEAD']);
 need(sha.status===0&&sha.stdout.trim()===env.GITHUB_SHA,
  'R181_TASK_SOURCE_HEAD_DRIFT_STOP');
}
function verifyCodeAncestor(root,pin){
 need(SHA40.test(pin??''),'R181_TASK_CODE_PIN_STOP');
 need(runGit(root,['merge-base','--is-ancestor',pin,'HEAD']).status===0,
  'R181_TASK_CODE_NOT_ANCESTOR_STOP');
 need(runGit(root,['diff','--quiet',pin,'HEAD','--',...REVIEWED_FILES]).status===0,
  'R181_TASK_CODE_CHANGED_STOP');
 need(runGit(root,['diff','--quiet','HEAD','--',...REVIEWED_FILES]).status===0,
  'R181_TASK_WORKTREE_CODE_CHANGED_STOP');
}
function readApprovedManifest(root,relative){
 need(MANIFEST.test(relative??''),'R181_TASK_MANIFEST_PATH_STOP');
 need(runGit(root,['ls-files','--error-unmatch','--',relative]).status===0,
  'R181_TASK_MANIFEST_NOT_COMMITTED_STOP');
 need(runGit(root,['diff','--quiet','HEAD','--',relative]).status===0,
  'R181_TASK_MANIFEST_DIRTY_STOP');
 const file=path.join(root,...relative.split('/')),parent=path.dirname(file);
 const parentSt=fs.lstatSync(parent),fileSt=fs.lstatSync(file);
 need(parentSt.isDirectory()&&!parentSt.isSymbolicLink()&&
  fileSt.isFile()&&!fileSt.isSymbolicLink()&&
  fileSt.size>=200&&fileSt.size<=4096,
  'R181_TASK_MANIFEST_FS_STOP');
 need(path.dirname(fs.realpathSync.native(file)).toLowerCase()===
  fs.realpathSync.native(parent).toLowerCase(),
  'R181_TASK_MANIFEST_ESCAPE_STOP');
 return fs.readFileSync(file);
}
export function authorizeExistingR181Task({event,env,manifestBytes}){
 need(env?.GITHUB_REPOSITORY===REPO&&env.GITHUB_EVENT_NAME==='issues'&&
  env.GITHUB_EVENT_ACTION==='opened'&&env.GITHUB_RUN_ATTEMPT==='1'&&
  env.GITHUB_ACTOR===OWNER&&SHA40.test(env.GITHUB_SHA??'')&&
  event?.repository?.full_name===REPO&&event.repository.private===true&&
  event.sender?.login===OWNER&&event.issue?.user?.login===OWNER&&
  !event.issue.pull_request&&event.issue.title===OPERATION&&
  event.issue.labels?.some(x=>x.name==='pc-writer-b-install')&&
  Number.isSafeInteger(event.issue.number)&&event.issue.number>0,
  'R181_TASK_EVENT_DENIED');
 let req;try{req=JSON.parse(event.issue.body);}catch{
  stop('R181_TASK_REQUEST_JSON_STOP');}
 need(exact(req,REQUEST_KEYS)&&req.schema===REQUEST_SCHEMA&&
  req.operation===OPERATION&&req.controlRepository===REPO&&
  UUID.test(req.requestId??'')&&UUID.test(req.chatId??'')&&
  MANIFEST.test(req.approvalManifestPath??'')&&
  SHA64.test(req.approvalManifestSha256??''),
  'R181_TASK_REQUEST_DENIED');
 need(Buffer.isBuffer(manifestBytes)&&manifestBytes.length>=200&&
  manifestBytes.length<=4096&&
  digest(manifestBytes)===req.approvalManifestSha256,
  'R181_TASK_MANIFEST_HASH_STOP');
 let a;try{a=JSON.parse(manifestBytes);}catch{
  stop('R181_TASK_MANIFEST_JSON_STOP');}
 need(exact(a,APPROVAL_KEYS)&&a.schema===APPROVAL_SCHEMA&&
  a.status==='APPROVED_B'&&a.scope==='W03_R181_EXISTING_TASK_RUN_ONCE'&&
  a.operation===OPERATION&&SHA40.test(a.controlSourceSha)&&
  a.taskName===TASK&&a.actionSha256===ACTION_SHA&&
  a.helperAfterSha256===TARGET_AFTER_SHA&&
  a.cycleSha256===CYCLE_SHA&&a.maxLaunches===1&&
  a.allowProviderCalls===true&&a.allowSqliteWrites===true&&
  a.allowD1Writes===false&&a.allowTaskRegistrationChanges===false&&
  a.allowScheduleChanges===false&&a.allowOtherOperations===false,
  'R181_TASK_APPROVAL_DENIED');
 return Object.freeze({request:Object.freeze(req),manifest:Object.freeze(a),
  controlSha:env.GITHUB_SHA});
}
function fixedSourceDigest(file,bytes){
 const parent=path.win32.dirname(TARGET);
 need(path.win32.dirname(file).toLowerCase()===parent.toLowerCase(),
  'R181_TASK_SOURCE_SCOPE_STOP');
 const stat=fs.lstatSync(file);
 need(stat.isFile()&&!stat.isSymbolicLink()&&
  stat.size===bytes,'R181_TASK_SOURCE_SIZE_STOP');
 need(path.win32.dirname(fs.realpathSync.native(file)).toLowerCase()===
  fs.realpathSync.native(parent).toLowerCase(),
  'R181_TASK_SOURCE_ESCAPE_STOP');
 return digest(fs.readFileSync(file));
}
function queryTaskXml(){
 const exe=path.win32.join(process.env.SystemRoot??'C:\\Windows',
   'System32','schtasks.exe');
 need(fs.existsSync(exe),'R181_TASK_SCHEDULER_UNAVAILABLE_STOP');
 const q=spawnSync(exe,['/Query','/TN',TASK,'/XML'],{
  encoding:'buffer',shell:false,windowsHide:true,timeout:15000,maxBuffer:512*1024});
 need(q.status===0&&!q.error&&Buffer.isBuffer(q.stdout),
  'R181_TASK_XML_QUERY_STOP');
 const b=q.stdout,utf16=(b[0]===255&&b[1]===254)||
  (b.length>=4&&b[1]===0&&b[3]===0);
 const xml=utf16?new TextDecoder('utf-16le').decode(b):b.toString('utf8');
 const command=xml.match(/<(?:\w+:)?Command>([\s\S]*?)<\/(?:\w+:)?Command>/i)?.[1]??'';
 const args=xml.match(/<(?:\w+:)?Arguments>([\s\S]*?)<\/(?:\w+:)?Arguments>/i)?.[1]??'';
 const sha=digest(Buffer.from(command+'\n'+args));
 need(sha===ACTION_SHA&&(command+' '+args).includes('r181-primary-cycle.mjs')&&
  (command+' '+args).toLowerCase().includes('theme-market-history-r131'),
  'R181_TASK_ACTION_PIN_STOP');
 const enabled=xml.match(/<(?:\w+:)?Enabled>\s*(true|false)\s*<\/(?:\w+:)?Enabled>/i)?.[1];
 need(enabled?.toLowerCase()!=='false','R181_TASK_DISABLED_STOP');
 return exe;
}
// One-way effect. Once schtasks /Run is attempted, never replay this request
// even when the exit status is ambiguous.
export function requestExistingR181TaskOnce({exe}){
 need(process.platform==='win32','R181_TASK_WINDOWS_ONLY_STOP');
 const r=spawnSync(exe,['/Run','/TN',TASK],{
   encoding:'buffer',shell:false,windowsHide:true,timeout:30000,
   maxBuffer:4096});
 if(r.status===0&&!r.error)return 'ACCEPTED';
 return 'STATE_UNKNOWN';
}
export async function runAuthorizedR181Task(proof,{sourceDigest=fixedSourceDigest,
 taskXml=queryTaskXml,launch=requestExistingR181TaskOnce,
 acquire=acquireInstallLock,claim=createInstallJournal,
 release=releaseInstallClaim}={}){
 need(proof?.manifest?.operation===OPERATION&&
  proof.manifest.taskName===TASK,'R181_TASK_PROOF_REQUIRED');
 const id=proof.request.requestId;
 let lease=null,claimed=false,attempted=false,retain=false;
 let stage='PRECHECK',code='R181_TASK_NOT_EXECUTED';
 try{
  lease=acquire({journalRoot:ROOT,requestId:id,sharedLock:SHARED});
  need(sourceDigest(TARGET,4331)===TARGET_AFTER_SHA,
   'R181_TASK_PATCH_NOT_INSTALLED_STOP');
  need(sourceDigest(CYCLE,7089)===CYCLE_SHA,
   'R181_TASK_CYCLE_SOURCE_DRIFT_STOP');
  const exe=taskXml();
  stage='CLAIM';
  // Irreversible claim must precede task-start effect.
  claimed=true;
  claim({journalRoot:ROOT,requestId:id,sharedLock:SHARED,fd:lease.fd});
  stage='TASK_RUN';
  attempted=true;
  const launched=launch({exe});
  if(launched!=='ACCEPTED'){
   retain=true;
   return Object.freeze({status:'STATE_UNKNOWN',code:'R181_TASK_RUN_OUTCOME_UNKNOWN',
    taskRunRequested:true,collectorVerified:false,providerCalls:null,
    sqliteWrites:null,d1Writes:null,requestId:id,controlSha:proof.controlSha});
  }
  // Accepted start != actual success. Ledger must advance independently.
  return Object.freeze({status:'RUN_REQUEST_ACCEPTED',
   code:'R181_TASK_SCHEDULER_ACCEPTED',
   taskRunRequested:true,collectorVerified:false,providerCalls:null,
   sqliteWrites:null,d1Writes:null,requestId:id,controlSha:proof.controlSha});
 }catch(e){
  code=/^R181_TASK_[A-Z0-9_]{3,100}$/.test(e?.code??'')?
    e.code:'R181_TASK_UNCLASSIFIED_STOP';
  if(attempted||claimed){retain=true;
   return Object.freeze({status:'STATE_UNKNOWN',code:'R181_TASK_STATE_RECONCILE',
    stage,taskRunRequested:attempted,collectorVerified:false,
    providerCalls:null,sqliteWrites:null,d1Writes:null,
    requestId:id,controlSha:proof.controlSha});}
  return Object.freeze({status:'PREFLIGHT_STOP',code,taskRunRequested:false,
    collectorVerified:false,providerCalls:0,sqliteWrites:0,d1Writes:0,
    requestId:id,controlSha:proof.controlSha});
 }finally{
  if(lease!==null)try{release({fd:lease.fd,sharedLock:SHARED,
   requestId:id,retain});}catch{/* Recovery: retain original one-shot journal */}
 }
}
export async function runR181ExistingTaskEntry({event,env,
 controlRoot,readManifest=readApprovedManifest,
 verifyCode=verifyCodeAncestor,verifyRoot=verifyControlRoot,
 io}={}){
 verifyRoot(controlRoot,env);
 const request=JSON.parse(event?.issue?.body??'{}');
 need(MANIFEST.test(request.approvalManifestPath??''),
  'R181_TASK_MANIFEST_PATH_STOP');
 const proof=authorizeExistingR181Task({event,env,
  manifestBytes:readManifest(controlRoot,request.approvalManifestPath)});
 verifyCode(controlRoot,proof.manifest.controlSourceSha);
 return runAuthorizedR181Task(proof,io);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 let result;
 try{
  const env=process.env;
  const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
  result=await runR181ExistingTaskEntry({event,env,
   controlRoot:path.join(env.GITHUB_WORKSPACE??'','writer-b-control')});
 }catch(e){
  result={status:'PREFLIGHT_STOP',
   code:/^R181_TASK_[A-Z0-9_]{3,100}$/.test(e?.code??'')?
    e.code:'R181_TASK_SETUP_UNCLASSIFIED_STOP',
   taskRunRequested:false,collectorVerified:false,
   providerCalls:0,sqliteWrites:0,d1Writes:0};
 }
 try{
  const dir=process.env.RUNNER_TEMP;
  need(typeof dir==='string'&&path.isAbsolute(dir),
   'R181_TASK_TEMP_SCOPE_STOP');
  fs.writeFileSync(path.join(dir,RESULT),JSON.stringify(result)+'\n',
   {flag:'wx'});
 }catch{process.exitCode=1;}
 process.stdout.write(result.status+' '+result.code+'\n');
 if(result.status!=='RUN_REQUEST_ACCEPTED')process.exitCode=1;
}

#!/usr/bin/env node
// Fixed one-file R47 B Windows adapter: requires authenticated owner Issue,
// pinned manifest raw bytes, exact candidate SHA and untouched Task preimage.
// NOT callable through generic pc-job; never executes the installed CMD.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {createHash} from 'node:crypto';
import {applyR47CmdBCas,R47_CMD_B} from './r47-onefile-cas.mjs';
import {approveExactR47B,assertApprovedR47B,R47_B_ISSUE} from './approval-intake.mjs';
import {taskAction} from '../controller/pc-source-readonly.mjs';
import {decodeTaskXmlBytes} from '../writer-b/windows-guards.mjs';
import {sameTaskDefinitionExceptSettingsEnabled}
 from '../r17-writer-b/r17-b-xml.mjs';
import {acquireInstallLock,createInstallJournal,releaseInstallClaim}
 from '../r17-writer-b/r17-b-claim.mjs';

const ROOT=path.dirname(fileURLToPath(import.meta.url));
const PROBE=path.join(ROOT,'r47-task-probe.js');
const DATA=String.raw`E:\ZGmini\data\pc-writer`;
const MUTEX=String.raw`E:\ZGmini\data\pc-writer\writer-source-install.lock`;
const JOURNALS=String.raw`E:\ZGmini\data\pc-writer\task-cmd-b-once`;
const SYS=process.env.SystemRoot??String.raw`C:\Windows`;
const BIN=Object.freeze({
 schtasks:path.join(SYS,'System32','schtasks.exe'),
 cscript:path.join(SYS,'System32','cscript.exe'),
 git:[String.raw`C:\Program Files\Git\cmd\git.exe`,
  String.raw`C:\Program Files\Git\bin\git.exe`].find(x=>fs.existsSync(x)),
});
const stop=code=>{throw Object.assign(new Error(code),{code});};
const need=(ok,code)=>{if(!ok)stop(code);};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&
 path.win32.normalize(a).toLowerCase()===path.win32.normalize(b).toLowerCase();
const run=(tool,args,cwd)=> {
 need(BIN[tool]&&fs.existsSync(BIN[tool]),'TASK_CMD_B_BINARY_STOP');
 const x=spawnSync(BIN[tool],args,{cwd,encoding:null,shell:false,
  windowsHide:true,maxBuffer:3_000_000,timeout:45000,
  env:{...process.env,GIT_TERMINAL_PROMPT:'0',GIT_CONFIG_NOSYSTEM:'1'}});
 need(x.status===0&&!x.error,'TASK_CMD_B_FIXED_TOOL_STOP');
 return x.stdout;
};
const git=(root,...args)=>run('git',['-C',root,'-c','core.fsmonitor=false',...args])
 .toString('utf8').trim();
function exactFile(file,root,max=1024*1024){
 const st=fs.lstatSync(file);
 need(st.isFile()&&!st.isSymbolicLink()&&st.size>0&&st.size<=max,
  'TASK_CMD_B_FILE_SHAPE_STOP');
 const prefix=fs.realpathSync.native(root).toLowerCase()+path.sep;
 need(fs.realpathSync.native(file).toLowerCase().startsWith(prefix),
  'TASK_CMD_B_REALPATH_STOP');
 return fs.readFileSync(file);
}
function writeDurable(file,bytes){
 const fd=fs.openSync(file,'wx');
 try{need(fs.writeSync(fd,bytes)===bytes.length,
  'TASK_CMD_B_BACKUP_SHORT_WRITE_STOP');fs.fsyncSync(fd);}
 finally{fs.closeSync(fd);}
 need(fs.readFileSync(file).equals(bytes),
  'TASK_CMD_B_BACKUP_READBACK_STOP');
}
function taskXml(task){
 const raw=run('schtasks',['/Query','/TN',task,'/XML']);
 const decoded=decodeTaskXmlBytes(raw);
 need((decoded.match(/<Exec\b/gi)||[]).length===1&&
  (decoded.match(/<Command>/gi)||[]).length===1,
  'TASK_CMD_B_TASK_ACTION_COUNT_STOP');
 return {raw,decoded,normalized:sameTaskDefinitionExceptSettingsEnabled(decoded)};
}
function taskProbe(){
 let p;
 try{p=JSON.parse(run('cscript',['//NoLogo',PROBE]).toString('utf8'));}
 catch{stop('TASK_CMD_B_TASK_PROBE_PARSE_STOP');}
 need(p?.ok===true&&typeof p.enabled==='boolean'&&
  Number.isInteger(p.state)&&p.state>=0&&p.state<=4&&
  ['instances','relatedProcesses','unknownProcessLines'].every(k=>
   Number.isInteger(p[k])&&p[k]>=0&&p[k]<100000),
  'TASK_CMD_B_TASK_PROBE_STOP');
 return p;
}
const drained=p=>p.enabled===false&&p.instances===0&&
 p.relatedProcesses===0&&p.unknownProcessLines===0&&p.state!==4;
const notRunning=p=>p.instances===0&&p.relatedProcesses===0&&
 p.unknownProcessLines===0&&p.state!==4;
export function makeR47WindowsAdapter(auth,{candidateRoot}){
 assertApprovedR47B(auth);
 const m=auth.manifest;
 const target=m.targetPath;
 const journalRoot=path.join(JOURNALS,auth.requestId);
 const journalFile=path.join(journalRoot,'journal.jsonl');
 let lock=null,baseTask=null,original=null,claimed=false;
 function record(phase){
  if(!claimed)return;
  const fd=fs.openSync(journalFile,'a');
  try{fs.writeSync(fd,JSON.stringify({phase,at:new Date().toISOString()})+'\n');
   fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
 }
 function ownerLock(){
  need(lock&&fs.readFileSync(MUTEX,'utf8')===auth.requestId,
   'TASK_CMD_B_LOCK_OWNER_DRIFT_STOP');
 }
 function readTarget(){return exactFile(target,DATA);}
 function probeEvidence(){
  ownerLock();
  const x=taskXml(m.task),p=taskProbe(),bytes=readTarget();
  const action=taskAction(x.decoded);
  // A direct approved Task action is mandatory. An unknown nested launcher is
  // not silently accepted as proof of executing this CMD.
  const direct=same(action.command,target);
  return {x,p,bytes,direct,action};
 }
 return {
  async assertPinnedApproval(candidate){return assertApprovedR47B(auth)===auth&&
   candidate===m;},
  async acquireSharedWriterLease(requestId){
   need(requestId===auth.requestId,'TASK_CMD_B_REQUEST_OWNER_STOP');
   lock=acquireInstallLock({journalRoot:JOURNALS,
    requestId,sharedLock:MUTEX});
  },
  async readPreimage(){
   const e=probeEvidence();
   need(e.direct,'TASK_CMD_B_TASK_ACTION_NOT_DIRECT_STOP');
   if(!baseTask){baseTask=e.x;original=e.bytes;}
   return {task:m.task,taskActionPath:e.direct?target:e.action.command,
    installedFilePath:target,taskXmlSha256:sha(e.x.raw),
    installedSha256:sha(e.bytes),taskEnabled:e.p.enabled,
    taskRunning:!notRunning(e.p),sharedWriterLeaseOwned:true,
    unrelatedWriteConflict:!e.x.raw.equals(baseTask.raw),
    sourceDirtyOnTarget:!e.bytes.equals(original)};
  },
  async fetchCandidateBytes(){
   need(git(candidateRoot,'rev-parse','HEAD')===m.sourceSha&&
    git(candidateRoot,'status','--porcelain=v1','--untracked-files=all')==='',
    'TASK_CMD_B_CANDIDATE_SOURCE_DRIFT_STOP');
   const p=path.join(candidateRoot,...m.sourcePath.split('/'));
   return exactFile(p,candidateRoot);
  },
  async backupOriginal(){
   ownerLock();
   need(baseTask&&original&&sha(original)===m.beforeSha256,
    'TASK_CMD_B_BACKUP_ORIGIN_STOP');
   createInstallJournal({journalRoot:JOURNALS,
    requestId:auth.requestId,sharedLock:MUTEX,fd:lock.fd});
   claimed=true;
   writeDurable(path.join(journalRoot,'original.cmd'),original);
   writeDurable(path.join(journalRoot,'task-original.xml'),baseTask.raw);
   record('BACKUP_VERIFIED');
   return {sha256:sha(original),durable:true};
  },
  async pauseExactTask(task){
   ownerLock();need(task===m.task&&baseTask,
    'TASK_CMD_B_TASK_PAUSE_SCOPE_STOP');
   need(taskXml(task).raw.equals(baseTask.raw)&&
    notRunning(taskProbe()),'TASK_CMD_B_TASK_PREPAUSE_DRIFT_STOP');
   run('schtasks',['/Change','/TN',task,'/Disable']);
   record('TASK_PAUSED');
  },
  async assertTaskQuiet(){
   for(let i=0;i<60;i++){
    const a=taskProbe();
    if(drained(a)){
     await delay(1200);
     if(drained(taskProbe())){record('TASK_DRAINED');return true;}
    }else await delay(1200);
   }
   return false;
  },
  async readPausedState(){
   const e=probeEvidence();
   return {task:m.task,installedFilePath:target,
    installedSha256:sha(e.bytes),taskEnabled:e.p.enabled,
    taskRunning:!drained(e.p),taskDefinitionExceptEnabledMatchesOriginal:
     e.x.normalized===baseTask.normalized,
    sharedWriterLeaseOwned:true,
    unrelatedWriteConflict:!e.bytes.equals(original)};
  },
  async journalWriteIntent(){
   ownerLock();need(claimed,'TASK_CMD_B_CAS_UNCLAIMED_STOP');
   record('WRITE_INTENT');
  },
  async replaceExactBytesIfBeforeMatches(manifest,bytes){
   ownerLock();need(manifest===m&&Buffer.isBuffer(bytes)&&
    sha(bytes)===m.afterSha256,'TASK_CMD_B_CAS_CANDIDATE_STOP');
   const e=probeEvidence();
   need(drained(e.p)&&e.x.normalized===baseTask.normalized&&
    e.bytes.equals(original),'TASK_CMD_B_CAS_BEFORE_DRIFT_STOP');
   const tmp=target+'.r47-cas-'+auth.requestId+'.tmp';
   writeDurable(tmp,bytes);
   // Before-value is checked again immediately before atomic same-dir rename.
   const again=probeEvidence();
   need(drained(again.p)&&again.x.normalized===baseTask.normalized&&
    again.bytes.equals(original),'TASK_CMD_B_CAS_RACE_STOP');
   fs.renameSync(tmp,target);
   need(sha(readTarget())===m.afterSha256,
    'TASK_CMD_B_CAS_READBACK_STOP');
   record('CAS_AFTER_VERIFIED');
  },
  async readInstalledAfter(){
   const e=probeEvidence();
   return {installedFilePath:target,installedSha256:sha(e.bytes),
    taskDefinitionExceptEnabledMatchesOriginal:
     e.x.normalized===baseTask.normalized,
    taskDefinitionUnchanged:e.x.raw.equals(baseTask.raw),
    taskXmlSha256:sha(e.x.raw),taskEnabled:e.p.enabled};
  },
  async restoreExactTask(task){
   ownerLock();need(task===m.task&&baseTask,
    'TASK_CMD_B_TASK_RESTORE_SCOPE_STOP');
   const cur=taskXml(task);
   need(cur.normalized===baseTask.normalized,
    'TASK_CMD_B_TASK_RESTORE_DEFINITION_DRIFT_STOP');
   if(!taskProbe().enabled){
    run('schtasks',['/Change','/TN',task,'/Enable']);
   }
   record('TASK_RESTORED');
  },
  async verifyTaskRestored(){
   ownerLock();
   const x=taskXml(m.task),p=taskProbe();
   return p.enabled===true&&x.raw.equals(baseTask.raw);
  },
  async releaseSharedWriterLease({requestId,retain}){
   ownerLock();need(requestId===auth.requestId,
    'TASK_CMD_B_RELEASE_OWNER_STOP');
   record(retain?'RECOVERY_REQUIRED':'FINALIZED');
   releaseInstallClaim({fd:lock.fd,sharedLock:MUTEX,
    requestId,retain});
   lock=null;
  },
 };
}
// Entrypoint used ONLY by an exact owner-authorized B workflow once registered.
export async function runPinnedR47WindowsB({controlRoot,candidateRoot,event,env}){
 need(process.platform==='win32','TASK_CMD_B_WINDOWS_ONLY_STOP');
 const body=JSON.parse(event?.issue?.body??'null');
 need(typeof body?.approvalManifestPath==='string'&&
  /^approvals\/task-cmd-b\/[a-z0-9][a-z0-9._-]{0,90}\.json$/.test(body.approvalManifestPath),
  'TASK_CMD_B_APPROVAL_PATH_STOP');
 const file=path.join(controlRoot,...body.approvalManifestPath.split('/'));
 const bytes=exactFile(file,path.join(controlRoot,'approvals','task-cmd-b'),16384);
 const controlSha=git(controlRoot,'rev-parse','HEAD');
 const auth=approveExactR47B({event,env,manifestBytes:bytes,controlSha});
 need(git(candidateRoot,'rev-parse','HEAD')===auth.manifest.sourceSha,
  'TASK_CMD_B_PINNED_SOURCE_CHECKOUT_STOP');
 return await applyR47CmdBCas(auth.manifest,
  makeR47WindowsAdapter(auth,{candidateRoot}));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const root=process.env.GITHUB_WORKSPACE;
  need(typeof root==='string'&&root.length>0,'TASK_CMD_B_WORKSPACE_STOP');
  const event=JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH,'utf8'));
  const result=await runPinnedR47WindowsB({
   controlRoot:path.join(root,'r47-control'),
   candidateRoot:path.join(root,'r47-candidate'),event,env:process.env});
  process.stdout.write(JSON.stringify(result)+'\n');
  if(result.status!=='PASS')process.exitCode=1;
 }catch(e){
  process.stdout.write(JSON.stringify({status:'STOP',
   code:/^TASK_CMD_B_[A-Z0-9_]+$/.test(e?.code??'')?e.code:
    'TASK_CMD_B_WINDOWS_ADAPTER_UNVERIFIED_STOP'})+'\n');
  process.exitCode=1;
 }
}

// Fixed operating PC Windows adapter: one owner-approved CNN Task, no shell from Issue.
// Reuses the installed shared Writer B file lock and immutable one-shot journal.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {acquireInstallLock,createInstallJournal,releaseInstallClaim}
 from '../r17-writer-b/r17-b-claim.mjs';
import {decodeTaskXmlBytes} from '../writer-b/windows-guards.mjs';
import {INSTALLED_SOURCE,SOURCE_ROOT,WRAPPER,TASK,sha256,
 normalizedW06TaskTemplate} from './contract.mjs';

const HOME=String.raw`E:\ZGmini\data\pc-writer`;
const CONFIG=path.win32.join(HOME,'config.json');
const SIDE=path.win32.join(HOME,'archive-sidecar-r7','archive-run.mjs');
const LOCK=path.win32.join(HOME,'writer-source-install.lock');
const JOURNAL=path.win32.join(HOME,'task-create-b');
const CORE='ZGMINI-PC-Local-Core';
const KOREA='ZGMINI-PC-Local-Korea';
const WRITER='ZGMINI-PC-Writer';
const stop=c=>{throw Object.assign(Error(c),{code:c});};
const need=(v,c)=>{if(!v)stop(c);};
const BIN={
 schtasks:path.win32.join(process.env.SystemRoot??String.raw`C:\Windows`,'System32','schtasks.exe'),
 powershell:path.win32.join(process.env.SystemRoot??String.raw`C:\Windows`,'System32','WindowsPowerShell','v1.0','powershell.exe'),
 git:[String.raw`C:\Program Files\Git\cmd\git.exe`,
  String.raw`C:\Program Files\Git\bin\git.exe`].find(x=>fs.existsSync(x))
};
const run=(exe,args,{cwd=SOURCE_ROOT,timeout=20000}={})=>{
 need(typeof exe==='string'&&fs.existsSync(exe),'TASK_CREATE_B_BINARY_STOP');
 const p=spawnSync(exe,args,{cwd,encoding:null,shell:false,
  windowsHide:true,timeout,maxBuffer:1024*1024,
  env:{...process.env,GIT_TERMINAL_PROMPT:'0',GIT_OPTIONAL_LOCKS:'0'}});
 need(p.status===0&&!p.error,'TASK_CREATE_B_NATIVE_COMMAND_STOP');
 return p.stdout;
};
const digest=b=>createHash('sha256').update(b).digest('hex');
const nativeTaskRaw=name=>run(BIN.schtasks,['/Query','/TN',name,'/XML']);
const nativeTask=name=>decodeTaskXmlBytes(nativeTaskRaw(name));
function taskPresent(name){
 // A successful fixed Task inventory query proves absence; a failed per-name
 // query is NOT interpreted as Task absence (may be ACL or scheduler error).
 const script=`$ErrorActionPreference='Stop';$t=@(Get-ScheduledTask -ErrorAction Stop|Where-Object {$_.TaskName -eq '${name}'});[Console]::Out.Write($t.Count)`;
 const out=run(BIN.powershell,['-NoProfile','-NonInteractive','-Command',script]);
 const n=out.toString('utf8').trim();
 need(n==='0'||n==='1','TASK_CREATE_B_INVENTORY_UNVERIFIED_STOP');
 return n==='1';
}
// The scheduler may reserialize an approved trigger but must not add
// boot/calendar/logon/event triggers beyond the sole minute TimeTrigger.
export function hasOnlyApprovedMinuteTrigger(xml){
 if(typeof xml!=='string')return false;
 const blocks=[...xml.matchAll(/<Triggers(?:\s[^>]*)?>([\s\S]*?)<\/Triggers>/gi)];
 if(blocks.length!==1)return false;
 const content=blocks[0][1].trim();
 return /^<TimeTrigger(?:\s[^>]*)?>[\s\S]*<\/TimeTrigger>$/i.test(content)&&
  (content.match(/<TimeTrigger\b/gi)??[]).length===1&&
  (content.match(/<\/TimeTrigger\s*>/gi)??[]).length===1&&
  !/<(?!TimeTrigger\b)[A-Za-z]+Trigger\b/i.test(content);
}

const taskEnabled=xml=>{
 const settings=xml.match(/<Settings(?:\s[^>]*)?>([\s\S]*?)<\/Settings>/i)?.[1];
 const enabled=settings?.match(/<Enabled>\s*(true|false)\s*<\/Enabled>/i)?.[1];
 need(enabled==='true'||enabled==='false','TASK_CREATE_B_TASK_ENABLED_UNVERIFIED_STOP');
 return enabled==='true';
};
const xmlUser=xml=>{
 const value=xml.match(/<UserId>([^<]{1,512})<\/UserId>/i)?.[1];
 need(typeof value==='string'&&value.length>0,'TASK_CREATE_B_PRINCIPAL_UNKNOWN_STOP');
 return value.replaceAll('&amp;','&').replaceAll('&quot;','"')
  .replaceAll('&apos;',"'").replaceAll('&lt;','<').replaceAll('&gt;','>');
};
function scopedFile(file,maxBytes){
 const stat=fs.lstatSync(file);
 need(stat.isFile()&&!stat.isSymbolicLink()&&stat.size>0&&stat.size<=maxBytes,
  'TASK_CREATE_B_LOCAL_FILE_SHAPE_STOP');
 return fs.readFileSync(file);
}
const installedSource=()=>{
 const head=run(BIN.git,['--no-optional-locks','-C',SOURCE_ROOT,'rev-parse','HEAD']).toString('utf8').trim();
 // The installed minute lane itself rejects dirty scoped sources.
 const dirty=run(BIN.git,['--no-optional-locks','-C',SOURCE_ROOT,
  'status','--porcelain','--untracked-files=all','--','lib','worker',
  'scripts/pc-writer']).toString('utf8').trim();
 need(!dirty,'TASK_CREATE_B_INSTALLED_SOURCE_DIRTY_STOP');
 let cfg;try{cfg=JSON.parse(scopedFile(CONFIG,65536).toString('utf8'));}
 catch{stop('TASK_CREATE_B_CONFIG_SOURCE_STOP')}
 need(/^[a-f0-9]{40}$/.test(head),'TASK_CREATE_B_SOURCE_HEAD_STOP');
 return {installedSourceSha:head,configSourceSha:cfg?.source??null};
};
export function createOperatingTaskCreateBPort(proof){
 need(process.platform==='win32','TASK_CREATE_B_WINDOWS_ONLY_STOP');
 const m=proof.manifest;
 let held=null,original=null,account=null,taskDefinition=null,enabledDefinition=null;
 const protectedTaskNames=[CORE,KOREA,WRITER];
 const snapshots=()=>Object.fromEntries(protectedTaskNames.map(name=>{
  const bytes=nativeTaskRaw(name);return [name,{bytes,hash:digest(bytes)}];
 }));
 const coreXml=()=>nativeTask(CORE);
 const coreHash=()=>digest(nativeTaskRaw(CORE));
 const protectedProof=()=>{
  const state=installedSource();
  return state.installedSourceSha===INSTALLED_SOURCE&&
   state.configSourceSha===INSTALLED_SOURCE&&
   coreHash()===m.coreTaskXmlSha256&&
   digest(scopedFile(SIDE,131072))===m.sidecarSourceSha256&&
   (!original||protectedTaskNames.every(name=>
    snapshots()[name].bytes.equals(original[name].bytes)));
 };
 const taskMatches=(xml,expectedEnabled)=>{
  // Scheduler may reserialize XML. Compare the fixed execution semantics,
  // the actual approved principal, and the exact single action instead.
  const settings=xml.match(/<Settings(?:\s[^>]*)?>([\s\S]*?)<\/Settings>/i)?.[1]??'';
  const commands=[...xml.matchAll(/<Command>([^<]+)<\/Command>/gi)];
  const args=[...xml.matchAll(/<Arguments>([^<]+)<\/Arguments>/gi)];
  const working=[...xml.matchAll(/<WorkingDirectory>([^<]+)<\/WorkingDirectory>/gi)];
  const decoded=t=>t.replaceAll('&quot;','"').replaceAll('&amp;','&');
  const cmd=commands.length===1?decoded(commands[0][1]):'';
  const argumentsText=args.length===1?decoded(args[0][1]):'';
  const workingDir=working.length===1?decoded(working[0][1]):'';
  const expectedCommand=path.win32.join(process.env.SystemRoot??String.raw`C:\Windows`,
   'System32','wscript.exe');
  return xml.includes('<Interval>PT1M</Interval>')&&
   xml.includes('<MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>')&&
   xml.includes('<ExecutionTimeLimit>PT30M</ExecutionTimeLimit>')&&
   xml.includes('<LogonType>InteractiveToken</LogonType>')&&
   xml.includes('<RunLevel>LeastPrivilege</RunLevel>')&&
   hasOnlyApprovedMinuteTrigger(xml)&&
   (xml.match(/<Exec\b/gi)??[]).length===1&&
   commands.length===1&&args.length===1&&working.length===1&&
   path.win32.normalize(cmd).toLowerCase()===path.win32.normalize(expectedCommand).toLowerCase()&&
   argumentsText==='"'+WRAPPER+'"'&&
   path.win32.normalize(workingDir).toLowerCase()===path.win32.normalize(SOURCE_ROOT).toLowerCase()&&
   xmlUser(xml)===account&&
   taskEnabled(xml)===expectedEnabled&&settings.length>0;
 };
 const backing=path.win32.join(JOURNAL,proof.request.requestId);
 return {
  async acquireSharedLease(requestId){
   held=acquireInstallLock({journalRoot:JOURNAL,requestId,sharedLock:LOCK});
  },
  async observe(){
   const src=installedSource(),coreBytes=nativeTaskRaw(CORE);
   const core=decodeTaskXmlBytes(coreBytes);
   account=xmlUser(core);
   return {...src,taskExists:taskPresent(TASK),wrapperExists:fs.existsSync(WRAPPER),
    coreTaskXmlSha256:digest(coreBytes),
    sidecarSourceSha256:digest(scopedFile(SIDE,131072)),
    coreTaskEnabled:taskEnabled(core),unrelatedTaskMutation:false};
  },
  operatingAccount(){need(typeof account==='string','TASK_CREATE_B_ACCOUNT_PRECHECK_STOP');return account;},
  async claimOnce(requestId){
   need(held!==null,'TASK_CREATE_B_LEASE_MISSING_STOP');
   createInstallJournal({journalRoot:JOURNAL,requestId,sharedLock:LOCK,fd:held.fd});
  },
  async backupProtected(){
   original=snapshots();
   need(protectedProof(),'TASK_CREATE_B_PROTECTION_DRIFT_STOP');
   // The backup is local to the previously claimed private data root.
   for(const [name,obj] of Object.entries(original)){
    const p=path.win32.join(backing,name+'.xml');
    fs.writeFileSync(p,obj.bytes,{flag:'wx'});
    need(fs.readFileSync(p).equals(obj.bytes),'TASK_CREATE_B_BACKUP_READBACK_STOP');
   }
  },
  async createLauncherExclusive(dest,bytes){
   need(dest===WRAPPER&&Buffer.isBuffer(bytes),
    'TASK_CREATE_B_LAUNCHER_SCOPE_STOP');
   fs.writeFileSync(dest,bytes,{flag:'wx'});
  },
  async launcherReadback(dest,digestApproved){
   return dest===WRAPPER&&digest(scopedFile(dest,8192))===digestApproved;
  },
  async registerTaskDisabled(name,bytes){
   need(name===TASK&&Buffer.isBuffer(bytes)&&!taskPresent(TASK),
    'TASK_CREATE_B_TASK_SCOPE_STOP');
   taskDefinition=bytes;
   const file=path.win32.join(backing,'candidate-task-disabled.xml');
   fs.writeFileSync(file,Buffer.concat([Buffer.from([0xff,0xfe]),bytes]),{flag:'wx'});
   run(BIN.schtasks,['/Create','/TN',TASK,'/XML',file]);
  },
  async taskReadback({name,enabled,definitionTemplateSha256}){
   if(name!==TASK||!taskPresent(TASK))return false;
   const xml=nativeTask(TASK);
   if(!taskMatches(xml,enabled))return false;
   const expected=enabled?m.enabledTemplateSha256:m.disabledTemplateSha256;
   return definitionTemplateSha256===expected;
  },
  async enableTask(name){
   need(name===TASK&&taskPresent(TASK)&&
    taskMatches(nativeTask(TASK),false)&&protectedProof(),
    'TASK_CREATE_B_ENABLE_PRECONDITION_STOP');
   run(BIN.schtasks,['/Change','/TN',TASK,'/Enable']);
  },
  async verifyProtectedUnchanged(){
   return protectedProof();
  },
  async undoOwnedTaskIfExact(name,template){
   if(name!==TASK||template!==m.disabledTemplateSha256)return false;
   if(!taskPresent(TASK))return true;
   if(!taskMatches(nativeTask(TASK),false))return false;
   run(BIN.schtasks,['/Delete','/TN',TASK,'/F']);
   return !taskPresent(TASK);
  },
  async undoOwnedLauncherIfExact(dest,hash){
   if(dest!==WRAPPER||hash!==m.launcherSha256)return false;
   if(!fs.existsSync(dest))return true;
   if(digest(scopedFile(dest,8192))!==hash)return false;
   fs.unlinkSync(dest);
   return !fs.existsSync(dest);
  },
  async verifyRestored(){
   return !taskPresent(TASK)&&!fs.existsSync(WRAPPER)&&protectedProof();
  },
  async releaseSharedLease(requestId){
   if(!held)return;
   releaseInstallClaim({fd:held.fd,sharedLock:LOCK,requestId,retain:false});
   held=null;
  }
 };
}

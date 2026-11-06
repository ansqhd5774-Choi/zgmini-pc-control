// One-shot Windows B transaction: commit exactly TWO historically approved
// calendar dirty files on top of approved cf43, then move config.source only.
// No collector, API, DB, D1, Writer, Controller or new scheduled task.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {BASE,CONTROL_REPO,SOURCE_ROOT,CONFIG_PATH,CORE_TASK,CORE_TASK_XML_SHA,
 APPROVED,R17_PROTECTED,FILES,hash,verifyBefore,verifyCommitted,
 replaceSourceOnly} from './contract.mjs';
import {sameTaskDefinitionExceptSettingsEnabled} from '../r17-writer-b/r17-b-xml.mjs';
import {classifyRecovery} from './recovery-plan.mjs';

const HERE=path.dirname(fileURLToPath(import.meta.url));
const LOCK=String.raw`E:\ZGmini\data\pc-writer\writer-source-install.lock`;
const CORE_LOCK=String.raw`E:\ZGmini\data\pc-writer\local-cycle.lock`;
const JOURNALS=String.raw`E:\ZGmini\data\pc-writer\calendar-cf43-source-align`;
const GIT=[String.raw`C:\Program Files\Git\cmd\git.exe`,
 String.raw`C:\Program Files\Git\bin\git.exe`].find(fs.existsSync);
const TASK_EXE=path.join(process.env.SystemRoot??String.raw`C:\Windows`,
 'System32','schtasks.exe');
const CSCRIPT=path.join(process.env.SystemRoot??String.raw`C:\Windows`,
 'System32','cscript.exe');
const PROBE=path.join(process.env.GITHUB_WORKSPACE??'', 'control',
 'r17-writer-b','r17-b-windows-probe.js');
const SHA40=/^[a-f0-9]{40}$/,SHA64=/^[a-f0-9]{64}$/;
const stop=code=>{throw Object.assign(new Error(code),{code});};
const need=(x,c)=>{if(!x)stop(c);};
const err=e=>/^CAL_CF43_[A-Z0-9_]+$/.test(e?.code??'')?e.code:
 'CAL_CF43_UNEXPECTED_STOP';
const filename=rel=>path.join(SOURCE_ROOT,...rel.split('/'));
const pause=ms=>new Promise(r=>setTimeout(r,ms));
let hooks=null;

function execute(exe,args,{write=false,input=null,maxBuffer=1000000,cwd}={}){
 need(exe&&fs.existsSync(exe),'CAL_CF43_EXE_MISSING_STOP');
 const r=spawnSync(exe,args,{windowsHide:true,shell:false,encoding:null,
  input,timeout:35000,maxBuffer,cwd,env:{...process.env,GIT_TERMINAL_PROMPT:'0',
   GIT_CONFIG_NOSYSTEM:'1',GIT_OPTIONAL_LOCKS:write?'1':'0'}});
 need(!r.error&&r.status===0,'CAL_CF43_COMMAND_STOP');
 return r.stdout;
}
function git(args,{write=false,raw=false}={}){
 const opts=['-C',SOURCE_ROOT,'-c','core.fsmonitor=false',
  '-c','core.autocrlf=false'];
 if(write){need(hooks&&fs.readdirSync(hooks).length===0,
  'CAL_CF43_HOOKS_STOP');opts.push('-c',`core.hooksPath=${hooks}`);}
 const output=execute(GIT,[...opts,...args],{write});
 return raw?output:output.toString('utf8').trim();
}
function safeFile(file,{root=SOURCE_ROOT}={}){
 const st=fs.lstatSync(file);
 need(st.isFile()&&!st.isSymbolicLink()&&st.size>0&&st.size<2000000,
  'CAL_CF43_NOT_REGULAR_STOP');
 const canonical=fs.realpathSync.native(file).toLowerCase(),
  src=fs.realpathSync.native(root).toLowerCase();
 need(canonical.startsWith(src+path.sep.toLowerCase()),
  'CAL_CF43_PATH_ESCAPE_STOP');
 return fs.readFileSync(file);
}
const xml=()=>execute(TASK_EXE,['/Query','/TN',CORE_TASK,'/XML']);
const xmlText=b=>b[0]===255&&b[1]===254?b.subarray(2).toString('utf16le'):
 b[1]===0&&b[3]===0?b.toString('utf16le'):b.toString('utf8');
const xmlIgnoringEnabled=b=>sameTaskDefinitionExceptSettingsEnabled(xmlText(b));
function probe(){
 const p=JSON.parse(execute(CSCRIPT,['//NoLogo',PROBE]).toString('utf8'));
 need(p?.ok===true&&typeof p.enabled==='boolean'&&
  Number.isInteger(p.instances)&&Number.isInteger(p.relatedProcesses)&&
  Number.isInteger(p.unknownProcessLines)&&Number.isInteger(p.state),
  'CAL_CF43_TASK_PROBE_STOP');
 return p;
}
const coreDrained=p=>p.enabled===false&&p.state!==4&&p.instances===0&&
 p.relatedProcesses===0&&p.unknownProcessLines===0&&!fs.existsSync(CORE_LOCK);
async function drain(){
 let consecutive=0;
 const deadline=Date.now()+180000;
 while(Date.now()<deadline){
  consecutive=coreDrained(probe())?consecutive+1:0;
  if(consecutive>=2)return;
  await pause(1500);
 }
 stop('CAL_CF43_CORE_DRAIN_TIMEOUT_STOP');
}
const diffList=(...args)=>git(args).split(/\r?\n/).filter(Boolean);
function relevantDirty(){
 return diffList('diff','--no-ext-diff','--no-renames','--name-status','HEAD',
  '--','worker','lib','scripts/pc-writer').map(line=>{
  const [status,rel]=line.split('\t');
  need(status==='M'&&FILES.includes(rel),'CAL_CF43_DIRTY_UNAPPROVED_STOP');
  return {status,path:rel,sha256:hash(safeFile(filename(rel)))};
 });
}
function indexCount(){
 const s=git(['diff','--no-ext-diff','--cached','--name-only']);
 return s?s.split(/\r?\n/).length:0;
}
function inspect(){
 const files=Object.fromEntries(FILES.map(p=>[p,safeFile(filename(p))]));
 const configRaw=safeFile(CONFIG_PATH,{root:String.raw`E:\ZGmini\data\pc-writer`});
 const config=JSON.parse(configRaw.toString('utf8'));
 const taskXml=xml(),p=probe();
 const b={sourceRoot:SOURCE_ROOT,configPath:CONFIG_PATH,coreTask:CORE_TASK,
  head:git(['rev-parse','HEAD']),configSource:config.source,
  taskXmlSha:hash(taskXml),coreEnabled:p.enabled,
  relevantDirty:relevantDirty(),stagedCount:indexCount(),
  configSha256:hash(configRaw),headTree:git(['rev-parse','HEAD^{tree}']),
  originalBranch:git(['branch','--show-current'])};
 verifyBefore(b);
 for(const rel of FILES)need(hash(files[rel])===APPROVED[rel],
  'CAL_CF43_APPROVED_BYTES_STOP');
 return {b,files,configRaw,taskXml,taskXmlShape:xmlIgnoringEnabled(taskXml)};
}
function auth(){
 const e=process.env;
 need(process.platform==='win32'&&GIT&&e.GITHUB_REPOSITORY===CONTROL_REPO&&
  e.GITHUB_ACTOR==='ansqhd5774-Choi'&&e.GITHUB_EVENT_NAME==='issues'&&
  e.GITHUB_EVENT_ACTION==='opened'&&e.GITHUB_RUN_ATTEMPT==='1'&&
  SHA40.test(e.GITHUB_SHA??''),'CAL_CF43_EVENT_STOP');
 const control=path.join(e.GITHUB_WORKSPACE??'','control');
 const controlHead=execute(GIT,['-C',control,'rev-parse','HEAD'])
  .toString('utf8').trim();
 need(controlHead===e.GITHUB_SHA,'CAL_CF43_CONTROL_CHECKOUT_STOP');
 const event=JSON.parse(fs.readFileSync(e.GITHUB_EVENT_PATH,'utf8'));
 need(event.action==='opened'&&event.repository?.private===true&&
  event.repository.full_name===CONTROL_REPO&&
  event.sender?.login===e.GITHUB_ACTOR&&
  event.issue?.user?.login===e.GITHUB_ACTOR&&
  event.issue?.title==='pc-calendar-cf43-two-approved-source-align-once'&&
  !event.issue.pull_request,'CAL_CF43_ISSUE_STOP');
 need(typeof event.issue.body==='string'&&event.issue.body.length<=4096,
  'CAL_CF43_REQUEST_BODY_STOP');
 const request=JSON.parse(event.issue.body);
 const uuid='[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}';
 need(Object.keys(request).length===6&&
  request.schema==='ZGMINI_CAL_CF43_TWO_APPROVED_B_REQUEST_V1'&&
  new RegExp('^pc-calendar-'+uuid+'$').test(request.requestId??'')&&
  new RegExp('^chat-'+uuid+'$').test(request.chatId??'')&&
  request.operation==='calendar-cf43-approved-dirty-two-source-align-once'&&
  request.controlSha===e.GITHUB_SHA&&SHA64.test(request.approvalSha256??''),
  'CAL_CF43_REQUEST_STOP');
 const manifestRaw=fs.readFileSync(path.join(HERE,'approval.json'));
 need(hash(manifestRaw)===request.approvalSha256,'CAL_CF43_MANIFEST_HASH_STOP');
 const manifest=JSON.parse(manifestRaw.toString('utf8'));
 need(manifest.schema==='ZGMINI_CAL_CF43_TWO_APPROVED_SOURCE_B_V1'&&
  manifest.status==='APPROVED_B_INSTALL_ONCE'&&
  manifest.scope==='SYNTHETIC_GIT_COMMIT_APPROVED_DIRTY_TWO_FILES'&&
  manifest.baseSourceSha===BASE&&manifest.coreTaskXmlSha256===CORE_TASK_XML_SHA&&
  manifest.sourceRoot===SOURCE_ROOT&&manifest.configPath===CONFIG_PATH&&
  manifest.coreTask===CORE_TASK&&
  FILES.every(f=>manifest.approvedPathsSha256?.[f]===APPROVED[f])&&
  Object.keys(manifest.approvedPathsSha256??{}).length===FILES.length&&
  manifest.gitEffect==='ONE_NEW_LOCAL_BRANCH_TWO_FILE_COMMIT_NO_RESET_STASH'&&
  manifest.configEffect==='SOURCE_SHA_ONLY'&&
  manifest.coreTaskEffect==='TEMPORARY_DISABLE_DRAIN_RESTORE'&&
  manifest.providerCalls===0&&manifest.databaseWrites===0&&
  manifest.writerRuns===0&&manifest.schedulerDefinitionChanges===0&&
  manifest.runCount===1,'CAL_CF43_APPROVAL_SCOPE_STOP');
 return {id:request.requestId,issueNumber:event.issue.number};
}
function store(pathname,bytes){
 const fd=fs.openSync(pathname,'wx');
 try{fs.writeSync(fd,bytes);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
}
function replace(file,bytes,id){
 const name=`${file}.calendar-cf43-${id}-${process.pid}.tmp`;
 store(name,bytes);
 need(fs.readFileSync(name).equals(bytes),'CAL_CF43_TEMP_CHECKSUM_STOP');
 fs.renameSync(name,file);
 need(fs.readFileSync(file).equals(bytes),'CAL_CF43_REPLACE_READBACK_STOP');
}
function append(file,value){
 const fd=fs.openSync(file,'a');
 try{fs.writeSync(fd,JSON.stringify(value)+'\n');fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
}
function observedCommit(branch){
 const head=git(['rev-parse','HEAD']);
 const parent=git(['rev-parse','HEAD^']);
 need(parent===BASE&&git(['rev-list','--count',`${BASE}..${head}`])==='1',
  'CAL_CF43_COMMIT_NOT_DIRECT_CHILD_STOP');
 const diff=diffList('diff-tree','--no-commit-id','--name-status','-r',BASE,head)
  .map(row=>{const [status,p]=row.split('\t');return {status,path:p};});
 const stored=Object.fromEntries(FILES.map(p=>[p,
  hash(git(['show',`HEAD:${p}`],{raw:true}))]));
 const parentBlobs=Object.fromEntries(R17_PROTECTED.map(p=>[p,
  git(['rev-parse',`HEAD^:${p}`])]));
 const childBlobs=Object.fromEntries(R17_PROTECTED.map(p=>[p,
  git(['rev-parse',`HEAD:${p}`])]));
 const clean=git(['diff','--name-only','HEAD','--','worker','lib','scripts/pc-writer'])==='';
 return verifyCommitted({parent,head,branch,diff,storedSha256:stored,
  r17ParentBlobs:parentBlobs,r17ChildBlobs:childBlobs,
  stagedCount:indexCount(),relevantClean:clean});
}
// Mimic run-local.mjs --publish's actual Git guard (no custom autocrlf or
// disabled system Git config). A conflicting user Git setting must be visible.
function writerGitGuardClean(){
 const r=spawnSync(GIT,['-C',SOURCE_ROOT,'diff','--quiet','HEAD','--',
  'worker','lib','scripts/pc-writer'],{windowsHide:true,shell:false,timeout:20000,
  encoding:null,env:{...process.env,GIT_OPTIONAL_LOCKS:'0',GIT_TERMINAL_PROMPT:'0'}});
 need(!r.error&&[0,1].includes(r.status),'CAL_CF43_WRITER_GIT_GUARD_ERROR_STOP');
 return r.status===0;
}

export async function install(){
 const request=auth();
 // A failing read-only inspection must not create a journal, lock or task edit.
 let baseline=inspect();
 const result={status:'CAL_CF43_B_STOP',phase:'PREFLIGHT',
  requestId:request.id,sourceSha:null,code:null,
  providerCalls:0,dbWrites:0,d1Writes:0,writerRuns:0,operationalWrites:0};
 let lockFd=null,owned=false,disabled=false,branchCreated=false,
  committed=false,configChanged=false,reEnabled=false,recovery=false,
  taskMayHaveChanged=false,taskRestoreAttempted=false,
  branchMayHaveChanged=false,commitMayHaveChanged=false,
  configMayHaveChanged=false;
 let plannedConfigBytes=null;
 const backupDir=path.join(JOURNALS,request.id);
 let journal=null;
 try{
  lockFd=fs.openSync(LOCK,'wx');
  fs.writeSync(lockFd,request.id);fs.fsyncSync(lockFd);owned=true;
  const recheck=inspect();
  need(JSON.stringify(recheck.b)===JSON.stringify(baseline.b),
   'CAL_CF43_PREFLIGHT_DRIFT_STOP');
  need(!fs.existsSync(backupDir),'CAL_CF43_REQUEST_ALREADY_CLAIMED_STOP');
  fs.mkdirSync(JOURNALS,{recursive:true});
  fs.mkdirSync(backupDir);
  hooks=path.join(backupDir,'empty-hooks');fs.mkdirSync(hooks);
  journal=path.join(backupDir,'journal.jsonl');
  store(path.join(backupDir,'config.before'),baseline.configRaw);
  store(path.join(backupDir,'task.before.xml'),baseline.taskXml);
  for(const [rel,bytes] of Object.entries(baseline.files)){
   const backup=path.join(backupDir,...rel.split('/'));
   fs.mkdirSync(path.dirname(backup),{recursive:true});
   store(backup,bytes);need(hash(fs.readFileSync(backup))===APPROVED[rel],
    'CAL_CF43_BACKUP_SHA_STOP');
  }
  append(journal,{phase:'BACKUP_VERIFIED',parent:BASE});
  for(const rel of FILES){
   const attr=git(['check-attr','filter','--',rel]);
   need(attr.endsWith('filter: unspecified')||attr.endsWith('filter: unset'),
    'CAL_CF43_GIT_FILTER_STOP');
  }
  const p=probe();need(p.enabled===true,'CAL_CF43_CORE_ALREADY_DISABLED_STOP');
  taskMayHaveChanged=true; // command may succeed at OS then report an error
  execute(TASK_EXE,['/Change','/TN',CORE_TASK,'/Disable'],{write:true});
  disabled=true;result.operationalWrites++;
  append(journal,{phase:'CORE_DISABLED'});
  await drain();
  need(xmlIgnoringEnabled(xml())===baseline.taskXmlShape,
   'CAL_CF43_TASK_XML_DRIFT_STOP');
  // SAME HEAD branch: existing approved dirty files remain byte-for-byte.
  const branch=`calendar-cf43-b/${request.id}`;
  branchMayHaveChanged=true;
  git(['switch','-c',branch],{write:true});branchCreated=true;
  git(['add','--',...FILES],{write:true});
  need(diffList('diff','--cached','--name-only').join('\n')===FILES.join('\n'),
   'CAL_CF43_STAGE_EXACT_TWO_STOP');
  commitMayHaveChanged=true;
  git(['-c','user.name=ZGMINI Approved Calendar Source',
   '-c','user.email=calendar-cf43@localhost','commit','--no-gpg-sign',
   '-m','ZGMINI approved calendar cf43 two-file source alignment'],{write:true});
  committed=true;result.operationalWrites++;
  const updated=observedCommit(branch);
  need(writerGitGuardClean(),'CAL_CF43_WRITER_GIT_GUARD_DIRTY_STOP');
  append(journal,{phase:'COMMIT_VERIFIED',sha:updated.sha});
  need(hash(safeFile(CONFIG_PATH,{root:String.raw`E:\ZGmini\data\pc-writer`}))===baseline.b.configSha256&&
   coreDrained(probe()),'CAL_CF43_POSTCOMMIT_DRIFT_STOP');
  plannedConfigBytes=replaceSourceOnly(baseline.configRaw,BASE,updated.sha);
  configMayHaveChanged=true;
  replace(CONFIG_PATH,plannedConfigBytes,request.id);
  configChanged=true;result.operationalWrites++;
  need(JSON.parse(fs.readFileSync(CONFIG_PATH,'utf8')).source===updated.sha&&
   git(['rev-parse','HEAD'])===updated.sha,
   'CAL_CF43_SOURCE_POINTER_PAIR_STOP');
  taskRestoreAttempted=true;
  execute(TASK_EXE,['/Change','/TN',CORE_TASK,'/Enable'],{write:true});
  reEnabled=true;disabled=false;result.operationalWrites++;
  need(probe().enabled===true&&
   xmlIgnoringEnabled(xml())===baseline.taskXmlShape&&
   git(['rev-parse','HEAD'])===updated.sha&&
   JSON.parse(fs.readFileSync(CONFIG_PATH,'utf8')).source===updated.sha&&
   FILES.every(p=>hash(safeFile(filename(p)))===APPROVED[p])&&
   indexCount()===0&&writerGitGuardClean()&&
   R17_PROTECTED.every(p=>git(['rev-parse',`HEAD:${p}`])===
    git(['rev-parse',`HEAD^:${p}`])),
   'CAL_CF43_FINAL_READBACK_STOP');
  result.status='CAL_CF43_B_SOURCE_ALIGNED_VERIFIED';
  result.sourceSha=updated.sha;result.phase='VERIFIED';
  append(journal,{phase:'VERIFIED',source:updated.sha});
 }catch(e){
  result.code=err(e);
  if(taskMayHaveChanged&&!disabled&&!reEnabled){
   try{disabled=probe().enabled===false;}
   catch{recovery=true;result.status='CAL_CF43_B_RECOVERY_REQUIRED';}
  }
  if(taskRestoreAttempted&&disabled){
   try{if(probe().enabled===true){reEnabled=true;disabled=false;}}
   catch{recovery=true;result.status='CAL_CF43_B_RECOVERY_REQUIRED';}
  }
  if(branchMayHaveChanged&&!branchCreated&&!recovery){
   try{
    const current=git(['branch','--show-current']);
    if(current===`calendar-cf43-b/${request.id}`)branchCreated=true;
    else need(current===baseline.b.originalBranch,
     'CAL_CF43_BRANCH_DRIFT_UNKNOWN_STOP');
   }catch{recovery=true;result.status='CAL_CF43_B_RECOVERY_REQUIRED';}
  }
  if(commitMayHaveChanged&&!committed&&!recovery){
   try{
    const current=git(['rev-parse','HEAD']);
    if(current!==BASE){
     observedCommit(`calendar-cf43-b/${request.id}`);
     committed=true;
    }
   }catch{recovery=true;result.status='CAL_CF43_B_RECOVERY_REQUIRED';}
  }
  if(configMayHaveChanged&&!configChanged&&!recovery){
   try{
    const current=fs.readFileSync(CONFIG_PATH);
    if(!current.equals(baseline.configRaw)){
     need(plannedConfigBytes&&current.equals(plannedConfigBytes),
      'CAL_CF43_CONFIG_EXTERNAL_DRIFT_STOP');
     configChanged=true;
    }
   }catch{recovery=true;result.status='CAL_CF43_B_RECOVERY_REQUIRED';}
  }
  // Resolve OS/Git may-have-changed flags from OBSERVED state before any
  // rollback. These exact classifications are fault-tested independently.
  if(!recovery){
   try{
    const p=probe(),branch=git(['branch','--show-current']);
    const head=git(['rev-parse','HEAD']);
    let sourceState='UNKNOWN';
    const bytesApproved=FILES.every(rel=>hash(safeFile(filename(rel)))===APPROVED[rel]);
    if(bytesApproved&&head===BASE&&
     branch===baseline.b.originalBranch&&
     relevantDirty().length===2&&indexCount()===0)
     sourceState='BASE_DIRTY';
    else if(bytesApproved&&head===BASE&&
     branch===`calendar-cf43-b/${request.id}`&&relevantDirty().length===2&&
     ['',FILES.join('\n')].includes(git(['diff','--cached','--name-only'])))
     sourceState='BRANCH_DIRTY';
    else if(bytesApproved&&head!==BASE&&
     branch===`calendar-cf43-b/${request.id}`){
     observedCommit(branch);sourceState='COMMITTED_CLEAN';
    }
    const raw=fs.readFileSync(CONFIG_PATH);
    const configState=raw.equals(baseline.configRaw)?'BASE':
     plannedConfigBytes&&raw.equals(plannedConfigBytes)?'CHILD':'UNKNOWN';
    const decision=classifyRecovery({taskState:p.enabled?'ENABLED':'DISABLED',
     sourceState,configState,approvedBytesMatch:bytesApproved,
     drained:coreDrained(p)});
    if(decision==='RECOVERY_REQUIRED'){
     recovery=true;result.status='CAL_CF43_B_RECOVERY_REQUIRED';
    }else if(decision==='STOP_NO_MUTATION'){
     disabled=false;
    }else{
     disabled=true;branchCreated=sourceState!=='BASE_DIRTY';
     committed=sourceState==='COMMITTED_CLEAN';
     configChanged=configState==='CHILD';
    }
   }catch{recovery=true;result.status='CAL_CF43_B_RECOVERY_REQUIRED';}
  }
  if(reEnabled){recovery=true;result.status='CAL_CF43_B_RECOVERY_REQUIRED';}
  else if(disabled&&!recovery){
   try{
    need(coreDrained(probe()),'CAL_CF43_ROLLBACK_CORE_BUSY_STOP');
    if(configChanged){
     need(plannedConfigBytes&&
      fs.readFileSync(CONFIG_PATH).equals(plannedConfigBytes),
      'CAL_CF43_ROLLBACK_CONFIG_EXTERNAL_DRIFT_STOP');
     replace(CONFIG_PATH,baseline.configRaw,request.id+'-restore');
     result.operationalWrites++;
    }
    if(branchCreated){
     need(FILES.every(rel=>hash(safeFile(filename(rel)))===APPROVED[rel]),
      'CAL_CF43_ROLLBACK_FILE_EXTERNAL_DRIFT_STOP');
     if(!committed)git(['restore','--staged','--',...FILES],{write:true});
     if(baseline.b.originalBranch){
      git(['switch',baseline.b.originalBranch],{write:true});
     }else git(['switch','--detach',BASE],{write:true});
     result.operationalWrites++;
     for(const rel of FILES){
      replace(filename(rel),baseline.files[rel],request.id+'-restore');
      result.operationalWrites++;
     }
    }
    need(git(['rev-parse','HEAD'])===BASE&&
     git(['branch','--show-current'])===baseline.b.originalBranch&&
     fs.readFileSync(CONFIG_PATH).equals(baseline.configRaw)&&
     FILES.every(rel=>hash(fs.readFileSync(filename(rel)))===APPROVED[rel]),
     'CAL_CF43_ROLLBACK_SHA_STOP');
    execute(TASK_EXE,['/Change','/TN',CORE_TASK,'/Enable'],{write:true});
    disabled=false;result.operationalWrites++;
    need(probe().enabled===true,'CAL_CF43_CORE_RESTORE_STOP');
    result.status='CAL_CF43_B_STOP_RESTORED';
   }catch{recovery=true;result.status='CAL_CF43_B_RECOVERY_REQUIRED';}
  }
  if(journal)append(journal,{phase:result.status,code:result.code});
 }finally{
  if(lockFd!==null){
   fs.closeSync(lockFd);
   if(!recovery&&owned){
    try{if(fs.readFileSync(LOCK,'utf8')===request.id)fs.unlinkSync(LOCK);}catch{}
   }
  }
 }
 return result;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 install().then(result=>{
  process.stdout.write(JSON.stringify(result)+'\n');
  if(result.status!=='CAL_CF43_B_SOURCE_ALIGNED_VERIFIED')process.exitCode=1;
 }).catch(e=>{
  process.stdout.write(JSON.stringify({status:'CAL_CF43_B_PREFLIGHT_STOP',
   code:err(e),providerCalls:0,dbWrites:0,d1Writes:0,operationalWrites:0})+'\n');
  process.exitCode=1;
 });
}

// Purpose-built R17 five-file B installation adapter for a GitHub self-hosted
// Windows runner. Copy this file AND its siblings into private control
// r17-writer-b/. This script is never a generic pc-job command interpreter.
// It does not request providers, touch SQLite/D1, invoke a Controller updater,
// or change Core task action/triggers. Live execution is NOT validated here.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {
  BASE,CANDIDATE,PATCH_HASH,CORE_XML_HASH,CORE_TASK,CONFIG_PATH,SOURCE_ROOT,
  BEFORE,TARGET,DIFF,sha256,R17Stop,authorize,performApprovedInstall,
} from './r17-writer-b-install-core.mjs';
import {sameTaskDefinitionExceptSettingsEnabled} from './r17-b-xml.mjs';
import {commitExactOverlay} from './r17-b-git-stage.mjs';
import {acquireInstallLock,createInstallJournal,releaseInstallClaim} from './r17-b-claim.mjs';

const ROOT=path.dirname(fileURLToPath(import.meta.url));
const MANIFEST=path.join(ROOT,'approval','R17_WRITER_B_INSTALL_APPROVAL.json');
const PATCH=path.join(ROOT,'approval','R17_A23_REBASE.patch');
const PROBE=path.join(ROOT,'r17-b-windows-probe.js');
const WORKFLOW_REPO='ansqhd5774-Choi/zgmini-pc-control';
const CANDIDATE_CHECKOUT=path.join(process.env.GITHUB_WORKSPACE??'', 'r17-source');
const LOCK=String.raw`E:\ZGmini\data\pc-writer\local-cycle.lock`;
const JOURNAL_ROOT=String.raw`E:\ZGmini\data\pc-writer\r17-b-install-once`;
// A shared OS mutex path: other approved Writer installers must honor this
// same lock. Any existing/stale lock is a STOP, never auto-steal/remove.
const SHARED_INSTALL_LOCK=String.raw`E:\ZGmini\data\pc-writer\writer-source-install.lock`;
const SHA40=/^[a-f0-9]{40}$/;
const MAX_OUTPUT=4_000_000;
const GIT_EXES=[String.raw`C:\Program Files\Git\cmd\git.exe`,
  String.raw`C:\Program Files\Git\bin\git.exe`];
const GIT_EXE=GIT_EXES.find(p=>fs.existsSync(p));
const SYSTEM32=path.join(process.env.SystemRoot??String.raw`C:\Windows`,'System32');
const BIN=Object.freeze({git:GIT_EXE,
  'schtasks.exe':path.join(SYSTEM32,'schtasks.exe'),
  'cscript.exe':path.join(SYSTEM32,'cscript.exe')});
function stop(code){throw new R17Stop(code);}
function check(condition,code){if(!condition)stop(code);}
function command(binary,args,{cwd,stdin,env={}}={}){
  // Fixed executable and argv, shell:false: never a user-supplied command.
  check(['git','schtasks.exe','cscript.exe'].includes(binary),'R17_B_EXECUTABLE_SCOPE_STOP');
  const executable=BIN[binary];
  check(typeof executable==='string'&&fs.existsSync(executable),
    'R17_B_EXECUTABLE_ABSOLUTE_MISSING_STOP');
  const result=spawnSync(executable,args,{cwd,encoding:null,input:stdin,windowsHide:true,
    shell:false,timeout:45_000,maxBuffer:MAX_OUTPUT,
    env:{...process.env,GIT_TERMINAL_PROMPT:'0',GIT_CONFIG_NOSYSTEM:'1',...env}});
  if(result.error||result.status!==0)stop('R17_B_COMMAND_STOP');
  return result.stdout;
}
function git(dir,...args){return command('git',['-C',dir,'-c','core.fsmonitor=false',...args]).toString('utf8').trim();}
function gitRaw(dir,args,{stdin,env}={}){
  return command('git',['-C',dir,'-c','core.fsmonitor=false',...args],{stdin,env});
}
let verifiedEmptyHooksDir=null;
function gitLive(...args){
  check(verifiedEmptyHooksDir&&fs.readdirSync(verifiedEmptyHooksDir).length===0,
    'R17_B_GIT_HOOKS_DIR_STOP');
  return command('git',['-C',SOURCE_ROOT,'-c',`core.hooksPath=${verifiedEmptyHooksDir}`,
    '-c','core.fsmonitor=false',...args]).toString('utf8').trim();
}
function readJson(file){try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{stop('R17_B_JSON_READ_STOP');}}
function readConfig(){const raw=regularFile(CONFIG_PATH,path.dirname(CONFIG_PATH));let obj;
  try{obj=JSON.parse(raw.toString('utf8'));}catch{stop('R17_B_CONFIG_JSON_STOP');}
  check(obj&&typeof obj==='object'&&!Array.isArray(obj)&&SHA40.test(obj.source??''),
    'R17_B_CONFIG_SOURCE_STOP');
  return {raw,obj};
}
function decodeXml(buf){
  if(buf[0]===0xff&&buf[1]===0xfe)return buf.subarray(2).toString('utf16le');
  if(buf[0]===0x3c&&buf[1]===0)return buf.toString('utf16le');
  return buf.toString('utf8').replace(/^\ufeff/,'');
}
function taskXml(){const raw=command('schtasks.exe',['/Query','/TN',CORE_TASK,'/XML']);
  const xml=decodeXml(raw);
  check(/^\s*<\?xml|^\s*<Task\b/.test(xml),'R17_B_TASK_XML_FORMAT_STOP');
  return {raw,xml};
}
const taskXmlComparable=sameTaskDefinitionExceptSettingsEnabled;
function probeTask(){
  const raw=command('cscript.exe',['//NoLogo',PROBE]);let x;
  try{x=JSON.parse(raw.toString('utf8').trim());}catch{stop('R17_B_WINDOWS_PROBE_FORMAT_STOP');}
  check(x?.ok===true&&typeof x.enabled==='boolean'&&Number.isInteger(x.state)&&
    Number.isInteger(x.instances)&&x.instances>=0&&Number.isInteger(x.relatedProcesses)&&
    x.relatedProcesses>=0&&Number.isInteger(x.unknownProcessLines)&&x.unknownProcessLines>=0,
    'R17_B_WINDOWS_PROBE_STOP');
  return x;
}
function sourceFile(filename){return path.join(SOURCE_ROOT,...filename.split('/'));}
function regularFile(file,allowedRoot=SOURCE_ROOT){
  const stat=fs.lstatSync(file);
  check(stat.isFile()&&!stat.isSymbolicLink(),'R17_B_REGULAR_FILE_STOP');
  const real=fs.realpathSync.native(file);
  const parent=fs.realpathSync.native(allowedRoot);
  check(real.toLowerCase().startsWith(parent.toLowerCase()+path.sep),
    'R17_B_REALPATH_SCOPE_STOP');
  return fs.readFileSync(file);
}
function sourceSha(file){return sha256(regularFile(sourceFile(file)));}
function assertSourceState(head,branch,files){
  check(git(SOURCE_ROOT,'rev-parse','HEAD')===head&&
    git(SOURCE_ROOT,'branch','--show-current')===branch&&
    git(SOURCE_ROOT,'status','--porcelain=v1','--untracked-files=all')==='',
    'R17_B_SOURCE_STATE_STOP');
  for(const [file,hash] of Object.entries(files))
    check(fs.existsSync(sourceFile(file))&&sourceSha(file)===hash,'R17_B_SOURCE_FILE_SHA_STOP');
  if(Object.keys(files).length===Object.keys(BEFORE).length){
    for(const file of Object.keys(TARGET).filter(x=>!Object.hasOwn(BEFORE,x)))
      check(!fs.existsSync(sourceFile(file)),'R17_B_ROLLBACK_ADDED_FILE_STOP');
  }
}
function atomicWrite(file,raw){
  const tmp=`${file}.r17-b-${process.pid}.tmp`;
  check(!fs.existsSync(tmp),'R17_B_ATOMIC_TEMP_EXISTS_STOP');
  fs.writeFileSync(tmp,raw,{flag:'wx'});
  try{fs.renameSync(tmp,file);}catch{stop('R17_B_ATOMIC_RENAME_STOP');}
  check(fs.readFileSync(file).equals(raw),'R17_B_ATOMIC_READBACK_STOP');
}
function replaceSourceOnly(raw,from,to){
  const text=raw.toString('utf8');const seen=[...text.matchAll(/"source"\s*:\s*"([a-f0-9]{40})"/g)];
  check(seen.length===1&&seen[0][1]===from,'R17_B_CONFIG_SOURCE_UNIQUE_STOP');
  const changed=text.slice(0,seen[0].index)+seen[0][0].replace(from,to)+
    text.slice(seen[0].index+seen[0][0].length);
  let oldJson,newJson;
  try{oldJson=JSON.parse(text);newJson=JSON.parse(changed);}catch{stop('R17_B_CONFIG_PARSE_STOP');}
  check(oldJson.source===from&&newJson.source===to&&
    JSON.stringify({...oldJson,source:to})===JSON.stringify(newJson),
    'R17_B_CONFIG_ONLY_SOURCE_STOP');
  return Buffer.from(changed,'utf8');
}
function readPinnedPublicFile(file){
  check(git(CANDIDATE_CHECKOUT,'rev-parse','HEAD')===CANDIDATE&&
    git(CANDIDATE_CHECKOUT,'status','--porcelain=v1','--untracked-files=all')==='',
    'R17_B_CANDIDATE_CHECKOUT_DRIFT_STOP');
  const bytes=regularFile(path.join(CANDIDATE_CHECKOUT,...file.split('/')),CANDIDATE_CHECKOUT);
  check(bytes.length>0&&bytes.length<=2_000_000&&sha256(bytes)===TARGET[file],
    'R17_B_CANDIDATE_SHA_STOP');
  return bytes;
}

function buildIsolatedCommit({originals,newFiles,requestId}){
  const stage=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-r17-b-'));
  git(stage,'init','-q');
  const objectLocation=git(SOURCE_ROOT,'rev-parse','--git-path','objects');
  const objectDir=fs.realpathSync(path.isAbsolute(objectLocation)
    ?objectLocation:path.resolve(SOURCE_ROOT,objectLocation));
  check(objectDir.length>6&&fs.statSync(objectDir).isDirectory(),'R17_B_OBJECT_DIR_STOP');
  const alternates=path.join(stage,'.git','objects','info','alternates');
  fs.writeFileSync(alternates,objectDir.replaceAll('\\','/')+'\n',{flag:'wx'});
  git(stage,'read-tree',BASE);
  // Native Git apply in an isolated scratch worktree. The previous in-memory
  // patch parser did NOT reproduce #376's CRLF-sensitive verified targets.
  const overlay=new Map();
  for(const [file,bytes] of Object.entries(originals)){
    const target=path.join(stage,...file.split('/'));
    fs.mkdirSync(path.dirname(target),{recursive:true});
    fs.writeFileSync(target,bytes,{flag:'wx'});
  }
  git(stage,'apply','--check',PATCH);
  git(stage,'apply',PATCH);
  for(const file of Object.keys(BEFORE)){
    const bytes=fs.readFileSync(path.join(stage,...file.split('/')));
    check(sha256(bytes)===TARGET[file],'R17_B_NATIVE_PATCH_TARGET_SHA_STOP');
    overlay.set(file,bytes);
  }
  for(const [file,bytes] of Object.entries(newFiles))overlay.set(file,bytes);
  for(const [file,bytes] of overlay){
    const mode=git(SOURCE_ROOT,'ls-tree',BASE,'--',file);
    if(Object.hasOwn(BEFORE,file))
      check(mode.startsWith('100644 blob '),'R17_B_GIT_BASE_MODE_STOP');
    else check(mode==='','R17_B_GIT_NEWFILE_PRESENT_STOP');
  }
  const sourceRef=`refs/heads/r17-writer-b/${requestId}`;
  const {sha,diff}=commitExactOverlay({stage,base:BASE,overlay,
    expectedSha256:TARGET,expectedDiff:DIFF,requestRef:sourceRef,run:git,runRaw:gitRaw});
  return {sha,parent:BASE,cleanCommit:true,targetSha256:TARGET,diff,
    patchSha256:PATCH_HASH,candidateSourceSha:CANDIDATE,
    branch:`r17-writer-b/${requestId}`,sourceRef,stage};
}

function makeAdapter(authorized){
  const journalDir=path.join(JOURNAL_ROOT,authorized.requestId);
  const journalFile=path.join(journalDir,'journal.jsonl');
  let originalConfig=null,originalXml=null,originalComparable=null,prepared=null;
  let lockFd=null;
  const adapter={
    async acquireSharedLock(id){
      check(id===authorized.requestId,'R17_B_REQUEST_ID_STOP');
      const lock=acquireInstallLock({journalRoot:JOURNAL_ROOT,requestId:id,
        sharedLock:SHARED_INSTALL_LOCK});
      lockFd=lock.fd;
    },
    async claim(id){
      check(id===authorized.requestId&&lockFd!==null,'R17_B_REQUEST_ID_STOP');
      const claim=createInstallJournal({journalRoot:JOURNAL_ROOT,requestId:id,
        sharedLock:SHARED_INSTALL_LOCK,fd:lockFd});
      verifiedEmptyHooksDir=claim.hooksDir;
    },
    async journal(phase,error){
      const fd=fs.openSync(journalFile,'a');
      try{fs.writeSync(fd,JSON.stringify({phase,errorCode:error??null,at:new Date().toISOString()})+'\n');
        fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
    },
    async inspectBefore(){
      check(fs.lstatSync(SOURCE_ROOT).isDirectory()&&
        !fs.lstatSync(SOURCE_ROOT).isSymbolicLink(),
        'R17_B_SOURCE_ROOT_REPARSE_STOP');
      const head=git(SOURCE_ROOT,'rev-parse','HEAD');
      const originalBranch=git(SOURCE_ROOT,'branch','--show-current');
      const worktreeClean=git(SOURCE_ROOT,'status','--porcelain=v1','--untracked-files=all')==='';
      originalConfig=readConfig().raw;
      const task=probeTask();originalXml=taskXml();originalComparable=taskXmlComparable(originalXml.xml);
      const xmlHashes=[sha256(originalXml.raw),sha256(Buffer.from(originalXml.xml,'utf8'))];
      const old=Object.fromEntries(Object.keys(BEFORE).map(p=>[p,sourceSha(p)]));
      return {sourceRoot:SOURCE_ROOT,configPath:CONFIG_PATH,coreTask:CORE_TASK,
        head,configSource:JSON.parse(originalConfig.toString('utf8')).source,worktreeClean,
        originalBranch,coreTaskXmlSha256:xmlHashes.includes(CORE_XML_HASH)?CORE_XML_HASH:xmlHashes[0],
        taskEnabled:task.enabled,taskRunning:task.state===4||task.instances>0,
        coreIdle:task.state!==4&&task.instances===0&&task.relatedProcesses===0&&
          task.unknownProcessLines===0&&!fs.existsSync(LOCK),
        existingSha256:old,absent:Object.keys(TARGET).filter(p=>!Object.hasOwn(BEFORE,p)&&!fs.existsSync(sourceFile(p))),
      };
    },
    async saveBaseline(before){
      check(before.head===BASE&&originalConfig&&originalXml,'R17_B_BASELINE_SAVE_STOP');
      fs.writeFileSync(path.join(journalDir,'config.original.bin'),originalConfig,{flag:'wx'});
      fs.writeFileSync(path.join(journalDir,'task.original.xml'),originalXml.raw,{flag:'wx'});
      fs.writeFileSync(path.join(journalDir,'baseline.json'),JSON.stringify({
        head:BASE,branch:before.originalBranch,configSha256:sha256(originalConfig),
        taskXmlSha256:sha256(originalXml.raw),beforeSha256:BEFORE,
      }),{flag:'wx'});
    },
    async prepareIsolatedCommit(){
      const patch=fs.readFileSync(PATCH);check(sha256(patch)===PATCH_HASH,'R17_B_PATCH_SHA_STOP');
      const originals=Object.fromEntries(Object.keys(BEFORE).map(p=>[p,regularFile(sourceFile(p))]));
      const newFiles={};
      for(const file of Object.keys(TARGET).filter(x=>!Object.hasOwn(BEFORE,x)))
        newFiles[file]=readPinnedPublicFile(file);
      prepared=buildIsolatedCommit({originals,newFiles,requestId:authorized.requestId});
      return prepared;
    },
    async disableCoreTask(){
      // Protect against another chat mutating source/config during B prepare.
      assertSourceState(BASE,git(SOURCE_ROOT,'branch','--show-current'),BEFORE);
      check(readConfig().raw.equals(originalConfig),'R17_B_PRE_DISABLE_CONFIG_DRIFT_STOP');
      check(taskXmlComparable(taskXml().xml)===originalComparable,
        'R17_B_PRE_DISABLE_TASK_DRIFT_STOP');
      // Pausing the schedule prevents new starts. An already running Core
      // must finish naturally in waitForDrain(), not block this first step.
      // The strict no-process/no-lock check remains immediately before switch.
      const immediate=probeTask();
      check(immediate.enabled===true,'R17_B_CORE_NOT_ENABLED_BEFORE_DISABLE_STOP');
      command('schtasks.exe',['/Change','/TN',CORE_TASK,'/Disable']);
    },
    async assertCoreDisabled(){
      const task=probeTask();check(task.enabled===false,'R17_B_CORE_NOT_DISABLED_STOP');
      check(taskXmlComparable(taskXml().xml)===originalComparable,
        'R17_B_CORE_DEFINITION_DRIFT_STOP');
    },
    async waitForDrain({maxDrainMs}){
      const until=Date.now()+maxDrainMs;let consecutive=0;
      while(Date.now()<until){
        const t=probeTask();
        const safe=!t.enabled&&t.state!==4&&t.instances===0&&t.relatedProcesses===0&&
          t.unknownProcessLines===0&&!fs.existsSync(LOCK);
        consecutive=safe?consecutive+1:0;
        if(consecutive>=2)return;
        await delay(1_500);
      }
      stop('R17_B_NATURAL_DRAIN_TIMEOUT_STOP');
    },
    async assertCoreDrained(){
      const t=probeTask();
      check(!t.enabled&&t.state!==4&&t.instances===0&&t.relatedProcesses===0&&
        t.unknownProcessLines===0&&!fs.existsSync(LOCK),'R17_B_CORE_NOT_DRAINED_STOP');
    },
    async switchToPreparedCommit({before,prepared:c}){
      check(c===prepared&&c.branch===`r17-writer-b/${authorized.requestId}`&&
        c.sourceRef===`refs/heads/${c.branch}`&&
        git(c.stage,'rev-parse','--verify',c.sourceRef)===c.sha,
        'R17_B_PREPARED_REF_STOP');
      assertSourceState(BASE,before.originalBranch,BEFORE);
      check(readConfig().raw.equals(originalConfig),'R17_B_PRE_SWITCH_CONFIG_DRIFT_STOP');
      check(taskXmlComparable(taskXml().xml)===originalComparable,
        'R17_B_PRE_SWITCH_TASK_DRIFT_STOP');
      const beforeTask=probeTask();check(!beforeTask.enabled&&beforeTask.state!==4&&
        beforeTask.instances===0&&beforeTask.relatedProcesses===0&&
        beforeTask.unknownProcessLines===0&&!fs.existsSync(LOCK),
        'R17_B_SWITCH_DRAIN_STOP');
      // Fetch only the isolated commit into a new dedicated local branch.
      const ref=`refs/heads/${c.branch}`;
      const exists=spawnSync(BIN.git,['-C',SOURCE_ROOT,'-c','core.fsmonitor=false',
        'show-ref','--verify','--quiet',ref],{
        encoding:null,windowsHide:true,shell:false,timeout:15_000,
        env:{...process.env,GIT_TERMINAL_PROMPT:'0',GIT_CONFIG_NOSYSTEM:'1'}});
      check(exists.status===1,'R17_B_TARGET_REF_EXISTS_STOP');
      // Refuse external checkout filters/attributes that could execute code.
      for(const file of Object.keys(TARGET)){
        const attribute=git(SOURCE_ROOT,'check-attr','filter','--',file);
        check(attribute===`${file}: filter: unspecified`||attribute===`${file}: filter: unset`,
          'R17_B_GIT_FILTER_ATTR_STOP');
      }
      gitLive('fetch','--no-tags','--no-write-fetch-head',c.stage,`${c.sourceRef}:${ref}`);
      check(git(SOURCE_ROOT,'rev-parse','--verify',ref)===c.sha,
        'R17_B_FETCH_REF_SHA_STOP');
      gitLive('switch',c.branch);
      check(git(SOURCE_ROOT,'rev-parse','HEAD')===c.sha,
        'R17_B_SWITCH_SHA_STOP');
    },
    async assertSource({head,branch,files}){assertSourceState(head,branch,files);},
    async changeConfigSource({from,to}){
      check(from===BASE&&to===prepared?.sha,'R17_B_CONFIG_TARGET_STOP');
      const now=fs.readFileSync(CONFIG_PATH);
      check(originalConfig&&now.equals(originalConfig),'R17_B_CONFIG_EXTERNAL_DRIFT_STOP');
      atomicWrite(CONFIG_PATH,replaceSourceOnly(now,from,to));
    },
    async assertConfigSource(source){
      check(readConfig().obj.source===source,'R17_B_CONFIG_ASSERT_STOP');
    },
    async restoreConfigExactly(){
      const now=fs.readFileSync(CONFIG_PATH);
      check(originalConfig!==null&&prepared!==null,'R17_B_CONFIG_RESTORE_BASE_STOP');
      if(now.equals(originalConfig))return;
      check(now.equals(replaceSourceOnly(originalConfig,BASE,prepared.sha)),
        'R17_B_CONFIG_RESTORE_DRIFT_STOP');
      atomicWrite(CONFIG_PATH,originalConfig);
    },
    async restoreOriginalSource(before,c){
      const head=git(SOURCE_ROOT,'rev-parse','HEAD');
      const branch=git(SOURCE_ROOT,'branch','--show-current');
      if(head===BASE&&branch===before.originalBranch){assertSourceState(BASE,branch,BEFORE);return;}
      check(c&&head===c.sha&&branch===c.branch,'R17_B_SOURCE_RESTORE_DRIFT_STOP');
      check(probeTask().enabled===false,'R17_B_RESTORE_WHILE_ENABLED_STOP');
      gitLive('switch',before.originalBranch);
    },
    async restoreCoreTask(before){
      const task=probeTask();
      if(task.enabled===true){check(taskXmlComparable(taskXml().xml)===originalComparable,
        'R17_B_ALREADY_ENABLED_DRIFT_STOP');return;}
      const head=git(SOURCE_ROOT,'rev-parse','HEAD');
      const config=readConfig().obj.source;
      const rolledBack=head===BASE&&config===BASE;
      check(rolledBack||(head===prepared?.sha&&config===head),
        'R17_B_CORE_REENABLE_SOURCE_MISMATCH_STOP');
      // When source/config are the ORIGINAL pair, an unexpectedly long
      // original Core is allowed to finish naturally; restore schedule.
      if(!rolledBack)check(task.instances===0&&task.relatedProcesses===0&&
        task.unknownProcessLines===0&&!fs.existsSync(LOCK),
        'R17_B_CORE_REENABLE_NOT_DRAINED_STOP');
      command('schtasks.exe',['/Change','/TN',CORE_TASK,'/Enable']);
    },
    async assertCoreRestored(before){
      const task=probeTask();
      check(before.taskEnabled===true&&task.enabled===true&&
        taskXmlComparable(taskXml().xml)===originalComparable,
        'R17_B_CORE_RESTORE_ASSERT_STOP');
    },
    async finalize(result){
      if(lockFd===null)return;
      releaseInstallClaim({fd:lockFd,sharedLock:SHARED_INSTALL_LOCK,
        requestId:authorized.requestId,
        retain:result.status==='R17_B_RECOVERY_REQUIRED'});
      lockFd=null;
    },
  };
  return adapter;
}

/** Entry point: intended for a single, pinned, owner-opened B Install Issue. */
async function main(){
  check(process.platform==='win32'&&process.env.GITHUB_REPOSITORY===WORKFLOW_REPO,
    'R17_B_WINDOWS_HOST_STOP');
  const workspace=process.env.GITHUB_WORKSPACE;
  check(typeof workspace==='string'&&workspace.length>0,'R17_B_WORKSPACE_STOP');
  const checkout=path.join(workspace,'r17-control');
  check(fs.realpathSync.native(checkout).toLowerCase().startsWith(
    fs.realpathSync.native(workspace).toLowerCase()+path.sep)&&
    git(checkout,'rev-parse','HEAD')===process.env.R17_CONTROL_SHA&&
    process.env.GITHUB_SHA===process.env.R17_CONTROL_SHA,
    'R17_B_CONTROL_CHECKOUT_SHA_STOP');
  const event=readJson(process.env.GITHUB_EVENT_PATH);
  let request;try{request=JSON.parse(event.issue.body);}catch{stop('R17_B_ISSUE_JSON_STOP');}
  const manifestBytes=fs.readFileSync(MANIFEST);
  const auth=authorize({event,request,manifestBytes,env:process.env});
  const adapter=makeAdapter(auth);
  const result=await performApprovedInstall(auth,adapter);
  try{await adapter.finalize(result);}catch{
    // Installation may already be complete. Never turn a reporting/lock
    // problem into implicit permission for another installation attempt.
    result.status='R17_B_RECOVERY_REQUIRED';
    result.recovery=[...(result.recovery??[]),'SHARED_LOCK_FINALIZE_FAILED'];
  }
  // No raw source, patch, task XML, full config or secrets in console output.
  process.stdout.write(JSON.stringify(result)+'\n');
  if(result.status!=='R17_B_INSTALLED_VERIFIED')process.exitCode=1;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  main().catch(error=>{
    process.stdout.write(JSON.stringify({status:'R17_B_SETUP_STOP',
      errorCode:error?.code??'R17_B_SETUP_UNEXPECTED_STOP'})+'\n');
    process.exitCode=1;
  });
}

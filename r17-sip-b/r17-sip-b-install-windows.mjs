// Dedicated Windows B adapter for exact three-file private R17 SIP collection.
// SOURCE ONLY: not registered on main, not a pc-job operation, and never a shell.
// Uses the existing R17 B shared lock/journal, Git overlay, task-probe and XML
// helpers. Do not execute without an authenticated, one-shot Issue event.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {
  BASELINE_SOURCE,CANDIDATE_SOURCE,SOURCE_ROOT,CONFIG_PATH,CORE_TASK,TARGET,
  sha256,SipBStop,validateScopeManifest,performAuthorizedInstall,
} from './r17-sip-b-install-core.mjs';
import {authorizeSipInstall} from './r17-sip-b-auth.mjs';
import {acquireInstallLock,createInstallJournal,releaseInstallClaim}
  from '../r17-writer-b/r17-b-claim.mjs';
import {commitExactOverlay} from '../r17-writer-b/r17-b-git-stage.mjs';
import {sameTaskDefinitionExceptSettingsEnabled}
  from '../r17-writer-b/r17-b-xml.mjs';

const REPO='ansqhd5774-Choi/zgmini-pc-control';
const SHA40=/^[a-f0-9]{40}$/;
const ROOT=path.dirname(fileURLToPath(import.meta.url));
const MANIFEST=path.join(ROOT,'R17_SIP_B_SCOPE_DRAFT.json');
const PROBE=path.resolve(ROOT,'../r17-writer-b/r17-b-windows-probe.js');
const CANDIDATE_CHECKOUT=path.join(process.env.GITHUB_WORKSPACE??'', 'r17-sip-candidate');
const JOURNAL_ROOT=String.raw`E:\ZGmini\data\pc-writer\r17-sip-b-install-once`;
const SHARED_LOCK=String.raw`E:\ZGmini\data\pc-writer\writer-source-install.lock`;
const CORE_LOCK=String.raw`E:\ZGmini\data\pc-writer\local-cycle.lock`;
const MAX_OUTPUT=4_000_000;
const SYSTEM32=path.join(process.env.SystemRoot??String.raw`C:\Windows`,'System32');
const GIT_EXE=[String.raw`C:\Program Files\Git\cmd\git.exe`,
  String.raw`C:\Program Files\Git\bin\git.exe`].find(fs.existsSync);
const BIN={git:GIT_EXE,'schtasks.exe':path.join(SYSTEM32,'schtasks.exe'),
  'cscript.exe':path.join(SYSTEM32,'cscript.exe')};
const stop=code=>{throw new SipBStop(code);};
const check=(value,code)=>{if(!value)stop(code);};
const object=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
export const coreQuietForTarget=(core,coreLockPresent)=>
  !!core&&core.instances===0&&core.relatedProcesses===0&&
  core.unknownProcessLines===0&&core.state!==4&&!coreLockPresent;

function command(which,args,{cwd,stdin,env={}}={}){
  check(Object.hasOwn(BIN,which),'SIP_B_EXECUTABLE_SCOPE_STOP');
  const exe=BIN[which];check(typeof exe==='string'&&fs.existsSync(exe),
    'SIP_B_EXECUTABLE_MISSING_STOP');
  const r=spawnSync(exe,args,{cwd,windowsHide:true,shell:false,
    timeout:45_000,maxBuffer:MAX_OUTPUT,encoding:null,input:stdin,
    env:{...process.env,GIT_TERMINAL_PROMPT:'0',GIT_CONFIG_NOSYSTEM:'1',...env}});
  check(!r.error&&r.status===0,'SIP_B_COMMAND_STOP');
  return r.stdout;
}
function git(dir,...args){return command('git',['-C',dir,'-c','core.fsmonitor=false',...args])
  .toString('utf8').trim();}
function gitRaw(dir,args,opts={}){
  return command('git',['-C',dir,'-c','core.fsmonitor=false',...args],opts);
}
let emptyHooks=null;
function gitLive(...args){
  check(emptyHooks&&fs.readdirSync(emptyHooks).length===0,'SIP_B_GIT_HOOKS_STOP');
  return command('git',['-C',SOURCE_ROOT,'-c',`core.hooksPath=${emptyHooks}`,
    '-c','core.fsmonitor=false',...args]).toString('utf8').trim();
}
function regularBytes(file,root){
  const stat=fs.lstatSync(file);
  check(stat.isFile()&&!stat.isSymbolicLink()&&stat.size>0&&stat.size<=2_000_000,
    'SIP_B_SOURCE_FILE_STOP');
  const real=fs.realpathSync.native(file).toLowerCase();
  const parent=fs.realpathSync.native(root).toLowerCase();
  check(real.startsWith(parent+path.sep.toLowerCase()),'SIP_B_FILE_SCOPE_STOP');
  return fs.readFileSync(file);
}
function sourcePath(file){return path.join(SOURCE_ROOT,...file.split('/'));}
function sourceHash(file){return sha256(regularBytes(sourcePath(file),SOURCE_ROOT));}
function readConfig(){
  const raw=regularBytes(CONFIG_PATH,path.dirname(CONFIG_PATH));
  let obj;try{obj=JSON.parse(raw.toString('utf8'));}catch{stop('SIP_B_CONFIG_JSON_STOP');}
  check(object(obj)&&SHA40.test(obj.source??''),'SIP_B_CONFIG_SOURCE_STOP');
  return {raw,obj};
}
function replaceSourceOnly(bytes,from,to){
  const text=bytes.toString('utf8');
  const matches=[...text.matchAll(/"source"\s*:\s*"([a-f0-9]{40})"/g)];
  check(matches.length===1&&matches[0][1]===from,'SIP_B_CONFIG_UNIQUE_SOURCE_STOP');
  const match=matches[0];
  const changed=text.slice(0,match.index)+match[0].replace(from,to)+
    text.slice(match.index+match[0].length);
  let oldObj,newObj;
  try{oldObj=JSON.parse(text);newObj=JSON.parse(changed);}catch{stop('SIP_B_CONFIG_PARSE_STOP');}
  check(JSON.stringify({...oldObj,source:to})===JSON.stringify(newObj),
    'SIP_B_CONFIG_SCOPE_STOP');
  return Buffer.from(changed,'utf8');
}
function atomicWrite(file,bytes){
  const temp=`${file}.sip-b-${process.pid}.tmp`;
  check(!fs.existsSync(temp),'SIP_B_TEMP_EXISTS_STOP');
  fs.writeFileSync(temp,bytes,{flag:'wx'});
  try{fs.renameSync(temp,file);}catch{stop('SIP_B_ATOMIC_RENAME_STOP');}
  check(fs.readFileSync(file).equals(bytes),'SIP_B_ATOMIC_READBACK_STOP');
}
function xmlText(raw){
  if(raw[0]===255&&raw[1]===254)return raw.subarray(2).toString('utf16le');
  if(raw[0]===60&&raw[1]===0)return raw.toString('utf16le');
  return raw.toString('utf8').replace(/^\ufeff/,'');
}
function taskXml(){const raw=command('schtasks.exe',['/Query','/TN',CORE_TASK,'/XML']);
  return {raw,comparable:sameTaskDefinitionExceptSettingsEnabled(xmlText(raw))};}
function probeCore(){
  const raw=command('cscript.exe',['//NoLogo',PROBE]);let parsed;
  try{parsed=JSON.parse(raw.toString('utf8').trim());}catch{stop('SIP_B_TASK_PROBE_JSON_STOP');}
  check(parsed?.ok===true&&typeof parsed.enabled==='boolean'&&
    Number.isInteger(parsed.state)&&Number.isInteger(parsed.instances)&&
    Number.isInteger(parsed.relatedProcesses)&&Number.isInteger(parsed.unknownProcessLines),
    'SIP_B_TASK_PROBE_STOP');
  return parsed;
}
function assertSource(head,branch,post){
  check(git(SOURCE_ROOT,'rev-parse','HEAD')===head&&
    git(SOURCE_ROOT,'branch','--show-current')===branch&&
    git(SOURCE_ROOT,'status','--porcelain=v1','--untracked-files=all')==='',
    'SIP_B_SOURCE_DRIFT_STOP');
  for(const [file,v] of Object.entries(TARGET)){
    if(!post&&v.status==='A'){
      check(!fs.existsSync(sourcePath(file)),'SIP_B_ADDED_FILE_DRIFT_STOP');
      continue;
    }
    check(fs.existsSync(sourcePath(file))&&sourceHash(file)===
      (post?v.targetSha256:v.beforeSha256),'SIP_B_FILE_HASH_STOP');
  }
}

function buildAdapter(auth){
  let fd=null,baseline=null,originalConfig=null,originalTask=null,prepared=null;
  let candidateFiles=null;
  const requestId=auth.requestId;
  const journalDir=path.join(JOURNAL_ROOT,requestId);
  const journal=path.join(journalDir,'journal.jsonl');
  let originalComparable=null;
  const writeJournal=phase=>{
    const out=JSON.stringify({phase,at:new Date().toISOString()})+'\n';
    fs.appendFileSync(journal,out,{encoding:'utf8'});
  };
  return {
    async acquireSharedWriterLock(){
      const claim=acquireInstallLock({journalRoot:JOURNAL_ROOT,requestId,sharedLock:SHARED_LOCK});
      fd=claim.fd;
    },
    async inspectPcPreimage(){
      check(fs.lstatSync(SOURCE_ROOT).isDirectory()&&
        !fs.lstatSync(SOURCE_ROOT).isSymbolicLink(),
        'SIP_B_SOURCE_ROOT_STOP');
      originalConfig=readConfig().raw;
      originalTask=taskXml();originalComparable=originalTask.comparable;
      const core=probeCore();
      const head=git(SOURCE_ROOT,'rev-parse','HEAD');
      const originalBranch=git(SOURCE_ROOT,'branch','--show-current');
      check(originalBranch.length>0&&
        git(SOURCE_ROOT,'check-ref-format','--branch',originalBranch)===originalBranch&&
        git(SOURCE_ROOT,'rev-parse','--verify',`refs/heads/${originalBranch}`)===head,
        'SIP_B_BASELINE_BRANCH_STOP');
      baseline={sourceRoot:SOURCE_ROOT,configPath:CONFIG_PATH,coreTask:CORE_TASK,
        head,
        configSource:JSON.parse(originalConfig.toString('utf8')).source,
        worktreeClean:git(SOURCE_ROOT,'status','--porcelain=v1','--untracked-files=all')==='',
        coreTaskEnabled:core.enabled,
        originalBranch,
        existingSha256:Object.fromEntries(Object.keys(TARGET).filter(p=>TARGET[p].status==='M')
          .map(p=>[p,fs.existsSync(sourcePath(p))?sourceHash(p):null])),
        absent:Object.keys(TARGET).filter(p=>TARGET[p].status==='A'&&!fs.existsSync(sourcePath(p))),
      };
      return baseline;
    },
    async inspectPinnedCandidate(candidateSha){
      check(candidateSha===CANDIDATE_SOURCE&&
        git(CANDIDATE_CHECKOUT,'rev-parse','HEAD')===CANDIDATE_SOURCE&&
        git(CANDIDATE_CHECKOUT,'status','--porcelain=v1','--untracked-files=all')==='',
        'SIP_B_CANDIDATE_CHECKOUT_STOP');
      candidateFiles=new Map();
      for(const [name,entry] of Object.entries(TARGET)){
        const bytes=regularBytes(path.join(CANDIDATE_CHECKOUT,...name.split('/')),
          CANDIDATE_CHECKOUT);
        check(sha256(bytes)===entry.targetSha256,'SIP_B_CANDIDATE_FILE_HASH_STOP');
        candidateFiles.set(name,bytes);
      }
      return {sourceSha:CANDIDATE_SOURCE,clean:true,
        filesSha256:Object.fromEntries([...candidateFiles].map(([p,b])=>[p,sha256(b)]))};
    },
    async claimOnce(id){
      check(fd!==null&&id===requestId,'SIP_B_CLAIM_ID_STOP');
      const claim=createInstallJournal({journalRoot:JOURNAL_ROOT,requestId,
        sharedLock:SHARED_LOCK,fd});
      emptyHooks=claim.hooksDir;
    },
    async backupExactSourceAndConfig(before){
      check(before===baseline&&originalConfig&&originalTask,'SIP_B_BASELINE_STOP');
      fs.writeFileSync(path.join(journalDir,'config.original.bin'),originalConfig,{flag:'wx'});
      fs.writeFileSync(path.join(journalDir,'core.original.xml'),originalTask.raw,{flag:'wx'});
      const originalBytes=regularBytes(sourcePath(Object.keys(TARGET)[0]),SOURCE_ROOT);
      fs.writeFileSync(path.join(journalDir,'cycle.original.bin'),originalBytes,{flag:'wx'});
      fs.writeFileSync(path.join(journalDir,'baseline.json'),JSON.stringify({
        head:before.head,branch:before.originalBranch,configSha256:sha256(originalConfig),
        coreXmlSha256:sha256(originalTask.raw),cycleSha256:sha256(originalBytes),
      }),{flag:'wx'});
      writeJournal('BASELINE_SAVED');
    },
    async prepareIsolatedExactThreeFileCommit(base,candidate,targets){
      check(base===BASELINE_SOURCE&&candidate===CANDIDATE_SOURCE&&targets===TARGET&&
        candidateFiles?.size===3,'SIP_B_PREPARE_SCOPE_STOP');
      const stage=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-sip-b-'));
      git(stage,'init','-q');
      const pathToObjects=git(SOURCE_ROOT,'rev-parse','--git-path','objects');
      const objectDir=fs.realpathSync(path.isAbsolute(pathToObjects)?
        pathToObjects:path.resolve(SOURCE_ROOT,pathToObjects));
      check(fs.statSync(objectDir).isDirectory(),'SIP_B_OBJECT_DIR_STOP');
      fs.writeFileSync(path.join(stage,'.git','objects','info','alternates'),
        objectDir.replaceAll('\\','/')+'\n',{flag:'wx'});
      git(stage,'read-tree',BASELINE_SOURCE);
      for(const [name,entry] of Object.entries(TARGET)){
        const mode=git(SOURCE_ROOT,'ls-tree',BASELINE_SOURCE,'--',name);
        check(entry.status==='M'?mode.startsWith('100644 blob '):mode==='',
          'SIP_B_GIT_BASE_FILE_MODE_STOP');
      }
      // Reuse the proven R17 overlay helper. Its legacy request-scoped ref
      // prefix is retained solely for compatibility, not five-file authority.
      const ref=`refs/heads/r17-writer-b/${requestId}`;
      const applied=commitExactOverlay({stage,base:BASELINE_SOURCE,
        overlay:candidateFiles,
        expectedSha256:Object.fromEntries(Object.entries(TARGET).map(([p,v])=>[p,v.targetSha256])),
        expectedDiff:Object.entries(TARGET).map(([path,v])=>({path,status:v.status})),
        requestRef:ref,run:git,runRaw:gitRaw});
      prepared={commit:applied.sha,parent:BASELINE_SOURCE,clean:true,
        onlyThreeFiles:true,branch:`r17-writer-b/${requestId}`,stage,ref};
      writeJournal('PREPARED');
      return prepared;
    },
    async pauseCoreWithoutDefinitionChange(){
      assertSource(BASELINE_SOURCE,baseline.originalBranch,false);
      check(readConfig().raw.equals(originalConfig)&&
        taskXml().comparable===originalComparable&&probeCore().enabled,
        'SIP_B_PRE_PAUSE_DRIFT_STOP');
      command('schtasks.exe',['/Change','/TN',CORE_TASK,'/Disable']);
      writeJournal('CORE_PAUSED');
    },
    async waitForCoreDrain(){
      const deadline=Date.now()+180_000;let successive=0;
      while(Date.now()<deadline){
        const t=probeCore();
        const quiet=!t.enabled&&t.state!==4&&t.instances===0&&
          t.relatedProcesses===0&&t.unknownProcessLines===0&&!fs.existsSync(CORE_LOCK);
        successive=quiet?successive+1:0;
        if(successive>=2)return;
        await delay(1500);
      }
      stop('SIP_B_NATURAL_DRAIN_TIMEOUT_STOP');
    },
    async assertCoreQuiet(){
      const t=probeCore();
      check(!t.enabled&&t.state!==4&&t.instances===0&&t.relatedProcesses===0&&
        t.unknownProcessLines===0&&!fs.existsSync(CORE_LOCK)&&
        taskXml().comparable===originalComparable,'SIP_B_CORE_NOT_QUIET_STOP');
    },
    async switchToPreparedCommit(commit){
      check(prepared?.commit===commit&&
        git(prepared.stage,'rev-parse','--verify',prepared.ref)===commit,
        'SIP_B_PREPARED_REF_STOP');
      assertSource(BASELINE_SOURCE,baseline.originalBranch,false);
      check(readConfig().raw.equals(originalConfig),'SIP_B_CONFIG_PRE_SWITCH_DRIFT_STOP');
      const ref=`refs/heads/${prepared.branch}`;
      const exists=spawnSync(BIN.git,['-C',SOURCE_ROOT,'show-ref','--verify','--quiet',ref],
        {windowsHide:true,shell:false,timeout:15_000});
      check(exists.status===1,'SIP_B_REF_EXISTS_STOP');
      for(const file of Object.keys(TARGET)){
        const attr=git(SOURCE_ROOT,'check-attr','filter','--',file);
        check(attr===`${file}: filter: unspecified`||attr===`${file}: filter: unset`,
          'SIP_B_GIT_FILTER_STOP');
      }
      gitLive('fetch','--no-tags','--no-write-fetch-head',prepared.stage,
        `${prepared.ref}:${ref}`);
      check(git(SOURCE_ROOT,'rev-parse','--verify',ref)===commit,
        'SIP_B_FETCH_REF_STOP');
      gitLive('switch',prepared.branch);
      writeJournal('SOURCE_SWITCHED');
    },
    async assertExactThreeFileSource(commit){
      check(commit===prepared?.commit,'SIP_B_TARGET_COMMIT_STOP');
      assertSource(commit,prepared.branch,true);
    },
    async replaceConfigSourceOnly(from,to){
      check(from===BASELINE_SOURCE&&to===prepared?.commit&&
        readConfig().raw.equals(originalConfig),'SIP_B_CONFIG_DRIFT_STOP');
      atomicWrite(CONFIG_PATH,replaceSourceOnly(originalConfig,from,to));
      writeJournal('CONFIG_REGISTERED');
    },
    async assertConfigSource(sha){
      check(readConfig().obj.source===sha,'SIP_B_CONFIG_READBACK_STOP');
    },
    async restoreConfigExactly(){
      const now=readConfig().raw;
      if(now.equals(originalConfig))return;
      check(now.equals(replaceSourceOnly(originalConfig,BASELINE_SOURCE,prepared.commit)),
        'SIP_B_CONFIG_RESTORE_DRIFT_STOP');
      atomicWrite(CONFIG_PATH,originalConfig);
    },
    async restoreOriginalSourceExactly(before,c){
      const head=git(SOURCE_ROOT,'rev-parse','HEAD');
      const branch=git(SOURCE_ROOT,'branch','--show-current');
      if(head===BASELINE_SOURCE&&branch===before.originalBranch)return;
      check(c===prepared&&head===c.commit&&branch===c.branch&&
        probeCore().enabled===false,'SIP_B_SOURCE_RESTORE_DRIFT_STOP');
      gitLive('switch',before.originalBranch);
    },
    async assertOriginalSourceAndConfig(before){
      assertSource(BASELINE_SOURCE,before.originalBranch,false);
      check(readConfig().raw.equals(originalConfig),'SIP_B_ORIGINAL_CONFIG_STOP');
    },
    async restoreCoreExactState(before){
      const current=probeCore();
      check(taskXml().comparable===originalComparable,
        'SIP_B_CORE_DEFINITION_DRIFT_STOP');
      const head=git(SOURCE_ROOT,'rev-parse','HEAD');
      const source=readConfig().obj.source;
      check((head===BASELINE_SOURCE&&source===head)||
        (head===prepared?.commit&&source===head),
        'SIP_B_CORE_SOURCE_CONFIG_PAIR_STOP');
      if(head===prepared?.commit){
        check(coreQuietForTarget(current,fs.existsSync(CORE_LOCK)),
          'SIP_B_CORE_REENABLE_NOT_DRAINED_STOP');
      }
      if(!current.enabled)command('schtasks.exe',['/Change','/TN',CORE_TASK,'/Enable']);
      writeJournal('CORE_RESTORED');
    },
    async assertCoreExactState(before){
      check(before===baseline&&probeCore().enabled===true&&
        taskXml().comparable===originalComparable,'SIP_B_CORE_RESTORE_STOP');
    },
    async releaseSharedWriterLock({retain}={}){
      if(fd===null)return;
      releaseInstallClaim({fd,sharedLock:SHARED_LOCK,requestId,retain:!!retain});
      fd=null;
    },
    recordResult(result){
      if(!fs.existsSync(journal))return;
      writeJournal(result.status);
    },
  };
}

export async function runWindowsInstall(event,env,manifestBytes){
  const auth=authorizeSipInstall({event,env,manifestBytes});
  validateScopeManifest(JSON.parse(manifestBytes.toString('utf8')));
  const io=buildAdapter(auth);
  const result=await performAuthorizedInstall(auth,io);
  return preserveResultAfterJournal(result,io.recordResult);
}

// A failed post-install evidence append cannot retroactively turn a verified
// source/config/Core installation into a setup failure or authorize a retry.
export function preserveResultAfterJournal(result,record,warning=()=>{
  process.stderr.write('SIP_B_JOURNAL_APPEND_UNVERIFIED\n');
}){
  try{record(result);}catch{warning();}
  return result;
}

async function main(){
  check(process.platform==='win32'&&process.env.GITHUB_REPOSITORY===REPO,
    'SIP_B_WINDOWS_HOST_STOP');
  const workspace=process.env.GITHUB_WORKSPACE;
  check(typeof workspace==='string'&&workspace.length>0,'SIP_B_WORKSPACE_STOP');
  const control=path.join(workspace,'r17-sip-control');
  check(fs.realpathSync.native(control).toLowerCase().startsWith(
    fs.realpathSync.native(workspace).toLowerCase()+path.sep)&&
    git(control,'rev-parse','HEAD')===process.env.R17_SIP_CONTROL_SHA,
    'SIP_B_CONTROL_SHA_STOP');
  const event=JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH,'utf8'));
  const result=await runWindowsInstall(event,process.env,fs.readFileSync(MANIFEST));
  process.stdout.write(JSON.stringify(result)+'\n');
  if(result.status!=='SIP_B_INSTALLED_VERIFIED')process.exitCode=1;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  main().catch(error=>{
    process.stdout.write(JSON.stringify({status:'SIP_B_SETUP_STOP',
      errorCode:error instanceof SipBStop?error.code:'SIP_B_SETUP_UNEXPECTED_STOP'})+'\n');
    process.exitCode=1;
  });
}

// Fixed, bounded R17 B Git preparation reproduction. ALL writes are confined
// to a newly created OS temporary Git repository; live source is read-only.
// No provider/SQLite/D1/Task access. Never return Git output or file contents.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {BASE,CANDIDATE,PATCH_HASH,SOURCE_ROOT,BEFORE,TARGET,DIFF,sha256}
  from '../r17-writer-b-install-core.mjs';
import {commitExactOverlay} from '../r17-b-git-stage.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const PATCH=path.join(ROOT,'approval','R17_A23_REBASE.patch');
const GIT=[String.raw`C:\Program Files\Git\cmd\git.exe`,
  String.raw`C:\Program Files\Git\bin\git.exe`].find(p=>fs.existsSync(p));
const REQUEST_REF='refs/heads/r17-writer-b/pc-r17-550e8400-e29b-41d4-a716-446655440000';
const MAX_OUTPUT=4_000_000;
const LABELS=new Set(['GIT_BINARY','SOURCE_HEAD','SOURCE_OBJECTS',
  'CANDIDATE_HEAD','CANDIDATE_CLEAN','PATCH_SHA','BASE_FILES',
  'CANDIDATE_FILES','TEMP_CREATE','GIT_INIT','ALTERNATES','READ_TREE',
  'COPY_BASE','APPLY_CHECK','APPLY','TARGET_HASHES','SOURCE_LS_TREE',
  'OVERLAY_HASH_OBJECT','OVERLAY_UPDATE_INDEX','OVERLAY_WRITE_TREE',
  'OVERLAY_COMMIT_TREE','OVERLAY_DIFF_TREE','OVERLAY_SHOW',
  'OVERLAY_UPDATE_REF','OVERLAY_REV_PARSE','OVERLAY_CAT_FILE',
  'STAGE_RESULT','TEMP_CLEANUP']);
const stop=()=>{throw new Error('R17_B_GIT_DIAG_STEP_STOP');};
const split=file=>file.split('/');

export function runGitStageDiagnostic({workspace,runCommand}={}){
  let stage=null,step='GIT_BINARY',lastPass=null,firstFail=null;
  let reason='NONE',exitCode=null,alternative='NOT_TESTED';
  const normalization={localCycle:'NOT_TESTED',runLocal:'NOT_TESTED'};
  const setStep=x=>{if(!LABELS.has(x))stop();step=x;};
  const check=(ok,label)=>{setStep(label);if(!ok)stop();lastPass=label;};
  const run=(cwd,args,{stdin,env}={},label)=>{
    setStep(label);
    const subprocess=runCommand??((bin,argv,opts)=>spawnSync(bin,argv,opts));
    const result=subprocess(GIT,['-C',cwd,'-c','core.fsmonitor=false',...args],{
      encoding:null,input:stdin,windowsHide:true,shell:false,
      timeout:20_000,maxBuffer:MAX_OUTPUT,
      env:{...process.env,GIT_TERMINAL_PROMPT:'0',GIT_CONFIG_NOSYSTEM:'1',
        GIT_OPTIONAL_LOCKS:'0',...env},
    });
    if(result?.error||result?.status!==0){
      exitCode=Number.isInteger(result?.status)?result.status:null;
      reason='COMMAND_FAILED';stop();
    }
    lastPass=label;
    return result.stdout;
  };
  const git=(cwd,label,...args)=>run(cwd,args,{},label).toString('utf8').trim();
  const gitRaw=(cwd,args,options={})=>run(cwd,args,options,
    'OVERLAY_'+args[0].toUpperCase().replaceAll('-','_'));
  const overlayGit=(cwd,...args)=>git(cwd,'OVERLAY_'+args[0].toUpperCase().replaceAll('-','_'),...args);
  const readRegular=(root,file,label)=>{
    setStep(label);
    const dest=path.join(root,...split(file));
    const stat=fs.lstatSync(dest);
    if(!stat.isFile()||stat.isSymbolicLink())stop();
    const real=fs.realpathSync.native(dest),base=fs.realpathSync.native(root);
    if(!real.toLowerCase().startsWith(base.toLowerCase()+path.sep))stop();
    const bytes=fs.readFileSync(dest);
    if(sha256(bytes)!==(Object.hasOwn(BEFORE,file)?BEFORE[file]:TARGET[file]))stop();
    lastPass=label;
    return bytes;
  };
  try{
    check(typeof GIT==='string'&&fs.existsSync(GIT),'GIT_BINARY');
    const candidate=path.join(workspace??'','r17-source');
    check(git(SOURCE_ROOT,'SOURCE_HEAD','rev-parse','HEAD')===BASE,'SOURCE_HEAD');
    check(git(candidate,'CANDIDATE_HEAD','rev-parse','HEAD')===CANDIDATE,'CANDIDATE_HEAD');
    check(git(candidate,'CANDIDATE_CLEAN','status','--porcelain=v1','--untracked-files=all')==='','CANDIDATE_CLEAN');
    const patch=fs.readFileSync(PATCH);
    check(sha256(patch)===PATCH_HASH,'PATCH_SHA');
    const originals=Object.fromEntries(Object.keys(BEFORE).map(p=>
      [p,readRegular(SOURCE_ROOT,p,'BASE_FILES')]));
    const newFiles=Object.fromEntries(Object.keys(TARGET).filter(p=>!Object.hasOwn(BEFORE,p)).map(p=>
      [p,readRegular(candidate,p,'CANDIDATE_FILES')]));
    setStep('TEMP_CREATE');stage=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-r17-b-diag-'));
    lastPass='TEMP_CREATE';
    git(stage,'GIT_INIT','init','-q');
    const objectLocation=git(SOURCE_ROOT,'SOURCE_OBJECTS','rev-parse','--git-path','objects');
    const objectDir=fs.realpathSync(path.isAbsolute(objectLocation)?
      objectLocation:path.resolve(SOURCE_ROOT,objectLocation));
    check(fs.statSync(objectDir).isDirectory(),'SOURCE_OBJECTS');
    setStep('ALTERNATES');fs.writeFileSync(path.join(stage,'.git','objects','info','alternates'),
      objectDir.replaceAll('\\','/')+'\n',{flag:'wx'});lastPass='ALTERNATES';
    git(stage,'READ_TREE','read-tree',BASE);
    setStep('COPY_BASE');
    for(const [file,bytes] of Object.entries(originals)){
      const target=path.join(stage,...split(file));
      fs.mkdirSync(path.dirname(target),{recursive:true});
      fs.writeFileSync(target,bytes,{flag:'wx'});
    }
    lastPass='COPY_BASE';
    git(stage,'APPLY_CHECK','apply','--check',PATCH);
    git(stage,'APPLY','apply',PATCH);
    const overlay=new Map();
    for(const file of Object.keys(BEFORE)){
      const bytes=fs.readFileSync(path.join(stage,...split(file)));
      check(sha256(bytes)===TARGET[file],'TARGET_HASHES');overlay.set(file,bytes);
    }
    for(const [file,bytes] of Object.entries(newFiles))overlay.set(file,bytes);
    for(const file of Object.keys(TARGET)){
      const mode=git(SOURCE_ROOT,'SOURCE_LS_TREE','ls-tree',BASE,'--',file);
      check(Object.hasOwn(BEFORE,file)?mode.startsWith('100644 blob '):mode==='','SOURCE_LS_TREE');
    }
    const prepared=commitExactOverlay({stage,base:BASE,overlay,
      expectedSha256:TARGET,expectedDiff:DIFF,requestRef:REQUEST_REF,
      run:overlayGit,runRaw:gitRaw});
    check(/^[a-f0-9]{40}$/.test(prepared.sha),'STAGE_RESULT');
    check(git(SOURCE_ROOT,'SOURCE_HEAD','rev-parse','HEAD')===BASE,'SOURCE_HEAD');
  }catch{
    firstFail=step;reason=reason==='NONE'?'LOCAL_STEP_FAILED':reason;
    // One bounded scratch-only simulation after the FIRST failure is recorded.
    // Git documents --ignore-space-change for context-line whitespace drift.
    // A successful apply is not accepted unless both exact target SHAs match.
    if(firstFail==='APPLY_CHECK'&&stage){
      const originalExit=exitCode,originalLastPass=lastPass;
      try{
        git(stage,'APPLY_CHECK','apply','--check','--ignore-space-change',PATCH);
        alternative='IGNORE_CONTEXT_CHECK_PASS_TARGET_UNVERIFIED';
        git(stage,'APPLY','apply','--ignore-space-change',PATCH);
        alternative=Object.keys(BEFORE).every(file=>sha256(fs.readFileSync(
          path.join(stage,...split(file))))===TARGET[file])?
          'IGNORE_CONTEXT_EXACT_TARGETS':'IGNORE_CONTEXT_TARGET_MISMATCH';
        if(alternative==='IGNORE_CONTEXT_TARGET_MISMATCH'){
          for(const [key,file] of [['localCycle','scripts/pc-writer/local-cycle.mjs'],
            ['runLocal','scripts/pc-writer/run-local.mjs']]){
            const bytes=fs.readFileSync(path.join(stage,...split(file)));
            const raw=bytes.toString('utf8');
            normalization[key]=sha256(bytes)===TARGET[file]?'EXACT':
              sha256(Buffer.from(raw.replace(/\r\n/g,'\n'),'utf8'))===TARGET[file]?'LF_EXACT':
              sha256(Buffer.from(raw.replace(/\r?\n/g,'\r\n'),'utf8'))===TARGET[file]?'CRLF_EXACT':
              'NO_SIMPLE_EOL_MATCH';
          }
        }
      }catch{alternative='IGNORE_CONTEXT_COMMAND_FAILED';}
      exitCode=originalExit;lastPass=originalLastPass;
    }
  }finally{
    if(stage){
      try{
        const parent=fs.realpathSync.native(os.tmpdir());
        const target=fs.realpathSync.native(stage),stat=fs.lstatSync(stage);
        if(!stat.isDirectory()||stat.isSymbolicLink()||
          !target.toLowerCase().startsWith(parent.toLowerCase()+path.sep)||
          !path.basename(target).startsWith('zgmini-r17-b-diag-'))throw Error('TEMP_SCOPE');
        fs.rmSync(stage,{recursive:true,force:false});
      }catch{firstFail??='TEMP_CLEANUP';reason='TEMP_CLEANUP_FAILED';}
    }
  }
  return {status:firstFail?'STOP':'PASS',lastPass,firstFail,
    reason,exitCode,alternative,normalization,
    sourceWrites:0,taskWrites:0,configWrites:0,
    installReruns:0};
}

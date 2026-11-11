// #996 original Windows Runner identity/startup preflight. READ ONLY.
// Never writes PAUSE, DRAIN, runner files or any operating-PC state.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';

const ROOT='E:/ZGmini/automation';
const NODE='E:/ZGmini/runtime/node.exe';
const SHA=b=>createHash('sha256').update(b).digest('hex');
const H64=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const need=(ok,code)=>{if(!ok)throw Object.assign(Error(code),{code});};
const exactFile=(p,max=32768)=>{
  const st=fs.lstatSync(p);
  need(st.isFile()&&!st.isSymbolicLink()&&st.size>0&&st.size<=max,
    'C996_LOCAL_RUNNER_FILE_UNSAFE');
  return fs.readFileSync(p);
};
const readJson=p=>{
  const bytes=exactFile(p);
  let x;try{x=JSON.parse(bytes.toString('utf8'));}
  catch{need(false,'C996_LOCAL_RUNNER_JSON_INVALID');}
  return x;
};
const markerPresent=p=>{
  try{const st=fs.lstatSync(p);
    need(st.isFile()&&!st.isSymbolicLink(),
      'C996_LOCAL_RUNNER_MARKER_UNSAFE');return true;
  }catch(e){if(e?.code==='ENOENT')return false;throw e;}
};
const validateTestRoot=root=>{
  const tmp=path.resolve(os.tmpdir()),at=path.resolve(root||'');
  need(process.platform!=='win32'&&typeof root==='string'&&
    at.startsWith(tmp+path.sep)&&
    path.basename(at).startsWith('zgmini-996-test-runner-local-')&&
    fs.lstatSync(at).isDirectory()&&!fs.lstatSync(at).isSymbolicLink()&&
    fs.realpathSync.native(at)===at,
  'C996_LOCAL_RUNNER_TEST_ROOT_INVALID');
  return at;
};

export function inspect996LocalRunnerReadOnly({testOnly=false,testRoot=null}={}){
  let base,startup;
  if(testOnly){
    base=validateTestRoot(testRoot);
    startup=path.join(base,'startup','ZGMINI_PC_CONTROL.vbs');
  }else{
    need(testRoot===null&&process.platform==='win32'&&
      !process.env.GITHUB_ACTIONS&&!process.env.RUNNER_NAME&&
      typeof process.env.APPDATA==='string'&&
      path.win32.normalize(process.execPath).toLowerCase()===
        path.win32.normalize(NODE).toLowerCase(),
    'C996_LOCAL_RUNNER_ORIGINAL_WINDOWS_ONLY');
    base=ROOT;
    startup=path.join(process.env.APPDATA,
      'Microsoft/Windows/Start Menu/Programs/Startup/ZGMINI_PC_CONTROL.vbs');
  }
  const control=path.join(base,'pc-control');
  const watchdog=path.join(base,'pc-watchdog');
  const install=readJson(path.join(watchdog,'INSTALL.json'));
  need(install?.scope==='RUNNER_RECOVERY_ONLY'&&
    H64(install.sha256)&&H64(install.startupSha256)&&
    SHA(exactFile(startup))===install.startupSha256&&
    SHA(exactFile(path.join(watchdog,'runner-watchdog.mjs'),128000))===
      install.sha256,
  'C996_LOCAL_RUNNER_WATCHDOG_SOURCE_MISMATCH');
  const bindings=[],ids=new Set();
  for(let n=1;n<=6;n++){
    const expected=`zgmini-pc-${String(n).padStart(2,'0')}`;
    const configured=readJson(path.join(control,'runners',
      String(n).padStart(2,'0'),'.runner'));
    need(Number.isSafeInteger(configured?.agentId)&&configured.agentId>0&&
      configured.agentName===expected&&!ids.has(configured.agentId),
    'C996_LOCAL_RUNNER_REGISTRATION_MISMATCH');
    ids.add(configured.agentId);
    // Never return the .runner file body, server URL, path, account or token.
    bindings.push(Object.freeze({id:configured.agentId,name:expected}));
  }
  return Object.freeze({schema:'ZGMINI_996_LOCAL_RUNNER_IDENTITY_READONLY_V1',
    status:'LOCAL_RUNNER_REGISTRATION_OBSERVED_ONLY',
    pcName:'기존 ZGMINI PC',bindings:Object.freeze(bindings),
    watchdogPausePresent:markerPresent(path.join(watchdog,'PAUSE')),
    controllerDrainPresent:markerPresent(path.join(control,'DRAIN')),
    startupAndWatchdogHashesMatch:true,
    sourceAuthenticatedExternally:false,
    processStateProven:false,executionAuthorized:false,
    operationalWrites:0,workflowPuts:0,issuePosts:0,
  });
}

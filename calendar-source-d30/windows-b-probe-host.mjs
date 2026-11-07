// Feature-owned, READ-ONLY D+30 B preflight host for an authenticated Windows
// one-shot Runner. Never performs B install, Task changes, Controller install,
// Git checkout/switch, DB access, or scheduler/workflow mutations.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {D30_WINDOWS_SOURCE_ROOT} from './windows-preview.mjs';
import {makeD30BManifestDraft} from './windows-b-simulator.mjs';

const ROOT=D30_WINDOWS_SOURCE_ROOT;
const DATA=String.raw`E:\ZGmini\data\pc-writer`;
const NODE=String.raw`E:\ZGmini\runtime\node.exe`;
const TASK='ZGMINI-PC-Local-Core';
const LOCK=path.win32.join(DATA,'writer-source-install.lock');
const WRAPPER=path.win32.join(DATA,'archive-sidecar-r7','run-original-then-archive.vbs');
const ALLOWED_CORE_ENTRIES=['local-cycle.mjs','quota-runner.mjs',
  'run-local.mjs','collect-local.mjs'].map(name=>
  path.win32.join(ROOT,'scripts','pc-writer',name));
const SHA40=/^[a-f0-9]{40}$/;
const FILES=makeD30BManifestDraft().files.map(f=>f.path);
const hash=b=>createHash('sha256').update(b).digest('hex');
const stop=code=>{throw Object.assign(new Error(code),{code});};
const need=(x,code)=>{if(!x)stop(code);};
const norm=p=>path.win32.normalize(p).toLowerCase();

function decode(bytes){
  if(!Buffer.isBuffer(bytes))return String(bytes);
  if(bytes[0]===0xff&&bytes[1]===0xfe)return bytes.subarray(2).toString('utf16le');
  if(bytes.length>=4&&bytes[1]===0&&bytes[3]===0)return bytes.toString('utf16le');
  return bytes.toString('utf8').replace(/^\uFEFF/,'');
}
function taskAction(xml){
  const text=decode(xml),tag=name=>{
    const value=text.match(new RegExp(`<${name}>([^<]*)<\\/${name}>`,'i'))?.[1]??'';
    return value.replace(/&(quot|amp|lt|gt|apos);/g,(_,e)=>({
      quot:'"',amp:'&',lt:'<',gt:'>',apos:"'"})[e]);
  };
  return {command:tag('Command'),args:tag('Arguments')};
}
function vbsPaths(text){
  return [...new Set((String(text).match(/[A-Z]:\\[^\r\n"'<>|]*?\.vbs/gi)??[])
    .map(path.win32.normalize))];
}

/**
 * Bounded static proof of actual Task XML -> wrapper VBS -> optional nested
 * VBS -> registered Node and local-cycle.mjs source. It does not execute VBS.
 * `readVbs` must resolve symlinks and enforce the fixed E: data boundary.
 */
export function traceD30CoreTaskChain({taskXml,readVbs,resolvePath=p=>p}={}){
  const unknown=reason=>({taskName:TASK,sourceRoot:ROOT,nodePath:NODE,
    taskXmlSha256:Buffer.isBuffer(taskXml)?hash(taskXml):null,
    taskXmlReadbackVerified:Buffer.isBuffer(taskXml),
    chainVerified:false,vbsOrDirectNodeVerified:false,reason});
  if(!Buffer.isBuffer(taskXml)||typeof readVbs!=='function')
    return unknown('ER1_D30_B_TASK_XML_UNAVAILABLE');
  const canonical=p=>norm(resolvePath(p));
  let base;
  try{base=canonical(DATA);}catch{return unknown('ER1_D30_B_DATA_ROOT_UNRESOLVED');}
  const action=taskAction(taskXml);
  if(!/[/\\]wscript\.exe$/i.test(action.command))
    return unknown('ER1_D30_B_TASK_ACTION_NOT_WSCRIPT');
  const first=vbsPaths(action.args);
  let firstMatches=false;
  try{firstMatches=first.length===1&&canonical(first[0])===canonical(WRAPPER);}
  catch{return unknown('ER1_D30_B_TASK_WRAPPER_PATH_UNKNOWN');}
  if(!firstMatches)
    return unknown('ER1_D30_B_TASK_WRAPPER_MISMATCH');
  const queue=[first[0]],visited=new Set(),observed=[];
  let resolved=false,archiveReferenced=false,launchEntry=null;
  while(queue.length&&visited.size<4){
    const file=queue.shift();
    if(visited.has(norm(file)))continue;
    let resolvedPath;
    try{resolvedPath=canonical(file);}catch{return unknown('ER1_D30_B_VBS_REALPATH_UNKNOWN');}
    if(!resolvedPath.startsWith(base+'\\'))
      return unknown('ER1_D30_B_VBS_OUTSIDE_FIXED_DATA');
    let bytes;
    try{bytes=readVbs(file);}catch{return unknown('ER1_D30_B_VBS_UNREADABLE');}
    if(!Buffer.isBuffer(bytes)||bytes.length===0||bytes.length>65_536)
      return unknown('ER1_D30_B_VBS_BYTES_UNVERIFIED');
    visited.add(norm(file));
    const text=decode(bytes);
    observed.push({sha256:hash(bytes)}); // No launcher content or secret paths in output.
    const lower=text.toLowerCase();
    archiveReferenced ||= lower.includes('archive-run.mjs');
    const nativeExecutables=(text.match(/[A-Z]:\\[^\r\n"'<>|]*?\.(?:exe|mjs)/gi)??[]);
    let nodeBound=false,localBound=false;
    try{
      nodeBound=nativeExecutables.some(p=>canonical(p)===canonical(NODE));
      const entry=ALLOWED_CORE_ENTRIES.find(target=>
        nativeExecutables.some(p=>canonical(p)===canonical(target)));
      localBound=!!entry;
      if(entry)launchEntry=path.win32.basename(entry);
    }catch{return unknown('ER1_D30_B_NODE_SOURCE_REALPATH_UNKNOWN');}
    // The registered entry can legitimately be quota-runner or a wrapper;
    // publishing flags are a distinct runtime behavior, not source identity.
    if(nodeBound&&localBound)resolved=true;
    for(const next of vbsPaths(text)){
      if(!visited.has(norm(next))&&!queue.some(x=>norm(x)===norm(next)))queue.push(next);
    }
  }
  if(!resolved)return {...unknown('ER1_D30_B_NODE_SOURCE_UNRESOLVED'),
    observedVbsCount:observed.length,archiveReferenced};
  return {taskName:TASK,sourceRoot:ROOT,nodePath:NODE,
    taskXmlSha256:hash(taskXml),taskXmlReadbackVerified:true,
    chainVerified:true,vbsOrDirectNodeVerified:true,
    observedVbsCount:observed.length,archiveReferenced,launchEntry};
}

function fixedGit(){
  for(const candidate of [String.raw`C:\Program Files\Git\cmd\git.exe`,
    String.raw`C:\Program Files\Git\bin\git.exe`]){
    try{const s=fs.lstatSync(candidate);if(s.isFile()&&!s.isSymbolicLink())return candidate;}
    catch{}
  }
  stop('ER1_D30_B_FIXED_GIT_MISSING');
}
function safeRead(file,root,max=2_000_000){
  const stat=fs.lstatSync(file);
  need(stat.isFile()&&!stat.isSymbolicLink()&&stat.size>0&&stat.size<max,
    'ER1_D30_B_FILE_UNSAFE');
  const real=fs.realpathSync.native(file).toLowerCase();
  const prefix=fs.realpathSync.native(root).toLowerCase()+path.win32.sep;
  need(real.startsWith(prefix),'ER1_D30_B_PATH_ESCAPE');
  return fs.readFileSync(file);
}
function runGit(args){
  const exe=fixedGit();
  const result=spawnSync(exe,['-C',ROOT,'-c','core.fsmonitor=false',...args],
    {shell:false,windowsHide:true,timeout:15_000,maxBuffer:64_000,
      encoding:'utf8',env:{...process.env,GIT_OPTIONAL_LOCKS:'0',
        GIT_TERMINAL_PROMPT:'0',GIT_CONFIG_NOSYSTEM:'1'}});
  need(!result.error&&result.status===0,'ER1_D30_B_GIT_READ_STOP');
  return result.stdout.trim();
}
function nativeTaskXml(){
  const exe=path.win32.join(process.env.SystemRoot||String.raw`C:\Windows`,
    'System32','schtasks.exe');
  const r=spawnSync(exe,['/Query','/TN',TASK,'/XML'],
    {shell:false,windowsHide:true,timeout:15_000,maxBuffer:262_144,encoding:null});
  need(!r.error&&r.status===0&&Buffer.isBuffer(r.stdout),
    'ER1_D30_B_TASK_XML_READ_STOP');
  return r.stdout;
}

/**
 * Injected `io` exists for bounded fixture tests only; real one-shot mode
 * uses the fixed native read implementations. Evidence ID must come from the
 * authenticated Actions receiver, never from an untrusted Issue body alone.
 */
export function createD30FeatureBReadOnlyHost({
  evidenceId=null,
  io={read:(p,root,max)=>safeRead(p,root,max),git:runGit,
    taskXml:nativeTaskXml,lockExists:p=>fs.existsSync(p),
    realpath:p=>fs.realpathSync.native(p)},
}={}){
  const readJson=file=>JSON.parse(io.read(file,DATA,131_072).toString('utf8'));
  const sha=val=>typeof val==='string'&&SHA40.test(val)?val:null;
  let chain=null;
  return {
    async inspectSourceGit(){
      const head=io.git(['rev-parse','HEAD']);
      const dirty=io.git(['status','--porcelain','--untracked-files=no','--',...FILES]);
      return {sourceRoot:ROOT,head,
        trackedDirty:dirty.length!==0,sourceTrackedDirtyScope:'PINNED_TARGET_3FILES',
        gitVerified:SHA40.test(head)};
    },
    async inspectTaskLaunchChain(){
      chain=traceD30CoreTaskChain({taskXml:io.taskXml(),
        readVbs:p=>io.read(p,DATA,65_536),resolvePath:io.realpath});
      return chain;
    },
    async inspectWriterConfig(){
      const source=readJson(path.win32.join(DATA,'config.json')).source;
      return {sourceRoot:ROOT,sourceSha:sha(source),readbackVerified:!!sha(source)};
    },
    async inspectWriterCheckpoint(){
      const source=readJson(path.win32.join(DATA,'local-writer-last-run.json')).source;
      return {sourceSha:sha(source),readbackVerified:!!sha(source)};
    },
    async inspectSourceConsumers(){
      // Publisher uses config.source, but a sidecar's bound source is not yet
      // proved by the static wrapper alone. Unknown deliberately stays null.
      const source=readJson(path.win32.join(DATA,'config.json')).source;
      return [{name:'CORE_PUBLISHER',sourceSha:sha(source)},
        {name:'CNN_ARCHIVE_SIDECAR',sourceSha:null,
          followsConfigSource:false,archiveWrapperObserved:chain?.archiveReferenced===true}];
    },
    async inspectExactFileHashes(requested){
      need(Array.isArray(requested)&&requested.join('|')===FILES.join('|'),
        'ER1_D30_B_EXACT_SCOPE_STOP');
      return Object.fromEntries(FILES.map(p=>[p,hash(io.read(
        path.win32.join(ROOT,...p.split('/')),ROOT,2_000_000))]));
    },
    async inspectSharedSourceLock(){return {path:LOCK,
      held:io.lockExists(LOCK)===true,readbackVerified:true};},
    async inspectReadOnlyEvidenceId(){return evidenceId&&
      Number.isSafeInteger(evidenceId.issue)&&evidenceId.issue>0&&
      String(evidenceId.requestId||'').trim()?{...evidenceId}:null;},
  };
}

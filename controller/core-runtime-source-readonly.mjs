// Installed A-only, bounded Windows Task EnginePID/WMI source proof.
// This module does not execute Core, mutate the scheduler, access databases,
// call providers, or print raw process command lines/environment variables.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const nodePath=String.raw`E:\ZGmini\runtime\node.exe`;
const projectsRoot=String.raw`E:\ZGmini\projects`;
const checkedFiles=Object.freeze([
 'lib/earnings-api-calendar.mjs',
 'scripts/pc-writer/earnings-api-local.mjs',
 'scripts/pc-writer/release-calendar.mjs',
]);
const norm=value=>path.win32.normalize(value).toLowerCase();
const validPid=value=>Number.isSafeInteger(value)&&value>0;
const unknown=code=>({status:'STATE_UNKNOWN',code,
 evidenceLevel:'LIVE_PROCESS_SNAPSHOT_INCONCLUSIVE',runtimeSourceVerified:false,
 providerCalls:0,d1Writes:0,sqliteOpened:false,operationalWrites:0});

export function classifyCoreSnapshot(snapshot,{realpath=fs.realpathSync.native}={}){
 if(snapshot?.ok!==true||!Array.isArray(snapshot?.engines)||
   !Array.isArray(snapshot?.processes)||snapshot.processes.length>8192)
  return unknown('CORE_PROCESS_SNAPSHOT_UNAVAILABLE');
 const engines=new Set(snapshot.engines.filter(validPid));
 if(!engines.size)return unknown('CORE_NO_ACTIVE_TASK_ENGINE');
 const byPid=new Map();
 for(const p of snapshot.processes){
  if(p.pid===0)continue;
  if(!validPid(p.pid)||byPid.has(p.pid))return unknown('CORE_PROCESS_INVENTORY_INVALID');
  byPid.set(p.pid,p);
 }
 let baseCanonical,nodeCanonical;
 try{
  baseCanonical=norm(realpath(projectsRoot));
  nodeCanonical=norm(realpath(nodePath));
 }catch{return unknown('CORE_SOURCE_REALPATH_UNAVAILABLE');}
 if(!nodeCanonical.endsWith('\\node.exe'))return unknown('CORE_NODE_REALPATH_INVALID');
 const matching=[];
 for(const p of snapshot.processes){
  if(p.name!=='node.exe'||!['E','C'].includes(p.sourceMarker)||
      typeof p.relativeRoot!=='string')continue;
  const segments=p.relativeRoot.split('\\');
  if(segments.length<1||segments.length>3||segments.some(x=>
      !/^[a-z0-9_-][a-z0-9._-]{0,79}$/i.test(x)))continue;
  const candidateRoot=path.win32.join(`${p.sourceMarker}:\\ZGmini\\projects`,...segments);
  const script=path.win32.join(candidateRoot,'scripts','pc-writer','local-cycle.mjs');
  let rootCanonical,scriptCanonical;
  try{
   rootCanonical=norm(realpath(candidateRoot));
   scriptCanonical=norm(realpath(script));
  }catch{continue;}
  if(!rootCanonical.startsWith(baseCanonical+'\\')||
     scriptCanonical!==path.win32.join(rootCanonical,'scripts','pc-writer','local-cycle.mjs'))continue;
  const visited=new Set();
  let cur=p,linked=false;
  for(let i=0;i<64;i++){
   if(engines.has(cur.pid)){linked=true;break;}
   if(visited.has(cur.pid)||!validPid(cur.parentPid))break;
   visited.add(cur.pid);
   const parent=byPid.get(cur.parentPid);
   if(!parent)break;
   if(Number.isFinite(cur.createdAtMs)&&Number.isFinite(parent.createdAtMs)&&
       parent.createdAtMs>cur.createdAtMs)break;
   cur=parent;
  }
  if(linked)matching.push({pid:p.pid,sourceRoot:rootCanonical});
 }
 if(matching.length!==1)return unknown(matching.length>1?
  'CORE_MULTIPLE_LINKED_NODES':'CORE_LINKED_NODE_NOT_OBSERVED');
 return {status:'PASS',code:'CORE_RUNTIME_SOURCE_VERIFIED',
  evidenceLevel:'TASK_ENGINE_WMI_PROCESS_CHAIN',runtimeSourceVerified:true,
  activeCoreSourceVerified:true,activeCoreRoot:matching[0].sourceRoot,
  relativeEntrypoint:'scripts/pc-writer/local-cycle.mjs',
  runningTaskInstances:snapshot.runningInstances,
  providerCalls:0,d1Writes:0,sqliteOpened:false,operationalWrites:0};
}

export function hashActiveCoreFiles(sourceRoot,{realpath=fs.realpathSync.native,
 lstat=fs.lstatSync,read=fs.readFileSync}={}){
 try{
  const root=norm(realpath(sourceRoot)),base=norm(realpath(projectsRoot));
  if(!root.startsWith(base+'\\'))return null;
  const hashes=[];
  for(const relative of checkedFiles){
   const file=path.win32.join(root,...relative.split('/'));
   const actual=norm(realpath(file));
   if(!actual.startsWith(root+'\\'))return null;
   const info=lstat(file);
   if(!info.isFile()||info.isSymbolicLink()||info.size<1||info.size>2_000_000)
    return null;
   const bytes=read(file);
   if(!Buffer.isBuffer(bytes)||bytes.length!==info.size)return null;
   hashes.push({path:relative,sha256:createHash('sha256').update(bytes).digest('hex')});
  }
  return hashes;
 }catch{return null;}
}

export function inspectCoreRuntimeSource({platform=process.platform,
 probe=spawnSync,exists=fs.existsSync,realpath=fs.realpathSync.native,
 lstat=fs.lstatSync,read=fs.readFileSync,
 systemRoot=process.env.SystemRoot??String.raw`C:\Windows`}={}){
 if(platform!=='win32')return unknown('CORE_WINDOWS_REQUIRED');
 const cscript=path.win32.join(systemRoot,'System32','cscript.exe');
 const script=fileURLToPath(new URL('./core-runtime-source-wmi.js',import.meta.url));
 if(!exists(cscript)||!exists(script))return unknown('CORE_FIXED_PROBE_UNAVAILABLE');
 try{
  const result=probe(cscript,['//NoLogo',script],{
   encoding:'utf8',windowsHide:true,shell:false,timeout:20000,maxBuffer:1500000,
  });
  if(result?.error||result?.status!==0||typeof result.stdout!=='string'||
     result.stdout.length>1500000)return unknown('CORE_FIXED_PROBE_EXECUTION_UNAVAILABLE');
  const snapshot=JSON.parse(result.stdout.trim());
  const classified=classifyCoreSnapshot(snapshot,{realpath});
  if(classified.status!=='PASS')return classified;
  const beforeFileSha256=hashActiveCoreFiles(classified.activeCoreRoot,{realpath,lstat,read});
  if(!beforeFileSha256)return unknown('CORE_ACTIVE_SOURCE_FILE_HASH_UNAVAILABLE');
  return {...classified,beforeFileSha256};
 }catch{return unknown('CORE_FIXED_PROBE_EXECUTION_UNAVAILABLE');}
}

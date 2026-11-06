// Installed A-only, bounded Windows Task EnginePID/WMI source proof.
// This module does not execute Core, mutate the scheduler, access databases,
// call providers, or print raw process command lines/environment variables.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const nodePath=String.raw`E:\ZGmini\runtime\node.exe`;
const sourceRoot=String.raw`E:\ZGmini\projects\zgmini-earnings-history-pc-release`;
const expectedScript=path.win32.join(sourceRoot,'scripts','pc-writer','local-cycle.mjs');
const alternateScript=expectedScript.replace(/^E:/i,'C:');
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
 let expectedCanonical,actualCanonical,alternateCanonical,rootCanonical;
 try{
  rootCanonical=norm(realpath(sourceRoot));
  expectedCanonical=norm(realpath(expectedScript));
  actualCanonical=norm(realpath(nodePath));
  alternateCanonical=norm(realpath(alternateScript));
 }catch{
  // The C: compatibility junction may not exist. E: remains sufficient.
  try{
   rootCanonical=norm(realpath(sourceRoot));
   expectedCanonical=norm(realpath(expectedScript));
   actualCanonical=norm(realpath(nodePath));
   alternateCanonical=null;
  }catch{return unknown('CORE_SOURCE_REALPATH_UNAVAILABLE');}
 }
 if(!actualCanonical.endsWith('\\node.exe'))return unknown('CORE_NODE_REALPATH_INVALID');
 if(expectedCanonical!==path.win32.join(rootCanonical,'scripts','pc-writer','local-cycle.mjs'))
  return unknown('CORE_SCRIPT_OUTSIDE_CANONICAL_SOURCE');
 const matching=[];
 for(const p of snapshot.processes){
  if(p.name!=='node.exe'||!['E','C'].includes(p.sourceMarker))continue;
  if(p.sourceMarker==='C'&&(!alternateCanonical||alternateCanonical!==expectedCanonical))continue;
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
  if(linked)matching.push(p.pid);
 }
 if(matching.length!==1)return unknown(matching.length>1?
  'CORE_MULTIPLE_LINKED_NODES':'CORE_LINKED_NODE_NOT_OBSERVED');
 return {status:'PASS',code:'CORE_RUNTIME_SOURCE_VERIFIED',
  evidenceLevel:'TASK_ENGINE_WMI_PROCESS_CHAIN',runtimeSourceVerified:true,
  activeCoreSourceVerified:true,sourceRootMarker:'E_ZGMINI_RELEASE',
  relativeEntrypoint:'scripts/pc-writer/local-cycle.mjs',
  runningTaskInstances:snapshot.runningInstances,
  providerCalls:0,d1Writes:0,sqliteOpened:false,operationalWrites:0};
}

export function inspectCoreRuntimeSource({platform=process.platform,
 probe=spawnSync,exists=fs.existsSync,realpath=fs.realpathSync.native,
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
  return classifyCoreSnapshot(snapshot,{realpath});
 }catch{return unknown('CORE_FIXED_PROBE_EXECUTION_UNAVAILABLE');}
}

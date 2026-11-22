// Installed A-only, bounded Windows Task EnginePID/WMI source proof.
// This module does not execute Core, mutate the scheduler, access databases,
// call providers, or print raw process command lines/environment variables.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync,execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {inspectStoredCoreCycleEvidence} from './core-cycle-provenance-readonly.mjs';

const nodePath=String.raw`E:\ZGmini\runtime\node.exe`;
const projectsRoot=String.raw`E:\ZGmini\projects`;
const checkedFiles=Object.freeze([
 'lib/earnings-api-calendar.mjs',
 'scripts/pc-writer/earnings-api-local.mjs',
 'scripts/pc-writer/release-calendar.mjs',
]);
const norm=value=>path.win32.normalize(value).toLowerCase();
const validPid=value=>Number.isSafeInteger(value)&&value>0;
const identityFiles=Object.freeze(['scripts/pc-writer/local-cycle.mjs',
 'scripts/pc-writer/collect-local.mjs','scripts/pc-writer/run-local.mjs',
 'scripts/pc-writer/collection-events.mjs']);
const unknown=code=>({status:'STATE_UNKNOWN',code,
 evidenceLevel:'LIVE_PROCESS_SNAPSHOT_INCONCLUSIVE',runtimeSourceVerified:false,
 providerCalls:0,d1Writes:0,sqliteOpened:false,operationalWrites:0});

export function classifyCoreSnapshot(snapshot,{realpath=fs.realpathSync.native,
 includeOwnerPid=false}={}){
 if(snapshot?.ok!==true||!Array.isArray(snapshot?.engines)||
   !Array.isArray(snapshot?.processes)||snapshot.processes.length>8192)
  return unknown('CORE_PROCESS_SNAPSHOT_UNAVAILABLE');
 const engines=new Set(snapshot.engines.filter(validPid));
 if(!engines.size){
  // GetInstances is security-context filtered. An empty list does not prove
  // the task stopped; a regular scheduled cycle may also finish mid-probe.
  // Preserve UNKNOWN rather than substituting unrelated Node processes.
  const validState=x=>Number.isInteger(x)&&x>=0&&x<=4;
  if(validState(snapshot.taskStateBefore)&&validState(snapshot.taskStateAfter)){
   const before=snapshot.taskStateBefore,after=snapshot.taskStateAfter;
   const code=before!==after?'CORE_TASK_STATE_CHANGED_DURING_PROBE':
    snapshot.runningInstances>0?'CORE_TASK_ENGINE_PID_UNAVAILABLE':
    after===4?'CORE_TASK_RUNNING_INSTANCE_UNOBSERVABLE':
    after===0?'CORE_TASK_STATE_UNKNOWN':'CORE_TASK_NOT_RUNNING_AT_SNAPSHOT';
   return {...unknown(code),taskObservation:{stateBefore:before,stateAfter:after,
    visibleRunningInstances:Number.isSafeInteger(snapshot.runningInstances)&&
     snapshot.runningInstances>=0?snapshot.runningInstances:null,
    stoppedProven:false,securityContextMayLimitVisibility:true}};
  }
  return unknown('CORE_NO_ACTIVE_TASK_ENGINE');
 }
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
  ...(includeOwnerPid?{ownerPid:matching[0].pid}:{}),
  providerCalls:0,d1Writes:0,sqliteOpened:false,operationalWrites:0};
}


// Fixed, bounded read-only inspection of the Core cycle lock. A lock PID is
// only a candidate: even a successful read never authorizes deletion or
// suspension of an active process.
const CORE_LOCK=String.raw`E:\ZGmini\data\pc-writer\local-cycle.lock`;
export function readCoreLockSnapshot({
 file=CORE_LOCK,lstat=fs.lstatSync,read=fs.readFileSync,clock=Date.now,
}={}){
 try{
  const stat=lstat(file);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size<2||stat.size>512)
   return {state:'UNKNOWN'};
  const bytes=read(file);
  if(!Buffer.isBuffer(bytes)||bytes.length!==stat.size)
   return {state:'UNKNOWN'};
  let value;
  try{value=JSON.parse(bytes.toString('utf8'));}catch{return {state:'UNKNOWN'};}
  if(!validPid(value?.pid)||!Number.isSafeInteger(value?.at)||
     value.at<946684800000||value.at>clock()+60000)
   return {state:'UNKNOWN'};
  return {state:'PRESENT',pid:value.pid,at:value.at,
   fingerprint:createHash('sha256').update(bytes).digest('hex')};
 }catch(error){
  return error?.code==='ENOENT'?{state:'ABSENT'}:{state:'UNKNOWN'};
 }
}

// Task Engine chain and lock owner are independent assertions. A matching PID
// without an active Core Task chain or plausible process creation time is NOT
// proof of ownership; Windows PID reuse remains fail-closed.
export function classifyCoreLockOwner(snapshot,before,after,
 {realpath=fs.realpathSync.native}={}){
 const unverified=code=>({status:'UNVERIFIED',code});
 if(before?.state==='ABSENT'&&after?.state==='ABSENT')
  return {status:'ABSENT',code:'CORE_LOCK_ABSENT'};
 if(before?.state!=='PRESENT'||after?.state!=='PRESENT')
  return unverified('CORE_LOCK_UNREADABLE_OR_CHANGED');
 if(before.fingerprint!==after.fingerprint||before.pid!==after.pid||
    before.at!==after.at)return unverified('CORE_LOCK_CHANGED_DURING_PROBE');
 if(snapshot?.ok!==true||!Array.isArray(snapshot.processes)||
    snapshot.processes.length>8192)
  return unverified('CORE_LOCK_PROCESS_INVENTORY_UNAVAILABLE');
 const candidates=snapshot.processes.filter(row=>row.pid===before.pid);
 if(candidates.length===0)return unverified('CORE_LOCK_OWNER_PID_NOT_OBSERVED');
 if(candidates.length!==1)return unverified('CORE_LOCK_PROCESS_INVENTORY_INVALID');
 const match=candidates[0];
 if(!Number.isSafeInteger(match.createdAtMs))
  return unverified('CORE_LOCK_PROCESS_START_UNVERIFIED');
 if(match.createdAtMs>before.at+5000)
  return unverified('CORE_LOCK_PID_REUSE_POSSIBLE');
 const core=classifyCoreSnapshot(snapshot,{realpath,includeOwnerPid:true});
 if(core.status!=='PASS')return unverified('CORE_LOCK_TASK_LINEAGE_UNVERIFIED');
 if(core.ownerPid!==before.pid)return unverified('CORE_LOCK_PID_NOT_LINKED_CORE');
 return {status:'VERIFIED_ACTIVE_CORE',code:'CORE_LOCK_TASK_LINKED_OWNER_VERIFIED'};
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

// Bind the OS-observed source root to the approved Git source and the exact
// entry/collector/Writer bytes. A matching checkout name or HEAD alone is not
// execution provenance. Never fetch, update Git/config, or print config bytes.
export function readActiveCoreSourceIdentity(sourceRoot,{
 realpath=fs.realpathSync.native,lstat=fs.lstatSync,read=fs.readFileSync,
 run=execFileSync,configFile=String.raw`E:\ZGmini\data\pc-writer\config.json`,
}={}){
 const fail=code=>({status:'UNVERIFIED',code});
 const digest=b=>createHash('sha256').update(b).digest('hex');
 try{
  const root=norm(realpath(sourceRoot)),base=norm(realpath(projectsRoot));
  if(!root.startsWith(base+'\\'))return fail('CORE_SOURCE_IDENTITY_PATH_INVALID');
  const git=args=>run('git',args,{cwd:root,encoding:null,windowsHide:true,
   shell:false,timeout:5000,maxBuffer:2_000_000});
  const head=git(['rev-parse','HEAD']).toString('utf8').trim();
  if(!/^[a-f0-9]{40}$/.test(head))return fail('CORE_SOURCE_IDENTITY_SHA_INVALID');
  const ci=lstat(configFile);
  if(!ci.isFile()||ci.isSymbolicLink()||ci.size<2||ci.size>65536)
   return fail('CORE_SOURCE_APPROVAL_UNREADABLE');
  const configBytes=read(configFile),approved=JSON.parse(configBytes.toString('utf8')).source;
  if(head!==approved)return fail('CORE_RUNNING_APPROVED_SOURCE_MISMATCH');
  const files=[];
  for(const rel of identityFiles){
   const file=path.win32.join(root,...rel.split('/'));
   if(norm(realpath(file))!==file)return fail('CORE_SOURCE_IDENTITY_PATH_INVALID');
   const st=lstat(file);
   if(!st.isFile()||st.isSymbolicLink()||st.size<1||st.size>2_000_000)
    return fail('CORE_EXECUTION_FILE_UNVERIFIED');
   const bytes=read(file),expected=git(['cat-file','blob',head+':'+rel]);
   if(!Buffer.isBuffer(bytes)||bytes.length!==st.size)
    return fail('CORE_EXECUTION_FILE_SOURCE_MISMATCH');
   let bytePolicy='EXACT_GIT_BLOB';
   if(digest(bytes)!==digest(expected)){
    // A normal Windows Git checkout can materialize LF blobs as CRLF.
    // Accept only that exact transformation under an observed Git policy;
    // never run repository filters or normalize arbitrary source changes.
    if(expected.includes(13)||!bytes.equals(Buffer.from(expected.toString('utf8').replace(/\n/g,'\r\n'))))
     return fail('CORE_EXECUTION_FILE_SOURCE_MISMATCH');
    const raw=git(['check-attr','-z','text','eol','filter','--',rel]).toString('utf8').split('\0');
    const attrs={};for(let i=0;i+2<raw.length;i+=3)attrs[raw[i+1]]=raw[i+2];
    if(attrs.filter!=='unspecified'||attrs.text==='unset'||attrs.eol==='lf')
     return fail('CORE_EXECUTION_FILE_SOURCE_MISMATCH');
    const auto=git(['config','--get','core.autocrlf']).toString('utf8').trim();
    if(attrs.eol!=='crlf'&&auto!=='true')return fail('CORE_EXECUTION_FILE_SOURCE_MISMATCH');
    bytePolicy='GIT_CRLF_CHECKOUT';
   }
   files.push({path:rel,sha256:digest(bytes),gitBlobSha256:digest(expected),bytePolicy});
  }
  if(git(['rev-parse','HEAD']).toString('utf8').trim()!==head||
     digest(read(configFile))!==digest(configBytes))
   return fail('CORE_SOURCE_CHANGED_DURING_PROBE');
  return {status:'VERIFIED',sourceSha:head,approvedSourceSha:approved,files};
 }catch{return fail('CORE_SOURCE_IDENTITY_UNAVAILABLE');}
}

export function inspectCoreRuntimeSource({platform=process.platform,
 probe=spawnSync,exists=fs.existsSync,realpath=fs.realpathSync.native,
 lstat=fs.lstatSync,read=fs.readFileSync,
 readLock=readCoreLockSnapshot,
 sourceIdentity=readActiveCoreSourceIdentity,
 recentCycleReader=inspectStoredCoreCycleEvidence,
 systemRoot=process.env.SystemRoot??String.raw`C:\Windows`}={}){
 if(platform!=='win32')return unknown('CORE_WINDOWS_REQUIRED');
 const cscript=path.win32.join(systemRoot,'System32','cscript.exe');
 const script=fileURLToPath(new URL('./core-runtime-source-wmi.mjs',import.meta.url));
 if(!exists(cscript)||!exists(script))return unknown('CORE_FIXED_PROBE_UNAVAILABLE');
 try{
  const lockBefore=readLock();
  const result=probe(cscript,['//NoLogo','//E:JScript',script],{
   encoding:'utf8',windowsHide:true,shell:false,timeout:20000,maxBuffer:1500000,
  });
  if(result?.error||result?.status!==0||typeof result.stdout!=='string'||
     result.stdout.length>1500000)return unknown('CORE_FIXED_PROBE_EXECUTION_UNAVAILABLE');
  const snapshot=JSON.parse(result.stdout.trim());
  const lockAfter=readLock();
  const lockOwner=classifyCoreLockOwner(snapshot,lockBefore,lockAfter,{realpath});
  const classified=classifyCoreSnapshot(snapshot,{realpath});
  if(classified.status!=='PASS'){
   // A finished natural cycle can corroborate an inactive Task only when the
   // current lock is independently ABSENT; never override a live/unknown owner.
   const eligible=new Set(['CORE_TASK_NOT_RUNNING_AT_SNAPSHOT',
    'CORE_TASK_RUNNING_INSTANCE_UNOBSERVABLE',
    'CORE_NO_ACTIVE_TASK_ENGINE','CORE_TASK_ENGINE_PID_UNAVAILABLE']);
   if(!eligible.has(classified.code))return {...classified,lockOwner};
   if(lockOwner.status!=='ABSENT')return {...classified,lockOwner,
    recentCycleEvidence:{status:'STATE_UNKNOWN',code:'CORE_RECENT_LOCK_NOT_ABSENT'}};
   let recent;
   try{recent=recentCycleReader();}
   catch{recent={status:'STATE_UNKNOWN',code:'CORE_RECENT_PROBE_UNAVAILABLE'};}
   // Do not accept an unqualified synthetic PASS from another read-only source.
   if(recent?.status==='PASS'&&recent.recentCoreSourceVerified===true&&
      recent.activeCoreSourceVerified===false&&recent.sourceFileHashesVerified===true&&
      /^[0-9a-f]{40}$/.test(recent.sourceSha??''))return {...recent,
      liveSnapshot:{status:classified.status,code:classified.code,
       taskObservation:classified.taskObservation??null},lockOwner};
   return {...classified,lockOwner,
    recentCycleEvidence:{status:recent?.status??'STATE_UNKNOWN',
     code:recent?.code??'CORE_RECENT_PROOF_INCOMPLETE'}};
  }
  const beforeFileSha256=hashActiveCoreFiles(classified.activeCoreRoot,{realpath,lstat,read});
  // Preserve the old top-level fail-closed contract when these particular
  // source file hashes cannot be proven. Do not discard independently verified
  // live TaskEngine/WMI ancestry; it is not a replacement for file provenance.
  if(!beforeFileSha256)return {...unknown('CORE_ACTIVE_SOURCE_FILE_HASH_UNAVAILABLE'),
   runtimeProcessEvidence:classified,sourceFileHashesVerified:false,
   sourceFileHashCode:'CORE_ACTIVE_SOURCE_FILE_HASH_UNAVAILABLE',beforeFileSha256:null,lockOwner};
  const identity=sourceIdentity(classified.activeCoreRoot);
  if(identity?.status!=='VERIFIED')return {...unknown(identity?.code??'CORE_SOURCE_IDENTITY_UNAVAILABLE'),
   runtimeProcessEvidence:classified,sourceIdentity:identity,lockOwner};
  const taskInstanceIds=Array.isArray(snapshot.taskInstanceIds)?snapshot.taskInstanceIds.filter(
   id=>typeof id==='string'&&/^\{[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\}$/i.test(id)):[];
  return {...classified,sourceFileHashesVerified:true,
   sourceFileHashCode:null,beforeFileSha256,lockOwner,sourceIdentity:identity,
   taskOrigin:{method:snapshot.engineOrigin==='TASK_SERVICE_INCLUDE_HIDDEN_EXACT_PATH'?
    snapshot.engineOrigin:'REGISTERED_TASK_GET_INSTANCES',taskInstanceIds},
   collectionWriterSameCycleVerified:false,
   resultLineage:'LIVE_SOURCE_PROVEN_CHECKPOINT_CYCLE_LINK_NOT_ATTESTED'};
 }catch{return unknown('CORE_FIXED_PROBE_EXECUTION_UNAVAILABLE');}
}

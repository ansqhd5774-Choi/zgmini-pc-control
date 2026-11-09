// Read-only, bounded shared-resource observation on the installed Windows PC.
// This is a candidate snapshot, NOT an authenticated release certificate:
// GitHub Issue/Run/result-pair readback and current approval are separate.
// No lock deletion, scheduler mutation, automatic retry or owner notification.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const SHA40=/^[a-f0-9]{40}$/;
const DATA_ROOT=String.raw`E:\ZGmini\data`;
const CORE_TASK='ZGMINI-PC-Local-Core';
const TASK_KEYS=['enabled','instances','ok','relatedProcesses','state','unknownProcessLines'];
const probeFile=fileURLToPath(new URL('./writer-b-1063-task-probe.mjs',import.meta.url));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const unknown=code=>({status:'STATE_UNKNOWN',code,
 evidenceLevel:'PC_LOCAL_OBSERVATION_INCOMPLETE',releaseVerified:false,
 runtimeSourceVerified:false,approvalVerified:false,ownerReplanAuthorized:false,
 automaticPcRetries:0,providerCalls:0,d1Writes:0,sqliteOpened:false,
 operationalWrites:0});

export function classifySharedResourceSamples(first,second){
 const valid=x=>x&&typeof x==='object'&&x.task&&
   Object.keys(x.task).sort().join(',')===TASK_KEYS.join(',')&&
   x.task.ok===true&&typeof x.task.enabled==='boolean'&&
   Number.isSafeInteger(x.task.state)&&x.task.state>=0&&x.task.state<=4&&
   ['instances','relatedProcesses','unknownProcessLines'].every(k=>
     Number.isSafeInteger(x.task[k])&&x.task[k]>=0)&&
   typeof x.coreLock==='boolean'&&typeof x.writerLock==='boolean'&&
   SHA40.test(x.configSourceSha??'')&&
   /^[a-f0-9]{64}$/.test(x.taskXmlSha256??'')&&
   Number.isSafeInteger(x.observedAtMs)&&x.observedAtMs>0;
 if(!valid(first)||!valid(second))return unknown('SHARED_RESOURCE_SAMPLE_UNVERIFIED');
 if(second.observedAtMs-first.observedAtMs<1000||
    second.observedAtMs-first.observedAtMs>30000)
  return unknown('SHARED_RESOURCE_SAMPLE_WINDOW_INVALID');
 const idle=x=>x.task.enabled===true&&x.task.state===3&&
   x.task.instances===0&&x.task.relatedProcesses===0&&
   x.task.unknownProcessLines===0&&x.coreLock===false;
 const stable=first.taskXmlSha256===second.taskXmlSha256&&
   first.configSourceSha===second.configSourceSha;
 const writerFree=idle(first)&&idle(second)&&stable&&
   first.writerLock===false&&second.writerLock===false;
 const writerBusy=[first,second].some(x=>x.writerLock||x.coreLock||
   x.task.instances>0||x.task.relatedProcesses>0||x.task.state===4);
 const writerState=writerFree?'CANDIDATE_CLEAR_NOT_AUTHORIZED':
   writerBusy?'OBSERVED_BUSY':'UNVERIFIED';
 return Object.freeze({status:'PASS',code:'SHARED_RESOURCE_READONLY_SNAPSHOT',
  evidenceLevel:'TWO_WINDOWS_SAMPLES_NOT_RELEASE_AUTHORIZATION',
  observedAt:new Date(second.observedAtMs).toISOString(),
  sampleCount:2,sourceStable:stable,observedConfigSourceSha:second.configSourceSha,
  taskXmlStable:first.taskXmlSha256===second.taskXmlSha256,
  resources:Object.freeze({
   'writer-source':Object.freeze({state:writerState,
     releaseCondition:'CORE_IDLE_WINDOW_VERIFIED',
     writerLockObserved:first.writerLock||second.writerLock,
     coreLockObserved:first.coreLock||second.coreLock}),
   'controller-install':Object.freeze({state:'UNVERIFIED',
     reason:'OWNER_LEASE_AND_MAINTENANCE_STATE_NOT_ATTESTED'}),
   'pc-job-heavy-memory':Object.freeze({state:'UNVERIFIED',
     reason:'OWN_REQUEST_AND_SEAT_LEASES_REQUIRE_CONTEXT_BOUND_ATTESTATION'}),
   'result-upload':Object.freeze({state:'UNVERIFIED',
     reason:'REMOTE_RESULT_PAIR_AND_RECEIPT_NOT_ATTESTED'}),
  }),
  releaseVerified:false,runtimeSourceVerified:false,approvalVerified:false,
  ownerReplanAuthorized:false,automaticPcRetries:0,providerCalls:0,
  d1Writes:0,sqliteOpened:false,operationalWrites:0});
}

function fixedLockState(file){
 try {fs.lstatSync(file);return true;}
 catch(error){if(error?.code==='ENOENT')return false;throw error;}
}

/** No caller paths, commands or resource key. Requires fixed installed layout. */
export function nativeSharedResourceSample({dataRoot,queryTask,
 platform=process.platform,probe=spawnSync,clock=Date.now}={}){
 if(platform!=='win32'||typeof queryTask!=='function')throw Error('WINDOWS_TASK_REQUIRED');
 const canonical=fs.realpathSync.native(dataRoot);
 if(path.win32.normalize(canonical).toLowerCase()!==
    path.win32.normalize(DATA_ROOT).toLowerCase())throw Error('DATA_ROOT_UNVERIFIED');
 const root=path.win32.join(canonical,'pc-writer');
 const stats=fs.lstatSync(root);
 if(!stats.isDirectory()||stats.isSymbolicLink()||
    path.win32.normalize(fs.realpathSync.native(root)).toLowerCase()!==
    path.win32.normalize(root).toLowerCase())throw Error('WRITER_ROOT_UNVERIFIED');
 const configFile=path.win32.join(root,'config.json');
 const cs=fs.lstatSync(configFile);
 if(!cs.isFile()||cs.isSymbolicLink()||cs.size<1||cs.size>65536||
    path.win32.normalize(fs.realpathSync.native(configFile)).toLowerCase()!==
    path.win32.normalize(configFile).toLowerCase())throw Error('CONFIG_UNVERIFIED');
 const bytes=fs.readFileSync(configFile);
 if(bytes.length!==cs.size)throw Error('CONFIG_READ_DRIFT');
 const config=JSON.parse(bytes.toString('utf8'));
 const src=config?.source;
 const sourceSha=[src?.sha,src?.commit,src?.commitSha,src,config?.sourceSha]
   .find(x=>typeof x==='string'&&SHA40.test(x));
 if(!sourceSha)throw Error('CONFIG_SOURCE_UNVERIFIED');
 const taskXml=queryTask(CORE_TASK);
 if(!Buffer.isBuffer(taskXml)||taskXml.length<5||taskXml.length>262144)
  throw Error('TASK_XML_UNVERIFIED');
 const exe=path.win32.join(process.env.SystemRoot??String.raw`C:\Windows`,
   'System32','cscript.exe');
 if(!fs.existsSync(exe)||!fs.existsSync(probeFile))throw Error('TASK_PROBE_UNAVAILABLE');
 const observation=probe(exe,['//NoLogo','//E:JScript',probeFile],{
  encoding:'utf8',windowsHide:true,shell:false,timeout:12000,maxBuffer:2048});
 if(observation?.error||observation?.status!==0||
    typeof observation.stdout!=='string'||observation.stdout.length>2048)
  throw Error('TASK_PROBE_FAILED');
 const task=JSON.parse(observation.stdout.trim());
 return {task,taskXmlSha256:hash(taskXml),configSourceSha:sourceSha,
   coreLock:fixedLockState(path.win32.join(root,'local-cycle.lock')),
   writerLock:fixedLockState(path.win32.join(root,'writer-source-install.lock')),
   observedAtMs:clock()};
}

export async function inspectSharedResourceReleaseReadonly({dataRoot,queryTask,
 sample=nativeSharedResourceSample,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),
 platform=process.platform}={}){
 if(platform!=='win32')return unknown('SHARED_RESOURCE_WINDOWS_REQUIRED');
 try{
  const first=await sample({dataRoot,queryTask,platform});
  await wait(1500);
  const second=await sample({dataRoot,queryTask,platform});
  return classifySharedResourceSamples(first,second);
 }catch{return unknown('SHARED_RESOURCE_READONLY_PROBE_UNAVAILABLE');}
}

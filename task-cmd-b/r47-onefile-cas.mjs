// Shared bounded contract for a future, separately approved Task CMD one-file B.
// SOURCE ONLY: this module registers no operation, schedules no task, and makes no writes.
import path from 'node:path';
import {createHash} from 'node:crypto';
import {verifiedR47TaskRoute} from './r47-task-chain.mjs';

const stop=code=>{throw Object.assign(new Error(code),{code});};
const must=(ok,code)=>{if(!ok)stop(code);};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const sha64=x=>typeof x==='string'&&/^[0-9a-f]{64}$/.test(x);
const fixed=(a,b)=>typeof a==='string'&&path.win32.normalize(a).toLowerCase()===path.win32.normalize(b).toLowerCase();
export const R47_CMD_B=Object.freeze({
 schema:'ZGMINI_TASK_CMD_ONEFILE_B_V1',
 scope:'EXISTING_R47_TASK_CMD_SINGLE_FILE_CAS',
 sourceRepository:'ansqhd5774-Choi/zgmini',
 sourcePath:'scripts/pc-writer/THEME_NINE_R47_RECURRING_PRIVATE_UPDATE.cmd',
 // R54 observed this data-root file path; actual Task Exec action requires read-only preflight.
 targetPath:String.raw`E:\ZGmini\data\pc-writer\theme-nine-r48\THEME_NINE_R47_RECURRING_PRIVATE_UPDATE.cmd`,
 task:'ZGMINI-PC-Theme-Nine-R47-Private',
 historicalOldSha256:'2e0fc3e358feff70103d1e9025ce0944132b7b10a2159900f9479b9860550888',
 requestedTargetSha256:'a08fdec82b484c41ba3ac562908f31d96fee09c75cc3ff1b32386e9dd625ba45',
 historicalTaskXmlSha256:'bf3207ab2274d1248e7bd8c953cea2fd3bd277b8bd70bb1c2494339a06e0a4be'
});
export const R47_CMD_B_CALENDAR_SAFE=Object.freeze({
 beforeSha256:R47_CMD_B.requestedTargetSha256,
 afterSha256:'fde41fa4ac02c99139171c18a03fa2b00f6956825be92f9c2b3d10da7217a955',
 sourceSha:'a2cea21930f142657c6890471c515ac6d92e7809'
});
// A new GO is never inferred from the historical one-file GO. Both exact
// transitions are individually pinned; source, target or preimage drift stops.
const authorizedR47Transition=m=>
 (m.beforeSha256===R47_CMD_B.historicalOldSha256&&
  m.afterSha256===R47_CMD_B.requestedTargetSha256)||
 (m.beforeSha256===R47_CMD_B_CALENDAR_SAFE.beforeSha256&&
  m.afterSha256===R47_CMD_B_CALENDAR_SAFE.afterSha256&&
  m.sourceSha===R47_CMD_B_CALENDAR_SAFE.sourceSha);
const KEYS=['schema','status','scope','requestId','sourceRepository','sourceSha',
 'sourcePath','targetPath','task','beforeSha256','afterSha256','taskXmlSha256',
 'runCount','allowTaskChanges','allowProviderCalls','allowSqliteWrites',
 'allowD1Writes','allowOtherFileWrites'];
export function validateR47CmdBManifest(m){
 must(m&&typeof m==='object'&&!Array.isArray(m)&&
  Object.keys(m).sort().join('|')===KEYS.slice().sort().join('|'),
  'TASK_CMD_B_MANIFEST_FIELDS_STOP');
 must(m.schema===R47_CMD_B.schema&&m.status==='APPROVED_B'&&
  m.scope===R47_CMD_B.scope&&m.runCount===1&&
  typeof m.requestId==='string'&&
  /^[-a-z0-9]{12,90}$/.test(m.requestId)&&
  /^[a-f0-9]{40}$/.test(m.sourceSha)&&
  m.sourceRepository===R47_CMD_B.sourceRepository&&
  m.sourcePath===R47_CMD_B.sourcePath&&
  fixed(m.targetPath,R47_CMD_B.targetPath)&&
  m.task===R47_CMD_B.task&&
  authorizedR47Transition(m)&&
  sha64(m.taskXmlSha256)&&
  m.taskXmlSha256===R47_CMD_B.historicalTaskXmlSha256,
  'TASK_CMD_B_MANIFEST_SCOPE_STOP');
 for(const key of ['allowTaskChanges','allowProviderCalls','allowSqliteWrites',
  'allowD1Writes','allowOtherFileWrites'])
  must(m[key]===false,'TASK_CMD_B_SIDE_EFFECT_STOP');
 return m;
}
export function verifyR47CmdBPreimage(manifest,actual){
 validateR47CmdBManifest(manifest);
 must(actual&&actual.task===manifest.task&&
  verifiedR47TaskRoute(actual,manifest.targetPath)&&
  fixed(actual.installedFilePath,manifest.targetPath)&&
  actual.taskXmlSha256===manifest.taskXmlSha256&&
  actual.installedSha256===manifest.beforeSha256&&
  actual.taskEnabled===true&&actual.taskRunning===false&&
  actual.sharedWriterLeaseOwned===true&&actual.unrelatedWriteConflict===false&&
  actual.sourceDirtyOnTarget===false,
  'TASK_CMD_B_PREIMAGE_STOP');
 return true;
}
export function verifyR47CmdBCandidate(manifest,bytes){
 validateR47CmdBManifest(manifest);
 must(Buffer.isBuffer(bytes)&&bytes.length>=100&&bytes.length<=1024*1024&&
  sha(bytes)===manifest.afterSha256,'TASK_CMD_B_CANDIDATE_SHA_STOP');
 return true;
}
// Task Scheduler may relaunch the CMD between two enabled-state samples.
// A receiver must prove the Task disabled and naturally drained before CAS.
export function verifyR47CmdBPaused(manifest,actual){
 validateR47CmdBManifest(manifest);
 must(actual&&actual.task===manifest.task&&
  fixed(actual.installedFilePath,manifest.targetPath)&&
  actual.installedSha256===manifest.beforeSha256&&
  actual.taskEnabled===false&&actual.taskRunning===false&&
  actual.taskDefinitionExceptEnabledMatchesOriginal===true&&
  actual.sharedWriterLeaseOwned===true&&
  actual.unrelatedWriteConflict===false,
  'TASK_CMD_B_PAUSED_PREIMAGE_STOP');
 return true;
}
const METHODS=['assertPinnedApproval','acquireSharedWriterLease','readPreimage',
 'fetchCandidateBytes','backupOriginal','pauseExactTask','readPausedState',
 'assertTaskQuiet','journalWriteIntent','replaceExactBytesIfBeforeMatches',
 'readInstalledAfter','restoreExactTask','verifyTaskRestored',
 'releaseSharedWriterLease'];
// The authenticated Windows adapter must implement approved-raw-byte/actor
// admission in assertPinnedApproval. This source module never claims B approval.
export async function applyR47CmdBCas(manifest,io){
 validateR47CmdBManifest(manifest);
 must(io&&METHODS.every(k=>typeof io[k]==='function'),
  'TASK_CMD_B_ADAPTER_NOT_REGISTERED_STOP');
 let leased=false,taskMayBePaused=false,writeIntent=false,recovery=false;
 let status=null;
 try{
  must(await io.assertPinnedApproval(manifest)===true,
   'TASK_CMD_B_APPROVAL_NOT_VERIFIED_STOP');
  await io.acquireSharedWriterLease(manifest.requestId);
  leased=true;
  verifyR47CmdBPreimage(manifest,await io.readPreimage());
  const candidate=await io.fetchCandidateBytes();
  verifyR47CmdBCandidate(manifest,candidate);
  const backup=await io.backupOriginal(manifest);
  must(backup?.sha256===manifest.beforeSha256&&backup?.durable===true,
   'TASK_CMD_B_BACKUP_NOT_VERIFIED_STOP');
  // Mark possible Task state change before invoking the external adapter.
  taskMayBePaused=true;
  await io.pauseExactTask(manifest.task);
  must(await io.assertTaskQuiet(manifest.task)===true,
   'TASK_CMD_B_TASK_NOT_QUIET_STOP');
  verifyR47CmdBPaused(manifest,await io.readPausedState());
  await io.journalWriteIntent(manifest);
  // Even a throwing CAS may have installed bytes. Never automatically retry.
  writeIntent=true;
  await io.replaceExactBytesIfBeforeMatches(manifest,candidate);
  const after=await io.readInstalledAfter();
  must(after?.installedSha256===manifest.afterSha256&&
   fixed(after?.installedFilePath,manifest.targetPath)&&
   after?.taskDefinitionExceptEnabledMatchesOriginal===true,
   'TASK_CMD_B_POSTCHECK_UNVERIFIED_STOP');
  await io.restoreExactTask(manifest.task);
  taskMayBePaused=false;
  must(await io.verifyTaskRestored(manifest)===true,
   'TASK_CMD_B_TASK_RESTORE_READBACK_STOP');
  // Final file readback must follow Task restoration as well.
  const final=await io.readInstalledAfter();
  must(final?.installedSha256===manifest.afterSha256&&
   final?.taskXmlSha256===manifest.taskXmlSha256&&
   final?.taskEnabled===true&&final?.taskDefinitionUnchanged===true,
   'TASK_CMD_B_FINAL_READBACK_STOP');
  writeIntent=false;
  status={status:'PASS',code:'TASK_CMD_B_ONEFILE_CAS_READBACK_VERIFIED',
   requestId:manifest.requestId,providerCalls:0,taskChanges:0,
   d1Writes:0,sqliteWrites:0,filesChanged:1,replay:'FORBIDDEN'};
 }catch(e){
  const code=/^TASK_CMD_B_[A-Z0-9_]+$/.test(e?.code??'')?
   e.code:'TASK_CMD_B_ADAPTER_UNVERIFIED_STOP';
  if(taskMayBePaused&&!writeIntent){
   try{await io.restoreExactTask(manifest.task);
    taskMayBePaused=false;
    must(await io.verifyTaskRestored(manifest)===true,
     'TASK_CMD_B_TASK_RESTORE_READBACK_STOP');
   }catch{recovery=true;}
  }
  recovery||=writeIntent;
  status={status:recovery?'STATE_UNKNOWN':'STOP',code,
   requestId:manifest.requestId,providerCalls:0,taskChanges:0,
   d1Writes:0,sqliteWrites:0,replay:'FORBIDDEN'};
 }finally{
  if(leased){
   try{await io.releaseSharedWriterLease({requestId:manifest.requestId,
    retain:recovery});}
   catch{status={...status,status:'STATE_UNKNOWN',
    code:'TASK_CMD_B_LEASE_RELEASE_UNVERIFIED_STOP'};}
  }
 }
 return status;
}

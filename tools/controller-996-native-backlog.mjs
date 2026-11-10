// #996 fixed-root backlog close component: one conditioned attempt only.
// NO CLI/authority. The signed native C operator must authenticate consent,
// current Writer/protection evidence, claim and exclusive-writer provenance.
// This is NOT an atomic compare-and-swap against a concurrent uncooperative
// writer; absent a proven exclusive maintenance writer it fails before writes.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {RECOVERY_996} from './controller-996-c-transaction.mjs';

const REQUEST=RECOVERY_996.requestId;
const ROOT='E:/ZGmini/automation/pc-maintenance';
const ORIGINAL_SHA='d48698b6bfe152fdcbea5adf582364334dc8633742cce02e6a1299718304a780';
const NOOP=()=>{};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const need=(ok,code)=>{if(!ok)throw Object.assign(Error(code),{code});};
const validTime=v=>typeof v==='string'&&Number.isFinite(Date.parse(v));
const safeDir=p=>{const stat=fs.lstatSync(p);
 need(stat.isDirectory()&&!stat.isSymbolicLink(),'C_BACKLOG_PATH_REDIRECT');};
const readBacklog=(folder,name)=>{
 safeDir(folder);const f=path.join(folder,name),stat=fs.lstatSync(f);
 need(stat.isFile()&&!stat.isSymbolicLink()&&stat.size<=2000000,
  'C_BACKLOG_FILE_UNSAFE');
 return fs.readFileSync(f);
};
function decodeBacklog(bytes,{open}){
 let data;try{data=JSON.parse(bytes);}catch{need(false,'C_BACKLOG_INVALID_JSON');}
 need(data&&typeof data==='object'&&!Array.isArray(data)&&
  data.schema==='ZGMINI_PC_BACKLOG_V1'&&data.requestId===REQUEST&&
  Array.isArray(data.windows)&&data.windows.length===1&&
  validTime(data.windows[0]?.pausedAt)&&
  data.windows[0].pausedAt===data.pausedAt&&
  data.replays&&typeof data.replays==='object'&&!Array.isArray(data.replays)&&
  Object.values(data.replays).every(r=>r&&
   ['DONE','SKIPPED_RESULT_PRESENT'].includes(r.status)),
  'C_BACKLOG_STRUCTURE_MISMATCH');
 if(open)need(data.resumedAt===null&&data.windows[0].resumedAt===null,
  'C_BACKLOG_NOT_OPEN');
 else need(validTime(data.resumedAt)&&data.windows[0].resumedAt===data.resumedAt&&
  Date.parse(data.resumedAt)>=Date.parse(data.pausedAt),'C_BACKLOG_NOT_CLOSED');
 return data;
}

export function create996NativeBacklogGate({root=ROOT,testOnly=false,
 claimStore,workflowGateway,
 proveExclusiveWriter,
 expectedOriginalSha=ORIGINAL_SHA,
 now=()=>new Date().toISOString(),onPreCommit=NOOP}={}){
 if(testOnly)need(process.platform!=='win32'&&path.isAbsolute(root)&&
  path.resolve(root).startsWith(path.resolve(os.tmpdir())+path.sep)&&
  path.basename(root).startsWith('zgmini-996-test-'),
  'C_BACKLOG_TEST_ROOT_REJECTED');
 else need(expectedOriginalSha===ORIGINAL_SHA&&onPreCommit===NOOP&&
  process.platform==='win32'&&
  path.win32.normalize(root).toLowerCase()===
   path.win32.normalize(ROOT).toLowerCase()&&
  !process.env.GITHUB_ACTIONS&&!process.env.RUNNER_NAME,
  'C_ORIGINAL_WINDOWS_PC_REQUIRED');
 need(claimStore&&typeof claimStore.ownClaimReadback==='function'&&
  typeof claimStore.hasMarker==='function'&&
  typeof claimStore.recordOnce==='function'&&workflowGateway&&
  typeof workflowGateway.verifyActiveReadback==='function'&&
  typeof proveExclusiveWriter==='function'&&typeof now==='function'&&
  /^[a-f0-9]{64}$/.test(expectedOriginalSha),
  'C_BACKLOG_PORT_INCOMPLETE');
 const folder=path.join(root,'backlog'),name=REQUEST+'.json';
 return Object.freeze({
  closeOnce(){
   const owner=claimStore.ownClaimReadback();
   need(typeof owner.nonce==='string'&&/^[a-zA-Z0-9-]{1,80}$/.test(owner.nonce),
    'C_BACKLOG_OWNER_NONCE_UNSAFE');
   need(claimStore.hasMarker('WORKFLOW_ENABLE_ATTEMPTED')&&
    !claimStore.hasMarker('BACKLOG_CLOSE_ATTEMPTED'),
    'C_BACKLOG_INTENT_ALREADY_OR_WORKFLOW_NOT_PREPARED');
   // Resolve potential path redirections and stale temporary attempt files
   // before consuming the one-shot attempt marker.
   safeDir(root);safeDir(folder);
   const tempName=`${REQUEST}.c996-${owner.nonce}.tmp`;
   need(!fs.existsSync(path.join(folder,tempName)),
    'C_BACKLOG_TEMP_ALREADY_EXISTS');
   need(workflowGateway.verifyActiveReadback()===true,'C_WORKFLOW_NOT_ACTIVE');
   // This callback must be supplied by the eventual authenticated native
   // adapter, performing its OWN fresh OS/lease/process check. A plain boolean
   // asserted by the manifest is not independent proof.
   need(proveExclusiveWriter({requestId:REQUEST,ownerNonce:owner.nonce})===true,
    'C_BACKLOG_EXCLUSIVE_WRITER_UNVERIFIED');
   const original=readBacklog(folder,name);
   need(sha(original)===expectedOriginalSha,'C_BACKLOG_ORIGINAL_DIGEST_DRIFT');
   const data=decodeBacklog(original,{open:true}),resumeAt=now();
   need(validTime(resumeAt)&&Date.parse(resumeAt)>=Date.parse(data.pausedAt),
    'C_BACKLOG_RESUME_TIME_INVALID');
   const next={...data,resumedAt:resumeAt,
    windows:[{...data.windows[0],resumedAt:resumeAt}]};
   const bytes=Buffer.from(JSON.stringify(next)+'\n');
   const nextSha=sha(bytes);
   // Intent persists before the first write to backlog. An uncertain outcome
   // never gets a second automatic attempt, even if rename never occurred.
   claimStore.recordOnce('BACKLOG_CLOSE_ATTEMPTED',{
    originalSha:expectedOriginalSha,nextSha,resumeAt,ownerNonce:owner.nonce,
    operation:'CLOSE_VERIFIED_ORIGINAL_PAUSE_WINDOW_ONCE'});
   const temp=path.join(folder,tempName);
   const fd=fs.openSync(temp,'wx',0o600);
   try{fs.writeSync(fd,bytes,0,bytes.length);fs.fsyncSync(fd);}
   finally{fs.closeSync(fd);}
   need(readBacklog(folder,tempName).equals(bytes),'C_BACKLOG_TEMP_READBACK_FAILED');
   need(sha(readBacklog(folder,name))===expectedOriginalSha,
    'C_BACKLOG_CHANGED_DURING_PREPARE');
   onPreCommit(); // test seam only; production default is no-op.
   need(sha(readBacklog(folder,name))===expectedOriginalSha,
    'C_BACKLOG_CHANGED_BEFORE_COMMIT');
   need(proveExclusiveWriter({requestId:REQUEST,ownerNonce:owner.nonce})===true,
    'C_BACKLOG_EXCLUSIVE_WRITER_LOST');
   fs.renameSync(temp,path.join(folder,name));
   const actual=readBacklog(folder,name);
   need(sha(actual)===nextSha,'C_BACKLOG_COMMIT_READBACK_FAILED');
   decodeBacklog(actual,{open:false});
   return Object.freeze({originalSha:expectedOriginalSha,nextSha,resumeAt});
  },
  readClosed(expectedNextSha){
   need(typeof expectedNextSha==='string'&&/^[a-f0-9]{64}$/.test(expectedNextSha),
    'C_BACKLOG_NEW_SHA_INVALID');
   claimStore.ownClaimReadback();
   const bytes=readBacklog(folder,name);
   need(sha(bytes)===expectedNextSha,'C_BACKLOG_CLOSED_SHA_DRIFT');
   return decodeBacklog(bytes,{open:false});
  },
 });
}

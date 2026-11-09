#!/usr/bin/env node
// One incident only: reconcile an approved *prepared* Writer B source with a
// disabled Core Task. Never execute original #1063 or change source/config.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {inspectWriterB1063Recovery} from '../controller/writer-b-1063-recovery-readonly.mjs';
import {reconcileWriterB1063,INCIDENT_ID,PREPARED_SHA,FINGERPRINT}
 from './recovery-1063-core.mjs';
import {archiveAndFinalizeExactLock} from './recovery-1063-lock.mjs';
import {verifyRecoveryApproval} from './recovery-1063-approval.mjs';
import {validateRecoveryEvent} from './recovery-1063-admission.mjs';

const ROOT=String.raw`E:\ZGmini`;
const SOURCE=String.raw`E:\ZGmini\projects\zgmini-earnings-history-pc-release`;
const JOURNAL=path.win32.join(ROOT,'data','pc-writer','writer-b-install-once',INCIDENT_ID);
const LOCK=path.win32.join(ROOT,'data','pc-writer','writer-source-install.lock');
const PROVENANCE=path.win32.join(JOURNAL,'provenance.json');
const TASK='ZGMINI-PC-Local-Core';
const sha=b=>createHash('sha256').update(b).digest('hex');
const stop=code=>{throw Object.assign(new Error(code),{code});};
const need=(ok,code)=>{if(!ok)stop(code);};

const exec=(command,args)=>execFileSync(command,args,
 {windowsHide:true,timeout:15000,maxBuffer:262144,encoding:'utf8'}).trim();
const git=args=>exec('git',['-C',SOURCE,...args]);
function fixedRaw(file,maxBytes){
 const stat=fs.lstatSync(file);
 need(stat.isFile()&&!stat.isSymbolicLink()&&stat.size>0&&
  stat.size<=maxBytes,'WRITER_B_1063_FIXED_FILE_UNSAFE');
 const native=fs.realpathSync.native(file).toLowerCase();
 need(native===path.win32.normalize(file).toLowerCase(),
  'WRITER_B_1063_FIXED_FILE_REPARSE');
 return fs.readFileSync(file);
}
export function buildWindowsAdapter({env=process.env}={}){
 need(process.platform==='win32','WRITER_B_1063_WINDOWS_ONLY');
 const event=JSON.parse(fixedRaw(env.GITHUB_EVENT_PATH,131072).toString('utf8'));
 const control=path.join(env.GITHUB_WORKSPACE,'writer-b-control');
 const controlSha=exec('git',['-C',control,'rev-parse','HEAD']);
 verifyRecoveryApproval(control);
 const request=validateRecoveryEvent(event,env,controlSha);
 const runId=env.GITHUB_RUN_ID;
 need(/^\d{1,18}$/.test(runId??''),'WRITER_B_1063_RUN_ID_INVALID');
 const audit=path.join(JOURNAL,'recovery-1063-attempt.jsonl');
 const appendAudit=phase=>{
  const fd=fs.openSync(audit,'a');
  try{fs.writeSync(fd,JSON.stringify({requestId:request.requestId,runId,
   phase,at:new Date().toISOString()})+'\n');fs.fsyncSync(fd);}
  finally{fs.closeSync(fd);}
 };
 return {
  request,
  inspect:()=>inspectWriterB1063Recovery(),
  gitIntegrity:()=>{
   const p=fixedRaw(PROVENANCE,65536);
   need(sha(p)===FINGERPRINT.provenance,
    'WRITER_B_1063_PROVENANCE_BYTES_DRIFT');
   const provenance=JSON.parse(p.toString('utf8'));
   const head=git(['rev-parse','--verify','HEAD']);
   const branch=git(['branch','--show-current']);
   const ref=git(['rev-parse','--verify',`refs/heads/writer-b/${INCIDENT_ID}`]);
   const tree=git(['rev-parse','--verify','HEAD^{tree}']);
   const parents=git(['show','-s','--format=%P','HEAD']).split(/\s+/).filter(Boolean);
   const baseTree=git(['rev-parse','--verify',`${provenance.baseHead}^{tree}`]);
   // A changed tracked file or untracked import may modify runtime semantics;
   // do not enable a paused Task over an unverified working tree.
   const status=git(['status','--porcelain=v1','--untracked-files=all']);
   return {head,branch,ref,tree,provenanceTree:provenance.preparedTreeOid,
    parent:parents[0]??null,singleParent:parents.length===1,
    baseTree,provenanceBaseTree:provenance.baseTreeOid,
    trackedClean:status==='',untrackedClean:status===''};
  },
  reserveOnce:()=>{
   need(fs.lstatSync(JOURNAL).isDirectory()&&
    !fs.lstatSync(JOURNAL).isSymbolicLink(),
    'WRITER_B_1063_JOURNAL_DIR_UNSAFE');
   // This is an incident-specific B lease, independent of Controller #917.
   const fd=fs.openSync(audit,'wx');
   try{fs.writeSync(fd,JSON.stringify({requestId:request.requestId,runId,
    phase:'STARTED',at:new Date().toISOString()})+'\n');fs.fsyncSync(fd);}
   finally{fs.closeSync(fd);}
  },
  enableCore:()=>{
   appendAudit('CORE_ENABLE_INTENT');
   exec('schtasks',['/Change','/TN',TASK,'/Enable']);
   appendAudit('CORE_ENABLE_RETURNED');
  },
  appendPhase:phase=>{
   need(['CORE_RESUMED','FINALIZED'].includes(phase),
    'WRITER_B_1063_PHASE_DENIED');
   // Original #1063 journal is immutable forensic evidence. Keep its exact
   // SHA/entry count; recovery phases go only to this new one-shot audit.
   appendAudit(phase);
  },
  finalizeLock:expected=>{
   archiveAndFinalizeExactLock({lock:LOCK,journal:JOURNAL,expected});
   appendAudit('EXACT_OWNER_LOCK_FINALIZED');
  },
 };
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const adapter=buildWindowsAdapter();
  const result=await reconcileWriterB1063(adapter);
  process.stdout.write(JSON.stringify(result)+'\n');
  if(result.status!=='WRITER_B_1063_CORE_RECOVERED')process.exitCode=1;
 }catch(error){
  const code=/^WRITER_B_1063_[A-Z0-9_]+$/.test(error?.code??'')?
   error.code:'WRITER_B_1063_SETUP_UNKNOWN';
  process.stdout.write(JSON.stringify({status:'WRITER_B_1063_STATE_UNKNOWN',
   code,incidentRequestId:INCIDENT_ID,installationVerified:false})+'\n');
  process.exitCode=1;
 }
}

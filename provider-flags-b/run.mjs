#!/usr/bin/env node
// Fixed, owner-approved B transaction on the Windows Runner; never runs a user command.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {authorize,FILE,FLAGS,sha256} from './contract.mjs';
import {changeProviderFlags} from './patch.mjs';
import {acquireInstallLock,createInstallJournal,releaseInstallClaim}
  from '../r17-writer-b/r17-b-claim.mjs';

const SHARED_LOCK=String.raw`E:\ZGmini\data\pc-writer\writer-source-install.lock`;
const JOURNAL_ROOT=String.raw`E:\ZGmini\data\pc-writer\provider-flags-b-once`;
const RESULT='provider-flags-b-result.json';
const stop=code=>{throw Object.assign(new Error(code),{code});};
const need=(ok,code)=>{if(!ok)stop(code);};
const publicCode=error=>/^PROVIDER_B_[A-Z0-9_]{1,100}$/.test(error?.code??'')?
  error.code:/^R17_B_SHARED_INSTALL_BUSY_NOOP_STOP$/.test(error?.code??'')?
  'PROVIDER_B_SHARED_WRITER_BUSY_STOP':'PROVIDER_B_UNEXPECTED_STOP';

function regular(file,parent,limit=262144){
  const root=fs.realpathSync.native(parent).toLowerCase()+path.sep;
  const stat=fs.lstatSync(file);
  need(stat.isFile()&&!stat.isSymbolicLink()&&stat.size>0&&stat.size<=limit&&
    fs.realpathSync.native(file).toLowerCase().startsWith(root),
    'PROVIDER_B_FILE_SCOPE_STOP');
  return fs.readFileSync(file);
}

function gitBinary(){
  const bin=[String.raw`C:\Program Files\Git\cmd\git.exe`,
    String.raw`C:\Program Files\Git\bin\git.exe`].find(p=>fs.existsSync(p));
  need(bin,'PROVIDER_B_GIT_UNAVAILABLE_STOP');
  return bin;
}
function gitHead(root){
  const r=spawnSync(gitBinary(),['-C',root,'rev-parse','HEAD'],{
    encoding:'utf8',shell:false,windowsHide:true,timeout:15000});
  need(r.status===0&&/^[a-f0-9]{40}$/i.test(r.stdout.trim()),
    'PROVIDER_B_GIT_HEAD_STOP');
  return r.stdout.trim();
}
function gitCommittedManifest(root,relativePath){
  // Git's committed blob has the approval's exact bytes even when a Windows
  // checkout applies core.autocrlf (LF -> CRLF) to the workspace copy.
  const r=spawnSync(gitBinary(),['-C',root,'show','HEAD:'+relativePath],{
    encoding:'buffer',shell:false,windowsHide:true,timeout:15000,maxBuffer:8192});
  need(r.status===0&&Buffer.isBuffer(r.stdout)&&
    r.stdout.length>=200&&r.stdout.length<=4096,
    'PROVIDER_B_GIT_MANIFEST_STOP');
  return r.stdout;
}
function checkoutMatchesBlob(worktree,blob){
  // Only Git checkout's text newline conversion is tolerated, never arbitrary
  // edits to the on-disk manifest. The hash is still checked on the raw blob.
  if(worktree.equals(blob))return true;
  if(blob.includes(13))return false;
  return worktree.equals(Buffer.from(blob.toString('utf8').replace(/\n/g,'\r\n')));
}

export function loadAuthorization({env=process.env,readFile=fs.readFileSync,
  controlRoot,head=gitHead,blob=gitCommittedManifest}={}){
  need(typeof controlRoot==='string'&&controlRoot.length>0,
    'PROVIDER_B_CONTROL_ROOT_STOP');
  const event=JSON.parse(readFile(env.GITHUB_EVENT_PATH,'utf8'));
  const req=JSON.parse(event.issue.body);
  need(/^approvals\/writer-config\/inflation19-flags-[a-z0-9-]{4,70}\.json$/.test(
    req.approvalManifestPath??''),'PROVIDER_B_APPROVAL_PATH_STOP');
  const root=path.join(controlRoot,'approvals','writer-config');
  const manifestPath=path.join(controlRoot,...req.approvalManifestPath.split('/'));
  const workspaceBytes=regular(manifestPath,root,4096);
  need(head(controlRoot)===env.GITHUB_SHA,'PROVIDER_B_CONTROL_SHA_STOP');
  const raw=blob(controlRoot,req.approvalManifestPath);
  need(Buffer.isBuffer(raw)&&checkoutMatchesBlob(workspaceBytes,raw),
    'PROVIDER_B_MANIFEST_WORKTREE_DRIFT_STOP');
  return authorize({event,env,manifestBytes:raw});
}

export function flushCopiedBackup(file,{open=fs.openSync,flush=fs.fsyncSync,
  close=fs.closeSync}={}){
  // On Windows FlushFileBuffers requires GENERIC_WRITE; opening the copy with
  // 'r' worked on POSIX but fails on the real Windows Runner.
  const fd=open(file,'r+');
  try{flush(fd);}finally{close(fd);}
}
function writeOriginalBackup(bytes,source,requestId,setStage=()=>{}){
  // A child journal directory can inherit a *different* ACL. Keep the durable
  // backup in the original directory so the exact file security is inherited
  // from the same parent, while retaining the source file's copied ACL.
  const dest=source+'.provider-b-'+requestId+'.original.bin';
  setStage('BACKUP_COPY');
  copyPreservingSecurity(source,dest);
  setStage('BACKUP_SYNC');
  flushCopiedBackup(dest);
  setStage('BACKUP_READBACK');
  need(fs.readFileSync(dest).equals(bytes),'PROVIDER_B_BACKUP_READBACK_STOP');
}
export function normalizeAclEvidence(stdout,file){
  need(typeof stdout==='string'&&stdout.startsWith(file),
    'PROVIDER_B_ACL_QUERY_STOP');
  // `icacls` indents continuation lines to the *filename length*. Comparing
  // its raw output rejects identical ACLs for different basename lengths.
  const body=stdout.slice(file.length).split(/\r?\n/)
    .map(line=>line.trim()).filter(Boolean).join('\n');
  need(body.length>0,'PROVIDER_B_ACL_EMPTY_STOP');
  return body;
}
function aclEvidence(file){
  if(process.platform!=='win32')return null;
  const exe=path.join(process.env.SystemRoot??String.raw`C:\Windows`,
    'System32','icacls.exe');
  need(fs.existsSync(exe),'PROVIDER_B_ACL_TOOL_STOP');
  const result=spawnSync(exe,[file],{encoding:'utf8',shell:false,
    windowsHide:true,timeout:15000,maxBuffer:128000});
  need(result.status===0&&!result.error&&typeof result.stdout==='string'&&
    result.stdout.startsWith(file),'PROVIDER_B_ACL_QUERY_STOP');
  // Never publish names/SIDs. Compare file-relative read-only ACL evidence.
  return normalizeAclEvidence(result.stdout,file);
}
function copyPreservingSecurity(source,dest){
  // Windows CopyFile preserves original security attributes; unlike creating
  // a new temp inode with inherited parent-only ACLs.
  fs.copyFileSync(source,dest,fs.constants.COPYFILE_EXCL);
  need(fs.lstatSync(dest).isFile()&&!fs.lstatSync(dest).isSymbolicLink(),
    'PROVIDER_B_COPY_SCOPE_STOP');
  if(process.platform==='win32')
    need(aclEvidence(source)===aclEvidence(dest),
      'PROVIDER_B_ACL_PRESERVATION_STOP');
}
function atomicReplace(target,bytes,suffix){
  const tmp=target+'.provider-b-'+suffix+'.tmp';
  need(!fs.existsSync(tmp),'PROVIDER_B_TEMP_COLLISION_STOP');
  try{
    copyPreservingSecurity(target,tmp);
    const fd=fs.openSync(tmp,'r+');
    try{
      fs.writeSync(fd,bytes,0,bytes.length,0);
      fs.ftruncateSync(fd,bytes.length);
      fs.fsyncSync(fd);
    }finally{fs.closeSync(fd);}
    need(aclEvidence(target)===aclEvidence(tmp),
      'PROVIDER_B_ACL_PRESERVATION_STOP');
    fs.renameSync(tmp,target);
  }finally{
    // Only the exact temporary leaf may be cleaned; the original backup stays.
    if(fs.existsSync(tmp))try{fs.unlinkSync(tmp);}catch{}
  }
}

export function applyApprovedFlags(auth,{target=FILE,journalRoot=JOURNAL_ROOT,
  sharedLock=SHARED_LOCK,beforeSwitch=()=>{},afterSwitch=()=>{}}={}){
  const requestId=auth.request.requestId;
  let lock=null,claimed=false,retain=false,original=null,proposed=null,
    wrote=false,result=null,stage='LOCK';
  const journal=phase=>{
    if(!claimed)return;
    const file=path.join(journalRoot,requestId,'journal.jsonl');
    const fd=fs.openSync(file,'a');
    try{fs.writeSync(fd,JSON.stringify({phase,at:new Date().toISOString()})+'\n');
      fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
  };
  try{
    // Same shared Writer resource lock as source-overlay B; no task stop.
    lock=acquireInstallLock({journalRoot,requestId,sharedLock});
    stage='ORIGINAL_READ';
    original=regular(target,path.dirname(target));
    stage='PATCH';
    proposed=changeProviderFlags(original);
    stage='JOURNAL_CREATE';
    createInstallJournal({journalRoot,requestId,sharedLock,fd:lock.fd});
    claimed=true;
    writeOriginalBackup(original,target,requestId,x=>{stage=x;});
    stage='JOURNAL_BACKED_UP';
    journal('BACKED_UP');
    // Direct CAS immediately before atomic switch. Other software not honoring
    // the shared writer lock may cause a safe STOP instead of overwrite.
    stage='FINAL_CAS';
    beforeSwitch();
    need(regular(target,path.dirname(target)).equals(original),
      'PROVIDER_B_CONCURRENT_FILE_DRIFT_STOP');
    if(proposed.changed){
      // Mark intent before the possible atomic switch for safe rollback.
      wrote=true;
      stage='ATOMIC_SWITCH';
      atomicReplace(target,proposed.bytes,requestId);
      stage='JOURNAL_SWITCH';
      journal('SWITCHED');
      stage='AFTER_SWITCH';
      afterSwitch();
    }
    stage='RESULT_READBACK';
    need(regular(target,path.dirname(target)).equals(proposed.bytes),
      'PROVIDER_B_READBACK_STOP');
    need(changeProviderFlags(proposed.bytes).changed===false,
      'PROVIDER_B_IDEMPOTENCE_STOP');
    stage='JOURNAL_VERIFIED';
    journal('VERIFIED');
    result={status:'PROVIDER_B_APPLIED_VERIFIED',requestId,
      code:proposed.changed?'PROVIDER_B_TWO_FLAGS_SET':'PROVIDER_B_ALREADY_SET',
      changedKeys:[...FLAGS],manifestSha256:auth.request.approvalManifestSha256,
      controlSha:auth.controlSha,beforeSha256:proposed.beforeSha256,
      afterSha256:proposed.afterSha256,backupVerified:true};
  }catch(error){
    const genericCode=publicCode(error);
    const code=genericCode==='PROVIDER_B_UNEXPECTED_STOP'?
      `PROVIDER_B_${stage}_SYSTEM_STOP`:genericCode;
    if(!claimed){result={status:'PROVIDER_B_PREFLIGHT_STOP',code,requestId};}
    else{
      try{
        const current=regular(target,path.dirname(target));
        if(!wrote&&!current.equals(original)){
          // No operational write was attempted: external drift is an ordinary
          // consumed NO-WRITE STOP, not a lock-retaining recovery incident.
          journal('STOP_EXTERNAL_DRIFT_UNTOUCHED');
          result={status:'PROVIDER_B_STOP_UNTOUCHED',code,requestId,
            recovery:'NO_OPERATIONAL_WRITE'};
        }else{
        if(wrote&&!current.equals(original)){
          need(proposed&&current.equals(proposed.bytes),
            'PROVIDER_B_ROLLBACK_CONCURRENT_DRIFT_STOP');
          atomicReplace(target,original,requestId+'-rollback');
          journal('ROLLED_BACK');
        }
        need(regular(target,path.dirname(target)).equals(original),
          'PROVIDER_B_ORIGINAL_VERIFY_STOP');
        journal('STOP_RESTORED');
        result={status:'PROVIDER_B_STOP_RESTORED',code,requestId,
          recovery:'ORIGINAL_VERIFIED'};
        }
      }catch{
        retain=true;
        try{journal('RECOVERY_REQUIRED');}catch{}
        result={status:'PROVIDER_B_RECOVERY_REQUIRED',code,requestId,
          recovery:'READ_ONLY_RECONCILE_NO_REEXECUTE'};
      }
    }
  }finally{
    if(lock){
      try{
        journal(retain?'LOCK_RETAINED':'FINALIZED');
        releaseInstallClaim({fd:lock.fd,sharedLock,requestId,retain});
      }catch{
        result={status:'PROVIDER_B_RECOVERY_REQUIRED',
          code:'PROVIDER_B_LOCK_FINALIZE_STOP',requestId,
          recovery:'READ_ONLY_RECONCILE_NO_REEXECUTE'};
      }
    }
  }
  return result;
}

async function main(){
  need(process.platform==='win32','PROVIDER_B_WINDOWS_HOST_STOP');
  const env=process.env,root=path.join(env.GITHUB_WORKSPACE??'', 'provider-b-control');
  const auth=loadAuthorization({env,controlRoot:root});
  return applyApprovedFlags(auth);
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  let result;
  try{result=await main();}
  catch(error){result={status:'PROVIDER_B_SETUP_STOP',code:publicCode(error),
    requestId:null};}
  const temp=process.env.RUNNER_TEMP;
  try{
    need(typeof temp==='string'&&path.isAbsolute(temp),'PROVIDER_B_TEMP_DIR_STOP');
    fs.writeFileSync(path.join(temp,RESULT),JSON.stringify(result)+'\n',{flag:'wx'});
  }catch{process.exitCode=1;}
  // No exception text, raw environment, target data or secrets on stdout.
  process.stdout.write(result.status+' '+result.code+'\n');
  if(result.status!=='PROVIDER_B_APPLIED_VERIFIED')process.exitCode=1;
}

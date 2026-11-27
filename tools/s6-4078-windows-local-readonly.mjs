// Source-only #4078 local S6 bytes adapter.
// The already-installed S6 journal lives under the maintenance ledger, NOT
// the generic controller-update request ledger. No write or POST primitives.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {FIXED} from './s6-4078-backlog-only-plan.mjs';

const sha=b=>createHash('sha256').update(b).digest('hex');
const REFUSED=code=>({status:'STATE_UNKNOWN',code,operationalWrites:0,
 mutationAuthorized:false,localReadback:null});
const ROOT='E:/ZGmini/automation/pc-maintenance';
const APPROVAL_SHA='1fceeba061f7f8731811220b27cac245bd91d44e87d68935cd8475117f094141';

export function readS64078LocalBytes({
 io=fs,maintenanceRoot=ROOT,sourceRoot='E:/ZGmini/projects/zgmini-pc-control',
 controllerRoot='E:/ZGmini/automation/pc-control',
 windowsPlatform=process.platform
}={}){
 if(windowsPlatform!=='win32')return REFUSED('S6_WINDOWS_OPERATOR_REQUIRED');
 if(typeof maintenanceRoot!=='string'||typeof sourceRoot!=='string'||
   typeof controllerRoot!=='string')return REFUSED('S6_ROOT_INVALID');
 const record=path.join(maintenanceRoot,'ledger','S6_ONCE_'+FIXED.s6RequestId);
 const safeFile=(p,max=262144)=>{
  const st=io.lstatSync(p);
  if(!st.isFile()||st.isSymbolicLink()||st.nlink!==1||
     st.size<1||st.size>max)throw Error('S6_LOCAL_FILE_UNSAFE');
  const bytes=io.readFileSync(p);
  if(!Buffer.isBuffer(bytes)||bytes.length!==st.size)
   throw Error('S6_LOCAL_BYTES_UNVERIFIED');
  return bytes;
 };
 const safeDir=p=>{
  const st=io.lstatSync(p);
  if(!st.isDirectory()||st.isSymbolicLink())throw Error('S6_LOCAL_DIRECTORY_UNSAFE');
 };
 try{
  for(const dir of [
   maintenanceRoot,path.join(maintenanceRoot,'ledger'),record
  ])safeDir(dir);
  const claim=safeFile(path.join(record,'claim.json'),32768);
  const claimBody=JSON.parse(claim.toString('utf8'));
  if(claimBody.schema!=='ZGMINI_S6_CLAIM_V1'||
     claimBody.requestId!==FIXED.s6RequestId||
     !/^[a-f0-9-]{36}$/.test(claimBody.nonce??''))
   return REFUSED('S6_ORIGINAL_CLAIM_UNVERIFIED');
  const approval=safeFile(path.join(sourceRoot,'approvals','controller-s6',APPROVAL_SHA+'.json'),32768);
  // Existing S6 operator's pinned approval permits only CRLF -> LF
  // canonicalization when *exactly* the reviewed raw hash is recovered.
  // The source copy remains unchanged and is re-read byte-for-byte below.
  let canonicalApproval=approval;
  if(sha(canonicalApproval)!==APPROVAL_SHA){
   const text=approval.toString('utf8');
   if(!text.includes('\r\n')||text.replace(/\r\n/g,'').includes('\r'))
    return REFUSED('S6_APPROVAL_SOURCE_CAS_DRIFT');
   canonicalApproval=Buffer.from(text.replace(/\r\n/g,'\n'),'utf8');
   if(sha(canonicalApproval)!==APPROVAL_SHA)
    return REFUSED('S6_APPROVAL_SOURCE_CAS_DRIFT');
  }
  const approvalBody=JSON.parse(canonicalApproval.toString('utf8'));
  if(approvalBody.schema!=='ZGMINI_PC_S6_ONCE_B_APPROVAL_V1'||
    approvalBody.requestId!==FIXED.s6RequestId||
    approvalBody.approval?.approved!==true||
    !/^[a-f0-9]{64}$/.test(approvalBody.ownerSha256??''))
   return REFUSED('S6_APPROVAL_SCOPE_INVALID');
  const owner=safeFile(path.join(controllerRoot,'leases','supervisor','owner.json'),32768);
  const readPair=basename=>{
   const p=path.join(record,basename);
   const a=safeFile(p),b=safeFile(p);
   if(!a.equals(b))throw Error('S6_LOCAL_DOUBLE_READ_CHANGED');
   return a;
  };
  const journal=readPair('journal.json'),backlog=readPair('backlog.json');
  // Cross-file snapshot fence: double-reads of each individual file are
  // insufficient if journal changes while the backlog is being sampled.
  // Re-read both after sampling *both* source files. Source-only; no locks.
  if(!safeFile(path.join(record,'journal.json')).equals(journal)||
     !safeFile(path.join(record,'backlog.json')).equals(backlog))
   return REFUSED('S6_LOCAL_CROSS_FILE_SNAPSHOT_CHANGED');
  // Recheck original claim and approval after the two local source reads.
  if(!safeFile(path.join(record,'claim.json'),32768).equals(claim)||
    !safeFile(path.join(sourceRoot,'approvals','controller-s6',APPROVAL_SHA+'.json'),32768).equals(approval)||
    !safeFile(path.join(controllerRoot,'leases','supervisor','owner.json'),32768).equals(owner))
   return REFUSED('S6_LOCAL_OWNER_OR_APPROVAL_CHANGED');
  return {
   status:'READ_ONLY_OBSERVED',code:'S6_4078_LOCAL_BYTES_SAMPLED',
   claimSha256:sha(claim),approvalSha256:sha(canonicalApproval),
   supervisorOwnerSha256:sha(owner),
   originalOwnerSha256:approvalBody.ownerSha256,
   originalOwnerMatchesCurrent:sha(owner)===approvalBody.ownerSha256,
   localReadback:{
    journalBefore:journal.toString('utf8'),
    journalAfter:journal.toString('utf8'),
    journalSha256:sha(journal),
    backlogBefore:backlog.toString('utf8'),
    backlogAfter:backlog.toString('utf8'),
    backlogSha256:sha(backlog)
   },
   ownerAndLeaseCasVerified:false, // Original S6 claim is NOT recovery authority.
   mutationAuthorized:false,operationalWrites:0
  };
 }catch{return REFUSED('S6_4078_LOCAL_SOURCE_OR_CAS_UNVERIFIED');}
}

// #3516 historical installed-state recovery: fixed read-only archive receipt.
// The exact V1 approval bytes are pinned; a cloned or altered manifest cannot promote recovery.
// This only projects non-secret status and hashes; no lease or recovery mutation.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {readFixedReadonlyBytes} from '../controller/fixed-readonly-bytes.mjs';

export const FIXED=Object.freeze({
 requestId:'pc-update-c087fa10-88e2-42e3-bc60-c758ab93f0c1',
 sourceSha:'ec9009be720f3da33c3300a81aaf54be1e18c683',
 controllerSha:'83679b013ac9a9820331d93311ec97e572b18e13',
 maintenance:'E:/ZGmini/automation/pc-maintenance',
 approval:'approvals/maintenance-recoveries/pc-update-c087fa10-88e2-42e3-bc60-c758ab93f0c1.installed.json',
 approvalSha256:'fd15a911666efe560fcba984b9bff60fdffe83bd27682ddbeb2bfc3142197d4b'
});
const HASH=/^[a-f0-9]{64}$/;
const sha=b=>createHash('sha256').update(b).digest('hex');
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const unknown=code=>({status:'STATE_UNKNOWN',code,originalLeaseArchived:null,
 archiveRecordVerified:false,completeRecordSha256:null,
 historicalPostcheck:null,operationalWrites:0,providerCalls:0,d1Writes:0});
const pending=()=>({...unknown('W04_3516_ORIGINAL_LEASE_STILL_HELD'),
 status:'NOT_ARCHIVED',originalLeaseArchived:false});
const isDate=v=>typeof v==='string'&&Number.isFinite(Date.parse(v));
const isObject=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);

/** Deterministic projection: never return raw approved paths, nonces or bytes. */
export function project3516ArchivedReceipt({approval,completed,completeBytes,ownerBytes,markerBytes}={}){
 const bad=()=>unknown('W04_3516_ARCHIVE_RECEIPT_UNVERIFIED');
 if(!isObject(approval)||approval.schema!=='ZGMINI_PC_INSTALLED_RECOVERY_APPROVAL_V1'||
  approval.approved!==true||approval.operation!=='RECONCILE_INSTALLED'||
  approval.requestId!==FIXED.requestId||approval.issueNumber!==3516||
  approval.sourceSha!==FIXED.sourceSha||approval.targetControllerSha!==FIXED.controllerSha)
  return bad();
 const a=approval.casDigests;
 if(!isObject(a)||Object.keys(a).length!==7||!['ledgerSha256','ownerSha256',
  'markerSha256','backlogSha256','snapshotSha256','protectionSha256','writerSha256']
  .every(k=>HASH.test(a[k]??'')))return bad();
 if(!isObject(completed)||
  completed.schema!=='ZGMINI_PC_INSTALLED_RECOVERY_RESULT_V1'||
  completed.status!=='RECOVERED_INSTALLED_STATE'||
  completed.code!=='INSTALLED_RUNTIME_RECOVERED_HISTORIC_POSTCHECK_UNKNOWN'||
  completed.requestId!==FIXED.requestId||completed.sourceSha!==FIXED.sourceSha||
  completed.installedSha!==FIXED.controllerSha||
  completed.historicalPostcheck!=='OUTCOME_UNKNOWN'||
  completed.historicalLedgerPreserved!==true||completed.originalRequestRetried!==false||
  completed.leaseArchived!==true||completed.controllerChanged!==false||
  completed.writerChanged!==false||completed.workflowChanged!==false||
  completed.dbD1Writes!==0||!isDate(completed.archivedAt)||
  !isObject(completed.casDigests)||Object.keys(completed.casDigests).length!==7||
  Object.keys(a).some(k=>completed.casDigests[k]!==a[k]))return bad();
 if(!Buffer.isBuffer(completeBytes)||completeBytes.length<20||completeBytes.length>32768||
  !Buffer.isBuffer(ownerBytes)||!Buffer.isBuffer(markerBytes)||
  sha(ownerBytes)!==a.ownerSha256||sha(markerBytes)!==a.markerSha256)return bad();
 try{
  if(JSON.stringify(JSON.parse(completeBytes.toString('utf8')))!==JSON.stringify(completed))
   return bad();
 }catch{return bad();}
 return {status:'ARCHIVE_VERIFIED',code:'W04_3516_ARCHIVED_RECEIPT_VERIFIED',
  originalLeaseArchived:true,archiveRecordVerified:true,
  completeRecordSha256:sha(completeBytes),historicalPostcheck:'OUTCOME_UNKNOWN',
  controllerSha:FIXED.controllerSha,approvedCasCount:7,
  operationalWrites:0,providerCalls:0,d1Writes:0};
}

/** 
 * Reuse the installed A-grade process-inventory result uploader. The fixed
 * archive is read only after the original lease is absent; the original B
 * operation and all other recovery archives remain untouched.
 */
export function inspect3516ArchivedReceiptReadonly({
 fileSystem=fs,read=readFixedReadonlyBytes,approvalRoot=root
}={}){
 try{
  const maintained=FIXED.maintenance;
  const originalLease=path.join(maintained,'leases/controller-install');
  const claim=path.join(maintained,'leases/controller-recovery');
  if(fileSystem.existsSync(originalLease))return pending();
  if(fileSystem.existsSync(claim))return unknown('W04_3516_RECOVERY_CLAIM_STILL_PRESENT');
  const dir=path.join(maintained,'recovery');
  const directory=fileSystem.lstatSync(dir);
  if(!directory.isDirectory()||directory.isSymbolicLink())
   return unknown('W04_3516_RECOVERY_DIRECTORY_UNSAFE');
  const names=fileSystem.readdirSync(dir);
  if(!Array.isArray(names)||names.length>10000)
   return unknown('W04_3516_RECOVERY_INVENTORY_UNVERIFIED');
  const exp=new RegExp('^'+FIXED.requestId+
   '-installed-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\\.complete\\.json$');
  const records=names.filter(n=>exp.test(n));
  if(records.length===0)return unknown('W04_3516_COMPLETE_RECEIPT_ABSENT');
  if(records.length!==1)return unknown('W04_3516_COMPLETE_RECEIPT_AMBIGUOUS');
  const basename=records[0].slice(0,-'.complete.json'.length);
  const archived=path.join(dir,basename+'.lease');
  const archiveDir=fileSystem.lstatSync(archived);
  if(!archiveDir.isDirectory()||archiveDir.isSymbolicLink())
   return unknown('W04_3516_ARCHIVED_LEASE_UNSAFE');
  const get=(file,verifiedRoot,maxBytes)=>{
   const r=read(file,{verifiedRoot,minBytes:1,maxBytes});
   if(r?.ok!==true||!Buffer.isBuffer(r.bytes))throw Error('UNVERIFIED_BYTES');
   return r.bytes;
  };
  const approvalBytes=get(path.join(approvalRoot,FIXED.approval),approvalRoot,32768);
  if(sha(approvalBytes)!==FIXED.approvalSha256)
   return unknown('W04_3516_APPROVAL_RAW_MISMATCH');
  const complete=get(path.join(dir,records[0]),maintained,32768);
  const owner=get(path.join(archived,'owner.json'),maintained,4096);
  const marker=get(path.join(archived,'RECOVERY_REQUIRED.json'),maintained,4096);
  const approved=JSON.parse(approvalBytes.toString('utf8'));
  const result=JSON.parse(complete.toString('utf8'));
  const observation=project3516ArchivedReceipt({
   approval:approved,completed:result,completeBytes:complete,
   ownerBytes:owner,markerBytes:marker
  });
  // The complete receipt is historical evidence, not proof of current
  // protected bytes, current Supervisor, or of the original postcheck.
  if(fileSystem.existsSync(originalLease)||fileSystem.existsSync(claim))
   return unknown('W04_3516_LEASE_STATE_CHANGED_DURING_READ');
  return observation;
 }catch{return unknown('W04_3516_ARCHIVE_READBACK_UNAVAILABLE');}
}

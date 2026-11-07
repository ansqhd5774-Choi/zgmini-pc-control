// Source-only candidate for the EXISTING independent `tools/update.mjs`.
// No CLI entrypoint, no default I/O and NO new installed B permission.
// All real B effects remain in the separately approved common B receiver.
import path from 'node:path';
import {createHash} from 'node:crypto';
import {isWriterBRequestId} from './writer-b-request-id.mjs';
import {GENERIC_B_OPERATION,GENERIC_B_TITLE,GENERIC_B_CONTROL_REPO}
 from './approved-generic-b-route.mjs';

export const STATUS='approved-runtime-b-status';
export const APPLY='approved-runtime-b-apply';
const SHA40=/^[a-f0-9]{40}$/;
const SHA64=/^[a-f0-9]{64}$/;
const sha=b=>createHash('sha256').update(b).digest('hex');
const stop=code=>{const e=Error(code);e.code=code;throw e;};
const need=(x,code)=>{if(!x)stop(code);};
const exact=(o,keys)=>o!==null&&typeof o==='object'&&!Array.isArray(o)&&
 Object.keys(o).sort().join('|')===[...keys].sort().join('|');
const safeCode=x=>typeof x==='string'&&/^B_[A-Z0-9_]{1,100}$/.test(x)?x:
 'B_UPDATE_UNKNOWN';

function parseArgs(args){
 need(Array.isArray(args)&&[STATUS,APPLY].includes(args[0])&&
  ((args[0]===STATUS&&args.length===3)||
   (args[0]===APPLY&&args.length===5&&args[3]==='--manifest-file'))&&
  args[1]==='--request-id'&&isWriterBRequestId(args[2]),
  'B_UPDATE_ARGS');
 return {command:args[0],requestId:args[2],manifestFile:args[4]??null};
}

function verifyFixedInstalled(install){
 need(install?.status==='INSTALLED_APPROVED_B_RECEIVER'&&
  install.operation===GENERIC_B_OPERATION&&
  SHA40.test(install.installedReceiverSha)&&SHA40.test(install.controlCommitSha)&&
  install.privateRepositoryVerified===true&&
  install.platform==='win32'&&install.originVerified===true&&
  typeof install.maintenanceRoot==='string'&&
  path.win32.isAbsolute(install.maintenanceRoot)&&
  typeof install.dataRoot==='string'&&path.win32.isAbsolute(install.dataRoot)&&
  install.fixedPathsVerified===true&&install.installedManifestShaVerified===true,
  'B_UPDATE_INSTALLED_RECEIVER_UNVERIFIED');
 const base=path.win32.join(install.dataRoot,'pc-writer');
 need(path.win32.normalize(install.approvedRegistryFile??'').toLowerCase()===
   path.win32.join(base,'approved-runtime-inventory-profiles.json').toLowerCase()&&
  path.win32.normalize(install.sharedWriterLock??'').toLowerCase()===
   path.win32.join(base,'writer-source-install.lock').toLowerCase(),
  'B_UPDATE_FIXED_EFFECT_PATH_DRIFT');
 return install;
}

function classify(probe,requestId){
 need(probe?.requestId===requestId&&
  (probe.ledger===null||typeof probe.ledger==='object')&&
  probe.sharedWriterLock&&typeof probe.sharedWriterLock.held==='boolean'&&
  probe.sourceShaVerified===true,
  'B_UPDATE_STATUS_UNKNOWN');
 return probe;
}

/**
 * All dependencies are explicitly injected by an already installed,
 * owner-approved, hash-pinned independent maintenance receiver. This is not
 * an authorization factory: the main receiver MUST implement each proof and
 * install its source bytes before it can be called.
 */
export function makeApprovedRuntimeBUpdater({
 installedStatus,readRecoveryStatus,readApprovedPackage,verifyLiveOwnerIssue,
 executeApprovedRoute,persistAndReadBackResult,
}={}){
 const deps={installedStatus,readRecoveryStatus,readApprovedPackage,
  verifyLiveOwnerIssue,executeApprovedRoute,persistAndReadBackResult};
 need(Object.values(deps).every(fn=>typeof fn==='function'),
  'B_UPDATE_RECEIVER_HOOK_UNINSTALLED');
 return Object.freeze({
  async command(args){
   const {command,requestId,manifestFile}=parseArgs(args);
   const install=verifyFixedInstalled(await installedStatus());
   // Read-only status must be usable to reconcile a prior uncertain attempt
   // even when Issue approval has since been closed or changed.
   const before=classify(await readRecoveryStatus({requestId,install}),requestId);
   if(command===STATUS)return {
    requestId,status:before.ledger?.status??(before.sharedWriterLock.held?
     'UNKNOWN':'NOT_CLAIMED'),
    ledger:before.ledger,installLock:before.sharedWriterLock,
    actualReceiverSha:install.installedReceiverSha};
   const expectedPackage=path.win32.join(install.maintenanceRoot,'approved',
    requestId+'.json');
   need(typeof manifestFile==='string'&&path.win32.isAbsolute(manifestFile)&&
    path.win32.normalize(manifestFile).toLowerCase()===
     path.win32.normalize(expectedPackage).toLowerCase(),
    'B_UPDATE_APPROVAL_PATH_DRIFT');
   need(before.ledger===null&&!before.sharedWriterLock.held,
    'B_UPDATE_PRIOR_OUTCOME_RECONCILE');
   const packageData=await readApprovedPackage({path:expectedPackage,
    requestId,installedReceiverSha:install.installedReceiverSha});
   need(exact(packageData,['issue','actor','issueNumber','manifest','manifestRawBase64'])&&
    packageData.actor==='ansqhd5774-Choi'&&
    Number.isSafeInteger(packageData.issueNumber)&&packageData.issueNumber>0&&
    packageData.issue?.schema==='ZGMINI_PC_APPROVED_RUNTIME_B_ISSUE_V1'&&
    packageData.issue?.requestId===requestId&&
    packageData.issue?.operation===GENERIC_B_OPERATION&&
    packageData.issue?.controlRepository===GENERIC_B_CONTROL_REPO&&
    packageData.issue?.expectedInstalledReceiverSha===install.installedReceiverSha&&
    SHA64.test(packageData.issue?.approvalManifestSha256)&&
    typeof packageData.manifestRawBase64==='string'&&
    packageData.manifestRawBase64.length<=350000,
    'B_UPDATE_PACKAGE_IDENTITY');
   let raw;
   try{raw=Buffer.from(packageData.manifestRawBase64,'base64');}
   catch{stop('B_UPDATE_PACKAGE_BASE64');}
   need(raw.length>0&&raw.length<=262144&&
    raw.toString('base64')===packageData.manifestRawBase64&&
    sha(raw)===packageData.issue.approvalManifestSha256,
    'B_UPDATE_PACKAGE_RAW_SHA_DRIFT');
   let parsedManifest;
   try{parsedManifest=JSON.parse(raw.toString('utf8'));}
   catch{stop('B_UPDATE_PACKAGE_JSON');}
   need(JSON.stringify(parsedManifest)===JSON.stringify(packageData.manifest),
    'B_UPDATE_PACKAGE_MANIFEST_DRIFT');
   const owner=await verifyLiveOwnerIssue({issueNumber:packageData.issueNumber,
    expectedIssue:packageData.issue,controlCommitSha:install.controlCommitSha,
    expectedApprovalSha256:sha(raw)});
   need(owner?.verified===true&&owner?.issue?.number===packageData.issueNumber&&
    owner.issue?.title===GENERIC_B_TITLE&&
    owner.issue?.state==='OPEN'&&
    owner.issue?.author?.login==='ansqhd5774-Choi'&&
    owner.privateRepositoryVerified===true&&
    owner.controlCommitSha===install.controlCommitSha&&
    owner.manifestSha256===sha(raw),
    'B_UPDATE_OWNER_PROVENANCE_UNVERIFIED');
   let liveRequest;
   try{liveRequest=JSON.parse(owner.issue.body);}catch{
    stop('B_UPDATE_LIVE_ISSUE_BODY_INVALID');
   }
   need(JSON.stringify(liveRequest)===JSON.stringify(packageData.issue)&&
    owner.issue.labels?.some(x=>x?.name==='pc-maintenance')&&
    owner.issue.labels?.some(x=>x?.name==='pc-approved-runtime-b'),
    'B_UPDATE_LIVE_ISSUE_IDENTITY_DRIFT');
   // Repeat status inspection: no stale read-only preflight can initiate an
   // operation after a different Writer B request claimed the shared lock.
   const still=classify(await readRecoveryStatus({requestId,install}),requestId);
   need(still.ledger===null&&!still.sharedWriterLock.held,
    'B_UPDATE_CLAIM_RACE');
   let outcome;
   try{
    outcome=await executeApprovedRoute({issue:owner.issue,requestId,
     installedReceiverSha:install.installedReceiverSha,
     rawApprovalSha256:sha(raw),controlCommitSha:install.controlCommitSha});
   }catch(error){
    // A thrown apply can be a partial mutation. Do not retry or label it
    // read-only BLOCKED based on an exception string.
    const uncertain=classify(await readRecoveryStatus({requestId,install}),requestId);
    return {requestId,status:'UNKNOWN',code:'B_UPDATE_APPLY_OUTCOME_UNKNOWN',
     firstFail:safeCode(error?.code),recovery:
      uncertain.ledger??uncertain.sharedWriterLock};
   }
   need(outcome&&['PASS','BLOCKED','STATE_UNKNOWN'].includes(outcome.status),
    'B_UPDATE_OUTCOME_UNVERIFIED');
   const operationSucceeded=outcome.status==='PASS';
   const evidenceComplete=outcome.reportStatus==='JSON_TXT_2_OF_2';
   const result={requestId,status:outcome.status==='STATE_UNKNOWN'?'UNKNOWN':
    operationSucceeded?'SUCCEEDED':'BLOCKED',
    code:operationSucceeded?(evidenceComplete?'B_UPDATE_APPLIED_VERIFIED':
     'B_UPDATE_APPLIED_EVIDENCE_INCOMPLETE'):
     safeCode(outcome.code),
    retainLockForRecovery:outcome.retainLockForRecovery===true,
    operationSucceeded,evidenceComplete,sourceSha:outcome.sourceSha??null};
   let ledger;
   try{
    ledger=await persistAndReadBackResult({requestId,issueNumber:owner.issue.number,
     result,installedReceiverSha:install.installedReceiverSha});
    need(ledger?.readbackVerified===true&&ledger?.requestId===requestId&&
     ledger?.result?.status===result.status&&ledger.result?.code===result.code,
     'B_UPDATE_LEDGER_READBACK_UNKNOWN');
   }catch{
    // A PC CAS may have succeeded even if ledger durability/readback did
    // not. Surface the split explicitly; no automatic application retry.
    return {...result,status:'UNKNOWN',code:'B_UPDATE_LEDGER_READBACK_UNKNOWN',
     ledgerVerified:false,endToEndDone:false};
   }
   return {...result,ledgerVerified:true,
    endToEndDone:operationSucceeded&&evidenceComplete};
  },
 });
}

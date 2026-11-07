// The maintenance-agent side of the one generic B vertical path.
// Source-only import, NO live CLI/GitHub/PC entrypoint. It never runs B
// effects directly; only an installed fixed update.mjs command may do that.
import path from 'node:path';
import {createHash} from 'node:crypto';
import {authenticateApprovedGenericBIssue,
 approvalPathFromDigest,GENERIC_B_CONTROL_REPO}
 from './approved-generic-b-route.mjs';
import {STATUS,APPLY} from './approved-runtime-b-updater.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const need=(condition,code)=>{if(!condition){const e=Error(code);e.code=code;throw e;}};
const SHA40=/^[a-f0-9]{40}$/;
const exact=(o,keys)=>o!==null&&typeof o==='object'&&!Array.isArray(o)&&
 Object.keys(o).sort().join('|')===[...keys].sort().join('|');

/**
 * The EXISTING maintainer's installed receiver constructs these fixed hooks.
 * In particular, invokeFixedUpdater must be execFile(node,[FIXED update.mjs,
 * ...fixedArgs],{shell:false,...safeEnv}) after installed-SHA verification.
 * It is NOT an arbitrary callback from an Issue, nor a new runner lane.
 */
export function makeApprovedRuntimeBIntake({
 installedStatus,readApprovalFromControlCommit,verifyOwnerEffectApproval,
 storeApprovedPackageCreateOnce,readApprovedPackageBack,
 invokeFixedUpdater,
}={}){
 const deps={installedStatus,readApprovalFromControlCommit,verifyOwnerEffectApproval,
  storeApprovedPackageCreateOnce,readApprovedPackageBack,invokeFixedUpdater};
 need(Object.values(deps).every(fn=>typeof fn==='function'),
  'B_INTAKE_INSTALLED_HOOK_REQUIRED');
 return Object.freeze({
  async receive({issue}){
   const installed=await installedStatus();
   need(installed?.status==='INSTALLED_APPROVED_B_RECEIVER'&&
    installed?.originVerified===true&&installed?.fixedPathsVerified===true&&
    SHA40.test(installed.installedReceiverSha)&&
    SHA40.test(installed.controlCommitSha)&&
    installed.privateRepositoryVerified===true&&
    typeof installed.maintenanceRoot==='string'&&
    path.win32.isAbsolute(installed.maintenanceRoot),
    'B_INTAKE_RECEIVER_NOT_INSTALLED');
   const request=authenticateApprovedGenericBIssue(issue);
   need(request.expectedInstalledReceiverSha===installed.installedReceiverSha,
    'B_INTAKE_SOURCE_DRIFT');
   const current=await invokeFixedUpdater({installed,
    args:[STATUS,'--request-id',request.requestId]});
   need(current?.requestId===request.requestId&&
    current.status==='NOT_CLAIMED'&&current.ledger===null&&
    current.installLock?.held===false,
    'B_INTAKE_PRIOR_ATTEMPT_RECONCILE');
   const approved=await readApprovalFromControlCommit({
    repository:GENERIC_B_CONTROL_REPO,
    controlCommitSha:installed.controlCommitSha,
    path:approvalPathFromDigest(request.approvalManifestSha256)});
   need(Buffer.isBuffer(approved)&&approved.length>0&&approved.length<=262144&&
    sha(approved)===request.approvalManifestSha256,
    'B_INTAKE_APPROVAL_BYTES');
   let manifest;
   try{manifest=JSON.parse(approved.toString('utf8'));}
   catch{need(false,'B_INTAKE_APPROVAL_JSON');}
   const owner=await verifyOwnerEffectApproval({issue,request,manifest,
    rawApprovalSha256:sha(approved),controlCommitSha:installed.controlCommitSha});
   need(owner?.verified===true&&owner?.issueNumber===issue.number&&
    owner?.controlCommitSha===installed.controlCommitSha&&
    owner?.rawApprovalSha256===sha(approved),
    'B_INTAKE_EFFECT_NOT_APPROVED');
   const file=path.win32.join(installed.maintenanceRoot,'approved',
    request.requestId+'.json');
   const packageData={issue:request,actor:'ansqhd5774-Choi',
    issueNumber:issue.number,manifest,
    manifestRawBase64:approved.toString('base64')};
   // Create-only package and readback. Existing conflicting package or
   // ambiguous write is a recovery STOP, not a license to overwrite/retry.
   const write=await storeApprovedPackageCreateOnce({file,packageData,requestId:request.requestId});
   need(write?.created===true||write?.identicalExisting===true,
    'B_INTAKE_PACKAGE_WRITE_UNKNOWN');
   const reloaded=await readApprovedPackageBack({file,requestId:request.requestId});
   need(exact(reloaded,['issue','actor','issueNumber','manifest','manifestRawBase64'])&&
    JSON.stringify(reloaded)===JSON.stringify(packageData),
    'B_INTAKE_PACKAGE_READBACK');
   // The registered updater independently checks owner/raw SHA and makes
   // the one-shot Writer B claim. No custom command or path from the Issue.
   return invokeFixedUpdater({installed,
    args:[APPLY,'--request-id',request.requestId,'--manifest-file',file]});
  },
 });
}

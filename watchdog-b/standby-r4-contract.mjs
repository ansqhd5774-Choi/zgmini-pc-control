// R4 same-host Controller Standby: pure B admission. No host I/O or install.
// Historical R2/R3 approvals remain immutable; this is an additional exact path.
import {createHash} from 'node:crypto';
import {
 REPO,ISSUE_TITLE,OP,REQUEST_SCHEMA,FINAL_SCOPE,NEXT_TARGET,
 PROTECTION_POLICY,error,exact
} from './contract.mjs';

export const R4_TARGET='c0c4dcff6c8071b1318cca956e43ba82718c4975';
export const R4_SOURCE_SHA256='4029b768d8dcbb75353106b761b5da672433e693a8be033411c62abebfd27470';
export const R4_PREIMAGE_SHA256='3f99ea3357c6731cc9000bde1273db915cb07ba5fa480718194deb6330c29072';
export const R4_INSTALL_PREIMAGE_SHA256='28c8017d469a0e2b13af96e01e686bae874d174b1ddac9e6a170ee2487bd6829';
export const R4_MANIFEST_SCHEMA='ZGMINI_PC_WATCHDOG_B_MANIFEST_V4';
export const R4_SCOPE='SAME_HOST_ACTIVE_1_STANDBY_1_WATCHDOG_B';
export const R4_BASIS='2026-11-26_R3_SAME_HOST_ACTIVE_1_STANDBY_1_USER_SCOPE';
export const R4_STANDBY=Object.freeze({mode:'ACTIVE_1_STANDBY_1',approved:true});
export const R4_CONTROLLER_FILES=Object.freeze({
 'controller/common.mjs':'91e4ceb5d26412893cc047670a420338aa8ef293e95498f852ac0a2f5edd6cc6',
 'controller/engine.mjs':'6112b5a357d6ecba2ffb299857c2649ee51ca97e1e7755162efd69337976769f',
 'controller/entry.mjs':'407ea8693ab48a03b04ec77fe63f86d05537a37661b42c9ddcd55f5b36aa01d7',
 'controller/supervisor.mjs':'5ec0952872adcaa16eb14adec614f024bac7264deb5b59fb68b9080f0edb0344',
 'controller/standby.mjs':'e18c09b7e9b90fc483d5200e1e0c4741d2e4f93e049328566d710e37c21be7e7'
});
const hex64=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const hex40=x=>typeof x==='string'&&/^[a-f0-9]{40}$/.test(x);
const requestId=x=>typeof x==='string'&&
 /^pc-watchdog-b-[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(x);
export const rawSha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const allowedFiles=['pc-watchdog/runner-watchdog.mjs','pc-watchdog/INSTALL.json'];
const approvalKeys=[
 'schema','approved','scope','installedSha256','installedManifestSha256',
 'targetSha','targetSha256','fromScope','toScope','allowedFiles','operation',
 'approvalBasis','revision','expectedControllerSha','expectedControllerFiles',
 'protectionPolicy','standby'
];
export function verifyR4ControllerHost(host){
 if(!host||host.controllerSourceSha!==R4_TARGET||
   !host.controllerFiles||typeof host.controllerFiles!=='object'||
   Array.isArray(host.controllerFiles))throw error('WATCHDOG_R4_CONTROLLER_NOT_INSTALLED');
 for(const [file,digest] of Object.entries(R4_CONTROLLER_FILES)){
  if(host.controllerFiles[file]!==digest)
   throw error('WATCHDOG_R4_CONTROLLER_SOURCE_NOT_ATTESTED');
 }
 // The existing B upgrader separately reads and hashes EVERY host-declared file.
 return true;
}
export function validateR4Request(
 event,body,approval,installed,sourceDigest,approvalDigest,installedManifestDigest
){
 if(event?.action!=='opened'||event?.repository?.full_name!==REPO||
   event.repository.private!==true||event?.sender?.login!=='ansqhd5774-Choi'||
   event?.issue?.user?.login!=='ansqhd5774-Choi'||
   event?.issue?.title!==ISSUE_TITLE||
   !Number.isSafeInteger(event.issue.number)||event.issue.number<1||
   !Array.isArray(event.issue.labels)||
   !event.issue.labels.some(x=>x?.name==='pc-maintenance'))
  throw error('WATCHDOG_R4_UNTRUSTED_EVENT');
 if(!exact(body,['schema','requestId','operation','targetSha','approvalManifestSha256'])||
   body.schema!==REQUEST_SCHEMA||body.operation!==OP||
   !requestId(body.requestId)||body.targetSha!==R4_TARGET||
   !hex64(body.approvalManifestSha256))
  throw error('WATCHDOG_R4_REQUEST_CONTRACT');
 if(!exact(approval,approvalKeys)||
   approval.schema!==R4_MANIFEST_SCHEMA||approval.revision!==4||
   approval.approved!==true||approval.scope!==R4_SCOPE||
   approval.approvalBasis!==R4_BASIS||
   approval.operation!==OP||approval.targetSha!==R4_TARGET||
   approval.targetSha256!==R4_SOURCE_SHA256||
   approval.installedSha256!==R4_PREIMAGE_SHA256||
   approval.installedManifestSha256!==R4_INSTALL_PREIMAGE_SHA256||
   approval.fromScope!==FINAL_SCOPE||approval.toScope!==FINAL_SCOPE||
   approval.protectionPolicy!==PROTECTION_POLICY||
   approval.expectedControllerSha!==R4_TARGET||
   !exact(approval.expectedControllerFiles,Object.keys(R4_CONTROLLER_FILES))||
   Object.entries(R4_CONTROLLER_FILES).some(([p,v])=>approval.expectedControllerFiles[p]!==v)||
   !exact(approval.standby,['mode','approved'])||
   approval.standby.mode!==R4_STANDBY.mode||
   approval.standby.approved!==R4_STANDBY.approved||
   JSON.stringify(approval.allowedFiles)!==JSON.stringify(allowedFiles)||
   !hex64(approvalDigest)||approvalDigest!==body.approvalManifestSha256||
   sourceDigest!==R4_SOURCE_SHA256)
  throw error('WATCHDOG_R4_APPROVAL_OR_SOURCE_MISMATCH');
 if(installedManifestDigest!==R4_INSTALL_PREIMAGE_SHA256||
   !installed||installed.sha256!==R4_PREIMAGE_SHA256||
   installed.scope!==FINAL_SCOPE||installed.approvedTargetSourceSha!==NEXT_TARGET||
   !hex64(installed.startupSha256)||!hex64(installed.priorStartupSha256)||
   installed.standby!==undefined)
  throw error('WATCHDOG_R4_INSTALLED_PREIMAGE_MISMATCH');
 if(!hex40(approval.expectedControllerSha))
  throw error('WATCHDOG_R4_CONTROLLER_SHA_INVALID');
 return Object.freeze({requestId:body.requestId,issueNumber:event.issue.number,
  targetSha:R4_TARGET,oldSha:R4_PREIMAGE_SHA256,newSha:R4_SOURCE_SHA256,
  oldManifestSha:R4_INSTALL_PREIMAGE_SHA256,expectedControllerSha:R4_TARGET});
}
export function projectR4InstalledManifest(installed,plan,upgradedAt){
 if(!installed||plan?.targetSha!==R4_TARGET||
   plan.oldSha!==R4_PREIMAGE_SHA256||plan.newSha!==R4_SOURCE_SHA256||
   typeof upgradedAt!=='string'||!Number.isFinite(Date.parse(upgradedAt)))
  throw error('WATCHDOG_R4_INSTALL_PROJECTION_INVALID');
 return {...installed,sha256:R4_SOURCE_SHA256,scope:FINAL_SCOPE,
  approvedTargetSourceSha:R4_TARGET,standby:{...R4_STANDBY},upgradedAt};
}

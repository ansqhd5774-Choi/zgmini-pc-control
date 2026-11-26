// R5: fail-closed admission for one additional *passive* same-host Standby.
// This source-only module cannot change the installed Watchdog by itself.
// No V5 approval manifest is created until the first R4 Standby is proven READY.
import {createHash} from 'node:crypto';
import {
 REPO,ISSUE_TITLE,OP,REQUEST_SCHEMA,FINAL_SCOPE,PROTECTION_POLICY,error,exact
} from './contract.mjs';
import {R4_TARGET,R4_SOURCE_SHA256} from './standby-r4-contract.mjs';

export const R5_TARGET='45807c661ee7f5f11a20b5780e6fd31116b24f84';
export const R5_SOURCE_SHA256='9137447231d354d9999cdadbbb5b2a6dee7f0bf869df61881742902ac445128f';
export const R5_PREIMAGE_SHA256=R4_SOURCE_SHA256;
export const R5_INSTALL_PREIMAGE_SHA256='a47343964fbf3668d27f77deba69dbfc9b53788775c26ea420eeb3b2509e3805';
export const R5_MANIFEST_SCHEMA='ZGMINI_PC_WATCHDOG_B_MANIFEST_V5';
export const R5_SCOPE='SAME_HOST_ACTIVE_1_STANDBY_2_WATCHDOG_B';
export const R5_BASIS='2026-11-26_USER_CONFIRMED_ACTIVE_1_STANDBY_2_TARGET';
export const R5_CONTROLLER_SHA='182bb46f2838306ba40d8b4ec32bac40ab75b69a';
export const R5_STANDBY=Object.freeze({mode:'ACTIVE_1_STANDBY_2',approved:true});
export const R5_CONTROLLER_FILES=Object.freeze({
 'controller/common.mjs':'91e4ceb5d26412893cc047670a420338aa8ef293e95498f852ac0a2f5edd6cc6',
 'controller/engine.mjs':'6112b5a357d6ecba2ffb299857c2649ee51ca97e1e7755162efd69337976769f',
 'controller/operations.mjs':'d4a76910806cba861b3253f5fd24eccc8968fcbaa66133999483034b2f661cd3',
 'controller/entry.mjs':'407ea8693ab48a03b04ec77fe63f86d05537a37661b42c9ddcd55f5b36aa01d7',
 'controller/supervisor.mjs':'5ec0952872adcaa16eb14adec614f024bac7264deb5b59fb68b9080f0edb0344',
 'controller/standby.mjs':'e18c09b7e9b90fc483d5200e1e0c4741d2e4f93e049328566d710e37c21be7e7',
 'controller/preimage-manifest-contract.mjs':'c59d5d36f0024b7a4b1781ea6eef9351f6275db33c8799bec05bf99abebbfcc1'
});
const isSha40=x=>typeof x==='string'&&/^[a-f0-9]{40}$/.test(x);
const isSha64=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const requestId=x=>typeof x==='string'&&
 /^pc-watchdog-b-[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(x);
const approvalKeys=['schema','approved','scope','installedSha256','installedManifestSha256',
 'targetSha','targetSha256','fromScope','toScope','allowedFiles','operation',
 'approvalBasis','revision','expectedControllerSha','expectedControllerFiles',
 'protectionPolicy','standby'];
const allowedFiles=['pc-watchdog/runner-watchdog.mjs','pc-watchdog/INSTALL.json'];
export const rawSha256=bytes=>createHash('sha256').update(bytes).digest('hex');

// R5 must retain the actual W06-installed controller hash roster. No generic
// later-Controller acceptance, missing file or extra operating source is allowed.
export function verifyR5ControllerHost(host){
 if(host?.controllerSourceSha!==R5_CONTROLLER_SHA||
   !host.controllerFiles||typeof host.controllerFiles!=='object'||
   Array.isArray(host.controllerFiles)||
   Object.entries(R5_CONTROLLER_FILES).some(([p,d])=>host.controllerFiles[p]!==d))
  throw error('WATCHDOG_R5_CONTROLLER_SOURCE_NOT_ATTESTED');
 return true;
}

// This independent read-only prerequisite distinguishes R4 STAGED-on-disk
// from a naturally started R4 process with exactly one READY IPC candidate.
// It is required again at B transaction time; source file presence is not READY.
export function verifyR5FirstStandbyReady(installed,owner,status,{
 now=Date.now(),pidAlive=()=>null
}={}){
 if(installed?.sha256!==R4_SOURCE_SHA256||
    installed?.approvedTargetSourceSha!==R4_TARGET||
    installed?.scope!==FINAL_SCOPE||
    !exact(installed?.standby,['mode','approved'])||
    installed.standby.mode!=='ACTIVE_1_STANDBY_1'||
    installed.standby.approved!==true)
  throw error('WATCHDOG_R5_FIRST_STANDBY_PREIMAGE_MISMATCH');
 const stageAt=Date.parse(installed.upgradedAt);
 const ownerAt=Date.parse(owner?.at);
 const statusAt=Date.parse(status?.at);
 if(!Number.isFinite(now)||!Number.isFinite(stageAt)||
    !Number.isFinite(ownerAt)||!Number.isFinite(statusAt)||
    stageAt>now||ownerAt<stageAt||ownerAt>now||statusAt<ownerAt||
    statusAt>now||now-statusAt>60000)
  throw error('WATCHDOG_R5_R4_NATURAL_RESTART_NOT_PROVEN');
 const pid=x=>Number.isSafeInteger(x)&&x>0;
 if(!pid(owner?.pid)||!pid(status?.pid)||!pid(status?.supervisorPid)||
    !pid(status?.standbyPid)||new Set([
      owner.pid,status.pid,status.supervisorPid,status.standbyPid
    ]).size!==3||
    typeof owner.nonce!=='string'||owner.nonce.length<16||
    status.pid!==owner.pid||status.state!=='HEALTHY'||
    status.standbyRole!=='READY'||
    pidAlive(owner.pid)!==true||pidAlive(status.supervisorPid)!==true||
    pidAlive(status.standbyPid)!==true)
  throw error('WATCHDOG_R5_FIRST_STANDBY_NOT_READY');
 return true;
}

export function validateR5Request(
 event,body,approval,installed,sourceDigest,approvalDigest,installedManifestDigest
){
 if(event?.action!=='opened'||event?.repository?.full_name!==REPO||
   event.repository.private!==true||event?.sender?.login!=='ansqhd5774-Choi'||
   event?.issue?.user?.login!=='ansqhd5774-Choi'||
   event?.issue?.title!==ISSUE_TITLE||
   !Number.isSafeInteger(event.issue.number)||event.issue.number<1||
   !Array.isArray(event.issue.labels)||
   !event.issue.labels.some(x=>x?.name==='pc-maintenance'))
  throw error('WATCHDOG_R5_UNTRUSTED_EVENT');
 if(!exact(body,['schema','requestId','operation','targetSha','approvalManifestSha256'])||
    body.schema!==REQUEST_SCHEMA||body.operation!==OP||
    !requestId(body.requestId)||body.targetSha!==R5_TARGET||
    !isSha64(body.approvalManifestSha256))
  throw error('WATCHDOG_R5_REQUEST_CONTRACT');
 if(!exact(approval,approvalKeys)||approval.schema!==R5_MANIFEST_SCHEMA||
    approval.revision!==5||approval.approved!==true||
    approval.scope!==R5_SCOPE||approval.approvalBasis!==R5_BASIS||
    approval.operation!==OP||approval.targetSha!==R5_TARGET||
    approval.targetSha256!==R5_SOURCE_SHA256||
    approval.installedSha256!==R5_PREIMAGE_SHA256||
    approval.installedManifestSha256!==R5_INSTALL_PREIMAGE_SHA256||
    approval.fromScope!==FINAL_SCOPE||approval.toScope!==FINAL_SCOPE||
    approval.protectionPolicy!==PROTECTION_POLICY||
    approval.expectedControllerSha!==R5_CONTROLLER_SHA||
    !exact(approval.expectedControllerFiles,Object.keys(R5_CONTROLLER_FILES))||
    Object.entries(R5_CONTROLLER_FILES).some(([p,d])=>
      approval.expectedControllerFiles[p]!==d)||
    !exact(approval.standby,['mode','approved'])||
    approval.standby.mode!==R5_STANDBY.mode||
    approval.standby.approved!==R5_STANDBY.approved||
    JSON.stringify(approval.allowedFiles)!==JSON.stringify(allowedFiles)||
    approvalDigest!==body.approvalManifestSha256||
    !isSha64(approvalDigest)||sourceDigest!==R5_SOURCE_SHA256)
  throw error('WATCHDOG_R5_APPROVAL_OR_SOURCE_MISMATCH');
 if(installedManifestDigest!==R5_INSTALL_PREIMAGE_SHA256||
    !installed||installed.sha256!==R5_PREIMAGE_SHA256||
    installed.scope!==FINAL_SCOPE||
    installed.approvedTargetSourceSha!==R4_TARGET||
    !exact(installed.standby,['mode','approved'])||
    installed.standby.mode!=='ACTIVE_1_STANDBY_1'||
    installed.standby.approved!==true||
    !isSha64(installed.startupSha256)||
    !isSha64(installed.priorStartupSha256))
  throw error('WATCHDOG_R5_INSTALLED_PREIMAGE_MISMATCH');
 return Object.freeze({requestId:body.requestId,issueNumber:event.issue.number,
  targetSha:R5_TARGET,oldSha:R5_PREIMAGE_SHA256,
  newSha:R5_SOURCE_SHA256,oldManifestSha:R5_INSTALL_PREIMAGE_SHA256,
  expectedControllerSha:R5_CONTROLLER_SHA});
}

export function projectR5InstalledManifest(installed,plan,upgradedAt){
 if(!installed||plan?.targetSha!==R5_TARGET||
    plan.oldSha!==R5_PREIMAGE_SHA256||plan.newSha!==R5_SOURCE_SHA256||
    !Number.isFinite(Date.parse(upgradedAt)))
  throw error('WATCHDOG_R5_INSTALL_PROJECTION_INVALID');
 return {...installed,sha256:R5_SOURCE_SHA256,scope:FINAL_SCOPE,
  approvedTargetSourceSha:R5_TARGET,standby:{...R5_STANDBY},upgradedAt};
}

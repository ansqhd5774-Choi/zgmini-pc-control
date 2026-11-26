// R6: same-scope, source-only crash-safe standby reconciliation patch.
// Reuses the existing two-file, single-use Watchdog B stage; never kills,
// restarts, promotes or directly touches a Controller/Runner process.
import {REPO,ISSUE_TITLE,OP,REQUEST_SCHEMA,FINAL_SCOPE,PROTECTION_POLICY,error,exact} from './contract.mjs';
import {R5_TARGET,R5_SOURCE_SHA256,R5_SCOPE,R5_STANDBY,R5_CONTROLLER_FILES} from './standby-r5-contract.mjs';

// The original #4122 manifest is immutable. This exact already-merged commit
// contains the same Watchdog safety bytes but pins the approved Controller R2.
export const R6_TARGET='8bdeca9b55457fc9c9d35585aacd7eea14af63f0';
export const R6_SOURCE_SHA256='8d98b99b24eef14d0577a93457832e7e7ba3459f00b65dbfa6df349efd958891';
export const R6_PREIMAGE_SHA256=R5_SOURCE_SHA256;
export const R6_INSTALL_PREIMAGE_SHA256='5cc8fa6f8b146054d68c003c4738f0dd4b961ccd9bbe0833913537303a78cc61';
export const R6_MANIFEST_SCHEMA='ZGMINI_PC_WATCHDOG_B_MANIFEST_V6';
export const R6_SCOPE=R5_SCOPE;
export const R6_BASIS='2026-11-27_OWNER_POST_S6_SAFETY_REPAIR_SAME_SCOPE';
export const R6_CONTROLLER_SHA='3c7d4cfefacf072fd35cb19706b352c64c5e4fd2';
export const R6_STANDBY=R5_STANDBY;
// Approved #4036 Controller R2 successor: exactly one changed operations file
// and one additional private read-only module. Never accept an arbitrary SHA.
export const R6_CONTROLLER_FILES=Object.freeze({
 ...R5_CONTROLLER_FILES,
 'controller/operations.mjs':'bac7412c51c156d31b68f725f2532011cccf38359fe18e66a4d3851aa3a2b803',
 'controller/us-breadth-r2-private-readonly.mjs':'e5f1d87626c0fb192831f4fc76fc9e13931af6105a38e503f90f7e656d180fb1'
});
const sha64=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const requestId=x=>typeof x==='string'&&
 /^pc-watchdog-b-[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(x);
const allowedFiles=['pc-watchdog/runner-watchdog.mjs','pc-watchdog/INSTALL.json'];
const approvalKeys=['schema','approved','scope','installedSha256','installedManifestSha256',
 'targetSha','targetSha256','fromScope','toScope','allowedFiles','operation',
 'approvalBasis','revision','expectedControllerSha','expectedControllerFiles',
 'protectionPolicy','standby'];

export function verifyR6TwoStandbysReady(installed,owner,status,{now=Date.now(),pidAlive=()=>null}={}){
 if(installed?.sha256!==R5_SOURCE_SHA256||installed?.approvedTargetSourceSha!==R5_TARGET||
    installed?.scope!==FINAL_SCOPE||!exact(installed?.standby,['mode','approved'])||
    installed.standby.mode!=='ACTIVE_1_STANDBY_2'||installed.standby.approved!==true)
  throw error('WATCHDOG_R6_R5_INSTALLED_PREIMAGE_MISMATCH');
 const stageAt=Date.parse(installed.upgradedAt),ownerAt=Date.parse(owner?.at),statusAt=Date.parse(status?.at);
 if(!Number.isFinite(now)||!Number.isFinite(stageAt)||!Number.isFinite(ownerAt)||
    !Number.isFinite(statusAt)||stageAt>now||ownerAt<stageAt||ownerAt>now||
    statusAt<ownerAt||statusAt>now||now-statusAt>60000)
  throw error('WATCHDOG_R6_R5_NATURAL_RESTART_NOT_PROVEN');
 const pid=x=>Number.isSafeInteger(x)&&x>0;
 const pids=[owner?.pid,status?.supervisorPid,status?.standbyPid,status?.secondStandbyPid];
 if(pids.some(x=>!pid(x))||new Set(pids).size!==4||
    status?.pid!==owner?.pid||status?.state!=='HEALTHY'||
    status?.standbyRole!=='READY'||status?.secondStandbyRole!=='READY'||
    status?.standbyReadyCount!==2||
    typeof owner?.nonce!=='string'||owner.nonce.length<16||
    pids.some(x=>pidAlive(x)!==true))
  throw error('WATCHDOG_R6_ACTIVE_1_TWO_STANDBYS_NOT_READY');
 return true;
}
export function verifyR6ControllerHost(host){
 if(host?.controllerSourceSha!==R6_CONTROLLER_SHA||
    !host.controllerFiles||typeof host.controllerFiles!=='object'||
    Array.isArray(host.controllerFiles)||
    Object.entries(R6_CONTROLLER_FILES).some(([p,sha])=>host.controllerFiles[p]!==sha))
  throw error('WATCHDOG_R6_APPROVED_CONTROLLER_R2_MISMATCH');
 return true;
}

export function validateR6Request(event,body,approval,installed,sourceDigest,approvalDigest,installedManifestDigest){
 if(event?.action!=='opened'||event?.repository?.full_name!==REPO||
    event.repository.private!==true||event?.sender?.login!=='ansqhd5774-Choi'||
    event?.issue?.user?.login!=='ansqhd5774-Choi'||event.issue.title!==ISSUE_TITLE||
    !Number.isSafeInteger(event.issue.number)||event.issue.number<1||
    !Array.isArray(event.issue.labels)||!event.issue.labels.some(x=>x?.name==='pc-maintenance'))
  throw error('WATCHDOG_R6_UNTRUSTED_EVENT');
 if(!exact(body,['schema','requestId','operation','targetSha','approvalManifestSha256'])||
    body.schema!==REQUEST_SCHEMA||body.operation!==OP||
    !requestId(body.requestId)||body.targetSha!==R6_TARGET||!sha64(body.approvalManifestSha256))
  throw error('WATCHDOG_R6_REQUEST_CONTRACT');
 if(!exact(approval,approvalKeys)||approval.schema!==R6_MANIFEST_SCHEMA||
    approval.revision!==6||approval.approved!==true||
    approval.scope!==R6_SCOPE||approval.approvalBasis!==R6_BASIS||
    approval.operation!==OP||approval.targetSha!==R6_TARGET||
    approval.targetSha256!==R6_SOURCE_SHA256||
    approval.installedSha256!==R6_PREIMAGE_SHA256||
    approval.installedManifestSha256!==R6_INSTALL_PREIMAGE_SHA256||
    approval.fromScope!==FINAL_SCOPE||approval.toScope!==FINAL_SCOPE||
    approval.protectionPolicy!==PROTECTION_POLICY||
    approval.expectedControllerSha!==R6_CONTROLLER_SHA||
    !exact(approval.expectedControllerFiles,Object.keys(R6_CONTROLLER_FILES))||
    Object.entries(R6_CONTROLLER_FILES).some(([p,h])=>approval.expectedControllerFiles[p]!==h)||
    !exact(approval.standby,['mode','approved'])||
    approval.standby.mode!==R6_STANDBY.mode||
    approval.standby.approved!==R6_STANDBY.approved||
    JSON.stringify(approval.allowedFiles)!==JSON.stringify(allowedFiles)||
    approvalDigest!==body.approvalManifestSha256||!sha64(approvalDigest)||
    sourceDigest!==R6_SOURCE_SHA256)
  throw error('WATCHDOG_R6_APPROVAL_OR_SOURCE_MISMATCH');
 if(installedManifestDigest!==R6_INSTALL_PREIMAGE_SHA256||
    !installed||installed.sha256!==R6_PREIMAGE_SHA256||
    installed.scope!==FINAL_SCOPE||installed.approvedTargetSourceSha!==R5_TARGET||
    !exact(installed.standby,['mode','approved'])||
    installed.standby.mode!=='ACTIVE_1_STANDBY_2'||installed.standby.approved!==true||
    !sha64(installed.startupSha256)||!sha64(installed.priorStartupSha256))
  throw error('WATCHDOG_R6_INSTALLED_PREIMAGE_MISMATCH');
 return Object.freeze({requestId:body.requestId,issueNumber:event.issue.number,
  targetSha:R6_TARGET,oldSha:R6_PREIMAGE_SHA256,
  newSha:R6_SOURCE_SHA256,oldManifestSha:R6_INSTALL_PREIMAGE_SHA256,
  expectedControllerSha:R6_CONTROLLER_SHA});
}

export function projectR6InstalledManifest(installed,plan,upgradedAt){
 if(!installed||plan?.targetSha!==R6_TARGET||
    plan.oldSha!==R6_PREIMAGE_SHA256||plan.newSha!==R6_SOURCE_SHA256||
    !Number.isFinite(Date.parse(upgradedAt)))
  throw error('WATCHDOG_R6_INSTALL_PROJECTION_INVALID');
 return {...installed,sha256:R6_SOURCE_SHA256,scope:FINAL_SCOPE,
  approvedTargetSourceSha:R6_TARGET,standby:{...R6_STANDBY},upgradedAt};
}

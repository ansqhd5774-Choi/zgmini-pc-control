// Exact R5 Guardian activation candidate. Pure validation only; no process I/O.
// Reuses existing one-PID Guardian WMI handoff mechanism, not a new Runner.
import {R5_TARGET,R5_SOURCE_SHA256,R5_CONTROLLER_SHA} from './standby-r5-contract.mjs';
import {FINAL_SCOPE,PROTECTION_POLICY,error,exact,REPO} from './contract.mjs';

export const R5_GUARDIAN_TARGET=R5_TARGET;
export const R5_GUARDIAN_SOURCE_SHA256=R5_SOURCE_SHA256;
export const R5_GUARDIAN_INSTALL_RAW_SHA256='5cc8fa6f8b146054d68c003c4738f0dd4b961ccd9bbe0833913537303a78cc61';
export const R5_GUARDIAN_REQUEST_ID='pc-watchdog-activate-4d9b6a73-cc80-4b8b-920f-e5f3d62465b1';
export const R5_GUARDIAN_STAGE_REQUEST_ID='pc-watchdog-b-5f340f82-0a8b-46a1-8afd-46ec50c35f41';
export const R5_GUARDIAN_STAGE_ISSUE=3842;
export const R5_GUARDIAN_CONTROLLER_SHA=R5_CONTROLLER_SHA;
export const R5_GUARDIAN_HELPER_SHA256='ba4890ca8c8dd7ba4d885d88aff000443a58d1a8b1c9d01f386e10b3e0aa3bbe';
export const R5_GUARDIAN_SCHEMA='ZGMINI_PC_WATCHDOG_ACTIVATION_B_MANIFEST_V5';
export const R5_GUARDIAN_SCOPE='ONE_GUARDIAN_WATCHDOG_PROCESS_ACTIVATION_ONLY';
export const R5_GUARDIAN_EFFECT='ONE_EXACT_WATCHDOG_PROCESS_EXIT_GUARDIAN_RESTART';
export const R5_GUARDIAN_BASIS='EXISTING_SAME_PURPOSE_WATCHDOG_B_APPROVAL_AND_R5_STAGED_SOURCE';
const V=/^[a-f0-9]{64}$/;
const expectedKeys=['schema','approved','scope','targetSha','installedSha256',
 'installedManifestSha256',
 'installedScope','guardianHelperSha256','activationScriptSha256',
 'stageRequestId','oldStageIssueNumber','expectedControllerSha',
 'effect','approvalBasis','protectionPolicy'];

export function validateR5GuardianRequest(event,body,approval,{
 approvalDigest,helperDigest,activationScriptDigest
}={}){
 if(event?.action!=='opened'||event.repository?.full_name!==REPO||
    event.repository.private!==true||event.sender?.login!=='ansqhd5774-Choi'||
    event.issue?.user?.login!=='ansqhd5774-Choi'||
    event.issue?.title!=='pc-watchdog-guardian-activate'||
    !Number.isSafeInteger(event.issue.number)||event.issue.number<1||
    !Array.isArray(event.issue.labels)||
    !event.issue.labels.some(x=>x.name==='pc-maintenance'))
  throw error('WATCHDOG_R5_GUARDIAN_EVENT_DENIED');
 if(!exact(body,['schema','requestId','operation','targetSha','approvalManifestSha256'])||
    body.schema!=='ZGMINI_PC_WATCHDOG_ACTIVATION_B_REQUEST_V1'||
    body.requestId!==R5_GUARDIAN_REQUEST_ID||
    body.operation!=='watchdog-guardian-activate'||
    body.targetSha!==R5_GUARDIAN_TARGET||
    !V.test(body.approvalManifestSha256)||body.approvalManifestSha256!==approvalDigest)
  throw error('WATCHDOG_R5_GUARDIAN_REQUEST_INVALID');
 if(!exact(approval,expectedKeys)||approval.approved!==true||
    approval.schema!==R5_GUARDIAN_SCHEMA||
    approval.scope!==R5_GUARDIAN_SCOPE||
    approval.targetSha!==R5_GUARDIAN_TARGET||
    approval.installedSha256!==R5_GUARDIAN_SOURCE_SHA256||
    approval.installedManifestSha256!==R5_GUARDIAN_INSTALL_RAW_SHA256||
    approval.installedScope!==FINAL_SCOPE||
    approval.guardianHelperSha256!==R5_GUARDIAN_HELPER_SHA256||
    helperDigest!==R5_GUARDIAN_HELPER_SHA256||
    approval.activationScriptSha256!==activationScriptDigest||
    !V.test(activationScriptDigest)||approval.stageRequestId!==R5_GUARDIAN_STAGE_REQUEST_ID||
    approval.oldStageIssueNumber!==R5_GUARDIAN_STAGE_ISSUE||
    approval.expectedControllerSha!==R5_GUARDIAN_CONTROLLER_SHA||
    approval.effect!==R5_GUARDIAN_EFFECT||
    approval.approvalBasis!==R5_GUARDIAN_BASIS||
    approval.protectionPolicy!==PROTECTION_POLICY)
  throw error('WATCHDOG_R5_GUARDIAN_APPROVAL_INVALID');
 return {requestId:body.requestId,issueNumber:event.issue.number};
}

export function verifyR5GuardianPrecheck({install,sourceDigest,installedManifestDigest,stage,owner,status,
 now=Date.now(),pidAlive=()=>null}={}){
 if(install?.sha256!==R5_GUARDIAN_SOURCE_SHA256||
    sourceDigest!==R5_GUARDIAN_SOURCE_SHA256||
    installedManifestDigest!==R5_GUARDIAN_INSTALL_RAW_SHA256||
    install.scope!==FINAL_SCOPE||
    install.approvedTargetSourceSha!==R5_GUARDIAN_TARGET||
    !exact(install.standby,['mode','approved'])||
    install.standby.mode!=='ACTIVE_1_STANDBY_2'||
    install.standby.approved!==true)
  throw error('WATCHDOG_R5_GUARDIAN_SOURCE_OR_MODE_DRIFT');
 if(stage?.schema!=='ZGMINI_PC_WATCHDOG_B_RESULT_V1'||
    stage.requestId!==R5_GUARDIAN_STAGE_REQUEST_ID||
    stage.issueNumber!==R5_GUARDIAN_STAGE_ISSUE||
    stage.targetSha!==R5_GUARDIAN_TARGET||
    stage.targetSourceSha256!==R5_GUARDIAN_SOURCE_SHA256||
    stage.status!=='STAGED'||stage.writes!==2)
  throw error('WATCHDOG_R5_GUARDIAN_STAGE_UNVERIFIED');
 const stageAt=Date.parse(install.upgradedAt),ownerAt=Date.parse(owner?.at),
  statusAt=Date.parse(status?.at);
 if(!Number.isFinite(now)||!Number.isFinite(stageAt)||
    !Number.isFinite(ownerAt)||!Number.isFinite(statusAt)||
    stageAt>now||ownerAt>=stageAt||
    ownerAt>now||statusAt<ownerAt||statusAt>now||now-statusAt>90000)
  throw error('WATCHDOG_R5_GUARDIAN_PRIOR_RUNTIME_NOT_VERIFIED');
 if(!Number.isSafeInteger(owner?.pid)||owner.pid<=0||
    typeof owner?.nonce!=='string'||owner.nonce.length<16||
    status?.pid!==owner.pid||status.state!=='HEALTHY'||
    status.standbyRole!=='READY'||status.secondStandbyRole!==undefined||
    !Number.isSafeInteger(status.standbyPid)||status.standbyPid<=0||
    !Number.isSafeInteger(status.supervisorPid)||status.supervisorPid<=0||
    new Set([owner.pid,status.standbyPid,status.supervisorPid]).size!==3||
    pidAlive(owner.pid)!==true||pidAlive(status.standbyPid)!==true||
    pidAlive(status.supervisorPid)!==true)
  throw error('WATCHDOG_R5_GUARDIAN_OLD_OWNER_UNVERIFIED');
 return true;
}

export function verifyR5GuardianPostcheck({install,sourceDigest,installedManifestDigest,oldOwner,newOwner,
 status,oldStatus,signalledAt,now=Date.now(),pidAlive=()=>null}={}){
 const valid=pid=>Number.isSafeInteger(pid)&&pid>0;
 const newAt=Date.parse(newOwner?.at),signalAt=Date.parse(signalledAt),
  statusAt=Date.parse(status?.at),stageAt=Date.parse(install?.upgradedAt);
 if(install?.sha256!==R5_GUARDIAN_SOURCE_SHA256||
    sourceDigest!==R5_GUARDIAN_SOURCE_SHA256||
    installedManifestDigest!==R5_GUARDIAN_INSTALL_RAW_SHA256||
    install.scope!==FINAL_SCOPE||
    install.approvedTargetSourceSha!==R5_GUARDIAN_TARGET||
    !exact(install.standby,['mode','approved'])||
    install.standby.mode!=='ACTIVE_1_STANDBY_2'||
    install.standby.approved!==true||
    !Number.isFinite(newAt)||!Number.isFinite(signalAt)||
    !Number.isFinite(statusAt)||!Number.isFinite(stageAt)||
    newAt<stageAt||newAt<signalAt||statusAt<newAt||
    now<statusAt||now-statusAt>60000||
    !valid(oldOwner?.pid)||!valid(newOwner?.pid)||
    newOwner.pid===oldOwner.pid||
    typeof newOwner.nonce!=='string'||newOwner.nonce.length<16||
    newOwner.nonce===oldOwner.nonce||
    !valid(status?.pid)||status.pid!==newOwner.pid||
    status.state!=='HEALTHY'||status.standbyRole!=='READY'||
    status.secondStandbyRole!=='READY'||status.standbyReadyCount!==2||
    !valid(status.supervisorPid)||!valid(status.standbyPid)||
    !valid(status.secondStandbyPid)||
    status.supervisorPid!==oldStatus?.supervisorPid||
    new Set([newOwner.pid,status.supervisorPid,status.standbyPid,
      status.secondStandbyPid]).size!==4||
    pidAlive(newOwner.pid)!==true||
    pidAlive(status.supervisorPid)!==true||
    pidAlive(status.standbyPid)!==true||
    pidAlive(status.secondStandbyPid)!==true)
  throw error('WATCHDOG_R5_GUARDIAN_NEW_READY_UNVERIFIED');
 return true;
}

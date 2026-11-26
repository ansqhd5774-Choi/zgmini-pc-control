// Exact R4 Guardian activation candidate. Pure validation only; no process I/O.
// Reuses existing one-PID Guardian WMI handoff mechanism, not a new Runner.
import {R4_TARGET,R4_SOURCE_SHA256} from './standby-r4-contract.mjs';
import {R5_CONTROLLER_SHA} from './standby-r5-contract.mjs';
import {FINAL_SCOPE,PROTECTION_POLICY,error,exact,REPO} from './contract.mjs';

export const R4_GUARDIAN_TARGET=R4_TARGET;
export const R4_GUARDIAN_SOURCE_SHA256=R4_SOURCE_SHA256;
export const R4_GUARDIAN_REQUEST_ID='pc-watchdog-activate-69e65f42-d21a-4428-8450-b80b8e8ec395';
export const R4_GUARDIAN_STAGE_REQUEST_ID='pc-watchdog-b-8a5ce329-6df0-4f42-b6d1-e45c2a765f3b';
export const R4_GUARDIAN_STAGE_ISSUE=3784;
export const R4_GUARDIAN_CONTROLLER_SHA=R5_CONTROLLER_SHA;
export const R4_GUARDIAN_HELPER_SHA256='ba4890ca8c8dd7ba4d885d88aff000443a58d1a8b1c9d01f386e10b3e0aa3bbe';
export const R4_GUARDIAN_SCHEMA='ZGMINI_PC_WATCHDOG_ACTIVATION_B_MANIFEST_V4';
export const R4_GUARDIAN_SCOPE='ONE_GUARDIAN_WATCHDOG_PROCESS_ACTIVATION_ONLY';
export const R4_GUARDIAN_EFFECT='ONE_EXACT_WATCHDOG_PROCESS_EXIT_GUARDIAN_RESTART';
export const R4_GUARDIAN_BASIS='EXISTING_SAME_PURPOSE_WATCHDOG_B_APPROVAL_AND_R4_STAGED_SOURCE';
const V=/^[a-f0-9]{64}$/;
const expectedKeys=['schema','approved','scope','targetSha','installedSha256',
 'installedScope','guardianHelperSha256','activationScriptSha256',
 'stageRequestId','oldStageIssueNumber','expectedControllerSha',
 'effect','approvalBasis','protectionPolicy'];

export function validateR4GuardianRequest(event,body,approval,{
 approvalDigest,helperDigest,activationScriptDigest
}={}){
 if(event?.action!=='opened'||event.repository?.full_name!==REPO||
    event.repository.private!==true||event.sender?.login!=='ansqhd5774-Choi'||
    event.issue?.user?.login!=='ansqhd5774-Choi'||
    event.issue?.title!=='pc-watchdog-guardian-activate'||
    !Number.isSafeInteger(event.issue.number)||event.issue.number<1||
    !Array.isArray(event.issue.labels)||
    !event.issue.labels.some(x=>x.name==='pc-maintenance'))
  throw error('WATCHDOG_R4_GUARDIAN_EVENT_DENIED');
 if(!exact(body,['schema','requestId','operation','targetSha','approvalManifestSha256'])||
    body.schema!=='ZGMINI_PC_WATCHDOG_ACTIVATION_B_REQUEST_V1'||
    body.requestId!==R4_GUARDIAN_REQUEST_ID||
    body.operation!=='watchdog-guardian-activate'||
    body.targetSha!==R4_GUARDIAN_TARGET||
    !V.test(body.approvalManifestSha256)||body.approvalManifestSha256!==approvalDigest)
  throw error('WATCHDOG_R4_GUARDIAN_REQUEST_INVALID');
 if(!exact(approval,expectedKeys)||approval.approved!==true||
    approval.schema!==R4_GUARDIAN_SCHEMA||
    approval.scope!==R4_GUARDIAN_SCOPE||
    approval.targetSha!==R4_GUARDIAN_TARGET||
    approval.installedSha256!==R4_GUARDIAN_SOURCE_SHA256||
    approval.installedScope!==FINAL_SCOPE||
    approval.guardianHelperSha256!==R4_GUARDIAN_HELPER_SHA256||
    helperDigest!==R4_GUARDIAN_HELPER_SHA256||
    approval.activationScriptSha256!==activationScriptDigest||
    !V.test(activationScriptDigest)||approval.stageRequestId!==R4_GUARDIAN_STAGE_REQUEST_ID||
    approval.oldStageIssueNumber!==R4_GUARDIAN_STAGE_ISSUE||
    approval.expectedControllerSha!==R4_GUARDIAN_CONTROLLER_SHA||
    approval.effect!==R4_GUARDIAN_EFFECT||
    approval.approvalBasis!==R4_GUARDIAN_BASIS||
    approval.protectionPolicy!==PROTECTION_POLICY)
  throw error('WATCHDOG_R4_GUARDIAN_APPROVAL_INVALID');
 return {requestId:body.requestId,issueNumber:event.issue.number};
}

export function verifyR4GuardianPrecheck({install,sourceDigest,stage,owner,status,
 now=Date.now(),pidAlive=()=>null}={}){
 if(install?.sha256!==R4_GUARDIAN_SOURCE_SHA256||
    sourceDigest!==R4_GUARDIAN_SOURCE_SHA256||
    install.scope!==FINAL_SCOPE||
    install.approvedTargetSourceSha!==R4_GUARDIAN_TARGET||
    !exact(install.standby,['mode','approved'])||
    install.standby.mode!=='ACTIVE_1_STANDBY_1'||
    install.standby.approved!==true)
  throw error('WATCHDOG_R4_GUARDIAN_SOURCE_OR_MODE_DRIFT');
 if(stage?.schema!=='ZGMINI_PC_WATCHDOG_B_RESULT_V1'||
    stage.requestId!==R4_GUARDIAN_STAGE_REQUEST_ID||
    stage.issueNumber!==R4_GUARDIAN_STAGE_ISSUE||
    stage.targetSha!==R4_GUARDIAN_TARGET||
    stage.targetSourceSha256!==R4_GUARDIAN_SOURCE_SHA256||
    stage.status!=='STAGED'||stage.writes!==2)
  throw error('WATCHDOG_R4_GUARDIAN_STAGE_UNVERIFIED');
 const stageAt=Date.parse(install.upgradedAt),ownerAt=Date.parse(owner?.at),
  statusAt=Date.parse(status?.at);
 if(!Number.isFinite(now)||!Number.isFinite(stageAt)||
    !Number.isFinite(ownerAt)||!Number.isFinite(statusAt)||
    stageAt>now||ownerAt>=stageAt||
    ownerAt>now||statusAt<ownerAt||statusAt>now||now-statusAt>90000)
  throw error('WATCHDOG_R4_GUARDIAN_PRIOR_RUNTIME_NOT_VERIFIED');
 if(!Number.isSafeInteger(owner?.pid)||owner.pid<=0||
    typeof owner?.nonce!=='string'||owner.nonce.length<16||
    status?.pid!==owner.pid||status.state!=='HEALTHY'||
    status.standbyRole!==undefined||pidAlive(owner.pid)!==true)
  throw error('WATCHDOG_R4_GUARDIAN_OLD_OWNER_UNVERIFIED');
 return true;
}

export function verifyR4GuardianPostcheck({install,sourceDigest,oldOwner,newOwner,
 status,signalledAt,now=Date.now(),pidAlive=()=>null}={}){
 const valid=pid=>Number.isSafeInteger(pid)&&pid>0;
 const newAt=Date.parse(newOwner?.at),signalAt=Date.parse(signalledAt),
  statusAt=Date.parse(status?.at),stageAt=Date.parse(install?.upgradedAt);
 if(install?.sha256!==R4_GUARDIAN_SOURCE_SHA256||
    sourceDigest!==R4_GUARDIAN_SOURCE_SHA256||
    !Number.isFinite(newAt)||!Number.isFinite(signalAt)||
    !Number.isFinite(statusAt)||!Number.isFinite(stageAt)||
    newAt<stageAt||newAt<signalAt||statusAt<newAt||
    now<statusAt||now-statusAt>60000||
    !valid(oldOwner?.pid)||!valid(newOwner?.pid)||
    newOwner.pid===oldOwner.pid||
    newOwner.nonce===oldOwner.nonce||
    !valid(status?.pid)||status.pid!==newOwner.pid||
    status.state!=='HEALTHY'||status.standbyRole!=='READY'||
    !valid(status.supervisorPid)||!valid(status.standbyPid)||
    new Set([newOwner.pid,status.supervisorPid,status.standbyPid]).size!==3||
    pidAlive(newOwner.pid)!==true||
    pidAlive(status.supervisorPid)!==true||
    pidAlive(status.standbyPid)!==true)
  throw error('WATCHDOG_R4_GUARDIAN_NEW_READY_UNVERIFIED');
 return true;
}

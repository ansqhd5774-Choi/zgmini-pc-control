// Exact R6 staged Watchdog Guardian activation admission. Pure contract:
// never starts/stops a process or mutates a Controller/Runner/lease.
import {R6_TARGET,R6_SOURCE_SHA256,R6_CONTROLLER_SHA} from './standby-r6-contract.mjs';
import {FINAL_SCOPE,PROTECTION_POLICY,error,exact,REPO} from './contract.mjs';

export const R6_GUARDIAN_TARGET=R6_TARGET;
export const R6_GUARDIAN_SOURCE_SHA256=R6_SOURCE_SHA256;
export const R6_GUARDIAN_INSTALL_RAW_SHA256='eba7ae6fd9928b0aab412d91f4f32691b3ea50667cdc831bb8a15b42b8c218fb';
export const R6_GUARDIAN_REQUEST_ID='pc-watchdog-activate-8c74649b-4e4c-4630-a1d6-7c87cf5d3d4b';
export const R6_GUARDIAN_STAGE_REQUEST_ID='pc-watchdog-b-9c0ce6e4-8d8f-4ba4-9dc4-6145b9fdc930';
export const R6_GUARDIAN_STAGE_ISSUE=4131;
export const R6_GUARDIAN_CONTROLLER_SHA=R6_CONTROLLER_SHA;
export const R6_GUARDIAN_HELPER_SHA256='ba4890ca8c8dd7ba4d885d88aff000443a58d1a8b1c9d01f386e10b3e0aa3bbe';
export const R6_GUARDIAN_SCHEMA='ZGMINI_PC_WATCHDOG_ACTIVATION_B_MANIFEST_V6';
export const R6_GUARDIAN_SCOPE='ONE_GUARDIAN_WATCHDOG_PROCESS_ACTIVATION_ONLY';
export const R6_GUARDIAN_EFFECT='ONE_EXACT_WATCHDOG_PROCESS_EXIT_GUARDIAN_RESTART';
export const R6_GUARDIAN_BASIS='EXISTING_SAME_PURPOSE_WATCHDOG_B_APPROVAL_AND_R6_STAGED_SOURCE';

const digest=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const manifestKeys=['schema','approved','scope','targetSha','installedSha256',
 'installedManifestSha256','installedScope','guardianHelperSha256',
 'activationScriptSha256','stageRequestId','oldStageIssueNumber',
 'expectedControllerSha','effect','approvalBasis','protectionPolicy'];
const validPid=x=>Number.isSafeInteger(x)&&x>0;

export function validateR6GuardianRequest(event,body,approval,{
 approvalDigest,helperDigest,activationScriptDigest
}={}){
 if(event?.action!=='opened'||event.repository?.full_name!==REPO||
   event.repository.private!==true||event.sender?.login!=='ansqhd5774-Choi'||
   event.issue?.user?.login!=='ansqhd5774-Choi'||
   event.issue?.title!=='pc-watchdog-guardian-activate'||
   !Number.isSafeInteger(event.issue.number)||event.issue.number<1||
   !Array.isArray(event.issue.labels)||
   !event.issue.labels.some(x=>x.name==='pc-maintenance'))
  throw error('WATCHDOG_R6_GUARDIAN_EVENT_DENIED');
 if(!exact(body,['schema','requestId','operation','targetSha','approvalManifestSha256'])||
   body.schema!=='ZGMINI_PC_WATCHDOG_ACTIVATION_B_REQUEST_V1'||
   body.requestId!==R6_GUARDIAN_REQUEST_ID||
   body.operation!=='watchdog-guardian-activate'||
   body.targetSha!==R6_GUARDIAN_TARGET||
   !digest(body.approvalManifestSha256)||body.approvalManifestSha256!==approvalDigest)
  throw error('WATCHDOG_R6_GUARDIAN_REQUEST_INVALID');
 if(!exact(approval,manifestKeys)||approval.approved!==true||
   approval.schema!==R6_GUARDIAN_SCHEMA||
   approval.scope!==R6_GUARDIAN_SCOPE||
   approval.targetSha!==R6_GUARDIAN_TARGET||
   approval.installedSha256!==R6_GUARDIAN_SOURCE_SHA256||
   approval.installedManifestSha256!==R6_GUARDIAN_INSTALL_RAW_SHA256||
   approval.installedScope!==FINAL_SCOPE||
   approval.guardianHelperSha256!==R6_GUARDIAN_HELPER_SHA256||
   helperDigest!==R6_GUARDIAN_HELPER_SHA256||
   approval.activationScriptSha256!==activationScriptDigest||
   !digest(activationScriptDigest)||
   approval.stageRequestId!==R6_GUARDIAN_STAGE_REQUEST_ID||
   approval.oldStageIssueNumber!==R6_GUARDIAN_STAGE_ISSUE||
   approval.expectedControllerSha!==R6_GUARDIAN_CONTROLLER_SHA||
   approval.effect!==R6_GUARDIAN_EFFECT||
   approval.approvalBasis!==R6_GUARDIAN_BASIS||
   approval.protectionPolicy!==PROTECTION_POLICY)
  throw error('WATCHDOG_R6_GUARDIAN_APPROVAL_INVALID');
 return {requestId:body.requestId,issueNumber:event.issue.number};
}

function requireR6Installed(install,sourceDigest,installedManifestDigest){
 if(install?.sha256!==R6_GUARDIAN_SOURCE_SHA256||
   sourceDigest!==R6_GUARDIAN_SOURCE_SHA256||
   installedManifestDigest!==R6_GUARDIAN_INSTALL_RAW_SHA256||
   install.scope!==FINAL_SCOPE||
   install.approvedTargetSourceSha!==R6_GUARDIAN_TARGET||
   !exact(install.standby,['mode','approved'])||
   install.standby.mode!=='ACTIVE_1_STANDBY_2'||
   install.standby.approved!==true)
  throw error('WATCHDOG_R6_GUARDIAN_SOURCE_OR_MODE_DRIFT');
}

export function verifyR6GuardianPrecheck({install,sourceDigest,installedManifestDigest,
 stage,owner,status,now=Date.now(),pidAlive=()=>null}={}){
 requireR6Installed(install,sourceDigest,installedManifestDigest);
 if(stage?.schema!=='ZGMINI_PC_WATCHDOG_B_RESULT_V1'||
   stage.requestId!==R6_GUARDIAN_STAGE_REQUEST_ID||
   stage.issueNumber!==R6_GUARDIAN_STAGE_ISSUE||
   stage.targetSha!==R6_GUARDIAN_TARGET||
   stage.targetSourceSha256!==R6_GUARDIAN_SOURCE_SHA256||
   stage.status!=='STAGED'||stage.writes!==2)
  throw error('WATCHDOG_R6_GUARDIAN_STAGE_UNVERIFIED');
 const stageAt=Date.parse(install.upgradedAt),ownerAt=Date.parse(owner?.at),
  statusAt=Date.parse(status?.at);
 if(!Number.isFinite(now)||!Number.isFinite(stageAt)||
   !Number.isFinite(ownerAt)||!Number.isFinite(statusAt)||
   stageAt>now||ownerAt>=stageAt||ownerAt>now||
   statusAt<ownerAt||statusAt>now||now-statusAt>60000)
  throw error('WATCHDOG_R6_GUARDIAN_PRIOR_RUNTIME_NOT_VERIFIED');
 const ids=[owner?.pid,status?.supervisorPid,status?.standbyPid,
  status?.secondStandbyPid];
 if(ids.some(x=>!validPid(x))||new Set(ids).size!==4||
   typeof owner?.nonce!=='string'||owner.nonce.length<16||
   status.pid!==owner.pid||status.state!=='HEALTHY'||
   status.standbyRole!=='READY'||status.secondStandbyRole!=='READY'||
   status.standbyReadyCount!==2||ids.some(x=>pidAlive(x)!==true))
  throw error('WATCHDOG_R6_GUARDIAN_OLD_OWNER_OR_READY_UNVERIFIED');
 return true;
}

export function verifyR6GuardianPostcheck({install,sourceDigest,installedManifestDigest,
 oldOwner,newOwner,status,oldStatus,signalledAt,now=Date.now(),
 pidAlive=()=>null}={}){
 requireR6Installed(install,sourceDigest,installedManifestDigest);
 const stageAt=Date.parse(install.upgradedAt),
  oldAt=Date.parse(oldOwner?.at),newAt=Date.parse(newOwner?.at),
  signalAt=Date.parse(signalledAt),statusAt=Date.parse(status?.at);
 const ids=[newOwner?.pid,status?.supervisorPid,status?.standbyPid,
  status?.secondStandbyPid];
 if(!Number.isFinite(now)||!Number.isFinite(stageAt)||
   !Number.isFinite(oldAt)||!Number.isFinite(newAt)||
   !Number.isFinite(signalAt)||!Number.isFinite(statusAt)||
   oldAt>=stageAt||newAt<stageAt||newAt<signalAt||
   statusAt<newAt||now<statusAt||now-statusAt>60000||
   !validPid(oldOwner?.pid)||ids.some(x=>!validPid(x))||
   new Set(ids).size!==4||newOwner.pid===oldOwner.pid||
   typeof newOwner?.nonce!=='string'||newOwner.nonce.length<16||
   newOwner.nonce===oldOwner.nonce||
   status.pid!==newOwner.pid||status.state!=='HEALTHY'||
   status.standbyRole!=='READY'||status.secondStandbyRole!=='READY'||
   status.standbyReadyCount!==2||
   status.supervisorPid!==oldStatus?.supervisorPid||
   ids.some(x=>pidAlive(x)!==true))
  throw error('WATCHDOG_R6_GUARDIAN_NEW_READY_UNVERIFIED');
 return true;
}

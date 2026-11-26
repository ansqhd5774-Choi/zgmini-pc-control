// Pure one-shot W06 recovery state machine; operating adapter supplies fixed I/O.
// No second Task creation, direct provider calls, SQLite or D1 operations.
import {TASK} from './contract.mjs';
import {RECOVERY_RESULT_SCHEMA,DISABLED_XML_SHA} from './recovery-contract.mjs';

const stop=c=>{throw Object.assign(Error(c),{code:c});};
const need=(v,c)=>{if(!v)stop(c);};
const safe=e=>/^TASK_RECOVERY_B_[A-Z0-9_]{3,100}$/.test(e?.code??'')?
 e.code:'TASK_RECOVERY_B_ADAPTER_UNKNOWN_STOP';

export function verifyRecoverySnapshot(x,manifest,{enabled=false}={}){
 need(x?.taskPresent===true&&x.wrapperExact===true&&
  x.originalJournalExact===true&&x.originalOwnerLockExact===true&&
  x.originalBackupsMatch===true&&x.savedCandidateExact===true&&
  x.protectedUnchanged===true&&
  x.installedSourceSha===manifest.installedSourceSha&&
  x.configSourceSha===manifest.installedSourceSha&&
  x.sidecarSourceSha256===manifest.sidecarSourceSha256&&
  x.coreTaskXmlSha256===manifest.coreTaskXmlSha256&&
  (enabled?x.enabledTaskExact===true&&x.disabledTaskExact===false:
   x.disabledTaskExact===true&&x.enabledTaskExact===false&&
    x.taskXmlSha256===DISABLED_XML_SHA),
  'TASK_RECOVERY_B_PREIMAGE_CAS_STOP');
 return true;
}

export async function recoverW06TaskB(proof,io){
 const m=proof?.originProof?.manifest,requestId=proof?.request?.requestId;
 need(m&&requestId&&io&&['snapshot','claimOnce','enableOnce',
  'finishOnce'].every(k=>typeof io[k]==='function'),
  'TASK_RECOVERY_B_PORT_SCOPE_STOP');
 const result={schema:RECOVERY_RESULT_SCHEMA,requestId,
  originRequestId:proof.request.originRequestId,taskName:TASK,
  status:'TASK_RECOVERY_B_STATE_UNKNOWN',code:'TASK_RECOVERY_B_NOT_STARTED',
  installed:null,taskChanges:null,otherTaskChanges:0,
  scheduledRuntimeEffects:'UNVERIFIED_UNTIL_NATURAL_TICKS'};
 let claimed=false,claimAttempted=false,enableAttempted=false;
 try{
  const before=await io.snapshot();
  verifyRecoverySnapshot(before,m);
  claimAttempted=true;
  await io.claimOnce(requestId);
  claimed=true;
  // The retained Writer B owner lock stays in place throughout activation.
  verifyRecoverySnapshot(await io.snapshot(),m);
  enableAttempted=true;
  await io.enableOnce(DISABLED_XML_SHA);
  verifyRecoverySnapshot(await io.snapshot(),m,{enabled:true});
  await io.finishOnce(requestId);
  return {...result,status:'TASK_RECOVERY_B_INSTALLED_VERIFIED',
   code:'TASK_RECOVERY_B_ONE_ENABLE_READBACK_PASS',installed:true,
   taskChanges:1};
 }catch(error){
  return {...result,status:(!claimAttempted&&!claimed)?
   'TASK_RECOVERY_B_PREFLIGHT_STOP':'TASK_RECOVERY_B_RECOVERY_REQUIRED',
   code:safe(error),installed:null,taskChanges:null,
   lastEffect:enableAttempted?'ENABLE_ATTEMPTED_RECONCILE_NO_RETRY':
    claimAttempted?'RECOVERY_CLAIM_ATTEMPTED_NO_RETRY':'NO_MUTATION'};
 }
}

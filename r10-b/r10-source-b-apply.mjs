// B-only coordinator library. NOT an executable CLI, pc-job adapter, Workflow,
// or installed maintenance receiver operation. A trusted independent Windows
// maintainer must supply the fixed port AFTER separate policy handoff.
// No Issue content can name paths, scripts, commands or Git refs to execute.
import {
 validateR10BManifest,validateR10BDiff,ORIGINAL_PC_SOURCE,
 PC_HOME,PC_REPO,SOURCE_COMMIT,PATHS,RESERVATION_PATH,stop,
} from './r10-source-b-contract.mjs';

const SHA64=/^[0-9a-f]{64}$/;
const codeOf=e=>/^R10_B_[A-Z0-9_]{1,90}$/.test(e?.code??'')?
 e.code:'R10_B_UNEXPECTED_STOP';
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);

/** Read-only admission. Actual provenance cannot be supplied by an Issue. */
export async function preflightR10B({request,approvalBytes,port,now=Date.now(),lease=null}={}){
 const manifest=validateR10BManifest(approvalBytes,request);
 if(!port||typeof port.inspect!=='function'||typeof port.verifyDiff!=='function')
  stop('R10_B_TRUSTED_MAINTAINER_REQUIRED_STOP');
 const probe=await port.inspect();
 if(probe?.pcHome!==PC_HOME||probe?.pcRepo!==PC_REPO||
  probe?.sourceHead!==ORIGINAL_PC_SOURCE||
  probe?.approvedConfigSource!==ORIGINAL_PC_SOURCE||
  probe?.trackedClean!==true||
  probe?.configSha256!==manifest.originalConfigSha256||
  !same(probe?.originalFilesSha256,manifest.originalFilesSha256))
  stop('R10_B_ORIGINAL_SOURCE_CAS_STOP');
 const provenance=probe.runtimeProvenance;
 if(provenance?.kind!=='LIVE_TASK_PROCESS_CHECKOUT_VERIFIED'||
  provenance?.checkoutPath!==PC_REPO||
  provenance?.head!==ORIGINAL_PC_SOURCE||
  !Number.isSafeInteger(provenance?.verifiedAt)||
  Math.abs(now-provenance.verifiedAt)>60_000||
  provenance.sha256!==manifest.runtimeProvenanceSha256||
  provenance?.taskPidVerified!==true||provenance?.processTreeVerified!==true)
  stop('R10_B_LIVE_CORE_PROVENANCE_STOP');
 // #137/#150 and an A historical candidate are explicitly NOT this proof.
 const applyLeaseFree=probe?.sharedApplyLeaseFree===true||
  (lease?.owned===true&&probe?.sharedApplyLeaseOwner===lease.id);
 if(probe?.taskEnabled!==true||probe?.coreIdle!==true||
  probe?.coreLockFree!==true||probe?.writerProcessFree!==true||
  !applyLeaseFree||probe?.otherInstallerFree!==true)
  stop('R10_B_CORE_OR_SHARED_LANE_BUSY_STOP');
 if(probe?.sqliteUnmodified!==true||probe?.providersUnmodified!==true||
  probe?.tasksUnmodified!==true||
  !SHA64.test(probe?.protectedSnapshotSha256??''))
  stop('R10_B_PROTECTED_BASELINE_STOP');
 // An independently restored, manifest-pinned bundle can establish both trees
 // when the deployed commit is unavailable remotely. The trusted port supplies
 // this proof from a fresh isolated restore, never from the request body.
 const bundle=probe.verifiedRecoveryBundle;
 const restoredBundle=bundle?.independentlyRestored===true&&
  bundle.connectivityVerified===true&&
  bundle.bundleSha256===manifest.rollbackBundleSha256&&
  bundle.originalSha===ORIGINAL_PC_SOURCE&&
  bundle.targetSha===manifest.targetPcSourceSha;
 const remoteTrees=probe.originalRemoteRetrievable===true&&probe.targetRemoteRetrievable===true;
 if(probe?.originalGitObjectVerified!==true||
  (!remoteTrees&&!restoredBundle)||
  probe?.targetGitObjectVerified!==true||
  probe?.targetDescendsOriginal!==true||
  probe?.targetSourceSha!==manifest.targetPcSourceSha||
  probe?.candidateSourceCommit!==SOURCE_COMMIT||
  probe?.rollbackBundleSha256!==manifest.rollbackBundleSha256||
  probe?.rollbackVerified!==true||probe?.candidateDependencyVerified!==true)
  stop('R10_B_GIT_ROLLBACK_OR_DEPENDENCY_STOP');
 const diff=await port.verifyDiff(ORIGINAL_PC_SOURCE,manifest.targetPcSourceSha);
 validateR10BDiff({files:diff?.files,fromSha:diff?.fromSha,
  toSha:diff?.toSha,manifest});
 if(!same(diff?.targetFilesSha256,manifest.candidateFilesSha256))
  stop('R10_B_TARGET_GIT_TREE_BYTES_STOP');
 return {manifest,baseline:{configSha256:probe.configSha256,
  sourceHead:probe.sourceHead,protectedSnapshotSha256:probe.protectedSnapshotSha256,
  runtimeProvenanceSha256:provenance.sha256},
  status:'READY_FOR_INDEPENDENT_B_ONLY',runtimeSourceVerified:true,
  operationalWrites:0,providerCalls:0,sqliteOpened:false,d1Writes:0};
}

/** No automatic retries. Unknown operational side effects retain the lease.
 *  Port methods MUST be bound to verified fixed operations, not arbitrary CMD.
 */
export async function applyR10BOnce({request,approvalBytes,port,now=Date.now()}={}){
 let reserved=false,mutationStarted=false,lease=null;
 let phase='PREFLIGHT';
 try{
  const admission=await preflightR10B({request,approvalBytes,port,now});
  const {manifest,baseline}=admission;
  if(typeof port.acquireExclusiveLease!=='function'||
    typeof port.verifyBackup!=='function'||
    typeof port.reserveCreateOnly!=='function'||
    typeof port.markAttemptStarted!=='function'||
    typeof port.applyExactSourceCommit!=='function'||
    typeof port.verifyAfterApply!=='function')
   stop('R10_B_INSTALLER_PORT_NOT_INSTALLED_STOP');
  lease=await port.acquireExclusiveLease({purpose:'ASSET_R10_SOURCE_B_ONCE'});
  if(lease?.owned!==true)stop('R10_B_APPLY_LEASE_BUSY_STOP');
  phase='CAS';
  // Take another read-only snapshot after the lease: no Task/Core/Writer drift.
  const again=await preflightR10B({request,approvalBytes,port,
   now:Date.now(),lease});
  if(!same(again.baseline,baseline))stop('R10_B_PRE_APPLY_CAS_CHANGED_STOP');
  phase='BACKUP';
  const backup=await port.verifyBackup({manifest,baseline});
  if(backup?.verified!==true||backup.sha256!==manifest.rollbackBundleSha256||
    backup.originalSourceSha!==ORIGINAL_PC_SOURCE||
    backup.originalConfigSha256!==manifest.originalConfigSha256)
   stop('R10_B_BACKUP_NOT_VERIFIED_STOP');
  phase='RESERVATION';
  const reservedResult=await port.reserveCreateOnly({request,manifest,
   path:RESERVATION_PATH});
  if(reservedResult?.status!=='CREATED_201'||
    reservedResult?.path!==RESERVATION_PATH)
   stop('R10_B_GLOBAL_RESERVATION_UNKNOWN_STOP');
  reserved=true;
  await port.markAttemptStarted({request,manifest});
  mutationStarted=true;phase='APPLY';
  await port.applyExactSourceCommit({oldSha:ORIGINAL_PC_SOURCE,
   targetSha:manifest.targetPcSourceSha,files:PATHS,
   configSourceOnly:true,expectedConfigSha256:manifest.originalConfigSha256});
  phase='READBACK';
  const after=await port.verifyAfterApply({request,manifest,baseline});
  if(after?.sourceHead!==manifest.targetPcSourceSha||
   after?.configSource!==manifest.targetPcSourceSha||
   after?.trackedClean!==true||
   after?.exactTwoFilesChanged!==true||
   after?.coreTaskUnchanged!==true||after?.sqliteUnchanged!==true||
   after?.providersUnchanged!==true||after?.d1Writes!==0||
   after?.providerCalls!==0||after?.protectedBaselineUnchanged!==true)
   stop('R10_B_POST_APPLY_READBACK_UNKNOWN_STOP');
  if(typeof port.releaseExclusiveLease==='function')
   await port.releaseExclusiveLease(lease);
  return {status:'PASS',code:'R10_B_SOURCE_TWO_FILES_AND_CONFIG_READBACK',
   targetSourceSha:manifest.targetPcSourceSha,
   operationalSourceFilesChanged:2,configSourceChanged:true,
   providerCalls:0,sqliteWrites:0,d1Writes:0,taskChanges:0};
 }catch(error){
  const reason=codeOf(error);
  // A timed-out create-only GitHub reservation can have been committed even
  // when its response was lost. Never classify that as safe-to-retry BLOCKED.
  const uncertainReservation=phase==='RESERVATION';
  if(!reserved&&!mutationStarted&&!uncertainReservation){
   if(lease?.owned===true&&typeof port?.releaseExclusiveLease==='function')
    try{await port.releaseExclusiveLease(lease);}catch{}
   return {status:'BLOCKED',code:reason,operationalWrites:0,
    providerCalls:0,d1Writes:0};
  }
  // Reservation is irrevocable. Before a fresh attempt, investigate original
  // ledger/checkout and recover with a separately verified backup operation.
  return {status:'STATE_UNKNOWN',code:reason,
   checkpoint:'INSPECT_SOURCE_CONFIG_BACKUP_AND_TASK_BEFORE_ANY_RETRY',
   operationalWrites:'UNKNOWN',providerCalls:0,d1Writes:0,
   applyPhase:phase,leaseRetained:lease?.owned===true};
 }
}

/** Separate, deliberately non-automatic recovery after STATE_UNKNOWN.
 * Only the trusted independent maintainer may bind a fixed restore operation;
 * an Issue cannot request an arbitrary rollback path or Git command.
 */
export async function recoverR10BVerifiedBackup({request,approvalBytes,port}={}){
 const manifest=validateR10BManifest(approvalBytes,request);
 if(typeof port?.inspectRecovery!=='function'||
  typeof port?.restoreExactBackupCAS!=='function'||
  typeof port?.verifyRecoveredOriginal!=='function')
  stop('R10_B_RECOVERY_PORT_NOT_INSTALLED_STOP');
 const proof=await port.inspectRecovery();
 if(proof?.ownLeaseHeld!==true||proof?.attemptMarkerMatches!==true||
  proof?.taskProcessStopped!==true||proof?.coreLockFree!==true||
  proof?.writerProcessFree!==true||proof?.sourceWithinExpectedStates!==true||
  proof?.backupSha256!==manifest.rollbackBundleSha256||
  proof?.originalSha!==ORIGINAL_PC_SOURCE||
  proof?.originalConfigSha256!==manifest.originalConfigSha256||
  proof?.protectedBaselineUnchanged!==true)
  stop('R10_B_RECOVERY_CAS_OR_QUIESCENCE_STOP');
 await port.restoreExactBackupCAS({originalSourceSha:ORIGINAL_PC_SOURCE,
  manifest,observedSourceSha:proof.observedSourceSha,
  observedConfigSha256:proof.observedConfigSha256});
 const restored=await port.verifyRecoveredOriginal({manifest});
 if(restored?.sourceHead!==ORIGINAL_PC_SOURCE||
  restored?.configSource!==ORIGINAL_PC_SOURCE||
  restored?.trackedClean!==true||restored?.exactOriginalFiles!==true||
  restored?.tasksUnchanged!==true||restored?.sqliteUnchanged!==true||
  restored?.d1Writes!==0||restored?.providerCalls!==0)
  stop('R10_B_RECOVERY_READBACK_UNKNOWN_STOP');
 return {status:'ROLLED_BACK',code:'R10_B_ORIGINAL_SOURCE_RECOVERED_CAS',
  operationalSourceFilesChanged:0,providerCalls:0,d1Writes:0,
  originalSourceSha:ORIGINAL_PC_SOURCE,originalRequestRetried:false};
}

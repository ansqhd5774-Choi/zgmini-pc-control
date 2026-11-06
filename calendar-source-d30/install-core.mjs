// ER1 D+30: a bounded B-grade Core-source transaction coordinator.
// Not a CLI, Issue receiver, scheduler, or generic shell. The independently
// approved PC maintainer supplies the authorized Windows host operations.
// No provider fetch, database access, or new Core scheduling is performed.
import {assessD30SourceInstall, D30_INSTALL_CONTRACT} from './contract.mjs';

const SHA40=/^[a-f0-9]{40}$/;
const SHA64=/^[a-f0-9]{64}$/;
const stop=code=>{throw Object.assign(new Error(code),{code});};
const need=(ok,code)=>{if(!ok)stop(code);};
const exact=(a,b)=>Array.isArray(a)&&a.length===b.length&&a.every((v,i)=>v===b[i]);
const PATHS=D30_INSTALL_CONTRACT.operationalFiles.map(f=>f.path);

/**
 * The maintainer is the authority for approval, lease, original bytes, Core
 * quiescence, Git and atomic config swaps. This module neither accepts a
 * GitHub Issue body nor trusts a source-only PR as an installation approval.
 *
 * host contract:
 *   attest() -> {activeCore,installedFileHashes,gitHead,configSource,
 *                sourceRoot,trackedDirty,stagedPaths,coreShaConsumers}
 *   verifyAuthority(), verifyExclusiveLease(), verifyCoreQuiesced()
 *   stageSourceTargets(paths,sourceHead) -> {path:{sha256,blob}}
 *   snapshotOriginal(paths) -> {backupId,readbackVerified:true}
 *   applyExactPaths(paths,sourceHead) -> {updatedPaths}
 *   commitExactPaths(paths,beforeSha) -> {sha,changedPaths,clean,protectedUnchanged}
 *   casConfigSource(beforeSha,afterSha) -> {sourceSha}
 *   verifyFinal(paths,afterSha) -> {fileSha256,gitHead,configSource,clean,
 *                  protectedUnchanged,coreTaskRestored}
 *   recover(backupId,cause) -> {restored:boolean,verified:boolean}
 *
 * All host methods are fixed, installed, B-approved methods. No arbitrary
 * file names, commands, environment variables or URLs may enter through a
 * user request. Sidecar/Publisher compatibility remains a separate observed
 * runtime effect, not something that an install-only result can claim.
 */
export async function installD30ApprovedThreeFiles({
  approvedBManifest, host,
}={}){
  need(host&&typeof host==='object','ER1_D30_TRUSTED_HOST_REQUIRED');
  for(const key of ['attest','verifyAuthority','verifyExclusiveLease',
    'verifyCoreQuiesced','stageSourceTargets','snapshotOriginal',
    'applyExactPaths','commitExactPaths','casConfigSource','verifyFinal','recover']){
    need(typeof host[key]==='function','ER1_D30_HOST_CONTRACT_INCOMPLETE');
  }

  // Establish trust and exact source origin BEFORE acquiring an exclusive
  // write lease or touching any operating file.
  await host.verifyAuthority();
  const before=await host.attest();
  const {activeCore,installedFileHashes}=before??{};
  const eligible=assessD30SourceInstall({activeCore,installedFileHashes,approvedBManifest});
  need(eligible.status==='READY_FOR_SEPARATE_APPROVED_B_INSTALL',
    eligible.code??'ER1_D30_PREFLIGHT_STOP');
  need(before.sourceRoot===activeCore.sourceRoot&&
    before.gitHead===activeCore.runtimeSourceSha&&
    before.configSource===activeCore.runtimeSourceSha,
  'ER1_D30_CORE_HEAD_CONFIG_DRIFT');
  need(exact(before.trackedDirty,[])&&exact(before.stagedPaths,[]),
    'ER1_D30_UNAPPROVED_DIRTY_STOP');
  need(Array.isArray(before.coreShaConsumers)&&
    before.coreShaConsumers.includes('CORE_PUBLISHER')&&
    before.coreShaConsumers.includes('CNN_ARCHIVE_SIDECAR'),
  'ER1_D30_SHARED_SHA_CONSUMERS_UNREVIEWED');

  const target=await host.stageSourceTargets(PATHS,D30_INSTALL_CONTRACT.sourceHead);
  const expected=Object.fromEntries(D30_INSTALL_CONTRACT.operationalFiles.map(f=>
    [f.path,{sha256:f.targetSha256,blob:f.targetBlob}]));
  need(target&&exact(Object.keys(target),PATHS)&&PATHS.every(path=>
    target[path]?.sha256===expected[path].sha256&&
    target[path]?.blob===expected[path].blob),
  'ER1_D30_TARGET_BYTES_DRIFT');

  // The host's lease must be shared with other Core-source writers. Its
  // quiescence mechanism must be previously approved and restore scheduling.
  await host.verifyExclusiveLease();
  await host.verifyCoreQuiesced();
  const recheck=await host.attest();
  need(recheck?.gitHead===before.gitHead&&recheck?.configSource===before.configSource&&
    recheck?.sourceRoot===before.sourceRoot&&
    exact(recheck?.trackedDirty,[])&&exact(recheck?.stagedPaths,[])&&
    PATHS.every(path=>recheck.installedFileHashes?.[path]===installedFileHashes[path]),
  'ER1_D30_PREWRITE_DRIFT');

  const backup=await host.snapshotOriginal(PATHS);
  need(backup?.readbackVerified===true&&typeof backup.backupId==='string'&&
    backup.backupId.length>0,'ER1_D30_BACKUP_UNVERIFIED');
  let changed=false;
  try{
    await host.verifyExclusiveLease();
    await host.verifyCoreQuiesced();
    changed=true; // Any subsequent uncertain write must be recovered, not retried.
    const applied=await host.applyExactPaths(PATHS,D30_INSTALL_CONTRACT.sourceHead);
    need(exact(applied?.updatedPaths,PATHS),'ER1_D30_APPLIED_PATHS_MISMATCH');
    const commit=await host.commitExactPaths(PATHS,before.gitHead);
    need(SHA40.test(commit?.sha??'')&&commit.sha!==before.gitHead&&
      exact(commit.changedPaths,PATHS)&&commit.clean===true&&
      commit.protectedUnchanged===true,'ER1_D30_COMMIT_SCOPE_DRIFT');
    const config=await host.casConfigSource(before.gitHead,commit.sha);
    need(config?.sourceSha===commit.sha,'ER1_D30_CONFIG_CAS_DRIFT');
    const observed=await host.verifyFinal(PATHS,commit.sha);
    need(observed?.gitHead===commit.sha&&observed.configSource===commit.sha&&
      observed.clean===true&&observed.protectedUnchanged===true&&
      observed.coreTaskRestored===true&&
      PATHS.every(path=>SHA64.test(observed.fileSha256?.[path]??'')&&
        observed.fileSha256[path]===expected[path].sha256),
    'ER1_D30_FINAL_READBACK_STOP');
    return {status:'SOURCE_INSTALLED_VERIFIED',sourceSha:commit.sha,
      installedFileCount:3,backupId:backup.backupId,
      publisherRuntime:'NOT_VERIFIED',sidecarRuntime:'NOT_VERIFIED',
      supplierGetCalls:0,databaseWrites:0,schedulerDefinitionsChanged:0};
  }catch(error){
    if(!changed)throw error;
    // The installed maintainer classifies/recovers the exact journal. A
    // recovery error is never permission to clear a lease or retry the job.
    let rollback;
    try{rollback=await host.recover(backup.backupId,error.code??'ER1_D30_B_UNKNOWN');}
    catch{rollback={restored:false,verified:false};}
    return {status:rollback?.restored&&rollback.verified?'ROLLED_BACK':'RECOVERY_REQUIRED',
      code:error.code??'ER1_D30_B_UNKNOWN',backupId:backup.backupId,
      supplierGetCalls:0,databaseWrites:0,schedulerDefinitionsChanged:0};
  }
}

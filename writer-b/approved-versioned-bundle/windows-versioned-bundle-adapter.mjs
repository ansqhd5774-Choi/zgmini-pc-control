// APPROVED-RECEIVER-ONLY Windows Node OS adapter CANDIDATE.
// This module has NO native OS or remote call of its own. The installed B
// receiver must inject the fixed, separately approved bridge capabilities.
// It MUST NOT be connected to a PC/Actions workflow without a new B approval.
// In particular, no arbitrary shell, Task change, provider/DB/D1 operation.
import {createHash} from 'node:crypto';
import {buildPinnedVersionedBundlePlan} from './pinned-bundle-profiles.mjs';

const sha=b=>createHash('sha256').update(b).digest('hex');
const stop=code=>{const e=Error(code);e.code=code;throw e;};
const need=(ok,code)=>{if(!ok)stop(code);};
const sorted=x=>[...x].sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
const REQUIRED_BRIDGE=[
 'authenticatePinnedApproval','verifyApprovedSourceTree','verifyNoReparse',
 'verifyProtectedHandles',
 'readTaskDefinition','readLauncherBytes','readActiveRecordBytes',
 'readPinnedSourceBlob','readApprovedZipArtifact','readApprovedActivationBytes',
 'inspectImmutableVersion',
 'attestNoMixedRuntimeExposure',
 'acquireExistingR17SharedWriterLock','releaseExistingR17SharedWriterLock',
 'stageImmutableVersionFile','readStagedVersionFile',
 'startDurableJournal','backupSameFolderPreserveAcl',
 'promoteStagedImmutableVersion','casReplaceSameFolder','readInstalledVersionFile',
 'commitDurableJournal','restoreSameFolderBackup','recordJsonTxtResult',
];
const SHA40=/^[0-9a-f]{40}$/;
const SHA64=/^[0-9a-f]{64}$/;
const exactFile=(bytes,expected,code)=>{
 need(Buffer.isBuffer(bytes)&&sha(bytes)===expected,code);return bytes;
};
const isAbsent=x=>x===null;

/**
 * Only the authorized receiver may call this function with a bridge from its
 * pinned Windows installation. manifest, operation and scope are closed by
 * buildPinnedVersionedBundlePlan. Paths/commands cannot come from Issue JSON.
 *
 * registryBytes must be the SAME exact bytes pinned by live host.json and
 * selected by A, not a second Writer-B profile registry.
 */
export function makeWindowsVersionedBundleAdapterCandidate({
 manifest,registryBytes,hostApprovedRegistrySha256,requestIdentity,bridge,
}={}){
 need(REQUIRED_BRIDGE.every(name=>typeof bridge?.[name]==='function'),
  'B_WINDOWS_BRIDGE_UNREGISTERED');
 const plan=buildPinnedVersionedBundlePlan({
  approval:manifest,manifestBytes:registryBytes,
  approvedManifestSha256:hostApprovedRegistrySha256,requestIdentity,
 });
 need(plan.status==='PLAN_ONLY'&&plan.sourceSha===requestIdentity.sourceSha&&
  SHA40.test(manifest.sourceSha)&&SHA64.test(hostApprovedRegistrySha256),
  'B_WINDOWS_PROFILE_DRIFT');
 const changed=[
  ...manifest.activation.launchers.map(x=>({...x,kind:'launcher'})),
  {...manifest.activation.activeRecord,kind:'active-record'},
 ];
 let sourceBytes=null,activeBytes=null,launcherBytes=null,stageReadBack=null;
 let journalId=null,lease=null,requestId=null;
 const requireLease=lock=>need(lock!==null&&lock===lease&&requestId,
  'B_WINDOWS_LOCK_UNOWNED');
 const verifyHandles=async(lock,phase)=>{
  requireLease(lock);
  const check=await bridge.verifyProtectedHandles({
   lock,profileId:manifest.profileId,home:plan.home,phase});
  need(check?.held===true&&check?.noReparse===true&&check?.scoped===true,
   'B_WINDOWS_HANDLE_SCOPE_DRIFT');
 };
 const requireTickSafeActivation=async lock=>{
  requireLease(lock);
  // The Task Scheduler does not inherently acquire Writer-B's lock. It may
  // tick between distinct file CAS operations. This MUST be a real receiver
  // attestation of old/new dispatcher compatibility, not a generic mutex.
  const compatibility=await bridge.attestNoMixedRuntimeExposure({
   lock,profileId:manifest.profileId,
   taskName:manifest.activation.task.name,
   launcherChanges:manifest.activation.launchers.map(l=>({
    name:l.name,beforeSha256:l.beforeSha256,afterSha256:l.afterSha256,
   })),
   activeRecord:manifest.activation.activeRecord,
  });
  need(compatibility?.strategy==='STATIC_DISPATCHER_POINTER_SWITCH'&&
   compatibility?.taskUnchanged===true&&
   compatibility?.oldAndNewLaunchersCompatible===true&&
   compatibility?.activePointerAtomic===true&&
   compatibility?.scheduleTickSafe===true,
   'B_WINDOWS_MIXED_RUNTIME_NOT_PROVEN');
 };
 const taskSnapshot=async()=>{
  const task=await bridge.readTaskDefinition({profileId:manifest.profileId,
   taskName:manifest.activation.task.name});
  need(Buffer.isBuffer(task?.xmlBytes)&&typeof task.state==='string'&&
   typeof task.time==='string','B_WINDOWS_TASK_UNAVAILABLE');
  return {name:manifest.activation.task.name,time:task.time,
   state:task.state,xmlSha256:sha(task.xmlBytes)};
 };
 const inspect=async()=>{
  const task=await taskSnapshot();
  const launchers=[];
  for(const file of manifest.activation.launchers){
   const bytes=await bridge.readLauncherBytes({profileId:manifest.profileId,
    launcherName:file.name});
   need(Buffer.isBuffer(bytes),'B_WINDOWS_LAUNCHER_MISSING');
   launchers.push({name:file.name,sha256:sha(bytes)});
  }
  const active=await bridge.readActiveRecordBytes({
   profileId:manifest.profileId,name:manifest.activation.activeRecord.name});
  need(isAbsent(active)||Buffer.isBuffer(active),'B_WINDOWS_ACTIVE_UNAVAILABLE');
  const state={task,launchers,
   activeRecord:{name:manifest.activation.activeRecord.name,
    sha256:isAbsent(active)?null:sha(active)},
   bundleVersion:null,fileListSha256:null};
  if(stageReadBack!==null){
   const files=[];
   for(const file of manifest.bundle.files){
    const bytes=await bridge.readInstalledVersionFile({
     profileId:manifest.profileId,version:manifest.bundle.version,path:file.path,
    });
    need(Buffer.isBuffer(bytes),'B_WINDOWS_VERSION_FILE_MISSING');
    files.push({path:file.path,sha256:sha(bytes),bytes:bytes.length});
   }
   state.bundleVersion=manifest.bundle.version;
   state.fileListSha256=sha(Buffer.from(JSON.stringify(sorted(files))));
  }
  return state;
 };
 return Object.freeze({
  async authenticatePinnedApproval({pin,rawSha256,manifestSourceSha}){
   need(pin?.sourceSha===manifest.sourceSha&&rawSha256===pin.rawManifestSha256&&
    (manifestSourceSha===undefined||manifestSourceSha===manifest.sourceSha),
    'B_WINDOWS_PIN_DRIFT');
   const auth=await bridge.authenticatePinnedApproval({
    pin,rawSha256,profileId:manifest.profileId,
    sourceSha:manifest.sourceSha,approvedRegistrySha256:hostApprovedRegistrySha256,
   });
   need(auth?.verified===true&&auth?.rawSha256===rawSha256,
    'B_WINDOWS_APPROVAL_NOT_ATTESTED');
   const source=await bridge.verifyApprovedSourceTree({
    repo:manifest.sourceRepository,sourceSha:manifest.sourceSha,
    sourceTreeGitOid:manifest.bundle.sourceTreeGitOid,
   });
   need(source?.verified===true,'B_WINDOWS_GIT_TREE_NOT_ATTESTED');
   const roots=await bridge.verifyNoReparse({
    profileId:manifest.profileId,home:plan.home,
   });
   need(roots?.exactApprovedRoot===true&&roots?.noReparse===true,
    'B_WINDOWS_APPROVED_ROOT_NOT_ATTESTED');
   return {verified:true,rawSha256};
  },
  async inspectPreimage(){return inspect();},
  async acquireSharedWriterLock({requestId:rid,profileId}){
   need(profileId===manifest.profileId&&typeof rid==='string'&&
    /^[A-Za-z0-9_-]{12,128}$/.test(rid),'B_WINDOWS_REQUEST_ID');
   need(lease===null,'B_WINDOWS_DOUBLE_LOCK');
   const result=await bridge.acquireExistingR17SharedWriterLock({
    requestId:rid,profileId,mode:'EXCLUSIVE_SAME_WRITER_B',
   });
   need(result?.acquired===true&&result?.lock!==undefined,
    'B_WINDOWS_SHARED_LOCK_FAILED');
   requestId=rid;lease=result.lock;
   return lease;
  },
  async verifyPreimageUnderLock({lock}){
   requireLease(lock);
   const root=await bridge.verifyNoReparse({
    profileId:manifest.profileId,home:plan.home,underLock:true});
   need(root?.exactApprovedRoot===true&&root?.noReparse===true,
    'B_WINDOWS_APPROVED_ROOT_NOT_ATTESTED');
   await verifyHandles(lock,'UNDER_LOCK');
  // Reject an incompatible multi-launcher deployment before even staging
  // immutable files. The later check also catches drift before CAS.
  await requireTickSafeActivation(lock);
   return inspect();
  },
  async stageVerifiedBundle({lock,plan:runtimePlan}){
   requireLease(lock);
   await verifyHandles(lock,'STAGE');
   need(runtimePlan.bundleVersion===plan.bundleVersion&&
    runtimePlan.fileListSha256===plan.fileListSha256,'B_WINDOWS_PLAN_DRIFT');
   const prior=await bridge.inspectImmutableVersion({
    lock,profileId:manifest.profileId,version:manifest.bundle.version,
    approvedFiles:manifest.bundle.files,fileListSha256:plan.fileListSha256,
   });
   need(prior?.exists===true||prior?.exists===false,
    'B_WINDOWS_IMMUTABLE_STATE_UNKNOWN');
   if(prior.exists){
    need(prior.exactVerified===true&&
     prior.fileListSha256===plan.fileListSha256&&
     prior.fileCount===manifest.bundle.files.length,
     'B_WINDOWS_IMMUTABLE_REUSE_DRIFT');
    // Never delete/rewrite an existing version; activation from a previous
    // verified-rollback may legitimately re-use identical immutable bytes.
    stageReadBack=true;
    return {verified:true,fileListSha256:plan.fileListSha256,
     stagedVersion:manifest.bundle.version,reused:true};
   }
   const zip=await bridge.readApprovedZipArtifact({
    sourceSha:manifest.sourceSha,expectedSha256:manifest.bundle.zipSha256,
   });
   exactFile(zip,manifest.bundle.zipSha256,'B_WINDOWS_ZIP_HASH');
   need(zip.length<=33554432,'B_WINDOWS_ZIP_SIZE');
   sourceBytes=new Map();const attest=[];
   for(const f of manifest.bundle.files){
    const bytes=await bridge.readPinnedSourceBlob({
     sourceSha:manifest.sourceSha,branch:manifest.sourceBranch,path:f.path,
    });
    need(Buffer.isBuffer(bytes)&&bytes.length===f.bytes&&sha(bytes)===f.sha256,
     'B_WINDOWS_SOURCE_BYTES_DRIFT');
    sourceBytes.set(f.path,bytes);
    const staged=await bridge.stageImmutableVersionFile({
     lock,requestId,profileId:manifest.profileId,version:manifest.bundle.version,
     path:f.path,bytes,expectedSha256:f.sha256,
    });
    need(staged?.staged===true&&staged.handleBound===true&&
     staged.noReparse===true,'B_WINDOWS_STAGING_FAILED');
    const read=await bridge.readStagedVersionFile({
     lock,requestId,profileId:manifest.profileId,version:manifest.bundle.version,
     path:f.path,
    });
    need(Buffer.isBuffer(read)&&read.length===f.bytes&&sha(read)===f.sha256,
     'B_WINDOWS_STAGED_READBACK');
    attest.push({path:f.path,sha256:sha(read),bytes:read.length});
   }
   stageReadBack=null; // version not yet promoted
   const listSha=sha(Buffer.from(JSON.stringify(sorted(attest))));
   need(listSha===plan.fileListSha256,'B_WINDOWS_STAGED_LIST_DRIFT');
   return {verified:true,fileListSha256:listSha,stagedVersion:manifest.bundle.version};
  },
  async backupPreimages({lock}){
   requireLease(lock);
   await verifyHandles(lock,'BACKUP');
   // The scheduled Task can tick between distinct NTFS per-file CAS operations.
   // Existing Writer lock alone has NOT proved that the scheduler honors it.
   // Only a separately verified, stable-dispatcher/atomic-pointer contract
   // can assert no old/new mixed execution. Without it, fail BEFORE backup.
  await requireTickSafeActivation(lock);
   // Ensure all afterimage bytes are independently pinned before backup.
   activeBytes=null;launcherBytes=new Map();
   for(const item of changed){
    const bytes=await bridge.readApprovedActivationBytes({
     sourceSha:manifest.sourceSha,kind:item.kind,name:item.name,
    });
    exactFile(bytes,item.afterSha256,'B_WINDOWS_ACTIVATION_BYTES_DRIFT');
    if(item.kind==='active-record')activeBytes=bytes;
    else launcherBytes.set(item.name,bytes);
   }
   const journal=await bridge.startDurableJournal({
    lock,requestId,profileId:manifest.profileId,
    manifestSha256:manifest.bundle.zipSha256,
    fileCount:manifest.bundle.files.length,
   });
   need(journal?.created===true&&typeof journal.journalId==='string'&&
    journal.journalId.length>0,'B_WINDOWS_JOURNAL_FAILED');
   journalId=journal.journalId;
   for(const item of changed){
    const b=await bridge.backupSameFolderPreserveAcl({
     lock,journalId,requestId,profileId:manifest.profileId,
     kind:item.kind,name:item.name,expectedBeforeSha256:item.beforeSha256,
    });
    need(b?.fsynced===true&&b?.aclPreserved===true&&
     b?.handleBound===true&&b?.noReparse===true&&
     (item.beforeSha256===null?
      b.absent===true:b.sha256===item.beforeSha256),
     'B_WINDOWS_BACKUP_NOT_ATTESTED');
   }
   return {complete:true,journalId};
  },
  async casActivate({lock,backup,staged}){
   requireLease(lock);
   await verifyHandles(lock,'CAS');
   need(backup.journalId===journalId&&
    staged.stagedVersion===manifest.bundle.version,'B_WINDOWS_ACTIVATION_CONTEXT_DRIFT');
   if(staged.reused){
    const actual=await bridge.inspectImmutableVersion({
     lock,profileId:manifest.profileId,version:manifest.bundle.version,
     approvedFiles:manifest.bundle.files,fileListSha256:plan.fileListSha256,
    });
    need(actual?.exists===true&&actual.exactVerified===true&&
     actual.fileListSha256===plan.fileListSha256&&
     actual.fileCount===manifest.bundle.files.length,
     'B_WINDOWS_IMMUTABLE_REUSE_DRIFT');
   }else{
    const v=await bridge.promoteStagedImmutableVersion({
     lock,journalId,requestId,profileId:manifest.profileId,
     version:manifest.bundle.version,fileListSha256:plan.fileListSha256,
    });
    need(v?.promoted===true&&v.fileListSha256===plan.fileListSha256,
     'B_WINDOWS_VERSION_PROMOTION_FAILED');
   }
   stageReadBack=true;
   for(const item of changed){
    const bytes=item.kind==='active-record'?activeBytes:launcherBytes.get(item.name);
    const result=await bridge.casReplaceSameFolder({
     lock,journalId,requestId,profileId:manifest.profileId,
     kind:item.kind,name:item.name,expectedBeforeSha256:item.beforeSha256,
     afterBytes:bytes,expectedAfterSha256:item.afterSha256,
    });
    need(result?.atomicRename===true&&result?.fsynced===true&&
     result?.handleBound===true&&result?.noReparse===true&&
     result?.aclPreserved===true&&result?.afterSha256===item.afterSha256,
     'B_WINDOWS_CAS_NOT_ATTESTED');
   }
   return {activated:true};
  },
  async readBack({lock}){
   requireLease(lock);await verifyHandles(lock,'READBACK');return inspect();
  },
  async commit({lock,backup}){
   requireLease(lock);need(backup.journalId===journalId,'B_WINDOWS_JOURNAL_ID');
   const c=await bridge.commitDurableJournal({lock,journalId,requestId});
   need(c?.committed===true,'B_WINDOWS_COMMIT_UNKNOWN');return {committed:true};
  },
  async rollback({lock,backup}){
   requireLease(lock);need(backup.journalId===journalId,'B_WINDOWS_JOURNAL_ID');
   await verifyHandles(lock,'ROLLBACK');
   // Reverse the order of mutation; bridge must compare current hashes
   // against before/after and restore same-parent original ACL/bytes.
   for(const item of [...changed].reverse()){
    const restored=await bridge.restoreSameFolderBackup({
     lock,journalId,requestId,profileId:manifest.profileId,
     kind:item.kind,name:item.name,beforeSha256:item.beforeSha256,
     afterSha256:item.afterSha256,
    });
    need(restored?.restored===true&&restored?.sha256===item.beforeSha256&&
     restored?.handleBound===true&&restored?.noReparse===true&&
     restored?.aclPreserved===true&&restored?.fsynced===true,
     'B_WINDOWS_ROLLBACK_NOT_ATTESTED');
   }
   return {rolledBack:true};
  },
  async verifyRollback({lock}){requireLease(lock);return inspect();},
  async releaseSharedWriterLock({lock}){
   requireLease(lock);
   const r=await bridge.releaseExistingR17SharedWriterLock({lock,requestId});
   need(r?.released===true,'B_WINDOWS_LOCK_RELEASE_FAILED');
   lease=null;requestId=null;
  },
  async recordResult({report}){
   need(report?.sourceSha===manifest.sourceSha&&
    report?.profileId===manifest.profileId,'B_WINDOWS_REPORT_SCOPE');
   const r=await bridge.recordJsonTxtResult({requestId:report.requestId,
    report});
   return {json:r?.json===true,txt:r?.txt===true};
  },
 });
}

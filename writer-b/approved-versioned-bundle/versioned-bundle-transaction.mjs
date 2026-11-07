// Generic B transaction coordinator. NO local I/O, shell or network.
// Only the already installed, separately authorized Writer B receiver can
// provide an adapter with the capabilities documented in README.md.
// This is a testable protocol prototype, NOT a deployed/approved Receiver.
import {createHash} from 'node:crypto';
import {buildVersionedBundlePlan} from './versioned-bundle-plan.mjs';

const SHA64=/^[a-f0-9]{64}$/;
const SHA40=/^[a-f0-9]{40}$/;
const hashBytes=b=>createHash('sha256').update(b).digest('hex');
const fail=code=>{const error=Error(code);error.code=code;throw error;};
const expect=(condition,code)=>{if(!condition)fail(code);};
const errno=error=>typeof error?.code==='string'&&/^B_[A-Z0-9_]+$/.test(error.code)
 ?error.code:'B_ADAPTER_ERROR';
const RUNTIME_STEPS=[
 'authenticatePinnedApproval','inspectPreimage','acquireSharedWriterLock',
 'verifyPreimageUnderLock','stageVerifiedBundle','backupPreimages',
 'casActivate','readBack','commit','rollback','verifyRollback',
 'releaseSharedWriterLock','recordResult'
];

function compareSnapshot(snapshot,manifest,after=false){
 expect(snapshot&&typeof snapshot==='object','B_SNAPSHOT_INVALID');
 const expectedTask=manifest.activation.task;
 expect(snapshot.task?.name===expectedTask.name&&
  snapshot.task?.time===expectedTask.time&&
  snapshot.task?.state===expectedTask.requiredState&&
  snapshot.task?.xmlSha256===expectedTask.beforeXmlSha256,'B_TASK_DRIFT');
 const expectedLaunchers=manifest.activation.launchers;
 expect(Array.isArray(snapshot.launchers)&&snapshot.launchers.length===expectedLaunchers.length,
  'B_LAUNCHER_DRIFT');
 const found=new Map(snapshot.launchers.map(l=>[l.name?.toLowerCase(),l.sha256]));
 expect(found.size===expectedLaunchers.length,'B_LAUNCHER_DRIFT');
 for(const launcher of expectedLaunchers){
  expect(found.get(launcher.name.toLowerCase())===
   (after?launcher.afterSha256:launcher.beforeSha256),'B_LAUNCHER_DRIFT');
 }
 const expectedRecord=manifest.activation.activeRecord;
 expect(snapshot.activeRecord?.name===expectedRecord.name&&
  snapshot.activeRecord?.sha256===
  (after?expectedRecord.afterSha256:expectedRecord.beforeSha256),'B_ACTIVE_DRIFT');
 if(after){
  expect(snapshot.bundleVersion===manifest.bundle.version&&
   snapshot.fileListSha256===
    hashBytes(JSON.stringify([...manifest.bundle.files].sort((a,b)=>
     a.path<b.path?-1:a.path>b.path?1:0))),'B_BUNDLE_READBACK_DRIFT');
 }
}

/**
 * Requires an adapter from the APPROVED, installed common Writer-B receiver.
 * No operationName, arbitrary command/path or executable is read from an Issue.
 *
 * pinnedApproval must be built from the receiver's fixed approval registration
 * (not user/Issue JSON). Receiver authenticates that exact raw manifest digest
 * at the immutable Git approvalRef in authenticatePinnedApproval.
 *
 * Returns a report; activation is irreversible only after commit. If rollback
 * cannot be proven, result is STATE_UNKNOWN and caller must retain the shared
 * lock / journal for an authorized recovery rather than retry.
 */
export async function runVersionedBundleTransaction({
 rawManifest,pinnedApproval,trustedProfiles,adapter,
}={}){
 const state={requestId:pinnedApproval?.requestId??null,phase:'START',status:'BLOCKED',
  code:null,plan:null,stages:[],rollback:null,reportStatus:'NOT_ATTEMPTED'};
 let lock=null,backup=null,staged=null,committed=false,retainLock=false;
 let manifest=null;
 try{
  const raw=Buffer.isBuffer(rawManifest)?rawManifest:
   typeof rawManifest==='string'?Buffer.from(rawManifest,'utf8'):null;
  expect(raw!==null&&raw.length>0&&raw.length<=262144,'B_MANIFEST_RAW_SIZE');
  expect(pinnedApproval!==null&&typeof pinnedApproval==='object'&&
   Object.keys(pinnedApproval).sort().join('|')===
   ['requestId','rawManifestSha256','approvalRef','sourceSha','profileId'].sort().join('|'),
   'B_PIN_FORMAT');
  expect(typeof pinnedApproval.requestId==='string'&&
   /^[a-zA-Z0-9_-]{12,128}$/.test(pinnedApproval.requestId)&&
   SHA64.test(pinnedApproval.rawManifestSha256)&&SHA40.test(pinnedApproval.sourceSha)&&
   typeof pinnedApproval.approvalRef==='string'&&
   /^[a-z0-9_.\/-]{10,200}$/i.test(pinnedApproval.approvalRef)&&
   !pinnedApproval.approvalRef.includes('..'),'B_PIN_FORMAT');
  const digest=hashBytes(raw);
  expect(digest===pinnedApproval.rawManifestSha256,'B_PIN_RAW_HASH_DRIFT');
  try{manifest=JSON.parse(raw.toString('utf8'));}
  catch{fail('B_MANIFEST_JSON');}
  expect(manifest?.profileId===pinnedApproval.profileId&&
   manifest.sourceSha===pinnedApproval.sourceSha,'B_PIN_MANIFEST_DRIFT');
  state.plan=buildVersionedBundlePlan(manifest,trustedProfiles);
  for(const name of RUNTIME_STEPS){
   expect(typeof adapter?.[name]==='function','B_ADAPTER_INCOMPLETE');
  }
  state.phase='AUTHORIZE';
  const auth=await adapter.authenticatePinnedApproval({
   pin:pinnedApproval,rawSha256:digest,manifestSchema:manifest.schema,
   manifestProfileId:manifest.profileId,manifestSourceSha:manifest.sourceSha,
  });
  expect(auth?.verified===true&&auth.rawSha256===digest,'B_AUTH_FAILED');
  state.stages.push('APPROVED');

  state.phase='PREIMAGE';
  compareSnapshot(await adapter.inspectPreimage({plan:state.plan}),manifest);
  state.stages.push('PREIMAGE_CHECKED');

  state.phase='LOCK';
  lock=await adapter.acquireSharedWriterLock({
   requestId:pinnedApproval.requestId,profileId:manifest.profileId});
  expect(lock!==null&&lock!==undefined,'B_LOCK_FAILED');
  state.stages.push('LOCKED');
  compareSnapshot(await adapter.verifyPreimageUnderLock({lock,plan:state.plan}),manifest);

  state.phase='STAGE';
  staged=await adapter.stageVerifiedBundle({lock,plan:state.plan,manifest,
   pinnedApproval});
  expect(staged?.verified===true&&staged?.fileListSha256===state.plan.fileListSha256,
   'B_STAGE_HASH_DRIFT');
  state.stages.push('STAGED');

  state.phase='BACKUP';
  backup=await adapter.backupPreimages({lock,plan:state.plan,manifest});
  expect(backup?.complete===true&&typeof backup?.journalId==='string'&&
   backup.journalId.length>0,'B_BACKUP_FAILED');
  state.stages.push('BACKED_UP');

  state.phase='CAS_ACTIVATE';
  const activated=await adapter.casActivate({lock,backup,staged,plan:state.plan,manifest});
  expect(activated?.activated===true,'B_ACTIVATION_FAILED');
  state.stages.push('ACTIVATED');

  state.phase='READBACK';
  compareSnapshot(await adapter.readBack({lock,plan:state.plan}),manifest,true);
  state.stages.push('READBACK_PASS');

  state.phase='COMMIT';
  const final=await adapter.commit({lock,backup,plan:state.plan});
  expect(final?.committed===true,'B_COMMIT_UNKNOWN');
  committed=true;
  state.status='PASS';
  state.phase='COMPLETE';
  state.code=null;
 }catch(error){
  state.code=errno(error);
  state.status='BLOCKED';
  // A potentially ambiguous commit is NOT safe to treat as failed or to replay.
  if(state.phase==='COMMIT'){
   state.status='STATE_UNKNOWN';
   retainLock=true;
  }else if(state.phase==='BACKUP'){
   // Backup may have created a partial recovery journal. Operational
   // preimages should be unchanged, but keep ownership until the adapter
   // verifies/repairs the partial durable backup independently.
   state.status='STATE_UNKNOWN';
   state.code='B_BACKUP_UNKNOWN';
   retainLock=true;
  }else if(lock!==null&&backup!==null&&!committed){
   state.phase='ROLLBACK';
   try{
    const restored=await adapter.rollback({lock,backup,staged,plan:state.plan});
    expect(restored?.rolledBack===true,'B_ROLLBACK_UNKNOWN');
    compareSnapshot(await adapter.verifyRollback({lock,plan:state.plan}),manifest);
    state.rollback='VERIFIED';
    state.stages.push('ROLLBACK_PASS');
   }catch{
    state.rollback='UNVERIFIED';
    state.status='STATE_UNKNOWN';
    state.code='B_ROLLBACK_UNKNOWN';
    retainLock=true;
   }
  }
 }finally{
  if(lock!==null&&!retainLock){
   try{await adapter.releaseSharedWriterLock({lock});}
   catch{
    state.status='STATE_UNKNOWN';
    state.code='B_LOCK_RELEASE_UNKNOWN';
    retainLock=true;
   }
  }
  state.retainLockForRecovery=retainLock;
  const report={
   requestId:state.requestId,status:state.status,code:state.code,phase:state.phase,
   bundleVersion:state.plan?.bundleVersion??null,profileId:state.plan?.profileId??null,
   sourceSha:state.plan?.sourceSha??null,stages:state.stages,
   rollback:state.rollback,retainLockForRecovery:state.retainLockForRecovery,
  };
  if(typeof adapter?.recordResult==='function'){
   try{
    const written=await adapter.recordResult({report});
    state.reportStatus=written?.json===true&&written?.txt===true?'JSON_TXT_2_OF_2':'INCOMPLETE';
   }catch{state.reportStatus='INCOMPLETE';}
  }
  return Object.freeze({...report,reportStatus:state.reportStatus});
 }
}

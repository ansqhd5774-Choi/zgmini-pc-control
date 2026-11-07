// Bounded, read-only preflight for the EXISTING calendar Windows B receiver.
// No task disabling, lease acquisition, Git switch, source/config write or B
// approval is performed. A feature-owned, authenticated one-shot Windows host
// supplies independent read-only evidence; Issue JSON alone is not evidence.
import {coreSourceIdentity} from './contract.mjs';
import {D30_WINDOWS_SOURCE_ROOT} from './windows-preview.mjs';
import {makeD30BManifestDraft} from './windows-b-simulator.mjs';

const ROOT=D30_WINDOWS_SOURCE_ROOT;
const NODE=String.raw`E:\ZGmini\runtime\node.exe`;
const TASK='ZGMINI-PC-Local-Core';
const LOCK=String.raw`E:\ZGmini\data\pc-writer\writer-source-install.lock`;
const SHA40=/^[a-f0-9]{40}$/;
const SHA64=/^[a-f0-9]{64}$/;
const fail=(code,detail)=>({status:'READ_ONLY_B_PREFLIGHT_BLOCKED',code,
  detail,sourceProvenance:'UNVERIFIED',operationalWrites:0});
const paths=makeD30BManifestDraft().files.map(f=>f.path);

/**
 * Required feature-owned trusted host read-only operations:
 * inspectSourceGit() -> {sourceRoot,head,trackedDirty:false,gitVerified:true}
 * inspectTaskLaunchChain() -> {taskName,sourceRoot,nodePath,taskXmlSha256,
 *   chainVerified:true,taskXmlReadbackVerified:true,vbsOrDirectNodeVerified:true}
 *   It MUST actually resolve Task XML -> VBS (if present) -> Node -> source,
 *   never infer a launch chain from git HEAD or a string in config.
 * inspectWriterConfig() -> {sourceSha,sourceRoot,readbackVerified:true}
 * inspectWriterCheckpoint() -> {sourceSha,readbackVerified:true}
 * inspectSourceConsumers() -> [{name,sourceSha?,followsConfigSource?},...]
 * inspectExactFileHashes(paths) -> {path:sha256}; only three fixed paths
 * inspectSharedSourceLock() -> {path:LOCK,held:boolean,readbackVerified:true}
 * inspectReadOnlyEvidenceId() -> {issue:positive integer,requestId:nonempty}
 *
 * The B executor must separately acquire the shared lock, quiesce actual
 * consumers, re-attest old SHA, stage exact bytes, obtain B approval and
 * install with backup/rollback. This READY is not installation permission.
 */
export async function inspectD30WindowsBReadOnlyPreflight({host}={}){
  const functions=['inspectSourceGit','inspectTaskLaunchChain','inspectWriterConfig',
    'inspectWriterCheckpoint','inspectSourceConsumers','inspectExactFileHashes',
    'inspectSharedSourceLock','inspectReadOnlyEvidenceId'];
  if(functions.some(name=>typeof host?.[name]!=='function'))
    return fail('ER1_D30_B_FEATURE_HOST_INCOMPLETE',
      'Authenticated feature one-shot host must expose eight read-only inspections.');
  let git,task,config,checkpoint,consumers,files,lock,evidence;
  try{
    [git,task,config,checkpoint,consumers,files,lock,evidence]=await Promise.all([
      host.inspectSourceGit(),host.inspectTaskLaunchChain(),
      host.inspectWriterConfig(),host.inspectWriterCheckpoint(),
      host.inspectSourceConsumers(),host.inspectExactFileHashes([...paths]),
      host.inspectSharedSourceLock(),host.inspectReadOnlyEvidenceId()]);
  }catch{
    return fail('ER1_D30_B_SOURCE_READ_FAILED','An independent read-only probe failed.');
  }
  if(git?.sourceRoot!==ROOT||!SHA40.test(git.head??'')||
      git.gitVerified!==true||typeof git.trackedDirty!=='boolean'||
      git.sourceTrackedDirtyScope!=='PINNED_TARGET_3FILES')
    return fail('ER1_D30_B_GIT_SOURCE_UNVERIFIED',
      'Operational source HEAD or bounded target-file change inventory is not proven.');
  if(task?.taskName!==TASK||task.sourceRoot!==ROOT||
      task.nodePath!==NODE||!SHA64.test(task.taskXmlSha256??'')||
      task.chainVerified!==true||task.taskXmlReadbackVerified!==true||
      task.vbsOrDirectNodeVerified!==true)
    return fail('ER1_D30_B_TASK_CHAIN_UNRESOLVED',
      'Task XML to VBS/direct Node to fixed E: source has not been proven.');
  if(config?.sourceRoot!==ROOT||config.readbackVerified!==true||
      config.sourceSha!==git.head)
    return fail('ER1_D30_B_CONFIG_SOURCE_MISMATCH','config.source differs from actual source HEAD.');
  const lastRunSourceStatus=checkpoint?.readbackVerified===true?
    checkpoint.sourceSha===git.head?'MATCH':'STALE_HISTORICAL':'UNAVAILABLE';
  // The Core publisher is the consumer of the D+30 source files. The archive
  // sidecar is a separately chained downstream process; unknown source pin in
  // that sidecar is reported, not silently treated as a mismatch in Core source.
  // Actual B must still protect every overlapping writer during quiescence.
  if(!Array.isArray(consumers)||!consumers.some(c=>c?.name==='CORE_PUBLISHER'&&
      (c.sourceSha===git.head||c.followsConfigSource===true)))
    return fail('ER1_D30_B_SHARED_CONSUMER_UNVERIFIED',
      'Core publisher binding to the D+30 operational source is unverified.');
  const sidecar=consumers.find(c=>c?.name==='CNN_ARCHIVE_SIDECAR');
  const sidecarSourceBinding=sidecar?.sourceSha===git.head||
    sidecar?.followsConfigSource===true?'CORROBORATED':'UNVERIFIED_NON_BLOCKING';
  if(lock?.path!==LOCK||lock.readbackVerified!==true||lock.held!==false)
    return fail('ER1_D30_B_SHARED_SOURCE_LOCK_BUSY_OR_UNKNOWN',
      'The common source-write lease must be visibly available before requesting B.');
  const draft=makeD30BManifestDraft();
  if(!files||typeof files!=='object'||Array.isArray(files)||
      Object.keys(files).sort().join('|')!==[...paths].sort().join('|')||
      draft.files.some(f=>files[f.path]!==f.beforeSha256))
    return fail('ER1_D30_B_PREVIEW_BEFORE_SHA_DRIFT',
      'One of the exact three PC files differs from verified #682 preimage.');
  if(!Number.isSafeInteger(evidence?.issue)||evidence.issue<=0||
      !String(evidence.requestId||'').trim())
    return fail('ER1_D30_B_EVIDENCE_ID_MISSING','Trusted A probe request identity is missing.');

  // An idle registered source is distinct from a verified running process.
  const activeCore={runtimeSourceVerified:false,
    evidenceLevel:'REGISTERED_CORE_SOURCE_PROVENANCE_VERIFIED',
    sourceRoot:ROOT,operationalSourceSha:git.head,gitVerified:true,
    taskLauncherSourceVerified:true,configSourceMatchesHead:true,
    writerCheckpointMatchesHead:lastRunSourceStatus==='MATCH',
    trackedDirty:git.trackedDirty,
    sourceTrackedDirtyScope:'PINNED_TARGET_3FILES',pinnedOverlayVerified:true,
    evidenceIssue:evidence.issue,evidenceRequestId:evidence.requestId};
  if(coreSourceIdentity(activeCore)!==git.head)
    return fail('ER1_D30_B_SOURCE_PROVENANCE_INCOMPLETE',
      'The corroborated source origin did not meet the shared D30 contract.');
  const report={status:'READ_ONLY_B_PREFLIGHT_SOURCE_VERIFIED',
    sourceProvenance:'REGISTERED_CORE_SOURCE_PROVENANCE_VERIFIED',
    beforeSourceSha:git.head,sourceRoot:ROOT,
    previewEvidenceIssue:682,preflightEvidenceIssue:evidence.issue,
    threeFileBeforeShaVerified:true,sharedSourceLease:'AVAILABLE_AT_PROBE_TIME',
    threeFileTrackedOverlayObserved:git.trackedDirty,
    lastRunSourceStatus,
    sidecarSourceBinding,
    bApproval:'NOT_VERIFIED',bInstall:'NOT_STARTED',operationalWrites:0};
  return Buffer.byteLength(JSON.stringify(report),'utf8')<32_768?report:
    fail('ER1_D30_B_REPORT_SIZE_STOP','Bounded result exceeds 32KB.');
}

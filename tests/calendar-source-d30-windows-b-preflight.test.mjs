import assert from 'node:assert/strict';
import test from 'node:test';
import {D30_WINDOWS_SOURCE_ROOT} from '../calendar-source-d30/windows-preview.mjs';
import {makeD30BManifestDraft} from '../calendar-source-d30/windows-b-simulator.mjs';
import {inspectD30WindowsBReadOnlyPreflight}
  from '../calendar-source-d30/windows-b-preflight.mjs';

const ROOT=D30_WINDOWS_SOURCE_ROOT;
const HEAD='a'.repeat(40);
const files=Object.fromEntries(makeD30BManifestDraft().files.map(f=>
  [f.path,f.beforeSha256]));
function fixture(){
  const values={
    git:{sourceRoot:ROOT,head:HEAD,trackedDirty:false,
      sourceTrackedDirtyScope:'PINNED_TARGET_3FILES',gitVerified:true},
    task:{taskName:'ZGMINI-PC-Local-Core',sourceRoot:ROOT,
      nodePath:'E:\\ZGmini\\runtime\\node.exe',taskXmlSha256:'b'.repeat(64),
      chainVerified:true,taskXmlReadbackVerified:true,vbsOrDirectNodeVerified:true},
    config:{sourceRoot:ROOT,sourceSha:HEAD,readbackVerified:true},
    checkpoint:{sourceSha:HEAD,readbackVerified:true},
    consumers:[{name:'CORE_PUBLISHER',sourceSha:HEAD},
      {name:'CNN_ARCHIVE_SIDECAR',followsConfigSource:true}],
    files:{...files},
    lock:{path:'E:\\ZGmini\\data\\pc-writer\\writer-source-install.lock',
      held:false,readbackVerified:true},
    evidence:{issue:999,requestId:'synthetic-unit-readonly-evidence'},
  };
  const host={
    inspectSourceGit:async()=>values.git,
    inspectTaskLaunchChain:async()=>values.task,
    inspectWriterConfig:async()=>values.config,
    inspectWriterCheckpoint:async()=>values.checkpoint,
    inspectSourceConsumers:async()=>values.consumers,
    inspectExactFileHashes:async paths=>{
      assert.deepEqual(paths,Object.keys(files));return values.files;},
    inspectSharedSourceLock:async()=>values.lock,
    inspectReadOnlyEvidenceId:async()=>values.evidence,
  };
  return {host,values};
}

test('aligned synthetic Task→Node/source+config/checkpoint/consumers is only preflight, never B success',async()=>{
  const {host}=fixture();
  const r=await inspectD30WindowsBReadOnlyPreflight({host});
  assert.equal(r.status,'READ_ONLY_B_PREFLIGHT_SOURCE_VERIFIED');
  assert.equal(r.sourceProvenance,'REGISTERED_CORE_SOURCE_PROVENANCE_VERIFIED');
  assert.equal(r.bApproval,'NOT_VERIFIED');
  assert.equal(r.bInstall,'NOT_STARTED');
  assert.equal(r.operationalWrites,0);
});

test('config.source mismatch stops without mutating source',async()=>{
  const {host,values}=fixture();values.config.sourceSha='c'.repeat(40);
  const r=await inspectD30WindowsBReadOnlyPreflight({host});
  assert.equal(r.code,'ER1_D30_B_CONFIG_SOURCE_MISMATCH');
  assert.equal(r.operationalWrites,0);
});

test('historical last-run checkpoint may be stale without blocking registered source',async()=>{
  const {host,values}=fixture();values.checkpoint.sourceSha='d'.repeat(40);
  const r=await inspectD30WindowsBReadOnlyPreflight({host});
  assert.equal(r.status,'READ_ONLY_B_PREFLIGHT_SOURCE_VERIFIED');
  assert.equal(r.lastRunSourceStatus,'STALE_HISTORICAL');
  assert.equal(r.bInstall,'NOT_STARTED');
});

test('unknown sidecar source is advisory while corroborated Core publisher can pass',async()=>{
  const {host,values}=fixture();
  values.consumers[1]={name:'CNN_ARCHIVE_SIDECAR',sourceSha:null,
    followsConfigSource:false,archiveWrapperObserved:true};
  const r=await inspectD30WindowsBReadOnlyPreflight({host});
  assert.equal(r.status,'READ_ONLY_B_PREFLIGHT_SOURCE_VERIFIED');
  assert.equal(r.sidecarSourceBinding,'UNVERIFIED_NON_BLOCKING');
  assert.equal(r.bApproval,'NOT_VERIFIED');
  assert.equal(r.bInstall,'NOT_STARTED');
});

test('unverified Core publisher still blocks regardless of sidecar',async()=>{
  const {host,values}=fixture();
  values.consumers[0]={name:'CORE_PUBLISHER',sourceSha:null};
  const r=await inspectD30WindowsBReadOnlyPreflight({host});
  assert.equal(r.code,'ER1_D30_B_SHARED_CONSUMER_UNVERIFIED');
});

test('approved three-file PC overlay passes exact SHA provenance without global clean gate',async()=>{
  const {host,values}=fixture();values.git.trackedDirty=true;
  const r=await inspectD30WindowsBReadOnlyPreflight({host});
  assert.equal(r.status,'READ_ONLY_B_PREFLIGHT_SOURCE_VERIFIED');
  assert.equal(r.threeFileTrackedOverlayObserved,true);
  assert.equal(r.threeFileBeforeShaVerified,true);
});

test('Task XML to VBS/Node launcher chain unresolved does not fake provenance',async()=>{
  const {host,values}=fixture();values.task.vbsOrDirectNodeVerified=false;
  const r=await inspectD30WindowsBReadOnlyPreflight({host});
  assert.equal(r.code,'ER1_D30_B_TASK_CHAIN_UNRESOLVED');
  assert.equal(r.sourceProvenance,'UNVERIFIED');
});

test('any one of three PC preimage SHA changes blocks #682 preflight',async()=>{
  const {host,values}=fixture();
  values.files['scripts/pc-writer/earnings-api-local.mjs']='9'.repeat(64);
  const r=await inspectD30WindowsBReadOnlyPreflight({host});
  assert.equal(r.code,'ER1_D30_B_PREVIEW_BEFORE_SHA_DRIFT');
});

test('occupied common source-write lock stops; no global Runner idle gate',async()=>{
  const {host,values}=fixture();values.lock.held=true;
  const r=await inspectD30WindowsBReadOnlyPreflight({host});
  assert.equal(r.code,'ER1_D30_B_SHARED_SOURCE_LOCK_BUSY_OR_UNKNOWN');
});

test('unavailable feature-owned one-shot host method is an explicit integration gap',async()=>{
  const {host}=fixture();delete host.inspectTaskLaunchChain;
  const r=await inspectD30WindowsBReadOnlyPreflight({host});
  assert.equal(r.code,'ER1_D30_B_FEATURE_HOST_INCOMPLETE');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {classify996CPhysicalDisposition as classify,
  C996PhysicalDispositionPhases as PHASE} from
  '../tools/controller-996-c-physical-disposition-readonly.mjs';

const REQ='pc-update-0010b2cf-9bca-40cf-89c5-b750fa42b404';
const ID='8e3893f0-8124-4fda-a370-871a6b81031e';
const h=x=>x.repeat(64);
const PINS={
  oldC:{
    'owner.json':h('a'),
    'PREPARED.json':h('b'),
    'WORKFLOW_ENABLE_ATTEMPTED.json':h('c'),
    'BACKLOG_CLOSE_ATTEMPTED.json':h('d'),
  },
  install:{'owner.json':h('e'),'RECOVERY_REQUIRED.json':h('f')},
  continuationBeforeReady:{
    'owner.json':h('1'),
    'PREPARED.json':h('2'),
    'OLD_C_CLAIM_ARCHIVE_ATTEMPTED.json':h('3'),
  },
  readySha256:h('4'),sourceLockSha256:h('5'),
};
const CREADY={...PINS.continuationBeforeReady,
  'READY_TO_RELEASE_INSTALL.json':PINS.readySha256};
const OWNER={requestId:ID,originalRequestId:REQ,nonce:'independent-test-nonce-0001'};
const READY={
  schema:'ZGMINI_996_CONTINUATION_READY_V1',
  name:'READY_TO_RELEASE_INSTALL',requestId:ID,originalRequestId:REQ,
  ownerNonce:OWNER.nonce,sourceLockSha256:PINS.sourceLockSha256,
  oldCArchiveOwnerSha256:PINS.oldC['owner.json'],
  installOwnerSha256:PINS.install['owner.json'],
  installRecoverySha256:PINS.install['RECOVERY_REQUIRED.json'],
  finalReleasePending:true,
};
const clone=o=>structuredClone(o);
const empty=()=>({present:false,files:null});
const present=(files)=>({present:true,files:clone(files)});

function fixture(phase){
  const paths={oldC:empty(),oldCArchive:empty(),continuation:empty(),
    continuationArchive:empty(),install:empty(),installArchive:empty()};
  let continuationOwner=null,ready=null;
  switch(phase){
    case 'ORIGINAL':
      paths.oldC=present(PINS.oldC);paths.install=present(PINS.install);
      break;
    case 'CLAIMED':
      paths.oldC=present(PINS.oldC);
      paths.continuation=present(PINS.continuationBeforeReady);
      paths.install=present(PINS.install);
      continuationOwner=clone(OWNER);
      break;
    case 'OLD':
      paths.oldCArchive=present(PINS.oldC);
      paths.continuation=present(PINS.continuationBeforeReady);
      paths.install=present(PINS.install);
      continuationOwner=clone(OWNER);
      break;
    case 'READY':
      paths.oldCArchive=present(PINS.oldC);
      paths.continuation=present(CREADY);
      paths.install=present(PINS.install);
      continuationOwner=clone(OWNER);ready=clone(READY);
      break;
    case 'CONT':
      paths.oldCArchive=present(PINS.oldC);
      paths.continuationArchive=present(CREADY);
      paths.install=present(PINS.install);
      continuationOwner=clone(OWNER);ready=clone(READY);
      break;
    case 'INSTALL':
      paths.oldCArchive=present(PINS.oldC);
      paths.continuationArchive=present(CREADY);
      paths.installArchive=present(PINS.install);
      continuationOwner=clone(OWNER);ready=clone(READY);
      break;
    default:throw Error('invalid test fixture phase');
  }
  return {snapshot:{
    schema:'ZGMINI_CONTROLLER_996_C_PHYSICAL_SNAPSHOT_V1',
    originalRequestId:REQ,continuationRequestId:ID,
    readOnly:true,twoSnapshotsIdentical:true,fresh:true,
    conflicts:{workflowState:'active',protectionVerified:true,
      writerActiveCount:0,controllerActiveCount:0,otherContinuationCount:0},
    paths,continuationOwner,ready,
  },pins:clone(PINS)};
}
const assertBounded=r=>{
  assert.equal(r.executionAuthorized,false);
  assert.equal(r.productionExecutable,false);
  assert.equal(r.liveOriginalPcVerified,false);
  assert.equal(r.independentAuthentication,false);
  for(const k of ['operationalWrites','workflowPuts','backlogWrites',
    'issuePosts','pcRetries'])assert.equal(r[k],0,k);
  assert.equal(r.cleanupPerformed,false);
};
const reject=(value,expected)=>{
  const r=classify(value);
  assert.equal(r.status,'C_DISPOSITION_SNAPSHOT_BLOCKED');
  assert.equal(r.phase,'UNKNOWN');
  assert.equal(r.code,expected);
  assertBounded(r);
};

test('six admissible injected positions are distinctly classified but never authorized',()=>{
  for(const [input,phase] of [
    ['ORIGINAL',PHASE.ORIGINAL],['CLAIMED',PHASE.CLAIMED],
    ['OLD',PHASE.AFTER_OLD],['READY',PHASE.AFTER_READY],
    ['CONT',PHASE.AFTER_CONT],['INSTALL',PHASE.AFTER_INSTALL],
  ]){
    const r=classify(fixture(input));
    assert.equal(r.status,'C_DISPOSITION_SNAPSHOT_CLASSIFIED_ONLY',input);
    assert.equal(r.phase,phase,input);
    assertBounded(r);
  }
});

test('missing snapshot, stale CAS, changed original request, and wrong UUID stop',()=>{
  reject({},'C_DISPOSITION_INPUT_OR_CAS_UNVERIFIED');
  for(const alter of [s=>{s.fresh=false;},s=>{s.twoSnapshotsIdentical=false;},
    s=>{s.readOnly=false;},s=>{s.originalRequestId='other';},
    s=>{s.continuationRequestId='not-a-uuid';}]){
    const x=fixture('ORIGINAL');alter(x.snapshot);
    reject(x,'C_DISPOSITION_INPUT_OR_CAS_UNVERIFIED');
  }
});

test('active Writer, Controller, another continuation or protection drift stop',()=>{
  for(const alter of [c=>{c.writerActiveCount=1;},
    c=>{c.controllerActiveCount=1;},c=>{c.otherContinuationCount=1;},
    c=>{c.workflowState='disabled';},c=>{c.protectionVerified=false;}]){
    const x=fixture('CONT');alter(x.snapshot.conflicts);
    reject(x,'C_DISPOSITION_CONFLICT_OR_PROTECTION_UNKNOWN');
  }
});

test('untrusted or missing original and continuation SHA pins stop',()=>{
  for(const alter of [p=>{p.oldC['owner.json']='BAD';},
    p=>{delete p.install['owner.json'];},
    p=>{p.continuationBeforeReady['bad.txt']=h('0');},
    p=>{p.readySha256='not-sha';},
    p=>{p.sourceLockSha256='not-sha';}]){
    const x=fixture('CONT');alter(x.pins);
    reject(x,'C_DISPOSITION_PINS_INVALID');
  }
});

test('duplicate source and archive entries fail closed at every stage',()=>{
  for(const [phase,source,archive,files] of [
    ['ORIGINAL','oldC','oldCArchive',PINS.oldC],
    ['OLD','continuation','continuationArchive',CREADY],
    ['CONT','install','installArchive',PINS.install],
  ]){
    const x=fixture(phase);x.snapshot.paths[archive]=present(files);
    reject(x,'C_DISPOSITION_SOURCE_ARCHIVE_COLLISION');
  }
});

test('source or archive file-set/SHA drift never classifies as healthy',()=>{
  for(const [phase,p,key] of [
    ['ORIGINAL','oldC','owner.json'],
    ['OLD','oldCArchive','PREPARED.json'],
    ['CONT','install','RECOVERY_REQUIRED.json'],
    ['INSTALL','installArchive','owner.json'],
  ]){
    const x=fixture(phase);
    x.snapshot.paths[p].files[key]=h('0');
    reject(x,'C_DISPOSITION_ORIGINAL_PIN_DRIFT');
  }
  const extra=fixture('OLD');
  extra.snapshot.paths.oldCArchive.files['extra.json']=h('a');
  reject(extra,'C_DISPOSITION_ORIGINAL_PIN_DRIFT');
});

test('continuation source/READY digest drift is blocked',()=>{
  for(const phase of ['CLAIMED','OLD','READY','CONT','INSTALL']){
    const x=fixture(phase),path=x.snapshot.paths.continuation.present?
      'continuation':'continuationArchive';
    x.snapshot.paths[path].files['owner.json']=h('0');
    reject(x,'C_DISPOSITION_CONTINUATION_PIN_DRIFT');
  }
  const x=fixture('CONT');
  x.snapshot.paths.continuationArchive.files['READY_TO_RELEASE_INSTALL.json']=h('0');
  reject(x,'C_DISPOSITION_CONTINUATION_PIN_DRIFT');
});

test('READY marker cannot refer to another source lock, owner, request or install',()=>{
  for(const alter of [r=>{r.sourceLockSha256=h('0');},
    r=>{r.ownerNonce='spoof';},r=>{r.requestId='another';},
    r=>{r.oldCArchiveOwnerSha256=h('0');},
    r=>{r.installRecoverySha256=h('0');},
    r=>{r.finalReleasePending=false;}]){
    const x=fixture('CONT');alter(x.snapshot.ready);
    reject(x,'C_DISPOSITION_READY_PROOF_INVALID');
  }
  const badOwner=fixture('CONT');badOwner.snapshot.continuationOwner.nonce='short';
  reject(badOwner,'C_DISPOSITION_CONTINUATION_OWNER_INVALID');
});

test('absence must carry null inventory and malformed path maps are unknown',()=>{
  const absentButFiles=fixture('ORIGINAL');
  absentButFiles.snapshot.paths.oldCArchive.files={};
  reject(absentButFiles,'C_DISPOSITION_PATH_INVENTORY_UNKNOWN');
  const missing=fixture('ORIGINAL');delete missing.snapshot.paths.installArchive;
  reject(missing,'C_DISPOSITION_PATH_SHAPE_UNKNOWN');
  const noFiles=fixture('ORIGINAL');noFiles.snapshot.paths.oldC.files=null;
  reject(noFiles,'C_DISPOSITION_PATH_INVENTORY_UNKNOWN');
});

test('partial move, new install owner after release and READY missing are unknown',()=>{
  const noContinuation=fixture('OLD');
  noContinuation.snapshot.paths.continuation=empty();
  noContinuation.snapshot.continuationOwner=null;
  reject(noContinuation,'C_DISPOSITION_PARTIAL_OR_UNKNOWN');
  const nextOwner=fixture('INSTALL');
  nextOwner.snapshot.paths.install=present({'owner.json':h('0')});
  reject(nextOwner,'C_DISPOSITION_SOURCE_ARCHIVE_COLLISION');
  const readyMissing=fixture('CONT');
  readyMissing.snapshot.paths.continuationArchive=present(PINS.continuationBeforeReady);
  readyMissing.snapshot.ready=null;
  reject(readyMissing,'C_DISPOSITION_FINAL_STAGE_WITHOUT_READY');
});

test('extra READY data before oldC archival or orphan evidence blocks',()=>{
  const early=fixture('CLAIMED');
  early.snapshot.paths.continuation=present(CREADY);early.snapshot.ready=clone(READY);
  reject(early,'C_DISPOSITION_READY_BEFORE_OLD_ARCHIVE');
  const orphan=fixture('ORIGINAL');orphan.snapshot.ready=clone(READY);
  reject(orphan,'C_DISPOSITION_ORPHAN_CONTINUATION_EVIDENCE');
  const unpinned=fixture('OLD');unpinned.snapshot.ready=clone(READY);
  reject(unpinned,'C_DISPOSITION_UNPINNED_READY_PRESENT');
});

test('implementation has no runtime I/O or authority-bearing entrypoint',()=>{
  const source=readFileSync(fileURLToPath(new URL(
    '../tools/controller-996-c-physical-disposition-readonly.mjs',
    import.meta.url)),'utf8');
  for(const forbidden of ["from 'node:fs'","from 'node:child_process'",
    'Directory.Move','fs.rename','mkdir','writeFile','fetch(',
    'Invoke-RestMethod','workflow_dispatch','Set-ExecutionPolicy']){
    assert.equal(source.includes(forbidden),false,forbidden);
  }
  assert.match(source,/executionAuthorized:false/);
  assert.match(source,/independentAuthentication:false/);
});

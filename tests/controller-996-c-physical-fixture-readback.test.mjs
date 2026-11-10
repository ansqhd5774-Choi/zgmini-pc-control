import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomBytes,createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {inspect996CPhysicalFixtureReadOnly as inspect} from
  '../tools/controller-996-c-physical-fixture-readback.mjs';

const REQ='pc-update-0010b2cf-9bca-40cf-89c5-b750fa42b404';
const ID='8e3893f0-8124-4fda-a370-871a6b81031e';
const SRC='abc123'.repeat(10)+'abcd';
const sha=b=>createHash('sha256').update(b).digest('hex');
const bytes=obj=>Buffer.from(JSON.stringify(obj)+'\n');
const hex=x=>sha(bytes(x));
const OLD={
  'owner.json':bytes({requestId:REQ,nonce:'old-claim-fixed'}),
  'PREPARED.json':bytes({name:'PREPARED'}),
  'WORKFLOW_ENABLE_ATTEMPTED.json':bytes({name:'WORKFLOW_ENABLE_ATTEMPTED'}),
  'BACKLOG_CLOSE_ATTEMPTED.json':bytes({name:'BACKLOG_CLOSE_ATTEMPTED'}),
};
const INSTALL={
  'owner.json':bytes({nonce:'installed-fixed'}),
  'RECOVERY_REQUIRED.json':bytes({reason:'previous C interrupted'}),
};
const OWNER={requestId:ID,originalRequestId:REQ,
  nonce:'test-fixture-continuation-nonce-001'};
const CONT={
  'owner.json':bytes(OWNER),
  'PREPARED.json':bytes({originalRequestId:REQ}),
  'OLD_C_CLAIM_ARCHIVE_ATTEMPTED.json':bytes({name:'attempted'}),
};
const digestFiles=files=>Object.fromEntries(
  Object.entries(files).map(([k,v])=>[k,sha(v)]));
const PINS={oldC:digestFiles(OLD),install:digestFiles(INSTALL),
  continuationBeforeReady:digestFiles(CONT),sourceLockSha256:SRC};
const READY={
  schema:'ZGMINI_996_CONTINUATION_READY_V1',
  name:'READY_TO_RELEASE_INSTALL',requestId:ID,originalRequestId:REQ,
  ownerNonce:OWNER.nonce,sourceLockSha256:SRC,
  oldCArchiveOwnerSha256:PINS.oldC['owner.json'],
  installOwnerSha256:PINS.install['owner.json'],
  installRecoverySha256:PINS.install['RECOVERY_REQUIRED.json'],
  finalReleasePending:true,
};
PINS.readySha256=hex(READY);
const MORE_CONT={...CONT,'READY_TO_RELEASE_INSTALL.json':bytes(READY)};
const NAMES={
  oldC:'controller-recovery',
  oldCArchive:`controller-recovery-archived-${REQ}`,
  continuation:`controller-recovery-continuation-${ID}`,
  continuationArchive:`controller-recovery-continuation-archived-${ID}`,
  install:'controller-install',
  installArchive:`controller-install-recovered-${REQ}`,
};
const write=(dir,files)=>{
  fs.mkdirSync(dir);
  for(const [name,value] of Object.entries(files))
    fs.writeFileSync(path.join(dir,name),value);
};
function fixture(t,phase='ORIGINAL'){
  const root=path.join(os.tmpdir(),
    'zgmini-996-test-physical-'+randomBytes(16).toString('hex'));
  fs.mkdirSync(root);
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const leases=path.join(root,'automation','pc-maintenance','leases');
  fs.mkdirSync(leases,{recursive:true});
  const live={schema:'ZGMINI_996_PHYSICAL_FIXTURE_LIVE_V1',
    originalRequestId:REQ,conflicts:{workflowState:'active',
      protectionVerified:true,
      scope:'CONTROLLER_INSTALL_AND_C_RECOVERY_LEASES',
      foreignInstallOwnerCount:0,otherContinuationCount:0,
      twoSnapshotsIdentical:true,fresh:true}};
  fs.writeFileSync(path.join(root,'live.json'),bytes(live));
  const inDir=(key,files)=>write(path.join(leases,NAMES[key]),files);
  switch(phase){
    case 'ORIGINAL':inDir('oldC',OLD);inDir('install',INSTALL);break;
    case 'CLAIMED':inDir('oldC',OLD);inDir('continuation',CONT);
      inDir('install',INSTALL);break;
    case 'OLD':inDir('oldCArchive',OLD);inDir('continuation',CONT);
      inDir('install',INSTALL);break;
    case 'READY':inDir('oldCArchive',OLD);inDir('continuation',MORE_CONT);
      inDir('install',INSTALL);break;
    case 'CONT':inDir('oldCArchive',OLD);inDir('continuationArchive',MORE_CONT);
      inDir('install',INSTALL);break;
    case 'INSTALL':inDir('oldCArchive',OLD);
      inDir('continuationArchive',MORE_CONT);inDir('installArchive',INSTALL);break;
    default:throw Error('bad phase');
  }
  return {root,leases,live};
}
const run=x=>inspect({testOnly:true,root:x.root,
  continuationRequestId:ID,pins:structuredClone(PINS)});
const bounded=x=>{
  assert.equal(x.liveOriginalPcVerified,false);
  assert.equal(x.independentAuthentication,false);
  assert.equal(x.executionAuthorized,false);
  assert.equal(x.productionExecutable,false);
  for(const key of ['operationalWrites','workflowPuts','backlogWrites',
    'issuePosts','pcRetries'])assert.equal(x[key],0,key);
  assert.equal(x.cleanupPerformed,false);
};

test('six same-parent physical fixture positions read, classify and never authorize',t=>{
  const positions=['ORIGINAL','CLAIMED','OLD','READY','CONT','INSTALL'];
  for(const phase of positions){
    const f=fixture(t,phase),res=run(f);
    assert.equal(res.status,'C_PHYSICAL_FIXTURE_SNAPSHOT_CLASSIFIED_ONLY',
      `${phase}: ${res.code}`);
    assert.notEqual(res.phase,'UNKNOWN');
    bounded(res);
  }
});

test('production disabled and non-fixture path rejected before original reads',t=>{
  const f=fixture(t);
  const production=inspect({root:f.root,continuationRequestId:ID,pins:PINS});
  assert.equal(production.code,'C_PHYSICAL_FIXTURE_PRODUCTION_DISABLED');
  const wrong=inspect({testOnly:true,root:'E:\\ZGmini',
    continuationRequestId:ID,pins:PINS});
  assert.equal(wrong.code,'C_PHYSICAL_FIXTURE_ROOT_REJECTED');
  bounded(production);bounded(wrong);
});

test('file content drift is detected from actual disk bytes',t=>{
  const f=fixture(t);
  fs.writeFileSync(path.join(f.leases,NAMES.oldC,'owner.json'),bytes({tampered:true}));
  const r=run(f);
  assert.equal(r.code,'C_DISPOSITION_ORIGINAL_PIN_DRIFT');
  bounded(r);
});

test('reparse-point source directory is rejected',t=>{
  const f=fixture(t,'ORIGINAL');
  const link=path.join(f.leases,NAMES.oldCArchive);
  fs.symlinkSync(path.join(f.leases,NAMES.oldC),link,'dir');
  const r=run(f);
  assert.equal(r.code,'C_PHYSICAL_FIXTURE_CLAIM_REDIRECT');
  bounded(r);
});

test('hardlink to pinned file is rejected',t=>{
  const f=fixture(t);
  const owner=path.join(f.leases,NAMES.oldC,'owner.json');
  fs.linkSync(owner,path.join(f.root,'second-hardlink.json'));
  const r=run(f);
  assert.equal(r.code,'C_PHYSICAL_FIXTURE_FILE_UNSAFE');
  bounded(r);
});

test('unexpected source files or nested directories block classification',t=>{
  const f=fixture(t);
  fs.writeFileSync(path.join(f.leases,NAMES.oldC,'unknown.txt'),'x');
  const r=run(f);
  assert.equal(r.code,'C_PHYSICAL_FIXTURE_UNEXPECTED_CLAIM_ENTRY');
  bounded(r);
});

test('other concurrent continuation IDs in lease parent are rejected',t=>{
  const f=fixture(t,'CLAIMED');
  fs.mkdirSync(path.join(f.leases,
    'controller-recovery-continuation-00000000-0000-4000-8000-000000000000'));
  const r=run(f);
  assert.equal(r.code,'C_PHYSICAL_FIXTURE_OTHER_CONTINUATION_DETECTED');
  bounded(r);
});

test('physical source/archive collision never chooses a surviving copy',t=>{
  const f=fixture(t,'OLD');
  write(path.join(f.leases,NAMES.oldC),OLD);
  const r=run(f);
  assert.equal(r.code,'C_DISPOSITION_SOURCE_ARCHIVE_COLLISION');
  bounded(r);
});

test('unrelated synthetic Writer activity cannot block a C lease-only disposition',t=>{
  const f=fixture(t);
  f.live.conflicts.writerActiveCount=1;
  fs.writeFileSync(path.join(f.root,'live.json'),bytes(f.live));
  const r=run(f);
  assert.equal(r.status,'C_PHYSICAL_FIXTURE_SNAPSHOT_CLASSIFIED_ONLY');
  bounded(r);
});

test('synthetic foreign install owner blocks despite matching source SHA',t=>{
  const f=fixture(t);
  f.live.conflicts.foreignInstallOwnerCount=1;
  fs.writeFileSync(path.join(f.root,'live.json'),bytes(f.live));
  const r=run(f);
  assert.equal(r.code,'C_DISPOSITION_CONFLICT_OR_PROTECTION_UNKNOWN');
  bounded(r);
});

test('changed synthetic live.json between two readbacks yields unknown',t=>{
  const f=fixture(t);
  const r=inspect({testOnly:true,root:f.root,continuationRequestId:ID,
    pins:structuredClone(PINS),
    betweenReads(){f.live.conflicts.writerActiveCount=2;
      fs.writeFileSync(path.join(f.root,'live.json'),bytes(f.live));}});
  assert.equal(r.code,'C_PHYSICAL_FIXTURE_DOUBLE_READ_DRIFT');
  bounded(r);
});

test('same-parent archive presence cannot be mistaken for source absence',t=>{
  const f=fixture(t,'INSTALL');
  fs.mkdirSync(path.join(f.leases,NAMES.install));
  fs.writeFileSync(path.join(f.leases,NAMES.install,'owner.json'),bytes({new:'owner'}));
  const r=run(f);
  assert.equal(r.code,'C_DISPOSITION_SOURCE_ARCHIVE_COLLISION');
  bounded(r);
});

test('source prototype contains no mutating or network entrypoint',()=>{
  const src=readFileSync(fileURLToPath(new URL(
    '../tools/controller-996-c-physical-fixture-readback.mjs',import.meta.url)),'utf8');
  for(const forbidden of ['fs.mkdirSync','fs.renameSync','fs.writeFileSync',
    'fs.unlinkSync','fs.rmSync','fetch(',"from 'node:child_process'",
    'Directory.Move','workflow_dispatch','Set-ExecutionPolicy']){
    assert.equal(src.includes(forbidden),false,forbidden);
  }
  assert.match(src,/process\.platform==='win32'/);
  assert.match(src,/C_PHYSICAL_FIXTURE_PRODUCTION_DISABLED/);
});

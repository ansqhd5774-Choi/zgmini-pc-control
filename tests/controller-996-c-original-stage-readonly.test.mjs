import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {inspect996COriginalStageReadOnly} from
  '../tools/controller-996-c-original-stage-readonly.mjs';

const REQ='pc-update-0010b2cf-9bca-40cf-89c5-b750fa42b404';
const ID='a26db66d-50b1-4b6f-8a89-1a19a21e7acf';
const B='automation/pc-maintenance';
const L=B+'/leases';
const HEX=txt=>createHash('sha256').update(txt).digest('hex');
const store=(root,rel,obj)=>{
  const full=path.join(root,...rel.split('/'));
  fs.mkdirSync(path.dirname(full),{recursive:true});
  fs.writeFileSync(full,JSON.stringify(obj)+'\n');
};
const hash=(root,rel)=>HEX(fs.readFileSync(path.join(root,...rel.split('/'))));
const marker=(name)=>({schema:'ZGMINI_CONTROLLER_996_C_MARKER_V1',
  requestId:REQ,issueNumber:996,name,ownerNonce:'old-c-nonce',
  at:'2026-11-10T13:21:26.727Z',details:{verified:true}});

function fixture(t,phase='CLAIMED'){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-996-test-stage-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const afterOld=['AFTER_OLD','AFTER_CONT','AFTER_INSTALL'].includes(phase);
  const afterCont=['AFTER_CONT','AFTER_INSTALL'].includes(phase);
  const afterInstall=phase==='AFTER_INSTALL';
  const oldName=afterOld?`controller-recovery-archived-${REQ}`:'controller-recovery';
  const installName=afterInstall?`controller-install-recovered-${REQ}`:'controller-install';
  const contName=afterCont?`controller-recovery-continuation-archived-${ID}`:
    `controller-recovery-continuation-${ID}`;
  const old=`${L}/${oldName}`,install=`${L}/${installName}`,
    cont=`${L}/${contName}`;
  store(root,old+'/owner.json',{pid:111,requestId:REQ,issueNumber:996,
    nonce:'old-c-nonce'});
  for(const m of ['PREPARED','WORKFLOW_ENABLE_ATTEMPTED',
    'BACKLOG_CLOSE_ATTEMPTED'])store(root,old+'/'+m+'.json',marker(m));
  store(root,install+'/owner.json',{pid:112,nonce:'old-install'});
  store(root,install+'/RECOVERY_REQUIRED.json',{nonce:'old-install'});
  store(root,`${B}/backlog/${REQ}.json`,{replays:{},requestId:REQ});
  store(root,'automation/pc-control/host.json',{tag:'installed'});
  store(root,`automation/pc-control/backups/controller-update-${REQ}/stage/host.json`,
    {tag:'stage'});
  store(root,`${B}/MAINTENANCE_INSTALL.json`,{tag:'maintainer'});
  store(root,`${L}/controller-recovery-continuation-reservation/owner.json`,{
    continuationRequestId:ID,originalRequestId:REQ,pid:777,nonce:'new-c-nonce',
  });
  store(root,cont+'/owner.json',{requestId:ID,originalRequestId:REQ,
    pid:777,nonce:'new-c-nonce'});
  store(root,cont+'/PREPARED.json',{tag:'prepared'});
  store(root,cont+'/OLD_C_CLAIM_ARCHIVE_ATTEMPTED.json',{tag:'attempted'});
  const originalPins={
    oldC:hash(root,old+'/owner.json'),
    installOwner:hash(root,install+'/owner.json'),
    installRecovery:hash(root,install+'/RECOVERY_REQUIRED.json'),
    backlog:hash(root,`${B}/backlog/${REQ}.json`),
    installed:hash(root,'automation/pc-control/host.json'),
    stage:hash(root,`automation/pc-control/backups/controller-update-${REQ}/stage/host.json`),
    maintainer:hash(root,`${B}/MAINTENANCE_INSTALL.json`),
    PREPARED:hash(root,old+'/PREPARED.json'),
    WORKFLOW_ENABLE_ATTEMPTED:hash(root,old+'/WORKFLOW_ENABLE_ATTEMPTED.json'),
    BACKLOG_CLOSE_ATTEMPTED:hash(root,old+'/BACKLOG_CLOSE_ATTEMPTED.json'),
  };
  const oldC=Object.fromEntries(['owner.json','PREPARED.json',
    'WORKFLOW_ENABLE_ATTEMPTED.json','BACKLOG_CLOSE_ATTEMPTED.json']
    .map(f=>[f,hash(root,old+'/'+f)]));
  const installPins={
    'owner.json':hash(root,install+'/owner.json'),
    'RECOVERY_REQUIRED.json':hash(root,install+'/RECOVERY_REQUIRED.json'),
  };
  const continuationBeforeReady=Object.fromEntries([
    'owner.json','PREPARED.json','OLD_C_CLAIM_ARCHIVE_ATTEMPTED.json'
  ].map(f=>[f,hash(root,cont+'/'+f)]));
  const sourceLockSha256='a'.repeat(64);
  const ready={schema:'ZGMINI_996_CONTINUATION_READY_V1',
    name:'READY_TO_RELEASE_INSTALL',requestId:ID,originalRequestId:REQ,
    ownerNonce:'new-c-nonce',sourceLockSha256,
    oldCArchiveOwnerSha256:oldC['owner.json'],
    installOwnerSha256:installPins['owner.json'],
    installRecoverySha256:installPins['RECOVERY_REQUIRED.json'],
    finalReleasePending:true,
  };
  // The fixture is prepared directly in its desired synthetic phase;
  // no original PC path, operator, archive move or runtime lease is invoked.
  if(afterOld)store(root,cont+'/READY_TO_RELEASE_INSTALL.json',ready);
  const pins={originalPins,
    reservationOwnerSha256:hash(root,
      `${L}/controller-recovery-continuation-reservation/owner.json`),
    classifierPins:{oldC,install:installPins,continuationBeforeReady,
      readySha256:afterOld?hash(root,cont+'/READY_TO_RELEASE_INSTALL.json'):
        HEX(JSON.stringify(ready)),sourceLockSha256},
  };
  return {root,pins,phase,install,cont};
}
const inspect=(fix,extra={})=>inspect996COriginalStageReadOnly({
  testOnly:true,root:fix.root,continuationRequestId:ID,pins:fix.pins,
  readWorkflow:()=> 'active',
  readProtected:()=>({status:'CURRENT_PROTECTION_MATCHES_R1',
    protectedFingerprint:'b'.repeat(64)}),
  readSource:()=>({status:'SOURCE_BYTES_MATCH_PINNED_GIT_COMMITS',
    installed:38,staged:39,maintainer:7,total:84,
    sourceBytesSha256:'c'.repeat(64),originalWindowsReadback:false,
    executionAuthorized:false}),
  isAlive:pid=>pid===777,actorPid:777,...extra,
});

for(const [name,expected] of [
  ['CLAIMED','ORIGINAL_WITH_CONTINUATION_CLAIM_RESERVED'],
  ['AFTER_OLD','AFTER_OLD_C_ARCHIVED_READY_NOT_YET_ARCHIVED'],
  ['AFTER_CONT','AFTER_CONTINUATION_ARCHIVED_READY_INSTALL_HELD'],
  ['AFTER_INSTALL','AFTER_INSTALL_ARCHIVED'],
])test(`${name}: real-path-shaped double read classifies only, never authorizes`,t=>{
  const fix=fixture(t,name),result=inspect(fix);
  assert.equal(result.status,'C_STAGE_LIVE_INVENTORY_READ_ONLY');
  assert.equal(result.phase,expected);
  assert.equal(result.executionAuthorized,false);
  assert.equal(result.originalWindowsReadback,false);
  assert.equal(result.originalPcWrites,0);
  assert.equal(result.sourceBytesVerified,false);
});

test('missing or spoofed 84-source-byte check cannot pass stage readback',t=>{
  const fix=fixture(t);
  for(const proof of [
    {status:'SOURCE_BYTES_UNVERIFIED'},
    {status:'SOURCE_BYTES_MATCH_PINNED_GIT_COMMITS',
      installed:38,staged:39,maintainer:7,total:84,
      sourceBytesSha256:'c'.repeat(64),originalWindowsReadback:true,
      executionAuthorized:false},
  ]){
    const result=inspect(fix,{readSource:()=>proof});
    assert.equal(result.code,'C_STAGE_GIT_84_BYTES_UNVERIFIED');
    assert.equal(result.executionAuthorized,false);
  }
});

test('foreign continuation stops before any mutation',t=>{
  const fix=fixture(t);
  fs.mkdirSync(path.join(fix.root,...(
    `${L}/controller-recovery-continuation-deadbeef`).split('/')));
  const result=inspect(fix);
  assert.equal(result.code,'C_STAGE_FOREIGN_CONTINUATION_PRESENT');
});

test('fixed reservation PID mismatch stops',t=>{
  const fix=fixture(t),result=inspect(fix,{actorPid:778});
  assert.equal(result.code,'C_STAGE_RESERVATION_OWNER_NOT_CURRENT');
});

test('a second snapshot change stops',t=>{
  const fix=fixture(t);
  const result=inspect(fix,{betweenReads:()=>{
    store(fix.root,`${B}/backlog/${REQ}.json`,
      {replays:{},requestId:REQ,changed:true});
  }});
  assert.equal(result.code,'C_STAGE_STATIC_OR_BACKLOG_SHA_CHANGED');
  assert.equal(result.executionAuthorized,false);
});

test('legitimate new canonical install claim after final release is not moved',t=>{
  const fix=fixture(t,'AFTER_INSTALL');
  store(fix.root,`${L}/controller-install/owner.json`,
    {pid:999,nonce:'fresh-normal-installer'});
  const result=inspect(fix);
  assert.equal(result.status,'C_STAGE_NEW_INSTALL_OWNER_OBSERVED_READONLY');
  assert.equal(result.executionAuthorized,false);
  assert.equal(result.originalPcWrites,0);
});

test('unapproved non-TEMP or normal Windows execution is denied on Linux',t=>{
  const fix=fixture(t);
  const result=inspect996COriginalStageReadOnly({root:fix.root,
    continuationRequestId:ID,pins:fix.pins});
  assert.equal(result.code,'C_STAGE_ORIGINAL_WINDOWS_ONLY');
});

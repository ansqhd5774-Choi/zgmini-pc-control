import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {simulate996Continuation} from
  '../tools/controller-996-continuation-transaction.mjs';
import {plan996SingleBootRecovery} from
  '../tools/controller-996-windows-archive-adapter.mjs';

const REQ='pc-update-0010b2cf-9bca-40cf-89c5-b750fa42b404';
const ID='70a4c347-25ea-4fc6-83d2-c0c670115249';
const C='automation/pc-control';
const M='automation/pc-maintenance';
const STAGE=`${C}/backups/controller-update-${REQ}/stage`;
const LEASE=`${M}/leases/controller-install`;
const OLD_C=`${M}/leases/controller-recovery`;
const CORE_SHA='badad9124157879d7a645b64f2768113d632355b';
const STAGE_SHA='9db6fff689c488a59fe8771f013b7c5d3bafc0a8';
const MAINT_SHA='16064e29fea0e53e7769a24d93d75b6f5292cfc0';
const maintPaths=['tools/maintenance-contract.mjs',
  'tools/maintenance-apply.mjs','tools/maintenance-agent.mjs',
  'tools/maintenance-lock.mjs','tools/update.mjs',
  'tools/maintenance-ancestry.vbs','tools/source-bundle-register.mjs'];
const sha=b=>createHash('sha256').update(b).digest('hex');
const buf=x=>Buffer.from(JSON.stringify(x));

function fixture(){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-996-test-'));
  const git=new Map();
  const put=(rel,bytes)=>{
    const full=path.join(root,...rel.split('/'));
    fs.mkdirSync(path.dirname(full),{recursive:true});
    fs.writeFileSync(full,bytes);
    return sha(bytes);
  };
  const installed={},staged={};
  for(let i=0;i<38;i++){
    const rel=i===0?'config/operations.json':
      `controller/source-${String(i).padStart(2,'0')}.mjs`;
    const old=Buffer.from('installed: '+rel);
    const next=Buffer.from('stage: '+rel);
    installed[rel]=put(`${C}/${rel}`,old);
    staged[rel]=put(`${STAGE}/${rel}`,next);
    git.set(`${CORE_SHA}:${rel}`,old);
    git.set(`${STAGE_SHA}:${rel}`,next);
  }
  const added='controller/source-38.mjs',content=Buffer.from('new stage only');
  staged[added]=put(`${STAGE}/${added}`,content);
  git.set(`${STAGE_SHA}:${added}`,content);
  const maintFiles={};
  for(const rel of maintPaths){
    const b=Buffer.from('maintainer '+rel);
    maintFiles[rel]=put(`${M}/${rel}`,b);
    git.set(`${MAINT_SHA}:${rel}`,b);
  }
  const pins={
    installed:put(`${C}/host.json`,buf({controllerSourceSha:CORE_SHA,
      controllerFiles:installed})),
    stage:put(`${STAGE}/host.json`,buf({controllerSourceSha:STAGE_SHA,
      controllerFiles:staged})),
    maintainer:put(`${M}/MAINTENANCE_INSTALL.json`,buf({
      schema:'ZGMINI_PC_MAINTENANCE_INSTALL_V1',sourceSha:MAINT_SHA,
      files:maintFiles})),
  };
  pins.installOwner=put(`${LEASE}/owner.json`,buf({pid:99999999}));
  pins.installRecovery=put(`${LEASE}/RECOVERY_REQUIRED.json`,
    buf({requestId:REQ}));
  pins.oldC=put(`${OLD_C}/owner.json`,buf({requestId:REQ,
    issueNumber:996,pid:99999999,nonce:'private-owner'}));
  for(const marker of ['PREPARED','WORKFLOW_ENABLE_ATTEMPTED',
    'BACKLOG_CLOSE_ATTEMPTED']){
    pins[marker]=put(`${OLD_C}/${marker}.json`,buf({
      schema:'ZGMINI_CONTROLLER_996_C_MARKER_V1',requestId:REQ,
      issueNumber:996,ownerNonce:'private-owner',name:marker}));
  }
  const pausedAt='2026-11-10T01:06:53.751Z';
  const resumedAt='2026-11-10T13:21:26.727Z';
  pins.backlog=put(`${M}/backlog/${REQ}.json`,buf({
    schema:'ZGMINI_PC_BACKLOG_V1',requestId:REQ,
    pausedAt,resumedAt,replays:{}}));
  const consent={schema:'ZGMINI_CONTROLLER_996_CONTINUATION_CANDIDATE_V1',
    operation:'ARCHIVE_OLD_C_CLAIM_THEN_INSTALL_LEASE',approved:true,
    requestId:ID,originalRequestId:REQ,sourceLockSha256:'a'.repeat(64),
    pausedAt,resumedAt,pins};
  const relative=rel=>path.join(root,...rel.split('/'));
  const cont=`${M}/leases/controller-recovery-continuation-${ID}`;
  const oldCArchive=`${M}/leases/controller-recovery-interrupted-${REQ}`;
  const leaseArchive=`${M}/leases/controller-install-recovered-${REQ}`;
  const contArchive=`${M}/leases/controller-recovery-continuation-archived-${ID}`;
  const run=options=>simulate996Continuation({testOnly:true,root,consent,
    independentConsentVerified:true,sourceRead:(source,rel)=>
      git.get(`${source}:${rel}`),isAlive:()=>false,
    readLive:()=>({workflowState:'active',protectionVerified:true,
      controllerConflictCount:0,writerConflictCount:0}),
    uuid:()=>ID,...options});
  return {root,consent,put,run,git,relative,cont,oldCArchive,
    leaseArchive,contArchive,
    cleanup:()=>fs.rmSync(root,{recursive:true,force:true})};
}

test('production is always rejected before any mutation or PC access',()=>{
  const r=simulate996Continuation();
  assert.equal(r.code,'C_CONTINUATION_PRODUCTION_NOT_APPROVED');
  assert.equal(r.executionAuthorized,false);
  assert.equal(r.workflowPuts,0);
  assert.equal(r.backlogWrites,0);
  assert.equal(r.issuePosts,0);
});
test('symlinked intermediate test fixture directory is rejected pre-mutation',()=>{
  const f=fixture();
  try{
    const actual=f.relative('real');
    fs.mkdirSync(actual);
    const nested=path.join(actual,'zgmini-996-test-nested');
    fs.mkdirSync(nested);
    fs.symlinkSync(actual,f.relative('redirect'),'dir');
    const r=f.run({root:f.relative('redirect/zgmini-996-test-nested')});
    assert.equal(r.code,'C_CONTINUATION_TEST_ROOT_REJECTED');
    assert.equal(fs.existsSync(f.relative(OLD_C)),true);
    assert.equal(fs.existsSync(f.relative(LEASE)),true);
    assert.equal(fs.existsSync(f.relative(f.cont)),false);
  }finally{f.cleanup();}
});

test('84 Git bytes checked and install lease is final archive step',()=>{
  const f=fixture();
  try{
    const r=f.run();
    assert.equal(r.status,'C_CONTINUATION_TEST_ARCHIVED_IN_ORDER');
    assert.deepEqual(r.sourceFiles,{installed:38,staged:39,maintainer:7});
    assert.equal(r.archivedCClaimBeforeInstallLease,true);
    assert.equal(r.continuationClaimBeforeInstallLease,true);
    assert.equal(r.installLeaseLast,true);
    assert.equal(r.winPePhaseBoundaryProven,false);
    assert.equal(r.nativeWindowsMoveProven,false);
    assert.equal(r.productionExecutable,false);
    assert.equal(r.executionAuthorized,false);
    assert.equal(r.originalRequestRetried,false);
    assert.equal(r.workflowPuts,0);assert.equal(r.issuePosts,0);
    assert.equal(fs.existsSync(f.relative(OLD_C)),false);
    assert.equal(fs.existsSync(f.relative(LEASE)),false);
    assert.equal(fs.existsSync(f.relative(f.oldCArchive)),true);
    assert.equal(fs.existsSync(f.relative(f.leaseArchive)),true);
    assert.equal(fs.existsSync(f.relative(f.contArchive)),true);
    assert.equal(fs.existsSync(f.relative(f.cont)),false);
    assert.equal(fs.existsSync(f.relative(f.oldCArchive+'/owner.json')),true);
    assert.equal(fs.existsSync(f.relative(f.leaseArchive+'/owner.json')),true);
    const ready=JSON.parse(fs.readFileSync(f.relative(
      f.contArchive+'/READY_TO_RELEASE_INSTALL.json'),'utf8'));
    assert.equal(ready.finalReleasePending,true);
    assert.equal(ready.name,'READY_TO_RELEASE_INSTALL');
  }finally{f.cleanup();}
});
test('Linux fixture archive paths and order agree with single WinPE boot proposal',()=>{
  const f=fixture();
  try{
    const plan=plan996SingleBootRecovery(ID);
    assert.equal(plan.winpeBootCount,1);
    assert.equal(plan.productionExecutable,false);
    assert.equal(plan.phases[0].moves.length,0);
    assert.equal(plan.phases[2].moves.length,0);
    const expected=[f.oldCArchive,f.contArchive,f.leaseArchive];
    const moves=plan.phases[1].moves;
    assert.deepEqual(moves.map(s=>path.win32.basename(s.destination)),
      expected.map(s=>path.posix.basename(s)));
    assert.deepEqual(moves.map(s=>s.name),['oldC','continuation','install']);
    assert.equal(path.win32.basename(moves[0].destination),
      `controller-recovery-interrupted-${REQ}`);
    assert.equal(f.run().status,'C_CONTINUATION_TEST_ARCHIVED_IN_ORDER');
    for(const rel of expected){
      assert.equal(fs.existsSync(f.relative(rel+'/owner.json')),true);
      assert.equal(fs.existsSync(f.relative(rel+'/payload')),false);
    }
  }finally{f.cleanup();}
});

test('Git source mismatch or unverified new consent makes zero changes',()=>{
  const f=fixture();
  try{
    f.git.set(`${CORE_SHA}:controller/source-01.mjs`,Buffer.from('tampered git'));
    const r=f.run();
    assert.equal(r.code,'C_CONTINUATION_GIT_SOURCE_BYTE_MISMATCH');
    assert.equal(fs.existsSync(f.relative(f.cont)),false);
    assert.equal(fs.existsSync(f.relative(OLD_C)),true);
    assert.equal(fs.existsSync(f.relative(LEASE)),true);
  }finally{f.cleanup();}
  const g=fixture();
  try{
    const r=g.run({independentConsentVerified:false});
    assert.equal(r.code,'C_CONTINUATION_CONSENT_OR_PORT_NOT_VERIFIED');
    assert.equal(fs.existsSync(g.relative(g.cont)),false);
  }finally{g.cleanup();}
});

test('crash after claim reservation keeps both old barriers, never retries',()=>{
  const f=fixture();
  try{
    const r=f.run({failAfter:'AFTER_RESERVE'});
    assert.equal(r.code,'C_CONTINUATION_INJECTED_AFTER_RESERVE');
    assert.equal(fs.existsSync(f.relative(OLD_C)),true);
    assert.equal(fs.existsSync(f.relative(LEASE)),true);
    assert.equal(fs.existsSync(f.relative(f.cont)),true);
    const retry=f.run();
    assert.equal(retry.code,'C_CONTINUATION_ARCHIVE_OR_ACTIVE_CLAIM_EXISTS');
  }finally{f.cleanup();}
});

test('crash after old C archive retains original install admission barrier',()=>{
  const f=fixture();
  try{
    const r=f.run({failAfter:'AFTER_OLD_C_ARCHIVE'});
    assert.equal(r.code,'C_CONTINUATION_INJECTED_AFTER_OLD_C_ARCHIVE');
    assert.equal(fs.existsSync(f.relative(OLD_C)),false);
    assert.equal(fs.existsSync(f.relative(f.oldCArchive)),true);
    assert.equal(fs.existsSync(f.relative(LEASE)),true);
    assert.equal(fs.existsSync(f.relative(f.leaseArchive)),false);
    assert.equal(fs.existsSync(f.relative(f.cont)),true);
  }finally{f.cleanup();}
});

test('crash after install release preserves all three archives, no post-write',()=>{
  const f=fixture();
  try{
    const r=f.run({failAfter:'AFTER_INSTALL_ARCHIVE'});
    assert.equal(r.code,'C_CONTINUATION_INJECTED_AFTER_INSTALL_ARCHIVE');
    assert.equal(fs.existsSync(f.relative(f.oldCArchive)),true);
    assert.equal(fs.existsSync(f.relative(f.leaseArchive)),true);
    assert.equal(fs.existsSync(f.relative(f.cont)),false);
    assert.equal(fs.existsSync(f.relative(f.contArchive)),true);
    assert.equal(r.executionAuthorized,false);
    assert.equal(f.run().code,'C_CONTINUATION_ARCHIVE_OR_ACTIVE_CLAIM_EXISTS');
  }finally{f.cleanup();}
});
test('crash after new C claim archive retains real install lease lock',()=>{
  const f=fixture();
  try{
    const r=f.run({failAfter:'AFTER_CONTINUATION_ARCHIVE'});
    assert.equal(r.code,'C_CONTINUATION_INJECTED_AFTER_CONTINUATION_ARCHIVE');
    assert.equal(fs.existsSync(f.relative(LEASE)),true);
    assert.equal(fs.existsSync(f.relative(f.cont)),false);
    assert.equal(fs.existsSync(f.relative(f.contArchive)),true);
    assert.equal(fs.existsSync(f.relative(f.leaseArchive)),false);
    assert.equal(f.run().code,'C_CONTINUATION_ARCHIVE_OR_ACTIVE_CLAIM_EXISTS');
  }finally{f.cleanup();}
});
test('crash after ready marker but before continuation archive keeps install',()=>{
  const f=fixture();
  try{
    const r=f.run({failAfter:'AFTER_RELEASE_INTENT'});
    assert.equal(r.code,'C_CONTINUATION_INJECTED_AFTER_RELEASE_INTENT');
    assert.equal(fs.existsSync(f.relative(LEASE)),true);
    assert.equal(fs.existsSync(f.relative(f.cont)),true);
    assert.equal(fs.existsSync(f.relative(f.contArchive)),false);
    assert.equal(fs.existsSync(f.relative(
      f.cont+'/READY_TO_RELEASE_INSTALL.json')),true);
  }finally{f.cleanup();}
});

test('an existing empty archive directory cannot be overwritten',()=>{
  const f=fixture();
  try{
    fs.mkdirSync(f.relative(f.oldCArchive));
    const r=f.run();
    assert.equal(r.code,'C_CONTINUATION_ARCHIVE_OR_ACTIVE_CLAIM_EXISTS');
    assert.equal(fs.existsSync(f.relative(OLD_C)),true);
    assert.equal(fs.existsSync(f.relative(LEASE)),true);
    assert.deepEqual(fs.readdirSync(f.relative(f.oldCArchive)),[]);
  }finally{f.cleanup();}
});

test('a competing directory created after precheck is never clobbered',()=>{
  const f=fixture();
  try{
    const r=f.run({beforeArchiveMove:({toRel})=>{
      if(toRel===f.oldCArchive){
        fs.mkdirSync(f.relative(toRel));
        fs.writeFileSync(f.relative(toRel+'/sentinel.txt'),'preserve');
      }
    }});
    assert.equal(r.code,'C_CONTINUATION_ARCHIVE_DESTINATION_TAKEN');
    assert.equal(fs.readFileSync(f.relative(f.oldCArchive+'/sentinel.txt'),'utf8'),
      'preserve');
    assert.equal(fs.existsSync(f.relative(OLD_C)),true);
    assert.equal(fs.existsSync(f.relative(LEASE)),true);
  }finally{f.cleanup();}
});

test('a crash before first direct archive move preserves both original locks',()=>{
  const f=fixture();
  try{
    const r=f.run({failAfter:'BEFORE_OLD_C_MOVE'});
    assert.equal(r.code,'C_CONTINUATION_INJECTED_BEFORE_OLD_C_MOVE');
    assert.equal(fs.existsSync(f.relative(OLD_C)),true);
    assert.equal(fs.existsSync(f.relative(LEASE)),true);
    assert.equal(fs.existsSync(f.relative(f.oldCArchive)),false);
    assert.equal(f.run().code,'C_CONTINUATION_ARCHIVE_OR_ACTIVE_CLAIM_EXISTS');
  }finally{f.cleanup();}
});

test('a crash before final direct install archive move retains install lease',()=>{
  const f=fixture();
  try{
    const r=f.run({failAfter:'BEFORE_INSTALL_MOVE'});
    assert.equal(r.code,'C_CONTINUATION_INJECTED_BEFORE_INSTALL_MOVE');
    assert.equal(fs.existsSync(f.relative(f.oldCArchive+'/owner.json')),
      true);
    assert.equal(fs.existsSync(f.relative(LEASE)),true);
    assert.equal(fs.existsSync(f.relative(f.contArchive)),true);
    assert.equal(fs.existsSync(f.relative(f.leaseArchive)),false);
  }finally{f.cleanup();}
});

test('old C source drift just before move blocks and preserves the source',()=>{
  const f=fixture();
  try{
    const r=f.run({beforeArchiveMove:({toRel})=>{
      if(toRel===f.oldCArchive){
        fs.writeFileSync(f.relative(OLD_C+'/owner.json'),
          JSON.stringify({requestId:REQ,issueNumber:996,pid:99999999,
            nonce:'changed'}));
      }
    }});
    assert.equal(r.code,'C_CONTINUATION_ARCHIVED_OWNER_SHA_DRIFT');
    assert.equal(fs.existsSync(f.relative(OLD_C)),true);
    assert.equal(fs.existsSync(f.relative(LEASE)),true);
    assert.equal(fs.existsSync(f.relative(f.oldCArchive)),false);
  }finally{f.cleanup();}
});

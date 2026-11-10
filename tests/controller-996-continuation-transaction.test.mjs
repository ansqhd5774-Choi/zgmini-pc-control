import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {simulate996Continuation} from
  '../tools/controller-996-continuation-transaction.mjs';

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
  const oldCArchive=`${M}/leases/controller-recovery-archived-${REQ}`;
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

test('test-only 84 Git bytes verified before archive C claim then install lease',()=>{
  const f=fixture();
  try{
    const r=f.run();
    assert.equal(r.status,'C_CONTINUATION_TEST_ARCHIVED_IN_ORDER');
    assert.deepEqual(r.sourceFiles,{installed:38,staged:39,maintainer:7});
    assert.equal(r.archivedCClaimBeforeInstallLease,true);
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

test('crash after install release preserves both archives and continuation claim',()=>{
  const f=fixture();
  try{
    const r=f.run({failAfter:'AFTER_INSTALL_ARCHIVE'});
    assert.equal(r.code,'C_CONTINUATION_INJECTED_AFTER_INSTALL_ARCHIVE');
    assert.equal(fs.existsSync(f.relative(f.oldCArchive)),true);
    assert.equal(fs.existsSync(f.relative(f.leaseArchive)),true);
    assert.equal(fs.existsSync(f.relative(f.cont)),true);
    assert.equal(fs.existsSync(f.relative(f.contArchive)),false);
    assert.equal(r.executionAuthorized,false);
  }finally{f.cleanup();}
});

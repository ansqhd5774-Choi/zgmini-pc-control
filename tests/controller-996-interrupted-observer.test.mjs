import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {collect996InterruptedEvidence} from '../tools/controller-996-interrupted-observer.mjs';

const REQ='pc-update-0010b2cf-9bca-40cf-89c5-b750fa42b404';
const B='automation/pc-maintenance';
const FP='877bcd2a2abbf34452c09fc96a15b28d0309a32b45687f8dace37ae5e29abb86';
const pinNames={
 ledger:`${B}/ledger/${REQ}.json`,
 originalOwner:`${B}/leases/controller-install/owner.json`,
 recoveryMarker:`${B}/leases/controller-install/RECOVERY_REQUIRED.json`,
 controllerHost:'automation/pc-control/host.json',
 stagedHost:`automation/pc-control/backups/controller-update-${REQ}/stage/host.json`,
 maintainer:`${B}/MAINTENANCE_INSTALL.json`,
};
const sha=b=>createHash('sha256').update(b).digest('hex');
function fixture(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-996-test-'));
 const write=(rel,obj)=>{
  const f=path.join(root,...rel.split('/'));
  fs.mkdirSync(path.dirname(f),{recursive:true});
  fs.writeFileSync(f,JSON.stringify(obj)+'\n');
 };
 const marker=(name,at,details)=>({
  schema:'ZGMINI_CONTROLLER_996_C_MARKER_V1',
  requestId:REQ,issueNumber:996,ownerNonce:'claim-nonce-test',
  name,at,details,
 });
 write(pinNames.ledger,{
  requestId:REQ,issueNumber:996,firstFail:'INTAKE_PAUSED',
  code:'RUNNER_SET_DRIFT',status:'RECOVERY_REQUIRED',
 });
 write(pinNames.originalOwner,{pid:1001,nonce:'old-nonce'});
 write(pinNames.recoveryMarker,{nonce:'old-nonce'});
 write(pinNames.controllerHost,{
  controllerSourceSha:'badad9124157879d7a645b64f2768113d632355b',
 });
 write(pinNames.stagedHost,{
  controllerSourceSha:'9db6fff689c488a59fe8771f013b7c5d3bafc0a8',
 });
 write(pinNames.maintainer,{
  sourceSha:'16064e29fea0e53e7769a24d93d75b6f5292cfc0',
 });
 write(`${B}/leases/controller-recovery/owner.json`,{
  requestId:REQ,issueNumber:996,pid:1002,nonce:'claim-nonce-test',
  at:'2026-11-10T12:59:00.000Z',
 });
 write(`${B}/leases/controller-recovery/PREPARED.json`,
  marker('PREPARED','2026-11-10T12:59:01.000Z',{
   manifestSha256:'05bf8aa72b438b69d7c86f8798a72ec2c12fe3537489f2153069dabfe0695e7b',
   manifestCommitSha:'7cff08ec6b27410baf10d8dc7130edb57b2de8c4',
   evidenceFingerprint:FP,ownerNonce:'claim-nonce-test',
  }));
 write(`${B}/leases/controller-recovery/WORKFLOW_ENABLE_ATTEMPTED.json`,
  marker('WORKFLOW_ENABLE_ATTEMPTED','2026-11-10T12:59:02.000Z',{
   action:'ENABLE_EXISTING_PC_JOB_WORKFLOW_ONCE',
   requestId:REQ,nonce:'claim-nonce-test',
   workflow:'repos/ansqhd5774-Choi/zgmini-pc-control/actions/workflows/pc-job.yml',
   priorState:'disabled_manually',
  }));
 const backlog={schema:'ZGMINI_PC_BACKLOG_V1',requestId:REQ,
  pausedAt:'2026-11-10T01:30:00.000Z',
  resumedAt:'2026-11-10T12:59:03.000Z',
  windows:[{pausedAt:'2026-11-10T01:30:00.000Z',
   resumedAt:'2026-11-10T12:59:03.000Z'}],replays:{}};
 write(`${B}/backlog/${REQ}.json`,backlog);
 const backlogSha=sha(fs.readFileSync(path.join(root,B,'backlog',REQ+'.json')));
 write(`${B}/leases/controller-recovery/BACKLOG_CLOSE_ATTEMPTED.json`,
  marker('BACKLOG_CLOSE_ATTEMPTED','2026-11-10T12:59:03.000Z',{
   originalSha:'d48698b6bfe152fdcbea5adf582364334dc8633742cce02e6a1299718304a780',
   nextSha:backlogSha,resumeAt:backlog.resumedAt,
   ownerNonce:'claim-nonce-test',
   operation:'CLOSE_VERIFIED_ORIGINAL_PAUSE_WINDOW_ONCE',
  }));
 const pin=Object.fromEntries(Object.entries(pinNames).map(([k,rel])=>[
  k,sha(fs.readFileSync(path.join(root,...rel.split('/'))))]));
 const readLive=()=>({workflowState:'active',namedRunnersObserved:6,
  additionalRunnersObserved:1,authenticated:true});
 const readProtected=()=>({status:'CURRENT_PROTECTION_MATCHES_R1',
  protectedFingerprint:FP,enabledTasks:2});
 const isAlive=()=>false;
 const run=(overrides={})=>collect996InterruptedEvidence({
  root,testOnly:true,pin,readLive,readProtected,isAlive,...overrides});
 const dispose=()=>fs.rmSync(root,{recursive:true,force:true});
 return {root,write,run,pin,dispose,readLive,readProtected,isAlive,backlog};
}

test('exact interrupted state is read-only phase-consistent, never recovery authorized',()=>{
 const f=fixture();
 try{
  const before=fs.readFileSync(path.join(f.root,B,'backlog',REQ+'.json'));
  const r=f.run();
  assert.equal(r.status,'READONLY_INTERRUPTED_PHASE_CONSISTENT');
  assert.equal(r.code,'C_CLAIM_PROVENANCE_NOT_EXTERNALLY_PINNED');
  assert.equal(r.checksPassed,14);
  assert.equal(r.executionAuthorized,false);
  assert.equal(r.claimProvenanceExternallyPinned,false);
  assert.equal(r.fullSourceBytePostcheckVerified,false);
  assert.equal(r.operationalWrites,0);
  assert.equal(r.issuePosts,0);
  assert.equal(r.pcRetries,0);
  assert.ok(before.equals(fs.readFileSync(path.join(f.root,B,'backlog',REQ+'.json'))));
 }finally{f.dispose();}
});

test('backlog digest drift stops without retry or lease archive',()=>{
 const f=fixture();
 try{
  f.write(`${B}/backlog/${REQ}.json`,{...f.backlog,unexpected:true});
  const r=f.run();
  assert.equal(r.status,'STATE_UNKNOWN_PRESERVE_C_CLAIM_AND_ORIGINAL_LEASE');
  assert.equal(r.code,'C_INTERRUPTED_BACKLOG_COMMIT_UNVERIFIED');
  assert.equal(r.operationalWrites,0);
 }finally{f.dispose();}
});

test('a later marker blocks the narrow interrupted-phase classification',()=>{
 const f=fixture();
 try{
  f.write(`${B}/leases/controller-recovery/PRE_ARCHIVE.json`,{
   schema:'ZGMINI_CONTROLLER_996_C_MARKER_V1'});
  assert.equal(f.run().code,'C_INTERRUPTED_LATER_MARKERS_ABSENT_UNVERIFIED');
 }finally{f.dispose();}
});

test('live or reused PID, inactive workflow, and protection drift each stop',()=>{
 const f=fixture();
 try{
  assert.equal(f.run({isAlive:()=>true}).code,
   'C_INTERRUPTED_OLD_OWNER_DEAD_UNVERIFIED');
  assert.equal(f.run({readLive:()=>({...f.readLive(),workflowState:'disabled_manually'})}).code,
   'C_INTERRUPTED_WORKFLOW_ACTIVE_UNVERIFIED');
  assert.equal(f.run({readProtected:()=>({...f.readProtected(),enabledTasks:1})}).code,
   'C_INTERRUPTED_CURRENT_PROTECTION_UNVERIFIED');
 }finally{f.dispose();}
});

test('missing or symlinked C claim never silently becomes eligible',()=>{
 const f=fixture();
 try{
  const rel=`${B}/leases/controller-recovery/owner.json`;
  const full=path.join(f.root,...rel.split('/'));
  fs.renameSync(full,full+'.preserved');
  assert.equal(f.run().status,'STATE_UNKNOWN_PRESERVE_C_CLAIM_AND_ORIGINAL_LEASE');
  fs.symlinkSync(full+'.preserved',full);
  assert.equal(f.run().code,'C_INTERRUPTED_PATH_REDIRECT');
 }finally{f.dispose();}
});

test('files and archive-marker presence changing during live GET are detected',()=>{
 const a=fixture();
 try{
  const drift=()=>{
   a.write(`${B}/backlog/${REQ}.json`,{...a.backlog,changedDuringRead:true});
   return a.readLive();
  };
  assert.equal(a.run({readLive:drift}).code,
   'C_INTERRUPTED_FILES_CHANGED_DURING_READ');
 }finally{a.dispose();}
 const b=fixture();
 try{
  const drift=()=>{
   b.write(`${B}/leases/controller-recovery/PRE_ARCHIVE.json`,{unexpected:true});
   return b.readLive();
  };
  assert.equal(b.run({readLive:drift}).code,
   'C_INTERRUPTED_LEASE_OR_MARKER_CHANGED_DURING_READ');
 }finally{b.dispose();}
});

test('test ports may not point at an arbitrary workspace root',()=>{
 const f=fixture();
 try{
  const result=f.run({root:os.tmpdir()});
  assert.equal(result.code,'C_INTERRUPTED_TEST_PORT_REJECTED');
  assert.equal(result.executionAuthorized,false);
 }finally{f.dispose();}
});

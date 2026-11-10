import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {collect996OriginalCPrewriteReadOnly} from
  '../tools/controller-996-c-original-prewrite-readonly.mjs';

const REQ='pc-update-0010b2cf-9bca-40cf-89c5-b750fa42b404';
const BASE='automation/pc-maintenance';
const UTC='2026-11-10T13:21:26.727Z';
const MARKERS=['PREPARED','WORKFLOW_ENABLE_ATTEMPTED',
  'BACKLOG_CLOSE_ATTEMPTED'];
const write=(root,rel,obj)=>{
  const at=path.join(root,...rel.split('/'));
  fs.mkdirSync(path.dirname(at),{recursive:true});
  fs.writeFileSync(at,JSON.stringify(obj)+'\n');
};
function fixture(t){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-996-test-prewrite-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const old=`${BASE}/leases/controller-recovery`;
  const install=`${BASE}/leases/controller-install`;
  write(root,old+'/owner.json',{requestId:REQ,issueNumber:996,
    nonce:'old-c-nonce',pid:111,at:UTC});
  write(root,install+'/owner.json',{pid:112});
  write(root,install+'/RECOVERY_REQUIRED.json',{reason:'interrupted'});
  for(const m of MARKERS)write(root,`${old}/${m}.json`,{
    schema:'ZGMINI_CONTROLLER_996_C_MARKER_V1',requestId:REQ,
    issueNumber:996,name:m,ownerNonce:'old-c-nonce',at:UTC,details:{ok:true},
  });
  write(root,`${BASE}/backlog/${REQ}.json`,{
    schema:'ZGMINI_PC_BACKLOG_V1',requestId:REQ,
    pausedAt:'2026-11-10T01:06:53.751Z',resumedAt:UTC,replays:{},
  });
  write(root,'automation/pc-control/host.json',{
    controllerSourceSha:'badad9124157879d7a645b64f2768113d632355b',
  });
  write(root,`automation/pc-control/backups/controller-update-${REQ}/stage/host.json`,{
    controllerSourceSha:'9db6fff689c488a59fe8771f013b7c5d3bafc0a8',
  });
  write(root,`${BASE}/MAINTENANCE_INSTALL.json`,{
    sourceSha:'16064e29fea0e53e7769a24d93d75b6f5292cfc0',
  });
  return {root,old,install};
}
const r1=()=>({status:'READONLY_INTERRUPTED_PHASE_CONSISTENT',
  checksPassed:14,checksTotal:14,workflowState:'active',
  executionAuthorized:false});
const r4=()=>({status:'SOURCE_BYTES_MATCH_PINNED_GIT_COMMITS',
  total:84,installed:38,staged:39,maintainer:7,executionAuthorized:false});
const run=(root,extra={})=>collect996OriginalCPrewriteReadOnly({
  testOnly:true,root,isAlive:()=>false,r1,r4,...extra,
});

test('ten physical files are pinned twice but C execution is NEVER approved',t=>{
  const {root}=fixture(t),result=run(root);
  assert.equal(result.status,'C_ORIGINAL_PREWRITE_FILE_PINS_OBSERVED_ONLY');
  assert.equal(Object.keys(result.pins).length,10);
  assert.equal(result.filesReadTwice,10);
  assert.equal(result.sourceBytesReadAgain,84);
  assert.equal(result.executionAuthorized,false);
  assert.equal(result.independentOwnerHandoffVerified,false);
  assert.equal(result.exactNewConsentVerified,false);
  assert.equal(result.writerControllerConflictVerified,false);
  assert.equal(result.originalWindowsReadback,false);
  assert.equal(result.originalPcWrites,0);
});

test('unapproved archive destination stops before any C change',t=>{
  const {root}=fixture(t);
  fs.mkdirSync(path.join(root,...(
    `${BASE}/leases/controller-install-recovered-${REQ}`).split('/')));
  const result=run(root);
  assert.equal(result.code,'C_996_PREWRITE_ARCHIVE_OR_RESERVATION_PRESENT');
  assert.equal(result.pins,null);
  assert.equal(result.originalPcWrites,0);
});

test('old C process becoming live blocks even when files match',t=>{
  const {root}=fixture(t);
  const result=run(root,{isAlive:pid=>pid===111});
  assert.equal(result.code,'C_996_PREWRITE_OLD_OWNER_OR_INSTALL_PID_UNKNOWN');
  assert.equal(result.executionAuthorized,false);
});

test('second snapshot detects changed marker without cleanup or retry',t=>{
  const {root,old}=fixture(t);
  const result=run(root,{betweenSnapshots:()=>{
    write(root,old+'/PREPARED.json',{
      schema:'ZGMINI_CONTROLLER_996_C_MARKER_V1',requestId:REQ,
      issueNumber:996,name:'PREPARED',ownerNonce:'old-c-nonce',
      at:UTC,details:{ok:true,touched:true},
    });
  }});
  assert.equal(result.code,'C_996_PREWRITE_TWO_PHYSICAL_SNAPSHOTS_DRIFT');
  assert.equal(result.executionAuthorized,false);
});

test('production entrypoint cannot be invoked through Linux or a test port',t=>{
  const {root}=fixture(t);
  const result=collect996OriginalCPrewriteReadOnly({root,
    isAlive:()=>false,r1,r4});
  assert.equal(result.code,'C_996_PREWRITE_ORIGINAL_WINDOWS_ONLY');
});

test('test roots outside new isolated TEMP are rejected before a read',()=>{
  const result=run('/workspace');
  assert.equal(result.code,'C_996_PREWRITE_TEST_ROOT_OR_PORT_REJECTED');
});

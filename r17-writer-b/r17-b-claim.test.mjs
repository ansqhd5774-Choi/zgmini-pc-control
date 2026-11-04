import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {acquireInstallClaim,releaseInstallClaim} from './r17-b-claim.mjs';

function fixture(){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'r17-b-claim-test-'));
  return {journalRoot:path.join(root,'requests'),sharedLock:path.join(root,'writer-source-install.lock')};
}
const A='pc-r17-550e8400-e29b-41d4-a716-446655440000';
const B='pc-r17-550e8400-e29b-41d4-a716-446655440001';

test('other B job holds shared lock: losing requestId remains unconsumed',()=>{
  const dirs=fixture();
  const winner=acquireInstallClaim({...dirs,requestId:A});
  assert.throws(()=>acquireInstallClaim({...dirs,requestId:B}),
    /R17_B_SHARED_INSTALL_BUSY_NOOP_STOP/);
  assert.equal(fs.existsSync(path.join(dirs.journalRoot,B)),false);
  releaseInstallClaim({fd:winner.fd,sharedLock:dirs.sharedLock,requestId:A,retain:false});
  const loserLater=acquireInstallClaim({...dirs,requestId:B});
  assert.equal(fs.existsSync(loserLater.journalFile),true);
  releaseInstallClaim({fd:loserLater.fd,sharedLock:dirs.sharedLock,requestId:B,retain:false});
});

test('same requestId cannot be reused even after shared mutex released',()=>{
  const dirs=fixture();const first=acquireInstallClaim({...dirs,requestId:A});
  releaseInstallClaim({fd:first.fd,sharedLock:dirs.sharedLock,requestId:A,retain:false});
  assert.throws(()=>acquireInstallClaim({...dirs,requestId:A}),
    /R17_B_REQUEST_ALREADY_CLAIMED_STOP/);
  assert.equal(fs.existsSync(dirs.sharedLock),false);
});

test('RECOVERY_REQUIRED deliberately retains shared lock for human reconciliation',()=>{
  const dirs=fixture();const active=acquireInstallClaim({...dirs,requestId:A});
  releaseInstallClaim({fd:active.fd,sharedLock:dirs.sharedLock,requestId:A,retain:true});
  assert.equal(fs.readFileSync(dirs.sharedLock,'utf8'),A);
  assert.throws(()=>acquireInstallClaim({...dirs,requestId:B}),
    /R17_B_SHARED_INSTALL_BUSY_NOOP_STOP/);
  assert.equal(fs.existsSync(path.join(dirs.journalRoot,B)),false);
});

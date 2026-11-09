import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {acquireR6CoreLaneLockFixture} from './core-lane-lock.mjs';
import {claimApprovedR6BOnce,claimR6BOnceFixture} from './one-shot-claim.mjs';

const HASH='c'.repeat(64);
const fixture=fn=>{
 const base=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-r6-one-shot-'));
 try{return fn(base);}finally{fs.rmSync(base,{recursive:true,force:true});}
};

test('Windows production claim is not a portable bypass',()=>{
  if(process.platform==='win32')return;
  assert.throws(()=>claimApprovedR6BOnce({requestId:randomUUID(),approvalManifestSha256:HASH,
   heldCoreLock:{verifyHeld:()=>true}}),{code:'R6_B_WINDOWS_ONLY_STOP'});
});

test('requires a held Core lock; no claim file on refusal',()=>fixture(base=>{
  assert.throws(()=>claimR6BOnceFixture({base,requestId:randomUUID(),
    approvalManifestSha256:HASH,heldCoreLock:{verifyHeld:()=>false}}),
    {code:'R6_B_ONESHOT_CORE_LOCK_NOT_HELD'});
  assert.equal(fs.readdirSync(base).length,0);
}));

test('approval SHA is globally claimed once even with a second request ID',()=>fixture(base=>{
  const lock=acquireR6CoreLaneLockFixture({base,requestId:randomUUID()});
  try{
    const requestId=randomUUID();
    const claim=claimR6BOnceFixture({base,requestId,approvalManifestSha256:HASH,heldCoreLock:lock});
    assert.equal(claim.status,'CLAIMED_NO_RETRY');
    assert.equal(claim.requestId,requestId);
    assert.throws(()=>claimR6BOnceFixture({base,requestId:randomUUID(),
       approvalManifestSha256:HASH,heldCoreLock:lock}),{code:'R6_B_ONESHOT_ALREADY_CLAIMED'});
    const artifact=JSON.parse(fs.readFileSync(path.join(base,`employment-r6-b-once-${HASH}.json`),'utf8'));
    assert.equal(artifact.requestId,requestId);
    assert.equal(artifact.state,'CLAIMED_NO_RETRY');
  } finally {assert.equal(lock.release().released,true);}
}));

test('claimed approval survives Core release and later execution attempts',()=>fixture(base=>{
  const a=acquireR6CoreLaneLockFixture({base,requestId:randomUUID()});
  claimR6BOnceFixture({base,requestId:randomUUID(),approvalManifestSha256:HASH,heldCoreLock:a});
  a.release();
  const b=acquireR6CoreLaneLockFixture({base,requestId:randomUUID()});
  try {assert.throws(()=>claimR6BOnceFixture({base,requestId:randomUUID(),
    approvalManifestSha256:HASH,heldCoreLock:b}),{code:'R6_B_ONESHOT_ALREADY_CLAIMED'});}
  finally {b.release();}
}));

test('invalid manifest hash never creates persistent state',()=>fixture(base=>{
  const lock=acquireR6CoreLaneLockFixture({base,requestId:randomUUID()});
  try{assert.throws(()=>claimR6BOnceFixture({base,requestId:randomUUID(),
    approvalManifestSha256:'bad',heldCoreLock:lock}),{code:'R6_B_ONESHOT_ID_OR_APPROVAL_INVALID'});
    assert.deepEqual(fs.readdirSync(base),['local-cycle.lock']);}
  finally{lock.release();}
}));

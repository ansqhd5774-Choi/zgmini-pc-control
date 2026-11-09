import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {acquireApprovedR6CoreLaneLock,acquireR6CoreLaneLockFixture} from './core-lane-lock.mjs';

const fixture = (fn) => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-r6-core-lock-'));
  try { return fn(base); } finally { fs.rmSync(base,{recursive:true,force:true}); }
};
const req=()=>randomUUID();

test('production Core lock cannot be acquired on non-Windows',()=>{
  if(process.platform==='win32')return;
  assert.throws(()=>acquireApprovedR6CoreLaneLock(req()),{code:'R6_B_WINDOWS_ONLY_STOP'});
});

test('creates the existing Core-shaped lock atomically and releases only own bytes',()=>fixture(base=>{
  const id=req(), lock=acquireR6CoreLaneLockFixture({base,requestId:id});
  assert.equal(lock.verifyHeld(),true);
  const bytes=JSON.parse(fs.readFileSync(path.join(base,'local-cycle.lock'),'utf8'));
  assert.equal(bytes.pid,process.pid);
  assert.equal(bytes.owner,'EMPLOYMENT_R6_B_ONE_SHOT');
  assert.equal(bytes.requestId,id);
  assert.match(bytes.nonce,/^[0-9a-f-]{36}$/);
  assert.deepEqual(lock.release(),{released:true,code:'R6_B_CORE_LOCK_RELEASED'});
  assert.equal(fs.existsSync(path.join(base,'local-cycle.lock')),false);
  assert.deepEqual(lock.release(),{released:false,code:'R6_B_CORE_LOCK_ALREADY_RELEASED'});
}));

test('a concurrent Core or R6 lock refuses without renaming/stale-lock takeover',()=>fixture(base=>{
  const file=path.join(base,'local-cycle.lock'), original='{"pid":999,"at":1}';
  fs.writeFileSync(file,original);
  assert.throws(()=>acquireR6CoreLaneLockFixture({base,requestId:req()}),{code:'R6_B_CORE_LOCK_OCCUPIED'});
  assert.equal(fs.readFileSync(file,'utf8'),original);
}));

test('second R6 claimant cannot acquire before first releases',()=>fixture(base=>{
  const first=acquireR6CoreLaneLockFixture({base,requestId:req()});
  assert.throws(()=>acquireR6CoreLaneLockFixture({base,requestId:req()}),{code:'R6_B_CORE_LOCK_OCCUPIED'});
  assert.equal(first.verifyHeld(),true);
  assert.equal(first.release().released,true);
  const second=acquireR6CoreLaneLockFixture({base,requestId:req()});
  assert.equal(second.verifyHeld(),true);
  assert.equal(second.release().released,true);
}));

test('unexpected in-place modification never removes another owner lock',()=>fixture(base=>{
  const first=acquireR6CoreLaneLockFixture({base,requestId:req()});
  fs.writeFileSync(path.join(base,'local-cycle.lock'),'{"pid":99,"at":2}');
  assert.equal(first.verifyHeld(),false);
  assert.deepEqual(first.release(),{released:false,code:'R6_B_CORE_LOCK_CONTENT_CHANGED'});
  assert.equal(fs.existsSync(path.join(base,'local-cycle.lock')),true);
}));

test('renamed stale lock is never silently stolen or removed',()=>fixture(base=>{
  const first=acquireR6CoreLaneLockFixture({base,requestId:req()});
  const file=path.join(base,'local-cycle.lock');
  fs.renameSync(file,file+'.retired');
  const second=acquireR6CoreLaneLockFixture({base,requestId:req()});
  assert.equal(first.verifyHeld(),false);
  assert.deepEqual(first.release(),{released:false,code:'R6_B_CORE_LOCK_IDENTITY_CHANGED'});
  assert.equal(second.verifyHeld(),true);
  assert.equal(second.release().released,true);
}));

test('invalid request IDs refuse before filesystem mutation',()=>fixture(base=>{
  assert.throws(()=>acquireR6CoreLaneLockFixture({base,requestId:'forged'}),{code:'R6_B_CORE_LOCK_INPUT_INVALID'});
  assert.equal(fs.readdirSync(base).length,0);
}));

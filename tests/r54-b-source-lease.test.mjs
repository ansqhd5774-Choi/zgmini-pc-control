import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {acquireR54BSourceLease} from '../tools/update.mjs';

const fixture=()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'r54-b-owned-lease-'));
 return {root,leaseDir:path.join(root,'R54_B_SOURCE_EXCLUSIVE.lock')};
};

test('B and Writer use exclusive atomic mkdir: BUSY does not touch owner',()=>{
 const f=fixture();
 const first=acquireR54BSourceLease({leaseDir:f.leaseDir});
 assert.equal(first.status,'ACQUIRED');
 assert.equal(first.assertHeld(),true);
 const before=fs.readFileSync(first.owner);
 assert.equal(JSON.parse(before).schema,'ZGMINI_R54_SOURCE_EXCLUSIVE_V1');
 const busy=acquireR54BSourceLease({leaseDir:f.leaseDir});
 assert.equal(busy.status,'BUSY');
 assert.equal(busy.owned,false);
 assert.deepEqual(fs.readFileSync(first.owner),before);
 assert.equal(first.release(),true);
 assert.equal(fs.existsSync(f.leaseDir),false);
 const next=acquireR54BSourceLease({leaseDir:f.leaseDir});
 assert.equal(next.status,'ACQUIRED');
 assert.equal(next.release(),true);
});

test('changed owner bytes cause hard stop, never delete another owner lease',()=>{
 const f=fixture();
 const lease=acquireR54BSourceLease({leaseDir:f.leaseDir});
 fs.writeFileSync(lease.owner,'{"schema":"R54_FOREIGN_OWNER"}\n');
 assert.equal(lease.assertHeld(),false);
 assert.throws(()=>lease.release(),/R54_B_SOURCE_LEASE_OWNER_DRIFT/);
 assert.equal(fs.existsSync(f.leaseDir),true);
});

test('ambiguous owner persistence retains lock directory for recovery',()=>{
 const f=fixture();
 const broken={...fs,fsyncSync(){throw Error('injected_fs_failure')}};
 assert.throws(()=>acquireR54BSourceLease({leaseDir:f.leaseDir,
  fsImpl:broken}),/R54_B_SOURCE_LEASE_OWNER_UNKNOWN/);
 assert.equal(fs.existsSync(f.leaseDir),true);
});

test('unexpected mkdir denial is UNKNOWN; no retry or fallback lock',()=>{
 const f=fixture();
 const broken={...fs,mkdirSync(){throw Object.assign(Error('EACCES'),{code:'EACCES'})}};
 assert.throws(()=>acquireR54BSourceLease({leaseDir:f.leaseDir,
  fsImpl:broken}),/R54_B_SOURCE_LEASE_ACQUIRE_UNKNOWN/);
 assert.equal(fs.existsSync(f.leaseDir),false);
});

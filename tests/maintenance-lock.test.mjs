import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {acquireMaintenanceLock,maintenanceLockStatus} from '../tools/maintenance-lock.mjs';

function fixture(){return fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-maintenance-lock-'));}
test('two update requests cannot acquire the global Controller-install lease',()=>{
 const root=fixture(),first=acquireMaintenanceLock(root,'controller-install');
 assert.equal(maintenanceLockStatus(root,'controller-install').held,true);
 assert.throws(()=>acquireMaintenanceLock(root,'controller-install'),{code:'MAINTENANCE_LOCK_BUSY_OR_RECOVERY_REQUIRED'});
 first.release();const second=acquireMaintenanceLock(root,'controller-install');second.release();
});
test('a second Startup receiver cannot poll in parallel with the first',()=>{
 const root=fixture(),one=acquireMaintenanceLock(root,'receiver');
 assert.throws(()=>acquireMaintenanceLock(root,'receiver'),{code:'MAINTENANCE_LOCK_BUSY_OR_RECOVERY_REQUIRED'});
 one.release();
});
test('uncertain install retains its lock and cannot silently retry',()=>{
 const root=fixture(),one=acquireMaintenanceLock(root,'controller-install');one.holdForRecovery();
 assert.equal(maintenanceLockStatus(root,'controller-install').recoveryRequired,true);
 assert.throws(()=>acquireMaintenanceLock(root,'controller-install'),{code:'MAINTENANCE_LOCK_BUSY_OR_RECOVERY_REQUIRED'});
});
test('lock release verifies its nonce; never removes another owner',()=>{
 const root=fixture(),one=acquireMaintenanceLock(root,'receiver');
 const file=path.join(root,'leases/receiver/owner.json');
 fs.writeFileSync(file,JSON.stringify({...one.owner,nonce:'different-owner'}));
 assert.throws(()=>one.release(),{code:'MAINTENANCE_LOCK_OWNER_CHANGED'});
 assert.ok(fs.existsSync(file));
});
test('arbitrary lock name and broad path are denied',()=>{
 const root=fixture();assert.throws(()=>acquireMaintenanceLock(root,'core'),{code:'MAINTENANCE_LOCK_NAME'});
 assert.throws(()=>acquireMaintenanceLock('/', 'receiver'),{code:'MAINTENANCE_LOCK_ROOT'});
 assert.throws(()=>acquireMaintenanceLock(path.parse(path.resolve(root)).root,'receiver'),{code:'MAINTENANCE_LOCK_ROOT'});
});

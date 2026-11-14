import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';
import {decide,archiveDeadLease,pauseReasons} from '../tools/runner-watchdog.mjs';
test('fresh heartbeat is required for healthy status',()=>{
 const now=Date.now(),owner={pid:123};
 assert.equal(decide({owner,live:true,heartbeat:new Date(now).toISOString(),now}),'HEALTHY');
 assert.equal(decide({owner,live:true,heartbeat:new Date(now-60000).toISOString(),now}),'BLOCKED_LIVE_OR_UNKNOWN');
});
test('maintenance and intentional pause suppress recovery',()=>{
 assert.equal(decide({paused:true,owner:{pid:123},live:false}),'PAUSED');
});
test('only a proven dead owner permits recovery',()=>{
 assert.equal(decide({owner:{pid:123},live:null}),'BLOCKED_LIVE_OR_UNKNOWN');
 assert.equal(decide({owner:{pid:123},live:false}),'RECOVER');
});

test('paused recovery identifies the installation barrier even when the supervisor is dead',()=>{
 const reasons=pauseReasons({installLease:true});
 assert.deepEqual(reasons,['CONTROLLER_INSTALL_LEASE']);
 assert.equal(decide({paused:reasons.length>0,owner:{pid:123},live:false}),'PAUSED');
});

test('all simultaneous pause causes are retained without lease contents',()=>{
 const reasons=pauseReasons({operatorPause:true,controllerDrain:true,installLease:true,otherControlLease:true});
 assert.deepEqual(reasons,['OPERATOR_PAUSE','CONTROLLER_DRAIN','CONTROLLER_INSTALL_LEASE','OTHER_CONTROLLER_LEASE']);
});

test('no pause reason preserves proven-dead and unknown-owner decisions',()=>{
 const paused=pauseReasons({}).length>0;
 assert.equal(paused,false);
 assert.equal(decide({paused,owner:{pid:123},live:false}),'RECOVER');
 assert.equal(decide({paused,owner:{pid:123},live:null}),'BLOCKED_LIVE_OR_UNKNOWN');
});
test('dead lease is archived intact; live or reused PID is never removed',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-watchdog-'));
 const lease=path.join(root,'supervisor');fs.mkdirSync(lease);
 const bytes=JSON.stringify({pid:123,nonce:'proof'});fs.writeFileSync(path.join(lease,'owner.json'),bytes);
 assert.throws(()=>archiveDeadLease(lease,()=>true),/NOT_PROVEN_DEAD/);
 assert.throws(()=>archiveDeadLease(lease,()=>null),/NOT_PROVEN_DEAD/);
 const archived=archiveDeadLease(lease,()=>false);
 assert.equal(fs.readFileSync(path.join(archived,'owner.json'),'utf8'),bytes);
 assert.equal(fs.existsSync(lease),false);
});

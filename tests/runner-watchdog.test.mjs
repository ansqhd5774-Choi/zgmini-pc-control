import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';
import {decide,archiveDeadLease} from '../tools/runner-watchdog.mjs';
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

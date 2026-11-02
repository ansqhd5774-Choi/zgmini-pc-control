import test from'node:test';import assert from'node:assert/strict';
import{reconnectState}from'../tools/update.mjs';
import{cooperativeStopRequested}from'../tools/maintenance-agent.mjs';
import fs from'node:fs';import os from'node:os';import path from'node:path';
test('server session expiry remains WAIT after one minute, bounded at ten minutes',()=>{
 assert.equal(reconnectState({now:90000,deadline:600000,matched:true,online:false}),'WAIT');
 assert.equal(reconnectState({now:300000,deadline:600000,matched:true,online:true}),'PASS');
 assert.equal(reconnectState({now:600000,deadline:600000,matched:true,online:false}),'TIMEOUT');
 assert.equal(reconnectState({now:1000,deadline:600000,matched:false,online:true}),'WAIT');
});
test('normal receiver stop binds PID nonce source and never interrupts install',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-stop-')),owner={pid:123,nonce:'owner'};
 fs.writeFileSync(root+'/MAINTENANCE_INSTALL.json',JSON.stringify({sourceSha:'a'.repeat(40)}));
 fs.writeFileSync(root+'/STOP_REQUEST.json','invalid');assert.equal(cooperativeStopRequested(root,owner),false);
 const request={schema:'ZGMINI_MAINTENANCE_STOP_V1',pid:123,nonce:'wrong',sourceSha:'a'.repeat(40)};
 fs.writeFileSync(root+'/STOP_REQUEST.json',JSON.stringify(request));assert.equal(cooperativeStopRequested(root,owner),false);
 request.nonce='owner';fs.writeFileSync(root+'/STOP_REQUEST.json',JSON.stringify(request));
 fs.mkdirSync(root+'/leases/controller-install',{recursive:true});assert.equal(cooperativeStopRequested(root,owner),false);
 fs.rmdirSync(root+'/leases/controller-install');assert.equal(cooperativeStopRequested(root,owner),true);
 assert.ok(fs.existsSync(root+'/STOP_HANDLED-owner.json'));
});

import test from'node:test';import assert from'node:assert/strict';
import{reconnectState,freshListenerCount}from'../tools/update.mjs';
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
test('API Online cannot substitute for six fresh listener connections',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-listener-')),now=Date.now();
 for(let seat=1;seat<=6;seat++){
  const dir=path.join(root,'runners',String(seat).padStart(2,'0'),'_diag');fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(dir+'/Runner_20261102-000000-utc.log','INFO Listening for Jobs\n');
 }
 assert.equal(freshListenerCount(root,now),6);
 const file=path.join(root,'runners/06/_diag/Runner_20261102-000000-utc.log');
 fs.appendFileSync(file,'A session for this runner already exists.\n');assert.equal(freshListenerCount(root,now),5);
 fs.appendFileSync(file,'Runner reconnected.\n');assert.equal(freshListenerCount(root,now),6);
 assert.equal(freshListenerCount(root,now+10000),0);
});

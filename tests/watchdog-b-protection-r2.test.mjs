import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {requireCurrentProtection,verifyApprovedControllerHost} from '../watchdog-b/upgrade.mjs';
const hash=x=>createHash('sha256').update(x).digest('hex');
const ctrl='badad9124157879d7a645b64f2768113d632355b';
function state(){
 const historical={
  'ZGMINI-PC-Local-Core':hash('core-xml'),
  'ZGMINI-PC-Local-Korea':hash('korea-xml'),
  'ZGMINI-PC-Iran-Progress-R13':hash('old-iran-task'),
  'E:/ZGmini/data/pc-writer/config.json':hash('writer-before'),
  'E:/ZGmini/automation/pc-control/host.json':hash('controller-before')};
 const current={...historical,
  'ZGMINI-PC-Iran-Progress-R13':'APPROVED_RETIRED_ABSENT',
  'E:/ZGmini/data/pc-writer/config.json':hash('writer-approved-after'),
  'E:/ZGmini/automation/pc-control/host.json':hash('controller-approved-after')};
 return {historical,current};
}
test('historical approved config, host and Iran differences do not globally block unrelated B',()=>{
 assert.equal(requireCurrentProtection(state()),true);
});
test('missing protected historical file, task unknown or spoofed Iran are hard stops',()=>{
 for(const mutate of [
  x=>delete x.current['E:/ZGmini/automation/pc-control/host.json'],
  x=>x.current['ZGMINI-PC-Iran-Progress-R13']=hash('iran-returned'),
  x=>x.current['ZGMINI-PC-Local-Core']='BAD',
  x=>x.current['UNAPPROVED_PATH']=hash('extra'),
 ]){const x=state();mutate(x);
  assert.throws(()=>requireCurrentProtection(x),/WATCHDOG_B_PROTECTED/);
 }
});
test('exact existing Controller source and each installed Controller file remain pinned',()=>{
 const host={controllerSourceSha:ctrl,
  controllerFiles:{'controller/supervisor.mjs':hash('original-runtime')}};
 const read=()=>Buffer.from('original-runtime');
 assert.equal(verifyApprovedControllerHost(host,ctrl,read),true);
 assert.throws(()=>verifyApprovedControllerHost({...host,controllerSourceSha:'a'.repeat(40)},ctrl,read),
  /WATCHDOG_B_APPROVED_CONTROLLER_SHA_DRIFT/);
 assert.throws(()=>verifyApprovedControllerHost(host,ctrl,()=>Buffer.from('tampered')),
  /WATCHDOG_B_CONTROLLER_FILE_HASH_DRIFT/);
 assert.throws(()=>verifyApprovedControllerHost({...host,
  controllerFiles:{'../outside.mjs':hash('original-runtime')}},ctrl,read),
  /WATCHDOG_B_CONTROLLER_FILE_HASH_DRIFT/);
});

// Regression for #1374's actual unchanged Core/Korea task categories:
// syntactically valid but *different* digests must not pass the R2 check.
test('Core and Korea Task SHA drift cannot be masked by valid SHA format',()=>{
 for(const task of ['ZGMINI-PC-Local-Core','ZGMINI-PC-Local-Korea']){
  const changed=state();
  changed.current[task]=hash('unapproved-'+task);
  assert.throws(()=>requireCurrentProtection(changed),
    /WATCHDOG_B_CORE_KOREA_TASK_DRIFT/);
  const missing=state();
  delete missing.historical[task];
  assert.throws(()=>requireCurrentProtection(missing),
    /WATCHDOG_B_CORE_KOREA_TASK_DRIFT/);
 }
});

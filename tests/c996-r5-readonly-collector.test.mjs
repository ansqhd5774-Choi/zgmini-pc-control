import {test} from 'node:test';
import assert from 'node:assert/strict';
import {allowedLogName,eventCode,logTimestamp,classification,TARGET_HOST} from '../c996-r5-readonly/collector.mjs';
test('exact target PC is pinned',()=>assert.equal(TARGET_HOST,'DESKTOP-N62L0NG'));
test('known DISM log basenames are accepted',()=>{
  assert.equal(allowedLogName('COMMIT_NEW_WIM.dism.log'),true);
  assert.equal(allowedLogName('MOUNT_NEW_WIM.dism.log'),true);
  assert.equal(allowedLogName('dism.log'),true);
});
test('dangerous or unrelated names rejected',()=>{
 for(const x of ['..\\secrets.dism.log','../secrets.dism.log','secrets.txt','.env','test.bat','private.log','x.dism.log/abc','C:\\x.dism.log']) assert.equal(allowedLogName(x),false,x);
});
test('commit event without leaking line',()=>assert.equal(eventCode('[12/12/2026 14:22:11] dism.exe /Unmount-Image /Commit /MountDir:C:\\private'),'COMMIT_REQUEST'));
test('mount event',()=>assert.equal(eventCode('DismMountImage index 1'), 'MOUNT_REQUEST'));
test('metadata mention',()=>assert.equal(eventCode('Processing image metadata'), 'METADATA_MENTION'));
test('error mention',()=>assert.equal(eventCode('Error: 5'), 'ERROR_MENTION'));
test('normal unrelated log lines not included',()=>assert.equal(eventCode('User account appears in this diagnostic'),null));
test('timestamps are limited to brackets',()=>{
 assert.equal(logTimestamp('[11/12/2026 08:05:22] blah'),'11/12/2026 08:05:22');
 assert.equal(logTimestamp('secret 11/12/2026 08:05:22'),null);
});
test('commit log absent never implies full validation',()=>assert.equal(classification([],[]),'COMMIT_LOG_NOT_ESTABLISHED'));
test('identified commit log still does not claim drift stage known',()=>assert.equal(classification([], [{name:'COMMIT_NEW_WIM.dism.log',counts:{}}]),'LOGS_PRESENT_STAGE_UNPROVEN'));

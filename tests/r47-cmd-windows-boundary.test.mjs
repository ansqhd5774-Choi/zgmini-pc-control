import test from 'node:test';
import assert from 'node:assert/strict';
import {makeR47WindowsAdapter,runPinnedR47WindowsB}
 from '../task-cmd-b/windows-adapter.mjs';
import {prepareR47SourcePin} from '../task-cmd-b/source-pin.mjs';
test('Windows entrypoints import, but arbitrary request cannot receive Task I/O',()=>{
 assert.equal(typeof runPinnedR47WindowsB,'function');
 assert.equal(typeof prepareR47SourcePin,'function');
 assert.throws(()=>makeR47WindowsAdapter({
  manifest:{status:'APPROVED_B',task:'ZGMINI-PC-Theme-Nine-R47-Private'},
  requestId:'fake'
 },{candidateRoot:'X:/untrusted'}),{
  code:'TASK_CMD_B_APPROVAL_NOT_AUTHENTICATED_STOP'});
});
test('source pin rejects unapproved Issue body before opening a PC file',()=>{
 assert.throws(()=>prepareR47SourcePin({
  controlRoot:'X:/nonexistent',event:{issue:{body:'{}'}},env:{}
 }),{code:'TASK_CMD_B_APPROVAL_PATH_STOP'});
});

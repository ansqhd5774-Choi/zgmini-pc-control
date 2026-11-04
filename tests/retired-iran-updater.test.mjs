import test from 'node:test';
import assert from 'node:assert/strict';
import {confirmRetiredIranAbsent} from '../tools/update.mjs';

const win=(status,stdout='',stderr='')=>({
 status,signal:null,error:undefined,stdout:Buffer.from(stdout),stderr:Buffer.from(stderr)
});
const taskInventory=names=>win(0,names.map(name=>'"\\'+name+'","Ready","N/A"').join('\r\n')+'\r\n');
const missing=()=>win(1,'','ERROR: The system cannot find the file specified.');

test('expected Iran retirement is a protected explicit absence',()=>{
 const out=confirmRetiredIranAbsent({exact:missing(),
  inventory:taskInventory(['ZGMINI-PC-Local-Core','ZGMINI-PC-Local-Korea'])});
 assert.equal(out,'APPROVED_RETIRED_ABSENT');
});

test('UTF-8 Korean missing-task error is classified without permitting access denial',()=>{
 const exact=win(1,'','오류: 시스템이 지정된 파일을 찾을 수 없습니다.');
 assert.equal(confirmRetiredIranAbsent({exact,
  inventory:taskInventory(['ZGMINI-PC-Local-Core','ZGMINI-PC-Local-Korea'])}),
 'APPROVED_RETIRED_ABSENT');
});

test('Iran task reappears with exact name: fail closed',()=>{
 assert.throws(()=>confirmRetiredIranAbsent({
  exact:win(0,'<Task>active</Task>'),inventory:taskInventory(['ZGMINI-PC-Local-Core'])
 }),{code:'RETIRED_IRAN_UNEXPECTEDLY_ACTIVE'});
});

test('Iran task reappears under a different R version: fail closed',()=>{
 assert.throws(()=>confirmRetiredIranAbsent({
  exact:missing(),inventory:taskInventory(['ZGMINI-PC-Local-Core','ZGMINI-PC-Iran-Progress-R14'])
 }),{code:'RETIRED_IRAN_UNEXPECTEDLY_ACTIVE'});
});

test('permission error is not mistaken for intended removal',()=>{
 assert.throws(()=>confirmRetiredIranAbsent({
  exact:win(1,'','ERROR: Access is denied.'),
  inventory:taskInventory(['ZGMINI-PC-Local-Core'])
 }),{code:'RETIRED_IRAN_QUERY_UNCERTAIN'});
});

test('unrelated nonzero exit is not mistaken for removal',()=>{
 assert.throws(()=>confirmRetiredIranAbsent({
  exact:win(2,'','ERROR: Failed to contact service.'),
  inventory:taskInventory(['ZGMINI-PC-Local-Core'])
 }),{code:'RETIRED_IRAN_QUERY_UNCERTAIN'});
});

test('missing scheduler executable is not mistaken for removal',()=>{
 assert.throws(()=>confirmRetiredIranAbsent({
  exact:{...missing(),error:Object.assign(new Error('missing'),{code:'ENOENT'})},
  inventory:taskInventory(['ZGMINI-PC-Local-Core'])
 }),{code:'RETIRED_IRAN_QUERY_UNCERTAIN'});
});

test('task enumeration failure is never treated as absence',()=>{
 assert.throws(()=>confirmRetiredIranAbsent({
  exact:missing(),inventory:win(1,'','ERROR: Access is denied.')
 }),{code:'RETIRED_IRAN_INVENTORY_UNAVAILABLE'});
});

test('empty or unparsable task enumeration is never treated as absence',()=>{
 for(const text of ['', 'The operation completed successfully.']){
  assert.throws(()=>confirmRetiredIranAbsent({
   exact:missing(),inventory:win(0,text)
  }),{code:'RETIRED_IRAN_INVENTORY_UNAVAILABLE'});
 }
});

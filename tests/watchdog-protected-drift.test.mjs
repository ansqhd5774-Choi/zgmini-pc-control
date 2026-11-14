import test from 'node:test';
import assert from 'node:assert/strict';
import {protectedKeyDelta,approveReadonly} from '../watchdog-b/protected-drift-readonly.mjs';
test('a drift reports bounded category without leaking protected hashes',()=>{
 const before={'E:/ZGmini/data/pc-writer/config.json':'old',
  'ZGMINI-PC-Local-Core':'same'};
 const after={'E:/ZGmini/data/pc-writer/config.json':'new',
  'ZGMINI-PC-Local-Core':'same'};
 assert.deepEqual(protectedKeyDelta(before,after),
  [{category:'WRITER_CONFIG',change:'CHANGED'}]);
});
test('additions, missing and schema drift cannot be hidden',()=>{
 assert.deepEqual(protectedKeyDelta(
  {'ZGMINI-PC-Local-Korea':'old'},
  {'ZGMINI-PC-Local-Core':'new'}),
  [{category:'CORE_TASK_XML',change:'ADDED'},
   {category:'KOREA_TASK_XML',change:'MISSING'}]);
 assert.throws(()=>protectedKeyDelta({'unknown':1},{}),
  /WATCHDOG_A_PROTECTION_UNKNOWN_FIELD/);
});
test('exact one-off actor and incident are required',()=>{
 const event={action:'opened',
  repository:{full_name:'ansqhd5774-Choi/zgmini-pc-control',private:true},
  sender:{login:'ansqhd5774-Choi'},
  issue:{user:{login:'ansqhd5774-Choi'},
   title:'pc-watchdog-protected-drift-readonly',labels:[{name:'pc-maintenance'}]}};
 const body={schema:'ZGMINI_PC_WATCHDOG_PROTECTED_DRIFT_A_REQUEST_V1',
  requestId:'pc-watchdog-a-12345678-aaaa-4123-9123-abcdef012345',
  operation:'watchdog-protected-drift-readonly',failedIssueNumber:1372};
 assert.deepEqual(approveReadonly(event,body),body);
 assert.throws(()=>approveReadonly(event,{...body,failedIssueNumber:1373}),
  /WATCHDOG_A_REQUEST_INVALID/);
 assert.throws(()=>approveReadonly({...event,sender:{login:'outsider'}},body),
  /WATCHDOG_A_EVENT_DENIED/);
});

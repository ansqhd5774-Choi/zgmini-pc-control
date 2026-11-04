import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {verifyRetiredIranAbsent,protection} from '../tools/install-runner-watchdog.mjs';

const issueName='ZGMINI-PC-Iran-Progress-R13';
const csv=tasks=>Buffer.from(tasks.map(t=>`"\\\\${t}","Ready"`).join('\r\n')+'\r\n');
const missing={status:1,error:null,signal:null,stdout:Buffer.alloc(0),
 stderr:Buffer.from('ERROR: The system cannot find the file specified.')};
const ok=stdout=>({status:0,error:null,signal:null,stdout,stderr:Buffer.alloc(0)});
const runFor=(exact,inventory)=>args=>args.includes('/TN')?exact:inventory;

test('intentionally retired Iran task is represented by a stable protected sentinel',()=>{
 const value=verifyRetiredIranAbsent(runFor(missing,ok(csv(['ZGMINI-PC-Local-Core','ZGMINI-PC-Local-Korea']))));
 assert.equal(value,'APPROVED_RETIRED_ABSENT');
});
test('active Iran task reappearing is fail closed',()=>{
 assert.throws(()=>verifyRetiredIranAbsent(runFor(ok(Buffer.from('<Task />')),ok(csv(['ZGMINI-PC-Local-Core'])))),
  {code:'WATCHDOG_IRAN_TASK_REAPPEARED'});
});
test('renamed Iran task in inventory is fail closed',()=>{
 assert.throws(()=>verifyRetiredIranAbsent(runFor(missing,ok(csv(['ZGMINI-PC-Local-Core',issueName+'-renamed'])))),
  {code:'WATCHDOG_IRAN_TASK_REAPPEARED'});
});
test('access-denied query cannot masquerade as retired task',()=>{
 const denied={...missing,stderr:Buffer.from('ERROR: Access is denied.')};
 assert.throws(()=>verifyRetiredIranAbsent(runFor(denied,ok(csv(['ZGMINI-PC-Local-Core'])))),
  {code:'WATCHDOG_IRAN_TASK_QUERY_UNCERTAIN'});
});
test('empty inventory is not proof of absence',()=>{
 assert.throws(()=>verifyRetiredIranAbsent(runFor(missing,ok(Buffer.alloc(0)))),
  {code:'WATCHDOG_IRAN_TASK_INVENTORY_UNAVAILABLE'});
});
test('inventory subprocess failure is fail closed',()=>{
 assert.throws(()=>verifyRetiredIranAbsent(runFor(missing,{status:1,error:null,signal:null,stdout:Buffer.alloc(0)})),
  {code:'WATCHDOG_IRAN_TASK_INVENTORY_UNAVAILABLE'});
});
test('mandatory Core and Korea XML remain hashed; Iran sentinel is independently attested',()=>{
 const hash=x=>createHash('sha256').update(x).digest('hex');
 const xml=task=>Buffer.from('<Task name="'+task+'"/>');
 const seen=[];
 const value=protection({queryXml:name=>{seen.push(name);return xml(name);},
  retiredProof:()=>verifyRetiredIranAbsent(runFor(missing,ok(csv(['ZGMINI-PC-Local-Core','ZGMINI-PC-Local-Korea'])))),
  exists:()=>false});
 assert.deepEqual(seen,['ZGMINI-PC-Local-Core','ZGMINI-PC-Local-Korea']);
 assert.equal(value['ZGMINI-PC-Local-Core'],hash(xml('ZGMINI-PC-Local-Core')));
 assert.equal(value['ZGMINI-PC-Local-Korea'],hash(xml('ZGMINI-PC-Local-Korea')));
 assert.equal(value[issueName],'APPROVED_RETIRED_ABSENT');
});

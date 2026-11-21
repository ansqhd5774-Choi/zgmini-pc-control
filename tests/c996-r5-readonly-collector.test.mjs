import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {allowedLogName,eventCode,logTimestamp,classification,TARGET_HOST,statNoLink,eventCodes,createReportBase,collectIndependentEvidence} from '../c996-r5-readonly/collector.mjs';
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
test('COMMIT basename alone is not a logged action',()=>assert.equal(classification([], [{name:'COMMIT_NEW_WIM.dism.log',counts:{}}]),'COMMIT_LOG_NOT_ESTABLISHED'));

test('unchanged no-follow lstat path traversal emits bounded progress markers',()=>{
 const steps=[];
 const st=statNoLink(fileURLToPath(import.meta.url),(operation,depth)=>steps.push({operation,depth}));
 assert.equal(st.isFile(),true);
 assert.deepEqual(steps[0],{operation:'PATH_LSTAT',depth:0});
 assert.deepEqual(steps.at(-1),{operation:'LEAF_RECHECK',depth:0});
 assert.ok(steps.some(x=>x.operation==='PATH_LSTAT'&&x.depth>=1));
 assert.ok(steps.every(x=>Number.isSafeInteger(x.depth)&&x.depth>=0&&x.depth<=24));
});

test('a denied FINAL_WIM preserves the first pin and still collects independent log evidence',async()=>{
 const report=createReportBase();
 const ids=['ADK_WIM','FINAL_WIM','TEST_ISO','BIOS_BCD','UEFI_BCD'];
 const readPins=async(_attempt,_progress,onlyIds=null)=>(onlyIds??ids).map(id=>
  id==='FINAL_WIM'?{id,matched:false,status:'UNVERIFIED',code:'EPERM',
   inspectOperation:'PATH_LSTAT',inspectDepth:0}:
   {id,matched:true,status:'MATCHED',sha256:'a'.repeat(64),bytes:1024});
 const result=await collectIndependentEvidence(report,{
  pins:readPins,metadata:async x=>({id:x.id,status:'MISSING'}),
  discover:()=>({selected:[{id:'ISO_LOGS',name:'COMMIT_NEW_WIM.dism.log'}],omitted:0,errors:[]}),
  inspect:async()=>({directory:'ISO_LOGS',name:'COMMIT_NEW_WIM.dism.log',
   bytes:10,sha256:'b'.repeat(64),lines:1,counts:{COMMIT_REQUEST:1},
   events:[{line:1,code:'COMMIT_REQUEST',at:null}]})
 });
 assert.equal(result.status,'PARTIAL');
 assert.equal(result.code,'INPUT_INTEGRITY_UNVERIFIED');
 assert.equal(result.inputs.length,5);
 assert.equal(result.inputs[0].matched,true);
 assert.equal(result.inputs[1].code,'EPERM');
 assert.equal(result.inputs[1].inspectOperation,'PATH_LSTAT');
 assert.equal(result.inputHashesUnchanged,4);
 assert.equal(result.logScanComplete,true);
 assert.equal(result.logs.length,1);
 assert.equal(result.fixedEvidence.length,6);
});
test('COMMIT in filename never implies a logged commit request',()=>{
 assert.equal(classification([], [{name:'COMMIT_NEW_WIM.dism.log',counts:{}}]),
  'COMMIT_LOG_NOT_ESTABLISHED');
});
test('coincident commit and error on the same log line both survive',()=>{
 assert.deepEqual(eventCodes('DismUnmountImageHandle commit failed to execute'),
  ['COMMIT_REQUEST','ERROR_MENTION']);
});
test('log inventory truncation never claims complete evidence',async()=>{
 const report=createReportBase();
 const ids=['ADK_WIM','FINAL_WIM','TEST_ISO','BIOS_BCD','UEFI_BCD'];
 await collectIndependentEvidence(report,{
  pins:async(_attempt,_progress,onlyIds)=> (onlyIds??ids).map(id=>({
   id,matched:true,status:'MATCHED',bytes:1,sha256:'a'.repeat(64)})),
  metadata:async x=>({id:x.id,status:'MISSING'}),
  discover:()=>({selected:[],omitted:8,errors:[{directory:'ISO_LOGS',code:'LOG_TOO_LARGE'}]}),
  inspect:async()=>{throw Error('should not run')}
 });
 assert.equal(report.status,'PARTIAL');
 assert.equal(report.logScanComplete,false);
 assert.equal(report.logOmitted,8);
 assert.equal(report.code,'LOG_SCAN_INCOMPLETE');
});

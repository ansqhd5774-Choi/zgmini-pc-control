import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {inspectR54TaskXml,createR54WindowsTaskAdapter,r54FixedSchtasks}
 from '../tools/update.mjs';
import {runApprovedR54TaskTransition} from '../tools/theme-nine-r54-task-gate.mjs';
import {FILES} from '../tools/theme-nine-r54-sixfile-b.mjs';

// Exact existing R54 CMD fixture, encoded to preserve its Windows CRLF hash.
const actionBytes=Buffer.from('QGVjaG8gb2ZmDQpzZXRsb2NhbCBFbmFibGVFeHRlbnNpb25zIERpc2FibGVEZWxheWVkRXhwYW5zaW9uDQpyZW0gUjU0IGFwcHJvdmVkIGV4aXN0aW5nLW5pbmUgcHVibGlzaGVyLiBOZXZlciBjb2xsZWN0cyByYXcgYmFycyBvciBtdXRhdGVzIHRhc2tzLg0Kc2V0ICJSNTRfSE9NRT1FOlxaR21pbmlcZGF0YVxwYy13cml0ZXJcdGhlbWUtbmluZS1yNTQiDQpzZXQgIlI1NF9OT0RFPUU6XFpHbWluaVxydW50aW1lXG5vZGUuZXhlIg0Kc2V0ICJaR01JTklfREFUQV9ST09UPUU6XFpHbWluaVxkYXRhIg0Kc2V0ICJSNTRfQ09OU0VOVD0lUjU0X0hPTUUlXFBVQkxJU0hFUl9DT05TRU5UX1I1NC50eHQiDQpzZXQgIlI1NF9MT0dfRElSPSVSNTRfSE9NRSVcbG9ncyINCmlmIG5vdCBleGlzdCAiJVI1NF9MT0dfRElSJVwiIG1rZGlyICIlUjU0X0xPR19ESVIlIiAyPm51bA0Kc2V0ICJSNTRfTE9HPSVSNTRfTE9HX0RJUiVcVEhFTUVfTklORV9SNTRfQ1lDTEVfJVJBTkRPTSVfJVJBTkRPTSUudHh0Ig0KaWYgZXhpc3QgIiVSNTRfTE9HJSIgZXhpdCAvYiAzDQo+IiVSNTRfTE9HJSIgZWNobyBSRVBPUlQ9VEhFTUVfTklORV9SNTRfREFJTFlfUFVCTElDX1NDT1JFX0NPTk5FQ1RJT04NCj4+IiVSNTRfTE9HJSIgZWNobyBTVEFSVEVEPSVEQVRFJSAlVElNRSUNCmlmIG5vdCBleGlzdCAiJVI1NF9OT0RFJSIgZ290byA6c3RvcA0KaWYgbm90IGV4aXN0ICIlUjU0X0NPTlNFTlQlIiBnb3RvIDpzdG9wDQpmaW5kc3RyIC9YIC9DOiJBQ0NFUFRfUjU0X0FOT05ZTU9VU19ERVJJVkVEX1JJU0tfMjAyNjEwMjgiICIlUjU0X0NPTlNFTlQlIiA+bnVsIDI+JjENCmlmIGVycm9ybGV2ZWwgMSBnb3RvIDpzdG9wDQoiJVI1NF9OT0RFJSIgIiVSNTRfSE9NRSVcc2NyaXB0c1xwYy13cml0ZXJcdGhlbWUtbmluZS1yNTQtcHVibGljLWNvbm5lY3QubWpzIiAtLW9uY2UgLS1wdWJsaXNoIC0tYWNjZXB0LWFub255bW91cy1saWNlbnNlLXJpc2sgPj4iJVI1NF9MT0clIiAyPiYxDQppZiBlcnJvcmxldmVsIDEgZ290byA6c3RvcA0KaWYgZXhpc3QgIiVSNTRfSE9NRSVcUjg4X1BPU1RfU1RFUC5jbWQiIGNhbGwgIiVSNTRfSE9NRSVcUjg4X1BPU1RfU1RFUC5jbWQiID4+IiVSNTRfTE9HJSIgMj4mMQ0KaWYgZXJyb3JsZXZlbCAxIGdvdG8gOnN0b3ANCj4+IiVSNTRfTE9HJSIgZWNobyBSRVNVTFQ9RVhFQ1VURURfQ0hFQ0tfSlNPTl9TVEFUVVMNCmV4aXQgL2IgMA0KOnN0b3ANCj4+IiVSNTRfTE9HJSIgZWNobyBSRVNVTFQ9U1RPUF9PUl9QRU5ESU5HX1JFVklFV19UWFQNCmV4aXQgL2IgMQ0K','base64');
const action=['E:','ZGmini','data','pc-writer','theme-nine-r54',
 'scripts','pc-writer','THEME_NINE_R54_PUBLIC_CYCLE.cmd'].join('\\');
const authorization={grade:'B',scope:'ONE_TIME_R54_TASK_PAUSE_RESTORE_B',
 taskName:'ZGMINI-PC-Theme-Nine-R54-Public',singleUse:true,
 preserveTaskDefinition:true,allowForceTermination:false,
 allowOtherTaskChanges:false};
function taskXml(enabled=true,command=action){
 return Buffer.from('<?xml version="1.0" encoding="UTF-8"?>'
  +'<Task><Settings><Enabled>'+enabled+'</Enabled></Settings>'
  +'<Actions><Exec><Command>'+command+'</Command></Exec></Actions></Task>');
}
function sandbox(t,enabled=true){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'r54-task-adapter-fixture-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 let current=enabled;
 const commands=[];
 const runTask=args=>{
  commands.push(args);
  if(args[0]==='/Query')return {status:0,stdout:taskXml(current)};
  if(args[0]==='/Change'){
   if(args[3]==='/Disable')current=false;
   else if(args[3]==='/Enable')current=true;
   else throw Error('UNEXPECTED_TASK_ACTION');
   return {status:0,stdout:Buffer.alloc(0)};
  }
  throw Error('UNEXPECTED_TASK_COMMAND');
 };
 const adapter=createR54WindowsTaskAdapter({
  requestId:'pc-r54-b-simulation-001',authorization,runTask,
  readActionBytes:()=>actionBytes,backupBase:root,platform:'win32'});
 return {adapter,commands,root};
}

test('pinned Task XML and existing CMD bytes are parsed without altering the Task',()=>{
 const before=inspectR54TaskXml(taskXml(true),actionBytes);
 const after=inspectR54TaskXml(taskXml(false),actionBytes);
 assert.equal(before.enabled,true);
 assert.equal(after.enabled,false);
 assert.equal(after.definitionDigest,before.definitionDigest);
 assert.notEqual(before.xmlSha256,after.xmlSha256);
 assert.equal(before.actionPath,action);
 assert.throws(()=>inspectR54TaskXml(taskXml(true,action+'-drift'),actionBytes),
  /R54_TASK_ACTION_CHANGED/);
 assert.throws(()=>inspectR54TaskXml(taskXml(true),Buffer.from('modified CMD')),
  /R54_TASK_ACTION_SOURCE_DRIFT/);
});

test('same Task with XML indentation/declaration formatting remains equivalent',()=>{
 const original=inspectR54TaskXml(taskXml(true),actionBytes);
 const reserialized=Buffer.from('<Task>\n <Settings>\n  <Enabled>false</Enabled>\n </Settings>\n'
  +'<Actions><Exec><Command>'+action+'</Command></Exec></Actions>\n</Task>');
 const observed=inspectR54TaskXml(reserialized,actionBytes);
 assert.equal(observed.definitionDigest,original.definitionDigest);
 assert.notEqual(observed.xmlSha256,original.xmlSha256);
});

test('one pinned Task: persist verified XML backup, disable, then restore original bytes',t=>{
 const {adapter,commands,root}=sandbox(t,true);
 const baseline=adapter.saveBaseline();
 assert.equal(baseline.enabled,true);
 assert.equal(baseline.durableXmlBackupReadback,true);
 const onDisk=path.join(root,'r54-pc-r54-b-simulation-001','BASELINE.json');
 assert.equal(fs.existsSync(onDisk),true);
 assert.equal(adapter.disable().enabled,false);
 assert.throws(()=>adapter.restore(),/R54_TASK_RESTORE_SOURCE_UNVERIFIED/);
 const restored=adapter.restore({writerSixHashVerified:true});
 assert.equal(restored.enabled,true);
 assert.equal(restored.xmlSha256,baseline.xmlSha256);
 const changes=commands.filter(x=>x[0]==='/Change');
 assert.deepEqual(changes,[
  ['/Change','/TN','ZGMINI-PC-Theme-Nine-R54-Public','/Disable'],
  ['/Change','/TN','ZGMINI-PC-Theme-Nine-R54-Public','/Enable']]);
});

test('pre-existing disabled R54 Task stays disabled; no extra Task writes',t=>{
 const {adapter,commands}=sandbox(t,false);
 const baseline=adapter.saveBaseline();
 assert.equal(baseline.enabled,false);
 assert.equal(adapter.disable().enabled,false);
 assert.equal(adapter.restore({writerSixHashVerified:true}).enabled,false);
 assert.equal(commands.filter(x=>x[0]==='/Change').length,0);
});

test('without pinned source/Windows port there is no safe Task management',()=>{
 assert.throws(()=>createR54WindowsTaskAdapter({platform:'linux'}),
  /R54_TASK_TRUSTED_WINDOWS_ADAPTER_REQUIRED/);
 assert.throws(()=>createR54WindowsTaskAdapter({
  platform:'win32',requestId:'pc-r54-b-simulation-001',
  runTask:()=>({status:0,stdout:Buffer.alloc(0)}),
  readActionBytes:()=>actionBytes}),/R54_TASK_B_EXCEPTION_REQUIRED/);
 assert.throws(()=>inspectR54TaskXml(taskXml(true),Buffer.alloc(0)),
  /R54_TASK_ACTION_SOURCE_DRIFT/);
});

test('fixed Windows schtasks port prohibits all other task names and commands',()=>{
 const records=[];
 const mock=(bin,args,options)=>{
  records.push({bin,args,options});
  return {status:0,stdout:taskXml(true)};
 };
 const env={platform:'win32',systemRoot:'C:\\Windows',spawnTask:mock};
 r54FixedSchtasks(['/Query','/TN','ZGMINI-PC-Theme-Nine-R54-Public','/XML'],env);
 assert.equal(records.length,1);
 assert.match(records[0].bin,/System32\\schtasks\.exe$/);
 assert.equal(records[0].options.shell,false);
 assert.throws(()=>r54FixedSchtasks(['/Change','/TN','OTHER-TASK','/Disable'],env),
  /R54_TASK_COMMAND_OUT_OF_SCOPE/);
 assert.throws(()=>r54FixedSchtasks(['/Delete','/TN','ZGMINI-PC-Theme-Nine-R54-Public'],env),
  /R54_TASK_COMMAND_OUT_OF_SCOPE/);
});

test('fixed native Task adapter satisfies B one-shot transition contract',async t=>{
 const {adapter,commands}=sandbox(t,true);
 let phase='old',applies=0;
 const ports={...adapter,
  closedRoutes:async()=>({taskName:authorization.taskName,
   schedulerStartDisabled:true,taskNotRunning:true,childProcessCount:0,
   conflictingSourceLaunches:0,installWindowExclusivityVerified:true,
   relevantLocksClear:true,exclusiveBLeaseHeld:true}),
  readSixHashes:async()=>FILES.map(x=>({...x,actual:x[phase]})),
  wait:async()=>{},
 };
 const result=await runApprovedR54TaskTransition({authorization,ports,
  applySix:async()=>{applies++;phase='next';
   return {status:'SIX_FILE_SOURCE_APPLIED_SHA_VERIFIED'};},waitMs:0});
 assert.equal(result.status,'R54_SIXFILE_AND_TASK_RESTORED_VERIFIED');
 assert.equal(applies,1);
 assert.equal(commands.filter(x=>x[0]==='/Change').length,2);
});

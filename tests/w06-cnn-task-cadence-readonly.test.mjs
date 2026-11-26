import test from 'node:test';
import assert from 'node:assert/strict';
import {PROBE,projectW06TaskCadence,inspectW06TaskCadenceReadonly} from
 '../controller/w06-cnn-task-cadence-readonly.mjs';

const sample=(extra={})=>({schema:'ZGMINI_W06_CNN_TASK_CADENCE_RAW_V1',
 observedAtUtc:'2026-11-26T11:49:19.000Z',tasks:[{
 name:'ZGMINI-PC-Local-Core',state:'Running',enabled:true,triggerCount:1,
 intervalsSeconds:[300],unverifiedIntervals:0,actionKind:'SCRIPT_HOST',
 cnnMinuteLiteral:false,infoAvailable:true,
 lastRunUtc:'2026-11-26T11:45:00.000Z',
 nextRunUtc:'2026-11-26T11:50:00.000Z',lastTaskResult:0,
 secretArguments:'C:\\Users\\PRIVATE\\some-secret'
 },{name:'ZGMINI-PC-CNN-Minutecycle',state:'Ready',enabled:true,triggerCount:1,
 intervalsSeconds:[60],unverifiedIntervals:0,actionKind:'NODE',
 cnnMinuteLiteral:true,infoAvailable:true,
 lastRunUtc:'2026-11-26T11:49:00.000Z',
 nextRunUtc:'2026-11-26T11:50:00.000Z',lastTaskResult:0,rawXml:'SECRET_XML'
 }],...extra});

test('W06 cadence projects bounded Task details but never raw actions, paths, or secrets',()=>{
 const r=projectW06TaskCadence(sample());
 assert.equal(PROBE,'w06-cnn-task-cadence-readonly');
 assert.equal(r.status,'PASS');
 assert.deepEqual(r.cnnMinuteTaskNames,['ZGMINI-PC-CNN-Minutecycle']);
 assert.deepEqual(r.tasks[0].repetitionIntervalsSeconds,[300]);
 assert.equal(r.tasks[1].lastTaskResult,0);
 assert.match(r.evidence,/NOT_NATURAL_60S_EXECUTION_PROOF/);
 assert.doesNotMatch(JSON.stringify(r),/PRIVATE|SECRET|Arguments|rawXml|token/i);
 assert.equal(r.operationalWrites,0);
 assert.equal(r.providerCalls,0);
 assert.equal(r.d1Writes,0);
});
test('W06 cadence preserves missing evidence as partial and rejects arbitrary/duplicate tasks',()=>{
 const unknown=sample();
 unknown.tasks[1].infoAvailable=false;
 unknown.tasks[1].lastRunUtc=null;
 unknown.tasks[1].unverifiedIntervals=1;
 const p=projectW06TaskCadence(unknown);
 assert.equal(p.status,'PARTIAL');
 assert.equal(p.unknownTaskCount,1);
 assert.equal(projectW06TaskCadence(sample({tasks:[...sample().tasks,
  {...sample().tasks[0]}]})).status,'STATE_UNKNOWN');
 assert.equal(projectW06TaskCadence(sample({tasks:[{...sample().tasks[0],
  name:'Other-Task'}]})).status,'STATE_UNKNOWN');
 assert.equal(projectW06TaskCadence(sample({tasks:[{...sample().tasks[0],
  intervalsSeconds:[-1]}]})).status,'STATE_UNKNOWN');
 assert.equal(projectW06TaskCadence(sample({tasks:[{...sample().tasks[0],
  lastRunUtc:'not-a-time'}]})).status,'STATE_UNKNOWN');
 assert.equal(projectW06TaskCadence(sample({tasks:Array(49).fill(sample().tasks[0])})).status,'STATE_UNKNOWN');
});
test('W06 probe uses fixed Windows command, no shell, never runs any Task',()=>{
 let args,opts,executable;
 const observed=inspectW06TaskCadenceReadonly({
  platform:'win32',systemRoot:'C:\\Windows',exists:()=>true,
  run:(exe,a,options)=>{
   executable=exe;args=a;opts=options;
   return {status:0,stdout:JSON.stringify(sample())};
  }});
 assert.equal(observed.status,'PASS');
 assert.match(executable,/powershell\.exe$/);
 assert.equal(args[3],'-EncodedCommand');
 assert.equal(opts.shell,false);
 assert.equal(opts.timeout,25000);
 assert.doesNotMatch(JSON.stringify(args),/PRIVATE|SECRET/);
 const ps=Buffer.from(args[4],'base64').toString('utf16le');
 assert.match(ps,/Get-ScheduledTaskInfo/);
 assert.doesNotMatch(ps,/Start-ScheduledTask|Set-ScheduledTask|Register-ScheduledTask|Invoke-WebRequest|SQLite|wrangler/i);
 assert.equal(inspectW06TaskCadenceReadonly({platform:'linux'}).status,'STATE_UNKNOWN');
 assert.equal(inspectW06TaskCadenceReadonly({
  platform:'win32',systemRoot:'C:\\Windows',exists:()=>true,
  run:()=>({status:1,stdout:'PRIVATE_ERROR'})}).status,'STATE_UNKNOWN');
});

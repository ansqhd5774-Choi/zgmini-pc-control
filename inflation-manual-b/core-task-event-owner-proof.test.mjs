import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {verifyCoreTaskEvent129,shouldAttemptCoreOwnerProof,
 shouldAcceptVisibleCoreOwner,shouldWaitForV2OwnerEvidence}
 from './core-task-event-owner-proof.mjs';

// Sanitized fixture only. Never read the host's TaskScheduler log in tests.
const eventAt=Date.parse('2026-11-15T14:00:00.000Z');
const now=Date.parse('2026-11-15T14:04:00.000Z');
const basic={
 lockPid:4321,lockAt:eventAt+15_000,ownerCreatedAtMs:eventAt-1000,
 taskRunning:true,ownerCoreMatched:true,now,
};
const event=(o={})=>{
 const id=o.id??129;
 const provider=o.provider??'Microsoft-Windows-TaskScheduler';
 const channel=o.channel??'Microsoft-Windows-TaskScheduler/Operational';
 const task=o.task??String.raw`\ZGMINI-PC-Local-Core`;
 const path=o.path??String.raw`E:\ZGmini\runtime\node.exe`;
 const pid=o.pid??4321;
 const at=o.at??'2026-11-15T14:00:00.000Z';
 return `<Events><Event xmlns="http://schemas.microsoft.com/win/2004/08/events/event">
 <System><Provider Name="${provider}"/><EventID>${id}</EventID>
 <TimeCreated SystemTime="${at}"/><Channel>${channel}</Channel></System>
 <EventData><Data Name="TaskName">${task}</Data>
 <Data Name="Path">${path}</Data><Data Name="ProcessID">${pid}</Data></EventData>
 </Event></Events>`;
};
const proof=(xml,opts={})=>verifyCoreTaskEvent129({...basic,xml,...opts});

test('one signed-in-time task process creation record directly proves same Core lock PID',()=>{
 const r=proof(event());
 assert.equal(r.ok,true);
 assert.equal(r.code,'INFL_MANUAL_B_CORE_TASK_EVENT129_PID_LINKED');
 assert.equal(r.proof,'TASKSCHEDULER_OPERATIONAL_129_PLUS_LIVE_WMI_AND_LOCK');
 assert.equal(JSON.stringify(r).includes('4321'),false);
 assert.equal(JSON.stringify(r).includes('node.exe'),false);
});
test('security-context-filtered running task is not a permit without log AND live owner',()=>{
 for(const opts of [
  {taskRunning:false},
  {ownerCoreMatched:false},
  {ownerCreatedAtMs:null},
  {lockAt:null},
  {lockPid:-1},
 ]){
  assert.equal(proof(event(),opts).ok,false);
 }
 assert.equal(proof('ACCESS DENIED').ok,false);
});
test('PID reuse and event/owner/process start mismatch reject past task launches',()=>{
 for(const opts of [
  {lockPid:7777},
  {ownerCreatedAtMs:eventAt-180_000},
  {ownerCreatedAtMs:eventAt+180_000},
  {lockAt:eventAt+3_800_000,now:eventAt+4_000_000},
  {lockAt:eventAt-60_000},
  {now:eventAt-1},
 ])assert.equal(proof(event(),opts).ok,false);
});
test('event provider, EventID, channel, TaskName, binary and ProcessID are all pinned',()=>{
 const bad=[
  {id:200},{provider:'Other'},{channel:'Security'},
  {task:'\\Other-Task'},{path:'C:\\Windows\\System32\\cmd.exe'},
  {pid:2222},
 ];
 for(const replacement of bad){
  assert.equal(proof(event(replacement)).ok,false,
   JSON.stringify(replacement));
 }
});
test('event169 and unrelated event cannot be upgraded to identity proof',()=>{
 const wrong=event({id:169});
 assert.equal(proof(wrong).ok,false);
 const wrongTask=event({task:'\\Unrelated'});
 assert.equal(proof(wrongTask).ok,false);
 const result=proof(wrongTask.replace('</Events>','')+
  event().replace('<Events>',''));
 assert.equal(result.ok,true); // only exact matching record is accepted
});
test('Task event log is strictly bounded; no arbitrary logs or unbounded parse',()=>{
 assert.equal(proof('x'.repeat(300_001)).ok,false);
 const many='<Events>'+Array.from({length:65},()=>event({pid:999})
  .replace('<Events>','').replace('</Events>','')).join('')+'</Events>';
 assert.equal(proof(many).code,'INFL_MANUAL_B_EVENT129_LOG_TOO_LARGE');
});

function runSanitizedWshProbe({visibleEngines=[],taskState=4,command=null,
 taskEnabled=true,created='20261115'+'230000.000000+540'}={}){
 const js=fs.readFileSync(new URL('./core-lock-owner-probe.js',import.meta.url),'utf8');
 const node=String.raw`E:\ZGmini\runtime\node.exe`;
 const script=String.raw`E:\ZGmini\projects\zgmini-earnings-history-pc-release\scripts\pc-writer\local-cycle.mjs`;
 const cmd=command??('"'+node+'" "'+script+'" --publish');
 const rows=[{ProcessId:4321,ParentProcessId:777,Name:'node.exe',
  CommandLine:cmd,CreationDate:created},
 {ProcessId:777,ParentProcessId:1,Name:'cmd.exe',CommandLine:'',CreationDate:created}];
 const output=[];
 function Enumerator(items){
  let cursor=0;
  this.atEnd=()=>cursor>=items.length;
  this.moveNext=()=>{cursor++;};
  this.item=()=>items[cursor];
 }
 const task={
  Enabled:taskEnabled,State:taskState,
  GetInstances:()=>({Count:visibleEngines.length,
   Item:i=>({EnginePID:visibleEngines[i-1]})}),
 };
 const sandbox={
  WScript:{Arguments:{length:1,Item:()=>String(4321)},Echo:x=>output.push(x)},
  // WSH invokes the COM creator with new; an arrow mock is not constructible.
  ActiveXObject:function(){return {Connect:()=>{},GetFolder:()=>({GetTask:()=>task})};},
  GetObject:()=>({ExecQuery:()=>rows}),
  Enumerator,
 };
 vm.runInNewContext(js,sandbox,{timeout:2000});
 assert.equal(output.length,1);
 return JSON.parse(output[0]);
}
test('WSH owner probe returns sanitized live identity despite security-filtered instances',()=>{
 const p=runSanitizedWshProbe();
 assert.equal(p.ok,true);
 assert.equal(p.linked,false);
 assert.equal(p.taskRunning,true);
 assert.equal(p.ownerCoreMatched,true);
 assert.equal(p.ownerKoreaMatched,false);
 assert.ok(Number.isSafeInteger(p.ownerCreatedAtMs));
 assert.equal(JSON.stringify(p).includes('node.exe'),false);
 assert.equal(JSON.stringify(p).includes('4321'),false);
});
test('legacy EnginePID chain stays linked when the actual Task PID is visible',()=>{
 const p=runSanitizedWshProbe({visibleEngines:[4321]});
 assert.equal(p.linked,true);
 assert.equal(p.ownerCoreMatched,true);
});
test('WSH cannot approve an unrelated Node, absent task state, or unverified creation',()=>{
 for(const opts of [
  {command:'node.exe unrelated.js'},
  {command:'"E:\\ZGmini\\runtime\\node.exe" "E:\\other\\local-cycle.mjs" --publish'},
  {taskState:3},
  {taskEnabled:false},
  {created:'invalid'}
 ]){
  const p=runSanitizedWshProbe(opts);
  assert.equal(p.ownerCoreMatched&&p.taskRunning&&Number.isSafeInteger(p.ownerCreatedAtMs),
   false);
 }
});

test('V2 event fallback observation gate is reachable with GetInstances filtered',()=>{
 // Reproduce actual #1461 shape: 0/38 visible Task instances, Core lock present.
 const filtered={instances:0,relatedProcesses:0};
 assert.equal(shouldAttemptCoreOwnerProof(true,filtered,true),true);
 assert.equal(shouldAttemptCoreOwnerProof(false,filtered,true),false);
 // The gate never accepts a missing lock or unknown legacy Task linkage.
 assert.equal(shouldAttemptCoreOwnerProof(true,filtered,false),false);
 assert.equal(shouldAttemptCoreOwnerProof(false,{instances:1,relatedProcesses:0},true),false);
 assert.equal(shouldAttemptCoreOwnerProof(false,{instances:1,relatedProcesses:1},true),true);
 // Passing the gate is not ownership proof; matching 129 + live identity
 // remains mandatory and fails closed when the event is absent.
 assert.equal(proof('NO EVENT 129').ok,false);
});

test('V2 waits for normal Korea-held lock and Task non-running instead of early one-shot STOP',()=>{
 const transient={isV2:true,linked:false,taskRunning:false};
 assert.equal(shouldWaitForV2OwnerEvidence(transient),true);
 assert.equal(shouldWaitForV2OwnerEvidence({...transient,isV2:false}),false);
 assert.equal(shouldWaitForV2OwnerEvidence({...transient,linked:true}),false);
 assert.equal(shouldWaitForV2OwnerEvidence({...transient,taskRunning:null}),false);
});
test('V2 waits only for verified event mismatch, never accepts missing reader/WMI/inputs',()=>{
 const base={isV2:true,linked:false,taskRunning:true};
 const absent=proof(event({task:String.raw`\\ZGMINI-PC-Local-Korea`}));
 assert.equal(absent.ok,false);
 assert.equal(absent.code,'INFL_MANUAL_B_EVENT129_TASK_PID_NOT_VERIFIED');
 assert.equal(shouldWaitForV2OwnerEvidence({...base,eventCode:absent.code}),true);
 for(const code of [
  'INFL_MANUAL_B_EVENT129_INPUT_UNVERIFIED',
  'INFL_MANUAL_B_EVENT129_READER_UNAVAILABLE',
  'INFL_MANUAL_B_EVENT129_LOG_TOO_LARGE',
  undefined,
 ]){
  assert.equal(shouldWaitForV2OwnerEvidence({...base,eventCode:code}),false);
 }
 assert.equal(shouldWaitForV2OwnerEvidence({...base,isV2:false,
  eventCode:absent.code}),false);
});

test('Korea exact live lock owner is a bounded wait candidate even when Core Task reports running',()=>{
 const node=String.raw`E:\ZGmini\runtime\node.exe`;
 const script=String.raw`E:\ZGmini\projects\zgmini-earnings-history-pc-release\scripts\pc-writer\local-cycle.mjs`;
 for(const suffix of ['--korea','--korea --publish','--publish --korea']){
  const p=runSanitizedWshProbe({command:'"'+node+'" "'+script+'" '+suffix,
   taskState:4});
  assert.equal(p.ok,true);
  assert.equal(p.ownerCoreMatched,false);
  assert.equal(p.ownerKoreaMatched,true);
  assert.equal(shouldWaitForV2OwnerEvidence({isV2:true,linked:false,
   taskRunning:p.taskRunning,ownerKoreaMatched:p.ownerKoreaMatched}),true);
  assert.equal(shouldWaitForV2OwnerEvidence({isV2:false,linked:false,
   taskRunning:p.taskRunning,ownerKoreaMatched:p.ownerKoreaMatched}),false);
 }
});
test('Korea wait never accepts a lookalike script, extra args, or unknown owner',()=>{
 const node=String.raw`E:\ZGmini\runtime\node.exe`;
 const script=String.raw`E:\ZGmini\projects\zgmini-earnings-history-pc-release\scripts\pc-writer\local-cycle.mjs`;
 for(const command of [
  '"'+node+'" "'+script+'" --korea --force',
  '"'+node+'" "E:\\other\\local-cycle.mjs" --korea',
  'node.exe "'+script+'" --korea',
  '"'+node+'" "'+script+'" --publish --unsafe --korea',
 ]){
  const p=runSanitizedWshProbe({command});
  assert.equal(p.ownerKoreaMatched,false);
  assert.equal(shouldWaitForV2OwnerEvidence({isV2:true,linked:false,
   taskRunning:true,ownerKoreaMatched:p.ownerKoreaMatched}),false);
 }
});

test('V2 visible Task ancestry alone cannot authenticate a Korea or modified Core command',()=>{
 const bad={linked:true,ownerCoreMatched:false,ownerKoreaMatched:true};
 assert.equal(shouldAcceptVisibleCoreOwner(true,bad),false);
 assert.equal(shouldAcceptVisibleCoreOwner(false,bad),true); // V1 unmodified
 assert.equal(shouldAcceptVisibleCoreOwner(true,{linked:true,ownerCoreMatched:true}),true);
 for(const linked of [false,null,undefined]){
  assert.equal(shouldAcceptVisibleCoreOwner(true,{linked,ownerCoreMatched:true}),false);
 }
});

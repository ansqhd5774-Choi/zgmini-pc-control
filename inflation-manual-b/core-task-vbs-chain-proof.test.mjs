import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {coreVbsTaskEventCandidates,verifyCoreVbsTaskWitness,
 assertPinnedVbsLaunchers,APPROVED_VBS_CHAIN_FILES}
 from './core-task-vbs-chain-proof.mjs';
const start=Date.parse('2026-11-15T14:00:00.000Z'),now=start+240_000;
const event=(o={})=>'<Events><Event><System>'+
 '<Provider Name="'+(o.provider??'Microsoft-Windows-TaskScheduler')+'"/>'+
 '<EventID>'+(o.id??129)+'</EventID>'+
 '<TimeCreated SystemTime="'+(o.at??'2026-11-15T14:00:00.000Z')+'"/>'+
 '<Channel>'+(o.channel??'Microsoft-Windows-TaskScheduler/Operational')+
 '</Channel></System><EventData><Data Name="TaskName">'+
 (o.task??'\\ZGMINI-PC-Local-Core')+'</Data>'+
 '<Data Name="Path">'+(o.path??'C:\\Windows\\System32\\wscript.exe')+'</Data>'+
 '<Data Name="ProcessID">'+(o.pid??8000)+'</Data>'+
 '</EventData></Event></Events>';
const record={candidate:{pid:8000,eventAt:start},lockAt:start+20_000,
 ownerCreatedAtMs:start+10_000,taskRunning:true,ownerCoreMatched:true,now};
const witness={ok:true,taskVbsLinked:true,taskRunning:true,ownerCoreMatched:true,
 ownerCreatedAtMs:start+10_000,taskVbsCreatedAtMs:start,
 approvedLauncherKinds:['ARCHIVE_NODE','CUTOVER_VBS','TASK_VBS']};
test('only the real task/Event129 wscript image is an eligible launcher',()=>{
 assert.deepEqual(coreVbsTaskEventCandidates(event(),{now}),[record.candidate]);
 for(const x of [{provider:'Fake'},{channel:'Security'},{id:169},
  {task:'\\ZGMINI-PC-Local-Korea'},{path:'C:\\evil\\wscript.exe'},
  {path:'E:\\ZGmini\\runtime\\node.exe'},{pid:0},
  {at:'2026-11-14T11:00:00.000Z'}])
  assert.equal(coreVbsTaskEventCandidates(event(x),{now}).length,0);
});
test('exact live WMI witness and matching task launcher link approve only V2 proof',()=>{
 assert.equal(verifyCoreVbsTaskWitness({...record,witness}).ok,true);
 for(const change of [{taskVbsLinked:false},{taskVbsCreatedAtMs:start-80_000},
  {approvedLauncherKinds:[]},{approvedLauncherKinds:['OTHER','TASK_VBS']},
  {approvedLauncherKinds:['TASK_VBS','ARCHIVE_NODE']},
  {taskRunning:false},{ownerCoreMatched:false},{ownerCreatedAtMs:start-100_000}])
  assert.equal(verifyCoreVbsTaskWitness({...record,witness:{...witness,...change}}).ok,false);
 for(const change of [{taskRunning:false},{ownerCoreMatched:false},
  {lockAt:start-10_000},{now:start+4_000_000}])
  assert.equal(verifyCoreVbsTaskWitness({...record,...change,witness}).ok,false);
});
// Fixed independently by the latest PC read-only launcher receipt #1524.
// A self-referential map of source constants alone would miss a wrong pin.
test('W01 launcher fingerprints reproduce actual PC #1524 receipt exactly',()=>{
 assert.equal(APPROVED_VBS_CHAIN_FILES.TASK_VBS.sha256,
  '9d5bc3429cd74813207cfc393eb04eff11a78106096964b80bf7833440385b7c');
 assert.equal(APPROVED_VBS_CHAIN_FILES.CUTOVER_VBS.sha256,
  'bb3e11c0b5c8da07162b1c824e7b52e7a7c2f987c079f29713211a2413932b01');
 assert.equal(APPROVED_VBS_CHAIN_FILES.ARCHIVE_NODE.sha256,
  'ce07af0b5e8d17625644e204f2815c1f754aff2468bc5434ac13c0dadcecd907');
 assert.equal(APPROVED_VBS_CHAIN_FILES.ARCHIVE_CORE_NODE.sha256,
  'e96d9ba669ee053d0b3558db36f1f5f7a28648b8ea26b7937f62a19bb4495c84');
 for(const f of Object.values(APPROVED_VBS_CHAIN_FILES))
  assert.match(f.sha256,/^[a-f0-9]{64}$/);
});
test('each VBS or intermediate Node script must match its observed SHA',()=>{
 const map=new Map(Object.values(APPROVED_VBS_CHAIN_FILES).map(o=>[o.path,o.sha256]));
 assert.equal(assertPinnedVbsLaunchers(witness.approvedLauncherKinds,p=>map.get(p)),true);
 assert.throws(()=>assertPinnedVbsLaunchers(witness.approvedLauncherKinds,p=>
  p===APPROVED_VBS_CHAIN_FILES.TASK_VBS.path?'0'.repeat(64):map.get(p)),
  e=>e.code==='INFL_MANUAL_B_VBS_LAUNCHER_SOURCE_STOP');
});
function runProbe(opts={}){
 const script=fs.readFileSync(new URL('./core-lock-owner-probe.js',import.meta.url),'utf8');
 const rows=[
  {ProcessId:5000,ParentProcessId:6000,Name:'node.exe',
   CommandLine:'"E:\\ZGmini\\runtime\\node.exe" "E:\\ZGmini\\projects\\zgmini-earnings-history-pc-release\\scripts\\pc-writer\\local-cycle.mjs" --publish',
   CreationDate:'20261115230010.000000+540'},
  {ProcessId:6000,ParentProcessId:7000,Name:'node.exe',
   CommandLine:'"E:\\ZGmini\\runtime\\node.exe" "E:\\ZGmini\\data\\pc-writer\\archive-sidecar-r7\\archive-run.mjs"',
   CreationDate:'20261115230008.000000+540'},
  {ProcessId:7000,ParentProcessId:opts.badParent?9999:8000,Name:'wscript.exe',
   CommandLine:opts.badCommand?'wscript.exe C:\\evil.vbs':
    '"C:\\Windows\\System32\\wscript.exe" "E:\\ZGmini\\data\\pc-writer\\cutover-evidence\\inflation-r37-2026-10-20T19-39-19-549Z\\run-local-core.vbs"',
   CreationDate:'20261115230005.000000+540'},
  {ProcessId:8000,ParentProcessId:100,Name:'wscript.exe',
   CommandLine:'"C:\\Windows\\System32\\wscript.exe" "E:\\ZGmini\\data\\pc-writer\\archive-sidecar-r7\\run-original-then-archive.vbs"',
   CreationDate:'20261115230000.000000+540'},
 ];
 const records=opts.gone?rows.filter(x=>x.ProcessId!==8000):rows;
 const out=[];
 function Enumerator(a){let n=0;this.atEnd=()=>n>=a.length;
  this.moveNext=()=>n++;this.item=()=>a[n];}
 const task={Enabled:true,State:opts.idle?3:4,
  GetInstances:()=>({Count:0,Item:()=>null})};
 const sandbox={WScript:{Arguments:{length:2,Item:i=>String(i===0?5000:
  (opts.badPid?9999:8000))},Echo:x=>out.push(x)},
  ActiveXObject:function(){return{Connect:()=>{},GetFolder:()=>({GetTask:()=>task})};},
  GetObject:()=>({ExecQuery:()=>records}),Enumerator};
 // Windows Script Host JScript 5.x may not provide the ES5 JSON intrinsic.
 if(opts.noJson)sandbox.JSON=undefined;
 vm.runInNewContext(script,sandbox,{timeout:2000});
 return JSON.parse(out[0]);
}
test('JScript without native JSON still emits safe owner evidence and rejects impostors',()=>{
 const valid=runProbe({noJson:true});
 assert.equal(valid.ok,true);
 assert.equal(valid.taskVbsLinked,true);
 assert.deepEqual([...valid.approvedLauncherKinds],
  ['ARCHIVE_NODE','CUTOVER_VBS','TASK_VBS']);
 for(const change of [{gone:true},{badParent:true},{badCommand:true},
  {badPid:true},{idle:true}])
  assert.equal(runProbe({noJson:true,...change}).taskVbsLinked,false,
   JSON.stringify(change));
});
test('actual WSH script connects the trusted VBS hierarchy to the lock Node',()=>{
 const result=runProbe();
 assert.equal(result.taskVbsLinked,true);
 assert.deepEqual([...result.approvedLauncherKinds],
  ['ARCHIVE_NODE','CUTOVER_VBS','TASK_VBS']);
 assert.equal(JSON.stringify(result).includes('5000'),false);
 assert.equal(JSON.stringify(result).includes('wscript.exe'),false);
 for(const x of [{gone:true},{badParent:true},{badCommand:true},
  {badPid:true},{idle:true}])
  assert.equal(runProbe(x).taskVbsLinked,false,JSON.stringify(x));
});

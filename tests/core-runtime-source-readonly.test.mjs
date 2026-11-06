import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {classifyCoreSnapshot,inspectCoreRuntimeSource,hashActiveCoreFiles} from '../controller/core-runtime-source-readonly.mjs';

const snapshot={ok:true,runningInstances:1,engines:[10],processes:[
 {pid:0,parentPid:0,name:'other',sourceMarker:'',createdAtMs:null},
 {pid:10,parentPid:1,name:'other',sourceMarker:'',createdAtMs:100},
 {pid:20,parentPid:10,name:'other',sourceMarker:'',createdAtMs:200},
 {pid:30,parentPid:20,name:'node.exe',sourceMarker:'E',
  relativeRoot:'zgmini-earnings-history-pc-release',createdAtMs:300},
]};
const realpath=p=>p;
test('live TaskEngine ancestry + exact sanitized E marker proves runtime',()=>{
 const r=classifyCoreSnapshot(snapshot,{realpath});
 assert.equal(r.status,'PASS');
 assert.equal(r.runtimeSourceVerified,true);
 assert.doesNotMatch(JSON.stringify(r),/CommandLine|token|pid/i);
});
test('no running Core task remains unknown',()=>{
 assert.equal(classifyCoreSnapshot({...snapshot,engines:[]},{realpath}).status,'STATE_UNKNOWN');
});
test('unrelated Node or missing parent record cannot prove source',()=>{
 const fake={...snapshot,processes:snapshot.processes.map(p=>p.pid===30?{...p,parentPid:999}:p)};
 assert.equal(classifyCoreSnapshot(fake,{realpath}).runtimeSourceVerified,false);
});
test('other-script marker cannot prove runtime',()=>{
 const fake={...snapshot,processes:snapshot.processes.map(p=>p.pid===30?{...p,sourceMarker:''}:p)};
 assert.equal(classifyCoreSnapshot(fake,{realpath}).status,'STATE_UNKNOWN');
});
test('C compatibility junction requires identical native canonical path',()=>{
 const c={...snapshot,processes:snapshot.processes.map(p=>p.pid===30?{...p,sourceMarker:'C'}:p)};
 assert.equal(classifyCoreSnapshot(c,{realpath}).status,'STATE_UNKNOWN');
 assert.equal(classifyCoreSnapshot(c,{realpath:p=>p.replace(/^C:/i,'E:')}).status,'PASS');
});
test('symlinked source script outside approved root stays unknown',()=>{
 const r=classifyCoreSnapshot(snapshot,{realpath:p=>p.toLowerCase().endsWith('local-cycle.mjs')?
  String.raw`E:\Unrelated\scripts\pc-writer\local-cycle.mjs`:p});
 assert.equal(r.status,'STATE_UNKNOWN');
});
test('project root escaping E: allowlist stays unknown',()=>{
 const r=classifyCoreSnapshot(snapshot,{realpath:p=>p.toLowerCase().endsWith('zgmini-earnings-history-pc-release')?
  String.raw`E:\Unrelated\zgmini-earnings-history-pc-release`:p});
 assert.equal(r.status,'STATE_UNKNOWN');
});
test('reused PID chronology, duplicate PID and multi-Core remain inconclusive',()=>{
 const stale={...snapshot,processes:snapshot.processes.map(p=>p.pid===20?{...p,createdAtMs:400}:p)};
 assert.equal(classifyCoreSnapshot(stale,{realpath}).status,'STATE_UNKNOWN');
 assert.equal(classifyCoreSnapshot({...snapshot,processes:[...snapshot.processes,snapshot.processes[1]]},{realpath}).status,'STATE_UNKNOWN');
 assert.equal(classifyCoreSnapshot({...snapshot,processes:[...snapshot.processes,{...snapshot.processes[3],pid:31}]},{realpath}).status,'STATE_UNKNOWN');
});
test('collector failures never escape as PASS or leak raw stderr',()=>{
 const err=inspectCoreRuntimeSource({platform:'win32',exists:()=>true,
  probe:()=>({status:1,stdout:'',stderr:'--token=secret'})});
 assert.equal(err.status,'STATE_UNKNOWN');
 assert.doesNotMatch(JSON.stringify(err),/secret|token/);
});
test('injected collector snapshot yields PASS without touching host',()=>{
 const payload=Buffer.from('approved-source-bytes');
 const result=inspectCoreRuntimeSource({platform:'win32',exists:()=>true,
  probe:()=>({status:0,stdout:JSON.stringify(snapshot)}),realpath,
  lstat:()=>({isFile:()=>true,isSymbolicLink:()=>false,size:payload.length}),
  read:()=>payload});
 assert.equal(result.status,'PASS');
 assert.deepEqual(result.beforeFileSha256.map(x=>x.path),[
  'lib/earnings-api-calendar.mjs','scripts/pc-writer/earnings-api-local.mjs',
  'scripts/pc-writer/release-calendar.mjs']);
 assert.ok(result.beforeFileSha256.every(x=>/^[a-f0-9]{64}$/.test(x.sha256)));
});
test('non-Windows host never tries probe',()=>{
 const result=inspectCoreRuntimeSource({platform:'linux',probe:()=>{throw Error('MUST_NOT_RUN');}});
 assert.equal(result.code,'CORE_WINDOWS_REQUIRED');
});

function simulateWsh({command,otherCommand='--token=SECRET_NEVER_PRINT',runningCount=1}){
 const source=fs.readFileSync(new URL('../controller/core-runtime-source-wmi.mjs',import.meta.url),'utf8');
 const records=[
  {ProcessId:10,ParentProcessId:1,Name:'taskeng.exe',CommandLine:'service',CreationDate:null},
  {ProcessId:20,ParentProcessId:10,Name:'wscript.exe',CommandLine:'wrapper',CreationDate:null},
  {ProcessId:30,ParentProcessId:20,Name:'node.exe',CommandLine:command,CreationDate:null},
  {ProcessId:99,ParentProcessId:1,Name:'node.exe',CommandLine:otherCommand,CreationDate:null},
 ];
 let printed='';
 function Enumerator(rows){this.rows=rows;this.i=0;this.atEnd=()=>this.i>=this.rows.length;
  this.moveNext=()=>{this.i++;};this.item=()=>this.rows[this.i];}
 const task={GetInstances:()=>({Count:runningCount,Item:()=>({EnginePID:10})})};
 const context={
  ActiveXObject:function(){return {Connect:()=>{},GetFolder:()=>({GetTask:()=>task})};},
  GetObject:()=>({ExecQuery:()=>records}),
  Enumerator,
  WScript:{Echo:x=>{printed+=x;},Quit:code=>{throw Error('WSH_EXIT_'+code);}},
 };
 vm.runInNewContext(source,context,{timeout:1000});
 return {snapshot:JSON.parse(printed),printed};
}
test('actual JScript WMI serialization returns only fixed enums and no raw commands',()=>{
 const cmd=String.raw`"E:\ZGmini\runtime\node.exe" "E:\ZGmini\projects\zgmini-earnings-history-pc-release\scripts\pc-writer\local-cycle.mjs" --publish`;
 const {snapshot:s,printed}=simulateWsh({command:cmd});
 assert.equal(s.ok,true);
 assert.equal(s.processes.find(p=>p.pid===30).sourceMarker,'E');
 assert.equal(s.processes.find(p=>p.pid===30).relativeRoot,'zgmini-earnings-history-pc-release');
 assert.equal(classifyCoreSnapshot(s,{realpath}).status,'PASS');
 assert.doesNotMatch(printed,/CommandLine|SECRET_NEVER_PRINT|--token|E:\\ZGmini/i);
});
test('read-only hashes reject external symbolic links, files too large, or missing',()=>{
 const root=String.raw`E:\ZGmini\projects\some-project`;
 assert.equal(hashActiveCoreFiles(root,{realpath:l=>l,
  lstat:()=>({isFile:()=>true,isSymbolicLink:()=>true,size:10}),read:()=>Buffer.alloc(10)}),null);
 assert.equal(hashActiveCoreFiles(root,{realpath:l=>l,
  lstat:()=>({isFile:()=>true,isSymbolicLink:()=>false,size:2_000_001}),read:()=>Buffer.alloc(10)}),null);
});
test('JScript rejects extra arguments and wrong script',()=>{
 const cmd=String.raw`"E:\ZGmini\runtime\node.exe" "E:\ZGmini\projects\zgmini-earnings-history-pc-release\scripts\pc-writer\local-cycle.mjs" --publish`;
 for(const altered of [cmd+' --unexpected',cmd.replace('local-cycle.mjs','other-cycle.mjs')]){
  const {snapshot:s}=simulateWsh({command:altered});
  assert.equal(s.processes.find(p=>p.pid===30).sourceMarker,'');
  assert.equal(classifyCoreSnapshot(s,{realpath}).status,'STATE_UNKNOWN');
 }
});

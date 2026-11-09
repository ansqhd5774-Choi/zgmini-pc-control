import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {classifyCoreSnapshot,inspectCoreRuntimeSource,hashActiveCoreFiles,
 readCoreLockSnapshot,classifyCoreLockOwner} from '../controller/core-runtime-source-readonly.mjs';

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

function simulateWsh({command,otherCommand='--token=SECRET_NEVER_PRINT',
 runningCount=1,creationDate=null}){
 const source=fs.readFileSync(new URL('../controller/core-runtime-source-wmi.mjs',import.meta.url),'utf8');
 const records=[
  {ProcessId:10,ParentProcessId:1,Name:'taskeng.exe',CommandLine:'service',CreationDate:null},
  {ProcessId:20,ParentProcessId:10,Name:'wscript.exe',CommandLine:'wrapper',CreationDate:null},
  {ProcessId:30,ParentProcessId:20,Name:'node.exe',CommandLine:command,CreationDate:creationDate},
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

test('fixed Core lock is read only and never returns raw bytes or owner PID publicly',()=>{
 const at=Date.UTC(2026,10,9,16,50,0),bytes=Buffer.from(JSON.stringify({pid:30,at}));
 const evidence=readCoreLockSnapshot({file:'test-lock',clock:()=>at+1000,
  lstat:()=>({isFile:()=>true,isSymbolicLink:()=>false,size:bytes.length}),
  read:()=>bytes});
 assert.equal(evidence.state,'PRESENT');
 assert.equal(evidence.pid,30);
 assert.equal(evidence.fingerprint.length,64);
 assert.equal(classifyCoreLockOwner(snapshot,evidence,evidence,{realpath}).status,
  'VERIFIED_ACTIVE_CORE');
 assert.doesNotMatch(JSON.stringify(classifyCoreLockOwner(snapshot,evidence,evidence,
  {realpath})),/"pid"|"at"|fingerprint|token/i);
});
test('PID reuse, false source ancestry and changed lock cannot claim verified owner',()=>{
 const at=Date.UTC(2026,10,9,16,50,0);
 const lock={state:'PRESENT',pid:30,at,fingerprint:'a'.repeat(64)};
 assert.equal(classifyCoreLockOwner(snapshot,lock,{...lock,fingerprint:'b'.repeat(64)},
  {realpath}).code,'CORE_LOCK_CHANGED_DURING_PROBE');
 assert.equal(classifyCoreLockOwner(snapshot,{...lock,pid:99},{...lock,pid:99},
  {realpath}).status,'UNVERIFIED');
 const reused={...snapshot,processes:snapshot.processes.map(p=>p.pid===30?
  {...p,createdAtMs:at+6000}:p)};
 assert.equal(classifyCoreLockOwner(reused,lock,lock,{realpath}).code,
  'CORE_LOCK_PID_REUSE_POSSIBLE');
 assert.equal(classifyCoreLockOwner({...snapshot,engines:[]},lock,lock,
  {realpath}).status,'UNVERIFIED');
});
test('lock owner PID absent from WMI is observed as unverified, not auto-stale',()=>{
 const lock={state:'PRESENT',pid:87654,
  at:Date.UTC(2026,10,9,16,50,0),fingerprint:'a'.repeat(64)};
 const out=classifyCoreLockOwner({...snapshot,engines:[]},lock,lock,{realpath});
 assert.equal(out.status,'UNVERIFIED');
 assert.equal(out.code,'CORE_LOCK_OWNER_PID_NOT_OBSERVED');
});

test('missing, symlinked, oversized, malformed Core lock never becomes stale proof',()=>{
 const at=Date.UTC(2026,10,9,16,50,0);
 const missing=readCoreLockSnapshot({lstat:()=>{throw Object.assign(Error('no'),{code:'ENOENT'});}});
 assert.equal(missing.state,'ABSENT');
 assert.equal(classifyCoreLockOwner(snapshot,missing,missing).status,'ABSENT');
 const invalid=readCoreLockSnapshot({clock:()=>at+1000,
  lstat:()=>({isFile:()=>true,isSymbolicLink:()=>true,size:32}),
  read:()=>Buffer.from(JSON.stringify({pid:30,at}))});
 assert.equal(invalid.state,'UNKNOWN');
 assert.equal(classifyCoreLockOwner(snapshot,invalid,invalid).status,'UNVERIFIED');
 assert.equal(readCoreLockSnapshot({lstat:()=>({isFile:()=>true,
  isSymbolicLink:()=>false,size:513}),read:()=>{throw Error('must not read');}})
  .state,'UNKNOWN');
});
test('WMI CIM_DATETIME +540 offset is converted to real UTC creation instant',()=>{
 const cmd=String.raw`"E:\ZGmini\runtime\node.exe" "E:\ZGmini\projects\zgmini-earnings-history-pc-release\scripts\pc-writer\local-cycle.mjs" --publish`;
 const {snapshot:s}=simulateWsh({command:cmd,
  creationDate:'20261110015000.000000+540'});
 assert.equal(s.processes.find(p=>p.pid===30).createdAtMs,
  Date.UTC(2026,10,9,16,50,0));
});
test('existing A collector attaches independent lock-owner evidence without writes',()=>{
 const at=Date.UTC(2026,10,9,16,50,0),bytes=Buffer.from('approved-source-bytes');
 const lock={state:'PRESENT',pid:30,at,fingerprint:'a'.repeat(64)};
 const out=inspectCoreRuntimeSource({platform:'win32',exists:()=>true,
  probe:()=>({status:0,stdout:JSON.stringify(snapshot)}),realpath,
  lstat:()=>({isFile:()=>true,isSymbolicLink:()=>false,size:bytes.length}),
  read:()=>bytes,readLock:()=>lock});
 assert.equal(out.status,'PASS');
 assert.equal(out.lockOwner.status,'VERIFIED_ACTIVE_CORE');
 assert.equal(out.operationalWrites,0);
 assert.equal(out.d1Writes,0);
});

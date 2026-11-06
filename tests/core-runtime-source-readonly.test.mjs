import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyCoreSnapshot,inspectCoreRuntimeSource} from '../controller/core-runtime-source-readonly.mjs';

const snapshot={ok:true,runningInstances:1,engines:[10],processes:[
 {pid:0,parentPid:0,name:'other',sourceMarker:'',createdAtMs:null},
 {pid:10,parentPid:1,name:'other',sourceMarker:'',createdAtMs:100},
 {pid:20,parentPid:10,name:'other',sourceMarker:'',createdAtMs:200},
 {pid:30,parentPid:20,name:'node.exe',sourceMarker:'E',createdAtMs:300},
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
test('reused PID chronology, duplicate PID and multi-Core remain inconclusive',()=>{
 const stale={...snapshot,processes:snapshot.processes.map(p=>p.pid===20?{...p,createdAtMs:400}:p)};
 assert.equal(classifyCoreSnapshot(stale,{realpath}).status,'STATE_UNKNOWN');
 assert.equal(classifyCoreSnapshot({...snapshot,processes:[...snapshot.processes,snapshot.processes[1]]},{realpath}).status,'STATE_UNKNOWN');
 assert.equal(classifyCoreSnapshot({...snapshot,processes:[...snapshot.processes,{pid:31,parentPid:20,name:'node.exe',sourceMarker:'E'}]},{realpath}).status,'STATE_UNKNOWN');
});
test('collector failures never escape as PASS or leak raw stderr',()=>{
 const err=inspectCoreRuntimeSource({platform:'win32',exists:()=>true,
  probe:()=>({status:1,stdout:'',stderr:'--token=secret'})});
 assert.equal(err.status,'STATE_UNKNOWN');
 assert.doesNotMatch(JSON.stringify(err),/secret|token/);
});
test('injected collector snapshot yields PASS without touching host',()=>{
 const result=inspectCoreRuntimeSource({platform:'win32',exists:()=>true,
  probe:()=>({status:0,stdout:JSON.stringify(snapshot)}),realpath});
 assert.equal(result.status,'PASS');
});
test('non-Windows host never tries probe',()=>{
 const result=inspectCoreRuntimeSource({platform:'linux',probe:()=>{throw Error('MUST_NOT_RUN');}});
 assert.equal(result.code,'CORE_WINDOWS_REQUIRED');
});

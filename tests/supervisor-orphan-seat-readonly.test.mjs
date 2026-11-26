import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {projectOrphanSeatMap,inspectOrphanSeatMapReadonly} from '../tools/supervisor-orphan-seat-readonly.mjs';

const slash=String.fromCharCode(92);
const root=['E:','ZGmini','automation','pc-control'].join(slash);
const pathFor=(seat,kind='Listener')=>
 [root,'runners',String(seat).padStart(2,'0'),'bin','Runner.'+kind+'.exe'].join(slash);
const listener=seat=>({pid:2200+seat,name:'Runner.Listener.exe',
 executablePath:pathFor(seat),sessionId:1,serviceAncestor:false,
 serviceObservationAvailable:true});
const worker=seat=>({pid:3200+seat,name:'Runner.Worker.exe',
 executablePath:pathFor(seat,'Worker'),sessionId:1,serviceAncestor:false,
 serviceObservationAvailable:true});
const service=()=>({pid:1999,name:'Runner.Listener.exe',executablePath:'',
 sessionId:0,serviceAncestor:true,serviceObservationAvailable:true});
const rows=()=>[...Array.from({length:6},(_,i)=>listener(i+1)),worker(4),service()];
const project=r=>projectOrphanSeatMap(r,{controllerRoot:root,canonicalize:x=>x});

test('one Controller Listener per seat and one active Worker are counts only',()=>{
 const v=project(rows());
 assert.equal(v.status,'PASS');
 assert.equal(v.code,'ORPHAN_SEAT_COUNTS_OBSERVED');
 assert.equal(v.controllerListenerCount,6);
 assert.equal(v.controllerWorkerCount,1);
 assert.equal(v.registeredServiceExceptionCount,1);
 assert.deepEqual(v.seats.map(s=>s.listenerCount),[1,1,1,1,1,1]);
 assert.deepEqual(v.seats.map(s=>s.workerCount),[0,0,0,1,0,0]);
 assert.equal(v.recoveryAuthorized,false);
 assert.equal(v.supervisorSpawnAuthorized,false);
 assert.equal(v.runnerTerminationAuthorized,false);
 assert.equal(v.seatIdleProven,false);
 assert.equal(v.operationalWrites,0);
 assert.doesNotMatch(JSON.stringify(v),/2201|3204|1999|pc-control|executablePath|nonce/i);
 assert.ok(Buffer.byteLength(JSON.stringify(v))<1300);
});

test('missing, duplicate, foreign and unknown executable paths fail closed',()=>{
 const mutations=[
  x=>{x.splice(0,1);},
  x=>{x[1].pid=x[0].pid;},
  x=>{x[1].executablePath=x[0].executablePath;},
  x=>{x[1].executablePath='C:relative';},
  x=>{x[1].executablePath='';},
  x=>{x[2].executablePath=['C:','other','Runner.Listener.exe'].join(slash);},
  x=>{x[2].executablePath=['E:','ZGmini','automation','pc-control','runners','07','bin','Runner.Listener.exe'].join(slash);},
  x=>{x.push(worker(4));},
  x=>{x.push({...service(),pid:4000});},
  x=>{x[7].serviceObservationAvailable=false;},
  x=>{x[7].serviceAncestor=false;},
  x=>{x[7].sessionId=2;},
  x=>{x[0].name='cmd.exe';},
 ];
 for(let i=0;i<mutations.length;i++){
  const x=rows();mutations[i](x);
  const v=project(x);
  assert.equal(v.status,'STATE_UNKNOWN','case '+i);
  assert.equal(v.recoveryAuthorized,false);
  assert.equal(v.seats.length,0);
 }
});

test('junction realpath failure, extra WMI rows or invalid source never become authorization',()=>{
 for(const x of [null,{},[],Array.from({length:257},(_,i)=>({...listener(1),pid:10000+i}))]){
  const v=project(x);
  assert.equal(v.status,'STATE_UNKNOWN');
  assert.equal(v.runnerTerminationAuthorized,false);
 }
 assert.equal(projectOrphanSeatMap(rows(),{controllerRoot:root,canonicalize:()=>{throw Error('EPERM');}}).status,'STATE_UNKNOWN');
 assert.equal(projectOrphanSeatMap(rows(),{controllerRoot:'not-absolute',canonicalize:x=>x}).status,'STATE_UNKNOWN');
});

test('fixed Windows-only WMI source is bounded, read-only and no shell',()=>{
 let captured=null;
 const run=(exe,args,options)=>{
  captured={exe,args,options};
  return {status:0,stdout:JSON.stringify({rows:rows()})};
 };
 const v=inspectOrphanSeatMapReadonly({
  platform:'win32',env:{SystemRoot:['C:','Windows'].join(slash)},
  filesystem:{statSync:()=>({isFile:()=>true})},
  canonicalize:x=>x,run
 });
 assert.equal(v.status,'PASS');
 assert.equal(v.seats[3].workerCount,1);
 assert.equal(captured.options.shell,false);
 assert.equal(captured.options.windowsHide,true);
 assert.equal(captured.options.timeout,15000);
 assert.match(captured.args[3],/Get-CimInstance -ClassName Win32_Process/);
 assert.match(captured.args[3],/Get-CimInstance -ClassName Win32_Service/);
 assert.doesNotMatch(captured.args[3],/Stop-Process|Remove-Item|Start-Process|Set-CimInstance|Invoke-Expression|\\btaskkill\\b/);
 for(const candidate of [
  {platform:'linux',env:{SystemRoot:['C:','Windows'].join(slash)}},
  {platform:'win32',env:{SystemRoot:'X:/other'}},
 ]){
  const bad=inspectOrphanSeatMapReadonly({...candidate,
   run:()=>{throw Error('should not run');}});
  assert.equal(bad.status,'STATE_UNKNOWN');
 }
 const denied=inspectOrphanSeatMapReadonly({
  platform:'win32',env:{SystemRoot:['C:','Windows'].join(slash)},
  filesystem:{statSync:()=>({isFile:()=>true})},
  run:()=>({status:1,stdout:'secret'}),canonicalize:x=>x
 });
 assert.equal(denied.status,'STATE_UNKNOWN');
 assert.doesNotMatch(JSON.stringify(denied),/secret/i);
});

test('source-only probe has no process, Controller, lease or workflow mutator',()=>{
 const src=fs.readFileSync(new URL('../tools/supervisor-orphan-seat-readonly.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(src,/\bkill\s*\(|\bspawn\s*\(|\bexecFileSync\s*\(|\bwriteFileSync\s*\(|unlinkSync|renameSync|mkdirSync|workflow_dispatch|taskkill/);
 assert.match(src,/runnerTerminationAuthorized:false/);
 assert.match(src,/seatIdleProven:false/);
});

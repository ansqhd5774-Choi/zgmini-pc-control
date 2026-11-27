import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {projectOrphanConsoleCohort,inspectOrphanConsoleCohortReadonly}
 from '../tools/supervisor-orphan-console-readonly.mjs';

const rows=()=>Array.from({length:6},(_,i)=>({
 seat:i+1,pid:45001+i,mode:'ATTACHED',
 members:[45001+i,49000+i,46000]
}));
const sample=()=>({schema:'ZGMINI_ORPHAN_CONSOLE_COHORT_A_V1',
 stable:true,inspectorPid:46000,rows:rows()});

test('orphan console: unique six groups observed without termination permission',()=>{
 const observed=projectOrphanConsoleCohort(sample());
 assert.equal(observed.status,'PASS');
 assert.equal(observed.distinctConsoleGroupCount,6);
 assert.equal(observed.sharedListenerConsoleGroupCount,0);
 assert.equal(observed.extraConsoleMemberCount,6);
 assert.equal(observed.gracefulShutdownSupported,null);
 assert.equal(observed.signalEmitted,false);
 assert.equal(observed.runnerTerminationAuthorized,false);
 assert.equal(observed.operationalWrites,0);
 assert.doesNotMatch(JSON.stringify(observed),/4500|4900|46000|pid|members/i);
});

test('orphan console: shared console is reported but never authorized for control',()=>{
 const input=sample();
 input.rows[1].members=[45001,45002,49000,46000];
 input.rows[0].members=[45001,45002,49000,46000];
 const observed=projectOrphanConsoleCohort(input);
 assert.equal(observed.status,'PASS');
 assert.equal(observed.distinctConsoleGroupCount,5);
 assert.equal(observed.sharedListenerConsoleGroupCount,1);
 assert.equal(observed.runnerTerminationAuthorized,false);
});

test('orphan console: missing, stale, recycled and duplicate identities fail closed',()=>{
 const patches=[
  x=>{x.stable=false;},
  x=>{x.rows.pop();},
  x=>{x.rows[0].seat=7;},
  x=>{x.rows[1].pid=x.rows[0].pid;},
  x=>{x.rows[0].mode='UNAVAILABLE';x.rows[0].members=[];},
  x=>{x.rows[0].members=[49000,46000];},
  x=>{x.rows[0].members=[45001,45001];},
  x=>{x.rows[0].members=[0,45001];}
 ];
 for(const patch of patches){
  const input=sample();patch(input);
  const r=projectOrphanConsoleCohort(input);
  assert.equal(r.status,'STATE_UNKNOWN');
  assert.equal(r.runnerTerminationAuthorized,false);
  assert.equal(r.signalEmitted,false);
  assert.equal(r.operationalWrites,0);
 }
});

test('orphan console: Windows probe is a fixed observational P/Invoke, no signals',()=>{
 let command=null;
 const output=JSON.stringify(sample());
 const r=inspectOrphanConsoleCohortReadonly({
  platform:'win32',env:{SystemRoot:'C:\\Windows'},
  filesystem:{statSync:()=>({isFile:()=>true})},
  run:(exe,args,opts)=>{
   command={exe,args,opts};
   return {status:0,stdout:output};
  }
 });
 assert.equal(r.status,'PASS');
 assert.match(command.exe,/powershell\.exe$/i);
 assert.deepEqual(command.args.slice(0,3),['-NoLogo','-NoProfile','-NonInteractive']);
 assert.match(command.args[4],/GetConsoleProcessList/);
 assert.ok(command.args[4].includes(String.raw`Runner\.Listener\.exe`),
  'exact literal Runner.Listener executable suffix');
 assert.match(command.args[4],/AttachConsole/);
 assert.match(command.args[4],/FreeConsole/);
 for(const prohibited of ['GenerateConsoleCtrlEvent','Stop-Process',
  'taskkill','TerminateProcess','Remove-Item','Set-CimInstance'])
  assert.equal(command.args[4].includes(prohibited),false,prohibited);
 assert.equal(command.opts.shell,false);
 assert.equal(command.opts.timeout,20000);
 assert.equal(r.runnerTerminationAuthorized,false);
});

test('orphan console: non-Windows or reader failure never fabricates a six-seat proof',()=>{
 assert.equal(inspectOrphanConsoleCohortReadonly({platform:'linux'}).status,'STATE_UNKNOWN');
 assert.equal(inspectOrphanConsoleCohortReadonly({
  platform:'win32',env:{SystemRoot:'C:\\Windows'},
  filesystem:{statSync:()=>{throw Error('unavailable');}}
 }).status,'STATE_UNKNOWN');
 assert.equal(inspectOrphanConsoleCohortReadonly({
  platform:'win32',env:{SystemRoot:'C:\\Windows'},
  filesystem:{statSync:()=>({isFile:()=>true})},
  run:()=>({status:1,stdout:'error'})
 }).status,'STATE_UNKNOWN');
});

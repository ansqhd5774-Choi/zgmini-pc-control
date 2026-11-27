import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {projectOrphanSixRunnerBinaryReadonly,inspectOrphanSixRunnerBinaryReadonly}
 from '../tools/supervisor-orphan-six-runner-binary-readonly.mjs';
const stamp='2026-11-27T07:30:00.0000000Z',binary='a'.repeat(64);
const sample=()=>({schema:'ZGMINI_ORPHAN_SIX_RUNNER_BINARY_A_V1',
 stable:true,rows:Array.from({length:6},(_,i)=>({
  seat:i+1,pid:59010+i,birth:stamp,
  version:'2.330.0.0',sha256:binary
 }))});
test('six identical Controller Runner.Listener binary instances yield diagnostics only',()=>{
 const x=projectOrphanSixRunnerBinaryReadonly(sample());
 assert.equal(x.status,'PASS');
 assert.equal(x.code,'ORPHAN_SIX_BINARY_SIX_IDENTICAL_READONLY');
 assert.equal(x.controllerListenerCount,6);
 assert.equal(x.version,'2.330.0.0');
 assert.equal(x.versionUniform,true);assert.equal(x.binaryUniform,true);
 assert.equal(x.exactSixSeatPathsVerified,true);
 for(const k of ['liveRunnerGracefulShutdownVerified','workerDrainVerified',
  'effectAuthorized','runnerStopAuthorized','signalEmitted'])
  assert.equal(x[k],false,k);
 assert.equal(x.operationalWrites,0);
 assert.doesNotMatch(JSON.stringify(x),/5901|2026-11-27T07|Runner.Listener.exe|E:\\|a{64}/);
});
test('six installed binaries whose versions or bytes disagree cannot claim one build',()=>{
 const raw=sample();raw.rows[4].version='2.331.0.0';
 const x=projectOrphanSixRunnerBinaryReadonly(raw);
 assert.equal(x.status,'STATE_UNKNOWN');
 assert.equal(x.code,'ORPHAN_SIX_BINARY_SIX_BUILDS_DIVERGENT');
 assert.equal(x.version,null);
 const same=sample();same.rows[3].sha256='b'.repeat(64);
 const y=projectOrphanSixRunnerBinaryReadonly(same);
 assert.equal(y.status,'STATE_UNKNOWN');
 assert.equal(y.versionUniform,true);
 assert.equal(y.binaryUniform,false);
});
test('missing, duplicate, reused PID, invalid version, binary digest and birth fail closed',()=>{
 const altered=[
  x=>x.rows.pop(),x=>{x.rows[1].seat=1;},
  x=>{x.rows[0].pid=x.rows[1].pid;},
  x=>{x.rows[0].version='2.330.0+UNTRUSTED';},
  x=>{x.rows[5].sha256='not-a-sha';},
  x=>{x.rows[3].birth='2026-11-27T07:30:00Z';},
  x=>{x.stable=false;}
 ];
 for(const apply of altered){
  const raw=sample();apply(raw);
  const y=projectOrphanSixRunnerBinaryReadonly(raw);
  assert.equal(y.status,'STATE_UNKNOWN');
  assert.equal(y.exactSixSeatPathsVerified,false);
  assert.equal(y.runnerStopAuthorized,false);
 }
});
test('not the operating Windows PC: no process inspection or action',()=>{
 let calls=0;
 const result=inspectOrphanSixRunnerBinaryReadonly({
  platform:'linux',hostname:'PC',systemRoot:'C:\\Windows',run:()=>{calls++;}});
 assert.equal(result.status,'STATE_UNKNOWN');
 assert.equal(result.code,'ORPHAN_SIX_BINARY_OPERATING_WINDOWS_REQUIRED');
 assert.equal(calls,0);
});
test('fixed PowerShell invocation is read-only, output redacted, error cannot authorize B',()=>{
 let calls=0;
 const ok=inspectOrphanSixRunnerBinaryReadonly({
  platform:'win32',hostname:'PC',systemRoot:'C:\\Windows',
  run:(exe,args,options)=>{
   calls++;
   assert.equal(exe,'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe');
   assert.deepEqual(args.slice(0,3),['-NoLogo','-NoProfile','-NonInteractive']);
   assert.equal(args[3],'-Command');
   assert.match(args[4],/Get-CimInstance/);
   assert.match(args[4],/Get-FileHash/);
   assert.match(args[4],/Runner\.Listener/);
   assert.doesNotMatch(args[4],/GenerateConsoleCtrlEvent|Stop-Process|taskkill|Remove-Item|Set-Content/);
   assert.equal(options.shell,false);
   assert.equal(options.windowsHide,true);
   return {status:0,stdout:JSON.stringify(sample())};
  }
 });
 assert.equal(ok.status,'PASS');assert.equal(calls,1);
 const fail=inspectOrphanSixRunnerBinaryReadonly({
  platform:'win32',hostname:'PC',systemRoot:'C:\\Windows',
  run:()=>({status:1,stdout:'sensitive command failed'})});
 assert.equal(fail.code,'ORPHAN_SIX_BINARY_READ_FAILED');
 assert.doesNotMatch(JSON.stringify(fail),/sensitive command/);
});
test('fixed build inspector has no effectful filesystem or OS signal API',()=>{
 const src=fs.readFileSync(new URL(
  '../tools/supervisor-orphan-six-runner-binary-readonly.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(src,/from ['"]node:(?:fs|net|http|https)['"]/);
 assert.doesNotMatch(src,/process\.kill\s*\(|fs\.(?:write|rm|rename|unlink|rmdir)/);
});

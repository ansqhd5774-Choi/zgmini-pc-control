import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {inspect996LocalRunnerReadOnly} from
  '../tools/controller-996-local-runner-readonly.mjs';

const sha=x=>createHash('sha256').update(x).digest('hex');
function fixture(t,{pause=true,drain=true}={}){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),
    'zgmini-996-test-runner-local-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  for(const dir of ['startup','pc-watchdog','pc-control',
    ...Array.from({length:6},(_,i)=>
      `pc-control/runners/${String(i+1).padStart(2,'0')}`)])
    fs.mkdirSync(path.join(root,dir),{recursive:true});
  const vbs=Buffer.from('Watchdog startup source fixture\n');
  const source=Buffer.from('Watchdog Node source fixture\n');
  fs.writeFileSync(path.join(root,'startup','ZGMINI_PC_CONTROL.vbs'),vbs);
  fs.writeFileSync(path.join(root,'pc-watchdog','runner-watchdog.mjs'),source);
  fs.writeFileSync(path.join(root,'pc-watchdog','INSTALL.json'),JSON.stringify({
    scope:'RUNNER_RECOVERY_ONLY',startupSha256:sha(vbs),sha256:sha(source)}));
  for(let i=1;i<=6;i++)fs.writeFileSync(path.join(root,'pc-control',
    'runners',String(i).padStart(2,'0'),'.runner'),JSON.stringify({
      agentId:10000+i,agentName:`zgmini-pc-${String(i).padStart(2,'0')}`,
      serverUrl:'SECRET_SERVER_URL_DO_NOT_REPORT',
    }));
  if(pause)fs.writeFileSync(path.join(root,'pc-watchdog','PAUSE'),'');
  if(drain)fs.writeFileSync(path.join(root,'pc-control','DRAIN'),'');
  return root;
}
const read=testRoot=>inspect996LocalRunnerReadOnly({testOnly:true,testRoot});

test('fixed six local registrations and startup Watchdog hashes are read-only',t=>{
  const root=fixture(t);
  const out=read(root);
  assert.equal(out.status,'LOCAL_RUNNER_REGISTRATION_OBSERVED_ONLY');
  assert.equal(out.bindings.length,6);
  assert.deepEqual(out.bindings[0],{id:10001,name:'zgmini-pc-01'});
  assert.equal(out.pcName,'기존 ZGMINI PC');
  assert.equal(out.watchdogPausePresent,true);
  assert.equal(out.controllerDrainPresent,true);
  assert.equal(out.sourceAuthenticatedExternally,false);
  assert.equal(out.processStateProven,false);
  assert.equal(out.executionAuthorized,false);
  assert.equal(out.operationalWrites,0);
  assert.equal(JSON.stringify(out).includes('SECRET_SERVER_URL'),false);
});
test('absent PAUSE/DRAIN is observed but never created',t=>{
  const root=fixture(t,{pause:false,drain:false});
  const out=read(root);
  assert.equal(out.watchdogPausePresent,false);
  assert.equal(out.controllerDrainPresent,false);
  assert.equal(fs.existsSync(path.join(root,'pc-watchdog','PAUSE')),false);
});
test('installed watchdog source and startup hash mismatches fail closed',t=>{
  for(const rel of ['startup/ZGMINI_PC_CONTROL.vbs',
    'pc-watchdog/runner-watchdog.mjs']){
    const root=fixture(t);
    fs.appendFileSync(path.join(root,rel),'TAMPER');
    assert.throws(()=>read(root),/C996_LOCAL_RUNNER_WATCHDOG_SOURCE_MISMATCH/);
  }
});
test('duplicate, missing or foreign Runner local registration IDs are rejected',t=>{
  for(const change of ['id','name','missing']){
    const root=fixture(t),p=path.join(root,'pc-control','runners','06','.runner');
    if(change==='missing')fs.unlinkSync(p);
    else fs.writeFileSync(p,JSON.stringify({agentId:change==='id'?10001:10006,
      agentName:change==='name'?'zgmini-handoff-ci-isolated':'zgmini-pc-06'}));
    assert.throws(()=>read(root));
  }
});
test('reparse/symlink marker or local runner registration is never trusted',t=>{
  const root=fixture(t),marker=path.join(root,'pc-watchdog','PAUSE');
  fs.unlinkSync(marker);
  fs.symlinkSync(path.join(root,'startup','ZGMINI_PC_CONTROL.vbs'),marker);
  assert.throws(()=>read(root),/C996_LOCAL_RUNNER_MARKER_UNSAFE/);
  const second=fixture(t),reg=path.join(second,'pc-control','runners','02','.runner');
  fs.unlinkSync(reg);
  fs.symlinkSync(path.join(second,'pc-control','runners','01','.runner'),reg);
  assert.throws(()=>read(second),/C996_LOCAL_RUNNER_FILE_UNSAFE/);
});
test('production Windows-only entrypoint and unrelated temp roots are blocked',()=>{
  assert.throws(()=>inspect996LocalRunnerReadOnly(),
    /C996_LOCAL_RUNNER_ORIGINAL_WINDOWS_ONLY/);
  assert.throws(()=>inspect996LocalRunnerReadOnly({testOnly:true,testRoot:'/tmp'}),
    /C996_LOCAL_RUNNER_TEST_ROOT_INVALID/);
});

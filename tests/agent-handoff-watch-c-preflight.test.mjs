import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,mkdirSync,cpSync,rmSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {inspectWatchCPreflight,C_SOURCE_BLOBS,C_SOURCE_COMMIT} from '../tools/handoff-watch-c-preflight.mjs';

const base={root:process.cwd(),platform:'win32',hostname:'DESKTOP-N62L0NG',
  nodeVersion:'v22.23.4',env:{}};

test('local C preflight validates exactly seven pinned Git blobs without tokens or PC writes',()=>{
  const report=inspectWatchCPreflight(base);
  assert.equal(report.sourceCommit,C_SOURCE_COMMIT);
  assert.equal(report.sourceFilesChecked,7);
  assert.equal(report.sourceFilesMatched,7);
  assert.equal(report.sourceEligible,true);
  assert.equal(report.state,'SOURCE_PREFLIGHT_PASS_C_AUTH_AND_TASK_REQUIRED');
  assert.equal(report.credentialStoreVerified,false);
  assert.equal(report.windowsTaskRegisteredVerified,false);
  assert.equal(report.runtimeHeartbeatVerified,false);
  assert.equal(report.installerExecuted,false);
  assert.equal(report.pcWrites,0);
  assert.ok(!JSON.stringify(report).includes(process.cwd()));
});

test('incorrect host, Node, token environment and OS fail closed without revealing token',()=>{
  for(const bad of [
    {platform:'linux'},{hostname:'DESKTOP-N62L0MX'},{nodeVersion:'v23.0.0'},
    {env:{GH_TOKEN:'synthetic-test-secret'}},
    {env:{GITHUB_TOKEN:'synthetic-test-secret'}}
  ]){
    const report=inspectWatchCPreflight({...base,...bad});
    assert.equal(report.sourceEligible,false);
    assert.equal(report.state,'SOURCE_PREFLIGHT_STOP');
    assert.ok(!JSON.stringify(report).includes('synthetic-test-secret'));
  }
});

test('one tampered, missing or mismatching pinned source cannot pass preflight',()=>{
  const temp=mkdtempSync(path.join(os.tmpdir(),'zgmini-watch-preflight-'));
  try{
    for(const file of Object.keys(C_SOURCE_BLOBS)){
      const dest=path.join(temp,...file.split('/'));
      mkdirSync(path.dirname(dest),{recursive:true});
      cpSync(path.resolve(file),dest);
    }
    assert.equal(inspectWatchCPreflight({...base,root:temp}).sourceEligible,true);
    const target=path.join(temp,'agent-handoff','intake-watch-5s.mjs');
    writeFileSync(target,Buffer.concat([readFileSync(target),Buffer.from('\n//tampered\n')]));
    const report=inspectWatchCPreflight({...base,root:temp});
    assert.equal(report.sourceEligible,false);
    assert.equal(report.sourceFilesMatched,6);
    assert.equal(report.sourceFiles.find(x=>x.file==='agent-handoff/intake-watch-5s.mjs').matched,false);
    assert.equal(report.pcWrites,0);
  }finally{rmSync(temp,{recursive:true,force:true});}
});

test('Windows CMD checkout is anchored to Git blob, allowing only equivalent CRLF conversion',()=>{
  const attributes=readFileSync('.gitattributes','utf8');
  assert.match(attributes,/^tools\/handoff-watch-user-start\.cmd text eol=lf$/m);
  assert.equal(inspectWatchCPreflight(base).sourceFiles.find(x=>
    x.file==='tools/handoff-watch-user-start.cmd').matched,true);
});
test('CRLF-only CMD checkout passes, but executable-content edits still fail',()=>{
  const temp=mkdtempSync(path.join(os.tmpdir(),'zgmini-watch-cmd-eol-'));
  try{
    for(const file of Object.keys(C_SOURCE_BLOBS)){
      const dest=path.join(temp,...file.split('/'));
      mkdirSync(path.dirname(dest),{recursive:true});
      cpSync(path.resolve(file),dest);
    }
    const cmd=path.join(temp,'tools','handoff-watch-user-start.cmd');
    const source=readFileSync(cmd,'utf8').replace(/\r\n/g,'\n');
    writeFileSync(cmd,source.replace(/\n/g,'\r\n'),'utf8');
    const valid=inspectWatchCPreflight({...base,root:temp});
    assert.equal(valid.sourceEligible,true);
    assert.equal(valid.sourceFiles.find(x=>x.file==='tools/handoff-watch-user-start.cmd').windowsCmdCrLfNormalized,true);
    writeFileSync(cmd,source.replace(/\n/g,'\r\n')+'\r\nrem modified command\r\n','utf8');
    const invalid=inspectWatchCPreflight({...base,root:temp});
    assert.equal(invalid.sourceEligible,false);
    assert.equal(invalid.sourceFiles.find(x=>x.file==='tools/handoff-watch-user-start.cmd').matched,false);
  }finally{rmSync(temp,{recursive:true,force:true});}
});

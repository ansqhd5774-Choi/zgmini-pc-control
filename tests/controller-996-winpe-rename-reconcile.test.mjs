// Source-only native C reconciliation test. Never invokes a Windows C runner.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const source=fileURLToPath(new URL('../tools/controller-996-winpe-rename-reconcile.c',import.meta.url));

test('pure C reconciliation returns safe stop states without operating-system I/O',t=>{
  if(process.platform==='win32'){
    t.skip('Linux C11 native test only; Windows PE binary requires separate approved proof');
    return;
  }
  const compiler=spawnSync('gcc',['--version'],{encoding:'utf8',timeout:3000});
  if(compiler.error?.code==='ENOENT'){
    t.skip('gcc not available; native test is not a release approval');
    return;
  }
  assert.equal(compiler.status,0);
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-996-reconcile-test-'));
  try{
    const exe=path.join(dir,'reconcile-test');
    const compile=spawnSync('gcc',[
      '-std=c11','-Wall','-Wextra','-Werror','-pedantic',
      '-DC996_RECONCILE_TEST_ONLY',source,'-o',exe,
    ],{encoding:'utf8',timeout:15000});
    assert.equal(compile.status,0,compile.stderr||compile.error?.message);
    const run=spawnSync(exe,[],{encoding:'utf8',timeout:5000});
    assert.equal(run.status,0,run.stderr||run.error?.message);
    assert.equal(run.stdout,'');
  }finally{
    fs.rmSync(dir,{recursive:true,force:true});
  }
});

test('native reconciliation source exposes no production mutation entry point',()=>{
  const src=fs.readFileSync(source,'utf8');
  assert.match(src,/C996_RENAME_STOP_BOTH/);
  assert.match(src,/C996_RENAME_STOP_NEITHER/);
  assert.match(src,/C996_RENAME_STOP_IDENTITY/);
  assert.match(src,/C996_THREE_READY_INSTALL/);
  assert.match(src,/C996_THREE_ALL_ARCHIVED/);
  assert.doesNotMatch(src,/#include\s*<windows\.h>/i);
  assert.doesNotMatch(src,/SetFileInformationByHandle|MoveFileEx|DeleteFile|RemoveDirectory|RegSetValue/);
});

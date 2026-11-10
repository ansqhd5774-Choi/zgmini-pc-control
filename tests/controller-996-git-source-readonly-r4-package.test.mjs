import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {verify996GitSourcePackageR4,main} from
  '../tools/controller-996-git-source-readonly-cli-r4.mjs';

const folder=path.resolve(path.dirname(fileURLToPath(import.meta.url)),
  '../tools');
const files=[
  'controller-996-git-source-readonly-cli-r4.mjs',
  'controller-996-git-byte-offline-readonly-r4.mjs',
  'controller-996-git-byte-offline-manifest-r4.json',
  'controller-996-git-source-readonly-source-lock-r4.json',
  'RUN_996_GIT_SOURCE_READONLY_R4_ONCE.cmd',
];
const hash=b=>createHash('sha256').update(b).digest('hex');
function fixture(){
  const at=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-996-test-r4-'));
  for(const f of files)fs.copyFileSync(path.join(folder,f),path.join(at,f));
  const pin=hash(fs.readFileSync(path.join(at,files[3])));
  return {at,pin,run:()=>verify996GitSourcePackageR4({testOnly:true,
    folder:at,expectedLockSha256:pin}),
  cleanup:()=>fs.rmSync(at,{recursive:true,force:true})};
}

test('R4 standalone five-file package verifies pinned source and manifest',()=>{
  const f=fixture();try{
    assert.equal(f.run().status,'READONLY_R4_SOURCE_PACKAGE_VERIFIED');
    assert.equal(f.run().executionAuthorized,false);
  }finally{f.cleanup();}
});

test('modified source and changed lock both fail before source import',()=>{
  const f=fixture();try{
    fs.appendFileSync(path.join(f.at,files[1]),'\n// unapproved');
    assert.throws(f.run,/C_R4_PACKAGE_SOURCE_MODULE_DRIFT/);
  }finally{f.cleanup();}
  const g=fixture();try{
    fs.appendFileSync(path.join(g.at,files[3]),' ');
    assert.throws(g.run,/C_R4_PACKAGE_SOURCE_LOCK_SHA_DRIFT/);
  }finally{g.cleanup();}
});

test('R4 offline remote manifest change is blocked before source import',()=>{
  const f=fixture();try{
    fs.appendFileSync(path.join(f.at,files[2]),' ');
    assert.throws(f.run,/C_R4_PACKAGE_MANIFEST_SHA_DRIFT/);
  }finally{f.cleanup();}
});

test('extra, missing and symlinked package files are rejected',()=>{
  const f=fixture();try{
    fs.writeFileSync(path.join(f.at,'extra.txt'),'unexpected');
    assert.throws(f.run,/C_R4_PACKAGE_EXTRA_OR_MISSING/);
  }finally{f.cleanup();}
  const g=fixture();try{
    fs.unlinkSync(path.join(g.at,files[1]));
    assert.throws(g.run,/C_R4_PACKAGE_EXTRA_OR_MISSING/);
  }finally{g.cleanup();}
  const h=fixture();try{
    const source=path.join(h.at,files[1]);
    fs.renameSync(source,source+'.old');
    fs.symlinkSync(source+'.old',source);
    fs.unlinkSync(source+'.old');
    assert.throws(h.run,/C_R4_PACKAGE_FILE_UNSAFE/);
  }finally{h.cleanup();}
});

test('R4 Linux or Windows Runner cannot touch original Windows',async()=>{
  await assert.rejects(main([]),/C_R4_ORIGINAL_WINDOWS_ONLY/);
  await assert.rejects(main(['--wrong']),/C_R4_FIXED_USAGE/);
});

test('R4 CMD is source-SHA pinned, console-only and C execution-free',()=>{
  const cli=fs.readFileSync(path.join(folder,files[0]));
  const cmd=fs.readFileSync(path.join(folder,files[4]),'utf8');
  const executable=cmd.split(/\r?\n/).filter(line=>
    !/^\s*REM\b/i.test(line)).join('\n');
  assert.ok(cmd.includes(hash(cli)));
  assert.match(cmd,/E:\\ZGmini\\runtime\\node\.exe/);
  assert.match(cmd,/C:\\Windows\\System32\\WindowsPowerShell\\v1\.0/);
  assert.match(cmd,/Get-FileHash -LiteralPath/);
  assert.match(cmd,/"%ZGMINI_NODE%" "%ZGMINI_CLI%"/);
  assert.doesNotMatch(executable,/\b(?:copy|move|ren|del|robocopy|curl|gh api)\b/i);
  assert.doesNotMatch(cmd,/"%ZGMINI_NODE%" "RUN_996_NATIVE_C_ONCE/);
});

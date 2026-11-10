import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {verify996InterruptedReadonlyPackageR2,main} from
  '../tools/controller-996-interrupted-readonly-cli-r2.mjs';

const toolDir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../tools');
const sha=v=>createHash('sha256').update(v).digest('hex');
const modules=[
 'controller-996-interrupted-observer.mjs',
 'controller-996-protection-attestation.mjs',
 'controller-996-r2-evidence-review.mjs',
 'controller-996-windows-observer.mjs',
 'controller-996-interrupted-evidence-r2.mjs',
 'controller-996-interrupted-readonly-cli-r2.mjs',
];
const lock='controller-996-interrupted-readonly-source-lock-r2.json';
function fixture(){
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-996-test-'));
 for(const name of [...modules,lock])
  fs.copyFileSync(path.join(toolDir,name),path.join(folder,name));
 const expectedLockSha256=sha(fs.readFileSync(path.join(folder,lock)));
 return {folder,expectedLockSha256,run:()=>
   verify996InterruptedReadonlyPackageR2({folder,expectedLockSha256,testOnly:true}),
  cleanup:()=>fs.rmSync(folder,{recursive:true,force:true})};
}

test('R2 source-lock verifies exactly five local modules and static import closure',()=>{
 const f=fixture();
 try{
  const result=f.run();
  assert.equal(result.status,'READONLY_R2_SOURCE_PACKAGE_5_VERIFIED');
  assert.equal(result.moduleCount,5);
  assert.equal(result.executionAuthorized,false);
 }finally{f.cleanup();}
});

test('extra, missing or edited R2 module fails without importing it',()=>{
 const f=fixture();
 try{
  fs.writeFileSync(path.join(f.folder,'controller-996-invalid.mjs'),'// extra');
  assert.throws(f.run,/C_R2_PACKAGE_EXTRA_OR_MISSING_MODULE/);
 }finally{f.cleanup();}
 const g=fixture();
 try{
  fs.appendFileSync(path.join(g.folder,modules[4]),'\n// tampered');
  assert.throws(g.run,/C_R2_PACKAGE_MODULE_DRIFT/);
 }finally{g.cleanup();}
 const h=fixture();
 try{
  fs.rmSync(path.join(h.folder,modules[4]));
  assert.throws(h.run,/C_R2_PACKAGE_EXTRA_OR_MISSING_MODULE/);
 }finally{h.cleanup();}
});

test('tampered source-lock fails before source module validation',()=>{
 const f=fixture();
 try{
  fs.appendFileSync(path.join(f.folder,lock),' ');
  assert.throws(f.run,/C_R2_PACKAGE_LOCK_SHA_DRIFT/);
 }finally{f.cleanup();}
});

test('production entry on Linux stops before any original PC access',async()=>{
 await assert.rejects(main([]),/C_R2_ORIGINAL_WINDOWS_ONLY/);
});

test('R2 CMD pins current CLI and never starts the old native C operator',()=>{
 const cli=fs.readFileSync(path.join(toolDir,modules[5]));
 const cmd=fs.readFileSync(path.join(toolDir,
   'RUN_996_INTERRUPTED_EVIDENCE_R2_ONCE.cmd'),'utf8');
 assert.ok(cmd.includes(sha(cli)));
 assert.match(cmd,/C:\\Windows\\System32\\WindowsPowerShell\\v1\.0\\powershell\.exe/);
 assert.match(cmd,/E:\\ZGmini\\runtime\\node\.exe/);
 assert.equal(cmd.includes('"%ZGMINI_NODE%" "%ZGMINI_CLI%"'),true);
 assert.equal(cmd.includes('"%ZGMINI_NODE%" "RUN_996_NATIVE_C_ONCE.cmd"'),false);
 assert.equal(/>\s*[^&]|\bcopy\b|\bmove\b|\bren\b/i.test(cmd),false);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {verify996InterruptedReadonlyPackage,main,
 summarize996InterruptedReadonly} from '../tools/controller-996-interrupted-readonly-cli.mjs';

const src=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../tools');
const files=[
 'controller-996-interrupted-readonly-cli.mjs',
 'controller-996-interrupted-observer.mjs',
 'controller-996-protection-attestation.mjs',
 'controller-996-r2-evidence-review.mjs',
 'controller-996-windows-observer.mjs',
 'controller-996-interrupted-readonly-source-lock-r1.json',
];
const lockName='controller-996-interrupted-readonly-source-lock-r1.json';
const sha=b=>createHash('sha256').update(b).digest('hex');
function fixture(){
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-996-test-'));
 for(const name of files)fs.copyFileSync(path.join(src,name),path.join(folder,name));
 const digest=()=>sha(fs.readFileSync(path.join(folder,lockName)));
 const run=(extra={})=>verify996InterruptedReadonlyPackage({
  folder,expectedLockSha256:digest(),testOnly:true,...extra});
 const dispose=()=>fs.rmSync(folder,{recursive:true,force:true});
 return {folder,run,dispose,digest};
}

test('all four exact fixed modules and import closure are verified',()=>{
 const a=fixture();
 try{
  assert.equal(a.run().status,'READONLY_SOURCE_PACKAGE_4_VERIFIED');
  assert.equal(a.run().moduleCount,4);
  assert.equal(a.run().executionAuthorized,false);
 }finally{a.dispose();}
});

test('source module byte tampering fails without loading it',()=>{
 const a=fixture();
 try{
  fs.appendFileSync(path.join(a.folder,'controller-996-interrupted-observer.mjs'),
   '// modified after seal\n');
  assert.throws(()=>a.run(),{code:'C_READONLY_PACKAGE_MODULE_DRIFT'});
 }finally{a.dispose();}
});

test('source-lock tampering fails before any module checks',()=>{
 const a=fixture();
 try{
  const initial=a.digest();
  fs.appendFileSync(path.join(a.folder,lockName),' ');
  assert.throws(()=>a.run({expectedLockSha256:initial}),
   {code:'C_READONLY_PACKAGE_LOCK_SHA_DRIFT'});
 }finally{a.dispose();}
});

test('an invalid pinned import closure cannot bypass the verifier',()=>{
 const a=fixture();
 try{
  const filename=path.join(a.folder,lockName),lock=JSON.parse(
   fs.readFileSync(filename,'utf8'));
  lock.files['controller-996-interrupted-observer.mjs'].imports=[];
  fs.writeFileSync(filename,JSON.stringify(lock)+'\n');
  assert.throws(()=>a.run(),{code:'C_READONLY_PACKAGE_MODULE_DRIFT'});
 }finally{a.dispose();}
});

test('a symlinked module or an extra module always stops',()=>{
 const a=fixture();
 try{
  const name='controller-996-protection-attestation.mjs';
  const f=path.join(a.folder,name);
  fs.renameSync(f,f+'.old');
  fs.symlinkSync(f+'.old',f);
  assert.throws(()=>a.run(),{code:'C_READONLY_PACKAGE_FILE_UNSAFE'});
 }finally{a.dispose();}
 const b=fixture();
 try{
  fs.writeFileSync(path.join(b.folder,'controller-996-extra.mjs'),
   'export default true;\n');
  assert.throws(()=>b.run(),{code:'C_READONLY_PACKAGE_EXTRA_OR_MISSING_MODULE'});
 }finally{b.dispose();}
});

test('test port is restricted to a dedicated temporary folder',()=>{
 const a=fixture();
 try{
  assert.throws(()=>a.run({folder:path.dirname(a.folder)}),
   {code:'C_READONLY_TEST_PORT_REJECTED'});
 }finally{a.dispose();}
});

test('production entry refuses a non-original Windows environment',async()=>{
 await assert.rejects(main(),{code:'C_READONLY_ORIGINAL_WINDOWS_ONLY'});
});

test('result summary is redacted and cannot authorize C recovery',()=>{
 const r={
  schema:'ZGMINI_CONTROLLER_996_INTERRUPTED_OBSERVATION_V1',
  status:'READONLY_INTERRUPTED_PHASE_CONSISTENT',
  code:'C_CLAIM_PROVENANCE_NOT_EXTERNALLY_PINNED',
  checksPassed:14,checksTotal:14,
  backlogSha256:'a'.repeat(64),
  pausedAt:'2026-11-10T01:30:00.000Z',
  resumedAt:'2026-11-10T12:59:03.000Z',
  workflowState:'active',originalLeasePresent:true,cClaimPresent:true,
  laterArchiveMarkersPresent:false,
  ownerNonce:'SECRET_NONCE_NOT_FOR_EXPORT',pid:1234,
  executionAuthorized:false,operationalWrites:0,issuePosts:0,pcRetries:0,
 };
 const out=summarize996InterruptedReadonly(r);
 const json=JSON.stringify(out);
 assert.equal(out.executionAuthorized,false);
 assert.equal(out.claimProvenanceExternallyPinned,false);
 assert.equal(json.includes('SECRET_NONCE_NOT_FOR_EXPORT'),false);
 assert.equal(json.includes('1234'),false);
 assert.throws(()=>summarize996InterruptedReadonly({...r,executionAuthorized:true}),
  {code:'C_READONLY_OBSERVER_RESULT_UNVERIFIED'});
});

test('CMD hashes only the new read-only CLI and excludes native C execution',()=>{
 const cmd=fs.readFileSync(path.join(src,'RUN_996_INTERRUPTED_READONLY_ONCE.cmd'),'utf8');
 const cli=fs.readFileSync(path.join(src,'controller-996-interrupted-readonly-cli.mjs'));
 const executable=cmd.split(/\r?\n/).filter(line=>!/^\s*REM\s/i.test(line)).join('\n');
 const matched=cmd.match(/Get-FileHash -LiteralPath \$env:ZGMINI_CLI -Algorithm SHA256\)\.Hash -ne '([a-f0-9]{64})'/);
 assert.equal(matched?.[1],sha(cli));
 assert.match(cmd,/-NoProfile -NonInteractive -Command/);
 assert.doesNotMatch(executable,/\bfor\s+\/f\b/i);
 assert.doesNotMatch(executable,/"%ZGMINI_NODE%"\s+"%~dp0RUN_996_NATIVE_C_ONCE/i);
 assert.match(cmd,/"%ZGMINI_NODE%"\s+"%ZGMINI_CLI%"/);
 assert.match(cmd,/%TEMP%\\ZGMINI-996-INTERRUPTED-READONLY/);
});

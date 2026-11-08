import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {applyApprovedConfig} from './transaction.mjs';
import {sha256,SCOPE,TARGET} from './contract.mjs';

let next=0;
function fixture(body='{"enabled":true,"source":"preserve","nested":{"value":7}}\n'){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'r6-config-b-fixture-'));
 const target=path.join(dir,'config.json');
 const journalRoot=path.join(dir,'journal');
 const sharedLock=path.join(dir,'shared-writer.lock');
 fs.writeFileSync(target,body);
 const original=fs.readFileSync(target);
 const requestId='test'+(++next);
 const auth={request:{requestId},controlSha:'e'.repeat(40),
  manifest:{scope:SCOPE,targetPath:TARGET,beforeSha256:sha256(original)}};
 return {dir,target,journalRoot,sharedLock,original,auth,
  args:{target,journalRoot,sharedLock,
   verifyInstalled:()=>({verifiedFiles:19,sourceSha:'e'.repeat(40)})},
  close(){fs.rmSync(dir,{recursive:true,force:true});}};
}

test('applies exact booleans with one-shot journal, same-directory backup and no other edits',()=>{
 const x=fixture();
 try{
  const result=applyApprovedConfig(x.auth,x.args);
  assert.equal(result.status,'CONFIG_B_APPLIED_VERIFIED');
  assert.equal(result.code,'CONFIG_B_OPTINS_SET');
  assert.equal(result.backupVerified,true);
  assert.equal(fs.existsSync(x.sharedLock),false);
  const final=JSON.parse(fs.readFileSync(x.target,'utf8'));
  assert.deepEqual(final,{enabled:true,source:'preserve',nested:{value:7},
   employmentR6AutoCollection:true,employmentR6OneYearAutoPublication:true});
  assert.equal(fs.readFileSync(x.target+'.config-b-'+x.auth.request.requestId+'.original.bin').equals(x.original),true);
  assert.equal(fs.existsSync(path.join(x.journalRoot,x.auth.request.requestId,'journal.jsonl')),true);
 }finally{x.close();}
});

test('no-op when both keys true, exact bytes intact without backup',()=>{
 const x=fixture('{"employmentR6AutoCollection":true,"other":1,"employmentR6OneYearAutoPublication":true}\n');
 try{
  const result=applyApprovedConfig(x.auth,x.args);
  assert.equal(result.status,'CONFIG_B_APPLIED_VERIFIED');
  assert.equal(result.code,'CONFIG_B_ALREADY_SET');
  assert.equal(result.backupVerified,false);
  assert.equal(fs.readFileSync(x.target).equals(x.original),true);
  assert.equal(fs.existsSync(x.target+'.config-b-'+x.auth.request.requestId+'.original.bin'),false);
 }finally{x.close();}
});

test('stale approval CAS prevents write and produces no claimed journal',()=>{
 const x=fixture();
 try{
  x.auth.manifest.beforeSha256='0'.repeat(64);
  const result=applyApprovedConfig(x.auth,x.args);
  assert.equal(result.status,'CONFIG_B_PREFLIGHT_STOP');
  assert.equal(result.code,'CONFIG_B_ORIGINAL_CAS_STOP');
  assert.equal(fs.readFileSync(x.target).equals(x.original),true);
  assert.equal(fs.existsSync(path.join(x.journalRoot,x.auth.request.requestId)),false);
 }finally{x.close();}
});

test('external file edit before final CAS blocks without clobbering third-party bytes',()=>{
 const x=fixture();
 try{
  const changed=Buffer.from('{"externallyChanged":true}\n');
  const result=applyApprovedConfig(x.auth,{...x.args,
   beforeSwitch:()=>fs.writeFileSync(x.target,changed)});
  assert.equal(result.status,'CONFIG_B_STOP_UNTOUCHED');
  assert.equal(result.code,'CONFIG_B_CONCURRENT_FILE_DRIFT_STOP');
  assert.equal(fs.readFileSync(x.target).equals(changed),true);
  assert.equal(fs.existsSync(x.sharedLock),false);
 }finally{x.close();}
});

test('post-backup source drift blocks without enabling opt-in or removing backup',()=>{
 const x=fixture();let reads=0;
 try{
  const result=applyApprovedConfig(x.auth,{...x.args,
   verifyInstalled:()=>({verifiedFiles:++reads===1?19:0})});
  assert.equal(result.status,'CONFIG_B_STOP_RESTORED');
  assert.equal(result.code,'CONFIG_B_INSTALL_FINAL_DRIFT_STOP');
  assert.equal(reads,2);
  assert.equal(fs.readFileSync(x.target).equals(x.original),true);
 }finally{x.close();}
});

test('post-switch failure rolls back original bytes',()=>{
 const x=fixture();
 try{
  const result=applyApprovedConfig(x.auth,{...x.args,
   afterSwitch:()=>{throw Object.assign(new Error('FIXTURE'),{code:'CONFIG_B_TEST_INJECTED_STOP'});}});
  assert.equal(result.status,'CONFIG_B_STOP_RESTORED');
  assert.equal(result.code,'CONFIG_B_TEST_INJECTED_STOP');
  assert.equal(fs.readFileSync(x.target).equals(x.original),true);
 }finally{x.close();}
});

test('shared lock contention is conservative no-op and original remains',()=>{
 const x=fixture();
 try{
  fs.writeFileSync(x.sharedLock,'other-owned-request');
  const result=applyApprovedConfig(x.auth,x.args);
  assert.equal(result.status,'CONFIG_B_PREFLIGHT_STOP');
  assert.equal(result.code,'CONFIG_B_SHARED_WRITER_BUSY_STOP');
  assert.equal(fs.readFileSync(x.target).equals(x.original),true);
  assert.equal(fs.readFileSync(x.sharedLock,'utf8'),'other-owned-request');
 }finally{x.close();}
});

test('external tamper after switch must not overwrite third-party bytes and retains lock',()=>{
 const x=fixture();
 try{
  const external=Buffer.from('{"anotherWriter": true}\n');
  const result=applyApprovedConfig(x.auth,{...x.args,
   afterSwitch:()=>{fs.writeFileSync(x.target,external);
    throw Object.assign(new Error('FIXTURE'),{code:'CONFIG_B_TEST_TAMPER_STOP'});}});
  assert.equal(result.status,'CONFIG_B_RECOVERY_REQUIRED');
  assert.equal(result.recovery,'READ_ONLY_RECONCILE_NO_REEXECUTE');
  assert.equal(fs.readFileSync(x.target).equals(external),true);
  assert.equal(fs.readFileSync(x.sharedLock,'utf8'),x.auth.request.requestId);
 }finally{x.close();}
});

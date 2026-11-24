import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {sha256} from './contract.mjs';
import {
 createWindowsSidecarIO,createIsolatedWindowsSidecarIO
} from './windows-file-adapter.mjs';

const ISOLATED=process.platform==='win32'&&process.env.CI==='true'&&
 process.env.COMPUTERNAME?.toUpperCase()==='DESKTOP-N62L0NG'&&
 typeof process.env.RUNNER_TEMP==='string';

const old=Buffer.from('isolated Windows Sidecar original bytes\n');
const revised=Buffer.from('isolated Windows Sidecar approved replacement bytes\n');
const originalSha=sha256(old);
const revisedSha=sha256(revised);
let serial=0;
const id=()=>('00000000-0000-4000-8000-'+String(++serial).padStart(12,'0'));
function fixture(t){
 const root=fs.mkdtempSync(path.join(process.env.RUNNER_TEMP,'zgmini-sidecar-b-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const target=path.join(root,'archive-run.mjs');
 const protectedFile=path.join(root,'protected-task.xml');
 fs.writeFileSync(target,old);
 fs.writeFileSync(protectedFile,Buffer.from('<task>unchanged</task>'));
 const protectedDigest=sha256(fs.readFileSync(protectedFile));
 const observeProtected=()=>({
  head:'a'.repeat(40),configSource:'a'.repeat(40),
  taskDefinitionSha256:protectedDigest,wrapperSha256:'b'.repeat(64),
  active:false,leaseOwned:true,sourceApproved:true
 });
 const make=(requestId,probe=observeProtected)=>
  createIsolatedWindowsSidecarIO({requestId,observeProtected:probe,fixtureDir:root});
 return {root,target,protectedFile,protectedDigest,make};
}
async function containsCode(action,code){
 await assert.rejects(action,e=>e.code===code);
}

test('production adapter requires trusted protection probe',()=>{
 assert.throws(()=>createWindowsSidecarIO({requestId:'not-authorized'}),
  e=>e.code==='SIDECAR_B_TRUSTED_PROBE_STOP'||
    e.code==='SIDECAR_B_WINDOWS_ONLY_STOP');
});
test('production adapter cannot run on non-Windows host',()=>{
 if(process.platform!=='win32')
  assert.throws(()=>createWindowsSidecarIO({
   requestId:'not-authorized',observeProtected:()=>({})
  }),e=>e.code==='SIDECAR_B_WINDOWS_ONLY_STOP');
});
test('isolated real-I/O factory fails closed off isolated Windows host',()=>{
 if(!ISOLATED)
  assert.throws(()=>createIsolatedWindowsSidecarIO({
   requestId:id(),observeProtected:()=>({}),fixtureDir:os.tmpdir()
  }),e=>e.code==='SIDECAR_B_ISOLATION_HOST_STOP');
});

test('isolated adapter performs real backup, CAS, atomic replacement, readback and durable claim',
 {skip:!ISOLATED},async t=>{
  const f=fixture(t),requestId=id(),io=f.make(requestId);
  await io.acquire(requestId);
  const observed=await io.observe();
  assert.equal(observed.beforeSha256,originalSha);
  assert.equal(observed.realPathMatches,true);
  await io.claimOnce(requestId);
  await io.backup(originalSha);
  await io.atomicReplace(revised,originalSha,revisedSha);
  assert.equal(await io.readbackSha256(),revisedSha);
  await io.release(requestId);
  assert.equal(sha256(fs.readFileSync(f.target)),revisedSha);
  assert.equal(sha256(fs.readFileSync(f.protectedFile)),f.protectedDigest);
  const journal=path.join(f.root,'writer-b-install-once',requestId,'journal.jsonl');
  assert.match(fs.readFileSync(journal,'utf8'),/REPLACEMENT_READBACK_VERIFIED/);
  const repeat=f.make(requestId);
  await containsCode(()=>repeat.acquire(requestId),'R17_B_REQUEST_ALREADY_CLAIMED_STOP');
 });

test('isolation forbids arbitrary filesystem roots even on approved CI host',
 {skip:!ISOLATED},async ()=>{
  assert.throws(()=>createIsolatedWindowsSidecarIO({
   requestId:id(),observeProtected:()=>({}),fixtureDir:path.dirname(process.env.RUNNER_TEMP)
  }),e=>e.code==='SIDECAR_B_ISOLATION_ROOT_STOP');
 });

test('shared Writer install lock rejects a second owner without consuming its claim',
 {skip:!ISOLATED},async t=>{
  const f=fixture(t),a=id(),b=id();
  const io1=f.make(a),io2=f.make(b);
  await io1.acquire(a);
  await containsCode(()=>io2.acquire(b),'R17_B_SHARED_INSTALL_BUSY_NOOP_STOP');
  await io1.release(a);
  await io2.acquire(b);
  await io2.release(b);
  assert.equal(fs.existsSync(path.join(f.root,'writer-source-install.lock')),false);
 });

test('CAS mismatch aborts before replacement with original bytes unchanged',
 {skip:!ISOLATED},async t=>{
  const f=fixture(t),requestId=id(),io=f.make(requestId);
  await io.acquire(requestId);await io.claimOnce(requestId);
  await containsCode(()=>io.backup('0'.repeat(64)),'SIDECAR_B_PREIMAGE_STOP');
  await io.release(requestId);
  assert.equal(sha256(fs.readFileSync(f.target)),originalSha);
 });

test('second preimage CAS rejects drift after backup; restoration keeps original backup',
 {skip:!ISOLATED},async t=>{
  const f=fixture(t),requestId=id(),io=f.make(requestId);
  await io.acquire(requestId);await io.claimOnce(requestId);
  await io.backup(originalSha);
  fs.writeFileSync(f.target,Buffer.from('concurrent preimage change'));
  await containsCode(
   ()=>io.atomicReplace(revised,originalSha,revisedSha),'SIDECAR_B_CAS_STOP');
  await io.restoreBackup(originalSha);
  assert.equal(await io.readbackSha256(),originalSha);
  await io.release(requestId);
  assert.equal(sha256(fs.readFileSync(f.protectedFile)),f.protectedDigest);
 });

test('readback drift triggers real backup restoration with preserved journal',
 {skip:!ISOLATED},async t=>{
  const f=fixture(t),requestId=id(),io=f.make(requestId);
  await io.acquire(requestId);await io.claimOnce(requestId);
  await io.backup(originalSha);
  await io.atomicReplace(revised,originalSha,revisedSha);
  fs.writeFileSync(f.target,Buffer.from('readback interference'));
  assert.notEqual(await io.readbackSha256(),revisedSha);
  await io.restoreBackup(originalSha);
  assert.equal(await io.readbackSha256(),originalSha);
  await io.release(requestId);
  const journal=path.join(f.root,'writer-b-install-once',requestId,'journal.jsonl');
  assert.match(fs.readFileSync(journal,'utf8'),/ORIGINAL_RESTORED_VERIFIED/);
 });

test('missing recovery backup fails closed and preserves owner lock and original evidence',
 {skip:!ISOLATED},async t=>{
  const f=fixture(t),requestId=id(),io=f.make(requestId);
  await io.acquire(requestId);await io.claimOnce(requestId);
  await io.backup(originalSha);
  await io.atomicReplace(revised,originalSha,revisedSha);
  const backup=path.join(f.root,'writer-b-install-once',requestId,'archive-run.original');
  fs.rmSync(backup);
  await containsCode(()=>io.restoreBackup(originalSha),'SIDECAR_B_BACKUP_STOP');
  await io.release(requestId);
  assert.equal(fs.readFileSync(path.join(f.root,'writer-source-install.lock'),'utf8'),requestId);
  assert.equal(sha256(fs.readFileSync(f.target)),revisedSha);
 });

test('foreign lock owner never gets released by the initial owner',
 {skip:!ISOLATED},async t=>{
  const f=fixture(t),requestId=id(),io=f.make(requestId);
  await io.acquire(requestId);
  const lock=path.join(f.root,'writer-source-install.lock');
  fs.writeFileSync(lock,'another-owner');
  await containsCode(()=>io.release(requestId),'SIDECAR_B_LOCK_OWNER_STOP');
  assert.equal(fs.readFileSync(lock,'utf8'),'another-owner');
  // Do not mutate a real operational lock; this is the isolated fixture.
  fs.writeFileSync(lock,requestId);
  await io.release(requestId);
 });

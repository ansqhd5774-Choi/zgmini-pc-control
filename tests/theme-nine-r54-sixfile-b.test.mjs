import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {FILES,R54_B_SCHEMA,R54_B_TASK_EXCEPTION,preflight,applyApprovedSix,
 readR54RecoveryJournalStatus} from '../tools/theme-nine-r54-sixfile-b.mjs';

const approved=()=>({schema:R54_B_SCHEMA,status:'APPROVED_B',
 scope:'R54_FIXED_SIXFILE_SOURCE_ONLY',runCount:1,noProviderCalls:true,
 noD1Writes:true,taskStateException:R54_B_TASK_EXCEPTION,
 noControllerChanges:true,files:FILES});
const validGate=()=>({publisherConsentVerified:true,taskIdleVerified:true,
 maintenanceLeaseVerified:true,activeR54ProcessAbsent:true,
 sourceRootVerified:true,scoreReplayApproved:true,
 observedAt:new Date().toISOString()});

test('source update scope is exactly the 6 audited R54/R51/R48/Reader files',()=>{
 assert.equal(FILES.length,6);
 assert.equal(new Set(FILES.map(x=>x.path)).size,6);
 assert.deepEqual(FILES.map(x=>x.path),[
  'scripts/pc-writer/theme-nine-r54-public-connect.mjs',
  'scripts/pc-writer/theme-nine-r51-stage-current.mjs',
  'scripts/pc-writer/theme-nine-r51-provisional-overlay.mjs',
  'scripts/pc-writer/theme-nine-r54-public-record.mjs',
  'scripts/pc-writer/theme-nine-r48-d1-publication.mjs',
  'worker/theme-nine-r37-public.mjs']);
 for(const row of FILES){
  assert.match(row.old,/^[a-f0-9]{64}$/);
  assert.match(row.next,/^[a-f0-9]{64}$/);
  assert.notEqual(row.old,row.next);
 }
 assert.equal(FILES.at(-1).next,
  '30326c94c7b6f0963329cc00f7a3649c906f8e884d6915a4da38005281bcfd85');
});

test('B approval contract cannot be broadened to additional files or writes',()=>{
 const changes=[
  {...approved(),scope:'ALL_WRITER_FILES'},
  {...approved(),noProviderCalls:false},
  {...approved(),noD1Writes:false},
  {...approved(),taskStateException:{...R54_B_TASK_EXCEPTION,noOtherTaskChanges:false}},
  {...approved(),runCount:2},
  {...approved(),files:[...FILES,{path:'data.sqlite',old:'a'.repeat(64),next:'b'.repeat(64)}]},
 ];
 for(const manifest of changes){
  assert.throws(()=>preflight({manifest,gate:validGate()}),
   /R54_B_MANIFEST_SCOPE_DENIED/);
 }
 assert.throws(()=>preflight({manifest:{...approved(),noTaskChanges:true},
  gate:validGate()}),/R54_B_MANIFEST_FIELDS_DENIED/);
});

test('B operation refuses missing verified runtime lease/consent before filesystem access',()=>{
 const badGates=[null,{},
  {...validGate(),maintenanceLeaseVerified:false},
  {...validGate(),publisherConsentVerified:false},
  {...validGate(),taskIdleVerified:false},
  {...validGate(),observedAt:'2026-01-01T00:00:00Z'}];
 for(const gate of badGates){
  assert.throws(()=>preflight({manifest:approved(),gate}),
   /R54_B_RUNTIME_GATE_REQUIRED/);
 }
});

test('B writer source change requires an independent runtime re-probe callback',()=>{
 assert.throws(()=>applyApprovedSix({manifest:approved(),gate:validGate()}),
  /R54_B_RUNTIME_REPROBE_REQUIRED/);
});

test('append-only B journal rejects incomplete, altered, and nonsequential records',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'r54-b-journal-fixture-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const id='pc-r54-journal-fixture-01';
 const journal=path.join(root,`R54_B_SIXFILE_${id}.jsonl`);
 const entry=(seq,phase)=>JSON.stringify({schema:'ZGMINI_R54_SIXFILE_B_JOURNAL_V1',
  seq,phase,file:null});
 assert.throws(()=>readR54RecoveryJournalStatus(root,id,root),
  /R54_B_JOURNAL_INSIDE_SOURCE_DENIED/);
 assert.equal(readR54RecoveryJournalStatus(root,id),null);
 fs.writeFileSync(journal,entry(0,'STAGING'));
 assert.throws(()=>readR54RecoveryJournalStatus(root,id),/R54_B_JOURNAL_INCOMPLETE/);
 fs.writeFileSync(journal,entry(0,'STAGING')+'\n'+entry(2,'SUCCEEDED')+'\n');
 assert.throws(()=>readR54RecoveryJournalStatus(root,id),/R54_B_JOURNAL_INVALID/);
 fs.writeFileSync(journal,entry(0,'STAGING')+'\n'+entry(1,'ROLLED_BACK_VERIFIED')+'\n');
 assert.equal(readR54RecoveryJournalStatus(root,id),'ROLLED_BACK_VERIFIED');
});

test('injected journal ENOSPC during swap catch restores originals and returns recovery-required',async t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'r54-b-failcatch-fixture-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const installedRoot=path.join(root,'installed'),candidateRoot=path.join(root,'candidate');
 const journalRoot=path.join(root,'ledger');
 for(const p of [installedRoot,candidateRoot,journalRoot])fs.mkdirSync(p);
 const digest=value=>createHash('sha256').update(value).digest('hex');
 let source=fs.readFileSync(fileURLToPath(new URL('../tools/theme-nine-r54-sixfile-b.mjs',
  import.meta.url)),'utf8');
 const oldBytes=[],nextBytes=[];
 for(const [i,spec] of FILES.entries()){
  const old=Buffer.from(`R54-test-old-${i}`),next=Buffer.from(`R54-test-new-${i}`);
  source=source.replace(spec.old,digest(old)).replace(spec.next,digest(next));
  oldBytes.push(old);nextBytes.push(next);
  for(const [folder,bytes] of [[installedRoot,old],[candidateRoot,next]]){
   const target=path.join(folder,spec.path);
   fs.mkdirSync(path.dirname(target),{recursive:true});
   fs.writeFileSync(target,bytes);
  }
 }
 const modulePath=path.join(root,'fixture-module.mjs');
 fs.writeFileSync(modulePath,source);
 const mod=await import(pathToFileURL(modulePath).href);
 const requestId='pc-r54-journal-enospc-01';
 const args={installedRoot,candidateRoot,journalRoot,requestId,
  manifest:{...approved(),files:mod.FILES},gate:validGate(),
  runtimeProbe:()=>validGate()};
 const nativeWrite=fs.writeSync;
 let n=0,journalFailed=false;
 fs.writeSync=function(fd,data,...rest){
  if(!journalFailed&&typeof data==='string'&&data.includes('"phase":"SWAP_INTERRUPTED"')){
   journalFailed=true;
   throw Object.assign(new Error('INJECTED_ENOSPC'),{code:'ENOSPC'});
  }
  return nativeWrite.call(this,fd,data,...rest);
 };
 try{
  assert.throws(()=>mod.applyApprovedSix({...args,beforeSwap:()=>{
   if(++n===2)throw new Error('INJECTED_SECOND_SWAP_FAILURE');
  }}),/R54_B_JOURNAL_RECOVERY_REQUIRED/);
 }finally{fs.writeSync=nativeWrite}
 assert.equal(journalFailed,true);
 for(const [i,spec] of mod.FILES.entries())
  assert.deepEqual(fs.readFileSync(path.join(installedRoot,spec.path)),oldBytes[i]);
 assert.throws(()=>mod.preflight(args),/R54_B_PRIOR_JOURNAL_REQUIRES_RECONCILIATION|R54_B_JOURNAL_INVALID/);
});


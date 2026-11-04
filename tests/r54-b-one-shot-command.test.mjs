import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {runR54BApprovedOneShot} from '../tools/update.mjs';
import {R54_B_SOURCE_FILES} from '../tools/maintenance-contract.mjs';

function fixture(t,{active=0,applyMode='success',restoreFails=false,
 disableThrows=false}={}){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'r54-command-test-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const state={enabled:true,phase:'old',active,disable:0,restore:0,applies:0,
  pauses:0,installRelease:0,installHold:0,writerRelease:0};
 const baseline={name:'ZGMINI-PC-Theme-Nine-R54-Public',enabled:true,
  definitionDigest:'f'.repeat(64),durableXmlBackupReadback:true};
 const task={
  saveBaseline:()=>baseline,
  inspect:()=>({...baseline,enabled:state.enabled}),
  disable:()=>{state.disable++;state.enabled=false;
   if(disableThrows)throw Error('R54_TASK_DISABLE_OUTCOME_UNKNOWN');
   return {...baseline,enabled:false};},
  restore:()=>{state.restore++;
   if(restoreFails)throw Error('R54_TASK_RESTORE_OUTCOME_UNKNOWN');
   state.enabled=true;return {...baseline,enabled:true};},
 };
 const options={requestId:'pc-r54-oneshot-verified-003',
  writerRoot:root,backupBase:root,
  loadCandidates:()=>new Map(),
  inspectOriginal:()=>({files:R54_B_SOURCE_FILES.map(x=>x)}),
  readPinnedHashes:()=>R54_B_SOURCE_FILES.map((x,i)=>
   state.phase==='mixed'&&i===1?'e'.repeat(64):x[state.phase==='next'?'next':'old']),
  sourceScan:()=>{const busy=state.active>0;if(busy)state.active--;
   return {active:busy?[123]:[]};},
  taskFactory:()=>task,
  acquireInstall:()=>({release:()=>state.installRelease++,
   holdForRecovery:()=>state.installHold++}),
  acquireWriter:()=>({status:'ACQUIRED',assertHeld:()=>true,
   release:()=>state.writerRelease++}),
  pause:async()=>{state.pauses++},
  applyFiles:async({verifyWindow})=>{
   state.applies++;
   assert.equal(await verifyWindow(),true);
   if(applyMode==='mixed'){state.phase='mixed';throw Error('R54_B_PARTIAL_SWAP');}
   if(applyMode==='old')throw Error('R54_B_APPLY_FAILED_VERIFIED_OLD');
   state.phase='next';return {status:'SIX_FILE_SOURCE_APPLIED_SHA_VERIFIED'};
  },
 };
 return {state,options};
}

test('approved one-shot enters exactly once and restores the sole Task',async t=>{
 const f=fixture(t,{active:2});
 const result=await runR54BApprovedOneShot(f.options);
 assert.equal(result.status,'SUCCEEDED');
 assert.equal(f.state.applies,1);
 assert.equal(f.state.disable,1);
 assert.equal(f.state.restore,1);
 assert.equal(f.state.pauses,2);
 assert.equal(f.state.installRelease,1);
 assert.equal(f.state.writerRelease,1);
});

test('candidate access failure is BLOCKED before any Task or source write',async t=>{
 const f=fixture(t);
 f.options.loadCandidates=()=>{throw Error('R54_B_CANDIDATE_SOURCE_UNAVAILABLE')};
 const result=await runR54BApprovedOneShot(f.options);
 assert.equal(result.status,'BLOCKED');
 assert.equal(result.protectedStateUnchanged,true);
 assert.equal(f.state.disable,0);
 assert.equal(f.state.applies,0);
 assert.equal(f.state.installRelease,0);
});

test('verified original six survive failed swap: Task restored, never retried',async t=>{
 const f=fixture(t,{applyMode:'old'});
 const result=await runR54BApprovedOneShot(f.options);
 assert.equal(result.status,'BLOCKED');
 assert.equal(result.sourceOldVerified,true);
 assert.equal(f.state.restore,1);
 assert.equal(f.state.applies,1);
});

test('mixed source after error keeps Task disabled and leases for recovery',async t=>{
 const f=fixture(t,{applyMode:'mixed'});
 const result=await runR54BApprovedOneShot(f.options);
 assert.equal(result.status,'RECOVERY_REQUIRED');
 assert.equal(f.state.enabled,false);
 assert.equal(f.state.restore,0);
 assert.equal(f.state.installHold,1);
 assert.equal(f.state.writerRelease,0);
});

test('unknown disable outcome does not blindly disable/enable a second time',async t=>{
 const f=fixture(t,{disableThrows:true});
 const result=await runR54BApprovedOneShot(f.options);
 assert.equal(result.status,'RECOVERY_REQUIRED');
 assert.equal(f.state.disable,1);
 assert.equal(f.state.restore,0);
 assert.equal(f.state.installHold,1);
});

test('unknown restore outcome is not automatically retried',async t=>{
 const f=fixture(t,{restoreFails:true});
 const result=await runR54BApprovedOneShot(f.options);
 assert.equal(result.status,'RECOVERY_REQUIRED');
 assert.equal(f.state.restore,1);
 assert.equal(f.state.applies,1);
 assert.equal(f.state.installHold,1);
});

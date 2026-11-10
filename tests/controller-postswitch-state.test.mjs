import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {acquirePostSwitchState,inspectPostSwitchState,resumePostSwitchState} from '../tools/controller-postswitch-state.mjs';

const id='pc-update-877e10c8-8580-4095-a675-bef9ec032193';
const sha40='badad9124157879d7a645b64f2768113d632355b';
const sha256=b=>createHash('sha256').update(b).digest('hex');
const nonce='ca956971-6c37-4d82-9974-034f4be203be';
function fixture(){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'post-switch-test-'));
  const ledgerDir=path.join(root,'ledger');
  fs.mkdirSync(ledgerDir);
  fs.mkdirSync(path.join(root,'leases'));
  const ledger=Buffer.from('{"status":"RECOVERY_REQUIRED"}\n');
  fs.writeFileSync(path.join(ledgerDir,id+'.json'),ledger);
  const opts={maintenanceRoot:root,requestId:id,ledgerSha256:sha256(ledger),
    sourceSha:sha40,nonce};
  return {root,opts,done:()=>fs.rmSync(root,{recursive:true,force:true})};
}
test('exclusive claim and append-only chained records',()=>{
  const f=fixture();
  try{
    const store=acquirePostSwitchState(f.opts);
    assert.equal(store.initial.code,'RECOVERY_CLAIM_ACQUIRED');
    assert.equal(store.initial.sequence,1);
    assert.equal(store.append('FORWARD_PREPARED',{claimHeld:true}).sequence,2);
    assert.equal(store.append('BACKLOG_POSTING',{originalIssueNumber:919}).sequence,3);
    assert.deepEqual(inspectPostSwitchState({maintenanceRoot:f.root,requestId:id}),{
      exists:true,claimExists:true,count:3,lastCode:'BACKLOG_POSTING',
      lastHash:inspectPostSwitchState({maintenanceRoot:f.root,requestId:id}).lastHash});
    assert.throws(()=>store.releaseUntouched(),/POSTSWITCH_CLAIM_ALREADY_USED/);
  }finally{f.done();}
});
test('duplicate operator cannot reserve a claim or silently resume',()=>{
  const f=fixture();
  try{
    acquirePostSwitchState(f.opts);
    assert.throws(()=>acquirePostSwitchState(f.opts),/POSTSWITCH_RECOVERY_CLAIM_EXISTS/);
  }finally{f.done();}
});

function resumableFixture(){
 const f=fixture();const s=acquirePostSwitchState(f.opts);
 s.append('BACKLOG_POSTING_INTENT',{originalIssueNumber:919});
 const owner=fs.readFileSync(path.join(s.claimDir,'owner.json'));
 const snapshot=inspectPostSwitchState({maintenanceRoot:f.root,requestId:id});
 const contract={ownerSha256:sha256(owner),priorSourceSha:sha40,
   recordCount:snapshot.count,recordTailSha256:snapshot.lastHash,replayIssueNumber:1215};
 return {...f,owner,contract,run:patch=>resumePostSwitchState({...f.opts,
   sourceSha:'f'.repeat(40),contract,livePid:()=>false,...patch})};
}
test('explicit resume appends to exact journal without changing original owner or ledger',()=>{
 const f=resumableFixture();try{
  const old=fs.readFileSync(path.join(f.root,'recovery/post-switch',id,'000002.json'));
  const resumed=f.run();resumed.append('RESUME_RESULT_VERIFIED',{issueNumber:1215});
  assert.deepEqual(fs.readFileSync(path.join(resumed.claimDir,'owner.json')),f.owner);
  assert.deepEqual(fs.readFileSync(path.join(resumed.stateDir,'000002.json')),old);
  assert.equal(inspectPostSwitchState({maintenanceRoot:f.root,requestId:id}).count,4);
  assert.throws(()=>f.run(),/RESUME_STATE_DRIFT|RESUME_ALREADY_CLAIMED/);
 }finally{f.done();}
});
test('resume refuses live/unknown owner, altered journal, wrong hash or ledger drift before claim',()=>{
 for(const mutate of [
  f=>({livePid:()=>true}),f=>({livePid:()=>null}),
  f=>({contract:{...f.contract,ownerSha256:'0'.repeat(64)}}),
  f=>({contract:{...f.contract,recordTailSha256:'0'.repeat(64)}}),
  f=>({contract:{...f.contract,priorSourceSha:'0'.repeat(40)}}),
  f=>{fs.appendFileSync(path.join(f.root,'ledger',id+'.json'),' ');return {};},
 ]){const f=resumableFixture();try{
   assert.throws(()=>f.run(mutate(f)),/RESUME_STATE_DRIFT/);
   assert.equal(fs.existsSync(path.join(f.root,'leases/controller-recovery/resume-1215')),false);
  }finally{f.done();}}
});

test('finalization preserves both earlier owner records and has its own exclusive child claim',()=>{
 const f=resumableFixture();try{
  const resumed=f.run();
  const previousFile=path.join(resumed.claimDir,'resume-1215/owner.json');
  const previous=fs.readFileSync(previousFile);
  const current=inspectPostSwitchState({maintenanceRoot:f.root,requestId:id});
  const contract={...f.contract,mode:'FINALIZE_1215_1216_EXISTING_RESULTS',
    priorSourceSha:'f'.repeat(40),ownerSourceSha:sha40,
    priorContinuationOwnerSha256:sha256(previous),recordCount:current.count,
    recordTailSha256:current.lastHash};
  const final=resumePostSwitchState({...f.opts,sourceSha:'e'.repeat(40),contract,livePid:()=>false});
  assert(fs.existsSync(path.join(final.claimDir,'finalize-1216/owner.json')));
  assert.deepEqual(fs.readFileSync(previousFile),previous);
  assert.deepEqual(fs.readFileSync(path.join(final.claimDir,'owner.json')),f.owner);
  assert.throws(()=>resumePostSwitchState({...f.opts,sourceSha:'e'.repeat(40),contract,livePid:()=>false}));
 }finally{f.done();}
});
test('unrelated existing C-grade recovery claim excludes this mode',()=>{
  const f=fixture();
  try{
    fs.mkdirSync(path.join(f.root,'leases','controller-recovery'));
    assert.throws(()=>acquirePostSwitchState(f.opts),/POSTSWITCH_RECOVERY_CLAIM_EXISTS/);
  }finally{f.done();}
});
test('preflight ledger changed before claim is rejected without writing',()=>{
  const f=fixture();
  try{
    fs.appendFileSync(path.join(f.root,'ledger',id+'.json'),'{}');
    assert.throws(()=>acquirePostSwitchState(f.opts),/POSTSWITCH_ORIGINAL_LEDGER_CHANGED/);
    assert.equal(fs.existsSync(path.join(f.root,'leases','controller-recovery')),false);
  }finally{f.done();}
});
test('original ledger changed after claim blocks all further intents',()=>{
  const f=fixture();
  try{
    const store=acquirePostSwitchState(f.opts);
    fs.appendFileSync(path.join(f.root,'ledger',id+'.json'),'{}');
    assert.throws(()=>store.append('BACKLOG_POSTING'),/POSTSWITCH_ORIGINAL_LEDGER_CHANGED/);
    assert.equal(inspectPostSwitchState({maintenanceRoot:f.root,requestId:id}).count,1);
  }finally{f.done();}
});
test('tampered append-only record blocks further mutations',()=>{
  const f=fixture();
  try{
    const store=acquirePostSwitchState(f.opts);
    store.append('FORWARD_PREPARED');
    fs.appendFileSync(path.join(store.stateDir,'000001.json'),'\n');
    assert.throws(()=>store.append('BACKLOG_POSTING'),/POSTSWITCH_RECOVERY_RECORD_CHAIN_DRIFT/);
  }finally{f.done();}
});
test('releasing only an untouched claim leaves durable audit',()=>{
  const f=fixture();
  try{
    const store=acquirePostSwitchState(f.opts);
    store.releaseUntouched();
    const result=inspectPostSwitchState({maintenanceRoot:f.root,requestId:id});
    assert.equal(result.exists,true);
    assert.equal(result.claimExists,false);
    assert.equal(result.count,1);
    assert.throws(()=>acquirePostSwitchState(f.opts),/POSTSWITCH_RECOVERY_RECORD_EXISTS/);
  }finally{f.done();}
});

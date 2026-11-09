import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {acquirePostSwitchState,inspectPostSwitchState} from '../tools/controller-postswitch-state.mjs';

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

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomBytes,randomUUID} from 'node:crypto';
import {Worker} from 'node:worker_threads';
import {simulate996CSharedReservation} from
  '../tools/controller-996-c-exclusive-reservation-fixture.mjs';

const SOURCE_LOCK='a'.repeat(64);
const FIXED='controller-recovery-continuation-reservation';
const SOURCE_MODULE=new URL(
  '../tools/controller-996-c-exclusive-reservation-fixture.mjs',import.meta.url).href;
const stable=()=>({workflowState:'active',protectionVerified:true,
  writerActiveCount:0,controllerActiveCount:0,otherContinuationCount:0});
function setup(){
  const root=path.join(os.tmpdir(),'zgmini-996-test-c-reservation-'+
    randomBytes(16).toString('hex'));
  fs.mkdirSync(root,{mode:0o700});
  const leases=path.join(root,'leases');
  fs.mkdirSync(leases);
  for(const name of ['controller-recovery','controller-install']){
    const at=path.join(leases,name);fs.mkdirSync(at);
    fs.writeFileSync(path.join(at,'owner.json'),JSON.stringify({name})+'\n',
      {flag:'wx'});
  }
  const original=fs.readFileSync(path.join(leases,
    'controller-install','owner.json'));
  return {root,leases,original};
}
const input=f=>({testOnly:true,root:f.root,
  continuationRequestId:randomUUID(),nonce:randomUUID(),
  sourceLockSha256:SOURCE_LOCK,readSynthetic:stable});
const status=(r,expected)=>{
  assert.equal(r.status,expected);
  assert.equal(r.executionAuthorized,false);
  assert.equal(r.productionExecutable,false);
  assert.equal(r.originalPcWrites,0);
  assert.equal(r.workflowPuts,0);
  assert.equal(r.backlogWrites,0);
  assert.equal(r.issuePosts,0);
  assert.equal(r.pcRetries,0);
  assert.equal(r.cleanupPerformed,false);
};
const sameInstall=f=>assert.deepEqual(fs.readFileSync(path.join(f.leases,
  'controller-install','owner.json')),f.original);

test('production call is unconditionally disabled before examining a path',()=>{
  status(simulate996CSharedReservation({root:'E:\\ZGmini',testOnly:false}),
    'ISOLATED_SHARED_RESERVATION_STOP_PRESERVE');
  assert.equal(simulate996CSharedReservation({testOnly:false}).code,
    'C_996_SHARED_RESERVATION_PRODUCTION_DISABLED');
});

test('synthetic fixed fence is independent from the continuation UUID',()=>{
  const f=setup(),first=input(f),second=input(f);
  const a=simulate996CSharedReservation(first);
  status(a,'ISOLATED_SHARED_RESERVATION_AND_CLAIM_ONLY');
  assert.equal(a.fixedReservation,FIXED);
  assert.notEqual(first.continuationRequestId,second.continuationRequestId);
  const b=simulate996CSharedReservation(second);
  status(b,'ISOLATED_SHARED_RESERVATION_STOP_PRESERVE');
  assert.equal(b.code,'C_996_SHARED_RESERVATION_BUSY');
  assert.equal(fs.existsSync(path.join(f.leases,FIXED,'owner.json')),true);
  assert.equal(fs.existsSync(path.join(f.leases,
    'controller-recovery-continuation-'+second.continuationRequestId)),false);
  sameInstall(f);
});

test('successful fixture writes two individually pinned test owners but never releases install',()=>{
  const f=setup(),i=input(f);
  const r=simulate996CSharedReservation(i);
  status(r,'ISOLATED_SHARED_RESERVATION_AND_CLAIM_ONLY');
  const fence=JSON.parse(fs.readFileSync(path.join(f.leases,FIXED,'owner.json'),'utf8'));
  const claim=JSON.parse(fs.readFileSync(path.join(f.leases,
    'controller-recovery-continuation-'+i.continuationRequestId,'owner.json'),'utf8'));
  assert.equal(fence.continuationRequestId,i.continuationRequestId);
  assert.equal(fence.nonce,i.nonce);
  assert.equal(claim.nonce,i.nonce);
  assert.equal(claim.phase,'CLAIMED_TEST_ONLY');
  sameInstall(f);
});

test('invalid source pin, UUID, and nonce do not reserve anything',()=>{
  for(const changed of [
    {continuationRequestId:'not-a-uuid'},
    {nonce:'not-a-uuid'},
    {sourceLockSha256:'not-a-digest'},
  ]){
    const f=setup(),r=simulate996CSharedReservation({...input(f),...changed});
    status(r,'ISOLATED_SHARED_RESERVATION_STOP_PRESERVE');
    assert.equal(r.code,'C_996_SHARED_RESERVATION_INPUT_INVALID');
    assert.equal(fs.existsSync(path.join(f.leases,FIXED)),false);
    sameInstall(f);
  }
});

test('active writer or Controller rejects prior to any fixture reservation',()=>{
  for(const state of [{writerActiveCount:1},{controllerActiveCount:1},
    {otherContinuationCount:1},{protectionVerified:false},
    {workflowState:'disabled'}]){
    const f=setup();
    const r=simulate996CSharedReservation({...input(f),
      readSynthetic:()=>({...stable(),...state})});
    status(r,'ISOLATED_SHARED_RESERVATION_STOP_PRESERVE');
    assert.equal(r.code,'C_996_SHARED_RESERVATION_SYNTHETIC_CONFLICT');
    assert.equal(fs.existsSync(path.join(f.leases,FIXED)),false);
    sameInstall(f);
  }
});

test('fault after fence preserves fixed directory without owner and never retries',()=>{
  const f=setup(),i=input(f);
  const r=simulate996CSharedReservation({...i,failAfter:'AFTER_FENCE'});
  status(r,'ISOLATED_SHARED_RESERVATION_STOP_PRESERVE');
  assert.equal(r.code,'C_996_SHARED_RESERVATION_INJECTED_AFTER_FENCE');
  assert.equal(fs.existsSync(path.join(f.leases,FIXED)),true);
  assert.equal(fs.existsSync(path.join(f.leases,FIXED,'owner.json')),false);
  const later=simulate996CSharedReservation({...i,
    continuationRequestId:randomUUID()});
  assert.equal(later.code,'C_996_SHARED_RESERVATION_BUSY');
  sameInstall(f);
});

test('fault after fence owner retains exact owner; cannot adopt for new UUID',()=>{
  const f=setup(),i=input(f);
  const r=simulate996CSharedReservation({...i,
    failAfter:'AFTER_FENCE_OWNER'});
  status(r,'ISOLATED_SHARED_RESERVATION_STOP_PRESERVE');
  assert.equal(r.code,'C_996_SHARED_RESERVATION_INJECTED_AFTER_FENCE_OWNER');
  assert.equal(JSON.parse(fs.readFileSync(path.join(f.leases,FIXED,
    'owner.json'),'utf8')).nonce,i.nonce);
  assert.equal(simulate996CSharedReservation({...i,
    continuationRequestId:randomUUID()}).code,
    'C_996_SHARED_RESERVATION_BUSY');
  sameInstall(f);
});

test('fault after unique claim leaves both reservations and canonical install intact',()=>{
  const f=setup(),i=input(f);
  const r=simulate996CSharedReservation({...i,failAfter:'AFTER_CLAIM'});
  status(r,'ISOLATED_SHARED_RESERVATION_STOP_PRESERVE');
  assert.equal(r.code,'C_996_SHARED_RESERVATION_INJECTED_AFTER_CLAIM');
  assert.equal(fs.existsSync(path.join(f.leases,FIXED,'owner.json')),true);
  assert.equal(fs.existsSync(path.join(f.leases,
    'controller-recovery-continuation-'+i.continuationRequestId)),true);
  sameInstall(f);
});

test('synthetic writer entering after fixed reservation leaves install and fence held',()=>{
  const f=setup();let reads=0;
  const r=simulate996CSharedReservation({...input(f),
    readSynthetic:()=>({...stable(),writerActiveCount:++reads===2?1:0})});
  status(r,'ISOLATED_SHARED_RESERVATION_STOP_PRESERVE');
  assert.equal(r.code,'C_996_SHARED_RESERVATION_SYNTHETIC_CONFLICT');
  assert.equal(fs.existsSync(path.join(f.leases,FIXED,'owner.json')),true);
  sameInstall(f);
});

test('unexpected lease member or symlink root is fail-closed',()=>{
  const f=setup();fs.mkdirSync(path.join(f.leases,'unrelated-resource'));
  const r=simulate996CSharedReservation(input(f));
  assert.equal(r.code,'C_996_SHARED_RESERVATION_UNEXPECTED_LEASE');
  assert.equal(fs.existsSync(path.join(f.leases,FIXED)),false);
  const f2=setup();const link=path.join(os.tmpdir(),
    'zgmini-996-test-c-reservation-'+randomBytes(16).toString('hex'));
  fs.symlinkSync(f2.root,link,'dir');
  const result=simulate996CSharedReservation({...input(f2),root:link});
  assert.equal(result.code,'C_996_SHARED_RESERVATION_REDIRECT_OR_NON_DIRECTORY');
  sameInstall(f2);
});

test('unknown non-test path cannot be used to acquire a real claim',()=>{
  const f=setup();
  const r=simulate996CSharedReservation({...input(f),root:'/'});
  assert.equal(r.code,'C_996_SHARED_RESERVATION_TEST_ROOT_UNSAFE');
  assert.equal(fs.existsSync(path.join(f.leases,FIXED)),false);
});

test('two real Node worker threads racing on the same fixed directory have one winner',async()=>{
  const f=setup();const a=input(f),b=input(f);
  const workerCode=`const {parentPort,workerData}=require('node:worker_threads');
    (async()=>{const {simulate996CSharedReservation}=await import(workerData.url);
    const gate=new Int32Array(workerData.barrier);
    Atomics.add(gate,0,1);Atomics.notify(gate,0);
    while(Atomics.load(gate,0)<2)Atomics.wait(gate,0,1,100);
    const r=simulate996CSharedReservation({...workerData.input,
      readSynthetic:()=>({workflowState:'active',protectionVerified:true,
      writerActiveCount:0,controllerActiveCount:0,otherContinuationCount:0})});
    parentPort.postMessage({status:r.status,code:r.code});})().catch(e=>parentPort.postMessage({error:e.message}));`;
  const barrier=new SharedArrayBuffer(4);
  const one=(i)=>new Promise((resolve,reject)=>{
    const w=new Worker(workerCode,{eval:true,workerData:{
      url:SOURCE_MODULE,barrier,input:{...i,readSynthetic:null}}});
    w.once('message',v=>{w.terminate();resolve(v);});
    w.once('error',reject);
    w.once('exit',code=>{if(code!==0)reject(Error('worker '+code));});
  });
  const outcome=await Promise.all([one(a),one(b)]);
  assert.equal(outcome.filter(x=>x.status==='ISOLATED_SHARED_RESERVATION_AND_CLAIM_ONLY').length,1);
  assert.equal(outcome.filter(x=>x.code==='C_996_SHARED_RESERVATION_BUSY').length,1);
  sameInstall(f);
});

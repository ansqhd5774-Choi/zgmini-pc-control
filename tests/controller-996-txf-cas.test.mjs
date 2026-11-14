import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {spawnSync} from 'node:child_process';import {createHash,randomUUID} from 'node:crypto';
import {build996OwnerTransactionalArchiveFixtureScript,require996OwnerArchiveReceipt} from '../tools/controller-996-c-native-owner-operator.mjs';
const ps='C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe';
const sha=b=>createHash('sha256').update(b).digest('hex');
function create(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-996-txf-cas-'));
 assert.equal(path.parse(root).root.toLowerCase(),'c:\\');
 const source=path.join(root,'source'),destination=path.join(root,'archive');fs.mkdirSync(source);
 const nonce=randomUUID(),bytes=Buffer.from(JSON.stringify({pid:process.pid,nonce}));
 fs.writeFileSync(path.join(source,'owner.json'),bytes);
 return {root,source,destination,bytes,input:{operation:'move',root,source,destination,
  pins:{'owner.json':sha(bytes)},ownerMode:'LIVE_NEW',actorPid:process.pid,nonce}};
}
function run(f,input=f.input){
 const result=spawnSync(ps,['-NoProfile','-NonInteractive','-Command',build996OwnerTransactionalArchiveFixtureScript()],
  {input:JSON.stringify(input),windowsHide:true,encoding:'utf8',timeout:30000,maxBuffer:50000});
 assert.equal(result.error,undefined);assert.equal(result.status,0,result.stderr.slice(-3000));
 return JSON.parse(result.stdout.trim());
}
function preserved(f){assert.equal(fs.existsSync(f.source),true);assert.equal(fs.existsSync(f.destination),false);
 assert.deepEqual(fs.readFileSync(path.join(f.source,'owner.json')),f.bytes);}
function clean(f){assert.ok(path.resolve(f.root).startsWith(path.resolve(os.tmpdir())+path.sep));
 assert.match(path.basename(f.root),/^zgmini-996-txf-cas-/);fs.rmSync(f.root,{recursive:true});}
for(const mode of ['success','bad-pin','extra-file','collision','insert-in-transaction','open-writer','wrong-owner','live-old-owner','hardlink'])test('real Operator TxF CAS: '+mode,{
 skip:process.platform!=='win32',
},()=>{
 const f=create();let fd=null;
 try{
  let input=f.input;
  if(mode==='bad-pin')input={...input,pins:{'owner.json':'0'.repeat(64)}};
  if(mode==='extra-file')fs.writeFileSync(path.join(f.source,'EXTRA.json'),'{}');
  if(mode==='collision'){fs.mkdirSync(f.destination);fs.writeFileSync(path.join(f.destination,'keep.txt'),'PRESERVE');}
  if(mode==='insert-in-transaction')input={...input,fixtureInsert:true};
  if(mode==='open-writer')fd=fs.openSync(path.join(f.source,'owner.json'),'r+');
  if(mode==='wrong-owner')input={...input,nonce:randomUUID()};
  if(mode==='live-old-owner')input={...input,ownerMode:'DEAD_OLD'};
  if(mode==='hardlink')fs.linkSync(path.join(f.source,'owner.json'),path.join(f.root,'shared.json'));
  const beforeId=fs.statSync(path.join(f.source,'owner.json'),{bigint:true}).ino;
  const r=run(f,input);
  if(mode==='success'){
   require996OwnerArchiveReceipt(r,input.pins);
   assert.equal(r.strategy,'WINDOWS_TXF_CAS_V1');assert.equal(r.transactionCommitted,true);
   assert.equal(r.pinsVerifiedBeforeCommit,true);assert.equal(r.aclPreserved,true);
   assert.equal(fs.existsSync(f.source),false);assert.deepEqual(fs.readFileSync(path.join(f.destination,'owner.json')),f.bytes);
   assert.equal(fs.statSync(path.join(f.destination,'owner.json'),{bigint:true}).ino,beforeId);
   for(const key of ['transactionCommitted','transactionIdentityVerified','pinsVerifiedBeforeCommit','aclPreserved'])
    assert.throws(()=>require996OwnerArchiveReceipt({...r,[key]:false},input.pins));
   return;
  }
  assert.equal(r.ok,false);assert.equal(r.transactionCommitted,false);
  assert.equal(r.commitAttempted,false);
  if(mode==='collision'){
   assert.equal(fs.readFileSync(path.join(f.destination,'keep.txt'),'utf8'),'PRESERVE');
   assert.deepEqual(fs.readFileSync(path.join(f.source,'owner.json')),f.bytes);
  }else preserved(f);
  if(mode==='bad-pin'||mode==='extra-file')assert.match(r.code,/PIN_(?:SET|BYTES)_DRIFT$/);
  if(mode==='insert-in-transaction'){
   assert.equal(r.rollbackConfirmed,true);assert.equal(r.code,'C996_NATIVE_TX_PIN_SET_DRIFT');
   assert.equal(fs.existsSync(path.join(f.source,'INJECTED.json')),false);
  }
  if(mode==='open-writer')assert.equal(r.rollbackConfirmed,true);
  if(mode==='wrong-owner')assert.equal(r.code,'C996_NATIVE_TX_OWNER_CHANGED');
  if(mode==='live-old-owner')assert.equal(r.code,'C996_NATIVE_TX_OLD_OWNER_ALIVE');
  if(mode==='hardlink')assert.equal(r.code,'C996_NATIVE_TX_UNSAFE_ENTRY');
 }finally{if(fd!==null)fs.closeSync(fd);clean(f);}
});
test('real Operator TxF CAS: termination after verified CAS rolls back without user finally',{
 skip:process.platform!=='win32',
},()=>{
 const f=create();
 try{
  const beforeId=fs.statSync(path.join(f.source,'owner.json'),{bigint:true}).ino;
  const result=spawnSync(ps,['-NoProfile','-NonInteractive','-Command',build996OwnerTransactionalArchiveFixtureScript()],
   {input:JSON.stringify({...f.input,fixtureTerminateAfterCas:true}),windowsHide:true,encoding:'utf8',timeout:30000,maxBuffer:50000});
  assert.equal(result.error,undefined);assert.equal(result.status,17,result.stderr.slice(-2000));
  assert.equal(result.stdout.trim(),'');preserved(f);
  assert.equal(fs.statSync(path.join(f.source,'owner.json'),{bigint:true}).ino,beforeId);
 }finally{clean(f);}
});

// Sequencing of the actual native mover in disposable C: TEMP only.
// This does not execute the production Operator or authenticate Owner consent.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {build996OwnerTransactionalArchiveFixtureScript,require996OwnerArchiveReceipt}
 from '../tools/controller-996-c-native-owner-operator.mjs';

const ps='C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe';
const sha=b=>createHash('sha256').update(b).digest('hex');
const script=build996OwnerTransactionalArchiveFixtureScript();
function native(input){
 const r=spawnSync(ps,['-NoProfile','-NonInteractive','-Command',script],
  {input:JSON.stringify(input),windowsHide:true,encoding:'utf8',timeout:30000,maxBuffer:50000});
 assert.equal(r.error,undefined);
 return r;
}
function acl(directory){
 const quoted="'"+directory.replaceAll("'","''")+"'";
 const r=spawnSync(ps,['-NoProfile','-NonInteractive','-Command',
  `[Console]::Write([Convert]::ToBase64String([IO.Directory]::GetAccessControl(${quoted}).GetSecurityDescriptorBinaryForm()))`],
  {windowsHide:true,encoding:'utf8',timeout:10000});
 assert.equal(r.error,undefined);assert.equal(r.status,0,r.stderr);
 assert.ok(r.stdout.length>0);return sha(r.stdout);
}
const cases=['success','after-old','kill-continuation','tamper-continuation',
 'after-continuation','kill-install','tamper-install','install-collision'];
for(const mode of cases)test('native three-archive sequence: '+mode,
 {skip:process.platform!=='win32'},()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-996-txf-cas-'));
 assert.equal(path.parse(root).root.toLowerCase(),'c:\\');
 const dead=spawnSync(process.execPath,['-e',''],{windowsHide:true,timeout:10000});
 assert.equal(dead.status,0);assert.ok(dead.pid>0);
 const nonce=randomUUID();
 const entries=[];
 try{
 for(const [index,name] of ['old','continuation','install'].entries()){
  const source=path.join(root,name),destination=path.join(root,name+'-archive');
  fs.mkdirSync(source);
  const bytes=Buffer.from(JSON.stringify({pid:index===1?process.pid:dead.pid,nonce}));
  fs.writeFileSync(path.join(source,'owner.json'),bytes);
  const pins={'owner.json':sha(bytes)};
  if(index===1){
   const ready=Buffer.from(JSON.stringify({finalReleasePending:true,fixtureOnly:true}));
   fs.writeFileSync(path.join(source,'READY_TO_RELEASE_INSTALL.json'),ready);
   pins['READY_TO_RELEASE_INSTALL.json']=sha(ready);
  }
  entries.push({source,destination,bytes,pins,id:fs.statSync(source,{bigint:true}).ino,
   fileId:fs.statSync(path.join(source,'owner.json'),{bigint:true}).ino,
   acl:acl(source),ownerMode:['DEAD_OLD','LIVE_NEW','DEAD_INSTALL'][index]});
 }
 const completed=[];
  for(let index=0;index<entries.length;index++){
   if(mode==='after-old'&&index===1||mode==='after-continuation'&&index===2)break;
   const e=entries[index];
   if(mode==='tamper-continuation'&&index===1||mode==='tamper-install'&&index===2)
    fs.writeFileSync(path.join(e.source,'INJECTED.json'),'unapproved');
   if(mode==='install-collision'&&index===2){
    fs.mkdirSync(e.destination);fs.writeFileSync(path.join(e.destination,'keep.txt'),'PRESERVE');
   }
   const kill=mode==='kill-continuation'&&index===1||mode==='kill-install'&&index===2;
   const r=native({operation:'move',root,source:e.source,destination:e.destination,
    pins:e.pins,ownerMode:e.ownerMode,actorPid:process.pid,nonce,
    ...(kill?{fixtureTerminateAfterCas:true}:{})});
   if(kill){assert.equal(r.status,17,r.stderr);assert.equal(r.stdout.trim(),'');break;}
   assert.equal(r.status,0,r.stderr);
   const receipt=JSON.parse(r.stdout.trim());
   if(!receipt.ok){
    assert.equal(receipt.transactionCommitted,false);
    assert.equal(receipt.commitAttempted,false);
    if(mode.startsWith('tamper-'))assert.equal(receipt.code,'C996_NATIVE_TX_PIN_SET_DRIFT');
    else assert.equal(mode,'install-collision');
    break;
   }
   require996OwnerArchiveReceipt(receipt,e.pins);
   assert.equal(receipt.strategy,'WINDOWS_TXF_CAS_V1');
   assert.equal(receipt.aclPreserved,true);completed.push(index);
  }
  assert.deepEqual(completed,mode==='success'?[0,1,2]:
   ['after-old','kill-continuation','tamper-continuation'].includes(mode)?[0]:[0,1]);
  for(const [index,e] of entries.entries()){
   const moved=completed.includes(index),actual=moved?e.destination:e.source;
   assert.equal(fs.existsSync(e.source),!moved);
   assert.equal(fs.statSync(actual,{bigint:true}).ino,e.id);
   assert.equal(fs.statSync(path.join(actual,'owner.json'),{bigint:true}).ino,e.fileId);
   assert.deepEqual(fs.readFileSync(path.join(actual,'owner.json')),e.bytes);
   assert.equal(acl(actual),e.acl);
  }
  // Every interrupted/failed earlier phase retains the canonical Install Lease.
  assert.equal(fs.existsSync(entries[2].source),mode!=='success');
  if(mode==='install-collision')assert.equal(fs.readFileSync(
   path.join(entries[2].destination,'keep.txt'),'utf8'),'PRESERVE');
 }finally{
  assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir())+path.sep));
  assert.match(path.basename(root),/^zgmini-996-txf-cas-/);
  fs.rmSync(root,{recursive:true});
 }
});

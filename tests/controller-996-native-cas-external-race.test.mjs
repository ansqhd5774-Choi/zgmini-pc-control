import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {spawn} from 'node:child_process';import {createHash,randomUUID} from 'node:crypto';
import {build996OwnerTransactionalArchiveFixtureScript,require996OwnerArchiveReceipt}
 from '../tools/controller-996-c-native-owner-operator.mjs';

test('independent writer cannot insert between verified native CAS and commit',
 {skip:process.platform!=='win32',timeout:30000},async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-996-txf-cas-'));
 assert.equal(path.parse(root).root.toLowerCase(),'c:\\');
 const source=path.join(root,'source'),destination=path.join(root,'archive');fs.mkdirSync(source);
 const nonce=randomUUID(),bytes=Buffer.from(JSON.stringify({pid:process.pid,nonce}));
 fs.writeFileSync(path.join(source,'owner.json'),bytes);
 const attack=path.join(source,'INSERT.json');
 // Positive control on the SAME path and writer before the transaction.
 fs.writeFileSync(attack,'positive');assert.equal(fs.readFileSync(attack,'utf8'),'positive');fs.unlinkSync(attack);
 const pins={'owner.json':createHash('sha256').update(bytes).digest('hex')};
 const child=spawn('C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe',
  ['-NoProfile','-NonInteractive','-Command',build996OwnerTransactionalArchiveFixtureScript()],
  {windowsHide:true,stdio:['pipe','pipe','pipe']});
 let stdout='',stderr='';child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);
 const exited=new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',code=>resolve(code));});
 child.stdin.end(JSON.stringify({operation:'move',root,source,destination,pins,
  ownerMode:'LIVE_NEW',actorPid:process.pid,nonce,fixtureExternalRace:true}));
 try{
  const until=Date.now()+15000;
  while(!fs.existsSync(path.join(root,'race-ready.json'))){
   assert.ok(Date.now()<until,'native CAS handshake timed out: '+stderr);
   await new Promise(r=>setTimeout(r,20));
  }
  let insertionError=null;
  try{fs.writeFileSync(attack,'UNAPPROVED',{flag:'wx'});}catch(e){insertionError=e.code;}
  fs.writeFileSync(path.join(root,'race-done.json'),'done');
  const code=await exited;
  assert.equal(code,0,stderr);
  const receipt=JSON.parse(stdout.trim());
  // If the writer could enter the namespace, a committed receipt is forbidden.
  if(insertionError===null){assert.equal(receipt.transactionCommitted,false);assert.equal(receipt.ok,false);}
  else{
   assert.ok(['EBUSY','EPERM','EACCES','EINVAL','UNKNOWN'].includes(insertionError),insertionError);
   require996OwnerArchiveReceipt(receipt,pins);assert.equal(receipt.transactionCommitted,true);
   assert.deepEqual(fs.readdirSync(destination),['owner.json']);
  }
 }finally{
  fs.writeFileSync(path.join(root,'race-done.json'),'stop');
  await exited;
  assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir())+path.sep));
  fs.rmSync(root,{recursive:true});
 }
});

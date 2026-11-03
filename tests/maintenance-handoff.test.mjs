import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';
import {requireStopped,requireNoReplacement,requireReceiverOrigin,requireNewReceiverOrigin,reserveReceiverSlot,reservationFailureStatus,rollbackStatus}from'../tools/handoff-maintenance.mjs';
import {acquireMaintenanceLock}from'../tools/maintenance-lock.mjs';
const prior={pid:123,nonce:'11111111-2222-3333-4444-555555555555',bootAt:1700000000000};
const installed={sourceSha:'a'.repeat(40),startupSha256:'b'.repeat(64)};
const proof={schema:'ZGMINI_PC_RECEIVER_ORIGIN_V1',pid:123,nonce:prior.nonce,
 bootAt:prior.bootAt,sourceSha:installed.sourceSha,startupSha256:installed.startupSha256,
 created:'20261103072233.123456+540',session:1,sid:'S-1-5-21-123456-789012'};
test('missing, invalid, active and uncertain receiver ownership fail closed',()=>{
 for(const item of [null,undefined,{}, {pid:0,nonce:prior.nonce},{pid:123},
   {...prior,nonce:'../forged'}])assert.throws(()=>requireStopped(item,()=>false),/NOT_PROVEN_STOPPED/);
 assert.doesNotThrow(()=>requireStopped(prior,()=>false));
 for(const value of [true,null])assert.throws(()=>requireStopped(prior,()=>value),/NOT_PROVEN_STOPPED/);
});
test('released original lease is allowed only with a known, stopped prior receiver',()=>{
 assert.doesNotThrow(()=>requireNoReplacement(prior,null));
 assert.doesNotThrow(()=>requireNoReplacement(prior,{pid:prior.pid,nonce:prior.nonce}));
 assert.throws(()=>requireNoReplacement(null,null),/HANDOFF_RECEIVER_CHANGED/);
 assert.throws(()=>requireNoReplacement(prior,{...prior,nonce:'other'}),/HANDOFF_RECEIVER_CHANGED/);
 assert.throws(()=>requireNoReplacement(prior,{pid:456,nonce:prior.nonce}),/HANDOFF_RECEIVER_CHANGED/);
});
test('receiver record and live Windows CAPTURE must match the prior process identity',()=>{
 const capture=`ATTESTED|${proof.created}|${proof.session}|${proof.sid}`;
 assert.doesNotThrow(()=>requireReceiverOrigin(prior,proof,installed));
 assert.doesNotThrow(()=>requireReceiverOrigin(prior,proof,installed,capture+'\r\n'));
 for(const changed of [
   {...proof,pid:456},{...proof,bootAt:0},{...proof,nonce:'other'},
   {...proof,created:'UNKNOWN'},{...proof,session:null},{...proof,sid:''},
   {...proof,sourceSha:'c'.repeat(40)}]){
  assert.throws(()=>requireReceiverOrigin(prior,changed,installed),/ORIGIN_NOT_PROVEN/);
 }
 assert.throws(()=>requireReceiverOrigin(prior,proof,installed,'ATTESTED|reused|1|S-1-5-21'),/ORIGIN_NOT_PROVEN/);
});
test('new receiver PASS requires complete proof, fresh live Windows CAPTURE and stable owner',()=>{
 const current={pid:456,nonce:'88888888-2222-3333-4444-555555555555',bootAt:prior.bootAt};
 const fresh={...proof,pid:current.pid,nonce:current.nonce,
   created:'20261103072301.654321+540'};
 const capture=`ATTESTED|${fresh.created}|${fresh.session}|${fresh.sid}\r\n`;
 const verify=(ownerValue=current,record=fresh,wmi=capture,live=()=>true,previous=prior)=>
  requireNewReceiverOrigin(previous,proof,current,record,installed,wmi,ownerValue,live);
 assert.doesNotThrow(()=>verify());
 for(const changed of [
  {...fresh,created:proof.created},{...fresh,nonce:prior.nonce},
  {...fresh,bootAt:0},{...fresh,sourceSha:'c'.repeat(40)},
  {...fresh,startupSha256:'d'.repeat(64)},{...fresh,sid:'S-1-5-21-999999'}]){
  assert.throws(()=>verify(current,changed),/NOT_PROVEN/);
 }
 for(const wmi of [null,'',`ATTESTED|${proof.created}|${fresh.session}|${fresh.sid}`])
  assert.throws(()=>verify(current,fresh,wmi),/NOT_PROVEN/);
 assert.throws(()=>requireNewReceiverOrigin(prior,proof,current,fresh,installed,
   undefined,current,()=>true),/NOT_PROVEN/);
 for(const currentAfter of [null,{...current,pid:789},{...current,nonce:'changed'}])
  assert.throws(()=>verify(currentAfter),/NOT_PROVEN/);
 for(const status of [false,null])assert.throws(()=>verify(current,fresh,capture,()=>status),/NOT_PROVEN/);
 assert.throws(()=>verify(current,fresh,capture,()=>true,{...prior,nonce:current.nonce}),/NOT_PROVEN/);
});
test('atomic handoff reservation blocks a second receiver until owned release',()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-r6-handoff-'));
 fs.mkdirSync(path.join(temp,'leases'));
 const dir=path.join(temp,'leases','receiver');
 try{
  const reservation=reserveReceiverSlot(dir);
  assert.equal(reservation.owner.pid,process.pid);
  assert.equal(fs.existsSync(path.join(dir,'RECOVERY_REQUIRED.json')),true);
  assert.throws(()=>reserveReceiverSlot(dir),/HANDOFF_RECEIVER_LEASE_BUSY/);
  assert.throws(()=>acquireMaintenanceLock(temp,'receiver'),/MAINTENANCE_LOCK_BUSY_OR_RECOVERY_REQUIRED/);
  assert.doesNotThrow(()=>reservation.verify());
  reservation.release();
  assert.equal(fs.existsSync(dir),false);
  assert.throws(()=>reservation.release(),/HANDOFF_RESERVATION_ALREADY_RELEASED/);
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
test('interrupted handoff reservation remains unreclaimable after owner exits',()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-r6-handoff-'));
 fs.mkdirSync(path.join(temp,'leases'));
 const dir=path.join(temp,'leases','receiver');
 try{
  fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir,'owner.json'),JSON.stringify({pid:2147483647,nonce:'dead-owner'})+'\n');
  fs.writeFileSync(path.join(dir,'RECOVERY_REQUIRED.json'),'recovery required\n');
  assert.throws(()=>acquireMaintenanceLock(temp,'receiver'),/MAINTENANCE_LOCK_BUSY_OR_RECOVERY_REQUIRED/);
  assert.equal(fs.existsSync(path.join(dir,'RECOVERY_REQUIRED.json')),true);
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
test('partial reservation write failure remains RECOVERY_REQUIRED, never ROLLED_BACK',()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-r6-handoff-'));
 const dir=path.join(temp,'receiver');
 try{
  const failingIo=Object.create(fs);
  failingIo.writeFileSync=(file,...args)=>{
   if(String(file).endsWith('owner.json'))throw Object.assign(Error('simulated-write-fail'),{code:'EIO'});
   return fs.writeFileSync(file,...args);
  };
  let error=null;
  try{reserveReceiverSlot(dir,failingIo);}catch(e){error=e;}
  assert.equal(error?.code,'HANDOFF_RESERVATION_INCOMPLETE');
  assert.equal(reservationFailureStatus(error),'RECOVERY_REQUIRED');
  assert.equal(fs.existsSync(path.join(dir,'RECOVERY_REQUIRED.json')),true);
  assert.equal(fs.existsSync(path.join(dir,'owner.json')),false);
  assert.throws(()=>reserveReceiverSlot(dir),/HANDOFF_RECEIVER_LEASE_BUSY/);
  assert.equal(reservationFailureStatus({code:'HANDOFF_RECEIVER_LEASE_BUSY'}),'BLOCKED');
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
test('reservation owner drift blocks release and retains recovery marker',()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-r6-handoff-'));
 const dir=path.join(temp,'receiver');
 try{
  const reservation=reserveReceiverSlot(dir);
  const file=path.join(dir,'owner.json');
  fs.writeFileSync(file,JSON.stringify({...reservation.owner,nonce:'external-owner'})+'\n');
  assert.throws(()=>reservation.verify(),/HANDOFF_RESERVATION_LOST/);
  assert.throws(()=>reservation.release(),/HANDOFF_RESERVATION_LOST/);
  assert.equal(fs.existsSync(path.join(dir,'RECOVERY_REQUIRED.json')),true);
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
test('pre-existing receiver lease must never be overwritten',()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-r6-handoff-'));
 const dir=path.join(temp,'receiver');
 try{
  fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir,'owner.json'),'existing owner proof\n');
  assert.throws(()=>reserveReceiverSlot(dir),/HANDOFF_RECEIVER_LEASE_BUSY/);
  assert.equal(fs.readFileSync(path.join(dir,'owner.json'),'utf8'),'existing owner proof\n');
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
test('restored files without reattested receiver are RECOVERY_REQUIRED',()=>{
 assert.equal(rollbackStatus({filesRestored:true,receiverReattested:false}),'RECOVERY_REQUIRED');
 assert.equal(rollbackStatus({filesRestored:false,receiverReattested:true}),'RECOVERY_REQUIRED');
 assert.equal(rollbackStatus({filesRestored:false,receiverReattested:false}),'RECOVERY_REQUIRED');
 assert.equal(rollbackStatus({filesRestored:true,receiverReattested:true}),'ROLLED_BACK');
});

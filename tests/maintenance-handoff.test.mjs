import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';
import {execFileSync}from'node:child_process';
import {requireHandoffCheckoutScope,requireStopped,requireNoReplacement,requireReceiverOrigin,requireNewReceiverOrigin,requireCurrentReceiverIdentity,reserveReceiverSlot,reservationFailureStatus,rollbackStatus,requireInstalledHandoffFiles,restorePriorHandoffFiles}from'../tools/handoff-maintenance.mjs';
import {acquireMaintenanceLock}from'../tools/maintenance-lock.mjs';
test('handoff ignores unrelated checkout edits, still denies executable and approval edits',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-handoff-scope-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const git=args=>execFileSync('git',args,{cwd:dir});
 const target='f'.repeat(40);
 const source=['maintenance-contract.mjs','maintenance-apply.mjs','maintenance-agent.mjs',
   'maintenance-lock.mjs','update.mjs','maintenance-ancestry.vbs',
    'maintenance-admission-queue.mjs','bootstrap-maintenance.mjs','handoff-maintenance.mjs'].map(name=>'tools/'+name);
 const approval=`approvals/maintenance-handoffs/${target}.json`;
 const unrelated=['docs/work-in-progress.md','results/maintenance-result.txt'];
 for(const rel of [...source,approval,...unrelated]){
   const file=path.join(dir,rel);fs.mkdirSync(path.dirname(file),{recursive:true});
   fs.writeFileSync(file,'approved bytes\n');
 }
 git(['init','-q']);git(['add','--',...source,approval,...unrelated]);
 git(['-c','user.name=Test','-c','user.email=test@example.invalid','commit','-qm','fixture']);
 for(const rel of unrelated){
   const file=path.join(dir,rel);fs.mkdirSync(path.dirname(file),{recursive:true});
   fs.writeFileSync(file,'unrelated local edit\n');
 }
 assert.doesNotThrow(()=>requireHandoffCheckoutScope(target,git));
 fs.writeFileSync(path.join(dir,source[0]),'modified execution source\n');
 assert.throws(()=>requireHandoffCheckoutScope(target,git),/HANDOFF_CHECKOUT_DIRTY/);
 fs.writeFileSync(path.join(dir,source[0]),'approved bytes\n');
 fs.writeFileSync(path.join(dir,approval),'tampered approval\n');
 assert.throws(()=>requireHandoffCheckoutScope(target,git),/HANDOFF_CHECKOUT_DIRTY/);
 assert.throws(()=>requireHandoffCheckoutScope('../bad',git),/HANDOFF_PIN_REQUIRED/);
});
const prior={pid:123,nonce:'11111111-2222-3333-4444-555555555555',bootAt:1700000000000};
const installed={sourceSha:'a'.repeat(40),startupSha256:'b'.repeat(64)};
const proof={schema:'ZGMINI_PC_RECEIVER_ORIGIN_V1',pid:123,nonce:prior.nonce,
 bootAt:prior.bootAt,sourceSha:installed.sourceSha,startupSha256:installed.startupSha256,
 created:'20261103072233.123456+540',session:1,sid:'S-1-5-21-123456-789012'};
test('existing receiver uses captured origin plus exact current identity without rewalking retired parent',()=>{
 const identity=`IDENTIFIED|${proof.created}|${proof.session}|${proof.sid}`;
 assert.doesNotThrow(()=>requireCurrentReceiverIdentity(prior,proof,installed,identity));
 for(const bad of ['UNKNOWN',identity.replace('.123456','.123457'),identity.replace('|1|','|2|'),identity.replace(proof.sid,'S-1-5-21-999')])
  assert.throws(()=>requireCurrentReceiverIdentity(prior,proof,installed,bad),/HANDOFF_RECEIVER_IDENTITY_NOT_PROVEN/);
 assert.throws(()=>requireCurrentReceiverIdentity(prior,null,installed,identity),/HANDOFF_RECEIVER_ORIGIN_NOT_PROVEN/);
});
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
const oldSix=['maintenance-contract.mjs','maintenance-apply.mjs','maintenance-agent.mjs',
 'maintenance-lock.mjs','update.mjs','maintenance-ancestry.vbs'].map(name=>'tools/'+name);
const newSeven=[...oldSix,'tools/maintenance-admission-queue.mjs'];
const manifestOf=names=>({files:Object.fromEntries(names.map(name=>[name,'a'.repeat(64)]))});
test('old six and target seven are exact separate handoff sets',()=>{
 assert.deepEqual(requireInstalledHandoffFiles(manifestOf(oldSix)),oldSix);
 assert.deepEqual(requireInstalledHandoffFiles(manifestOf(newSeven)),newSeven);
 for(const invalid of [[],oldSix.slice(1),[...oldSix,'tools/unknown.mjs'],
   [...newSeven,'tools/unknown.mjs']])
  assert.throws(()=>requireInstalledHandoffFiles(manifestOf(invalid)),/HANDOFF_INSTALLED_FILE_SET_INVALID/);
});
test('old six to target seven rollback restores only prior files and removes the newly added adapter',t=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-six-seven-'));
 t.after(()=>fs.rmSync(temp,{recursive:true,force:true}));
 const root=path.join(temp,'installed'),backup=path.join(temp,'backup');
 for(const rel of [...newSeven,'MAINTENANCE_INSTALL.json']){
  for(const base of [root,backup])fs.mkdirSync(path.dirname(path.join(base,rel)),{recursive:true});
  if(oldSix.includes(rel)||rel==='MAINTENANCE_INSTALL.json'){
   fs.writeFileSync(path.join(backup,rel),`approved-${rel}`);
   fs.writeFileSync(path.join(root,rel),`new-${rel}`);
  }else fs.writeFileSync(path.join(root,rel),'partially installed new adapter');
 }
 restorePriorHandoffFiles(root,backup,oldSix);
 for(const rel of [...oldSix,'MAINTENANCE_INSTALL.json'])
  assert.equal(fs.readFileSync(path.join(root,rel),'utf8'),`approved-${rel}`);
 assert.equal(fs.existsSync(path.join(root,newSeven.at(-1))),false);
});
test('seven to seven rollback retains exact seven-file prior install',t=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-seven-seven-'));
 t.after(()=>fs.rmSync(temp,{recursive:true,force:true}));
 const root=path.join(temp,'installed'),backup=path.join(temp,'backup');
 for(const rel of [...newSeven,'MAINTENANCE_INSTALL.json']){
  for(const base of [root,backup])fs.mkdirSync(path.dirname(path.join(base,rel)),{recursive:true});
  fs.writeFileSync(path.join(backup,rel),`prior-${rel}`);
  fs.writeFileSync(path.join(root,rel),`later-${rel}`);
 }
 restorePriorHandoffFiles(root,backup,newSeven);
 for(const rel of [...newSeven,'MAINTENANCE_INSTALL.json'])
  assert.equal(fs.readFileSync(path.join(root,rel),'utf8'),`prior-${rel}`);
});
test('simulated rollback copy failure is surfaced, never silently marked complete',t=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-six-seven-fail-'));
 t.after(()=>fs.rmSync(temp,{recursive:true,force:true}));
 const root=path.join(temp,'installed'),backup=path.join(temp,'backup');
 const failingIo={...fs,copyFileSync(){throw Error('simulated-restore-failure');}};
 assert.throws(()=>restorePriorHandoffFiles(root,backup,oldSix,failingIo),/simulated-restore-failure/);
 assert.equal(rollbackStatus({filesRestored:false,receiverReattested:false}),'RECOVERY_REQUIRED');
});


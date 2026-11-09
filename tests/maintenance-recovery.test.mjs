import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {createHash} from 'node:crypto';
import {classifyRecovery,archiveUntouched,inspectEvidenceFile,
 verifyMaintenanceManifest as recoveryInventory} from '../tools/maintenance-recovery.mjs';
import {verifyMaintenanceManifest as statusInventory} from '../tools/automation-status.mjs';
const sha='a'.repeat(40),id='pc-update-recovery-fixture';
test('inspection distinguishes missing evidence, unreadable evidence and malformed JSON without exposing paths',()=>{
 const file='E:/private/secret.json';
 const attempt=(label,read)=>()=>inspectEvidenceFile(file,label,read);
 const missing=Object.assign(new Error('private path'),{code:'ENOENT'});
 const forbidden=Object.assign(new Error('private path'),{code:'EACCES'});
 assert.throws(attempt('RECOVERY_REQUEST_LEDGER',()=>{throw missing;}),{code:'RECOVERY_REQUEST_LEDGER_MISSING'});
 assert.throws(attempt('RECOVERY_INSTALL_OWNER',()=>{throw forbidden;}),{code:'RECOVERY_INSTALL_OWNER_UNREADABLE'});
 assert.throws(attempt('RECOVERY_INSTALL_MARKER',()=>Buffer.from('{oops')),{code:'RECOVERY_INSTALL_MARKER_INVALID_JSON'});
 const value=inspectEvidenceFile(file,'RECOVERY_REQUEST_LEDGER',()=>Buffer.from('{"status":"RECOVERY_REQUIRED"}'));
 assert.equal(value.value.status,'RECOVERY_REQUIRED');
 for(const run of [attempt('RECOVERY_REQUEST_LEDGER',()=>{throw missing;}),
  attempt('RECOVERY_INSTALL_OWNER',()=>{throw forbidden;}),
  attempt('RECOVERY_INSTALL_MARKER',()=>Buffer.from('{oops'))]){
  try{run();assert.fail('must fail closed');}catch(e){
   assert.equal(e.message.includes('E:/private'),false);
  }
 }
});
const state=()=>({identityVerified:true,ownerAlive:false,
 ledger:{status:'RECOVERY_REQUIRED',phase:'RECOVERY_REQUIRED',firstFail:'RECEIVED',installedShaBefore:sha,intakePaused:false,workflowEnabled:true},
 actualSha:sha,controllerVerified:true,maintenanceVerified:true,backupExists:false,backlogExists:false,
 workflow:'active',runnerSetVerified:true,runnersIdle:true,otherLeaseCount:0});
test('status and recovery verify both pre-handoff six and post-handoff seven exact runtime files',()=>{
 const original=['tools/maintenance-contract.mjs','tools/maintenance-apply.mjs',
  'tools/maintenance-agent.mjs','tools/maintenance-lock.mjs',
  'tools/update.mjs','tools/maintenance-ancestry.vbs'];
 const next=[...original,'tools/source-bundle-register.mjs'];
 const data=Object.fromEntries([...next,'tools/unapproved.mjs'].map(p=>[p,Buffer.from(p)]));
 const oldSha='4f076a0228f8ba9598e85b7d0f64f161b6b7c8a4';
 const targetSha='f'.repeat(40);
 const manifest=(files,sourceSha=files.length===original.length?oldSha:targetSha)=>({
  schema:'ZGMINI_PC_MAINTENANCE_INSTALL_V1',sourceSha,files:Object.fromEntries(
  files.map(p=>[p,createHash('sha256').update(data[p]).digest('hex')]))});
 const readBytes=p=>data[path.relative('/fixture',p)];
 for(const validate of [recoveryInventory,statusInventory]){
  assert.equal(validate(manifest(original),'/fixture',readBytes),true);
  assert.equal(validate(manifest(next),'/fixture',readBytes),true);
  assert.equal(validate(manifest(original,targetSha),'/fixture',readBytes),false);
  assert.equal(validate(manifest([...original,'tools/unapproved.mjs']),'/fixture',readBytes),false);
  assert.equal(validate(manifest([...next,'tools/unapproved.mjs']),'/fixture',readBytes),false);
  const changed=manifest(next);changed.files['tools/update.mjs']='0'.repeat(64);
  assert.equal(validate(changed,'/fixture',readBytes),false);
  const missing=manifest(next);delete missing.files['tools/source-bundle-register.mjs'];
  missing.files['tools/unapproved.mjs']='0'.repeat(64);
  assert.equal(validate(missing,'/fixture',readBytes),false);
 }
});
function fixture(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-recovery-'));
 fs.mkdirSync(path.join(root,'leases/controller-install'),{recursive:true});fs.mkdirSync(path.join(root,'ledger'));
 const ownerBytes=Buffer.from(JSON.stringify({pid:123,nonce:'fixture'}));
 const markerBytes=Buffer.from(JSON.stringify({nonce:'fixture'})),ledgerBytes=Buffer.from(JSON.stringify(state().ledger));
 fs.writeFileSync(path.join(root,'leases/controller-install/owner.json'),ownerBytes);
 fs.writeFileSync(path.join(root,'leases/controller-install/RECOVERY_REQUIRED.json'),markerBytes);
 fs.writeFileSync(path.join(root,'ledger',id+'.json'),ledgerBytes);
 return {root,requestId:id,ownerBytes,markerBytes,ledgerBytes,observe:state,isAlive:()=>false};
}
test('only proven untouched prevalidation failure is eligible',()=>assert.equal(classifyRecovery(state()).status,'ABORT_UNTOUCHED_ELIGIBLE'));
for(const [name,change] of Object.entries({liveOwner:s=>s.ownerAlive=true,unknownOwner:s=>s.ownerAlive=null,
 switched:s=>s.ledger.firstFail='SWITCHED',staged:s=>s.backupExists=true,paused:s=>s.backlogExists=true,
 changedController:s=>s.actualSha='b'.repeat(40),missingBytes:s=>s.controllerVerified=false,
 missingMaintainer:s=>s.maintenanceVerified=false,workflowUnknown:s=>s.workflow=null,busy:s=>s.runnersIdle=false,
 otherLease:s=>s.otherLeaseCount=1,badIdentity:s=>s.identityVerified=false,
 postcheck:s=>s.ledger.postIssueNumber=5}))test('fails closed: '+name,()=>{
 const s=state();change(s);assert.equal(classifyRecovery(s).status,'RECOVERY_REQUIRED');
});
test('archive preserves original journal and complete lease; never retries',()=>{
 const f=fixture();try{
  const r=archiveUntouched(f);assert.equal(r.status,'ABORTED_UNTOUCHED');
  assert.equal(r.originalRequestRetried,false);assert.equal(r.controllerChanged,false);
  assert.deepEqual(fs.readFileSync(path.join(f.root,'ledger',id+'.json')),f.ledgerBytes);
  assert.deepEqual(fs.readFileSync(path.join(f.root,'recovery',r.archiveName,'owner.json')),f.ownerBytes);
  assert.equal(fs.existsSync(path.join(f.root,'leases/controller-install')),false);
 }finally{fs.rmSync(f.root,{recursive:true,force:true});}
});
test('changed nonce or journal never archives another owner',()=>{
 const f=fixture();try{
  fs.writeFileSync(path.join(f.root,'leases/controller-install/owner.json'),'{}');
  assert.throws(()=>archiveUntouched(f),{code:'RECOVERY_EVIDENCE_CHANGED'});
  assert.ok(fs.existsSync(path.join(f.root,'leases/controller-install')));
 }finally{fs.rmSync(f.root,{recursive:true,force:true});}
});
test('owner liveness rechecked after fresh observation',()=>{
 const f=fixture();try{
  let n=0;f.isAlive=()=>++n===1?false:true;
  assert.throws(()=>archiveUntouched(f),{code:'RECOVERY_OWNER_NOT_DEAD'});
  assert.ok(fs.existsSync(path.join(f.root,'leases/controller-install')));
 }finally{fs.rmSync(f.root,{recursive:true,force:true});}
});
test('second recovery cannot compete for single reservation',()=>{
 const f=fixture();try{
  fs.mkdirSync(path.join(f.root,'leases/controller-recovery'));
  assert.throws(()=>archiveUntouched(f),{code:'EEXIST'});
  assert.ok(fs.existsSync(path.join(f.root,'leases/controller-install')));
 }finally{fs.rmSync(f.root,{recursive:true,force:true});}
});


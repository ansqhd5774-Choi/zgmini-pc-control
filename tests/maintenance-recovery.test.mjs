import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {classifyRecovery,archiveUntouched} from '../tools/maintenance-recovery.mjs';
const sha='a'.repeat(40),id='pc-update-recovery-fixture';
const state=()=>({identityVerified:true,ownerAlive:false,
 ledger:{status:'RECOVERY_REQUIRED',phase:'RECOVERY_REQUIRED',firstFail:'RECEIVED',installedShaBefore:sha,intakePaused:false,workflowEnabled:true},
 actualSha:sha,controllerVerified:true,maintenanceVerified:true,backupExists:false,backlogExists:false,
 workflow:'active',runnerSetVerified:true,runnersIdle:true,otherLeaseCount:0});
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

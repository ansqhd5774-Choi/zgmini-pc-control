import test from 'node:test';import assert from 'node:assert/strict';
import {summarizeAutomation} from '../tools/automation-status.mjs';
const healthy=()=>({installLock:{held:false},actualControllerSha:'a'.repeat(40),
 controllerFilesVerified:true,supervisorAlive:true,supervisorIdentityVerified:true,
 supervisorFresh:true,supervisorChildrenVerified:true,runnerSetOnline:true,workflowState:'active',installedOperations:['core-status']});

test('online runners without six owned supervisor children are not healthy',()=>{
 assert.equal(summarizeAutomation({...healthy(),supervisorChildrenVerified:false}).runtimeState,'UNVERIFIED');
});
test('healthy Runtime does not claim chat request submission permission',()=>{
 const r=summarizeAutomation(healthy());assert.equal(r.runtimeState,'HEALTHY');
 assert.equal(r.intakeToolPermission,'NOT_TESTED_BY_PC_STATUS');assert.equal(r.updateSuccessProven,false);
});
test('healthy Controller with dead maintainer is not healthy whole automation',()=>{
 const r=summarizeAutomation(healthy());assert.equal(r.controllerState,'HEALTHY');
 assert.equal(r.maintenanceState,'UNVERIFIED');assert.equal(r.automationState,'PARTIAL_OR_UNVERIFIED');
 const full=summarizeAutomation({...healthy(),maintenanceFilesVerified:true,receiverIdentityVerified:true,receiverFresh:true,receiverListening:true});
 assert.equal(full.automationState,'HEALTHY');
 assert.equal(summarizeAutomation({...healthy(),maintenanceFilesVerified:true,receiverIdentityVerified:true,receiverFresh:false,receiverListening:true}).maintenanceState,'UNVERIFIED');
});
test('historical recovery journal without live lock does not block all work',()=>{
 const r=summarizeAutomation({...healthy(),ledger:{status:'RECOVERY_REQUIRED'}});
 assert.equal(r.state,'NO_ACTIVE_INSTALL_LEASE');assert.equal(r.blockScope,'NONE_FROM_INSTALL_LEASE');
 assert.equal(r.next,'REUSE_ARCHIVE_EVIDENCE_AND_VERIFY_CURRENT_RUNTIME');
});
test('active recovery blocks shared install only',()=>{
 const r=summarizeAutomation({...healthy(),installLock:{held:true,recoveryRequired:true}});
 assert.equal(r.state,'RECOVERY_REQUIRED');assert.equal(r.blockScope,'SHARED_INSTALL_ONLY');
});
test('ordinary active lease waits for current owner',()=>{
 const r=summarizeAutomation({...healthy(),installLock:{held:true,recoveryRequired:false}});
 assert.equal(r.state,'INSTALL_LEASE_HELD');assert.equal(r.next,'OBSERVE_EXISTING_OWNER_NO_DUPLICATE_REQUEST');
});
for(const key of ['controllerFilesVerified','supervisorAlive','supervisorIdentityVerified','supervisorFresh','runnerSetOnline'])
 test('unverified '+key+' cannot be healthy',()=>assert.equal(summarizeAutomation({...healthy(),[key]:false}).runtimeState,'UNVERIFIED'));
test('unreadable lease fails closed but does not claim Runtime failure',()=>{
 const r=summarizeAutomation({...healthy(),lockReadbackCode:'UNAVAILABLE'});
 assert.equal(r.state,'STATE_UNKNOWN');assert.equal(r.runtimeState,'HEALTHY');
});

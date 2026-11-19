import test from 'node:test';import assert from 'node:assert/strict';
import {summarizeAutomation,dedicatedPcRunnersOnline,classifyRunnerQueryError,safeRuntimeSignals} from '../tools/automation-status.mjs';
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

const operatingSeats=()=>Array.from({length:6},(_,i)=>({
 name:'zgmini-pc-0'+(i+1),status:'online',busy:false,
}));
test('automation status accepts six operating seats plus an independent handoff runner',()=>{
 assert.equal(dedicatedPcRunnersOnline([
  ...operatingSeats(),{name:'zgmini-handoff-ci-spare-01',status:'online',busy:true},
 ]),true);
});
test('automation status rejects missing, offline or duplicated operating seats',()=>{
 const seats=operatingSeats();
 assert.equal(dedicatedPcRunnersOnline(seats.slice(0,5)),false);
 assert.equal(dedicatedPcRunnersOnline([...seats.slice(0,2),{...seats[2],status:'offline'},...seats.slice(3)]),false);
 assert.equal(dedicatedPcRunnersOnline([...seats,{...seats[0]}]),false);
 assert.equal(dedicatedPcRunnersOnline(null),false);
});
test('runner API permission failures are distinct from offline runner status',()=>{
 assert.equal(classifyRunnerQueryError({stderr:Buffer.from('gh: Forbidden (HTTP 403)\nsecret token')}),'HTTP_403_FORBIDDEN');
 assert.equal(classifyRunnerQueryError({stderr:Buffer.from('HTTP 404')}),'HTTP_404_NOT_FOUND');
 assert.equal(classifyRunnerQueryError({code:'ETIMEDOUT'}),'REQUEST_TIMEOUT');
 assert.equal(classifyRunnerQueryError({message:'sensitive-data should never leak'}),'RUNNER_QUERY_ERROR_OTHER');
 const v=safeRuntimeSignals({...healthy(),runnerSetOnline:null});
 assert.equal(v.runnerSetOnline,null);
 assert.equal(summarizeAutomation({...healthy(),runnerSetOnline:null}).runtimeState,'UNVERIFIED');
});

test('403 runner roster permission is scoped, not a controller local outage or an all-six PASS',()=>{
 const r=summarizeAutomation({...healthy(),runnerSetOnline:null,
  runnerQueryError:'HTTP_403_FORBIDDEN',maintenanceFilesVerified:true,
  receiverIdentityVerified:true,receiverFresh:true,receiverListening:true});
 assert.equal(r.localControllerState,'HEALTHY');
 assert.equal(r.runnerRegistryState,'UNVERIFIED');
 assert.equal(r.runtimeState,'UNVERIFIED');
 assert.equal(r.automationState,'PARTIAL_OR_UNVERIFIED');
 assert.equal(r.next,'CHECK_GITHUB_RUNNER_ROSTER_READ_PERMISSION');
 assert.equal(r.blockScope,'NONE_FROM_INSTALL_LEASE');
});
test('missing, offline and unrelated runner errors retain scoped diagnosis',()=>{
 for(const runnerSetOnline of [false,null]){
  const r=summarizeAutomation({...healthy(),runnerSetOnline,
   runnerQueryError:'REQUEST_TIMEOUT'});
  assert.equal(r.next,'DIAGNOSE_CURRENT_RUNTIME_WITHOUT_REPLAYING_OLD_UPDATE');
  assert.equal(r.runtimeState,'UNVERIFIED');
 }
 const a=summarizeAutomation({...healthy(),runnerSetOnline:null,
  runnerQueryError:'HTTP_403_FORBIDDEN',supervisorFresh:false});
 assert.equal(a.localControllerState,'UNVERIFIED');
 assert.equal(a.next,'DIAGNOSE_CURRENT_RUNTIME_WITHOUT_REPLAYING_OLD_UPDATE');
 const blocked=summarizeAutomation({...healthy(),runnerSetOnline:null,
  runnerQueryError:'HTTP_403_FORBIDDEN',installLock:{held:true,recoveryRequired:true}});
 assert.equal(blocked.state,'RECOVERY_REQUIRED');
 assert.equal(blocked.next,'USE_CONTROLLER_RECOVERY_RUNBOOK');
});

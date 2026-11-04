import test from 'node:test';
import assert from 'node:assert/strict';
import {applyApprovedUpdate,maintenanceCliFailureReport} from '../tools/maintenance-apply.mjs';

const installed='c'.repeat(40), target='b'.repeat(40);
const request={requestId:'pc-update-failure-metadata-test',installedSha:installed,targetSha:target};

function fixture(overrides={}){
 const history=new Map();let current=installed,paused=false,oldRunning=true;
 const port={
  fingerprint:x=>JSON.stringify(x),read:async id=>history.get(id),
  persist:async x=>history.set(x.requestId,structuredClone(x)),
  inspect:async()=>({installedSha:current,insideRunnerTree:false,githubActions:false}),
  validate:async()=>{},stage:async()=>{},
  pauseIntake:async()=>{paused=true;},waitForDrain:async()=>{},backup:async()=>{},
  stopOwnSupervisor:async()=>{oldRunning=false;},switchVersion:async()=>{current=target;},
  reconnect:async()=>{},resumeIntake:async()=>{paused=false;},reconcileBacklog:async()=>{},
  postcheck:async()=>({status:'PASS',actualExecutionSha:target,
    protectedStateUnchanged:true,runnerSetVerified:true,postSourceVerified:true}),
  verifyPrevious:async()=>current===installed&&oldRunning,
  verifyBackup:async()=>true,restore:async()=>{current=installed;},
  reconnectPrevious:async()=>{oldRunning=true;},
  inspectAfterUncertain:async()=>({actualControllerSha:current,workflowState:paused?'disabled_manually':'active'}),
  ...overrides
 };
 return {port,history};
}
function six(r){
 for(const name of ['phase','failureOperation','code','mutationStarted','affectedScope','nextAction']){
  assert.ok(Object.hasOwn(r,name),name+' missing');
 }
 assert.ok(typeof r.mutationStarted==='boolean'||r.mutationStarted===null);
 assert.match(r.affectedScope,/^[A-Z_]+$/);
 assert.match(r.nextAction,/^[A-Z_]+$/);
}

test('verified untouched prevalidation has exact failure phase, no mutation and request-only impact',async()=>{
 const f=fixture({validate:async()=>{throw Object.assign(Error('never leak private path'),{code:'ENOSPC'});},
  verifyPrevalidationUntouched:async()=>true});
 const r=await applyApprovedUpdate(request,f.port);six(r);
 assert.equal(r.status,'BLOCKED');assert.equal(r.firstFail,'RECEIVED');
 assert.equal(r.failureOperation,'validate');assert.equal(r.code,'UPDATE_VALIDATE_ENOSPC');
 assert.equal(r.mutationStarted,false);assert.equal(r.affectedScope,'REQUEST_ONLY');
 assert.ok(!JSON.stringify(r).includes('private path'));
});
test('partial staging is not called untouched even with the original Controller alive',async()=>{
 const f=fixture({stage:async()=>{throw Object.assign(Error('private'),{code:'ENOSPC'});}});
 const r=await applyApprovedUpdate(request,f.port);six(r);
 assert.equal(r.status,'RECOVERY_REQUIRED');assert.equal(r.firstFail,'VALIDATED');
 assert.equal(r.failureOperation,'stage');assert.equal(r.mutationStarted,true);
 assert.equal(r.affectedScope,'INSTALL_STAGING');
});
test('unconfirmed intake change is not misclassified as request-only',async()=>{
 const f=fixture({pauseIntake:async()=>{throw Object.assign(Error('unknown ack'),{code:'WORKFLOW_ACK_TIMEOUT'});},
  inspectAfterUncertain:async()=>({actualControllerSha:installed,workflowState:'disabled_manually'}),
  resumeIntake:async()=>{throw Error('cannot safely re-enable');}});
 const r=await applyApprovedUpdate(request,f.port);six(r);
 assert.equal(r.status,'RECOVERY_REQUIRED');assert.equal(r.mutationStarted,true);
 assert.equal(r.affectedScope,'SHARED_INTAKE');
});
test('uncertain postcheck preserves next/nextAction and precludes blind retries',async()=>{
 const f=fixture({postcheck:async()=>{throw Object.assign(Error('network'),{code:'POSTCHECK_OUTCOME_UNKNOWN'});}});
 const r=await applyApprovedUpdate(request,f.port);six(r);
 assert.equal(r.status,'RECOVERY_REQUIRED');assert.equal(r.mutationStarted,true);
 assert.equal(r.affectedScope,'CONTROLLER_RUNTIME_AND_INTAKE');
 assert.equal(r.nextAction,r.next);
 assert.equal(r.nextAction,'RECONCILE_POSTCHECK_AND_ACTUAL_INSTALL_BEFORE_ANY_RETRY');
});
test('verified rollback still reports affected runtime, not no-effect',async()=>{
 const f=fixture({reconnect:async()=>{throw Object.assign(Error('closed'),{code:'SIX_RECONNECT_FAILED'});}});
 const r=await applyApprovedUpdate(request,f.port);six(r);
 assert.equal(r.status,'ROLLED_BACK');assert.equal(r.mutationStarted,true);
 assert.equal(r.affectedScope,'CONTROLLER_RUNTIME_AND_INTAKE');
});
test('ambiguous interrupted prior ledger does not retry and labels risk conservatively',async()=>{
 const f=fixture();f.history.set(request.requestId,{requestId:request.requestId,
  fingerprint:f.port.fingerprint(request),phase:'SWITCHED',status:'RUNNING'});
 const r=await applyApprovedUpdate(request,f.port);six(r);
 assert.equal(r.status,'RECOVERY_REQUIRED');assert.equal(r.mutationStarted,true);
 assert.equal(r.affectedScope,'CONTROLLER_STATE_UNVERIFIED');
});
test('pre-install CLI errors identify failing read without revealing system paths',()=>{
 const r=maintenanceCliFailureReport({code:'ENOENT',failureStage:'PRE_INSTALL',
  failureOperation:'capturePrevalidationBaseline',message:'secret system path'});
 six(r);assert.equal(r.status,'AUTOMATION_BLOCKED');
 assert.equal(r.mutationStarted,false);assert.equal(r.affectedScope,'REQUEST_ONLY');
 assert.equal(r.failureOperation,'capturePrevalidationBaseline');
 assert.ok(!JSON.stringify(r).includes('secret'));
});
test('unclassified CLI failure cannot claim mutation did not occur',()=>{
 const r=maintenanceCliFailureReport({code:'EACCES',message:'private path'});
 six(r);assert.equal(r.mutationStarted,null);
 assert.equal(r.phase,'UNVERIFIED');assert.equal(r.affectedScope,'CONTROLLER_STATE_UNVERIFIED');
 assert.equal(r.failureOperation,'unverified');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {applyApprovedUpdate} from '../tools/maintenance-apply.mjs';

const previous='c'.repeat(40), target='b'.repeat(40);
const request={requestId:'pc-update-simulation-0001',installedSha:previous,targetSha:target};
function fixture(overrides={}) {
  const events=[],records=new Map();let installed=previous,paused=false,oldRunning=true;
  const port={
    fingerprint:x=>JSON.stringify(x),
    read:async id=>records.get(id),
    persist:async x=>{records.set(x.requestId,structuredClone(x));events.push('ledger:'+x.phase);},
    inspect:async()=>({installedSha:installed,insideRunnerTree:false,githubActions:false}),
    validate:async()=>events.push('validate'),stage:async()=>events.push('stage'),
    pauseIntake:async()=>{paused=true;events.push('pause');},
    waitForDrain:async()=>events.push('drain'),backup:async()=>events.push('backup'),
    stopOwnSupervisor:async()=>{oldRunning=false;events.push('stop');},
    switchVersion:async()=>{installed=target;events.push('switch');},
    reconnect:async()=>events.push('reconnect'),
    resumeIntake:async()=>{paused=false;events.push('resume');},
    reconcileBacklog:async()=>events.push('replay-missed-issues'),
    postcheck:async()=>({status:'PASS',actualExecutionSha:target}),
    verifyPrevious:async()=>installed===previous&&oldRunning,
    verifyBackup:async()=>true,
    restore:async()=>{installed=previous;events.push('restore');},
    reconnectPrevious:async()=>{oldRunning=true;events.push('reconnectPrevious');},
    inspectAfterUncertain:async()=>({installedSha:installed}),
    ...overrides
  };
  return {port,events,records,get installed(){return installed;},get paused(){return paused;}};
}

test('approved out-of-process update waits for drain and verifies actual new SHA',async()=>{
 const f=fixture(),r=await applyApprovedUpdate(request,f.port);
 assert.equal(r.status,'PASS');assert.equal(r.actualInstalledSha,target);assert.equal(f.paused,false);
 assert.ok(f.events.indexOf('drain')<f.events.indexOf('stop'));
 assert.ok(f.events.indexOf('backup')<f.events.indexOf('switch'));
 assert.ok(f.events.indexOf('reconnect')<f.events.indexOf('resume'));
 assert.ok(f.events.indexOf('resume')<f.events.indexOf('replay-missed-issues'));
});
test('same requestId returns stored evidence and never installs twice',async()=>{
 const f=fixture();await applyApprovedUpdate(request,f.port);const previousEvents=f.events.length;
 const r=await applyApprovedUpdate(request,f.port);assert.equal(r.reused,true);assert.equal(f.events.length,previousEvents);
});
test('different body on same requestId is refused',async()=>{
 const f=fixture();await applyApprovedUpdate(request,f.port);
 await assert.rejects(applyApprovedUpdate({...request,targetSha:'d'.repeat(40)},f.port),{code:'REQUEST_ID_REUSED_WITH_DIFFERENT_BODY'});
});
test('stale installed SHA blocks before staging',async()=>{
 const f=fixture({inspect:async()=>({installedSha:'a'.repeat(40)})});const r=await applyApprovedUpdate(request,f.port);
 assert.equal(r.status,'BLOCKED');assert.equal(r.code,'INSTALLED_SHA_MISMATCH');assert.ok(!f.events.includes('stage'));
});
test('Runner descendant rejects update without side effects',async()=>{
 const f=fixture({inspect:async()=>({installedSha:previous,insideRunnerTree:true})});const r=await applyApprovedUpdate(request,f.port);
 assert.equal(r.code,'MAINTENANCE_PROCESS_NOT_INDEPENDENT');assert.ok(!f.events.includes('pause'));
});
test('SHA and permission validation happens before intake pause',async()=>{
 const f=fixture({validate:async()=>{throw Object.assign(Error('UNAPPROVED_CHANGE'),{code:'UNAPPROVED_CHANGE'});}});
 const r=await applyApprovedUpdate(request,f.port);assert.equal(r.status,'BLOCKED');assert.equal(r.code,'UNAPPROVED_CHANGE');assert.ok(!f.events.includes('pause'));
});
test('long running existing job fails closed, without stopping supervisor',async()=>{
 const f=fixture({waitForDrain:async()=>{throw Object.assign(Error('DRAIN_TIMEOUT'),{code:'DRAIN_TIMEOUT'});}});
 const r=await applyApprovedUpdate(request,f.port);assert.equal(r.status,'BLOCKED');assert.equal(r.code,'DRAIN_TIMEOUT');assert.ok(!f.events.includes('stop'));
});
test('partial failure restores only verified backup, keeps original SHA',async()=>{
 const f=fixture({reconnect:async()=>{throw Object.assign(Error('SIX_RECONNECT_FAILED'),{code:'SIX_RECONNECT_FAILED'});}});
 const r=await applyApprovedUpdate(request,f.port);assert.equal(r.status,'ROLLED_BACK');assert.equal(r.code,'SIX_RECONNECT_FAILED');
 assert.equal(f.installed,previous);assert.equal(f.paused,false);assert.ok(f.events.includes('restore'));
});
test('unverifiable backup is never restored or called success',async()=>{
 const f=fixture({reconnect:async()=>{throw Error('broken');},verifyBackup:async()=>false});const r=await applyApprovedUpdate(request,f.port);
 assert.equal(r.status,'RECOVERY_REQUIRED');assert.equal(r.actualInstalledSha,null);assert.ok(!f.events.includes('restore'));
});
test('six Online without diagnostic PASS is rolled back',async()=>{
 const f=fixture({postcheck:async()=>({status:'FAIL',actualExecutionSha:target})});const r=await applyApprovedUpdate(request,f.port);
 assert.equal(r.status,'ROLLED_BACK');assert.equal(r.code,'POSTCHECK_NOT_VERIFIED');
});
test('postcheck with old actualExecutionSha is refused and rolled back',async()=>{
 const f=fixture({postcheck:async()=>({status:'PASS',actualExecutionSha:previous})});const r=await applyApprovedUpdate(request,f.port);
 assert.equal(r.status,'ROLLED_BACK');assert.equal(r.code,'POSTCHECK_NOT_VERIFIED');
});
test('ambiguous network timeout does not kill a possibly running postcheck',async()=>{
 const f=fixture({postcheck:async()=>{throw Object.assign(Error('unknown'),{code:'POSTCHECK_OUTCOME_UNKNOWN'});}});
 const r=await applyApprovedUpdate(request,f.port);
 assert.equal(r.status,'RECOVERY_REQUIRED');assert.ok(!f.events.includes('restore'));
 assert.equal(r.next,'RECONCILE_POSTCHECK_AND_ACTUAL_INSTALL_BEFORE_ANY_RETRY');
});
test('an uncertain backlog replay is not retried and never stops active requeued jobs',async()=>{
 const f=fixture({reconcileBacklog:async()=>{throw Object.assign(Error('outcome unknown'),{code:'BACKLOG_REPLAY_OUTCOME_UNKNOWN'});}});
 const r=await applyApprovedUpdate(request,f.port);assert.equal(r.status,'RECOVERY_REQUIRED');
 assert.equal(r.code,'BACKLOG_REPLAY_OUTCOME_UNKNOWN');assert.ok(!f.events.includes('restore'));
});
test('interrupted journal is only reconciled; never silently retried',async()=>{
 const f=fixture();await f.port.persist({requestId:request.requestId,fingerprint:f.port.fingerprint(request),phase:'SWITCHED',status:'RUNNING'});
 const r=await applyApprovedUpdate(request,f.port);assert.equal(r.status,'RECOVERY_REQUIRED');assert.ok(!f.events.includes('switch'));
});

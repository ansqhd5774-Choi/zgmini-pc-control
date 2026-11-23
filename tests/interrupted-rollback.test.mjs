import test from 'node:test';import assert from 'node:assert/strict';
import {reconcileInterruptedRollback} from '../tools/maintenance-apply.mjs';
const original={requestId:'pc-update-fixture',status:'RUNNING',phase:'SWITCHED',installedShaBefore:'a'.repeat(40)};
function fixture(){const calls=[],records=[];const port={};for(const k of ['prepareRecovery','verifyBackup','restore','reconnectPrevious','verifyPrevious','resumeIntake','reconcileBacklog'])port[k]=async()=>{calls.push(k);return true;};return {port,calls,records,persist:async r=>records.push(r)};}
test('interrupted switch restores only verified backup and preserves original journal',async()=>{const f=fixture(),copy=structuredClone(original);const r=await reconcileInterruptedRollback(original,f.port,f.persist);assert.equal(r.status,'ROLLED_BACK');assert.equal(r.actualInstalledSha,original.installedShaBefore);assert.deepEqual(original,copy);assert.deepEqual(f.calls,['prepareRecovery','verifyBackup','restore','reconnectPrevious','verifyPrevious','resumeIntake','reconcileBacklog','verifyPrevious']);assert.equal(f.records.find(x=>x.code==='RECOVERY_RESTORE_STARTED').mutationStarted,true);});
test('missing backup never restores or resumes intake',async()=>{const f=fixture();f.port.verifyBackup=async()=>false;const r=await reconcileInterruptedRollback(original,f.port,f.persist);assert.equal(r.status,'RECOVERY_REQUIRED');assert.equal(r.code,'RECOVERY_BACKUP_NOT_VERIFIED');assert.deepEqual(f.calls,['prepareRecovery']);assert.equal(r.mutationStarted,undefined);});
test('protection drift stops before restore',async()=>{const f=fixture();f.port.prepareRecovery=async()=>{throw Object.assign(Error(),{code:'PROTECTED_STATE_DRIFT'});};const r=await reconcileInterruptedRollback(original,f.port,f.persist);assert.equal(r.code,'PROTECTED_STATE_DRIFT');assert.equal(f.calls.length,0);});
test('postcheck uncertainty does not roll back a possibly successful update',async()=>{const f=fixture();const r=await reconcileInterruptedRollback({...original,phase:'POSTCHECK_PENDING'},f.port,f.persist);assert.equal(r.code,'RECOVERY_WAIT_EXISTING_RESULT');assert.equal(f.calls.length,0);});
test('attested failed postcheck may use already guarded rollback but never re-run original update',async()=>{
 const f=fixture(),confirmed={...original,status:'RECOVERY_REQUIRED',phase:'RECOVERY_REQUIRED',
  firstFail:'POSTCHECK_PENDING',postIssueNumber:2506,targetSha:'b'.repeat(40)};
 f.port.confirmPostcheckFailure=async x=>{f.calls.push('confirmPostcheckFailure');
  return x.postIssueNumber===2506;};
 const copy=structuredClone(confirmed);
 const result=await reconcileInterruptedRollback(confirmed,f.port,f.persist);
 assert.equal(result.status,'ROLLED_BACK');
 assert.equal(result.originalPhase,'POSTCHECK_PENDING');
 assert.equal(result.originalRequestRetried,false);
 assert.deepEqual(confirmed,copy);
 assert.deepEqual(f.calls,[
  'confirmPostcheckFailure','prepareRecovery','verifyBackup','restore',
  'reconnectPrevious','verifyPrevious','resumeIntake','reconcileBacklog','verifyPrevious']);
 assert.equal(f.records.find(x=>x.code==='RECOVERY_CONFIRMED_POSTCHECK_FAILURE')?.mutationStarted,undefined);
 assert.equal(f.records.find(x=>x.code==='RECOVERY_RESTORE_STARTED')?.mutationStarted,true);
});
test('missing or rejected verified postcheck keeps old safe WAIT without runtime mutation',async()=>{
 const valid={...original,status:'RECOVERY_REQUIRED',phase:'RECOVERY_REQUIRED',
  firstFail:'POSTCHECK_PENDING',postIssueNumber:2506,targetSha:'b'.repeat(40)};
 for(const rejected of [
  { ...valid, postIssueNumber:null },
  { ...valid, targetSha:null },
  { ...valid, status:'RUNNING',phase:'POSTCHECK_PENDING' }
 ]){
  const f=fixture();f.port.confirmPostcheckFailure=async()=>true;
  const out=await reconcileInterruptedRollback(rejected,f.port,f.persist);
  assert.equal(out.code,'RECOVERY_WAIT_EXISTING_RESULT');
  assert.equal(f.calls.length,0);
 }
 for(const proof of [async()=>false,async()=>{throw Error('private-fail');}]){
  const f=fixture();f.port.confirmPostcheckFailure=proof;
  const out=await reconcileInterruptedRollback(valid,f.port,f.persist);
  assert.equal(out.code,'RECOVERY_WAIT_EXISTING_RESULT');
  assert.equal(f.calls.length,0);
 }
 const f=fixture();f.port.confirmPostcheckFailure=async()=>true;
 f.port.prepareRecovery=async()=>{throw Object.assign(Error(),{code:'PROTECTED_STATE_DRIFT'});};
 const stopped=await reconcileInterruptedRollback(valid,f.port,f.persist);
 assert.equal(stopped.code,'PROTECTED_STATE_DRIFT');
 assert.ok(!f.calls.includes('restore'));
 assert.ok(!f.calls.includes('resumeIntake'));
});
test('failed old runtime readback keeps recovery required and intake paused',async()=>{const f=fixture();f.port.verifyPrevious=async()=>false;const r=await reconcileInterruptedRollback(original,f.port,f.persist);assert.equal(r.code,'RECOVERY_RUNTIME_NOT_VERIFIED');assert.equal(r.mutationStarted,true);assert.ok(!f.calls.includes('resumeIntake'));});
test('BACKED_UP recovery preserves verified busy previous Supervisor without restore',async()=>{
 const f=fixture(),o={...original,status:'RECOVERY_REQUIRED',phase:'RECOVERY_REQUIRED',
  firstFail:'BACKED_UP'};
 f.port.verifyRestoredPrevious=async()=>{f.calls.push('verifyRestoredPrevious');return true;};
 f.port.verifyPrevious=async x=>{f.calls.push('verifyPrevious:'+String(x.requireIdle));return true;};
 const r=await reconcileInterruptedRollback(o,f.port,f.persist);
 assert.equal(r.status,'ROLLED_BACK');
 assert.equal(r.actualInstalledSha,o.installedShaBefore);
 assert.equal(r.originalRequestRetried,false);
 assert.deepEqual(f.calls,['prepareRecovery','verifyBackup','verifyRestoredPrevious',
  'verifyPrevious:false','resumeIntake','reconcileBacklog','verifyPrevious:false']);
 assert.ok(!f.records.some(x=>x.code==='RECOVERY_RESTORE_STARTED'));
 assert.ok(!f.calls.includes('restore')&&!f.calls.includes('reconnectPrevious'));
});
test('switched recovery still requires idle verification before resuming intake',async()=>{
 const f=fixture(),o={...original,status:'RECOVERY_REQUIRED',phase:'RECOVERY_REQUIRED',
  firstFail:'SWITCHED'};
 f.port.verifyRestoredPrevious=async()=>true;
 f.port.verifyPrevious=async ({requireIdle})=>{
  f.calls.push('verifyPrevious:'+String(requireIdle));return true;
 };
 const r=await reconcileInterruptedRollback(o,f.port,f.persist);
 assert.equal(r.status,'ROLLED_BACK');
 assert.deepEqual(f.calls.filter(x=>x.startsWith('verifyPrevious:')),
  ['verifyPrevious:true','verifyPrevious:false']);
});
test('a busy but ONLINE six-runner roster is not an invalid previous runtime',async()=>{
 const {dedicatedPcRunnerRows}=await import('../tools/update.mjs');
 const roster=Array.from({length:6},(_,i)=>({
  name:'zgmini-pc-0'+(i+1),status:'online',busy:i===0,
 }));
 assert.equal(dedicatedPcRunnerRows(roster,{requireOnline:true})?.length,6);
 assert.equal(dedicatedPcRunnerRows(roster,{requireOnline:true,requireIdle:true}),null);
 assert.equal(dedicatedPcRunnerRows(roster.slice(1),{requireOnline:true}),null);
});

test('pre-install failure uses cancellation path rather than partial rollback',async()=>{const f=fixture();const r=await reconcileInterruptedRollback({...original,phase:'RECEIVED'},f.port,f.persist);assert.equal(r.code,'RECOVERY_PHASE_NOT_ROLLBACK_ELIGIBLE');assert.equal(f.calls.length,0);});

test('independent rollback preflight failure leaves no mutation claim',async()=>{
 const recovered={...original,status:'RECOVERY_REQUIRED',phase:'RECOVERY_REQUIRED',
  firstFail:'POSTCHECK_PENDING',postIssueNumber:2506,targetSha:'b'.repeat(40)};
 for(const code of ['RUNNER_INVENTORY_INCOMPLETE','HTTP_403_FORBIDDEN']){
  const f=fixture();
  f.port.confirmPostcheckFailure=async()=>true;
  f.port.verifyRestoredPrevious=async()=>false;
  f.port.preflightRecoveryRestore=async()=>{f.calls.push('preflightRecoveryRestore');
   throw Object.assign(Error(code),{code});};
  const r=await reconcileInterruptedRollback(recovered,f.port,f.persist);
  assert.equal(r.code,code);
  assert.equal(r.failureOperation,'preflightRecoveryRestore');
  assert.notEqual(r.mutationStarted,true);
  assert.ok(!f.calls.includes('restore'));
  assert.ok(!f.calls.includes('resumeIntake'));
  assert.ok(!f.records.some(x=>x.code==='RECOVERY_RESTORE_STARTED'));
 }
});
test('independent rollback read-only preflight precedes durable mutation marker',async()=>{
 const f=fixture();f.port.preflightRecoveryRestore=async()=>{f.calls.push('preflightRecoveryRestore');};
 const r=await reconcileInterruptedRollback(original,f.port,f.persist);
 assert.equal(r.status,'ROLLED_BACK');
 assert.ok(f.calls.indexOf('preflightRecoveryRestore')<f.calls.indexOf('restore'));
 assert.equal(f.records.find(x=>x.code==='RECOVERY_RESTORE_STARTED')?.mutationStarted,true);
});

test('boundary-aware restore readback failure before first write does not retain mutation marker',async()=>{
 const f=fixture();f.port.restoreMarksMutation=true;
 f.port.restore=async({beforeMutation})=>{f.calls.push('restoreReadback');
  throw Object.assign(Error('HTTP_403_FORBIDDEN'),{code:'HTTP_403_FORBIDDEN'});};
 const r=await reconcileInterruptedRollback(original,f.port,f.persist);
 assert.equal(r.code,'HTTP_403_FORBIDDEN');
 assert.notEqual(r.mutationStarted,true);
 assert.ok(!f.records.some(x=>x.code==='RECOVERY_RESTORE_STARTED'));
 assert.deepEqual(f.calls.slice(-1),['restoreReadback']);
});
test('boundary-aware restore persists durable claim before any runtime mutation',async()=>{
 const f=fixture();f.port.restoreMarksMutation=true;
 f.port.restore=async({beforeMutation})=>{
  f.calls.push('restoreReadback');await beforeMutation();
  assert.equal(f.records.at(-1).code,'RECOVERY_RESTORE_STARTED');
  assert.equal(f.records.at(-1).mutationStarted,true);
  f.calls.push('firstWrite');
  throw Object.assign(Error('ROLLBACK_PARTIAL_APPLY'),{code:'ROLLBACK_PARTIAL_APPLY'});
 };
 const r=await reconcileInterruptedRollback(original,f.port,f.persist);
 assert.equal(r.code,'ROLLBACK_PARTIAL_APPLY');
 assert.equal(r.mutationStarted,true);
 assert.ok(f.calls.indexOf('restoreReadback')<f.calls.indexOf('firstWrite'));
});
test('boundary-aware restore cannot report success without durable mutation marker',async()=>{
 const f=fixture();f.port.restoreMarksMutation=true;
 f.port.restore=async()=>{f.calls.push('restore');};
 const r=await reconcileInterruptedRollback(original,f.port,f.persist);
 assert.equal(r.code,'RECOVERY_MUTATION_MARKER_MISSING');
 assert.notEqual(r.mutationStarted,true);
 assert.ok(!f.calls.includes('reconnectPrevious'));
});

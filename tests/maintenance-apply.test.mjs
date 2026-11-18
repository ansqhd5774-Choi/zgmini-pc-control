import test from 'node:test';
// Exercise the approved 7/9-field backlog contract through the existing isolated maintenance CI suite.
import './maintenance-backlog-request.test.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {nextRuntimeFiles,requireHandoffApproval,approvedRuntimeChanges} from '../tools/handoff-maintenance.mjs';
import {applyApprovedUpdate,maintenanceFailureCode,reconcileInterruptedRollback} from '../tools/maintenance-apply.mjs';
import {readControllerUpdateArtifacts,confirmExactWorkflowState,readMaintenanceRecoveryStatus,backlogPauseWindows,openRollbackPause,
  closeLatestPause,backlogIssueInPause,prevalidationInventory} from '../tools/update.mjs';
import {INSTALLABLE_FILES} from '../tools/maintenance-contract.mjs';

const previous='c'.repeat(40), target='b'.repeat(40);
const request={requestId:'pc-update-simulation-0001',installedSha:previous,targetSha:target};
test('no-effect proof rejects an incomplete, substituted or absent installed file inventory',()=>{
 const h='0'.repeat(64),files=Object.fromEntries(INSTALLABLE_FILES.map(x=>[x,h]));
 assert.equal(INSTALLABLE_FILES.length,9);
 assert.deepEqual(Object.keys(prevalidationInventory({controllerFiles:files})).length,9);
 assert.equal(prevalidationInventory({controllerFiles:{...files,'controller/entry.mjs':undefined}}),null);
 assert.equal(prevalidationInventory({controllerFiles:{...files,'controller/upload.mjs':undefined}}),null);
 assert.equal(prevalidationInventory({controllerFiles:{'controller/entry.mjs':h}}),null);
 assert.equal(prevalidationInventory({}),null);
});
test('uncoded preflight exception reports a precise safe stage and leaves Controller untouched',async()=>{
 const f=fixture({inspect:async()=>{throw Error('private path and arbitrary details must stay private');}});
 const r=await applyApprovedUpdate(request,f.port);
 assert.equal(r.status,'BLOCKED');
 assert.equal(r.code,'UPDATE_INSPECT_FAILED');
 assert.equal(r.firstFail,'RECEIVED');
 assert.equal(r.failureOperation,'inspect');
 // A legacy success path does not claim a specialized no-effect proof.
 assert.equal(r.substate,undefined);
 assert.equal(f.installed,previous);
 assert.equal(f.paused,false);
 assert.ok(!f.events.includes('stage'));
 assert.ok(!JSON.stringify(r).includes('private path'));
});
test('known errors remain exact; system errno is safely tied to the failing stage',()=>{
 assert.equal(maintenanceFailureCode({code:'SUPERVISOR_NOT_HEALTHY'},'validate'),'SUPERVISOR_NOT_HEALTHY');
 assert.equal(maintenanceFailureCode({code:'ENOENT'},'validate'),'UPDATE_VALIDATE_ENOENT');
 assert.equal(maintenanceFailureCode(Error('token=do-not-log'),'postcheck'),'UPDATE_POSTCHECK_FAILED');
});
test('bounded no-effect proof can release an otherwise overly strict busy-Runner prevalidation block',async()=>{
 const f=fixture({
  validate:async()=>{throw Object.assign(Error('prevalidation failed'),{code:'ALLOWFILE_HASH_MISMATCH'});},
  verifyPrevious:async()=>false, // old health check treats a busy unrelated runner as unsafe
  verifyPrevalidationUntouched:async()=>true, // live original, Core digest and active workflow were read back
 });
 const r=await applyApprovedUpdate(request,f.port);
 assert.equal(r.status,'BLOCKED');
 assert.equal(r.substate,'PREVALIDATION_UNTOUCHED_VERIFIED');
 assert.equal(r.code,'ALLOWFILE_HASH_MISMATCH');
 assert.equal(r.firstFail,'RECEIVED');
 assert.equal(r.failureOperation,'validate');
 assert.equal(r.workflowEnabled,true);
 assert.equal(f.events.includes('stage'),false);
});
test('no-effect prevalidation remains recovery-required if fresh installed SHA disagrees',async()=>{
 const f=fixture({validate:async()=>{throw Error('rejected before stage');},
  verifyPrevious:async()=>false,verifyPrevalidationUntouched:async()=>true,
  inspectAfterUncertain:async()=>({actualControllerSha:target,workflowState:'active'})});
 const r=await applyApprovedUpdate(request,f.port);
 assert.equal(r.status,'RECOVERY_REQUIRED');
 assert.equal(r.substate,undefined);
 assert.equal(r.observed.actualControllerSha,target);
});
test('no-effect prevalidation requires independently readable installed SHA',async()=>{
 const f=fixture({validate:async()=>{throw Error('rejected before stage');},
  verifyPrevious:async()=>false,verifyPrevalidationUntouched:async()=>true,
  inspectAfterUncertain:async()=>({workflowState:'active'})});
 const r=await applyApprovedUpdate(request,f.port);
 assert.equal(r.status,'RECOVERY_REQUIRED');
});
test('no-effect assertion cannot override an absent proof or a disabled workflow',async()=>{
 const noProof=fixture({inspect:async()=>{throw Error('inspect failed');},
  verifyPrevious:async()=>false,verifyPrevalidationUntouched:async()=>false});
 const a=await applyApprovedUpdate(request,noProof.port);
 assert.equal(a.status,'RECOVERY_REQUIRED');
 assert.equal(a.substate,undefined);
 assert.equal(a.firstFail,'RECEIVED');
 const disabled=fixture({inspect:async()=>{throw Error('inspect failed');},
  verifyPrevious:async()=>false,verifyPrevalidationUntouched:async()=>true,
  inspectAfterUncertain:async()=>({installedSha:previous,workflowState:'disabled_manually'})});
 const b=await applyApprovedUpdate(request,disabled.port);
 assert.equal(b.status,'RECOVERY_REQUIRED');
 assert.equal(b.substate,undefined);
 assert.equal(b.workflowEnabled,false);
});
test('failed or throwing proof does not turn a recovery requirement into BLOCKED',async()=>{
 for(const proof of [async()=>{throw Error('readback failed');},async()=>null]){
  const f=fixture({inspect:async()=>{throw Error('no effect but unverified');},
   verifyPrevious:async()=>false,verifyPrevalidationUntouched:proof});
  const r=await applyApprovedUpdate(request,f.port);
  assert.equal(r.status,'RECOVERY_REQUIRED');
  assert.equal(r.substate,undefined);
 }
});
test('stage-entry failure cannot be downgraded by a false untouched-proof callback',async()=>{
 let proofCalls=0,stageCalls=0;
 const f=fixture({
  stage:async()=>{stageCalls++;throw Object.assign(Error('partial stage write'),{code:'ENOSPC'});},
  verifyPrevalidationUntouched:async()=>{proofCalls++;return true;},
 });
 const r=await applyApprovedUpdate(request,f.port);
 assert.equal(stageCalls,1);
 assert.equal(proofCalls,0);
 assert.equal(r.status,'RECOVERY_REQUIRED');
 assert.equal(r.substate,undefined);
 assert.equal(r.firstFail,'VALIDATED');
 assert.equal(r.failureOperation,'stage');
 assert.equal(r.code,'UPDATE_STAGE_ENOSPC');
});
test('prevalidation-only exception never changes stored failure into a new top-level status',async()=>{
 const f=fixture({validate:async()=>{throw Object.assign(Error('invalid digest'),{code:'ALLOWFILE_HASH_MISMATCH'});},
  verifyPrevalidationUntouched:async()=>true});
 const r=await applyApprovedUpdate(request,f.port);
 assert.equal(r.status,'BLOCKED');
 assert.equal(r.substate,'PREVALIDATION_UNTOUCHED_VERIFIED');
 assert.ok(!f.events.includes('stage'));
 assert.ok(!f.events.includes('pause'));
 const source=fs.readFileSync(new URL('../tools/update.mjs',import.meta.url),'utf8');
 assert.match(source,/await ports\.capturePrevalidationBaseline\(\);/);
 assert.match(source,/verifyPrevalidationUntouched:async/);
 assert.match(source,/prevalidationBaseline\.ownerNonce/);
 assert.match(source,/protectedSnapshot\(\)/);
 assert.match(source,/if\(result\.status==='RECOVERY_REQUIRED'\)\{installLock\.holdForRecovery\(\)/);
 assert.match(source,/if\(!retained\)installLock\.release\(\)/);
});
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
    postcheck:async()=>({status:'PASS',actualExecutionSha:target,
      protectedStateUnchanged:true,runnerSetVerified:true,postSourceVerified:true}),
    verifyPrevious:async()=>installed===previous&&oldRunning,
    verifyBackup:async()=>true,
    restore:async()=>{installed=previous;events.push('restore');},
    reconnectPrevious:async()=>{oldRunning=true;events.push('reconnectPrevious');},
    inspectAfterUncertain:async()=>({actualControllerSha:installed,workflowState:paused?'disabled_manually':'active'}),
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
test('partial host.json corruption still returns original request ledger and recovery lock',()=>{
 const ledger={requestId:request.requestId,status:'RECOVERY_REQUIRED',phase:'SWITCHED'};
 const state=readMaintenanceRecoveryStatus(request.requestId,{
  readInstalled:()=>{throw Error('host missing after switch');},
  readLedger:()=>ledger,readLock:()=>({held:true,recoveryRequired:true}),
 });
 assert.equal(state.status,'STATUS');
 assert.equal(state.actualControllerSha,null);
 assert.equal(state.installedReadbackCode,'INSTALLED_MANIFEST_UNAVAILABLE');
 assert.deepEqual(state.ledger,ledger);
 assert.equal(state.installLock.recoveryRequired,true);
});
test('rollback creates a second durable pause window and replays issues from both windows',()=>{
 const first='2026-11-02T10:00:00.000Z',firstResume='2026-11-02T10:02:00.000Z';
 let state={schema:'ZGMINI_PC_BACKLOG_V1',requestId:request.requestId,
   pausedAt:first,resumedAt:null,replays:{},windows:[{pausedAt:first,resumedAt:null}]};
 state=closeLatestPause(state,firstResume);
 state=openRollbackPause(state,'2026-11-02T10:04:00.000Z');
 assert.equal(backlogPauseWindows(state).length,2);
 assert.equal(backlogPauseWindows(state)[1].resumedAt,null);
 assert.throws(()=>openRollbackPause(state,'2026-11-02T10:05:00.000Z'),
   /BACKLOG_PRIOR_PAUSE_OPEN/);
 state=closeLatestPause(state,'2026-11-02T10:06:00.000Z');
 const issue=when=>({created_at:when,user:{login:'ansqhd5774-Choi'},
   labels:[{name:'pc-job'}],title:'Approved PC request'});
 const firstIssue=issue('2026-11-02T10:01:00.000Z');
 const rollbackIssue=issue('2026-11-02T10:05:00.000Z');
 const between=issue('2026-11-02T10:03:00.000Z');
 const windows=backlogPauseWindows(state);
 assert.equal(windows.some(w=>backlogIssueInPause(firstIssue,w)),true);
 assert.equal(windows.some(w=>backlogIssueInPause(rollbackIssue,w)),true);
 assert.equal(windows.some(w=>backlogIssueInPause(between,w)),false);
 assert.equal(state.resumedAt,firstResume);
});
test('invalid or unclosed backlog window is fail-closed before replay',()=>{
 const legacy={schema:'ZGMINI_PC_BACKLOG_V1',pausedAt:'2026-11-02T10:00:00Z',resumedAt:null};
 assert.equal(backlogPauseWindows(legacy).length,1);
 assert.throws(()=>closeLatestPause(legacy,'2026-11-02T09:00:00Z'),/BACKLOG_RESUME_TIME_INVALID/);
 assert.throws(()=>backlogPauseWindows({...legacy,windows:[]}),/BACKLOG_WINDOWS_INVALID/);
});
test('unreadable install lock fails closed while preserving verified SHA and ledger',()=>{
 const ledger={requestId:request.requestId,status:'RUNNING'};
 const state=readMaintenanceRecoveryStatus(request.requestId,{
  readInstalled:()=>previous,readLedger:()=>ledger,
  readLock:()=>{throw Error('lock unreadable');},
 });
 assert.equal(state.actualControllerSha,previous);
 assert.deepEqual(state.ledger,ledger);
 assert.equal(state.lockReadbackCode,'UPDATE_LOCK_UNAVAILABLE');
 assert.deepEqual(state.installLock,{held:true,recoveryRequired:true});
});
test('unreadable request ledger is not disguised as no prior request',()=>{
 const state=readMaintenanceRecoveryStatus(request.requestId,{
  readInstalled:()=>previous,
  readLedger:()=>{throw Error('ledger parse failure');},
  readLock:()=>({held:false}),
 });
 assert.equal(state.ledger,null);
 assert.equal(state.ledgerReadbackCode,'UPDATE_LEDGER_UNAVAILABLE');
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
test('missing backlog before any pause cannot turn validation failure into recovery lock',async()=>{
 const f=fixture({validate:async()=>{throw Object.assign(Error('missing prerequisite'),{code:'ENOENT'});},
  reconcileBacklog:async()=>{throw Object.assign(Error('no pause ever'),{code:'BACKLOG_STATE_MISSING'});}});
 const r=await applyApprovedUpdate(request,f.port);
 assert.equal(r.status,'BLOCKED');assert.equal(r.code,'UPDATE_VALIDATE_ENOENT');assert.equal(r.failureOperation,'validate');
 assert.equal(f.events.includes('pause'),false);
});
test('long running existing job fails closed, without stopping supervisor',async()=>{
 const f=fixture({waitForDrain:async()=>{throw Object.assign(Error('DRAIN_TIMEOUT'),{code:'DRAIN_TIMEOUT'});}});
 const r=await applyApprovedUpdate(request,f.port);assert.equal(r.status,'BLOCKED');assert.equal(r.code,'DRAIN_TIMEOUT');assert.ok(!f.events.includes('stop'));
});
test('lost workflow disable acknowledgement reports actual disabled state, never false BLOCKED success',async()=>{
 const f=fixture();
 f.port.pauseIntake=async()=>{await (async()=>{f.events.push('pause-no-ack');})();
   throw Object.assign(Error('lost ACK'),{code:'WORKFLOW_ACK_TIMEOUT'});};
 f.port.inspectAfterUncertain=async()=>({installedSha:previous,workflowState:'disabled_manually'});
 const r=await applyApprovedUpdate(request,f.port);
 assert.equal(r.status,'RECOVERY_REQUIRED');
 assert.equal(r.workflowEnabled,false);
 assert.equal(r.code,'WORKFLOW_ACK_TIMEOUT');
 assert.equal(f.events.includes('stop'),false);
});
test('lost stop acknowledgement confirms the old supervisor before treating the install as blocked',async()=>{
 const f=fixture();
 f.port.stopOwnSupervisor=async()=>{throw Object.assign(Error('lost ACK'),{code:'SUPERVISOR_STOP_ACK_TIMEOUT'});};
 const r=await applyApprovedUpdate(request,f.port);
 assert.equal(r.status,'BLOCKED');
 assert.equal(f.installed,previous);
 assert.ok(!f.events.includes('switch'));
});
test('an unverified Core protection digest cannot be a successful postcheck',async()=>{
 const f=fixture({postcheck:async()=>({status:'PASS',actualExecutionSha:target,
   protectedStateUnchanged:false,runnerSetVerified:true,postSourceVerified:true})});
 const r=await applyApprovedUpdate(request,f.port);
 assert.equal(r.status,'ROLLED_BACK');
 assert.equal(r.code,'POSTCHECK_NOT_VERIFIED');
});
test('fewer than six verified Runner seats cannot be accepted as success',async()=>{
 const f=fixture({postcheck:async()=>({status:'PASS',actualExecutionSha:target,
   protectedStateUnchanged:true,runnerSetVerified:false,postSourceVerified:true})});
 const r=await applyApprovedUpdate(request,f.port);
 assert.equal(r.status,'ROLLED_BACK');
 assert.equal(r.code,'POSTCHECK_NOT_VERIFIED');
});
test('a mismatched immutable diagnostic source is rejected even if controller SHA is correct',async()=>{
 const f=fixture({postcheck:async()=>({status:'PASS',actualExecutionSha:target,
   protectedStateUnchanged:true,runnerSetVerified:true,postSourceVerified:false})});
 const r=await applyApprovedUpdate(request,f.port);
 assert.equal(r.status,'ROLLED_BACK');
 assert.equal(r.code,'POSTCHECK_NOT_VERIFIED');
});
test('fixed WMI ancestry checker fails closed without shell substitution',()=>{
 const source=fs.readFileSync(new URL('../tools/update.mjs',import.meta.url),'utf8');
 const checker=fs.readFileSync(new URL('../tools/maintenance-ancestry.vbs',import.meta.url),'utf8');
 const bootstrap=fs.readFileSync(new URL('../tools/bootstrap-maintenance.mjs',import.meta.url),'utf8');
 const maintainer=fs.readFileSync(new URL('../tools/maintenance-agent.mjs',import.meta.url),'utf8');
 assert.match(source,/execFileSync\('cscript\.exe'/);
 assert.doesNotMatch(source,/powershell\.exe/i);
 assert.match(checker,/Win32_Process WHERE ProcessId=/);
 for(const marker of ['UNKNOWN','DESCENDANT','INDEPENDENT'])assert.ok(checker.includes(marker));
 assert.match(bootstrap,/tools\/maintenance-ancestry\.vbs/);
 assert.match(maintainer,/tools\/maintenance-ancestry\.vbs/);
});
test('one-time bootstrap keeps immutable approved code across report-only main advances',()=>{
 const source=fs.readFileSync(new URL('../tools/bootstrap-maintenance.mjs',import.meta.url),'utf8');
 assert.match(source,/BOOTSTRAP_UNAPPROVED_CODE_DRIFT/);
 assert.match(source,/merge-base.*--is-ancestor/);
 assert.match(source,/results\\\/\[a-zA-Z0-9\._-\]/);
 assert.match(source,/BOOTSTRAP_PINNED_FILE_DRIFT/);
 assert.doesNotMatch(source,/g\(\['rev-parse','HEAD'\]\)===args\[1\]/);
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
test('W02 #1501 regression: confirmed reconnect with failed intake acknowledgement never restores',async()=>{
 const f=fixture({resumeIntake:async()=>{throw Object.assign(
  Error('API reply not confirmed'),{code:'WORKFLOW_ENABLE_NOT_CONFIRMED'});}});
 const r=await applyApprovedUpdate(request,f.port);
 assert.equal(r.status,'RECOVERY_REQUIRED');
 assert.equal(r.code,'WORKFLOW_ENABLE_NOT_CONFIRMED');
 assert.equal(r.firstFail,'RECONNECTED');
 assert.equal(r.failureOperation,'resumeIntake');
 assert.equal(r.actualInstalledSha,null);
 assert.equal(r.next,'RECONCILE_WORKFLOW_BACKLOG_AND_INSTALLED_SHA_NO_AUTOMATIC_ROLLBACK');
 assert.equal(f.installed,target);
 assert.equal(f.paused,true);
 assert.ok(!f.events.includes('restore'));
 assert.ok(!f.events.includes('reconnectPrevious'));
 assert.ok(!f.events.includes('replay-missed-issues'));
});
test('post-resume backlog readback failure must not kill a possibly active intake',async()=>{
 const f=fixture({reconcileBacklog:async()=>{throw Error('unknown private backlog I/O');}});
 const r=await applyApprovedUpdate(request,f.port);
 assert.equal(r.status,'RECOVERY_REQUIRED');
 assert.equal(r.code,'UPDATE_BACKLOG_FAILED');
 assert.equal(r.firstFail,'INTAKE_RESUMED');
 assert.equal(r.failureOperation,'reconcileBacklog');
 assert.equal(r.next,'RECONCILE_WORKFLOW_BACKLOG_AND_INSTALLED_SHA_NO_AUTOMATIC_ROLLBACK');
 assert.equal(f.installed,target);
 assert.equal(f.paused,false);
 assert.ok(!f.events.includes('restore'));
 assert.ok(!f.events.includes('reconnectPrevious'));
});
test('journal write failure after successful reconnect does not provoke a second host mutation',async()=>{
 const f=fixture();
 const original=f.port.persist;
 let failed=false;
 f.port.persist=async row=>{
  if(!failed&&row.phase==='RECONNECTED'){failed=true;throw Error('private journal write failed');}
  return original(row);
 };
 const r=await applyApprovedUpdate(request,f.port);
 assert.equal(r.status,'RECOVERY_REQUIRED');
 assert.equal(r.firstFail,'RECONNECTED');
 assert.equal(r.code,'UPDATE_RECONNECT_FAILED');
 assert.equal(f.installed,target);
 assert.ok(failed);
 assert.ok(!f.events.includes('restore'));
 assert.ok(!f.events.includes('reconnectPrevious'));
});
test('interrupted journal is only reconciled; never silently retried',async()=>{
 const f=fixture();await f.port.persist({requestId:request.requestId,fingerprint:f.port.fingerprint(request),phase:'SWITCHED',status:'RUNNING'});
 const r=await applyApprovedUpdate(request,f.port);assert.equal(r.status,'RECOVERY_REQUIRED');assert.ok(!f.events.includes('switch'));
});

test('W02 #1501: RECONNECTED/RECOVERY_REQUIRED never starts standalone rollback',async()=>{
 const calls=[],rows=[];
 const ports={};
 for(const key of ['prepareRecovery','verifyBackup','restore','reconnectPrevious',
   'verifyPrevious','resumeIntake','reconcileBacklog'])
  ports[key]=async()=>{calls.push(key);return true;};
 const original={requestId:'pc-update-original-1501-fixture',status:'RECOVERY_REQUIRED',
   phase:'RECOVERY_REQUIRED',firstFail:'RECONNECTED',installedShaBefore:previous};
 const snapshot=structuredClone(original);
 const result=await reconcileInterruptedRollback(original,ports,async row=>rows.push(row));
 assert.equal(result.status,'RECOVERY_REQUIRED');
 assert.equal(result.code,'RECOVERY_RECONNECTED_INTAKE_READBACK_REQUIRED');
 assert.equal(result.originalPhase,'RECONNECTED');
 assert.equal(result.originalRequestRetried,false);
 assert.deepEqual(original,snapshot);
 assert.deepEqual(calls,[]);
 assert.equal(rows.length,1);
 assert.equal(result.mutationStarted,undefined);
});
test('interrupted RUNNING at RECONNECTED preserves the existing Controller until intake resolved',async()=>{
 const calls=[],port={};
 for(const key of ['prepareRecovery','verifyBackup','restore','reconnectPrevious',
   'verifyPrevious','resumeIntake','reconcileBacklog'])
  port[key]=async()=>{calls.push(key);return true;};
 const rows=[],result=await reconcileInterruptedRollback(
   {requestId:'pc-update-connecting-fixture',status:'RUNNING',
    phase:'RECONNECTED',installedShaBefore:previous},
   port,async row=>rows.push(row));
 assert.equal(result.status,'RECOVERY_REQUIRED');
 assert.equal(result.code,'RECOVERY_RECONNECTED_INTAKE_READBACK_REQUIRED');
 assert.equal(rows.length,1);
 assert.deepEqual(calls,[]);
});

function restoredRecovery(overrides={}){
 const calls=[],rows=[],port={};
 for(const key of ['prepareRecovery','verifyBackup','verifyRestoredPrevious','restore',
  'reconnectPrevious','verifyPrevious','resumeIntake','reconcileBacklog'])
  port[key]=async()=>{calls.push(key);return true;};
 Object.assign(port,overrides);
 const original={requestId:'pc-update-restored-fixture',status:'RECOVERY_REQUIRED',
  phase:'RECOVERY_REQUIRED',firstFail:'SWITCHED',installedShaBefore:previous};
 return {calls,rows,port,original,run:()=>reconcileInterruptedRollback(original,port,async row=>rows.push(row))};
}
test('1841 already-restored exact snapshot resumes intake without another restore or reconnect',async()=>{
 const f=restoredRecovery(),original=structuredClone(f.original),r=await f.run();
 assert.equal(r.status,'ROLLED_BACK');assert.equal(r.existingVersionPreserved,true);
 assert.equal(r.actualInstalledSha,previous);assert.equal(r.originalRequestRetried,false);
 assert.deepEqual(f.original,original);
 assert.ok(!f.calls.includes('restore'));assert.ok(!f.calls.includes('reconnectPrevious'));
 assert.ok(f.calls.includes('resumeIntake'));assert.ok(f.calls.includes('reconcileBacklog'));
 const before=f.rows.findIndex(x=>x.code==='RECOVERY_INTAKE_RESUME_STARTED');
 assert.ok(before>=0);assert.equal(f.rows[before].mutationStarted,true);
});
test('restored intake ambiguity retains mutation flag and never repeats restore or enable',async()=>{
 let n=0;const f=restoredRecovery({resumeIntake:async()=>{n++;throw Object.assign(Error(),{code:'WORKFLOW_ENABLE_NOT_CONFIRMED'});}});
 const r=await f.run();assert.equal(n,1);assert.equal(r.status,'RECOVERY_REQUIRED');
 assert.equal(r.failureOperation,'resumeIntake');assert.equal(r.mutationStarted,true);
 assert.equal(r.code,'WORKFLOW_ENABLE_NOT_CONFIRMED');
 assert.ok(!f.calls.includes('restore'));assert.ok(!f.calls.includes('reconcileBacklog'));
});
test('restored proof exception refuses file mutation and intake',async()=>{
 const f=restoredRecovery({verifyRestoredPrevious:async()=>{throw Object.assign(Error(),{code:'CURRENT_CONTROLLER_DRIFT'});}});
 const r=await f.run();assert.equal(r.status,'RECOVERY_REQUIRED');
 assert.equal(r.failureOperation,'verifyRestoredPrevious');assert.equal(r.mutationStarted,undefined);
 assert.ok(!f.calls.includes('restore'));assert.ok(!f.calls.includes('resumeIntake'));
});
test('unproven restored state retains original verified rollback path',async()=>{
 const f=restoredRecovery({verifyRestoredPrevious:async()=>false}),r=await f.run();
 assert.equal(r.status,'ROLLED_BACK');assert.ok(f.calls.includes('restore'));
 assert.ok(f.calls.includes('reconnectPrevious'));assert.notEqual(r.existingVersionPreserved,true);
});
test('backup failure never skips into already-restored intake',async()=>{
 const f=restoredRecovery({verifyBackup:async()=>false}),r=await f.run();
 assert.equal(r.status,'RECOVERY_REQUIRED');assert.equal(r.code,'RECOVERY_BACKUP_NOT_VERIFIED');
 assert.ok(!f.calls.includes('verifyRestoredPrevious'));assert.ok(!f.calls.includes('resumeIntake'));
});
test('backlog ambiguity preserves recovery claim after enabled intake and does not replay twice',async()=>{
 let n=0;const f=restoredRecovery({reconcileBacklog:async()=>{n++;throw Object.assign(Error(),{code:'BACKLOG_REPLAY_OUTCOME_UNKNOWN'});}});
 const r=await f.run();assert.equal(n,1);assert.equal(r.status,'RECOVERY_REQUIRED');
 assert.equal(r.failureOperation,'reconcileBacklog');assert.equal(r.mutationStarted,true);
 assert.ok(!f.calls.includes('restore'));
});
test('successful replay requires Online runners but does not wait for newly dispatched A to become idle',async()=>{
 const options=[];const f=restoredRecovery({verifyPrevious:async x=>{options.push(x);return true;}});
 const r=await f.run();assert.equal(r.status,'ROLLED_BACK');
 assert.equal(options.length,2);assert.notEqual(options[0].requireIdle,false);
 assert.equal(options[1].requireIdle,false);assert.equal(options[1].requireRunning,true);
});

test('maintenance workflow readback accepts only eventual exact disabled state',async()=>{
 const states=['active','active','disabled_manually'];const pauses=[];
 const ok=await confirmExactWorkflowState(()=>states.shift(),'disabled_manually',
  {pause:async ms=>pauses.push(ms)});
 assert.equal(ok,true);assert.deepEqual(pauses,[1000,1000]);
});
test('maintenance workflow readback never infers disable from persistent active or missing state',async()=>{
 let calls=0;const pauses=[];
 const ok=await confirmExactWorkflowState(()=>{calls++;return 'active';},'disabled_manually',
  {pause:async ms=>pauses.push(ms)});
 assert.equal(ok,false);assert.equal(calls,6);assert.deepEqual(pauses,[1000,1000,1000,1000,1000]);
 assert.equal(await confirmExactWorkflowState(()=>undefined,'disabled_manually',{pause:async()=>{}}),false);
});
test('maintenance workflow readback rejects unexpected state and does not toggle the workflow',async()=>{
 let calls=0;const pauses=[];
 assert.equal(await confirmExactWorkflowState(()=>{calls++;return 'disabled_inactivity';},'disabled_manually',
  {pause:async ms=>pauses.push(ms)}),false);
 assert.equal(calls,1);assert.deepEqual(pauses,[]);
});
test('maintenance workflow readback retries uncertain GET only, including enable verification',async()=>{
 let calls=0;const pauses=[];
 const ok=await confirmExactWorkflowState(()=>{
  if(++calls===1)throw Error('private API error');
  return 'active';
 },'active',{pause:async ms=>pauses.push(ms)});
 assert.equal(ok,true);assert.equal(calls,2);assert.deepEqual(pauses,[1000]);
 await assert.rejects(confirmExactWorkflowState(()=> 'active','unknown',{pause:async()=>{}}),
  {code:'WORKFLOW_STATE_PROBE_INVALID'});
});

test('workflow drift while draining aborts before backup or stopping Supervisor',async()=>{
 const f=fixture({waitForDrain:async()=>{f.events.push('drain');
  throw Object.assign(Error('intake unexpectedly active'),{code:'WORKFLOW_STATE_DRIFT_BEFORE_DRAIN'});
 }});
 const r=await applyApprovedUpdate(request,f.port);
 assert.equal(r.code,'WORKFLOW_STATE_DRIFT_BEFORE_DRAIN');
 assert.equal(r.firstFail,'INTAKE_PAUSED');
 assert.equal(r.failureOperation,'waitForDrain');
 assert.equal(f.events.includes('backup'),false);
 assert.equal(f.events.includes('stop'),false);
 assert.equal(f.events.includes('restore'),false);
 assert.equal(f.installed,previous);
});

function stageArtifactFixture(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-stage-readonly-'));
 const backupBase=path.join(dir,'backups'),backlogBase=path.join(dir,'backlog'),
  leaseBase=path.join(dir,'leases');
 for(const p of [backupBase,backlogBase,leaseBase])fs.mkdirSync(p);
 const requestId='pc-update-staged-test-0001';
 const opts={backupBase,backlogBase,leaseBase};
 const backup=path.join(backupBase,'controller-update-'+requestId);
 const backlog=path.join(backlogBase,requestId+'.json');
 const lease=path.join(leaseBase,'controller-install');
 const inspect=()=>readControllerUpdateArtifacts(requestId,opts);
 const cleanup=()=>fs.rmSync(dir,{recursive:true,force:true});
 return {dir,requestId,opts,backup,backlog,lease,inspect,cleanup};
}
test('stage artifact inspection is read-only, namespaced and does not infer installation',()=>{
 const f=stageArtifactFixture();
 try{
  const result=f.inspect();
  assert.equal(result.status,'OBSERVED');
  assert.equal(result.artifacts.stageRoot,'ABSENT');
  assert.equal(result.backlog.file,'ABSENT');
  assert.equal(result.lease.directory,'ABSENT');
  assert.equal(result.operationalWrites,0);
  assert.equal(result.recoveryComplete,false);
  assert.equal(result.installSuccessProven,false);
  assert.equal(fs.readdirSync(f.opts.backupBase).length,0);
  assert.throws(()=>readControllerUpdateArtifacts('../not-a-request',f.opts),
   {code:'MAINTENANCE_REQUEST_ID'});
 }finally{f.cleanup();}
});
test('STAGED partial intake journal and matching recovery owner are summarized without private bytes',()=>{
 const f=stageArtifactFixture();
 try{
  fs.mkdirSync(path.join(f.backup,'stage'),{recursive:true});
  fs.writeFileSync(path.join(f.backup,'stage','host.json'),'private host contents');
  const ledger={schema:'ZGMINI_PC_BACKLOG_V1',requestId:f.requestId,
   pausedAt:'2026-11-18T04:18:00Z',resumedAt:null,
   windows:[{pausedAt:'2026-11-18T04:18:00Z',resumedAt:null}],replays:{}};
  fs.writeFileSync(f.backlog,JSON.stringify(ledger));
  fs.mkdirSync(f.lease);
  const nonce='01234567-89ab-cdef-0123-456789abcdef';
  fs.writeFileSync(path.join(f.lease,'owner.json'),JSON.stringify({pid:98765,nonce}));
  fs.writeFileSync(path.join(f.lease,'RECOVERY_REQUIRED.json'),
   JSON.stringify({requestOwnerPid:98765,nonce}));
  const result=f.inspect();
  assert.equal(result.status,'OBSERVED');
  assert.equal(result.artifacts.stageRoot,'PRESENT');
  assert.equal(result.artifacts.snapshotRoot,'ABSENT');
  assert.equal(result.artifacts.stagedHost,'PRESENT');
  assert.equal(result.backlog.openWindows,1);
  assert.equal(result.lease.ownerMarkerMatch,true);
  const txt=JSON.stringify(result);
  assert.equal(txt.includes(nonce),false);
  assert.equal(txt.includes('98765'),false);
  assert.equal(txt.includes('private host contents'),false);
  assert.equal(txt.includes(f.dir),false);
  const classified=readMaintenanceRecoveryStatus(f.requestId,{
   readInstalled:()=>previous,
   readLedger:()=>({status:'BLOCKED',firstFail:'STAGED'}),
   readLock:()=>({held:false}),
   readArtifacts:f.inspect,
  });
  assert.equal(classified.guidance.state,'RECOVERY_REVIEW_REQUIRED');
  assert.equal(classified.guidance.blockScope,'SHARED_INSTALL_ONLY');
 }finally{f.cleanup();}
});
test('staged artifacts with invalid or mismatched local records fail closed',()=>{
 const f=stageArtifactFixture();
 try{
  fs.mkdirSync(f.lease);
  fs.writeFileSync(path.join(f.lease,'RECOVERY_REQUIRED.json'),'{}');
  assert.equal(f.inspect().status,'UNVERIFIED');
  fs.writeFileSync(path.join(f.lease,'owner.json'),JSON.stringify({
   pid:33,nonce:'01234567-89ab-cdef-0123-456789abcdef'}));
  assert.equal(f.inspect().lease.ownerMarkerMatch,false);
  fs.writeFileSync(f.backlog,'{not-json');
  assert.equal(f.inspect().backlog.file,'UNVERIFIED');
  const classified=readMaintenanceRecoveryStatus(f.requestId,{
   readInstalled:()=>previous,readLedger:()=>({status:'BLOCKED',firstFail:'STAGED'}),
   readLock:()=>({held:false}),readArtifacts:f.inspect});
  assert.equal(classified.artifactReadbackCode,'UPDATE_ARTIFACTS_UNVERIFIED');
  assert.equal(classified.guidance.state,'STATE_UNKNOWN');
 }finally{f.cleanup();}
});
test('stage path type corruption cannot be treated as absent or completed',()=>{
 const f=stageArtifactFixture();
 try{
  fs.mkdirSync(f.backup);
  fs.writeFileSync(path.join(f.backup,'stage'),'not a directory');
  const result=f.inspect();
  assert.equal(result.artifacts.stageRoot,'UNSAFE');
  assert.equal(result.status,'UNVERIFIED');
  fs.rmSync(path.join(f.backup,'stage'));
  const backlog={schema:'ZGMINI_PC_BACKLOG_V1',requestId:f.requestId,
   windows:[{pausedAt:'2026-11-18T04:18:00Z',resumedAt:'2026-11-18T04:17:00Z'}],replays:{}};
  fs.writeFileSync(f.backlog,JSON.stringify(backlog));
  assert.equal(f.inspect().backlog.file,'UNVERIFIED');
 }finally{f.cleanup();}
});

test('terminal STAGED artifact remains review-required even if install lease is absent',()=>{
 const f=stageArtifactFixture();
 try{
  fs.mkdirSync(path.join(f.backup,'stage'),{recursive:true});
  const artifacts=f.inspect();
  assert.equal(artifacts.status,'OBSERVED');
  const result=readMaintenanceRecoveryStatus(f.requestId,{
   readInstalled:()=>previous,
   readLedger:()=>({status:'BLOCKED',firstFail:'STAGED',installedShaBefore:previous}),
   readLock:()=>({held:false}),
   readArtifacts:()=>artifacts});
  assert.equal(result.guidance.state,'STAGED_EVIDENCE_REVIEW_REQUIRED');
  assert.equal(result.guidance.blockScope,'SHARED_INSTALL_ONLY');
  assert.equal(result.guidance.next,'PRESERVE_STAGE_VERIFY_BACKLOG_INSTALL_LEASE_AND_RUNTIME');
 }finally{f.cleanup();}
});

test('exact approved V2 handoff pins nine checked-out tool bytes and changes only updater',()=>{
 const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
 const installedSha='36cf8ffb813f3a006f3e05379fba641fb3404645';
 const targetSha='732d94aa592723e09c6d776b37f269283dd26e3e';
 const old=JSON.parse(fs.readFileSync(path.join(root,'approvals/maintenance-handoffs',installedSha+'.json'),'utf8'));
 const approved=JSON.parse(fs.readFileSync(path.join(root,'approvals/maintenance-handoffs',targetSha+'.json'),'utf8'));
 const draft=JSON.parse(fs.readFileSync(path.join(root,'drafts/process-coordination','maintenance-handoff-'+targetSha+'.json'),'utf8'));
 assert.equal(draft.approved,false);
 assert.equal(approved.approved,true);
 assert.equal(requireHandoffApproval(approved,targetSha,installedSha),'SEVEN_TO_SEVEN');
 assert.equal(approved.transition,'SEVEN_TO_SEVEN');
 assert.deepEqual(approved.runtimeChangedFiles,['tools/update.mjs']);
 assert.deepEqual(Object.keys(approved.files).sort(),Object.keys(old.files).sort());
 for(const [rel,digest] of Object.entries(approved.files)){
  assert.match(rel,/^tools\/[a-z0-9.-]+$/);
  const actual=createHash('sha256').update(fs.readFileSync(path.join(root,rel))).digest('hex');
  assert.equal(actual,digest,rel);
 }
 const prior=Object.fromEntries(nextRuntimeFiles.map(rel=>[rel,old.files[rel]]));
 assert.deepEqual(approvedRuntimeChanges('SEVEN_TO_SEVEN',prior,approved.files),['tools/update.mjs']);
 assert.equal(approved.files['tools/update.mjs'],
  'aff7b1c51b37be86cebbd8743fcd8561d449da389e2bf63b02bc654f5f7d9425');
 assert.equal(approved.checks.windowsHandoffExecuted,false);
 // A source authorization is not a claim of installation or rollback success.
 assert.match(approved.scopeNote,/NOT PC APPLIED/);
});

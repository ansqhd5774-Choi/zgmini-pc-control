import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {applyApprovedUpdate,maintenanceFailureCode} from '../tools/maintenance-apply.mjs';
import {readMaintenanceRecoveryStatus,backlogPauseWindows,openRollbackPause,
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
test('interrupted journal is only reconciled; never silently retried',async()=>{
 const f=fixture();await f.port.persist({requestId:request.requestId,fingerprint:f.port.fingerprint(request),phase:'SWITCHED',status:'RUNNING'});
 const r=await applyApprovedUpdate(request,f.port);assert.equal(r.status,'RECOVERY_REQUIRED');assert.ok(!f.events.includes('switch'));
});

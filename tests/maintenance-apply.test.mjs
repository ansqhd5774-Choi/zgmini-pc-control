import test from 'node:test';
// Exercise the approved 7/9-field backlog contract through the existing isolated maintenance CI suite.
import './maintenance-backlog-request.test.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {nextRuntimeFiles,requireHandoffApproval,approvedRuntimeChanges} from '../tools/handoff-maintenance.mjs';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {applyApprovedUpdate,maintenanceFailureCode,reconcileInterruptedRollback,runApprovedS6FailoverOnce} from '../tools/maintenance-apply.mjs';
import {isolatedControllerStage,recoveryOperatorProofStatus,waitForSupervisorStopIdle,
 s6PriorRequestLedgerPreserved,normalizeS6OldChildren,
 s6WatchdogPinMatches,s6OwnedLeaseReleaseReadback,
 makeS6OnceOwnedOperatingPort} from '../tools/update.mjs';

test('independent recovery proof keeps strict identity and returns exact sanitized failure categories',()=>{
 assert.deepEqual(recoveryOperatorProofStatus({exitCode:0,stdout:'INDEPENDENT_OPERATOR\r\n'}),{verified:true,code:'RECOVERY_OPERATOR_VERIFIED'});
 for(const input of [{exitCode:2,stdout:'UNKNOWN'},{exitCode:0,stdout:'UNKNOWN'},
  {exitCode:2,stdout:'INDEPENDENT_OPERATOR'},{stdout:'private identity token=SECRET'}]){
  const result=recoveryOperatorProofStatus(input);
  assert.equal(result.verified,false);assert.equal(result.code,'RECOVERY_OPERATOR_ATTESTATION_UNVERIFIED');assert.equal(JSON.stringify(result).includes('SECRET'),false);
 }
 assert.equal(recoveryOperatorProofStatus({errorCode:'ETIMEDOUT'}).code,'RECOVERY_OPERATOR_PROOF_TIMEOUT');
 assert.equal(recoveryOperatorProofStatus({errorCode:'ENOENT'}).code,'RECOVERY_OPERATOR_PROOF_TOOL_UNAVAILABLE');
});

test('actual TEMP candidate namespace permits partial owned files and preserves their bytes',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-isolated-stage-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 fs.mkdirSync(path.join(root,'stage','controller'),{recursive:true});
 const file=path.join(root,'stage','controller','entry.mjs');fs.writeFileSync(file,'partial candidate');
 assert.equal(isolatedControllerStage(root,['controller/entry.mjs']),true);
 assert.equal(fs.readFileSync(file,'utf8'),'partial candidate');
 fs.mkdirSync(path.join(root,'snapshot'));assert.equal(isolatedControllerStage(root,['controller/entry.mjs']),false);
});
test('unknown files, hard links, unavailable paths and invalid planned paths cannot prove isolation',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-isolated-stage-bad-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 fs.mkdirSync(path.join(root,'stage','controller'),{recursive:true});
 const outside=path.join(root,'outside');fs.writeFileSync(outside,'original');
 assert.equal(isolatedControllerStage(root,['controller/entry.mjs']),false);
 fs.linkSync(outside,path.join(root,'stage','controller','entry.mjs'));fs.unlinkSync(outside);
 const second=path.join(root,'stage','controller','other.mjs');fs.linkSync(path.join(root,'stage','controller','entry.mjs'),second);
 assert.equal(isolatedControllerStage(root,['controller/entry.mjs','controller/other.mjs']),false);
 assert.equal(isolatedControllerStage(root,['../outside']),false);
 const io={lstatSync(){throw Object.assign(Error(),{code:'EACCES'})},existsSync:()=>true};
 assert.equal(isolatedControllerStage(root,['controller/entry.mjs'],{io}),false);
});
import {readControllerUpdateArtifacts,confirmExactWorkflowState,readMaintenanceRecoveryStatus,backlogPauseWindows,openRollbackPause,
  closeLatestPause,backlogIssueInPause,prevalidationInventory,admittedMaintenanceIssueState} from '../tools/update.mjs';
import {INSTALLABLE_FILES} from '../tools/maintenance-contract.mjs';

const previous='c'.repeat(40), target='b'.repeat(40);
const request={requestId:'pc-update-simulation-0001',installedSha:previous,targetSha:target};
test('closed source Issue can only be used for separately approved recovery, never new installation',()=>{
 const issue={title:'pc-controller-update',state:'closed',state_reason:'completed'};
 assert.equal(admittedMaintenanceIssueState(issue),false);
 assert.equal(admittedMaintenanceIssueState(issue,{recovery:false}),false);
 assert.equal(admittedMaintenanceIssueState(issue,{recovery:true}),true);
 assert.equal(admittedMaintenanceIssueState({...issue,state:'open'},{recovery:false}),true);
 for(const state_reason of ['not_planned','duplicate',null,undefined]){
  assert.equal(admittedMaintenanceIssueState({...issue,state_reason},{recovery:true}),false);
 }
 assert.equal(admittedMaintenanceIssueState({...issue,state:'closed',title:'pc-job'},{recovery:true}),false);
 assert.equal(admittedMaintenanceIssueState({...issue,state:'draft'},{recovery:true}),false);
 assert.equal(admittedMaintenanceIssueState(null,{recovery:true}),false);
});

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
test('isolated preparation failure preserves artifacts and original intake without stop or restore',async()=>{
 const f=fixture({stage:async()=>{throw Object.assign(Error(),{code:'ENOSPC'});},verifyStagingFailureIsolated:async()=>true});
 const r=await applyApprovedUpdate(request,f.port);
 assert.equal(r.status,'BLOCKED');assert.equal(r.substate,'STAGING_ONLY_ISOLATED_VERIFIED');
 assert.equal(r.code,'UPDATE_STAGE_ENOSPC');assert.equal(r.actualInstalledSha,previous);
 assert.equal(r.candidateArtifactsPreserved,true);assert.equal(r.operatingStateUnchanged,true);
 assert.equal(r.workflowEnabled,true);assert.equal(f.paused,false);
 for(const effect of ['pause','stop','switch','restore','reconnectPrevious','replay-missed-issues'])assert.equal(f.events.includes(effect),false);
});
test('isolation proof cannot override changed runtime, disabled intake or a missing observation',async()=>{
 for(const observed of [{actualControllerSha:target,workflowState:'active'},
  {actualControllerSha:previous,workflowState:'disabled_manually'},{}]){
  const f=fixture({stage:async()=>{throw Error('stage');},verifyStagingFailureIsolated:async()=>true,inspectAfterUncertain:async()=>observed});
  assert.equal((await applyApprovedUpdate(request,f.port)).status,'RECOVERY_REQUIRED');
 }
});
test('failed or unavailable stage namespace proof keeps original recovery requirements',async()=>{
 for(const proof of [async()=>false,async()=>{throw Error('unreadable')}]){
  const f=fixture({stage:async()=>{throw Error('stage');},verifyStagingFailureIsolated:proof});
  assert.equal((await applyApprovedUpdate(request,f.port)).status,'RECOVERY_REQUIRED');
 }
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
    verifyRestoredPrevious:async sha=>installed===sha&&oldRunning,
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
test('bounded idle telemetry is persisted on successful supervisor stop',async()=>{
 const f=fixture({stopOwnSupervisor:async()=>({retryCount:2,elapsedMs:6000,observedBusy:true})});
 const result=await applyApprovedUpdate(request,f.port);
 assert.equal(result.status,'PASS');
 assert.deepEqual(result.supervisorIdleWait,{retryCount:2,elapsedMs:6000,observedBusy:true});
 assert.deepEqual(f.records.get(request.requestId).supervisorIdleWait,result.supervisorIdleWait);
});

test('unverified idle telemetry is not treated as measured',async()=>{
 const f=fixture({stopOwnSupervisor:async()=>({retryCount:-1,elapsedMs:NaN,observedBusy:'yes'})});
 const result=await applyApprovedUpdate(request,f.port);
 assert.equal(result.status,'PASS');
 assert.equal(Object.hasOwn(result,'supervisorIdleWait'),false);
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
test('BACKED_UP runner busy after backup preserves the proven previous runtime and resumes intake',async()=>{
 const f=fixture({
  stopOwnSupervisor:async()=>{throw Object.assign(Error('busy seat'),{code:'RUNNERS_NOT_IDLE'});},
  verifyRestoredPrevious:async sha=>{f.events.push('verify-snapshot-and-owner');return sha===previous;},
  verifyPrevious:async({installedSha,requireRunning,requireIdle})=>{
   f.events.push('verify-previous-online');
   return installedSha===previous&&requireRunning===true&&requireIdle===false;
  },
  restore:async()=>{throw Error('must not overwrite the running original Controller');}
 });
 const out=await applyApprovedUpdate(request,f.port);
 assert.equal(out.status,'BLOCKED');
 assert.equal(out.code,'RUNNERS_NOT_IDLE');
 assert.equal(out.firstFail,'BACKED_UP');
 assert.equal(out.actualInstalledSha,previous);
 assert.equal(out.workflowEnabled,true);
 assert.equal(f.installed,previous);
 assert.equal(f.paused,false);
 assert.ok(f.events.includes('verify-snapshot-and-owner'));
 assert.ok(f.events.includes('verify-previous-online'));
 assert.ok(f.events.includes('replay-missed-issues'));
 for(const forbidden of ['stop','switch','restore','reconnectPrevious'])
  assert.ok(!f.events.includes(forbidden),forbidden);
});
test('BACKED_UP Busy refusal preserves failure telemetry and prior live controller',async()=>{
 const measured={retryCount:10,elapsedMs:30000,observedBusy:true};
 const f=fixture({
  stopOwnSupervisor:async()=>{throw Object.assign(Error('RUNNERS_NOT_IDLE'),{
   code:'RUNNERS_NOT_IDLE',supervisorIdleWait:measured});},
  verifyRestoredPrevious:async sha=>sha===previous,
  verifyPrevious:async({installedSha,requireRunning,requireIdle})=>
   installedSha===previous&&requireRunning===true&&requireIdle===false,
  restore:async()=>{throw Error('must never restore running old Controller');}
 });
 const r=await applyApprovedUpdate(request,f.port);
 assert.equal(r.status,'BLOCKED');assert.equal(r.code,'RUNNERS_NOT_IDLE');
 assert.equal(r.firstFail,'BACKED_UP');assert.equal(r.actualInstalledSha,previous);
 assert.equal(r.workflowEnabled,true);assert.equal(f.installed,previous);
 assert.deepEqual(r.supervisorIdleWait,measured);
 assert.deepEqual(f.records.get(request.requestId).supervisorIdleWait,measured);
 assert.ok(!f.events.includes('switch'));
 assert.ok(!f.events.includes('reconnectPrevious'));
});

test('other stop failures cannot forge Busy telemetry',async()=>{
 const f=fixture({stopOwnSupervisor:async()=>{throw Object.assign(Error('SUPERVISOR_OWNER_CHANGED'),{
  code:'SUPERVISOR_OWNER_CHANGED',
  supervisorIdleWait:{retryCount:10,elapsedMs:30000,observedBusy:true}});}});
 const r=await applyApprovedUpdate(request,f.port);
 assert.equal(r.code,'SUPERVISOR_OWNER_CHANGED');
 assert.equal(Object.hasOwn(r,'supervisorIdleWait'),false);
});

test('BACKED_UP rejected previous-runtime proof freezes before destructive rollback',async()=>{
 const f=fixture({
  stopOwnSupervisor:async()=>{throw Object.assign(Error('busy'),{code:'RUNNERS_NOT_IDLE'});},
  verifyRestoredPrevious:async()=>false,
  restore:async()=>{throw Error('unapproved restore');}
 });
 const out=await applyApprovedUpdate(request,f.port);
 assert.equal(out.status,'RECOVERY_REQUIRED');
 assert.equal(out.firstFail,'BACKED_UP');
 assert.equal(out.code,'RUNNERS_NOT_IDLE');
 assert.equal(out.actualInstalledSha,null);
 assert.equal(f.paused,true);
 assert.ok(!f.events.includes('restore'));
 assert.ok(!f.events.includes('reconnectPrevious'));
 assert.ok(!f.events.includes('switch'));
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
test('W05 BACKED_UP independent recovery accepts previously verified online original while seats are busy',async()=>{
 const observed=[];
 const f=restoredRecovery({verifyPrevious:async opts=>{observed.push(opts);return opts.requireIdle===false;}});
 f.original.firstFail='BACKED_UP';
 const out=await f.run();
 assert.equal(out.status,'ROLLED_BACK');
 assert.equal(out.originalPhase,'BACKED_UP');
 assert.equal(out.existingVersionPreserved,true);
 assert.equal(out.actualInstalledSha,previous);
 assert.equal(out.originalRequestRetried,false);
 assert.ok(!f.calls.includes('restore'));
 assert.ok(!f.calls.includes('reconnectPrevious'));
 assert.ok(f.calls.includes('resumeIntake'));
 assert.ok(f.calls.includes('reconcileBacklog'));
 assert.deepEqual(observed,[
  {installedSha:previous,requireRunning:true,requireIdle:false},
  {installedSha:previous,requireRunning:true,requireIdle:false}]);
});
test('W05 independent recovery refuses unproven original without a destructive switch',async()=>{
 const f=restoredRecovery({
  verifyRestoredPrevious:async()=>false,
  preflightRecoveryRestore:async()=>{throw Object.assign(Error(),{code:'RECOVERY_PROTECTION_PREFLIGHT_CHANGED'});}
 });
 f.original.firstFail='BACKED_UP';
 const out=await f.run();
 assert.equal(out.status,'RECOVERY_REQUIRED');
 assert.equal(out.code,'RECOVERY_PROTECTION_PREFLIGHT_CHANGED');
 assert.ok(!f.calls.includes('restore'));
 assert.ok(!f.calls.includes('reconnectPrevious'));
 assert.ok(!f.calls.includes('resumeIntake'));
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
 assert.equal(options.length,2);assert.equal(options[0].requireIdle,false);
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
 // Verify the approved historical bytes, not later changes at HEAD.
 // Any additional maintainer source change requires an independent B handoff.
 for(const [rel,digest] of Object.entries(approved.files)){
  assert.match(rel,/^tools\/[a-z0-9.-]+$/);
  const historical=execFileSync('git',['show',targetSha+':'+rel],
    {cwd:root,encoding:null,windowsHide:true});
  const actual=createHash('sha256').update(historical).digest('hex');
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

test('historical selective maintainer handoff preserves its two-file immutable approval', async()=>{
 const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
 const installedSha='36cf8ffb813f3a006f3e05379fba641fb3404645';
 const targetSha='a6e7d1a43244520214ea7c7dd3fdd31f9fbbeac6';
 const old=JSON.parse(fs.readFileSync(path.join(root,'approvals/maintenance-handoffs',installedSha+'.json'),'utf8'));
 const file=path.join(root,'approvals/maintenance-handoffs',targetSha+'.json');
 const raw=fs.readFileSync(file);
 const approved=JSON.parse(raw.toString('utf8'));
 const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
 assert.equal(old.targetSha,installedSha);
 assert.equal(approved.approved,true);
 assert.equal(approved.installedSha,installedSha);
 assert.equal(approved.targetSha,targetSha);
 assert.equal(requireHandoffApproval(approved,targetSha,installedSha),'SEVEN_TO_SEVEN');
 assert.deepEqual(approved.runtimeChangedFiles,
  ['tools/maintenance-contract.mjs','tools/update.mjs']);
 assert.deepEqual(Object.keys(approved.files).sort(),Object.keys(old.files).sort());
 assert.equal(Object.keys(approved.files).length,9);
 const prior=Object.fromEntries(nextRuntimeFiles.map(rel=>[rel,old.files[rel]]));
 assert.deepEqual(approvedRuntimeChanges('SEVEN_TO_SEVEN',prior,approved.files),
  approved.runtimeChangedFiles);
 for(const [rel,digest] of Object.entries(approved.files)){
  assert.ok(rel.startsWith('tools/') && !rel.includes('..'),rel);
  const pinned=execFileSync('git',['show',targetSha+':'+rel],
   {cwd:root,encoding:null,windowsHide:true});
  assert.equal(sha(pinned),digest,rel+' pinned source');
  // This is a historical approval, not a prohibition on developing a new
  // version. Actual handoff verifies the selected target's checkout separately
  // in verifyHandoffIsolatedSource; old pins cannot authorize these new bytes.
 }
 for(const rel of nextRuntimeFiles){
  const installed=execFileSync('git',['show',installedSha+':'+rel],
   {cwd:root,encoding:null,windowsHide:true});
  assert.equal(sha(installed),old.files[rel],rel+' installed pin');
 }
 const {validateHandoffIntent}=await import('../tools/runner-watchdog.mjs');
 const request={schema:'ZGMINI_MAINTENANCE_HANDOFF_REQUEST_V1',
  requestId:'pc-handoff-aaaaaaaa-bbbb-4ccc-8ddd-0123456789ab',
  operation:'maintenance-handoff',targetSha,
  approvalManifestSha256:sha(raw)};
 const issue={title:'pc-maintenance-handoff',state:'OPEN',
  author:{login:'ansqhd5774-Choi'},labels:[{name:'pc-maintenance'}]};
 assert.equal(validateHandoffIntent(issue,request,approved,{sourceSha:installedSha},sha(raw)).targetSha,
  targetSha);
 assert.throws(()=>validateHandoffIntent(issue,{...request,
  approvalManifestSha256:'0'.repeat(64)},approved,{sourceSha:installedSha},sha(raw)),
  /HANDOFF_APPROVAL_BYTES_OR_SOURCE_MISMATCH/);
 assert.throws(()=>validateHandoffIntent(issue,request,approved,{sourceSha:targetSha},sha(raw)),
  /HANDOFF_APPROVAL_BYTES_OR_SOURCE_MISMATCH/);
});

test('verified terminal postcheck failure restores service without waiting for a missing upload',async()=>{
 const f=fixture({postcheck:async()=>{throw Object.assign(Error('verified'),{code:'POSTCHECK_EXECUTION_FAILED_VERIFIED',postcheckFailureEvidence:{issueNumber:42,runId:10,jobId:20,runnerName:'zgmini-pc-06'}});}});
 const out=await applyApprovedUpdate(request,f.port);
 assert.equal(out.status,'ROLLED_BACK');assert.equal(out.originalFailureCode,'POSTCHECK_EXECUTION_FAILED_VERIFIED');
 assert.equal(out.rollbackFailureCode,null);assert.equal(out.actualInstalledSha,previous);assert.equal(f.paused,false);
 assert.equal(out.nextAction,'PREVIOUS_VERSION_RESTORED_CONTINUE_APPROVED_WORK');assert.equal(out.postcheckFailureEvidence.jobId,20);
});
test('rollback failure retains both the original defect and exact restore failure',async()=>{
 const f=fixture({postcheck:async()=>({status:'FAIL'}),restore:async()=>{throw Object.assign(Error('bad snapshot'),{code:'BACKUP_CAS_DRIFT'});}});
 const out=await applyApprovedUpdate(request,f.port);
 assert.equal(out.status,'RECOVERY_REQUIRED');assert.equal(out.originalFailureCode,'POSTCHECK_NOT_VERIFIED');
 assert.equal(out.rollbackFailureCode,'BACKUP_CAS_DRIFT');assert.equal(out.rollbackFailureOperation,'restore');
 assert.equal(out.actualInstalledSha,null);
});
test('restored intake can accept normal busy jobs without invalidating rollback',async()=>{
 let last=null;const f=fixture();const verify=f.port.verifyPrevious;
 f.port.verifyPrevious=async o=>{last=o;return verify(o)};
 f.port.postcheck=async()=>({status:'FAIL'});
 const out=await applyApprovedUpdate(request,f.port);
 assert.equal(out.status,'ROLLED_BACK');assert.equal(last.requireIdle,false);
});

const idleRaceSeats=()=>Array.from({length:6},(_,i)=>({
 name:`zgmini-pc-0${i+1}`,status:'online',busy:false
}));

test('drain and final stop both require Online seats before Supervisor mutation',()=>{
 const source=fs.readFileSync(new URL('../tools/update.mjs',import.meta.url),'utf8');
 const drain=source.split('  waitForDrain:async()=>{')[1]?.split('  backup:async()=>{')[0];
 const stop=source.split('  stopOwnSupervisor:async()=>{')[1]?.split('  switchVersion:async()=>{')[0];
 assert.match(drain??'',/need\(seats\.every\(x=>x\.status==='online'\),'RUNNERS_NOT_ONLINE'\)/);
 assert.ok(stop?.includes('await waitForSupervisorStopIdle('));
 assert.ok(stop.indexOf('await waitForSupervisorStopIdle(')<stop.indexOf("execFileSync('taskkill.exe'"));
 assert.ok(stop.includes('process.kill(oldOwner.owner.pid,0)'));
 assert.ok(!stop.includes('process.kill(current.owner.pid,0)'));
});

test('a briefly Busy runner can settle after backup without an unguarded stop',async()=>{
 let clock=0,reads=0,checks=0;
 const observed=await waitForSupervisorStopIdle({
  readRunners:()=>{const rows=idleRaceSeats();if(++reads<3)rows[2].busy=true;return rows;},
  verifySafety:()=>{checks++;},now:()=>clock,pause:async ms=>{clock+=ms;}
 });
 assert.equal(clock,6000);
 assert.equal(reads,3);
 assert.equal(checks,3);
 assert.deepEqual(observed,{retryCount:2,elapsedMs:6000,observedBusy:true});
});

test('an immediately Idle Runner records zero retry and zero elapsed time',async()=>{
 const observed=await waitForSupervisorStopIdle({
  readRunners:idleRaceSeats,verifySafety:()=>{},now:()=>0,
  pause:async()=>{throw Error('unexpected pause');}
 });
 assert.deepEqual(observed,{retryCount:0,elapsedMs:0,observedBusy:false});
});

test('a persistently Busy runner is refused after at most 30 seconds',async()=>{
 let clock=0,reads=0;
 await assert.rejects(waitForSupervisorStopIdle({
  readRunners:()=>{const rows=idleRaceSeats();reads++;rows[0].busy=true;return rows;},
  verifySafety:()=>{},now:()=>clock,pause:async ms=>{clock+=ms;}
 }),error=>{
  assert.equal(error.code,'RUNNERS_NOT_IDLE');
  assert.deepEqual(error.supervisorIdleWait,{retryCount:10,elapsedMs:30000,observedBusy:true});
  return true;
 });
 assert.equal(clock,30000);
 assert.equal(reads,11);
});

test('Offline or missing Runner prevents stop without waiting',async()=>{
 for(const inventory of [
  ()=>{const rows=idleRaceSeats();rows[4].status='offline';return rows;},
  ()=>idleRaceSeats().slice(1)
 ]){
  let waits=0;
  await assert.rejects(waitForSupervisorStopIdle({
   readRunners:inventory,verifySafety:()=>{},now:()=>0,pause:async()=>{waits++;}
  }),{code:'RUNNERS_NOT_ONLINE'});
  assert.equal(waits,0);
 }
});

test('owner or protection drift aborts next idle retry before readback or stop',async()=>{
 for(const kind of ['SUPERVISOR_OWNER_CHANGED','PROTECTED_STATE_DRIFT']){
  let clock=0,reads=0,checks=0;
  await assert.rejects(waitForSupervisorStopIdle({
   readRunners:()=>{const rows=idleRaceSeats();reads++;rows[1].busy=true;return rows;},
   verifySafety:()=>{if(++checks===2){const e=Error(kind);e.code=kind;throw e;}},
   now:()=>clock,pause:async ms=>{clock+=ms;}
  }),{code:kind});
  assert.equal(clock,3000);
  assert.equal(reads,1);
 }
});


// The one-shot S6 coordinator uses only injectable ports. None of these tests
// touches operating-PC processes, GitHub intake, install leases or source.
const S6_TS=Date.parse('2026-11-26T12:35:00.000Z');
const s6Request=()=>({
 operation:'controller-s6-failover-once',
 requestId:'pc-s6-11111111-2222-4333-8444-555555555555'
});
const s6Base=()=>({
 requestId:s6Request().requestId,controllerSha:'a'.repeat(40),
 approvalManifestSha256:'b'.repeat(64),protectedSha256:'c'.repeat(64),
 oldSupervisorPid:41001,
 oldSupervisorNonce:'11111111-2222-4333-8444-555555555555',
 watchdogPid:41002,standbyPids:[41003,41004]
});
function s6Observe(phase,{fast=false,failPre=false,failHeld=false,failPromoted=false}={}){
 const b=s6Base();
 const snap={
  requestId:b.requestId,controllerSha:b.controllerSha,
  protectedSha256:b.protectedSha256,watchdogPid:b.watchdogPid,
  oldSupervisorNonce:b.oldSupervisorNonce,oldOwnerIdentityMatched:true,
  relatedLeasesAbsent:true,pendingWorkCount:0,
  independentOperatorAttested:true,exactApprovalBytesAttested:true,
  observedAtUtc:new Date(S6_TS-1000).toISOString(),
  workflowState:'active',maintenanceLeaseHeld:false,
  watchdogPaused:false,controllerDraining:false,oldSupervisorAlive:true,
  activeSupervisorPid:b.oldSupervisorPid,heartbeatFresh:true,
  standbyReadyCount:2,standbyOwnersUnique:true,
  runnerSeats:Array.from({length:6},(_,i)=>({
   seat:i+1,name:'zgmini-pc-0'+(i+1),status:'online',busy:false
  }))
 };
 if(phase==='PRE_DRAIN')return failPre?{
  ...snap,runnerSeats:[...snap.runnerSeats.slice(0,5),{...snap.runnerSeats[5],busy:true}]
 }:snap;
 const stopped={
  ...snap,oldSupervisorAlive:false,oldSixChildrenStopped:true,
  runnerExecutableProof:'NO_CONTROLLER_RUNNER_PROCESS',
  workflowState:'disabled_manually',maintenanceLeaseHeld:true,
  watchdogPaused:!failHeld
 };
 if(phase==='STOPPED_HELD')return stopped;
 const release={...stopped,workflowState:'active',
  maintenanceLeaseHeld:false,watchdogPaused:false};
 if(phase==='WATCHDOG_RELEASED')return fast?{
  ...release,runnerExecutableProof:'ACTIVE_RUNNER_PROCESS'
 }:release;
 if(phase==='PROMOTED')return {
  ...release,oldSupervisorAlive:false,oldSixChildrenStopped:true,
  activeSupervisorPid:41003,activeOwnerNonceChanged:true,
  newOwnerNonce:'99999999-2222-4333-8444-555555555555',
  watchdogStatusHealthy:!failPromoted,standbyReadyCount:1,
  previousOwnerFenced:true,existingRequestLedgerPreserved:true
 };
 throw Error('UNEXPECTED_TEST_PHASE');
}
function s6Fixture(options={}){
 const calls=[],journal=[];
 const add=x=>(calls.push(x),true);
 const port={
  now:()=>S6_TS,
  read:async()=>{add('read');return options.prior??null;},
  attestApproval:async()=>{add('attestApproval');return options.approval!==false;},
  captureBaseline:async()=>{add('captureBaseline');return s6Base();},
  observe:async phase=>{add('observe:'+phase);
   return s6Observe(phase,options);
  },
  claimOnce:async()=>{add('claimOnce');return options.claim!==false;},
  acquireOwnedInstallLease:async()=>{add('acquireOwnedInstallLease');
   if(options.failAcquire)throw Object.assign(Error('S6_TEST_INSTALL_LEASE_UNKNOWN'),{code:'S6_TEST_INSTALL_LEASE_UNKNOWN'});
  },
  persist:async entry=>{journal.push(entry);add('persist:'+entry.phase);
   if(options.failPersist===entry.phase)throw Object.assign(Error('S6_TEST_JOURNAL_FAIL'),{code:'S6_TEST_JOURNAL_FAIL'});
  },
  pauseIntake:async()=>{add('pauseIntake');if(options.failPause)throw Object.assign(Error('S6_TEST_PAUSE_UNKNOWN'),{code:'S6_TEST_PAUSE_UNKNOWN'});},
  waitForDrain:async()=>{add('waitForDrain');},
  verifyStopGuard:async()=>{add('verifyStopGuard');return options.stopGuard!==false;},
  stopOwnTree:async()=>{add('stopOwnTree');if(options.failStop)throw Object.assign(Error('S6_TEST_STOP_UNKNOWN'),{code:'S6_TEST_STOP_UNKNOWN'});},
  waitForStoppedHeld:async()=>{add('waitForStoppedHeld');if(options.failWaitStopped)throw Object.assign(Error('S6_TEST_STOPPED_WAIT_TIMEOUT'),{code:'S6_TEST_STOPPED_WAIT_TIMEOUT'});},
  resumeIntake:async()=>{add('resumeIntake');},
  verifyReleaseGuard:async()=>{add('verifyReleaseGuard');return options.releaseGuard!==false;},
  releaseOwnedInstallLease:async()=>{add('releaseOwnedInstallLease');
   if(options.failRelease)throw Object.assign(Error('S6_TEST_RELEASE_UNKNOWN'),{code:'S6_TEST_RELEASE_UNKNOWN'});
  },
  waitForPromotion:async()=>{add('waitForPromotion');}
 };
 return {port,calls,journal};
}
test('S6 coordinator keeps exact one-shot owner transitions and never marks the A job complete',async()=>{
 const {port,calls,journal}=s6Fixture();
 const r=await runApprovedS6FailoverOnce(s6Request(),port);
 assert.equal(r.status,'POSTCHECK_PENDING');
 assert.equal(r.code,'S6_ONCE_PROMOTION_OBSERVED_A_JOB_PENDING');
 assert.equal(r.failoverTested,false);
 assert.equal(r.promotionApproved,false);
 assert.equal(r.leaseReleaseAcknowledged,true);
 assert.equal(calls.filter(x=>x==='stopOwnTree').length,1);
 assert.equal(calls.filter(x=>x==='releaseOwnedInstallLease').length,1);
 assert.ok(calls.indexOf('acquireOwnedInstallLease')<calls.indexOf('pauseIntake'));
 assert.ok(calls.indexOf('pauseIntake')<calls.indexOf('waitForDrain'));
 assert.ok(calls.indexOf('waitForDrain')<calls.indexOf('verifyStopGuard'));
 assert.ok(calls.indexOf('verifyStopGuard')<calls.indexOf('stopOwnTree'));
 assert.ok(calls.indexOf('stopOwnTree')<calls.indexOf('waitForStoppedHeld'));
 assert.ok(calls.indexOf('waitForStoppedHeld')<calls.indexOf('observe:STOPPED_HELD'));
 assert.ok(calls.indexOf('observe:STOPPED_HELD')<calls.indexOf('resumeIntake'));
 assert.ok(calls.indexOf('resumeIntake')<calls.indexOf('verifyReleaseGuard'));
 assert.ok(calls.indexOf('verifyReleaseGuard')<calls.indexOf('releaseOwnedInstallLease'));
 assert.ok(calls.indexOf('releaseOwnedInstallLease')<calls.indexOf('waitForPromotion'));
 assert.deepEqual(journal.at(-1).phase,'PROMOTED_READBACK_VERIFIED');
 assert.equal(journal.at(-1).status,'POSTCHECK_PENDING');
});
test('S6 coordinator refuses duplicate, wrong operation, unverifiable approval or busy seats without effect',async()=>{
 for(const [request,opts,code] of [
  [{...s6Request(),operation:'controller-update'}, {}, 'S6_ONCE_REQUEST_INVALID'],
  [s6Request(),{prior:{phase:'STOPPED_HELD'}},'S6_ONCE_EXISTING_CLAIM_RECONCILE'],
  [s6Request(),{approval:false},'S6_ONCE_EXACT_APPROVAL_OR_OPERATOR_UNVERIFIED'],
  [s6Request(),{failPre:true},'S6_SIX_RUNNERS_NOT_IDLE_VERIFIED'],
  [s6Request(),{claim:false},'S6_ONCE_CLAIM_OUTCOME_UNVERIFIED']
 ]){
  const {port,calls}=s6Fixture(opts);
  const r=await runApprovedS6FailoverOnce(request,port);
  assert.equal(r.code,code);
  assert.equal(r.failoverTested,false);
  assert.equal(calls.includes('pauseIntake'),false);
  assert.equal(calls.includes('stopOwnTree'),false);
  assert.equal(calls.includes('releaseOwnedInstallLease'),false);
 }
});
test('S6 coordinator never releases install lease after uncertain pause, stop, WMI or release guard',async()=>{
 for(const opts of [
  {failAcquire:true},{failPause:true},{stopGuard:false},{failStop:true},
  {failWaitStopped:true},
  {failHeld:true},{releaseGuard:false}
 ]){
  const {port,calls,journal}=s6Fixture(opts);
  const r=await runApprovedS6FailoverOnce(s6Request(),port);
  assert.equal(r.status,'RECOVERY_REQUIRED',JSON.stringify({opts,r}));
  assert.equal(r.leaseReleaseAcknowledged,false);
  assert.equal(calls.includes('releaseOwnedInstallLease'),false);
  assert.equal(calls.filter(x=>x==='stopOwnTree').length<=1,true);
  assert.equal(journal.at(-1).phase,'RECOVERY_REQUIRED');
 }
});
test('S6 coordinator cannot retry ambiguous owned lease release',async()=>{
 const {port,calls,journal}=s6Fixture({failRelease:true});
 const r=await runApprovedS6FailoverOnce(s6Request(),port);
 assert.equal(r.status,'RECOVERY_REQUIRED');
 assert.equal(r.leaseReleaseAcknowledged,false); // false means not attested, not proved held
 assert.equal(calls.filter(x=>x==='releaseOwnedInstallLease').length,1);
 assert.equal(calls.includes('waitForPromotion'),false);
 assert.equal(journal.at(-1).phase,'RECOVERY_REQUIRED');
});
test('S6 coordinator allows a fast unique promotion without inventing a missing release interval',async()=>{
 const {port,calls,journal}=s6Fixture({fast:true});
 const r=await runApprovedS6FailoverOnce(s6Request(),port);
 assert.equal(r.status,'POSTCHECK_PENDING');
 assert.equal(calls.includes('waitForPromotion'),false);
 assert.equal(journal.some(x=>x.phase==='FAST_PROMOTION_OBSERVED'),true);
 assert.equal(r.failoverTested,false);
});
test('S6 coordinator reports uncertain promotion and does not stop another tree',async()=>{
 const {port,calls,journal}=s6Fixture({failPromoted:true});
 const r=await runApprovedS6FailoverOnce(s6Request(),port);
 assert.equal(r.status,'RECOVERY_REQUIRED');
 assert.equal(r.leaseReleaseAcknowledged,true);
 assert.equal(calls.filter(x=>x==='stopOwnTree').length,1);
 assert.equal(calls.filter(x=>x==='releaseOwnedInstallLease').length,1);
 assert.equal(journal.at(-1).phase,'RECOVERY_REQUIRED');
 assert.equal(r.failoverTested,false);
});


test('S6 does not open intake-pause or old process stop before owned install lease is attested',async()=>{
 const {port,calls,journal}=s6Fixture({failAcquire:true});
 const result=await runApprovedS6FailoverOnce(s6Request(),port);
 assert.equal(result.status,'RECOVERY_REQUIRED');
 assert.equal(result.failoverTested,false);
 assert.equal(result.leaseReleaseAcknowledged,false);
 assert.equal(calls.filter(x=>x==='acquireOwnedInstallLease').length,1);
 assert.equal(calls.includes('pauseIntake'),false);
 assert.equal(calls.includes('stopOwnTree'),false);
 assert.equal(calls.includes('releaseOwnedInstallLease'),false);
 assert.equal(journal.at(-1).phase,'RECOVERY_REQUIRED');
});


test('S6 old Runner and Watchdog pause proof waits only read-only before owned release',async()=>{
 const {port,calls,journal}=s6Fixture({failWaitStopped:true});
 const result=await runApprovedS6FailoverOnce(s6Request(),port);
 assert.equal(result.status,'RECOVERY_REQUIRED');
 assert.equal(result.leaseReleaseAcknowledged,false);
 assert.equal(calls.filter(x=>x==='stopOwnTree').length,1);
 assert.equal(calls.filter(x=>x==='waitForStoppedHeld').length,1);
 assert.equal(calls.includes('observe:STOPPED_HELD'),false);
 assert.equal(calls.includes('resumeIntake'),false);
 assert.equal(calls.includes('releaseOwnedInstallLease'),false);
 assert.equal(journal.at(-1).phase,'RECOVERY_REQUIRED');
});


test('S6 readonly PC preflight checks deployed Watchdog bytes, not just INSTALL pin or stale process status',()=>{
 const src=fs.readFileSync(new URL('../tools/update.mjs',import.meta.url),'utf8');
 const start=src.indexOf('export function readS6OnceCurrentPreimage(');
 const end=src.indexOf('export async function command(',start);
 assert.ok(start>=0&&end>start);
 const body=src.slice(start,end);
 assert.match(body,/sha256\(fs\.readFileSync\(path\.join\(wdHome,'runner-watchdog\.mjs'\)\)\)===wdInstall\.sha256/);
 assert.match(body,/wdStatus\.standbyReadyCount===2/);
 assert.match(body,/verifyIndependent\(owner\.pid\)/);
 assert.match(body,/requireCompleteRunnerInventory/);
 assert.match(body,/maintenanceLockStatus\(maintenanceRoot,'controller-install'\)/);
 assert.match(body,/protectedSnapshot\(\)/);
 assert.doesNotMatch(body,/taskkill|fs\.unlinkSync|fs\.renameSync|spawn\(|\.release\(/);
});


test('S6 existing requestId ledger hashes retain original bytes even after new A job is added',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-s6-ledger-test-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const id='pc-test-11111111-2222-4333-8444-555555555555.json';
 const file=path.join(root,id);
 const raw=Buffer.from('{"schema":"ZGMINI_PC_RESULT_V1","status":"PASS"}\n');
 fs.writeFileSync(file,raw);
 const pinned={[id]:createHash('sha256').update(raw).digest('hex')};
 assert.equal(s6PriorRequestLedgerPreserved(pinned,{root}),true);
 fs.writeFileSync(path.join(root,'pc-new-abcdef12-3456-4321-8123-abcdefabcdef.json'),
  'new authorized result');
 assert.equal(s6PriorRequestLedgerPreserved(pinned,{root}),true);
 fs.writeFileSync(file,'{"status":"FAIL"}');
 assert.equal(s6PriorRequestLedgerPreserved(pinned,{root}),false);
 fs.unlinkSync(file);
 assert.equal(s6PriorRequestLedgerPreserved(pinned,{root}),false);
});
test('S6 ledger readback fails closed for traversal, malformed SHA and symlinked ledger data',()=>{
 const fake={
  lstatSync:()=>({isFile:()=>true,isSymbolicLink:()=>true}),
  readFileSync:()=>Buffer.from('never read')
 };
 const digest='a'.repeat(64),root='X:/S6-test-ledger';
 assert.equal(s6PriorRequestLedgerPreserved({'../owner.json':digest},{root,io:fake}),false);
 assert.equal(s6PriorRequestLedgerPreserved({'pc-test-abcdef12.json':'invalid'},{root,io:fake}),false);
 assert.equal(s6PriorRequestLedgerPreserved({'pc-test-abcdef12.json':digest},{root,io:fake}),false);
 assert.equal(s6PriorRequestLedgerPreserved(null,{root,io:fake}),false);
});
test('S6 local readback uses actual deployed Watchdog WMI and never publishes a synthetic pass',()=>{
 const s=fs.readFileSync(new URL('../tools/update.mjs',import.meta.url),'utf8');
 const begin=s.indexOf('export async function readS6OncePhaseReadback(');
 const end=s.indexOf('export async function command(',begin);
 assert.ok(begin>0&&end>begin);
 const code=s.slice(begin,end);
 assert.match(code,/sha256\(verifiedWatchdogBytes\)===wdInstall\.sha256/);
 assert.match(code,/import\('data:text\/javascript;base64,'\+/);
 assert.match(code,/watchdogModule|wdModule\.scanControllerRunnersReadOnly\(\)/);
 assert.match(code,/oldSixChildrenStopped/);
 assert.match(code,/oldOwnerArchived/);
 assert.match(code,/existingRequestLedgerPreserved/);
 assert.match(code,/previousOwnerFenced/);
 assert.match(code,/exactApprovalBytesAttested===true&&independentOperatorAttested===true/);
 assert.doesNotMatch(code,/taskkill|fs\.unlinkSync|fs\.renameSync|fs\.writeFileSync|spawn\(/);
});


test('S6 six original Runner child seats are canonicalized despite Windows Supervisor Map reinsertion',()=>{
 const orig=Array.from({length:6},(_,i)=>({
  seat:i+1,pid:51001+i,alive:true
 }));
 // Restart of seat 2 deletes/reinserts the Map entry at the end.
 const resumed=[orig[0],...orig.slice(2),{...orig[1],pid:52002}];
 const actual=normalizeS6OldChildren(resumed,{requireAlive:true});
 assert.deepEqual(actual,[orig[0],{seat:2,pid:52002},...orig.slice(2)].map(x=>({
  seat:x.seat,pid:x.pid
 })));
 assert.equal(normalizeS6OldChildren([...resumed.slice(0,5)],{requireAlive:true}),null);
 assert.equal(normalizeS6OldChildren([...resumed.slice(0,5),{...orig[0]}]),null);
 assert.equal(normalizeS6OldChildren([...resumed.slice(0,5),{seat:2,pid:51001}]),null);
 assert.equal(normalizeS6OldChildren([...resumed.slice(0,5),{seat:7,pid:61000}]),null);
 assert.equal(normalizeS6OldChildren([...resumed.slice(0,5),{...resumed[5],alive:false}],{
  requireAlive:true}),null);
 assert.notEqual(normalizeS6OldChildren(resumed),null);
});


test('S6 Watchdog approval pin rejects replaced source, receiver nonce and recycled PID',()=>{
 const baseline={watchdogSourceSha256:'a'.repeat(64),
  watchdogReceiverNonce:'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',watchdogPid:21001};
 const install={sha256:baseline.watchdogSourceSha256};
 const receiver={pid:baseline.watchdogPid,nonce:baseline.watchdogReceiverNonce};
 const status={pid:baseline.watchdogPid,state:'HEALTHY'};
 const good={baseline,install,receiver,status,sourceSha256:install.sha256};
 assert.equal(s6WatchdogPinMatches(good),true);
 for(const altered of [
  {install:{sha256:'b'.repeat(64)}},
  {sourceSha256:'b'.repeat(64)},
  {receiver:{...receiver,nonce:'ffffffff-bbbb-4ccc-8ddd-eeeeeeeeeeee'}},
  {receiver:{...receiver,pid:21009}},
  {status:{...status,pid:21009}},
  {baseline:{...baseline,watchdogSourceSha256:'invalid'}},
  {baseline:{...baseline,watchdogReceiverNonce:'invalid'}},
  {baseline:{...baseline,watchdogPid:null}}
 ])assert.equal(s6WatchdogPinMatches({...good,...altered}),false,
  JSON.stringify(altered));
});


test('S6 owned release requires exact old owner, empty WMI, preserved ledger and same B operator source',()=>{
 const now=Date.parse('2026-11-26T13:00:00Z');
 const baseline={
  requestId:'pc-s6-12345678-aaaa-4ccc-8ddd-123456789abc',
  controllerSha:'a'.repeat(40),protectedSha256:'b'.repeat(64),
  watchdogPid:13001,oldSupervisorNonce:'11111111-2222-4333-8444-555555555555'
 };
 const snap={
  requestId:baseline.requestId,controllerSha:baseline.controllerSha,
  protectedSha256:baseline.protectedSha256,
  watchdogPid:baseline.watchdogPid,
  oldSupervisorNonce:baseline.oldSupervisorNonce,
  oldOwnerIdentityMatched:true,independentOperatorAttested:true,
  exactApprovalBytesAttested:true,
  observedAtUtc:new Date(now-1000).toISOString(),
  oldSupervisorAlive:false,oldSixChildrenStopped:true,
  runnerExecutableProof:'NO_CONTROLLER_RUNNER_PROCESS',
  watchdogPaused:true,maintenanceLeaseHeld:true,
  workflowState:'active',controllerDraining:false,
  relatedLeasesAbsent:true,existingRequestLedgerPreserved:true,
  pendingWorkCount:1 // newly queued legitimate A job is not old Writer activity
 };
 assert.equal(s6OwnedLeaseReleaseReadback(snap,baseline,{now}),true);
 for(const change of [
  {requestId:'pc-s6-mismatch'},{controllerSha:'c'.repeat(40)},
  {protectedSha256:'c'.repeat(64)},{watchdogPid:13002},
  {oldSupervisorNonce:'99999999-2222-4333-8444-555555555555'},
  {oldOwnerIdentityMatched:false},{independentOperatorAttested:false},
  {exactApprovalBytesAttested:false},
  {oldSupervisorAlive:true},{oldSixChildrenStopped:false},
  {runnerExecutableProof:'UNVERIFIED'},
  {runnerExecutableProof:'ACTIVE_RUNNER_PROCESS'},
  {watchdogPaused:false},{maintenanceLeaseHeld:false},
  {workflowState:'disabled_manually'},{controllerDraining:true},
  {relatedLeasesAbsent:false},{existingRequestLedgerPreserved:false},
  {observedAtUtc:new Date(now-46000).toISOString()},
  {observedAtUtc:new Date(now+1000).toISOString()}
 ])assert.equal(s6OwnedLeaseReleaseReadback({...snap,...change},baseline,{now}),false,
  JSON.stringify(change));
 assert.equal(s6OwnedLeaseReleaseReadback(null,baseline,{now}),false);
 assert.equal(s6OwnedLeaseReleaseReadback(snap,null,{now}),false);
});
test('S6 live operating-port entry is not available to CI or Runner and has no direct CLI dispatch',()=>{
 assert.throws(()=>makeS6OnceOwnedOperatingPort({}),/S6_PORT_INDEPENDENT_WINDOWS_ONLY|S6_PORT_OPERATOR_OR_ISSUE_UNVERIFIED/);
 const src=fs.readFileSync(new URL('../tools/update.mjs',import.meta.url),'utf8');
 const b=src.indexOf('export function makeS6OnceOwnedOperatingPort(');
 const e=src.indexOf('export async function command(',b);
 assert.ok(b>=0&&e>b);
 const body=src.slice(b,e);
 assert.match(body,/validateS6OnceIssueEnvelope/);
 assert.match(body,/validateS6OnceBManifest/);
 assert.match(body,/verifyIndependent/);
 assert.match(body,/assertRemoteBPin/);
 for(const [start,end] of [['pauseIntake:async','waitForDrain:async'],
  ['stopOwnTree:async','waitForStoppedHeld:async'],
  ['releaseOwnedInstallLease:async','waitForPromotion:async']]){
  const from=body.indexOf(start),to=body.indexOf(end,from);
  assert.ok(from>=0&&to>from);
  assert.match(body.slice(from,to),/assertRemoteBPin\(\)/);
 }

 assert.match(body,/acquireMaintenanceLock\(maintenanceRoot,'controller-install'\)/);
 assert.match(body,/path\.win32\.join\(systemRoot,'System32','taskkill\.exe'\)/);
 assert.match(body,/S6_PORT_SYSTEMROOT_UNVERIFIED/);
 assert.match(body,/s6OwnedLeaseReleaseReadback\(snap,baseline\)/);
 assert.match(body,/case.*claim|claimOnce:/);
 assert.doesNotMatch(src.slice(e),/if\(cmd==='s6-once-apply'\)/);
});

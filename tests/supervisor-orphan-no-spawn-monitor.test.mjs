import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {assessNoSpawnMonitorSnapshot,decideNoSpawnMonitorFailure}
 from '../controller/orphan-no-spawn-monitor-contract.mjs';

const now=Date.parse('2026-11-26T23:45:12Z');
const h=x=>x.repeat(64);
const stamp='2026-11-26T23:45:10Z';
const six=()=>Array.from({length:6},(_,i)=>({
 seat:i+1,pid:4010+i,startedAtUtc:'2026-11-26T22:57:00Z',
 canonicalPathSha256:String.fromCharCode(97+i).repeat(64)
}));
const good=()=>({
 now,observedAt:stamp,
 preimage:{controllerSourceSha:'a'.repeat(40),
  ownerRecordSha256:h('a'),hostManifestSha256:h('b'),
  heartbeatSha256:h('c'),stableAtRead:true},
 approvedPreimage:{scope:'SEPARATELY_APPROVED_ORPHAN_RECOVERY_B',
  approvalVerified:true,ownerRecordSha256:h('a'),
  hostManifestSha256:h('b'),heartbeatSha256:h('c')},
 installed:{controllerSourceSha:'a'.repeat(40),controllerFilesVerified:true},
 oldOwner:{pid:8888,deadVerified:true,sameBootVerified:true,
  historicalSixSeatsVerified:true,lastHeartbeatAt:'2026-11-26T23:00:00Z'},
 newOwner:{pid:9000,aliveVerified:true,sameBootVerified:true,
  recoveryMode:'ADOPT_EXISTING_SIX_NO_SPAWN',
  startedAtUtc:'2026-11-26T23:45:00Z',noRunnerLaunchObserved:true},
 watcher:{watchdogOwnerVerified:true,installedR6SourceVerified:true,
  singleWatchdogOwnerVerified:true,noStandbyPromotionPendingVerified:true},
 privateLineage:{source:'PRIVATE_APPROVED_WINDOWS_B_ATTESTATION',
  inheritedNonceMatchesOldOwner:true,newOwnerNonceMatchesInherited:true,
  newOwnerNoSpawnSourceVerified:true,
  sixOriginalListenerBirthTimesPinned:true},
 controllerSeatPins:six(),
 liveWmi:{source:'WIN32_PROCESS_PRIVATE_SAME_HOST',
  completeControllerRootsVerified:true,extraControllerListenerCount:0,
  unknownControllerPathCount:0,rows:six().map(x=>({...x,alive:true}))},
 lease:{newOwnerBytesSha256:h('d'),newOwnerPid:9000,
  newOwnerMatchesLiveProcess:true,sameOwnerNonceContinuityVerified:true,
  claimExactCasReadback:true,singleRecoveryOperatorVerified:true,
  uninterruptedRecoveryLeaseVerified:true},
 gitHubRoster:{fixedSixOnline:true},
 installation:{independentMaintainerVerified:true,controllerSourceUnchanged:true,
  installLeaseHeld:false,workflowState:'active'},
 relatedLeases:0,activeControllerWorkers:1
});

test('all six unchanged Runner processes yield monitoring candidate only',()=>{
 const result=assessNoSpawnMonitorSnapshot(good());
 assert.equal(result.status,'CANDIDATE_ONLY');
 assert.equal(result.code,'NO_SPAWN_MONITOR_ALL_SIX_IDENTITIES_CONTINUOUS');
 assert.equal(result.exactSeatIdentityCount,6);
 assert.equal(result.activeControllerWorkers,1);
 assert.equal(result.monitoringCandidate,true);
 for(const name of ['effectAuthorized','controllerJobAdmissionVerified',
  'heartbeatWriteAuthorized','supervisorSpawnAuthorized',
  'runnerStopAuthorized','leaseMutationAuthorized',
  'watchdogPromotionAuthorized'])
  assert.equal(result[name],false,name);
 assert.equal(result.operationalWrites,0);
 assert.doesNotMatch(JSON.stringify(result),/4010|9000|8888|WIN32_PROCESS|PRIVATE_APPROVED|E:\\/);
});

test('new Supervisor and historical owner must be exact live/dead identities',()=>{
 const mutations=[
  x=>{x.newOwner.pid=8888;},
  x=>{x.newOwner.pid=0;},
  x=>{x.newOwner.aliveVerified=false;},
  x=>{x.newOwner.sameBootVerified=false;},
  x=>{x.newOwner.recoveryMode='NORMAL_SPAWN_SIX';},
  x=>{x.newOwner.noRunnerLaunchObserved=false;},
  x=>{x.newOwner.startedAtUtc='2026-11-26T23:45:20Z';},
  x=>{x.oldOwner.deadVerified=false;},
  x=>{x.oldOwner.sameBootVerified=false;},
  x=>{x.oldOwner.historicalSixSeatsVerified=false;},
  x=>{x.oldOwner.lastHeartbeatAt='';},
  x=>{x.installed.controllerFilesVerified=false;},
  x=>{x.installed.controllerSourceSha='b'.repeat(40);},
  x=>{x.preimage.stableAtRead=false;},
  x=>{x.preimage.ownerRecordSha256='missing';},
  x=>{x.approvedPreimage.approvalVerified=false;},
  x=>{x.approvedPreimage.ownerRecordSha256='b'.repeat(64);},
  x=>{x.approvedPreimage.scope='SOME_OTHER_POLICY';},
  x=>{x.observedAt='2026-11-26T23:40:00Z';},
  x=>{x.observedAt='2026-11-26T23:46:00Z';}
 ];
 for(let i=0;i<mutations.length;i++){
  const x=good();mutations[i](x);
  const result=assessNoSpawnMonitorSnapshot(x);
  assert.equal(result.status,'BLOCKED','identity mutation '+i);
  assert.equal(result.heartbeatWriteAuthorized,false);
 }
});

test('the private nonce and independent Operator/Watchdog are strict gates',()=>{
 const mutations=[
  x=>{x.privateLineage.source='GITHUB_ISSUE_BODY';},
  x=>{x.privateLineage.inheritedNonceMatchesOldOwner=false;},
  x=>{x.privateLineage.newOwnerNonceMatchesInherited=false;},
  x=>{x.privateLineage.newOwnerNoSpawnSourceVerified=false;},
  x=>{x.privateLineage.sixOriginalListenerBirthTimesPinned=false;},
  x=>{x.watcher.watchdogOwnerVerified=false;},
  x=>{x.watcher.installedR6SourceVerified=false;},
  x=>{x.watcher.singleWatchdogOwnerVerified=false;},
  x=>{x.watcher.noStandbyPromotionPendingVerified=false;},
  x=>{x.installation.independentMaintainerVerified=false;},
  x=>{x.installation.controllerSourceUnchanged=false;},
  x=>{x.lease.newOwnerPid=9001;},
  x=>{x.lease.claimExactCasReadback=false;},
  x=>{x.lease.newOwnerMatchesLiveProcess=false;},
  x=>{x.lease.sameOwnerNonceContinuityVerified=false;},
  x=>{x.lease.newOwnerBytesSha256='';},
  x=>{x.lease.singleRecoveryOperatorVerified=false;},
  x=>{x.lease.uninterruptedRecoveryLeaseVerified=false;}
 ];
 for(let i=0;i<mutations.length;i++){
  const x=good();mutations[i](x);
  assert.equal(assessNoSpawnMonitorSnapshot(x).status,'BLOCKED','gate '+i);
 }
});

test('exact PID+start time+path hash forbid PID reuse, late spawn and duplicate seats',()=>{
 const mutations=[
  x=>{x.controllerSeatPins=x.controllerSeatPins.slice(1);},
  x=>{x.liveWmi.rows=x.liveWmi.rows.slice(1);},
  x=>{x.liveWmi.rows[0].pid=5001;},
  x=>{x.liveWmi.rows[0].startedAtUtc='2026-11-26T23:45:01Z';},
  x=>{x.liveWmi.rows[0].startedAtUtc='2026-11-26T22:58:00Z';},
  x=>{x.liveWmi.rows[0].canonicalPathSha256=h('f');},
  x=>{x.liveWmi.rows[0].alive=false;},
  x=>{x.liveWmi.rows[0].seat=2;},
  x=>{x.liveWmi.rows[0].pid=x.liveWmi.rows[1].pid;},
  x=>{x.controllerSeatPins[0].seat=2;},
  x=>{x.liveWmi.extraControllerListenerCount=1;},
  x=>{x.liveWmi.unknownControllerPathCount=1;},
  x=>{x.liveWmi.completeControllerRootsVerified=false;},
  x=>{x.liveWmi.source='WMI_PATH_UNATTESTED';}
 ];
 for(let i=0;i<mutations.length;i++){
  const x=good();mutations[i](x);
  const result=assessNoSpawnMonitorSnapshot(x);
  assert.equal(result.status,'BLOCKED','WMI mutation '+i);
  assert.equal(result.supervisorSpawnAuthorized,false);
 }
});

test('related leases, workflow, fixed GitHub roster and Worker bounds deny',()=>{
 const mutations=[
  x=>{x.relatedLeases=1;},
  x=>{x.installation.installLeaseHeld=true;},
  x=>{x.installation.workflowState='disabled_manually';},
  x=>{x.gitHubRoster.fixedSixOnline=false;},
  x=>{x.activeControllerWorkers=null;},
  x=>{x.activeControllerWorkers=7;},
  x=>{x.activeControllerWorkers=-1;}
 ];
 for(let i=0;i<mutations.length;i++){
  const x=good();mutations[i](x);
  assert.equal(assessNoSpawnMonitorSnapshot(x).status,'BLOCKED','resource '+i);
 }
});

test('observed continuity loss fails closed without restarting or stopping Runners',()=>{
 const original=assessNoSpawnMonitorSnapshot(good());
 const broken=good();broken.liveWmi.rows[2].alive=false;
 const failure=decideNoSpawnMonitorFailure({
  previous:original,latest:assessNoSpawnMonitorSnapshot(broken)});
 assert.equal(failure.status,'FAIL_CLOSED');
 assert.equal(failure.stopRunners,false);
 assert.equal(failure.spawnRunners,false);
 assert.equal(failure.heartbeatWriteAuthorized,false);
 const noBaseline=decideNoSpawnMonitorFailure({
  previous:assessNoSpawnMonitorSnapshot(broken),latest:original});
 assert.equal(noBaseline.status,'HOLD');
 const repeat=decideNoSpawnMonitorFailure({previous:original,latest:original});
 assert.equal(repeat.status,'CONTINUE_CANDIDATE');
 assert.equal(repeat.heartbeatWriteAuthorized,false);
});

test('monitor is pure, cannot mutate Supervisor lease or spawn any Runner',()=>{
 const source=fs.readFileSync(
  new URL('../controller/orphan-no-spawn-monitor-contract.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(source,/\bspawn\s*\(|\bexecFile\s*\(|\bkill\s*\(|unlinkSync|renameSync|writeFileSync|mkdirSync|process\.env|taskkill|Stop-Process|Get-CimInstance/);
 for(const token of ['heartbeatWriteAuthorized:false','supervisorSpawnAuthorized:false',
  'runnerStopAuthorized:false','leaseMutationAuthorized:false',
  'watchdogPromotionAuthorized:false'])assert.ok(source.includes(token));
});


test('ongoing Controller work is not mistaken for an unrelated lease after established adoption',()=>{
 const x=good();
 x.monitorPhase='ESTABLISHED_MONITOR_RENEWAL';
 x.relatedLeases=2;
 x.ongoingJobs={
  source:'PRIVATE_SAME_HOST_CONTROLLER_JOB_LEASES',
  observedRelatedLeaseCount:2,
  allRelatedLeasesAccountedFor:true,
  allBoundToOriginalSixSeatsVerified:true,
  workerProcessLineageVerified:true,
  noInstallRecoveryOrExternalLeaseVerified:true,
  jobOwnerNonceContinuityVerified:true,
  activeWorkerCount:1
 };
 const renewed=assessNoSpawnMonitorSnapshot(x);
 assert.equal(renewed.status,'CANDIDATE_ONLY');
 assert.equal(renewed.effectAuthorized,false);
 assert.equal(renewed.heartbeatWriteAuthorized,false);
 const initial={...x,monitorPhase:'INITIAL_OWNER_ADOPTION'};
 assert.equal(assessNoSpawnMonitorSnapshot(initial).status,'BLOCKED');
 const cases=[
  a=>{a.ongoingJobs.source='GITHUB_ISSUE_BODY';},
  a=>{a.ongoingJobs.observedRelatedLeaseCount=1;},
  a=>{a.ongoingJobs.allRelatedLeasesAccountedFor=false;},
  a=>{a.ongoingJobs.allBoundToOriginalSixSeatsVerified=false;},
  a=>{a.ongoingJobs.workerProcessLineageVerified=false;},
  a=>{a.ongoingJobs.noInstallRecoveryOrExternalLeaseVerified=false;},
  a=>{a.ongoingJobs.jobOwnerNonceContinuityVerified=false;},
  a=>{a.ongoingJobs.activeWorkerCount=0;},
  a=>{a.relatedLeases=19;},
  a=>{a.installation.installLeaseHeld=true;},
  a=>{a.liveWmi.rows[0].pid=9999;},
  a=>{a.monitorPhase='UNKNOWN_PHASE';}
 ];
 for(let i=0;i<cases.length;i++){
  const q=structuredClone(x);cases[i](q);
  assert.equal(assessNoSpawnMonitorSnapshot(q).status,'BLOCKED','renewal '+i);
 }
});

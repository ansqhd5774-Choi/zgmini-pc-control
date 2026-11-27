import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import './controller-operating-audit-selective.test.mjs';
import './controller-operating-audit-b-manifest.test.mjs';
import './controller-audit-public-b-operator-once.test.mjs';
import './controller-audit-lineage-public-b-operator-once.test.mjs';
import {summarizeAutomation,dedicatedPcRunnersOnline,classifyRunnerQueryError,scopedRunnerRosterCliOptions,safeRuntimeSignals,operatingPcRunnerEvidence,inspectWatchdogReadOnly,summarizeSupervisorReadOnly,summarizeRequestedRecoveryEvidence,summarizeRequestProgress} from '../tools/automation-status.mjs';
import {inspectControllerOperatingAuditReadonly} from '../controller/operations.mjs';
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
test('authenticated Public SOURCE_ONLY poll reports verified source without asserting B or A readiness',()=>{
 const state={...healthy(),maintenanceFilesVerified:true,receiverIdentityVerified:true,
  receiverFresh:true,receiverSourceOnly:true,receiverListening:false};
 const r=summarizeAutomation(state);
 assert.equal(r.controllerState,'HEALTHY');
 assert.equal(r.runtimeState,'HEALTHY');
 assert.equal(r.maintenanceState,'SOURCE_ONLY_VERIFIED');
 assert.equal(r.automationState,'PARTIAL_OR_UNVERIFIED');
 assert.equal(r.updateSuccessProven,false);
 assert.equal(r.blockScope,'NONE_FROM_INSTALL_LEASE');
 // Identical observed status without installed bytes or fresh owner fails closed.
 for(const field of ['maintenanceFilesVerified','receiverIdentityVerified','receiverFresh']){
  const bad=summarizeAutomation({...state,[field]:false});
  assert.equal(bad.maintenanceState,'UNVERIFIED',field);
  assert.notEqual(bad.automationState,'HEALTHY',field);
 }
 // Contradictory full-B plus source-only markers cannot become B HEALTHY.
 const conflicting=summarizeAutomation({...state,receiverListening:true});
 assert.equal(conflicting.maintenanceState,'UNVERIFIED');
 assert.equal(conflicting.automationState,'PARTIAL_OR_UNVERIFIED');
 // Private full-B LISTENING remains recognized with the original protections.
 const privateFull=summarizeAutomation({...state,receiverSourceOnly:false,receiverListening:true});
 assert.equal(privateFull.maintenanceState,'HEALTHY');
 assert.equal(privateFull.automationState,'HEALTHY');
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

test('the fixed operating inventory runner GET may use existing scoped gh OAuth without exposing tokens',()=>{
 const env={GITHUB_ACTIONS:'true',GITHUB_EVENT_NAME:'issues',
  GITHUB_REPOSITORY:'ansqhd5774-Choi/zgmini-pc-control',
  GITHUB_ACTOR:'ansqhd5774-Choi',
  GITHUB_WORKFLOW_REF:'ansqhd5774-Choi/zgmini-pc-control/.github/workflows/pc-process-inventory-readonly.yml@refs/heads/main',
  RUNNER_NAME:'zgmini-pc-03',GITHUB_TOKEN:'WORKFLOW_ONLY',GH_HOST:'github.com'};
 const options=scopedRunnerRosterCliOptions('actions/runners?per_page=100',env);
 assert.ok(options.env);
 assert.equal(Object.hasOwn(options.env,'GITHUB_TOKEN'),false);
 assert.equal(options.env.GH_HOST,'github.com');
 assert.equal(env.GITHUB_TOKEN,'WORKFLOW_ONLY');
 assert.deepEqual(scopedRunnerRosterCliOptions('actions/workflows/pc-job.yml',env),{});
 for(const [key,value] of Object.entries({
  GITHUB_ACTIONS:'false',GITHUB_EVENT_NAME:'pull_request',
  GITHUB_REPOSITORY:'other/repo',GITHUB_ACTOR:'untrusted',
  GITHUB_WORKFLOW_REF:'ansqhd5774-Choi/zgmini-pc-control/.github/workflows/pc-job.yml@refs/heads/main',
  RUNNER_NAME:'zgmini-handoff-ci-spare-01',GITHUB_TOKEN:'',GH_TOKEN:'OTHER_CREDENTIAL'})){
  assert.deepEqual(scopedRunnerRosterCliOptions('actions/runners?per_page=100',{...env,[key]:value}),{},key);
 }
 assert.deepEqual(scopedRunnerRosterCliOptions('actions/runners?per_page=100',
  {...env,GH_TOKEN:'EXPLICIT_OTHER_TOKEN'}),{});
});
test('403 roster permission remains scoped without introducing a new next-step gate',()=>{
 const r=summarizeAutomation({...healthy(),runnerSetOnline:null,
  runnerQueryError:'HTTP_403_FORBIDDEN',maintenanceFilesVerified:true,
  receiverIdentityVerified:true,receiverFresh:true,receiverListening:true});
 assert.equal(r.localControllerState,'HEALTHY');
 assert.equal(r.runnerRegistryState,'UNVERIFIED');
 assert.equal(r.runtimeState,'UNVERIFIED');
 assert.equal(r.automationState,'PARTIAL_OR_UNVERIFIED');
 assert.equal(r.next,'VERIFY_TARGET_MANIFEST_AND_CURRENT_RUNTIME');
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

test('010 status CI covers direct status imports and verifies isolated host before tests',()=>{
 const workflow=readFileSync(new URL('../.github/workflows/automation-status-readonly-source-tests.yml',import.meta.url),'utf8');
 for(const dependency of [
  'tools/automation-status.mjs','tools/maintenance-lock.mjs','tools/update.mjs',
  'tools/runner-watchdog.mjs','tests/automation-status.test.mjs',
  'tests/runner-watchdog.test.mjs'
 ])assert.ok(workflow.includes("      - '"+dependency+"'"),dependency);
 const host=workflow.indexOf('      - name: Confirm isolated CI host');
 const test=workflow.indexOf('      - name: Run automation status read-only regression tests');
 assert.ok(host>=0 && test>host);
 assert.match(workflow,/cancel-in-progress: true/);
 assert.match(workflow,/permissions:\r?\n  contents: read/);
});

test('runner status report includes exactly six fixed operating seats, not other registered computers',()=>{
 const seats=operatingSeats(),rows=[...seats,
  {name:'zgmini-handoff-ci-spare-01',status:'online',busy:true,secret:'PRIVATE'},
  {name:'unrelated-listener',status:'online',busy:false}];
 const result=operatingPcRunnerEvidence(rows);
 assert.equal(result.length,6);
 assert.deepEqual(result.map(x=>x.name),seats.map(x=>x.name));
 assert.ok(result.every(x=>x.registration==='SINGLE'&&x.status==='online'&&x.busy===false));
 assert.doesNotMatch(JSON.stringify(result),/handoff|unrelated|PRIVATE/);
 assert.equal(dedicatedPcRunnersOnline(rows),true);
});
test('missing, duplicate, and malformed seats remain explicit without false online claim',()=>{
 const seats=operatingSeats();
 const rows=[...seats.slice(0,5),{...seats[0],status:'online',busy:true},
  {name:'zgmini-handoff-ci-spare-01',status:'online',busy:false}];
 const result=operatingPcRunnerEvidence(rows);
 assert.deepEqual(result[0],{name:'zgmini-pc-01',registration:'DUPLICATE',
  status:null,busy:null,routeLabelState:'UNKNOWN',missingRouteLabels:[],
  assignmentCandidateAtObservation:null});
 assert.deepEqual(result[5],{name:'zgmini-pc-06',registration:'MISSING',
  status:null,busy:null,routeLabelState:'UNKNOWN',missingRouteLabels:[],
  assignmentCandidateAtObservation:null});
 assert.equal(dedicatedPcRunnersOnline(rows),false);
 const malformed=operatingPcRunnerEvidence([{name:'zgmini-pc-01',status:'READY',busy:'false'}]);
 assert.deepEqual(malformed[0],{name:'zgmini-pc-01',registration:'SINGLE',
  status:null,busy:null,routeLabelState:'UNKNOWN',missingRouteLabels:[],
  assignmentCandidateAtObservation:null});
 assert.equal(operatingPcRunnerEvidence(null),null);
});
const requiredLabels=()=>['self-hosted','Windows','X64','zgmini-pc-control']
 .map(name=>({name}));
test('operating six-seat report checks exact routing labels without returning unrelated metadata',()=>{
 const rows=operatingSeats().map(x=>({...x,labels:[...requiredLabels(),{name:'PRIVATE-TEAM'}]}));
 rows.push({name:'zgmini-handoff-ci-spare-01',status:'online',busy:false,
  labels:[{name:'OTHER-ONLY'}],token:'SHOULD_NOT_LEAK'});
 const status=operatingPcRunnerEvidence(rows);
 assert.equal(status.length,6);
 assert.ok(status.every(x=>x.routeLabelState==='MATCHED'&&
  x.assignmentCandidateAtObservation===true&&x.missingRouteLabels.length===0));
 assert.equal(status[0].registration,'SINGLE');
 assert.doesNotMatch(JSON.stringify(status),/PRIVATE-TEAM|OTHER-ONLY|SHOULD_NOT_LEAK/);
 assert.equal(dedicatedPcRunnersOnline(rows),true);
});
test('routing-label missing, offline, busy and unreadable metadata fail closed independently',()=>{
 const seats=operatingSeats().map(x=>({...x,labels:requiredLabels()}));
 seats[0].labels=[...requiredLabels().slice(0,3),{name:'other-custom'}];
 seats[1].status='offline';
 seats[2].busy=true;
 delete seats[3].labels;
 seats[4].status='BROKEN';
 seats[5].labels=[...requiredLabels().slice(0,3),{name:42}];
 const status=operatingPcRunnerEvidence(seats);
 assert.deepEqual(status[0].missingRouteLabels,['zgmini-pc-control']);
 assert.equal(status[0].routeLabelState,'MISSING');
 assert.equal(status[0].assignmentCandidateAtObservation,false);
 assert.equal(status[1].routeLabelState,'MATCHED');
 assert.equal(status[1].assignmentCandidateAtObservation,false);
 assert.equal(status[2].assignmentCandidateAtObservation,false);
 for(const i of [3,5]){
  assert.equal(status[i].routeLabelState,'UNKNOWN');
  assert.equal(status[i].assignmentCandidateAtObservation,null);
 }
 assert.equal(status[4].routeLabelState,'MATCHED');
 assert.equal(status[4].assignmentCandidateAtObservation,null);
 assert.deepEqual(status[5].missingRouteLabels,[]);
});

// Filesystem double exposes only lstat/read/readdir. It cannot mutate the PC,
// start a Supervisor, create requests or inspect private marker text.
function watchdogFixture({
 status={at:'2026-11-14T01:00:00.000Z',pid:2026,state:'HEALTHY'},
 receiver={pid:2026,nonce:'test-only'},
 flags=[],otherLeases=[],badStatus=false,symlink=null,
 clock=()=>Date.parse('2026-11-14T01:00:15.000Z'),pidAlive=()=>true,
}={}){
 const home=path.join('fixture','watchdog');
 const ctl=path.join('fixture','control');
 const mtn=path.join('fixture','maintenance');
 const statusFile=path.join(home,'STATUS.json');
 const receiverFile=path.join(home,'receiver','owner.json');
 const markerPaths={
  guardianStop:path.join(home,'GUARDIAN_STOP.txt'),
  watchdogPause:path.join(home,'PAUSE'),
  controllerDrain:path.join(ctl,'DRAIN'),
  controllerInstallLease:path.join(mtn,'leases','controller-install'),
 };
 const docs=new Map();
 if(status!==null)docs.set(statusFile,badStatus?'[bad-json':JSON.stringify(status));
 if(receiver!==null)docs.set(receiverFile,JSON.stringify(receiver));
 for(const k of flags)docs.set(markerPaths[k],'PRIVATE_MARKER_CONTENT_DO_NOT_RETURN');
 const leases=path.join(ctl,'leases');
 const dirs=new Map([[leases,['supervisor',...otherLeases]]]);
 const missing=()=>Object.assign(Error('not found'),{code:'ENOENT'});
 const filesystem={
  lstatSync(p){
   if(docs.has(p))return {
    isFile:()=>true,isDirectory:()=>false,isSymbolicLink:()=>p===markerPaths[symlink],
    size:Buffer.byteLength(docs.get(p)),
   };
   if(dirs.has(p))return {
    isFile:()=>false,isDirectory:()=>true,isSymbolicLink:()=>false,size:0,
   };
   throw missing();
  },
  readFileSync(p){if(!docs.has(p))throw missing();return docs.get(p);},
  readdirSync(p){if(!dirs.has(p))throw missing();return dirs.get(p);},
 };
 const result=inspectWatchdogReadOnly({filesystem,watchdogHome:home,
  controllerHome:ctl,maintenanceHome:mtn,clock,pidAlive});
 return {result,docs,markerPaths};
}

test('watchdog marker source remains independent of healthy six-runner verdict',()=>{
 const {result}=watchdogFixture();
 assert.equal(result.state,'HEALTHY');
 assert.equal(result.observedAt,'2026-11-14T01:00:00.000Z');
 assert.equal(result.fresh,true);
 assert.equal(result.processAlive,true);
 assert.equal(result.receiverPidMatches,true);
 assert.deepEqual(result.inhibitors,[]);
 assert.deepEqual(result.diagnostics,[]);
 assert.equal(result.evidenceScope,'READONLY_WATCHDOG_MARKERS_NOT_RECOVERY_AUTHORIZATION');
 assert.equal(summarizeAutomation({...healthy(),watchdog:result}).runtimeState,'HEALTHY');
});

test('R6 two-standby READY requires fresh owner-matched watchdog and two live distinct children',()=>{
 const status={at:'2026-11-14T01:00:00.000Z',pid:2026,state:'HEALTHY',
  standbyRole:'READY',standbyPid:3101,
  secondStandbyRole:'READY',secondStandbyPid:3102,standbyReadyCount:2};
 const {result}=watchdogFixture({status,pidAlive:pid=>[2026,3101,3102].includes(pid)});
 assert.equal(result.standbyRole,'READY');
 assert.equal(result.secondStandbyRole,'READY');
 assert.equal(result.standbyReadyCount,2);
 assert.equal(result.standbyPairReadyAtObservation,true);
 assert.equal(result.secondStandbyPid,3102);
 assert.equal(result.receiverPidMatches,true);
 assert.deepEqual(result.diagnostics,[]);
 assert.equal(JSON.stringify(result).includes('test-only'),false);
});

test('two-standby readback never upgrades missing, stale or malformed evidence to READY',()=>{
 const base={at:'2026-11-14T01:00:00.000Z',pid:2026,state:'HEALTHY',
  standbyRole:'READY',standbyPid:3101,
  secondStandbyRole:'READY',secondStandbyPid:3102,standbyReadyCount:2};
 const invalid=[
  {status:{...base,standbyReadyCount:1}},
  {status:{...base,standbyReadyCount:'2'}},
  {status:{...base,secondStandbyPid:3101}},
  {status:{...base,secondStandbyRole:'STARTING'}},
  {status:{...base,secondStandbyRole:'PRIVATE_VALUE'}},
  {status:{...base,secondStandbyPid:2026}},
  {status:{...base,state:'PAUSED'}},
  {status:base,receiver:{pid:2027}},
  {status:base,clock:()=>Date.parse('2026-11-14T01:02:00.000Z')},
  {status:base,pidAlive:pid=>pid===3102?false:true},
  {status:base,pidAlive:pid=>pid===3102?null:true},
 ];
 for(const fixture of invalid){
  const {result}=watchdogFixture(fixture);
  assert.equal(result.standbyPairReadyAtObservation,false,
   'a malformed, stale, unowned or dead second slot must not pass');
 }
 const legacy=watchdogFixture({status:{
  at:'2026-11-14T01:00:00.000Z',pid:2026,state:'HEALTHY',
  standbyRole:'READY',standbyPid:3101
 }}).result;
 assert.equal(legacy.standbyPairReadyAtObservation,undefined);
 assert.equal(legacy.secondStandbyRole,undefined);
 assert.equal(legacy.standbyReadyCount,undefined);
 const missing=watchdogFixture({status:null}).result;
 assert.equal(missing.standbyPairReadyAtObservation,undefined);
});

test('guardian STOP, PAUSE, DRAIN, install lease and other leases have separate origins',()=>{
 const {result,docs}=watchdogFixture({status:{at:'2026-11-14T01:00:00.000Z',pid:2026,state:'PAUSED'},
  flags:['guardianStop','watchdogPause','controllerDrain','controllerInstallLease'],
  otherLeases:['job-other','supervisor.dead-archived']});
 assert.equal(result.state,'PAUSED');
 assert.equal(result.fresh,true);
 assert.equal(result.guardianStop,true);
 assert.equal(result.watchdogPause,true);
 assert.equal(result.controllerDrain,true);
 assert.equal(result.controllerInstallLease,true);
 assert.equal(result.otherControllerLeases,true);
 assert.deepEqual(result.inhibitors,['GUARDIAN_STOP','WATCHDOG_PAUSE',
  'CONTROLLER_DRAIN','CONTROLLER_INSTALL_LEASE','OTHER_CONTROLLER_LEASES']);
 assert.equal(JSON.stringify(result).includes('PRIVATE_MARKER_CONTENT_DO_NOT_RETURN'),false);
 assert.equal(JSON.stringify(result).includes('job-other'),false);
 assert.equal(docs.size,6);
});

test('historical HEALTHY watchdog state is not current process proof',()=>{
 const {result}=watchdogFixture({
  status:{at:'2026-11-14T01:00:00.000Z',pid:22,state:'HEALTHY'},
  receiver:{pid:23,nonce:'other'},
  clock:()=>Date.parse('2026-11-14T01:02:00.000Z'),pidAlive:()=>false,
 });
 assert.equal(result.state,'HEALTHY');
 assert.equal(result.fresh,false);
 assert.equal(result.processAlive,false);
 assert.equal(result.receiverPidMatches,false);
 assert.equal(result.guardianStop,false);
 assert.deepEqual(result.inhibitors,[]);
});

test('unreadable watchdog status is UNKNOWN, and a symlink marker is not safe absence',()=>{
 const {result}=watchdogFixture({status:null,receiver:null,
  flags:['watchdogPause'],symlink:'watchdogPause'});
 assert.equal(result.state,null);
 assert.equal(result.observedAt,null);
 assert.equal(result.fresh,null);
 assert.equal(result.processAlive,null);
 assert.equal(result.receiverPidMatches,null);
 assert.equal(result.watchdogPause,null);
 assert.ok(result.diagnostics.includes('WATCHDOG_STATUS_UNVERIFIED'));
 assert.ok(result.diagnostics.includes('WATCHDOG_RECEIVER_UNVERIFIED'));
 assert.ok(result.diagnostics.includes('WATCHDOG_PAUSE_UNVERIFIED'));
 assert.deepEqual(result.inhibitors,[]);
});
test('invalid JSON or future timestamps never become fresh READY evidence',()=>{
 const bad=watchdogFixture({badStatus:true});
 assert.equal(bad.result.state,null);
 assert.ok(bad.result.diagnostics.includes('WATCHDOG_STATUS_UNVERIFIED'));
 const future=watchdogFixture({status:{at:'2026-11-14T02:00:00.000Z',pid:2026,state:'HEALTHY'}});
 assert.equal(future.result.state,'HEALTHY');
 assert.equal(future.result.fresh,false);
});

test('watchdog BLOCKED cause is reported only when it is a safe diagnostic code',()=>{
 const base={at:'2026-11-14T01:00:00.000Z',pid:2026,state:'BLOCKED'};
 const diagnosed=watchdogFixture({status:{...base,code:'CONTROLLER_HASH_MISMATCH'}}).result;
 assert.equal(diagnosed.blockedCode,'CONTROLLER_HASH_MISMATCH');
 const unsafe=watchdogFixture({status:{...base,code:'SECRET:token-value'}}).result;
 assert.equal(unsafe.blockedCode,null);
 const healthyStatus=watchdogFixture({status:{...base,state:'HEALTHY',code:'STALE_ERROR'}}).result;
 assert.equal(healthyStatus.blockedCode,null);
});

test('read-only supervisor evidence identifies owner and heartbeat without private fields',()=>{
 const supervisor={pid:37,at:'2026-11-14T01:00:00.000Z',mode:'LISTENING',
  children:[{seat:1},{seat:2}],sourceSha:'SHOULD_NOT_LEAK'};
 const owner={pid:37,nonce:'PRIVATE_NONCE'};
 const state={supervisorAlive:true,supervisorIdentityVerified:true,
  supervisorFresh:true,supervisorChildrenVerified:false};
 const result=summarizeSupervisorReadOnly({supervisor,owner,state});
 assert.deepEqual(result,{heartbeatAt:'2026-11-14T01:00:00.000Z',
  statusPid:37,ownerPid:37,ownerProcessAlive:true,identityVerified:true,
  heartbeatFresh:true,childrenVerified:false,childCount:2,mode:'LISTENING'});
 assert.equal(JSON.stringify(result).includes('PRIVATE_NONCE'),false);
 assert.equal(JSON.stringify(result).includes('SHOULD_NOT_LEAK'),false);
});

test('missing or malformed supervisor timestamp remains unverified',()=>{
 const noEvidence=summarizeSupervisorReadOnly({state:{}});
 assert.equal(noEvidence.heartbeatAt,null);
 assert.equal(noEvidence.heartbeatFresh,null);
 assert.equal(noEvidence.childrenVerified,null);
 assert.equal(noEvidence.ownerPid,null);
 const invalid=summarizeSupervisorReadOnly({
  supervisor:{pid:-2,at:'2026-11-14T01:00:00Z',mode:'INVALID',children:[]},
  owner:{pid:-1},
  state:{supervisorAlive:null,supervisorFresh:true,supervisorIdentityVerified:false,supervisorChildrenVerified:true},
 });
 assert.equal(invalid.heartbeatAt,null);
 assert.equal(invalid.heartbeatFresh,null);
 assert.equal(invalid.ownerPid,null);
 assert.equal(invalid.statusPid,null);
 assert.equal(invalid.childCount,0);
 assert.equal(invalid.mode,null);
});

test('one-shot request reconciliation exposes bounded artifact status, never claims recovery success',()=>{
 const id='pc-update-8f413b02-4bb7-4d99-b71f-64d9c51a294a';
 const snapshot={
  status:'STATUS',actualControllerSha:'0'.repeat(40),installedReadbackCode:null,
  ledger:{status:'RECOVERY_REQUIRED',code:'POSTCHECK_OUTCOME_UNKNOWN',phase:'RECOVERY_REQUIRED',
   postIssueNumber:2506},
  installLock:{held:true,recoveryRequired:true},
  artifacts:{schema:'ZGMINI_PC_UPDATE_ARTIFACT_READBACK_V1',requestId:id,
   status:'OBSERVED',artifacts:{backupRoot:'PRESENT',protectedBefore:'PRESENT'},
   backlog:{file:'PRESENT',windows:1,openWindows:0,replayCount:0},
   lease:{directory:'PRESENT',recoveryMarker:'PRESENT',ownerMarkerMatch:true}},
  guidance:{state:'RECOVERY_REQUIRED',next:'USE_CONTROLLER_RECOVERY_RUNBOOK'},
 };
 const r=summarizeRequestedRecoveryEvidence(snapshot);
 assert.equal(r.requestId,id);
 assert.equal(r.historicalCode,'POSTCHECK_OUTCOME_UNKNOWN');
 assert.equal(r.postIssueNumber,2506);
 assert.equal(r.artifacts.backupRoot,'PRESENT');
 assert.equal(r.recoveryRequired,true);
 assert.equal(r.installSuccessProven,false);
 assert.equal(r.recoveryComplete,false);
 assert.equal(r.originalRequestRetried,false);
 assert.equal(r.operationalWrites,0);
});
test('request recovery summary fails closed when evidence not observed',()=>{
 assert.equal(summarizeRequestedRecoveryEvidence(null),null);
 const r=summarizeRequestedRecoveryEvidence({status:'STATUS',ledger:{code:'UNSAFE / SECRET'},
  installLock:{held:true},artifacts:null,artifactReadbackCode:'UPDATE_ARTIFACTS_UNVERIFIED'});
 assert.equal(r.historicalCode,null);
 assert.equal(r.artifactReadbackCode,'UPDATE_ARTIFACTS_UNVERIFIED');
 assert.equal(r.artifacts,null);
 assert.equal(r.installSuccessProven,false);
});

test('maintenance phase remains visible while running, without time-based failure or duplicate execution',()=>{
 const r=summarizeRequestProgress({requestId:'pc-update-3652629d-dd06-4e5d-a7a7-1efeb056cf9d',
  status:'RUNNING',phase:'SWITCHED',lastPass:'SWITCHED',firstFail:null,code:'IN_PROGRESS',
  updatedAt:'2026-11-22T00:35:00.000Z'});
 assert.equal(r.executionState,'RUNNING');assert.equal(r.phase,'SWITCHED');
 assert.equal(r.next,'FOLLOW_EXISTING_PHASE_NO_DUPLICATE_REQUEST');
 assert.equal(r.executionAuthorized,false);
});
test('completed installation and delayed reporting are distinct from execution failure',()=>{
 const r=summarizeRequestProgress({status:'PASS',phase:'PASS',code:'APPROVED_UPDATE_AND_DIAGNOSTIC_VERIFIED',
  postIssueNumber:2670,reportUploadStatus:'REPORT_UPLOAD_PENDING'});
 assert.equal(r.executionState,'COMPLETED_RESULT_DELIVERY_PENDING');
 assert.equal(r.postIssueNumber,2670);
 assert.equal(summarizeRequestProgress({...r,reportUploadStatus:'VERIFIED'}).executionState,'COMPLETED_REPORTED');
 assert.equal(summarizeRequestProgress({status:'STATE_UNKNOWN'}).next,'RECONCILE_EXISTING_REQUEST_NO_NEW_APPLY');
 assert.equal(summarizeRequestProgress(null).executionState,'NOT_OBSERVED');
});
test('request progress never returns unbounded journal text or private payloads',()=>{
 const r=summarizeRequestProgress({requestId:'secret@example.com',phase:'TOKEN=SECRET',
  firstFail:'sensitive arbitrary text',updatedAt:'invalid',payload:'PRIVATE'});
 assert.equal(r.requestId,null);assert.equal(r.phase,null);assert.equal(r.updatedAt,null);
 assert.doesNotMatch(JSON.stringify(r),/SECRET|PRIVATE|@/);
});

test('fixed operating audit correlates two live READY standbys, six children and two private A ledgers',()=>{
 const ctrl='E:/ZGmini/automation/pc-control',wd='E:/ZGmini/automation/pc-watchdog';
 const clock=Date.parse('2026-11-27T19:47:46.062Z'),sha='555f95708984580cd7d5a0fd05a80b718e867710';
 const supervisorPid=15776,watchdogPid=43904;
 const children=Array.from({length:6},(_,i)=>({seat:i+1,pid:6101+i,alive:true}));
 const docs=new Map();
 const put=(root,p,obj)=>docs.set(path.join(root,p),JSON.stringify(obj));
 put(wd,'STATUS.json',{at:new Date(clock).toISOString(),pid:watchdogPid,state:'HEALTHY',
  standbyRole:'READY',standbyPid:12580,secondStandbyRole:'READY',
  secondStandbyPid:16268,standbyReadyCount:2,supervisorPid,
  heartbeatAt:'2026-11-27T19:47:42.562Z'});
 put(wd,'receiver/owner.json',{pid:watchdogPid,nonce:'SENSITIVE_WD_NONCE'});
 put(ctrl,'SUPERVISOR_STATUS.json',{at:'2026-11-27T19:47:42.562Z',pid:supervisorPid,
  mode:'LISTENING',sourceSha:sha,children});
 put(ctrl,'leases/supervisor/owner.json',{pid:supervisorPid,nonce:'SENSITIVE_OWNER_NONCE'});
 put(ctrl,'host.json',{controllerSourceSha:sha});
 const specs=[
  ['pc-update-3f1c0413-37dd-4b44-900e-75c709d492ff-postcheck',
   'core-status','run-46051863226-1-seat-6'],
  ['pc-stage5-4263-recovery-smoke-20261128-01',
   'runner-smoke','run-46052065337-1-seat-6']
 ];
 for(const [id,operation,jobId] of specs)put(ctrl,'ledger/'+id+'.json',{
  payloadSha:'a'.repeat(64),report:{schema:'ZGMINI_PC_RESULT_V1',requestId:id,
   operation,jobId,seat:6,status:'PASS',code:'LOCAL_PASS',firstFail:null,
   protectedStateUnchanged:true,actualExecutionSha:sha}
 });
 const living=new Set([supervisorPid,watchdogPid,12580,16268,...children.map(x=>x.pid)]);
 const filesystem={
  lstatSync(p){if(!docs.has(p))throw Object.assign(Error('missing'),{code:'ENOENT'});
   return {isFile:()=>true,isSymbolicLink:()=>false,size:Buffer.byteLength(docs.get(p))};},
  readFileSync:p=>docs.get(p)
 };
 const audit=(args={})=>inspectControllerOperatingAuditReadonly({
  filesystem,now:()=>clock,pidAlive:n=>living.has(n),controlRoot:ctrl,watchdogRoot:wd,...args});
 const good=audit();
 assert.equal(good.status,'PASS');
 assert.equal(good.standbyPairReady,true);
 assert.equal(good.supervisorVerified,true);
 assert.equal(good.localPostcheckLedgerVerified,true);
 assert.equal(good.localRunnerSmokeLedgerVerified,true);
 assert.equal(good.operationalWrites,0);
 assert.equal(good.providerCalls,0);
 assert.equal(good.d1Writes,0);
 assert.doesNotMatch(JSON.stringify(good),/SENSITIVE|payloadSha|555f957/);
 // Historical executions retain their attested old source after a valid
 // Controller upgrade. Current health must still follow the new host source.
 const upgraded='cde1dd372210e4658ae348cb9e2577967cb11634';
 const hostKey=path.join(ctrl,'host.json'),supKey=path.join(ctrl,'SUPERVISOR_STATUS.json');
 const priorHost=docs.get(hostKey),priorSup=docs.get(supKey);
 put(ctrl,'host.json',{controllerSourceSha:upgraded});
 docs.set(supKey,JSON.stringify({...JSON.parse(priorSup),sourceSha:upgraded}));
 assert.equal(audit().status,'PASS');
 const historicalKey=path.join(ctrl,'ledger/'+specs[0][0]+'.json'),priorHistory=docs.get(historicalKey);
 const wrong=JSON.parse(priorHistory);wrong.report.actualExecutionSha=upgraded;
 docs.set(historicalKey,JSON.stringify(wrong));
 assert.equal(audit().localPostcheckLedgerVerified,false);
 docs.set(historicalKey,priorHistory);docs.set(hostKey,priorHost);docs.set(supKey,priorSup);
 const changed=(root,p,replacement)=>{
  const k=path.join(root,p),old=docs.get(k);
  docs.set(k,JSON.stringify({...JSON.parse(old),...replacement}));
  assert.equal(audit().status,'STATE_UNKNOWN',p);
  docs.set(k,old);
 };
 changed(wd,'STATUS.json',{standbyReadyCount:1});
 changed(wd,'STATUS.json',{secondStandbyRole:'STARTING'});
 changed(wd,'STATUS.json',{secondStandbyPid:12580});
 changed(wd,'STATUS.json',{secondStandbyPid:watchdogPid});
 changed(wd,'STATUS.json',{at:'2026-11-27T19:40:00.000Z'});
 changed(wd,'receiver/owner.json',{pid:99999});
 changed(ctrl,'SUPERVISOR_STATUS.json',{sourceSha:'b'.repeat(40)});
 changed(ctrl,'SUPERVISOR_STATUS.json',{children:children.slice(0,5)});
 const [id]=specs[0],ledger=path.join(ctrl,'ledger',id+'.json');
 const old=docs.get(ledger);
 docs.set(ledger,JSON.stringify({...JSON.parse(old),report:{...JSON.parse(old).report,protectedStateUnchanged:false}}));
 assert.equal(audit().localPostcheckLedgerVerified,false);
 assert.equal(audit().status,'STATE_UNKNOWN');
 docs.set(ledger,old);
 living.delete(16268);
 assert.equal(audit().standbyPairReady,false);
 living.add(16268);
 const missing=docs.get(path.join(wd,'receiver','owner.json'));
 docs.delete(path.join(wd,'receiver','owner.json'));
 assert.equal(audit().status,'STATE_UNKNOWN');
 docs.set(path.join(wd,'receiver','owner.json'),missing);
 assert.equal(audit().status,'PASS');
});

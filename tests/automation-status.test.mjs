import test from 'node:test';import assert from 'node:assert/strict';
import path from 'node:path';
import {summarizeAutomation,dedicatedPcRunnersOnline,operatingPcRunnerEvidence,inspectWatchdogReadOnly,summarizeSupervisorReadOnly} from '../tools/automation-status.mjs';
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

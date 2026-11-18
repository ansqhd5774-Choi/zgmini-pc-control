import test from 'node:test';
import {createHash} from 'node:crypto';
import {inspectTask, TASK} from '../tools/marketparquet-task-source-readonly.mjs';
import {safeRuntimeSignals} from '../tools/automation-status.mjs';
import assert from 'node:assert/strict';
import {authenticateProcess,collect,sanitizeProbe,sanitizeMaintenanceStatus,classify996LeaseCorrelation,inspect996LeaseCorrelation,classify1501LeaseCorrelation,inspect1501LeaseCorrelation,classify1501RecoveryCheckpoint,classify1841RecoveryCheckpoint,summarize2094StageStatus,inspect2094StageReadonly,inspect1841LeaseCorrelation,projectObservedProviderHosts,classify1501BacklogBytes,inspect1501BacklogReadonly,sanitizeRuntimeSignals,sanitizeDedicatedRunnerEvidence,projectTargetEndpointStatus,serializeProcessResult,toText,SCHEMA,TITLE,ROLE_OPERATION}
 from '../tools/pc-process-inventory-readonly.mjs';
const REPO='ansqhd5774-Choi/zgmini-pc-control';
function event(role='operating'){
 const request={schema:SCHEMA,operation:ROLE_OPERATION,role,
  requestId:'2d605c34-939e-43e4-8ca1-58d678bf3862'};
 return {action:'opened',repository:{full_name:REPO,private:true},
  issue:{number:2001,user:{login:'ansqhd5774-Choi'},title:TITLE,
   body:JSON.stringify(request)}};
}
const env={GITHUB_REPOSITORY:REPO,GITHUB_ACTOR:'ansqhd5774-Choi',
 GITHUB_EVENT_NAME:'issues',GITHUB_RUN_ID:'43110000000',GITHUB_RUN_ATTEMPT:'1'};
test('exact read-only schema, owner, roles and run provenance',()=>{
 assert.equal(authenticateProcess(event(),env,'operating').role,'operating');
 assert.equal(authenticateProcess(event('handoff'),env,'handoff').role,'handoff');
 for(const role of ['operating','handoff']){
  const e=event(role),b=JSON.parse(e.issue.body);
  for(const prop of ['cmd','path','script','token','operationWrites']){
   assert.throws(()=>authenticateProcess({...e,issue:{...e.issue,
    body:JSON.stringify({...b,[prop]:'not-allowed'})}},env,role));
  }
 }
 assert.throws(()=>authenticateProcess({...event(),action:'labeled'},env,'operating'));
 assert.throws(()=>authenticateProcess(event(),{...env,GITHUB_ACTOR:'other'},'operating'));
});
test('sanitize output keeps only bounded whitelisted Windows process metadata',()=>{
 const result=sanitizeProbe({schema:'ZGMINI_PC_PROCESS_PROBE_V1',
  observedAtUtc:'2026-11-12T10:00:00Z',totalProcessCount:151,
  selectedProcessCount:84,processCounts:[{name:'Runner.Listener.exe',count:6},
   {name:'node.exe',count:10},{name:'cmd.exe',count:16},{name:'conhost.exe',count:39}],processes:[
  {name:'Runner.Listener.exe',pid:44,ppid:3,session:1,workingSetMiB:84,commandLine:'super-secret'},
  {name:'node.exe',pid:46,ppid:44,session:1,workingSetMiB:31,
   path:'C:\\Users\\secret'}],services:[{name:'actions.runner.zgmini-pc-03',
  state:'Running',startMode:'Auto',path:'C:\\SECRET'}],
  serviceStatus:'OK',tasks:[{name:'ZGMINI-PC-Local-Core',state:'Ready',argument:'SECRET'}],
  taskStatus:'OK',startup:['ZGMINI_PC_CONTROL.vbs'],startupStatus:'OK'});
 assert.equal(result.processes.length,2);
 assert.equal(result.totalProcessCount,151);
 assert.equal(result.processCounts.find(x=>x.name==='Runner.Listener.exe').count,6);
 assert.equal(result.processListTruncated,true);
 assert.doesNotMatch(JSON.stringify(result),/super-secret|C:\\Users|SECRET/);
 assert.equal(result.services[0].startMode,'Auto');
 assert.equal(result.tasks[0].state,'Ready');
});
test('aggregated memory coverage exposes only fixed process classes and private commit',()=>{
 const sample={schema:'ZGMINI_PC_PROCESS_PROBE_V1',totalProcessCount:3,
  selectedProcessCount:1,processes:[
   {name:'node.exe',pid:12,ppid:10,session:1,workingSetMiB:0,
    privateCommitMiB:512,commandLine:'SECRET'}],
  memoryGroups:[
   {kind:'NODE_NONRUNNER',count:1,workingSetMiB:0,privateCommitMiB:512,
    zeroWorkingSetCount:1,unknownWorkingSetCount:0,unknownPrivateCommitCount:0,
    commandLine:'SECRET'},
   {kind:'OTHER_PROCESSES',count:2,workingSetMiB:300,privateCommitMiB:900,
    zeroWorkingSetCount:0,unknownWorkingSetCount:0,unknownPrivateCommitCount:0,
    applicationName:'Private-Browser'}]};
 const out=sanitizeProbe(sample);
 assert.equal(out.memoryGroupCoverage,'COUNT_COMPLETE');
 assert.equal(out.memoryGroups.reduce((n,g)=>n+g.count,0),3);
 assert.equal(out.memoryGroups[0].privateCommitMiB,512);
 assert.equal(out.processes[0].privateCommitMiB,512);
 assert.equal(out.processes[0].workingSetMiB,0);
 assert.doesNotMatch(JSON.stringify(out),/SECRET|Private-Browser|applicationName|commandLine/);
 assert.equal(sanitizeProbe({...sample,totalProcessCount:4}).memoryGroupCoverage,'COUNT_PARTIAL');
 assert.equal(sanitizeProbe({...sample,memoryGroups:[]}).memoryGroupCoverage,'UNAVAILABLE');
});
test('memory groups fail closed for unapproved labels and forged counters',()=>{
 const base={schema:'ZGMINI_PC_PROCESS_PROBE_V1',totalProcessCount:1,
  processes:[],services:[],tasks:[]};
 const valid={kind:'NODE_NONRUNNER',count:1,workingSetMiB:0,
  privateCommitMiB:30,zeroWorkingSetCount:1,
  unknownWorkingSetCount:0,unknownPrivateCommitCount:0};
 const cases=[
  [{...valid,kind:'secret-app.exe'}],
  [{...valid,zeroWorkingSetCount:2}],
  [{...valid,privateCommitMiB:-1}],
  [valid,valid]];
 for(const groups of cases)
  assert.throws(()=>sanitizeProbe({...base,memoryGroups:groups}));
});
test('compact result preserves full memory attribution and large readonly roster without truncation',()=>{
 const complete={schema:'ZGMINI_PC_PROCESS_INVENTORY_RESULT_V1',
  role:'operating',status:'PASS',code:'PROCESS_INVENTORY_COLLECTED',
  snapshot:{memoryGroupCoverage:'COUNT_COMPLETE',
   memoryGroups:[{kind:'NODE_NONRUNNER',count:14,workingSetMiB:0,
    privateCommitMiB:3000,zeroWorkingSetCount:14,
    unknownWorkingSetCount:0,unknownPrivateCommitCount:0}],
   processes:Array.from({length:60},(_,i)=>({name:'node.exe',pid:i+1,
    ppid:123,session:1,workingSetMiB:0,privateCommitMiB:90}))},
  observedHttpHostRoster:{hosts:Array.from({length:32},(_,i)=>({
   host:'example-'+i+'.gov',summary:'X'.repeat(180),readOnly:true}))}};
 const raw=serializeProcessResult(complete);
 assert.ok(Buffer.byteLength(raw)<32768);
 assert.ok(Buffer.byteLength(raw)<Buffer.byteLength(JSON.stringify(complete,null,2)));
 assert.deepEqual(JSON.parse(raw),complete);
 assert.match(raw,/privateCommitMiB/);
});
test('bounded broad categories resolve OTHER process group without leaking names',()=>{
 const base={schema:'ZGMINI_PC_PROCESS_PROBE_V1',totalProcessCount:4,
  selectedProcessCount:0,processes:[],services:[],tasks:[],
  memoryGroups:[{kind:'OTHER_PROCESSES',count:4,workingSetMiB:4000,
   privateCommitMiB:3000,zeroWorkingSetCount:0,
   unknownWorkingSetCount:0,unknownPrivateCommitCount:0}],
  otherSubgroups:[
   {category:'BROWSER_WEBVIEW',count:2,workingSetMiB:3000,privateCommitMiB:2000,
    processName:'DO_NOT_LEAK_USER_APP'},
   {category:'WINDOWS_CORE_UI',count:1,workingSetMiB:700,privateCommitMiB:600},
   {category:'UNCLASSIFIED_OTHER',count:1,workingSetMiB:300,privateCommitMiB:400}],
  otherTopMemory:[{category:'BROWSER_WEBVIEW',workingSetMiB:2500,
   privateCommitMiB:1600,commandLine:'SECRET_DO_NOT_LEAK'}]};
 const out=sanitizeProbe(base);
 assert.equal(out.memoryGroupCoverage,'COUNT_COMPLETE');
 assert.equal(out.otherSubgroupCoverage,'COUNT_COMPLETE');
 assert.equal(out.otherSubgroups.reduce((n,g)=>n+g.count,0),4);
 assert.equal(out.otherTopMemory[0].workingSetMiB,2500);
 assert.deepEqual(Object.keys(out.otherTopMemory[0]),
  ['category','workingSetMiB','privateCommitMiB']);
 assert.doesNotMatch(JSON.stringify(out),/DO_NOT_LEAK|SECRET|processName|commandLine/);
 assert.equal(sanitizeProbe({...base,otherSubgroups:base.otherSubgroups.slice(0,2)})
  .otherSubgroupCoverage,'COUNT_PARTIAL');
 assert.equal(sanitizeProbe({...base,otherSubgroups:[]}).otherSubgroupCoverage,'UNAVAILABLE');
});
test('broad category sanitizer rejects names, forged data, duplicate classes',()=>{
 const base={schema:'ZGMINI_PC_PROCESS_PROBE_V1',totalProcessCount:1,
  processes:[],memoryGroups:[{kind:'OTHER_PROCESSES',count:1,
   workingSetMiB:123,privateCommitMiB:66,zeroWorkingSetCount:0,
   unknownWorkingSetCount:0,unknownPrivateCommitCount:0}]};
 const valid={category:'UNCLASSIFIED_OTHER',count:1,
  workingSetMiB:123,privateCommitMiB:66};
 for(const groups of [
  [{...valid,category:'private.exe'}],
  [{...valid,workingSetMiB:-1}],
  [valid,valid]
 ])assert.throws(()=>sanitizeProbe({...base,otherSubgroups:groups}));
 for(const row of [
  {category:'private.exe',workingSetMiB:123,privateCommitMiB:1},
  {category:'WINDOWS_CORE_UI',workingSetMiB:-1,privateCommitMiB:1},
 ])assert.throws(()=>sanitizeProbe({...base,otherTopMemory:[row]}));
});
test('reject unapproved process names, task names, service names',()=>{
 const raw={schema:'ZGMINI_PC_PROCESS_PROBE_V1',
  processes:[{name:'unknown.exe',pid:1,ppid:0}],services:[],tasks:[]};
 assert.throws(()=>sanitizeProbe(raw),/PROBE_PROCESS_NOT_ALLOWLISTED/);
 assert.throws(()=>sanitizeProbe({...raw,processes:[],tasks:[{name:'MicrosoftWindows',state:'Ready'}]}));
 assert.throws(()=>sanitizeProbe({...raw,processes:[],services:[{name:'SecretsService',state:'Running'}]}));
});
test('result text is limited to safe run summary',()=>{
 const text=toText({schema:'R',requestId:'id',role:'handoff',runId:'1',
  attempt:'1',host:'PC',runnerName:'runner',status:'PASS',
  code:'PROCESS_INVENTORY_COLLECTED',observedAtUtc:'2026-11-12T00:00Z',
  snapshot:{totalProcessCount:140,selectedProcessCount:12}});
 assert.match(text,/totalProcessCount=140/);
 assert.doesNotMatch(text,/cmd|token|AppData|C:\\Users/i);
});
test('no implicit cross-host worker execution',()=>{
 const out=collect('operating',{requestId:'id',issueNumber:2,runId:'2',attempt:'1'},
  {RUNNER_NAME:'zgmini-handoff-ci-spare-01'});
 assert.equal(out.status,'BLOCKED');
});

test('operating maintainer status exposes only bounded hashes and safe lease booleans',()=>{
 const raw={maintenanceSourceSha:'a'.repeat(40),actualControllerSha:'b'.repeat(40),
  maintenanceFilesVerified:true,controllerFilesVerified:true,
  installLock:{held:true,recoveryRequired:true,owner:{nonce:'SECRET_NONCE'}},
  diagnostics:[],receiverStatus:'LISTENING',workflowState:'active',
  observedAt:'2026-11-13T01:02:03.123Z',privatePath:'E:/SECRET',
  token:'super-secret'};
 const out=sanitizeMaintenanceStatus(raw);
 assert.equal(out.status,'PASS');
 assert.equal(out.maintenanceSourceSha,'a'.repeat(40));
 assert.equal(out.actualControllerSha,'b'.repeat(40));
 assert.equal(out.installLockHeld,true);
 assert.equal(out.installLockRecoveryRequired,true);
 assert.equal(out.observedAtUtc,'2026-11-13T01:02:03.123Z');
 assert.equal(out.operationalWrites,0);
 assert.doesNotMatch(JSON.stringify(out),/SECRET|nonce|token|privatePath|owner/i);
});
test('missing lease evidence is unknown even if fallback marker claims it is held',()=>{
 const out=sanitizeMaintenanceStatus({maintenanceSourceSha:'a'.repeat(40),
  maintenanceFilesVerified:true,installLock:{held:true,recoveryRequired:true},
  diagnostics:['INSTALL_LEASE_UNAVAILABLE']});
 assert.equal(out.status,'STATE_UNKNOWN');
 assert.equal(out.installLockReadbackVerified,false);
 assert.equal(out.installLockHeld,null);
 assert.equal(out.installLockRecoveryRequired,null);
 assert.equal(sanitizeMaintenanceStatus(null).status,'STATE_UNKNOWN');
 assert.equal(sanitizeMaintenanceStatus({maintenanceSourceSha:'invalid'}).maintenanceSourceSha,null);
});

const pinned996=()=>({
 lockBefore:{held:true,recoveryRequired:true,ownerPid:4567},
 lockAfter:{held:true,recoveryRequired:true,ownerPid:4567},
 first:{
  owner:Buffer.from(JSON.stringify({pid:4567,nonce:'11111111-2222-4333-8444-555555555555',
   at:'2026-11-12T20:32:30.000Z'})),
  marker:Buffer.from(JSON.stringify({requestOwnerPid:4567,nonce:'11111111-2222-4333-8444-555555555555',
   at:'2026-11-12T20:32:32.000Z'})),
  ledger:Buffer.from(JSON.stringify({requestId:'pc-update-0010b2cf-9bca-40cf-89c5-b750fa42b404',
   issueNumber:996,targetSha:'9db6fff689c488a59fe8771f013b7c5d3bafc0a8',
   updatedAt:'2026-11-12T20:32:33.000Z'}))
 }
});
test('fixed 996 lease snapshots correlate only owner marker and pinned original ledger',()=>{
 const x=pinned996();x.second={...x.first};
 const result=classify996LeaseCorrelation(x);
 assert.equal(result.status,'CORRELATED');
 assert.equal(result.ownerPid,4567);
 assert.equal(result.ownerMarkerIdentityMatched,true);
 assert.equal(result.ledger996Matched,true);
 assert.equal(result.ledgerMarkerTimeMatched,true);
 for(const sha of ['ownerSha256','markerSha256','ledgerSha256'])
  assert.match(result[sha],/^[0-9a-f]{64}$/);
 assert.doesNotMatch(JSON.stringify(result),/11111111|targetSha|owner\\.json|nonce|owner\\.at|ZGmini/i);
});
test('mismatched original request and changed file snapshots never claim C996 ownership',()=>{
 const base=pinned996();
 const wrong={...base,second:{...base.first},
  first:{...base.first,ledger:Buffer.from(JSON.stringify({requestId:'another-request',
   issueNumber:996,targetSha:'9db6fff689c488a59fe8771f013b7c5d3bafc0a8',
   updatedAt:'2026-11-12T20:32:33.000Z'}))}};
 wrong.second={...wrong.first};
 assert.equal(classify996LeaseCorrelation(wrong).status,'STATE_UNKNOWN');
 assert.equal(classify996LeaseCorrelation(wrong).ledger996Matched,false);
 const drifting={...base,second:{...base.first,
  marker:Buffer.from('changed between snapshots')}};
 assert.equal(classify996LeaseCorrelation(drifting).code,'C996_ORIGINAL_SNAPSHOT_UNVERIFIED');
 assert.equal(classify996LeaseCorrelation({
  ...base,lockAfter:{held:false,recoveryRequired:false}}).status,'STATE_UNKNOWN');
});
test('read-only collector fails closed without fixed local files',()=>{
 const result=inspect996LeaseCorrelation({
  lock:()=>({held:true,recoveryRequired:true,ownerPid:4567}),
  stat:()=>{throw Error('offline');},
  read:()=>{throw Error('no file');}});
 assert.equal(result.status,'STATE_UNKNOWN');
 assert.equal(result.code,'C996_ORIGINAL_FILES_UNAVAILABLE');
 assert.equal(result.operationalWrites,0);
});
test('fixed 1501 lease snapshot distinguishes current owner from unrelated C996 ledger',()=>{
 const p=pinned996(),o=JSON.parse(p.first.owner.toString('utf8'));
 const ledger={requestId:'pc-update-95a0c24a-e0eb-4ad5-a250-559750f8450b',
  issueNumber:1501,targetSha:'b2ff49dd14a09ebeba482e2ae9a84530e00f094f',
  updatedAt:'2026-11-12T20:32:33.000Z'};
 const x={...p,first:{...p.first,ledger:Buffer.from(JSON.stringify(ledger))}};
 x.second={...x.first};
 const ok=classify1501LeaseCorrelation(x);
 assert.equal(ok.status,'CORRELATED');
 assert.equal(ok.code,'C1501_LEASE_IDENTITY_CORRELATED');
 assert.equal(ok.ledger1501Matched,true);
 assert.equal(ok.ownerMarkerIdentityMatched,true);
 assert.equal(ok.ledgerMarkerTimeMatched,true);
 assert.equal(Object.hasOwn(ok,'ledger996Matched'),false);
 assert.equal(classify996LeaseCorrelation(x).status,'STATE_UNKNOWN');
 const late={...x,first:{...x.first,ledger:Buffer.from(JSON.stringify({...ledger,
  updatedAt:'2026-11-16T12:00:00.000Z'}))}};
 late.second={...late.first};
 const mis=classify1501LeaseCorrelation(late);
 assert.equal(mis.status,'STATE_UNKNOWN');
 assert.equal(mis.ledger1501Matched,true);
 assert.equal(mis.ledgerMarkerTimeMatched,false);
 assert.doesNotMatch(JSON.stringify(mis),/95a0c24a|b2ff49dd|11111111|nonce|ZGmini/i);
});
test('fixed 1501 operation never follows user-controlled path or mutates files',()=>{
 const q=inspect1501LeaseCorrelation({lock:()=>({held:true,recoveryRequired:true,ownerPid:42}),
  stat:()=>{throw Error('no mounted ledger');},
  read:()=>{throw Error('unexpected read');}});
 assert.equal(q.status,'STATE_UNKNOWN');
 assert.equal(q.code,'C1501_ORIGINAL_FILES_UNAVAILABLE');
 assert.equal(q.operationalWrites,0);
 assert.equal(Object.hasOwn(q,'ledger996Matched'),false);
});
test('1501 recovery checkpoint preserves phase and PID existence without claiming safe release',()=>{
 const x=pinned996();
 x.first.ledger=Buffer.from(JSON.stringify({
  requestId:'pc-update-95a0c24a-e0eb-4ad5-a250-559750f8450b',
  issueNumber:1501,targetSha:'b2ff49dd14a09ebeba482e2ae9a84530e00f094f',
  status:'RECOVERY_REQUIRED',phase:'RECOVERY_REQUIRED',firstFail:'RECONNECTED',
  failureOperation:'resumeIntake',intakePaused:true,workflowEnabled:false,
  updatedAt:'2026-11-12T20:32:33.000Z',token:'SECRET_TOKEN'}));
 x.second={...x.first};
 const z=classify1501RecoveryCheckpoint(x,{
  signal:(pid,flag)=>{assert.equal(pid,4567);assert.equal(flag,0);},
  backupPresent:true,backlogPresent:false});
 assert.equal(z.status,'CORRELATED');
 assert.equal(z.ledgerPhase,'RECOVERY_REQUIRED');
 assert.equal(z.ledgerFirstFail,'RECONNECTED');
 assert.equal(z.ledgerFailureOperation,'resumeIntake');
 assert.equal(z.ownerPidObservation,'PID_PRESENT_IDENTITY_UNVERIFIED');
 assert.equal(z.backupPresent,true);
 assert.equal(z.backlogPresent,false);
 assert.equal(z.eligibleForAutomaticRelease,false);
 assert.doesNotMatch(JSON.stringify(z),/SECRET_TOKEN|nonce|targetSha|requestId|ZGmini/i);
 const absent=classify1501RecoveryCheckpoint(x,{
  signal:()=>{const e=new Error('not found');e.code='ESRCH';throw e;}});
 assert.equal(absent.ownerPidObservation,'PID_NOT_PRESENT');
 assert.equal(absent.eligibleForAutomaticRelease,false);
});
test('1501 recovery checkpoint refuses to interpret uncorrelated or malformed phase',()=>{
 const x=pinned996();x.second={...x.first};
 const no=classify1501RecoveryCheckpoint(x,{signal:()=>{throw Error('should not probe');}});
 assert.equal(no.status,'STATE_UNKNOWN');
 assert.equal(no.ownerPidObservation,'UNKNOWN');
 assert.equal(no.ledgerPhase,null);
});
test('#1841 original ledger is correlated only with its own matching live owner marker',()=>{
 const x=pinned996();
 x.first.ledger=Buffer.from(JSON.stringify({
  requestId:'pc-update-7acb05d3-2860-4d19-8e30-55fe78892b12',
  issueNumber:1841,targetSha:'2f569c18e09a55e54e81052985a80f6a8765d680',
  status:'RECOVERY_REQUIRED',phase:'SWITCHED',firstFail:'SWITCHED',
  failureOperation:'reconcileBacklog',intakePaused:true,workflowEnabled:false,
  updatedAt:'2026-11-12T20:32:33.000Z',token:'SECRET_DO_NOT_LEAK'}));
 x.second={...x.first};
 const result=classify1841RecoveryCheckpoint(x,{
  signal:()=>{const e=new Error('absent');e.code='ESRCH';throw e;},
  backupPresent:true,backlogPresent:true});
 assert.equal(result.status,'CORRELATED');
 assert.equal(result.code,'C1841_LEASE_IDENTITY_CORRELATED');
 assert.equal(result.ledger1841Matched,true);
 assert.equal(result.ledgerPhase,'SWITCHED');
 assert.equal(result.ledgerFirstFail,'SWITCHED');
 assert.equal(result.ledgerFailureOperation,'reconcileBacklog');
 assert.equal(result.ownerPidObservation,'PID_NOT_PRESENT');
 assert.equal(result.backupPresent,true);
 assert.equal(result.backlogPresent,true);
 assert.equal(result.eligibleForAutomaticRelease,false);
 assert.equal(Object.hasOwn(result,'ledger996Matched'),false);
 assert.doesNotMatch(JSON.stringify(result),/SECRET_DO_NOT_LEAK|7acb05d3|2f569c18|nonce|ZGmini/i);
});
test('#1841 stale ledger timing or another owner never authenticates a held lease',()=>{
 const x=pinned996();
 const wrong=classify1841RecoveryCheckpoint({...x,second:{...x.first}});
 assert.equal(wrong.status,'STATE_UNKNOWN');
 assert.equal(wrong.ledger1841Matched,false);
 x.first.ledger=Buffer.from(JSON.stringify({
  requestId:'pc-update-7acb05d3-2860-4d19-8e30-55fe78892b12',
  issueNumber:1841,targetSha:'2f569c18e09a55e54e81052985a80f6a8765d680',
  status:'RECOVERY_REQUIRED',phase:'SWITCHED',firstFail:'SWITCHED',
  updatedAt:'2026-11-17T01:40:00.000Z',note:'SECRET'}));
 x.second={...x.first};
 const stale=classify1841RecoveryCheckpoint(x,{backupPresent:true,backlogPresent:false,
  signal:()=>{throw Error('MUST_NOT_SIGNAL_UNVERIFIED_OWNER');}});
 assert.equal(stale.status,'STATE_UNKNOWN');
 assert.equal(stale.ledger1841Matched,true);
 assert.equal(stale.ownerMarkerIdentityMatched,true);
 assert.equal(stale.ledgerMarkerTimeMatched,false);
 assert.equal(stale.ledgerPhase,'SWITCHED');
 assert.equal(stale.ownerPidObservation,'UNKNOWN');
 assert.equal(stale.eligibleForAutomaticRelease,false);
 assert.doesNotMatch(JSON.stringify(stale),/SECRET|7acb05d3|nonce|ZGmini/i);
});
test('#1841 fixed read-only probe rejects missing original bytes without writing or executing',()=>{
 const out=inspect1841LeaseCorrelation({
  lock:()=>({held:true,recoveryRequired:true,ownerPid:1}),
  stat:()=>{throw Error('absent');},
  read:()=>{throw Error('MUST_NOT_READ_UNSAFE');},
  signal:()=>{throw Error('MUST_NOT_EXECUTE');}});
 assert.equal(out.status,'STATE_UNKNOWN');
 assert.equal(out.code,'C1841_ORIGINAL_FILES_UNAVAILABLE');
 assert.equal(out.operationalWrites,0);
 assert.equal(out.providerCalls,0);
 assert.equal(out.d1Writes,0);
});
test('workflow state distinguishes current active and manual disable without exposing raw data',()=>{
 const base={maintenanceSourceSha:'a'.repeat(40),maintenanceFilesVerified:true,
  installLock:{held:true,recoveryRequired:true},diagnostics:[]};
 assert.equal(sanitizeMaintenanceStatus({...base,workflowState:'active'}).workflowState,'active');
 assert.equal(sanitizeMaintenanceStatus({...base,workflowState:'disabled_manually'}).workflowState,'disabled_manually');
 assert.equal(sanitizeMaintenanceStatus({...base,workflowState:'disabled_inactivity'}).workflowState,'disabled_inactivity');
 assert.equal(sanitizeMaintenanceStatus({...base,workflowState:'SECRET_TOKEN'}).workflowState,'UNVERIFIED');
});
test('project repeated HTTP host names only, never raw tokens, one-off, or URL paths',()=>{
 const raw={status:'PASS',source:'PC_COLLECTION_EVENTS_FETCH_WRAPPER',scope:'FIXED_LOCAL_JSONL_ONLY',
  now:'2026-11-16T12:00:00Z',windowDays:14,monitoredHostCount:2,
  monitoredHostsReturned:2,omittedHosts:0,
  http:{normal:1,failed:1,unknown:0,total:2},
  hosts:[
   {host:'api.example.gov',monitored:true,monitoringState:'normal',reason:'RECENT_2XX',
    lastAttemptAt:'2026-11-16T11:00:00Z',last2xxRunAt:'2026-11-16T11:00:00Z',
    lastRunStatuses:{200:1},token:'DO_NOT_LEAK',url:'https://secret/path?key=secret'},
   {host:'status.example.gov',monitored:true,monitoringState:'failed',
    reason:'LAST_HTTP_ERROR',lastAttemptAt:'2026-11-16T11:10:00Z',
    last2xxRunAt:null,lastRunStatuses:{503:2}},
   {host:'only-once.example.gov',monitored:false,monitoringState:'unknown',
    reason:'NOT_REPEATED',lastAttemptAt:'2026-11-16T11:00:00Z',
    last2xxRunAt:null,lastRunStatuses:{200:1}}
  ]};
 const projected=projectObservedProviderHosts(raw);
 assert.equal(projected.status,'PASS');
 assert.equal(projected.monitoredCount,2);
 assert.equal(projected.rosterComplete,true);
 assert.deepEqual(projected.http,{normal:1,failed:1,unknown:0,total:2});
 assert.deepEqual(projected.hosts.map(x=>x.host),['api.example.gov','status.example.gov']);
 assert.doesNotMatch(JSON.stringify(projected),/DO_NOT_LEAK|only-once|secret\/path|token|https:\/\//i);
 assert.equal(projected.providerCalls,0);assert.equal(projected.operationalWrites,0);
});
test('partial or malformed observed HTTP evidence does not assert validated connection health',()=>{
 const row={status:'STATE_UNKNOWN',source:'PC_COLLECTION_EVENTS_FETCH_WRAPPER',
  scope:'FIXED_LOCAL_JSONL_ONLY',now:'2026-11-16T12:00:00Z',windowDays:14,
  monitoredHostCount:2,monitoredHostsReturned:1,omittedHosts:1,
  http:{normal:2,failed:0,unknown:0,total:2},
  hosts:[{host:'api.example.gov',monitored:true,monitoringState:'normal',reason:'RECENT_2XX',
   lastAttemptAt:'2026-11-16T11:00:00Z',last2xxRunAt:'2026-11-16T11:00:00Z',
   lastRunStatuses:{200:1}}]};
 const partial=projectObservedProviderHosts(row);
 assert.equal(partial.status,'STATE_UNKNOWN');
 assert.equal(partial.rosterComplete,false);
 assert.equal(partial.hosts.length,1);
 assert.equal(partial.http,null);
 assert.equal(projectObservedProviderHosts({...row,hosts:[{...row.hosts[0],
  host:'user:password@api.example.gov'}]}).status,'STATE_UNKNOWN');
});
test('#1501 open paused backlog window and durable replays summarize without raw content',()=>{
 const raw=Buffer.from(JSON.stringify({schema:'ZGMINI_PC_BACKLOG_V1',
  windows:[{pausedAt:'2026-11-16T00:35:00Z',resumedAt:null}],
  replays:{'1503':{status:'POSTING',body:'SECRET_TOKEN'},
   '1508':{status:'SKIPPED_RESULT_PRESENT',command:'secret cmd'},
   '1510':{status:'DONE'}},token:'SECRET_TOKEN'}));
 const x=classify1501BacklogBytes(raw,raw);
 assert.equal(x.status,'PASS');assert.equal(x.openWindowCount,1);
 assert.equal(x.windowCount,1);assert.equal(x.replayCount,3);
 assert.deepEqual(x.replayCounts,{done:1,skippedResultPresent:1,posting:1,otherUnverified:0});
 assert.deepEqual(x.replays.map(z=>z.issueNumber),[1503,1508,1510]);
 assert.equal(x.mutationAllowed,false);
 assert.doesNotMatch(JSON.stringify(x),/SECRET_TOKEN|secret cmd|nonce|body/i);
 assert.equal(classify1501BacklogBytes(raw,Buffer.from('drift')).status,'STATE_UNKNOWN');
});
test('#1501 backlog refuses wrong schema, invalid windows, symlink, missing owner',()=>{
 const build=v=>Buffer.from(JSON.stringify(v));
 assert.equal(classify1501BacklogBytes(build({schema:'OTHER'}),build({schema:'OTHER'})).status,'STATE_UNKNOWN');
 const invalid=build({schema:'ZGMINI_PC_BACKLOG_V1',windows:[{pausedAt:'x',resumedAt:null}]});
 assert.equal(classify1501BacklogBytes(invalid,invalid).status,'STATE_UNKNOWN');
 const q=inspect1501BacklogReadonly({correlation:()=>({status:'STATE_UNKNOWN'}),
  stat:()=>{throw Error('must not read');},read:()=>{throw Error('must not read');}});
 assert.equal(q.code,'C1501_BACKLOG_OWNER_UNVERIFIED');
 const unsafe=inspect1501BacklogReadonly({correlation:()=>({status:'CORRELATED'}),
  stat:()=>({isDirectory:()=>false,isSymbolicLink:()=>true}),
  read:()=>{throw Error('must not read');}});
 assert.equal(unsafe.code,'C1501_BACKLOG_UNSAFE_DIRECTORY');
});
test('#1501 current runtime and independent maintenance health are distinct from workflow and lease',()=>{
 const base={maintenanceSourceSha:'a'.repeat(40),maintenanceFilesVerified:true,
  actualControllerSha:'b'.repeat(40),
  installLock:{held:true,recoveryRequired:true},diagnostics:[],
  workflowState:'active',runtimeState:'HEALTHY',
  maintenanceState:'HEALTHY',automationState:'HEALTHY',nonce:'secret'};
 const ok=sanitizeMaintenanceStatus(base);
 assert.equal(ok.runtimeState,'HEALTHY');
 assert.equal(ok.maintenanceState,'HEALTHY');
 assert.equal(ok.automationState,'HEALTHY');
 assert.equal(ok.workflowState,'active');
 assert.equal(ok.installLockHeld,true);
 assert.doesNotMatch(JSON.stringify(ok),/nonce|secret/i);
 const unknown=sanitizeMaintenanceStatus({...base,runtimeState:'COMPROMISED',
  maintenanceState:'COMPROMISED',automationState:'COMPROMISED'});
 assert.equal(unknown.runtimeState,'UNVERIFIED');
 assert.equal(unknown.maintenanceState,'UNVERIFIED');
 assert.equal(unknown.automationState,'PARTIAL_OR_UNVERIFIED');
});
test('#1501 isolate runtime signal that prevents healthy classification',()=>{
 const sample={controllerFilesVerified:true,supervisorAlive:false,
  supervisorIdentityVerified:false,supervisorFresh:false,
  supervisorChildrenVerified:false,runnerSetOnline:true,workflowState:'active',
  nonce:'SECRET_NONCE',ownerPid:4567};
 const signals=safeRuntimeSignals(sample);
 assert.deepEqual(signals,{
  controllerFilesVerified:true,supervisorAlive:false,
  supervisorIdentityVerified:false,supervisorFresh:false,
  supervisorChildrenVerified:false,runnerSetOnline:true,workflowActive:true});
 const projected=sanitizeRuntimeSignals(signals);
 assert.deepEqual(projected,signals);
 assert.doesNotMatch(JSON.stringify(projected),/SECRET|nonce|ownerPid|4567/);
 const unknown=safeRuntimeSignals({workflowState:'ERROR',
  supervisorAlive:'yes',runnerSetOnline:'online'});
 assert.equal(unknown.supervisorAlive,null);
 assert.equal(unknown.runnerSetOnline,null);
 assert.equal(unknown.workflowActive,null);
 assert.equal(sanitizeRuntimeSignals({supervisorAlive:'false'}).supervisorAlive,null);
});
test('runner-query missing cannot be misreported as actual offline six seats',()=>{
 const q=sanitizeDedicatedRunnerEvidence({diagnostics:['RUNNERS_QUERY_UNAVAILABLE'],runners:null});
 assert.equal(q.queryState,'QUERY_UNAVAILABLE');
 assert.equal(q.allSixOnline,null);
 assert.deepEqual(q.runners.map(x=>x.status),Array(6).fill('UNVERIFIED'));
 const rows=Array.from({length:6},(_,i)=>({
  name:'zgmini-pc-0'+(i+1),status:'online',busy:false,token:'HIDDEN'}));
 const x=sanitizeDedicatedRunnerEvidence({runners:rows});
 assert.equal(x.queryState,'QUERY_RETURNED');
 assert.equal(x.allSixOnline,true);
 assert.equal(x.runners.length,6);
 assert.doesNotMatch(JSON.stringify(x),/HIDDEN|token/);
 const partial=sanitizeDedicatedRunnerEvidence({runners:[
  ...rows.slice(0,4),{...rows[4],status:'offline'},rows[5],rows[5]]});
 assert.equal(partial.allSixOnline,false);
 assert.equal(partial.runners[4].status,'offline');
 assert.equal(partial.runners[5].status,'DUPLICATE');
 const unknown=sanitizeDedicatedRunnerEvidence({runners:[{name:'zgmini-pc-01',
  status:'SUSPICIOUS',busy:'maybe',password:'SECRET'}]});
 assert.equal(unknown.runners[0].status,'UNVERIFIED');
 assert.equal(unknown.runners[0].busy,null);
 assert.doesNotMatch(JSON.stringify(unknown),/SECRET|password/);
});
test('runner query HTTP 403 emits read-only forbidden classification, no fabricated offline list',()=>{
 const x=sanitizeDedicatedRunnerEvidence({diagnostics:['RUNNERS_QUERY_UNAVAILABLE'],
  runnerQueryError:'HTTP_403_FORBIDDEN',runners:null,token:'SECRET'});
 assert.equal(x.queryState,'QUERY_UNAVAILABLE');
 assert.equal(x.queryFailureReason,'HTTP_403_FORBIDDEN');
 assert.equal(x.allSixOnline,null);
 assert.deepEqual(x.runners.map(row=>row.status),Array(6).fill('UNVERIFIED'));
 assert.doesNotMatch(JSON.stringify(x),/SECRET|token/);
 assert.equal(sanitizeDedicatedRunnerEvidence({diagnostics:['RUNNERS_QUERY_UNAVAILABLE'],
  runnerQueryError:'PRIVATE'}).queryFailureReason,null);
});

test('three fixed hosts preserve hashed endpoint 404 receipts without paths or credentials',()=>{
 const NOW=Date.parse('2026-11-16T13:10:00Z');
 const hash='a'.repeat(32),other='b'.repeat(32);
 const lines=[
  JSON.stringify({at:'2026-11-16T11:05:00Z',endpointPaths:{
   'data.sec.gov':{[hash]:{requests:2,statuses:{200:1,404:1}}},
   'cdn.www.census.gov':{[other]:{requests:1,statuses:{200:1}}},
   'private.example.org':{[other]:{requests:1,statuses:{500:1}}},
   },secret:'DO_NOT_PUBLISH',url:'https://data.sec.gov/secret-path?token=x'}),
  JSON.stringify({at:'2026-11-16T11:06:00Z',endpointPaths:{
   'data.sec.gov':{[hash]:{requests:1,statuses:{404:1}}}}},
  )];
 const q=projectTargetEndpointStatus(lines,NOW);
 assert.equal(q.status,'OBSERVED');
 assert.equal(q.hosts.length,3);
 assert.equal(q.hosts[0].host,'data.sec.gov');
 assert.equal(q.hosts[0].endpointCount,1);
 assert.deepEqual(q.hosts[0].endpointHashes[0].lastStatuses,{'404':1});
 assert.equal(q.hosts[0].endpointHashes[0].last2xxAt,'2026-11-16T11:05:00.000Z');
 assert.equal(q.hosts[0].endpointHashes[0].last404At,'2026-11-16T11:06:00.000Z');
 assert.equal(q.endpointCoverageVerified,false);
 assert.doesNotMatch(JSON.stringify(q),/DO_NOT_PUBLISH|private\.example|secret-path|token|https:\/\//);
});
test('invalid and partial endpoint log cannot claim comprehensive HTTP coverage',()=>{
 const now=Date.parse('2026-11-16T13:10:00Z');
 const bad=projectTargetEndpointStatus(['{"at": "garbage"}'],now);
 assert.equal(bad.status,'STATE_UNKNOWN');
 assert.equal(bad.invalidEvents,1);
 const partial=projectTargetEndpointStatus([JSON.stringify({
  at:'2026-11-16T13:00:00Z',endpointPaths:{'data.sec.gov':{
   ['c'.repeat(32)]:{requests:1,statuses:{200:1}}}}})],now,{partialTail:true});
 assert.equal(partial.status,'STATE_UNKNOWN');
 assert.equal(partial.endpointCoverageVerified,false);
 const forged=projectTargetEndpointStatus([JSON.stringify({
  at:'2026-11-16T13:00:00Z',endpointPaths:{'data.sec.gov':{
   'user:pass@api':{requests:1,statuses:{200:1}}}}})],now);
 assert.equal(forged.status,'STATE_UNKNOWN');
});

test('recent real HTTP 200 with unverified cadence is safe in exact A roster projection',()=>{
 const host={host:'data.alpaca.markets',monitored:true,monitoringState:'normal',
  reason:'RECENT_2XX_CADENCE_UNVERIFIED',lastAttemptAt:'2026-11-16T00:00:11.478Z',
  last2xxRunAt:'2026-11-16T00:00:11.478Z',lastRunStatuses:{200:1},
  secret:'PRIVATE_CREDENTIAL'};
 const raw={status:'PASS',source:'PC_COLLECTION_EVENTS_FETCH_WRAPPER',
  scope:'FIXED_LOCAL_JSONL_ONLY',now:'2026-11-16T14:34:00Z',
  windowDays:14,monitoredHostCount:1,monitoredHostsReturned:1,
  omittedHosts:0,http:{normal:1,failed:0,unknown:0,total:1},hosts:[host]};
 const projected=projectObservedProviderHosts(raw);
 assert.equal(projected.status,'PASS');
 assert.deepEqual(projected.http,{normal:1,failed:0,unknown:0,total:1});
 assert.equal(projected.hosts[0].reason,'RECENT_2XX_CADENCE_UNVERIFIED');
 assert.doesNotMatch(JSON.stringify(projected),/PRIVATE_CREDENTIAL/);
 assert.equal(projected.providerCalls,0);
 assert.equal(projected.operationalWrites,0);
 assert.equal(projectObservedProviderHosts({...raw,hosts:[
  {...host,reason:'RECENT_2XX_SECRET_COMMAND'}]}).status,'STATE_UNKNOWN');
});

test('bounded monthly Census source evidence is allowed in sanitised 32-host roster',()=>{
 const h={host:'cdn.www.census.gov',monitored:true,monitoringState:'normal',
  reason:'MONTHLY_BFS_2XX_IN_OBSERVED_WINDOW',
  lastAttemptAt:'2026-11-03T21:00:36.518Z',
  last2xxRunAt:'2026-11-03T21:00:36.518Z',
  lastRunStatuses:{200:1},rawSecret:'DO_NOT_PRINT'};
 const raw={status:'PASS',source:'PC_COLLECTION_EVENTS_FETCH_WRAPPER',
  scope:'FIXED_LOCAL_JSONL_ONLY',now:'2026-11-16T14:34:00Z',
  windowDays:14,monitoredHostCount:1,monitoredHostsReturned:1,
  omittedHosts:0,http:{normal:1,failed:0,unknown:0,total:1},hosts:[h]};
 const result=projectObservedProviderHosts(raw);
 assert.equal(result.rosterComplete,true);
 assert.deepEqual(result.http,{normal:1,failed:0,unknown:0,total:1});
 assert.equal(result.hosts[0].reason,'MONTHLY_BFS_2XX_IN_OBSERVED_WINDOW');
 assert.equal(result.providerCalls,0);assert.equal(result.operationalWrites,0);
 assert.ok(!JSON.stringify(result).includes('DO_NOT_PRINT'));
 const tampered=projectObservedProviderHosts({...raw,hosts:[{...h,
  reason:'MONTHLY_BFS_2XX_IN_OBSERVED_WINDOW_SECRET'}]});
 assert.equal(tampered.status,'STATE_UNKNOWN');
});


test('browser attribution distinguishes Runner descendants from nonzero Windows sessions using only aggregate memory',()=>{
 const fixture={schema:'ZGMINI_PC_PROCESS_PROBE_V1',totalProcessCount:3,
  selectedProcessCount:0,processes:[],services:[],tasks:[],
  memoryGroups:[{kind:'OTHER_PROCESSES',count:3,workingSetMiB:6000,
   privateCommitMiB:12000,zeroWorkingSetCount:0,
   unknownWorkingSetCount:0,unknownPrivateCommitCount:0}],
  otherSubgroups:[{category:'BROWSER_WEBVIEW',count:3,workingSetMiB:6000,
   privateCommitMiB:12000}],
  browserAttribution:[
   {class:'RUNNER_DESCENDANT',count:1,workingSetMiB:400,privateCommitMiB:900,
    pid:123,name:'SECRET_USER_BROWSER'},
   {class:'NONZERO_SESSION_NONRUNNER',count:2,workingSetMiB:5600,
    privateCommitMiB:11100,cmd:'NEVER_SHOW'}
  ]};
 const out=sanitizeProbe(fixture);
 assert.equal(out.browserAttributionCoverage,'COUNT_COMPLETE');
 assert.equal(out.browserAttribution.length,2);
 assert.equal(out.browserAttribution.reduce((v,g)=>v+g.workingSetMiB,0),6000);
 assert.deepEqual(Object.keys(out.browserAttribution[0]),
  ['class','count','workingSetMiB','privateCommitMiB']);
 assert.doesNotMatch(JSON.stringify(out),/SECRET_USER_BROWSER|NEVER_SHOW|pid|cmd/);
 assert.equal(sanitizeProbe({...fixture,browserAttribution:undefined})
  .browserAttributionCoverage,'UNAVAILABLE');
 for(const bad of [
  [{...fixture.browserAttribution[0],class:'SECRET_APPLICATION'},
   fixture.browserAttribution[1]],
  [{...fixture.browserAttribution[0],count:2},fixture.browserAttribution[1]],
  [{...fixture.browserAttribution[0],workingSetMiB:-1},fixture.browserAttribution[1]],
  [fixture.browserAttribution[0],fixture.browserAttribution[0]],
  [fixture.browserAttribution[0]],
  [{...fixture.browserAttribution[0],class:'SESSION_ZERO_NONRUNNER',count:0},
   fixture.browserAttribution[1]]
 ])assert.throws(()=>sanitizeProbe({...fixture,browserAttribution:bad}));
});
test('zero-browser inventory yields complete empty attribution and rejects invented browser processes',()=>{
 const raw={schema:'ZGMINI_PC_PROCESS_PROBE_V1',totalProcessCount:1,
  selectedProcessCount:0,processes:[],otherSubgroups:[
   {category:'WINDOWS_CORE_UI',count:1,workingSetMiB:10,privateCommitMiB:15}],
  browserAttribution:[]};
 assert.equal(sanitizeProbe(raw).browserAttributionCoverage,'COUNT_COMPLETE');
 assert.throws(()=>sanitizeProbe({...raw,browserAttribution:[
  {class:'NONZERO_SESSION_NONRUNNER',count:1,workingSetMiB:10,privateCommitMiB:15}
 ]}));
});


test('unclassified OTHER attribution keeps exact class totals without leaking process identifiers',()=>{
 const base={schema:'ZGMINI_PC_PROCESS_PROBE_V1',
  totalProcessCount:4,selectedProcessCount:0,processes:[],services:[],tasks:[],
  memoryGroups:[{kind:'OTHER_PROCESSES',count:4,workingSetMiB:4402,
   privateCommitMiB:7300,zeroWorkingSetCount:0,
   unknownWorkingSetCount:0,unknownPrivateCommitCount:0}],
  otherSubgroups:[{category:'UNCLASSIFIED_OTHER',count:4,
   workingSetMiB:4402,privateCommitMiB:7300}],
  unclassifiedAttribution:[
   {class:'RUNNER_DESCENDANT',count:1,workingSetMiB:1659,
    privateCommitMiB:1865,name:'PRIVATE_PROCESS',pid:123,commandLine:'secret'},
   {class:'NONZERO_SESSION_NONRUNNER',count:3,workingSetMiB:2743,
    privateCommitMiB:5435,username:'PRIVATE_USER',path:'SECRET_PATH'}
  ]};
 const result=sanitizeProbe(base);
 assert.equal(result.unclassifiedAttributionCoverage,'COUNT_COMPLETE');
 assert.equal(result.unclassifiedAttribution.length,2);
 assert.equal(result.unclassifiedAttribution.reduce((n,g)=>n+g.workingSetMiB,0),4402);
 assert.deepEqual(Object.keys(result.unclassifiedAttribution[0]),
  ['class','count','workingSetMiB','privateCommitMiB']);
 assert.doesNotMatch(JSON.stringify(result),
  /PRIVATE_PROCESS|PRIVATE_USER|SECRET_PATH|secret|commandLine|username/);
 assert.equal(sanitizeProbe({...base,unclassifiedAttribution:undefined})
  .unclassifiedAttributionCoverage,'UNAVAILABLE');
 for(const invalid of [
  [{...base.unclassifiedAttribution[0],class:'UNAPPROVED_APP'},
   base.unclassifiedAttribution[1]],
  [base.unclassifiedAttribution[0],base.unclassifiedAttribution[0]],
  [{...base.unclassifiedAttribution[0],count:2},
   base.unclassifiedAttribution[1]],
  [{...base.unclassifiedAttribution[0],workingSetMiB:-1},
   base.unclassifiedAttribution[1]],
  [{...base.unclassifiedAttribution[0],count:0},
   base.unclassifiedAttribution[1]],
  [base.unclassifiedAttribution[0]]
 ])assert.throws(()=>sanitizeProbe({...base,unclassifiedAttribution:invalid}));
});
test('no UNCLASSIFIED_OTHER gives complete empty attribution only for empty groups',()=>{
 const base={schema:'ZGMINI_PC_PROCESS_PROBE_V1',totalProcessCount:1,
  selectedProcessCount:0,processes:[],
  otherSubgroups:[{category:'WINDOWS_CORE_UI',count:1,
   workingSetMiB:50,privateCommitMiB:80}],
  unclassifiedAttribution:[]};
 assert.equal(sanitizeProbe(base).unclassifiedAttributionCoverage,'COUNT_COMPLETE');
 assert.throws(()=>sanitizeProbe({...base,unclassifiedAttribution:[
  {class:'SESSION_ZERO_NONRUNNER',count:1,workingSetMiB:50,privateCommitMiB:80}
 ]}));
});

const C2094_ID='pc-update-dbed28c1-a59b-403b-84c6-8cf190930cb5';
function stage2094Fixture(){
 return {status:'STATUS',installedReadbackCode:null,ledgerReadbackCode:null,
  lockReadbackCode:null,artifactReadbackCode:null,
  actualControllerSha:'f7f1559bc0ef15bb9b375982d048369c474c490f',
  installLock:{held:false,recoveryRequired:false,ownerPid:12345,nonce:'NO_EXPORT'},
  ledger:{schema:'ZGMINI_PC_UPDATE_RESULT_V1',requestId:C2094_ID,
   issueNumber:2094,targetSha:'ead5d2d585ff2ce2a6df5f9b6cf720f65d90b49b',
   installedShaBefore:'f7f1559bc0ef15bb9b375982d048369c474c490f',
   status:'BLOCKED',phase:'BLOCKED',firstFail:'STAGED',
   failureOperation:'pauseIntake',code:'WORKFLOW_DISABLE_NOT_CONFIRMED',
   workflowEnabled:true,nonce:'CONFIDENTIAL',absolutePath:'E:/PRIVATE/data',
   providerApiKey:'SECRET'},
  artifacts:{schema:'ZGMINI_PC_UPDATE_ARTIFACT_READBACK_V1',requestId:C2094_ID,
   status:'OBSERVED',recoveryComplete:false,installSuccessProven:false,
   artifacts:{backupRoot:'PRESENT',stageRoot:'PRESENT',stagedHost:'PRESENT',
    snapshotRoot:'ABSENT',originalHost:'ABSENT',protectedBefore:'ABSENT',
    previousHost:'ABSENT'},backlog:{file:'PRESENT',windows:1,openWindows:0,
     replayCount:0,secret:'NO_EXPORT'},
   lease:{directory:'ABSENT',ownerFile:'ABSENT',recoveryMarker:'ABSENT',
    ownerMarkerMatch:null,privateOwner:'NO_EXPORT'}}};
}
test('C2094 fixed A scope reports actual stage metadata but NEVER approves recovery',()=>{
 const j=stage2094Fixture(),r=summarize2094StageStatus(j);
 assert.equal(r.status,'READ_ONLY_OBSERVED');
 assert.equal(r.ledgerFirstFail,'STAGED');
 assert.equal(r.ledgerFailureOperation,'pauseIntake');
 assert.equal(r.backup.stageRoot,'PRESENT');
 assert.equal(r.backlog.openWindows,0);
 assert.equal(r.lease.held,false);
 assert.equal(r.restorationVerified,false);
 assert.equal(r.recoveryEligible,false);
 const output=JSON.stringify(r);
 assert.doesNotMatch(output,/NO_EXPORT|CONFIDENTIAL|SECRET|PRIVATE|ownerPid|nonce|absolutePath|providerApiKey/);
 assert.equal(inspect2094StageReadonly(()=>j).status,'READ_ONLY_OBSERVED');
});
test('C2094 fixed A scope rejects wrong issue, target, prior SHA and foreign request',()=>{
 const a=stage2094Fixture(),bad=[
  {...a,ledger:{...a.ledger,requestId:'pc-update-other-1234567890'}},
  {...a,ledger:{...a.ledger,issueNumber:9999}},
  {...a,ledger:{...a.ledger,targetSha:'a'.repeat(40)}},
  {...a,ledger:{...a.ledger,installedShaBefore:'b'.repeat(40)}},
  {...a,artifacts:{...a.artifacts,requestId:'pc-update-other-1234567890'}},
  {...a,installedReadbackCode:'INSTALLED_MANIFEST_UNAVAILABLE'}
 ];
 for(const j of bad)assert.equal(summarize2094StageStatus(j).status,'STATE_UNKNOWN');
});
test('C2094 fixed A scope fails closed on unknown type, damaged readback or unstable snapshot',()=>{
 const a=stage2094Fixture();
 for(const j of [
  {...a,artifacts:{...a.artifacts,status:'UNVERIFIED'}},
  {...a,artifactReadbackCode:'UPDATE_ARTIFACTS_UNVERIFIED'},
  {...a,installLock:{held:'false'}},
  {...a,artifacts:{...a.artifacts,artifacts:{...a.artifacts.artifacts,stageRoot:'SYMLINK'}}},
  {...a,artifacts:{...a.artifacts,backlog:{...a.artifacts.backlog,openWindows:-1}}},
 ]){
  const result=summarize2094StageStatus(j);
  assert.equal(result.status,'STATE_UNKNOWN');
  assert.equal(result.recoveryEligible,false);
 }
 assert.equal(inspect2094StageReadonly(()=>{throw Error('secret token');}).status,'STATE_UNKNOWN');
 let reads=0;
 const changed=inspect2094StageReadonly(()=>({
  ...a,artifacts:{...a.artifacts,backlog:{...a.artifacts.backlog,openWindows:reads++?1:0}}}));
 assert.equal(changed.code,'C2094_DOUBLE_READ_CHANGED');
 assert.doesNotMatch(JSON.stringify(changed),/secret|token/i);
});

test('fixed MarketParquet Task fingerprint never reveals credentials or command line',()=>{
 const xml='<Task><Settings><Enabled>true</Enabled></Settings><Actions><Exec>'+
  '<Command>C:\\Windows\\System32\\cmd.exe</Command>'+
  '<Arguments>/d /c &quot;E:\\ZGmini\\data\\pc-writer\\legacy\\collect.cmd&quot; SECRET_TOKEN</Arguments>'+
  '</Exec></Actions></Task>';
 const bytes=Buffer.from(xml);
 const evidence=inspectTask({platform:'win32',query:()=>({status:0,stdout:bytes}),
  hashEntry:p=>{assert.equal(p,'E:\\ZGmini\\data\\pc-writer\\legacy\\collect.cmd');return 'a'.repeat(64);},
  clock:()=> '2026-11-18T09:00:00Z'});
 assert.equal(TASK,'ZGMINI-PC-MarketParquet-ETF');
 assert.equal(evidence.status,'PASS');
 assert.equal(evidence.taskEnabled,true);
 assert.equal(evidence.actionKind,'CMD');
 assert.equal(evidence.entryFileScope,'E_DATA');
 assert.equal(evidence.entryFileLeaf,'collect.cmd');
 assert.equal(evidence.entryFileSha256,'a'.repeat(64));
 assert.equal(evidence.taskXmlSha256,createHash('sha256').update(bytes).digest('hex'));
 assert.doesNotMatch(JSON.stringify(evidence),/SECRET_TOKEN|legacy|\/d \/c|C:\\Windows/);
});
test('MarketParquet Task probe fails closed for missing/ambiguous/unapproved sources',()=>{
 const doc=(enabled,execs)=>'<Task><Settings><Enabled>'+enabled+'</Enabled></Settings><Actions>'+execs+'</Actions></Task>';
 const exec=p=>'<Exec><Command>E:\\ZGmini\\runtime\\node.exe</Command><Arguments>'+p+'</Arguments></Exec>';
 const probe=x=>inspectTask({platform:'win32',query:()=>({status:0,stdout:Buffer.from(x)}),
  hashEntry:()=> 'b'.repeat(64)});
 assert.equal(inspectTask({platform:'linux'}).status,'STATE_UNKNOWN');
 assert.equal(probe(doc('true',exec('C:\\Users\\x.mjs'))).code,'TASK_SOURCE_OUTSIDE_APPROVED_ROOT');
 assert.equal(probe(doc('true',exec('E:\\ZGmini\\data\\a.mjs')+exec('E:\\ZGmini\\data\\b.mjs'))).code,'TASK_EXEC_ACTION_COUNT_NOT_ONE');
 assert.equal(probe(doc('false',exec('E:\\ZGmini\\data\\x.mjs'))).taskEnabled,false);
 assert.equal(probe(doc('true','')).status,'STATE_UNKNOWN');
 assert.equal(inspectTask({platform:'win32',query:()=>({status:1,stderr:Buffer.from('SECRET')})}).code,
  'TASK_QUERY_UNAVAILABLE');
});

test('Task XML without explicit Settings Enabled still fingerprints one action without claiming Task enabled',()=>{
 const xml='<Task><Settings></Settings><Actions><Exec>'+
  '<Command>E:\\ZGmini\\runtime\\node.exe</Command>'+
  '<Arguments>E:\\ZGmini\\data\\pc-writer\\collector.mjs</Arguments>'+
  '</Exec></Actions></Task>';
 const result=inspectTask({platform:'win32',query:()=>({status:0,stdout:Buffer.from(xml)}),
  hashEntry:()=> 'f'.repeat(64)});
 assert.equal(result.status,'STATE_UNKNOWN');
 assert.equal(result.code,'TASK_ENABLED_FIELD_ABSENT_SOURCE_FINGERPRINTED');
 assert.equal(result.enabledFieldPresent,false);
 assert.equal(result.execActionCount,1);
 assert.equal(result.taskEnabled,null);
 assert.equal(result.entryFileLeaf,'collector.mjs');
 assert.equal(result.entryFileSha256,'f'.repeat(64));
 assert.equal(result.operationalWrites,0);
 assert.equal(result.providerCalls,0);
});
test('missing and multiple Task Exec actions are distinct hard-UNKNOWN without source access',()=>{
 const inspect=xml=>inspectTask({platform:'win32',
  query:()=>({status:0,stdout:Buffer.from(xml)}),
  hashEntry:()=>{throw Error('HASH_ENTRY_MUST_NOT_RUN');}});
 const empty=inspect('<Task><Settings><Enabled>true</Enabled></Settings><Actions></Actions></Task>');
 assert.equal(empty.status,'STATE_UNKNOWN');
 assert.equal(empty.code,'TASK_EXEC_ACTION_COUNT_NOT_ONE');
 assert.equal(empty.execActionCount,0);
 const two=inspect('<Task><Settings></Settings><Actions><Exec></Exec><Exec></Exec></Actions></Task>');
 assert.equal(two.status,'STATE_UNKNOWN');
 assert.equal(two.execActionCount,2);
 assert.equal(two.taskEnabled,null);
});

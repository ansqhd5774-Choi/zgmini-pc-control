import test from 'node:test';
import {safeRuntimeSignals} from '../tools/automation-status.mjs';
import assert from 'node:assert/strict';
import {authenticateProcess,collect,sanitizeProbe,sanitizeMaintenanceStatus,classify996LeaseCorrelation,inspect996LeaseCorrelation,classify1501LeaseCorrelation,inspect1501LeaseCorrelation,classify1501RecoveryCheckpoint,projectObservedProviderHosts,classify1501BacklogBytes,inspect1501BacklogReadonly,sanitizeRuntimeSignals,sanitizeDedicatedRunnerEvidence,toText,SCHEMA,TITLE,ROLE_OPERATION}
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

import test from 'node:test';
import assert from 'node:assert/strict';
import {PROBE,projectW06TaskCadence,inspectW06TaskCadenceReadonly,assessW06TaskBXmlReadonly,inspectW06TaskBRecoveryReadonly,classifyW06TaskRunLevel,verifyW06RecoveryMarker,projectW06HttpChecksReadonly,inspectW06HttpChecksReadonly} from
 '../controller/w06-cnn-task-cadence-readonly.mjs';
import {classifyW06NextTickGate,inspectW06NextTickGateReadonly,
 projectW06Event322Readonly,inspectW06TaskEventsReadonly}
 from '../controller/w06-cnn-minute-tick-evidence-readonly.mjs';

const sample=(extra={})=>({schema:'ZGMINI_W06_CNN_TASK_CADENCE_RAW_V1',
 observedAtUtc:'2026-11-26T11:49:19.000Z',tasks:[{
 name:'ZGMINI-PC-Local-Core',state:'Running',enabled:true,triggerCount:1,
 intervalsSeconds:[300],unverifiedIntervals:0,actionKind:'SCRIPT_HOST',
 cnnMinuteLiteral:false,infoAvailable:true,
 lastRunUtc:'2026-11-26T11:45:00.000Z',
 nextRunUtc:'2026-11-26T11:50:00.000Z',lastTaskResult:0,
 secretArguments:'C:\\Users\\PRIVATE\\some-secret'
 },{name:'ZGMINI-PC-CNN-Minutecycle',state:'Ready',enabled:true,triggerCount:1,
 intervalsSeconds:[60],unverifiedIntervals:0,actionKind:'NODE',
 cnnMinuteLiteral:true,infoAvailable:true,
 lastRunUtc:'2026-11-26T11:49:00.000Z',
 nextRunUtc:'2026-11-26T11:50:00.000Z',lastTaskResult:0,rawXml:'SECRET_XML'
 }],...extra});

test('W06 cadence projects bounded Task details but never raw actions, paths, or secrets',()=>{
 const r=projectW06TaskCadence(sample());
 assert.equal(PROBE,'w06-cnn-task-cadence-readonly');
 assert.equal(r.status,'PASS');
 assert.deepEqual(r.cnnMinuteTaskNames,['ZGMINI-PC-CNN-Minutecycle']);
 assert.deepEqual(r.tasks[0].repetitionIntervalsSeconds,[300]);
 assert.equal(r.tasks[1].lastTaskResult,0);
 assert.match(r.evidence,/NOT_NATURAL_60S_EXECUTION_PROOF/);
 assert.doesNotMatch(JSON.stringify(r),/PRIVATE|SECRET|Arguments|rawXml|token/i);
 assert.equal(r.operationalWrites,0);
 assert.equal(r.providerCalls,0);
 assert.equal(r.d1Writes,0);
});
test('W06 cadence preserves missing evidence as partial and rejects arbitrary/duplicate tasks',()=>{
 const unknown=sample();
 unknown.tasks[1].infoAvailable=false;
 unknown.tasks[1].lastRunUtc=null;
 unknown.tasks[1].unverifiedIntervals=1;
 const p=projectW06TaskCadence(unknown);
 assert.equal(p.status,'PARTIAL');
 assert.equal(p.unknownTaskCount,1);
 assert.equal(projectW06TaskCadence(sample({tasks:[...sample().tasks,
  {...sample().tasks[0]}]})).status,'STATE_UNKNOWN');
 assert.equal(projectW06TaskCadence(sample({tasks:[{...sample().tasks[0],
  name:'Other-Task'}]})).status,'STATE_UNKNOWN');
 assert.equal(projectW06TaskCadence(sample({tasks:[{...sample().tasks[0],
  intervalsSeconds:[-1]}]})).status,'STATE_UNKNOWN');
 assert.equal(projectW06TaskCadence(sample({tasks:[{...sample().tasks[0],
  lastRunUtc:'not-a-time'}]})).status,'STATE_UNKNOWN');
 assert.equal(projectW06TaskCadence(sample({tasks:Array(49).fill(sample().tasks[0])})).status,'STATE_UNKNOWN');
});
test('W06 probe uses fixed Windows command, no shell, never runs any Task',()=>{
 let args,opts,executable;
 const observed=inspectW06TaskCadenceReadonly({
  platform:'win32',systemRoot:'C:\\Windows',exists:()=>true,
  run:(exe,a,options)=>{
   executable=exe;args=a;opts=options;
   return {status:0,stdout:JSON.stringify(sample())};
  }});
 assert.equal(observed.status,'PASS');
 assert.match(executable,/powershell\.exe$/);
 assert.equal(args[3],'-EncodedCommand');
 assert.equal(opts.shell,false);
 assert.equal(opts.timeout,25000);
 assert.doesNotMatch(JSON.stringify(args),/PRIVATE|SECRET/);
 const ps=Buffer.from(args[4],'base64').toString('utf16le');
 assert.match(ps,/Get-ScheduledTaskInfo/);
 assert.doesNotMatch(ps,/Start-ScheduledTask|Set-ScheduledTask|Register-ScheduledTask|Invoke-WebRequest|SQLite|wrangler/i);
 assert.equal(inspectW06TaskCadenceReadonly({platform:'linux'}).status,'STATE_UNKNOWN');
 assert.equal(inspectW06TaskCadenceReadonly({
  platform:'win32',systemRoot:'C:\\Windows',exists:()=>true,
  run:()=>({status:1,stdout:'PRIVATE_ERROR'})}).status,'STATE_UNKNOWN');
});

test('W06 retained disabled Task diagnostic checks exact XML semantics without sharing raw identifiers',()=>{
 const task='<Task><Triggers><TimeTrigger><Repetition><Interval>PT1M</Interval></Repetition></TimeTrigger></Triggers>'+
  '<Settings><MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy><ExecutionTimeLimit>PT30M</ExecutionTimeLimit><Enabled>false</Enabled></Settings>'+
  '<Principals><Principal><UserId>SAFE_USER</UserId><LogonType>InteractiveToken</LogonType><RunLevel>LeastPrivilege</RunLevel></Principal></Principals>'+
  '<Actions><Exec><Command>C:\\Windows\\System32\\wscript.exe</Command>'+
  '<Arguments>"E:\\ZGmini\\data\\pc-writer\\run-local-cnn-minute.vbs"</Arguments>'+
  '<WorkingDirectory>E:\\ZGmini\\projects\\zgmini-earnings-history-pc-release</WorkingDirectory>'+
  '</Exec></Actions></Task>';
 const core='<Task><Principals><Principal><UserId>SAFE_USER</UserId></Principal></Principals></Task>';
 const exact=assessW06TaskBXmlReadonly(task,core,{systemRoot:'C:\\Windows'});
 for(const key of ['oneTimeTrigger','oneExecAction','commandExact','argumentsExact',
  'workingDirExact','principalMatchesCore','logonInteractiveToken',
  'runLevelLeastPrivilege','ignoreNew','limitPT30M'])assert.equal(exact[key],true,key);
 assert.equal(exact.explicitSettingsEnabled,'false');
 assert.doesNotMatch(JSON.stringify(exact),/SAFE_USER|wscript\\.exe|run-local-cnn-minute\\.vbs|C:/);
 const altered=assessW06TaskBXmlReadonly(task.replace('PT30M','PT5M'),core);
 assert.equal(altered.limitPT30M,false);
 assert.equal(inspectW06TaskBRecoveryReadonly({
  filesystem:{existsSync:()=>false}}).status,'STATE_UNKNOWN');
});


test('W06 RunLevel diagnostic distinguishes omitted XML default from effective native privilege',()=>{
 const xmlOmitted='<Task><Principals><Principal><UserId>PRIVATE</UserId></Principal></Principals></Task>';
 const limited=classifyW06TaskRunLevel(xmlOmitted,'Limited');
 assert.deepEqual(limited,{xmlLevel:'OMITTED',effectiveLevel:'LIMITED',nativeLeastPrivilege:true});
 assert.equal(classifyW06TaskRunLevel(xmlOmitted,'0').nativeLeastPrivilege,true);
 const elevated=classifyW06TaskRunLevel(xmlOmitted,'Highest');
 assert.deepEqual(elevated,{xmlLevel:'OMITTED',effectiveLevel:'HIGHEST',nativeLeastPrivilege:false});
 assert.equal(classifyW06TaskRunLevel(xmlOmitted,'1').nativeLeastPrivilege,false);
 const unknown=classifyW06TaskRunLevel(xmlOmitted,null);
 assert.equal(unknown.nativeLeastPrivilege,null);
 assert.equal(unknown.effectiveLevel,'UNVERIFIED');
 const explicitleast=classifyW06TaskRunLevel('<Task><RunLevel>LeastPrivilege</RunLevel></Task>','Limited');
 assert.equal(explicitleast.xmlLevel,'LEAST_PRIVILEGE');
 const explicitHigh=classifyW06TaskRunLevel('<Task><RunLevel>HighestAvailable</RunLevel></Task>','Highest');
 assert.equal(explicitHigh.xmlLevel,'HIGHEST_AVAILABLE');
 const inconsistent=classifyW06TaskRunLevel('<Task><RunLevel>LeastPrivilege</RunLevel></Task>','Highest');
 assert.equal(inconsistent.nativeLeastPrivilege,false);
 assert.doesNotMatch(JSON.stringify(inconsistent),/PRIVATE|SECRET|C:\\\\Users/);
});

test('W06 recovery read-only classifies exact one-shot claim and completion without exposing marker bytes',()=>{
 const id='5b012ae0-5a2b-4fb9-92a6-72754de915c3';
 const origin='ce21eaa3-7768-4cb8-88d9-0911941d966c';
 const claim=Buffer.from(JSON.stringify({schema:'ZGMINI_TASK_RECOVERY_CLAIM_V1',
  requestId:id,originRequestId:origin,status:'CLAIMED'}));
 const complete=Buffer.from(JSON.stringify({schema:'ZGMINI_TASK_RECOVERY_COMPLETE_V1',
  requestId:id,originRequestId:origin,status:'VERIFIED'}));
 assert.equal(verifyW06RecoveryMarker(claim),true);
 assert.equal(verifyW06RecoveryMarker(complete,{complete:true}),true);
 assert.equal(verifyW06RecoveryMarker(claim,{complete:true}),false);
 assert.equal(verifyW06RecoveryMarker(complete),false);
 assert.equal(verifyW06RecoveryMarker(Buffer.from('PRIVATE_BAD_JSON')),false);
 assert.equal(verifyW06RecoveryMarker(Buffer.from(JSON.stringify({...JSON.parse(claim),requestId:'FOREIGN'}))),false);
 assert.equal(verifyW06RecoveryMarker(Buffer.from(JSON.stringify({...JSON.parse(complete),additional:'SHOULD_NOT_BE_EXPORTED'})),{complete:true}),false);
 assert.equal(verifyW06RecoveryMarker(null),false);
});

test('W06 HTTP PC read-only separates 60s attempted GET from D1 publication',()=>{
 const now=Date.parse('2026-11-26T15:20:00.000Z');
 const rows=[{snapshot_key:'2026-11-26',body:JSON.stringify({
  version:'CNN_HTTP_CHECKS_R1',date:'2026-11-26',
  checks:[
   {requestedAt:Date.parse('2026-11-26T11:45:35.000Z'),
    checkedAt:Date.parse('2026-11-26T11:45:35.868Z'),
    httpStatus:200,outcome:'VERIFIED',sourceObservedAt:'2026-11-26T01:59:59.000Z',score:15},
   {requestedAt:Date.parse('2026-11-26T15:11:10.000Z'),
    checkedAt:Date.parse('2026-11-26T15:11:10.200Z'),
    httpStatus:429,outcome:'HTTP_FAILED',sourceObservedAt:null,score:null},
   {requestedAt:Date.parse('2026-11-26T15:19:10.000Z'),
    checkedAt:Date.parse('2026-11-26T15:19:11.000Z'),
    httpStatus:null,outcome:'FETCH_FAILED',sourceObservedAt:null,score:null}
  ]})}];
 const x=projectW06HttpChecksReadonly(rows,{observedAtMs:now});
 assert.equal(x.status,'READ');
 assert.equal(x.twoDayCount,3);
 assert.equal(x.afterActivationCount,2);
 assert.equal(x.recentTenMinutesCount,2);
 assert.equal(x.verifiedCount,1);
 assert.equal(x.verifiedAfterActivation,0);
 assert.equal(x.http2xxCount,1);
 assert.equal(x.http429Count,1);
 assert.equal(x.fetchFailedCount,1);
 assert.equal(x.latestOutcome,'FETCH_FAILED');
 assert.equal(x.requestGapSampleCount,1);
 assert.equal(x.minRequestGapSeconds,480);
 assert.equal(x.medianRequestGapSeconds,480);
 assert.equal(x.maxRequestGapSeconds,480);
 assert.equal(x.gapsOver90Seconds,1);
 assert.deepEqual(x.recentRequestIntervalsSeconds,[480]);
 assert.equal(x.afterActivationFirstRequestAt,'2026-11-26T15:11:10.000Z');
 assert.equal(x.afterActivationLastRequestAt,'2026-11-26T15:19:10.000Z');
 assert.doesNotMatch(JSON.stringify(x),/sourceObservedAt|score|PRIVATE|SECRET/);
 const unsafe=projectW06HttpChecksReadonly([
  {snapshot_key:'2026-11-26',body:JSON.stringify({
   version:'CNN_HTTP_CHECKS_R1',date:'2026-11-26',
   checks:[{checkedAt:'SECRET',requestedAt:now,httpStatus:200,outcome:'VERIFIED'}]})}
 ],{observedAtMs:now});
 assert.equal(unsafe.status,'UNVERIFIED');
});
test('W06 gap attribution distinguishes failed fetch, slow HTTP and unexplained verified predecessor without asserting causality',()=>{
 const time=value=>Date.parse('2026-11-26T'+(value.length===5?value+':00':value)+'.000Z');
 const sample=(at,checked,outcome)=>({requestedAt:time(at),checkedAt:time(checked),
  httpStatus:outcome==='FETCH_FAILED'?null:200,outcome,
  sourceObservedAt:outcome==='VERIFIED'?'2026-11-26T01:59:59.000Z':null,
  score:outcome==='VERIFIED'?15:null});
 const data=[
  sample('17:03','17:03','VERIFIED'),
  sample('17:04','17:04','FETCH_FAILED'),
  sample('17:10','17:10','VERIFIED'),
  sample('17:11','17:11','VERIFIED'),
  sample('17:13','17:14:45','VERIFIED'),
  sample('17:20','17:20','VERIFIED')
 ];
 const rows=[{snapshot_key:'2026-11-26',body:JSON.stringify({
  version:'CNN_HTTP_CHECKS_R1',date:'2026-11-26',checks:data
 })}];
 const r=projectW06HttpChecksReadonly(rows,{observedAtMs:time('17:30')});
 assert.equal(r.status,'READ');
 assert.deepEqual(r.sinceInstallLongGapPreviousOutcomeCounts,
  {VERIFIED:2,FETCH_FAILED:1,HTTP_FAILED:0,INVALID_OUTPUT:0});
 assert.equal(r.sinceInstallLongGapSlowPreviousCount,1);
 assert.deepEqual(r.sinceInstallRecentLongGapContexts,[
  {intervalSeconds:360,previousOutcome:'FETCH_FAILED',previousHttpDurationSeconds:0,nextOutcome:'VERIFIED'},
  {intervalSeconds:120,previousOutcome:'VERIFIED',previousHttpDurationSeconds:0,nextOutcome:'VERIFIED'},
  {intervalSeconds:420,previousOutcome:'VERIFIED',previousHttpDurationSeconds:105,nextOutcome:'VERIFIED'}
 ]);
 const output=JSON.stringify(r);
 assert.doesNotMatch(output,/sourceObservedAt|score|SECRET|PRIVATE|inputUrl|requestId/);
 assert.equal(r.providerCalls,0);
 assert.equal(r.sqliteWrites,0);
 assert.equal(r.d1Writes,0);
 const unknown=projectW06HttpChecksReadonly([], {observedAtMs:time('17:30')});
 assert.equal(unknown.status,'READ');
 assert.deepEqual(unknown.sinceInstallLongGapPreviousOutcomeCounts,
  {VERIFIED:0,FETCH_FAILED:0,HTTP_FAILED:0,INVALID_OUTPUT:0});
});

test('W06 HTTP evidence uses bounded native SQLite read-only query without mutation',()=>{
 let readOnly=false,sql='',params=[],closed=false;
 const now=Date.parse('2026-11-26T15:20:00.000Z');
 const v=inspectW06HttpChecksReadonly({
  filesystem:{lstatSync:p=>{assert.match(p,/core\.sqlite$/);return {
   isFile:()=>true,isSymbolicLink:()=>false,size:16*1024*1024}}},
  connect:(p,opts)=>{readOnly=true;return {
   exec:q=>{assert.equal(q,'PRAGMA query_only=ON')},
   prepare:q=>{sql=q;return {all:(...args)=>{params=args;return []}}},
   close:()=>{closed=true}}},clock:()=>now
 });
 assert.equal(readOnly,true);
 assert.equal(v.status,'READ');
 assert.equal(v.twoDayCount,0);
 assert.equal(closed,true);
 assert.match(sql,/kind='input'/);
 assert.match(sql,/fear-greed-http-checks/);
 assert.doesNotMatch(sql,/INSERT|UPDATE|DELETE|DROP|ALTER/i);
 assert.deepEqual(params,['2026-11-25','2026-11-26']);
 assert.equal(inspectW06HttpChecksReadonly({
  filesystem:{lstatSync:()=>{throw Error('NO_DB')}}}).status,'UNVERIFIED');
});

test('W06 HTTP request gap median measures actual fetch starts, not stale source timestamps',()=>{
 const times=['15:05:00','15:06:00','15:08:00','15:12:00'];
 const checks=times.map(t=>{
  const ms=Date.parse('2026-11-26T'+t+'.000Z');
  return {requestedAt:ms,checkedAt:ms+500,httpStatus:200,
   outcome:'VERIFIED',sourceObservedAt:'2026-11-26T01:59:59.000Z',score:15};
 });
 const rows=[{snapshot_key:'2026-11-26',body:JSON.stringify({
  version:'CNN_HTTP_CHECKS_R1',date:'2026-11-26',checks})}];
 const out=projectW06HttpChecksReadonly(rows,{
  observedAtMs:Date.parse('2026-11-26T15:15:00.000Z')});
 assert.equal(out.status,'READ');
 assert.equal(out.afterActivationCount,4);
 assert.equal(out.requestGapSampleCount,3);
 assert.equal(out.minRequestGapSeconds,60);
 assert.equal(out.medianRequestGapSeconds,120);
 assert.equal(out.maxRequestGapSeconds,240);
 assert.equal(out.gapsOver90Seconds,2);
 assert.deepEqual(out.recentRequestIntervalsSeconds,[60,120,240]);
 assert.doesNotMatch(JSON.stringify(out),/sourceObservedAt|score|PRIVATE|SECRET/);
 const single=projectW06HttpChecksReadonly([
  {snapshot_key:'2026-11-26',body:JSON.stringify({version:'CNN_HTTP_CHECKS_R1',
   date:'2026-11-26',checks:[checks[0]]})}
 ],{observedAtMs:Date.parse('2026-11-26T15:15:00.000Z')});
 assert.equal(single.requestGapSampleCount,0);
 assert.equal(single.minRequestGapSeconds,null);
 assert.equal(single.medianRequestGapSeconds,null);
 assert.deepEqual(single.recentRequestIntervalsSeconds,[]);
});


test('W06 post-install HTTP cadence excludes pre-install calls and never invents missing ticks',()=>{
 const times=['17:01:30','17:03:10','17:04:12','17:06:12','17:07:12'];
 const checks=times.map(t=>{
  const requestedAt=Date.parse('2026-11-26T'+t+'.000Z');
  return {requestedAt,checkedAt:requestedAt+400,httpStatus:200,
   outcome:'VERIFIED',sourceObservedAt:'2026-11-26T01:59:59.000Z',score:15};
 });
 const rows=[{snapshot_key:'2026-11-26',body:JSON.stringify({
  version:'CNN_HTTP_CHECKS_R1',date:'2026-11-26',checks})}];
 const read=projectW06HttpChecksReadonly(rows,{
  observedAtMs:Date.parse('2026-11-26T17:10:00.000Z')});
 assert.equal(read.status,'READ');
 assert.equal(read.twoDayCount,5);
 assert.equal(read.sinceInstallReadbackCount,4);
 assert.equal(read.sinceInstallReadbackVerifiedCount,4);
 assert.equal(read.installedReadbackAt,'2026-11-26T17:02:17.109Z');
 assert.equal(read.sinceInstallReadbackGapSampleCount,3);
 assert.equal(read.sinceInstallReadbackMedianGapSeconds,62);
 assert.equal(read.sinceInstallReadbackMaxGapSeconds,120);
 assert.equal(read.sinceInstallReadbackGapsOver90Seconds,1);
 assert.deepEqual(read.sinceInstallReadbackRecentIntervalsSeconds,[62,120,60]);
 assert.equal(read.sinceInstallReadbackFirstRequestAt,'2026-11-26T17:03:10.000Z');
 assert.equal(read.sinceInstallReadbackLastRequestAt,'2026-11-26T17:07:12.000Z');
 assert.equal(read.requestGapSampleCount,4,'old activation-wide metric unchanged');
 assert.doesNotMatch(JSON.stringify(read),/sourceObservedAt|score|PRIVATE|SECRET/);
 const noPost=projectW06HttpChecksReadonly([{snapshot_key:'2026-11-26',
  body:JSON.stringify({version:'CNN_HTTP_CHECKS_R1',date:'2026-11-26',
   checks:[checks[0]]})}],{observedAtMs:Date.parse('2026-11-26T17:10:00.000Z')});
 assert.equal(noPost.sinceInstallReadbackCount,0);
 assert.equal(noPost.sinceInstallReadbackGapSampleCount,0);
 assert.equal(noPost.sinceInstallReadbackMedianGapSeconds,null);
 assert.deepEqual(noPost.sinceInstallReadbackRecentIntervalsSeconds,[]);
});

test('W06 fixed output 7 seconds after Task minute makes next nominal tick CACHED',()=>{
 const tick='2026-11-26T15:47:00.000Z';
 const rows=[
  {kind:'output',stored_at:Date.parse('2026-11-26T15:46:07.000Z'),attempt_body:null},
  {kind:'attempt',stored_at:Date.parse('2026-11-26T15:46:01.000Z'),attempt_body:'{"status":"ATTEMPTED"}'}];
 const q=classifyW06NextTickGate(rows,{
  nextRunUtc:tick,observedAtMs:Date.parse('2026-11-26T15:46:15.000Z')});
 assert.equal(q.status,'READ');
 assert.equal(q.predictedGate,'CACHED');
 assert.equal(q.millisecondsUntilEligible,7000);
 assert.equal(q.lastOutputStoredAt,'2026-11-26T15:46:07.000Z');
 assert.doesNotMatch(JSON.stringify(q),/raw|PRIVATE|TOKEN|SCORE|SECRET/);
 const tooLate=classifyW06NextTickGate(rows,{
  nextRunUtc:tick,observedAtMs:Date.parse('2026-11-26T15:48:00.000Z')});
 assert.equal(tooLate.status,'UNVERIFIED');
 assert.equal(tooLate.code,'CNN_NEXT_TICK_TIME_UNVERIFIED');
});

test('W06 next tick retry and previous attempt gates remain distinct',()=>{
 const at=Date.parse('2026-11-26T15:46:15Z');
 const nextRunUtc='2026-11-26T15:47:00.000Z';
 const past={kind:'output',stored_at:Date.parse('2026-11-26T15:44:01.000Z'),attempt_body:null};
 const retry={kind:'attempt',stored_at:Date.parse('2026-11-26T15:44:31Z'),
  attempt_body:JSON.stringify({status:'ATTEMPTED',retryAt:Date.parse('2026-11-26T15:49:00Z')})};
 const recent={...retry,stored_at:Date.parse('2026-11-26T15:46:41Z'),
  attempt_body:'{"status":"ATTEMPTED"}'};
 const get=rows=>classifyW06NextTickGate(rows,{nextRunUtc,observedAtMs:at});
 assert.equal(get([past,retry]).predictedGate,'COOLDOWN_RETRY_AFTER');
 assert.equal(get([past,retry]).millisecondsUntilEligible,120000);
 // A later stored-at timestamp than the snapshot is invalid and never attested.
 assert.equal(get([past,recent]).status,'UNVERIFIED');
 const later=classifyW06NextTickGate([past,recent],{nextRunUtc,
  observedAtMs:Date.parse('2026-11-26T15:46:45Z')});
 assert.equal(later.predictedGate,'COOLDOWN_LAST_ATTEMPT');
 assert.equal(later.millisecondsUntilEligible,41000);
 assert.equal(get([past]).predictedGate,'ELIGIBLE');
 assert.equal(get([past,{...retry,kind:'output'}]).status,'UNVERIFIED');
});

test('W06 minute gate uses a bounded native SQLite query-only read transaction',()=>{
 const now=Date.parse('2026-11-26T15:46:15Z');
 let closed=false,sql=null,steps=[];
 const result=inspectW06NextTickGateReadonly('2026-11-26T15:47:00.000Z',{
  filesystem:{lstatSync:p=>{assert.match(p,/core\.sqlite$/);return {
   isFile:()=>true,isSymbolicLink:()=>false,size:4096}}},
  connect:(p,options)=>{assert.equal(options.readOnly,true);return {
   exec:command=>steps.push(command),
   prepare:query=>{sql=query;return {all:()=>[
    {kind:'output',stored_at:now-8000,attempt_body:null},
    {kind:'attempt',stored_at:now-14000,attempt_body:'{"status":"ATTEMPTED"}'}
   ]}},
   close:()=>{closed=true}
  }},
  clock:()=>now
 });
 assert.equal(result.sqliteOpened,true);
 assert.equal(result.status,'READ');
 assert.equal(result.predictedGate,'CACHED');
 assert.deepEqual(steps,['PRAGMA query_only=ON']);
 assert.match(sql,/feed_key='fear-greed'/);
 assert.match(sql,/kind IN \('output','attempt'\)/);
 assert.match(sql,/LIMIT 2/);
 assert.doesNotMatch(sql,/INSERT|UPDATE|DELETE|DROP|ALTER/i);
 assert.equal(closed,true);
 assert.equal(inspectW06NextTickGateReadonly('2026-11-26T15:47:00Z',{
  filesystem:{lstatSync:()=>{throw Error('NOT_PRESENT')}}}).status,'UNVERIFIED');
});

test('W06 TaskScheduler channel-disabled state never claims zero ignored launches',()=>{
 const runs=[];
 const call=(exe,args,options)=>{runs.push(args);
  assert.equal(options.shell,false);
  return {status:0,stdout:Buffer.from('enabled: false\n', 'utf8')}};
 const out=inspectW06TaskEventsReadonly({platform:'win32',
  systemRoot:'C:\\Windows',filesystem:{existsSync:()=>true},run:call});
 assert.equal(out.status,'READ');
 assert.equal(out.code,'CNN_TASK_EVENT_CHANNEL_DISABLED');
 assert.equal(out.channelEnabled,false);
 assert.equal(out.recent90mIgnoredLaunches,null);
 assert.equal(runs.length,1);
 assert.equal(runs[0][0],'gl');
 assert.equal(inspectW06TaskEventsReadonly({platform:'linux'}).status,'UNVERIFIED');
});

test('W06 TaskScheduler Event322 count is restricted to one exact Task and 90 minutes',()=>{
 const now=Date.parse('2026-11-26T15:46:45Z');
 const xml=(task,time)=>'<Event><System><EventID>322</EventID>'+
  '<TimeCreated SystemTime="'+time+'"/></System><EventData>'+
  '<Data Name="TaskName">'+task+'</Data></EventData></Event>';
 const source=xml('\\ZGMINI-PC-CNN-Minute','2026-11-26T15:43:00.000Z')+
  xml('\\ZGMINI-PC-CNN-Minute','2026-11-26T13:43:00.000Z')+
  xml('\\ZGMINI-PC-Local-Core','2026-11-26T15:44:00.000Z');
 const projected=projectW06Event322Readonly(source,{nowMs:now});
 assert.equal(projected.status,'READ');
 assert.equal(projected.recent90mIgnoredLaunches,1);
 assert.equal(projected.latestIgnoredAt,'2026-11-26T15:43:00.000Z');
 assert.equal(projected.eventsExamined,3);
 assert.doesNotMatch(JSON.stringify(projected),/ZGMINI-PC-|PRIVATE|Account|Command/);
 let calls=0;
 const seen=inspectW06TaskEventsReadonly({platform:'win32',
  systemRoot:'C:\\Windows',filesystem:{existsSync:()=>true},clock:()=>now,
  run:(exe,args,opts)=>{calls++;return {status:0,
   stdout:Buffer.from(calls===1?'enabled: true\n':source,'utf8')}}});
 assert.equal(calls,2);
 assert.equal(seen.recent90mIgnoredLaunches,1);
 assert.equal(seen.channelEnabled,true);
});

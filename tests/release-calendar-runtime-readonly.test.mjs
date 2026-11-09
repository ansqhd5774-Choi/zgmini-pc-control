import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {inspectReleaseCalendarRuntime} from '../controller/release-calendar-runtime-readonly.mjs';

const SHA='a'.repeat(40);
function fixture(t,{dirs=70}={}){
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'release-calendar-a-'));
 t.after(()=>fs.rmSync(tmp,{force:true,recursive:true}));
 const root=path.join(tmp,'ZGmini'),data=path.join(root,'data'),pc=path.join(data,'pc-writer');
 fs.mkdirSync(pc,{recursive:true});
 fs.writeFileSync(path.join(pc,'config.json'),JSON.stringify({source:SHA,privateKey:'MUST_NOT_LEAK'}));
 fs.writeFileSync(path.join(pc,'local-collection-last-run.json'),JSON.stringify({at:'2026-11-05T08:00:00.000Z',source:SHA,
  releaseCalendar:{status:'PARTIAL',providerRequests:6,sources:{bls:'READY',bea:'READY',nyfed:'SOURCE_FAILED'}},secrets:'MUST_NOT_LEAK'}));
 const projects=path.join(root,'projects');fs.mkdirSync(projects,{recursive:true});
 for(let i=0;i<dirs;i++)fs.mkdirSync(path.join(projects,`other-${String(i).padStart(3,'0')}`));
 const checkout=path.join(projects,'zgmini-approved');
 fs.mkdirSync(path.join(checkout,'scripts','pc-writer'),{recursive:true});
 fs.mkdirSync(path.join(checkout,'lib'),{recursive:true});
 fs.mkdirSync(path.join(checkout,'.git'));
 fs.writeFileSync(path.join(checkout,'scripts','pc-writer','collect-local.mjs'),
  "import {collectReleaseCalendar} from './release-calendar.mjs'; collectReleaseCalendar();");
 fs.writeFileSync(path.join(checkout,'scripts','pc-writer','release-calendar.mjs'),
  "export async function collectReleaseCalendar() { return 'fixture'; }");
 fs.writeFileSync(path.join(checkout,'lib','release-calendar.mjs'),
  "export const RELEASE_SOURCES=Object.freeze({\n bls:{url:'a'},\n bea:{url:'b'},\n eia_epm:{url:'c'},\n nyfed:{url:'d'}\n});");
 return {root,data,pc,projects,checkout};
}

test('over 64 project siblings still finds exact calendar source without raw data',t=>{
 const f=fixture(t),out=inspectReleaseCalendarRuntime(f.data,{gitHead:()=>SHA,
  coreTaskXml:'<Task><Command>run-local.cmd</Command></Task>'});
 assert.equal(out.status,'PASS');
 assert.equal(out.code,'RELEASE_CALENDAR_SOURCE_INVENTORY_READONLY');
 assert.equal(out.configuredSourceSha,SHA);
 assert.equal(out.candidateCount,1);
 assert.equal(out.inventoryTruncated,false);
 assert.equal(out.candidates[0].matchesConfiguredSource,true);
 assert.deepEqual(out.candidates[0].sourceKeys,['bls','bea','eia_epm','nyfed']);
 assert.equal(out.candidates[0].sourceParseStatus,'PARSED');
 assert.equal(out.candidates[0].collectorImportsCalendar,true);
 assert.match(out.candidates[0].runnerSha256,/^[0-9a-f]{64}$/);
 assert.equal(out.coreTask.mentionsRunLocal,true);
 assert.deepEqual(out.collection.sourceKeys,['bea','bls','nyfed']);
 assert.equal(out.collection.calendarStatus,'PARTIAL');
 assert.equal(out.runtimeSourceVerified,false);
 assert.equal(out.providerCalls,0);assert.equal(out.sqliteOpened,false);
 assert.equal(out.d1Writes,0);assert.equal(out.operationalWrites,0);
 assert.doesNotMatch(JSON.stringify(out),/MUST_NOT_LEAK/);
});

test('wrong root and missing checkpoint cannot falsely claim running code',t=>{
 const f=fixture(t,{dirs:0});
 assert.equal(inspectReleaseCalendarRuntime(f.projects).status,'BLOCKED');
 fs.unlinkSync(path.join(f.pc,'local-collection-last-run.json'));
 const out=inspectReleaseCalendarRuntime(f.data,{gitHead:()=>null});
 assert.equal(out.status,'PASS');
 assert.equal(out.collection,null);
 assert.equal(out.candidates[0].matchesConfiguredSource,false);
 assert.equal(out.runtimeSourceVerified,false);
});

test('candidate symlink escape and oversized files are never scanned',t=>{
 const f=fixture(t,{dirs:0});
 const outside=path.join(path.dirname(f.root),'outside');
 fs.mkdirSync(path.join(outside,'scripts','pc-writer'),{recursive:true});
 fs.mkdirSync(path.join(outside,'lib'),{recursive:true});
 fs.writeFileSync(path.join(outside,'scripts','pc-writer','collect-local.mjs'),'collectReleaseCalendar()');
 fs.writeFileSync(path.join(outside,'lib','release-calendar.mjs'),'export const RELEASE_SOURCES=Object.freeze({x:{}});');
 fs.symlinkSync(outside,path.join(f.projects,'outside-link'),'dir');
 let out=inspectReleaseCalendarRuntime(f.data,{gitHead:()=>SHA});
 assert.equal(out.candidateCount,1);
 fs.writeFileSync(path.join(f.checkout,'lib','release-calendar.mjs'),'Z'.repeat(1048577));
 out=inspectReleaseCalendarRuntime(f.data,{gitHead:()=>SHA});
 assert.equal(out.candidateCount,0);
 assert.equal(out.runtimeSourceVerified,false);
});

test('missing executable collector, invalid git marker and unknown keys do not certify source',t=>{
 const f=fixture(t,{dirs:0});
 const file=path.join(f.checkout,'scripts','pc-writer','release-calendar.mjs');
 fs.unlinkSync(file);
 let out=inspectReleaseCalendarRuntime(f.data,{gitHead:()=>SHA});
 assert.equal(out.candidateCount,0);
 fs.writeFileSync(file,'export const collectReleaseCalendar=()=>null');
 fs.rmSync(path.join(f.checkout,'.git'),{recursive:true});
 let calls=0;
 out=inspectReleaseCalendarRuntime(f.data,{gitHead:()=>{calls++;return SHA}});
 assert.equal(calls,0);
 assert.equal(out.candidates[0].head,null);
 fs.writeFileSync(path.join(f.checkout,'lib','release-calendar.mjs'),'export const differentSource = true;');
 out=inspectReleaseCalendarRuntime(f.data);
 assert.equal(out.candidates[0].sourceParseStatus,'UNKNOWN');
 assert.equal(out.candidates[0].sourceCount,null);
});

test('PC-only EarningsAPI collector is reported by metadata, never raw source',t=>{
 const f=fixture(t,{dirs:0});
 const module=path.join(f.checkout,'scripts','pc-writer','earnings-api-local.mjs');
 fs.writeFileSync(module,'// MUST_NOT_LEAK_SECRET: fake test fixture, not an API key\nexport const noop=()=>{};\n');
 const out=inspectReleaseCalendarRuntime(f.data,{gitHead:()=>SHA});
 assert.equal(out.status,'PASS');
 assert.equal(out.candidates[0].earningsApiCollector.verifiedReadable,true);
 assert.match(out.candidates[0].earningsApiCollector.sha256,/^[0-9a-f]{64}$/);
 assert.ok(out.candidates[0].earningsApiCollector.bytes>0);
 assert.match(out.candidates[0].earningsApiCollector.modifiedAt,/^20\d\d-/);
 assert.equal(out.candidates[0].earningsApiCollector.evidenceLevel,'FILE_INVENTORY_ONLY_NOT_DAILY_GET_PROOF');
 assert.doesNotMatch(JSON.stringify(out),/MUST_NOT_LEAK_SECRET/);
 assert.equal(out.providerCalls,0);
});

test('missing EarningsAPI collector is not treated as verified readable',t=>{
 const f=fixture(t,{dirs:0});
 const out=inspectReleaseCalendarRuntime(f.data,{gitHead:()=>SHA});
 assert.equal(out.status,'PASS');
 assert.deepEqual(out.candidates[0].earningsApiCollector,{verifiedReadable:false});
 assert.equal(out.earningsApiCollectorEvidenceLevel,'FILE_INVENTORY_ONLY_NOT_DAILY_GET_PROOF');
});

test('EarningsAPI collector symlink outside approved root is excluded',t=>{
 const f=fixture(t,{dirs:0});
 const outside=path.join(path.dirname(f.root),'outside-earnings-api-local.mjs');
 fs.writeFileSync(outside,'// MUST_NOT_LEAK_EXTERNAL\n');
 fs.symlinkSync(outside,path.join(f.checkout,'scripts','pc-writer','earnings-api-local.mjs'));
 const out=inspectReleaseCalendarRuntime(f.data,{gitHead:()=>SHA});
 assert.equal(out.status,'PASS');
 assert.equal(out.candidates[0].earningsApiCollector.verifiedReadable,false);
 assert.equal(out.candidates[0].earningsApiCollector.sha256,undefined);
 assert.doesNotMatch(JSON.stringify(out),/MUST_NOT_LEAK_EXTERNAL/);
});

function manyCandidates(f,{readable=false}={}){
 if(readable)fs.writeFileSync(path.join(f.checkout,'scripts','pc-writer','earnings-api-local.mjs'),
  'export const safe = true;\n');
 for(let i=0;i<61;i++){
  const dest=path.join(f.projects,`zgmini-release-calendar-candidate-${String(i).padStart(3,'0')}-copy`);
  fs.cpSync(f.checkout,dest,{recursive:true});
 }
}

function uploadBytes(out){
 const body={schema:'ZGMINI_PC_RESULT_V1',jobId:'run-42261956750-1-seat-3',
  requestId:'pc-dd8ebabd-0022-4b2c-9886-308058ed9357',startedAt:'2026-11-06T17:28:37.859Z',
  controlRepository:'ansqhd5774-Choi/zgmini-pc-control',controlSourceSha:SHA,
  sourceRepository:'ansqhd5774-Choi/zgmini',requestedSourceSha:SHA,sourceBranch:'main',
  operation:'release-calendar-runtime-readonly',seat:3,status:'PASS',code:out.code,
  lastPass:'ALLOWLISTED_OPERATION_COMPLETED',firstFail:null,operationalWrites:0,
  providerCalls:0,d1Writes:0,sqliteOpened:false,controlWorkspaceWrites:true,
  chatId:'chat-48a82f49-de79-449a-92b7-c23db8c43e95',pcOperationalApprovedSha:SHA,
  exitCode:0,result:out,protectedStateUnchanged:true,protectedBeforeSha256:'a'.repeat(64),
  protectedAfterSha256:'a'.repeat(64),actualExecutionSha:SHA,
  next:'READ_RESULT_NO_REPEAT',finishedAt:'2026-11-06T17:29:04.556Z',durationMs:26697};
 const json=JSON.stringify(body,null,2)+'\n';
 const txt=Object.entries(body).filter(([key])=>!['result','prior'].includes(key))
  .map(([key,value])=>`${key}=${typeof value==='object'?JSON.stringify(value):value}`)
  .join('\r\n')+'\r\n';
 return Buffer.byteLength(json)+Buffer.byteLength(txt);
}

test('62 candidates keep negative EarningsAPI observations explicit and report under 32 KiB',t=>{
 const f=fixture(t,{dirs:0});
 manyCandidates(f);
 const out=inspectReleaseCalendarRuntime(f.data,{gitHead:()=>SHA});
 assert.equal(out.status,'PASS');
 assert.equal(out.candidateCount,62);
 assert.equal(out.candidates.length,32);
 assert.equal(out.inventoryTruncated,true);
 assert.ok(out.candidates.every(candidate=>candidate.earningsApiCollector.verifiedReadable===false));
 assert.equal(out.earningsApiRequestObservations.status,'STATE_UNKNOWN');
 assert.ok(uploadBytes(out)<32768,'the fixed host uploader must accept this result');
});

test('readable EarningsAPI metadata remains available when candidate payload must truncate',t=>{
 const f=fixture(t,{dirs:0});
 manyCandidates(f,{readable:true});
 const out=inspectReleaseCalendarRuntime(f.data,{gitHead:()=>SHA});
 assert.equal(out.status,'PASS');
 assert.equal(out.candidateCount,62);
 assert.equal(out.inventoryTruncated,true);
 assert.ok(out.candidates.length>0&&out.candidates.length<=32);
 assert.ok(out.candidates.every(candidate=>candidate.earningsApiCollector.verifiedReadable===true));
 assert.ok(out.candidates.every(candidate=>/^[a-f0-9]{64}$/.test(candidate.earningsApiCollector.sha256)));
 assert.ok(uploadBytes(out)<32768,'readable metadata must also fit uploader');
});

const event=(at,requests,extra={})=>JSON.stringify({at,lane:'core',providers:{
 ...(requests===null?{}:{'api.earningsapi.com':{requests,statuses:{200:requests}}}),
 'api.other.example':{requests:3},...extra},secret:'MUST_NOT_LEAK_LOG'});

test('EarningsAPI request ledger aggregates observed KST days without exposing raw events',t=>{
 const f=fixture(t,{dirs:0});
 fs.writeFileSync(path.join(f.pc,'collection-events.jsonl'),[
  event('2026-11-06T14:30:00.000Z',1), // 2026-11-06 23:30 KST
  event('2026-11-06T14:45:00.000Z',null),
  event('2026-11-06T15:10:00.000Z',1), // 2026-11-07 00:10 KST
  ''
 ].join('\n'));
 const out=inspectReleaseCalendarRuntime(f.data,{gitHead:()=>SHA});
 const obs=out.earningsApiRequestObservations;
 assert.equal(out.status,'PASS');
 assert.equal(obs.status,'OBSERVED');
 assert.equal(obs.coverage,'BOUNDED_LOG');
 assert.equal(obs.observedMaxDailyRequests,1);
 assert.equal(obs.observedOverOneRequestDays,0);
 assert.deepEqual(obs.observedDays,[
  {kstDate:'2026-11-06',observedRequests:1},
  {kstDate:'2026-11-07',observedRequests:1}
 ]);
 assert.equal(obs.eventsExamined,3);
 assert.equal(obs.duplicateHostLogLines,0);
 assert.deepEqual(obs.statusColumns,['ok2xx','client4xx','server5xx','networkError','quotaGuard','other','duplicateLines']);
 assert.deepEqual(obs.observedStatusDays,[
  {kstDate:'2026-11-06',counts:'1,0,0,0,0,0,0'},
  {kstDate:'2026-11-07',counts:'1,0,0,0,0,0,0'}
 ]);
 assert.deepEqual(obs.observedWindow,{
  firstEventAt:'2026-11-06T14:30:00.000Z',lastEventAt:'2026-11-06T15:10:00.000Z'});
 assert.match(obs.evidenceLevel,/NOT_DAILY_LIMIT_OR_SAVED_DATE_PROOF/);
 assert.doesNotMatch(JSON.stringify(out),/MUST_NOT_LEAK_LOG|api\.other\.example/);
 assert.equal(out.providerCalls,0);
});

test('read-only KST response status buckets reveal response outcomes and exact duplicate log lines',t=>{
 const f=fixture(t,{dirs:0});
 const first=event('2026-11-06T04:00:00.000Z',14,{
  'api.earningsapi.com':{requests:14,statuses:{200:11,429:1,503:1,NETWORK_ERROR:1}}});
 const second=event('2026-11-06T05:00:00.000Z',2,{
  'api.earningsapi.com':{requests:2,statuses:{PROVIDER_QUOTA_GUARD:1,418:1}}});
 fs.writeFileSync(path.join(f.pc,'collection-events.jsonl'),[first,first,second,''].join('\n'));
 const obs=inspectReleaseCalendarRuntime(f.data).earningsApiRequestObservations;
 assert.equal(obs.status,'OBSERVED');
 assert.equal(obs.observedMaxDailyRequests,30);
 assert.equal(obs.duplicateHostLogLines,1);
 assert.equal(obs.statusInvalidEvents,0);
 assert.equal(obs.statusCoverage,'BOUNDED_LOG');
 assert.deepEqual(obs.observedStatusDays,[
  {kstDate:'2026-11-06',counts:'22,3,2,2,1,0,1'}
 ]);
 assert.doesNotMatch(JSON.stringify(obs),/MUST_NOT_LEAK_LOG|api\.other\.example|apikey=/);
 assert.equal(inspectReleaseCalendarRuntime(f.data).providerCalls,0);
});

test('missing or malformed wrapper statuses do not change request counts or imply verified GETs',t=>{
 const f=fixture(t,{dirs:0});
 fs.writeFileSync(path.join(f.pc,'collection-events.jsonl'),[
  event('2026-11-06T04:00:00.000Z',2,{
   'api.earningsapi.com':{requests:2,statuses:{200:-1,NETWORK_ERROR:'not-a-count'}}}),
  event('2026-11-06T05:00:00.000Z',3,{
   'api.earningsapi.com':{requests:3}}),''].join('\n'));
 const obs=inspectReleaseCalendarRuntime(f.data).earningsApiRequestObservations;
 assert.equal(obs.status,'STATE_UNKNOWN');
 assert.equal(obs.observedMaxDailyRequests,5);
 assert.equal(obs.statusInvalidEvents,3);
 assert.equal(obs.statusCoverage,'PARTIAL');
 assert.equal(obs.coverage,'PARTIAL');
 assert.match(obs.statusEvidenceLevel,/NOT_PROVIDER_GET_POLICY_PROOF/);
 assert.equal(obs.observedStatusDays[0].counts,'0,0,0,0,0,0,0');
});

test('bounded status day details with 62 candidates remain inside upload limit',t=>{
 const f=fixture(t,{dirs:0});manyCandidates(f,{readable:true});
 const lines=[];
 for(let i=0;i<14;i++){
  const at=new Date(Date.parse('2026-10-25T12:00:00Z')+i*86400000).toISOString();
  lines.push(event(at,14,{'api.earningsapi.com':{requests:14,
   statuses:{200:8,429:1,502:1,NETWORK_ERROR:2,PROVIDER_QUOTA_GUARD:2}}}));
 }
 fs.writeFileSync(path.join(f.pc,'collection-events.jsonl'),lines.join('\n')+'\n');
 const out=inspectReleaseCalendarRuntime(f.data,{gitHead:()=>SHA});
 assert.equal(out.earningsApiRequestObservations.observedStatusDays.length,14);
 assert.equal(out.earningsApiRequestObservations.status,'OBSERVED');
 assert.equal(out.candidateCount,62);
 assert.ok(uploadBytes(out)<32768,`bounded response detail and inventory fit host upload cap (got ${uploadBytes(out)}B)`);
});

test('two observed EarningsAPI requests on one KST day are visibly counted, never certified',t=>{
 const f=fixture(t,{dirs:0});
 fs.writeFileSync(path.join(f.pc,'collection-events.jsonl'),[
  event('2026-11-06T04:00:00.000Z',1),
  event('2026-11-06T05:00:00.000Z',1),''
 ].join('\n'));
 const obs=inspectReleaseCalendarRuntime(f.data).earningsApiRequestObservations;
 assert.equal(obs.status,'OBSERVED');
 assert.deepEqual(obs.observedDays,[{kstDate:'2026-11-06',observedRequests:2}]);
 assert.equal(obs.observedOverOneRequestDays,1);
 assert.equal(obs.observedMaxDailyRequests,2);
 assert.match(obs.evidenceLevel,/ONLY_NOT_DAILY_LIMIT/);
});

test('missing, symlink and malformed collection logs remain STATE_UNKNOWN',t=>{
 const f=fixture(t,{dirs:0}),file=path.join(f.pc,'collection-events.jsonl');
 let obs=inspectReleaseCalendarRuntime(f.data).earningsApiRequestObservations;
 assert.equal(obs.status,'STATE_UNKNOWN');
 assert.equal(obs.code,'COLLECTION_EVENTS_UNAVAILABLE');
 const outside=path.join(path.dirname(f.root),'outside-collection-events.jsonl');
 fs.writeFileSync(outside,event('2026-11-06T04:00:00.000Z',1)+'\n');
 fs.symlinkSync(outside,file);
 obs=inspectReleaseCalendarRuntime(f.data).earningsApiRequestObservations;
 assert.equal(obs.status,'STATE_UNKNOWN');
 assert.equal(obs.observedDayCount,0);
 fs.unlinkSync(file);
 fs.writeFileSync(file,event('2026-11-06T04:00:00.000Z',1)+'\nINVALID\n');
 obs=inspectReleaseCalendarRuntime(f.data).earningsApiRequestObservations;
 assert.equal(obs.status,'STATE_UNKNOWN');
 assert.equal(obs.coverage,'PARTIAL');
 assert.equal(obs.invalidEvents,1);
 assert.equal(obs.observedDays[0].observedRequests,1);
});

test('truncated tail and incomplete final event never imply complete daily coverage',t=>{
 const f=fixture(t,{dirs:0}),file=path.join(f.pc,'collection-events.jsonl');
 const massive=event('2026-11-05T04:00:00.000Z',1)+'\n';
 fs.writeFileSync(file,massive.repeat(4500)+event('2026-11-06T04:00:00.000Z',1)+'\n');
 let obs=inspectReleaseCalendarRuntime(f.data).earningsApiRequestObservations;
 assert.equal(obs.status,'STATE_UNKNOWN');
 assert.equal(obs.coverage,'PARTIAL');
 assert.equal(obs.tailTruncated,true);
 assert.ok(obs.bytesRead<=512*1024);
 fs.writeFileSync(file,event('2026-11-06T04:00:00.000Z',1)+'\n'+
  '{"at":"2026-11-06T05:00:00.000Z","providers":');
 obs=inspectReleaseCalendarRuntime(f.data).earningsApiRequestObservations;
 assert.equal(obs.status,'STATE_UNKNOWN');
 assert.equal(obs.tailTruncated,true);
 assert.deepEqual(obs.observedDays,[{kstDate:'2026-11-06',observedRequests:1}]);
});


test('Treasury failure code is bounded, private, and reported after a CACHED failed attempt',t=>{
 const f=fixture(t,{dirs:0}),file=path.join(f.pc,'local-collection-last-run.json');
 const read=(code,status='PARTIAL',treasury='SOURCE_FAILED')=>{
  fs.writeFileSync(file,JSON.stringify({at:'2026-11-09T09:15:00.000Z',source:SHA,
   releaseCalendar:{status,providerRequests:1,sources:{treasury},treasuryFailureCode:code},
   secrets:'MUST_NOT_LEAK_TREASURY_TOKEN'}));
  return inspectReleaseCalendarRuntime(f.data,{gitHead:()=>SHA});
 };
 for(const code of ['TREASURY_HTTP_429','TREASURY_TIMEOUT','TREASURY_FETCH_FAILED',
  'TREASURY_COLLECTION_FAILED','TREASURY_ENTRY_FIELD_INVALID']){
  const out=read(code);
  assert.equal(out.collection.treasuryFailureCode,code);
  assert.equal(out.providerCalls,0);assert.equal(out.operationalWrites,0);
  assert.doesNotMatch(JSON.stringify(out),/MUST_NOT_LEAK_TREASURY_TOKEN/);
 }
 for(const code of ['https://example.invalid/secret','TREASURY_HTTP_999',
  'TREASURY_HTTP_429\nSECRET','TREASURY_HTTP_429_SECRET','TREASURY_'+'X'.repeat(90)]){
  assert.equal(read(code).collection.treasuryFailureCode,null);
 }
 assert.equal(read('TREASURY_HTTP_429','CACHED').collection.treasuryFailureCode,'TREASURY_HTTP_429');
 assert.equal(read('TREASURY_HTTP_429','CACHED','READY').collection.treasuryFailureCode,null);
 assert.equal(read('TREASURY_HTTP_429','READY','READY').collection.treasuryFailureCode,null);
 assert.equal(read(undefined).collection.treasuryFailureCode,null);
});

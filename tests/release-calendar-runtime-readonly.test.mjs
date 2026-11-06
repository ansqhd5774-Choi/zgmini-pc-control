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
 assert.deepEqual(out.candidates[0].earningsApiCollector,{
  verifiedReadable:false,sha256:null,bytes:null,modifiedAt:null,
  evidenceLevel:'FILE_INVENTORY_ONLY_NOT_DAILY_GET_PROOF'});
});

test('EarningsAPI collector symlink outside approved root is excluded',t=>{
 const f=fixture(t,{dirs:0});
 const outside=path.join(path.dirname(f.root),'outside-earnings-api-local.mjs');
 fs.writeFileSync(outside,'// MUST_NOT_LEAK_EXTERNAL\n');
 fs.symlinkSync(outside,path.join(f.checkout,'scripts','pc-writer','earnings-api-local.mjs'));
 const out=inspectReleaseCalendarRuntime(f.data,{gitHead:()=>SHA});
 assert.equal(out.status,'PASS');
 assert.equal(out.candidates[0].earningsApiCollector.verifiedReadable,false);
 assert.equal(out.candidates[0].earningsApiCollector.sha256,null);
 assert.doesNotMatch(JSON.stringify(out),/MUST_NOT_LEAK_EXTERNAL/);
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
 assert.deepEqual(obs.observedWindow,{
  firstEventAt:'2026-11-06T14:30:00.000Z',lastEventAt:'2026-11-06T15:10:00.000Z'});
 assert.match(obs.evidenceLevel,/NOT_DAILY_LIMIT_OR_SAVED_DATE_PROOF/);
 assert.doesNotMatch(JSON.stringify(out),/MUST_NOT_LEAK_LOG|api\.other\.example/);
 assert.equal(out.providerCalls,0);
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

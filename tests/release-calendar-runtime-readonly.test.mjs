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

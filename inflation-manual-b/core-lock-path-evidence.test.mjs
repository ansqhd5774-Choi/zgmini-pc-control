import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {DATA_ROOT,SOURCE_ROOT} from './contract.mjs';
import {CORE_LOCK_EVIDENCE_TASKS,inspectCoreLockPathEvidence}
 from './core-lock-path-evidence.mjs';

const hash=x=>createHash('sha256').update(x).digest('hex');
const n=x=>path.win32.normalize(x).toLowerCase();
const CLOCK=Date.parse('2026-11-10T00:00:00Z');
const AT='2026-11-09T23:21:42.451Z';
const SRC=path.win32.join(SOURCE_ROOT,'scripts','pc-writer','local-cycle.mjs');
const REPORT=path.win32.join(DATA_ROOT,'local-cycle-last-run.json');
const VBS1=path.win32.join(DATA_ROOT,'archive-sidecar-r7','run-original-then-archive.vbs');
const VBS2=path.win32.join(DATA_ROOT,'cutover-evidence','run-local-core.vbs');
const VBSK=path.win32.join(DATA_ROOT,'run-local-korea.vbs');
const WSH=String.raw`C:\Windows\System32\wscript.exe`;
const ACCOUNT=String.raw`S-1-5-21-111-222-333-1001`;
const source=Buffer.from('const base=process.env.ZGMINI_PC_HOME; // exact pinned fixture');
const vbsCore=Buffer.from('Set shell=CreateObject("WScript.Shell")\r\n');
const vbsNested=Buffer.from('WScript.Quit 0\r\n');
const vbsKorea=Buffer.from('WScript.Quit 0\r\n');
const xml=first=>Buffer.from(`<?xml version="1.0"?><Task>`+
 `<Principals><Principal><UserId>${ACCOUNT}</UserId></Principal></Principals>`+
 `<Actions><Exec><Command>${WSH}</Command>`+
 `<Arguments>&quot;${first}&quot;</Arguments></Exec></Actions></Task>`);

function fixture(){
 const coreXml=xml(VBS1),koreaXml=xml(VBSK);
 const files=new Map([
  [n(SRC),source],[n(VBS1),vbsCore],[n(VBS2),vbsNested],
  [n(VBSK),vbsKorea],
  [n(REPORT),Buffer.from(JSON.stringify({lane:'core',at:AT,status:'COMPLETE'}))],
 ]);
 const tasks=new Map([[CORE_LOCK_EVIDENCE_TASKS.core,coreXml],
  [CORE_LOCK_EVIDENCE_TASKS.korea,koreaXml]]);
 const attestations=new Map(Object.values(CORE_LOCK_EVIDENCE_TASKS).map(name=>
  [name,{method:'OBSERVED_TASK_RUNTIME',taskName:name,
   path:String.raw`C:\Users\example\.zgmini\pc-writer`} ]));
 const pins={sourceSha256:hash(source),tasks:{
  core:{principal:ACCOUNT,taskXmlSha256:hash(coreXml),
   executable:WSH,firstVbs:VBS1,vbs:[
    {path:VBS1,sha256:hash(vbsCore)},
    {path:VBS2,sha256:hash(vbsNested)}]},
  korea:{principal:ACCOUNT,taskXmlSha256:hash(koreaXml),
   executable:WSH,firstVbs:VBSK,vbs:[{path:VBSK,sha256:hash(vbsKorea)}]},
 }};
 const calls=[];
 const io={
  readFile:async filename=>{calls.push(['read',filename]);return files.get(n(filename));},
  readTaskXml:async name=>{calls.push(['task',name]);return tasks.get(name);},
  effectiveTaskHomeEvidence:async name=>{calls.push(['home',name]);return attestations.get(name);},
  realpath:async filename=>{
   calls.push(['realpath',filename]);
   if(n(filename)===n(DATA_ROOT)||n(filename).includes('users\\example'))
    return DATA_ROOT;
   throw Error('unresolvable');
  },
  stat:async filename=>{calls.push(['stat',filename]);return {mtimeMs:Date.parse(AT)+101.25};},
 };
 return {io,pins,files,tasks,attestations,calls};
}
const inspect=f=>inspectCoreLockPathEvidence({io:f.io,pins:f.pins,clock:CLOCK});

test('two task homes, exact source/launcher bytes and core checkpoint classify only evidence',async()=>{
 const f=fixture(),out=await inspect(f);
 assert.equal(out.status,'EVIDENCE_CONSISTENT');
 assert.equal(out.authorizesB,false);
 assert.equal(out.operationalWrites,0);
 assert.equal(out.providerCalls,0);
 assert.equal(out.d1Writes,0);
 assert.equal(f.calls.filter(x=>x[0]==='task').length,2);
 assert.doesNotMatch(JSON.stringify(out),/S-1-5|ZGmini|example|\.vbs/);
 assert.ok(f.calls.every(x=>['read','stat','task','home','realpath'].includes(x[0])));
});

test('Runner environment is not accepted as effective scheduled Task home',async()=>{
 const f=fixture();
 f.attestations.set(CORE_LOCK_EVIDENCE_TASKS.core,{
  method:'RUNNER_ENV',taskName:CORE_LOCK_EVIDENCE_TASKS.core,path:DATA_ROOT});
 const out=await inspect(f);
 assert.equal(out.code,'CORE_PATH_EFFECTIVE_HOME_UNATTESTED');
 assert.equal(out.authorizesB,false);
});

test('Core alias and Korea effective home must BOTH resolve to E: data root',async()=>{
 const f=fixture();
 f.io.realpath=async value=>n(value)===n(DATA_ROOT)?DATA_ROOT:
  n(value).includes('users\\example')?String.raw`C:\Wrong\pc-writer`:value;
 const out=await inspect(f);
 assert.equal(out.code,'CORE_PATH_EFFECTIVE_HOME_MISMATCH');
});

test('unverified Task principal or action is not a path proof',async()=>{
 const f=fixture();
 f.pins.tasks.core.principal='different-sid';
 const out=await inspect(f);
 assert.equal(out.code,'CORE_PATH_TASK_ACTION_OR_PRINCIPAL_UNKNOWN');
});

test('changed Task XML is stopped before reading any launcher',async()=>{
 const f=fixture();
 f.tasks.set(CORE_LOCK_EVIDENCE_TASKS.core,Buffer.from('<Task>changed</Task>'));
 const out=await inspect(f);
 assert.equal(out.code,'CORE_PATH_TASK_XML_UNKNOWN');
 assert.equal(f.calls.filter(x=>x[0]==='read'&&x[1].endsWith('.vbs')).length,0);
});

test('one changed VBS byte invalidates even an unchanged Task XML',async()=>{
 const f=fixture();f.files.set(n(VBS2),Buffer.from('WScript.Quit 1\r\n'));
 const out=await inspect(f);
 assert.equal(out.code,'CORE_PATH_LAUNCHER_HASH_UNKNOWN');
});

test('changed Core source prevents E report inference',async()=>{
 const f=fixture();f.files.set(n(SRC),Buffer.from('different source'));
 const out=await inspect(f);
 assert.equal(out.code,'CORE_PATH_SOURCE_HASH_UNKNOWN');
});

test('only a recent CORE lane report with a source-defined status is evidence',async()=>{
 for(const changed of [
  {lane:'korea',at:AT,status:'COMPLETE'},
  {lane:'core',at:AT,status:'INVALID'},
  {lane:'core',at:'2026-11-01T23:21:42.451Z',status:'COMPLETE'},
 ]){
  const f=fixture();f.files.set(n(REPORT),Buffer.from(JSON.stringify(changed)));
  const out=await inspect(f);
  assert.equal(out.code,'CORE_PATH_CORE_CHECKPOINT_UNVERIFIED');
 }
});

test('degraded and failed publication status still support the same-base path inference',async()=>{
 for(const status of ['COMPLETE','COMPLETE_WITH_COLLECTION_GAPS',
  'PUBLICATION_NOT_VERIFIED']){
  const f=fixture();f.files.set(n(REPORT),Buffer.from(JSON.stringify({
   lane:'core',at:AT,status})));
  const out=await inspect(f);
  assert.equal(out.status,'EVIDENCE_CONSISTENT');
  assert.equal(out.authorizesB,false);
 }
});

test('missing effective task attestation and unreadable source fail closed',async()=>{
 const f=fixture();f.attestations.delete(CORE_LOCK_EVIDENCE_TASKS.korea);
 assert.equal((await inspect(f)).code,'CORE_PATH_EFFECTIVE_HOME_UNATTESTED');
 const g=fixture();g.io.readFile=async()=>{throw Error('denied');};
 assert.equal((await inspect(g)).code,'CORE_PATH_READONLY_INSPECTION_UNAVAILABLE');
});

test('untrusted path in pin list and incomplete adapter are rejected',async()=>{
 const f=fixture();f.pins.tasks.core.vbs.push({
  path:String.raw`C:\Other\unapproved.vbs`,sha256:hash(vbsCore)});
 assert.equal((await inspect(f)).code,'CORE_PATH_PROBE_CONTRACT_UNKNOWN');
 const g=fixture();delete g.io.realpath;
 assert.equal((await inspect(g)).code,'CORE_PATH_PROBE_CONTRACT_UNKNOWN');
});

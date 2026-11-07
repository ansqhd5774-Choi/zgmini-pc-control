import test from 'node:test';
import assert from 'node:assert/strict';
import {decodeTaskXmlBytes,coreQuietFromProbe,
 coreReadyForMaintenance,coreMaintenanceWindowBlockCode,
 attestTaskFirstHopLauncher} from './windows-guards.mjs';

const XML='<?xml version="1.0"?><Task><Settings><Enabled>true</Enabled></Settings></Task>';
const quiet=()=>({enabled:false,state:3,instances:0,
 relatedProcesses:0,unknownProcessLines:0});

test('Windows Task XML decoder preserves UTF-8/UTF-8 BOM/UTF-16LE identities',()=>{
 assert.equal(decodeTaskXmlBytes(Buffer.from(XML)),XML);
 assert.equal(decodeTaskXmlBytes(Buffer.concat([
  Buffer.from([0xef,0xbb,0xbf]),Buffer.from(XML)])),XML);
 assert.equal(decodeTaskXmlBytes(Buffer.concat([
  Buffer.from([0xff,0xfe]),Buffer.from(XML,'utf16le')])),XML);
 assert.equal(decodeTaskXmlBytes(Buffer.from(XML,'utf16le')),XML);
});

test('malformed Task XML bytes and unsupported UTF-16BE reject read-only',()=>{
 assert.throws(()=>decodeTaskXmlBytes(Buffer.from([0xfe,0xff,0,60,0,0])),
  {code:'WRITER_B_TASK_XML_ENCODING_STOP'});
 assert.throws(()=>decodeTaskXmlBytes(Buffer.from('not-xml')),
  {code:'WRITER_B_TASK_XML_STOP'});
 assert.throws(()=>decodeTaskXmlBytes(Buffer.from([0xff,0xfe,0x3c,0,0x3e])),
  {code:'WRITER_B_TASK_XML_ENCODING_STOP'});
});

test('Core drain requires disabled Task, no active instance/process, no cycle lock',()=>{
 assert.equal(coreQuietFromProbe(quiet(),false),true);
 assert.equal(coreQuietFromProbe({...quiet(),state:1},false),true,
  'a disabled Task with no active instances remains quiescent');
 for(const delta of [{enabled:true},{state:0},{state:2},{state:4},
  {state:undefined},{instances:1},
  {relatedProcesses:1},{unknownProcessLines:1}])
  assert.equal(coreQuietFromProbe({...quiet(),...delta},false),false);
 assert.equal(coreQuietFromProbe(quiet(),true),false);
});

test('Core maintenance window requires enabled READY Task with no running Core',()=>{
 const ready={...quiet(),enabled:true};
 assert.equal(coreReadyForMaintenance(ready,false),true);
 assert.equal(coreMaintenanceWindowBlockCode(ready,false),null);
 // A live Core cycle should not be interrupted for an installation.
 for(const change of [{state:4},{state:2},{state:0},{instances:1},
  {relatedProcesses:2},{unknownProcessLines:1},{enabled:false}]){
  assert.equal(coreReadyForMaintenance({...ready,...change},false),false);
 }
 assert.equal(coreReadyForMaintenance(ready,true),false);
 assert.equal(coreMaintenanceWindowBlockCode({...ready,relatedProcesses:2},false),
  'WRITER_B_CORE_ACTIVE_WINDOW_DEFERRED');
 assert.equal(coreMaintenanceWindowBlockCode(ready,true),
  'WRITER_B_CORE_ACTIVE_WINDOW_DEFERRED');
 assert.equal(coreMaintenanceWindowBlockCode({...ready,state:0},false),
  'WRITER_B_CORE_WINDOW_UNVERIFIED_DEFERRED');
});

const LAUNCHER=String.raw`E:\ZGmini\data\pc-writer\archive-sidecar-r7\run-original-then-archive.vbs`;
const xmlAction=(command,args,workingDirectory='')=>
 `<Task><Actions><Exec><Command>${command}</Command>`+
 `<Arguments>${args}</Arguments>`+
 (workingDirectory?`<WorkingDirectory>${workingDirectory}</WorkingDirectory>`:'')+
 '</Exec></Actions></Task>';
const firstHopManifest=(launcher=LAUNCHER)=>({
 files:[{path:'scripts/pc-writer/run-local.mjs'}],
 runtimeDependencies:{consumers:[{id:'core-launcher',kind:'LAUNCHER',
  path:launcher,sha256:'a'.repeat(64),dependsOn:['scripts/pc-writer/run-local.mjs']}]},
});
const att=(taskXml,manifest=firstHopManifest(),realpath=p=>p)=>
 attestTaskFirstHopLauncher({taskXml,manifest,realpath});

test('first Task hop matches approved E: absolute WSH launcher only',()=>{
 const result=att(xmlAction('C:\\Windows\\System32\\cscript.exe',
  `//NoLogo "${LAUNCHER}"`));
 assert.deepEqual(result,{status:'PASS',code:'FIRST_HOP_TASK_LAUNCHER_MATCH',
  consumerId:'core-launcher',runtimeChainVerified:false});
});

test('approved Task WorkingDirectory resolves relative VBS and CMD first hops',()=>{
 const wd=String.raw`E:\ZGmini\data\pc-writer\archive-sidecar-r7`;
 assert.equal(att(xmlAction('wscript.exe','run-original-then-archive.vbs',wd)).status,'PASS');
 const script=String.raw`E:\ZGmini\data\pc-writer\task-root\launcher.cmd`;
 const cmdManifest=firstHopManifest(script);
 const result=att(xmlAction('cmd.exe','/D /C launcher.cmd',
  String.raw`E:\ZGmini\data\pc-writer\task-root`),cmdManifest);
 assert.equal(result.code,'FIRST_HOP_TASK_LAUNCHER_MATCH');
});

test('C: compatibility junction is accepted only if its native realpath is the approved E: file',()=>{
 const legacy=String.raw`C:\ZGmini\data\pc-writer\archive-sidecar-r7\run-original-then-archive.vbs`;
 assert.equal(att(xmlAction('wscript.exe',`"${legacy}"`),
  firstHopManifest(),p=>p===legacy?LAUNCHER:p).status,'PASS');
 assert.throws(()=>att(xmlAction('wscript.exe',`"${legacy}"`),
  firstHopManifest(),p=>p),{code:'WRITER_B_FIRST_HOP_OUTSIDE_SCOPE_STOP'});
});

test('unknown relative Task hop, multiple Exec and dynamic argument never pass',()=>{
 const valid=xmlAction('wscript.exe','run-original-then-archive.vbs');
 assert.throws(()=>att(valid),{code:'WRITER_B_FIRST_HOP_UNRESOLVED_STOP'});
 const two=xmlAction('wscript.exe',`"${LAUNCHER}"`).replace(
  '</Actions>',`<Exec><Command>wscript.exe</Command><Arguments>${LAUNCHER}</Arguments></Exec></Actions>`);
 assert.throws(()=>att(two),{code:'WRITER_B_FIRST_HOP_UNRESOLVED_STOP'});
 assert.throws(()=>att(xmlAction('wscript.exe','%RUNNER_TEMP%\\launch.vbs')),
  {code:'WRITER_B_FIRST_HOP_UNRESOLVED_STOP'});
 assert.throws(()=>att(xmlAction('wscript.exe',`"${LAUNCHER}" & start evil.cmd`)),
  {code:'WRITER_B_FIRST_HOP_UNRESOLVED_STOP'});
});

test('first hop mismatch rejects even identical basename in a different folder',()=>{
 const different=String.raw`E:\ZGmini\data\pc-writer\other\run-original-then-archive.vbs`;
 assert.throws(()=>att(xmlAction('wscript.exe',`"${different}"`)),
  {code:'WRITER_B_FIRST_HOP_LAUNCHER_MISMATCH_STOP'});
 assert.throws(()=>att(xmlAction('wscript.exe',`"${LAUNCHER}"`),
  firstHopManifest(String.raw`E:\ZGmini\data\pc-writer\other\run-original-then-archive.vbs`)),
  {code:'WRITER_B_FIRST_HOP_LAUNCHER_MISMATCH_STOP'});
});

test('non-entrypoint-only changes never acquire a Task first-hop global Gate',()=>{
 const manifest={files:[{path:'lib/feature-only.mjs'}],runtimeDependencies:{consumers:[]}};
 assert.equal(attestTaskFirstHopLauncher({taskXml:'unavailable',manifest,
  realpath:()=>{throw Error('should not be called');}}).status,'NOT_APPLICABLE');
});

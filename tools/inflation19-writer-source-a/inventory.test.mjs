import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalWindows,approvedWriterVbsPath,sourceRootFromRealScript,
 parseCoreTaskXml,parseApprovedCoreVbs,
 launcherArgumentShape,sanitizedBlock,
 inventoryReadOnly,FILES,SCHEMA} from './inventory.mjs';

const SCRIPT=String.raw`E:\ZGmini\projects\zgmini-earnings-history-pc-release\scripts\pc-writer\local-cycle.mjs`;
const ROOT=String.raw`e:\zgmini\projects\zgmini-earnings-history-pc-release`;
const SOURCE='a23c12cc8dd3238fa59adb417a4fdd5fce1bd57e';
const CORE_VBS=String.raw`E:\ZGmini\data\pc-writer\run-local-core.vbs`;
const ALT_VBS=String.raw`E:\ZGmini\data\pc-writer\launchers\approved-core-alternate.vbs`;
const COMPAT_VBS=String.raw`C:\ZGmini\data\pc-writer\launchers\approved-core-alternate.vbs`;
const vbs=()=>Buffer.from('Set shell = CreateObject("WScript.Shell")\r\n'+
 'WScript.Quit shell.Run("""E:\\ZGmini\\runtime\\node.exe"" ""'+SCRIPT+'"" --publish", 0, True)\r\n');
const xml=(script=SCRIPT,command=String.raw`E:\ZGmini\runtime\node.exe`)=>Buffer.from(
 `<?xml version="1.0"?><Task><Actions><Exec><Command>${command}</Command>`+
 `<Arguments>"${script}"</Arguments></Exec></Actions></Task>`);
function fixture(overrides={}){
 const deps={taskXml:()=>xml(),resolveRealPath:()=>SCRIPT,
  readConfig:()=>({source:SOURCE}),gitRoot:()=>ROOT,gitHead:()=>SOURCE,
  targetFilesDirty:()=>false,
  readLauncher:()=>vbs(),
  readTargetExists:(_root,rel)=>rel===FILES[0],
  readTarget:()=>Buffer.from('approved existing run-local source')};
 return {...deps,...overrides};
}

test('task Action pins one script and only exposes digest and executable basename',()=>{
 const p=parseCoreTaskXml(xml());
 assert.equal(p.script,SCRIPT);
 assert.equal(p.kind,'direct-mjs');
 assert.equal(p.actionExe,'node.exe');
 assert.match(p.taskXmlSha256,/^[a-f0-9]{64}$/);
 assert.equal(Object.keys(p).length,4);
});

test('documented WScript VBS launcher is parsed as data for an exact MJS path',()=>{
 const a=parseCoreTaskXml(xml(CORE_VBS,String.raw`C:\Windows\System32\wscript.exe`));
 assert.equal(a.kind,'vbs');assert.equal(a.launcher,CORE_VBS);
 assert.equal(parseApprovedCoreVbs(vbs()),SCRIPT);
 const r=inventoryReadOnly(fixture({taskXml:()=>xml(CORE_VBS,
  String.raw`C:\Windows\System32\wscript.exe`),
  resolveRealPath:p=>p===CORE_VBS?CORE_VBS:SCRIPT}));
 assert.equal(r.status,'PASS_READONLY');assert.equal(r.actionExe,'wscript.exe');
});

test('alternate quoted VBS basename passes only with approved contents and realpath',()=>{
 const a=parseCoreTaskXml(xml(ALT_VBS,String.raw`C:\Windows\System32\wscript.exe`));
 assert.equal(a.kind,'vbs');assert.equal(a.launcher,ALT_VBS);
 assert.equal(approvedWriterVbsPath(ALT_VBS),ALT_VBS.toLowerCase());
 const r=inventoryReadOnly(fixture({taskXml:()=>xml(ALT_VBS,
  String.raw`C:\Windows\System32\wscript.exe`),
  resolveRealPath:p=>p===ALT_VBS?String.raw`\\?\E:\ZGmini\data\pc-writer\launchers\approved-core-alternate.vbs`:SCRIPT}));
 assert.equal(r.status,'PASS_READONLY');
 assert.equal(r.actionExe,'wscript.exe');
});

test('C drive compatibility junction passes only when native realpath enters E Writer root',()=>{
 let launcherReads=0;
 const r=inventoryReadOnly(fixture({taskXml:()=>xml(COMPAT_VBS,
  String.raw`C:\Windows\System32\wscript.exe`),
  resolveRealPath:p=>p===COMPAT_VBS?ALT_VBS:SCRIPT,
  readLauncher:()=>{launcherReads++;return vbs()}}));
 assert.equal(r.status,'PASS_READONLY');
 assert.equal(r.actionExe,'wscript.exe');
 assert.equal(launcherReads,1);
});

test('C path which resolves outside E Writer root fails before launcher read',()=>{
 let launcherReads=0,error;
 try{inventoryReadOnly(fixture({taskXml:()=>xml(COMPAT_VBS,
  String.raw`C:\Windows\System32\wscript.exe`),
  resolveRealPath:p=>p===COMPAT_VBS?String.raw`E:\ZGmini\data\other\not-writer.vbs`:SCRIPT,
  readLauncher:()=>{launcherReads++;return vbs()}}))}catch(e){error=e}
 const report=sanitizedBlock(error);
 assert.equal(report.status,'BLOCKED');
 assert.equal(report.code,'INFL19_A_LAUNCHER_PATH_DENIED');
 assert.equal(report.launcherArgumentShape,'QUOTED_VBS_PATH');
 assert.equal(launcherReads,0);
 assert.equal(JSON.stringify(report).includes('not-writer'),false);
});

test('VBS action outside approved root, traversal, and junction escape fail closed',()=>{
 const wscript=String.raw`C:\Windows\System32\wscript.exe`;
 for(const bad of [String.raw`E:\ZGmini\data\other\x.vbs`,
  String.raw`E:\ZGmini\data\pc-writer\..\outside.vbs`,
  String.raw`E:\ZGmini\data\pc-writer\nested/../fake.vbs`,
  String.raw`C:\ZGmini\data\pc-writer\x.vbs`,
  String.raw`E:\ZGmini\data\pc-writer\fake.vbs:ads`]){
  let error;
  try{inventoryReadOnly(fixture({taskXml:()=>xml(bad,wscript),
   resolveRealPath:p=>p===bad?bad:SCRIPT}))}catch(e){error=e}
  const report=sanitizedBlock(error);
  assert.equal(report.status,'BLOCKED');
  assert.ok(['INFL19_A_LAUNCHER_PATH_DENIED',
   'INFL19_A_SCRIPT_REFERENCE_UNRESOLVED'].includes(report.code));
  assert.equal(report.actionExe,'wscript.exe');
  assert.match(report.taskXmlSha256,/^[a-f0-9]{64}$/);
  assert.equal(report.pcSourceWrites,0);
 }
 const escaped=String.raw`E:\ZGmini\data\unapproved\secret.vbs`;
 let error;
 try{inventoryReadOnly(fixture({taskXml:()=>xml(ALT_VBS,wscript),
  resolveRealPath:p=>p===ALT_VBS?escaped:SCRIPT}))}catch(e){error=e}
 const report=sanitizedBlock(error);
 assert.equal(report.code,'INFL19_A_LAUNCHER_PATH_DENIED');
 assert.equal(report.launcherArgumentShape,'QUOTED_VBS_PATH');
 assert.equal(JSON.stringify(report).includes('secret'),false);
});

test('alternate VBS with malicious content is blocked without executing',()=>{
 const r=inventoryReadOnly(fixture({taskXml:()=>xml(ALT_VBS,
  String.raw`C:\Windows\System32\wscript.exe`),
  resolveRealPath:p=>p===ALT_VBS?ALT_VBS:SCRIPT,
  readLauncher:()=>Buffer.from('Set shell = CreateObject("WScript.Shell")\r\nWScript.Quit shell.Run("malicious", 0, True)\r\n')}));
 assert.equal(r.status,'BLOCKED');
 assert.equal(r.code,'INFL19_A_LAUNCHER_FORMAT_UNSUPPORTED');
 assert.match(r.launcherSha256,/^[a-f0-9]{64}$/);
 assert.equal(JSON.stringify(r).includes('malicious'),false);
});

test('nonstandard dispatcher stops with only launcher hash, without exposing content',()=>{
 const r=inventoryReadOnly(fixture({taskXml:()=>xml(CORE_VBS,
  String.raw`C:\Windows\System32\wscript.exe`),
  resolveRealPath:p=>p===CORE_VBS?CORE_VBS:SCRIPT,
  readLauncher:()=>Buffer.from('secret option --unknown-dispatcher')}));
 assert.equal(r.status,'BLOCKED');
 assert.equal(r.code,'INFL19_A_LAUNCHER_FORMAT_UNSUPPORTED');
 assert.match(r.launcherSha256,/^[a-f0-9]{64}$/);
 assert.equal(JSON.stringify(r).includes('secret option'),false);
});

test('task XML UTF-16LE BOM is decoded without running Action',()=>{
 const source=xml().toString('utf8');
 const p=parseCoreTaskXml(Buffer.concat([Buffer.from([0xff,0xfe]),
  Buffer.from(source,'utf16le')]));
 assert.equal(p.script,SCRIPT);
 assert.equal(parseCoreTaskXml(Buffer.from(source,'utf16le')).script,SCRIPT);
});

test('junction-normalized Windows real path stays under approved E project root',()=>{
 assert.equal(canonicalWindows(String.raw`\\?\E:\ZGmini\projects\abc`),String.raw`e:\zgmini\projects\abc`);
 assert.equal(sourceRootFromRealScript(SCRIPT),ROOT);
 assert.throws(()=>sourceRootFromRealScript(String.raw`C:\ZGmini\projects\abc\scripts\pc-writer\local-cycle.mjs`),
  /INFL19_A_SOURCE_ROOT_DENIED/);
 assert.throws(()=>sourceRootFromRealScript(String.raw`E:\ZGmini\data\pc-writer\scripts\pc-writer\local-cycle.mjs`),
  /INFL19_A_SOURCE_ROOT_DENIED/);
});

test('bounded read-only inventory returns identity and 3 file states',()=>{
 const r=inventoryReadOnly(fixture());
 assert.equal(r.schema,SCHEMA);assert.equal(r.status,'PASS_READONLY');
 assert.equal(r.sourceRoot,ROOT);assert.equal(r.configMatchesHead,true);
 assert.equal(r.targetFilesDirty,false);
 assert.equal(r.files[FILES[0]].status,'PRESENT');
 assert.equal(r.files[FILES[1]].status,'ABSENT');
 assert.equal(r.files[FILES[2]].status,'ABSENT');
 assert.equal(r.pcSourceWrites,0);assert.equal(r.d1Writes,0);
 assert.equal('config' in r,false);assert.equal('args' in r,false);
});

test('mixed config/source SHA is reported without mutation or false runtime assertion',()=>{
 const r=inventoryReadOnly(fixture({gitHead:()=> 'f'.repeat(40)}));
 assert.equal(r.configMatchesHead,false);
 assert.equal(r.evidenceLevel,'TASK_XML_AND_FILESYSTEM_GIT_READONLY_NOT_CORE_RUNTIME');
});

test('ambiguous/missing task Action or non-Writer script stops',()=>{
 assert.throws(()=>parseCoreTaskXml(Buffer.from('<Task/>')),
  /INFL19_A_TASK_ACTION_AMBIGUOUS/);
 assert.throws(()=>parseCoreTaskXml(xml(String.raw`E:\ZGmini\projects\foo\not-writer.mjs`)),
  /INFL19_A_SCRIPT_REFERENCE_UNRESOLVED/);
 assert.throws(()=>parseCoreTaskXml(Buffer.from('<Task><Actions><Exec><Command>a</Command></Exec>'+ 
  '<Exec><Command>b</Command></Exec></Actions></Task>')),
  /INFL19_A_TASK_ACTION_AMBIGUOUS/);
 assert.throws(()=>parseCoreTaskXml(xml(SCRIPT,String.raw`E:\ZGmini\runtime\not-node.exe`)),
  /INFL19_A_SCRIPT_REFERENCE_UNRESOLVED/);
 assert.throws(()=>parseCoreTaskXml(Buffer.from('<Task><Exec><Command>x</Command></Exec></Task>')),
  /INFL19_A_TASK_ACTION_AMBIGUOUS/);
});

test('unsafe source state and missing entry do not pass',()=>{
 assert.throws(()=>inventoryReadOnly(fixture({gitHead:()=> 'invalid'})),
  /INFL19_A_GIT_HEAD_DENIED/);
 assert.throws(()=>inventoryReadOnly(fixture({readConfig:()=>({source:'invalid'})})),
  /INFL19_A_CONFIG_SOURCE_DENIED/);
 assert.throws(()=>inventoryReadOnly(fixture({readTargetExists:()=>false})),
  /INFL19_A_WRITER_ENTRY_MISSING/);
 assert.throws(()=>inventoryReadOnly(fixture({gitRoot:()=>String.raw`e:\zgmini\projects`})),
  /INFL19_A_NOT_CHECKOUT_ROOT/);
});

test('unresolved action reports only allowlisted executable and argument shape',()=>{
 const raw=xml(String.raw`E:\ZGmini\automation\private-dispatch.vbs`,
  String.raw`C:\Windows\System32\cscript.exe`);
 let error;
 try{parseCoreTaskXml(raw)}catch(e){error=e}
 const report=sanitizedBlock(error);
 assert.equal(report.code,'INFL19_A_SCRIPT_REFERENCE_UNRESOLVED');
 assert.equal(report.actionExe,'cscript.exe');
 assert.equal(report.launcherArgumentShape,'QUOTED_VBS_PATH');
 assert.match(report.taskXmlSha256,/^[a-f0-9]{64}$/);
 assert.equal(JSON.stringify(report).includes('private-dispatch'),false);
 assert.equal(report.pcSourceWrites,0);
});

test('nonallowlisted executable is redacted, command switches classified only',()=>{
 assert.equal(launcherArgumentShape('/d /c "E:\\secret\\launcher.cmd"'),'CMD_SWITCH');
 const raw=xml(String.raw`E:\ZGmini\automation\secret.cmd`,
  String.raw`C:\Windows\System32\unknown-secret.exe`);
 let error;
 try{parseCoreTaskXml(raw)}catch(e){error=e}
 const report=sanitizedBlock(error);
 assert.equal(report.actionExe,'OTHER');
 assert.equal(report.launcherArgumentShape,'QUOTED_CMD_PATH');
 assert.equal(JSON.stringify(report).includes('unknown-secret'),false);
});

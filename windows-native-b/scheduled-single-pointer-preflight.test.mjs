import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {analyzeScheduledSinglePointer,inspectWindowsScheduledSinglePointer,
 inspectWindowsConfiguredRuntimeMode} from
 './scheduled-single-pointer-preflight.mjs';

const home='E:\\ZGmini\\data\\pc-writer\\theme-config-tool';
const oldVersion='1234567890abcdef',newVersion='fedcba0987654321';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const cmd=version=>Buffer.from([
 '@echo off',
 'setlocal EnableExtensions DisableDelayedExpansion',
 'set "ZGMINI_DATA_ROOT=E:\\ZGmini\\data"',
 '"E:\\ZGmini\\runtime\\node.exe" "'+home+'\\versions\\'+version+
  '\\scripts\\pc-writer\\theme-config-tool.mjs" --scheduled >>"'+
  home+'\\SCHEDULE_HISTORY.log" 2>&1',
 'set "RESULT=%ERRORLEVEL%"',
 'exit /b %RESULT%','',
].join('\r\n'));
const xml=Buffer.from('<Task><Actions><Exec><Command>wscript.exe</Command>'+ 
 '<Arguments>&quot;'+home+'\\THEME_SCHEDULED.vbs&quot;</Arguments>'+ 
 '</Exec></Actions></Task>');
const vbs=Buffer.from(['Option Explicit','Dim shell',
 'Set shell = CreateObject("WScript.Shell")',
 'WScript.Quit shell.Run("""'+home+'\\THEME_SCHEDULED.cmd""", 0, True)',
 ''].join('\r\n'));
const base={taskXmlBytes:xml,vbsBytes:vbs,
 oldCmdBytes:cmd(oldVersion),newCmdBytes:cmd(newVersion)};
const approved={taskName:'ZGMINI-PC-Configured-Themes',oldVersion,newVersion,
 taskXmlSha256:hash(xml),vbsSha256:hash(vbs),
 oldCmdSha256:hash(base.oldCmdBytes),newCmdSha256:hash(base.newCmdBytes)};
const invoke=(updates={},appUpdates={})=>analyzeScheduledSinglePointer({
 ...base,...updates,approval:{...approved,...appUpdates},
});
const rejected=(updates,appUpdates,code)=>{
 assert.throws(()=>invoke(updates,appUpdates),e=>e.code===code);
};

test('old/new immutable single-CMD dispatch is a candidate, NEVER an activation authorization',()=>{
 const got=invoke();
 assert.equal(got.status,'SINGLE_SCHEDULED_CMD_CANDIDATE_ONLY');
 assert.deepEqual(got.changedScheduledFiles,['THEME_SCHEDULED.cmd']);
 assert.equal(got.runtimeCompatibilityProven,false);
 assert.equal(got.schedulerTickRaceProvenSafe,false);
 assert.equal(got.activationAllowed,false);
 assert.equal(got.firstFail,'B_NATIVE_TASK_TICK_COMPATIBILITY_PROOF_REQUIRED');
});
test('task or VBS hash drift fails closed',()=>{
 rejected({taskXmlBytes:Buffer.from('<Task/>')},{},'B_SINGLE_POINTER_PIN_DRIFT');
 rejected({vbsBytes:Buffer.from('Set shell = null')},{},'B_SINGLE_POINTER_PIN_DRIFT');
});
test('unapproved extra command is rejected, even when matching after SHA is forged in argument',()=>{
 const forged=Buffer.from(cmd(newVersion).toString().replace('@echo off',
  '@echo off\r\ndel E:\\ZGmini\\data\\sensitive.sqlite'));
 rejected({newCmdBytes:forged},{newCmdSha256:hash(forged)},
  'B_SINGLE_POINTER_CMD_GRAMMAR');
});
test('altered Task action and VBS dispatcher are rejected even with updated supplied pins',()=>{
 const wrongTask=Buffer.from(xml.toString().replace('wscript.exe','powershell.exe'));
 rejected({taskXmlBytes:wrongTask},{taskXmlSha256:hash(wrongTask)},
  'B_SINGLE_POINTER_TASK_ACTION');
 const wrongVbs=Buffer.from(vbs.toString().replace('THEME_SCHEDULED.cmd','UNAPPROVED.cmd'));
 rejected({vbsBytes:wrongVbs},{vbsSha256:hash(wrongVbs)},
  'B_SINGLE_POINTER_VBS_DISPATCH');
});
test('wrong approved version, scope, dataRoot fail closed',()=>{
 rejected({}, {oldVersion:newVersion},'B_SINGLE_POINTER_APPROVAL_SCOPE');
 rejected({}, {taskName:'Other-Task'},'B_SINGLE_POINTER_APPROVAL_SCOPE');
 const wrong=Buffer.from(cmd(newVersion).toString().replace('ZGMINI_DATA_ROOT=E:',
  'ZGMINI_DATA_ROOT=C:'));
 rejected({newCmdBytes:wrong},{newCmdSha256:hash(wrong)},
  'B_SINGLE_POINTER_CMD_GRAMMAR');
});
test('native read-only path requires Windows, no OS mutation',()=>{
 assert.throws(()=>inspectWindowsScheduledSinglePointer({approval:approved,
  newCmdBytes:base.newCmdBytes,platform:'linux'}),
  e=>e.code==='B_NATIVE_WINDOWS_REQUIRED');
 const paths=[];
 const got=inspectWindowsScheduledSinglePointer({approval:approved,
  newCmdBytes:base.newCmdBytes,platform:'win32',
  lstat:(p)=>{paths.push(p);return {
   isSymbolicLink:()=>false,isFile:()=>p.endsWith('.cmd')||p.endsWith('.vbs'),
   isDirectory:()=>!p.endsWith('.cmd')&&!p.endsWith('.vbs')};},
  readFile:p=>p.endsWith('.cmd')?base.oldCmdBytes:vbs,
  readTaskXml:()=>xml,
 });
 assert.equal(got.activationAllowed,false);
 assert.ok(paths.includes(home));
});
test('native preflight rejects junction/reparse and snapshot races',()=>{
 assert.throws(()=>inspectWindowsScheduledSinglePointer({approval:approved,
  newCmdBytes:base.newCmdBytes,platform:'win32',
  lstat:()=>({isSymbolicLink:()=>true,isFile:()=>true,isDirectory:()=>true}),
  readFile:()=>base.oldCmdBytes,readTaskXml:()=>xml,
 }),e=>e.code==='B_NATIVE_REPARSE_OR_TYPE');
 let calls=0;
 assert.throws(()=>inspectWindowsScheduledSinglePointer({approval:approved,
  newCmdBytes:base.newCmdBytes,platform:'win32',
  lstat:p=>({isSymbolicLink:()=>false,
   isFile:()=>p.endsWith('.cmd')||p.endsWith('.vbs'),
   isDirectory:()=>!p.endsWith('.cmd')&&!p.endsWith('.vbs')}),
  readFile:p=>p.endsWith('.cmd')?base.oldCmdBytes:vbs,
  readTaskXml:()=>++calls===1?xml:Buffer.from('<Task/>'),
 }),e=>e.code==='B_NATIVE_TASK_SNAPSHOT_DRIFT');
});

test('read-only runtime inventory distinguishes original single-CMD from active repeatable mode',()=>{
 const fakeStat=()=>({isFile:()=>true,isSymbolicLink:()=>false});
 const first=inspectWindowsConfiguredRuntimeMode({platform:'win32',
  existsSync:()=>false,lstat:fakeStat});
 assert.equal(first.mode,'FIRST_SINGLE_CMD_UPGRADE');
 assert.equal(first.activationAllowed,false);
 const repeat=inspectWindowsConfiguredRuntimeMode({platform:'win32',
  existsSync:()=>true,lstat:fakeStat});
 assert.equal(repeat.mode,'REPEATABLE_ACTIVE_RUNTIME');
 assert.equal(repeat.operationalWrites,0);
});
test('single-CMD preflight does not silently run in repeatable ACTIVE_RUNTIME mode',()=>{
 assert.throws(()=>inspectWindowsScheduledSinglePointer({approval:approved,
  newCmdBytes:base.newCmdBytes,platform:'win32',existsSync:()=>true}),
  e=>e.code==='B_NATIVE_REPEATABLE_RUNTIME_DIFFERENT_EFFECT');
 let checks=0;
 assert.throws(()=>inspectWindowsScheduledSinglePointer({approval:approved,
  newCmdBytes:base.newCmdBytes,platform:'win32',
  existsSync:()=>++checks>1,
  lstat:p=>({isSymbolicLink:()=>false,
   isFile:()=>p.endsWith('.cmd')||p.endsWith('.vbs'),
   isDirectory:()=>!p.endsWith('.cmd')&&!p.endsWith('.vbs')}),
  readFile:p=>p.endsWith('.cmd')?base.oldCmdBytes:vbs,
  readTaskXml:()=>xml,
 }),e=>e.code==='B_NATIVE_RUNTIME_MODE_CHANGED_DURING_READ');
});

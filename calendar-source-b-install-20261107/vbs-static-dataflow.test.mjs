import test from 'node:test';
import assert from 'node:assert/strict';
import {traceVbsDataflow,logicalLines} from './vbs-static-dataflow.mjs';
const root=String.raw`E:\ZGmini\projects\zgmini-earnings-history-pc-release`;
const source=String.raw`E:\ZGmini\data\pc-writer\cutover-evidence\run-local-core.vbs`;
const script=String.raw`E:\ZGmini\data\pc-writer\archive-sidecar-r7\run-original-then-archive.vbs`;
const context={scriptPath:script,secondPath:source,root};
test('literal + variable + quote concatenation resolves pinned next VBS',()=>{
 const vbs=`Set shell = CreateObject("WScript.Shell")\n`+
  `nextScript = "${source}"\n`+
  `q = Chr(34)\n`+
  `shell.Run q & nextScript & q, 0, True\n`;
 const x=traceVbsDataflow(vbs,context);
 assert.equal(x.callCount,1);
 assert.equal(x.unresolvedCount,0);
 assert.equal(x.calls[0].nextPinnedVbs,true);
 assert.equal(x.calls[0].nextPinnedVbsDirect,true);
 assert.equal(x.calls[0].argumentForm,'concatenated');
 assert.equal(x.entirelyDeterministic,true);
 assert.equal(JSON.stringify(x).includes(source),false);
});
test('BuildPath, ScriptFullName and parent path are bounded known functions',()=>{
 const vbs=`Set fso = CreateObject("Scripting.FileSystemObject")\n`+
  `Set sh = CreateObject("WScript.Shell")\n`+
  `folder = fso.GetParentFolderName(WScript.ScriptFullName)\n`+
  `target = fso.BuildPath(folder, "run-local-core.vbs")\n`+
  `sh.Run target\n`;
 const x=traceVbsDataflow(vbs,{...context,secondPath:
  String.raw`E:\ZGmini\data\pc-writer\archive-sidecar-r7\run-local-core.vbs`});
 assert.equal(x.callCount,1);
 assert.equal(x.calls[0].resolved,true);
 assert.equal(x.calls[0].nextPinnedVbs,true);
 assert.equal(x.calls[0].nextPinnedVbsDirect,true);
});
test('branch reassignment, unapproved env and indirect Eval all STOP',()=>{
 const vbs=`Set sh=CreateObject("WScript.Shell")\n`+
  `cmd = sh.ExpandEnvironmentStrings("%SECRET_ENV%")\n`+
  `If flag Then\ncmd = "${source}"\nEnd If\n`+
  `Eval("unknown")\nsh.Run cmd\n`;
 const x=traceVbsDataflow(vbs,context);
 assert.equal(x.branchSeen,true);
 assert.equal(x.indirectExecutionSeen,true);
 assert.equal(x.calls[0].resolved,false);
 assert.equal(x.entirelyDeterministic,false);
 assert.equal(JSON.stringify(x).includes('SECRET_ENV'),false);
});
test('comments, quotes, escaped quotes and continuation never invent calls',()=>{
 const x=traceVbsDataflow(`Rem sh.Run "wrong"\n`+
  `Set sh=CreateObject("WScript.Shell")\n`+
  `' sh.Run "wrong"\n`+
  `cmd = "prefix & literal" & _\n`+
  ` " end"\n`+
  `sh.Run cmd\n`,context);
 assert.equal(x.callCount,1);
 assert.equal(x.calls[0].resolved,true);
 assert.equal(x.calls[0].nextPinnedVbs,false);
 assert.equal(logicalLines('x="hello \' quoted"\ny=3').length,2);
});
test('unknown Shell object, dynamic path, cmd switch must not prove Core',()=>{
 const x=traceVbsDataflow(`Set sh=CreateObject("WScript.Shell")\n`+
  `sh.Run "cmd.exe /c " & target\n`+
  `other.Run "${source}"\n`,context);
 assert.equal(x.callCount,2);
 assert.equal(x.unresolvedCount,2);
 assert.equal(x.entirelyDeterministic,false);
});
test('exact absolute Node and Core entrypoint is recognized, lookalikes are not',()=>{
 const entry=String.raw`E:\ZGmini\projects\zgmini-earnings-history-pc-release\scripts\pc-writer\local-cycle.mjs`;
 const good=traceVbsDataflow('Set sh = WScript.CreateObject("WScript.Shell")\n'+
  `sh.Run "E:\\ZGmini\\runtime\\node.exe ${entry} --publish"`,context);
 assert.equal(good.calls[0].coreNodeEntrypointDirect,true);
 const bad=traceVbsDataflow('Set sh = CreateObject("WScript.Shell")\n'+
  `sh.Run "cmd.exe /c E:\\ZGmini\\runtime\\node.exe ${entry} --publish"`,context);
 assert.equal(bad.calls[0].coreNodeEntrypointDirect,false);
 assert.equal(bad.calls[0].shellCmdAmbiguous,true);
});
test('ShellExecute, With and indirect Call force diagnostic uncertainty',()=>{
 const x=traceVbsDataflow('Set sh = CreateObject("WScript.Shell")\n'+
  'With sh\n.Run "direct.exe"\nEnd With\n'+
  'Call UnknownFunction\napp.ShellExecute "other.exe"',context);
 assert.equal(x.indirectExecutionSeen,true);
 assert.equal(x.entirelyDeterministic,false);
});
test('inline CreateObject.Run and Win32_Process.Create are never quietly ignored',()=>{
 const x=traceVbsDataflow('Set sh = CreateObject("WScript.Shell")\n'+
  'sh.Run "E:\\known.exe"\n'+
  'WScript.CreateObject("WScript.Shell").Run "E:\\unknown.exe"\n'+
  'Win32_Process.Create "E:\\other.exe"',context);
 assert.equal(x.indirectExecutionSeen,true);
 assert.equal(x.entirelyDeterministic,false);
});

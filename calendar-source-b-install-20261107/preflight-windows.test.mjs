import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {parseCoreTaskAction,summarizeVbsCalls,issueAuth} from './preflight-windows.mjs';
const xml=(command,args)=>`<?xml version="1.0"?><Task><Actions><Exec>
<Command>${command}</Command><Arguments>${args}</Arguments>
<WorkingDirectory>E:\\ZGmini\\projects\\zgmini-earnings-history-pc-release</WorkingDirectory>
</Exec></Actions></Task>`;
const node=String.raw`E:\ZGmini\runtime\node.exe`;
const script=String.raw`E:\ZGmini\projects\zgmini-earnings-history-pc-release\scripts\pc-writer\local-cycle.mjs`;
const fake={realpath:path=>path};
test('owner-only one-shot issue auth needs exact title and four fields, no new label',()=>{
 const env={GITHUB_REPOSITORY:'ansqhd5774-Choi/zgmini-pc-control',
  GITHUB_ACTOR:'ansqhd5774-Choi',GITHUB_EVENT_NAME:'issues',
  GITHUB_EVENT_ACTION:'opened',GITHUB_RUN_ATTEMPT:'1'};
 const body={schema:'ZGMINI_CALENDAR_SOURCE_PREFLIGHT_V1',
  requestId:'pc-calendar-11111111-1111-4111-8111-111111111111',
  chatId:'chat-22222222-2222-4222-8222-222222222222',
  sourceSha:'ce9bccd8b38939b204e8f836a50ae362960eb7af'};
 const event={action:'opened',repository:{private:true,full_name:env.GITHUB_REPOSITORY},
  sender:{login:env.GITHUB_ACTOR},issue:{number:558,
   user:{login:env.GITHUB_ACTOR},title:'pc-calendar-source-preflight-once',
   body:JSON.stringify(body),labels:[]}};
 assert.equal(issueAuth({env,event}).issue,558);
 assert.throws(()=>issueAuth({env:{...env,GITHUB_ACTOR:'intruder'},event}),
  /CAL_B_PREFLIGHT_EVENT_STOP/);
 assert.throws(()=>issueAuth({env,event:{...event,sender:{login:'intruder'}}}),
  /CAL_B_PREFLIGHT_ISSUE_STOP/);
 assert.throws(()=>issueAuth({env,event:{...event,issue:{...event.issue,title:'other'}}}),
  /CAL_B_PREFLIGHT_ISSUE_STOP/);
 assert.throws(()=>issueAuth({env,event:{...event,issue:{...event.issue,
  body:JSON.stringify({...body,schema:'OTHER'})}}}),
  /CAL_B_PREFLIGHT_REQUEST_STOP/);
 assert.throws(()=>issueAuth({env,event:{...event,issue:{...event.issue,
  body:JSON.stringify({...body,extra:'x'})}}}),
  /CAL_B_PREFLIGHT_REQUEST_STOP/);
});
test('verifies exact active Core node+script, no mutation',()=>{
 assert.equal(parseCoreTaskAction(xml(node,`"${script}" --publish`),fake)
  .relativeEntrypoint,'scripts/pc-writer/local-cycle.mjs');
});
test('other Core source root, bare wrapper and Korea lane fail closed',()=>{
 const wrong=String.raw`E:\Other\projects\zgmini\scripts\pc-writer\local-cycle.mjs`;
 assert.throws(()=>parseCoreTaskAction(xml(node,`"${wrong}" --publish`),fake),
  /CAL_B_TASK_ROOT_NOT_ACTIVE_SOURCE_STOP/);
 assert.throws(()=>parseCoreTaskAction(xml('cmd.exe',`"${script}" --publish`),fake),
  /CAL_B_TASK_NODE_COMMAND_STOP/);
 assert.throws(()=>parseCoreTaskAction(xml(node,`"${script}" --korea`),fake),
  /CAL_B_TASK_ENTRYPOINT_UNRESOLVED_STOP/);
});
test('ambiguous multiple Exec actions are rejected',()=>{
 const doc=xml(node,`"${script}" --publish`).replace(
  '</Actions>','<Exec><Command>cmd.exe</Command></Exec></Actions>');
 assert.throws(()=>parseCoreTaskAction(doc,fake),/CAL_B_TASK_EXEC_COUNT_STOP/);
});
test('known wscript + two VBS launchers identify a candidate but never greenlight B',()=>{
 const a=String.raw`E:\ZGmini\data\pc-writer\archive-sidecar-r7\run-original-then-archive.vbs`;
 const b=String.raw`E:\ZGmini\data\pc-writer\cutover-evidence\inflation-r37-2026-10-20T19-39-19-549Z\run-local-core.vbs`;
 const one=Buffer.from(`Set shell = CreateObject("WScript.Shell")\nShell.Run "${b}"\n`);
 const two=Buffer.from(`Set shell = CreateObject("WScript.Shell")\nShell.Run "${script} --publish"\n`);
 const hash=x=>createHash('sha256').update(x).digest('hex');
 const knownLaunchers=[{path:a,sha:hash(one)},{path:b,sha:hash(two)}];
 const items=new Map([[a,one],[b,two]]);
 const injected={realpath:p=>p,knownLaunchers,
  statFile:p=>({isFile:()=>true,isSymbolicLink:()=>false,size:items.get(p).length}),
  readFile:p=>items.get(p)};
 const wrapper=xml('wscript.exe',`"${a}"`);
 assert.throws(()=>parseCoreTaskAction(wrapper,injected),e=>{
  assert.equal(e.code,'CAL_B_TASK_WRAPPER_STATIC_CANDIDATE_STOP');
  assert.equal(e.diagnostic.firstLauncherShaVerified,true);
  assert.equal(e.diagnostic.secondLauncherShaVerified,true);
  assert.equal(e.diagnostic.containsSourceRoot,true);
  assert.equal(e.diagnostic.containsLocalCycle,true);
  return true;
 });
 const corrupted={...injected,readFile:p=>p===a?Buffer.from('tampered'):items.get(p)};
 assert.throws(()=>parseCoreTaskAction(wrapper,corrupted),
  /CAL_B_TASK_WRAPPER_SHA_STOP/);
 const dynamicOnly={...injected,readFile:p=>p===b?Buffer.from('run-local.cmd'):items.get(p),
  knownLaunchers:[knownLaunchers[0],
   {path:b,sha:hash(Buffer.from('run-local.cmd'))}]};
 assert.throws(()=>parseCoreTaskAction(wrapper,dynamicOnly),e=>{
  assert.equal(e.code,'CAL_B_TASK_WRAPPER_STATIC_CANDIDATE_STOP');
  assert.equal(e.diagnostic.containsLocalCycle,false);
  assert.equal(e.diagnostic.containsRunLocalCmd,true);
  return true;
 });
});
test('comments or dead branches containing expected strings never prove runtime',()=>{
 const a=String.raw`E:\ZGmini\data\pc-writer\archive-sidecar-r7\run-original-then-archive.vbs`;
 const b=String.raw`E:\ZGmini\data\pc-writer\cutover-evidence\inflation-r37-2026-10-20T19-39-19-549Z\run-local-core.vbs`;
 const first=Buffer.from(`Set shell = CreateObject("WScript.Shell")\nShell.Run "C:\\other.vbs"\n' run-local-core.vbs\n`);
 const second=Buffer.from(`Set shell = CreateObject("WScript.Shell")\nShell.Run "C:\\unrelated.mjs"\n' ${script}\n`);
 const hash=x=>createHash('sha256').update(x).digest('hex');
 const files=new Map([[a,first],[b,second]]);
 const options={realpath:p=>p,knownLaunchers:[{path:a,sha:hash(first)},{path:b,sha:hash(second)}],
  statFile:p=>({isFile:()=>true,isSymbolicLink:()=>false,size:files.get(p).length}),
  readFile:p=>files.get(p)};
 assert.throws(()=>parseCoreTaskAction(xml('wscript.exe',`"${a}"`),options),e=>{
  assert.equal(e.code,'CAL_B_TASK_WRAPPER_STATIC_CANDIDATE_STOP');
  assert.equal(e.diagnostic.containsSecondLauncher,true);
  assert.equal(e.diagnostic.containsSourceRoot,true);
  return true;
 });
});
test('read-only VBS call graph distinguishes literal, dynamic and comment-only sites',()=>{
 const source=String.raw`Rem Shell.Run "local-cycle.mjs"
Set sh = CreateObject("WScript.Shell")
sh.Run "E:\ZGmini\data\pc-writer\cutover-evidence\run-local-core.vbs"
sh.Exec runner & " local-cycle.mjs"
' sh.Run "run-local.cmd"
If userChoice Then
  sh.Run targetCommand
End If`;
 const x=summarizeVbsCalls(source);
 assert.equal(x.callCount,3);
 assert.deepEqual(x.callSites.map(c=>c.argumentForm),
  ['literal','concatenated','variable']);
 assert.deepEqual(x.callSites.map(c=>c.api),['run','exec','run']);
 assert.equal(x.anyConditionalSyntax,true);
 assert.equal(x.callSites[0].mentionsSecondLauncher,true);
 assert.equal(x.callSites[1].mentionsCoreScript,true);
 assert.equal(x.callSites.some(c=>c.mentionsRunLocalCmd),false);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeR17Probe,assessR17Evidence,assessR17TaskChain,diagnoseR17TaskChain,classifyR17PatchFailure,diagnoseR17PatchContexts,decodeR17Launcher,R17_VBS_CHAIN,R17_APPROVED,R17_BASE_FILES,R17_MISSING,R17_PATCH_SHA,isTrackedSourceDirty} from '../controller/us-breadth-r17-preflight.mjs';

const valid=()=>({
 head:R17_APPROVED,dirty:false,hashes:{...R17_BASE_FILES},
 present:Object.fromEntries(R17_MISSING.map(f=>[f,false])),
 patchHash:R17_PATCH_SHA,patchApplies:true,quotaContract:true,taskLinked:true,
});
test('Git porcelain clean and dirty statuses keep fail-closed semantics',()=>{
 assert.equal(isTrackedSourceDirty(''),false);
 assert.equal(isTrackedSourceDirty('   '),false);
 assert.equal(isTrackedSourceDirty(' M scripts/pc-writer/local-cycle.mjs'),true);
 assert.equal(isTrackedSourceDirty(null),null);
 assert.equal(assessR17Evidence({...valid(),dirty:isTrackedSourceDirty('')}).status,'PASS');
 assert.ok(assessR17Evidence({...valid(),dirty:isTrackedSourceDirty(' M tracked')}).reasons.includes('OPERATING_SOURCE_DIRTY_OR_UNVERIFIED'));
 assert.ok(assessR17Evidence({...valid(),dirty:isTrackedSourceDirty(null)}).reasons.includes('OPERATING_SOURCE_DIRTY_OR_UNVERIFIED'));
});
test('patch failure diagnostics are bounded codes and never return stderr',()=>{
 const error={stderr:Buffer.from('error: patch failed: scripts/pc-writer/local-cycle.mjs:23\nerror: patch does not apply\nTOKEN=NEVER_RETURN')};
 assert.equal(classifyR17PatchFailure(error),'PATCH_CONTEXT_MISMATCH');
 assert.equal(classifyR17PatchFailure({stderr:Buffer.from('error: corrupt patch at line 8')}),'PATCH_FORMAT_INVALID');
 assert.equal(classifyR17PatchFailure({code:'ETIMEDOUT'}),'PATCH_CHECK_TIMEOUT');
 const report=summarizeR17Probe({...valid(),patchApplies:false,patchFailureCode:classifyR17PatchFailure(error)});
 assert.equal(report.status,'BLOCKED');
 assert.equal(report.diagnostics.patchCheck,'PATCH_CONTEXT_MISMATCH');
 assert.equal(JSON.stringify(report).includes('TOKEN=NEVER_RETURN'),false);
});
test('patch diagnosis returns only five-hunk positions and match booleans, even with CRLF',()=>{
 const patch='diff --git a/scripts/pc-writer/local-cycle.mjs b/scripts/pc-writer/local-cycle.mjs\n'
  +'--- a/scripts/pc-writer/local-cycle.mjs\n+++ b/scripts/pc-writer/local-cycle.mjs\n'
  +'@@ -2,2 +2,3 @@\n two\n-three\n+added\n';
 const good=diagnoseR17PatchContexts(patch,{'scripts/pc-writer/local-cycle.mjs':'one\r\ntwo\r\nthree\r\n'});
 assert.deepEqual(good,[{file:'cycle',hunk:'2',oldContextMatches:true}]);
 const bad=diagnoseR17PatchContexts(patch,{'scripts/pc-writer/local-cycle.mjs':'SECRET\ntwo\nother\n'});
 assert.deepEqual(bad,[{file:'cycle',hunk:'2',oldContextMatches:false}]);
 assert.equal(JSON.stringify(bad).includes('SECRET'),false);
});
test('VBS decoder accepts BOM UTF-16LE and UTF-16BE without altering bytes',()=>{
 const script='shell.Run "local-cycle.mjs", 0, True';
 const le=Buffer.concat([Buffer.from([0xff,0xfe]),Buffer.from(script,'utf16le')]);
 const be=Buffer.concat([Buffer.from([0xfe,0xff]),Buffer.from(script,'utf16le').swap16()]);
 assert.equal(decodeR17Launcher(le),script);
 assert.equal(decodeR17Launcher(be),script);
 assert.equal(decodeR17Launcher(Buffer.from(script,'utf8')),script);
 assert.equal(decodeR17Launcher(Buffer.concat([Buffer.from([0xef,0xbb,0xbf]),Buffer.from(script)])),script);
 assert.deepEqual(Array.from(le.subarray(0,2)),[0xff,0xfe]);
});
test('Task-chain diagnostics expose only fixed booleans without changing admission',()=>{
 const action={command:'C:\\Windows\\System32\\wscript.exe',arguments:'E:\\ZGmini\\data\\pc-writer\\archive-sidecar-r7\\run-original-then-archive.vbs'};
 const launchers=[{sha256:R17_VBS_CHAIN[0].sha256,text:'run-local-core.vbs'},
  {sha256:R17_VBS_CHAIN[1].sha256,text:'local-cycle.mjs'}];
 const checks=diagnoseR17TaskChain({action,launchers});
 assert.deepEqual(Object.values(checks),Array(6).fill(true));
 assert.equal(assessR17TaskChain({action,launchers}),true);
 const bad=diagnoseR17TaskChain({action:{...action,command:'cmd.exe'},launchers});
 assert.equal(bad.commandWscript,false);
 assert.equal(assessR17TaskChain({action:{...action,command:'cmd.exe'},launchers}),false);
});
test('R17 exact contract is only static preflight, never install approval',()=>{
 const r=assessR17Evidence(valid());
 assert.equal(r.status,'PASS');
 assert.equal(r.canInstall,false);
 assert.equal(r.runtimeSourceVerified,false);
 assert.equal(r.providerCalls,0);assert.equal(r.sqliteWrites,0);assert.equal(r.d1Writes,0);
 assert.equal(r.checkedExistingFiles,3);assert.equal(r.checkedNewFiles,3);
});
test('mismatched PC approved SHA and tracked dirty block independently',()=>{
 const e=valid();e.head='f'.repeat(40);e.dirty=true;
 const r=assessR17Evidence(e);
 assert.equal(r.status,'BLOCKED');
 assert.ok(r.reasons.includes('OPERATING_SOURCE_SHA_MISMATCH'));
 assert.ok(r.reasons.includes('OPERATING_SOURCE_DIRTY_OR_UNVERIFIED'));
});
test('each existing PC file must match independently pinned runtime SHA',()=>{
 for(const path of Object.keys(R17_BASE_FILES)){
  const e=valid();e.hashes[path]='0'.repeat(64);
  assert.ok(assessR17Evidence(e).reasons.includes('BASE_FILE_SHA_MISMATCH:'+path));
 }
});
test('new sidecars cannot be overwritten or silently assumed absent',()=>{
 for(const path of R17_MISSING){
  const e=valid();e.present[path]=true;
  assert.ok(assessR17Evidence(e).reasons.includes('NEW_FILE_ALREADY_PRESENT_OR_UNKNOWN:'+path));
 }
 const missing=valid();delete missing.present[R17_MISSING[0]];
 assert.equal(assessR17Evidence(missing).status,'BLOCKED');
});
test('PR patch check failure and different patch bytes are separate blockers',()=>{
 const e=valid();e.patchApplies=false;e.patchHash='a'.repeat(64);
 const r=assessR17Evidence(e);
 assert.ok(r.reasons.includes('PR957_PATCH_HASH_UNVERIFIED'));
 assert.ok(r.reasons.includes('PR957_CONTEXT_CONFLICT_OR_UNVERIFIED'));
 assert.equal(r.canInstall,false);
});
test('static quota match cannot substitute for proof of Core launcher execution',()=>{
 const e=valid();e.quotaContract=false;e.taskLinked=false;
 const r=assessR17Evidence(e);
 assert.ok(r.reasons.includes('LOCAL_ALPACA_GUARD_UNVERIFIED'));
 assert.ok(r.reasons.includes('CORE_TASK_SOURCE_LINK_UNVERIFIED'));
 assert.equal(r.runtimeSourceVerified,false);
});
test('absent evidence is blocked without leaking source or secrets',()=>{
 const e=assessR17Evidence(null);
 assert.equal(e.status,'BLOCKED');assert.equal(e.canInstall,false);
 assert.equal(JSON.stringify(e).includes('APCA_API_SECRET_KEY'),false);
 assert.equal(JSON.stringify(e).includes('providers.env'),false);
});

test('actual Core XML WScript to fixed VBS chain is accepted as static evidence only',()=>{
 const args='"E:\\ZGmini\\data\\pc-writer\\archive-sidecar-r7\\run-original-then-archive.vbs"';
 const action={command:'C:\\Windows\\System32\\wscript.exe',arguments:args};
 const launchers=[
  {sha256:R17_VBS_CHAIN[0].sha256,text:'shell.Run "run-local-core.vbs", 0, True'},
  {sha256:R17_VBS_CHAIN[1].sha256,text:'node.exe "E:\\ZGmini\\projects\\zgmini-earnings-history-pc-release\\scripts\\pc-writer\\local-cycle.mjs"'},
 ];
 assert.equal(assessR17TaskChain({action,launchers}),true);
 // Still not runtime proof or B authorization.
 const evidence=valid();evidence.taskLinked=assessR17TaskChain({action,launchers});
 assert.equal(assessR17Evidence(evidence).runtimeSourceVerified,false);
 assert.equal(assessR17Evidence(evidence).canInstall,false);
});
test('static WScript chain rejects swapped VBS bytes, unrelated task and missing second hop',()=>{
 const action={command:'C:\\Windows\\System32\\wscript.exe',
  arguments:'"E:\\ZGmini\\data\\pc-writer\\archive-sidecar-r7\\run-original-then-archive.vbs"'};
 const clean=[
  {sha256:R17_VBS_CHAIN[0].sha256,text:'run-local-core.vbs'},
  {sha256:R17_VBS_CHAIN[1].sha256,text:'local-cycle.mjs'},
 ];
 assert.equal(assessR17TaskChain({action,launchers:clean}),true);
 assert.equal(assessR17TaskChain({action:{...action,command:'cmd.exe'},launchers:clean}),false);
 assert.equal(assessR17TaskChain({action:{...action,arguments:'"C:\\fake\\other.vbs"'},launchers:clean}),false);
 assert.equal(assessR17TaskChain({action,launchers:[{...clean[0],sha256:'0'.repeat(64)},clean[1]]}),false);
 assert.equal(assessR17TaskChain({action,launchers:[clean[0],{...clean[1],text:'archive-core.mjs'}]}),false);
});

test('a prematurely interrupted read-only preflight reports only its real stopped step',()=>{
 const e=valid();e.stoppedAt='GIT_STATUS';
 e.dirty=null;e.patchApplies=false;e.quotaContract=false;e.taskLinked=false;
 const result=summarizeR17Probe(e);
 assert.equal(result.status,'BLOCKED');
 assert.equal(result.code,'R17_PREFLIGHT_INTERRUPTED');
 assert.deepEqual(result.reasons,['R17_PREFLIGHT_INTERRUPTED:GIT_STATUS']);
 assert.equal(result.stoppedAt,'GIT_STATUS');
 assert.equal(result.canInstall,false);
});
test('confirmed independent patch or quota failures remain strict blockers',()=>{
 const e=valid();e.patchApplies=false;e.quotaContract=false;
 const result=summarizeR17Probe(e);
 assert.equal(result.status,'BLOCKED');
 assert.ok(result.reasons.includes('PR957_CONTEXT_CONFLICT_OR_UNVERIFIED'));
 assert.ok(result.reasons.includes('LOCAL_ALPACA_GUARD_UNVERIFIED'));
 assert.equal(result.canInstall,false);
});

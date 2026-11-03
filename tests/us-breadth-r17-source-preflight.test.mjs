import test from 'node:test';
import assert from 'node:assert/strict';
import {assessR17Evidence,assessR17TaskChain,R17_VBS_CHAIN,R17_APPROVED,R17_BASE_FILES,R17_MISSING,R17_PATCH_SHA} from '../tools/us-breadth-r17-source-preflight.mjs';

const valid=()=>({
 head:R17_APPROVED,dirty:false,hashes:{...R17_BASE_FILES},
 present:Object.fromEntries(R17_MISSING.map(f=>[f,false])),
 patchHash:R17_PATCH_SHA,patchApplies:true,quotaContract:true,taskLinked:true,
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

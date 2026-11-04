import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeR17Probe,assessR17Evidence,assessR17TaskChain,diagnoseR17TaskChain,classifyR17PatchFailure,diagnoseR17PatchContexts,diagnoseR17RestrictedContexts,diagnoseR17SingleDispatcher,verifiedR17Source,decodeR17Launcher,R17_VBS_CHAIN,R17_APPROVED,R17_BASE_FILES,R17_MISSING,R17_PATCH_SHA,R17_PATCH_TEXT,isTrackedSourceDirty} from '../controller/us-breadth-r17-preflight.mjs';

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
const contextFixture=()=>({
 'scripts/pc-writer/local-cycle.mjs':[
  ...Array.from({length:179},(_,i)=>`// fixture cycle ${i}`),
  'const prior=1;',
  " const report={at:new Date().toISOString(),lane,collectionExit:collection.status,extra:'SAFE'};",
  ' save(report);',
 ].join('\r\n'),
 'scripts/pc-writer/run-local.mjs':[
  ...Array.from({length:68},(_,i)=>`// fixture publication head ${i}`),
  ' await attemptOutput(report,\'us-breadth\',async()=>{',
  '  report.usBreadth=await prepareUsBreadth(core,{now:new Date(now)});',
  ' });',
  ' const marketReady=true;',
  ...Array.from({length:148},(_,i)=>`// fixture publication middle ${i}`),
  ' if(report.usBreadth?.prepared)await attemptOutput(report,\'us-breadth-publication\',async()=>{',
  '   report.usBreadth.publication=await publishUsBreadth(remote,config.core,report.usBreadth,{now});',
  ' });',
  ' else report.usBreadth={publication:\'SKIPPED_NOT_READY\'};',
 ].join('\r\n'),
});
test('three fixed contexts emit only verified bounded non-sensitive excerpts',()=>{
 const src=contextFixture();
 assert.equal(verifiedR17Source(valid()),true);
 const got=diagnoseR17RestrictedContexts(src,valid());
 assert.equal(got.status,'THREE_EXCERPTS_READONLY');
 assert.deepEqual(got.excerpts.map(x=>[x.file,x.hunk,x.lineCount]),
  [['cycle','185',3],['publication','72',4],['publication','228',4]]);
 assert.ok(got.excerpts.every(x=>!x.text.includes('\r')));
 assert.ok(JSON.stringify(got).length<=2500);
 assert.equal(got.excerpts.some(x=>x.text.includes('safe')),false);
});
test('restricted contexts fail closed on unapproved head/hash, secrets, ambiguity and oversize',()=>{
 const src=contextFixture();
 const wrong={...valid(),head:'0'.repeat(40)};
 assert.deepEqual(diagnoseR17RestrictedContexts(src,wrong),{status:'SOURCE_UNVERIFIED',excerpts:[]});
 const modified={...valid(),hashes:{...R17_BASE_FILES}};
 modified.hashes['scripts/pc-writer/run-local.mjs']='f'.repeat(64);
 assert.deepEqual(diagnoseR17RestrictedContexts(src,modified),{status:'SOURCE_UNVERIFIED',excerpts:[]});
 const exposed={...src,'scripts/pc-writer/run-local.mjs':src['scripts/pc-writer/run-local.mjs'].replace('const marketReady=true;',"const password='NEVER_EMIT_THIS';")};
 const withheld=diagnoseR17RestrictedContexts(exposed,valid());
 assert.equal(withheld.status,'SENSITIVE_CONTEXT_SUPPRESSED');
 assert.equal(JSON.stringify(withheld).includes('NEVER_EMIT_THIS'),false);
 const dup={...src,'scripts/pc-writer/local-cycle.mjs':src['scripts/pc-writer/local-cycle.mjs']+"\n const report={at:new Date().toISOString(),lane,collectionExit:other};"};
 assert.deepEqual(diagnoseR17RestrictedContexts(dup,valid()),
  {status:'CONTEXT_LOCATION_UNVERIFIED',failedHunk:'185',excerpts:[]});
 const long={...src,'scripts/pc-writer/local-cycle.mjs':src['scripts/pc-writer/local-cycle.mjs'].replace('extra:', 'x'.repeat(900)+'extra:')};
 assert.equal(diagnoseR17RestrictedContexts(long,valid()).status,'CONTEXT_TOO_LONG');
});
test('fuzzy relative alignment retains bounded context when patch old lines are modified/deleted',()=>{
 const cycle='scripts/pc-writer/local-cycle.mjs',publication='scripts/pc-writer/run-local.mjs';
 const rows={[cycle]:Array(360).fill('// fixture padding'),
  [publication]:Array(360).fill('// fixture padding')};
 const fill=(file,hunk,change)=>{
  const section=R17_PATCH_TEXT.split(/(?=^diff --git )/m)
   .find(x=>x.startsWith(`diff --git a/${file} `));
  const part=section.split(/(?=^@@ )/m).slice(1)
   .find(x=>x.startsWith(`@@ -${hunk},`));
  const start=Number(part.match(/^@@ -(\d+)/)[1])-1;
  const old=part.split('\n').slice(1)
   .filter(x=>x.startsWith(' ')||x.startsWith('-')).map(x=>x.slice(1));
  const row=old.findIndex(x=>change.test(x));
  assert.ok(row>=0);
  old[row]=old[row].replace(change,'NEW_APPROVED_VALUE');
  rows[file].splice(start,old.length,...old);
 };
 fill(cycle,185,/const report=/);
 fill(publication,72,/report\.usBreadth=await prepareUsBreadth/);
 fill(publication,228,/report\.usBreadth\.publication=await publishUsBreadth/);
 const asSource=()=>Object.fromEntries(Object.entries(rows).map(([k,v])=>[k,v.join('\n')]));
 const changed=diagnoseR17RestrictedContexts(asSource(),valid());
 assert.equal(changed.status,'THREE_EXCERPTS_READONLY');
 assert.deepEqual(changed.excerpts.map(x=>x.method),Array(3).fill('FUZZY_RELATIVE_LINES'));
 assert.ok(changed.excerpts.every(x=>x.matchedLines>=2&&x.lineCount>=3&&x.lineCount<=6));
 // Delete a line inside the second hunk: its subsequent context shifts by one.
 rows[publication].splice(72,1);
 const deleted=diagnoseR17RestrictedContexts(asSource(),valid());
 assert.equal(deleted.status,'THREE_EXCERPTS_READONLY');
 assert.ok(deleted.excerpts.every(x=>x.matchedLines>=2));
 assert.ok(JSON.stringify(deleted).length<=2500);
});
test('dispatcher diagnosis returns one allowlisted static name and hash, never Task/VBS text',()=>{
 const action={command:'C:\\Windows\\System32\\wscript.exe',
  arguments:'"E:\\ZGmini\\data\\pc-writer\\archive-sidecar-r7\\run-original-then-archive.vbs"'};
 const launchers=[
  {sha256:R17_VBS_CHAIN[0].sha256,text:'shell.Run "run-local-core.vbs"'},
  {sha256:R17_VBS_CHAIN[1].sha256,text:'shell.Run "node.exe quota-runner.mjs", 0, True'},
 ];
 const got=diagnoseR17SingleDispatcher({action,launchers,evidence:valid(),readAllowed:(scope,name)=>{
  assert.equal(scope,'source');assert.equal(name,'scripts/pc-writer/quota-runner.mjs');
  return Buffer.from('node.exe local-cycle.mjs');
 }});
 assert.equal(got.status,'DISPATCH_STATIC_UNVERIFIED');
 assert.equal(got.singleHop.name,'quota-runner.mjs');
 assert.equal(got.singleHop.referencesLocalCycle,true);
 assert.equal(got.singleHop.pinnedHashMatches,false);
 assert.equal(/E:\\ZGmini|shell\.Run|password/i.test(JSON.stringify(got)),false);
 assert.equal(assessR17TaskChain({action,launchers}),false);
 assert.deepEqual(diagnoseR17SingleDispatcher({action,launchers,evidence:{...valid(),dirty:true},readAllowed:()=>Buffer.from('x')}),
  {status:'DISPATCH_UNVERIFIED',singleHop:null});
 const ambiguous=[launchers[0],{...launchers[1],text:'shell.Run "node.exe quota-runner.mjs run-local.mjs"'}];
 assert.equal(diagnoseR17SingleDispatcher({action,launchers:ambiguous,evidence:valid(),readAllowed:()=>Buffer.from('x')}).status,
  'DISPATCH_TARGET_NOT_UNIQUE');
 const commentOnly=[launchers[0],{...launchers[1],text:"' node.exe quota-runner.mjs"}];
 assert.equal(diagnoseR17SingleDispatcher({action,launchers:commentOnly,evidence:valid(),readAllowed:()=>Buffer.from('x')}).singleHop,null);
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

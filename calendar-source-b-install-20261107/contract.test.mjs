import test from 'node:test';
import assert from 'node:assert/strict';
import {BASE,PUBLIC,SOURCE_ROOT,CONFIG,CORE_TASK,TARGET_BLOBS,
 INSTALLED_HOTFIX_PATH,INSTALLED_HOTFIX_SHA256,validatePreflight,
 validatePrepared,validateAfter} from './contract.mjs';
const x40='a'.repeat(40),x64='b'.repeat(64);
const fixture=()=>({
 sourceRoot:SOURCE_ROOT,configPath:CONFIG,coreTask:CORE_TASK,
 activeCoreSourceVerified:true,resolvedTaskSourceRoot:SOURCE_ROOT,
 resolvedTaskEntry:'scripts/pc-writer/local-cycle.mjs',
 taskDefinitionVerified:true,head:BASE,configSource:BASE,
 originalBranch:'main',publicHead:PUBLIC,
 publicHotfixBlob:TARGET_BLOBS[INSTALLED_HOTFIX_PATH],
 taskEnabled:true,taskStateKnown:true,trackedDirty:[{
  path:INSTALLED_HOTFIX_PATH,sha256:INSTALLED_HOTFIX_SHA256,
  targetBlob:TARGET_BLOBS[INSTALLED_HOTFIX_PATH]}],
 untracked:[],indexDirty:[],configRawSha256:x64,taskXmlSha256:x64,
 baseTreeSha:x40,providerCalls:0,sqliteOpened:false,d1Writes:0,
});
const prepared=()=>({
 parent:BASE,sha:x40,cleanCommit:true,
 diff:[{path:INSTALLED_HOTFIX_PATH,status:'M'}],
 targetBlobs:{...TARGET_BLOBS},commitTreeRechecked:true,scratchOnly:true,
});
test('the exact already installed #511 hotfix may be committed, never lost',()=>{
 const pre=validatePreflight(fixture()),commit=validatePrepared(prepared(),pre);
 assert.equal(commit.approvedChangeCount,1);
 assert.deepEqual(validateAfter({
  head:x40,configSource:x40,taskEnabled:true,taskDefinitionVerified:true,
  gitDiffRelevantClean:true,otherDirtyBytesPreserved:true,targetBlobsVerified:true,
  protectedStateVerified:true,
 },commit),{status:'CAL_B_SOURCE_INSTALLED_VERIFIED',sourceSha:x40});
});
test('an already clean checkout may be upgraded without inventing a dirty file',()=>{
 const a=fixture();a.trackedDirty=[];assert.equal(validatePreflight(a).paths,10);
});
test('never infer the live Core root from a historic checkout alone',()=>{
 const a=fixture();a.activeCoreSourceVerified=false;
 assert.throws(()=>validatePreflight(a),/CAL_B_ACTIVE_TASK_SOURCE_UNRESOLVED_STOP/);
});
test('only relevant dirty or staged index blocks; unrelated untracked files do not',()=>{
 const a=fixture();a.trackedDirty.push({path:'worker/unrelated.mjs'});
 assert.throws(()=>validatePreflight(a),/CAL_B_DIRTY_OVERLAY_SCOPE_STOP/);
 const b=fixture();b.indexDirty.push({path:'docs/user-plan.md'});
 assert.throws(()=>validatePreflight(b),/CAL_B_STAGED_INDEX_STOP/);
 const c=fixture();c.untracked.push('docs/private-note.txt');
 assert.equal(validatePreflight(c).paths,10);
});
test('a different one-file hotfix digest or public blob stops',()=>{
 const a=fixture();a.trackedDirty[0].sha256=x64;
 assert.throws(()=>validatePreflight(a),/CAL_B_DIRTY_OVERLAY_SCOPE_STOP/);
 const b=fixture();b.publicHotfixBlob=x40;
 assert.throws(()=>validatePreflight(b),/CAL_B_PUBLIC_PIN_STOP/);
});
test('source/manifest mismatch is not healed by modifying the guard',()=>{
 const a=fixture();a.configSource=PUBLIC;
 assert.throws(()=>validatePreflight(a),/CAL_B_BASE_LINEAGE_STOP/);
 const b=fixture();b.providerCalls=1;
 assert.throws(()=>validatePreflight(b),/CAL_B_SOURCE_ONLY_SCOPE_STOP/);
});
test('isolated commit cannot include a file outside the ten approved paths',()=>{
 const pre=validatePreflight(fixture()),c=prepared();
 c.diff.push({path:'worker/unrelated.mjs',status:'M'});
 assert.throws(()=>validatePrepared(c,pre),/CAL_B_PREPARE_UNAPPROVED_DIFF_STOP/);
});
test('unknown target or incomplete exact readback fails closed',()=>{
 const pre=validatePreflight(fixture()),c=prepared();
 c.targetBlobs['lib/tic-calendar.mjs']=x40;
 assert.throws(()=>validatePrepared(c,pre),/CAL_B_PREPARE_TARGET_MISMATCH_STOP/);
 assert.throws(()=>validateAfter({head:x40,configSource:BASE},prepared()),
  /CAL_B_FINAL_READBACK_STOP/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {classifyW06PublicBEffect,matchesExactW06OwnerEffectComment,classifyW06BTerminalFailure,matchesReviewedW06SourceMerge,REVIEWED_SOURCE_FILES,verifyW06ReviewedImportClosure,verifyW06InstalledAncestryAttestation} from './public-v3-independent-owner-b-once.mjs';

const fixture=()=>({
 approvedMergePinned:true,ownerApprovalVerified:true,
 trustedMainSource:true,candidateBytesVerified:true,
 independentWindowsOwner:true,liveCasValidated:true,
 manifest:{
  schema:'ZGMINI_CNN_SIDECAR_ONEFILE_B_V3',status:'APPROVED_B',
  target:'E:\\ZGmini\\data\\pc-writer\\archive-sidecar-r7\\archive-run.mjs',
  beforeSha256:'eb3c43bf8fba6ea4e51f3e84b77f9ec13000db9d9e38077ffd914950d7080b6b',
  afterSha256:'894411dea16462c4ee305f7ec80102d81662063f5f76c8a8384f04977e860ac3',
  approvedContentSha256:'894411dea16462c4ee305f7ec80102d81662063f5f76c8a8384f04977e860ac3',
  approvedSourceSha:'42ab63b28e0c2617486a7b7dba550101960e5cf7',
  installedHead:'c8ed53a3991212dd1778742cda8a86ac133e0796',
  installedConfigSource:'c8ed53a3991212dd1778742cda8a86ac133e0796',
  taskDefinitionSha256:'dd81987c7efa4b1e343af30329a580613bb920dec89c1aa7a436ef935f0bb028',
  wrapperSha256:'9d5bc3429cd74813207cfc393eb04eff11a78106096964b80bf7833440385b7c',
  runCount:1,allowProviderCalls:false,allowDbChanges:false,
  allowD1Writes:false,allowTaskChanges:false
 }
});
function ensureNoEffect(r) {
 assert.equal(r.effectAuthorized,false);
 assert.equal(r.operationalWrites,0);
 assert.equal(r.providerCalls,0);
 assert.equal(r.d1Writes,0);
}
test('W06 Public B operation is unreachable without separately pinned owner merge',()=>{
 const f=fixture();f.approvedMergePinned=false;
 const r=classifyW06PublicBEffect(f);
 assert.equal(r.code,'W06_PUBLIC_B_EFFECT_NOT_APPROVED');
 ensureNoEffect(r);
 const s=fs.readFileSync(new URL('./public-v3-independent-owner-b-once.mjs',import.meta.url),'utf8');
 assert.match(s,/const APPROVAL_PR=0;/);
 assert.match(s,/const APPROVAL_MERGE=null;/);
 assert.match(s,/W06_PUBLIC_B_EFFECT_APPROVAL_REQUIRED/);
});
test('source, owner, independent Windows identity, candidate and CAS are individually required',()=>{
 for(const key of ['ownerApprovalVerified','trustedMainSource','candidateBytesVerified',
  'independentWindowsOwner','liveCasValidated']){
  const f=fixture();f[key]=false;
  const r=classifyW06PublicBEffect(f);
  assert.notEqual(r.status,'READY',key);ensureNoEffect(r);
 }
});
test('approved effect exact immutable file, old and new SHA and task/wrapper pin required',()=>{
 for(const key of ['schema','status','target','beforeSha256','afterSha256',
  'approvedContentSha256','approvedSourceSha','installedHead',
  'installedConfigSource','taskDefinitionSha256','wrapperSha256','runCount']){
  const f=fixture();f.manifest[key]='untrusted';
  const r=classifyW06PublicBEffect(f);
  assert.equal(r.status,'BLOCKED',key);ensureNoEffect(r);
 }
});
test('scope rejects any added runtime effect without reusing V2 approval',()=>{
 for(const key of ['allowProviderCalls','allowDbChanges','allowD1Writes',
  'allowTaskChanges']){
  const f=fixture();f.manifest[key]=true;
  const r=classifyW06PublicBEffect(f);
  assert.equal(r.code,'W06_PUBLIC_B_EFFECT_SCOPE_MISMATCH',key);ensureNoEffect(r);
 }
});
test('future strictly approved evidence is still preflight only, not an execution',()=>{
 const r=classifyW06PublicBEffect(fixture());
 assert.equal(r.status,'READY');
 assert.equal(r.code,'W06_PUBLIC_B_EFFECT_PREFLIGHT_READY_ONLY');
 ensureNoEffect(r);
});
test('sidecar operation reuses existing exact CAS backup rollback adapter but not Private B admission',()=>{
 const s=fs.readFileSync(new URL('./public-v3-independent-owner-b-once.mjs',import.meta.url),'utf8');
 assert.match(s,/applyOneFile\(manifest,verifiedCandidate,trackedIO\)/);
 assert.match(s,/createOperatingSidecarProbe/);
 assert.match(s,/createWindowsSidecarIO/);
 assert.match(s,/awaitNaturalSidecarIdle/);
 assert.doesNotMatch(s,/receiveApprovedSidecarB|authorizeSidecarIssue|GITHUB_WORKSPACE|workflow_dispatch/);
});

test('owner PR merge never substitutes for a separate exact B effect consent',()=>{
 const body='ZGMINI_W06_V3_B_EFFECT_APPROVED_V1 manifestSha256='+'a'.repeat(64);
 const mergedAt='2026-11-28T04:00:00Z';
 const event={user:{id:327938088},body,created_at:'2026-11-28T04:01:00Z'};
 assert.equal(matchesExactW06OwnerEffectComment(event,body,mergedAt),true);
 for(const mutate of [
  v=>{v.user.id=1;},v=>{v.body+=' changed';},
  v=>{v.created_at='2026-11-28T03:59:00Z';},
  v=>{v.created_at='invalid';},v=>{delete v.user;}
 ]){
  const bad=structuredClone(event);mutate(bad);
  assert.equal(matchesExactW06OwnerEffectComment(bad,body,mergedAt),false);
 }
 const source=fs.readFileSync(new URL('./public-v3-independent-owner-b-once.mjs',import.meta.url),'utf8');
 assert.match(source,/W06_PUBLIC_B_EXPLICIT_OWNER_EFFECT_CONSENT_STOP/);
});

test('preflight module cannot be evaluated before its authenticated source CAS',()=>{
 const source=fs.readFileSync(new URL('./public-v3-independent-owner-b-once.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(source,/^import\s+.*from\s+['"]\.\/public-v3-independent-preimage-readonly\.mjs['"]/m);
 const sourceMergeCheck=source.indexOf('const reviewedSourceMerge=reviewedW06SourceMerge()');
 const closureCheck=source.indexOf('verifyReviewedSourceClosure(reviewedSourceMerge)',sourceMergeCheck);
 const ancestryCheck=source.indexOf('verifyInstalledAncestrySource()',closureCheck);
 const dynamicImport=source.indexOf("await import('./public-v3-independent-preimage-readonly.mjs')");
 const invoke=source.indexOf('await inspectIndependent()');
 assert.ok(sourceMergeCheck>0&&closureCheck>sourceMergeCheck&&
  ancestryCheck>closureCheck&&dynamicImport>ancestryCheck&&invoke>dynamicImport);
 assert.match(source,/W06_PUBLIC_B_REVIEWED_SOURCE_DRIFT_STOP/);
 assert.match(source,/W06_PUBLIC_B_INDEPENDENT_WINDOWS_REQUIRED/);
});

test('pre-replacement rejection never invents an operational file write',()=>{
 const r=classifyW06BTerminalFailure({
  errorCode:'SIDECAR_B_PREIMAGE_STOP',replacementAttempted:false
 });
 assert.equal(r.status,'BLOCKED');
 assert.equal(r.operationalWrites,0);
 assert.equal(r.changedFileCount,undefined);
});
test('uncertain replacement and failed postcheck require owner reconciliation',()=>{
 for(const errorCode of [
  'SIDECAR_B_RECOVERY_UNVERIFIED_STOP',
  'W06_PUBLIC_B_POSTINSTALL_READBACK_STOP',
  'SIDECAR_B_LOCK_OWNER_STOP'
 ]) {
  const r=classifyW06BTerminalFailure({
   errorCode,replacementAttempted:true,rollbackVerified:false
  });
  assert.equal(r.status,'RECOVERY_REQUIRED',errorCode);
  assert.equal(r.code,'W06_PUBLIC_B_EFFECT_OUTCOME_UNVERIFIED');
  assert.equal(r.operationalWrites,null);
  assert.equal(r.changedFileCount,null);
  assert.equal(r.requiresOwnerReconcile,true);
 }
});
test('verified rollback is not misreported as a zero-write rejection',()=>{
 const r=classifyW06BTerminalFailure({
  errorCode:'SIDECAR_B_READBACK_STOP',
  replacementAttempted:true,rollbackVerified:true
 });
 assert.equal(r.status,'ROLLED_BACK');
 assert.equal(r.operationalWrites,null);
 assert.equal(r.changedFileCount,0);
 assert.equal(r.rollbackVerified,true);
 const unknown=classifyW06BTerminalFailure({
  errorCode:'SIDECAR_B_RECOVERY_UNVERIFIED_STOP',
  replacementAttempted:true,rollbackVerified:true
 });
 assert.equal(unknown.status,'RECOVERY_REQUIRED');
});
test('real transaction wraps atomic replace, rollback and postcheck; CLI retains recovery report',()=>{
 const s=fs.readFileSync(new URL('./public-v3-independent-owner-b-once.mjs',import.meta.url),'utf8');
 assert.match(s,/tx\.replacementAttempted=true/);
 assert.match(s,/tx\.rollbackVerified=true/);
 assert.match(s,/terminalReport:classified/);
 assert.match(s,/error\?\.terminalReport/);
 assert.match(s,/W06_PUBLIC_B_PROTECTED_READBACK_UNVERIFIED/);
});

test('post-install byte proof is captured inside applyOneFile lease, not read after release',()=>{
 const s=fs.readFileSync(new URL('./public-v3-independent-owner-b-once.mjs',import.meta.url),'utf8');
 assert.match(s,/async readbackSha256\(\.\.\.args\)/);
 assert.match(s,/tx\.verifiedReadback=true/);
 assert.match(s,/installed\.afterSha256===FIXED\.afterSha256&&\s*tx\.verifiedReadback===true/);
 assert.doesNotMatch(s,/sha256\(fs\.readFileSync\(TARGET\)\)/);
 assert.match(s,/async release\(\.\.\.args\)/);
});
test('unknown lease-release after claimed rollback requires owner reconcile',()=>{
 const rolledBack=classifyW06BTerminalFailure({
  errorCode:'SIDECAR_B_LOCK_OWNER_STOP',replacementAttempted:true,
  rollbackVerified:true,leaseReleaseFailed:true
 });
 assert.equal(rolledBack.status,'RECOVERY_REQUIRED');
 assert.equal(rolledBack.code,'W06_PUBLIC_B_LEASE_OUTCOME_UNVERIFIED');
 assert.equal(rolledBack.changedFileCount,null);
 const noReplace=classifyW06BTerminalFailure({
  errorCode:'SIDECAR_B_LOCK_OWNER_STOP',replacementAttempted:false,
  leaseReleaseFailed:true
 });
 assert.equal(noReplace.status,'RECOVERY_REQUIRED');
 assert.equal(noReplace.operationalWrites,0);
});

test('reviewed W06 operator merge must be owner-authored, main ancestor and not a draft',()=>{
 const sha='a'.repeat(40);
 const pr={
  number:4288,merged:true,merge_commit_sha:sha,
  user:{id:327938088},
  head:{repo:{full_name:'ansqhd5774-Choi/zgmini-pc-control'}},
  base:{repo:{full_name:'ansqhd5774-Choi/zgmini-pc-control'},ref:'main'}
 };
 const comparison={behind_by:0,merge_base_commit:{sha}};
 assert.equal(matchesReviewedW06SourceMerge(pr,comparison),true);
 const variants=[
  p=>{p.merged=false;},p=>{p.number=4287;},
  p=>{p.user.id=1;},p=>{p.base.ref='other';},
  p=>{p.head.repo.full_name='other/repo';},
  p=>{p.merge_commit_sha='x';},
 ];
 for(const mutate of variants){
  const changed=structuredClone(pr);mutate(changed);
  assert.equal(matchesReviewedW06SourceMerge(changed,comparison),false);
 }
 for(const changed of [
  {behind_by:1,merge_base_commit:{sha}},
  {behind_by:0,merge_base_commit:{sha:'b'.repeat(40)}},
  {behind_by:0}
 ])
  assert.equal(matchesReviewedW06SourceMerge(pr,changed),false);
});
test('reviewed immutable merge bytes are compared before any local preflight evaluation',()=>{
 const s=fs.readFileSync(new URL('./public-v3-independent-owner-b-once.mjs',import.meta.url),'utf8');
 const review=s.indexOf('const reviewedSourceMerge=reviewedW06SourceMerge()');
 const closure=s.indexOf('verifyReviewedSourceClosure(reviewedSourceMerge)',review);
 const ancestry=s.indexOf('verifyInstalledAncestrySource()',closure);
 const dynamic=s.indexOf("await import('./public-v3-independent-preimage-readonly.mjs')");
 assert.ok(review>0&&closure>review&&ancestry>closure&&dynamic>ancestry);
 assert.match(s,/reviewed\.equals\(current\)/);
 assert.match(s,/sha\(readLocal\(relative\)\)===sha\(reviewed\)/);
 assert.match(s,/verifyReviewedSourceClosure\(reviewedSourceMerge\)/);
 assert.match(s,/W06_PUBLIC_B_OPERATOR_REVIEWED_MERGE_REQUIRED/);
});

test('all transitive static, bare and dynamic W06 runtime imports are source-pinned',()=>{
 const sources=Object.fromEntries(REVIEWED_SOURCE_FILES.map(rel=>[
  rel,fs.readFileSync(new URL('../'+rel,import.meta.url),'utf8')
 ]));
 assert.equal(REVIEWED_SOURCE_FILES.length,11);
 assert.equal(verifyW06ReviewedImportClosure(sources),true);
 for(const injected of [
  "import './malicious-plugin.mjs';",
  "const m=await import('../unreviewed.mjs');",
  "export * from 'unapproved-package';",
  "import 'unexpected-library';"
 ]){
  const bad={...sources,[REVIEWED_SOURCE_FILES[0]]:
   sources[REVIEWED_SOURCE_FILES[0]]+'\n'+injected};
  assert.throws(()=>verifyW06ReviewedImportClosure(bad),
   {code:'W06_PUBLIC_B_IMPORT_NOT_PINNED'});
 }
 const missing={...sources};
 delete missing['controller/pc-source-readonly.mjs'];
 assert.throws(()=>verifyW06ReviewedImportClosure(missing),
  {code:'W06_PUBLIC_B_IMPORT_CLOSURE_STOP'});
});
test('actual installed ancestry must match the existing maintenance source receipt',()=>{
 const hash='a'.repeat(64);
 const proof={
  manifest:{schema:'ZGMINI_PC_MAINTENANCE_INSTALL_V1',
   sourceSha:'b'.repeat(40),files:{'tools/maintenance-ancestry.vbs':hash}},
  installedSha256:hash,pinnedSha256:hash
 };
 assert.equal(verifyW06InstalledAncestryAttestation(proof),true);
 for(const field of ['installedSha256','pinnedSha256']){
  const mutated=structuredClone(proof);mutated[field]='c'.repeat(64);
  assert.equal(verifyW06InstalledAncestryAttestation(mutated),false);
 }
 for(const edit of [
  p=>{p.manifest.sourceSha='invalid';},
  p=>{p.manifest.schema='OTHER';},
  p=>{p.manifest.files['tools/maintenance-ancestry.vbs']='invalid';},
  p=>{delete p.manifest.files;},
 ]){
  const mutated=structuredClone(proof);edit(mutated);
  assert.equal(verifyW06InstalledAncestryAttestation(mutated),false);
 }
});

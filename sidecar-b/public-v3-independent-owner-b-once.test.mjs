import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {classifyW06PublicBEffect,matchesExactW06OwnerEffectComment} from './public-v3-independent-owner-b-once.mjs';

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
 assert.match(s,/applyOneFile\(manifest,verifiedCandidate,io\)/);
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
 const check=source.indexOf('for(const relative of [ENTRY,preflightSource])');
 const dynamicImport=source.indexOf("await import('./public-v3-independent-preimage-readonly.mjs')");
 const invoke=source.indexOf('await inspectIndependent()');
 assert.ok(check>0&&dynamicImport>check&&invoke>dynamicImport);
 assert.match(source,/W06_PUBLIC_B_SOURCE_DRIFT_STOP/);
 assert.match(source,/W06_PUBLIC_B_INDEPENDENT_WINDOWS_REQUIRED/);
});

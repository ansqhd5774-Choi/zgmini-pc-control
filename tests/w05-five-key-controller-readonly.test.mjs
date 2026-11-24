import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,mkdirSync,writeFileSync,rmSync,realpathSync} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {readFixedReadonlyBytes} from '../controller/fixed-readonly-bytes.mjs';
import {validatePreimageApproval} from '../controller/preimage-manifest-contract.mjs';
import {manifestFingerprint,validateControllerSelectivePin,validateControllerConfigTransition} from '../tools/maintenance-contract.mjs';
import {createHash} from 'node:crypto';
import {
 W05_FIVE_OPERATION,W05_SOURCE_FILES,
 summarizeW05FiveKeyEvidence,compareW05FiveKeyWithApprovedReaders,
 inspectW05FiveKeyD1ApiReadback
} from '../controller/w05-five-key-d1-api-readback-readonly.mjs';

const SLOTS=['inflation19','inflation7','calendar','theme','employment'];
const SOURCE='a'.repeat(40),SHA='c'.repeat(64);
const fixture=(status='STRUCTURAL_MATCH_NOT_RUNTIME_PROOF')=>({
 schema:'ZGMINI_W05_FIVE_KEY_INPLACE_PREWORK_R12',
 keysChecked:5,results:SLOTS.map((slot,i)=>({
  slot,status,d1StoredAt:1795220442315,d1BodySha256:SHA,
  d1ReadAt:'2026-11-24T07:00:00.000Z',
  apiObservedAt:'2026-11-24T07:00:01.000Z',
  ...(slot==='theme'?{rollingAndSidecarsVerified:true}:{}),
  secret:'DO_NOT_EXPOSE',body:{privateMetadata:'DO_NOT_EXPOSE'},
  password:'DO_NOT_EXPOSE',unexpected:'DO_NOT_EXPOSE',index:i
 }))});
test('W05 added readback is A/light, fixed dispatch and no visitor-triggered operation',()=>{
 const policy=JSON.parse(readFileSync(new URL('../config/operations.json',import.meta.url),'utf8'));
 assert.equal(policy.operations[W05_FIVE_OPERATION].grade,'A');
 assert.equal(policy.operations[W05_FIVE_OPERATION].resource,'light');
 assert.equal(policy.operations[W05_FIVE_OPERATION].timeoutSeconds,90);
 const previous=structuredClone(policy);
 delete previous.operations[W05_FIVE_OPERATION];
 assert.equal(validateControllerConfigTransition(previous,policy),true);
 assert.equal(policy.mutationsEnabled,false);
 const dispatch=readFileSync(new URL('../controller/operations.mjs',import.meta.url),'utf8');
 assert.match(dispatch,/request\.operation==='w05-five-key-d1-api-readback-readonly'/);
 assert.match(dispatch,/await inspectW05FiveKeyD1ApiReadback\(dataRoot\)/);
});
test('exact installed source must contain complete paid, inflation, employment validation closure',()=>{
 assert.equal(new Set(W05_SOURCE_FILES).size,W05_SOURCE_FILES.length);
 assert.equal(W05_SOURCE_FILES.length,12);
 for(const p of ['lib/w05-audit/compare-five-public-readbacks-r1.mjs',
  'lib/w05-audit/five-key-inplace-readback-prework-r12.mjs',
  'lib/w05-audit/five-key-public-api-reader-r1.mjs',
  'worker/theme-paid-contract.mjs',
  'worker/employment-r6-public-display.mjs',
  'lib/market-score/employment-r6-formula.mjs'])
  assert.ok(W05_SOURCE_FILES.includes(p),p);
 assert.ok(W05_SOURCE_FILES.every(p=>!p.startsWith('/')&&!p.includes('..')));
});
test('actual observed 5 source/API fixture matches remain STATE_UNKNOWN without active deployment attestation',()=>{
 const r=summarizeW05FiveKeyEvidence(fixture(),{sourceSha:SOURCE});
 assert.equal(r.status,'STATE_UNKNOWN');
 assert.equal(r.code,'W05_FIVE_KEY_STRUCTURAL_ONLY_DEPLOYMENT_UNVERIFIED');
 assert.deepEqual(r.results.map(row=>row.slot),SLOTS);
 assert.deepEqual(r.results.map(row=>row.status),
  Array(5).fill('STRUCTURAL_MATCH_NOT_RUNTIME_PROOF'));
 assert.equal(r.keysChecked,5);
 assert.equal(r.structuralMatches,5);
 assert.equal(r.liveD1ApiCompared,true);
 assert.equal(r.sourceCheckoutVerified,true);
 assert.equal(r.deploymentIdentityVerified,false);
 assert.equal(r.ownerAuthorizationVerified,false);
 assert.equal(r.runtimeVerified,false);
 assert.equal(r.providerCalls,0);assert.equal(r.d1Writes,0);
 assert.equal(r.operationalWrites,0);assert.equal(r.sqliteOpened,false);
 assert.doesNotMatch(JSON.stringify(r),/DO_NOT_EXPOSE|privateMetadata|password|secret|body/);
 assert.equal(r.results.find(v=>v.slot==='theme').rollingAndSidecarsVerified,false);
});
test('actual mismatches and partial results never convert into PASS or unsupported PARTIAL',()=>{
 const x=fixture();
 x.results[2].status='PUBLIC_BODY_MISMATCH';
 x.results[3].status='THEME_READER_BRANCH_UNVERIFIED';
 const r=summarizeW05FiveKeyEvidence(x,{sourceSha:SOURCE});
 assert.equal(r.status,'STATE_UNKNOWN');
 assert.equal(r.code,'W05_FIVE_KEY_COMPARISON_PARTIAL_OR_UNVERIFIED');
 assert.equal(r.structuralMatches,3);
 assert.deepEqual(r.results.map(v=>v.status),x.results.map(v=>v.status));
 assert.equal(r.deploymentIdentityVerified,false);
});
test('missing or malicious receipt cannot claim a live public comparison',()=>{
 for(const x of [
  null,{},fixture(),{...fixture(),keysChecked:4},
  {...fixture(),results:fixture().results.slice(0,4)},
  {...fixture(),results:fixture().results.map((r,i)=>i===0?{...r,slot:'unapproved'}:r)},
  {...fixture(),results:fixture().results.map((r,i)=>i===0?{...r,status:'ALLOWED\nsecret'}:r)}
 ]){
  const input=x===null?x:x===undefined?x:x;
  const evidence=summarizeW05FiveKeyEvidence(input&&input===fixture()?null:input);
  if(input?.results?.length===5&&input?.schema==='ZGMINI_W05_FIVE_KEY_INPLACE_PREWORK_R12'&&
     input.keysChecked===5&&input.results.every((v,i)=>v.slot===SLOTS[i]&&
     /^[A-Z][A-Z0-9_]{2,90}$/.test(v.status))){
    assert.equal(evidence.status,'STATE_UNKNOWN');
  }else{
    assert.equal(evidence.status,'STATE_UNKNOWN');
    assert.equal(evidence.liveD1ApiCompared,false);
  }
 }
});
test('receipt sanitizer drops malformed optional hashes and timestamps, never outputs raw payloads',()=>{
 const receipt=fixture();
 receipt.results[0].d1BodySha256='bad';
 receipt.results[0].d1ReadAt='malformed';
 receipt.results[0].apiObservedAt='2026-11-24T07:00:01+00:00';
 const x=summarizeW05FiveKeyEvidence(receipt,{sourceSha:'wrong'});
 assert.equal(x.status,'STATE_UNKNOWN');
 assert.equal(x.sourceCheckoutVerified,false);
 assert.equal(x.sourceSha,null);
 assert.equal(x.results[0].d1BodySha256,undefined);
 assert.equal(x.results[0].d1ReadAt,undefined);
 assert.equal(x.results[0].apiObservedAt,undefined);
 assert.doesNotMatch(JSON.stringify(x),/DO_NOT_EXPOSE/);
});
test('no dynamic approved reader or throw in collector can be upgraded to success',async()=>{
 const missing=await compareW05FiveKeyWithApprovedReaders({});
 assert.equal(missing.status,'STATE_UNKNOWN');
 assert.equal(missing.code,'W05_APPROVED_READERS_NOT_AVAILABLE');
 let observed=0;
 const failed=await compareW05FiveKeyWithApprovedReaders({
  queryFixed:async()=>null,readApi:async()=>({statusCode:200,body:{}}),
  createAdapter:()=>({}),collect:async()=>{observed++;throw Error('SECRET');}
 });
 assert.equal(observed,1);
 assert.equal(failed.status,'STATE_UNKNOWN');
 assert.equal(failed.code,'W05_READBACK_EXECUTION_UNVERIFIED');
 assert.doesNotMatch(JSON.stringify(failed),/SECRET/);
});
test('bounded 5-key operation forwards only supplied reads, not arbitrary operations',async()=>{
 const sql=[];
 const result=await compareW05FiveKeyWithApprovedReaders({
  queryFixed:async(q,p)=>{sql.push({q,p});return null;},
  readApi:async()=>({statusCode:503,body:null}),
  createAdapter:fn=>({query:fn}),
  collect:async ({db,readApi})=>{
   const a=await db.query('FIXED_SQL_FROM_OWNER',['fixed']);
   assert.equal(a,null);
   const b=await readApi();
   assert.equal(b.statusCode,503);
   return fixture('API_NOT_READY');
  },
  sourceSha:SOURCE
 });
 assert.deepEqual(sql,[{q:'FIXED_SQL_FROM_OWNER',p:['fixed']}]);
 assert.equal(result.structuralMatches,0);
 assert.equal(result.status,'STATE_UNKNOWN');
 assert.equal(result.runtimeVerified,false);
});
test('invalid data root and missing config fail closed without touching provider, database or credentials',async()=>{
 const invalid=await inspectW05FiveKeyD1ApiReadback('not-absolute');
 assert.equal(invalid.code,'W05_DATA_ROOT_INVALID');
 const dir=mkdtempSync(path.join(os.tmpdir(),'zgmini-w05-five-key-'));
 const verified=realpathSync.native(dir);
 try{
  const absent=await inspectW05FiveKeyD1ApiReadback(verified);
  assert.equal(absent.status,'STATE_UNKNOWN');
  assert.equal(absent.code,'W05_WRITER_CONFIG_NOT_AVAILABLE');
  mkdirSync(path.join(dir,'pc-writer'),{recursive:true});
  writeFileSync(path.join(dir,'pc-writer','config.json'),'{bad');
  const protection=readFixedReadonlyBytes(path.join(dir,'pc-writer','config.json'),{
   verifiedRoot:verified,minBytes:2,maxBytes:131072});
  assert.equal(protection.ok,true,'safe fixed-byte reader: '+protection.reason);
  const malformed=await inspectW05FiveKeyD1ApiReadback(verified);
  assert.equal(malformed.code,'W05_WRITER_CONFIG_INVALID');
  writeFileSync(path.join(dir,'pc-writer','config.json'),JSON.stringify({
   source:SOURCE,account:'b'.repeat(32),core:'123e4567-e89b-12d3-a456-426614174000'}));
  const absentSource=await inspectW05FiveKeyD1ApiReadback(verified);
  assert.equal(absentSource.status,'STATE_UNKNOWN');
  assert.equal(absentSource.code,'W05_SOURCE_CHECKOUT_UNVERIFIED');
  assert.equal(absentSource.deploymentIdentityVerified,false);
  assert.equal(absentSource.liveD1ApiCompared,false);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

const W05_B_TARGET='03fdedc58e0aadf207f04bc66cb08580dc3d113f';
const W05_B_INSTALLED='7c6cecfd9f5e81759d90dc927265c9442acd4237';
const W05_B_MANIFEST=JSON.parse(readFileSync(new URL(
 '../approvals/controller-updates/'+W05_B_TARGET+'.json',import.meta.url),'utf8'));
const W05_B_PIN=JSON.parse(readFileSync(new URL(
 '../approvals/controller-selective-targets/'+W05_B_TARGET+'.json',import.meta.url),'utf8'));
test('W05 exact selective B pin covers only 3 approved files and the installed CAS',()=>{
 const m=W05_B_MANIFEST,p=W05_B_PIN;
 assert.equal(m.schema,'ZGMINI_PC_UPDATE_V1');
 assert.equal(m.installedSha,W05_B_INSTALLED);
 assert.equal(m.targetSha,W05_B_TARGET);
 assert.equal(m.controllerOnlyInstall,true);
 assert.equal(m.purpose,'pc-controller-maintenance');
 assert.equal(m.approval.grade,'B');
 assert.equal(m.approval.scope,'PC_CONTROL_CONTROLLER_UPDATE');
 assert.equal(m.approval.ref,'https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/3260');
 assert.equal(m.checks.status,'PASS');
 assert.equal(m.checks.targetSha,W05_B_TARGET);
 assert.equal(m.checks.manifestSha256,manifestFingerprint(m.allowFiles).sha256);
 assert.equal(m.checks.manifestSha256,
  'f1787d0798de190e454c0b37120db69e55f53af7fe83ca35b1617a29a2b9fc88');
 assert.deepEqual(m.allowFiles.map(f=>f.path),[
  'config/operations.json','controller/operations.mjs',
  'controller/w05-five-key-d1-api-readback-readonly.mjs']);
 assert.deepEqual(m.backup,{
  strategy:'VERSIONED_SNAPSHOT',
  rollback:{kind:'RESTORE_INSTALLED_SHA',sha:W05_B_INSTALLED}});
 assert.equal(m.postOperation,'core-status');
 assert.equal(m.postSourceBranch,'main');
 assert.equal(m.postSourceSha,'a24067b26bb21b57abe4075e67dfcda63c7f4010');
 assert.equal(m.selectiveSource.branch,
  'codex/w05-five-key-controller-singleparent-7c6c-20261124');
 assert.deepEqual(m.selectiveSource.customPaths,
  ['config/operations.json','controller/operations.mjs']);
 assert.equal(validateControllerSelectivePin(m,p),true);
});
test('W05 selective B cannot substitute another target or change live module bytes',()=>{
 const m=W05_B_MANIFEST,p=W05_B_PIN;
 assert.throws(()=>validateControllerSelectivePin(m,{...p,installedSha:'a'.repeat(40)}),
  /SELECTIVE_PIN_MISMATCH/);
 assert.throws(()=>validateControllerSelectivePin(m,{...p,allowFiles:[
  ...p.allowFiles,{path:'controller/worker.mjs',sha256:'b'.repeat(64)}
 ]}),/SELECTIVE_PIN_MISMATCH/);
 const current=readFileSync(new URL(
  '../controller/w05-five-key-d1-api-readback-readonly.mjs',import.meta.url));
 const sourceHash=createHash('sha256').update(current).digest('hex');
 // The changed source-only module is NOT the previously approved installed
 // target. Do not silently rewrite its historical B file hash.
 assert.notEqual(sourceHash,m.allowFiles[2].sha256);
 const policy=JSON.parse(readFileSync(new URL('../config/operations.json',import.meta.url),'utf8'));
 assert.equal(policy.operations[W05_FIVE_OPERATION].timeoutSeconds,90);
});

// A source PR that only registered the A operation cannot authorize a later
// selective B pin. The approving PR must carry the exact target pin at its
// merge commit; changing the pin's provenance without the manifest is denied.
test('W05 selective B denies approval PR and pin provenance divergence',()=>{
 const m=W05_B_MANIFEST,p=W05_B_PIN;
 assert.throws(()=>validateControllerSelectivePin(m,{...p,
  approvalRef:'https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/3254'}),
  /SELECTIVE_PIN_MISMATCH/);
});

test('W05 15-file exact preimage approval covers allowed lib and D1 dependencies only',()=>{
 const a=JSON.parse(readFileSync(new URL(
  '../approvals/writer-preimage/w05-five-key-lib-closure-20261124.json',import.meta.url),'utf8'));
 assert.equal(a.schema,'ZGMINI_WRITER_PREIMAGE_SCOPE_APPROVAL_V1');
 assert.equal(a.status,'APPROVED_A_READONLY');
 assert.equal(a.scope,'PC_WRITER_APPROVED_SOURCE_PREIMAGE');
 assert.equal(a.sourceRoot,'projects/zgmini-earnings-history-pc-release');
 assert.equal(a.allowOtherPaths,false);
 assert.equal(a.files.length,15);
 const manifestPath='approvals/writer-preimage/w05-five-key-lib-closure-20261124.json';
 const raw=readFileSync(new URL('../'+manifestPath,import.meta.url));
 const digest=createHash('sha256').update(raw).digest('hex');
 const checked=validatePreimageApproval(raw,{expectedSha256:digest,manifestPath});
 assert.deepEqual(checked.files,a.files);
 assert.deepEqual(a.files.slice(0,3).map(x=>x.path),[
  'lib/w05-audit/compare-five-public-readbacks-r1.mjs',
  'lib/w05-audit/five-key-inplace-readback-prework-r12.mjs',
  'lib/w05-audit/five-key-public-api-reader-r1.mjs']);
 assert.deepEqual(a.files.slice(0,3).map(x=>x.change),['A','A','A']);
 assert.deepEqual(a.files.slice(-3).map(x=>x.path),[
  'scripts/pc-writer/d1.mjs','scripts/pc-writer/d1-transient.mjs',
  'scripts/pc-writer/d1-diagnostics.mjs']);
 assert.equal(new Set(a.files.map(x=>x.path.toLowerCase())).size,15);
 const allowed=/^(?:lib|worker|scripts\/pc-writer)\//;
 assert.equal(a.files.every(x=>allowed.test(x.path)&&!x.path.includes('..')&&
  !x.path.includes('scripts/api-site')&&['A','M'].includes(x.change)),true);
 assert.equal(W05_SOURCE_FILES.every(p=>a.files.some(x=>x.path===p)),true);
});

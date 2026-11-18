// W05 QFR source-overlay proposal only: immutable A evidence vs exact B scope.
// These tests validate source-only contracts; they neither approve nor install B.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateWriterBManifest} from '../writer-b/contract.mjs';

const approval=JSON.parse(fs.readFileSync(
  new URL('../approvals/writer-updates/w05-qfr-sevenfile-source-20261118.json',import.meta.url),'utf8'));
const observed=JSON.parse(fs.readFileSync(
  new URL('../results/44236404405-1-seat-2.json',import.meta.url),'utf8'));
const sourceFiles=[
  'scripts/pc-writer/EARNINGS_CENSUS_QFR_R1_READONLY.mjs',
  'scripts/pc-writer/EARNINGS_CENSUS_QFR_R2_SQLITE_APPEND.mjs',
  'scripts/pc-writer/EARNINGS_CENSUS_QFR_R3_STORED_PREVIEW_READONLY.mjs',
  'scripts/pc-writer/EARNINGS_CENSUS_QFR_R4_PROJECTION_DRAFT_READONLY.mjs',
  'scripts/pc-writer/EARNINGS_CENSUS_QFR_R4_D1_ONCE.mjs',
  'scripts/pc-writer/EARNINGS_R4_C_D1_DUAL_SOURCE_GATES.mjs',
  'worker/earnings-companion-c-qfr-r1.mjs',
];
const sharedFiles=[
  'scripts/pc-writer/d1.mjs',
  'scripts/pc-writer/d1-transient.mjs',
  'scripts/pc-writer/d1-diagnostics.mjs',
];
const snapshot=()=>structuredClone(approval);
const observedFiles=new Map(observed.result.scopedPreimage.files.map(item=>[item.path,item]));

test('W05 source-only QFR seven-addition B proposal matches approved ten-file Windows A receipt',()=>{
  assert.equal(validateWriterBManifest(approval),approval);
  assert.equal(observed.requestId,'pc-6fe48906-b35f-4ce3-bdd6-77ec9b8e6c2d');
  assert.equal(observed.jobId,'run-44236404405-1-seat-2');
  assert.equal(observed.status,'PASS');
  assert.equal(observed.code,'WRITER_APPROVED_PREIMAGE_READONLY');
  assert.equal(observed.operationalWrites,0);
  assert.equal(observed.d1Writes,0);
  assert.equal(observed.providerCalls,0);
  assert.equal(observed.protectedStateUnchanged,true);
  assert.equal(observed.result.runtimeSourceVerified,false);
  assert.equal(observed.result.scopedPreimage.manifestSha256,
    '55c770f403ec9deb0b36f7657043bc6158b9f4fceed63e1d7c7867a6f8bd0288');
  assert.equal(observed.result.sourceHead,approval.baseHead);
  assert.equal(observed.result.approvedConfigSource,approval.baseConfigSourceSha);
  assert.equal(observed.result.checkpointSource,approval.baseHead);
  assert.equal(approval.candidateSourceSha,'b8d3c665e32de4721e174cd23bd6c25d739cf1e9');
  assert.deepEqual(approval.files.map(f=>f.path),sourceFiles);
  assert.deepEqual(approval.protectedFiles.map(f=>f.path),sharedFiles);
  assert.equal(observedFiles.size,10);
  for(const f of approval.files){
    const state=observedFiles.get(f.path);
    assert.equal(f.change,'A');
    assert.equal(f.beforeSha256,null);
    assert.match(f.afterSha256,/^[0-9a-f]{64}$/);
    assert.equal(state?.exists,false);
    assert.equal(state?.sha256,null);
    assert.equal(state?.state,'ABSENT');
  }
  for(const f of approval.protectedFiles){
    const state=observedFiles.get(f.path);
    assert.equal(state?.exists,true);
    assert.equal(state?.trackedDirty,false);
    assert.equal(state?.sha256,f.sha256);
    assert.equal(state?.state,'PRESENT');
  }
  assert.deepEqual(approval.runtimeDependencies,{taskXmlSha256:null,consumers:[]});
  assert.equal(approval.runCount,1);
  for(const flag of ['allowProviderCalls','allowDbChanges','allowD1Writes',
    'allowTaskDefinitionChanges','allowOtherSourceChanges'])
    assert.equal(approval[flag],false);
});

test('QFR B source proposal cannot enlarge scope to D1 writes or alter shared D1 modules',()=>{
  const flags=['allowProviderCalls','allowDbChanges','allowD1Writes',
    'allowTaskDefinitionChanges','allowOtherSourceChanges'];
  for(const key of flags){
    const altered=snapshot();
    altered[key]=true;
    assert.throws(()=>validateWriterBManifest(altered),
      {code:'WRITER_B_SIDE_EFFECT_SCOPE_STOP'});
  }
  const missing=snapshot();missing.files.length=0;
  assert.throws(()=>validateWriterBManifest(missing),
    {code:'WRITER_B_FILE_COUNT_STOP'});
  const wrongEffect=snapshot();wrongEffect.files[0].change='M';
  assert.throws(()=>validateWriterBManifest(wrongEffect),
    {code:'WRITER_B_FILE_CONTRACT_STOP'});
  const protectedOverlay=snapshot();
  protectedOverlay.files.push({path:sharedFiles[0],change:'A',
    beforeSha256:null,afterSha256:'f'.repeat(64)});
  assert.throws(()=>validateWriterBManifest(protectedOverlay),
    {code:'WRITER_B_PROTECTED_OVERLAP_STOP'});
});

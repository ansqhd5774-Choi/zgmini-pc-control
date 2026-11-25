import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import fs from 'node:fs';
import {FIXED,validateRecoverySourcePacket,prepareSourceOnly}
 from '../tools/maintenance-source-packet.mjs';

const root=fileURLToPath(new URL('..',import.meta.url));
const git=args=>execFileSync('git',['--no-optional-locks','-C',root,...args],
 {encoding:null,windowsHide:true,timeout:20000,maxBuffer:4000000});
const fixture=()=>{
 const approvalRaw=git(['show','HEAD:'+FIXED.approval]);
 const proofRaw=git(['show','HEAD:'+FIXED.proof]);
 const sourceFiles=Object.fromEntries(FIXED.sourceFiles.map(p=>
  [p,git(['show',FIXED.sourceSha+':'+p])]));
 const headSha=git(['rev-parse','HEAD']).toString().trim();
 return {approvalRaw,proofRaw,sourceFiles,headSha,sourceAncestor:true};
};
const throwsCode=(fn,code)=>assert.throws(fn,e=>e?.code===code);
const jsonMutate=(bytes,mutate)=>{
 const v=JSON.parse(bytes.toString('utf8'));
 mutate(v);return Buffer.from(JSON.stringify(v));
};

test('exact #3516 Git bytes pass pure contract with separately verified ancestry',()=>{
 const original=fixture();
 // C996's changed-source checkout may be shallow: this pure fixture supplies
 // ancestry as a verified input. Only the isolated packet builder performs
 // real merge-base with fetch-depth:0; never infer ancestor from source bytes.
 const result=validateRecoverySourcePacket(original);
 assert.equal(result.status,'SOURCE_PREPARED_ONLY');
 assert.equal(result.code,'IMMUTABLE_SOURCE_BYTES_CAS_COMPATIBLE');
 assert.equal(result.requestId,FIXED.requestId);
 assert.equal(result.sourceSha,FIXED.sourceSha);
 assert.equal(result.recoveryExecuted,false);
 assert.equal(result.controllerWrites,0);
 assert.equal(result.leaseWrites,0);
 assert.equal(result.dbD1Writes,0);
 assert.equal(result.sourceFiles.length,4);
 for(const f of result.sourceFiles){
  assert.ok(f.sizeBytes>0);
  assert.ok(f.sizeBytes<=(f.path==='tools/update.mjs'?262144:131072));
 }
});

test('no Git ancestry or incomplete source cannot fabricate preflight success',()=>{
 const f=fixture();
 throwsCode(()=>validateRecoverySourcePacket({...f,sourceAncestor:false}),
  'SOURCE_PACKET_ANCESTRY_NOT_VERIFIED');
 throwsCode(()=>validateRecoverySourcePacket({...f,sourceFiles:{}}),
  'SOURCE_PACKET_SOURCE_SET_INVALID');
 throwsCode(()=>validateRecoverySourcePacket({...f,headSha:'unknown'}),
  'SOURCE_PACKET_ANCESTRY_NOT_VERIFIED');
});

test('not approved, different source or changed CAS is rejected before packaging',()=>{
 const f=fixture();
 for(const change of [
  a=>a.approved=false,
  a=>a.requestId='pc-update-other',
  a=>a.sourceSha='f'.repeat(40),
  a=>a.targetControllerSha='a'.repeat(40),
  a=>a.proof.runId=45579963187
 ])throwsCode(()=>validateRecoverySourcePacket({
  ...f,approvalRaw:jsonMutate(f.approvalRaw,change)}),
  change.toString().includes('proof')?'SOURCE_PACKET_A_PROOF_SCOPE_INVALID':
  'SOURCE_PACKET_APPROVAL_IDENTITY_MISMATCH');
 throwsCode(()=>validateRecoverySourcePacket({
  ...f,approvalRaw:jsonMutate(f.approvalRaw,a=>a.casDigests.ownerSha256='x')}),
  'SOURCE_PACKET_CAS_SCOPE_INVALID');
});

test('unexpected file, tampered source bytes and oversized normal file are denied',()=>{
 const f=fixture(),p=FIXED.sourceFiles[0];
 throwsCode(()=>validateRecoverySourcePacket({...f,sourceFiles:{
  ...f.sourceFiles,'tools/other.mjs':Buffer.from('unsafe')}}),
  'SOURCE_PACKET_SOURCE_SET_INVALID');
 throwsCode(()=>validateRecoverySourcePacket({...f,sourceFiles:{
  ...f.sourceFiles,[p]:Buffer.from('changed')}}),
  'SOURCE_PACKET_FILE_SHA_MISMATCH');
 throwsCode(()=>validateRecoverySourcePacket({...f,sourceFiles:{
  ...f.sourceFiles,[p]:Buffer.alloc(131073)}}),
  'SOURCE_PACKET_FILE_SIZE_INCOMPATIBLE');
 throwsCode(()=>validateRecoverySourcePacket({...f,approvalRaw:jsonMutate(
  f.approvalRaw,a=>a.files[0].path='../escape')}),
  'SOURCE_PACKET_APPROVED_FILES_INVALID');
});

test('pinned operating A receipt byte drift or synthetic PASS is rejected',()=>{
 const f=fixture();
 throwsCode(()=>validateRecoverySourcePacket({...f,proofRaw:Buffer.from('changed')}),
  'SOURCE_PACKET_A_PROOF_BYTES_MISMATCH');
 throwsCode(()=>validateRecoverySourcePacket({...f,approvalRaw:jsonMutate(
  f.approvalRaw,a=>a.proof.resultSha256='f'.repeat(64))}),
  'SOURCE_PACKET_A_PROOF_BYTES_MISMATCH');
 // Mutating the proof would also change its SHA, making this a byte-level
 // failure rather than a permissible claim of retroactive #3519 success.
 assert.equal(JSON.parse(f.proofRaw.toString('utf8'))
  .w043516MaintenanceStatus.historicalRequest.code,
  'POSTCHECK_OUTCOME_UNKNOWN');
});

test('source-only entry refuses untrusted local executions before writing',()=>{
 // The standalone package builder must never operate as an independent C
 // operator or write to an operating PC. This test intentionally does not
 // invoke its successful CI stage or mutate RUNNER_TEMP.
 const s=fs.readFileSync(new URL('../tools/maintenance-source-packet.mjs',
  import.meta.url),'utf8');
 assert.match(s,/process\.env\.GITHUB_ACTIONS==='true'/);
 assert.match(s,/PINNED_GIT_OBJECTS_NOT_OPERATING_PC/);
 assert.match(s,/recoveryExecuted:false,leaseWrites:0,controllerWrites:0,dbD1Writes:0/);
 assert.doesNotMatch(s,/reconcile-installed['"]\s*,\s*['"]--request-id/);
 assert.equal(typeof prepareSourceOnly,'function');
});

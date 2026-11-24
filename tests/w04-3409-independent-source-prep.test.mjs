import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {validateApproval,verifyCas,verifyStagedFiles,REQUEST_ID,SOURCE_SHA,STAGE,CAS_PATHS,assertIndependentOperator} from '../tools/w04-3409-independent-source-prep.mjs';
const digest=b=>createHash('sha256').update(b).digest('hex');
const keys=['ledger','owner','marker','backlog','snapshot','protection','writer'];
const files=['tools/maintenance-recovery.mjs','tools/update.mjs','tools/maintenance-contract.mjs','controller/fixed-readonly-bytes.mjs'];
const approval=()=>({schema:'ZGMINI_PC_INSTALLED_RECOVERY_APPROVAL_V2',approved:true,
  previousRecoveryApprovalSha256:'e9707741bb4a39cc933b2cb8b5e04ec27242992aa7d974d0fb1af89d21fd9005',
  writerBReceiptSha256:'5ab2953c95e7d86939f18e621c0ced8db92eaba7ab4ce0690b77564198b176f0',
  operation:'RECONCILE_INSTALLED',requestId:REQUEST_ID,issueNumber:3409,
  sourceSha:SOURCE_SHA,targetControllerSha:'6b3c9c0ce77354d81babe4c9ea7785663c6c2cb4',
  casDigests:Object.fromEntries(keys.map(k=>[k+'Sha256',digest(Buffer.from(k))])),
  approvedCurrentWriterConfigSha256:digest(Buffer.from('writer')),
  files:files.map(path=>({path,sha256:digest(Buffer.from(path))}))});
test('accepts only the exact approved W04 case',()=>{
 assert.equal(validateApproval(approval()),true);
 for(const [field,value] of [['requestId','pc-other'],['approved',false],['sourceSha','0'.repeat(40)]]) {
  const a=approval();a[field]=value;assert.throws(()=>validateApproval(a),/PREP_APPROVAL_IDENTITY_MISMATCH/);
 }
});
test('every CAS must match independently, including current Writer',()=>{
 const a=approval();let seen=0;
 const stat=()=>({isFile:()=>true,isSymbolicLink:()=>false,size:8});
 const read=p=>{const k=Object.keys(CAS_PATHS).find(k=>CAS_PATHS[k]===p);seen++;return Buffer.from(k);};
 assert.equal(verifyCas(a,read,stat),true);assert.equal(seen,7);
 const bad=approval();bad.casDigests.writerSha256=digest(Buffer.from('changed'));
 bad.approvedCurrentWriterConfigSha256=bad.casDigests.writerSha256;
 assert.throws(()=>verifyCas(bad,read,stat),/PREP_WRITER_CAS_CHANGED/);
});
test('staged file bytes must match both source object and manifest',()=>{
 const a=approval();let seen=0;
 const git=args=>{seen++;assert.equal(args[0],'show');return Buffer.from(args[1].split(':').slice(1).join(':'));};
 const read=p=>Buffer.from(p.slice(STAGE.length+1).replaceAll('\\','/'));
 assert.equal(verifyStagedFiles(a,git,read),true);assert.equal(seen,4);
 assert.throws(()=>verifyStagedFiles(a,git,()=>Buffer.from('corrupt')),/PREP_STAGED_FILE_DRIFT/);
});

test('source preparation demands the installed independent Windows operator proof',()=>{
 let attestations=0;
 assert.throws(()=>assertIndependentOperator({platform:'linux',env:{},attest:()=>{attestations++;}}),
  /PREP_INDEPENDENT_WINDOWS_ONLY/);
 assert.equal(attestations,0);
 assert.throws(()=>assertIndependentOperator({platform:'win32',env:{RUNNER_NAME:'zgmini-pc-01'},
  attest:()=>{attestations++;}}),/PREP_INDEPENDENT_WINDOWS_ONLY/);
 assert.equal(attestations,0);
 assert.throws(()=>assertIndependentOperator({platform:'win32',env:{},
  attest:()=>{attestations++;throw new Error('RECOVERY_OPERATOR_ATTESTATION_UNVERIFIED');}}),
  /RECOVERY_OPERATOR_ATTESTATION_UNVERIFIED/);
 assert.equal(attestations,1);
 assert.equal(assertIndependentOperator({platform:'win32',env:{},attest:()=>{attestations++;}}),true);
 assert.equal(attestations,2);
});

test('source preparation rejects unpinned historical recovery or Writer B result approval',()=>{
 for(const key of ['previousRecoveryApprovalSha256','writerBReceiptSha256']) {
  const a=approval();a[key]='0'.repeat(64);
  assert.throws(()=>validateApproval(a),/PREP_APPROVAL_IDENTITY_MISMATCH/);
 }
});

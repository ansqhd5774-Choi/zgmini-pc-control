import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {validateApproval,verifyCas,verifyStagedFiles,REQUEST_ID,SOURCE_SHA,STAGE} from '../tools/w04-3409-independent-source-prep.mjs';
const digest=b=>createHash('sha256').update(b).digest('hex');
const keys=['ledger','owner','marker','backlog','snapshot','protection','writer'];
const files=['tools/maintenance-recovery.mjs','tools/update.mjs','tools/maintenance-contract.mjs','controller/fixed-readonly-bytes.mjs'];
const approval=()=>({schema:'ZGMINI_PC_INSTALLED_RECOVERY_APPROVAL_V1',approved:true,
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
 const read=p=>{const k=keys.find(k=>p.includes(k))??'writer';seen++;return Buffer.from(k);};
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

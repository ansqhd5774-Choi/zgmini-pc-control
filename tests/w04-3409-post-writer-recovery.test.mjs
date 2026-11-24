import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {validateW043409PostWriterBridge,
 permittedInstalledRecoveryProtection,fixedInstalledRecoveryCase} from '../tools/maintenance-recovery.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=rel=>fs.readFileSync(path.join(root,rel));
const hex=buffer=>createHash('sha256').update(buffer).digest('hex');
const ID='pc-update-71ea39dc-7048-4e10-9d11-d4be7f6c3ec0';
const R_ID='821f15bd-9709-45bf-b7e3-8b2ce33ae978';
const M='approvals/writer-updates/w04-eta538-scheduled-release-safe-drain-pending-20261125.json';
const original=read('approvals/maintenance-recoveries/'+ID+'.installed.json');
const writerManifest=read(M);
const writerReceipt=read('results/writer-b-source-install-'+R_ID+'.json');
const originalJson=JSON.parse(original);
const actualWriterSha='d8ac245003e7b8e006c2345382d5c639c6d5f18b';
const writerBytes=Buffer.from(JSON.stringify({source:actualWriterSha})+'\n');

function fixture() {
 const approval={...originalJson,sourceSha:'a'.repeat(40),
  schema:'ZGMINI_PC_INSTALLED_RECOVERY_APPROVAL_V2',
  previousRecoveryApprovalSha256:hex(original),
  approvedCurrentWriterConfigSha256:hex(writerBytes),
  writerBReceiptSha256:hex(writerReceipt),
  casDigests:{...originalJson.casDigests,writerSha256:hex(writerBytes)}};
 const issue={number:3461,title:'pc-writer-source-install',
  user:{login:'ansqhd5774-Choi'},labels:[{name:'pc-writer-b-install'}],
  body:JSON.stringify({schema:'ZGMINI_PC_WRITER_SOURCE_B_REQUEST_V1',
   requestId:R_ID,chatId:'b92b724f-36d2-427f-8b1e-204733ae7aa5',
   operation:'pc-writer-source-install',
   controlRepository:'ansqhd5774-Choi/zgmini-pc-control',
   approvalManifestPath:M,
   approvalManifestSha256:'4102978f3c365d43bf0126f5eae6b885bec0ff523b8558a97345c5bcadb5eea0'})};
 return {approval,oldApprovalRaw:original,writerManifestRaw:writerManifest,
  writerReceiptRaw:writerReceipt,writerIssue:issue,writerBytes};
}
test('only the specific already approved W04 Writer B transition may bridge 3409',()=>{
 assert.equal(validateW043409PostWriterBridge(fixture()),true);
});
test('six original CAS members remain immutable even after authorized Writer change',()=>{
 for(const key of Object.keys(originalJson.casDigests).filter(x=>x!=='writerSha256')) {
  const item=fixture();item.approval.casDigests[key]='0'.repeat(64);
  assert.throws(()=>validateW043409PostWriterBridge(item),/W04_POSTWRITER_CAS_SCOPE_CHANGED/,key);
 }
});
test('reject source ref changes, unapproved Writer config bytes and historical approval drift',()=>{
 for(const mutation of [
  x=>{x.approval.sourceSha=originalJson.sourceSha;},
  x=>{x.approval.previousRecoveryApprovalSha256='0'.repeat(64);},
  x=>{x.approval.proof.issueNumber=1;},
  x=>{x.writerBytes=Buffer.from('{"source":"bogus"}\n');}
 ]) {
  const x=fixture();mutation(x);
  assert.throws(()=>validateW043409PostWriterBridge(x),/W04_POSTWRITER_(?:ORIGINAL_APPROVAL_DRIFT|CAS_SCOPE_CHANGED)/);
 }
});
test('reject forgery of Writer B approval, result, identity and source',()=>{
 for(const mutation of [
  x=>{x.writerIssue.user.login='other';},
  x=>{x.writerIssue.labels=[];},
  x=>{x.writerIssue.body='{}';},
  x=>{x.writerManifestRaw=Buffer.from('{}\n');},
  x=>{x.writerReceiptRaw=Buffer.from('{}\n');},
  x=>{const o=JSON.parse(x.writerBytes);o.source='other';
    x.writerBytes=Buffer.from(JSON.stringify(o)+'\n');
    x.approval.casDigests.writerSha256=hex(x.writerBytes);
    x.approval.approvedCurrentWriterConfigSha256=hex(x.writerBytes);}
 ]) {
  const x=fixture();mutation(x);
  assert.throws(()=>validateW043409PostWriterBridge(x),/W04_POSTWRITER_B_AUTHORIZATION_UNVERIFIED/);
 }
});
test('historical 3409 protection stays closed unless Writer B bridge proved',()=>{
 const fixed=fixedInstalledRecoveryCase(ID);
 const changed={allowed:true,code:'RECOVERY_CURRENT_WRITER_CONFIG_PRESERVED',
  preservedWriterConfig:true};
 assert.equal(permittedInstalledRecoveryProtection(fixed,changed),false);
 assert.equal(permittedInstalledRecoveryProtection(fixed,changed,false),false);
 assert.equal(permittedInstalledRecoveryProtection(fixed,changed,true),true);
 assert.equal(permittedInstalledRecoveryProtection(fixed,{allowed:false,...changed},true),true===false);
 assert.equal(permittedInstalledRecoveryProtection(fixed,{allowed:true,
  code:'RECOVERY_OTHER_PROTECTED_STATE_DRIFT',preservedWriterConfig:false},true),false);
 const unchanged={allowed:true,code:'RECOVERY_ORIGINAL_PROTECTION_UNCHANGED'};
 assert.equal(permittedInstalledRecoveryProtection(fixed,unchanged),true);
 const w05={allowUnchangedBaseline:false};
 assert.equal(permittedInstalledRecoveryProtection(w05,changed),true);
 assert.equal(permittedInstalledRecoveryProtection(w05,unchanged),false);
});

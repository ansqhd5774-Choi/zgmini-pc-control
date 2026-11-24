import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {FIXED,project3409ArchivedReceipt,inspect3409ArchivedReceiptReadonly}
 from '../tools/w04-3409-archive-receipt-readonly.mjs';

const approved=JSON.parse(fs.readFileSync(new URL('../'+FIXED.approval,import.meta.url),'utf8'));
const owner=Buffer.from('test-owner-original-bytes');
const marker=Buffer.from('test-marker-original-bytes');
const sha=b=>createHash('sha256').update(b).digest('hex');
const approval=()=>({
 ...approved,casDigests:{...approved.casDigests,
  ownerSha256:sha(owner),markerSha256:sha(marker)}
});
const result=()=>{
 const a=approval();
 return {
  schema:'ZGMINI_PC_INSTALLED_RECOVERY_RESULT_V1',
  requestId:FIXED.requestId,sourceSha:FIXED.sourceSha,
  installedSha:FIXED.controllerSha,status:'RECOVERED_INSTALLED_STATE',
  code:'INSTALLED_RUNTIME_RECOVERED_HISTORIC_POSTCHECK_UNKNOWN',
  archivedAt:'2026-11-25T00:00:00.000Z',
  leaseArchived:true,historicalPostcheck:'OUTCOME_UNKNOWN',
  historicalLedgerPreserved:true,originalRequestRetried:false,
  controllerChanged:false,writerChanged:false,workflowChanged:false,
  dbD1Writes:0,casDigests:{...a.casDigests}
 };
};
const fixture=()=>{const a=approval(),r=result();
 return {approval:a,completed:r,ownerBytes:owner,markerBytes:marker,
  completeBytes:Buffer.from(JSON.stringify(r)+'\n')};
};
test('#3409 only exact approved V2 and archived original lease can verify recovery',()=>{
 const r=project3409ArchivedReceipt(fixture());
 assert.equal(r.status,'ARCHIVE_VERIFIED');
 assert.equal(r.originalLeaseArchived,true);
 assert.equal(r.archiveRecordVerified,true);
 assert.equal(r.historicalPostcheck,'OUTCOME_UNKNOWN');
 assert.equal(r.controllerSha,FIXED.controllerSha);
 assert.equal(r.approvedCasCount,7);
 assert.equal(r.operationalWrites,0);
 assert.match(r.completeRecordSha256,/^[a-f0-9]{64}$/);
 assert.doesNotMatch(JSON.stringify(r),/original-bytes|nonce|secret|approvedCurrentWriter/);
});
test('forged success, missing lease archive and a new historic PASS are rejected',()=>{
 const base=fixture();
 const mutations=[
  {status:'PASS'},{code:'UNKNOWN'},{leaseArchived:false},
  {historicalPostcheck:'PASS'},{originalRequestRetried:true},
  {writerChanged:true},{controllerChanged:true},{workflowChanged:true},
  {historicalLedgerPreserved:false},{dbD1Writes:1},
  {sourceSha:'0'.repeat(40)},{installedSha:'0'.repeat(40)},
  {archivedAt:'unparseable'},{schema:'OTHER'},
  {casDigests:{...base.completed.casDigests,writerSha256:'0'.repeat(64)}}
 ];
 for(const change of mutations){
  const fake={...base.completed,...change};
  assert.equal(project3409ArchivedReceipt({...base,completed:fake,
   completeBytes:Buffer.from(JSON.stringify(fake))}).status,'STATE_UNKNOWN',JSON.stringify(change));
 }
 for(const mutation of [
  {approved:false},{issueNumber:1000},{sourceSha:'0'.repeat(40)},
  {schema:'OTHER'},{casDigests:{...base.approval.casDigests,ownerSha256:'0'.repeat(64)}}
 ]){
  assert.equal(project3409ArchivedReceipt({...base,approval:{...base.approval,...mutation}})
   .status,'STATE_UNKNOWN');
 }
 for(const fake of [
  {...base,ownerBytes:Buffer.from('tampered-owner')},
  {...base,markerBytes:Buffer.from('tampered-marker')},
  {...base,completeBytes:Buffer.from('{"status":"PASS"}')},
  {...base,completeBytes:Buffer.from('NOT_JSON')}
 ])assert.equal(project3409ArchivedReceipt(fake).status,'STATE_UNKNOWN');
});
test('#3409 existing held original install lease remains NOT_ARCHIVED and no archive is read',()=>{
 const observed=inspect3409ArchivedReceiptReadonly({fileSystem:{
  existsSync:()=>true,lstatSync:()=>{throw Error('should not read');}
 }});
 assert.deepEqual({status:observed.status,originalLeaseArchived:observed.originalLeaseArchived},
  {status:'NOT_ARCHIVED',originalLeaseArchived:false});
 assert.equal(observed.operationalWrites,0);
});
test('#3409 read-only post-archive scan excludes arbitrary names, raw data and other requests',()=>{
 const basename=FIXED.requestId+'-installed-11223344-5566-4777-8999-aabbccddeeff';
 const recordFile=basename+'.complete.json';
 const base=fixture();
 let held=false,claim=false,names=[recordFile];
 const fileSystem={
  existsSync:p=>p.endsWith('controller-install')?held:p.endsWith('controller-recovery')?claim:false,
  lstatSync:()=>({isDirectory:()=>true,isSymbolicLink:()=>false}),
  readdirSync:()=>names
 };
 const read=(file)=>{
  const n=path.basename(file);
  if(n===path.basename(FIXED.approval))return {ok:true,bytes:Buffer.from(JSON.stringify(base.approval))};
  if(n===recordFile)return {ok:true,bytes:base.completeBytes};
  if(n==='owner.json')return {ok:true,bytes:base.ownerBytes};
  if(n==='RECOVERY_REQUIRED.json')return {ok:true,bytes:base.markerBytes};
  throw Error('unexpected read');
 };
 const inspect=()=>inspect3409ArchivedReceiptReadonly({fileSystem,read,approvalRoot:'/trusted/source'});
 assert.equal(inspect().status,'ARCHIVE_VERIFIED');
 claim=true;
 assert.equal(inspect().code,'W04_3409_RECOVERY_CLAIM_STILL_PRESENT');
 claim=false;names=['another-request-installed-11223344-5566-4777-8999-aabbccddeeff.complete.json'];
 assert.equal(inspect().code,'W04_3409_COMPLETE_RECEIPT_ABSENT');
 names=[recordFile,recordFile];
 assert.equal(inspect().code,'W04_3409_COMPLETE_RECEIPT_AMBIGUOUS');
 names=[recordFile];held=true;
 assert.equal(inspect().status,'NOT_ARCHIVED');
});

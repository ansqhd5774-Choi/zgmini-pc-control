import test from 'node:test';
import assert from 'node:assert/strict';
import {writeAndVerify} from '../w05-r304-service-b/report.mjs';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {validateSourceBundleBApproval} from '../tools/source-bundle-register.mjs';

const url='https://api.github.com/repos/ansqhd5774-Choi/zgmini-pc-control/contents/results/w05-fixture.json';
const env={GITHUB_TOKEN:'fixture-token'};

test('W05 one-shot result recovery accepts only byte-identical existing GitHub content',async()=>{
 const data='{"status":"PASS"}\n';
 const calls=[];
 const fetchApi=async(address,opts)=>{
  calls.push({address,method:opts.method});
  if(opts.method==='PUT')return {status:422};
  return {ok:true,json:async()=>({encoding:'base64',
   content:Buffer.from(data).toString('base64')})};
 };
 await writeAndVerify(url,data,env,fetchApi);
 assert.deepEqual(calls.map(x=>x.method),['PUT','GET']);
 assert.equal(calls[1].address,url+'?ref=main');
});

test('W05 differing preexisting data never passes reconciliation',async()=>{
 const fetchApi=async(address,opts)=>opts.method==='PUT'?{status:422}:
  {ok:true,json:async()=>({encoding:'base64',
   content:Buffer.from('different').toString('base64')})};
 await assert.rejects(writeAndVerify(url,'expected',env,fetchApi),
  {code:'W05_B_REMOTE_RESULT_HASH_STOP'});
});

test('W05 absent, unreadable or malformed readback never becomes a result',async()=>{
 for(const response of [
  {ok:false},
  {ok:true,json:async()=>({encoding:'raw',content:'same'})},
  {ok:true,json:async()=>({encoding:'base64',content:'not-base64'})}
 ]){
  const fetchApi=async(address,opts)=>opts.method==='PUT'?{status:422}:response;
  await assert.rejects(writeAndVerify(url,'same',env,fetchApi),
   {code:'W05_B_REMOTE_RESULT_READBACK_STOP'});
 }
});

test('W05 service two-file source B manifest candidate validates and detects drift',()=>{
 const approvalBytes=fs.readFileSync(new URL(
  '../approvals/source-bundles/w05-service-r4-twofile-source-b-20261123.json',import.meta.url));
 const approval=JSON.parse(approvalBytes.toString('utf8'));
 const sourceBytes=fs.readFileSync(new URL(
  '../approvals/source-bundles/manifests/42a1c46c0c973fb859f4050a77d781a026acc6c7.json',import.meta.url));
 const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
 assert.equal(digest(sourceBytes),approval.sourceManifestSha256);
 const source=JSON.parse(sourceBytes.toString('utf8'));
 assert.deepEqual(Object.keys(source.files).sort(),[
  'scripts/pc-writer/EARNINGS_R3D_STORED_BLS_CALC_READONLY.mjs',
  'scripts/pc-writer/EARNINGS_R4_C_READ_MODEL_PREVIEW_READONLY.mjs']);
 assert.equal(approval.sourceSha,source.sourceSha);
 assert.equal(approval.entrypoint,source.entrypoint);
 assert.equal(approval.approval.ref,
  'https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/2811');
 const request={schema:'ZGMINI_PC_MAINTENANCE_REQUEST_V1',
  requestId:'pc-update-560cd179-87f6-4cbc-b8a9-f54e5f128b09',
  chatId:'chat-w05-source-twofile-b-20261123',operation:'pc-source-bundle-register',
  controlRepository:'ansqhd5774-Choi/zgmini-pc-control',
  targetControllerSha:'2f3ebcf3518a5e9b694bafbb7e6331840a6a4a25',
  approvalManifestSha256:digest(approvalBytes)};
 const args={actor:'ansqhd5774-Choi',installedSha:request.targetControllerSha};
 const result=validateSourceBundleBApproval(request,approvalBytes,args);
 assert.equal(result.sourceSha,source.sourceSha);
 assert.equal(result.installedControllerSha,request.targetControllerSha);
 assert.equal(result.backup.rollback,'RESTORE_HOST_SHA256');
 assert.throws(()=>validateSourceBundleBApproval(request,
  Buffer.concat([approvalBytes,Buffer.from(' ')]),args),/BUNDLE_B_APPROVAL_BYTES_DRIFT/);
 assert.throws(()=>validateSourceBundleBApproval(request,approvalBytes,
  {...args,installedSha:'d996f2c666955c6659c233d8840d13181571f02a'}),
  /BUNDLE_B_APPROVAL_CONTRACT_INVALID/);
 assert.throws(()=>validateSourceBundleBApproval(request,approvalBytes,
  {...args,actor:'unapproved'}),/BUNDLE_B_ISSUE_CONTRACT_INVALID/);
});

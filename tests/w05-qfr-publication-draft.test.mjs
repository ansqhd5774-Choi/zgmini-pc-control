// W05 QFR: draft one-key publication B contract, with no PC or D1 side effects.
// A valid manifest is NOT an approval. Owner comment and activation remain separate.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {sha256,validatePublicationApproval,validatePublisherFileDigests,
  validateSourceCheckpoints,validateBApprovalComment,operationSpec}
  from '../tools/publication-contract.mjs';

const id='pc-publication-34db72af-680c-4129-b6ee-8a7f31e5c40a';
const bytes=fs.readFileSync(new URL(`../approvals/publications/${id}.json`,import.meta.url));
const manifest=JSON.parse(bytes.toString('utf8'));
const request={schema:'ZGMINI_PC_PUBLICATION_REQUEST_V1',requestId:id,
  chatId:'chat-6f4876f1-f46a-4c3b-8fd7-5a69697193ba',
  operation:'census-qfr-margin-once',
  controlRepository:'ansqhd5774-Choi/zgmini-pc-control',
  approvalManifestSha256:sha256(bytes)};
const observedOperational='2070ff53549e2f9f2cea57d5af7e1d83f9fd7388';
const pinnedPublisher='7b95f8fee83b031a14bf2e199b812d403e211c19';

test('QFR B draft pins exactly one D1 key and ten publisher-main file hashes, not installed QFR files',()=>{
  const v=validatePublicationApproval(request,bytes);
  assert.equal(v.approval.publisherSha,pinnedPublisher);
  assert.equal(v.approval.operationalSha,observedOperational);
  assert.equal(v.approval.approval.issueNumber,2089);
  assert.equal(v.approval.execution.maxD1Keys,1);
  assert.equal(v.approval.execution.maxAutomaticRetries,0);
  assert.equal(v.approval.execution.provider,'STORED_SQLITE_ONLY');
  assert.equal(v.invocation.script,'scripts/pc-writer/EARNINGS_CENSUS_QFR_R4_D1_ONCE.mjs');
  assert.deepEqual([...v.invocation.flags],['--apply','--confirm-census-qfr-d1-write']);
  assert.equal(v.invocation.snapshotKey,
    'detail:earnings-recession-indicators:census-qfr-mfg-margin:v1');
  assert.deepEqual(Object.keys(manifest.publisherFiles),
    [...operationSpec(request.operation).sourceFiles]);
  assert.equal(Object.keys(manifest.publisherFiles).length,10);
  assert.equal(validatePublisherFileDigests(v,manifest.publisherFiles),true);
  assert.deepEqual(validateSourceCheckpoints(v,{
    publisherHead:pinnedPublisher,originMainHead:pinnedPublisher,publisherBranch:'main',
    operationalHead:observedOperational,configSource:observedOperational,
    publisherClean:true,operationalClean:true,
    publisherRoot:'E:/zgmini/publisher-main',operationalRoot:'E:/zgmini/operational-approved'
  }),true);
});

test('QFR B draft cannot authorize its own D1 write without exact independent owner approval',()=>{
  const v=validatePublicationApproval(request,bytes);
  assert.throws(()=>validateBApprovalComment(v,[]),
    /PUBLICATION_EXPLICIT_B_APPROVAL_NOT_FOUND/);
  assert.throws(()=>validateSourceCheckpoints(v,{
    publisherHead:pinnedPublisher,originMainHead:pinnedPublisher,publisherBranch:'main',
    operationalHead:observedOperational,configSource:'f'.repeat(40),
    publisherClean:true,operationalClean:true,
    publisherRoot:'E:/zgmini/publisher-main',operationalRoot:'E:/zgmini/operational-approved'
  }),/PUBLICATION_OPERATIONAL_SOURCE_MISMATCH/);
  const bad={...manifest,publisherFiles:{...manifest.publisherFiles}};
  bad.publisherFiles['worker/earnings-companion-c-qfr-r1.mjs']='0'.repeat(64);
  assert.throws(()=>validatePublisherFileDigests(v,bad.publisherFiles),
    /PUBLICATION_SOURCE_FILE_DRIFT/);
});

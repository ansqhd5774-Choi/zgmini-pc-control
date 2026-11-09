import test from 'node:test';
import assert from 'node:assert/strict';
import {APPROVAL_ROUTES,inspectSharedIssueAdmission,
 prepareSharedApprovalIssue} from './issue-admission.mjs';

const identifier='bd435d7c-2939-457f-907c-98d551f6b8cf';
const chatId='d9ff52d2-960a-4e6c-9d6b-ee63cc76b2f1';
const base={requestId:identifier,chatId,
 controlRepository:'ansqhd5774-Choi/zgmini-pc-control',
 approvalManifestSha256:'d'.repeat(64)};
const inflation=()=>({...base,
 schema:'ZGMINI_INFLATION_OFFICIAL_MANUAL_B_REQUEST_V1',
 operation:'inflation-official-manual',
 approvalManifestPath:'approvals/inflation-manual-b/one.json'});
const writer=()=>({...base,
 schema:'ZGMINI_PC_WRITER_SOURCE_B_REQUEST_V1',
 operation:'pc-writer-source-install',
 approvalManifestPath:'approvals/writer-updates/one.json'});
const verify=(kind,request)=>{
 const issue=prepareSharedApprovalIssue(kind,request);
 return inspectSharedIssueAdmission(issue);
};

test('new official inflation B and existing Writer B share a label safely',()=>{
 assert.equal(APPROVAL_ROUTES['inflation-manual-b'].label,
  APPROVAL_ROUTES['writer-source-b'].label);
 assert.deepEqual(verify('inflation-manual-b',inflation()),{
  state:'ADMITTED_TO_WORKFLOW',code:'EXACT_ROUTE_VERIFIED',
  kind:'inflation-manual-b',requestId:identifier});
 assert.deepEqual(verify('writer-source-b',writer()),{
  state:'ADMITTED_TO_WORKFLOW',code:'EXACT_ROUTE_VERIFIED',
  kind:'writer-source-b',requestId:identifier});
});

test('shared label never permits cross-route schema or manifest path',()=>{
 const issue=prepareSharedApprovalIssue('inflation-manual-b',inflation());
 assert.equal(inspectSharedIssueAdmission({...issue,body:JSON.stringify(writer())}).code,
  'REQUEST_MANIFEST_OR_IDENTITY_INVALID');
 assert.equal(inspectSharedIssueAdmission({...issue,body:JSON.stringify({
  ...inflation(),approvalManifestPath:'approvals/writer-updates/one.json'})}).code,
  'REQUEST_MANIFEST_OR_IDENTITY_INVALID');
 assert.equal(inspectSharedIssueAdmission({...issue,title:'unknown-b'}).code,
  'EXACT_ISSUE_TITLE_REQUIRED');
});

test('wrong label, invalid body and unknown route fail without PC effects',()=>{
 const issue=prepareSharedApprovalIssue('inflation-manual-b',inflation());
 assert.equal(inspectSharedIssueAdmission({...issue,labels:[]}).code,
  'EXACT_RESOURCE_LABEL_REQUIRED');
 assert.equal(inspectSharedIssueAdmission({...issue,body:'{'}).code,
  'REQUEST_JSON_INVALID');
 assert.equal(inspectSharedIssueAdmission({title:'unknown-b',labels:[],body:''}).state,
  'UNMANAGED');
 assert.throws(()=>prepareSharedApprovalIssue('inflation-manual-b',writer()),
  /SHARED_ISSUE_ADMISSION_REQUEST_INVALID/);
});

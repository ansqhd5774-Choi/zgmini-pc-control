import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyIssueCompletion} from '../controller/issue-lifecycle-eligibility.mjs';

const good = () => ({
  issue: {state:'open',number:1299,body:JSON.stringify({schema:'ZGMINI_PC_JOB_V1',requestId:'req-1299',operation:'release-calendar-runtime-readonly',sourceRepository:'ansqhd5774-Choi/zgmini',sourceBranch:'main',sourceSha:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'})},
  request: {schema:'ZGMINI_PC_JOB_V1',requestId:'req-1299',operation:'release-calendar-runtime-readonly',sourceRepository:'ansqhd5774-Choi/zgmini',sourceBranch:'main',sourceSha:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'},
  result: {schema:'ZGMINI_PC_RESULT_V1',controlRepository:'ansqhd5774-Choi/zgmini-pc-control',controlSourceSha:'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',actualExecutionSha:'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',requestedSourceSha:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',sourceRepository:'ansqhd5774-Choi/zgmini',sourceBranch:'main',requestId:'req-1299',operation:'release-calendar-runtime-readonly',jobId:'run-43166235600-1-seat-3',status:'PASS',
    code:'RELEASE_CALENDAR_SOURCE_INVENTORY_READONLY',firstFail:null,exitCode:0,protectedStateUnchanged:true,
    protectedBeforeSha256:'c'.repeat(64),protectedAfterSha256:'c'.repeat(64),
    result:{status:'PASS',code:'RELEASE_CALENDAR_SOURCE_INVENTORY_READONLY'},
    operationalWrites:0,providerCalls:0,d1Writes:0},
  evidence: {issueNumber:1299,requestId:'req-1299',runId:'43166235600',attempt:1,seat:3,
    jsonVerified:true,txtVerified:true,commentVerified:true,runConcludedSuccessfully:true},
  intent: {autoCloseEnabled:true,kind:'SINGLE_READONLY_DIAGNOSTIC',
    objectiveSatisfied:true,approvedByIndependentPolicy:true,requestId:'req-1299'}
});
test('off by default', () => {
  const a=good();a.intent.autoCloseEnabled=false;
  assert.equal(classifyIssueCompletion(a).reason,'DEFAULT_OFF');
});
test('complete and approved diagnostic is only human-review eligible', () => {
  assert.deepEqual(classifyIssueCompletion(good()),{eligible:true,closeAuthorized:false,requiresHumanReview:true,reason:'ELIGIBLE_FOR_HUMAN_REVIEW_ONLY'});
});
const negatives=[
 ['issue already closed',a=>a.issue.state='closed','ISSUE_NOT_OPEN'],
 ['missing original issue body',a=>delete a.issue.body,'ISSUE_BODY_UNVERIFIED'],
 ['source SHA drift',a=>a.result.requestedSourceSha='cccccccccccccccccccccccccccccccccccccccc','SOURCE_IDENTITY_MISMATCH'],
 ['body source SHA mismatch',a=>a.issue.body=JSON.stringify({...JSON.parse(a.issue.body),sourceSha:'dddddddddddddddddddddddddddddddddddddddd'}),'SOURCE_IDENTITY_MISMATCH'],
 ['malformed source SHA',a=>{a.request.sourceSha='short';a.issue.body=JSON.stringify(a.request);},'SOURCE_IDENTITY_MISMATCH'],
 ['source repo changed',a=>a.result.sourceRepository='foreign/other','SOURCE_IDENTITY_MISMATCH'],
 ['source branch changed',a=>a.result.sourceBranch='unknown','SOURCE_IDENTITY_MISMATCH'],
 ['wrong controller repository',a=>a.result.controlRepository='foreign/other','RECEIPT_SCHEMA_UNVERIFIED'],
 ['unexpected receipt schema',a=>a.result.schema='UNKNOWN','RECEIPT_SCHEMA_UNVERIFIED'],
 ['execution source mismatch',a=>a.result.actualExecutionSha='cccccccccccccccccccccccccccccccccccccccc','EXECUTION_IDENTITY_MISMATCH'],
 ['missing execution hash',a=>delete a.result.controlSourceSha,'EXECUTION_IDENTITY_MISMATCH'],
 ['forged requestId in original issue',a=>a.issue.body=JSON.stringify({...JSON.parse(a.issue.body),requestId:'other'}),'ISSUE_BODY_UNVERIFIED'],
 ['nested result status false',a=>a.result.result.status='BLOCKED','NESTED_RESULT_MISMATCH'],
 ['nested result code mismatched',a=>a.result.result.code='UNVERIFIED','NESTED_RESULT_MISMATCH'],
 ['nonzero process exit',a=>a.result.exitCode=1,'NESTED_RESULT_MISMATCH'],
 ['truncated nested inventory',a=>a.result.result.inventoryTruncated=true,'PARTIAL_EVIDENCE'],
 ['real #1299 nested unknown despite top PASS',a=>a.result.result.earningsApiRequestObservations={status:'STATE_UNKNOWN',coverage:'PARTIAL',tailTruncated:true},'NESTED_OBSERVATION_INCOMPLETE'],
 ['partial nested coverage',a=>a.result.result.earningsApiRequestObservations={status:'PASS',coverage:'PARTIAL'},'NESTED_OBSERVATION_INCOMPLETE'],
 ['truncated log tail',a=>a.result.result.earningsApiRequestObservations={status:'PASS',coverage:'COMPLETE',tailTruncated:true},'NESTED_OBSERVATION_INCOMPLETE'],
 ['unknown objective',a=>a.intent.objectiveSatisfied=false,'OBJECTIVE_UNVERIFIED'],
 ['unapproved intent',a=>a.intent.approvedByIndependentPolicy=false,'OBJECTIVE_UNVERIFIED'],
 ['wrong requestId',a=>a.result.requestId='other','REQUEST_MISMATCH'],
 ['unapproved code',a=>a.result.code='CORE_READONLY_DIAGNOSIS','OPERATION_CODE_NOT_APPROVED'],
 ['blocked',a=>a.result.status='BLOCKED','RESULT_NOT_SAFE_PASS'],
 ['state unknown',a=>a.result.status='STATE_UNKNOWN','RESULT_NOT_SAFE_PASS'],
 ['protected state changed',a=>a.result.protectedStateUnchanged=false,'RESULT_NOT_SAFE_PASS'],
 ['protected hash mismatch despite safe flag',a=>a.result.protectedAfterSha256='d'.repeat(64),'PROTECTED_STATE_HASH_MISMATCH'],
 ['protected prehash absent',a=>delete a.result.protectedBeforeSha256,'PROTECTED_STATE_HASH_MISMATCH'],
 ['unexpected provider call',a=>a.result.providerCalls=1,'UNSAFE_SIDE_EFFECTS'],
 ['truncated inventory',a=>a.result.reportTransfer={status:'SUMMARY_ONLY'},'PARTIAL_EVIDENCE'],
 ['wrong issue',a=>a.evidence.issueNumber=1010,'PROVENANCE_MISMATCH'],
 ['wrong run',a=>a.evidence.runId='0','PROVENANCE_MISMATCH'],
 ['missing result txt',a=>a.evidence.txtVerified=false,'RECEIPT_NOT_VERIFIED'],
 ['comment not independently verified',a=>a.evidence.commentVerified=false,'RECEIPT_NOT_VERIFIED'],
 ['cancelled run',a=>a.evidence.runConcludedSuccessfully=false,'RECEIPT_NOT_VERIFIED'],
 ['Core lock remains (#1010)',a=>{a.intent.requiresCoreLockReleased=true;a.result.result={...a.result.result,core:{lockPresent:true}};},'CORE_LOCK_NOT_RELEASED'],
 ['runtime source unknown (#936)',a=>{a.intent.requiresRuntimeSourceVerified=true;a.result.result={...a.result.result,runtimeSourceVerified:false};},'RUNTIME_SOURCE_UNVERIFIED'],
 ['failure flow not proved (#1033)',a=>a.intent.objectiveSatisfied=false,'OBJECTIVE_UNVERIFIED'],
 ['D1 readback unverified (#930)',a=>a.intent.objectiveSatisfied=false,'OBJECTIVE_UNVERIFIED'],
 ['unsupported inventory schema',a=>{a.request.schema='ZGMINI_PC_PROCESS_INVENTORY_REQUEST_V1';a.request.operation='process-inventory-readonly';a.result.operation='process-inventory-readonly';a.result.code='PROCESS_INVENTORY_COLLECTED';a.issue.body=JSON.stringify(a.request);},'SCHEMA_NOT_APPROVED'],
 ['runtime source not verified even with permissive intent',a=>{a.request.operation='core-runtime-source-readonly';a.result.operation='core-runtime-source-readonly';a.result.code='CORE_RUNTIME_SOURCE_VERIFIED';a.result.result={...a.result.result,code:'CORE_RUNTIME_SOURCE_VERIFIED',runtimeSourceVerified:false};a.issue.body=JSON.stringify(a.request);},'RUNTIME_SOURCE_UNVERIFIED']
];
for(const [name,mutate,reason] of negatives){
 test(name,()=>{const a=good();mutate(a);assert.equal(classifyIssueCompletion(a).reason,reason);});
}

test('eligibility decision never grants automatic closure authority',()=>{
 const answer=classifyIssueCompletion(good());
 assert.equal(answer.closeAuthorized,false);
 assert.equal(answer.requiresHumanReview,true);
 assert.equal(Object.isFrozen(answer),true);
});

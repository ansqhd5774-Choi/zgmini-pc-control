import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyIssueCompletion} from '../controller/issue-lifecycle-eligibility.mjs';

const good = () => ({
  issue: {state:'open',number:3336},
  request: {schema:'ZGMINI_PC_PROCESS_INVENTORY_REQUEST_V1',requestId:'verified-request-id',operation:'process-inventory-readonly'},
  result: {requestId:'verified-request-id',operation:'process-inventory-readonly',runId:'45405985982',status:'PASS',
    code:'PROCESS_INVENTORY_COLLECTED',firstFail:null,protectedStateUnchanged:true,
    operationalWrites:0,providerCalls:0,d1Writes:0},
  evidence: {issueNumber:3336,requestId:'verified-request-id',runId:'45405985982',attempt:1,seat:1,
    jsonVerified:true,txtVerified:true,commentVerified:true,runConcludedSuccessfully:true},
  intent: {autoCloseEnabled:true,kind:'SINGLE_READONLY_DIAGNOSTIC',
    objectiveSatisfied:true,approvedByIndependentPolicy:true,requestId:'verified-request-id'}
});
test('off by default', () => {
  const a=good();a.intent.autoCloseEnabled=false;
  assert.equal(classifyIssueCompletion(a).reason,'DEFAULT_OFF');
});
test('complete and approved diagnostic is only human-review eligible', () => {
  assert.deepEqual(classifyIssueCompletion(good()),{eligible:true,reason:'ELIGIBLE_FOR_HUMAN_REVIEW_ONLY'});
});
const negatives=[
 ['issue already closed',a=>a.issue.state='closed','ISSUE_NOT_OPEN'],
 ['unknown objective',a=>a.intent.objectiveSatisfied=false,'OBJECTIVE_UNVERIFIED'],
 ['unapproved intent',a=>a.intent.approvedByIndependentPolicy=false,'OBJECTIVE_UNVERIFIED'],
 ['wrong requestId',a=>a.result.requestId='other','REQUEST_MISMATCH'],
 ['unapproved code',a=>a.result.code='CORE_READONLY_DIAGNOSIS','OPERATION_CODE_NOT_APPROVED'],
 ['blocked',a=>a.result.status='BLOCKED','RESULT_NOT_SAFE_PASS'],
 ['state unknown',a=>a.result.status='STATE_UNKNOWN','RESULT_NOT_SAFE_PASS'],
 ['protected state changed',a=>a.result.protectedStateUnchanged=false,'RESULT_NOT_SAFE_PASS'],
 ['unexpected provider call',a=>a.result.providerCalls=1,'UNSAFE_SIDE_EFFECTS'],
 ['truncated inventory',a=>a.result.reportTransfer={status:'SUMMARY_ONLY'},'PARTIAL_EVIDENCE'],
 ['wrong issue',a=>a.evidence.issueNumber=1010,'PROVENANCE_MISMATCH'],
 ['wrong run',a=>a.evidence.runId='0','PROVENANCE_MISMATCH'],
 ['missing result txt',a=>a.evidence.txtVerified=false,'RECEIPT_NOT_VERIFIED'],
 ['comment not independently verified',a=>a.evidence.commentVerified=false,'RECEIPT_NOT_VERIFIED'],
 ['cancelled run',a=>a.evidence.runConcludedSuccessfully=false,'RECEIPT_NOT_VERIFIED'],
 ['Core lock remains (#1010)',a=>{a.intent.requiresCoreLockReleased=true;a.result.result={core:{lockPresent:true}};},'CORE_LOCK_NOT_RELEASED'],
 ['runtime source unknown (#936)',a=>{a.intent.requiresRuntimeSourceVerified=true;a.result.result={runtimeSourceVerified:false};},'RUNTIME_SOURCE_UNVERIFIED'],
 ['failure flow not proved (#1033)',a=>a.intent.objectiveSatisfied=false,'OBJECTIVE_UNVERIFIED'],
 ['D1 readback unverified (#930)',a=>a.intent.objectiveSatisfied=false,'OBJECTIVE_UNVERIFIED']
];
for(const [name,mutate,reason] of negatives){
 test(name,()=>{const a=good();mutate(a);assert.equal(classifyIssueCompletion(a).reason,reason);});
}

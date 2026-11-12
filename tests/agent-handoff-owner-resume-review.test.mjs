import test from 'node:test';
import assert from 'node:assert/strict';
import {
  OWNER_RESUME_STAGES,reviewOwnerNextStep,readAndReviewOwnerNextStep
} from '../agent-handoff/owner-resume-review.mjs';

const SHA='434f30d2aa221bddacab5afa09241916618d8e22';
const OLD='825cfbd6e2025940e3e48631e7ff1dddf582e75a';
const REPO='ansqhd5774-Choi/zgmini-pc-control';
const reviewed={
  state:'RETURN_EVIDENCE_REVIEWABLE',originIssue:1063,incidentIssue:1068,
  resultId:'result-1063-writer-b-reconcile-20261109',
  resultReceiptCompared:true,ownerChatReceived:'UNKNOWN',
  executionAuthorized:false,
};
const source={repository:'ansqhd5774-Choi/zgmini',
  runtimeSha:SHA,configSha:SHA,evidenceRef:'issues/1089'};
const approval={sourceSha:SHA,evidenceRef:'approvals/writer-updates/r6.json'};
const checkpoint={stage:'RAW_STORED',sourceSha:SHA,
  evidenceRef:'results/verified-collector.json'};
const decide=(overrides={})=>reviewOwnerNextStep({
  returnReview:reviewed,sourceEvidence:source,approvalEvidence:approval,
  lastValidCheckpoint:checkpoint,...overrides,
});

test('real #1063 style central return without PC source/checkpoint stays evidence-required',()=>{
 const x=reviewOwnerNextStep({returnReview:reviewed});
 assert.equal(x.state,'SOURCE_APPROVAL_EVIDENCE_REQUIRED');
 assert.equal(x.nextFunctionStep,null);
 assert.equal(x.returnedIncident,1068);
 assert.equal(x.ownerChatReceived,'UNKNOWN');
 assert.equal(x.runtimeVerified,false);
 assert.equal(x.executionAuthorized,false);
 assert.equal(x.automaticPcRetries,0);
});

test('verified source but absent valid functional checkpoint must not infer stage OTHER',()=>{
 const x=decide({lastValidCheckpoint:undefined});
 assert.equal(x.state,'CHECKPOINT_EVIDENCE_REQUIRED');
 assert.equal(x.nextEvidence,'READ_LAST_VALID_FUNCTION_CHECKPOINT');
 assert.equal(x.nextFunctionStep,null);
});

test('matching evidence yields only a proposed next step, never authority to execute',()=>{
 const x=decide();
 assert.equal(x.state,'NEXT_FUNCTION_STEP_REVIEWABLE');
 assert.equal(x.lastValidStage,'RAW_STORED');
 assert.equal(x.nextFunctionStep,'CALCULATE_FROM_LOCAL_RAW');
 assert.equal(x.checkpointEvidenceRef,checkpoint.evidenceRef);
 assert.equal(x.evidenceAuthenticatedByThisFunction,false);
 assert.equal(x.runtimeVerified,false);
 assert.equal(x.sourceInstallVerified,false);
 assert.equal(x.executionAuthorized,false);
 assert.equal(x.operationalWrites,0);
});

test('all recognized stages advance without skipping local store or D1 checks',()=>{
 assert.deepEqual(OWNER_RESUME_STAGES,[
  'SOURCE_VERIFIED','RAW_STORED','CALCULATED','RESULT_STORED',
  'D1_VERIFIED','API_VERIFIED','UI_VERIFIED']);
 const expected={
  SOURCE_VERIFIED:'COLLECT_RAW',
  RAW_STORED:'CALCULATE_FROM_LOCAL_RAW',
  CALCULATED:'STORE_LOCAL_RESULT',
  RESULT_STORED:'PUBLISH_APPROVED_RESULT',
  D1_VERIFIED:'VERIFY_PUBLIC_API',
  API_VERIFIED:'VERIFY_PC_AND_MOBILE_UI',
  UI_VERIFIED:null,
 };
 for(const [stage,step] of Object.entries(expected)){
  const x=decide({lastValidCheckpoint:{...checkpoint,stage}});
  assert.equal(x.nextFunctionStep,step,stage);
  assert.equal(x.executionAuthorized,false,stage);
  assert.equal(x.state,step===null?'FUNCTION_COMPLETION_REVIEWABLE':
    'NEXT_FUNCTION_STEP_REVIEWABLE',stage);
 }
});

test('source/config or approved source mismatch cannot become a next execution candidate',()=>{
 for(const input of [
  {sourceEvidence:{...source,runtimeSha:OLD}},
  {sourceEvidence:{...source,configSha:OLD}},
  {approvalEvidence:{...approval,sourceSha:OLD}},
 ]){
  const x=decide(input);
  assert.equal(x.state,'SOURCE_APPROVAL_RECONCILIATION_REQUIRED');
  assert.equal(x.nextFunctionStep,null);
  assert.equal(x.executionAuthorized,false);
 }
});

test('checkpoint from older source is preserved for compatibility review, not discarded or reused blindly',()=>{
 const x=decide({lastValidCheckpoint:{...checkpoint,sourceSha:OLD}});
 assert.equal(x.state,'CHECKPOINT_SOURCE_REVIEW_REQUIRED');
 assert.equal(x.nextEvidence,'VERIFY_CHECKPOINT_COMPATIBILITY_WITH_CURRENT_SOURCE');
 assert.equal(x.nextFunctionStep,null);
});

test('invalid source, checkpoint, approval or fabricated return fails closed',()=>{
 for(const input of [
  {sourceEvidence:{...source,repository:'attacker/repo'}},
  {sourceEvidence:{...source,runtimeSha:'main'}},
  {sourceEvidence:{...source,evidenceRef:'http://evil/?token=SECRET'}},
  {approvalEvidence:{...approval,evidenceRef:'../outside?token=1'}},
  {lastValidCheckpoint:{...checkpoint,stage:'OTHER'}},
  {lastValidCheckpoint:{...checkpoint,sourceSha:'not-a-sha'}},
  {lastValidCheckpoint:{...checkpoint,evidenceRef:''}},
  {returnReview:{...reviewed,executionAuthorized:true}},
  {returnReview:{...reviewed,resultReceiptCompared:false}},
  {returnReview:{...reviewed,originIssue:0}},
 ])assert.throws(()=>decide(input),/OWNER_RESUME_/);
});

test('without a central return, independently valid work is not blocked by a fabricated hold',()=>{
 const x=decide({returnReview:{
  state:'NO_RETURNED_RESULT',originIssue:1063,ownerChatReceived:'UNKNOWN',
  executionAuthorized:false,
 }});
 assert.equal(x.state,'NO_CENTRAL_RESULT');
 assert.equal(x.nextEvidence,'REVIEW_INDEPENDENT_FUNCTION_PROGRESS');
 assert.equal(x.nextFunctionStep,null);
 assert.equal(x.executionAuthorized,false);
 assert.equal(x.returnedIncident,null);
});

test('bridge reads only the original GitHub Issue for a no-return case',async()=>{
 const reads=[];
 const io={
  readIssue:async n=>{
   reads.push(['issue',n]);
   return {number:1063,title:'pc-writer-source-install',
    user:{login:'ansqhd5774-Choi'},labels:[{name:'pc-writer-b-install'}],
    body:JSON.stringify({schema:'ZGMINI_PC_WRITER_SOURCE_B_REQUEST_V1',
     requestId:'bd435d7c-2939-457f-907c-98d551f6b8cf',
     chatId:'85876f3c-ff19-42c5-89aa-7de5adbe09cf',
     operation:'pc-writer-source-install',controlRepository:REPO})};
  },
  readIssueComments:async n=>{
   reads.push(['comments',n]);return {comments:[],complete:true};
  },
  readPullRequest:async()=>{throw Error('unexpected PR read');},
  readRun:async()=>{throw Error('unexpected Run read');},
 };
 const x=await readAndReviewOwnerNextStep({originIssueNumber:1063,io});
 assert.equal(x.state,'NO_CENTRAL_RESULT');
 assert.deepEqual(reads,[['issue',1063],['comments',1063]]);
 assert.equal(x.executionAuthorized,false);
});

test('read bridge rejects bad Issue identifiers before any GitHub query',async()=>{
 let calls=0;
 const io={
  readIssue:async()=>{calls++;return null;},
  readIssueComments:async()=>{calls++;return null;},
  readPullRequest:async()=>{calls++;return null;},
  readRun:async()=>{calls++;return null;},
 };
 await assert.rejects(
  readAndReviewOwnerNextStep({originIssueNumber:'1063',io}),
  /OWNER_READ_IO_INVALID/);
 assert.equal(calls,0);
});

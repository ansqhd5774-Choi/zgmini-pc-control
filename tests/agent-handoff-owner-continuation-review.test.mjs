import test from 'node:test';
import assert from 'node:assert/strict';
import {
  reviewOwnerContinuation,readAndReviewOwnerContinuation,
} from '../agent-handoff/owner-continuation-review.mjs';

const SHA='434f30d2aa221bddacab5afa09241916618d8e22';
const OLD='825cfbd6e2025940e3e48631e7ff1dddf582e75a';
const review=()=>({
  state:'RETURN_EVIDENCE_REVIEWABLE',originIssue:1063,
  lastKnownCheckpoint:'OTHER',
  brokerState:'RUNTIME_VERIFICATION_PENDING',executionAuthorized:false,
});
const plan=()=>({
  originIssue:1063,steps:[
    {id:'source_install',status:'DONE',
     evidenceRef:'https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1087',
     sourceSha:SHA},
    {id:'collect',status:'READY'},
    {id:'store',status:'DEFERRED'},
  ],
});
const source=()=>({
  originIssue:1063,currentSourceSha:SHA,approvedSourceSha:SHA,
  sourceEvidenceRef:'https://github.com/ansqhd5774-Choi/zgmini-pc-control/issues/1089',
  approvalEvidenceRef:'approvals/writer-updates/employment-r6-backfill-window-collector-20261109.json',
});
const run=(overrides={})=>reviewOwnerContinuation({
  returnReview:review(),ownerPlan:plan(),sourceReadback:source(),...overrides,
});
function safe(v){
  assert.equal(v.ownerChatReceived,'UNKNOWN');
  assert.equal(v.ownerCheckpointAuthenticated,false);
  assert.equal(v.ownerSourceAuthenticated,false);
  assert.equal(v.runtimeVerified,false);
  assert.equal(v.approvalVerified,false);
  assert.equal(v.executionAuthorized,false);
  assert.equal(v.automaticPcRetries,0);
  assert.equal(v.operationalWrites,0);
}
test('historical #1063 OTHER handoff checkpoint is not owner feature completion',()=>{
 const v=reviewOwnerContinuation({returnReview:review()});
 assert.equal(v.state,'OWNER_PLAN_EVIDENCE_REQUIRED');
 assert.equal(v.lastKnownHandoffCheckpoint,'OTHER');
 assert.equal(v.candidateNextStep,null);
 safe(v);
});
test('owner feature stages select first unfinished step but never authorize PC work',()=>{
 const v=run();
 assert.equal(v.state,'OWNER_NEXT_STEP_REVIEWABLE');
 assert.equal(v.lastClaimedDoneStep,'source_install');
 assert.equal(v.candidateNextStep,'collect');
 assert.equal(v.candidateStatus,'READY');
 assert.equal(v.nextAction,'OWNER_VALIDATE_APPROVAL_AND_RUNTIME_BEFORE_EXECUTION');
 safe(v);
});
test('missing source/approval readback requires only the affected evidence',()=>{
 const v=run({sourceReadback:null});
 assert.equal(v.state,'OWNER_SOURCE_EVIDENCE_REQUIRED');
 assert.equal(v.candidateNextStep,'collect');
 safe(v);
});
test('a source/config approval mismatch is review-required, not a queued installation',()=>{
 const s=source();s.approvedSourceSha=OLD;
 const v=run({sourceReadback:s});
 assert.equal(v.state,'OWNER_SOURCE_PAIR_REVIEW_REQUIRED');
 assert.equal(v.nextAction,'RECONCILE_CURRENT_SOURCE_AND_APPROVAL');
 safe(v);
});
test('changed source preserves previous DONE evidence but requires impact review',()=>{
 const p=plan();p.steps[0].sourceSha=OLD;
 const v=run({ownerPlan:p});
 assert.equal(v.state,'OWNER_CHECKPOINT_IMPACT_REVIEW_REQUIRED');
 assert.equal(v.lastClaimedDoneStep,'source_install');
 assert.ok(v.lastClaimedDoneEvidence.includes('issues/1087'));
 safe(v);
});
test('blocked and deferred owner stages are not made ready by central CI success',()=>{
 for(const status of ['BLOCKED','DEFERRED']){
  const p=plan();p.steps[1].status=status;
  const v=run({ownerPlan:p});
  assert.equal(v.state,'OWNER_NEXT_STEP_NOT_READY');
  assert.equal(v.candidateStatus,status);
  safe(v);
 }
});
test('all supplied DONE steps still require final runtime and publication evidence',()=>{
 const p=plan();p.steps=p.steps.slice(0,1);
 const v=run({ownerPlan:p});
 assert.equal(v.state,'OWNER_PLAN_DONE_CLAIMED');
 assert.equal(v.candidateNextStep,null);
 assert.equal(v.nextAction,'VERIFY_FINAL_RUNTIME_AND_PUBLIC_OUTPUT');
 safe(v);
});
test('missing DONE references and discontiguous completion fail closed',()=>{
 for(const mutation of [
  p=>{p.steps[0].evidenceRef='';},
  p=>{p.steps[0].sourceSha=null;},
  p=>{p.steps[2].status='DONE';p.steps[2].sourceSha=SHA;p.steps[2].evidenceRef='issue:100';},
 ]) {
  const p=plan();mutation(p);
  assert.throws(()=>run({ownerPlan:p}),
   /OWNER_RESUME_(DONE_EVIDENCE_MISSING|NONCONTIGUOUS_DONE)/);
 }
});
test('invalid origin binding, step identity, and fake return state fail closed',()=>{
 const p=plan();p.originIssue=999;
 assert.throws(()=>run({ownerPlan:p}),/OWNER_RESUME_PLAN_INVALID/);
 const q=plan();q.steps[1].id='source_install';
 assert.throws(()=>run({ownerPlan:q}),/OWNER_RESUME_STEP_INVALID/);
 const s=source();s.originIssue=999;
 assert.throws(()=>run({sourceReadback:s}),/OWNER_RESUME_SOURCE_INPUT_INVALID/);
 assert.throws(()=>run({returnReview:{originIssue:1063,state:'RUNTIME_VERIFIED'}}),
  /OWNER_RESUME_RETURN_INVALID/);
});
test('no central return does not block independent owner work or fabricate a runtime fix',()=>{
 const v=run({returnReview:{originIssue:1063,state:'NO_RETURNED_RESULT'},
  ownerPlan:null,sourceReadback:null});
 assert.equal(v.state,'NO_CENTRAL_RETURN');
 assert.equal(v.nextAction,'CONTINUE_INDEPENDENT_OWNER_WORK');
 safe(v);
});
test('read-only wrapper only uses original Issue readback for no-returned-result',async()=>{
 const calls=[];
 const io={
  async readIssue(n){
   calls.push(['issue',n]);
   return {
    number:1063,title:'pc-writer-source-install',
    user:{login:'ansqhd5774-Choi'},labels:[{name:'pc-writer-b-install'}],
    body:JSON.stringify({
      schema:'ZGMINI_PC_WRITER_SOURCE_B_REQUEST_V1',
      requestId:'bd435d7c-2939-457f-907c-98d551f6b8cf',
      chatId:'85876f3c-ff19-42c5-89aa-7de5adbe09cf',
      operation:'pc-writer-source-install',
      controlRepository:'ansqhd5774-Choi/zgmini-pc-control',
    }),
   };
  },
  async readIssueComments(n){calls.push(['comments',n]);return {complete:true,comments:[]};},
  async readPullRequest(){throw Error('UNEXPECTED_PR_READ');},
  async readRun(){throw Error('UNEXPECTED_RUN_READ');},
 };
 const v=await readAndReviewOwnerContinuation({originIssueNumber:1063,io});
 assert.equal(v.state,'NO_CENTRAL_RETURN');
 assert.deepEqual(calls,[['issue',1063],['comments',1063]]);
 safe(v);
});
test('owner plan and source input must stay bounded and exact',()=>{
 const p=plan();p.steps=Array.from({length:25},(_,i)=>({
   id:'x'+i,status:'READY',
 }));
 assert.throws(()=>run({ownerPlan:p}),/OWNER_RESUME_PLAN_INVALID/);
 const s=source();s.currentSourceSha='a'.repeat(39);
 assert.throws(()=>run({sourceReadback:s}),/OWNER_RESUME_SOURCE_INPUT_INVALID/);
 const r=review();r.originIssue=0;
 assert.throws(()=>run({returnReview:r}),/OWNER_RESUME_RETURN_INVALID/);
});

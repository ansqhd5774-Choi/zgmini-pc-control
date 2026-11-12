import test from 'node:test';
import assert from 'node:assert/strict';
import {fingerprintHandoff,parseHandoff} from '../agent-handoff/contract.mjs';
import {resultDigest,verifyAgentResult} from '../agent-handoff/result-contract.mjs';
import {originResultReceipt,centralResultReceipt} from '../agent-handoff/result-receipts.mjs';
import {reviewOwnerHandoffReturn} from '../agent-handoff/owner-return-review.mjs';

const REPO='ansqhd5774-Choi/zgmini-pc-control',OWNER='ansqhd5774-Choi',BOT='github-actions[bot]';
const url=n=>'https://api.github.com/repos/'+REPO+'/issues/'+n;
const comment=(name,n,body)=>({user:{login:name},issue_url:url(n),body});

function fixture({writer=true}={}){
  const number=1063,incident=1068;
  const request=writer?{
    schema:'ZGMINI_PC_WRITER_SOURCE_B_REQUEST_V1',
    requestId:'bd435d7c-2939-457f-907c-98d551f6b8cf',
    chatId:'85876f3c-ff19-42c5-89aa-7de5adbe09cf',
    operation:'pc-writer-source-install',controlRepository:REPO,
  }:{
    schema:'ZGMINI_PC_JOB_V1',requestId:'pc-e2e-review-0001',
    chatId:'chat-e2e-review-0001',sourceRepository:REPO,
    sourceBranch:'main',sourceSha:'a'.repeat(40),
  };
  const originIssue={number,title:writer?'pc-writer-source-install':'pc-job',
    user:{login:OWNER},labels:[{name:writer?'pc-writer-b-install':'pc-job'}],
    body:JSON.stringify(request)};
  const handoff=parseHandoff(JSON.stringify({
    schema:'ZGMINI_AGENT_HANDOFF_V1',
    incidentId:'handoff-19daa86467b1dacba669d1ff',
    origin:{repository:REPO,issueNumber:number,
      requestId:request.requestId,chatId:request.chatId,
      branch:'main',sourceSha:'a'.repeat(40),
      checkpoint:writer?'OTHER':'COLLECT'},
    failure:{kind:writer?'COMMON_WRITER':'COMMON_CONTROLLER',
      code:'WRITER_B_CORE_REENABLE_SOURCE_PAIR_STOP',
      lastPass:'SOURCE_CHECKED',firstFail:'RUNTIME_IMPORT',
      fileRefs:[],evidenceIssueNumber:number},
  }));
  const incidentIssue={number:incident,
    title:'agent-handoff '+handoff.incidentId,
    user:{login:BOT},labels:[{name:'agent-handoff'}],
    body:JSON.stringify(handoff)};
  const result={schema:'ZGMINI_AGENT_HANDOFF_RESULT_V1',
    resultId:'result-1063-writer-b-reconcile-20261109',
    incidentId:handoff.incidentId,fingerprint:fingerprintHandoff(handoff),
    pullRequest:{repository:REPO,number:1086,headSha:'b'.repeat(40)},
    testRun:{repository:REPO,runId:42637013508,headSha:'b'.repeat(40)}};
  const pullRequest={number:1086,state:'closed',
    head:{sha:'b'.repeat(40),repo:{full_name:REPO}},
    base:{repo:{full_name:REPO}}};
  const testRun={id:42637013508,head_sha:'b'.repeat(40),status:'completed',
    conclusion:'success',repository:{full_name:REPO}};
  const verified=verifyAgentResult(handoff,result,pullRequest,testRun);
  const digest=resultDigest(result);
  return {originIssue,originComments:[
    comment(BOT,number,originResultReceipt(result,digest,REPO,verified,incident))],
    originCommentsComplete:true,incidentIssue,incidentComments:[
      comment(OWNER,incident,JSON.stringify(result)),
      comment(BOT,incident,centralResultReceipt(handoff,result,digest,REPO,verified))],
    incidentCommentsComplete:true,pullRequest,testRun};
}
const check=(input=fixture())=>reviewOwnerHandoffReturn(input);
const changes=(mutate)=>{const f=fixture();mutate(f);return f;};

test('exact existing Writer B-style return is a source-only owner review candidate, not execution authority',()=>{
 const x=check();
 assert.equal(x.state,'RETURN_EVIDENCE_REVIEWABLE');
 assert.equal(x.originIssue,1063);
 assert.equal(x.incidentIssue,1068);
 assert.equal(x.repairPr,1086);
 assert.equal(x.testRunId,42637013508);
 assert.equal(x.lastKnownCheckpoint,'OTHER');
 assert.equal(x.brokerState,'RUNTIME_VERIFICATION_PENDING');
 assert.equal(x.resultReceiptCompared,true);
 assert.equal(x.suppliedGithubInputsAuthenticated,false);
 assert.equal(x.ownerChatReceived,'UNKNOWN');
 for(const prop of ['runtimeVerified','sourceInstallVerified','executionAuthorized'])
   assert.equal(x[prop],false);
 assert.equal(x.operationalWrites,0);
 assert.equal(x.automaticPcRetries,0);
});
test('feature-neutral PC Job original may be reviewed only against its exact request',()=>{
 const x=check(fixture({writer:false}));
 assert.equal(x.state,'RETURN_EVIDENCE_REVIEWABLE');
 assert.equal(x.lastKnownCheckpoint,'COLLECT');
 const altered=fixture({writer:false});
 const request=JSON.parse(altered.originIssue.body);
 request.sourceSha='c'.repeat(40);
 altered.originIssue.body=JSON.stringify(request);
 assert.throws(()=>check(altered),/OWNER_HANDOFF_ORIGIN_DRIFT/);
});
test('no returned bot receipt means no result, never a claim that owner resumed',()=>{
 const x=changes(f=>{f.originComments=[];});
 assert.deepEqual(check(x),{state:'NO_RETURNED_RESULT',originIssue:1063,
   ownerChatReceived:'UNKNOWN',runtimeVerified:false,executionAuthorized:false,
   operationalWrites:0,automaticPcRetries:0});
});
test('missing pages or malformed origin comments fail closed instead of false empty',()=>{
 for(const mutate of [
  f=>{f.originCommentsComplete=false;},
  f=>{f.incidentCommentsComplete=false;},
  f=>{f.originComments={comments:[]};},
 ]){
  const f=changes(mutate);
  assert.throws(()=>check(f),/OWNER_(ORIGIN|INCIDENT)_COMMENTS_INCOMPLETE/);
 }
});
test('origin bot receipt must be exact with correct issue URL and no duplicate',()=>{
 for(const mutate of [
  f=>{f.originComments[0].body+='\\nPC verified: true';},
  f=>{f.originComments[0].body=f.originComments[0].body.replace(
    'ChatGPT owner received: UNKNOWN','ChatGPT owner received: YES');},
  f=>{f.originComments[0].body=f.originComments[0].body.replace(
    'testRunId: 42637013508','testRunId: 42637013509');},
  f=>{f.originComments.push(structuredClone(f.originComments[0]));},
  f=>{f.originComments[0].issue_url=url(9999);},
 ]){
  const f=changes(mutate);
  assert.throws(()=>check(f),/OWNER_(ORIGIN_RECEIPT_NOT_EXACT|ORIGIN_RECEIPT_WRONG_ISSUE|MULTIPLE_ORIGIN_RETURNS_REVIEW)/);
 }
});
test('owner result and incident are bound to exact author, title, request ID and issue',()=>{
 for(const mutate of [
  f=>{f.incidentIssue.user.login='attacker';},
  f=>{f.incidentIssue.title='agent-handoff wrong-id';},
  f=>{f.originIssue.body=JSON.stringify({...JSON.parse(f.originIssue.body),requestId:'other-request'});},
  f=>{f.incidentComments[0].user.login='attacker';},
  f=>{f.incidentComments[0].issue_url=url(1200);},
  f=>{f.incidentComments.push(structuredClone(f.incidentComments[0]));},
 ]){
  assert.throws(()=>check(changes(mutate)),
    /OWNER_(INCIDENT_BINDING_INVALID|HANDOFF_ORIGIN_DRIFT|RESULT_COMMENT_MISSING_OR_DUPLICATE)/);
 }
});
test('central bot receipt must be exact, present, unique and bound to incident URL',()=>{
 for(const mutate of [
  f=>{f.incidentComments[1].body+='\\nAPPLIED_VERIFIED';},
  f=>{f.incidentComments[1].body=f.incidentComments[1].body.replace(
     'Windows/D1/API/UI verification: NOT_VERIFIED','Windows/D1/API/UI verification: VERIFIED');},
  f=>{f.incidentComments[1].issue_url=url(1063);},
  f=>{f.incidentComments[1].user.login='attacker';},
  f=>{f.incidentComments.push(structuredClone(f.incidentComments[1]));},
 ]){
  assert.throws(()=>check(changes(mutate)),/OWNER_CENTRAL_RECEIPT_NOT_EXACT/);
 }
});
test('failed CI, wrong PR SHA or different repository cannot become reviewable',()=>{
 for(const mutate of [
  f=>{f.testRun.conclusion='failure';},
  f=>{f.pullRequest.head.sha='c'.repeat(40);},
  f=>{f.testRun.repository.full_name='attacker/repo';},
 ]){
  assert.throws(()=>check(changes(mutate)),
    /RESULT_(TEST_RUN_PROVENANCE_STOP|PR_PROVENANCE_STOP)/);
 }
});
test('original Owner and exact known operation scope must not drift',()=>{
 for(const mutate of [
  f=>{f.originIssue.user.login='attacker';},
  f=>{f.originIssue.labels=[{name:'agent-handoff'}];},
  f=>{f.originIssue.body='not JSON';},
 ]){
  assert.throws(()=>check(changes(mutate)),
    /OWNER_(ORIGIN_ISSUE_INVALID|ORIGIN_SCOPE_DENIED|ORIGIN_JSON_INVALID)/);
 }
});


test('historical #1063/#1068 verified bot receipt bytes remain backward compatible',()=>{
 const f=fixture();
 const h=parseHandoff(JSON.stringify({
  schema:'ZGMINI_AGENT_HANDOFF_V1',
  incidentId:'handoff-19daa86467b1dacba669d1ff',
  origin:{repository:REPO,issueNumber:1063,
   requestId:'bd435d7c-2939-457f-907c-98d551f6b8cf',
   chatId:'85876f3c-ff19-42c5-89aa-7de5adbe09cf',branch:'main',
   sourceSha:'1b828e20c46fad1f26d6332d77e72a68fc0f4eb9',
   checkpoint:'OTHER'},
  failure:{kind:'COMMON_WRITER',code:'WRITER_B_CORE_REENABLE_SOURCE_PAIR_STOP',
   lastPass:'NOT_RECORDED',firstFail:'NOT_RECORDED',
   fileRefs:[
    'approvals/writer-updates/employment-r6-backfill-window-collector-20261109.json',
    'results/writer-b-source-install-bd435d7c-2939-457f-907c-98d551f6b8cf.json',
    'results/writer-b-source-install-bd435d7c-2939-457f-907c-98d551f6b8cf.txt'],
   evidenceIssueNumber:1063}
 }));
 const result={
  schema:'ZGMINI_AGENT_HANDOFF_RESULT_V1',
  resultId:'result-1063-writer-b-reconcile-20261109',
  incidentId:h.incidentId,
  fingerprint:'2a7aee646f209e983f6f732219839800eb5c1e0f9d5aec45d672288d634ecb7d',
  pullRequest:{repository:REPO,number:1086,
   headSha:'f723f776c60f30d0d6a68a333319b5d895333111'},
  testRun:{repository:REPO,runId:42637013508,
   headSha:'f723f776c60f30d0d6a68a333319b5d895333111'}
 };
 assert.equal(fingerprintHandoff(h),result.fingerprint);
 assert.equal(resultDigest(result),'30f067e915dcd053547650108bcbeb5af7c93e8d45488ff445b386d9f9631bfd');
 f.incidentIssue.body=JSON.stringify(h);
 f.incidentComments=[
  comment(OWNER,1068,JSON.stringify(result)),
  comment(BOT,1068,[
   'HANDOFF_RESULT_RECORDED',
   'resultId: result-1063-writer-b-reconcile-20261109',
   'digest: 30f067e915dcd053547650108bcbeb5af7c93e8d45488ff445b386d9f9631bfd',
   'incidentId: handoff-19daa86467b1dacba669d1ff',
   'fingerprint: 2a7aee646f209e983f6f732219839800eb5c1e0f9d5aec45d672288d634ecb7d',
   'origin: ansqhd5774-Choi/zgmini-pc-control#1063',
   'pr: ansqhd5774-Choi/zgmini-pc-control#1086',
   'prHeadSha: f723f776c60f30d0d6a68a333319b5d895333111',
   'testRunId: 42637013508',
   'state: RUNTIME_VERIFICATION_PENDING',
   'ChatGPT owner received: UNKNOWN',
   'Windows/D1/API/UI verification: NOT_VERIFIED',
   'PC retries: 0','operationalWrites: 0'].join('\n'))
 ];
 f.originComments=[comment(BOT,1063,[
  'HANDOFF_ORIGIN_RESULT_RECORDED',
  'resultId: result-1063-writer-b-reconcile-20261109',
  'digest: 30f067e915dcd053547650108bcbeb5af7c93e8d45488ff445b386d9f9631bfd',
  'incidentId: handoff-19daa86467b1dacba669d1ff',
  'handoffIssue: 1068',
  'fixPr: ansqhd5774-Choi/zgmini-pc-control#1086',
  'prHeadSha: f723f776c60f30d0d6a68a333319b5d895333111',
  'testRunId: 42637013508',
  'state: RUNTIME_VERIFICATION_PENDING',
  'ChatGPT owner received: UNKNOWN',
  'Windows/D1/API/UI verification: NOT_VERIFIED',
  'PC retries: 0','operationalWrites: 0'].join('\n'))];
 f.pullRequest.head.sha=result.pullRequest.headSha;
 f.testRun.head_sha=result.testRun.headSha;
 const review=check(f);
 assert.equal(review.state,'RETURN_EVIDENCE_REVIEWABLE');
 assert.equal(review.brokerState,'RUNTIME_VERIFICATION_PENDING');
 assert.equal(review.ownerChatReceived,'UNKNOWN');
 assert.equal(review.executionAuthorized,false);
});

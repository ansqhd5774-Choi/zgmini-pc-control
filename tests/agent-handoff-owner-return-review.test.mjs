import test from 'node:test';
import assert from 'node:assert/strict';
import {fingerprintHandoff,parseHandoff} from '../agent-handoff/contract.mjs';
import {resultDigest,verifyAgentResult} from '../agent-handoff/result-contract.mjs';
import {originResultReceipt,centralResultReceipt} from '../agent-handoff/result-receipts.mjs';
import {reviewOwnerHandoffReturn,readAndReviewOwnerReturn} from '../agent-handoff/owner-return-review.mjs';
import {createOwnerReturnGithubReadIo} from '../agent-handoff/owner-return-github-io.mjs';

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


function mockedReadIO(f,trace){
 const source=structuredClone(f);
 return {
  readIssue:async n=>{
   trace.push(['issue',n]);
   if(n===source.originIssue.number)return source.originIssue;
   if(n===source.incidentIssue.number)return source.incidentIssue;
   throw Error('UNEXPECTED_ISSUE_READ');
  },
  readIssueComments:async n=>{
   trace.push(['comments',n]);
   if(n===source.originIssue.number)
     return {complete:source.originCommentsComplete,comments:source.originComments};
   if(n===source.incidentIssue.number)
     return {complete:source.incidentCommentsComplete,comments:source.incidentComments};
   throw Error('UNEXPECTED_COMMENTS_READ');
  },
  readPullRequest:async (repo,n)=>{
   trace.push(['pr',repo,n]);
   if(repo!==REPO||n!==source.pullRequest.number)
     throw Error('UNEXPECTED_PR_READ');
   return source.pullRequest;
  },
  readRun:async (repo,n)=>{
   trace.push(['run',repo,n]);
   if(repo!==REPO||n!==source.testRun.id)
     throw Error('UNEXPECTED_RUN_READ');
   return source.testRun;
  },
 };
}
test('owner readback connects only original Issue to the exact associated Incident, PR and CI',async()=>{
 const f=fixture(),trace=[];
 const x=await readAndReviewOwnerReturn({originIssueNumber:1063,io:mockedReadIO(f,trace)});
 assert.equal(x.state,'RETURN_EVIDENCE_REVIEWABLE');
 assert.deepEqual(trace,[
  ['issue',1063],['comments',1063],['issue',1068],['comments',1068],
  ['pr',REPO,1086],['run',REPO,42637013508]]);
 assert.equal(x.ownerChatReceived,'UNKNOWN');
 assert.equal(x.executionAuthorized,false);
 assert.equal(x.suppliedGithubInputsAuthenticated,false);
 assert.equal(x.automaticPcRetries,0);
});
test('no return receipt needs no unrelated Incident/PR/CI reads and never indicates delivery',async()=>{
 const f=fixture(),trace=[];
 f.originComments=[];
 const x=await readAndReviewOwnerReturn({originIssueNumber:1063,io:mockedReadIO(f,trace)});
 assert.equal(x.state,'NO_RETURNED_RESULT');
 assert.deepEqual(trace,[['issue',1063],['comments',1063]]);
 assert.equal(x.runtimeVerified,false);
 assert.equal(x.executionAuthorized,false);
});
test('incomplete origin or Incident comment pagination stops before further review',async()=>{
 for(const field of ['originCommentsComplete','incidentCommentsComplete']){
  const f=fixture(),trace=[];f[field]=false;
  await assert.rejects(readAndReviewOwnerReturn({
   originIssueNumber:1063,io:mockedReadIO(f,trace)
  }),/OWNER_(ORIGIN|INCIDENT)_COMMENTS_INCOMPLETE/);
  assert.equal(trace.some(v=>v[0]==='run'),false);
 }
});
test('untrusted or malformed origin receipt cannot redirect readback to arbitrary issue',async()=>{
 for(const mutation of [
  f=>{f.originComments[0].issue_url=url(9999);},
  f=>{f.originComments[0].body=f.originComments[0].body.replace(
    'handoffIssue: 1068','handoffIssue: 9999');},
  f=>{f.originComments[0].body=f.originComments[0].body.replace(
    'handoffIssue: 1068','handoffIssue: 1063');},
  f=>{f.originComments.push(structuredClone(f.originComments[0]));},
 ]){
  const f=fixture(),trace=[];mutation(f);
  await assert.rejects(readAndReviewOwnerReturn({
   originIssueNumber:1063,io:mockedReadIO(f,trace)
  }),/(OWNER_(ORIGIN_RECEIPT_WRONG_ISSUE|INCIDENT_READBACK_NUMBER_MISMATCH|ORIGIN_RETURN_FIELDS_INVALID|MULTIPLE_ORIGIN_RETURNS_REVIEW)|UNEXPECTED_ISSUE_READ)/);
  assert.equal(trace.some(v=>v[0]==='run'),false);
 }
});
test('owner result missing or incomplete must not trigger PR/CI fetch',async()=>{
 for(const mutation of [
  f=>{f.incidentComments[0].issue_url=url(1001);},
  f=>{f.incidentComments.splice(0,1);},
  f=>{f.incidentComments.push(structuredClone(f.incidentComments[0]));},
 ]){
  const f=fixture(),trace=[];mutation(f);
  await assert.rejects(readAndReviewOwnerReturn({
   originIssueNumber:1063,io:mockedReadIO(f,trace)
  }),/OWNER_RESULT_COMMENT_MISSING_OR_DUPLICATE/);
  assert.equal(trace.some(v=>v[0]==='pr'||v[0]==='run'),false);
 }
});
test('readback rejects invalid input and missing IO without assuming a successful empty state',async()=>{
 const f=fixture(),trace=[],io=mockedReadIO(f,trace);
 for(const original of [0,NaN,'1063',1068.5]){
  await assert.rejects(readAndReviewOwnerReturn({
   originIssueNumber:original,io
  }),/OWNER_READ_IO_INVALID/);
 }
 await assert.rejects(readAndReviewOwnerReturn({
  originIssueNumber:1063,io:{...io,readRun:undefined}
 }),/OWNER_READ_IO_INVALID/);
 assert.deepEqual(trace,[]);
});
test('failed PR or CI provenance cannot be treated as a reviewed original result',async()=>{
 const f=fixture(),trace=[];f.testRun.conclusion='failure';
 await assert.rejects(readAndReviewOwnerReturn({
  originIssueNumber:1063,io:mockedReadIO(f,trace)
 }),/RESULT_TEST_RUN_PROVENANCE_STOP/);
 assert.equal(trace.length,6);
});


function mockedAuthenticatedGithub(f,{changeOriginDuringRead=false,missingPage=false,
  responseStatus=200}={}){
 const base='https://api.github.com/repos/'+REPO;
 const source=structuredClone(f);
 const original={...source.originIssue,comments:source.originComments.length,
   updated_at:'2026-11-12T02:00:00Z'};
 const incident={...source.incidentIssue,comments:source.incidentComments.length,
   updated_at:'2026-11-12T02:00:00Z'};
 const collections={
  [source.originIssue.number]:source.originComments.map((c,i)=>({...c,id:10001+i})),
  [source.incidentIssue.number]:source.incidentComments.map((c,i)=>({...c,id:20001+i})),
 };
 const trace=[],counts=new Map();
 const failStatus=responseStatus;
 const read=async(url,options)=>{
  const u=new URL(url);
  const path=u.pathname;
  trace.push({url,method:options?.method,headers:options?.headers});
  assert.equal(options?.method,'GET');
  assert.equal(options?.redirect,'error');
  assert.equal(options?.headers?.Authorization,'Bearer test-connector-token');
  assert.equal(u.origin,'https://api.github.com');
  if(failStatus!==200)
   return new Response('denied',{status:failStatus});
  const part='/repos/'+REPO;
  let value;
  if(path===part+'/issues/'+source.originIssue.number){
   const n=(counts.get(path)||0)+1;counts.set(path,n);
   value={...original,...(changeOriginDuringRead&&n>1?
     {updated_at:'2026-11-12T02:01:00Z'}:{})};
  }else if(path===part+'/issues/'+source.incidentIssue.number){
   value=incident;
  }else if(path.startsWith(part+'/issues/')&&
    path.endsWith('/comments')){
   const number=Number(path.split('/')[4]);
   const list=collections[number];
   if(!list)throw Error('UNEXPECTED_ISSUE_COMMENT_GET');
   const page=Number(u.searchParams.get('page'));
   assert.equal(u.searchParams.get('per_page'),'100');
   value=missingPage&&page===2?[]:list.slice((page-1)*100,page*100);
  }else if(path===part+'/pulls/1086'){
   value=source.pullRequest;
  }else if(path===part+'/actions/runs/42637013508'){
   value=source.testRun;
  }else{
   throw Error('UNEXPECTED_GITHUB_GET_PATH');
  }
  return new Response(JSON.stringify(value),{
   status:200,headers:{'content-type':'application/json'}});
 };
 return {read,trace};
}
const authIo=(fetchImpl)=>createOwnerReturnGithubReadIo({
 token:'test-connector-token',fetchImpl});
test('authenticated GET adapter actually feeds original-owner return review without mutation',async()=>{
 const mock=mockedAuthenticatedGithub(fixture());
 const result=await readAndReviewOwnerReturn({
  originIssueNumber:1063,io:authIo(mock.read)});
 assert.equal(result.state,'RETURN_EVIDENCE_REVIEWABLE');
 assert.equal(result.incidentIssue,1068);
 assert.equal(result.ownerChatReceived,'UNKNOWN');
 assert.equal(result.executionAuthorized,false);
 assert.equal(mock.trace.length,8);
 assert.ok(mock.trace.every(t=>t.method==='GET'));
 assert.ok(mock.trace.every(t=>!t.url.includes('Bearer')));
 assert.equal(mock.trace.filter(t=>t.url.includes('/pulls/')).length,1);
 assert.equal(mock.trace.filter(t=>t.url.includes('/actions/runs/')).length,1);
});
test('authenticated readback of no-returned-result stops without any Incident/PR/Run GET',async()=>{
 const f=fixture();f.originComments=[];
 const mock=mockedAuthenticatedGithub(f);
 const value=await readAndReviewOwnerReturn({
  originIssueNumber:1063,io:authIo(mock.read)});
 assert.equal(value.state,'NO_RETURNED_RESULT');
 assert.equal(mock.trace.length,3);
 assert.ok(mock.trace.every(x=>x.url.includes('/issues/1063')));
});
test('authenticated GitHub GET follows all 100-item pages and checks exact count',async()=>{
 const f=fixture();
 const filler=Array.from({length:100},(_,i)=>comment(OWNER,1063,'ordinary-comment-'+i));
 f.originComments=[...filler,...f.originComments];
 const mock=mockedAuthenticatedGithub(f);
 const value=await readAndReviewOwnerReturn({
  originIssueNumber:1063,io:authIo(mock.read)});
 assert.equal(value.state,'RETURN_EVIDENCE_REVIEWABLE');
 assert.equal(mock.trace.filter(t=>t.url.includes('/issues/1063/comments')).length,2);
 const missing=mockedAuthenticatedGithub(f,{missingPage:true});
 await assert.rejects(readAndReviewOwnerReturn({
  originIssueNumber:1063,io:authIo(missing.read)
 }),/OWNER_GITHUB_READ_COMMENTS_TRUNCATED/);
});
test('auth GET fails closed on a changing Issue or unauthorized GitHub response',async()=>{
 const f=fixture();
 for(const opts of [{changeOriginDuringRead:true},{responseStatus:403}]){
  const mock=mockedAuthenticatedGithub(f,opts);
  await assert.rejects(readAndReviewOwnerReturn({
   originIssueNumber:1063,io:authIo(mock.read)
  }),/OWNER_GITHUB_READ_(COMMENTS_CHANGED_DURING_READ|HTTP_NOT_OK)/);
  assert.equal(mock.trace.some(t=>t.method!=='GET'),false);
 }
});
test('read-only adapter rejects invalid tokens/repositories/PR and run IDs without fetch',async()=>{
 const fetches=[];
 const fetchImpl=async(...args)=>{fetches.push(args);throw Error('unexpected network');};
 assert.throws(()=>createOwnerReturnGithubReadIo({token:'bad',fetchImpl}),
  /OWNER_GITHUB_READ_AUTH_INPUT_INVALID/);
 const io=authIo(fetchImpl);
 await assert.rejects(io.readPullRequest('attacker/repo',1086),
  /OWNER_GITHUB_READ_PR_SCOPE_STOP/);
 await assert.rejects(io.readRun(REPO,0),/OWNER_GITHUB_READ_RUN_SCOPE_STOP/);
 await assert.rejects(io.readIssue('1063'),/OWNER_GITHUB_READ_ISSUE_NUMBER_INVALID/);
 assert.equal(fetches.length,0);
});
test('forged comment URL or duplicate GitHub ID never yields a complete ledger',async()=>{
 const f=fixture();
 f.originComments[0].issue_url=url(9999);
 const bad=mockedAuthenticatedGithub(f);
 await assert.rejects(readAndReviewOwnerReturn({
  originIssueNumber:1063,io:authIo(bad.read)
 }),/OWNER_GITHUB_READ_COMMENT_IDENTITY_STOP/);
 const q=fixture();
 q.originComments.push(structuredClone(q.originComments[0]));
 const dup=mockedAuthenticatedGithub(q);
 await assert.rejects(readAndReviewOwnerReturn({
  originIssueNumber:1063,io:authIo(dup.read)
 }),/OWNER_MULTIPLE_ORIGIN_RETURNS_REVIEW/);
});

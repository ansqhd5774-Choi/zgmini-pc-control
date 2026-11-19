import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseHandoff,fingerprintHandoff,routeHandoff} from '../agent-handoff/contract.mjs';
import {selectionReceipt} from '../agent-handoff/queue-selector.mjs';
import {
  DEEP_POLICY,selectRecentHandoffs,verifyHandoff,reportMarker,
  alreadyReported,sourceAssessment,simulateOptions,buildDeepReport,
  analyzeRecentHistory
} from '../agent-handoff/deep-diagnostics.mjs';
import {processDeepQueue,validateDeepEvent} from '../agent-handoff/deep-diagnostics-runner.mjs';

const repo='ansqhd5774-Choi/zgmini-pc-control',owner='ansqhd5774-Choi';
const now=Date.parse('2026-11-16T13:00:00Z'),when='2026-11-16T12:00:00Z';
const sha='a'.repeat(40),mainSha='b'.repeat(40);
const url=n=>'https://api.github.com/repos/'+repo+'/issues/'+n;
function fixture(number=120,code='WRITER_B_PC_PREIMAGE_STOP',created=when){
  const request={schema:'ZGMINI_AGENT_HANDOFF_V1',
    incidentId:'handoff-fixture-'+number+'-20261116',
    origin:{repository:repo,issueNumber:number-1,
      requestId:'test-00000000-'+number,chatId:'chat-test-00000000',branch:'main',
      sourceSha:sha,checkpoint:'OTHER'},
    failure:{kind:'COMMON_WRITER',code,lastPass:'NOT_RECORDED',
      firstFail:'NOT_RECORDED',fileRefs:['writer-b/install.mjs'],evidenceIssueNumber:number-1}};
  const issue={number,title:'agent-handoff '+request.incidentId,body:JSON.stringify(request),
    created_at:created,updated_at:created,state:'open',user:{login:owner},
    labels:[{name:'agent-handoff'},{name:'handoff-agent-pending'}]};
  const decoded=parseHandoff(issue.body);
  const fp=fingerprintHandoff(decoded);
  const routing=routeHandoff(decoded);
  const route=['HANDOFF_ROUTED','incidentId: '+decoded.incidentId,
    'fingerprint: '+fp,'role: '+routing.role,
    'state: AWAITING_AGENT_CONFIGURATION','checkpoint: OTHER',
    'PC retries: 0','operationalWrites: 0',
    'Automatic AI execution and original ChatGPT conversation wake-up: NOT_CONFIGURED'].join('\n');
  const comments=[
    {id:number*10,issue_url:url(number),body:route,
      user:{login:'github-actions[bot]'},created_at:created},
    {id:number*10+1,issue_url:url(number),body:selectionReceipt(decoded,fp),
      user:{login:'github-actions[bot]'},created_at:created}
  ];
  return {issue,request:decoded,comments};
}
function originFor(f){return {number:f.request.origin.issueNumber,
  state:'open',user:{login:owner},body:'private origin evidence'};}
function evidenceFor(f){
  return {origin:originFor(f),originComments:[{user:{login:owner},
    body:'sensitive-secret=DO_NOT_PUBLISH'}],history:[],
    source:{mainSha,files:[{path:'writer-b/install.mjs',status:'CHANGED_BLOB'}]}};
}
test('strict seven-day newest-first ignores historical 3-month intake',()=>{
  const newest=fixture(101),middle=fixture(102,'WRITER_B_PC_PREIMAGE_STOP','2026-11-15T00:00:00Z');
  const old=fixture(103,'WRITER_B_PC_PREIMAGE_STOP','2026-08-16T00:00:00Z');
  const selected=selectRecentHandoffs([middle.issue,old.issue,newest.issue],now);
  assert.deepEqual(selected.selected.map(x=>x.number),[101,102]);
  assert.equal(selected.cutoff,'2026-11-09T13:00:00.000Z');
});
test('only exact authenticated routing and selector receipts pass',()=>{
  const f=fixture();
  assert.equal(verifyHandoff(f.issue,f.comments).incidentId,f.request.incidentId);
  assert.throws(()=>verifyHandoff(f.issue,[f.comments[0]]),/HANDOFF_RECEIPT/);
  assert.throws(()=>verifyHandoff(f.issue,[{...f.comments[0],user:{login:owner}},f.comments[1]]),/HANDOFF_RECEIPT/);
  assert.throws(()=>verifyHandoff({...f.issue,body:f.issue.body.replace('PC_PREIMAGE','PC_MISMATCH')},f.comments),/HANDOFF_RECEIPT/);
});
test('diagnostic ledger marker must be unique and bot-authored',()=>{
  const f=fixture(),marker=reportMarker(f.issue,f.request);
  const bot={id:10,created_at:new Date().toISOString(),user:{login:'github-actions[bot]'},body:marker+'\nreport'};
  assert.equal(alreadyReported([],f.issue,f.request),false);
  assert.equal(alreadyReported([bot],f.issue,f.request),true);
  assert.throws(()=>alreadyReported([{...bot,user:{login:owner}}],f.issue,f.request),/LEDGER_MARKER_AUTHOR_STOP/);
  assert.throws(()=>alreadyReported([bot,{...bot,id:11}],f.issue,f.request),/LEDGER_DUPLICATE_STOP/);
});
test('source comparison is only exact bounded blob metadata',()=>{
  const f=fixture(),source=evidenceFor(f).source;
  const info=sourceAssessment(f.request,source.files,mainSha);
  assert.equal(info.states[0].status,'CHANGED_BLOB');
  assert.throws(()=>sourceAssessment(f.request,[{path:'unexpected',status:'SAME_BLOB'}],mainSha),/SOURCE_RESULT_CONTRACT_STOP/);
  assert.throws(()=>sourceAssessment(f.request,[{path:'writer-b/install.mjs',status:'ROOT_CAUSE_PROVEN'}],mainSha),/SOURCE_RESULT_CONTRACT_STOP/);
});
test('conditional simulation blocks runtime changes and does not declare repair success',()=>{
  const f=fixture(),ev=evidenceFor(f),source=sourceAssessment(f.request,ev.source.files,mainSha);
  const sim=simulateOptions(f.request,source,true);
  assert.deepEqual(sim.map(x=>x.result),['BLOCK','REVIEWABLE','OWNER_ACTION_REQUIRED','NOT_AUTHORIZED']);
  assert.equal(simulateOptions(f.request,{...source,states:[{path:'writer-b/install.mjs',status:'UNAVAILABLE'}]},true)[1].result,'INSUFFICIENT_EVIDENCE');
});
test('report captures safe origin/source/history proof without sensitive issue text',()=>{
  const f=fixture(),ev=evidenceFor(f);
  ev.history=[{id:1001,created_at:when,head_sha:sha,status:'completed',conclusion:'success'},
    {id:1002,created_at:when,head_sha:mainSha,status:'completed',conclusion:'failure'}];
  const report=buildDeepReport(f.issue,f.request,ev,now);
  assert.match(report,/정밀 증거·조건부 시뮬레이션/);
  assert.match(report,/변경 1/);
  assert.match(report,/성공 1 \/ 실패·시간초과 0/);
  assert.match(report,/NOT_AUTHORIZED/);
  assert.doesNotMatch(report,/DO_NOT_PUBLISH|private origin evidence|sensitive-secret/);
  assert.equal(analyzeRecentHistory(ev.history,f.request,now).latestSuccess,1001);
});
test('isolated runner processes newest verified case and never reposts receipt',async()=>{
  const a=fixture(200),b=fixture(201,'WRITER_B_IMPORT_MISSING_DEPENDENCY_STOP','2026-11-15T09:00:00Z');
  const cases=[b,a],records=new Map(cases.map(f=>[f.issue.number,f]));
  const posts=[];
  let ledgerComments=[];
  const io={
    listIssues:async()=>cases.map(x=>structuredClone(x.issue)),
    readIssue:async id=>structuredClone(records.get(id).issue),
    readComments:async id=>id===1743?structuredClone(ledgerComments):
      structuredClone(records.get(id).comments),
    readLedger:async()=>({number:1743,state:'open',user:{login:owner},
      body:'<!-- ZGMINI_PROACTIVE_DIAGNOSTIC_LEDGER_R1 -->',comments:ledgerComments.length}),
    readOrigin:async(_,n)=>originFor(records.get(n+1)),
    readOriginComments:async()=>[],
    mainSha:async()=>mainSha,
    compareFile:async()=> 'SAME_BLOB',
    recentHistory:async()=>[],
    postLedger:async body=>{
      posts.push(body);
      ledgerComments.push({id:9000+posts.length,body,created_at:new Date().toISOString(),
        user:{login:'github-actions[bot]'}});
    }
  };
  const first=await processDeepQueue(io,now);
  assert.deepEqual(first.observed.map(x=>x.issue),[200,201]);
  assert.equal(first.posted,2);
  const again=await processDeepQueue(io,now);
  assert.equal(again.posted,0);
  assert.equal(again.already,2);
  assert.equal(posts.length,2);
});
test('invalid bot selector evidence does not post',async()=>{
  const f=fixture(),posts=[];
  const io={
    listIssues:async()=>[f.issue],readIssue:async()=>f.issue,
    readComments:async n=>n===1743?[]:[f.comments[0]],
    readLedger:async()=>({number:1743,state:'open',user:{login:owner},
      body:'<!-- ZGMINI_PROACTIVE_DIAGNOSTIC_LEDGER_R1 -->',comments:0}),
    readOrigin:async()=>{throw Error('should not call');},
    readOriginComments:async()=>[],
    mainSha:async()=>mainSha,compareFile:async()=> 'SAME_BLOB',
    recentHistory:async()=>[],postLedger:async x=>posts.push(x)
  };
  const output=await processDeepQueue(io,now);
  assert.equal(output.unverified,1);assert.equal(output.posted,0);assert.deepEqual(posts,[]);
});
test('workflow stays owner/schedule gated on isolated Windows without write to code',()=>{
  const workflow=readFileSync(new URL('../.github/workflows/agent-handoff-deep-diagnostics.yml',import.meta.url),'utf8');
  assert.match(workflow,/cron: '12,27,42,57 \* \* \* \*'/);
  assert.match(workflow,/contents: read/);
  assert.match(workflow,/actions: read/);
  assert.match(workflow,/issues: write/);
  assert.match(workflow,/zgmini-handoff-ci-isolated/);
  assert.match(workflow,/ZGMINI_AGENT_HANDOFF_ENABLED/);
  assert.match(workflow,/deep-diagnostics-runner.mjs/);
  assert.doesNotMatch(workflow,/^  workflow_run:/m);assert.match(workflow,/issues:/);assert.doesNotMatch(workflow,/^  push:/m);
  assert.match(workflow,/types: \[labeled\]/);
  assert.doesNotMatch(workflow,/contents: write|actions: write|pull_request:/);
  const event={repository:{private:true,full_name:repo},schedule:DEEP_POLICY.schedule};
  const env={GITHUB_REPOSITORY:repo,GITHUB_EVENT_PATH:'event.json',
    GITHUB_REF:'refs/heads/main',GITHUB_EVENT_NAME:'schedule'};
  assert.doesNotThrow(()=>validateDeepEvent(event,env));
  assert.throws(()=>validateDeepEvent({...event,schedule:'* * * * *'},env),/CRON/);
});

test('R2 fallback gate refuses untrusted events and accepts authorized source receipts',()=>{
  const e={repository:{private:true,full_name:repo}};
  const base={GITHUB_REPOSITORY:repo,GITHUB_EVENT_PATH:'event.json',GITHUB_REF:'refs/heads/main'};
  const run={...e,action:'completed',workflow_run:{name:'ZGMINI Handoff Queue Candidate Selector',
    conclusion:'success',actor:{login:owner},head_branch:'main'}};
  assert.doesNotThrow(()=>validateDeepEvent(run,{...base,GITHUB_EVENT_NAME:'workflow_run'}));
  assert.throws(()=>validateDeepEvent({...run,workflow_run:{...run.workflow_run,conclusion:'skipped'}},{...base,GITHUB_EVENT_NAME:'workflow_run'}),/FALLBACK_WORKFLOW/);
  assert.throws(()=>validateDeepEvent({...run,workflow_run:{...run.workflow_run,name:'untrusted'}},{...base,GITHUB_EVENT_NAME:'workflow_run'}),/FALLBACK_WORKFLOW/);
  const issue={...e,action:'labeled',label:{name:'handoff-agent-pending'},issue:{state:'open',user:{login:owner},labels:[{name:'agent-handoff'}]}};
  assert.doesNotThrow(()=>validateDeepEvent(issue,{...base,GITHUB_EVENT_NAME:'issues',GITHUB_ACTOR:owner}));
  assert.throws(()=>validateDeepEvent(issue,{...base,GITHUB_EVENT_NAME:'issues',GITHUB_ACTOR:'attacker'}),/FALLBACK_ISSUE/);
  assert.throws(()=>validateDeepEvent({...e,ref:'refs/heads/main'},
    {...base,GITHUB_EVENT_NAME:'push',GITHUB_ACTOR:owner}),/HANDOFF_DEEP_RUNNER_EVENT/);
});

test('bad clock in one pending incident is isolated and reported, not a global stop',()=>{
  const good=fixture(301);
  const bad=fixture(302,'WRITER_B_PC_PREIMAGE_STOP','incorrect-clock');
  const nonPending=fixture(303,'WRITER_B_PC_PREIMAGE_STOP','incorrect-clock');
  nonPending.issue.labels=[{name:'agent-handoff'}];
  const outcome=selectRecentHandoffs([bad.issue,good.issue,nonPending.issue],now);
  assert.deepEqual(outcome.selected.map(x=>x.number),[301]);
  assert.deepEqual(outcome.unknownClockIssues,[302]);
  assert.equal(outcome.cutoff,'2026-11-09T13:00:00.000Z');
});

test('deep runner preserves valid evidence and counts unknown-clock issue',async()=>{
  const good=fixture(310),bad=fixture(311,'WRITER_B_PC_PREIMAGE_STOP','unknown-clock');
  const posts=[],ledger=[];
  const io={
    listIssues:async()=>[bad.issue,good.issue],
    readIssue:async id=>id===310?structuredClone(good.issue):structuredClone(bad.issue),
    readComments:async n=>n===1743?structuredClone(ledger):
      structuredClone(n===310?good.comments:bad.comments),
    readLedger:async()=>({number:1743,state:'open',user:{login:owner},
      body:'<!-- ZGMINI_PROACTIVE_DIAGNOSTIC_LEDGER_R1 -->',comments:ledger.length}),
    readOrigin:async()=>originFor(good),readOriginComments:async()=>[],
    mainSha:async()=>mainSha,compareFile:async()=> 'SAME_BLOB',
    recentHistory:async()=>[],
    postLedger:async body=>{
      posts.push(body);
      ledger.push({id:9300+posts.length,body,created_at:new Date().toISOString(),
        user:{login:'github-actions[bot]'}});
    }
  };
  const result=await processDeepQueue(io,now);
  assert.equal(result.posted,1);
  assert.equal(result.unverified,1);
  assert.deepEqual(result.unknownClockIssues,[311]);
  assert.deepEqual(result.observed.map(x=>x.issue),[310]);
  assert.equal(posts.length,1);
  assert.equal(result.pcOperationalWrites,0);
});

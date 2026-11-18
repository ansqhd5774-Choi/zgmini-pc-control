import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  SCOUT_POLICY,selectRecentFailures,markerFor,recordedFor,classifyLogs,
  assertSameRun,buildDiagnosis
} from '../agent-handoff/proactive-diagnostics.mjs';
import {
  scanLatest,validateScoutEvent,lookbackQuery,REPO,OWNER
} from '../agent-handoff/proactive-diagnostics-runner.mjs';
const now=Date.parse('2026-11-16T13:00:00Z');
const recent='2026-11-16T12:00:00Z',old='2026-08-16T12:00:00Z';
const run=(id,time=recent,extra={})=>({
  id,run_attempt:1,status:'completed',conclusion:'failure',
  name:'Test Consumer',head_sha:'a'.repeat(40),
  event:'workflow_run',created_at:time,...extra
});
const ledger=()=>({number:1743,state:'open',comments:0,
  body:'<!-- ZGMINI_PROACTIVE_DIAGNOSTIC_LEDGER_R1 -->',
  user:{login:OWNER}});
const receipt=(r,id)=>({id,body:markerFor(r)+'\nverified',
  user:{login:'github-actions[bot]'},created_at:recent});
function ioFor(runs,initial=[]){
  const comments=structuredClone(initial),posted=[];
  return {
    listRuns:async()=>structuredClone(runs),
    readLedger:async()=>ledger(),
    readComments:async()=>structuredClone(comments),
    getRun:async id=>structuredClone(runs.find(r=>r.id===id)),
    getJobs:async()=>[{id:550,conclusion:'failure',steps:[{number:3,conclusion:'failure'}]}],
    getLog:async()=> 'AssertionError: a test failed',
    postComment:async body=>{
      posted.push(body);
      comments.push({id:comments.length+1,body,user:{login:'github-actions[bot]'},created_at:recent});
    },
    posted
  };
}
test('recent seven days only, newest-first independent of source list order',()=>{
  const x=selectRecentFailures([
    run(101,'2026-11-15T10:00:00Z'),run(103,old),run(102,recent)
  ],now);
  assert.deepEqual(x.recent.map(r=>r.id),[102,101]);
  assert.equal(x.excludedOld,1);
  assert.equal(x.cutoff,'2026-11-09T13:00:00.000Z');
  assert.equal(lookbackQuery(now),'>=2026-11-09');
});
test('cutoff inclusive; old failures, successes, self failures ignored',()=>{
  const x=selectRecentFailures([
    run(101,'2026-11-09T13:00:00Z'),
    run(102,'2026-11-09T12:59:59Z'),
    run(103,recent,{conclusion:'success'}),
    run(104,recent,{name:'ZGMINI Proactive GitHub Diagnostics'})
  ],now);
  assert.deepEqual(x.recent.map(r=>r.id),[101]);
});
test('invalid/duplicate identity and timestamps stop',()=>{
  assert.throws(()=>selectRecentFailures([run(1),run(1)],now),/DUPLICATE_RUN_STOP/);
  assert.throws(()=>selectRecentFailures([run(1,'bad')],now),/RUN_TIMESTAMP_STOP/);
  assert.throws(()=>selectRecentFailures([run(1,'2099-01-01T00:00:00Z')],now),/RUN_TIMESTAMP_STOP/);
});
test('provenance of bot marker required for dedupe',()=>{
  const r=run(100);
  assert.equal(recordedFor([],r),false);
  assert.equal(recordedFor([receipt(r,1)],r),true);
  assert.throws(()=>recordedFor([{...receipt(r,1),user:{login:OWNER}}],r),/LEDGER_AUTHOR_CONFLICT/);
  assert.throws(()=>recordedFor([receipt(r,1),receipt(r,2)],r),/LEDGER_DUPLICATE_STOP/);
});
test('log signals never expose raw logs or secrets in diagnosis',()=>{
  const hints=classifyLogs('secret=xyz123\nAssertionError\nHTTP 429');
  assert.deepEqual(hints,['RATE_LIMIT_HINT','ASSERTION_HINT']);
  const s=buildDiagnosis(run(100),[{id:500,conclusion:'failure',
    steps:[{number:3,conclusion:'failure'}]}],hints,now);
  assert.match(s,/Run ID \/ attempt: 100 \/ 1/);
  assert.match(s,/Job 500: step 3/);
  assert.doesNotMatch(s,/xyz123|secret=/);
});
test('changed run SHA and status refuse write',()=>{
  assert.throws(()=>assertSameRun(run(1),run(1,recent,{head_sha:'b'.repeat(40)})),/SOURCE_RUN_DRIFT/);
  assert.throws(()=>assertSameRun(run(1),run(1,recent,{conclusion:'success'})),/SOURCE_RUN_DRIFT/);
});
test('recent missing reports are posted newest-first at maximum three per cycle',async()=>{
  const runs=[run(4,'2026-11-14T12:00:00Z'),run(1,old),
    run(2,'2026-11-16T08:00:00Z'),run(5,recent),
    run(3,'2026-11-15T09:00:00Z')];
  const io=ioFor(runs);
  const first=await scanLatest(io,now);
  assert.deepEqual(first.observed.map(x=>x.runId),[5,2,3]);
  assert.equal(first.excludedOld,1);
  assert.equal(first.newReports,3);
  assert.equal(first.pcOperationalWrites,0);
  assert.equal(first.aiCalls,0);
  const second=await scanLatest(io,now);
  assert.deepEqual(second.observed.map(x=>x.runId),[4]);
  const third=await scanLatest(io,now);
  assert.equal(third.newReports,0);
  assert.equal(io.posted.length,4);
});
test('already posted exact run does not block newer unrecorded reports',async()=>{
  const runs=[run(101),run(102,'2026-11-15T00:00:00Z')];
  const io=ioFor(runs,[receipt(runs[0],10)]);
  const result=await scanLatest(io,now);
  assert.deepEqual(result.observed.map(x=>x.runId),[102]);
});
test('ledger invalid or source drift fails before writing',async()=>{
  const io=ioFor([run(101)]);
  io.readLedger=async()=>({...ledger(),state:'closed'});
  await assert.rejects(()=>scanLatest(io,now),/LEDGER_NOT_VERIFIED/);
  assert.equal(io.posted.length,0);
  const io2=ioFor([run(101)]);
  io2.getRun=async()=>run(101,recent,{head_sha:'b'.repeat(40)});
  await assert.rejects(()=>scanLatest(io2,now),/SOURCE_RUN_DRIFT/);
  assert.equal(io2.posted.length,0);
});
test('event gate protects repository, branch, schedule and actor',()=>{
  const event={repository:{full_name:REPO,private:true},schedule:SCOUT_POLICY.schedule};
  const env={GITHUB_REPOSITORY:REPO,GITHUB_EVENT_PATH:'event.json',
    GITHUB_EVENT_NAME:'schedule',GITHUB_REF:'refs/heads/main'};
  assert.doesNotThrow(()=>validateScoutEvent(event,env));
  assert.throws(()=>validateScoutEvent({...event,schedule:'* * * * *'},env),/SCHEDULE_STOP/);
  assert.throws(()=>validateScoutEvent(event,{...env,GITHUB_REF:'refs/heads/dev'}),/MAIN_REF_STOP/);
  assert.throws(()=>validateScoutEvent({...event,repository:{full_name:REPO,private:false}},env),/SCOPE_STOP/);
  assert.doesNotThrow(()=>validateScoutEvent({repository:event.repository,sender:{login:OWNER}},
    {...env,GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_ACTOR:OWNER}));
});
test('new workflow uses existing isolated runner with bounded permissions',()=>{
  const s=readFileSync(new URL('../.github/workflows/agent-handoff-proactive-diagnostics.yml',import.meta.url),'utf8');
  assert.match(s,/cron: '10,25,40,55 \* \* \* \*'/);
  assert.match(s,/actions: read/);assert.match(s,/issues: write/);
  assert.match(s,/runs-on: \[self-hosted, Windows, X64, zgmini-handoff-ci-isolated\]/);
  assert.match(s,/ZGMINI_AGENT_HANDOFF_ENABLED/);
  assert.match(s,/node agent-handoff\/proactive-diagnostics-runner.mjs/);
  assert.doesNotMatch(s,/^  workflow_run:/m);assert.match(s,/issues:/);assert.doesNotMatch(s,/^  push:/m);
  assert.match(s,/types: \[labeled\]/);assert.doesNotMatch(s,/github\.event\.workflow_run/);
  assert.doesNotMatch(s,/pull_request:|contents: write|actions: write/);
});

test('R1 fallback gate allows only verified owner events on main',()=>{
  const e={repository:{full_name:REPO,private:true}};
  const base={GITHUB_REPOSITORY:REPO,GITHUB_REF:'refs/heads/main',GITHUB_EVENT_PATH:'event.json'};
  const accepted={...e,action:'completed',workflow_run:{name:'ZGMINI Handoff Queue Candidate Selector',head_branch:'main',actor:{login:OWNER},conclusion:'success'}};
  assert.doesNotThrow(()=>validateScoutEvent(accepted,{...base,GITHUB_EVENT_NAME:'workflow_run'}));
  assert.throws(()=>validateScoutEvent({...accepted,workflow_run:{...accepted.workflow_run,conclusion:'skipped'}},{...base,GITHUB_EVENT_NAME:'workflow_run'}),/FALLBACK_WORKFLOW_STOP/);
  assert.throws(()=>validateScoutEvent({...accepted,workflow_run:{...accepted.workflow_run,actor:{login:'attacker'}}},{...base,GITHUB_EVENT_NAME:'workflow_run'}),/FALLBACK_WORKFLOW_STOP/);
  assert.throws(()=>validateScoutEvent({...accepted,workflow_run:{...accepted.workflow_run,head_branch:'bad'}},{...base,GITHUB_EVENT_NAME:'workflow_run'}),/FALLBACK_WORKFLOW_STOP/);
  const issue={...e,action:'labeled',label:{name:'handoff-agent-pending'},
    issue:{state:'open',user:{login:OWNER},labels:[{name:'agent-handoff'},{name:'handoff-agent-pending'}]}};
  assert.doesNotThrow(()=>validateScoutEvent(issue,{...base,GITHUB_EVENT_NAME:'issues',GITHUB_ACTOR:OWNER}));
  assert.throws(()=>validateScoutEvent({...issue,label:{name:'other'}},{...base,GITHUB_EVENT_NAME:'issues',GITHUB_ACTOR:OWNER}),/FALLBACK_ISSUE_STOP/);
  assert.throws(()=>validateScoutEvent(issue,{...base,GITHUB_EVENT_NAME:'issues',GITHUB_ACTOR:'attacker'}),/FALLBACK_ISSUE_STOP/);
  assert.throws(()=>validateScoutEvent({...e,ref:'refs/heads/main'},
    {...base,GITHUB_EVENT_NAME:'push',GITHUB_ACTOR:OWNER}),/PROACTIVE_DIAG_RUNNER_EVENT_TYPE_STOP/);
});

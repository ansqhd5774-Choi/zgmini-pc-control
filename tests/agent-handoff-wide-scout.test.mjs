import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  WIDE_POLICY,evaluateWideSnapshot,reportDecision,renderWideReport,snapshotMarker,
  CONTROL_REPO,OWNER
} from '../agent-handoff/wide-scout.mjs';
import {validateWideEvent,scoutWide,RUN_STATUS_PARTITIONS} from '../agent-handoff/wide-scout-runner.mjs';
const now=Date.parse('2026-11-16T15:00:00Z');
const recent='2026-11-16T14:00:00Z';
const older='2026-08-16T12:00:00Z';
const half='2026-11-12T13:00:00Z';
const workflows=[
  'agent-handoff-queue-board.yml',
  'agent-handoff-proactive-diagnostics.yml',
  'agent-handoff-deep-diagnostics.yml'
].map(file=>({file,state:'active'}));
const run=(id,created_at=recent,patch={})=>({
  id,created_at,status:'completed',conclusion:'cancelled',...patch
});
const issue=(n,created_at=half,patch={})=>({
  number:n,created_at,updated_at:created_at,state:'open',
  labels:[{name:'agent-handoff'},{name:'handoff-agent-pending'}],
  user:{login:OWNER},...patch
});
const pr=(n,created_at=half,patch={})=>({
  number:n,created_at,updated_at:created_at,state:'open',draft:false,
  labels:[{name:'agent-handoff-ci'}],user:{login:OWNER},...patch
});
const snapshot=(patch={})=>({
  runs:[],issues:[],pulls:[],workflows,scheduleRunCount:0,
  complete:{runs:true,issues:true,pulls:true},...patch
});
test('expanded categories, old exclusion and newest-first',()=>{
  const sample=evaluateWideSnapshot(snapshot({
    runs:[
      run(1,older),
      run(2,'2026-11-14T14:00:00Z'),
      run(4,recent,{status:'in_progress',conclusion:null,run_started_at:half}),
      run(3,recent,{status:'completed',conclusion:'action_required'}),
      run(5,recent,{status:'completed',conclusion:'failure'})
    ],
    issues:[issue(90),issue(91,older)],
    pulls:[pr(77),pr(78,older)]
  }),now);
  assert.deepEqual(sample.counts,{
    failedHandledByR1:1,delayedRuns:1,cancelled:1,actionRequired:1,
    pendingHandoffs:1,waitingPRs:1
  });
  assert.equal(sample.inventory.oldExcluded,3);
  assert.deepEqual(sample.findings.map(x=>x.id),[4,3,2,90,77]);
  assert.doesNotMatch(renderWideReport(sample),/undefined|secret=/);
});
test('intentional skips and running less than two hours do not create incident',()=>{
  const r=evaluateWideSnapshot(snapshot({
    runs:[run(11,recent,{conclusion:'skipped'}),
      run(12,recent,{status:'queued',conclusion:null})]
  }),now);
  assert.equal(r.findings.length,0);
  assert.equal(r.hasActionableReview,false);
  assert.equal(reportDecision([],r,now),'NO_FINDINGS');
});
test('workflow disabled becomes actionable with no false scheduled claim',()=>{
  const w=structuredClone(workflows);w[1].state='disabled_manually';
  const r=evaluateWideSnapshot(snapshot({workflows:w}),now);
  assert.equal(r.schedule.observedRuns,0);
  assert.equal(r.hasActionableReview,true);
  assert.equal(reportDecision([],r,now),'REPORT');
  assert.match(renderWideReport(r),/disabled_manually/);
});
test('time bounds, identity, and pagination completeness stay explicit',()=>{
  const r=evaluateWideSnapshot(snapshot({runs:[run(10,older)],
    complete:{runs:false,issues:true,pulls:true}}),now);
  assert.equal(r.inventory.complete.runs,false);
  const invalid=evaluateWideSnapshot(snapshot({runs:[run(2),run(2)],
    issues:[issue(4,'not-date')],pulls:[pr(7),pr(7)]}),now);
  assert.deepEqual(invalid.inventory.invalid,{runs:1,issues:1,pulls:1});
  assert.deepEqual(invalid.inventory.complete,{runs:false,issues:false,pulls:false});
  assert.equal(invalid.hasActionableReview,true);
});
test('bot-only duplicate and cooldown protections',()=>{
  const r=evaluateWideSnapshot(snapshot({runs:[run(33)]}),now);
  const body=renderWideReport(r);
  const c={id:123,created_at:recent,user:{login:'github-actions[bot]'},body};
  assert.equal(reportDecision([c],r,now),'DUPLICATE');
  assert.throws(()=>reportDecision([{...c,user:{login:OWNER}}],r,now),/LEDGER_AUTHOR_CONFLICT/);
  const newer=evaluateWideSnapshot(snapshot({runs:[run(34)]}),now);
  assert.equal(reportDecision([c],newer,now),'RATE_LIMIT');
  const aged={...c,created_at:'2026-11-15T04:00:00Z'};
  assert.equal(reportDecision([aged],newer,now),'REPORT');
  assert.match(snapshotMarker(r),/^[<]!-- ZGMINI_WIDE_SCOUT_R3 digest:[a-f0-9]{64} -->$/);
});
test('isolated runner posts one report, readback verifies, rerun deduplicates',async()=>{
  const comments=[],posted=[];
  const io={
    getRuns:async()=>({items:[run(51)],complete:true}),
    getIssues:async()=>({items:[],complete:true}),
    getPulls:async()=>({items:[],complete:true}),
    getWorkflows:async()=>workflows,
    getScheduleCount:async()=>0,
    getLedger:async()=>({number:1743,state:'open',pull_request:null,
      user:{login:OWNER},
      comments:comments.length,
      body:'<!-- ZGMINI_PROACTIVE_DIAGNOSTIC_LEDGER_R1 -->'}),
    getComments:async()=>structuredClone(comments),
    postComment:async body=>{
      posted.push(body);
      comments.push({id:100+posted.length,created_at:recent,
        user:{login:'github-actions[bot]'},body});
    }
  };
  const first=await scoutWide(io,now);
  assert.equal(first.posted,1);
  assert.equal(first.operationalWrites,0);
  const again=await scoutWide(io,now);
  assert.equal(again.posted,0);
  assert.equal(again.decision,'DUPLICATE');
  assert.equal(posted.length,1);
});
test('invalid ledger stops with zero writes',async()=>{
  let writes=0;
  const io={
    getRuns:async()=>({items:[],complete:true}),
    getIssues:async()=>({items:[],complete:true}),
    getPulls:async()=>({items:[],complete:true}),
    getWorkflows:async()=>workflows,
    getScheduleCount:async()=>0,
    getLedger:async()=>({number:1743,state:'closed'}),
    getComments:async()=>[],
    postComment:async()=>{writes++}
  };
  await assert.rejects(()=>scoutWide(io,now),/LEDGER_PROOF/);
  assert.equal(writes,0);
});
test('workflow is guarded on Windows, least-privilege and no production writes',()=>{
  const s=readFileSync(new URL('../.github/workflows/agent-handoff-wide-scout.yml',import.meta.url),'utf8');
  assert.match(s,/cron: '14,29,44,59 \* \* \* \*'/);
  assert.doesNotMatch(s,/^  workflow_run:/m);assert.match(s,/issues:/);
  assert.doesNotMatch(s,/^  push:/m);
  assert.match(s,/pull-requests: read/);
  assert.match(s,/contents: read/);assert.match(s,/actions: read/);
  assert.match(s,/zgmini-handoff-ci-isolated/);
  assert.match(s,/ZGMINI_AGENT_HANDOFF_ENABLED/);
  assert.doesNotMatch(s,/contents: write|actions: write|pull_requests: write/);
});
test('event identity and owner provenance are strict',()=>{
  const e={repository:{private:true,full_name:CONTROL_REPO},
    schedule:WIDE_POLICY.schedule};
  const env={GITHUB_REPOSITORY:CONTROL_REPO,
    GITHUB_EVENT_PATH:'event.json',GITHUB_REF:'refs/heads/main',
    GITHUB_EVENT_NAME:'schedule'};
  assert.doesNotThrow(()=>validateWideEvent(e,env));
  assert.throws(()=>validateWideEvent({...e,schedule:'* * * * *'},env),/SCHEDULE/);
  assert.throws(()=>validateWideEvent(e,{...env,GITHUB_REF:'refs/heads/test'}),/SCOPE/);
  const w={repository:e.repository,action:'completed',workflow_run:{
    name:'ZGMINI Handoff Queue Candidate Selector',actor:{login:OWNER},
    head_branch:'main',conclusion:'success'}};
  assert.doesNotThrow(()=>validateWideEvent(w,{...env,GITHUB_EVENT_NAME:'workflow_run'}));
  assert.throws(()=>validateWideEvent({...w,workflow_run:{...w.workflow_run,
    actor:{login:'attacker'}}},{...env,GITHUB_EVENT_NAME:'workflow_run'}),/WORKFLOW_PROVENANCE/);
  assert.throws(()=>validateWideEvent({...e,ref:'refs/heads/main'},
    {...env,GITHUB_EVENT_NAME:'push',GITHUB_ACTOR:OWNER}),/WIDE_SCOUT_RUNNER_EVENT/);
});

test('status-partition coverage prevents a newest-300-only blind spot',()=>{
  assert.deepEqual(RUN_STATUS_PARTITIONS,[
    'failure','timed_out','cancelled','action_required',
    'queued','waiting','in_progress','pending'
  ]);
  assert.equal(WIDE_POLICY.maxRuns,1600);
  const report=evaluateWideSnapshot(snapshot({
    runs:[run(3,recent,{conclusion:'failure'})],
    coverage:[{status:'failure',count:200,complete:false},
      {status:'cancelled',count:10,complete:true}],
    complete:{runs:false,issues:true,pulls:true}
  }),now);
  assert.equal(report.inventory.complete.runs,false);
  assert.equal(report.inventory.statusCoverage[0].complete,false);
  assert.match(renderWideReport(report),/failure=200\(미완전\)/);
});

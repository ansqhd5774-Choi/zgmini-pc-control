import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  WIDE_POLICY,evaluateWideSnapshot,reportDecision,renderWideReport,snapshotMarker,
  CONTROL_REPO,OWNER
} from '../agent-handoff/wide-scout.mjs';
import {validateWideEvent,scoutWide,RUN_STATUS_PARTITIONS,recentRuns} from '../agent-handoff/wide-scout-runner.mjs';
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
test('cancelled-run flood cannot hide a pending handoff from the 25-row report',()=>{
  const cancelled=Array.from({length:40},(_,i)=>run(1000+i,
    '2026-11-16T14:00:00Z'));
  const sample=evaluateWideSnapshot(snapshot({
    runs:cancelled,
    issues:[issue(900,'2026-11-12T13:00:00Z')],
    pulls:[pr(901,'2026-11-12T13:00:00Z')]
  }),now);
  assert.equal(sample.counts.cancelled,40);
  assert.equal(sample.counts.pendingHandoffs,1);
  assert.equal(sample.counts.waitingPRs,1);
  assert.equal(sample.findings.length,WIDE_POLICY.maxFindings);
  assert.equal(sample.omittedFindings,17);
  assert.ok(sample.findings.some(x=>x.kind==='HANDOFF_AGE_REVIEW'&&x.id===900));
  assert.ok(sample.findings.some(x=>x.kind==='PR_EVIDENCE_REVIEW'&&x.id===901));
  assert.equal(sample.findings.filter(x=>x.kind==='CANCELLED_RUN_REVIEW').length,23);
  assert.ok(sample.findings.every((x,i,a)=>!i||a[i-1].at>=x.at));
  const output=renderWideReport(sample);
  assert.match(output,/HANDOFF_AGE_REVIEW \[#900\]/);
  assert.match(output,/PR_EVIDENCE_REVIEW \[#901\]/);
  assert.doesNotMatch(output,/장애 확정.*cancelled=true/);
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
test('monthly shards preserve one report, readback, and deduplication',async()=>{
  const issues=[],comments=new Map(),posts=[];
  let nextIssue=2000;
  const io={
    getRuns:async()=>({items:[run(51)],complete:true}),
    getIssues:async()=>({items:[],complete:true}),
    getPulls:async()=>({items:[],complete:true}),
    getWorkflows:async()=>workflows,
    getScheduleCount:async()=>0,
    findShards:async month=>issues.filter(x=>x.title.startsWith('ZGMINI Wide Scout '+month+' #')),
    readShard:async n=>issues.find(x=>x.number===n),
    readShardComments:async n=>structuredClone(comments.get(n)||[]),
    createShard:async(month,index,title,marker)=>{
      const issue={number:nextIssue++,title,body:marker,state:'open',user:{login:OWNER}};
      issues.push(issue);comments.set(issue.number,[]);
      return issue;
    },
    postComment:async(n,body)=>{
      posts.push({n,body});
      comments.get(n).push({id:100+posts.length,created_at:recent,
        user:{login:'github-actions[bot]'},body});
    }
  };
  const first=await scoutWide(io,now);
  assert.equal(first.posted,1);
  assert.equal(first.operationalWrites,0);
  assert.equal(issues.length,1);
  assert.match(issues[0].title,/ZGMINI Wide Scout 2026-11 #1/);
  const again=await scoutWide(io,now);
  assert.equal(again.posted,0);
  assert.equal(again.decision,'DUPLICATE');
  assert.equal(posts.length,1);
  issues[0].body='forged marker';
  await assert.rejects(()=>scoutWide(io,now),/SHARD_IDENTITY/);
});
test('incomplete listings are reportable without treating absence as healthy',()=>{
  const report=evaluateWideSnapshot(snapshot({
    complete:{runs:false,issues:true,pulls:true}
  }),now);
  assert.equal(report.hasActionableReview,true);
  assert.equal(reportDecision([],report,now),'REPORT');
  assert.match(renderWideReport(report),/INCOMPLETE_EVIDENCE/);
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
  assert.throws(()=>validateWideEvent({...e,ref:'refs/heads/main'},
    {...env,GITHUB_EVENT_NAME:'push',GITHUB_ACTOR:OWNER}),/WIDE_SCOUT_RUNNER_EVENT/);
});

test('seven-day overflow uses bounded UTC daily queries to recover all recent failures and cancellations',async()=>{
 const time=Date.parse('2026-11-16T15:00:00Z');
 const data=[];
 for(const [kind,idOffset] of [['failure',0],['cancelled',1000]]){
  for(let day=10;day<=16;day++)for(let i=0;i<30;i++)data.push({
   id:idOffset+day*100+i,created_at:'2026-11-'+String(day)+'T12:00:00Z',
   run_started_at:'2026-11-'+String(day)+'T12:00:00Z',
   status:'completed',conclusion:kind
  });
 }
 let calls=0;
 const fetchRun=async resource=>{
  calls++;
  const q=new URL(resource,'https://api.github.com/').searchParams;
  const kind=q.get('status'),created=q.get('created'),page=Number(q.get('page'));
  const sorted=data.filter(x=>x.conclusion===kind&&
    (created.startsWith('>=')?x.created_at.slice(0,10)>=created.slice(2):
      x.created_at.slice(0,10)===created)).sort((a,b)=>b.id-a.id);
  return {workflow_runs:sorted.slice((page-1)*100,page*100)};
 };
 const result=await recentRuns(time,fetchRun);
 assert.equal(result.complete,true);
 assert.equal(result.items.length,420);
 assert.deepEqual(result.coverage.filter(x=>['failure','cancelled'].includes(x.status))
   .map(x=>[x.count,x.complete]),[[210,true],[210,true]]);
 assert.ok(calls<=44,'bounded page calls without an unlimited retry');
});
test('saturated cancellation day recovers 288 runs via bounded hourly queries',async()=>{
 const time=Date.parse('2026-11-16T15:00:00Z');
 const runs=Array.from({length:288},(_,i)=>{
   const hour=String(i%24).padStart(2,'0');
   const minute=String(Math.floor(i/24)).padStart(2,'0');
   return {id:1000+i,status:'completed',conclusion:'cancelled',
     created_at:'2026-11-16T'+hour+':'+minute+':00Z'};
 });
 let count=0;
 const requestRuns=async resource=>{
   count++;
   const q=new URL(resource,'https://api.github.com/').searchParams;
   const status=q.get('status'),created=q.get('created');
   const page=Number(q.get('page'));
   let matches=runs.filter(x=>x.conclusion===status);
   if(created.includes('..')){
     const [start,end]=created.split('..');
     matches=matches.filter(x=>x.created_at>=start&&x.created_at<=end);
   }else if(created.startsWith('>=')){
     matches=matches.filter(x=>x.created_at.slice(0,10)>=created.slice(2));
   }else matches=matches.filter(x=>x.created_at.slice(0,10)===created);
   matches.sort((a,b)=>b.created_at.localeCompare(a.created_at)||b.id-a.id);
   return {workflow_runs:matches.slice((page-1)*100,page*100)};
 };
 const result=await recentRuns(time,requestRuns);
 assert.equal(result.complete,true);
 assert.equal(result.items.length,288);
 assert.equal(result.coverage.find(x=>x.status==='cancelled').count,288);
 assert.equal(new Set(result.items.map(x=>x.id)).size,288);
 assert.ok(count<=50,'hourly extension stays bounded and skips ordinary statuses');
});
test('five saturated days fit the shared 96-call partition budget',async()=>{
 const time=Date.parse('2026-11-16T15:00:00Z');
 const dates=['2026-11-11','2026-11-12','2026-11-13','2026-11-14','2026-11-15'];
 const runs=dates.flatMap((date,di)=>Array.from({length:250},(_,i)=>({
   id:30000+di*250+i,status:'completed',conclusion:'cancelled',
   created_at:date+'T'+String(i%24).padStart(2,'0')+':'+
     String(Math.floor(i/24)).padStart(2,'0')+':00Z'
 })));
 let totalCalls=0,segmentedCalls=0;
 const requestRuns=async resource=>{
   totalCalls++;
   const params=new URL(resource,'https://api.github.com/').searchParams;
   const status=params.get('status'),created=params.get('created');
   const page=Number(params.get('page'));
   if(created.includes('..'))segmentedCalls++;
   let rows=runs.filter(x=>x.conclusion===status);
   if(created.includes('..')){
     const [from,to]=created.split('..');
     rows=rows.filter(x=>x.created_at>=from&&x.created_at<=to);
   }else if(created.startsWith('>=')){
     rows=rows.filter(x=>x.created_at.slice(0,10)>=created.slice(2));
   }else rows=rows.filter(x=>x.created_at.slice(0,10)===created);
   rows.sort((a,b)=>b.created_at.localeCompare(a.created_at)||b.id-a.id);
   return {workflow_runs:rows.slice((page-1)*100,page*100)};
 };
 const result=await recentRuns(time,requestRuns);
 assert.equal(result.complete,true);
 assert.equal(result.items.length,1250);
 assert.equal(result.coverage.find(x=>x.status==='cancelled').count,1250);
 assert.equal(new Set(result.items.map(x=>x.id)).size,1250);
 assert.ok(segmentedCalls<=60,'only busy days need bounded four-hour ranges');
 assert.ok(totalCalls<=96,'all regular and secondary calls remain economical');
});

test('unsupported hourly filter cannot fake complete day coverage',async()=>{
 const time=Date.parse('2026-11-16T15:00:00Z');
 const all=Array.from({length:230},(_,i)=>({
  id:2000+i,created_at:'2026-11-16T12:00:00Z',
  status:'completed',conclusion:'cancelled'})).reverse();
 const requestRuns=async resource=>{
  const q=new URL(resource,'https://api.github.com/').searchParams;
  const page=Number(q.get('page'));
  if(q.get('status')!=='cancelled'||q.get('created').includes('..')||
    !(q.get('created')==='2026-11-16'||q.get('created').startsWith('>=')))
   return {workflow_runs:[]};
  return {workflow_runs:all.slice((page-1)*100,page*100)};
 };
 const result=await recentRuns(time,requestRuns);
 assert.equal(result.complete,false);
 assert.equal(result.coverage.find(x=>x.status==='cancelled').complete,false);
 assert.equal(result.coverage.find(x=>x.status==='cancelled').count,200);
});
test('overfull single-day inventory remains incomplete rather than falsely verified',async()=>{
 const time=Date.parse('2026-11-16T15:00:00Z');
 const rows=Array.from({length:230},(_,i)=>({
  id:i+1,status:'completed',conclusion:'failure',
  created_at:'2026-11-16T12:00:00Z'
 })).reverse();
 const fetchRun=async resource=>{
  const q=new URL(resource,'https://api.github.com/').searchParams;
  const page=Number(q.get('page'));
  return {workflow_runs:q.get('status')==='failure'&&
   (q.get('created').startsWith('>=')||q.get('created')==='2026-11-16')?
   rows.slice((page-1)*100,page*100):[]};
 };
 const result=await recentRuns(time,fetchRun);
 assert.equal(result.complete,false);
 assert.deepEqual(result.coverage.find(x=>x.status==='failure'),{
  status:'failure',count:200,complete:false
 });
});
test('under-cap status inventory retains the existing one-page read pattern',async()=>{
 const time=Date.parse('2026-11-16T15:00:00Z');
 const calls=[];
 const result=await recentRuns(time,async resource=>{
  calls.push(resource);
  return {workflow_runs:[]};
 });
 assert.equal(result.complete,true);
 assert.equal(result.items.length,0);
 assert.equal(calls.length,RUN_STATUS_PARTITIONS.length);
 assert.ok(calls.every(q=>q.includes('per_page=100&page=1')));
 assert.ok(calls.every(q=>!q.includes('..')));
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

test('shard closing after selection recovers with a fresh authenticated shard',async()=>{
  const entries=[];const comments=new Map();let next=4000,closedOnce=false;
  const io={
    getRuns:async()=>({items:[],complete:true,coverage:[]}),
    getIssues:async()=>({items:[],complete:true}),
    getPulls:async()=>({items:[],complete:true}),
    getWorkflows:async()=>workflows.map((w,i)=>i===0?{...w,state:'disabled_manually'}:w),
    getScheduleCount:async()=>0,
    findShards:async()=>{
      // Close the first shard immediately before post-selection readback.
      if(entries.length===1&&!closedOnce){entries[0].state='closed';closedOnce=true;}
      return entries.map(x=>({...x}));
    },
    readShard:async n=>entries.find(x=>x.number===n),
    readShardComments:async n=>[...(comments.get(n)||[])],
    createShard:async(month,index,title,marker)=>{
      const item={number:next++,title,body:marker,state:'open',user:{login:OWNER}};
      entries.push(item);comments.set(item.number,[]);return item;
    },
    postComment:async(n,body)=>comments.get(n).push({
      id:1,created_at:recent,user:{login:'github-actions[bot]'},body
    })
  };
  const result=await scoutWide(io,now);
  assert.equal(result.posted,1);
  assert.equal(entries.length,2);
  assert.equal(entries[0].state,'closed');
  assert.equal(comments.get(entries[0].number).length,0);
  assert.equal(comments.get(entries[1].number).length,1);
});

test('full historical read window does not globally block shard rotation',()=>{
  const report=evaluateWideSnapshot(snapshot({workflows:workflows.map((w,i)=>
    i===0?{...w,state:'disabled_manually'}:w)}),now);
  const comments=Array.from({length:WIDE_POLICY.maxComments},(_,i)=>({
    id:i+1,created_at:older,user:{login:'github-actions[bot]'},body:'historical '+i
  }));
  assert.equal(reportDecision(comments,report,now),'REPORT');
});

test('shard filling after selection recovers without posting to full shard',async()=>{
  const entries=[],comments=new Map();let next=5000,filled=false;
  const io={
    getRuns:async()=>({items:[],complete:true}),
    getIssues:async()=>({items:[],complete:true}),
    getPulls:async()=>({items:[],complete:true}),
    getWorkflows:async()=>workflows.map((w,i)=>i===0?{...w,state:'disabled_manually'}:w),
    getScheduleCount:async()=>0,
    findShards:async()=>{
      if(entries.length===1&&!filled){
        comments.set(entries[0].number,Array.from({length:WIDE_POLICY.maxComments},
          (_,i)=>({id:i+1,created_at:older,user:{login:'github-actions[bot]'},body:'historical '+i})));
        filled=true;
      }
      return entries.map(x=>({...x}));
    },
    readShard:async n=>entries.find(x=>x.number===n),
    readShardComments:async n=>[...(comments.get(n)||[])],
    createShard:async(month,index,title,marker)=>{
      const item={number:next++,title,body:marker,state:'open',user:{login:OWNER}};
      entries.push(item);comments.set(item.number,[]);return item;
    },
    postComment:async(n,body)=>comments.get(n).push({
      id:9000,created_at:recent,user:{login:'github-actions[bot]'},body
    })
  };
  const result=await scoutWide(io,now);
  assert.equal(result.posted,1);
  assert.equal(entries.length,2);
  assert.equal(comments.get(entries[0].number).length,WIDE_POLICY.maxComments);
  assert.equal(comments.get(entries[1].number).length,1);
});

test('second shard closure preserves SHARD_WRITE_SCOPE safe stop',async()=>{
  const entries=[];const comments=new Map();let next=6000;
  const io={
    getRuns:async()=>({items:[],complete:true}),
    getIssues:async()=>({items:[],complete:true}),
    getPulls:async()=>({items:[],complete:true}),
    getWorkflows:async()=>workflows.map((w,i)=>i===0?{...w,state:'disabled_manually'}:w),
    getScheduleCount:async()=>0,
    findShards:async()=>{
      if(entries.length)entries.at(-1).state='closed';
      return entries.map(x=>({...x}));
    },
    readShard:async n=>entries.find(x=>x.number===n),
    readShardComments:async n=>[...(comments.get(n)||[])],
    createShard:async(month,index,title,marker)=>{
      const item={number:next++,title,body:marker,state:'open',user:{login:OWNER}};
      entries.push(item);comments.set(item.number,[]);return item;
    },
    postComment:async(n,body)=>comments.get(n).push({id:1,created_at:recent,
      user:{login:'github-actions[bot]'},body})
  };
  await assert.rejects(()=>scoutWide(io,now),/SHARD_WRITE_SCOPE/);
  assert.equal(entries.length,2);
  assert.equal([...comments.values()].reduce((sum,c)=>sum+c.length,0),0);
});

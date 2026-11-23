import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  SCOUT_POLICY,selectRecentFailures,markerFor,recordedFor,classifyLogs,
  assertSameRun,buildDiagnosis
} from '../agent-handoff/proactive-diagnostics.mjs';
import {
  scanLatest,validateScoutEvent,lookbackQuery,readLegacyProactiveArchive,githubRequestPhase,github403Signal,readBoundedLogEvidence,REPO,OWNER
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
  const shards=new Map();let nextIssue=3000;
  const archive=[{id:7006077223,body:'<!-- ZGMINI_PROACTIVE_DIAG_R1 run:44467706543 attempt:1 -->',user:{login:'github-actions[bot]'},created_at:recent}];
  return {
    listRuns:async()=>structuredClone(runs),
    readLedger:async()=>ledger(),
    readLegacyComments:async()=>structuredClone(archive),
    findShards:async month=>[...shards.values()].filter(x=>x.issue.title.startsWith('ZGMINI Proactive Diagnostics '+month+' #')).map(x=>structuredClone(x.issue)),
    readShard:async n=>structuredClone(shards.get(n).issue),
    readShardComments:async n=>structuredClone(shards.get(n).comments),
    createShard:async(month,index,title,body)=>{
      const issue={number:nextIssue++,title,body,state:'open',user:{login:OWNER},labels:[{name:SCOUT_POLICY.shardLabel}]};
      shards.set(issue.number,{issue,comments:[]});return {number:issue.number};
    },
    getRun:async id=>structuredClone(runs.find(r=>r.id===id)),
    getJobs:async()=>[{id:550,conclusion:'failure',steps:[{number:3,conclusion:'failure'}]}],
    getLog:async()=> 'AssertionError: a test failed',
    postComment:async (n,body)=>{
      posted.push(body);
      const a=shards.get(n).comments;
      a.push({id:10000+posted.length,body,user:{login:'github-actions[bot]'},created_at:recent});
    },
    posted,shards
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
test('invalid/duplicate identity and timestamps isolate unverified runs',()=>{
  assert.equal(selectRecentFailures([run(1),run(1),run(2)],now).recent.map(x=>x.id).join(','),'2');
  assert.equal(selectRecentFailures([run(1,'bad'),run(2)],now).unverified,1);
  assert.equal(selectRecentFailures([run(1,'2099-01-01T00:00:00Z'),run(2)],now).recent.length,1);
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
test('passing TAP test titles do not turn an unrelated CI failure into HTTP 503 outage',()=>{
  const lines=[
    '2026-11-23T03:27:26.3056850Z # Subtest: fresh latest HTTP 503 stays failed despite burst-derived cadence',
    '2026-11-23T03:27:26.3057527Z ok 24 - fresh latest HTTP 503 stays failed despite burst-derived cadence',
    '2026-11-23T03:27:55.0336906Z ##[error]Process completed with exit code 1.'
  ];
  assert.deepEqual(classifyLogs(lines.join('\n')),[]);
  assert.deepEqual(classifyLogs([...lines,
    '2026-11-23T03:27:52.8015570Z not ok 175 - actual regression failure'].join('\n')),
    ['ASSERTION_HINT']);
  assert.deepEqual(classifyLogs('2026-11-23T03:27:27.000Z ##[error]HTTP 503 from provider'),
    ['UPSTREAM_5XX_HINT']);
});
test('large CI log captures actual failed TAP tests in the tail within the 128 KiB budget',()=>{
  // Reproduces the original 358 KiB Job 137206882613 layout: the first
  // not-ok line only appears after the initial 128 KiB window.
  const passed='2026-11-22T12:23:01Z # Subtest: healthy fixture HTTP 503 was rejected\n'+
    '2026-11-22T12:23:02Z ok 9 - healthy fixture HTTP 503 was rejected\n';
  const text=passed+'2026-11-22T12:23:10Z PASS fixture\n'.repeat(9000)+
    '2026-11-22T12:24:42Z not ok 133 - actual regression failure\n'+
    '2026-11-22T12:24:43Z harmless output\n'.repeat(1800);
  assert.ok(text.indexOf('not ok 133')>131072);
  assert.ok(text.length-text.indexOf('not ok 133')<114688);
  assert.deepEqual(classifyLogs(text),['ASSERTION_HINT']);
  assert.deepEqual(classifyLogs(passed+'normal line\n'.repeat(19000)),[]);
  const trueUpstream='2026-11-22T12:24:43Z ##[error]HTTP 503 from provider\n';
  assert.deepEqual(classifyLogs('previous successful CI log\n'.repeat(9500)+trueUpstream),
    ['UPSTREAM_5XX_HINT']);
});
test('actual GitHub log stream retains late failure and discards private middle',async()=>{
 const pass='2026-11-23T07:00:00Z # Subtest: HTTP 503 success fixture\n'+
  '2026-11-23T07:00:01Z ok 1 - HTTP 503 success fixture\n';
 const middle='2026-11-23T07:00:02Z clean CI output\n'.repeat(1200)+
  'secret=UNPUBLISHED_PRIVATE_MIDDLE\n'+
  '2026-11-23T07:00:03Z clean CI output\n'.repeat(7800);
 const failure='2026-11-23T07:01:00Z not ok 133 - real failing Windows test\n';
 const body=pass+middle+failure+'2026-11-23T07:02:00Z clean footer\n'.repeat(2200);
 assert.ok(body.length>300000&&body.indexOf('not ok 133')>131072);
 const bytes=new TextEncoder().encode(body);
 let offset=0;
 const reader={read:async()=>offset>=bytes.length?{done:true}:({
  done:false,value:bytes.subarray(offset,offset+=8192)
 })};
 const excerpt=await readBoundedLogEvidence(reader);
 assert.ok(excerpt.length<=131072);
 assert.ok(excerpt.includes('not ok 133'));
 assert.ok(!excerpt.includes('UNPUBLISHED_PRIVATE_MIDDLE'));
 assert.deepEqual(classifyLogs(excerpt),['ASSERTION_HINT']);
});
test('real streamed 112-128 KiB logs retain first error and every byte exactly once',async()=>{
 for(const length of [114688,114689,120000,131071,131072]){
  const first='2026-11-23T08:00:00Z ##[error]HTTP 503 provider outage\n';
  const last='\n2026-11-23T08:00:01Z log completed\n';
  const middle='Z'.repeat(length-first.length-last.length);
  const original=first+middle+last;
  assert.equal(new TextEncoder().encode(original).length,length);
  const raw=new TextEncoder().encode(original);
  let i=0;
  const reader={read:async()=>i>=raw.length?{done:true}:(()=>{
   const end=Math.min(i+4093,raw.length);
   const value=raw.subarray(i,end);i=end;
   return {done:false,value};
  })()};
  const received=await readBoundedLogEvidence(reader);
  assert.equal(received,original,'exact byte-preservation at length '+length);
  assert.deepEqual(classifyLogs(received),['UPSTREAM_5XX_HINT']);
 }
});
test('bounded log reader keeps small errors and fails closed on overlarge logs',async()=>{
 const bytes=new TextEncoder().encode('##[error]HTTP 503 from provider\n');
 const reader={read:async()=>reader.done?{done:true}:(reader.done=true,{done:false,value:bytes})};
 assert.deepEqual(classifyLogs(await readBoundedLogEvidence(reader)),['UPSTREAM_5XX_HINT']);
 let served=0;
 const huge={read:async()=>({done:false,value:new Uint8Array(65536).fill(++served)})};
 await assert.rejects(()=>readBoundedLogEvidence(huge),/LOG_READ_LIMIT/);
 assert.ok(served<=65);
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
  const io=ioFor(runs);
  // Existing report on an authenticated current shard.
  await io.createShard('2026-11',1,'ZGMINI Proactive Diagnostics 2026-11 #1','<!-- ZGMINI_PROACTIVE_DIAGNOSTIC_LEDGER_R2 month:2026-11 shard:1 -->');
  io.shards.get(3000).comments.push(receipt(runs[0],10));
  const result=await scanLatest(io,now);
  assert.deepEqual(result.observed.map(x=>x.runId),[102]);
});
test('authenticated month snapshot deduplicates many previously recorded runs with one shard read',async()=>{
  const runs=[run(201),run(202),run(203),run(204)];
  const io=ioFor(runs);
  const issue=await io.createShard('2026-11',1,
    'ZGMINI Proactive Diagnostics 2026-11 #1',
    '<!-- ZGMINI_PROACTIVE_DIAGNOSTIC_LEDGER_R2 month:2026-11 shard:1 -->');
  runs.forEach((r,i)=>io.shards.get(issue.number).comments.push(receipt(r,500+i)));
  const search=io.findShards,read=io.readShardComments;
  let searches=0,reads=0;
  io.findShards=async month=>{searches++;return search(month);};
  io.readShardComments=async n=>{reads++;return read(n);};
  const result=await scanLatest(io,now);
  assert.equal(result.alreadyRecorded,4);
  assert.equal(result.newReports,0);
  assert.equal(searches,1);
  assert.equal(reads,1);
  assert.equal(io.posted.length,0);
});

test('existing authenticated shard needs no redundant full index reload before POST',async()=>{
  const io=ioFor([run(211)]);
  const issue=await io.createShard('2026-11',1,
    'ZGMINI Proactive Diagnostics 2026-11 #1',
    '<!-- ZGMINI_PROACTIVE_DIAGNOSTIC_LEDGER_R2 month:2026-11 shard:1 -->');
  const find=io.findShards,read=io.readShardComments;
  let searches=0,reads=0;
  io.findShards=async m=>{searches++;return find(m);};
  io.readShardComments=async n=>{reads++;return read(n);};
  const result=await scanLatest(io,now);
  assert.equal(result.newReports,1);
  assert.equal(result.observed[0].shardIssue,issue.number);
  // Initial check, fresh pre-write check, and post-write readback only.
  assert.equal(searches,3);
  assert.equal(reads,3);
  assert.equal(io.posted.length,1);
});

test('new shard still requires full index recheck before write',async()=>{
  const io=ioFor([run(212)]);
  const find=io.findShards;
  let searches=0;
  io.findShards=async m=>{searches++;return find(m);};
  const result=await scanLatest(io,now);
  assert.equal(result.newReports,1);
  // Includes the additional verification needed after shard creation.
  assert.equal(searches,4);
  assert.equal(io.posted.length,1);
});

test('cached absent marker is refreshed before write and cannot duplicate another recorded run',async()=>{
  const runs=[run(301),run(302)];
  const io=ioFor(runs);
  const issue=await io.createShard('2026-11',1,
    'ZGMINI Proactive Diagnostics 2026-11 #1',
    '<!-- ZGMINI_PROACTIVE_DIAGNOSTIC_LEDGER_R2 month:2026-11 shard:1 -->');
  const read=io.readShardComments;
  let reads=0;
  io.readShardComments=async n=>{
    reads++;
    // A concurrent authenticated report appears after the cached first read.
    if(reads===2)io.shards.get(issue.number).comments.push(receipt(runs[0],600));
    return read(n);
  };
  const result=await scanLatest(io,now);
  assert.equal(result.newReports,1);
  assert.equal(result.alreadyRecorded,1);
  assert.deepEqual(result.observed.map(x=>x.runId),[302]);
  assert.equal(io.posted.length,1);
});

test('ledger invalid or source drift fails before writing',async()=>{
  const io=ioFor([run(101)]);
  io.readLedger=async()=>({...ledger(),state:'closed'});
  await assert.rejects(()=>scanLatest(io,now),/LEDGER_NOT_VERIFIED/);
  assert.equal(io.posted.length,0);
  const io2=ioFor([run(101)]);
  io2.getRun=async()=>run(101,recent,{head_sha:'b'.repeat(40)});
  const result=await scanLatest(io2,now);
  assert.equal(result.unverified,1);
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

test('legacy archive stops at pinned authenticated 167th R1 report',async()=>{
  const rows=Array.from({length:166},(_,i)=>({id:100+i,body:markerFor(run(i+1))+'\nverified',user:{login:'github-actions[bot]'},created_at:recent}));
  rows.push({id:7006077223,body:'<!-- ZGMINI_PROACTIVE_DIAG_R1 run:44467706543 attempt:1 -->',user:{login:'github-actions[bot]'},created_at:recent});
  const pages=[rows.slice(0,100),rows.slice(100)];
  const found=await readLegacyProactiveArchive(async page=>pages[page-1]||[]);
  assert.equal(found.length,167);
  await assert.rejects(()=>readLegacyProactiveArchive(async()=>[]),/ARCHIVE_ANCHOR_NOT_FOUND/);
});
test('shard rollover and 401 stop are independent of shared ledger count',async()=>{
  const io=ioFor([run(500)]);
  io.readLedger=async()=>({...ledger(),comments:999});
  const first=await scanLatest(io,now);
  assert.equal(first.newReports,1);
  assert.equal(first.reportStore,'MONTHLY_SHARDED_ISSUES');
  assert.equal(io.shards.size,1);
  const io2=ioFor([run(501)]);
  io2.getRun=async()=>{throw Error('PROACTIVE_DIAG_RUNNER_GITHUB_HTTP_401');};
  await assert.rejects(()=>scanLatest(io2,now),/GITHUB_HTTP_401/);
  assert.equal(io2.posted.length,0);
});
test('bad run evidence is isolated while independent run posts',async()=>{
  const io=ioFor([run(601),run(602)]);
  io.getJobs=async id=>id===601?null:[{id:550,conclusion:'failure'}];
  const result=await scanLatest(io,now);
  assert.equal(result.unverified,1);
  assert.equal(result.newReports,1);
  assert.equal(result.observed[0].runId,602);
});

test('300-comment shard rotation continues on an independently authenticated next shard',async()=>{
  const io=ioFor([run(710)]);
  await io.createShard('2026-11',1,
    'ZGMINI Proactive Diagnostics 2026-11 #1',
    '<!-- ZGMINI_PROACTIVE_DIAGNOSTIC_LEDGER_R2 month:2026-11 shard:1 -->');
  for(let i=0;i<300;i++)io.shards.get(3000).comments.push(
    receipt(run(10000+i),900000+i));
  const result=await scanLatest(io,now);
  assert.equal(result.newReports,1);
  assert.equal(result.observed[0].shardIssue,3001);
  assert.equal(io.shards.get(3000).comments.length,300);
  assert.equal(io.shards.get(3001).comments.length,1);
});

test('lost comment acknowledgement is reconciled without a second write',async()=>{
  const io=ioFor([run(720)]);
  const original=io.postComment;let calls=0;
  io.postComment=async(n,body)=>{calls++;await original(n,body);throw Error('lost ACK');};
  const result=await scanLatest(io,now);
  assert.equal(result.newReports,1);
  assert.equal(calls,1);
  const again=await scanLatest(io,now);
  assert.equal(again.newReports,0);
  assert.equal(again.alreadyRecorded,1);
  assert.equal(calls,1);
});

test('complete old archive prohibits a duplicate new shard report',async()=>{
  const oldRun=run(730),io=ioFor([oldRun]);
  io.readLegacyComments=async()=>[
    {id:SCOUT_POLICY.legacyAnchorCommentId,body:markerFor(oldRun),
      user:{login:'github-actions[bot]'},created_at:recent}
  ];
  const result=await scanLatest(io,now);
  assert.equal(result.newReports,0);
  assert.equal(result.alreadyRecorded,1);
  assert.equal(io.shards.size,0);
});

test('ambiguous shard creation without readback is stopped and not retried',async()=>{
  const io=ioFor([run(740)]);
  let count=0;
  io.createShard=async()=>{count++;throw Error('POST response lost');};
  await assert.rejects(()=>scanLatest(io,now),/SHARD_CREATE_OUTCOME_UNKNOWN/);
  assert.equal(count,1);
  assert.equal(io.posted.length,0);
});

test('shard creation 403 retains exact API phase after no-create readback',async()=>{
  const io=ioFor([run(741)]);
  let attempts=0;
  io.createShard=async()=>{
    attempts++;
    throw Error('PROACTIVE_DIAG_RUNNER_GITHUB_HTTP_403_SHARD_CREATE');
  };
  await assert.rejects(()=>scanLatest(io,now),
    /PROACTIVE_DIAG_RUNNER_GITHUB_HTTP_403_SHARD_CREATE/);
  assert.equal(attempts,1);
  assert.equal(io.shards.size,0);
  assert.equal(io.posted.length,0);
});

test('comment 403 retains exact API phase with one POST and zero duplicates',async()=>{
  const io=ioFor([run(742)]);
  let attempts=0;
  io.postComment=async()=>{
    attempts++;
    throw Error('PROACTIVE_DIAG_RUNNER_GITHUB_HTTP_403_COMMENT_WRITE');
  };
  await assert.rejects(()=>scanLatest(io,now),
    /PROACTIVE_DIAG_RUNNER_GITHUB_HTTP_403_COMMENT_WRITE/);
  assert.equal(attempts,1);
  assert.equal(io.posted.length,0);
  assert.equal([...io.shards.values()][0].comments.length,0);
});

test('invalid run cannot suppress a later valid run in newest-first scan',async()=>{
  const io=ioFor([run(800,'bad'),run(801)]);
  const result=await scanLatest(io,now);
  assert.equal(result.unverified,1);
  assert.equal(result.newReports,1);
  assert.equal(result.observed[0].runId,801);
});

test('403 response classifies only bounded rate-limit signal, not speculative permission cause',()=>{
  assert.equal(github403Signal(new Headers({'x-ratelimit-remaining':'0'})),'RATE_LIMIT_SIGNAL');
  assert.equal(github403Signal(new Headers({'retry-after':'30'})),'RATE_LIMIT_SIGNAL');
  assert.equal(github403Signal(new Headers({'x-ratelimit-remaining':'40'})),'CAUSE_UNVERIFIED');
  assert.equal(github403Signal(new Headers()),'CAUSE_UNVERIFIED');
  assert.equal(github403Signal(null),'CAUSE_UNVERIFIED');
  const source=readFileSync(new URL('../agent-handoff/proactive-diagnostics-runner.mjs',import.meta.url),'utf8');
  assert.match(source,/res.status===403\?'_'\+github403Signal\(res.headers\)/);
  assert.doesNotMatch(source,/console\.log\(res\.headers\)|res\.headers\.entries\(\)/);
});

test('403 rate-limit classification preserves fail-closed write and no repeat POST',async()=>{
  const io=ioFor([run(743)]);
  let calls=0;
  io.postComment=async()=>{
    calls++;
    throw Error('PROACTIVE_DIAG_RUNNER_GITHUB_HTTP_403_COMMENT_WRITE_RATE_LIMIT_SIGNAL');
  };
  await assert.rejects(()=>scanLatest(io,now),/GITHUB_HTTP_403_COMMENT_WRITE_RATE_LIMIT_SIGNAL/);
  assert.equal(calls,1);
  assert.equal(io.posted.length,0);
});

test('403 diagnostics identify only a fixed API phase without exposing query or job identity',()=>{
  assert.equal(githubRequestPhase('actions/runs?status=failure&created=secret'),'RUN_INVENTORY');
  assert.equal(githubRequestPhase('actions/runs/123/attempts/1/jobs?per_page=100'),'RUN_JOBS');
  assert.equal(githubRequestPhase('actions/runs/123'),'RUN_IDENTITY');
  assert.equal(githubRequestPhase('actions/jobs/123/logs'),'JOB_LOG');
  assert.equal(githubRequestPhase('search/issues?q=private-value'),'SHARD_INDEX');
  assert.equal(githubRequestPhase('issues/1743/comments?per_page=100'),'LEDGER_COMMENTS');
  assert.equal(githubRequestPhase('issues/1743/comments','POST'),'COMMENT_WRITE');
  assert.equal(githubRequestPhase('issues','POST'),'SHARD_CREATE');
  assert.equal(githubRequestPhase('other?token=private'),'OTHER');
  const source=readFileSync(new URL('../agent-handoff/proactive-diagnostics-runner.mjs',import.meta.url),'utf8');
  assert.match(source,/GITHUB_HTTP_.*githubRequestPhase\(resource,method\)/);
  assert.doesNotMatch(source,/res\.status\+'_'+resource/);
});

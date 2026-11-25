import test from 'node:test';
import assert from 'node:assert/strict';
import {collectMetrics,summarizeJobs,githubRead} from '../scripts/ci-job-metrics.mjs';

const repository='ansqhd5774-Choi/zgmini-pc-control';
const workflow='C996 R5 Readonly Source Checks';
const workflowId=9123;
const catalog=(rows=[{id:workflowId,name:workflow}])=>({
 total_count:rows.length,workflows:rows
});
const namedRuns=(rows=[])=>({total_count:rows.length,workflow_runs:rows});
const date=s=>'2026-11-24T19:00:'+s+'Z';
const job=(conclusion,created,started,completed)=>({
 status:'completed',conclusion,created_at:created,started_at:started,completed_at:completed
});
const run=(id,conclusion,name=workflow,attempt=1)=>({
 id,run_attempt:attempt,name,status:'completed',conclusion
});

test('measures GitHub Job queue separately from execution and retains failed runs',async()=>{
 const calls=[];
 const data={'actions/workflows?per_page=100':catalog([
  {id:workflowId,name:workflow},{id:9124,name:'Other Workflow'}
 ]),['actions/workflows/'+workflowId+'/runs?per_page=100']:namedRuns([
  run(123,'success'),run(124,'failure',workflow,2),run(125,'success','Other Workflow')
 ]),'actions/runs/123/attempts/1/jobs?per_page=100':{total_count:1,jobs:[
  job('success',date('00'),date('03'),date('13'))
 ]},'actions/runs/124/attempts/2/jobs?per_page=100':{total_count:2,jobs:[
  job('failure',date('00'),date('07'),date('22')),
  job('skipped',date('00'),null,null)
 ]}};
 const report=await collectMetrics({repository,workflow,request:async path=>{
  calls.push(path);assert.ok(path in data);return data[path];
 }});
 assert.deepEqual(calls,['actions/workflows?per_page=100',
  'actions/workflows/'+workflowId+'/runs?per_page=100',
  'actions/runs/123/attempts/1/jobs?per_page=100',
  'actions/runs/124/attempts/2/jobs?per_page=100']);
 assert.equal(report.sampledRuns,2);
 assert.equal(report.workflowId,workflowId);
 assert.equal(report.scope,'MOST_RECENT_100_WORKFLOW_RUNS');
 assert.deepEqual(report.byRunConclusion,{success:1,failure:1});
 assert.equal(report.jobsTotal,3);
 assert.equal(report.jobsWithTiming,2);
 assert.equal(report.jobsSkipped,1);
 assert.equal(report.meanQueueSeconds,5);
 assert.equal(report.meanExecutionSeconds,12.5);
 assert.equal(report.maxQueueSeconds,7);
 assert.deepEqual(report.runIds,[{id:123,attempt:1},{id:124,attempt:2}]);
});

test('no matching Run produces unknown metrics, not fabricated zero',async()=>{
 const result=await collectMetrics({repository,workflow,request:async path=>
  path==='actions/workflows?per_page=100'?catalog():
   namedRuns([run(7,'success','Other Workflow')])});
 assert.equal(result.sampledRuns,0);
 assert.equal(result.meanQueueSeconds,null);
 assert.equal(result.meanExecutionSeconds,null);
 assert.equal(result.jobsWithTiming,0);
});

test('cancelled job before Runner start is counted but never treated as zero-second',()=>{
 const result=summarizeJobs([job('cancelled',date('00'),null,date('20'))]);
 assert.equal(result.jobsExcludedNoStart,1);
 assert.equal(result.jobsWithTiming,0);
 assert.equal(result.meanQueueSeconds,null);
 assert.deepEqual(result.byConclusion,{cancelled:1});
});

test('incomplete GitHub Job inventory is rejected rather than undercounted',async()=>{
 const calls=[];
 await assert.rejects(collectMetrics({repository,workflow,request:async path=>{
  calls.push(path);
  if(path==='actions/workflows?per_page=100')return catalog();
  if(path.startsWith('actions/workflows/'))return namedRuns([run(123,'success')]);
  return {total_count:1,jobs:[]};
 }}),/CI_METRICS_JOB_INVENTORY_INCOMPLETE/);
 assert.equal(calls.length,3);
});

test('invalid Run timestamps, negative durations and missing times fail closed',()=>{
 assert.throws(()=>summarizeJobs([job('success',date('10'),date('09'),date('22'))]),
  /CI_METRICS_NEGATIVE_DURATION/);
 assert.throws(()=>summarizeJobs([job('success',date('00'),null,date('22'))]),
  /CI_METRICS_TIMESTAMP_UNVERIFIED/);
 assert.throws(()=>summarizeJobs([job('success','not-a-date',date('09'),date('22'))]),
  /CI_METRICS_TIMESTAMP_UNVERIFIED/);
});

test('disallowed repository and invalid requests are rejected before network access',async()=>{
 let sent=0;
 await assert.rejects(collectMetrics({repository:'someone-else/private',workflow,
  request:async()=>{sent++;return {};}}),/CI_METRICS_REPOSITORY_NOT_ALLOWED/);
 await assert.rejects(collectMetrics({repository,workflow,limit:21,
  request:async()=>{sent++;return {};}}),/CI_METRICS_LIMIT_INVALID/);
 assert.equal(sent,0);
 await assert.rejects(githubRead(repository,'issues?state=open','token',
  async()=>{sent++;return {}; }),/CI_METRICS_RESOURCE_NOT_ALLOWED/);
 assert.equal(sent,0);
});

test('GitHub requests are read only, bounded and errors do not become success',async()=>{
 let observed;
 const data=await githubRead(repository,'actions/workflows?per_page=100','fixture-only-token',
  async(url,options)=>{
   observed={url,method:options.method,accept:options.headers.Accept};
   return {ok:true,json:async()=>({total_count:0,workflow_runs:[]})};
  });
 assert.deepEqual(observed,{url:'https://api.github.com/repos/'+repository+
  '/actions/workflows?per_page=100',method:'GET',accept:'application/vnd.github+json'});
 assert.equal(data.total_count,0);
 await assert.rejects(githubRead(repository,'actions/workflows/'+workflowId+'/runs?per_page=100','fixture-token',
  async()=>({ok:false,status:403})),/CI_METRICS_GITHUB_HTTP_403/);
});

test('workflow-scoped query cannot lose a valid run behind 100 unrelated repo events',async()=>{
 const calls=[];
 const result=await collectMetrics({repository,workflow,request:async resource=>{
  calls.push(resource);
  if(resource==='actions/workflows?per_page=100')return catalog();
  if(resource==='actions/workflows/'+workflowId+'/runs?per_page=100')
   return namedRuns([run(321,'success')]);
  if(resource==='actions/runs/321/attempts/1/jobs?per_page=100')
   return {total_count:1,jobs:[job('success',date('00'),date('02'),date('04'))]};
  throw Error('Unexpected repository-wide or unrelated API request: '+resource);
 }});
 assert.equal(result.sampledRuns,1);
 assert.deepEqual(result.runIds,[{id:321,attempt:1}]);
 assert.equal(calls.some(x=>x==='actions/runs?per_page=100'),false);
});

test('workflow inventory gaps and ambiguous names fail closed before reading runs',async()=>{
 for(const response of [
  {total_count:2,workflows:[{id:workflowId,name:workflow}]},
  catalog([{id:workflowId,name:'Other Workflow'}]),
  catalog([{id:workflowId,name:workflow},{id:9124,name:workflow}]),
  catalog([{id:0,name:workflow}])
 ]){
  const calls=[];
  await assert.rejects(collectMetrics({repository,workflow,request:async resource=>{
   calls.push(resource);return response;
  }}),/CI_METRICS_WORKFLOW_(?:INVENTORY_INCOMPLETE|NOT_FOUND|NAME_AMBIGUOUS|ID_UNVERIFIED)/);
  assert.deepEqual(calls,['actions/workflows?per_page=100']);
 }
});

test('run records belonging to a different workflow ID cannot contaminate the metric',async()=>{
 await assert.rejects(collectMetrics({repository,workflow,request:async resource=>
  resource==='actions/workflows?per_page=100'?catalog():
   namedRuns([{...run(12,'success'),workflow_id:42}])
 }),/CI_METRICS_RUN_LIST_UNVERIFIED/);
});

test('workflow API resource remains an allowlisted GET with no extra permissions',async()=>{
 let called=0;
 const resource='actions/workflows/'+workflowId+'/runs?per_page=100';
 const result=await githubRead(repository,resource,'fixture-only-token',async(url,options)=>{
  called++;
  assert.ok(url.endsWith('/'+resource));
  assert.equal(options.method,'GET');
  return {ok:true,json:async()=>namedRuns([])};
 });
 assert.equal(called,1);
 assert.equal(result.total_count,0);
 await assert.rejects(githubRead(repository,'actions/workflows/0/runs?per_page=100','fixture-token',
  async()=>{called++;return {ok:true};}),/CI_METRICS_RESOURCE_NOT_ALLOWED/);
 assert.equal(called,1);
});

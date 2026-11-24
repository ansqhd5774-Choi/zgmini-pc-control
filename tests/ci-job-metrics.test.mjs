import test from 'node:test';
import assert from 'node:assert/strict';
import {collectMetrics,summarizeJobs,githubRead} from '../scripts/ci-job-metrics.mjs';

const repository='ansqhd5774-Choi/zgmini-pc-control';
const workflow='C996 R5 Readonly Source Checks';
const date=s=>'2026-11-24T19:00:'+s+'Z';
const job=(conclusion,created,started,completed)=>({
 status:'completed',conclusion,created_at:created,started_at:started,completed_at:completed
});
const run=(id,conclusion,name=workflow,attempt=1)=>({
 id,run_attempt:attempt,name,status:'completed',conclusion
});

test('measures GitHub Job queue separately from execution and retains failed runs',async()=>{
 const calls=[];
 const data={'actions/runs?per_page=100':{total_count:3,workflow_runs:[
  run(123,'success'),run(124,'failure',workflow,2),run(125,'success','Other Workflow')
 ]},'actions/runs/123/attempts/1/jobs?per_page=100':{total_count:1,jobs:[
  job('success',date('00'),date('03'),date('13'))
 ]},'actions/runs/124/attempts/2/jobs?per_page=100':{total_count:2,jobs:[
  job('failure',date('00'),date('07'),date('22')),
  job('skipped',date('00'),null,null)
 ]}};
 const report=await collectMetrics({repository,workflow,request:async path=>{
  calls.push(path);assert.ok(path in data);return data[path];
 }});
 assert.deepEqual(calls,['actions/runs?per_page=100',
  'actions/runs/123/attempts/1/jobs?per_page=100',
  'actions/runs/124/attempts/2/jobs?per_page=100']);
 assert.equal(report.sampledRuns,2);
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
 const result=await collectMetrics({repository,workflow,request:async()=>({
  total_count:1,workflow_runs:[run(7,'success','Other Workflow')]
 })});
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
  return path.startsWith('actions/runs?')?
   {total_count:1,workflow_runs:[run(123,'success')]}:
   {total_count:1,jobs:[]};
 }}),/CI_METRICS_JOB_INVENTORY_INCOMPLETE/);
 assert.equal(calls.length,2);
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
 const data=await githubRead(repository,'actions/runs?per_page=100','fixture-only-token',
  async(url,options)=>{
   observed={url,method:options.method,accept:options.headers.Accept};
   return {ok:true,json:async()=>({total_count:0,workflow_runs:[]})};
  });
 assert.deepEqual(observed,{url:'https://api.github.com/repos/'+repository+
  '/actions/runs?per_page=100',method:'GET',accept:'application/vnd.github+json'});
 assert.equal(data.total_count,0);
 await assert.rejects(githubRead(repository,'actions/runs?per_page=100','fixture-token',
  async()=>({ok:false,status:403})),/CI_METRICS_GITHUB_HTTP_403/);
});

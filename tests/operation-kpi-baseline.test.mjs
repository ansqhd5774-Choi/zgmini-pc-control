import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {readPrivateResultDirectory,summarizeKpis,summarizeGithubPcJobMetrics} from '../tools/operation-kpi-baseline.mjs';

const now=new Date('2026-11-05T03:00:00.000Z');
const sample=(status,code,time='2026-11-05T02:00:00.000Z',durationMs=200)=>({
 schema:'ZGMINI_PC_RESULT_V1',status,code,startedAt:time,finishedAt:time,durationMs,
 requestId:'private-request-uuid',internalPath:'E:/very/private/path',secretToken:'never-export'});
const byId=(report,id)=>report.kpis.find(r=>r.id===id);

test('reports only witnessed generic failures and measured durations, never private fields',()=>{
 const report=summarizeKpis([
  sample('BLOCKED','INTERNAL_EXECUTION_ERROR',undefined,300),
  sample('PASS','RUNNER_COMMAND_EXECUTED',undefined,100),
  sample('BLOCKED','RESOURCE_WAIT_MEMORY',undefined,500),
 ],{asOf:now});
 assert.equal(byId(report,'generic_error_count').value,1);
 assert.equal(byId(report,'generic_error_count').status,'OBSERVED_ONLY');
 assert.equal(byId(report,'execution_duration_ms').p50,300);
 assert.equal(byId(report,'execution_duration_ms').p95,500);
 assert.equal(report.supportingSignals[0].value,1);
 assert.equal(report.coverage.inWindowRecords,3);
 assert.doesNotMatch(JSON.stringify(report),/secretToken|never-export|private-request-uuid|E:\//);
});
test('does not misreport missing approval/dependency/installation evidence as zero',()=>{
 const report=summarizeKpis([sample('PASS','COMPLETED')],{asOf:now});
 for(const id of ['unrelated_file_block_count','independent_a_unnecessary_stop_count',
   'duplicate_install_count','unapproved_operational_write_count']){
  const metric=byId(report,id);
  assert.equal(metric.status,'NOT_MEASURABLE');assert.equal(metric.value,null);
 }
});
test('empty or undated results never become green zero and are counted as missing coverage',()=>{
 const undated={schema:'ZGMINI_PC_MAINTENANCE_RESULT_V1',status:'UNKNOWN',code:'UPDATE_UNEXPECTED_FAILURE'};
 const report=summarizeKpis([undated],{asOf:now});
 assert.equal(report.coverage.undatedRecords,1);
 assert.equal(report.coverage.inWindowRecords,0);
 assert.equal(byId(report,'generic_error_count').status,'NOT_MEASURABLE');
 assert.equal(byId(report,'execution_duration_ms').status,'NOT_MEASURABLE');
});
test('only the supplied time window and supported schemas enter the evidence denominator',()=>{
 const report=summarizeKpis([
  sample('BLOCKED','INTERNAL_EXECUTION_ERROR','2026-09-01T00:00:00Z'),
  sample('PASS','OK'),
  {...sample('FAIL','BROKEN'),schema:'UNTRUSTED'},
 ],{asOf:now,windowDays:30});
 assert.equal(report.coverage.outsideWindowRecords,1);
 assert.equal(report.coverage.unsupportedRecords,1);
 assert.equal(report.coverage.inWindowRecords,1);
 assert.equal(byId(report,'generic_error_count').value,0);
 assert.equal(byId(report,'generic_error_count').status,'OBSERVED_ONLY');
});
test('bounded private result directory reader excludes symlinks and oversize inputs',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-kpi-fixture-'));
 try{
  fs.writeFileSync(path.join(root,'good.json'),JSON.stringify(sample('PASS','OK')));
  fs.writeFileSync(path.join(root,'bad.json'),'not valid json');
  fs.writeFileSync(path.join(root,'big.json'),'x'.repeat(32769));
  fs.symlinkSync(path.join(root,'good.json'),path.join(root,'linked.json'));
  const out=readPrivateResultDirectory(root);
  assert.equal(out.records.length,1);
  assert.equal(out.unreadableFiles,2);
  assert.equal(out.records[0].code,'OK');
 }finally{
  fs.rmSync(root,{recursive:true,force:true});
 }
});
test('malformed options fail closed rather than making a misleading baseline',()=>{
 assert.throws(()=>summarizeKpis([], {asOf:'not-a-date'}),/KPI_ASOF_INVALID/);
 assert.throws(()=>summarizeKpis([], {asOf:now,windowDays:0}),/KPI_INPUT_INVALID/);
});

const githubIssue=(number,{created='2026-11-05T01:00:00Z',started='2026-11-05T01:00:10Z',
 finished='2026-11-05T01:00:15Z',seat=1,status='PASS',code='SUCCESS',
 runId=String(900+number),comments=true,author='github-actions[bot]',durationMs=5000}={})=>{
 const requestId='pc-00000000-0000-4000-8000-'+String(number).padStart(12,'0');
 const report={schema:'ZGMINI_PC_RESULT_V1',jobId:`run-${runId}-1-seat-${seat}`,
  requestId,seat,status,code,startedAt:started,finishedAt:finished,durationMs,
  token:'PRIVATE_NEVER_EXPORT',internalPath:'E:/very/private'};
 return {issue:{issue_number:number,created_at:created,labels:[{name:'pc-job'}],
  body:JSON.stringify({requestId})},comments:comments?[{user:{login:author},
  body:`<!-- zgmini-pc-result:${runId}:1:${seat} -->\nJSON 결과:\n\n\`\`\`json\n${JSON.stringify(report)}\n\`\`\``}]:[]};
};

test('GitHub Issue timestamps measure actual queue delay and duration with explicit time zones',()=>{
 const r=summarizeGithubPcJobMetrics([
  githubIssue(1,{created:'2026-11-05T10:00:00+09:00',started:'2026-11-05T01:00:10Z',finished:'2026-11-05T01:00:15Z'}),
  githubIssue(2,{created:'2026-11-05T01:00:00Z',started:'2026-11-05T01:00:20Z',finished:'2026-11-05T01:00:25Z',seat:2}),
 ]);
 assert.equal(r.queueWait.medianMs,15000);
 assert.equal(r.execution.meanMs,5000);
 assert.equal(r.coverage.completeResults,2);
 assert.deepEqual(r.observedRunnerSeats,[1,2]);
 assert.doesNotMatch(JSON.stringify(r),/PRIVATE_NEVER_EXPORT|E:\/|requestId/);
});

test('overlap is based on actual execution windows, with end-before-start at same instant',()=>{
 const r=summarizeGithubPcJobMetrics([
  githubIssue(3,{started:'2026-11-05T01:00:10Z',finished:'2026-11-05T01:00:15Z'}),
  githubIssue(4,{started:'2026-11-05T01:00:13Z',finished:'2026-11-05T01:00:18Z',seat:4}),
  githubIssue(5,{started:'2026-11-05T01:00:18Z',finished:'2026-11-05T01:00:23Z',seat:5}),
 ]);
 assert.equal(r.peakObservedConcurrency,2);
});

test('unavailable comments and no terminal result remain missing, never zero successes',()=>{
 const a=githubIssue(6);delete a.comments;
 const b=githubIssue(7,{comments:false});
 const r=summarizeGithubPcJobMetrics([a,b]);
 assert.equal(r.coverage.completeResults,0);
 assert.equal(r.coverage.excludedReasons.COMMENTS_UNAVAILABLE,1);
 assert.equal(r.coverage.excludedReasons.RESULT_UNAVAILABLE,1);
 assert.equal(r.queueWait.medianMs,null);
 assert.equal(r.peakObservedConcurrency,null);
});

test('only bot marker results count; user-shaped result comments are excluded',()=>{
 const row=githubIssue(8,{author:'untrusted-user'});
 const r=summarizeGithubPcJobMetrics([row]);
 assert.equal(r.coverage.excludedReasons.RESULT_UNAVAILABLE,1);
 assert.equal(r.statusCounts.PASS,0);
});

test('conflicting bot reports for same Issue fail closed without hiding ambiguity',()=>{
 const row=githubIssue(9);
 row.comments.push({...row.comments[0],body:row.comments[0].body.replace('"code":"SUCCESS"','"code":"DIFFERENT"')});
 const r=summarizeGithubPcJobMetrics([row]);
 assert.equal(r.coverage.excludedReasons.RESULT_AMBIGUOUS,1);
 assert.equal(r.coverage.completeResults,0);
});

test('BLOCKED counts exact codes, not assumed Controller internal failure',()=>{
 const r=summarizeGithubPcJobMetrics([githubIssue(10,{status:'BLOCKED',code:'ALPACA_LEDGER_ABSENT'})]);
 assert.equal(r.statusCounts.BLOCKED,1);
 assert.equal(r.codeCounts.ALPACA_LEDGER_ABSENT,1);
 assert.equal(r.codeCounts.INTERNAL_EXECUTION_ERROR,undefined);
});

test('result with inconsistent duration is excluded, not normalized to green PASS',()=>{
 const row=githubIssue(11,{durationMs:900000});
 const r=summarizeGithubPcJobMetrics([row]);
 assert.equal(r.coverage.excludedReasons.RESULT_DURATION_INVALID,1);
 assert.equal(r.statusCounts.PASS,0);
});

test('stdin mode outputs only bounded aggregate, with no PC/E writes',()=>{
 const script=fileURLToPath(new URL('../tools/operation-kpi-baseline.mjs',import.meta.url));
 const run=spawnSync(process.execPath,[script,'--github-issues-stdin'],{input:JSON.stringify([githubIssue(12)]),encoding:'utf8'});
 assert.equal(run.status,0,run.stderr);
 const r=JSON.parse(run.stdout);
 assert.equal(r.coverage.completeResults,1);
 assert.equal(r.eDriveWrites,0);
 assert.equal(r.githubWrites,0);
 assert.equal(r.peakObservedConcurrency,1);
});

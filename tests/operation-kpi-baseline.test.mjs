import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {readPrivateResultDirectory,summarizeKpis} from '../tools/operation-kpi-baseline.mjs';

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

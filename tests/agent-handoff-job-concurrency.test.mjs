import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const workflows = [
  {file:'agent-handoff-proactive-diagnostics.yml',
   job:'newest-first-diagnostic-scanner',
   group:'zgmini-proactive-diagnostics-ledger',
   cron:"10,25,40,55"},
  {file:'agent-handoff-deep-diagnostics.yml',
   job:'handoff-evidence-and-conditional-simulation',
   group:'zgmini-proactive-diagnostics-ledger',
   cron:"12,27,42,57"},
  {file:'agent-handoff-wide-scout.yml',
   job:'read-only-extended-monitor',
   group:'zgmini-proactive-diagnostics-ledger',
   cron:"14,29,44,59"},
  {file:'agent-handoff-queue-board.yml',
   job:'authenticated-readonly-board',
   group:'zgmini-handoff-control-board',
   cron:"7,22,37,52"}
];

const read = file => readFileSync(
  new URL('../.github/workflows/'+file,import.meta.url),'utf8'
).replace(/\r\n/g,'\n');

for(const {file,job,group,cron} of workflows){
  test(file+' gates and queues only its actual job',()=>{
    const yaml=read(file);
    const section='jobs:\n  '+job+':\n    concurrency:\n'+
      '      group: '+group+'\n'+
      '      cancel-in-progress: false\n'+
      '      queue: max\n'+
      '    if:';
    assert.ok(yaml.includes(section),'job-level queue must precede validated if');
    assert.doesNotMatch(yaml,/^concurrency:\s*$/m,
      'workflow-level queue would include events whose jobs are skipped');
    assert.equal((yaml.match(/^      queue: max$/gm)||[]).length,1);
    assert.match(yaml,/runs-on: \[self-hosted, Windows, X64, zgmini-handoff-ci-isolated\]/);
    assert.match(yaml,/ZGMINI_AGENT_HANDOFF_ENABLED/);
    assert.ok(yaml.includes("- cron: '"+cron+" * * * *'"),'existing schedule unchanged');
    assert.doesNotMatch(yaml,/cancel-in-progress: true|runs-on: ubuntu-latest/);
  });
}

test('all three ledger writers retain one serialized group and queue capacity',()=>{
  const names=workflows.slice(0,3).map(({file})=>
    read(file).match(/^      group: (.+)$/m)?.[1]);
  assert.deepEqual(names,Array(3).fill('zgmini-proactive-diagnostics-ledger'));
  assert.equal(workflows[3].group,'zgmini-handoff-control-board');
});

test('no new triggers, runner, provider operations or permissions are introduced',()=>{
  for(const {file} of workflows){
    const yaml=read(file);
    assert.doesNotMatch(yaml,/runs-on: \[.*zgmini-pc-control.*\]/);
    assert.doesNotMatch(yaml,/\bsecrets\.|\bwrangler\b|\bnpm install\b/);
    assert.ok(yaml.includes('github.repository =='));
    assert.ok(yaml.includes('github.event.repository.private == true'));
  }
});

test('completed-run fanout is limited to intake, selector and board',()=>{
  const intake=read('agent-handoff.yml');
  const selector=read('agent-handoff-candidate-selector.yml');
  const board=read('agent-handoff-queue-board.yml');
  assert.match(intake,/^  issue_comment:/m);
  assert.match(selector,/^  workflow_run:/m);
  assert.match(selector,/- ZGMINI Agent Handoff Intake/);
  assert.match(board,/^  workflow_run:/m);
  assert.match(board,/- ZGMINI Handoff Queue Candidate Selector/);
  assert.doesNotMatch(board,/- ZGMINI Agent Handoff Intake/);
  // Keep the schedule, explicit owner dispatch and labeled-event fallback.
  for(const file of ['agent-handoff-wide-scout.yml',
    'agent-handoff-deep-diagnostics.yml',
    'agent-handoff-proactive-diagnostics.yml']){
    const yaml=read(file);
    assert.doesNotMatch(yaml,/^  workflow_run:/m);
    assert.doesNotMatch(yaml,/github.event.workflow_run/);
    assert.match(yaml,/^  schedule:/m);
    assert.match(yaml,/^  workflow_dispatch:/m);
    assert.match(yaml,/^  issues:/m);
    assert.match(yaml,/types: \[labeled\]/);
  }
  const oldFanout=1+1+2+3;
  const newFanout=1+1+1;
  assert.equal(oldFanout,7);
  assert.equal(newFanout,3);
  assert.equal(oldFanout-newFanout,4);
});

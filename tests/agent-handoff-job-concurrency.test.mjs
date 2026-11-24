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
   group:'zgmini-wide-scout-ledger',
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

test('source pushes cannot start redundant diagnostics while owner and 15-minute paths remain',()=>{
  for(const {file} of workflows.slice(0,3)){
    const yaml=read(file);
    assert.doesNotMatch(yaml,/^  push:/m);
    assert.doesNotMatch(yaml,/github\.event_name == 'push'/);
    assert.match(yaml,/^  schedule:/m);
    assert.match(yaml,/^  issues:/m);
    assert.match(yaml,/^  workflow_dispatch:/m);
  }
});

test('007 serializes its own shard writes without blocking 005 and deep diagnostics',()=>{
  const names=workflows.slice(0,3).map(({file})=>
    read(file).match(/^      group: (.+)$/m)?.[1]);
  assert.deepEqual(names,['zgmini-proactive-diagnostics-ledger',
    'zgmini-proactive-diagnostics-ledger','zgmini-wide-scout-ledger']);
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

test('independent selector and board have no completion trigger; full board follows selection success',()=>{
  const intake=read('agent-handoff.yml');
  const selector=read('agent-handoff-candidate-selector.yml');
  const board=read('agent-handoff-queue-board.yml');
  assert.match(intake,/^  issue_comment:/m);
  assert.doesNotMatch(selector,/^  workflow_run:/m);
  assert.doesNotMatch(selector,/github\.event\.workflow_run/);
  assert.match(selector,/^  workflow_dispatch:/m);
  assert.match(selector,/^  push:/m);
  assert.match(read('agent-handoff-pc-failure-intake.yml'),/workflows: \[ZGMINI PC Job\]/);
  assert.match(read('agent-handoff-writer-b-failure-intake.yml'),/workflows: \[ZGMINI Approved Writer B Source Overlay Once\]/);
  assert.doesNotMatch(board,/^  workflow_run:/m);
  assert.doesNotMatch(board,/github\.event\.workflow_run/);
  assert.match(board,/^  schedule:/m);
  assert.match(board,/^  workflow_dispatch:/m);
  const after=selector.slice(selector.indexOf('  authenticated-readonly-board-after-selection:'));
  assert.match(after,/needs: verify-and-select-candidates/);
  assert.match(after,/needs\.verify-and-select-candidates\.result == 'success'/);
  assert.match(after,/github\.ref == 'refs\/heads\/main'/);
  assert.match(after,/permissions:\s*\n\s*contents: read\s*\n\s*issues: read\s*\n\s*pull-requests: read/);
  assert.doesNotMatch(after,/issues: write|contents: write|continue-on-error|always\(\)/);
  assert.match(after,/group: zgmini-handoff-control-board\s*\n\s*cancel-in-progress: false\s*\n\s*queue: max/);
  assert.equal(after.slice(after.indexOf('    runs-on:')),board.slice(board.indexOf('    runs-on:')));
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
  // Source completion remains independently observed by the two producers.
  // All candidate/board followups are now jobs rather than completion Runs.
});

test('009 admits only relevant events and serializes actual issue writers without dropping queued events',()=>{
 const yaml=read('agent-handoff.yml');
 assert.doesNotMatch(yaml,/^concurrency:/m);
 for(const job of ['route-sanitized-incident','record-verified-return','record-work-progress']){
   assert.ok(yaml.includes('  '+job+':\n    concurrency:\n      group: agent-handoff-${{ github.event.issue.number }}\n      cancel-in-progress: false\n      queue: max'));
 }
 assert.equal((yaml.match(/^      queue: max$/gm)||[]).length,5);
 assert.match(yaml,/github\.event\.action == 'opened'/);
 assert.match(yaml,/github\.event\.action == 'labeled' && github\.event\.label\.name == 'agent-handoff'/);
 assert.doesNotMatch(yaml,/cancel-in-progress: true/);
});


test('direct intake selection requires a successful original job, not merely a completed event',()=>{
 const intake=read('agent-handoff.yml');
 const follow=intake.slice(intake.indexOf('  verify-and-select-after-intake:'));
 const selection=follow.slice(0,follow.indexOf('  authenticated-readonly-board-after-selection:'));
 const board=follow.slice(follow.indexOf('  authenticated-readonly-board-after-selection:'));
 assert.match(selection,/needs: \[route-sanitized-incident, record-verified-return, record-work-progress\]/);
 assert.match(selection,/!cancelled\(\) && !failure\(\)/);
 for(const job of ['route-sanitized-incident','record-verified-return','record-work-progress'])
   assert.ok(selection.includes("needs."+job+".result == 'success'"));
 assert.match(selection,/github\.ref == 'refs\/heads\/main'/);
 assert.match(selection,/github\.actor == 'ansqhd5774-Choi'/);
 assert.match(selection,/vars\.ZGMINI_AGENT_HANDOFF_ENABLED == 'true'/);
 assert.match(selection,/group: zgmini-handoff-candidate-selector\s*\n\s*cancel-in-progress: false\s*\n\s*queue: max/);
 assert.match(board,/needs: verify-and-select-after-intake/);
 assert.match(board,/needs\.verify-and-select-after-intake\.result == 'success'/);
 assert.match(board,/permissions:\s*\n\s*contents: read\s*\n\s*issues: read\s*\n\s*pull-requests: read/);
 assert.doesNotMatch(board,/issues: write|contents: write|always\(\)|continue-on-error/);
 assert.match(board,/group: zgmini-handoff-control-board/);
 const source=read('agent-handoff-candidate-selector.yml');
 const sourceSelection=source.slice(source.indexOf('    runs-on:'),source.indexOf('  # Preserve full board readback'));
 assert.equal(selection.slice(selection.indexOf('    runs-on:')),sourceSelection);
 assert.equal(board.slice(board.indexOf('    runs-on:')),read('agent-handoff-queue-board.yml').slice(read('agent-handoff-queue-board.yml').indexOf('    runs-on:')));
});


test('PC and Writer B followups require successful independent intake and preserve isolated read/write scopes',()=>{
 const source=read('agent-handoff-candidate-selector.yml');
 const selectionSteps=source.slice(source.indexOf('    runs-on:'),source.indexOf('  # Preserve full board readback'));
 const boardSteps=read('agent-handoff-queue-board.yml').slice(read('agent-handoff-queue-board.yml').indexOf('    runs-on:'));
 for(const [file,job] of [['agent-handoff-pc-failure-intake.yml','enqueue-confirmed-failures'],['agent-handoff-writer-b-failure-intake.yml','enqueue-verified-writer-b-failures']]){
   const yaml=read(file),follow=yaml.slice(yaml.indexOf('  verify-and-select-after-failure-intake:'));
   const selection=follow.slice(0,follow.indexOf('  authenticated-readonly-board-after-selection:'));
   const board=follow.slice(follow.indexOf('  authenticated-readonly-board-after-selection:'));
   assert.ok(selection.includes('needs: '+job));
   assert.ok(selection.includes("needs."+job+".result == 'success'"));
   assert.match(selection,/vars\.ZGMINI_AGENT_HANDOFF_ENABLED == 'true'/);
   assert.match(selection,/github\.actor == 'ansqhd5774-Choi'/);
   assert.match(selection,/github\.ref == 'refs\/heads\/main'/);
   assert.match(selection,/group: zgmini-handoff-candidate-selector/);
   assert.match(selection,/permissions:\s*\n\s*contents: read\s*\n\s*issues: write/);
   assert.ok(board.includes('needs: ['+job+', verify-and-select-after-failure-intake]'));
   assert.match(board,/!cancelled\(\) && !failure\(\)/);
   assert.ok(selection.includes("needs."+job+".outputs.selection_reused != 'true'"));
   assert.ok(board.includes("needs."+job+".outputs.selection_reused == 'true'"));
   assert.match(board,/needs\.verify-and-select-after-failure-intake\.result == 'skipped'/);
   assert.match(board,/needs\.verify-and-select-after-failure-intake\.result == 'success'/);
   assert.match(board,/permissions:\s*\n\s*contents: read\s*\n\s*issues: read\s*\n\s*pull-requests: read/);
   assert.doesNotMatch(board,/issues: write|contents: write|continue-on-error|always\(\)/);
   assert.match(board,/group: zgmini-handoff-control-board/);
   assert.equal(selection.slice(selection.indexOf('    runs-on:')),selectionSteps);
   assert.equal(board.slice(board.indexOf('    runs-on:')),boardSteps);
 }
});


test('no-op proof never blocks the original intake or bypasses a required selection',()=>{
 for(const [file,job] of [['agent-handoff-pc-failure-intake.yml','enqueue-confirmed-failures'],['agent-handoff-writer-b-failure-intake.yml','enqueue-verified-writer-b-failures']]){
  const yaml=read(file),original=yaml.slice(0,yaml.indexOf('  # Keep original intake independent'));
  assert.match(original,/selection_reused: \$\{\{ steps\.selection-noop\.outcome == 'success' && steps\.selection-noop\.outputs\.reusable == 'true' && 'true' \|\| 'false' \}\}/);
  const proof=original.slice(original.indexOf('      - name: Verify all pending selection receipts'));
  assert.match(proof,/id: selection-noop/);
  assert.match(proof,/github\.event_name == 'workflow_run'/);
  assert.match(proof,/vars\.ZGMINI_AGENT_HANDOFF_ENABLED == 'true'/);
  assert.match(proof,/continue-on-error: true/);
  assert.match(proof,/run: node agent-handoff\/queue-dispatcher\.mjs --verify-noop/);
  assert.doesNotMatch(proof,/actions: write|issues: write|pull-requests: write|schedule:/);
  const after=yaml.slice(yaml.indexOf('  authenticated-readonly-board-after-selection:'));
  assert.ok(after.includes("needs."+job+".result == 'success'"));
  assert.match(after,/vars\.ZGMINI_AGENT_HANDOFF_ENABLED == 'true'/);
 }
});

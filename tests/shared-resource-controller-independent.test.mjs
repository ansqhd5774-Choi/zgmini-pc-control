import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const workflow = (name) => readFileSync(new URL(`../.github/workflows/${name}`, import.meta.url), 'utf8');

const independentJobs = [
  ['agent-handoff.yml', 5, ['agent-handoff/issue-broker.mjs', 'agent-handoff/result-entry.mjs', 'agent-handoff/work-progress-broker.mjs', 'agent-handoff/queue-dispatcher.mjs', 'agent-handoff/queue-board-runner.mjs']],
  ['agent-handoff-pc-failure-intake.yml', 3, ['agent-handoff/pc-failure-producer.mjs', 'agent-handoff/queue-dispatcher.mjs', 'agent-handoff/queue-board-runner.mjs']],
  ['agent-handoff-writer-b-failure-intake.yml', 3, ['agent-handoff/writer-b-failure-producer.mjs', 'agent-handoff/queue-dispatcher.mjs', 'agent-handoff/queue-board-runner.mjs']],
];

for (const [name, jobs, scripts] of independentJobs) {
  test(`${name}: GitHub-only coordination remains available without the production Controller`, () => {
    const source = workflow(name);
    const isolated = source.match(/runs-on: \[self-hosted, Windows, X64, zgmini-handoff-ci-isolated\]/g) ?? [];
    const nodeSetup = source.match(/uses: actions\/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020/g) ?? [];
    assert.equal(isolated.length, jobs);
    assert.equal(nodeSetup.length, jobs);
    assert.doesNotMatch(source, /runs-on: \[self-hosted, Windows, X64, zgmini-pc-control\]/);
    assert.doesNotMatch(source, /E:\\ZGmini\\runtime\\node\.exe/);
    assert.match(source, /persist-credentials: false/);
    assert.doesNotMatch(source, /schedule:/);
    if (name==='agent-handoff-pc-failure-intake.yml') {
      // The one-case historical recovery is owner-gated and uses the same
      // isolated runner/concurrency; it never dispatches a PC Job.
      assert.match(source,/workflow_dispatch:/);
      assert.match(source,/github\.actor == 'ansqhd5774-Choi'/);
      assert.match(source,/github\.ref == 'refs\/heads\/main'/);
      assert.match(source,/inputs\.confirmation == 'reconcile-2307-resource-wait'/);
      assert.match(source,/inputs\.mode == 'preview' \|\| inputs\.mode == 'apply'/);
      assert.match(source,/run: node agent-handoff\/pc-2307-wait-recovery\.mjs/);
      assert.match(source,/group: agent-handoff-pc-failure-intake/);
      assert.match(source,/if: github\.event_name == 'workflow_run'/);
      assert.match(source,/if: github\.event_name == 'workflow_dispatch'/);
    } else {
      assert.doesNotMatch(source,/workflow_dispatch:/);
    }
    for (const script of scripts) assert.ok(source.includes(`run: node ${script}`), `${name}: ${script}`);
  });
}

test('incident routing remains explicitly opted in and origin-authorized', () => {
  assert.match(workflow('agent-handoff.yml'), /vars\.ZGMINI_AGENT_HANDOFF_ENABLED == 'true'/);
  assert.match(workflow('agent-handoff.yml'), /github\.actor == 'ansqhd5774-Choi'/);
  assert.match(workflow('agent-handoff-pc-failure-intake.yml'), /vars\.ZGMINI_PC_HANDOFF_INTAKE_ENABLED == 'true'/);
  assert.match(workflow('agent-handoff-writer-b-failure-intake.yml'), /vars\.ZGMINI_PC_HANDOFF_WRITER_B_INTAKE_ENABLED == 'true'/);
  assert.match(workflow('agent-handoff-writer-b-failure-intake.yml'), /github\.event\.workflow_run\.run_attempt == 1/);
});

test('result entry retains source verification and dispatches diagnosis without the operational Controller', () => {
  const entry=readFileSync(new URL('../agent-handoff/result-entry.mjs',import.meta.url),'utf8');
  assert.match(entry,/from '\.\/result-broker\.mjs'/);
  assert.match(entry,/from '\.\/diagnosis-broker\.mjs'/);
  assert.match(entry,/result\.schema===DIAGNOSIS_SCHEMA/);
  assert.match(entry,/return sourceResult\(env\)/);
  assert.doesNotMatch(entry,/child_process|controller\/engine|E:\\ZGmini/);
});

test('shared-resource issue admission explicitly passes issue action to the reporter', () => {
  const source = workflow('pc-shared-issue-admission.yml');
  assert.match(source, /GITHUB_EVENT_ACTION: \$\{\{ github\.event\.action \}\}/);
  assert.match(source, /github\.event\.action == 'opened'/);
  assert.match(source, /runs-on: \[self-hosted, Windows, X64, zgmini-handoff-ci-isolated\]/);
  assert.doesNotMatch(source, /workflow_dispatch:|schedule:/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GROUPS,selectGroups,changedFiles} from '../tools/c996-source-checks.mjs';
const all=Object.keys(GROUPS);
test('011 unrelated feature/docs PR cannot be blocked by unrelated source suites',()=>{
 assert.deepEqual(selectGroups(['docs/unrelated-feature.md','site/home.tsx']),[]);
});
test('011 handoff and R6 changes select their own suites without unrelated R47',()=>{
 const set=selectGroups(['agent-handoff/result-broker.mjs','tests/employment-r6-collection-evidence-readonly.test.mjs']);
 assert.deepEqual(set,['handoff009','employment']);
});
test('011 direct test changes and shared source preserve relevant tests',()=>{
 assert.deepEqual(selectGroups(['tests/agent-handoff-result.test.mjs']),['handoff009']);
 assert.deepEqual(selectGroups(['direct-writer-b/configured-direct-b.test.mjs']),['writer']);
 assert.deepEqual(selectGroups(['tools/update.mjs']),all);
 assert.deepEqual(selectGroups(['tools/unknown-shared-contract.mjs']),all);
});
test('011 workflow and selection contract changes always run all original suites',()=>{
 assert.deepEqual(selectGroups(['.github/workflows/c996-r5-readonly-source-checks.yml']),all);
 assert.deepEqual(selectGroups(['tests/c996-source-scope.test.mjs']),all);
 const tests=Object.values(GROUPS).flat();
 assert.equal(new Set(tests).size,tests.length,'each fixed test runs once');
 assert.ok(tests.includes('tests/agent-handoff-result.test.mjs'));
 assert.ok(tests.includes('tests/agent-handoff-job-concurrency.test.mjs'));
 assert.ok(tests.includes('tests/r47-existing-task-once.test.mjs'));
 assert.ok(tests.includes('tests/marketparquet-task-retire.test.mjs'));
});
test('011 incomplete PR file retrieval retains full regression coverage',async()=>{
 const env={GITHUB_EVENT_PATH:'not-real-path',GITHUB_REPOSITORY:'ansqhd5774-Choi/zgmini-pc-control',GITHUB_TOKEN:'unit-test'};
 assert.equal(await changedFiles(env),null);
 assert.deepEqual(selectGroups(null),all);
});
test('011 CI uses scoped PR concurrency and checks host before test execution',()=>{
 const y=readFileSync(new URL('../.github/workflows/c996-r5-readonly-source-checks.yml',import.meta.url),'utf8').replace(/\r\n/g,'\n');
 assert.match(y,/group: c996-r5-readonly-source-\$\{\{ github.event.pull_request.number \}\}/);
 assert.match(y,/cancel-in-progress: true/);
 assert.match(y,/permissions:\n  contents: read/);
 assert.ok(y.indexOf('- name: Identify exact permitted queue PC')<
           y.indexOf('- name: Run changed-source regressions only'));
 assert.match(y,/runs-on: \[self-hosted, Windows, X64, zgmini-handoff-ci-isolated\]/);
 assert.doesNotMatch(y,/schedule:|workflow_dispatch:|runs-on: ubuntu-latest/);
});

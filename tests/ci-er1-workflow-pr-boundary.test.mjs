import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const operational=read('.github/workflows/pc-er1-dec31-symbol-batch-a.yml');
const offline=read('.github/workflows/pc-er1-dec31-symbol-pair-contract-tests.yml');

test('PC ER1 execution remains restricted to original owner-issued issue event',()=>{
 const trigger=operational.slice(0,operational.indexOf('\npermissions:'));
 assert.match(trigger,/\n  issues:\s*\n\s+types: \[opened\]/);
 assert.doesNotMatch(trigger,/pull_request|push:|workflow_dispatch:/);
 assert.match(operational,/github\.event\.issue\.title == 'pc-er1-dec31-symbol-batch-a-one-shot'/);
 assert.match(operational,/github\.event\.issue\.title == 'pc-er1-dec31-symbol-pair-resume-once'/);
 assert.match(operational,/contains\(github\.event\.issue\.labels\.\*\.name, 'pc-er1-approved'\)/);
 assert.match(operational,/runs-on: \[self-hosted, Windows, X64, zgmini-pc-control\]/);
 assert.doesNotMatch(operational,/pair-contract-tests:|if: github\.event_name == 'pull_request'/);
 assert.match(operational,/issues: write/);
});

test('offline PR verification uses hosted runner, read-only token and credential-free source',()=>{
 const trigger=offline.slice(0,offline.indexOf('\npermissions:'));
 assert.match(trigger,/\n  pull_request:\s*\n\s+branches: \[main\]/);
 assert.doesNotMatch(trigger,/\n  issues:|\n  push:|workflow_dispatch/);
 assert.match(offline,/\npermissions:\s*\n\s+contents: read\s*\n/);
 assert.doesNotMatch(offline,/^\\s*(?:issues|pull-requests):\\s*write\\s*$/m);\n assert.doesNotMatch(offline,/write-all|self-hosted|GITHUB_TOKEN|pc-job|--upload/);
 assert.match(offline,/runs-on: ubuntu-latest/);
 assert.match(offline,/persist-credentials: false/);
 assert.match(offline,/node --test er1-dec31-symbol-pair-resume-entry\.test\.mjs tests\/ci-er1-workflow-pr-boundary\.test\.mjs/);
 for(const p of [
  'er1-dec31-symbol-batch-a-entry.mjs',
  'er1-dec31-symbol-pair-resume-entry.test.mjs',
  '.github/workflows/pc-er1-dec31-symbol-batch-a.yml',
  '.github/workflows/pc-er1-dec31-symbol-pair-contract-tests.yml',
  'tests/ci-er1-workflow-pr-boundary.test.mjs'
 ]){
  assert.ok(trigger.includes("      - '"+p+"'"),'missing PR trigger: '+p);
 }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const workflow=fs.readFileSync(path.join(here,'..','.github','workflows',
  'pc-report-recovery-540-once.yml'),'utf8');

test('one-shot owner comment #540 only; no worker, A rerun, or schedule',()=>{
  assert.match(workflow,/issue_comment:\s*\n\s*types: \[created\]/);
  assert.match(workflow,/github\.repository == 'ansqhd5774-Choi\/zgmini-pc-control'/);
  assert.match(workflow,/github\.event\.repository\.private == true/);
  assert.match(workflow,/github\.event\.issue\.number == 540/);
  assert.match(workflow,/github\.event\.issue\.pull_request == null/);
  assert.match(workflow,/github\.actor == 'ansqhd5774-Choi'/);
  assert.match(workflow,/github\.event\.comment\.user\.login == 'ansqhd5774-Choi'/);
  assert.match(workflow,/github\.event\.comment\.body == '\/zgmini-recover-540-once'/);
  assert.match(workflow,/runs-on: \[self-hosted, Windows, X64, zgmini-pc-control\]/);
  assert.match(workflow,/controller\\report-recovery-540-once\.mjs/);
  assert.doesNotMatch(workflow,/entry\.mjs|worker\.mjs|workflow_dispatch|schedule:|actions\/checkout@|GITHUB_RUN_ID\s*:/);
  assert.equal((workflow.match(/GITHUB_TOKEN:/g)??[]).length,1);
});

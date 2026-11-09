import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const workflow = fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)),
  '../.github/workflows/agent-handoff-pr-evidence.yml'), 'utf8');

test('new handoff CI is PR-only, owner-label gated, and cannot run on push or schedule', () => {
  assert.match(workflow, /^on:\n  pull_request:\n    types: \[labeled, synchronize\]/m);
  assert.match(workflow, /pull_request\.user\.login == 'ansqhd5774-Choi'/);
  assert.match(workflow, /pull_request\.head\.repo\.full_name == github\.repository/);
  assert.match(workflow, /pull_request\.base\.ref == 'main'/);
  assert.match(workflow, /contains\(github\.event\.pull_request\.labels\.\*\.name, 'agent-handoff-ci'\)/);
  assert.match(workflow, /github\.event\.label\.name == 'agent-handoff-ci'/);
  assert.doesNotMatch(workflow, /(^|\n)\s*(push|schedule|workflow_dispatch|pull_request_target):/);
});

test('new handoff CI checks out exact PR head and preserves read-only credentials', () => {
  assert.match(workflow, /permissions:\n  contents: read/);
  assert.match(workflow, /ref: \$\{\{ github\.event\.pull_request\.head\.sha \}\}/);
  assert.match(workflow, /persist-credentials: false/);
  assert.match(workflow, /run: node --test tests\/agent-handoff\*\.test\.mjs/);
  assert.match(workflow, /runs-on: ubuntu-latest/);
  assert.match(workflow, /timeout-minutes: 5/);
  assert.match(workflow, /cancel-in-progress: true/);
  assert.doesNotMatch(workflow, /runs-on: \[self-hosted|E:\\ZGmini|secrets\.|issues: write|actions: write/);
});

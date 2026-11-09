import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const workflow = fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)),
  '../.github/workflows/agent-handoff-pr-evidence.yml'), 'utf8');

test('new handoff CI is PR-only, owner-label gated, and cannot run on push or schedule', () => {
  assert.match(workflow, /^on:\n  pull_request:\n    types: \[labeled\]/m);
  assert.match(workflow, /pull_request\.user\.login == 'ansqhd5774-Choi'/);
  assert.match(workflow, /pull_request\.head\.repo\.full_name == github\.repository/);
  assert.match(workflow, /pull_request\.base\.ref == 'main'/);
  assert.match(workflow, /contains\(github\.event\.pull_request\.labels\.\*\.name, 'agent-handoff-ci'\)/);
  assert.match(workflow, /github\.event\.label\.name == 'agent-handoff-ci'/);
  assert.match(workflow, /github\.event\.action == 'labeled'/);
  assert.doesNotMatch(workflow, /types: \[[^\]]*synchronize|github\.event\.action == 'synchronize'|types: \[opened|reopened/);
  assert.doesNotMatch(workflow, /(^|\n)\s*(push|schedule|workflow_dispatch|pull_request_target):/);
});

test('new handoff CI checks out exact PR head and preserves read-only credentials', () => {
  assert.match(workflow, /permissions:\n  contents: read/);
  assert.match(workflow, /ref: \$\{\{ github\.event\.pull_request\.head\.sha \}\}/);
  assert.match(workflow, /persist-credentials: false/);
  assert.match(workflow, /actions\/checkout@11d5960a326750d5838078e36cf38b85af677262/);
  assert.match(workflow, /actions\/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020/);
  assert.doesNotMatch(workflow, /uses: actions\/(checkout|setup-node)@v\d/);
  assert.match(workflow, /run: node --test --test-concurrency=1 "tests\/agent-handoff\*\.test\.mjs"/);
  assert.match(workflow, /runs-on: \[self-hosted, Linux, X64, zgmini-handoff-ci-isolated\]/);
  assert.match(workflow, /defaults:\s*\n\s+run:\s*\n\s+shell: bash/);
  assert.match(workflow, /timeout-minutes: 5/);
  assert.match(workflow, /cancel-in-progress: true/);
  assert.doesNotMatch(workflow, /runs-on: ubuntu-latest|zgmini-pc-control\]|node\.exe|\$\{\{\s*secrets\.|issues: write|actions: write/);
  assert.doesNotMatch(workflow, /^(?:\s*)(?:artifact|cache|schedule):/m);
});

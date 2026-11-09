import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const workflow = readFileSync(new URL('../.github/workflows/agent-handoff-writer-b-failure-intake.yml', import.meta.url), 'utf8');

test('Writer B intake listens only to completed Writer B runs', () => {
  assert.match(workflow, /workflow_run:\s*\n\s+workflows: \[ZGMINI Approved Writer B Source Overlay Once\]\s*\n\s+types: \[completed\]/);
  assert.doesNotMatch(workflow, /workflows: \[ZGMINI PC Job\]/);
  assert.doesNotMatch(workflow, /^\s+issues:\s*$/m);
});

test('Writer B intake is gated independently and retains pending events', () => {
  assert.match(workflow, /vars\.ZGMINI_PC_HANDOFF_WRITER_B_INTAKE_ENABLED == 'true'/);
  assert.doesNotMatch(workflow, /vars\.ZGMINI_PC_HANDOFF_INTAKE_ENABLED == 'true'/);
  assert.match(workflow, /cancel-in-progress: false\s*\n\s+queue: max/);
  assert.match(workflow, /runs-on: \[self-hosted, Windows, X64, zgmini-pc-control\]/);
});

test('Writer B intake runs only its metadata adapter, never the PC installer', () => {
  assert.match(workflow, /writer-b-failure-producer\.mjs/);
  assert.doesNotMatch(workflow, /writer-b\\windows-adapter\.mjs|pc-writer-b-source-once\.yml|pc-job-runner\.mjs/);
  assert.match(workflow, /persist-credentials: false/);
});

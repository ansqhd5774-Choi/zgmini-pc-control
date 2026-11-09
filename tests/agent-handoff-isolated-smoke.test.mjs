import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const workflow = readFileSync(new URL('../.github/workflows/agent-handoff-isolated-smoke.yml', import.meta.url), 'utf8');
const scriptMarker = '          script: |\n';
const scriptStart = workflow.indexOf(scriptMarker);
assert.notEqual(scriptStart, -1, 'github-script step must exist');
const script = workflow.slice(scriptStart + scriptMarker.length).split('\n')
  .filter(line => line.length > 0)
  .map(line => {
    assert.ok(line.startsWith('            '), 'inline script must use exact indentation');
    return line.slice(12);
  }).join('\n');
const run = new Function('github', 'context', 'core', `return (async () => {\n${script}\n})()`);

function fixture({ originOwner = 'ansqhd5774-Choi', labels = [], originBody } = {}) {
  const testId = 'isolated-20261109-1';
  const comments = new Map([[700, []], [701, []]]);
  const writes = [];
  const context = {
    repo: { owner: 'ansqhd5774-Choi', repo: 'zgmini-pc-control' },
    payload: {
      issue: {
        number: 701,
        title: `[ISOLATED-TEST] INCIDENT ${testId}`,
        user: { login: 'ansqhd5774-Choi' },
        labels: labels.map(name => ({ name })),
        body: JSON.stringify({ schema: 'ZGMINI_HANDOFF_ISOLATED_TRANSPORT_V1', testId, originIssue: 700 })
      }
    }
  };
  const origin = {
    number: 700,
    title: `[ISOLATED-TEST] ORIGIN ${testId}`,
    state: 'open',
    user: { login: originOwner },
    labels: [],
    body: originBody ?? JSON.stringify({ schema: 'ZGMINI_HANDOFF_ISOLATED_ORIGIN_V1', testId })
  };
  const github = { rest: { issues: {
    async get({ issue_number }) {
      assert.equal(issue_number, 700);
      return { data: origin };
    },
    async listComments({ issue_number }) {
      assert.ok(comments.has(issue_number));
      return { data: [...comments.get(issue_number)] };
    },
    async createComment({ issue_number, body }) {
      assert.ok(comments.has(issue_number));
      writes.push({ issue_number, body });
      comments.get(issue_number).push({ body, user: { login: 'github-actions[bot]' } });
    }
  } } };
  const lines = [];
  const core = { info: line => lines.push(line) };
  return { github, context, core, writes, comments, lines };
}

test('isolated workflow requires opt-in and a dedicated non-production runner label', () => {
  assert.match(workflow, /ZGMINI_HANDOFF_ISOLATED_TEST_ENABLED == 'true'/);
  assert.match(workflow, /runs-on: \[self-hosted, Windows, X64, zgmini-handoff-isolated\]/);
  assert.match(workflow, /!contains\(github\.event\.issue\.labels\.\*\.name, 'agent-handoff'\)/);
  assert.doesNotMatch(workflow, /runs-on:.*zgmini-pc-control/);
  assert.doesNotMatch(workflow, /checkout@|E:\\ZGmini|pwsh|powershell|schedule:/i);
});

test('test-only incident writes exactly two receipts, then is idempotent', async () => {
  const f = fixture();
  await run(f.github, f.context, f.core);
  assert.deepEqual(f.writes.map(write => write.issue_number), [700, 701]);
  assert.match(f.lines[0], /2\/2 test receipts/);
  await run(f.github, f.context, f.core);
  assert.equal(f.writes.length, 2);
});

test('rejects incorrect origin owner before GitHub comments are created', async () => {
  const f = fixture({ originOwner: 'untrusted-user' });
  await assert.rejects(run(f.github, f.context, f.core), /TEST_ORIGIN_INVALID/);
  assert.equal(f.writes.length, 0);
});

test('rejects production agent-handoff labels before GitHub comments are created', async () => {
  const f = fixture({ labels: ['agent-handoff'] });
  await assert.rejects(run(f.github, f.context, f.core), /PRODUCTION_LABEL_FORBIDDEN/);
  assert.equal(f.writes.length, 0);
});

test('rejects malformed origin contracts before GitHub comments are created', async () => {
  const f = fixture({ originBody: JSON.stringify({ schema: 'WRONG', testId: 'isolated-20261109-1' }) });
  await assert.rejects(run(f.github, f.context, f.core), /TEST_ORIGIN_CONTRACT_INVALID/);
  assert.equal(f.writes.length, 0);
});

test('untrusted owner-authored comment cannot impersonate a verified bot receipt', async () => {
  const f = fixture();
  f.comments.get(700).push({
    body: JSON.stringify({
      schema: 'ZGMINI_HANDOFF_ISOLATED_ORIGIN_RECEIPT_V1',
      testId: 'isolated-20261109-1',
      incidentIssue: 701,
      status: 'TEST_ONLY_RECORDED'
    }),
    user: { login: 'ansqhd5774-Choi' }
  });
  await run(f.github, f.context, f.core);
  assert.deepEqual(f.writes.map(write => write.issue_number), [700, 701]);
});

test('an origin already bound to a distinct incident cannot be reused', async () => {
  const f = fixture();
  f.comments.get(700).push({
    body: JSON.stringify({
      schema: 'ZGMINI_HANDOFF_ISOLATED_ORIGIN_RECEIPT_V1',
      testId: 'isolated-20261109-1',
      incidentIssue: 699,
      status: 'TEST_ONLY_RECORDED'
    }),
    user: { login: 'github-actions[bot]' }
  });
  await assert.rejects(run(f.github, f.context, f.core), /TEST_ORIGIN_ALREADY_BOUND/);
  assert.equal(f.writes.length, 0);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { validateRequest, validateApproval, validateChildReport } from './er1-nov30-html-publish-entry.mjs';

const approved = JSON.parse(fs.readFileSync(new URL('./ER1_NOV30_HTML_PUBLISH_B_APPROVAL.json', import.meta.url), 'utf8'));
const event = { action: 'opened', issue: {
  user: { login: 'ansqhd5774-Choi' },
  title: 'pc-er1-nov30-html-publish-one-shot',
  labels: [{ name: 'pc-er1-approved' }],
  body: JSON.stringify({
    schema: 'ZGMINI_ER1_NOV30_HTML_PUBLISH_V1',
    operation: 'publish-saved-november-2026-html-only',
    requestId: 'pc-nov30-html-12345678-1234-4234-8234-123456789abc',
    chatId: 'chat-12345678-1234-4234-8234-123456789abc',
    sourceSha: approved.sourceSha, from: '2026-11-01', through: '2026-11-30',
  }),
} };
const env = {
  GITHUB_REPOSITORY: 'ansqhd5774-Choi/zgmini-pc-control',
  GITHUB_ACTOR: 'ansqhd5774-Choi', GITHUB_EVENT_NAME: 'issues',
  GITHUB_EVENT_ACTION: 'opened',
};

test('only exact owner, label, issue title, approved source and period admitted', () => {
  assert.equal(validateRequest(event, env).from, '2026-11-01');
  assert.throws(() => validateRequest(event, { ...env, GITHUB_ACTOR: 'untrusted' }),
    /NOV30_HTML_ISSUE_NOT_APPROVED/);
  assert.throws(() => validateRequest({ ...event, issue: {
    ...event.issue, title: 'pc-er1-dec31-html-publish-one-shot',
  } }, env), /NOV30_HTML_ISSUE_NOT_APPROVED/);
  assert.throws(() => validateRequest({ ...event, issue: {
    ...event.issue, body: event.issue.body.replace('2026-11-30', '2026-12-31'),
  } }, env), /NOV30_HTML_REQUEST_CONTRACT_STOP/);
  assert.throws(() => validateRequest({ ...event, issue: {
    ...event.issue, body: event.issue.body.replace('saved-november', 'fetch-november'),
  } }, env), /NOV30_HTML_REQUEST_CONTRACT_STOP/);
  assert.throws(() => validateRequest({ ...event, issue: {
    ...event.issue, body: event.issue.body.replace(
      '12345678-1234-4234-8234-123456789abc', '------------------------------------'),
  } }, env), /NOV30_HTML_REQUEST_CONTRACT_STOP/);
});

test('immutable approval is limited to both November half-month HTML D1 keys and zero supplier', () => {
  validateApproval(approved);
  for (const field of ['allowProviderCalls', 'allowExistingFeedWrites', 'allowRawVendorPublic',
    'allowFormulaChanges', 'allowSchedulerChanges', 'allowDirectDeployment']) {
    assert.throws(() => validateApproval({ ...approved, [field]: true }),
      /NOV30_HTML_APPROVAL_SCOPE_STOP/, field);
  }
  assert.throws(() => validateApproval({ ...approved, expectedEvents: 3050 }),
    /NOV30_HTML_APPROVAL_SCOPE_STOP/);
  assert.throws(() => validateApproval({ ...approved, outputKeys: ['market-calendar:earnings-display-html'] }),
    /NOV30_HTML_APPROVAL_SCOPE_STOP/);
  assert.throws(() => validateApproval({ ...approved, maxAutomaticRetries: 1 }),
    /NOV30_HTML_APPROVAL_SCOPE_STOP/);
});

const digest = 'a'.repeat(64);
const pass = {
  schema: 'ZGMINI_NOV30_HTML_PUBLISH_V1', status: 'PASS',
  code: 'NOV30_PUBLISH_D1_BOTH_VERIFIED', eventCount: 3051,
  coreReusedDayCount: 16, privateReusedDayCount: 14,
  d1Writes: 1, providerCalls: 0, coreWrites: 0, schedulerWrites: 0,
  existingFeedWrites: 0, rawRowsPublic: 0,
  publicationBatchId: 'c'.repeat(64),
  localHtmlSha256H1: digest, localHtmlSha256H2: 'b'.repeat(64),
  d1ReadbackSha256H1: digest, d1ReadbackSha256H2: 'b'.repeat(64),
};

test('only complete 30-day/3051-row no-GET/no-raw both-key D1 readback can pass', () => {
  assert.equal(validateChildReport(pass).eventCount, 3051);
  assert.equal(validateChildReport({ ...pass, d1Writes: 2 }).status, 'PASS');
  assert.equal(validateChildReport({ ...pass, code: 'NOV30_PUBLISH_D1_BOTH_ALREADY_MATCHED',
    d1Writes: 0 }).status, 'PASS');
  for (const invalid of [
    { eventCount: 3050 }, { coreReusedDayCount: 15 }, { providerCalls: 1 },
    { existingFeedWrites: 1 }, { coreWrites: 1 }, { schedulerWrites: 1 },
    { rawRowsPublic: 1 }, { d1Writes: 3 },
    { d1ReadbackSha256H1: 'b'.repeat(64) }, { localHtmlSha256H2: null },
    { publicationBatchId: null },
    { d1Writes: 0 },
    { code: 'NOV30_PUBLISH_UNVERIFIED' },
  ]) assert.throws(() => validateChildReport({ ...pass, ...invalid }),
    /NOV30_HTML_CHILD_(REPORT_CONTRACT|PASS_INCOMPLETE)_STOP/);
});

test('sensitive unexpected child fields never appear in issue report', () => {
  const output = validateChildReport({ ...pass, rawInput: '{secret}', vendorBody: 'raw' });
  assert.ok(!('rawInput' in output));
  assert.ok(!('vendorBody' in output));
  const blocked = validateChildReport({ schema: pass.schema,
    status: 'BLOCKED', code: 'NOV30_PUBLISH_SAVED_DAY_MISSING_STOP',
    providerCalls: 0, existingFeedWrites: 0, coreWrites: 0,
    schedulerWrites: 0, d1Writes: 0, rawRowsPublic: 0 });
  assert.equal(blocked.code, 'NOV30_PUBLISH_SAVED_DAY_MISSING_STOP');
  assert.equal(blocked.eventCount, 0);
});

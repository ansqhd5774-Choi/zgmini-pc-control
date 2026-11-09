import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {R6_ONE_SHOT} from './contract.mjs';
import {
  R6_WINDOWS_B_HOST_SCHEMA, inspectR6BApprovalContractFixture,
  runR6BWindowsAdapter,
} from './windows-adapter.mjs';

const sourceSha = 'a'.repeat(40), controlSha = 'b'.repeat(40);
const requestId = 'fce55270-a893-44c6-b9c4-0aadd73059ce';
const chatId = '00171969-0112-4a9b-b5aa-a871087c0a20';
const approval = {
  schema: R6_ONE_SHOT.approvalSchema, approvalState: 'APPROVED_B_ONE_SHOT',
  scope: R6_ONE_SHOT.scope, sourceRepository: R6_ONE_SHOT.sourceRepository,
  sourceSha, controlSha, coreDatabasePath: R6_ONE_SHOT.coreDatabasePath,
  runCount: 1, maxBlsRequests: 18, maxDolRequests: 2,
  maxTotalRequests: 20, blsUnregistered24hLimit: 25,
  allowProviderCalls: true, allowLocalRawDbWrites: true,
  allowD1Writes: false, allowSchedulerChanges: false,
  allowCoreSourceChanges: false, maxAutomaticRetries: 0,
};
const manifestBytes = Buffer.from(JSON.stringify(approval));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const pins = {sourceSha, controlSha, approvalManifestSha256: hash(manifestBytes)};
const event = {
  action: 'opened', repository: {private: true},
  issue: {
    user: {login: R6_ONE_SHOT.owner}, title: R6_ONE_SHOT.issueTitle,
    labels: [{name: R6_ONE_SHOT.issueLabel}],
    body: JSON.stringify({schema: R6_ONE_SHOT.schema,
      operation: 'employment-r6-backfill-once', requestId, chatId, ...pins}),
  },
};
const env = {
  GITHUB_REPOSITORY: R6_ONE_SHOT.repository,
  GITHUB_ACTOR: R6_ONE_SHOT.owner,
  GITHUB_EVENT_NAME: 'issues', GITHUB_EVENT_ACTION: 'opened',
};

test('no approved effect pins: even a plausible issue never opens a Windows B job', async () => {
  const actual = await runR6BWindowsAdapter({event, env});
  assert.equal(actual.schema, R6_WINDOWS_B_HOST_SCHEMA);
  assert.equal(actual.status, 'BLOCKED');
  assert.equal(actual.code, 'R6_B_EFFECT_APPROVAL_PINS_NOT_INSTALLED');
  assert.equal(actual.executable, false);
  assert.equal(actual.providerRequests, 0);
  assert.equal(actual.allowProviderCalls, false);
  assert.equal(actual.allowDbWrites, false);
  assert.equal(actual.retry, 'NO_AUTO_RETRY');
});

test('Issue-supplied pins and injected executor have no authority to bypass the static host gate', async () => {
  let forbiddenCalls = 0;
  const anyEffect = () => { forbiddenCalls++; throw Error('EFFECT_INVOKED'); };
  const result = await runR6BWindowsAdapter({
    event, env: {...env, R6_APPROVAL_MANIFEST_SHA256: pins.approvalManifestSha256},
    pins, manifestBytes,
    callbacks: {verifyApprovedScope:anyEffect, verifyProtectedHost:anyEffect,
      reserveBlsBatch:anyEffect, collectBackfill:anyEffect, auditEffects:anyEffect},
    fetchImpl: anyEffect, openSqlite: anyEffect, postReport: anyEffect,
  });
  assert.equal(result.code, 'R6_B_EFFECT_APPROVAL_PINS_NOT_INSTALLED');
  assert.equal(forbiddenCalls, 0);
});

test('pure synthetic contract fixture is never runtime authorization', () => {
  const inspected = inspectR6BApprovalContractFixture({event, env, pins, manifestBytes});
  assert.equal(inspected.status, 'FIXTURE_ONLY_NOT_EXECUTABLE');
  assert.equal(inspected.code, 'R6_B_CONTRACT_BYTES_MATCH_FIXTURE');
  assert.equal(inspected.executable, false);
  assert.equal(inspected.allowProviderCalls, false);
  assert.equal(inspected.allowDbWrites, false);
});

test('synthetic fixture rejects a changed manifest or widened DB effect', () => {
  const tampered = Buffer.from(JSON.stringify({...approval, allowD1Writes: true}));
  const mismatch = inspectR6BApprovalContractFixture({event, env, pins, manifestBytes: tampered});
  assert.equal(mismatch.status, 'BLOCKED');
  const expanded = Buffer.from(JSON.stringify({...approval, maxTotalRequests: 40}));
  const newPins = {...pins, approvalManifestSha256: hash(expanded)};
  const newEvent = {...event, issue:{...event.issue,
    body:JSON.stringify({...JSON.parse(event.issue.body), approvalManifestSha256:newPins.approvalManifestSha256})}};
  const denied = inspectR6BApprovalContractFixture({event:newEvent, env, pins:newPins,
    manifestBytes:expanded});
  assert.equal(denied.status, 'BLOCKED');
  assert.equal(denied.executable, false);
});


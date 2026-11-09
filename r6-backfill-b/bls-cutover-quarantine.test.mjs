import test from 'node:test';
import assert from 'node:assert/strict';
import { assessR6BlsCutoverQuarantine } from './bls-cutover-quarantine.mjs';

const ALL = [
  'DOL_UI_WEEKLY_CLAIMS', 'BLS_EMPLOYMENT_SITUATION', 'BLS_JOLTS',
  'BLS_ECI', 'BLS_STATE_MSA', 'BLS_BED',
];
const pinned = Object.freeze({
  preparedSourceSha: 'a'.repeat(40), activationManifestSha256: 'b'.repeat(64),
});
const NOW = '2026-11-10T12:00:00.000Z';
const CUTOVER = '2026-11-09T12:00:00.000Z';

function proof(overrides = {}) {
  const hostProof = {
    schema: 'ZGMINI_BLS_UNREGISTERED_HOST_CUTOVER_PROOF_V1',
    status: 'INDEPENDENT_WINDOWS_RUNTIME_COVERAGE_VERIFIED',
    preparedSourceSha: pinned.preparedSourceSha,
    activationManifestSha256: pinned.activationManifestSha256,
    callers: ['CORE', 'GROWTH_MONTHLY', 'R4_ONE_YEAR'],
    untrackedPcCallers: 0,
    externalEgressScope: 'ALL_UNREGISTERED_BLS_EGRESS_VERIFIED',
    untrackedExternalCallers: 0,
    continuousProtectionVerified: true,
    precutoverQuarantineMode: 'ALL_UNREGISTERED_BLS_PHYSICAL_CALLS_BLOCKED',
    quarantineContinuouslyEnforced: true,
    cutoverAt: CUTOVER, observedAt: NOW,
    ...overrides.host,
  };
  const journalProof = {
    schema: 'ZGMINI_BLS_UNREGISTERED_SHARED_JOURNAL_PROOF_V1',
    status: 'ANCHOR_AND_ATOMIC_HISTORY_VERIFIED',
    preparedSourceSha: pinned.preparedSourceSha,
    activationManifestSha256: pinned.activationManifestSha256,
    cutoverAt: CUTOVER,
    continuousHistoryVerified: true,
    quarantinePhysicalAttemptsVerified: true,
    quarantinePhysicalAttempts: 0,
    anchorSha256: 'c'.repeat(64),
    occupiedSlots24h: 7,
    observedAt: NOW,
    ...overrides.journal,
  };
  return {
    now: new Date(NOW), dueGroups: ALL,
    reviewedPins: pinned, hostProof, journalProof,
    ...overrides.other,
  };
}
const run = overrides => assessR6BlsCutoverQuarantine(proof(overrides));
const denied = (result, code) => {
  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.code, code);
  assert.equal(result.allowProviderCalls, false);
  assert.equal(result.allowDbWrites, false);
  assert.equal(result.executable, false);
  assert.equal(result.providerRequests, 0);
};

test('full 24h quarantine with attested 7 occupied slots remains read-only', () => {
  const result = run();
  assert.equal(result.status, 'READY_FOR_ATOMIC_RECHECK_NOT_EXECUTABLE');
  assert.equal(result.expectedBlsRequests, 18);
  assert.equal(result.expectedDolRequests, 2);
  assert.equal(result.occupiedSlots24h, 7);
  assert.equal(result.remainingSlots24h, 18);
  assert.equal(result.allowProviderCalls, false);
  assert.equal(result.allowDbWrites, false);
  assert.equal(result.executable, false);
  assert.equal(result.providerRequests, 0);
});

test('23h59m quarantine cannot be interpreted as historical zero', () => {
  denied(run({host: {cutoverAt: '2026-11-09T12:01:00.000Z'},
    journal: {cutoverAt: '2026-11-09T12:01:00.000Z'}}),
  'R6_B_QUARANTINE_24H_NOT_ELAPSED');
});

test('8 occupied plus 18 new BLS requests is denied without network', () => {
  const result = run({journal: {occupiedSlots24h: 8}});
  denied(result, 'R6_B_QUARANTINE_CAPACITY_INSUFFICIENT');
  assert.equal(result.remainingSlots24h, 17);
});

test('unknown IP clients cannot be misrepresented by a PC-only caller list', () => {
  denied(run({host: {externalEgressScope: 'PC_ONLY',
    untrackedExternalCallers: null}}), 'R6_B_QUARANTINE_COVERAGE_UNVERIFIED');
  denied(run({host: {untrackedExternalCallers: 1}}),
    'R6_B_QUARANTINE_COVERAGE_UNVERIFIED');
});

test('missing, extra or duplicate caller paths deny even if count is zero', () => {
  for (const callers of [
    ['CORE', 'GROWTH_MONTHLY'],
    ['CORE', 'GROWTH_MONTHLY', 'R4_ONE_YEAR', 'EXTRA'],
    ['CORE', 'CORE', 'R4_ONE_YEAR'],
  ]) denied(run({host: {callers}}), 'R6_B_QUARANTINE_COVERAGE_UNVERIFIED');
});

test('disabled or interrupted guard cannot pass a 24h time condition', () => {
  denied(run({host: {continuousProtectionVerified: false}}),
    'R6_B_QUARANTINE_COVERAGE_UNVERIFIED');
  denied(run({journal: {continuousHistoryVerified: false}}),
    'R6_B_QUARANTINE_JOURNAL_UNVERIFIED');
});

test('delaying only R6 does not protect normal Core/R4 calls before 24h', () => {
  denied(run({host: {precutoverQuarantineMode: 'R6_BATCH_ONLY'}}),
    'R6_B_QUARANTINE_COVERAGE_UNVERIFIED');
  denied(run({host: {quarantineContinuouslyEnforced: false}}),
    'R6_B_QUARANTINE_COVERAGE_UNVERIFIED');
  denied(run({journal: {quarantinePhysicalAttemptsVerified: false}}),
    'R6_B_QUARANTINE_JOURNAL_UNVERIFIED');
  denied(run({journal: {quarantinePhysicalAttempts: 1}}),
    'R6_B_QUARANTINE_JOURNAL_UNVERIFIED');
  denied(run({journal: {quarantinePhysicalAttempts: null}}),
    'R6_B_QUARANTINE_JOURNAL_UNVERIFIED');
});

test('Issue-like source SHA and activation digest cannot replace reviewed pins', () => {
  denied(run({host: {preparedSourceSha: 'f'.repeat(40)}}),
    'R6_B_QUARANTINE_COVERAGE_UNVERIFIED');
  denied(run({journal: {activationManifestSha256: 'a'.repeat(64)}}),
    'R6_B_QUARANTINE_JOURNAL_UNVERIFIED');
  denied(run({other: {reviewedPins: null}}),
    'R6_B_QUARANTINE_REVIEWED_PINS_MISSING');
});

test('missing or inconsistent journal anchor does not default to zero', () => {
  for (const occupiedSlots24h of [null, -1, 26, 2.5, NaN])
    denied(run({journal: {occupiedSlots24h}}),
      'R6_B_QUARANTINE_JOURNAL_UNVERIFIED');
  denied(run({journal: {anchorSha256: null}}),
    'R6_B_QUARANTINE_JOURNAL_UNVERIFIED');
  denied(run({journal: {cutoverAt: '2026-11-08T12:00:00.000Z'}}),
    'R6_B_QUARANTINE_JOURNAL_UNVERIFIED');
});

test('stale host or journal observations cannot certify current coverage', () => {
  denied(run({host: {observedAt: '2026-11-10T11:57:59.000Z'}}),
    'R6_B_QUARANTINE_OBSERVATION_STALE');
  denied(run({journal: {observedAt: '2026-11-10T12:00:01.000Z'}}),
    'R6_B_QUARANTINE_OBSERVATION_STALE');
});

test('DOL-only and empty due plans are not artificial BLS execution grants', () => {
  denied(run({other: {dueGroups: ['DOL_UI_WEEKLY_CLAIMS']}}),
    'R6_B_QUARANTINE_NO_BLS_DUE');
  denied(run({other: {dueGroups: []}}),
    'R6_B_QUARANTINE_NO_BLS_DUE');
  denied(run({other: {dueGroups: ['NOT_APPROVED']}}),
    'R6_B_QUARANTINE_GROUP_SCOPE_STOP');
});

test('proof fixtures are not mutated or persisted', () => {
  const input = proof();
  const before = JSON.stringify(input);
  assessR6BlsCutoverQuarantine(input);
  assert.equal(JSON.stringify(input), before);
});

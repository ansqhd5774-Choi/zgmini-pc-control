import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { checkR6BEntryPreflight } from './entry-preflight.mjs';
import { R6_ONE_SHOT } from './contract.mjs';

const W = path.win32;
const REQUEST = '11111111-1111-4111-8111-111111111111';
const CHAT = '22222222-2222-4222-8222-222222222222';
const CONTROL = 'a'.repeat(40), SOURCE = 'b'.repeat(40);
const NOW = new Date('2026-11-09T12:00:00.000Z');
const WORKSPACE = String.raw`C:\actions\_work\r6`;
const DATA_BASE = String.raw`E:\ZGmini\data\pc-writer`;
const NODE = String.raw`E:\ZGmini\runtime\node.exe`;
const CORE_DB = W.join(DATA_BASE, 'storage', 'core.sqlite');
const CONTROL_ROOT = W.join(WORKSPACE, 'r6-control');
const SOURCE_ROOT = W.join(WORKSPACE, 'r6-source');
const manifest = {
  schema: R6_ONE_SHOT.approvalSchema,
  approvalState: 'APPROVED_B_ONE_SHOT', scope: R6_ONE_SHOT.scope,
  sourceRepository: R6_ONE_SHOT.sourceRepository, sourceSha: SOURCE,
  controlSha: CONTROL, coreDatabasePath: CORE_DB, runCount: 1,
  maxBlsRequests: 18, maxDolRequests: 2, maxTotalRequests: 20,
  blsUnregistered24hLimit: 25, allowProviderCalls: true,
  allowLocalRawDbWrites: true, allowD1Writes: false,
  allowSchedulerChanges: false, allowCoreSourceChanges: false,
  maxAutomaticRetries: 0,
};
const manifestBytes = Buffer.from(JSON.stringify(manifest));
const pins = { sourceSha: SOURCE, controlSha: CONTROL,
  approvalManifestSha256: createHash('sha256').update(manifestBytes).digest('hex') };
const request = { schema: R6_ONE_SHOT.schema,
  operation: 'employment-r6-backfill-once', requestId: REQUEST,
  chatId: CHAT, sourceSha: SOURCE, controlSha: CONTROL,
  approvalManifestSha256: pins.approvalManifestSha256 };
const event = { action: 'opened', repository: { private: true },
  issue: { title: R6_ONE_SHOT.issueTitle, body: JSON.stringify(request),
    user: { login: R6_ONE_SHOT.owner },
    labels: [{ name: R6_ONE_SHOT.issueLabel }] } };
const env = { GITHUB_REPOSITORY: R6_ONE_SHOT.repository,
  GITHUB_ACTOR: R6_ONE_SHOT.owner, GITHUB_EVENT_NAME: 'issues',
  GITHUB_EVENT_ACTION: 'opened', GITHUB_WORKSPACE: WORKSPACE };

function setup() {
  const calls = [];
  const types = new Map([
    [WORKSPACE, 'dir'], [CONTROL_ROOT, 'dir'], [SOURCE_ROOT, 'dir'],
    [NODE, 'file'], [DATA_BASE, 'dir'], [CORE_DB, 'file'],
  ]);
  const io = {
    lstatSync(file) {
      calls.push(`stat:${file}`);
      const kind = types.get(file);
      if (!kind) throw Error('ENOENT');
      return { isFile: () => kind === 'file', isDirectory: () => kind === 'dir',
        isSymbolicLink: () => false };
    },
    realpathSync: { native: file => { calls.push(`real:${file}`); return file; } },
  };
  const options = {
    event, env, pins, manifestBytes, approvedDataBase: DATA_BASE,
    io, platform: 'win32', now: NOW,
    async gitInspect({ role }) {
      calls.push(`git:${role}`);
      return { head: role === 'control' ? CONTROL : SOURCE, dirty: false };
    },
    async coreLease({ requestId, canonicalCoreDb }) {
      calls.push('core-lease');
      return { status: 'EXCLUSIVE_CORE_LEASE_VERIFIED', requestId, canonicalCoreDb,
        leaseId: '33333333-3333-4333-8333-333333333333', observedAt: NOW.toISOString() };
    },
    async blsCoverage({ requestId, canonicalBase, sourceSha }) {
      calls.push('coverage');
      return { status: 'ALL_BLS_UNREGISTERED_CALLERS_VERIFIED', requestId,
        canonicalBase, sourceSha, trackedCallers: 3, untrackedCallers: 0,
        journalAnchorSha256: 'c'.repeat(64), observedAt: NOW.toISOString() };
    },
  };
  return { options, calls, types };
}

test('read-only structural checks PASS does not authorize provider or DB writes', async () => {
  const { options, calls } = setup();
  const result = await checkR6BEntryPreflight(options);
  assert.equal(result.status, 'STRUCTURAL_PREFLIGHT_PASS_NOT_EXECUTABLE');
  assert.equal(result.verifiedCheckoutCount, 2);
  assert.equal(result.coreDbExisting, true);
  assert.equal(result.trackedBlsCallers, 3);
  assert.equal(result.allowProviderCalls, false);
  assert.equal(result.allowDbWrites, false);
  assert.equal(result.executable, false);
  assert.deepEqual(calls.slice(-4), ['git:control','git:source','core-lease','coverage']);
});

test('forged or wrong-owner Issue rejects before even filesystem probes', async () => {
  const { options, calls } = setup();
  options.event = { ...event, issue: { ...event.issue, user: { login: 'different' } } };
  const result = await checkR6BEntryPreflight(options);
  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.allowProviderCalls, false);
  assert.deepEqual(calls, []);
});

test('changed immutable manifest bytes reject before filesystem or DB planning', async () => {
  const { options, calls } = setup();
  options.manifestBytes = Buffer.from(manifestBytes.toString() + ' ');
  const result = await checkR6BEntryPreflight(options);
  assert.equal(result.status, 'BLOCKED');
  assert.deepEqual(calls, []);
});

test('missing existing core.sqlite fails closed, without attempting its creation', async () => {
  const { options, calls, types } = setup();
  types.delete(CORE_DB);
  const result = await checkR6BEntryPreflight(options);
  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.code, 'R6_B_CORE_DB_FILE_MISSING');
  assert.ok(!calls.some(x => x.startsWith('git:')));
});

test('another existing E: core.sqlite is rejected even if the host approves its base', async () => {
  const { options, calls, types } = setup();
  const otherBase = String.raw`E:\ZGmini\data\different-writer`;
  const otherDb = W.join(otherBase, 'storage', 'core.sqlite');
  types.set(otherBase, 'dir');
  types.set(otherDb, 'file');
  options.approvedDataBase = otherBase;
  const result = await checkR6BEntryPreflight(options);
  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.code, 'R6_B_APPROVED_CORE_DB_PATH_STOP');
  assert.ok(!calls.some(x => x.startsWith('git:')));
});

test('dirty checkout does not pass even when both HEAD SHAs match pins', async () => {
  const { options, calls } = setup();
  options.gitInspect = async ({ role }) => {
    calls.push(`git:${role}`);
    return { head: role === 'control' ? CONTROL : SOURCE,
      dirty: role === 'source' };
  };
  const result = await checkR6BEntryPreflight(options);
  assert.equal(result.code, 'R6_B_CHECKOUT_SHA_OR_DIRTY_STOP');
  assert.ok(!calls.includes('core-lease'));
});

test('unverified Core lease and BLS caller coverage must not be treated as PASS', async () => {
  const first = setup();
  first.options.coreLease = async () => null;
  const a = await checkR6BEntryPreflight(first.options);
  assert.equal(a.code, 'R6_B_CORE_LEASE_UNVERIFIED');
  const second = setup();
  second.options.blsCoverage = async () => null;
  const b = await checkR6BEntryPreflight(second.options);
  assert.equal(b.code, 'R6_B_BLS_COVERAGE_UNVERIFIED');
});

test('stale caller coverage or nonzero untracked BLS callers refuses admission', async () => {
  const first = setup();
  first.options.blsCoverage = async ({ requestId, canonicalBase, sourceSha }) => ({
    status: 'ALL_BLS_UNREGISTERED_CALLERS_VERIFIED', requestId, canonicalBase,
    sourceSha, trackedCallers: 3, untrackedCallers: 1,
    journalAnchorSha256: 'c'.repeat(64), observedAt: NOW.toISOString(),
  });
  assert.equal((await checkR6BEntryPreflight(first.options)).code,
    'R6_B_BLS_COVERAGE_UNVERIFIED');
  const second = setup();
  second.options.blsCoverage = async ({ requestId, canonicalBase, sourceSha }) => ({
    status: 'ALL_BLS_UNREGISTERED_CALLERS_VERIFIED', requestId, canonicalBase,
    sourceSha, trackedCallers: 3, untrackedCallers: 0,
    journalAnchorSha256: 'c'.repeat(64), observedAt: '2026-11-08T00:00:00.000Z',
  });
  assert.equal((await checkR6BEntryPreflight(second.options)).code,
    'R6_B_BLS_COVERAGE_UNVERIFIED');
});

test('non-Windows runtime refuses before inspecting PC paths', async () => {
  const { options, calls } = setup();
  options.platform = 'linux';
  const result = await checkR6BEntryPreflight(options);
  assert.equal(result.code, 'R6_B_WINDOWS_ONLY_STOP');
  assert.deepEqual(calls, []);
});

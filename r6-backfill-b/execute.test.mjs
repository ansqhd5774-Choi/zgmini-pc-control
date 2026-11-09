import test from 'node:test';
import assert from 'node:assert/strict';
import { coordinateR6BackfillOnce } from './execute.mjs';
import { R6_ONE_SHOT } from './contract.mjs';

const REQUEST = '11111111-1111-4111-8111-111111111111';
const ALL = Object.keys(R6_ONE_SHOT.groups);
const plan = due => ALL.map(groupName => ({ groupName, due: due.includes(groupName) }));

function fixture({ due = ['BLS_JOLTS'], events = [],
  plans = plan(due), collectResult, auditResult, admission, claim, reservation } = {}) {
  const cost = { bls: due.reduce((sum, group) => sum + R6_ONE_SHOT.groups[group], 0),
    dol: due.includes('DOL_UI_WEEKLY_CLAIMS') ? 2 : 0 };
  const rows = due.map(groupName => ({ groupName, status: 'SUCCESS',
    providerRequests: groupName === 'DOL_UI_WEEKLY_CLAIMS' ? 2 : R6_ONE_SHOT.groups[groupName] }));
  const counters = { bls: rows.filter(x => x.groupName !== 'DOL_UI_WEEKLY_CLAIMS')
    .reduce((sum, x) => sum + x.providerRequests, 0),
    dol: rows.filter(x => x.groupName === 'DOL_UI_WEEKLY_CLAIMS')
      .reduce((sum, x) => sum + x.providerRequests, 0) };
  const collected = collectResult ?? { status: 'SUCCESS',
    providerRequests: counters.bls + counters.dol, groupResults: rows };
  return {
    requestId: REQUEST,
    async verifyApprovedScope({ requestId }) {
      events.push('scope'); return { status: 'APPROVED_B_SCOPE_VERIFIED', requestId };
    },
    async verifyProtectedHost() {
      events.push('host'); return { status: 'PROTECTED_HOST_VERIFIED',
        coreLaneExclusive: true, allBlsCallersTracked: true, sharedJournalVerified: true };
    },
    async planDueGroups({ mode, groups }) {
      events.push('plan'); assert.equal(mode, 'BACKFILL');
      assert.deepEqual(groups, ALL); return plans;
    },
    async inspectQuotaAdmission({ cost: provided, dueGroups }) {
      events.push('admission'); assert.deepEqual(dueGroups, due);
      assert.deepEqual(provided, { bls: cost.bls, dol: cost.dol, total: cost.bls + cost.dol });
      return admission ?? { status: 'READY_FOR_ATOMIC_RECHECK',
        expectedBlsRequests: cost.bls, expectedDolRequests: cost.dol,
        allowProviderCalls: false };
    },
    async claimOneShot({ requestId, dueGroups, cost: claimCost }) {
      // Claim is approval-wide and must happen before any DB-writing plan.
      assert.equal(dueGroups, undefined);
      assert.equal(claimCost, undefined);
      events.push('claim'); return claim ?? { status: 'CLAIMED_NO_RETRY', requestId };
    },
    async reserveBlsBatch({ requestId, count, maxDaily }) {
      events.push(`reserve:${count}`); assert.equal(count, cost.bls);
      assert.equal(maxDaily, 25);
      return reservation ?? { requestId, reserved: count };
    },
    quotaAdapter: {
      fetchR6WithLease(id) {
        events.push('lease-fetch'); assert.equal(id, REQUEST);
        return async () => { events.push('physical-fetch'); throw Error('NEVER_NETWORK'); };
      },
    },
    async collectBackfill(args) {
      events.push('collector'); assert.equal(args.mode, 'BACKFILL');
      assert.deepEqual(args.groups, due);
      assert.equal(typeof args.fetchImpl, 'function');
      return collected;
    },
    async auditEffects({ noop }) {
      events.push('audit');
      return auditResult ?? { providerRequestsVerified: true,
        localRawDbEffectsVerified: true, d1Writes: 0, schedulerWrites: 0,
        coreSourceWrites: 0, blsRequests: noop ? 0 : counters.bls,
        dolRequests: noop ? 0 : counters.dol };
    },
  };
}

test('partial resume reserves exactly due BLS slots and passes only due groups to BACKFILL', async () => {
  const events = [];
  const due = ['DOL_UI_WEEKLY_CLAIMS', 'BLS_JOLTS', 'BLS_BED'];
  const result = await coordinateR6BackfillOnce(fixture({ due, events }));
  assert.equal(result.status, 'SUCCESS');
  assert.equal(result.providerRequests, 14);
  assert.equal(result.blsRequests, 12);
  assert.equal(result.dolRequests, 2);
  assert.equal(result.effectsVerified, true);
  assert.deepEqual(events, ['scope','host','claim','plan','admission','reserve:12',
    'lease-fetch','collector','audit']);
});

test('approval is required before the planner can initialize or access DB', async () => {
  const events = [];
  const options = fixture({ events });
  options.verifyApprovedScope = async () => { events.push('scope-reject'); return null; };
  const result = await coordinateR6BackfillOnce(options);
  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.code, 'R6_B_APPROVAL_UNVERIFIED');
  assert.deepEqual(events, ['scope-reject']);
});

test('host verification including Core lane and caller coverage precedes planner', async () => {
  const events = [];
  const options = fixture({ events });
  options.verifyProtectedHost = async () => {
    events.push('host-reject'); return { status: 'PROTECTED_HOST_VERIFIED',
      coreLaneExclusive: true, allBlsCallersTracked: false, sharedJournalVerified: true };
  };
  const result = await coordinateR6BackfillOnce(options);
  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.code, 'R6_B_HOST_OR_SHARED_QUOTA_UNVERIFIED');
  assert.deepEqual(events, ['scope','host-reject']);
});

test('already completed and attempted groups consume one-shot ID with no reservation', async () => {
  const events = [];
  const result = await coordinateR6BackfillOnce(fixture({ due: [], events }));
  assert.equal(result.status, 'NOOP');
  assert.equal(result.providerRequests, 0);
  assert.equal(result.effectsVerified, true);
  assert.deepEqual(events, ['scope','host','claim','plan','audit']);
});

test('a zero-due request with an already-claimed ID cannot be replayed when data changes', async () => {
  const events = [];
  const result = await coordinateR6BackfillOnce(fixture({ due: [], events,
    claim: { status: 'ALREADY_CLAIMED', requestId: REQUEST } }));
  assert.equal(result.status, 'STATE_UNKNOWN');
  assert.equal(result.code, 'R6_B_ONESHOT_CLAIM_UNVERIFIED');
  assert.equal(result.providerRequests, null);
  assert.deepEqual(events, ['scope','host','claim']);
});

test('a DOL-only resume never reserves BLS but still uses the isolated B adapter', async () => {
  const events = [];
  const result = await coordinateR6BackfillOnce(fixture({ due: ['DOL_UI_WEEKLY_CLAIMS'], events }));
  assert.equal(result.status, 'SUCCESS');
  assert.equal(result.blsRequests, 0);
  assert.equal(result.dolRequests, 2);
  assert.deepEqual(events, ['scope','host','claim','plan','admission',
    'lease-fetch','collector','audit']);
});

test('a duplicate/ambiguous global claim cannot enter provider code or be retried', async () => {
  const events = [];
  const result = await coordinateR6BackfillOnce(fixture({ events,
    claim: { status: 'ALREADY_CLAIMED', requestId: REQUEST } }));
  assert.equal(result.status, 'STATE_UNKNOWN');
  assert.equal(result.code, 'R6_B_ONESHOT_CLAIM_UNVERIFIED');
  assert.equal(result.providerRequests, null);
  assert.deepEqual(events, ['scope','host','claim']);
});

test('a claim callback that persists then throws remains STATE_UNKNOWN without DB planning', async () => {
  const events = [];
  const options = fixture({ events });
  options.claimOneShot = async () => {
    events.push('claim-fsync-then-error');
    throw Object.assign(new Error('R6_B_CLAIM_ACK_LOST'), { code: 'R6_B_CLAIM_ACK_LOST' });
  };
  const result = await coordinateR6BackfillOnce(options);
  assert.equal(result.status, 'STATE_UNKNOWN');
  assert.equal(result.code, 'R6_B_CLAIM_ACK_LOST');
  assert.equal(result.providerRequests, null);
  assert.deepEqual(events, ['scope','host','claim-fsync-then-error']);
});

test('a planner crash after durable claim cannot be classified retryable', async () => {
  const events = [];
  const options = fixture({ events });
  options.planDueGroups = async () => {
    events.push('plan-crash');
    throw Object.assign(new Error('R6_B_SQLITE_PLAN_CRASH'), { code: 'R6_B_SQLITE_PLAN_CRASH' });
  };
  const result = await coordinateR6BackfillOnce(options);
  assert.equal(result.status, 'STATE_UNKNOWN');
  assert.equal(result.code, 'R6_B_SQLITE_PLAN_CRASH');
  assert.equal(result.effectsVerified, false);
  assert.deepEqual(events, ['scope','host','claim','plan-crash']);
});

test('quota preflight refusal cannot reserve or call collector', async () => {
  const events = [];
  const result = await coordinateR6BackfillOnce(fixture({ events,
    admission: { status: 'BLOCKED', expectedBlsRequests: 2, expectedDolRequests: 0,
      allowProviderCalls: false } }));
  assert.equal(result.status, 'STATE_UNKNOWN'); // planner can initialize existing DB
  assert.equal(result.code, 'R6_B_QUOTA_PREFLIGHT_NOT_READY');
  assert.deepEqual(events, ['scope','host','claim','plan','admission']);
});

test('reservation mismatch fails closed before lease fetch and collector', async () => {
  const events = [];
  const result = await coordinateR6BackfillOnce(fixture({ events,
    reservation: { requestId: REQUEST, reserved: 1 } }));
  assert.equal(result.status, 'STATE_UNKNOWN');
  assert.equal(result.code, 'R6_B_BATCH_RESERVATION_UNVERIFIED');
  assert.deepEqual(events, ['scope','host','claim','plan','admission','reserve:2']);
});

test('collector cannot invent extra group or count more calls than reserved', async () => {
  const events = [];
  const bad = { status: 'SUCCESS', providerRequests: 3,
    groupResults: [{ groupName: 'BLS_JOLTS', status: 'SUCCESS', providerRequests: 3 }] };
  const result = await coordinateR6BackfillOnce(fixture({ events, collectResult: bad }));
  assert.equal(result.status, 'STATE_UNKNOWN');
  assert.equal(result.code, 'R6_B_COLLECTOR_GROUP_RESULT_INVALID');
  assert.equal(events.at(-1), 'collector');
});

test('missing post-run D1 or scheduler write proof is not silently set to zero', async () => {
  const events = [];
  const result = await coordinateR6BackfillOnce(fixture({ events,
    auditResult: { providerRequestsVerified: true, localRawDbEffectsVerified: true,
      d1Writes: null, schedulerWrites: 0, coreSourceWrites: 0, blsRequests: 2, dolRequests: 0 } }));
  assert.equal(result.status, 'STATE_UNKNOWN');
  assert.equal(result.code, 'R6_B_EFFECTS_NOT_VERIFIED');
  assert.equal(result.d1Writes, null);
  assert.equal(result.effectsVerified, false);
});

test('a weaker collector aggregate PARTIAL cannot be upgraded to SUCCESS', async () => {
  const result = await coordinateR6BackfillOnce(fixture({
    collectResult: { status: 'PARTIAL', providerRequests: 2,
      groupResults: [{ groupName: 'BLS_JOLTS', status: 'SUCCESS', providerRequests: 2 }] },
  }));
  assert.equal(result.status, 'PARTIAL');
  assert.equal(result.effectsVerified, true);
});

test('nonempty due groups reject contradictory aggregate NOOP, even with SUCCESS rows', async () => {
  const events = [];
  const result = await coordinateR6BackfillOnce(fixture({ events,
    collectResult: { status: 'NOOP', providerRequests: 2,
      groupResults: [{ groupName: 'BLS_JOLTS', status: 'SUCCESS', providerRequests: 2 }] },
  }));
  assert.equal(result.status, 'STATE_UNKNOWN');
  assert.equal(result.code, 'R6_B_COLLECTOR_STATUS_INCONSISTENT');
  assert.equal(result.effectsVerified, false);
  assert.equal(events.at(-1), 'collector');
});

test('a BLS guard with confirmed zero physical calls stays FAIL, not SUCCESS', async () => {
  const events = [];
  const result = await coordinateR6BackfillOnce(fixture({ events,
    collectResult: { status: 'FAIL', providerRequests: 0,
      groupResults: [{ groupName: 'BLS_JOLTS', status: 'FAIL', providerRequests: 0,
        failureCode: 'BLS_UNREG_25_PER_24H_STOP' }] },
    auditResult: { providerRequestsVerified: true, localRawDbEffectsVerified: true,
      d1Writes: 0, schedulerWrites: 0, coreSourceWrites: 0, blsRequests: 0, dolRequests: 0 },
  }));
  assert.equal(result.status, 'FAIL');
  assert.equal(result.providerRequests, 0);
  assert.equal(result.groupResults[0].failureCode, 'BLS_UNREG_25_PER_24H_STOP');
});

test('input callback failures never become executable CLI defaults', async () => {
  const result = await coordinateR6BackfillOnce({ requestId: REQUEST });
  assert.equal(result.status, 'STATE_UNKNOWN');
  assert.equal(result.code, 'R6_B_HOST_CALLBACK_UNAVAILABLE');
  assert.equal(result.effectsVerified, false);
});

import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  R6_ONE_SHOT, plannedR6BackfillCost,
  validateR6OneShotRequest, validateR6OneShotApproval, verifyR6OneShotApprovalBytes,
} from "./contract.mjs";
import { assessR6BackfillAdmission } from "./admission.mjs";
import { sanitizeR6BackfillResult } from "./report.mjs";

const sourceSha = "a".repeat(40), controlSha = "b".repeat(40);
const approvalManifestSha256 = "c".repeat(64);
const pins = { sourceSha, controlSha, approvalManifestSha256 };
const request = {
  schema: R6_ONE_SHOT.schema, operation: "employment-r6-backfill-once",
  requestId: "fce55270-a893-44c6-b9c4-0aadd73059ce",
  chatId: "00171969-0112-4a9b-b5aa-a871087c0a20",
  ...pins,
};
const event = {
  action: "opened", repository: { private: true },
  issue: {
    user: { login: R6_ONE_SHOT.owner }, title: R6_ONE_SHOT.issueTitle,
    labels: [{ name: R6_ONE_SHOT.issueLabel }], body: JSON.stringify(request),
  },
};
const env = {
  GITHUB_REPOSITORY: R6_ONE_SHOT.repository,
  GITHUB_ACTOR: R6_ONE_SHOT.owner,
  GITHUB_EVENT_NAME: "issues", GITHUB_EVENT_ACTION: "opened",
};
const approval = {
  schema: R6_ONE_SHOT.approvalSchema, approvalState: "APPROVED_B_ONE_SHOT",
  scope: R6_ONE_SHOT.scope, sourceRepository: R6_ONE_SHOT.sourceRepository,
  sourceSha, controlSha, coreDatabasePath: R6_ONE_SHOT.coreDatabasePath, runCount: 1,
  maxBlsRequests: 18, maxDolRequests: 2, maxTotalRequests: 20,
  blsUnregistered24hLimit: 25, allowProviderCalls: true,
  allowLocalRawDbWrites: true, allowD1Writes: false,
  allowSchedulerChanges: false, allowCoreSourceChanges: false,
  maxAutomaticRetries: 0,
};

test("R6 one-shot accepts only exact private owner issue and pinned SHA", () => {
  assert.deepEqual(validateR6OneShotRequest(event, env, pins), request);
  assert.throws(() => validateR6OneShotRequest(event, { ...env, GITHUB_ACTOR: "other" }, pins), /ISSUE_SCOPE_STOP/);
  assert.throws(() => validateR6OneShotRequest(event, env, { ...pins, sourceSha: "d".repeat(40) }), /IMMUTABLE_PIN_STOP/);
  const broader = { ...event, issue: { ...event.issue, body: JSON.stringify({ ...request, allowShell: true }) } };
  assert.throws(() => validateR6OneShotRequest(broader, env, pins), /REQUEST_CONTRACT_STOP/);
});

test("R6 one-shot exact approval refuses publication and repeat permissions", () => {
  assert.equal(validateR6OneShotApproval(approval, pins), true);
  assert.throws(() => validateR6OneShotApproval({ ...approval, allowD1Writes: true }, pins), /APPROVAL_SCOPE_STOP/);
  assert.throws(() => validateR6OneShotApproval({ ...approval, sourceSha: undefined }, {}), /APPROVAL_SCOPE_STOP/);
  assert.throws(() => validateR6OneShotApproval({ ...approval, runCount: 2 }, pins), /APPROVAL_SCOPE_STOP/);
  assert.throws(() => validateR6OneShotApproval({ ...approval,
    coreDatabasePath: String.raw`E:\ZGmini\data\other\storage\core.sqlite` }, pins), /APPROVAL_SCOPE_STOP/);
  assert.throws(() => validateR6OneShotApproval({ ...approval, allowTaskDefinitionChanges: true }, pins), /APPROVAL_SCOPE_STOP/);
});

test("R6 exact approval bytes must match immutable SHA256", () => {
  const bytes = Buffer.from(JSON.stringify(approval), "utf8");
  const manifestHash = createHash("sha256").update(bytes).digest("hex");
  const approvedPins = { ...pins, approvalManifestSha256: manifestHash };
  assert.deepEqual(verifyR6OneShotApprovalBytes(bytes, approvedPins), approval);
  assert.throws(() => verifyR6OneShotApprovalBytes(Buffer.from(JSON.stringify({
    ...approval, allowD1Writes: true,
  })), approvedPins), /APPROVAL_HASH_STOP/);
  assert.throws(() => verifyR6OneShotApprovalBytes(Buffer.from("not-json"), {
    ...pins, approvalManifestSha256: createHash("sha256").update("not-json").digest("hex"),
  }), /APPROVAL_JSON_STOP/);
  assert.throws(() => verifyR6OneShotApprovalBytes(Buffer.from(JSON.stringify({
    ...approval, runCount: 2,
  })), { ...pins, approvalManifestSha256: createHash("sha256")
    .update(JSON.stringify({ ...approval, runCount: 2 })).digest("hex") }), /APPROVAL_SCOPE_STOP/);
});

test("R6 one-shot cost is bounded to 6 named groups, BLS18 and DOL2", () => {
  assert.deepEqual(plannedR6BackfillCost(Object.keys(R6_ONE_SHOT.groups)), { bls: 18, dol: 2, total: 20 });
  assert.deepEqual(plannedR6BackfillCost(["BLS_ECI", "DOL_UI_WEEKLY_CLAIMS"]), { bls: 2, dol: 2, total: 4 });
  assert.throws(() => plannedR6BackfillCost(["BLS_JOLTS", "BLS_JOLTS"]), /GROUP_SCOPE_STOP/);
  assert.throws(() => plannedR6BackfillCost(["OTHER"]), /GROUP_SCOPE_STOP/);
});

const now = new Date("2026-11-09T03:00:00.000Z");
const ledger = used => ({ providers: { BLS: { requestTimes: Array(used).fill(now.getTime() - 1000) } } });
const good = {
  now, dueGroups: Object.keys(R6_ONE_SHOT.groups), globalQuotaLedger: ledger(7),
  quotaObservedAt: "2026-11-09T02:59:00.000Z", allUnregisteredBlsCallersTracked: true,
  r6RequestsCoveredByGlobalLedger: true, r6RunRequests24h: 2,
  coreDbExistingAndVerified: true, sourceIdentityVerified: true,
  exclusiveCoreLaneVerified: true, atomicBlsReservationAvailable: true,
};

test("7+18 preflight is only READY_FOR_ATOMIC_RECHECK, never execution permission", () => {
  const result = assessR6BackfillAdmission(good);
  assert.equal(result.status, "READY_FOR_ATOMIC_RECHECK");
  assert.equal(result.expectedBlsRequests, 18);
  assert.equal(result.remainingBlsRequests24h, 18);
  assert.equal(result.providerRequests, 0);
  assert.equal(result.allowProviderCalls, false);
});

test("8+18 is denied with zero requests", () => {
  const r = assessR6BackfillAdmission({ ...good, globalQuotaLedger: ledger(8) });
  assert.equal(r.code, "R6_B_BLS_QUOTA_INSUFFICIENT");
  assert.equal(r.providerRequests, 0);
});

test("unknown caller coverage, reservation or ledger fails closed", () => {
  assert.equal(assessR6BackfillAdmission({ ...good, allUnregisteredBlsCallersTracked: false }).code,
    "R6_B_QUOTA_COVERAGE_UNVERIFIED");
  assert.equal(assessR6BackfillAdmission({ ...good, atomicBlsReservationAvailable: false }).code,
    "R6_B_SHARED_RESERVATION_UNAVAILABLE");
  assert.equal(assessR6BackfillAdmission({ ...good, globalQuotaLedger: null }).code,
    "R6_B_QUOTA_LEDGER_INVALID");
  assert.equal(assessR6BackfillAdmission({ ...good, r6RunRequests24h: 9 }).code,
    "R6_B_QUOTA_LEDGER_INCONSISTENT");
  assert.equal(assessR6BackfillAdmission({ ...good, quotaObservedAt: "2026-11-09T02:55:00.000Z" }).code,
    "R6_B_QUOTA_SNAPSHOT_STALE");
});

test("unverified DB never gets an execution permission", () => {
  assert.equal(assessR6BackfillAdmission({ ...good, coreDbExistingAndVerified: false }).code,
    "R6_B_PC_SOURCE_OR_DB_UNVERIFIED");
  assert.equal(assessR6BackfillAdmission({ ...good, dueGroups: [] }).status, "NOOP");
});

test("B result report strips raw provider response and paths", () => {
  const safe = sanitizeR6BackfillResult({
    requestId: request.requestId, status: "PARTIAL", failureCode: "BLS_SERIES_PARTIAL",
    providerRequests: 2, blsRequests: 2, dolRequests: 0,
    d1Writes: 0, schedulerWrites: 0,
    token: "secret-must-never-appear", sourcePath: "E:/sensitive/raw.sqlite",
    groupResults: [{ groupName: "BLS_JOLTS", status: "PARTIAL", providerRequests: 2,
      failureCode: "BLS_SERIES_PARTIAL", rawBody: "private-observation-dump" }],
  });
  assert.equal(safe.status, "PARTIAL");
  assert.equal(safe.providerRequests, 2);
  assert.equal(safe.groupResults.length, 1);
  assert.equal(JSON.stringify(safe).includes("secret-must-never-appear"), false);
  assert.equal(JSON.stringify(safe).includes("private-observation-dump"), false);
  assert.equal(JSON.stringify(safe).includes("sensitive/raw.sqlite"), false);
});

test("B result report refuses unverified effects or out-of-bound calls", () => {
  const base = {
    requestId: request.requestId, status: "SUCCESS", providerRequests: 20,
    blsRequests: 18, dolRequests: 2, d1Writes: 0, schedulerWrites: 0,
    groupResults: Object.entries(R6_ONE_SHOT.groups).map(([groupName, max]) => ({
      groupName, status: "SUCCESS", providerRequests: groupName === "DOL_UI_WEEKLY_CLAIMS" ? 2 : max,
    })),
  };
  assert.equal(sanitizeR6BackfillResult(base).status, "SUCCESS");
  assert.equal(sanitizeR6BackfillResult({ ...base, d1Writes: 1 }).status, "STATE_UNKNOWN");
  assert.equal(sanitizeR6BackfillResult({ ...base, schedulerWrites: null }).status, "STATE_UNKNOWN");
  assert.equal(sanitizeR6BackfillResult({ ...base, providerRequests: 21 }).status, "STATE_UNKNOWN");
  assert.equal(sanitizeR6BackfillResult({ ...base, requestId: "sensitive" }).requestId, null);
  assert.equal(sanitizeR6BackfillResult({ ...base, groupResults: [] }).status, "STATE_UNKNOWN");
  assert.equal(sanitizeR6BackfillResult({ ...base, groupResults: base.groupResults.map(x =>
    x.groupName === "BLS_JOLTS" ? { ...x, providerRequests: 3 } : x) }).status, "STATE_UNKNOWN");
  assert.equal(sanitizeR6BackfillResult({ ...base, status: "NOOP" }).status, "STATE_UNKNOWN");
  assert.equal(sanitizeR6BackfillResult({ ...base, groupResults: [] }).providerRequests, null);
  const effectViolation = sanitizeR6BackfillResult({ ...base, d1Writes: 1 });
  assert.equal(effectViolation.d1Writes, null);
  assert.equal(effectViolation.schedulerWrites, null);
  assert.equal(effectViolation.effectsVerified, false);
  assert.equal(sanitizeR6BackfillResult(base).effectsVerified, true);
});

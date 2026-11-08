// Adapted from Minnzen/sqliteq (MIT), pinned source in
// third_party/sqliteq-reference/ at 202d9c7e864950bdb0966a5b3d25f22f0c7e229b.
// This is a metadata-only, opt-in handoff queue. Importing it never opens a
// database, launches an agent, touches a PC, or retries an operation.
import {createHash, randomUUID} from 'node:crypto';
import {parseHandoff, fingerprintHandoff, routeHandoff} from './contract.mjs';

export const HANDOFF_QUEUE_SCHEMA = 'ZGMINI_HANDOFF_SQLITE_QUEUE_V1';
export const HANDOFF_QUEUE_RETRIES = 0;
export const HANDOFF_QUEUE_TABLE = 'zgmini_handoff_queue_v1';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS zgmini_handoff_queue_v1 (
  fingerprint TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  payload_sha256 TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('COMMON_PROCESS_OWNER', 'ORIGIN_FUNCTION_OWNER')),
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'CLAIMED', 'ROUTED_PENDING_AGENT', 'STATE_UNKNOWN')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  receive_generation INTEGER NOT NULL DEFAULT 0 CHECK (receive_generation >= 0),
  lease_token TEXT,
  lease_owner TEXT,
  lease_expires_at TEXT,
  route_evidence TEXT
) STRICT;
CREATE INDEX IF NOT EXISTS zgmini_handoff_queue_ready_v1
  ON zgmini_handoff_queue_v1(status, created_at, fingerprint);
`;

function validDatabase(db) {
  if (!db || typeof db.exec !== 'function' || typeof db.prepare !== 'function') {
    throw new Error('HANDOFF_QUEUE_SQLITE_DATABASE_REQUIRED');
  }
  return db;
}

function nowIso(clock) {
  const now = clock();
  if (!Number.isSafeInteger(now) || now < 0) throw new Error('HANDOFF_QUEUE_CLOCK_INVALID');
  return new Date(now).toISOString();
}

function timestampAfter(clock, ms) {
  if (!Number.isSafeInteger(ms) || ms < 1 || ms > 3_600_000) {
    throw new Error('HANDOFF_QUEUE_LEASE_DURATION_INVALID');
  }
  return new Date(clock() + ms).toISOString();
}

function requireFingerprint(value) {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) {
    throw new Error('HANDOFF_QUEUE_FINGERPRINT_INVALID');
  }
  return value;
}

function requireLease(lease) {
  if (!lease || typeof lease !== 'object' ||
      !/^[a-f0-9]{64}$/.test(lease.fingerprint ?? '') ||
      !/^[a-f0-9-]{36}$/.test(lease.token ?? '') ||
      !Number.isSafeInteger(lease.generation) || lease.generation < 1) {
    throw new Error('HANDOFF_QUEUE_LEASE_INVALID');
  }
  return lease;
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function checkedStoredHandoff(row) {
  // Always verify bytes read from SQLite, including ordinary read/claim paths.
  // An intact payload hash alone cannot prove that it belongs to this key.
  if (sha256(row.payload) !== row.payload_sha256) {
    throw new Error('HANDOFF_QUEUE_PAYLOAD_HASH_MISMATCH_STOP');
  }
  const handoff = parseHandoff(row.payload);
  if (JSON.stringify(handoff) !== row.payload ||
      fingerprintHandoff(handoff) !== row.fingerprint ||
      routeHandoff(handoff).role !== row.role) {
    throw new Error('HANDOFF_QUEUE_STORED_CONTRACT_MISMATCH_STOP');
  }
  return handoff;
}

// Explicit schema setup only. Never call this from the existing Controller or
// GitHub Actions workflow until the PC database path and B approval are fixed.
export function initializeHandoffQueueSchema(db) {
  validDatabase(db);
  db.exec('PRAGMA busy_timeout = 5000');
  db.exec(SCHEMA);
}

export function createHandoffQueue(db, {clock = Date.now} = {}) {
  validDatabase(db);
  if (typeof clock !== 'function') throw new Error('HANDOFF_QUEUE_CLOCK_INVALID');

  // Busy timeout is connection-local. A second Runner does not inherit the
  // setting from the connection that initialized the shared database schema.
  db.exec('PRAGMA busy_timeout = 5000');

  const statements = {
    insert: db.prepare(`INSERT INTO ${HANDOFF_QUEUE_TABLE}
      (fingerprint, payload, payload_sha256, role, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(fingerprint) DO NOTHING RETURNING fingerprint`),
    get: db.prepare(`SELECT * FROM ${HANDOFF_QUEUE_TABLE} WHERE fingerprint = ?`),
    claim: db.prepare(`UPDATE ${HANDOFF_QUEUE_TABLE}
      SET status = 'CLAIMED', receive_generation = receive_generation + 1,
          lease_token = ?, lease_owner = ?, lease_expires_at = ?, updated_at = ?
      WHERE fingerprint = (SELECT fingerprint FROM ${HANDOFF_QUEUE_TABLE}
        WHERE status = 'PENDING' AND (? IS NULL OR fingerprint = ?)
        ORDER BY created_at, fingerprint LIMIT 1)
      RETURNING fingerprint, payload, payload_sha256, role, receive_generation, lease_token, lease_expires_at`),
    extend: db.prepare(`UPDATE ${HANDOFF_QUEUE_TABLE} SET lease_expires_at = ?, updated_at = ?
      WHERE fingerprint = ? AND status = 'CLAIMED' AND receive_generation = ?
        AND lease_token = ? AND lease_expires_at > ?`),
    routed: db.prepare(`UPDATE ${HANDOFF_QUEUE_TABLE}
      SET status = 'ROUTED_PENDING_AGENT', route_evidence = ?,
          lease_token = NULL, lease_owner = NULL, lease_expires_at = NULL, updated_at = ?
      WHERE fingerprint = ? AND status = 'CLAIMED' AND receive_generation = ?
        AND lease_token = ? AND lease_expires_at > ?`),
    expire: db.prepare(`UPDATE ${HANDOFF_QUEUE_TABLE}
      SET status = 'STATE_UNKNOWN', updated_at = ?, lease_token = NULL, lease_owner = NULL
      WHERE status = 'CLAIMED' AND lease_expires_at <= ?`),
    counts: db.prepare(`SELECT status, COUNT(*) AS count FROM ${HANDOFF_QUEUE_TABLE} GROUP BY status`)
  };

  return Object.freeze({
    // The source payload is always parsed with the existing strict contract.
    // A fingerprint collision with different details cannot silently overwrite.
    enqueue(body) {
      const handoff = parseHandoff(typeof body === 'string' ? body : JSON.stringify(body));
      const payload = JSON.stringify(handoff);
      const fingerprint = fingerprintHandoff(handoff);
      const hash = sha256(payload);
      const now = nowIso(clock);
      const inserted = !!statements.insert.get(fingerprint, payload, hash,
        routeHandoff(handoff).role, now, now);
      const row = statements.get.get(fingerprint);
      if (!row) throw new Error('HANDOFF_QUEUE_READBACK_STOP');
      const stored = checkedStoredHandoff(row);
      // Existing Issue handoff behavior permits a new incidentId for an
      // identical failure; only the first incident is authoritative.
      const comparable = {...handoff, incidentId: stored.incidentId};
      if (row.payload_sha256 !== sha256(JSON.stringify(comparable))) {
        throw new Error('HANDOFF_QUEUE_FINGERPRINT_COLLISION_STOP');
      }
      return Object.freeze({fingerprint, inserted, status: row.status,
        existingIncidentId: stored.incidentId,
        automaticPcRetries: HANDOFF_QUEUE_RETRIES, operationalWrites: 0});
    },

    // A claim means only that a metadata processor owns this queue record.
    // It does NOT prove that another ChatGPT conversation received a message.
    claim(owner, {leaseMs = 60_000, fingerprint = null} = {}) {
      if (typeof owner !== 'string' || !/^[a-z][a-z0-9-]{2,79}$/.test(owner)) {
        throw new Error('HANDOFF_QUEUE_OWNER_INVALID');
      }
      if (fingerprint !== null) requireFingerprint(fingerprint);
      const expiry = timestampAfter(clock, leaseMs);
      const row = statements.claim.get(randomUUID(), owner, expiry, nowIso(clock), fingerprint, fingerprint);
      if (!row) return null;
      const handoff = checkedStoredHandoff(row);
      return Object.freeze({fingerprint: row.fingerprint, token: row.lease_token,
        generation: row.receive_generation, leaseExpiresAt: row.lease_expires_at,
        handoff, role: row.role,
        automaticPcRetries: HANDOFF_QUEUE_RETRIES, operationalWrites: 0});
    },

    extend(lease, {leaseMs = 60_000} = {}) {
      requireLease(lease);
      const expiresAt = timestampAfter(clock, leaseMs);
      const now = nowIso(clock);
      return statements.extend.run(expiresAt, now, lease.fingerprint, lease.generation,
        lease.token, now).changes === 1;
    },

    // Record only a previously READ-BACK-VERIFIED GitHub Issue comment.
    // Does not declare agent execution, Windows application or owner resumption.
    markRouted(lease, evidence) {
      requireLease(lease);
      if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence) ||
          Object.keys(evidence).sort().join(',') !==
            'commentId,fingerprint,issueNumber,marker,verifiedCommentReadback' ||
          evidence.fingerprint !== lease.fingerprint ||
          !Number.isSafeInteger(evidence.issueNumber) || evidence.issueNumber < 1 ||
          !Number.isSafeInteger(evidence.commentId) || evidence.commentId < 1 ||
          !['HANDOFF_ROUTED', 'HANDOFF_DUPLICATE_REUSED'].includes(evidence.marker) ||
          evidence.verifiedCommentReadback !== true) {
        throw new Error('HANDOFF_QUEUE_ROUTE_EVIDENCE_REQUIRED');
      }
      const now = nowIso(clock);
      const safeEvidence = JSON.stringify({issueNumber: evidence.issueNumber,
        commentId: evidence.commentId, fingerprint: lease.fingerprint, marker: evidence.marker});
      return statements.routed.run(safeEvidence, now, lease.fingerprint,
        lease.generation, lease.token, now).changes === 1;
    },

    // A lease expiration is STATE_UNKNOWN, never an automatic retry.
    // Do not make the original PC request eligible for another execution.
    markExpiredUnknown() {
      const now = nowIso(clock);
      return statements.expire.run(now, now).changes;
    },

    read(fingerprint) {
      const row = statements.get.get(requireFingerprint(fingerprint));
      if (!row) return null;
      return Object.freeze({fingerprint: row.fingerprint, handoff: checkedStoredHandoff(row),
        role: row.role, status: row.status, generation: row.receive_generation,
        leaseExpiresAt: row.lease_expires_at, routeEvidence: row.route_evidence ? JSON.parse(row.route_evidence) : null});
    },

    stats() {
      const stats = {PENDING: 0, CLAIMED: 0, ROUTED_PENDING_AGENT: 0, STATE_UNKNOWN: 0};
      for (const row of statements.counts.all()) stats[row.status] = row.count;
      return Object.freeze({...stats, total: Object.values(stats).reduce((a, b) => a + b, 0)});
    }
  });
}

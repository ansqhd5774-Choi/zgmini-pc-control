// Fixed A/light inspection of the last PC Writer result. This operation never
// opens SQLite, uses provider APIs, or sends a D1 write/read request.
import fs from 'node:fs';
import path from 'node:path';

const MAX_FILE_BYTES = 131_072;
const SHA40 = /^[a-f0-9]{40}$/;
const SAFE_CODE = /^[A-Z][A-Z0-9_]{1,100}$/;
const KEY_STATUSES = new Set(['READBACK_VERIFIED', 'ALREADY_STORED', 'UNCHANGED_VERIFIED']);

function directoryIsSafe(dir) {
  try {
    const s = fs.lstatSync(dir);
    return s.isDirectory() && !s.isSymbolicLink();
  } catch { return false; }
}

function readBoundedJson(file) {
  let stat;
  try { stat = fs.lstatSync(file); } catch { return { kind: 'MISSING' }; }
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 2 || stat.size > MAX_FILE_BYTES)
    return { kind: 'INVALID' };
  try {
    const value = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value))
      return { kind: 'INVALID' };
    return { kind: 'READY', value, modifiedAt: stat.mtime.toISOString() };
  } catch { return { kind: 'INVALID' }; }
}

const safeCode = s => typeof s === 'string' && SAFE_CODE.test(s) ? s : null;
const safeSha = s => typeof s === 'string' && SHA40.test(s) ? s : null;
const safeTime = s => typeof s === 'string' && Number.isFinite(Date.parse(s))
  ? new Date(s).toISOString() : null;
const safeKey = s => KEY_STATUSES.has(s) ? s : null;

/**
 * The only parameter is the Controller's fixed dataRoot. The output is a
 * bounded whitelist: no provider keys, raw input, formulas or JSON error text.
 * Recorded writer readback is not independently proven Production D1 state.
 */
export function inspectAssetR10Publication(dataRoot) {
  const result = {
    status: 'BLOCKED', code: 'ASSET_R10_PUBLICATION_EVIDENCE_MISSING',
    proofStatus: 'NO_EVIDENCE', evidenceLevel: 'LOCAL_WRITER_CHECKPOINT_ONLY',
    writer: null, ledger: null, r10: null,
    recordedSidecarReadback: false, productionD1Verified: false,
    runtimeSourceVerified: false, publicationPerformed: false,
    operationalWrites: 0, providerCalls: 0, d1Writes: 0, sqliteOpened: false,
  };
  if (typeof dataRoot !== 'string' || !path.isAbsolute(dataRoot)) {
    result.code = 'ASSET_R10_DATA_ROOT_NOT_APPROVED'; return result;
  }
  const pcHome = path.join(dataRoot, 'pc-writer');
  if (![dataRoot, pcHome].every(directoryIsSafe)) return result;

  const writer = readBoundedJson(path.join(pcHome, 'local-writer-last-run.json'));
  const ledger = readBoundedJson(path.join(pcHome, 'local-publication-ledger.json'));
  if (writer.kind === 'MISSING' || ledger.kind === 'MISSING') return result;
  if (writer.kind !== 'READY' || ledger.kind !== 'READY') {
    result.code = 'ASSET_R10_PUBLICATION_EVIDENCE_INVALID'; return result;
  }
  const w = writer.value, l = ledger.value;
  const sourceSha = safeSha(w.source);
  const runAt = safeTime(w.at);
  const mode = w.mode === 'PUBLISH' ? 'PUBLISH' : w.mode === 'DRY_RUN' ? 'DRY_RUN' : null;
  const writerStatus = safeCode(w.status);
  const ledgerStatus = safeCode(l.status);
  const ledgerAt = Number.isSafeInteger(l.at) && l.at > 0 ? l.at : null;
  const calculationStatus = safeCode(w.assetR10Calculation?.status);
  const projectionStatus = safeCode(w.assetR10?.status);
  const sidecarStatus = safeCode(w.assetR10Sidecars?.status);
  const raw = safeKey(w.assetR10Sidecars?.keys?.raw);
  const history = safeKey(w.assetR10Sidecars?.keys?.history);
  const r10Failures = Array.isArray(w.failures) ? w.failures
    .filter(f => f?.id === 'asset-r10-sidecars-publication' || f?.id === 'projection:assetBubble'
      || f?.id === 'projection-publication:assetBubble')
    .map(f => ({ stage: f.id, reason: safeCode(f.reason) ?? 'OUTPUT_STAGE_FAILED' }))
    .slice(0, 3) : [];
  result.writer = { runAt, modifiedAt: writer.modifiedAt, mode,
    status: writerStatus, sourceSha };
  result.ledger = { status: ledgerStatus, at: ledgerAt,
    modifiedAt: ledger.modifiedAt, sourceMatched: sourceSha !== null && l.source === sourceSha };
  result.r10 = { calculationStatus, projectionStatus, sidecarStatus,
    keys: { raw, history }, failures: r10Failures };
  if (!runAt || !sourceSha || !mode || !writerStatus || !ledgerStatus || !ledgerAt) {
    result.code = 'ASSET_R10_PUBLICATION_EVIDENCE_INVALID'; return result;
  }
  result.status = 'PASS';
  result.code = 'ASSET_R10_PUBLICATION_STATUS_READONLY';

  // The status file can be overwritten by a newer dry-run. Never infer that an
  // older ledger belongs to that newer writer run. SUBMITTING is not a failure.
  if (ledgerStatus === 'SUBMITTING' || l.source !== sourceSha ||
      ledgerAt < Date.parse(runAt)) {
    result.proofStatus = 'STATE_UNKNOWN'; return result;
  }
  if (mode !== 'PUBLISH') {
    result.proofStatus = 'NO_PUBLISH_CYCLE'; return result;
  }
  if (projectionStatus === 'PREVIOUS_RELEASE_PRESERVED') {
    result.proofStatus = 'PREVIOUS_RELEASE_PRESERVED'; return result;
  }
  if (r10Failures.length) {
    result.proofStatus = 'R10_LANE_FAILED'; return result;
  }
  if (['VERIFIED', 'VERIFIED_WITH_GAPS'].includes(writerStatus) &&
      ['VERIFIED', 'PARTIAL'].includes(ledgerStatus) &&
      projectionStatus === 'READY' && sidecarStatus === 'READY' && raw && history) {
    result.proofStatus = 'RECORDED_READBACK_VERIFIED';
    result.recordedSidecarReadback = true;
  } else result.proofStatus = 'R10_PUBLICATION_NOT_RECORDED';
  return result;
}

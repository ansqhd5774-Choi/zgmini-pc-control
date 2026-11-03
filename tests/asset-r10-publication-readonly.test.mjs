import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { inspectAssetR10Publication } from '../controller/asset-r10-publication-readonly.mjs';

const SHA = 'a'.repeat(40);
const AT = '2026-11-03T06:10:00.000Z';
const END = Date.parse('2026-11-03T06:11:00.000Z');
const keys = { raw: 'READBACK_VERIFIED', history: 'UNCHANGED_VERIFIED' };

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zgmini-r10-a-'));
  const home = path.join(root, 'pc-writer');
  fs.mkdirSync(home);
  const writer = { at: AT, source: SHA, mode: 'PUBLISH', status: 'VERIFIED',
    assetR10Calculation: { status: 'R10_RECALCULATED' },
    assetR10: { status: 'READY', score: 99, secretRawData: 'DO_NOT_LEAK' },
    assetR10Sidecars: { status: 'READY', sourceVersion: 'private-digest', keys } };
  const ledger = { status: 'VERIFIED', source: SHA, at: END };
  const write = () => {
    fs.writeFileSync(path.join(home, 'local-writer-last-run.json'), JSON.stringify(writer));
    fs.writeFileSync(path.join(home, 'local-publication-ledger.json'), JSON.stringify(ledger));
  };
  write();
  return { root, home, writer, ledger, write,
    cleanup: () => fs.rmSync(root, { recursive: true, force: true }) };
}

test('completed R10 sidecars, including unchanged key, are read-only recorded evidence', () => {
  const f = fixture();
  try {
    const r = inspectAssetR10Publication(f.root);
    assert.equal(r.status, 'PASS');
    assert.equal(r.code, 'ASSET_R10_PUBLICATION_STATUS_READONLY');
    assert.equal(r.proofStatus, 'RECORDED_READBACK_VERIFIED');
    assert.equal(r.recordedSidecarReadback, true);
    assert.equal(r.productionD1Verified, false);
    assert.equal(r.runtimeSourceVerified, false);
    assert.equal(r.publicationPerformed, false);
    assert.equal(r.providerCalls, 0); assert.equal(r.d1Writes, 0);
    assert.equal(r.sqliteOpened, false); assert.equal(r.operationalWrites, 0);
    assert.equal(r.r10.keys.history, 'UNCHANGED_VERIFIED');
    assert.doesNotMatch(JSON.stringify(r), /DO_NOT_LEAK|secretRawData|private-digest|"score"/);
  } finally { f.cleanup(); }
});

test('another output can fail while R10 lane still has recorded readback', () => {
  const f = fixture();
  try {
    f.writer.status = 'VERIFIED_WITH_GAPS';
    f.writer.failures = [{ id: 'feed:unrelated', reason: 'SECRET_OTHER_FAILURE' }];
    f.ledger.status = 'PARTIAL'; f.write();
    const r = inspectAssetR10Publication(f.root);
    assert.equal(r.proofStatus, 'RECORDED_READBACK_VERIFIED');
    assert.deepEqual(r.r10.failures, []);
    assert.doesNotMatch(JSON.stringify(r), /SECRET_OTHER_FAILURE/);
  } finally { f.cleanup(); }
});

test('R10 sidecar failure is scoped and reason output restricted to allowed codes', () => {
  const f = fixture();
  try {
    f.writer.status = 'VERIFIED_WITH_GAPS';
    f.writer.failures = [{ id: 'asset-r10-sidecars-publication',
      reason: 'password=secret-should-never-leak' }];
    f.ledger.status = 'PARTIAL'; f.write();
    const r = inspectAssetR10Publication(f.root);
    assert.equal(r.proofStatus, 'R10_LANE_FAILED');
    assert.equal(r.recordedSidecarReadback, false);
    assert.equal(r.r10.failures[0].reason, 'OUTPUT_STAGE_FAILED');
    assert.doesNotMatch(JSON.stringify(r), /password|secret-should-never-leak/);
  } finally { f.cleanup(); }
});

test('SUBMITTING and ambiguous or older ledger never count as completed', () => {
  const f = fixture();
  try {
    f.ledger.status = 'SUBMITTING'; f.write();
    assert.equal(inspectAssetR10Publication(f.root).proofStatus, 'STATE_UNKNOWN');
    f.ledger.status = 'VERIFIED'; f.ledger.at = Date.parse(AT) - 1000; f.write();
    assert.equal(inspectAssetR10Publication(f.root).proofStatus, 'STATE_UNKNOWN');
    f.ledger.at = END; f.ledger.source = 'b'.repeat(40); f.write();
    assert.equal(inspectAssetR10Publication(f.root).proofStatus, 'STATE_UNKNOWN');
  } finally { f.cleanup(); }
});

test('previous release, dry-run and missing sidecar are not fresh publication', () => {
  const f = fixture();
  try {
    f.writer.assetR10.status = 'PREVIOUS_RELEASE_PRESERVED'; f.write();
    assert.equal(inspectAssetR10Publication(f.root).proofStatus, 'PREVIOUS_RELEASE_PRESERVED');
    f.writer.assetR10.status = 'READY'; f.writer.mode = 'DRY_RUN'; f.write();
    assert.equal(inspectAssetR10Publication(f.root).proofStatus, 'NO_PUBLISH_CYCLE');
    f.writer.mode = 'PUBLISH'; delete f.writer.assetR10Sidecars; f.write();
    assert.equal(inspectAssetR10Publication(f.root).proofStatus, 'R10_PUBLICATION_NOT_RECORDED');
  } finally { f.cleanup(); }
});

test('missing, malformed or oversized evidence is bounded and not exposed', () => {
  const f = fixture();
  try {
    fs.unlinkSync(path.join(f.home, 'local-publication-ledger.json'));
    assert.equal(inspectAssetR10Publication(f.root).code, 'ASSET_R10_PUBLICATION_EVIDENCE_MISSING');
    fs.writeFileSync(path.join(f.home, 'local-publication-ledger.json'), '{secret');
    assert.equal(inspectAssetR10Publication(f.root).code, 'ASSET_R10_PUBLICATION_EVIDENCE_INVALID');
    fs.writeFileSync(path.join(f.home, 'local-publication-ledger.json'), 'Z'.repeat(131_073));
    assert.equal(inspectAssetR10Publication(f.root).code, 'ASSET_R10_PUBLICATION_EVIDENCE_INVALID');
    assert.equal(inspectAssetR10Publication('relative-path').code, 'ASSET_R10_DATA_ROOT_NOT_APPROVED');
    const symlink = path.join(f.root, 'writer-link');
    fs.symlinkSync(f.home, symlink, 'dir');
    assert.equal(inspectAssetR10Publication(symlink).code, 'ASSET_R10_PUBLICATION_EVIDENCE_MISSING');
  } finally { f.cleanup(); }
});

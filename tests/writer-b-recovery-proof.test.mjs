import test from 'node:test';
import assert from 'node:assert/strict';
import {sanitizeWriterBResult} from '../writer-b/report.mjs';

const rid = '9b4e50f9-8674-4894-9c5e-8ba454d6f79d';
const raw = (status, recovery) => ({
  status, code:'WRITER_B_CORE_ACTIVE_WINDOW_DEFERRED', requestId:rid,
  ...(recovery == null ? {} : {recovery})});
const clean = item => sanitizeWriterBResult(item,rid,'42636354244','b'.repeat(64));

test('restored-looking status without exact original evidence stays UNKNOWN', () => {
  assert.equal(clean(raw('WRITER_B_INSTALL_STOP_RESTORED')).status,
    'WRITER_B_STATE_UNKNOWN');
  assert.equal(clean(raw('WRITER_B_INSTALL_STOP_RESTORED','UNVERIFIED')).status,
    'WRITER_B_STATE_UNKNOWN');
  const verified = clean(raw('WRITER_B_INSTALL_STOP_RESTORED','ORIGINAL_VERIFIED'));
  assert.equal(verified.status, 'WRITER_B_INSTALL_STOP_RESTORED');
  assert.equal(verified.recovery, 'ORIGINAL_VERIFIED');
});

test('preclaim safety does not manufacture a rollback proof', () => {
  const r=clean(raw('WRITER_B_PREFLIGHT_STOP'));
  assert.equal(r.status,'WRITER_B_PREFLIGHT_STOP');
  assert.equal(Object.hasOwn(r,'recovery'),false);
});

test('actual recovery-required status remains visible and never becomes waiting', () => {
  const r=clean(raw('WRITER_B_RECOVERY_REQUIRED',
    'RECONCILE_EXACT_REQUEST_NO_RETRY'));
  assert.equal(r.status,'WRITER_B_RECOVERY_REQUIRED');
  assert.equal(r.recovery,'RECONCILE_EXACT_REQUEST_NO_RETRY');
  const old=clean(raw('WRITER_B_RECOVERY_REQUIRED'));
  assert.equal(old.status,'WRITER_B_RECOVERY_REQUIRED');
  assert.equal(old.recovery,'RECONCILE_EXACT_REQUEST_NO_RETRY');
});

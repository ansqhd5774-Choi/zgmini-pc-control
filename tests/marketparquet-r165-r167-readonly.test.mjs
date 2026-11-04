import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { inspectMarketParquetR165R167 } from '../controller/marketparquet-r165-r167-readonly.mjs';

const dirPrefix = 'theme-market-history-r131';
const targetDate = '2026-11-03';
const fixtureCsv = '"PC","\\ZGMINI-PC-MarketParquet-ETF","N/A","Ready","Interactive only","11/04/2026 1:00:00 AM","0","Author"';

function arrange(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mpetf-readonly-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const r165 = path.join(root, dirPrefix, 'marketparquet-r165');
  const r167 = path.join(root, dirPrefix, 'marketparquet-r167');
  fs.mkdirSync(r165, { recursive: true });
  fs.mkdirSync(r167, { recursive: true });
  const parquet = Buffer.from('PAR1example-dataPAR1');
  fs.writeFileSync(path.join(r165, `etf_daily_${targetDate}.parquet`), parquet);
  fs.writeFileSync(path.join(r167, `etf_daily_${targetDate}.audit.json`), JSON.stringify({
    date: targetDate, complete: true, source: 'MARKETPARQUET_ETF_DAILY_SPLIT_ADJUSTED',
    sha256: createHash('sha256').update(parquet).digest('hex'),
  }));
  fs.writeFileSync(path.join(r167, 'R181_PRIMARY_LAST_RUN.json'), JSON.stringify({
    at: '2026-11-04T04:26:38.000Z', status: 'PRIMARY_RAW_STORED', providerCalls: 1,
    secret: 'CANARY_API_SECRET_NEVER_LEAK', coverage: { keys: 'CANARY_RAW_ROWS_NEVER_LEAK' },
  }));
  return { root, r165, r167 };
}

test('fixed source metadata, matching audit and whitelisted checkpoint, without raw leak', (t) => {
  const { root } = arrange(t);
  const result = inspectMarketParquetR165R167(root, { queryTaskCsv: () => fixtureCsv, allowFixtureRoot: true });
  assert.equal(result.scheduler.state, 'QUERIED');
  assert.equal(result.scheduler.lastResult, '0');
  assert.deepEqual(result.history.map(({date}) => date), ['2026-10-30', '2026-11-02', '2026-11-03']);
  assert.equal(result.history[2].verified, true);
  assert.equal(result.history[0].parquet, 'MISSING');
  assert.equal(result.checkpoints.primary.status, 'PRIMARY_RAW_STORED');
  assert.equal(result.checkpoints.secondary.state, 'MISSING');
  assert.equal(result.operationalWrites, 0);
  assert.equal(result.providerCalls, 0);
  assert.equal(result.d1Writes, 0);
  assert.equal(JSON.stringify(result).includes('CANARY_'), false);
});

test('changed parquet bytes invalidate audit without leaking contents', (t) => {
  const { root, r165 } = arrange(t);
  fs.writeFileSync(path.join(r165, `etf_daily_${targetDate}.parquet`), 'PAR1alteredPAR1');
  const result = inspectMarketParquetR165R167(root, { queryTaskCsv: () => fixtureCsv, allowFixtureRoot: true });
  assert.equal(result.history[2].verified, false);
  assert.equal(result.history[2].reason, 'AUDIT_MISMATCH');
});

test('missing or invalid audit is never verified', (t) => {
  const { root, r167 } = arrange(t);
  fs.unlinkSync(path.join(r167, `etf_daily_${targetDate}.audit.json`));
  const result = inspectMarketParquetR165R167(root, { queryTaskCsv: () => fixtureCsv, allowFixtureRoot: true });
  assert.equal(result.history[2].audit, 'MISSING');
  assert.equal(result.history[2].verified, false);
});

test('task query errors remain UNKNOWN without asserting runtime failure', (t) => {
  const { root } = arrange(t);
  const result = inspectMarketParquetR165R167(root, {
    queryTaskCsv: () => { throw Error('no task access'); }, allowFixtureRoot: true,
  });
  assert.equal(result.scheduler.state, 'UNKNOWN');
  assert.equal(result.scheduler.reason, 'TASK_QUERY_UNAVAILABLE');
  assert.equal(result.history[2].verified, true);
});

test('strict PC root guard and symlink blocker', (t) => {
  const { root, r165 } = arrange(t);
  assert.throws(() => inspectMarketParquetR165R167(root), /UNAPPROVED_DATA_ROOT/);
  const victim = path.join(r165, `etf_daily_${targetDate}.parquet`);
  fs.unlinkSync(victim);
  fs.symlinkSync(path.join(root, dirPrefix, 'marketparquet-r167', `etf_daily_${targetDate}.audit.json`), victim);
  const result = inspectMarketParquetR165R167(root, { queryTaskCsv: () => fixtureCsv, allowFixtureRoot: true });
  assert.equal(result.history[2].verified, false);
  assert.equal(result.history[2].reason, 'SYMLINK_BLOCKED');
});

test('malformed CSV must not be mistaken for success', (t) => {
  const { root } = arrange(t);
  const result = inspectMarketParquetR165R167(root, { queryTaskCsv: () => 'not a CSV', allowFixtureRoot: true });
  assert.equal(result.scheduler.state, 'UNKNOWN');
});

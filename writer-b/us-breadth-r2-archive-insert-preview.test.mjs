import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validatePreviewSpec} from './insert-preview-readonly.mjs';
import {applyApprovedInsertions} from './insert-only-patch.mjs';

const spec=JSON.parse(fs.readFileSync(new URL(
 '../approvals/writer-previews/us-breadth-paid-r2-archive-insert-20261127.json',
 import.meta.url),'utf8'));

test('R2 Archive preview isolates installed Core and two insertion anchors',()=>{
 assert.equal(validatePreviewSpec(spec),spec);
 assert.equal(spec.baseHead,'c8ed53a3991212dd1778742cda8a86ac133e0796');
 assert.equal(spec.beforeSha256,'f69fb3cc1a6fdb85af34054f016b10dcbc7b1dcbf76e51c32b617121fe22d05d');
 assert.equal(spec.filePath,'scripts/pc-writer/local-cycle.mjs');
 assert.equal(spec.insertions.length,2);
 assert.ok(spec.insertions.every(x=>x.position==='before'));
 const joined=spec.insertions.map(x=>x.text).join('\n');
 assert.match(joined,/paidR2DailyStart/);
 assert.match(joined,/planStoredPaidUsR2Backfill/);
 assert.match(joined,/maxFiles:40-used/);
 assert.match(joined,/assetTypes:\['stock_daily'\]/);
 assert.match(joined,/checkApprovedPcRuntime/);
 assert.match(joined,/lane==='core'&&process\.argv\.includes\('--publish'\)/);
 assert.doesNotMatch(joined,/asset-r10-sp500-refresh|earnings-risk-provisional-r23-hook/);
 assert.doesNotMatch(joined,/schtasks|spawnSync|process\.exit/);
});

test('R2 Archive insertions remain pure additive source, preserving legacy R2 hook',()=>{
 const previous=JSON.parse(fs.readFileSync(new URL(
 '../approvals/writer-updates/us-breadth-paid-r2-eightfile-20261127.json',
 import.meta.url),'utf8'));
 const previouslyInstalled=previous.files[0].insertions[0].text;
 const fixture=[
  'try{',
  spec.insertions[0].anchor,
  previouslyInstalled.slice(0,-1),
  ' const collection=spawnSync(process.execPath,[]);',
  '}',
  '',
 ].join('\n');
 const patched=applyApprovedInsertions(Buffer.from(fixture),spec.insertions,{
  filePath:spec.filePath,
 }).toString('utf8');
 assert.ok(patched.indexOf('paidR2DailyStart')<patched.indexOf('planStoredPaidUsR2Backfill'));
 assert.ok(patched.indexOf('planStoredPaidUsR2Backfill')<patched.indexOf('runPaidUsR2StoredCycle(base'));
 assert.equal(patched.includes('asset-r10-sp500-refresh'),false);
 assert.equal(patched.includes('earnings-risk-provisional-r23-hook'),false);
});

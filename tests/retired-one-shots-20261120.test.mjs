import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const retired=["handoff-watch-runner-context-readonly.yml","pc-calendar-twofile-b-install-once.yml","pc-configured-runtime-proof-once.yml","pc-inflation19-public-d1-once.yml","pc-r17-sip-b-install-once.yml","pc-r17-sip-refresh-onefile-b-once.yml","pc-r17-writer-b-install-once.yml","pc-report-recovery-540-once.yml","pc-writer-b-1063-recovery-once.yml","pc-writer-config-b-once.yml","pc-writer-config-b-proof-once.yml"];
const kept=['pc-approved-runtime-a-once.yml','pc-approved-runtime-b-once.yml','pc-job.yml','pc-writer-b-source-once.yml','pc-inflation-19-inventory-b-once.yml','pc-theme-r54-evidence-once.yml','pc-theme-r54-readiness-once.yml','pc-theme-r54-score-once.yml'];
test('eleven completed one-shot Issue intakes are retired',()=>{
 assert.equal(retired.length,11);assert.equal(new Set(retired).size,11);
 for(const name of retired)assert.equal(existsSync(path.join(root,'.github/workflows',name)),false,name);
});
// R17's fixed 2026-11-06 SIP/probe/preflight requests are now terminal.
// Retire only their Issue-opened entrypoints, not immutable evidence or code.
test('three terminal R17 historical Issue-opened entrypoints are retired',()=>{
 const old=[
  'pc-r17-sip-historical-probe-once.yml',
  'pc-r17-writer-b-probe-diagnostic-once.yml',
  'pc-r17-writer-b-preflight.yml'
 ];
 assert.equal(new Set(old).size,3);
 for(const name of old)assert.equal(existsSync(path.join(root,'.github/workflows',name)),false,name);
 for(const source of [
  'r17-sip-probe/historical-probe.mjs',
  'r17-writer-b/probe-diag/r17-b-probe-diagnostic.mjs',
  'r17-writer-b/entry.mjs'
 ])assert.equal(existsSync(path.join(root,source)),true,source);
});
// #265 closed with immutable EIA saved-file readback proof; the reader and
// original receipt survive, but the consumed event entrypoint must not linger.
test('completed immutable EIA saved-file one-shot intake is retired',()=>{
 assert.equal(existsSync(path.join(root,'.github/workflows','pc-inflation-eia-readback-once.yml')),false);
 assert.equal(existsSync(path.join(root,'inflation-eia-readback-b-once.mjs')),true);
 assert.equal(existsSync(path.join(root,'inflation-eia-readback-b-once.test.mjs')),true);
 // Separate fixed EIA collection and shared inflation inventory remain.
 for(const file of ['pc-inflation-19-inventory-b-once.yml'])
  assert.equal(existsSync(path.join(root,'.github/workflows',file)),true,file);
});
// #246 has a terminal PASS/BLS8_SAVED_READBACK receipt for the fixed
// 2026-11-04 batch. Only its Issue-opened trigger is retired.
test('completed fixed BLS PPI8 Issue intake is retired while approved paths survive',()=>{
 assert.equal(existsSync(path.join(root,'.github/workflows','pc-inflation-bls8-approved-once.yml')),false);
 assert.equal(existsSync(path.join(root,'inflation-bls8-b-once.mjs')),true);
 for(const name of ['pc-inflation-19-inventory-b-once.yml','pc-approved-runtime-a-once.yml',
   'pc-approved-runtime-b-once.yml','pc-job.yml','pc-writer-b-source-once.yml'])
  assert.equal(existsSync(path.join(root,'.github/workflows',name)),true,name);
});
// #210 is the terminal 2026-11-04 NY Fed SCE #31 private capture;
// retain its fixed approval, test and collector without the old Issue intake.
test('terminal SCE31 Issue-opened workflow is retired with source approvals preserved',()=>{
 assert.equal(existsSync(path.join(root,'.github/workflows','pc-inflation-sce31-approved-once.yml')),false);
 for(const file of ['inflation-sce31-b-once.mjs','INFLATION_SCE31_B_APPROVAL.json',
   'tests/inflation-sce31-b-once.test.mjs'])
  assert.equal(existsSync(path.join(root,file)),true,file);
 for(const name of ['pc-approved-runtime-a-once.yml','pc-approved-runtime-b-once.yml',
   'pc-job.yml','pc-writer-b-source-once.yml','pc-inflation-19-inventory-b-once.yml'])
  assert.equal(existsSync(path.join(root,'.github/workflows',name)),true,name);
});
// #258 succeeded in the fixed EIA private write/readback despite a stale
// uploader result. #265 independently proved the saved archive; both closed.
test('terminal EIA-only B Issue intake is retired while private source and approved paths survive',()=>{
 const old='pc-inflation-eia-only-approved-once.yml';
 assert.equal(existsSync(path.join(root,'.github/workflows',old)),false,old);
 for(const name of ['inflation-eia-only-b-once.mjs','INFLATION_EIA_ONLY_B_APPROVAL.json',
   'tests/inflation-eia-only-b-once.test.mjs'])
  assert.equal(existsSync(path.join(root,name)),true,name);
 for(const name of ['pc-inflation-19-inventory-b-once.yml',
   'pc-approved-runtime-a-once.yml','pc-approved-runtime-b-once.yml',
   'pc-job.yml','pc-writer-b-source-once.yml'])
  assert.equal(existsSync(path.join(root,'.github/workflows',name)),true,name);
});
// #248 was blocked and #251 was partial: FRED and EIA independently
// recovered under separate later requests, not a composite false PASS.
test('superseded fixed gas-electric dual-source Issue intake is retired',()=>{
 assert.equal(existsSync(path.join(root,'.github/workflows','pc-inflation-gas-electric-approved-once.yml')),false);
 for(const name of ['inflation-gas-electric-b-once.mjs','INFLATION_GAS_ELECTRIC_B_APPROVAL.json',
   'tests/inflation-gas-electric-b-once.test.mjs'])
  assert.equal(existsSync(path.join(root,name)),true,name);
 for(const name of ['pc-inflation-19-inventory-b-once.yml','pc-approved-runtime-a-once.yml',
   'pc-approved-runtime-b-once.yml','pc-job.yml','pc-writer-b-source-once.yml',
   'pc-inflation-gas-refresh-approved-once.yml'])
  assert.equal(existsSync(path.join(root,'.github/workflows',name)),true,name);
});
test('common A/B and unfinished inflation and R54 readers are preserved',()=>{
 for(const name of kept)assert.equal(existsSync(path.join(root,'.github/workflows',name)),true,name);
});
test('pinned adapters, safety checks, approved manifests and historical recovery code remain',()=>{
 const preserved=['tools/handoff-watch-runner-context-readonly.mjs',
  'calendar-b-twofile/install.mjs','calendar-b-twofile/upload.mjs','calendar-b-twofile/approval.json',
  'direct-writer-b/proof-only.mjs','inflation19-public-d1-b-once.mjs',
  'r17-sip-b/r17-sip-b-install-windows.mjs','r17-sip-refresh-b/windows.mjs',
  'r17-writer-b/r17-writer-b-install-windows.mjs','controller/report-recovery-540-once.mjs',
  'writer-b/recovery-1063-windows.mjs','writer-config-b/run.mjs','writer-config-b/proof-only.mjs'];
 for(const file of preserved)assert.equal(existsSync(path.join(root,file)),true,file);
 assert.match(readFileSync(path.join(root,'writer-config-b/run.mjs'),'utf8'),/authorizeRequest|authorize/);
 assert.match(readFileSync(path.join(root,'controller/report-recovery-540-once.mjs'),'utf8'),/runId: '42261956750'/);
});

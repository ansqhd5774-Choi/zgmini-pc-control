import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createHash} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const retired=["handoff-watch-runner-context-readonly.yml","pc-calendar-twofile-b-install-once.yml","pc-configured-runtime-proof-once.yml","pc-inflation19-public-d1-once.yml","pc-r17-sip-b-install-once.yml","pc-r17-sip-refresh-onefile-b-once.yml","pc-r17-writer-b-install-once.yml","pc-report-recovery-540-once.yml","pc-writer-b-1063-recovery-once.yml","pc-writer-config-b-once.yml","pc-writer-config-b-proof-once.yml"];
const kept=['pc-approved-runtime-a-once.yml','pc-approved-runtime-b-once.yml','pc-job.yml','pc-writer-b-source-once.yml','pc-inflation-19-inventory-b-once.yml','pc-theme-r54-evidence-once.yml','pc-theme-r54-readiness-once.yml'];
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
   'pc-approved-runtime-b-once.yml','pc-job.yml','pc-writer-b-source-once.yml'])
  assert.equal(existsSync(path.join(root,'.github/workflows',name)),true,name);
});
// Frozen 2026-11-04 ER1 November cached-cohort readers were consumed by
// #373 (15/20), #397 (blocked), and #402 (20/20 recovered). This retirement
// is not proof of a complete November actuals or public ER1 projection.
test('terminal November saved15 read-only event intakes are retired with original evidence preserved',()=>{
 for(const [workflow,entry,contract,testFile] of [
  ['pc-er1-nov30-saved15-readonly.yml','er1-nov30-saved15-readonly-entry.mjs',
    'ER1_NOV30_SAVED15_READONLY_A_CONTRACT.json','tests/er1-nov30-saved15-readonly-entry.test.mjs'],
  ['pc-er1-nov30-saved15-recovery-readonly.yml','er1-nov30-saved15-recovery-readonly-entry.mjs',
    'ER1_NOV30_SAVED15_RECOVERY_READONLY_A_CONTRACT.json',
    'tests/er1-nov30-saved15-recovery-readonly-entry.test.mjs']
 ]){
  assert.equal(existsSync(path.join(root,'.github/workflows',workflow)),false,workflow);
  for(const file of [entry,contract,testFile])assert.equal(existsSync(path.join(root,file)),true,file);
 }
 for(const name of ['pc-job.yml','pc-approved-runtime-a-once.yml','pc-approved-runtime-b-once.yml',
  'pc-writer-b-source-once.yml','pc-er1-nov30-capture.yml','pc-er1-nov30-full.yml'])
  assert.equal(existsSync(path.join(root,'.github/workflows',name)),true,name);
});
test('common A/B and reusable inflation inventory and R54 diagnostics are preserved',()=>{
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

// #3409 and #3516 fixed historical operator deliveries completed on 2026-11-25.
// Keep exact archived workflow bytes and all executable source; no event intake.
test('terminal W04 fixed operator delivery workflows are retired without losing evidence',()=>{
 for(const [name,sha] of [
  ['w04-3409-operator-delivery.yml','8f10b1ebe1cabd03671ded914cc71c9937ae5507'],
  ['w04-3516-source-packet.yml','d23a6cde36995bd2e71cf36defe20974744da396']
 ]){
  assert.equal(existsSync(path.join(root,'.github/workflows',name)),false,name);
  const bytes=readFileSync(path.join(root,'tests/fixtures/retired-workflows',name));
  const blob=createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex');
  assert.equal(blob,sha,name);
 }
 for(const source of [
  'tools/operator-packets/W04_3409_INDEPENDENT_RECOVERY_ONCE_V1.cmd',
  'tools/operator-packets/w04-3409-recovery-once.mjs',
  'tools/operator-packets/W04_3516_INDEPENDENT_RECOVERY_ONCE_V1.cmd',
  'tools/operator-packets/w04-3516-recovery-once.mjs',
  'tools/maintenance-source-packet.mjs','tests/maintenance-source-packet.test.mjs',
  'tests/w04-3516-operator-once.test.mjs'
 ])assert.equal(existsSync(path.join(root,source)),true,source);
});

// Historical December HTML V1/V2 (#187/#189) and score V1 (#193) were
// superseded by #192 and #194. November pilot #369/#392/#394 was consumed;
// #473/#474 full collection is independent and NOT proven complete here.
test('superseded ER1 fixed one-shot workflows are retired with exact history and successors preserved',()=>{
 for(const [name,sha] of [
  [
    "pc-er1-dec31-html-publish.yml",
    "65fea870491d9e36c434524f2028f517bd63ce3c"
  ],
  [
    "pc-er1-dec31-html-publish-v2.yml",
    "606621d3607f942afb42b800d9865f2fb4323673"
  ],
  [
    "pc-er1-dec31-derived-score-v1.yml",
    "f68fc160321416346fb0ca48bb4bfd33f8008618"
  ],
  [
    "pc-er1-nov30-batch20.yml",
    "161737a1bcd2e2a9631e44d56268ee068b38531e"
  ],
  [
    "pc-er1-nov30-batch20-recovery.yml",
    "581495d72b0774a84e6dbd32a7c76fc6e7697d92"
  ]
]){
  assert.equal(existsSync(path.join(root,'.github/workflows',name)),false,name);
  const bytes=readFileSync(path.join(root,'tests/fixtures/retired-workflows',name));
  const blob=createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex');
  assert.equal(blob,sha,name);
 }
 for(const name of ['pc-er1-nov30-full.yml','pc-er1-nov30-capture.yml','pc-er1-nov30-saved-actual-audit.yml','pc-er1-dec31-symbol-batch-a.yml','pc-job.yml'])
  assert.equal(existsSync(path.join(root,'.github/workflows',name)),true,name);
 for(const file of ['er1-dec31-html-publish-entry.mjs','er1-dec31-html-publish-v2-entry.mjs','er1-dec31-derived-score-v1-entry.mjs','er1-nov30-batch20-one-shot-entry.mjs','er1-nov30-batch20-recovery-entry.mjs','ER1_NOV30_BATCH20_B_APPROVAL.json','ER1_NOV30_BATCH20_RECOVERY_B_APPROVAL.json'])
  assert.equal(existsSync(path.join(root,file)),true,file);
});

// #380 used the fixed November 3 gas observation approval; the original run
// 41919412878 completed with a saved-file readback. #274/#276 are terminal,
// superseded R54 replay requests, not successful historical score calculations.
test('consumed gas refresh and superseded fixed R54 replay triggers are retired',()=>{
 for(const [name,sha] of [
  [
    "pc-inflation-gas-refresh-approved-once.yml",
    "36fd0979f2dc517d090cbc4a56e6dfc83ca85778"
  ],
  [
    "pc-theme-r54-score-once.yml",
    "c1ca1a041ea1517924fa1dcd3584a19a47ea062d"
  ]
]){
  assert.equal(existsSync(path.join(root,'.github/workflows',name)),false,name);
  const bytes=readFileSync(path.join(root,'tests/fixtures/retired-workflows',name));
  assert.equal(createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex'),sha,name);
 }
 for(const file of ['inflation19-gas-refresh-b/receiver.mjs','inflation19-gas-refresh-b/upload.mjs','inflation19-gas-refresh-b/gas-refresh.mjs','inflation19-gas-refresh-b/inflation-gas-refresh-b-approval.json','r54-score-once/entry.mjs','THEME_R54_SCORE_REPLAY_B_APPROVAL.json','tests/theme-r54-score-once.test.mjs'])
  assert.equal(existsSync(path.join(root,file)),true,file);
 for(const name of ['pc-inflation-19-inventory-b-once.yml','pc-theme-r54-evidence-once.yml','pc-theme-r54-readiness-once.yml','pc-job.yml','pc-writer-b-source-once.yml'])
  assert.equal(existsSync(path.join(root,'.github/workflows',name)),true,name);
});

// #363 consumed the original three-symbol private pilot approval. Preserve its
// historical PASS receipt scope, not a claim of full collection/publication.
test('consumed ER1 three-symbol pilot intake is retired with approval and successors intact',()=>{
 const name='pc-er1-nov30-actual-pilot.yml';
 assert.equal(existsSync(path.join(root,'.github/workflows',name)),false,name);
 const bytes=readFileSync(path.join(root,'tests/fixtures/retired-workflows',name));
 assert.equal(createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex'),'65c7b5d7c6db376837c774428bc66a4503f0b302');
 for(const file of ['er1-nov30-actual-pilot-entry.mjs','ER1_NOV30_ACTUAL_PILOT_B_APPROVAL.json'])
  assert.equal(existsSync(path.join(root,file)),true,file);
 for(const file of ['pc-er1-nov30-full.yml','pc-er1-nov30-capture.yml','pc-er1-nov30-saved-actual-audit.yml','pc-er1-nov-forecast-shadow.yml','pc-er1-nov-forecast-publish.yml','pc-job.yml'])
  assert.equal(existsSync(path.join(root,'.github/workflows',file)),true,file);
});

// #166 was a fixed three-symbol probe, #383 a fixed WTI/gas one-key D1 delta.
// Neither historical receipt establishes current production freshness or full ER1 coverage.
test('consumed December symbol probe and Inflation delta intakes are retired with exact evidence',()=>{
 for(const [name,sha] of [
  [
    "pc-er1-dec31-symbol-probe.yml",
    "1fe2227d2e39e9e5a0661b09fc5f1704f6811dac"
  ],
  [
    "pc-inflation19-wti-gas-delta-d1-b-once.yml",
    "29a837a745bf1ef5d2cc9e0bcad9ebf6a41878f5"
  ]
]){
  assert.equal(existsSync(path.join(root,'.github/workflows',name)),false,name);
  const bytes=readFileSync(path.join(root,'tests/fixtures/retired-workflows',name));
  assert.equal(createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex'),sha,name);
 }
 for(const file of ['ER1_DEC31_SYMBOL_PROBE_B_APPROVAL.json','er1-dec31-symbol-probe-entry.mjs','infl19-d1-publish-candidate/INFLATION19_DELTA_B_CANDIDATE_APPROVAL.json','infl19-d1-publish-candidate/inflation19-delta-b-receiver.mjs','infl19-d1-publish-candidate/inflation19-delta-b-contract.mjs','infl19-d1-publish-candidate/inflation19-delta-b-contract.test.mjs'])
  assert.equal(existsSync(path.join(root,file)),true,file);
 for(const name of ['pc-er1-dec31-symbol-batch-a.yml','pc-inflation-19-inventory-b-once.yml','pc-job.yml','pc-publication-b.yml'])
  assert.equal(existsSync(path.join(root,'.github/workflows',name)),true,name);
});

// #192/#194 consumed the fixed 38-event HTML and score publication approvals.
// Their successor status for earlier failed intakes remains historical evidence.
// Retain approval files, executable source and exact YAML; no future replay authority.
test('consumed December HTML V3 and derived score V2 publication intakes are archived intact',()=>{
 for(const [name,sha] of [
  [
    "pc-er1-dec31-html-publish-v3.yml",
    "a7ab17d23a830d90eab9eaa2e68f57f871194309"
  ],
  [
    "pc-er1-dec31-derived-score-v2.yml",
    "f3a4e8ad0383696bf50a9d69c8152adea45d58a5"
  ]
]){
  assert.equal(existsSync(path.join(root,'.github/workflows',name)),false,name);
  const bytes=readFileSync(path.join(root,'tests/fixtures/retired-workflows',name));
  assert.equal(createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex'),sha,name);
 }
 for(const [file,entry,pin,key] of [
  ['ER1_DEC31_HTML_PUBLISH_V3_B_APPROVAL.json','er1-dec31-html-publish-v3-entry.mjs','044e085f6c51803e55ef26d8ba80e5632ef473cc','market-calendar:earnings-dec2026-display-html'],
  ['ER1_DEC31_DERIVED_ER1_B_APPROVAL.json','er1-dec31-derived-score-v2-entry.mjs','85dcfe8e9e6f622ee8f8ddb8be563a72fbcfc44d','market-calendar:earnings-dec2026-er1-score-public']
 ]){
  const a=JSON.parse(readFileSync(path.join(root,file),'utf8'));
  assert.equal(a.sourceSha,pin);assert.equal(a.outputKey,key);assert.equal(a.expectedEvents,38);
  assert.equal(a.allowProviderCalls,false);assert.equal(a.allowFormulaChanges,false);assert.equal(a.allowSchedulerChanges,false);assert.equal(a.allowDedicatedD1OutputWrite,true);
  assert.equal(existsSync(path.join(root,entry)),true,entry);
 }
 for(const name of ['pc-er1-dec31-symbol-batch-a.yml','pc-er1-nov30-full.yml','pc-er1-nov30-capture.yml','pc-publication-b.yml','pc-job.yml'])
  assert.equal(existsSync(path.join(root,'.github/workflows',name)),true,name);
});

// #215 consumed a fixed two-key historical HTML publication approval.
// Current production freshness, full Actual data and scores are independent.
test('consumed November 3051-event HTML publication intake is archived with approval intact',()=>{
 const name='pc-er1-nov30-html-publish.yml';
 assert.equal(existsSync(path.join(root,'.github/workflows',name)),false,name);
 const bytes=readFileSync(path.join(root,'tests/fixtures/retired-workflows',name));
 assert.equal(createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex'),'a095bd4a953483e01d544a424c23dc9e9cd884fc');
 const a=JSON.parse(readFileSync(path.join(root,'ER1_NOV30_HTML_PUBLISH_B_APPROVAL.json'),'utf8'));
 assert.equal(a.sourceSha,'f8c7ba3f2ec407d01b9b2b57ce2c8e28b52dbac8');
 assert.equal(a.expectedEvents,3051);assert.equal(a.expectedDates,30);
 assert.deepEqual(a.outputKeys,['market-calendar:earnings-nov2026-h1-display-html','market-calendar:earnings-nov2026-h2-display-html']);
 for(const k of ['allowProviderCalls','allowExistingFeedWrites','allowRawVendorPublic','allowFormulaChanges','allowSchedulerChanges','allowDirectDeployment'])assert.equal(a[k],false,k);
 assert.equal(a.maxAutomaticRetries,0);
 assert.equal(existsSync(path.join(root,'er1-nov30-html-publish-entry.mjs')),true);
 for(const n of ['pc-er1-nov30-full.yml','pc-er1-nov30-capture.yml','pc-er1-nov30-saved-actual-audit.yml','pc-er1-nov-forecast-shadow.yml','pc-er1-nov-forecast-publish.yml','pc-publication-b.yml','pc-job.yml'])assert.equal(existsSync(path.join(root,'.github/workflows',n)),true,n);
});

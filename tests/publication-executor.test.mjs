import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parsePublisherLog,nextLedgerPhase,millisecondsToNextUtcSecond,
  publicationCheckpointReport,validateBeaStoredPreflight,
  validateQfrStoredPreflight,validateQfrApplySource,validateQfrPinnedNoWrite,
  validateWpsfd42ServicePreflight,validateWpsfd42ServiceApplySource,
  validateWpsfd42PinnedNoWrite} from '../tools/publication-executor.mjs';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const source=file=>fs.readFileSync(path.join(root,file),'utf8');

test('BEA exact D1 readback and original CSV hash are mandatory',()=>{
 const raw=['MODE=EXPLICIT_APPLY','SOURCE_ORIGIN=PC_IMMUTABLE_ARCHIVE',
   'SOURCE_HTTP_REQUESTS=0','STORED_RAW_READBACK=VERIFIED','SOURCE_SHA256='+'a'.repeat(64),
   'SOURCE_STORED_AT=1793112733108','D1_RESULT=READBACK_VERIFIED',
   'RESULT=PASS_BEA_UNIT_READBACK_VERIFIED'].join('\r\n');
 assert.deepEqual(parsePublisherLog(raw,'bea-unit-profit-once'),{
   status:'PASS',d1Result:'READBACK_VERIFIED',sourceVersion:'a'.repeat(64),
   sourceStoredAt:1793112733108});
 assert.throws(()=>parsePublisherLog(raw.replace('D1_RESULT=READBACK_VERIFIED',
   'D1_RESULT=WRITE_SUBMITTED'),'bea-unit-profit-once'),/PUBLICATION_RESULT_NOT_VERIFIED/);
});
test('QFR exact stored checkpoint is validated and only identical prior is reusable',()=>{
 const key='detail:earnings-recession-indicators:census-qfr-mfg-margin:v1';
 const raw=['MODE=APPLY_EXPLICIT','SNAPSHOT_KEY='+key,'SOURCE_GATES=PASS',
   'SOURCE_HTTP_REQUESTS=0','PC_SQLITE_WRITES=0',
   'SOURCE_VERSION='+'b'.repeat(64),'RAW_ZIP_SHA256='+'c'.repeat(64),
   'PREFLIGHT_SOURCE_PIN=VERIFIED','SOURCE_STORED_AT=1793112733108',
   'D1_RESULT=ALREADY_STORED','D1_READBACK=PREVIOUS_IDENTICAL',
   'RESULT=PASS_QFR_D1_ALREADY_STORED'].join('\n');
 const evidence=parsePublisherLog(raw,'census-qfr-margin-once',key);
 assert.equal(evidence.d1Result,'ALREADY_STORED');
 assert.equal(evidence.key,key);
 assert.throws(()=>parsePublisherLog(raw+'\nSOURCE_VERSION='+'a'.repeat(64),
   'census-qfr-margin-once',key),/PUBLICATION_RESULT_TXT_INVALID/);
 assert.throws(()=>parsePublisherLog(raw.replace('SOURCE_STORED_AT=1793112733108',
   'SOURCE_STORED_AT=0'),'census-qfr-margin-once',key),/PUBLICATION_RESULT_CHECKPOINT_INVALID/);
});
test('second-resolution result files cannot share a dry-run/apply UTC second',()=>{
 assert.equal(millisecondsToNextUtcSecond(1793112733000),1050);
 assert.equal(millisecondsToNextUtcSecond(1793112733900),150);
 assert.equal(millisecondsToNextUtcSecond(1793112733999),51);
 const executor=source('tools/publication-executor.mjs');
 assert.match(executor,/setTimeout\(resolve,millisecondsToNextUtcSecond\(fenceAt\)\)/);
 assert.match(executor,/const fenceAt=Date\.now\(\)/);
});
test('BEA already-stored attempt timestamp is not claimed as D1 checkpoint',()=>{
 const evidence={d1Result:'ALREADY_STORED',sourceStoredAt:1793112733108};
 assert.deepEqual(publicationCheckpointReport('bea-unit-profit-once',evidence),{
  sourceStoredAt:null,attemptedSourceStoredAt:1793112733108,
  sourceStoredAtEvidence:'ATTEMPTED_ONLY'});
 assert.deepEqual(publicationCheckpointReport('census-qfr-margin-once',evidence),{
  sourceStoredAt:1793112733108,attemptedSourceStoredAt:1793112733108,
  sourceStoredAtEvidence:'D1_READBACK_VERIFIED'});
 assert.equal(publicationCheckpointReport('bea-unit-profit-once',
  {...evidence,d1Result:'READBACK_VERIFIED'}).sourceStoredAt,1793112733108);
});
test('operation state transitions fail closed on ambiguous apply or timeout',()=>{
 const initial={requestId:'pc-publication-fixture',fingerprint:'a'.repeat(64),phase:'READY'};
 const preflight=nextLedgerPhase(initial,'PREFLIGHT_PASS');
 assert.equal(preflight.phase,'PREFLIGHT_VERIFIED');
 const applying=nextLedgerPhase(preflight,'APPLY_START');
 assert.equal(applying.phase,'APPLYING');
 const unknown=nextLedgerPhase(applying,'UNVERIFIED',{code:'PUBLICATION_APPLY_RESULT_UNKNOWN'});
 assert.equal(unknown.phase,'STATE_UNKNOWN');
 assert.equal(unknown.firstFail,'PUBLICATION_APPLY_RESULT_UNKNOWN');
 assert.throws(()=>nextLedgerPhase(unknown,'APPLY_START'),/PUBLICATION_LEDGER_TRANSITION_REJECTED/);
 assert.equal(nextLedgerPhase(applying,'READBACK_PASS').phase,'PASS');
 assert.equal(nextLedgerPhase(applying,'NO_WRITE_STOP',{code:'PUBLICATION_QFR_SOURCE_DRIFT_NO_WRITE'}).phase,'BLOCKED');
 assert.equal(nextLedgerPhase(preflight,'STOP',{code:'SOURCE_DRIFT'}).phase,'BLOCKED');
});
test('QFR B reads unique result files from the approved request directory, never source checkout',()=>{
 const executor=source('tools/publication-executor.mjs');
 assert.match(executor,/const outputDir=logDirectory;/);
 assert.match(executor,/ZGMINI_EARNINGS_C_LOG_DIR:logDirectory/);
 assert.doesNotMatch(executor,/outputDir=bea\?logDirectory:path\.join\(publisherRoot/);
});
test('static workflow stays gated and cannot overwrite existing A or maintenance channels',()=>{
 const yml=source('.github/workflows/pc-publication-b.yml');
 assert.match(yml,/vars\.ZGMINI_B_PUBLICATION_APPLY_ENABLED == 'true'/);
 assert.match(yml,/group: zgmini-pc-publication-b-single-lane/);
 assert.match(yml,/cancel-in-progress: false/);
 assert.match(yml,/contains\(github\.event\.issue\.labels\.\*\.name, 'pc-publication'\)/);
 assert.match(yml,/publication-executor\.mjs/);
 assert.equal((yml.match(/clean: false/g)||[]).length,2);
 assert.doesNotMatch(yml,/pc-job\.yml|pc-maintenance/);
 const executor=source('tools/publication-executor.mjs');
 assert.match(executor,/fs\.mkdirSync\(active\)/);
 assert.match(executor,/phase\.phase==='APPLYING'/);
 assert.match(executor,/noWriteVerified\?'NO_WRITE_STOP':'UNVERIFIED'/);
 assert.match(executor,/:'STOP'/);
 assert.match(executor,/phase\.phase==='PASS'/);
 assert.match(executor,/\['--dry-run'\]/);
 assert.match(executor,/\[\.\.\.invocation\.flags\]/);
 assert.match(executor,/publisherFiles/);
 assert.doesNotMatch(executor,/shell:true|execSync\(|powershell|wrangler deploy/i);
});

test('BEA preflight and apply must reuse manifest pinned source without provider GET',()=>{
 const pin='e'.repeat(64);
 const raw=['MODE=READ_ONLY_PREFLIGHT','SOURCE_SHA256='+pin,
  'SOURCE_ORIGIN=PC_IMMUTABLE_ARCHIVE','SOURCE_HTTP_REQUESTS=0',
  'STORED_RAW_READBACK=VERIFIED','D1_WRITES=0','RAW_LOCAL_WRITES=0',
  'RESULT=PASS_BEA_UNIT_PREFLIGHT_ONLY'].join('\n');
 assert.equal(validateBeaStoredPreflight(raw,pin),true);
 assert.throws(()=>validateBeaStoredPreflight(raw,'f'.repeat(64)),
   /PUBLICATION_BEA_PREFLIGHT_SOURCE_MISMATCH/);
 assert.throws(()=>validateBeaStoredPreflight(raw.replace('SOURCE_HTTP_REQUESTS=0',
   'SOURCE_HTTP_REQUESTS=1'),pin),/PUBLICATION_BEA_PREFLIGHT_SOURCE_MISMATCH/);
 const changed=raw.replace('STORED_RAW_READBACK=VERIFIED','STORED_RAW_READBACK=UNVERIFIED');
 assert.throws(()=>validateBeaStoredPreflight(changed,pin),
   /PUBLICATION_BEA_PREFLIGHT_SOURCE_MISMATCH/);
 const executor=source('tools/publication-executor.mjs');
 assert.match(executor,/ZGMINI_EARNINGS_BEA_UNIT_SOURCE_SHA:invocation.sourceSha256/);
 assert.match(executor,/evidence.sourceVersion!==invocation.sourceSha256/);
 assert.match(executor,/providerCalls:0/);
 assert.doesNotMatch(executor,/providerCalls:request.operation==='bea-unit-profit-once'\?2:0/);
});

test('QFR dry-run pins exact version, raw ZIP SHA and stored timestamp',()=>{
 const key='detail:earnings-recession-indicators:census-qfr-mfg-margin:v1';
 const raw=['MODE=READ_ONLY_PREFLIGHT','SNAPSHOT_KEY='+key,'SOURCE_GATES=PASS',
   'SOURCE_FRESHNESS=FRESH','SOURCE_HTTP_REQUESTS=0','PC_SQLITE_WRITES=0',
   'D1_QUERIES=0','D1_WRITES=0','SOURCE_VERSION='+'a'.repeat(64),
   'RAW_ZIP_SHA256='+'b'.repeat(64),'SOURCE_STORED_AT=1793112733108',
   'RESULT=PASS_QFR_D1_PREFLIGHT_NO_REMOTE_ACCESS'].join('\n');
 const pin=validateQfrStoredPreflight(raw,key);
 assert.deepEqual(pin,{sourceVersion:'a'.repeat(64),
   rawZipSha256:'b'.repeat(64),sourceStoredAt:1793112733108});
 for(const [field,value] of [['SOURCE_VERSION','c'.repeat(63)],['RAW_ZIP_SHA256','X'],
   ['SOURCE_STORED_AT','0'],['D1_WRITES','1'],['SNAPSHOT_KEY','different'],
   ['SOURCE_FRESHNESS','STALE']]){
   const changed=raw.replace(field+'='+raw.split('\n').find(x=>x.startsWith(field+'=')).split('=')[1],
     field+'='+value);
   assert.throws(()=>validateQfrStoredPreflight(changed,key),
     /PUBLICATION_QFR_PREFLIGHT_SOURCE_MISMATCH/);
 }
 const apply={sourceVersion:pin.sourceVersion,rawZipSha256:pin.rawZipSha256,
   sourceStoredAt:pin.sourceStoredAt};
 assert.equal(validateQfrApplySource(pin,apply),true);
 for(const [field,value] of [['sourceVersion','c'.repeat(64)],
   ['rawZipSha256','c'.repeat(64)],['sourceStoredAt',1793112733109]])
   assert.throws(()=>validateQfrApplySource(pin,{...apply,[field]:value}),
     /PUBLICATION_QFR_APPLY_SOURCE_MISMATCH/);
 const executor=source('tools/publication-executor.mjs');
 assert.match(executor,/validateQfrStoredPreflight\(preflightEvidence,invocation\.snapshotKey\)/);
 assert.match(executor,/ZGMINI_EARNINGS_QFR_SOURCE_VERSION:qfrPin\.sourceVersion/);
 assert.match(executor,/ZGMINI_EARNINGS_QFR_RAW_ZIP_SHA256:qfrPin\.rawZipSha256/);
 assert.match(executor,/ZGMINI_EARNINGS_QFR_SOURCE_STORED_AT:String\(qfrPin\.sourceStoredAt\)/);
 assert.match(executor,/validateQfrApplySource\(qfrPin,evidence\)/);
});

test('QFR proven pre-write drift is BLOCKED but any ambiguous apply remains UNKNOWN',()=>{
 const key='detail:earnings-recession-indicators:census-qfr-mfg-margin:v1';
 const pinned={sourceVersion:'a'.repeat(64),rawZipSha256:'b'.repeat(64),
   sourceStoredAt:1793112733108};
 const result=['MODE=APPLY_EXPLICIT','SNAPSHOT_KEY='+key,'SOURCE_GATES=PASS',
   'SOURCE_HTTP_REQUESTS=0','SOURCE_VERSION='+'c'.repeat(64),
   'RAW_ZIP_SHA256='+'b'.repeat(64),'SOURCE_STORED_AT=1793112733108',
   'D1_QUERIES=0','D1_WRITES=0','ERROR=QFR_PUBLISH_SOURCE_DRIFT',
   'RESULT=FAIL_QFR_D1_NO_VERIFIED_PUBLICATION'].join('\n');
 assert.equal(validateQfrPinnedNoWrite(result,pinned,key),true);
 for(const [needle,replacement] of [['D1_WRITES=0','D1_WRITES=1'],
   ['ERROR=QFR_PUBLISH_SOURCE_DRIFT','ERROR=OTHER'],
   ['MODE=APPLY_EXPLICIT','MODE=READ_ONLY_PREFLIGHT']]){
   assert.throws(()=>validateQfrPinnedNoWrite(result.replace(needle,replacement),pinned,key),
     /PUBLICATION_QFR_NO_WRITE_EVIDENCE_INVALID/);
 }
 assert.throws(()=>validateQfrPinnedNoWrite(
   result.replace('SOURCE_VERSION='+'c'.repeat(64),'SOURCE_VERSION='+'a'.repeat(64)),
   pinned,key),/PUBLICATION_QFR_NO_WRITE_EVIDENCE_INVALID/);
 const executor=source('tools/publication-executor.mjs');
 assert.match(executor,/noWriteVerified=true/);
 assert.match(executor,/noWriteVerified\?'NO_WRITE_STOP':'UNVERIFIED'/);
 assert.match(executor,/applied\.exitCode===1&&!applied\.timedOut&&!applied\.truncated/);
});

test('QFR apply result proves the actual key, no side effects and exact D1 outcome',()=>{
 const key='detail:earnings-recession-indicators:census-qfr-mfg-margin:v1';
 const fields=[
  ['MODE','APPLY_EXPLICIT'],['SNAPSHOT_KEY',key],['SOURCE_GATES','PASS'],
  ['SOURCE_HTTP_REQUESTS','0'],['PC_SQLITE_WRITES','0'],
  ['SOURCE_VERSION','a'.repeat(64)],['RAW_ZIP_SHA256','b'.repeat(64)],
  ['SOURCE_STORED_AT','1793112733108'],['PREFLIGHT_SOURCE_PIN','VERIFIED'],
  ['D1_RESULT','READBACK_VERIFIED'],['D1_READBACK','EXACT'],
  ['RESULT','PASS_QFR_D1_EXACT_READBACK'],
 ];
 const fixture=(changes={})=>fields.map(([name,value])=>
  name+'='+(Object.hasOwn(changes,name)?changes[name]:value)).join('\r\n');
 const evidence=parsePublisherLog(fixture(),'census-qfr-margin-once',key);
 assert.equal(evidence.key,key);
 assert.equal(evidence.d1Result,'READBACK_VERIFIED');
 for(const [field,value] of [
  ['SNAPSHOT_KEY','detail:unapproved-key'],
  ['MODE','READ_ONLY_PREFLIGHT'],
  ['SOURCE_GATES','FAIL'],
  ['SOURCE_HTTP_REQUESTS','1'],
  ['PC_SQLITE_WRITES','1'],
  ['D1_RESULT','ALREADY_STORED'],
  ['RESULT','PASS_QFR_D1_ALREADY_STORED'],
  ['D1_READBACK','PREVIOUS_IDENTICAL'],
 ]){
  assert.throws(()=>parsePublisherLog(fixture({[field]:value}),
    'census-qfr-margin-once',key),/PUBLICATION_QFR_APPLY_EVIDENCE_INVALID/);
 }
 assert.throws(()=>parsePublisherLog(fixture(),
   'census-qfr-margin-once','detail:incorrect-approved-key'),
   /PUBLICATION_QFR_APPLY_EVIDENCE_INVALID/);
 assert.throws(()=>parsePublisherLog(fixture(),
   'census-qfr-margin-once'),/PUBLICATION_QFR_APPLY_EVIDENCE_INVALID/);
 assert.throws(()=>parsePublisherLog(fixture()+'\nERROR=QFR_D1_PUBLISHER_FAILED',
   'census-qfr-margin-once',key),/PUBLICATION_QFR_APPLY_EVIDENCE_INVALID/);
 assert.throws(()=>parsePublisherLog(fixture({PREFLIGHT_SOURCE_PIN:'MISSING'}),
   'census-qfr-margin-once',key),/PUBLICATION_QFR_APPLY_PIN_MISSING/);
 const duplicate=parsePublisherLog(fixture({D1_RESULT:'ALREADY_STORED',
   D1_READBACK:'PREVIOUS_IDENTICAL',RESULT:'PASS_QFR_D1_ALREADY_STORED'}),
   'census-qfr-margin-once',key);
 assert.equal(duplicate.d1Result,'ALREADY_STORED');
 const executor=source('tools/publication-executor.mjs');
 assert.match(executor,/request\.operation,invocation\.snapshotKey\)/);
 assert.match(executor,/\.\.\.evidence,\.\.\.\(bea\?\{key:invocation\.snapshotKey\}:\{\}\)/);
});


test('manufacturing one-shot uses fixed SHA arguments and verified JSON readback without changing legacy B operations',()=>{
 const executor=source('tools/publication-executor.mjs');
 assert.match(executor,/const mfg=request\.operation==='bea-manufacturing-profit-once'/);
 assert.match(executor,/\['--source-sha',invocation\.sourceSha256,'--dry-run'\]/);
 assert.match(executor,/\['--source-sha',invocation\.sourceSha256,\.\.\.invocation\.flags\]/);
 assert.match(executor,/parseBeaMfgResult\(preflightEvidence/);
 assert.match(executor,/parseBeaMfgResult\(applied\.output/);
  assert.match(executor,/if\(qfr\)validateQfrApplySource\(qfrPin,evidence\)/);
  assert.match(executor,/if\(qfr&&applied\.exitCode===1/);
 for(const name of ['ZGMINI_EARNINGS_BEA_MFG_B_PIN_REQUIRED',
   'ZGMINI_EARNINGS_BEA_MFG_SOURCE_VERSION',
   'ZGMINI_EARNINGS_BEA_MFG_SOURCE_STORED_AT',
   'ZGMINI_EARNINGS_BEA_MFG_OBSERVED_THROUGH'])
   assert.ok(executor.includes(name));
 assert.match(executor,/validatePublicationReadback\(validated/);
 const contract=source('tools/publication-contract.mjs');
 assert.match(contract,/BEA_MANUFACTURING_PROFIT_SINGLE_KEY_D1_ONCE/);
 assert.match(contract,/STORED_CSV_ONLY/);
});


test('WPSFD42 B preflight verifies exactly two fresh rows, stored hash pin and zero effects',()=>{
  const key='detail:earnings-recession-indicators:bls-wpsfd42:v1';
  const rows=[
    ['MODE','READ_ONLY_PREFLIGHT'],['SNAPSHOT_KEY',key],['SOURCE_GATES','PASS'],
    ['SOURCE_HTTP_REQUESTS','0'],['PC_SQLITE_WRITES','0'],['D1_QUERIES','0'],
    ['D1_WRITES','0'],['BASE_SNAPSHOT_KEY_WRITES','0'],['SCORE_WRITES','0'],
    ['SCHEDULER_CHANGED','NO'],['WORKER_DEPLOYED','NO'],
    ['ROW_COUNT','2'],['FRESH_READY_ROWS','2'],['WPSFD42_VERIFIED_SNAPSHOTS','1'],
    ['SOURCE_VERSION','a'.repeat(64)],['SOURCE_STORED_AT','1795351641253'],
    ['RESULT','PASS_EARNINGS_C_SERVICE_D1_PREFLIGHT_ONLY']
  ];
  const result=(changes={})=>rows.map(([k,v])=>k+'='+
    (Object.hasOwn(changes,k)?changes[k]:v)).join('\n');
  const pin=validateWpsfd42ServicePreflight(result(),key);
  assert.deepEqual(pin,{sourceVersion:'a'.repeat(64),sourceStoredAt:1795351641253});
  for(const [k,v] of [['SNAPSHOT_KEY','detail:earnings-recession-indicators:v1'],
    ['SOURCE_GATES','FAIL'],['SOURCE_HTTP_REQUESTS','1'],['D1_WRITES','1'],
    ['SCORE_WRITES','1'],['ROW_COUNT','1'],['FRESH_READY_ROWS','1'],
    ['WPSFD42_VERIFIED_SNAPSHOTS','0'],['SOURCE_VERSION','b'.repeat(63)]])
    assert.throws(()=>validateWpsfd42ServicePreflight(result({[k]:v}),key),
      /PUBLICATION_WPSFD42_PREFLIGHT_SOURCE_MISMATCH/);
  assert.equal(validateWpsfd42ServiceApplySource(pin,{...pin}),true);
  for(const evidence of [{...pin,sourceVersion:'b'.repeat(64)},
    {...pin,sourceStoredAt:1795351641254}])
    assert.throws(()=>validateWpsfd42ServiceApplySource(pin,evidence),
      /PUBLICATION_WPSFD42_APPLY_SOURCE_MISMATCH/);
});

test('WPSFD42 B accepts verified single-key readback or identical stored key only',()=>{
  const key='detail:earnings-recession-indicators:bls-wpsfd42:v1';
  const fields=[
    ['MODE','APPLY_EXPLICIT'],['SNAPSHOT_KEY',key],['SOURCE_GATES','PASS'],
    ['PREFLIGHT_SOURCE_PIN','VERIFIED'],['SOURCE_HTTP_REQUESTS','0'],
    ['PC_SQLITE_WRITES','0'],['EXISTING_C_CHECKPOINT_WRITES','0'],
    ['BASE_SNAPSHOT_KEY_WRITES','0'],['SCORE_WRITES','0'],
    ['SCHEDULER_CHANGED','NO'],['WORKER_DEPLOYED','NO'],
    ['ROW_COUNT','2'],['FRESH_READY_ROWS','2'],
    ['SOURCE_VERSION','a'.repeat(64)],['SOURCE_STORED_AT','1795351641253'],
    ['D1_RESULT','READBACK_VERIFIED'],['D1_READBACK','VERIFIED'],
    ['RESULT','PASS_EARNINGS_C_SERVICE_D1_READBACK']
  ];
  const result=(changes={})=>fields.map(([k,v])=>k+'='+
    (Object.hasOwn(changes,k)?changes[k]:v)).join('\r\n');
  const confirmed=parsePublisherLog(result(),'bls-wpsfd42-service-once',key);
  assert.equal(confirmed.key,key);
  assert.equal(confirmed.sourceVersion,'a'.repeat(64));
  assert.equal(confirmed.sourceStoredAt,1795351641253);
  for(const [k,v] of [['SNAPSHOT_KEY','detail:earnings-recession-indicators:v1'],
    ['MODE','READ_ONLY_PREFLIGHT'],['SOURCE_GATES','FAIL'],
    ['PREFLIGHT_SOURCE_PIN','MISSING'],['SOURCE_HTTP_REQUESTS','1'],
    ['PC_SQLITE_WRITES','1'],['EXISTING_C_CHECKPOINT_WRITES','1'],
    ['BASE_SNAPSHOT_KEY_WRITES','1'],['SCORE_WRITES','1'],
    ['ROW_COUNT','5'],['FRESH_READY_ROWS','1'],['D1_READBACK','PREVIOUS_IDENTICAL']])
    assert.throws(()=>parsePublisherLog(result({[k]:v}),
      'bls-wpsfd42-service-once',key),/PUBLICATION_WPSFD42_APPLY_EVIDENCE_INVALID/);
  const identical=parsePublisherLog(result({D1_RESULT:'ALREADY_STORED',
    D1_READBACK:'PREVIOUS_IDENTICAL',
    RESULT:'PASS_EARNINGS_C_SERVICE_ALREADY_STORED'}),
    'bls-wpsfd42-service-once',key);
  assert.equal(identical.d1Result,'ALREADY_STORED');
  assert.throws(()=>parsePublisherLog(result({SOURCE_STORED_AT:'0'}),
    'bls-wpsfd42-service-once',key),/PUBLICATION_RESULT_CHECKPOINT_INVALID/);
});

test('WPSFD42 B source drift can stop only with proved no D1 query or write',()=>{
 const key='detail:earnings-recession-indicators:bls-wpsfd42:v1';
 const pin={sourceVersion:'a'.repeat(64),sourceStoredAt:1795351641253};
 const raw=['MODE=APPLY_EXPLICIT','SNAPSHOT_KEY='+key,'SOURCE_GATES=PASS',
  'SOURCE_HTTP_REQUESTS=0','PC_SQLITE_WRITES=0','D1_QUERIES=0','D1_WRITES=0',
  'SOURCE_VERSION='+'b'.repeat(64),'SOURCE_STORED_AT=1795351641253',
  'ERROR=EARNINGS_C_SERVICE_SOURCE_DRIFT','RESULT=FAIL_EARNINGS_C_SERVICE_D1'].join('\n');
 assert.equal(validateWpsfd42PinnedNoWrite(raw,pin,key),true);
 for(const [x,y] of [['D1_WRITES=0','D1_WRITES=1'],
   ['D1_QUERIES=0','D1_QUERIES=1'],
   ['ERROR=EARNINGS_C_SERVICE_SOURCE_DRIFT','ERROR=NETWORK_UNKNOWN'],
   ['SNAPSHOT_KEY='+key,'SNAPSHOT_KEY=detail:unapproved']])
   assert.throws(()=>validateWpsfd42PinnedNoWrite(raw.replace(x,y),pin,key),
     /PUBLICATION_WPSFD42_NO_WRITE_EVIDENCE_INVALID/);
 assert.throws(()=>validateWpsfd42PinnedNoWrite(
   raw.replace('SOURCE_VERSION='+'b'.repeat(64),'SOURCE_VERSION='+'a'.repeat(64)),
   pin,key),/PUBLICATION_WPSFD42_NO_WRITE_EVIDENCE_INVALID/);
 const executor=source('tools/publication-executor.mjs');
 assert.match(executor,/ZGMINI_EARNINGS_SERVICE_SOURCE_VERSION:servicePin.sourceVersion/);
 assert.match(executor,/ZGMINI_EARNINGS_SERVICE_SOURCE_STORED_AT:String\(servicePin.sourceStoredAt\)/);
 assert.match(executor,/service&&applied.exitCode===1/);
 assert.match(executor,/validateWpsfd42ServiceApplySource\(servicePin,evidence\)/);
 assert.match(executor,/PUBLICATION_WPSFD42_SOURCE_DRIFT_NO_WRITE/);
 assert.match(executor,/noWriteVerified=true/);
});

test('native BEA JSON B preflight binds immutable source and dedicated transport',()=>{
 const key='detail:earnings-bea-unit-profit:v1',sha='e'.repeat(64);
 const raw=[
  'MODE=READ_ONLY_PREFLIGHT','SOURCE_TRANSPORT=BEA_API_JSON',
  'SOURCE_SERIES=A463RD','SNAPSHOT_KEY='+key,
  'SOURCE_SHA256='+sha,'SOURCE_ORIGIN=PC_IMMUTABLE_ARCHIVE',
  'SOURCE_HTTP_REQUESTS=0','STORED_RAW_READBACK=VERIFIED',
  'D1_WRITES=0','RAW_LOCAL_WRITES=0','RESULT=PASS_BEA_UNIT_PREFLIGHT_ONLY'
 ].join('\n');
 assert.equal(validateBeaStoredPreflight(raw,sha,{native:true,expectedKey:key}),true);
 for(const [oldValue,newValue] of [
  ['SOURCE_TRANSPORT=BEA_API_JSON','SOURCE_TRANSPORT=FRED_CSV'],
  ['SOURCE_SERIES=A463RD','SOURCE_SERIES=A463RD3Q052SBEA'],
  ['SNAPSHOT_KEY='+key,'SNAPSHOT_KEY=detail:other']
 ])assert.throws(()=>validateBeaStoredPreflight(raw.replace(oldValue,newValue),sha,
  {native:true,expectedKey:key}),/PUBLICATION_BEA_NATIVE_PREFLIGHT_MISMATCH/);
 assert.throws(()=>validateBeaStoredPreflight(raw,'f'.repeat(64),
  {native:true,expectedKey:key}),/PUBLICATION_BEA_PREFLIGHT_SOURCE_MISMATCH/);
});

test('native BEA JSON B apply accepts only exact source and D1 result evidence',()=>{
 const key='detail:earnings-bea-unit-profit:v1',sha='e'.repeat(64);
 const lines=[
  'MODE=EXPLICIT_APPLY','SOURCE_TRANSPORT=BEA_API_JSON',
  'SOURCE_SERIES=A463RD','SNAPSHOT_KEY='+key,
  'SOURCE_GATES=PASS','SOURCE_HTTP_REQUESTS=0','PC_SQLITE_WRITES=0',
  'SOURCE_ORIGIN=PC_IMMUTABLE_ARCHIVE','STORED_RAW_READBACK=VERIFIED',
  'SOURCE_SHA256='+sha,'SOURCE_STORED_AT=1793112733108',
  'D1_RESULT=READBACK_VERIFIED','D1_READBACK=VERIFIED',
  'RESULT=PASS_BEA_UNIT_READBACK_VERIFIED'
 ];
 const fixture=changes=>lines.map(line=>{
  const key=line.split('=')[0];
  return Object.hasOwn(changes,key)?key+'='+changes[key]:line;
 }).join('\n');
 const e=parsePublisherLog(fixture({}),'bea-unit-nipa-json-once',key);
 assert.deepEqual(e,{status:'PASS',d1Result:'READBACK_VERIFIED',
  sourceVersion:sha,sourceStoredAt:1793112733108});
 for(const [name,value] of [
  ['MODE','READ_ONLY_PREFLIGHT'],['SOURCE_TRANSPORT','FRED_CSV'],
  ['SOURCE_SERIES','A463RD3Q052SBEA'],['SNAPSHOT_KEY','detail:wrong'],
  ['SOURCE_GATES','FAIL'],['SOURCE_HTTP_REQUESTS','1'],
  ['PC_SQLITE_WRITES','1'],['D1_READBACK','PREVIOUS_IDENTICAL']
 ])assert.throws(()=>parsePublisherLog(fixture({[name]:value}),
  'bea-unit-nipa-json-once',key),/PUBLICATION_(BEA_NATIVE_APPLY_EVIDENCE_INVALID|BEA_NOT_STORED_SOURCE)/);
 assert.deepEqual(publicationCheckpointReport('bea-unit-nipa-json-once',
  {...e,d1Result:'ALREADY_STORED'}),{
   sourceStoredAt:null,attemptedSourceStoredAt:1793112733108,
   sourceStoredAtEvidence:'ATTEMPTED_ONLY'
  });
});

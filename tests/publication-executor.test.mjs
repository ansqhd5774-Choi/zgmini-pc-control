import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parsePublisherLog,nextLedgerPhase,millisecondsToNextUtcSecond,
  publicationCheckpointReport,validateBeaStoredPreflight,
  validateQfrStoredPreflight,validateQfrApplySource} from '../tools/publication-executor.mjs';

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
 const raw=['MODE=APPLY_EXPLICIT','SOURCE_VERSION='+'b'.repeat(64),
   'RAW_ZIP_SHA256='+'c'.repeat(64),'PREFLIGHT_SOURCE_PIN=VERIFIED',
   'SOURCE_STORED_AT=1793112733108','D1_RESULT=ALREADY_STORED',
   'RESULT=PASS_QFR_D1_ALREADY_STORED'].join('\n');
 assert.equal(parsePublisherLog(raw,'census-qfr-margin-once').d1Result,'ALREADY_STORED');
 assert.throws(()=>parsePublisherLog(raw+'\nSOURCE_VERSION='+'a'.repeat(64),
   'census-qfr-margin-once'),/PUBLICATION_RESULT_TXT_INVALID/);
 assert.throws(()=>parsePublisherLog(raw.replace('SOURCE_STORED_AT=1793112733108',
   'SOURCE_STORED_AT=0'),'census-qfr-margin-once'),/PUBLICATION_RESULT_CHECKPOINT_INVALID/);
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
 assert.equal(nextLedgerPhase(preflight,'STOP',{code:'SOURCE_DRIFT'}).phase,'BLOCKED');
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
 assert.match(executor,/phase\.phase==='APPLYING'\?'UNVERIFIED':'STOP'/);
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

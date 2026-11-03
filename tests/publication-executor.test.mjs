import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parsePublisherLog,nextLedgerPhase,millisecondsToNextUtcSecond,
  publicationCheckpointReport} from '../tools/publication-executor.mjs';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const source=file=>fs.readFileSync(path.join(root,file),'utf8');

test('BEA exact D1 readback and original CSV hash are mandatory',()=>{
 const raw=['MODE=EXPLICIT_APPLY','SOURCE_SHA256='+'a'.repeat(64),
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

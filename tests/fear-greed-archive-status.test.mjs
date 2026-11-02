import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {inspectFearGreedArchive} from '../controller/fear-greed-archive-readonly.mjs';
import {executeJob} from '../controller/engine.mjs';

const policy=JSON.parse(fs.readFileSync(new URL('../config/operations.json',import.meta.url)));
const digest=x=>createHash('sha256').update(x).digest('hex');
const request=()=>({schema:'ZGMINI_PC_JOB_V1',requestId:'fear-greed-archive-test-1',chatId:'chat-fear-greed',operation:'fear-greed-archive-status',sourceRepository:policy.sourceRepository,sourceBranch:'codex/usa-fear-greed-change-only-r10-20261101',sourceSha:'a'.repeat(40)});
const taskXml='<Task><Actions><Exec><Command>C:\\Windows\\System32\\wscript.exe</Command><Arguments>&quot;E:\\ZGmini\\data\\pc-writer\\run-local-core.vbs&quot;</Arguments></Exec></Actions></Task>';

function fixture(withDatabase=true){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-fg-readonly-'));
 const dataRoot=path.join(root,'data');const storage=path.join(dataRoot,'pc-writer','storage');
 fs.mkdirSync(storage,{recursive:true});
 fs.writeFileSync(path.join(dataRoot,'pc-writer','config.json'),JSON.stringify({source:'b'.repeat(40)}));
 const dbFile=path.join(storage,'core.sqlite');
 if(withDatabase){
  const db=new DatabaseSync(dbFile);
  db.exec('CREATE TABLE public_feed_snapshots_v1(kind TEXT,feed_key TEXT,snapshot_key TEXT,body TEXT,stored_at INTEGER,PRIMARY KEY(kind,feed_key,snapshot_key))');
  db.exec('CREATE TABLE market_public_snapshots_v1(snapshot_key TEXT PRIMARY KEY,body TEXT,stored_at INTEGER)');
  const q=db.prepare('INSERT INTO public_feed_snapshots_v1(kind,feed_key,snapshot_key,body,stored_at) VALUES(?,?,?,?,?)');
  q.run('output','fear-greed','current',JSON.stringify({status:'verified',score:24.8,observedAt:'2026-11-02T12:53:46.000Z',secret:'NEVER_EXPOSE_ME'}),1793624026000);
  q.run('output','fear-greed-observed','2026-10-30',JSON.stringify({version:'CNN_OBSERVED_ARCHIVE_R1',date:'2026-10-30',observations:[{observedAt:'2026-10-30T23:59:48.000Z',score:26.2}]}),1793404788000);
  q.run('output','fear-greed-verified-checks','2026-11-02',JSON.stringify({version:'CNN_VERIFIED_CHECKS_R1',date:'2026-11-02',checks:[{checkedAt:'2026-11-02T12:40:00.000Z',score:26.1,sourceObservedAt:'2026-11-02T12:38:50.000Z',sourceStoredAt:1793623200000}]}),1793623200000);
  db.prepare('INSERT INTO market_public_snapshots_v1(snapshot_key,body,stored_at) VALUES(?,?,?)').run('composite-observed:2026-11-02',JSON.stringify({version:'COMPOSITE_CALCULATED_SCORES_R1',date:'2026-11-02',points:[{calculatedAt:'2026-11-02T12:45:00.000Z',score:45.5}]}),1793623500000);
  db.close();
 }
 return {root,dataRoot,dbFile,policy:structuredClone(policy),host:{dataRoot,controllerSourceSha:'c'.repeat(40)},queryTask:()=>Buffer.from('\uFEFF'+taskXml,'utf16le'),runId:'123456',seat:1};
}

test('approved read-only diagnosis returns only counts/times, not raw input, and leaves SQLite unchanged',()=>{
 const f=fixture();const before=digest(fs.readFileSync(f.dbFile));
 const result=inspectFearGreedArchive(f.dataRoot,{queryTask:f.queryTask});
 assert.equal(result.status,'PASS');
 assert.equal(result.code,'FEAR_GREED_ARCHIVE_READONLY_DIAGNOSIS');
 assert.equal(result.sqliteOpened,true);
 assert.equal(result.local.original.pointCount,1);
 assert.equal(result.local.checks.pointCount,1);
 assert.equal(result.local.composite.pointCount,1);
 assert.equal(result.local.currentPublic.score,24.8);
 assert.equal(result.task.commandBase,'wscript.exe');
 assert.equal(result.task.referencedScripts.length,1);
 assert.equal(result.task.referencedScripts[0].exists,false);
 assert.equal(result.providerCalls,0);assert.equal(result.d1Writes,0);assert.equal(result.operationalWrites,0);
 assert.equal(digest(fs.readFileSync(f.dbFile)),before);
 assert.doesNotMatch(JSON.stringify(result),/NEVER_EXPOSE_ME/);
});

test('missing database is an explicit scoped blocker, not a synthetic empty history',()=>{
 const f=fixture(false),r=inspectFearGreedArchive(f.dataRoot,{queryTask:f.queryTask});
 assert.equal(r.status,'BLOCKED');assert.equal(r.code,'FEAR_GREED_DB_NOT_FOUND');
 assert.equal(r.sqliteOpened,false);
});

test('host runner executes fixed diagnosis and preserves protected operational state',async()=>{
 const f=fixture(),before=digest(fs.readFileSync(f.dbFile));
 const r=await executeJob(request(),f);
 assert.equal(r.report.status,'PASS');
 assert.equal(r.report.code,'FEAR_GREED_ARCHIVE_READONLY_DIAGNOSIS');
 assert.equal(r.report.protectedStateUnchanged,true);
 assert.equal(r.report.sqliteOpened,true);
 assert.equal(r.report.result.local.checks.pointCount,1);
 assert.equal(r.report.operationalWrites,0);
 assert.equal(digest(fs.readFileSync(f.dbFile)),before);
});

test('sidecar evidence absent remains UNKNOWN even while the read-only query passes',()=>{
 const f=fixture(),r=inspectFearGreedArchive(f.dataRoot,{queryTask:f.queryTask});
 assert.equal(r.status,'PASS');
 assert.equal(r.archiveTrace.sidecar.evidence,'NOT_FOUND');
 assert.equal(r.archiveTrace.alignment.status,'HISTORY_DIVERGENCE');
 assert.equal(r.archiveTrace.alignment.cause,'UNKNOWN');
});

test('sidecar status is sanitized, not mistaken for authenticated process evidence',()=>{
 const f=fixture(),before=digest(fs.readFileSync(f.dbFile));
 const directory=path.join(f.dataRoot,'pc-writer','archive-sidecar-r7');fs.mkdirSync(directory);
 const payload={status:'PASS',code:'ARCHIVE_COMPLETED',lastPass:'WRITE_COMPLETED',firstFail:'NONE',finishedAt:'2026-11-02T12:55:00.000Z',
  token:'SECRET_TOKEN_EXAMPLE',data:{privateInputs:'DO_NOT_DISCLOSE'},reason:'AKIAABCDEFGHIJKLMNOP'};
 fs.writeFileSync(path.join(directory,'archive-last-run.json'),JSON.stringify(payload));
 const r=inspectFearGreedArchive(f.dataRoot,{queryTask:f.queryTask});
 const candidate=r.archiveTrace.sidecar.candidates[0];
 assert.equal(r.archiveTrace.sidecar.evidence,'OBSERVED_UNATTESTED');
 assert.equal(candidate.evidence,'UNATTESTED_LEDGER');
 assert.equal(candidate.reportedStatus,'PASS');
 assert.equal(candidate.reason,null);
 assert.equal(r.archiveTrace.alignment.cause,'UNKNOWN');
 assert.doesNotMatch(JSON.stringify(r),/SECRET_TOKEN_EXAMPLE|DO_NOT_DISCLOSE|AKIAABCDEFGHIJKLMNOP/);
 assert.equal(digest(fs.readFileSync(f.dbFile)),before);
});

test('unrecognized uppercase ledger fields are suppressed even when they match a code-shaped regex',()=>{
 const f=fixture(),directory=path.join(f.dataRoot,'pc-writer','archive-sidecar-r7');fs.mkdirSync(directory);
 const secrets=['AKIAABCDEFGHIJKLMNOP','GH_PAT_SECRET_0123456789','SENSITIVE:UPPERCASE_TOKEN'];
 fs.writeFileSync(path.join(directory,'archive-status.json'),JSON.stringify({
  status:secrets[0],code:secrets[1],reason:secrets[2],lastPass:secrets[0],firstFail:secrets[1],
 }));
 const r=inspectFearGreedArchive(f.dataRoot,{queryTask:f.queryTask});
 const item=r.archiveTrace.sidecar.candidates[0];
 for (const key of ['reportedStatus','code','reason','lastPass','firstFail']) assert.equal(item[key],null);
 for (const secret of secrets) assert.equal(JSON.stringify(r).includes(secret),false);
});

test('blocked sidecar failure exposes only bounded categories, never raw error or secret',()=>{
 const f=fixture(),directory=path.join(f.dataRoot,'pc-writer','archive-sidecar-r7');fs.mkdirSync(directory);
 const secret='GH_PAT_SECRET_0123456789';
 fs.writeFileSync(path.join(directory,'last-run.json'),JSON.stringify({
  status:'BLOCKED',stage:'ARCHIVE_SOURCE_VALIDATION',
  error:{code:'PC_LOCAL_CYCLE_LOCK_BUSY',message:`locked ${secret}`},
  reason:`local cycle lock still busy, auth ${secret}`,
  token:secret,
 }));
 const r=inspectFearGreedArchive(f.dataRoot,{queryTask:f.queryTask});
 const item=r.archiveTrace.sidecar.candidates[0];
 assert.equal(item.reportedStatus,'BLOCKED');
 assert.equal(item.code,null);
 assert.equal(item.failureHints.evidence,'UNATTESTED_CATEGORICAL_HINTS');
 assert.equal(item.failureHints.hasStage,true);
 assert.equal(item.failureHints.hasError,true);
 assert.equal(item.failureHints.hasReason,true);
 assert.deepEqual(item.failureHints.categories,['SOURCE_OR_APPROVAL','LOCK_OR_LEASE']);
 assert.doesNotMatch(JSON.stringify(r),/GH_PAT_SECRET_0123456789|PC_LOCAL_CYCLE_LOCK_BUSY|ARCHIVE_SOURCE_VALIDATION/);
});

test('unknown and extremely long sidecar failure values do not escape the sanitizer',()=>{
 const f=fixture(),directory=path.join(f.dataRoot,'pc-writer','archive-sidecar-r7');fs.mkdirSync(directory);
 fs.writeFileSync(path.join(directory,'last-run.json'),JSON.stringify({
  status:'BLOCKED',reason:'INTERNAL_PRIVATE_FAILURE',message:'SECRET_INPUT_'.repeat(500),
 }));
 const r=inspectFearGreedArchive(f.dataRoot,{queryTask:f.queryTask});
 const hints=r.archiveTrace.sidecar.candidates[0].failureHints;
 assert.deepEqual(hints.categories,['UNCLASSIFIED']);
 assert.equal(hints.hasError,true);
 assert.equal(hints.hasReason,true);
 assert.doesNotMatch(JSON.stringify(r),/SECRET_INPUT_|INTERNAL_PRIVATE_FAILURE/);
});

test('unrecognized sidecar code still yields only a bounded diagnostic category',()=>{
 const f=fixture(),directory=path.join(f.dataRoot,'pc-writer','archive-sidecar-r7');fs.mkdirSync(directory);
 fs.writeFileSync(path.join(directory,'last-run.json'),JSON.stringify({status:'BLOCKED',code:'ARCHIVE_D1_READBACK_BLOCKED'}));
 const item=inspectFearGreedArchive(f.dataRoot,{queryTask:f.queryTask}).archiveTrace.sidecar.candidates[0];
 assert.equal(item.code,null);
 assert.deepEqual(item.failureHints.categories,['PUBLICATION']);
 assert.equal(item.failureHints.hasError,false);
 assert.equal(item.failureHints.hasReason,false);
});

test('corrupt and oversized sidecar ledgers are bounded without leaking content',()=>{
 const f=fixture();
 const directory=path.join(f.dataRoot,'pc-writer','archive-sidecar-r7');fs.mkdirSync(directory);
 fs.writeFileSync(path.join(directory,'archive-status.json'),'{broken:SECRET_TOKEN_EXAMPLE');
 fs.writeFileSync(path.join(directory,'archive-ledger.json'),'x'.repeat(65537));
 const r=inspectFearGreedArchive(f.dataRoot,{queryTask:f.queryTask});
 const candidates=r.archiveTrace.sidecar.candidates;
 assert.equal(candidates.length,2);
 assert.deepEqual(candidates.map(x=>x.evidence).sort(),['INVALID_FILE_TYPE_OR_SIZE','INVALID_LEDGER'].sort());
 assert.doesNotMatch(JSON.stringify(r),/SECRET_TOKEN_EXAMPLE/);
});

test('sidecar directory symlink cannot read outside the dedicated sidecar root',()=>{
 const f=fixture();
 const outside=path.join(f.root,'outside');fs.mkdirSync(outside);
 fs.writeFileSync(path.join(outside,'archive-last-run.json'),JSON.stringify({status:'PASS',token:'DO_NOT_READ'}));
 const directory=path.join(f.dataRoot,'pc-writer','archive-sidecar-r7');
 fs.symlinkSync(outside,directory,'dir');
 const a=inspectFearGreedArchive(f.dataRoot,{queryTask:f.queryTask});
 assert.equal(a.archiveTrace.sidecar.reason,'UNSAFE_SIDECAR_DIRECTORY');
 assert.equal(a.archiveTrace.sidecar.evidence,'UNKNOWN');
 assert.doesNotMatch(JSON.stringify(a),/DO_NOT_READ/);
});

test('individual sidecar ledger symlink is identified as unsafe, not silently reported absent',()=>{
 const f=fixture(),directory=path.join(f.dataRoot,'pc-writer','archive-sidecar-r7');fs.mkdirSync(directory);
 const outside=path.join(f.root,'archive-status-outside.json');
 fs.writeFileSync(outside,JSON.stringify({status:'PASS',reason:'PRIVATE_LEDGER_VALUE'}));
 fs.symlinkSync(outside,path.join(directory,'archive-status.json'));
 const r=inspectFearGreedArchive(f.dataRoot,{queryTask:f.queryTask});
 assert.equal(r.archiveTrace.sidecar.candidates.length,1);
 assert.equal(r.archiveTrace.sidecar.candidates[0].evidence,'INVALID_FILE_TYPE_OR_SIZE');
 assert.doesNotMatch(JSON.stringify(r),/PRIVATE_LEDGER_VALUE/);
});

test('ancestor pc-writer symlink escaping the data root is refused before reading ledger data',()=>{
 const f=fixture(false),base=path.join(f.dataRoot,'pc-writer');
 const outside=path.join(f.root,'relocated-pc-writer');
 fs.renameSync(base,outside);
 fs.mkdirSync(path.join(outside,'archive-sidecar-r7'));
 fs.writeFileSync(path.join(outside,'archive-sidecar-r7','archive-last-run.json'),JSON.stringify({status:'PASS',reason:'PRIVATE_LEDGER_VALUE'}));
 fs.symlinkSync(outside,base,'dir');
 const r=inspectFearGreedArchive(f.dataRoot,{queryTask:f.queryTask});
 assert.equal(r.archiveTrace.sidecar.evidence,'UNKNOWN');
 assert.equal(r.archiveTrace.sidecar.reason,'UNSAFE_REAL_PATH');
 assert.doesNotMatch(JSON.stringify(r),/PRIVATE_LEDGER_VALUE/);
});

test('configuration JSON is not treated as a sidecar execution ledger',()=>{
 const f=fixture(),directory=path.join(f.dataRoot,'pc-writer','archive-sidecar-r7');fs.mkdirSync(directory);
 fs.writeFileSync(path.join(directory,'archive-config.json'),JSON.stringify({status:'PASS',token:'PRIVATE_CONFIG'}));
 const r=inspectFearGreedArchive(f.dataRoot,{queryTask:f.queryTask});
 assert.equal(r.archiveTrace.sidecar.evidence,'NOT_FOUND');
 assert.equal(r.archiveTrace.sidecar.reason,'LEDGER_NOT_FOUND');
 assert.doesNotMatch(JSON.stringify(r),/PRIVATE_CONFIG/);
});

test('approved unchanged and below-cadence reasons stay observations, not root-cause PASS',()=>{
 const f=fixture(),directory=path.join(f.dataRoot,'pc-writer','archive-sidecar-r7');fs.mkdirSync(directory);
 fs.writeFileSync(path.join(directory,'archive-status.json'),JSON.stringify({status:'UNCHANGED',reason:'UNCHANGED_SOURCE_OBSERVATION'}));
 fs.writeFileSync(path.join(directory,'archive-result.json'),JSON.stringify({status:'UNCHANGED',reason:'BELOW_APPROVED_15M_CADENCE'}));
 const r=inspectFearGreedArchive(f.dataRoot,{queryTask:f.queryTask});
 assert.equal(r.archiveTrace.sidecar.candidates.length,2);
 assert.deepEqual(r.archiveTrace.sidecar.candidates.map(x=>x.reason).sort(),['BELOW_APPROVED_15M_CADENCE','UNCHANGED_SOURCE_OBSERVATION']);
 assert.equal(r.archiveTrace.alignment.cause,'UNKNOWN');
});

test('existing global publication ledger is sanitized and never equated to archive publication',()=>{
 const f=fixture(),file=path.join(f.dataRoot,'pc-writer','local-publication-ledger.json');
 fs.writeFileSync(file,JSON.stringify({status:'VERIFIED',at:1793623200000,source:'a'.repeat(40),apiToken:'SECRET_TOKEN_EXAMPLE'}));
 const r=inspectFearGreedArchive(f.dataRoot,{queryTask:f.queryTask});
 assert.equal(r.archiveTrace.publicationLedger.evidence,'UNATTESTED_LEDGER');
 assert.equal(r.archiveTrace.publicationLedger.reportedStatus,'VERIFIED');
 assert.equal(r.archiveTrace.publicationLedger.scope,'GLOBAL_PUBLICATION_ONLY');
 assert.equal(r.archiveTrace.sidecar.evidence,'NOT_FOUND');
 assert.doesNotMatch(JSON.stringify(r),/SECRET_TOKEN_EXAMPLE/);
});

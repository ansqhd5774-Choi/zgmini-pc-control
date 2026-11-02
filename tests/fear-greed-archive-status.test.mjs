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

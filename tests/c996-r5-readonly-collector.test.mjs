import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {allowedLogName,eventCode,logTimestamp,classification,TARGET_HOST,statNoLink} from '../c996-r5-readonly/collector.mjs';
test('exact target PC is pinned',()=>assert.equal(TARGET_HOST,'DESKTOP-N62L0NG'));
test('known DISM log basenames are accepted',()=>{
  assert.equal(allowedLogName('COMMIT_NEW_WIM.dism.log'),true);
  assert.equal(allowedLogName('MOUNT_NEW_WIM.dism.log'),true);
  assert.equal(allowedLogName('dism.log'),true);
});
test('dangerous or unrelated names rejected',()=>{
 for(const x of ['..\\secrets.dism.log','../secrets.dism.log','secrets.txt','.env','test.bat','private.log','x.dism.log/abc','C:\\x.dism.log']) assert.equal(allowedLogName(x),false,x);
});
test('commit event without leaking line',()=>assert.equal(eventCode('[12/12/2026 14:22:11] dism.exe /Unmount-Image /Commit /MountDir:C:\\private'),'COMMIT_REQUEST'));
test('mount event',()=>assert.equal(eventCode('DismMountImage index 1'), 'MOUNT_REQUEST'));
test('metadata mention',()=>assert.equal(eventCode('Processing image metadata'), 'METADATA_MENTION'));
test('error mention',()=>assert.equal(eventCode('Error: 5'), 'ERROR_MENTION'));
test('normal unrelated log lines not included',()=>assert.equal(eventCode('User account appears in this diagnostic'),null));
test('timestamps are limited to brackets',()=>{
 assert.equal(logTimestamp('[11/12/2026 08:05:22] blah'),'11/12/2026 08:05:22');
 assert.equal(logTimestamp('secret 11/12/2026 08:05:22'),null);
});
test('commit log absent never implies full validation',()=>assert.equal(classification([],[]),'COMMIT_LOG_NOT_ESTABLISHED'));
test('identified commit log still does not claim drift stage known',()=>assert.equal(classification([], [{name:'COMMIT_NEW_WIM.dism.log',counts:{}}]),'LOGS_PRESENT_STAGE_UNPROVEN'));

test('unchanged no-follow lstat path traversal emits bounded progress markers',()=>{
 const steps=[];
 const st=statNoLink(fileURLToPath(import.meta.url),(operation,depth)=>steps.push({operation,depth}));
 assert.equal(st.isFile(),true);
 assert.deepEqual(steps[0],{operation:'PATH_LSTAT',depth:0});
 assert.deepEqual(steps.at(-1),{operation:'LEAF_RECHECK',depth:0});
 assert.ok(steps.some(x=>x.operation==='PATH_LSTAT'&&x.depth>=1));
 assert.ok(steps.every(x=>Number.isSafeInteger(x.depth)&&x.depth>=0&&x.depth<=24));
});

// CI ONLY: exact selective candidate, no production changes; fixture and test copied from merged #3104.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {inspectSidecarSourceGate} from '../controller/fear-greed-archive-readonly.mjs';
const policy=JSON.parse(fs.readFileSync(new URL('../config/operations.json',import.meta.url)));
const digest=x=>createHash('sha256').update(x).digest('hex');
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

test('fixed R10 child source can localize an exact reason without leaking source or modifying SQLite',()=>{
 const f=fixture(),dir=path.join(f.dataRoot,'pc-writer','archive-sidecar-r7');fs.mkdirSync(dir);
 const scripts={
  'archive-run.mjs':'const run=true;\n',
  'run-original-then-archive.vbs':'WScript.Echo "archive-run.mjs"\n',
  'archive-core-r10.mjs':"const approvedSourceSha=config.source;\nthrow Error('SOURCE_SHA_GATE_PRIVATE');\n",
  'verified-checks-r10.mjs':'const check=true;\n',
 };
 const past=new Date(Date.now()-30000);
 for(const [name,body] of Object.entries(scripts)){
  fs.writeFileSync(path.join(dir,name),body);
  fs.utimesSync(path.join(dir,name),past,past);
 }
 fs.writeFileSync(path.join(dir,'last-run.json'),JSON.stringify({status:'BLOCKED',reason:'SOURCE_SHA_GATE_PRIVATE'}));
 const before=digest(fs.readFileSync(f.dbFile));
 const expectedHashes=Object.fromEntries(Object.entries(scripts).map(([name,body])=>[name,digest(body)]));
 const good=inspectSidecarSourceGate(f.dataRoot,{expectedHashes});
 assert.deepEqual(good.scriptStatus.map(x=>x.status),['MATCH','MATCH','MATCH','MATCH']);
 assert.equal(good.matchingErrorSite,'UNIQUE');
 assert.equal(good.matchedScript,'archive-core-r10.mjs');
 assert.equal(good.siteLine,2);
 assert.deepEqual(good.matchedGateCategories,['SOURCE_APPROVAL_REFERENCE']);
 assert.doesNotMatch(JSON.stringify(good),/SOURCE_SHA_GATE_PRIVATE|config\.source/);
 const changed=inspectSidecarSourceGate(f.dataRoot,{expectedHashes:{...expectedHashes,'verified-checks-r10.mjs':digest('other')}});
 assert.equal(changed.matchingErrorSite,'NOT_CHECKED');
 assert.deepEqual(changed.matchedGateCategories,[]);
 assert.equal(digest(fs.readFileSync(f.dbFile)),before);
 assert.equal(good.operationalWrites,0);
 assert.equal(good.d1Writes,0);
 assert.equal(good.providerCalls,0);
});

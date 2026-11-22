import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {inspectFearGreedArchive,inspectCompositeWriterCheckpoint}
 from '../controller/fear-greed-archive-readonly.mjs';

const sha=x=>createHash('sha256').update(x).digest('hex');
function fixture(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'w06-composite-evidence-'));
 const dataRoot=path.join(root,'data'), writer=path.join(dataRoot,'pc-writer');
 fs.mkdirSync(path.join(writer,'storage'),{recursive:true});
 const file=path.join(writer,'storage','core.sqlite');
 const db=new DatabaseSync(file);
 db.exec('CREATE TABLE public_feed_snapshots_v1(kind TEXT,feed_key TEXT,snapshot_key TEXT,body TEXT,stored_at INTEGER)');
 db.exec('CREATE TABLE market_public_snapshots_v1(snapshot_key TEXT PRIMARY KEY,body TEXT,stored_at INTEGER)');
 db.prepare('INSERT INTO public_feed_snapshots_v1 VALUES (?,?,?,?,?)').run(
  'output','fear-greed','current',JSON.stringify({status:'verified',score:9.7}),1795340000000);
 const current=JSON.stringify({score:45.1373,secret:'DO_NOT_LEAK_FORMULA'});
 const archive=JSON.stringify({version:'COMPOSITE_CALCULATED_SCORES_R1',date:'2026-11-22',
  points:[{calculatedAt:'2026-11-22T00:00:50.969Z',score:45.1373}]});
 db.prepare('INSERT INTO market_public_snapshots_v1 VALUES (?,?,?)').run('current',current,1795305650969);
 db.prepare('INSERT INTO market_public_snapshots_v1 VALUES (?,?,?)').run('composite-observed:2026-11-22',archive,1795305650969);
 db.close();
 return {root,dataRoot,writer,file,current,archive,close:()=>fs.rmSync(root,{recursive:true,force:true})};
}
const taskXml='<Task><Actions><Exec><Command>C:\\Windows\\System32\\wscript.exe</Command><Arguments>E:\\ZGmini\\data\\pc-writer\\run-local-core.vbs</Arguments></Exec></Actions></Task>';
const queryTask=()=>Buffer.from('\uFEFF'+taskXml,'utf16le');

test('sanitized W06 checkpoint and fixed two-key hashes are read-only',()=>{
 const f=fixture();try{
  const before=sha(fs.readFileSync(f.file));
  fs.writeFileSync(path.join(f.writer,'local-writer-last-run.json'),JSON.stringify({
   at:'2026-11-22T11:59:54.050Z',mode:'PUBLISH',status:'VERIFIED',source:'a'.repeat(40),
   market:{status:'VERIFIED',credentials:'DO_NOT_LEAK_PROVIDER'},
   compositeObserved:{status:'UNCHANGED',points:1,secret:'DO_NOT_LEAK_INPUT'},
   compositeObservedPublication:{status:'VERIFIED',storedDays:21,publishedDays:0,deferredDays:0,
    token:'DO_NOT_LEAK_TOKEN'},
   failures:[{id:'composite-observed-publication',reason:'DO_NOT_LEAK_REASON'},
    {id:'unrelated',reason:'DO_NOT_LEAK_OTHER'}],
  }));
  const result=inspectFearGreedArchive(f.dataRoot,{queryTask});
  assert.equal(result.status,'PASS');
  assert.equal(result.sqliteOpened,true);
  assert.equal(result.writerComposite.state,'READ');
  assert.equal(result.writerComposite.at,'2026-11-22T11:59:54.050Z');
  assert.equal(result.writerComposite.mode,'PUBLISH');
  assert.equal(result.writerComposite.compositeArchiveLocal.status,'UNCHANGED');
  assert.equal(result.writerComposite.compositeArchiveLocal.points,1);
  assert.equal(result.writerComposite.compositePublication.status,'VERIFIED');
  assert.deepEqual(result.writerComposite.failedStages,['composite-observed-publication']);
  assert.equal(result.writerComposite.d1PerKeyReadback,'NOT_VERIFIED');
  assert.equal(result.local.localCompositeKeys.current.bodySha256,sha(f.current));
  assert.equal(result.local.localCompositeKeys.latestArchiveKey,'composite-observed:2026-11-22');
  assert.equal(result.local.localCompositeKeys.latestArchive.bodySha256,sha(f.archive));
  assert.equal(result.local.localCompositeKeys.current.storedAt,1795305650969);
  assert.equal(sha(fs.readFileSync(f.file)),before);
  assert.doesNotMatch(JSON.stringify(result),/DO_NOT_LEAK/);
 }finally{f.close();}
});

test('missing and forged Writer status cannot be reported as verified D1',()=>{
 const f=fixture();try{
  assert.equal(inspectCompositeWriterCheckpoint(f.dataRoot).state,'MISSING');
  fs.writeFileSync(path.join(f.writer,'local-writer-last-run.json'),JSON.stringify({
   at:'INVALID',mode:'REMOTE',status:'AKIAABCDEFGHIJKLMNOP',
   compositeObserved:{status:'SECRET',points:-9},
   compositeObservedPublication:{status:'PENDING_VERIFIED_MARKET',publishedDays:-1},
   failures:[{id:'other-secret',reason:'LEAK_THIS'}],
  }));
  const x=inspectCompositeWriterCheckpoint(f.dataRoot);
  assert.equal(x.at,null);assert.equal(x.mode,null);
  assert.equal(x.writerStatus,null);
  assert.equal(x.compositeArchiveLocal.status,null);
  assert.equal(x.compositeArchiveLocal.points,null);
  assert.equal(x.compositePublication.status,'PENDING_VERIFIED_MARKET');
  assert.equal(x.compositePublication.publishedDays,null);
  assert.deepEqual(x.failedStages,[]);
  assert.equal(x.d1PerKeyReadback,'NOT_VERIFIED');
  assert.doesNotMatch(JSON.stringify(x),/AKIA|LEAK_THIS|SECRET/);
 }finally{f.close();}
});

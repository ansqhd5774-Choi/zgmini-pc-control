import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {openSqliteReadonly} from '../controller/common.mjs';
function fixture(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-read-contract-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const file=path.join(dir,'test.sqlite'),writer=new DatabaseSync(file);
 writer.exec('PRAGMA journal_mode=WAL; CREATE TABLE sample(id INTEGER PRIMARY KEY,value INTEGER); INSERT INTO sample VALUES(1,10)');
 return {file,writer};
}
test('native read transaction sees WAL data and keeps one snapshot across concurrent commits',t=>{
 const {file,writer}=fixture(t),reader=openSqliteReadonly(file);
 try{
  assert.equal(reader.prepare('SELECT value FROM sample').get().value,10);
  writer.exec('UPDATE sample SET value=20');
  assert.equal(reader.prepare('SELECT value FROM sample').get().value,10);
  assert.equal(writer.prepare('SELECT value FROM sample').get().value,20);
 }finally{reader.close();writer.close();}
});
test('read-only/query-only deny DML and schema changes even if query_only is disabled',t=>{
 const {file,writer}=fixture(t),reader=openSqliteReadonly(file);
 try{
  for(const sql of ['INSERT INTO sample VALUES(2,99)','UPDATE sample SET value=99','DELETE FROM sample','DROP TABLE sample'])
   assert.throws(()=>reader.exec(sql),/readonly|read-only/i);
  reader.exec('PRAGMA query_only=OFF');
  assert.throws(()=>reader.exec('UPDATE sample SET value=99'),/readonly|read-only/i);
  assert.equal(writer.prepare('SELECT value FROM sample').get().value,10);
 }finally{reader.close();writer.close();}
});
test('clean WAL database without sidecars is readable without immutable mode',t=>{
 const {file,writer}=fixture(t);writer.close();
 assert.equal(fs.existsSync(file+'-wal'),false);
 const reader=openSqliteReadonly(file);
 try{assert.equal(reader.prepare('SELECT value FROM sample').get().value,10);}
 finally{reader.close();}
});
test('missing coordination index can be rebuilt by SQLite without business data writes',t=>{
 const {file,writer}=fixture(t);writer.close();
 // Preserve a valid WAL frame set from a completed fixture connection. The
 // disposable copy has no other process and deliberately has no shared index.
 const w=new DatabaseSync(file);w.exec('UPDATE sample SET value=30');
 const copy=path.join(path.dirname(file),'copy.sqlite');
 fs.copyFileSync(file,copy);fs.copyFileSync(file+'-wal',copy+'-wal');w.close();
 assert.equal(fs.existsSync(copy+'-shm'),false);
 const reader=openSqliteReadonly(copy);
 try{assert.equal(reader.prepare('SELECT value FROM sample').get().value,30);}
 finally{reader.close();}
});
test('an active exclusive writer is a bounded SQLite busy result, not permission to disable locking',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-read-busy-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const file=path.join(dir,'test.sqlite'),writer=new DatabaseSync(file);
 writer.exec('CREATE TABLE sample(id INTEGER); BEGIN EXCLUSIVE; INSERT INTO sample VALUES(1)');
 let reader;try{
  reader=openSqliteReadonly(file,{timeout:10});
  assert.throws(()=>reader.prepare('SELECT * FROM sample').all(),/locked|busy/i);
 }finally{reader?.close();writer.exec('ROLLBACK');writer.close();}
});
test('a residual shared index without WAL is handled by native SQLite, not rejected by filename state',t=>{
 const {file,writer}=fixture(t),index=fs.readFileSync(file+'-shm');writer.close();
 fs.writeFileSync(file+'-shm',index);assert.equal(fs.existsSync(file+'-wal'),false);
 const reader=openSqliteReadonly(file);
 try{assert.equal(reader.prepare('SELECT value FROM sample').get().value,10);}
 finally{reader.close();}
});

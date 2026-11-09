import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {archiveAndFinalizeExactLock} from './recovery-1063-lock.mjs';
import {INCIDENT_ID} from './recovery-1063-core.mjs';

function fixture(t,owner=INCIDENT_ID){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-1063-lock-test-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const journal=path.join(root,'journal');fs.mkdirSync(journal);
 const lock=path.join(root,'writer-source-install.lock');
 fs.writeFileSync(lock,owner);
 return {lock,journal};
}
test('archives exact original byte-owner before removing just that lock leaf',t=>{
 const x=fixture(t);const result=archiveAndFinalizeExactLock(x);
 assert.deepEqual(result,{archived:true,lockFinalized:true});
 assert.equal(fs.existsSync(x.lock),false);
 assert.equal(fs.readFileSync(path.join(x.journal,
  'recovery-1063-exact-owner-lock.original'),'utf8'),INCIDENT_ID);
});
test('wrong owner remains untouched',t=>{
 const x=fixture(t,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
 assert.throws(()=>archiveAndFinalizeExactLock(x),
  {code:'WRITER_B_1063_LOCK_CHANGED'});
 assert.equal(fs.existsSync(x.lock),true);
 assert.equal(fs.readdirSync(x.journal).length,0);
});
test('existing archive collision retains live lock',t=>{
 const x=fixture(t);
 fs.writeFileSync(path.join(x.journal,
  'recovery-1063-exact-owner-lock.original'),INCIDENT_ID);
 assert.throws(()=>archiveAndFinalizeExactLock(x),{code:'EEXIST'});
 assert.equal(fs.readFileSync(x.lock,'utf8'),INCIDENT_ID);
});
test('archive readback failure retains live lock',t=>{
 const x=fixture(t);
 const io={...fs,realpathSync:fs.realpathSync,
  copyFileSync:(src,dest,flags)=>{
   fs.copyFileSync(src,dest,flags);fs.writeFileSync(dest,'NOT_ORIGINAL');
  }};
 assert.throws(()=>archiveAndFinalizeExactLock({...x,io}),
  {code:'WRITER_B_1063_LOCK_ARCHIVE_READBACK_FAILED'});
 assert.equal(fs.readFileSync(x.lock,'utf8'),INCIDENT_ID);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {applyR54BPinnedSixConnectorLast,fetchR54BPinnedCandidateBytes}
 from '../tools/update.mjs';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const names=['scripts/pc-writer/theme-nine-r54-public-connect.mjs',
 'scripts/pc-writer/one.mjs','scripts/pc-writer/two.mjs',
 'scripts/pc-writer/three.mjs','scripts/pc-writer/four.mjs',
 'worker/five.mjs'];

function fixture(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'r54-one-shot-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const installedRoot=path.join(dir,'writer'),backupRoot=path.join(dir,'backup');
 fs.mkdirSync(installedRoot);
 const bytes=new Map(),files=names.map((rel,i)=>{
  const old=Buffer.from(`old-${i}`),next=Buffer.from(`next-${i}`);
  const target=path.join(installedRoot,...rel.split('/'));
  fs.mkdirSync(path.dirname(target),{recursive:true});
  fs.writeFileSync(target,old);bytes.set(rel,next);
  return {path:rel,old:sha(old),next:sha(next)};
 });
 const connector=path.join(installedRoot,...names[0].split('/'));
 return {installedRoot,backupRoot,bytes,files,connector,
  requestId:'pc-r54-sixfile-verified-001',
  rows:()=>files.map(x=>({path:x.path,
   actual:fs.existsSync(path.join(installedRoot,...x.path.split('/')))
    ?sha(fs.readFileSync(path.join(installedRoot,...x.path.split('/')))):null}))};
}

test('six pinned candidate blobs reject even one wrong SHA before any PC write',()=>{
 assert.throws(()=>fetchR54BPinnedCandidateBytes({readRemote:()=>Buffer.from('wrong')}),
  /R54_B_CANDIDATE_SOURCE_SHA_DRIFT/);
});

test('connector is absent during all five support swaps, then installed last',async t=>{
 const f=fixture(t);let visits=0;
 const result=await applyR54BPinnedSixConnectorLast({...f,
  candidateBytes:f.bytes,verifyWindow:async()=>{
   visits++;
   if(visits>1)assert.equal(fs.existsSync(f.connector),false);
   return true;
  }});
 assert.equal(result.status,'SIX_FILE_SOURCE_APPLIED_SHA_VERIFIED');
 assert.ok(visits>=7);
 assert.deepEqual(f.rows().map(x=>x.actual),f.files.map(x=>x.next));
 assert.equal(fs.readFileSync(path.join(f.backupRoot,'JOURNAL.jsonl'),'utf8')
  .includes('SUCCEEDED'),true);
});

test('collision during swap returns six originals with connector restored last',async t=>{
 const f=fixture(t);let visits=0;
 await assert.rejects(applyR54BPinnedSixConnectorLast({...f,
  candidateBytes:f.bytes,verifyWindow:async()=>++visits<4}),
  /R54_B_SOURCE_COLLISION_DURING_SWAP/);
 assert.deepEqual(f.rows().map(x=>x.actual),f.files.map(x=>x.old));
 assert.match(fs.readFileSync(path.join(f.backupRoot,'JOURNAL.jsonl'),'utf8'),
  /ROLLED_BACK_VERIFIED/);
});

test('unrecognized concurrent bytes hold connector closed and require recovery',async t=>{
 const f=fixture(t);let visits=0;
 await assert.rejects(applyR54BPinnedSixConnectorLast({...f,
  candidateBytes:f.bytes,verifyWindow:async()=>{
   visits++;
   if(visits===4){
    fs.writeFileSync(path.join(f.installedRoot,'scripts','pc-writer','one.mjs'),
     'outside-change');
   }
   return true;
  }}),/R54_B_MIXED_SOURCE_RECOVERY_REQUIRED/);
 assert.equal(fs.existsSync(f.connector),false);
 assert.match(fs.readFileSync(path.join(f.backupRoot,'JOURNAL.jsonl'),'utf8'),
  /RECOVERY_REQUIRED/);
});

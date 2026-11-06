import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {readFixedReadonlyBytes} from '../controller/fixed-readonly-bytes.mjs';

function fixture(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fixed-readonly-'));
 const allowed=path.join(dir,'allowed'),outside=path.join(dir,'outside');
 fs.mkdirSync(allowed);fs.mkdirSync(outside);
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const file=path.join(allowed,'snapshot.json');
 const read=(override={})=>readFixedReadonlyBytes(file,{
  verifiedRoot:allowed,maxBytes:2048,...override
 });
 return {dir,allowed,outside,file,read};
}
test('fixed bounded file returns only exact bytes without writing',t=>{
 const f=fixture(t),value='{"source":"KNOWN"}';
 fs.writeFileSync(f.file,value);
 const before=fs.statSync(f.file);
 const result=f.read();
 assert.equal(result.ok,true);
 assert.equal(result.bytes.toString('utf8'),value);
 const after=fs.statSync(f.file);
 assert.equal(before.size,after.size);
 assert.equal(before.mtimeMs,after.mtimeMs);
});
test('missing, empty, oversized, symlink and root escapes cannot be read',t=>{
 const f=fixture(t);
 assert.deepEqual(f.read(),{ok:false,reason:'MISSING'});
 fs.writeFileSync(f.file,'');
 assert.equal(f.read().reason,'SIZE_INVALID');
 fs.writeFileSync(f.file,'x'.repeat(2049));
 assert.equal(f.read().reason,'SIZE_INVALID');
 fs.unlinkSync(f.file);
 const privateFile=path.join(f.outside,'private.json');
 fs.writeFileSync(privateFile,'PRIVATE_CREDENTIAL_DO_NOT_LEAK');
 try{fs.symlinkSync(privateFile,f.file);}
 catch(error){
  if(process.platform==='win32'&&['EPERM','EACCES'].includes(error.code))return;
  throw error;
 }
 const symlink=f.read();
 assert.deepEqual(symlink,{ok:false,reason:'UNSAFE_FILE'});
 assert.doesNotMatch(JSON.stringify(symlink),/PRIVATE_CREDENTIAL/);
 fs.unlinkSync(f.file);
 assert.deepEqual(readFixedReadonlyBytes(privateFile,{
  verifiedRoot:f.allowed,maxBytes:2048}),{ok:false,reason:'UNSAFE_FILE'});
 assert.equal(readFixedReadonlyBytes('relative.json',{
  verifiedRoot:f.allowed,maxBytes:2048}).reason,'UNSAFE_FILE');
});
test('rejects short read and changed inode before exposing bytes',t=>{
 const f=fixture(t);fs.writeFileSync(f.file,'{"safe":true}');
 const truncated={...fs,readSync:()=>0};
 assert.deepEqual(f.read({fileSystem:truncated}),{ok:false,reason:'SHORT_READ'});
 const swapped={...fs,fstatSync:fd=>{
  const s=fs.fstatSync(fd);
  return Object.assign(Object.create(s),{ino:Number(s.ino)+1});
 }};
 assert.deepEqual(f.read({fileSystem:swapped}),{ok:false,reason:'CHANGED_DURING_READ'});
});
test('rejects mutation detected after the file was read',t=>{
 const f=fixture(t);fs.writeFileSync(f.file,'{"safe":true}');
 let calls=0;
 const changed={...fs,fstatSync:fd=>{
  const s=fs.fstatSync(fd);
  calls++;
  return calls===1?s:Object.assign(Object.create(s),{size:s.size+1});
 }};
 assert.deepEqual(f.read({fileSystem:changed}),{ok:false,reason:'CHANGED_DURING_READ'});
});
test('opened handle with invalid size retains the original size error classification',t=>{
 const f=fixture(t);fs.writeFileSync(f.file,'{"safe":true}');
 const oversized={...fs,fstatSync:fd=>{
  const s=fs.fstatSync(fd);
  return Object.assign(Object.create(s),{size:2049});
 }};
 assert.deepEqual(f.read({fileSystem:oversized}),{ok:false,reason:'SIZE_INVALID'});
 const empty={...fs,fstatSync:fd=>{
  const s=fs.fstatSync(fd);
  return Object.assign(Object.create(s),{size:0});
 }};
 assert.deepEqual(f.read({fileSystem:empty}),{ok:false,reason:'SIZE_INVALID'});
});
test('malformed options and forced I/O errors fail without source leakage',t=>{
 const f=fixture(t);fs.writeFileSync(f.file,'PRIVATE_VALUE');
 assert.equal(f.read({maxBytes:0}).reason,'UNSAFE_FILE');
 assert.equal(f.read({verifiedRoot:null}).reason,'UNSAFE_FILE');
 const inaccessible={...fs,openSync:()=>{const err=Error('access denied');err.code='EACCES';throw err;}};
 const out=f.read({fileSystem:inaccessible});
 assert.deepEqual(out,{ok:false,reason:'UNREADABLE'});
 assert.doesNotMatch(JSON.stringify(out),/PRIVATE_VALUE/);
});


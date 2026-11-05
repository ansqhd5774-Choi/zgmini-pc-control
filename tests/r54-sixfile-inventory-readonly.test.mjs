import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {inspectR54SixFileInventory,R54_SIX_SOURCE_PATHS} from
 '../controller/r54-sixfile-inventory-readonly.mjs';

function fixture(t){
 const outer=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-r54-sixfile-'));
 t.after(()=>fs.rmSync(outer,{recursive:true,force:true}));
 const dataRoot=path.join(outer,'data');
 const writerRoot=path.join(dataRoot,'pc-writer','theme-nine-r54');
 fs.mkdirSync(writerRoot,{recursive:true});
 return {outer,dataRoot,writerRoot};
}
function seedSix(writerRoot){
 return R54_SIX_SOURCE_PATHS.map((rel,index)=>{
  const file=path.join(writerRoot,...rel.split('/'));
  const bytes=Buffer.from(`fixture R54 file ${index}\n`);
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file,bytes);
  return {file,bytes,rel};
 });
}

test('all six fixed files return raw SHA-256 without changes or secrets',t=>{
 const {dataRoot,writerRoot}=fixture(t),seeded=seedSix(writerRoot);
 const pre=seeded.map(x=>fs.statSync(x.file).mtimeMs);
 const result=inspectR54SixFileInventory(dataRoot);
 assert.equal(result.status,'PASS');
 assert.equal(result.code,'R54_SIXFILE_INVENTORY_COMPLETE');
 assert.equal(result.presentCount,6);
 assert.equal(result.missingCount,0);
 assert.equal(result.inventoryComplete,true);
 assert.equal(result.runtimeTaskBindingVerified,false);
 assert.equal(result.approvedForInstallation,false);
 assert.deepEqual(result.files.map(x=>x.path),R54_SIX_SOURCE_PATHS);
 assert.deepEqual(result.files.map(x=>x.sha256),seeded.map(x=>
  createHash('sha256').update(x.bytes).digest('hex')));
 assert.deepEqual(seeded.map(x=>fs.statSync(x.file).mtimeMs),pre);
 assert.equal(result.providerCalls+result.d1Writes+result.operationalWrites,0);
 assert.equal(result.sqliteOpened,false);
 assert.equal(result.transientELogsWritten,0);
});

test('missing is reported as MISSING with null hash, never zero hash',t=>{
 const {dataRoot,writerRoot}=fixture(t),files=seedSix(writerRoot);
 fs.unlinkSync(files[2].file);
 const result=inspectR54SixFileInventory(dataRoot);
 assert.equal(result.status,'PASS');
 assert.equal(result.code,'R54_SIXFILE_INVENTORY_MISSING');
 assert.equal(result.presentCount,5);
 assert.equal(result.missingCount,1);
 assert.equal(result.files[2].state,'MISSING');
 assert.equal(result.files[2].sha256,null);
 assert.equal(result.files[2].bytes,null);
 assert.equal(result.inventoryComplete,false);
});

test('file symlink escape is blocked, never hashes outside file',t=>{
 const {outer,dataRoot,writerRoot}=fixture(t),files=seedSix(writerRoot);
 const outside=path.join(outer,'secret.env');
 fs.writeFileSync(outside,'SECRET_SHOULD_NOT_BE_READ');
 fs.unlinkSync(files[0].file);
 fs.symlinkSync(outside,files[0].file);
 const result=inspectR54SixFileInventory(dataRoot);
 assert.equal(result.status,'BLOCKED');
 assert.equal(result.rejectedCount,1);
 assert.equal(result.files[0].state,'REDIRECT_REJECTED');
 assert.equal(result.files[0].sha256,null);
 assert.equal(fs.readFileSync(outside,'utf8'),'SECRET_SHOULD_NOT_BE_READ');
});

test('directory symlink escape is blocked even when one file resides there',t=>{
 const {outer,dataRoot,writerRoot}=fixture(t),files=seedSix(writerRoot);
 const external=path.join(outer,'escape');
 fs.mkdirSync(external);
 fs.renameSync(files[5].file,path.join(external,path.basename(files[5].file)));
 fs.rmdirSync(path.join(writerRoot,'worker'));
 fs.symlinkSync(external,path.join(writerRoot,'worker'),'dir');
 const result=inspectR54SixFileInventory(dataRoot);
 assert.equal(result.status,'BLOCKED');
 assert.equal(result.files[5].state,'REDIRECT_REJECTED');
 assert.equal(result.files[5].sha256,null);
});

test('root redirect or missing drive does not masquerade as missing six files',t=>{
 const {outer,dataRoot}=fixture(t);
 const alias=path.join(outer,'alias');
 fs.symlinkSync(dataRoot,alias,'dir');
 const redirect=inspectR54SixFileInventory(alias);
 assert.equal(redirect.status,'BLOCKED');
 assert.equal(redirect.code,'R54_DATA_ROOT_UNAVAILABLE');
 assert.ok(redirect.files.every(x=>x.state==='UNKNOWN_ROOT'&&x.sha256===null));
 const absent=inspectR54SixFileInventory(path.join(outer,'not-mounted'));
 assert.equal(absent.status,'BLOCKED');
 assert.equal(absent.missingCount,0);
 assert.ok(absent.files.every(x=>x.state==='UNKNOWN_ROOT'));
});

test('oversized file is blocked and not read into memory',t=>{
 const {dataRoot,writerRoot}=fixture(t),files=seedSix(writerRoot);
 fs.writeFileSync(files[1].file,Buffer.alloc(4_000_001,1));
 const result=inspectR54SixFileInventory(dataRoot);
 assert.equal(result.status,'BLOCKED');
 assert.equal(result.files[1].state,'INVALID_SIZE');
 assert.equal(result.files[1].sha256,null);
});

test('path and source list are fixed; no caller-supplied file list is used',t=>{
 const {outer,dataRoot,writerRoot}=fixture(t);
 seedSix(writerRoot);
 const secret=path.join(outer,'secret.env');
 fs.writeFileSync(secret,'DO_NOT_READ');
 const result=inspectR54SixFileInventory(dataRoot,{files:['../../secret.env'],
  commands:['type ../../secret.env']});
 assert.equal(result.files.length,6);
 assert.equal(result.status,'PASS');
 assert.equal(result.files.some(x=>x.path.includes('secret')),false);
 assert.equal(result.providerCalls,0);
});

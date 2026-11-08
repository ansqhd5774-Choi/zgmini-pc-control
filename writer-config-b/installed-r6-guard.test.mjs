import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {verifyInstalledR6} from './installed-r6-guard.mjs';
import {sha256} from './contract.mjs';
import {EMPLOYMENT_R6_PREIMAGE_FILES} from '../controller/writer-install-preimage-readonly.mjs';

const installed='d'.repeat(40);
function fixture(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'r6-install-proof-'));
 const files=EMPLOYMENT_R6_PREIMAGE_FILES.map((relative,index)=>{
  const filename=path.join(root,...relative.split('/'));
  fs.mkdirSync(path.dirname(filename),{recursive:true});
  const bytes=Buffer.from('export const marker='+index+';\n');
  fs.writeFileSync(filename,bytes);
  return {path:relative,afterSha256:sha256(bytes)};
 });
 const manifest={verifiedR6Install:{status:'WRITER_B_INSTALLED_VERIFIED',
  sourceSha:installed},installedFiles:files};
 const config=Buffer.from(JSON.stringify({source:installed})+'\n');
 const options={sourceRoot:root,gitHead:()=>installed};
 return {root,manifest,config,options,close(){fs.rmSync(root,{recursive:true,force:true});}};
}
test('19 fixed postimages and installed checkout/config source must agree',()=>{
 const f=fixture();
 try{assert.deepEqual(verifyInstalledR6(f.manifest,f.config,f.options),{
   verifiedFiles:19,sourceSha:installed});}
 finally{f.close();}
});
test('a different Git source or config source rejects activation',()=>{
 const f=fixture();
 try{
  assert.throws(()=>verifyInstalledR6(f.manifest,f.config,{...f.options,
   gitHead:()=>('a'.repeat(40))}),/CONFIG_B_SOURCE_HEAD_MISMATCH_STOP/);
  assert.throws(()=>verifyInstalledR6(f.manifest,Buffer.from('{"source":"'+('a'.repeat(40))+'"}'),
   f.options),/CONFIG_B_CONFIG_SOURCE_MISMATCH_STOP/);
 }finally{f.close();}
});
test('changed/missing/symlink postimage rejects activation even with matching HEAD',()=>{
 const f=fixture();
 try{
  const filename=path.join(f.root,...f.manifest.installedFiles[0].path.split('/'));
  fs.writeFileSync(filename,'export const changed=true;\n');
  assert.throws(()=>verifyInstalledR6(f.manifest,f.config,f.options),
   /CONFIG_B_R6_POSTIMAGE_MISMATCH_STOP/);
  fs.unlinkSync(filename);
  assert.throws(()=>verifyInstalledR6(f.manifest,f.config,f.options),
   /CONFIG_B_R6_POSTIMAGE_MISMATCH_STOP/);
 }finally{f.close();}
});

import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {execFileSync} from 'node:child_process';import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const repo=fileURLToPath(new URL('..',import.meta.url));
test('Windows autocrlf checkout preserves sealed R4 and future C manifest/lock raw bytes',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-996-lf-checkout-'));
 const git=a=>execFileSync('git',a,{cwd:root,stdio:['ignore','pipe','pipe']});
 try{
  git(['init','-q']);git(['config','core.autocrlf','true']);
  fs.writeFileSync(path.join(root,'.gitattributes'),fs.readFileSync(path.join(repo,'.gitattributes')));
  const r4='tools/controller-996-git-byte-offline-manifest-r4.json';
  const originals=new Map([[r4,execFileSync('git',['show','HEAD:'+r4],{cwd:repo})],
   ['tools/controller-996-c-native-owner-source-lock.json',Buffer.from('{"fixture":"lock-only"}\n')],
   ['docs/CONTROLLER_996_C_CONTINUATION_APPROVAL_V1.json',Buffer.from('{"fixture":"not-approved"}\n')]]);
  for(const [p,b] of originals){fs.mkdirSync(path.dirname(path.join(root,p)),{recursive:true});fs.writeFileSync(path.join(root,p),b);}
  git(['add','--','.gitattributes',...originals.keys()]);
  for(const p of originals.keys())fs.writeFileSync(path.join(root,p),'force fresh checkout\r\n');
  git(['checkout-index','--force','--all']);
  for(const [p,b] of originals)assert.deepEqual(fs.readFileSync(path.join(root,p)),b);
  assert.equal(createHash('sha256').update(fs.readFileSync(path.join(root,r4))).digest('hex'),
   '0978bae8a0e260a65a2d690fbee21f751d06bb4bb26d55051d30d081f4619f6f');
 }finally{assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir())+path.sep));fs.rmSync(root,{recursive:true});}
});

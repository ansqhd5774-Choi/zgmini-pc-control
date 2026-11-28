import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const workflow=fs.readFileSync(path.join(root,'.github/workflows/pc-job.yml'),'utf8');
const old='555f95708984580cd7d5a0fd05a80b718e867710';
const next='cde1dd372210e4658ae348cb9e2577967cb11634';
const lineage='d3764580fdb08ecddd5f9b1064051eec30f90492';
const sourceBaseline='bc5a0646b7e311d8179ea1204879be7bc7b9bed7';
const gitBytes=(sha,p)=>execFileSync('git',['show',sha+':'+p],
 {cwd:root,windowsHide:true,timeout:10000,maxBuffer:2e6});
const sha256=b=>createHash('sha256').update(b).digest('hex');
const pin={
 'controller/common.mjs':'9e940a92c0f3ac332ba4d8a5d52b4bac0d647340bdb30863e2628b5b70d27083',
 'controller/entry.mjs':'1874aa1b0b9c6ce109a15737a608a711b81aecb7e3bdcc475032be8b54c1dca7',
 'controller/preimage-manifest-stager.mjs':'806950791803cfc9a1fb387dfdbc4b74757304c48df20e90a2d9b76d52c8cf10',
 'controller/upload.mjs':'a0a6065c7f2fd8f816e6b0a9efd9e7aba14e990bd0336aadc6b0be74baaefe8e'
};
const nextPin={
 'controller/operations.mjs':'0507663515206b97bb2cad72a2b3fb19032d5ab0f3c2bdd1305eaa6d225d5375',
 'config/operations.json':'177cb15b40ca34fc415a091bf93f8f6ac6d607ce4d6f7f429a77d73c8abdcccf'
};
const lineagePin={'controller/operations.mjs':'6c0441108c244d1d5dd58e7793b785a371169a9d96b69e606200d905e8f59966',
 'config/operations.json':nextPin['config/operations.json']};
const line=workflow.split(/\r?\n/).find(s=>s.includes('const f=require(\'node:fs\')'));
assert.ok(line,'exact installed controller guard should exist');
const raw=line.slice(line.indexOf(' -e "')+5);
assert.ok(raw.endsWith('"'));
const script=raw.slice(0,-1);
const start="if(h.controllerSourceSha!=='"+old+"')process.exit(2);";
const replacement="const next='"+next+"',lineage='"+lineage+"';if(h.controllerSourceSha!==next&&h.controllerSourceSha!==lineage){if(h.controllerSourceSha!=='"+old+"')process.exit(2);}if(h.controllerSourceSha===next||h.controllerSourceSha===lineage){p['controller/operations.mjs']=h.controllerSourceSha===lineage?'"+lineagePin['controller/operations.mjs']+"':'"+nextPin['controller/operations.mjs']+"';p['config/operations.json']='"+nextPin['config/operations.json']+"';}";

const s6='66b8a66c6112441576917e0ac9fbe4d39cbd5eea';
const s6Pin={
 'controller/operations.mjs':'d8d26f2ff7e0740676a2be3d25a35bd3799ab8d08b4f82d4d7426b9a89942631',
 'config/operations.json':'95873e17a8e0d44be78b7353f99c99288500a2566cf7b1708ff51c463abaf32c',
 'controller/s6-journal-readonly.mjs':'0801332a91641be02ca62f9237e9b8fc01b052651ac99caa07044b305351b46d'
};
const priorS6Guard="if(h.controllerSourceSha!==next&&h.controllerSourceSha!==lineage){if(h.controllerSourceSha!=='555f95708984580cd7d5a0fd05a80b718e867710')process.exit(2);}";
const newS6Guard="const s6='66b8a66c6112441576917e0ac9fbe4d39cbd5eea';if(h.controllerSourceSha!==s6&&h.controllerSourceSha!==next&&h.controllerSourceSha!==lineage){if(h.controllerSourceSha!=='555f95708984580cd7d5a0fd05a80b718e867710')process.exit(2);}";
const newS6Pins="if(h.controllerSourceSha===s6){p['controller/operations.mjs']='d8d26f2ff7e0740676a2be3d25a35bd3799ab8d08b4f82d4d7426b9a89942631';p['config/operations.json']='95873e17a8e0d44be78b7353f99c99288500a2566cf7b1708ff51c463abaf32c';p['controller/s6-journal-readonly.mjs']='0801332a91641be02ca62f9237e9b8fc01b052651ac99caa07044b305351b46d';}";

test('Public A audit transition changes only exact version-pinned guard, never issue admission or other effects',()=>{
 const baseline=gitBytes(sourceBaseline,'.github/workflows/pc-job.yml').toString('utf8');
 assert.equal(workflow.replace(newS6Guard,priorS6Guard).replace(newS6Pins,'').replace(replacement,start),baseline);
 assert.match(workflow,/github\.event\.repository\.private == false/);
 assert.match(workflow,/github\.actor_id == 327938088/);
 assert.match(workflow,/github\.run_attempt == 1/);
 assert.equal((workflow.match(/steps\.installed_controller\.outcome == 'success'/g)||[]).length,3);
});

function guard({installed=old,drift=null,manifestDrift=null,alias=null}={}){
 const source=installed===s6?s6:installed===next||installed===lineage?next:old;
 const expected={...pin,...(installed===next?nextPin:installed===lineage?lineagePin:installed===s6?s6Pin:{})};
 const data=new Map();
 const rootPath='E:/ZGmini/automation/pc-control';
 for(const p of Object.keys(expected)){
  let bytes=gitBytes(source,p);
  if(installed===lineage&&p==='controller/operations.mjs'){
   const before='report.actualExecutionSha===host?.controllerSourceSha';
   const after="report.actualExecutionSha==='555f95708984580cd7d5a0fd05a80b718e867710'";
   const text=bytes.toString('utf8');
   assert.equal(text.split(before).length-1,1);
   bytes=Buffer.from(text.replace(before,after));
  }
  assert.equal(sha256(bytes),expected[p],p);
  data.set(rootPath+'/'+p,bytes);
 }
 const host={controllerSourceSha:installed,controllerFiles:{...expected}};
 if(manifestDrift)host.controllerFiles[manifestDrift]='b'.repeat(64);
 data.set(rootPath+'/host.json',Buffer.from(JSON.stringify(host)));
 if(drift){const p=rootPath+'/'+drift;data.set(p,Buffer.from('tampered'));}
 const filesystem={
  lstatSync(p){
   if(!data.has(p))throw Error('ENOENT');
   return {isFile:()=>true,isSymbolicLink:()=>p===rootPath+'/'+alias};
  },
  readFileSync(p){if(!data.has(p))throw Error('ENOENT');return data.get(p);}
 };
 const proc={exitCode:0,exit(n){this.exitCode=n;throw Error('STOP')}};
 const crypto={createHash};
 vm.runInNewContext(script,{require(n){if(n==='node:fs')return filesystem;
  if(n==='node:crypto')return crypto;throw Error('MODULE_NOT_ALLOWED');},process:proc},
 {timeout:10000});
 return proc.exitCode;
}
test('Public A guard preserves old pin and accepts only exact new installed B target',()=>{
 assert.equal(guard({installed:old}),0);
 assert.equal(guard({installed:next}),0);
 assert.equal(guard({installed:lineage}),0);
 assert.equal(guard({installed:'a'.repeat(40)}),2);
 for(const key of Object.keys(pin))assert.equal(guard({installed:old,drift:key}),2,key);
 for(const key of Object.keys({...pin,...nextPin})){
  assert.equal(guard({installed:next,drift:key}),2,key);
  assert.equal(guard({installed:next,manifestDrift:key}),2,key);
  assert.equal(guard({installed:next,alias:key}),2,key);
 }
 for(const key of Object.keys({...pin,...lineagePin})){
  assert.equal(guard({installed:lineage,drift:key}),2,key);
  assert.equal(guard({installed:lineage,manifestDrift:key}),2,key);
  assert.equal(guard({installed:lineage,alias:key}),2,key);
 }
});

test('S6 successor guard preserves all old pins and requires exact three additional installed bytes',()=>{
 assert.equal(guard({installed:s6}),0);
 for(const key of Object.keys({...pin,...s6Pin})){
  assert.equal(guard({installed:s6,drift:key}),2,key);
  assert.equal(guard({installed:s6,manifestDrift:key}),2,key);
  assert.equal(guard({installed:s6,alias:key}),2,key);
 }
});

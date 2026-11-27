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
const line=workflow.split(/\r?\n/).find(s=>s.includes('const f=require(\'node:fs\')'));
assert.ok(line,'exact installed controller guard should exist');
const raw=line.slice(line.indexOf(' -e "')+5);
assert.ok(raw.endsWith('"'));
const script=raw.slice(0,-1);
const start="if(h.controllerSourceSha!=='"+old+"')process.exit(2);";
const replacement="const old='"+old+"',next='"+next+"';if(h.controllerSourceSha!==old&&h.controllerSourceSha!==next)process.exit(2);if(h.controllerSourceSha===next){p['controller/operations.mjs']='"+nextPin['controller/operations.mjs']+"';p['config/operations.json']='"+nextPin['config/operations.json']+"';}";

test('Public A audit transition changes only exact version-pinned guard, never issue admission or other effects',()=>{
 const baseline=gitBytes(sourceBaseline,'.github/workflows/pc-job.yml').toString('utf8');
 assert.equal(workflow.replace(replacement,start),baseline);
 assert.match(workflow,/github\.event\.repository\.private == false/);
 assert.match(workflow,/github\.actor_id == 327938088/);
 assert.match(workflow,/github\.run_attempt == 1/);
 assert.equal((workflow.match(/steps\.installed_controller\.outcome == 'success'/g)||[]).length,3);
});

function guard({installed=old,drift=null,manifestDrift=null,alias=null}={}){
 const source=installed===next?next:old;
 const expected={...pin,...(installed===next?nextPin:{})};
 const data=new Map();
 const rootPath='E:/ZGmini/automation/pc-control';
 for(const p of Object.keys(expected))data.set(rootPath+'/'+p,gitBytes(source,p));
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
 assert.equal(guard({installed:'a'.repeat(40)}),2);
 for(const key of Object.keys(pin))assert.equal(guard({installed:old,drift:key}),2,key);
 for(const key of Object.keys({...pin,...nextPin})){
  assert.equal(guard({installed:next,drift:key}),2,key);
  assert.equal(guard({installed:next,manifestDrift:key}),2,key);
  assert.equal(guard({installed:next,alias:key}),2,key);
 }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {exclusive} from '../controller/common.mjs';

const fixture=fn=>{
 const base=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-lease-acquire-'));
 try{fn(base);}finally{fs.rmSync(base,{recursive:true,force:true});}
};

test('failed owner creation rolls back only the empty lease directory and allows retry',()=>fixture(base=>{
 const root=path.join(base,'leases'),id='result-upload';
 const io={...fs,writeFileSync(filename,...args){
  if(path.basename(filename)==='owner.json'){
   const error=Object.assign(Error('simulated disk write failure'),{code:'ENOSPC'});
   throw error;
  }
  return fs.writeFileSync(filename,...args);
 }};
 assert.throws(()=>exclusive(root,id,io),{code:'ENOSPC'});
 assert.equal(fs.existsSync(path.join(root,id)),false);
 const release=exclusive(root,id);
 assert.equal(fs.existsSync(path.join(root,id,'owner.json')),true);
 release();
 assert.equal(fs.existsSync(path.join(root,id)),false);
}));

test('ambiguous owner write retains nonempty lease rather than erasing uncertain evidence',()=>fixture(base=>{
 const root=path.join(base,'leases'),id='result-upload';
 const io={...fs,writeFileSync(filename,...args){
  fs.writeFileSync(filename,'{"status":"PARTIAL"}',{flag:'wx'});
  throw Object.assign(Error('simulated incomplete owner write'),{code:'EIO'});
 }};
 assert.throws(()=>exclusive(root,id,io),{code:'EIO'});
 assert.equal(fs.readFileSync(path.join(root,id,'owner.json'),'utf8'),'{"status":"PARTIAL"}');
 assert.throws(()=>exclusive(root,id),{code:'LEASE_BUSY'});
}));

test('pre-existing lease remains byte-identical when another acquisition is rejected',()=>fixture(base=>{
 const root=path.join(base,'leases'),id='result-upload';
 fs.mkdirSync(path.join(root,id),{recursive:true});
 const file=path.join(root,id,'owner.json'),original='{"nonce":"other-process"}';
 fs.writeFileSync(file,original,{flag:'wx'});
 assert.throws(()=>exclusive(root,id),{code:'LEASE_BUSY'});
 assert.equal(fs.readFileSync(file,'utf8'),original);
}));

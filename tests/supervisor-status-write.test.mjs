import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createSupervisorStatusWriter,writeJson} from '../controller/common.mjs';

test('transient heartbeat failure preserves old bytes, then next tick publishes fresh state',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-supervisor-status-'));
 const file=path.join(root,'status.json'),reports=[];
 fs.writeFileSync(file,'{"at":"old","pid":1}');
 let fail=true;
 const publish=createSupervisorStatusWriter({write:(f,v)=>{
  if(fail)throw Object.assign(Error('private path and command'),{code:'EPERM'});
  writeJson(f,v);
 },report:r=>reports.push(r)});
 try{
  assert.equal(publish(file,{at:'new',pid:2}),false);
  assert.deepEqual(JSON.parse(fs.readFileSync(file)),{at:'old',pid:1});
  assert.equal(publish(file,{at:'new',pid:2}),false);
  assert.equal(reports.length,1);
  assert.doesNotMatch(JSON.stringify(reports),/private|command/);
  fail=false;
  assert.equal(publish(file,{at:'new',pid:2}),true);
  assert.deepEqual(JSON.parse(fs.readFileSync(file)),{at:'new',pid:2});
  fail=true;publish(file,{at:'later',pid:2});
  assert.equal(reports.length,2);
 }finally{fs.rmSync(root,{recursive:true});}
});

test('all transient sharing errors are nonfatal without claiming a heartbeat update',()=>{
 for(const code of ['EACCES','EPERM','EBUSY']){
  const reports=[];
  const publish=createSupervisorStatusWriter({write:()=>{throw Object.assign(Error('hidden'),{code});},report:r=>reports.push(r)});
  assert.equal(publish('unused',{}),false);
  assert.equal(reports[0].ioCode,code);
  assert.equal(reports[0].heartbeatUpdated,false);
 }
});

test('unexpected write errors and strict ledger writes are not suppressed',()=>{
 for(const code of ['ENOSPC','ENOENT','INTERNAL_ERROR']){
  const publish=createSupervisorStatusWriter({write:()=>{throw Object.assign(Error(code),{code});}});
  assert.throws(()=>publish('unused',{}),e=>e.code===code);
 }
 assert.throws(()=>writeJson(path.join(os.tmpdir(),'missing-'+crypto.randomUUID(),'ledger.json'),{}),{code:'ENOENT'});
});

test('atomic rename failure preserves destination and cleans only its own temporary file',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-supervisor-rename-'));
 const destination=path.join(root,'status.json');
 fs.mkdirSync(destination);
 try{
  const before=fs.readdirSync(root).sort();
  assert.throws(()=>writeJson(destination,{at:'later'}),e=>
   e.zgminiIoPhase==='ATOMIC_RENAME');
  assert.deepEqual(fs.readdirSync(root).sort(),before);
  assert.equal(fs.statSync(destination).isDirectory(),true);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('write errors distinguish temporary write from atomic rename without exposing paths',()=>{
 const root=path.join(os.tmpdir(),'zgmini-nonexistent-'+crypto.randomUUID());
 assert.throws(()=>writeJson(path.join(root,'status.json'),{}),e=>
  e.code==='ENOENT'&&e.zgminiIoPhase==='TEMP_WRITE');
 const reports=[];
 const publish=createSupervisorStatusWriter({write:()=>{
  throw Object.assign(Error('sensitive local path'),{
   code:'EPERM',zgminiIoPhase:'ATOMIC_RENAME'});
 },report:r=>reports.push(r)});
 assert.equal(publish('unused',{}),false);
 assert.equal(reports[0].ioPhase,'ATOMIC_RENAME');
 assert.equal(reports[0].heartbeatUpdated,false);
 assert.doesNotMatch(JSON.stringify(reports),/sensitive local path/);
});

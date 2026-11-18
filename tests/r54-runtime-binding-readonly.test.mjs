import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {inspectR54RuntimeBinding,R54_RUNTIME_TASK,R54_RUNTIME_ACTION,
 R54_RUNTIME_ACTION_SHA256,readR54PinnedActionBytes} from '../controller/r54-runtime-binding-readonly.mjs';

const xml=(enabled=true,cmd=R54_RUNTIME_ACTION,extra='')=>Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<Task><Settings><Enabled>${enabled}</Enabled></Settings>
<Actions><Exec><Command>${cmd}</Command>${extra}</Exec></Actions></Task>`);
const inputs=(buf=xml())=>({queryTask:name=>{
 assert.equal(name,R54_RUNTIME_TASK);return buf;
},readActionBytes:()=>Buffer.from('fixed test data'),
 hashAction:()=>R54_RUNTIME_ACTION_SHA256});

test('fixed R54 task and action are observed without any mutation',()=>{
 const observed=inspectR54RuntimeBinding(inputs());
 assert.equal(observed.status,'PASS');
 assert.equal(observed.code,'R54_TASK_BINDING_VERIFIED');
 assert.equal(observed.enabled,true);
 assert.equal(observed.actionBytesMatch,true);
 assert.equal(observed.bindingVerified,true);
 assert.match(observed.taskXmlSha256,/^[a-f0-9]{64}$/);
 assert.equal(observed.lastRun,'UNKNOWN');
 assert.equal(observed.cycleEvidence,'UNVERIFIED_PATH');
 assert.equal(observed.operationalWrites,0);
 assert.ok(!('xml' in observed));
});

test('disabled task is a diagnostic failure, not an assumed successful publication',()=>{
 const observed=inspectR54RuntimeBinding(inputs(xml(false)));
 assert.equal(observed.status,'FAIL');
 assert.equal(observed.code,'R54_TASK_DISABLED');
});

test('Arguments are rejected before action read',()=>{
 for(const extra of ['<Arguments>/unsafe</Arguments>', '<Arguments/>']){
  let called=false;
  const observed=inspectR54RuntimeBinding({...inputs(xml(true,R54_RUNTIME_ACTION,extra)),
   readActionBytes:()=>{called=true;throw Error('must not read');}});
  assert.equal(observed.status,'BLOCKED');
  assert.equal(observed.code,'R54_TASK_XML_ACTION_INVALID');
  assert.equal(called,false);
 }
});

test('existing Task WorkingDirectory is observed without leaking the raw path or claiming it verified',()=>{
 const observed=inspectR54RuntimeBinding(inputs(xml(true,R54_RUNTIME_ACTION,
  '<WorkingDirectory>C:\\Sensitive\\Existing</WorkingDirectory>')));
 assert.equal(observed.status,'PASS');
 assert.equal(observed.code,'R54_TASK_ACTION_OBSERVED_WORKDIR_UNVERIFIED');
 assert.equal(observed.workingDirectoryObserved,true);
 assert.equal(observed.workingDirectoryStatus,'OBSERVED_UNVERIFIED');
 assert.equal(observed.bindingVerified,false);
 assert.ok(!JSON.stringify(observed).includes('Sensitive'));
});

test('command path drift and second actions fail without executable output',()=>{
 for(const buf of [xml(true,'C:\\other.cmd'),Buffer.from(`<Task><Settings><Enabled>true</Enabled></Settings><Actions><Exec><Command>${R54_RUNTIME_ACTION}</Command></Exec><Exec><Command>${R54_RUNTIME_ACTION}</Command></Exec></Actions></Task>`)]){
  const observed=inspectR54RuntimeBinding(inputs(buf));
  assert.equal(observed.status,'BLOCKED');
  assert.match(observed.code,/R54_TASK_ACTION_CHANGED|R54_TASK_XML_ACTION_INVALID/);
  assert.equal(observed.actionSha256,null);
 }
});

test('real action hash drift is classified separately from scheduler connection',()=>{
 const {hashAction,...ports}=inputs();
 const observed=inspectR54RuntimeBinding(ports);
 assert.equal(observed.status,'FAIL');
 assert.equal(observed.code,'R54_ACTION_SOURCE_DRIFT');
 assert.equal(observed.taskActionMatches,true);
});

test('only explicit not found and uncertain query are distinguished',()=>{
 const missing=inspectR54RuntimeBinding({queryTask:()=>{throw Object.assign(Error('missing'),{stderr:Buffer.from('ERROR: The system cannot find the file specified.')});}});
 assert.equal(missing.code,'R54_TASK_NOT_FOUND');
 const uncertain=inspectR54RuntimeBinding({queryTask:()=>{throw Object.assign(Error('denied'),{stderr:Buffer.from('Access denied')});}});
 assert.equal(uncertain.code,'R54_TASK_QUERY_UNAVAILABLE');
});

test('accept UTF16LE BOM, reject malformed bytes and forbidden XML DTD',()=>{
 const fixture=xml().toString();
 const u16=Buffer.concat([Buffer.from([0xff,0xfe]),Buffer.from(fixture,'utf16le')]);
 assert.equal(inspectR54RuntimeBinding(inputs(u16)).status,'PASS');
 assert.equal(inspectR54RuntimeBinding(inputs(Buffer.from([0xff,0xfe,0xff]))).code,'R54_TASK_XML_ENCODING_UNKNOWN');
 assert.equal(inspectR54RuntimeBinding(inputs(Buffer.from('<!DOCTYPE a><Task/>'))).code,'R54_TASK_XML_SHAPE_INVALID');
});

function actionFixture(t){
 const outer=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-r54-action-'));
 t.after(()=>fs.rmSync(outer,{recursive:true,force:true}));
 const root=path.join(outer,'data');
 const folder=path.join(root,'pc-writer','theme-nine-r54','scripts','pc-writer');
 fs.mkdirSync(folder,{recursive:true});
 const file=path.join(folder,'THEME_NINE_R54_PUBLIC_CYCLE.cmd');
 fs.writeFileSync(file,Buffer.from('@echo off\r\n'));
 return {outer,root,folder,file};
}

test('fixed action reader accepts intact bytes under canonical root',t=>{
 const {root,file}=actionFixture(t),before=fs.statSync(file).mtimeMs;
 const bytes=readR54PinnedActionBytes({root});
 assert.equal(bytes.toString(),'@echo off\r\n');
 assert.equal(fs.statSync(file).mtimeMs,before);
});

test('fixed action reader refuses symlink outside root',t=>{
 const {outer,root,file}=actionFixture(t);
 const other=path.join(outer,'other.cmd');fs.writeFileSync(other,'SECRET');
 fs.unlinkSync(file);fs.symlinkSync(other,file);
 assert.throws(()=>readR54PinnedActionBytes({root}),/R54_ACTION_PATH_UNSAFE/);
});

test('fixed action reader detects file changing during its read',t=>{
 const {root,file}=actionFixture(t);
 const io={...fs,readFileSync(name){
  const bytes=fs.readFileSync(name);fs.appendFileSync(file,'Changed!');return bytes;
 }};
 assert.throws(()=>readR54PinnedActionBytes({root,fsOps:io}),/R54_ACTION_CHANGED_DURING_READ/);
});

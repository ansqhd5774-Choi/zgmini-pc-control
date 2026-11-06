import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {inspectPcSource,inspectWriterSourceInventory} from '../controller/pc-source-readonly.mjs';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const fixture=t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-r2-a-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const put=(relative,bytes)=>{
  const file=path.join(root,relative);
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file,bytes);
  return file;
 };
 const dataRoot=path.join(root,'data');
 fs.mkdirSync(dataRoot);
 put('start.cmd','wscript.exe stage-one.vbs');
 put('stage-one.vbs','CreateObject("WScript.Shell").Run "nested\\stage-two.vbs"');
 put('nested/stage-two.vbs','"projects/pilot/scripts/pc-writer/local-cycle.mjs"');
 put('projects/pilot/.git','gitdir: fake');
 put('projects/pilot/scripts/pc-writer/local-cycle.mjs','export {}');
 put('projects/pilot/scripts/pc-writer/run-local.mjs','export const ready=true');
 put('projects/pilot/scripts/pc-writer/inflation-causal-public-auto-publication-r1.mjs','export const publish=1');
 put('projects/pilot/scripts/pc-writer/inflation-causal-public-auto-publication-r1.test.mjs','export const test=true');
 const task='<Task><Actions><Exec><Command>start.cmd</Command></Exec></Actions></Task>';
 const sha='a'.repeat(40);
 put('data/pc-writer/config.json',JSON.stringify({source:{sha},secret:'NEVER_OUTPUT_SECRET'}));
 const git=(cwd,args)=>{
  assert.equal(cwd,path.join(root,'projects/pilot'));
  return args[0]==='rev-parse'?sha+'\n':' M scripts/pc-writer/run-local.mjs\n';
 };
 return {root,dataRoot,put,task,git};
};

test('two-level VBS wrapper resolves static Writer source without execution',t=>{
 const f=fixture(t),reads=[];
 const before=fs.readFileSync(path.join(f.root,'stage-one.vbs'));
 const result=inspectPcSource({dataRoot:f.dataRoot,coreTaskXml:f.task,git:f.git,
  read:p=>{reads.push(p);return fs.readFileSync(p);}});
 assert.equal(result.status,'PASS');
 assert.equal(result.sourceResolved,true,JSON.stringify({launchers:result.tracedLaunchers,root:result.sourceRoot}));
 assert.equal(result.runtimeSourceVerified,false);
 assert.equal(result.evidenceLevel,'STATIC_LAUNCHER_TRACE_ONLY');
 assert.equal(result.tracedLaunchers.length,4);
 assert.equal(result.sourceHeadMatchesConfig,true);
 assert.equal(result.configApprovedSha,'a'.repeat(40));
 const files=result.writerSourceInventory;
 assert.equal(files.status,'PASS');
 assert.equal(files.complete,true);
 assert.ok(files.files.length>=4);
 assert.equal(files.files.find(x=>x.path==='scripts/pc-writer/run-local.mjs').trackedDirty,true);
 const publication=files.files.find(x=>x.path==='scripts/pc-writer/inflation-causal-public-auto-publication-r1.mjs');
 assert.equal(publication.sha256,hash(Buffer.from('export const publish=1')));
 assert.deepEqual(fs.readFileSync(path.join(f.root,'stage-one.vbs')),before);
 assert.ok(reads.every(p=>p.startsWith(f.root+path.sep)));
 assert.doesNotMatch(JSON.stringify(result),/NEVER_OUTPUT_SECRET/);
 assert.equal(result.providerCalls,0);
 assert.equal(result.d1Writes,0);
});

test('config source mismatch is reported but cannot falsify PC Runtime proof',t=>{
 const f=fixture(t);
 f.put('data/pc-writer/config.json',JSON.stringify({source:'b'.repeat(40),key:'SECRET'}));
 const result=inspectPcSource({dataRoot:f.dataRoot,coreTaskXml:f.task,git:f.git});
 assert.equal(result.sourceHeadMatchesConfig,false);
 assert.equal(result.runtimeSourceVerified,false);
 assert.doesNotMatch(JSON.stringify(result),/SECRET/);
});

test('Writer inventory rejects symlinks and reveals no escaped file hashes',t=>{
 const f=fixture(t);
 const dir=path.join(f.root,'projects/pilot/scripts/pc-writer');
 const external=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-r2-private-'));
 t.after(()=>fs.rmSync(external,{recursive:true,force:true}));
 const secret=path.join(external,'secret.mjs');
 fs.writeFileSync(secret,'private-source');
 fs.symlinkSync(secret,path.join(dir,'escaped.mjs'));
 const inventory=inspectWriterSourceInventory(path.join(f.root,'projects/pilot'));
 assert.equal(inventory.status,'STATE_UNKNOWN');
 assert.equal(inventory.complete,false);
 assert.deepEqual(inventory.files,[]);
 assert.doesNotMatch(JSON.stringify(inventory),/private-source/);
});

test('oversize Writer file makes inventory incomplete without digesting it',t=>{
 const f=fixture(t);
 f.put('projects/pilot/scripts/pc-writer/oversize.mjs',Buffer.alloc(2_000_001,65));
 const inventory=inspectWriterSourceInventory(path.join(f.root,'projects/pilot'));
 assert.equal(inventory.code,'WRITER_SOURCE_FILE_UNVERIFIED');
 assert.equal(inventory.complete,false);
 assert.equal(inventory.files.length,0);
});

test('unexpected Writer mjs file names cannot yield falsely complete inventory',t=>{
 const f=fixture(t);
 f.put('projects/pilot/scripts/pc-writer/private data.mjs','export const x=1');
 const inventory=inspectWriterSourceInventory(path.join(f.root,'projects/pilot'));
 assert.equal(inventory.code,'WRITER_SOURCE_FILENAME_UNVERIFIED');
 assert.equal(inventory.complete,false);
 assert.deepEqual(inventory.files,[]);
});

test('Writer inventory file-count cap refuses incomplete results',t=>{
 const f=fixture(t);
 for(let i=0;i<260;i++)f.put('projects/pilot/scripts/pc-writer/extra'+i+'.mjs','export {}');
 const inventory=inspectWriterSourceInventory(path.join(f.root,'projects/pilot'));
 assert.equal(inventory.code,'WRITER_SOURCE_FILE_COUNT_LIMIT');
 assert.equal(inventory.complete,false);
 assert.equal(inventory.files.length,0);
});

test('unrelated outside-root VBS reference cannot escape bounded Core source',t=>{
 const f=fixture(t);
 f.put('stage-one.vbs','CreateObject("WScript.Shell").Run "../../outside/secret.vbs"');
 const read=[];
 const result=inspectPcSource({dataRoot:f.dataRoot,coreTaskXml:f.task,
  read:p=>{read.push(p);return fs.readFileSync(p);},git:()=>{throw Error('git should not run');}});
 assert.equal(result.sourceResolved,false);
 assert.equal(result.runtimeSourceVerified,false);
 assert.ok(read.every(p=>p.startsWith(f.root+path.sep)));
});

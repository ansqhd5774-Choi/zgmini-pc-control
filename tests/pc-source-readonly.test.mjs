import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {inspectPcSource,taskAction} from '../controller/pc-source-readonly.mjs';

const fixture=t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-pc-source-fixture-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const put=(name,body)=>{const p=path.join(root,name);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,body);return p;};
 const dataRoot=path.join(root,'data');fs.mkdirSync(dataRoot);
 put('start.cmd','node projects/pilot/scripts/pc-writer/local-cycle.mjs');
 put('projects/pilot/.git','gitdir: fake');
 put('projects/pilot/scripts/pc-writer/local-cycle.mjs','export {}');
 put('projects/pilot/scripts/pc-writer/run-local.mjs','export {}');
 put('projects/pilot/lib/market-breadth/us-provisional-r1.mjs','export {}');
 const task='<Task><Actions><Exec><Command>start.cmd</Command><Arguments>--publish</Arguments></Exec></Actions></Task>';
 return {root,dataRoot,put,task};
};

test('read-only Core task trace resolves Git HEAD, dirty names and required file hashes',t=>{
 const f=fixture(t),read=[];const git=(cwd,args)=>{
  assert.equal(cwd,path.join(f.root,'projects/pilot'));
  assert.ok([['rev-parse','HEAD'],['status','--porcelain','--untracked-files=no']].some(x=>JSON.stringify(x)===JSON.stringify(args)));
  return args[0]==='rev-parse'?'a'.repeat(40)+'\n':' M scripts/pc-writer/run-local.mjs\n';
 };
 const before=fs.readFileSync(path.join(f.root,'start.cmd'));
 const result=inspectPcSource({dataRoot:f.dataRoot,coreTaskXml:f.task,git,
  read:p=>{read.push(p);return fs.readFileSync(p);}});
 assert.equal(result.status,'PASS');assert.equal(result.sourceResolved,true);
 assert.equal(result.runtimeSourceVerified,false);
 assert.equal(result.evidenceLevel,'STATIC_LAUNCHER_TRACE_ONLY');
 assert.equal(result.sourceHead,'a'.repeat(40));
 assert.deepEqual(result.trackedDirty,['scripts/pc-writer/run-local.mjs']);
 assert.equal(result.sourceRoot,'projects/pilot');
 assert.equal(result.tracedLaunchers.length,2);
 assert.equal(result.requiredFiles.find(x=>x.path.endsWith('us-breadth-provisional-cycle.mjs')).exists,false);
 assert.deepEqual(fs.readFileSync(path.join(f.root,'start.cmd')),before);
 assert.ok(read.every(p=>p.startsWith(f.root+path.sep)));
});

test('outside-root script references and unknown launchers do not access arbitrary files',t=>{
 const f=fixture(t);
 const external=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-outside-'));
 t.after(()=>fs.rmSync(external,{recursive:true,force:true}));
 fs.writeFileSync(path.join(external,'secret.mjs'),'not-for-reading');
 f.put('start.cmd',`node ../${path.basename(external)}/secret.mjs`);
 const paths=[];
 const result=inspectPcSource({dataRoot:f.dataRoot,coreTaskXml:f.task,
  read:p=>{paths.push(p);return fs.readFileSync(p);},git:()=>{throw Error('should not call git');}});
 assert.equal(result.sourceResolved,false);
 assert.equal(result.sourceHead,null);
 assert.equal(paths.includes(path.join(external,'secret.mjs')),false);
 assert.equal(result.providerCalls,0);assert.equal(result.d1Writes,0);
});

test('task XML returns only fixed action fields; decoded arguments are not executed',()=>{
 const action=taskAction('<Task><Command>wscript.exe</Command><Arguments>&quot;run.vbs&quot; &amp; whoami</Arguments></Task>');
 assert.deepEqual(action,{command:'wscript.exe',arguments:'"run.vbs" & whoami',workingDirectory:''});
});

test('Windows UTF-16LE Task XML buffers retain the real launcher path',()=>{
 const xml='<Task><Actions><Exec><Command>E:\\ZGmini\\automation\\core.vbs</Command><Arguments>&quot;E:\\ZGmini\\projects\\core.cmd&quot;</Arguments></Exec></Actions></Task>';
 const expected=taskAction(xml);
 assert.deepEqual(taskAction(Buffer.from(xml,'utf16le')),expected);
 assert.deepEqual(taskAction(Buffer.concat([Buffer.from([0xff,0xfe]),Buffer.from(xml,'utf16le')])),expected);
 assert.deepEqual(taskAction(Buffer.from(xml,'utf8')),expected);
});

test('Core Task Arguments with script paths are summarized without treating array index as a suffix',t=>{
 const f=fixture(t);
 const xml='<Task><Actions><Exec><Command>start.cmd</Command><Arguments>&quot;launch.vbs&quot; --publish</Arguments></Exec></Actions></Task>';
 const result=inspectPcSource({dataRoot:f.dataRoot,coreTaskXml:xml,git:()=>''});
 assert.equal(result.status,'PASS');
 assert.deepEqual(result.coreTaskAction.scriptFiles,['launch.vbs']);
 assert.equal(result.providerCalls,0);
 assert.equal(result.d1Writes,0);
});

test('bounded Writer checkpoint extracts runtime-reported Git SHA without leaking unrelated metadata',t=>{
 const f=fixture(t),head='b'.repeat(40);
 f.put('data/pc-writer/local-writer-last-run.json',
  JSON.stringify({source:head,at:'2026-11-03T04:00:00Z',status:'VERIFIED',
   credentials:'SECRET_NEVER_DISCLOSED',providerRows:['PRIVATE']}));
 f.put('start.cmd','rem no project reference');
 const result=inspectPcSource({dataRoot:f.dataRoot,coreTaskXml:f.task,
  git:()=>{throw Error('No checkout was resolved');}});
 assert.equal(result.sourceResolved,false);
 assert.equal(result.runtimeSourceVerified,false);
 assert.deepEqual(result.lastWriterEvidence,{
  evidenceLevel:'STORED_WRITER_RUNTIME_CHECKPOINT',
  sourceHead:head,at:'2026-11-03T04:00:00Z',status:'VERIFIED',
 });
 assert.doesNotMatch(JSON.stringify(result),/SECRET_NEVER_DISCLOSED|PRIVATE/);
});

test('malformed Writer checkpoint does not become invented runtime evidence',t=>{
 const f=fixture(t);
 f.put('start.cmd','rem no project reference');
 f.put('data/pc-writer/local-writer-last-run.json','not-json');
 const result=inspectPcSource({dataRoot:f.dataRoot,coreTaskXml:f.task});
 assert.equal(result.sourceResolved,false);
 assert.equal(result.lastWriterEvidence,undefined);
});

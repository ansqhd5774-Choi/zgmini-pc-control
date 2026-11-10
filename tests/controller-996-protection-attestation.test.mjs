import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {collect996ProtectedItems} from '../tools/controller-996-protection-attestation.mjs';

const hash=buffer=>createHash('sha256').update(buffer).digest('hex');
const filenames=['config.json','quota-runner.cmd','run-local.cmd'];
const tasknames=['ZGMINI-PC-Local-Core','ZGMINI-PC-Local-Korea'];
function fixture(){
 const writer=Object.fromEntries(filenames.map(n=>[n,Buffer.from(`file:${n}`)]));
 const tasks=Object.fromEntries(tasknames.map((n,i)=>[n,Buffer.from(
  `<?xml version="1.0"?><Task><Settings><Enabled>${i===0?'true':'false'}</Enabled></Settings></Task>`)]));
 const current={files:Object.fromEntries(filenames.map(n=>[n,hash(writer[n])])),
  tasks:Object.fromEntries(tasknames.map(n=>[n,hash(tasks[n])]))};
 return {writer,tasks,expected:hash(Buffer.from(JSON.stringify(current)))};
}
function observe(f,override={}){
 return collect996ProtectedItems({
  readFile:(_,n)=>f.writer[n],readTask:n=>f.tasks[n],
  expectedFingerprint:f.expected,now:()=> '2026-11-10T03:02:02.041Z',
  ...override});
}

test('exact 3 Writer and 2 Task hashes reproduce the previous aggregate',()=>{
 const f=fixture(),observation=observe(f);
 assert.equal(observation.status,'CURRENT_ITEMS_MATCH_OBSERVATION');
 assert.equal(observation.fingerprintMatch,true);
 assert.equal(observation.allFivePresent,true);
 assert.deepEqual(Object.keys(observation.items.files),filenames);
 assert.deepEqual(Object.keys(observation.items.taskSha256),tasknames);
 assert.deepEqual(observation.items.taskEnabled,{
  'ZGMINI-PC-Local-Core':true,'ZGMINI-PC-Local-Korea':false});
 assert.equal(observation.operationalWrites,0);
 assert.equal(observation.executionAuthorized,false);
 assert.equal(observation.historicalBaselineAvailable,false);
 assert.equal(observation.allActorsImmutableProven,false);
});

test('any changed file or task breaks exact prior fingerprint, no auto repair',()=>{
 const f=fixture();f.writer['config.json']=Buffer.from('changed');
 const result=observe(f);
 assert.equal(result.status,'CURRENT_ITEMS_DIFFER_OR_UNPROVEN');
 assert.equal(result.fingerprintMatch,false);
 assert.equal(result.operationalWrites,0);
});

test('an absent optional Writer file must match the original R1 omission rule',()=>{
 const f=fixture();delete f.writer['run-local.cmd'];
 const result=observe(f,{expectedFingerprint:hash(Buffer.from(JSON.stringify({
  files:Object.fromEntries(filenames.filter(n=>n!=='run-local.cmd')
   .map(n=>[n,hash(f.writer[n])])),
  tasks:Object.fromEntries(tasknames.map(n=>[n,hash(f.tasks[n])])),
 })))});
 assert.equal(result.status,'CURRENT_ITEMS_MATCH_OBSERVATION');
 assert.equal(result.items.writerFileStatus['run-local.cmd'],'ABSENT');
 assert.equal(result.items.files['run-local.cmd'],undefined);
 assert.equal(result.presentWriterFileCount,2);
 assert.equal(result.allFivePresent,false);
 assert.equal(result.fingerprintMatch,true);
});

test('a newly absent Writer file changes fingerprint and is not claimed unchanged',()=>{
 const f=fixture();delete f.writer['quota-runner.cmd'];
 const result=observe(f);
 assert.equal(result.status,'CURRENT_ITEMS_DIFFER_OR_UNPROVEN');
 assert.equal(result.fingerprintMatch,false);
 assert.equal(result.items.writerFileStatus['quota-runner.cmd'],'ABSENT');
});

test('a file read error reports the failing item and source code',()=>{
 const f=fixture(),error=Object.assign(Error('no such file'),{code:'ENOENT'});
 assert.throws(()=>observe(f,{readFile:(_,name)=>{
  if(name==='quota-runner.cmd')throw error;
  return f.writer[name];
 }}),e=>e.code==='WRITER_FILE_OBSERVATION_FAILED'&&
  e.failedItem==='quota-runner.cmd'&&e.underlyingCode==='ENOENT');
});

test('a Task query failure identifies the task without claiming a baseline',()=>{
 const f=fixture(),error=Object.assign(Error('command gone'),{code:'ENOENT'});
 assert.throws(()=>observe(f,{readTask:name=>{
  if(name==='ZGMINI-PC-Local-Korea')throw error;
  return f.tasks[name];
 }}),e=>e.code==='PROTECTED_TASK_QUERY_FAILED'&&
  e.failedItem==='ZGMINI-PC-Local-Korea'&&e.underlyingCode==='ENOENT');
});

test('missing task settings yields unknown instead of an asserted enabled state',()=>{
 const f=fixture();f.tasks[tasknames[0]]=Buffer.from('<Task/>');
 const result=observe(f,{expectedFingerprint:hash(Buffer.from(JSON.stringify({
  files:Object.fromEntries(filenames.map(n=>[n,hash(f.writer[n])])),
  tasks:Object.fromEntries(tasknames.map(n=>[n,hash(f.tasks[n])])),
 })))});
 assert.equal(result.items.taskEnabled[tasknames[0]],null);
 assert.equal(result.status,'CURRENT_ITEMS_DIFFER_OR_UNPROVEN');
});

test('UTF-16LE Task XML is decoded for the enabled state, raw bytes are hashed',()=>{
 const f=fixture();
 f.tasks[tasknames[0]]=Buffer.from('<Task><Settings><Enabled>true</Enabled></Settings></Task>','utf16le');
 const result=observe(f,{expectedFingerprint:hash(Buffer.from(JSON.stringify({
  files:Object.fromEntries(filenames.map(n=>[n,hash(f.writer[n])])),
  tasks:Object.fromEntries(tasknames.map(n=>[n,hash(f.tasks[n])])),
 })))});
 assert.equal(result.items.taskEnabled[tasknames[0]],true);
 assert.equal(result.status,'CURRENT_ITEMS_MATCH_OBSERVATION');
});

test('probe source never calls operational writes, workflow mutation or release',()=>{
 const source=fs.readFileSync(fileURLToPath(new URL(
  '../tools/controller-996-protection-attestation.mjs',import.meta.url)),'utf8');
 assert.doesNotMatch(source,/\b(?:writeFileSync|renameSync|unlinkSync|mkdirSync|rmSync|cpSync|spawnSync)\s*\(/);
 assert.doesNotMatch(source,/\b(?:fetch|process\.kill|https\.request|http\.request)\s*\(/);
});

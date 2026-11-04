import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {attestRetiredIranAbsence,protectedState,readCore,runOperation} from '../controller/operations.mjs';
import {executeJob} from '../controller/engine.mjs';

const missing=()=>({status:1,signal:null,stderr:Buffer.from('ERROR: The system cannot find the file specified.')});
const present=()=>({status:0,signal:null,stderr:Buffer.alloc(0)});
const inventory=(names=['\\ZGMINI-PC-Local-Core','\\ZGMINI-PC-Local-Korea'])=>({
 status:0,signal:null,stdout:Buffer.from(names.map(n=>`"${n}","Ready","x"`).join('\r\n'))
});

test('approved Iran retirement must be demonstrated by exact absence and inventory',()=>{
 assert.equal(attestRetiredIranAbsence({exact:missing(),inventory:inventory()}),'APPROVED_RETIRED_ABSENT');
});
test('retired Iran task reappearance is a hard stop',()=>{
 assert.throws(()=>attestRetiredIranAbsence({exact:present(),inventory:inventory()}),{code:'RETIRED_IRAN_UNEXPECTEDLY_ACTIVE'});
 assert.throws(()=>attestRetiredIranAbsence({exact:missing(),inventory:inventory(['\\ZGMINI-PC-Iran-Progress-R14'])}),{code:'RETIRED_IRAN_UNEXPECTEDLY_ACTIVE'});
});
test('access denial, unknown failure and unreliable inventory are not accepted as absence',()=>{
 assert.throws(()=>attestRetiredIranAbsence({exact:{status:1,stderr:Buffer.from('ERROR: Access is denied.')},inventory:inventory()}),{code:'RETIRED_IRAN_QUERY_UNCERTAIN'});
 assert.throws(()=>attestRetiredIranAbsence({exact:{status:2,stderr:Buffer.from('failed')},inventory:inventory()}),{code:'RETIRED_IRAN_QUERY_UNCERTAIN'});
 assert.throws(()=>attestRetiredIranAbsence({exact:missing(),inventory:{status:1,stderr:Buffer.from('failed')} }),{code:'RETIRED_IRAN_INVENTORY_UNAVAILABLE'});
 assert.throws(()=>attestRetiredIranAbsence({exact:missing(),inventory:inventory([])}),{code:'RETIRED_IRAN_INVENTORY_UNAVAILABLE'});
});
test('protectedState and readCore keep both active task hashes and record expected absence',()=>{
 const queried=[];
 const queryTask=name=>{queried.push(name);return Buffer.from('safe-fixture-'+name);};
 const options={queryTask,retiredTaskEvidence:()=> 'APPROVED_RETIRED_ABSENT'};
 const state=protectedState('/nonexistent-retired-iran-fixture',options);
 const core=readCore('/nonexistent-retired-iran-fixture',options);
 assert.deepEqual(Object.keys(state.tasks),['ZGMINI-PC-Local-Core','ZGMINI-PC-Local-Korea','ZGMINI-PC-Iran-Progress-R13']);
 assert.equal(state.tasks['ZGMINI-PC-Iran-Progress-R13'],'APPROVED_RETIRED_ABSENT');
 assert.equal(core.taskXmlHashes['ZGMINI-PC-Iran-Progress-R13'],'APPROVED_RETIRED_ABSENT');
 assert.equal(queried.length,4);
 assert(!queried.some(name=>name.includes('Iran')));
 assert.notEqual(state.tasks['ZGMINI-PC-Local-Core'],state.tasks['ZGMINI-PC-Local-Korea']);
});
test('active Core or Korea query failure cannot be bypassed',()=>{
 assert.throws(()=>protectedState('/nonexistent-retired-iran-fixture',{queryTask:()=>{throw Error('active task failed')},
  retiredTaskEvidence:()=> 'APPROVED_RETIRED_ABSENT'}),/active task failed/);
});
test('core-status reports approved absent Iran without operational writes',async()=>{
 const result=await runOperation({operation:'core-status'},{
  dataRoot:'/nonexistent-retired-iran-fixture',
  queryTask:()=>Buffer.from('active XML'),
  retiredTaskEvidence:()=> 'APPROVED_RETIRED_ABSENT'
 });
 assert.equal(result.status,'PASS');
 assert.equal(result.code,'CORE_READONLY_DIAGNOSIS');
 assert.equal(result.core.taskXmlHashes['ZGMINI-PC-Iran-Progress-R13'],'APPROVED_RETIRED_ABSENT');
 assert.equal(result.d1Writes,0);
 assert.equal(result.providerCalls,0);
});
test('engine retains precise retired-Iran refusal in read-only prevalidation',async()=>{
 const policy=JSON.parse(fs.readFileSync(new URL('../config/operations.json',import.meta.url),'utf8'));
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-retired-iran-engine-'));
 const dataRoot=path.join(dir,'data');
 const request={schema:'ZGMINI_PC_JOB_V1',requestId:'retired-iran-fixture-1234',
  chatId:'chat-retired-fixture',operation:'runner-smoke',
  sourceRepository:policy.sourceRepository,sourceBranch:'main',sourceSha:'a'.repeat(40)};
 const result=await executeJob(request,{
  root:dir,policy,host:{dataRoot,controllerSourceSha:'b'.repeat(40)},
  seat:1,runId:'100',queryTask:()=>Buffer.from('active task'),
  retiredTaskEvidence:()=>{throw Object.assign(Error('RETIRED_IRAN_UNEXPECTEDLY_ACTIVE'),
    {code:'RETIRED_IRAN_UNEXPECTEDLY_ACTIVE'});}
 });
 assert.equal(result.report.status,'BLOCKED');
 assert.equal(result.report.code,'RETIRED_IRAN_UNEXPECTEDLY_ACTIVE');
 assert.equal(result.report.failureOperation,'PROTECTED_STATE_SNAPSHOT');
 assert.equal(result.report.failedProtectedTask,'ZGMINI-PC-Iran-Progress-R13');
 assert.equal(result.report.mutationStarted,false);
 assert.equal(result.report.operationalWrites,0);
 assert.equal(result.report.d1Writes,0);
});

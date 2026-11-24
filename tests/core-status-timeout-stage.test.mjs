import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {readCore,runOperation,CORE_STATUS_STAGES} from '../controller/operations.mjs';
import {executeJob,readFixedCoreStatusStage} from '../controller/engine.mjs';

function fixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-core-status-stages-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const dataRoot=path.join(root,'data'),pc=path.join(dataRoot,'pc-writer');
 const workspace=path.join(root,'jobs','fixed-owned-workspace');
 fs.mkdirSync(pc,{recursive:true});fs.mkdirSync(workspace,{recursive:true});
 fs.writeFileSync(path.join(pc,'config.json'),JSON.stringify({source:'a'.repeat(40)}));
 for(const file of ['local-cycle-last-run.json','local-collection-last-run.json','local-writer-last-run.json'])
  fs.writeFileSync(path.join(pc,file),JSON.stringify({status:'COMPLETE',secret:'DO_NOT_TRANSFER'}));
 return {root,dataRoot,workspace};
}

test('readCore emits fixed stage order without changing evidence projection',t=>{
 const {dataRoot}=fixture(t),observed=[];
 const core=readCore(dataRoot,{taskXmlHashes:{core:'unchanged'},onStage:s=>observed.push(s)});
 assert.deepEqual(observed,CORE_STATUS_STAGES.slice(1));
 assert.deepEqual(core.taskXmlHashes,{core:'unchanged'});
 assert.equal(core.approvedSourceSha,'a'.repeat(40));
 assert.equal(JSON.stringify(core).includes('DO_NOT_TRANSFER'),false);
});

test('core-status writes only private stage, while normal output remains unchanged',async t=>{
 const {dataRoot,workspace}=fixture(t);
 const output=await runOperation({operation:'core-status'},{dataRoot,workspace,
  policy:{mutationsEnabled:false},protectedTaskHashes:{core:'hash'}});
 assert.equal(output.status,'PASS');
 assert.equal(output.code,'CORE_READONLY_DIAGNOSIS');
 assert.equal(output.workerLastEnteredStage,undefined);
 assert.deepEqual(output.core.taskXmlHashes,{core:'hash'});
 assert.equal(readFixedCoreStatusStage(workspace),'CORE_STATUS_DONE');
 assert.deepEqual(JSON.parse(fs.readFileSync(path.join(workspace,'core-status-readonly-stage.json'))),
  {stage:'CORE_STATUS_DONE'});
});

test('missing Task observation stays unverified and never falls through to OS queries',async t=>{
 const {dataRoot,workspace}=fixture(t);
 const output=await runOperation({operation:'core-status'},{dataRoot,workspace,
  policy:{mutationsEnabled:false},skipProtectedTaskObservation:true,
  queryTask:()=>{throw Error('should not query the Task');}});
 assert.equal(output.status,'PASS');
 assert.equal(output.taskObservation,'UNVERIFIED');
 assert.deepEqual(output.core.taskXmlHashes,{});
 assert.equal(readFixedCoreStatusStage(workspace),'CORE_STATUS_DONE');
});

test('timeout parser accepts exactly a bounded allowlisted stage, no private data',t=>{
 const {workspace}=fixture(t),file=path.join(workspace,'core-status-readonly-stage.json');
 assert.equal(readFixedCoreStatusStage(workspace),null);
 fs.writeFileSync(file,JSON.stringify({stage:'CORE_CHECKPOINT_WRITER'}));
 assert.equal(readFixedCoreStatusStage(workspace),'CORE_CHECKPOINT_WRITER');
 for(const bad of [
  {stage:'CORE_CHECKPOINT_WRITER',secret:'LEAK'},
  {stage:'E:\\\\private\\\\path'},
  {stage:'CORE_CHECKPOINT_WRITER',pid:1337},
  ['CORE_CHECKPOINT_WRITER'],null
 ]){
  fs.writeFileSync(file,JSON.stringify(bad));
  assert.equal(readFixedCoreStatusStage(workspace),null);
 }
 fs.writeFileSync(file,' '.repeat(129));
 assert.equal(readFixedCoreStatusStage(workspace),null);
 fs.unlinkSync(file);
 if(process.platform!=='win32'){
  fs.symlinkSync(path.join(workspace,'other-stage.json'),file);
  assert.equal(readFixedCoreStatusStage(workspace),null);
 }
});

test('normal Controller job does not advertise a timeout stage or modify protected state',async t=>{
 const {root,dataRoot}=fixture(t);
 const policy=JSON.parse(fs.readFileSync(new URL('../config/operations.json',import.meta.url)));
 const request={schema:'ZGMINI_PC_JOB_V1',requestId:'core-stage-pass-20261124',
  chatId:'chat-stage-pass',operation:'core-status',
  sourceRepository:policy.sourceRepository,sourceBranch:'main',sourceSha:'a'.repeat(40)};
 const output=await executeJob(request,{root,policy,host:{dataRoot,
  controllerSourceSha:'b'.repeat(40)},runId:'77720261124',seat:1,
  queryTask:()=>Buffer.from('task-xml'),
  retiredTaskEvidence:()=> 'APPROVED_RETIRED_ABSENT'});
 assert.equal(output.report.status,'PASS');
 assert.equal(output.report.code,'CORE_READONLY_DIAGNOSIS');
 assert.equal(output.report.workerLastEnteredStage,undefined);
 assert.equal(output.report.protectedStateUnchanged,true);
 assert.equal(output.report.operationalWrites,0);
 assert.equal(output.report.providerCalls,0);
 assert.equal(output.report.d1Writes,0);
 assert.equal(readFixedCoreStatusStage(output.workspace),'CORE_STATUS_DONE');
});

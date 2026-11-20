import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const controller=path.join(here,'..','controller');

test('missing engine dependency or host manifest yields uploadable BLOCKED pointer',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-entry-import-'));
 try{
  fs.mkdirSync(path.join(root,'controller'));
  for(const file of ['entry.mjs','common.mjs','preimage-manifest-contract.mjs'])
   fs.copyFileSync(path.join(controller,file),path.join(root,'controller',file));
  // Reproduce a selectively installed engine with an absent transitive import.
  fs.writeFileSync(path.join(root,'controller','engine.mjs'),
   "import './r54-runtime-binding-readonly.mjs'; export const executeJob=()=>{};\n");
  fs.writeFileSync(path.join(root,'host.json'),JSON.stringify({controllerFiles:{}}));
  fs.mkdirSync(path.join(root,'config'));
  const repository='ansqhd5774-Choi/zgmini-pc-control';
  fs.writeFileSync(path.join(root,'config','operations.json'),JSON.stringify({
   controlRepository:repository,sourceRepository:'ansqhd5774-Choi/zgmini',
   allowedActors:['ansqhd5774-Choi'],operations:{'core-status':{grade:'A',resource:'light',timeoutSeconds:60}}
  }));
  const request={schema:'ZGMINI_PC_JOB_V1',requestId:'pc-test-import-failure-0001',
   chatId:'chat-test-import-failure',operation:'core-status',
   sourceRepository:'ansqhd5774-Choi/zgmini',sourceBranch:'main',sourceSha:'a'.repeat(40)};
  const event=path.join(root,'event.json');
  fs.writeFileSync(event,JSON.stringify({action:'opened',repository:{private:true},
   issue:{number:2506,user:{login:'ansqhd5774-Choi'},labels:[{name:'pc-job'}],
    body:JSON.stringify(request)}}));
  const runId='99999999999',seat='2';
  const env={...process.env,GITHUB_EVENT_PATH:event,GITHUB_REPOSITORY:repository,
   GITHUB_ACTOR:'ansqhd5774-Choi',GITHUB_EVENT_NAME:'issues',
   GITHUB_RUN_ID:runId,GITHUB_RUN_ATTEMPT:'1',RUNNER_NAME:'zgmini-pc-02'};
  const out=spawnSync(process.execPath,[path.join(root,'controller','entry.mjs')],{
   encoding:'utf8',env
  });
  assert.equal(out.status,1,out.stderr);
  const pointer=JSON.parse(fs.readFileSync(path.join(root,'reports',
   `${runId}-1-${seat}.json`),'utf8'));
  assert.equal(pointer.issueNumber,2506);
  assert.equal(pointer.report.status,'BLOCKED');
  assert.equal(pointer.report.code,'CONTROLLER_IMPORT_MISSING');
  assert.equal(pointer.report.firstFail,'ENGINE_IMPORT');
  assert.equal(pointer.report.operationalWrites,0);
  assert.equal(pointer.report.providerCalls,0);
  assert.equal(pointer.report.d1Writes,0);
  assert.match(out.stdout,/CONTROLLER_IMPORT_MISSING/);
  // A missing or malformed installed host manifest also needs an uploadable
  // receipt. The unchanged policy and original Issue identity remain valid.
  const hostFile=path.join(root,'host.json');
  const reportFile=path.join(root,'reports',`${runId}-1-${seat}.json`);
  for(const hostBytes of [null,'{not valid json']){
   fs.rmSync(reportFile,{force:true});
   if(hostBytes===null)fs.rmSync(hostFile,{force:true});
   else fs.writeFileSync(hostFile,hostBytes);
   const missingHost=spawnSync(process.execPath,[path.join(root,'controller','entry.mjs')],{
    encoding:'utf8',env
   });
   assert.equal(missingHost.status,1,missingHost.stderr);
   const receipt=JSON.parse(fs.readFileSync(reportFile,'utf8'));
   assert.equal(receipt.issueNumber,2506);
   assert.equal(receipt.report.status,'BLOCKED');
   assert.equal(receipt.report.code,'CONTROLLER_HOST_MANIFEST_UNAVAILABLE');
   assert.equal(receipt.report.firstFail,'HOST_MANIFEST_READ');
   assert.equal(receipt.report.operationalWrites,0);
   assert.equal(receipt.report.providerCalls,0);
   assert.equal(receipt.report.d1Writes,0);
  }
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});

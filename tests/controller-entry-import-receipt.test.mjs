import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
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
  fs.mkdirSync(path.join(root,'config'));
  const repository='ansqhd5774-Choi/zgmini-pc-control';
  fs.writeFileSync(path.join(root,'config','operations.json'),JSON.stringify({
   controlRepository:repository,sourceRepository:'ansqhd5774-Choi/zgmini',
   maxReportBytes:32768,allowedActors:['ansqhd5774-Choi'],operations:{'core-status':{grade:'A',resource:'light',timeoutSeconds:60},
    'writer-install-preimage-readonly':{grade:'A',resource:'light',timeoutSeconds:60}}
  }));
  // A valid installed manifest must attest a nonempty, scoped source inventory.
  const paths=['config/operations.json','controller/common.mjs','controller/engine.mjs',
   'controller/entry.mjs','controller/fear-greed-archive-readonly.mjs',
   'controller/operations.mjs','controller/supervisor.mjs',
   'controller/upload.mjs','controller/worker.mjs',
   'controller/preimage-manifest-contract.mjs','controller/preimage-manifest-stager.mjs'];
  // Only the engine import graph executes in this isolated failure fixture.
  for(const rel of paths){
   const file=path.join(root,rel);
   if(!fs.existsSync(file))fs.writeFileSync(file,'export const fixtureOnly=true;\n');
  }
  const controllerFiles=Object.fromEntries(paths.map(rel=>[rel,
   createHash('sha256').update(fs.readFileSync(path.join(root,rel))).digest('hex')]));
  fs.writeFileSync(path.join(root,'host.json'),JSON.stringify({
   controllerSourceSha:'b'.repeat(40),controllerFiles
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
  // Exact failure remains on PC pointer, but public Actions stdout is bounded.
  assert.match(out.stdout,/PUBLIC_LOCAL_RESULT_REDACTED/);
  assert.doesNotMatch(out.stdout,/CONTROLLER_IMPORT_MISSING/);
  // Missing, invalid JSON and valid JSON with invalid host shape all need an uploadable
  // BLOCKED receipt, never an uncaught TypeError from Object.entries.
  // A missing or malformed installed host manifest also needs an uploadable
  // receipt. The unchanged policy and original Issue identity remain valid.
  const hostFile=path.join(root,'host.json');
  const reportFile=path.join(root,'reports',`${runId}-1-${seat}.json`);
  for(const hostBytes of [null,'{not valid json','null','[]','"not a host"',
   '{}','{"controllerFiles":null}','{"controllerFiles":[]}',
   JSON.stringify({controllerSourceSha:'b'.repeat(40),controllerFiles:{}}),
   JSON.stringify({controllerSourceSha:'bad',controllerFiles}),
   JSON.stringify({controllerSourceSha:'b'.repeat(40),
    controllerFiles:Object.fromEntries(Object.entries(controllerFiles)
     .filter(([rel])=>rel!=='controller/upload.mjs'))}),
   JSON.stringify({controllerSourceSha:'b'.repeat(40),
    controllerFiles:{...controllerFiles,'controller/../unverified.mjs':'c'.repeat(64)}}),
   JSON.stringify({controllerSourceSha:'b'.repeat(40),
    controllerFiles:{...controllerFiles,'controller/entry.mjs':'bad'}})]){
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
  // An attested preimage helper may still have an unavailable transitive
  // import. It must not fail before entry creates the BLOCKED pointer.
  const preimageFile=path.join(root,'controller','preimage-manifest-contract.mjs');
  fs.writeFileSync(preimageFile,
   "import './unavailable-preimage-helper.mjs'; export const readStagedPreimageScope=()=>null;\n");
  const withBrokenPreimage={...controllerFiles,
   'controller/preimage-manifest-contract.mjs':createHash('sha256')
    .update(fs.readFileSync(preimageFile)).digest('hex')};
  fs.writeFileSync(hostFile,JSON.stringify({controllerSourceSha:'b'.repeat(40),
   controllerFiles:withBrokenPreimage}));
  fs.rmSync(reportFile,{force:true});
  const missingPreimage=spawnSync(process.execPath,
   [path.join(root,'controller','entry.mjs')],{encoding:'utf8',env});
  assert.equal(missingPreimage.status,1,missingPreimage.stderr);
  const receipt=JSON.parse(fs.readFileSync(reportFile,'utf8'));
  assert.equal(receipt.issueNumber,2506);
  assert.equal(receipt.report.status,'BLOCKED');
  assert.equal(receipt.report.code,'CONTROLLER_IMPORT_MISSING');
  // Ordinary operations now skip the optional helper entirely. Their missing
  // engine import retains the existing ENGINE_IMPORT failure stage.
  assert.equal(receipt.report.firstFail,'ENGINE_IMPORT');
  assert.equal(receipt.report.operationalWrites,0);
  assert.equal(receipt.report.providerCalls,0);
  assert.equal(receipt.report.d1Writes,0);
  // The same damaged helper must still fail closed at PREIMAGE_STAGE_IMPORT
  // for a genuinely scoped preimage request. Preserve the original Issue
  // identity and the previously attested host manifest.
  const preimageRequest={...request,operation:'writer-install-preimage-readonly',
   preimageManifestPath:'approvals/writer-preimage/test-scope.json',
   preimageManifestSha256:'c'.repeat(64)};
  fs.writeFileSync(event,JSON.stringify({action:'opened',repository:{private:true},
   issue:{number:2506,user:{login:'ansqhd5774-Choi'},labels:[{name:'pc-job'}],
    body:JSON.stringify(preimageRequest)}}));
  fs.rmSync(reportFile,{force:true});
  const scoped=spawnSync(process.execPath,[path.join(root,'controller','entry.mjs')],
   {encoding:'utf8',env});
  assert.equal(scoped.status,1,scoped.stderr);
  const scopedReceipt=JSON.parse(fs.readFileSync(reportFile,'utf8'));
  assert.equal(scopedReceipt.issueNumber,2506);
  assert.equal(scopedReceipt.report.status,'BLOCKED');
  assert.equal(scopedReceipt.report.code,'CONTROLLER_IMPORT_MISSING');
  assert.equal(scopedReceipt.report.firstFail,'PREIMAGE_STAGE_IMPORT');
  assert.equal(scopedReceipt.report.operationalWrites,0);
  assert.equal(scopedReceipt.report.providerCalls,0);
  assert.equal(scopedReceipt.report.d1Writes,0);
  // Restore the normal request for the policy corruption checks below.
  fs.writeFileSync(event,JSON.stringify({action:'opened',repository:{private:true},
   issue:{number:2506,user:{login:'ansqhd5774-Choi'},labels:[{name:'pc-job'}],
    body:JSON.stringify(request)}}));
  assert.equal(receipt.report.operationalWrites,0);
  assert.equal(receipt.report.providerCalls,0);
  assert.equal(receipt.report.d1Writes,0);
  // Corrupt installed policy must not bypass entry's fixed failure receipt.
  // The trusted GitHub event remains available for the original Issue number.
  const policyFile=path.join(root,'config','operations.json');
  const policyBytes=fs.readFileSync(policyFile);
  for(const invalidPolicy of ['{broken json','','null','[]','42','"string"','{}',
   JSON.stringify({controlRepository:'ansqhd5774-Choi/zgmini-pc-control',maxReportBytes:32768}),
   JSON.stringify({controlRepository:'incorrect/repo',maxReportBytes:32768,
    allowedActors:['ansqhd5774-Choi'],operations:{}})]){
   fs.writeFileSync(policyFile,invalidPolicy);
   fs.rmSync(reportFile,{force:true});
   const badPolicy=spawnSync(process.execPath,
    [path.join(root,'controller','entry.mjs')],{encoding:'utf8',env});
   assert.equal(badPolicy.status,1,badPolicy.stderr);
   const blocked=JSON.parse(fs.readFileSync(reportFile,'utf8'));
   assert.equal(blocked.issueNumber,2506);
   assert.equal(blocked.report.status,'BLOCKED');
   assert.equal(blocked.report.code,'CONTROLLER_POLICY_UNAVAILABLE');
   assert.equal(blocked.report.operationalWrites,0);
   assert.equal(blocked.report.providerCalls,0);
   assert.equal(blocked.report.d1Writes,0);
  }
  fs.writeFileSync(policyFile,policyBytes);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});

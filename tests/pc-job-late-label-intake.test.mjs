import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {stagePreimageManifest} from '../controller/preimage-manifest-stager.mjs';

const wf=fs.readFileSync(new URL('../.github/workflows/pc-job.yml',import.meta.url),'utf8');
const entry=fs.readFileSync(new URL('../controller/entry.mjs',import.meta.url),'utf8');
const stager=fs.readFileSync(new URL('../controller/preimage-manifest-stager.mjs',import.meta.url),'utf8');
const engine=fs.readFileSync(new URL('../controller/engine.mjs',import.meta.url),'utf8');

const policy={sourceRepository:'ansqhd5774-Choi/zgmini',operations:{'core-runtime-source-readonly':{grade:'A'}}};
const request={schema:'ZGMINI_PC_JOB_V1',requestId:'pc-late-label-source-fixture-01',chatId:'pc-label-fixture',
 operation:'core-runtime-source-readonly',sourceRepository:'ansqhd5774-Choi/zgmini',
 sourceBranch:'main',sourceSha:'a'.repeat(40)};
const env={GITHUB_REPOSITORY:'ansqhd5774-Choi/zgmini-pc-control',
 GITHUB_ACTOR:'ansqhd5774-Choi',GITHUB_EVENT_NAME:'issues'};
const event=(action='labeled',label='pc-job',issueOwner='ansqhd5774-Choi')=>({
 action,label:{name:label},repository:{private:true},
 issue:{user:{login:issueOwner},labels:[{name:'pc-job'}],body:JSON.stringify(request)}
});

test('workflow accepts exactly owner opened or pc-job labeled and retains pinned Windows entry',()=>{
 assert.match(wf,/types: \[opened, labeled\]/);
 assert.match(wf,/github\.event\.issue\.user\.login == 'ansqhd5774-Choi'/);
 assert.match(wf,/github\.event\.action == 'opened'/);
 assert.match(wf,/github\.event\.action == 'labeled' && github\.event\.label\.name == 'pc-job'/);
 assert.match(wf,/contains\(github\.event\.issue\.labels\.\*\.name, 'pc-job'\)/);
 assert.match(wf,/github\.actor == 'ansqhd5774-Choi'/);
 assert.match(wf,/cancel-in-progress: false/);
 assert.match(wf,/E:\\ZGmini\\runtime\\node\.exe/);
 assert.match(wf,/controller\\entry\.mjs/);
 assert.match(wf,/controller\\upload\.mjs/);
 assert.doesNotMatch(wf,/workflow_dispatch:|repository_dispatch:|schedule:/);
});

test('installed Controller entry and scope stager require exact label and issue owner',()=>{
 assert.match(entry,/event\.action==='opened'/);
 assert.match(entry,/event\.action==='labeled'&&event\.label\?\.name==='pc-job'/);
 assert.match(entry,/event\.issue\?\.user\?\.login==='ansqhd5774-Choi'/);
 assert.match(entry,/EVENT_NOT_ALLOWED/);
 assert.match(stager,/event\?\.action==='opened'/);
 assert.match(stager,/event\?\.action==='labeled'&&event\?\.label\?\.name==='pc-job'/);
 assert.match(stager,/event\?\.issue\?\.user\?\.login!=='ansqhd5774-Choi'/);
 // Existing requestId ledger means repeated original labels cannot execute
 // the fixed A operation twice; concurrency remains serialized per Issue.
 assert.match(engine,/DUPLICATE_REUSED_NO_EXECUTION/);
 assert.match(engine,/request-['"]\+request\.requestId/);
});

test('preimage intake accepts labeled pc-job A without inventing scope or issuing network fetch',async()=>{
 let calls=0;
 const fetchImpl=async()=>{calls++;throw Error('should not fetch')};
 assert.equal(await stagePreimageManifest({env,event:event(),policy,fetchImpl}),null);
 assert.equal(await stagePreimageManifest({env,event:event('opened'),policy,fetchImpl}),null);
 assert.equal(calls,0);
});

test('late-label intake rejects unrelated labels, foreign owner, foreign actor, missing label and edits',async()=>{
 const invalid=[
  {env,event:event('labeled','other')},
  {env,event:event('labeled','pc-job','another-user')},
  {env:{...env,GITHUB_ACTOR:'another-user'},event:event()},
  {env,event:{...event(),issue:{...event().issue,labels:[]}}},
  {env,event:event('edited')},
  {env,event:{...event(),repository:{private:false}}},
 ];
 for(const testCase of invalid)
  await assert.rejects(stagePreimageManifest({...testCase,policy}),{code:'PREIMAGE_STAGE_EVENT_STOP'});
});

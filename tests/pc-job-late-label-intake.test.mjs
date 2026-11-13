import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {executeJob} from '../controller/engine.mjs';
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

test('repeated labeled delivery reuses existing requestId ledger without another worker execution',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'pc-late-label-repeat-'));
 try{
  const approvedPolicy={controlRepository:'ansqhd5774-Choi/zgmini-pc-control',
   sourceRepository:'ansqhd5774-Choi/zgmini',seats:6,
   operations:{'core-runtime-source-readonly':{grade:'A',resource:'light',timeoutSeconds:60}}};
  const host={controllerSourceSha:'b'.repeat(40),dataRoot:path.join(root,'data')};
  const ledger=path.join(root,'ledger',request.requestId+'.json');
  fs.mkdirSync(path.dirname(ledger),{recursive:true});
  const digest=createHash('sha256').update(JSON.stringify(request)).digest('hex');
  const prior={status:'PASS',code:'CORE_READONLY_DIAGNOSIS',
   lastPass:'ALLOWLISTED_OPERATION_COMPLETED',firstFail:null};
  fs.writeFileSync(ledger,JSON.stringify({payloadSha:digest,report:prior}),{flag:'wx'});
  for(const runId of ['999901','999902']){
   const outcome=await executeJob(request,{root,policy:approvedPolicy,host,seat:1,runId});
   assert.equal(outcome.report.reused,true);
   assert.equal(outcome.report.reuseCode,'DUPLICATE_REUSED_NO_EXECUTION');
   assert.equal(outcome.report.code,prior.code);
   assert.equal(outcome.report.status,'PASS');
   assert.equal(outcome.report.operationalWrites,0);
   assert.equal(fs.existsSync(path.join(outcome.workspace,'worker-result.json')),false);
   assert.equal(fs.existsSync(outcome.file),true);
  }
  const changed={...request,sourceSha:'c'.repeat(40)};
  const refused=await executeJob(changed,{root,policy:approvedPolicy,host,seat:1,runId:'999903'});
  assert.equal(refused.report.status,'BLOCKED');
  assert.equal(refused.report.code,'DUPLICATE_REQUEST_PAYLOAD_CHANGED');
  assert.equal(fs.existsSync(path.join(refused.workspace,'worker-result.json')),false);
  assert.deepEqual(JSON.parse(fs.readFileSync(ledger,'utf8')),{payloadSha:digest,report:prior});
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('preimage intake accepts labeled pc-job A without inventing scope or issuing network fetch',async()=>{
 let calls=0;
 const fetchImpl=async()=>{calls++;throw Error('should not fetch')};
 assert.equal(await stagePreimageManifest({env,event:event(),policy,fetchImpl}),null);
 assert.equal(await stagePreimageManifest({env,event:event('opened'),policy,fetchImpl}),null);
 assert.equal(calls,0);
});

test('labeled scoped preimage stages only approved hash-bound bytes without token forwarding',async()=>{
 const {createHash}=await import('node:crypto');
 const approval={schema:'ZGMINI_WRITER_PREIMAGE_SCOPE_APPROVAL_V1',status:'APPROVED_A_READONLY',
  scope:'PC_WRITER_APPROVED_SOURCE_PREIMAGE',sourceRoot:'projects/zgmini-earnings-history-pc-release',
  files:[{path:'scripts/pc-writer/run-local.mjs',change:'M'}],allowOtherPaths:false};
 const bytes=Buffer.from(JSON.stringify(approval));
 const hash=createHash('sha256').update(bytes).digest('hex');
 const scoped={...request,operation:'writer-install-preimage-readonly',
  preimageManifestPath:'approvals/writer-preimage/inflation-candidates-7-r1.json',
  preimageManifestSha256:hash};
 const labeled=event();labeled.issue.body=JSON.stringify(scoped);
 const token='test-only-scoped-preimage-credential-00001';
 let calls=0,observedUrl='';
 const staged=await stagePreimageManifest({env:{...env,GITHUB_SHA:'b'.repeat(40),GITHUB_TOKEN:token},
  event:labeled,policy:{...policy,operations:{...policy.operations,'writer-install-preimage-readonly':{grade:'A'}}},
  fetchImpl:async(url,options)=>{
   calls++;observedUrl=url;
   assert.equal(options.method,'GET');
   assert.equal(options.headers.Authorization,'Bearer '+token);
   return {ok:true,text:async()=>JSON.stringify({type:'file',encoding:'base64',content:bytes.toString('base64')})};
  }});
 assert.equal(calls,1);
 assert.equal(new URL(observedUrl).searchParams.get('ref'),'b'.repeat(40));
 assert.equal(staged.manifestSha256,hash);
 assert.equal(JSON.stringify(staged).includes(token),false);
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

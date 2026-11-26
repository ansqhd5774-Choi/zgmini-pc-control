import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {test} from 'node:test';
import {manifestFingerprint,validateControllerImportClosure,controllerImportScanRoots} from '../tools/maintenance-contract.mjs';
import {prepareMaintenanceIssue,verifyMaintenanceIssue,submitMaintenanceIssue,submitPreparedMaintenanceIssue,submitCiPreparedMaintenanceIssue,submitExistingControllerApprovalFromCi,createCiEffectReceiptStore,reconcileMaintenanceIssue,main} from '../tools/maintenance-request.mjs';
const OLD='a'.repeat(40),NEXT='b'.repeat(40),OWNER='ansqhd5774-Choi';
function manifest(){
 const allowFiles=[{path:'controller/operations.mjs',sha256:'c'.repeat(64)}];
 return Buffer.from(JSON.stringify({schema:'ZGMINI_PC_UPDATE_V1',installedSha:OLD,targetSha:NEXT,
  allowFiles,purpose:'pc-controller-maintenance',approval:{grade:'B',ref:'https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/28',scope:'PC_CONTROL_CONTROLLER_UPDATE'},
  checks:{targetSha:NEXT,status:'PASS',manifestSha256:manifestFingerprint(allowFiles).sha256},
  backup:{strategy:'VERSIONED_SNAPSHOT',rollback:{kind:'RESTORE_INSTALLED_SHA',sha:OLD}},
  postOperation:'core-status',postSourceBranch:'main',postSourceSha:NEXT}));
}
function setup(){
 const expected=prepareMaintenanceIssue(manifest(),{installedSha:OLD});
 const actual={number:42,state:'open',user:{login:OWNER},title:expected.title,body:expected.body,labels:expected.labels.map(name=>({name}))};
 let saved=null,posts=0;const writes=[];
 const ports={createIssue:async envelope=>{posts++;assert.deepEqual(envelope,expected);return {number:42}},readIssue:async()=>actual,
  saveReceipt:async(r,{exclusive=false}={})=>{if(exclusive&&saved)throw Error('EEXIST');saved=structuredClone(r);writes.push(structuredClone(r));}};
 return {expected,actual,ports,writes,get saved(){return saved},get posts(){return posts}};
}
test('one envelope includes fixed title/label and reuses original manifest validation',()=>{
 const f=setup();assert.equal(f.expected.title,'pc-controller-update');assert.deepEqual(f.expected.labels,['pc-maintenance']);
 assert.equal(JSON.parse(f.expected.body).targetControllerSha,NEXT);
 assert.throws(()=>prepareMaintenanceIssue(manifest(),{installedSha:OLD,chatId:'chat-../bad'}),/CHAT_ID_INVALID/);
 assert.throws(()=>prepareMaintenanceIssue(manifest(),{installedSha:NEXT}),/INSTALLED_SOURCE_DRIFT/);
 const bad=JSON.parse(manifest());bad.approval.grade='A';
 assert.throws(()=>prepareMaintenanceIssue(Buffer.from(JSON.stringify(bad)),{installedSha:OLD}),/B_APPROVAL_REQUIRED/);
});
test('persist-before-POST, exactly one creation and independent GET readback',async()=>{
 const f=setup();const create=f.ports.createIssue;
 f.ports.createIssue=async e=>{assert.equal(f.saved.phase,'CREATING');return create(e)};
 const result=await submitMaintenanceIssue(f.expected,f.ports);
 assert.equal(result.status,'REQUEST_READBACK_VERIFIED');assert.equal(result.execution,'NOT_ASSERTED');
 assert.equal(f.posts,1);assert.equal(f.saved.phase,'READBACK_VERIFIED');
 await assert.rejects(()=>submitMaintenanceIssue(f.expected,f.ports),/EEXIST/);assert.equal(f.posts,1);
});
test('lost create response reconciles the same Issue without another POST',async()=>{
 const f=setup();let attempts=0;
 f.ports.createIssue=async()=>{attempts++;throw Error('timeout after commit')};
 assert.equal((await submitMaintenanceIssue(f.expected,f.ports)).code,'MAINTENANCE_CREATE_OUTCOME_UNKNOWN');
 const result=await reconcileMaintenanceIssue(f.saved,{...f.ports,findIssues:async()=>[f.actual]});
 assert.equal(result.issueNumber,42);assert.equal(attempts,1);
});
test('missing or duplicate search matches never cause request recreation',async()=>{
 const f=setup();const r={schema:'ZGMINI_MAINTENANCE_SUBMISSION_V1',expected:f.expected,issueNumber:null};
 assert.equal((await reconcileMaintenanceIssue(r,{...f.ports,findIssues:async()=>[]})).code,'MAINTENANCE_REQUEST_NOT_FOUND_NO_REPOST');
 assert.equal((await reconcileMaintenanceIssue(r,{...f.ports,findIssues:async()=>[f.actual,{...f.actual,number:43}]})).code,'MAINTENANCE_MULTIPLE_MATCHES_NO_REPOST');assert.equal(f.posts,0);
});
test('readback mismatch retains original Issue and permits only read reconciliation',async()=>{
 const f=setup();f.actual.labels=[];
 const result=await submitMaintenanceIssue(f.expected,f.ports);
 assert.equal(result.code,'MAINTENANCE_CREATED_ISSUE_NOT_VERIFIED');assert.equal(result.issueNumber,42);assert.equal(f.posts,1);
 assert.equal(result.firstFail,'MAINTENANCE_ISSUE_READBACK_LABEL_MISSING');
 f.actual.labels=[{name:'pc-maintenance'}];
 assert.equal((await reconcileMaintenanceIssue(f.saved,f.ports)).status,'REQUEST_READBACK_VERIFIED');assert.equal(f.posts,1);
});
test('title/body/author/label/state/PR substitutions cannot pass readback',()=>{
 for(const [patch,code] of [[{title:'wrong'},'TITLE_MISMATCH'],[{body:'{}'},'BODY_MISMATCH'],[{user:{login:'other'}},'ACTOR_MISMATCH'],[{labels:[]},'LABEL_MISSING'],[{state:'closed'},'STATE_MISMATCH'],[{pull_request:{}},'TYPE_MISMATCH']]){
  const f=setup();assert.throws(()=>verifyMaintenanceIssue(f.expected,{...f.actual,...patch}),new RegExp('READBACK_'+code));
 }
});
test('read-only reconciliation permits completed closed Issue without relaxing new submission state',async()=>{
 const f=setup();f.actual.state='closed';
 assert.throws(()=>verifyMaintenanceIssue(f.expected,f.actual),/STATE_MISMATCH/);
 assert.equal(verifyMaintenanceIssue(f.expected,f.actual,{allowClosed:true}).execution,'NOT_ASSERTED');
 const receipt={schema:'ZGMINI_MAINTENANCE_SUBMISSION_V1',expected:f.expected,issueNumber:42};
 assert.equal((await reconcileMaintenanceIssue(receipt,f.ports)).execution,'NOT_ASSERTED');assert.equal(f.posts,0);
});
test('unknown fields and invalid CLI combinations fail before external access',async()=>{
 await assert.rejects(()=>main(['verify','--issue-number','1','--manifest-file','x']),/USAGE/);
 await assert.rejects(()=>main(['verify','--issue-number','1;bad']),/USAGE/);
 await assert.rejects(()=>main(['reconcile']),/RECEIPT_PATH_REQUIRED/);
 await assert.rejects(()=>main(['prepare','--manifest-file','x','--target-sha',NEXT,'--installed-sha',OLD]),/USAGE/);
 await assert.rejects(()=>main(['prepare','--target-sha','../bad','--installed-sha',OLD]),/USAGE/);
});
test('existing target-tree check catches unchanged entry and transitive missing module without importing it',()=>{
 const files={'controller/entry.mjs':"import './dispatcher.mjs';",'controller/operations.mjs':'export {};','controller/dispatcher.mjs':"import './missing.mjs';"};
 const roots=controllerImportScanRoots(['config/operations.json']);
 assert.throws(()=>validateControllerImportClosure(Object.keys(files),roots,p=>files[p]),/CONTROLLER_IMPORT_MISSING/);
 files['controller/missing.mjs']="throw Error('MUST_NOT_EXECUTE');";
 assert.equal(validateControllerImportClosure(Object.keys(files),roots,p=>files[p]).status,'VERIFIED');
});
test('actual TEMP package missing dependency fails before simulated switch; complete dependency loads',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-package-regression-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 fs.writeFileSync(path.join(root,'entry.mjs'),"import './required.mjs';\n");
 const missing=spawnSync(process.execPath,[path.join(root,'entry.mjs')],{encoding:'utf8',windowsHide:true,timeout:5000});
 assert.notEqual(missing.status,0);assert.match(missing.stderr,/ERR_MODULE_NOT_FOUND/);
 fs.writeFileSync(path.join(root,'required.mjs'),'export const ready=true;\n');
 assert.equal(spawnSync(process.execPath,[path.join(root,'entry.mjs')],{encoding:'utf8',windowsHide:true,timeout:5000}).status,0);
});

function preparedPorts(f){
 return {...f.ports,installedSha:OLD,readIdentity:async()=>({login:OWNER}),readRepository:async()=>({private:true}),
 readManifest:async target=>{assert.equal(target,NEXT);return manifest();}};
}
test('prepared owner submission preserves exact request id and existing one-shot receipt',async()=>{
 const f=setup(),ports=preparedPorts(f);
 const original=JSON.parse(f.expected.body).requestId;
 assert.equal((await submitPreparedMaintenanceIssue(f.expected,ports)).requestId,original);
 assert.equal(f.saved.expected.body,f.expected.body);assert.equal(f.posts,1);
 await assert.rejects(()=>submitPreparedMaintenanceIssue(f.expected,ports),/EEXIST/);assert.equal(f.posts,1);
});
test('prepared bridge refuses non-owner and nonprivate repository without POST',async()=>{
 const f=setup(),p=preparedPorts(f);
 await assert.rejects(()=>submitPreparedMaintenanceIssue(f.expected,{...p,readIdentity:async()=>({login:'github-actions[bot]'})}),/IDENTITY_DENIED/);
 await assert.rejects(()=>submitPreparedMaintenanceIssue(f.expected,{...p,readRepository:async()=>({private:false})}),/IDENTITY_DENIED/);
 assert.equal(f.posts,0);assert.equal(f.saved,null);
});
test('prepared bridge refuses remote raw manifest mismatch and installation drift',async()=>{
 const f=setup(),p=preparedPorts(f);
 await assert.rejects(()=>submitPreparedMaintenanceIssue(f.expected,{...p,readManifest:async()=>Buffer.from(manifest().toString()+' ')}),/MANIFEST_PIN_MISMATCH/);
 await assert.rejects(()=>submitPreparedMaintenanceIssue(f.expected,{...p,installedSha:NEXT}),/INSTALLED_SOURCE_DRIFT/);
 assert.equal(f.posts,0);assert.equal(f.saved,null);
});
test('prepared bridge refuses candidate wrapper and invalid request shape',async()=>{
 const f=setup(),p=preparedPorts(f);
 await assert.rejects(()=>submitPreparedMaintenanceIssue({...f.expected,canPublish:false},p),/PREPARED_ENVELOPE_INVALID/);
 await assert.rejects(()=>submitPreparedMaintenanceIssue({...f.expected,body:'{}'},p));
 assert.equal(f.posts,0);
});
test('prepared bridge preserves unknown POST and uses same reconciliation',async()=>{
 const f=setup(),p=preparedPorts(f);let attempts=0;
 p.createIssue=async()=>{attempts++;throw Error('unknown response')};
 assert.equal((await submitPreparedMaintenanceIssue(f.expected,p)).code,'MAINTENANCE_CREATE_OUTCOME_UNKNOWN');
 assert.equal((await reconcileMaintenanceIssue(f.saved,{...p,findIssues:async()=>[f.actual]})).requestId,JSON.parse(f.expected.body).requestId);
 assert.equal(attempts,1);
});
test('prepared CLI rejects incomplete or mixed mode before IO',async()=>{
 await assert.rejects(()=>main(['submit-prepared','--prepared-file','x','--installed-sha',OLD]),/USAGE/);
 await assert.rejects(()=>main(['submit-prepared','--prepared-file','x','--target-sha',NEXT]),/USAGE/);
});

function ciPorts(f){
 const repo='ansqhd5774-Choi/zgmini-pc-control',head='d'.repeat(40);
 const pr={number:28,merged:true,base:{ref:'main',repo:{full_name:repo}},head:{sha:head,repo:{full_name:repo}}};
 const run={id:123,workflow_id:416355595,path:'.github/workflows/controller-maintenance-source-tests.yml',
  event:'pull_request',status:'completed',conclusion:'success',repository:{id:1442936296,full_name:repo},
  head_repository:{id:1442936296},head_sha:head};
 return {...preparedPorts(f),runId:123,readApprovalPr:async n=>{assert.equal(n,28);return pr;},
  readRun:async n=>{assert.equal(n,123);return run;},pr,run};
}
test('CI-selected existing approval uses regular owner submitter and original receipt',async()=>{
 const f=setup(),p=ciPorts(f);
 const r=await submitCiPreparedMaintenanceIssue(f.expected,p);
 assert.equal(r.status,'REQUEST_READBACK_VERIFIED');assert.equal(r.execution,'NOT_ASSERTED');
 assert.equal(f.posts,1);assert.equal(f.saved.expected.body,f.expected.body);
 await assert.rejects(()=>submitCiPreparedMaintenanceIssue(f.expected,p),/EEXIST/);assert.equal(f.posts,1);
});
for(const [name,edit] of [
 ['unmerged approval',p=>{p.pr.merged=false}],
 ['CI failure',p=>{p.run.conclusion='failure'}],
 ['different source',p=>{p.run.head_sha='e'.repeat(40)}],
 ['unrelated workflow',p=>{p.run.workflow_id=42}],
 ['foreign source',p=>{p.run.head_repository.id=42}]
])test('CI submitter refuses '+name+' before POST',async()=>{
 const f=setup(),p=ciPorts(f);edit(p);
 await assert.rejects(()=>submitCiPreparedMaintenanceIssue(f.expected,p),/CI_APPROVAL_SOURCE_MISMATCH/);
 assert.equal(f.posts,0);assert.equal(f.saved,null);
});
test('CI token is not owner authority',async()=>{
 const f=setup(),p=ciPorts(f);p.readIdentity=async()=>({login:'github-actions[bot]'});
 await assert.rejects(()=>submitCiPreparedMaintenanceIssue(f.expected,p),/IDENTITY_DENIED/);
 assert.equal(f.posts,0);assert.equal(f.saved,null);
});
test('approval drift during CI handoff stops regular submission',async()=>{
 const f=setup(),p=ciPorts(f);let reads=0;
 p.readManifest=async()=>++reads===1?manifest():Buffer.from(manifest().toString()+' ');
 await assert.rejects(()=>submitCiPreparedMaintenanceIssue(f.expected,p),/MANIFEST_PIN_MISMATCH/);
 assert.equal(f.posts,0);assert.equal(f.saved,null);
});

test('CI CLI calls the existing owner submitter using the exact original receipt',async t=>{
 const f=setup(),p=ciPorts(f);
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-ci-submit-test-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const prepared=path.join(dir,'prepared.json'),receipt=path.join(dir,'receipt.json');
 fs.writeFileSync(prepared,JSON.stringify(f.expected));
 const repo='repos/ansqhd5774-Choi/zgmini-pc-control';
 let posts=0;
 const githubApi=(route,options)=>{
  if(route==='user')return {login:OWNER};
  if(route===repo)return {private:true};
  if(route.startsWith('search/issues?'))return {total_count:0,incomplete_results:false,items:[]};
  if(route===repo+'/pulls/28')return p.pr;
  if(route===repo+'/actions/runs/123')return p.run;
  if(route.startsWith(repo+'/contents/approvals/controller-updates/'))return {encoding:'base64',content:manifest().toString('base64')};
  if(route===repo+'/issues'&&options?.body){
   posts++;assert.equal(JSON.parse(fs.readFileSync(receipt,'utf8')).phase,'CREATING');
   assert.deepEqual(options.body,{title:f.expected.title,labels:f.expected.labels,body:f.expected.body});
   return {number:42};
  }
  if(route===repo+'/issues/42')return f.actual;
  throw Error('unexpected API route');
 };
 const argv=['submit-ci-prepared','--prepared-file',prepared,'--installed-sha',OLD,'--receipt-file',receipt,'--run-id','123'];
 const result=await main(argv,{githubApi});
 assert.equal(result.status,'REQUEST_READBACK_VERIFIED');
 assert.equal(posts,1);
 assert.equal(JSON.parse(fs.readFileSync(receipt,'utf8')).expected.body,f.expected.body);
 await assert.rejects(()=>main(argv,{githubApi}),/RECEIPT_EXISTS_USE_RECONCILE/);
 assert.equal(posts,1);
});
test('CI CLI rejects malformed and oversized explicit run id before IO',async()=>{
 const args=['submit-ci-prepared','--prepared-file','missing','--installed-sha',OLD,'--receipt-file','missing'];
 const githubApi=()=>{throw Error('unexpected API call')};
 for(const suffix of [['--run-id','1;bad'],['--run-id','9007199254740992']]){
  await assert.rejects(()=>main([...args,...suffix],{githubApi}),/MAINTENANCE_REQUEST_USAGE/);
 }
});

test('approval publication can resolve exact source CI without a supplied run ID',async()=>{
 const f=setup(),p=ciPorts(f);delete p.runId;
 p.listRuns=async head=>{assert.equal(head,p.pr.head.sha);return {workflow_runs:[
  {...p.run,id:124,head_sha:'e'.repeat(40)},{...p.run,id:125,conclusion:'failure'},p.run]};};
 const result=await submitCiPreparedMaintenanceIssue(f.expected,p);
 assert.equal(result.status,'REQUEST_READBACK_VERIFIED');assert.equal(f.posts,1);
});
test('no matching successful CI does not issue a request',async()=>{
 const f=setup(),p=ciPorts(f);delete p.runId;
 p.listRuns=async()=>({workflow_runs:[{...p.run,conclusion:'failure'}]});
 await assert.rejects(()=>submitCiPreparedMaintenanceIssue(f.expected,p),/CI_SUCCESS_NOT_FOUND/);
 assert.equal(f.posts,0);assert.equal(f.saved,null);
});
test('listed success must survive exact independent run readback',async()=>{
 const f=setup(),p=ciPorts(f);delete p.runId;
 p.listRuns=async()=>({workflow_runs:[p.run]});
 p.readRun=async()=>({...p.run,conclusion:'cancelled'});
 await assert.rejects(()=>submitCiPreparedMaintenanceIssue(f.expected,p),/CI_APPROVAL_SOURCE_MISMATCH/);
 assert.equal(f.posts,0);assert.equal(f.saved,null);
});

test('CI with a missing receipt recovers an already closed exact request without checking obsolete installed SHA or posting',async()=>{
 const f=setup(),p=ciPorts(f);
 p.findIssues=async id=>{assert.equal(id,JSON.parse(f.expected.body).requestId);return [{...f.actual,state:'closed'}];};
 p.readIssue=async n=>{assert.equal(n,f.actual.number);return {...f.actual,state:'closed'};};
 p.readManifest=async()=>{throw Error('historical approval need not be current');};
 p.installedSha=NEXT;
 const result=await submitCiPreparedMaintenanceIssue(f.expected,p);
 assert.equal(result.recoveredExistingRequest,true);assert.equal(result.execution,'NOT_ASSERTED');
 assert.equal(f.saved.issueNumber,f.actual.number);assert.equal(f.saved.phase,'READBACK_VERIFIED');assert.equal(f.posts,0);
});
test('same request identity with a different body cannot cause a fresh CI POST',async()=>{
 const f=setup(),p=ciPorts(f);
 const body=JSON.stringify({...JSON.parse(f.actual.body),targetControllerSha:OLD});
 p.findIssues=async()=>[{...f.actual,body}];
 const result=await submitCiPreparedMaintenanceIssue(f.expected,p);
 assert.equal(result.code,'MAINTENANCE_EXISTING_REQUEST_CONFLICT');assert.equal(f.posts,0);assert.equal(f.saved,null);
});
test('incomplete existing-request search does not authorize a fresh CI POST',async()=>{
 const f=setup(),p=ciPorts(f);
 p.findIssues=async()=>{throw Error('MAINTENANCE_SEARCH_INCOMPLETE_NO_REPOST');};
 await assert.rejects(()=>submitCiPreparedMaintenanceIssue(f.expected,p),/SEARCH_INCOMPLETE_NO_REPOST/);
 assert.equal(f.posts,0);assert.equal(f.saved,null);
});

function workloadPublisherFixture(){
 const repo='ansqhd5774-Choi/zgmini-pc-control',head='d'.repeat(40),merged='e'.repeat(40);
 const m=JSON.parse(manifest());m.controllerOnlyInstall=true;
 m.selectiveSource={schema:'ZGMINI_CONTROLLER_SELECTIVE_SOURCE_V1',branch:'codex/example-selective',mainSha:head,customPaths:[]};
 const bytes=Buffer.from(JSON.stringify(m)),owner={login:OWNER,id:327938088,type:'User'};
 const pr={number:28,merged:true,merged_by:owner,merge_commit_sha:merged,base:{ref:'main',repo:{full_name:repo}},head:{sha:head,repo:{full_name:repo}}};
 const run={id:123,workflow_id:416355595,path:'.github/workflows/controller-maintenance-source-tests.yml',
  event:'pull_request',status:'completed',conclusion:'success',repository:{id:1442936296,full_name:repo},
  head_repository:{id:1442936296},head_sha:head};
 const f={input:{targetSha:NEXT,approvalSha256:createHash('sha256').update(bytes).digest('hex'),runId:456,attempt:1},
  bytes,pr,run,owner,posts:0,saved:null,actual:null,prior:[]};
 f.ports={readRepository:async()=>({id:1442936296,full_name:repo,private:true,owner}),
  readManifest:async()=>f.bytes,readMergedManifest:async()=>f.bytes,readApprovalPr:async()=>pr,
  listRuns:async()=>({workflow_runs:[run]}),readRun:async()=>run,
  loadReceipt:async()=>f.saved,findPriorRequests:async()=>f.prior,
  saveReceipt:async(key,r,{exclusive=false}={})=>{assert.match(key,/^[a-f0-9]{64}$/);if(exclusive&&f.saved)throw Error('EEXIST');f.saved=structuredClone(r);},
  createIssue:async e=>{f.posts++;assert.equal(f.saved.phase,'CREATING');f.actual={number:42,state:'open',
   user:{login:'github-actions[bot]',id:41898282,type:'Bot'},title:e.title,body:e.body,labels:e.labels.map(name=>({name}))};return {number:42};},
  readIssue:async()=>f.actual};
 return f;
}
test('CI publisher creates exact existing B request once and records request-bound receipt',async()=>{
 const f=workloadPublisherFixture(),result=await submitExistingControllerApprovalFromCi(f.input,f.ports);
 assert.equal(result.status,'REQUEST_READBACK_VERIFIED');assert.equal(f.posts,1);
 assert.equal(f.saved.phase,'READBACK_VERIFIED');assert.match(result.receiptMarker,/^ZGMINI_CI_CONTROLLER_B_RECEIPT=42:[a-f0-9]{64}$/);
 assert.equal(JSON.parse(f.actual.body).chatId,'chat-ci-456-1');
 const retry=await submitExistingControllerApprovalFromCi({...f.input,runId:789},f.ports);
 assert.equal(retry.status,'EXISTING_REQUEST_REUSED');assert.deepEqual(retry.issueNumbers,[42]);
 assert.equal(f.posts,1);
 assert.equal(retry.effectKey,result.effectKey);assert.equal(retry.receiptMarker,undefined);
});
test('CI previously verified original request remains reusable after closure',async()=>{
 const f=workloadPublisherFixture();
 await submitExistingControllerApprovalFromCi(f.input,f.ports);
 f.actual.state='closed';
 const result=await submitExistingControllerApprovalFromCi({...f.input,runId:789},f.ports);
 assert.equal(result.status,'EXISTING_REQUEST_REUSED');
 assert.deepEqual(result.issueNumbers,[42]);assert.equal(f.posts,1);
 assert.equal(result.receiptMarker,undefined);
});
test('CI non-verified or drifted receipt cannot claim a reused request',async()=>{
 const mutations=[
  f=>{f.saved.phase='CREATION_UNKNOWN';},
  f=>{f.saved.phase='READBACK_PENDING';},
  f=>{f.saved.expected.body=JSON.stringify({...JSON.parse(f.saved.expected.body),
   approvalManifestSha256:'f'.repeat(64)});},
  f=>{f.actual.body='{}';},
  f=>{f.actual.user={login:'ansqhd5774-Choi',id:327938088,type:'User'};},
  f=>{f.actual.number=73;},
  f=>{f.ports.readIssue=async()=>{throw Error('read unavailable')};}
 ];
 for(const mutate of mutations){
  const f=workloadPublisherFixture();
  await submitExistingControllerApprovalFromCi(f.input,f.ports);
  mutate(f);
  const result=await submitExistingControllerApprovalFromCi({...f.input,runId:789},f.ports);
  assert.equal(result.status,'STATE_UNKNOWN');
  assert.equal(result.code,'MAINTENANCE_CI_EXISTING_RECEIPT_NO_REPOST');
  assert.equal(result.receiptMarker,undefined);assert.equal(f.posts,1);
 }
});
test('existing manual request with matching manifest is reused without issuing a CI receipt',async()=>{
 const f=workloadPublisherFixture();
 const original=prepareMaintenanceIssue(f.bytes,{installedSha:OLD,chatId:'chat-ci-123-1'});
 f.prior=[{number:123,state:'closed',user:f.owner,title:'pc-controller-update',
  body:original.body,labels:[{name:'pc-maintenance'}]}];
 const result=await submitExistingControllerApprovalFromCi(f.input,f.ports);
 assert.equal(result.status,'EXISTING_REQUEST_REUSED');assert.deepEqual(result.issueNumbers,[123]);assert.equal(f.posts,0);
});
test('CI reuse accepts legacy pc-UUID using the established envelope schema',async()=>{
 const f=workloadPublisherFixture();
 const previous=JSON.parse(prepareMaintenanceIssue(f.bytes,{installedSha:OLD,chatId:'chat-ci-123-1'}).body);
 previous.requestId=previous.requestId.replace(/^pc-update-/,'pc-');
 f.prior=[{number:123,state:'closed',user:f.owner,title:'pc-controller-update',
  body:JSON.stringify(previous),labels:[{name:'pc-maintenance'}]}];
 const result=await submitExistingControllerApprovalFromCi(f.input,f.ports);
 assert.equal(result.status,'EXISTING_REQUEST_REUSED');assert.deepEqual(result.issueNumbers,[123]);assert.equal(f.posts,0);
});
test('CI reuse rejects malformed historical request identity without a new POST',async()=>{
 const f=workloadPublisherFixture();
 const previous=JSON.parse(prepareMaintenanceIssue(f.bytes,{installedSha:OLD,chatId:'chat-ci-123-1'}).body);
 previous.requestId='pc-update-unsafe';
 f.prior=[{number:123,state:'closed',user:f.owner,title:'pc-controller-update',
  body:JSON.stringify(previous),labels:[{name:'pc-maintenance'}]}];
 const result=await submitExistingControllerApprovalFromCi(f.input,f.ports);
 assert.equal(result.status,'STATE_UNKNOWN');
 assert.equal(result.code,'MAINTENANCE_CI_PRIOR_EFFECT_UNVERIFIED_NO_REPOST');
 assert.equal(f.posts,0);assert.equal(f.saved,null);
});
test('CI reuse never reports success for a different manifest with the same target SHA',async()=>{
 const f=workloadPublisherFixture();
 const original=JSON.parse(prepareMaintenanceIssue(f.bytes,{installedSha:OLD,chatId:'chat-ci-123-1'}).body);
 original.approvalManifestSha256='f'.repeat(64);
 f.prior=[{number:123,state:'closed',user:f.owner,title:'pc-controller-update',
  body:JSON.stringify(original),labels:[{name:'pc-maintenance'}]}];
 const result=await submitExistingControllerApprovalFromCi(f.input,f.ports);
 assert.equal(result.status,'STATE_UNKNOWN');
 assert.equal(result.code,'MAINTENANCE_CI_PRIOR_EFFECT_UNVERIFIED_NO_REPOST');
 assert.deepEqual(result.issueNumbers,[123]);assert.equal(f.posts,0);assert.equal(f.saved,null);
});
test('CI reuse does not submit or falsely succeed on incomplete or mixed prior Issues',async()=>{
 const f=workloadPublisherFixture();
 const valid=prepareMaintenanceIssue(f.bytes,{installedSha:OLD,chatId:'chat-ci-123-1'});
 const original={number:123,state:'closed',user:f.owner,title:'pc-controller-update',
  body:valid.body,labels:[{name:'pc-maintenance'}]};
 const incomplete={...original,number:124,body:JSON.stringify({targetControllerSha:NEXT})};
 for(const list of [[incomplete],[original,incomplete],[{...original,labels:[]}]]) {
  f.prior=list;
  const result=await submitExistingControllerApprovalFromCi(f.input,f.ports);
  assert.equal(result.status,'STATE_UNKNOWN');assert.equal(result.code,'MAINTENANCE_CI_PRIOR_EFFECT_UNVERIFIED_NO_REPOST');
  assert.equal(f.posts,0);assert.equal(f.saved,null);
 }
});
test('CI lost POST response may recover exact bot Issue in its original successful run',async()=>{
 const f=workloadPublisherFixture(),create=f.ports.createIssue;
 f.ports.createIssue=async e=>{await create(e);throw Error('response lost');};
 // Before creation the inventory is empty. After the lost response it may
 // contain the original Issue: this remains a read-only same-run recovery.
 f.ports.findPriorRequests=async()=>f.actual?[f.actual]:[];
 const result=await submitExistingControllerApprovalFromCi(f.input,f.ports);
 assert.equal(result.status,'REQUEST_READBACK_VERIFIED');
 assert.equal(result.issueNumber,42);assert.equal(f.saved.phase,'READBACK_VERIFIED');
 assert.match(result.receiptMarker,/^ZGMINI_CI_CONTROLLER_B_RECEIPT=42:[a-f0-9]{64}$/);
 const later=await submitExistingControllerApprovalFromCi({...f.input,runId:900},f.ports);
 assert.equal(later.status,'EXISTING_REQUEST_REUSED');
 assert.deepEqual(later.issueNumbers,[42]);
 assert.equal(later.receiptMarker,undefined);assert.equal(f.posts,1);
});
test('CI first readback failure can recover the same bot Issue without another POST',async()=>{
 const f=workloadPublisherFixture(),read=f.ports.readIssue;let reads=0;
 f.ports.readIssue=async()=>{reads++;if(reads===1)throw Error('readback temporarily unavailable');return read();};
 const result=await submitExistingControllerApprovalFromCi(f.input,f.ports);
 assert.equal(result.status,'REQUEST_READBACK_VERIFIED');
 assert.equal(result.issueNumber,42);assert.equal(reads,2);
 assert.equal(f.saved.phase,'READBACK_VERIFIED');
 assert.equal(f.posts,1);assert.match(result.receiptMarker,/^ZGMINI_CI_CONTROLLER_B_RECEIPT=42:/);
});
test('CI uncertain recovery rejects multiple candidates or wrong actor without new POST or marker',async()=>{
 for(const corrupt of [
  f=>[f.actual,{...f.actual,number:43}],
  f=>[{...f.actual,user:f.owner}]
 ]){
  const f=workloadPublisherFixture(),create=f.ports.createIssue;
  f.ports.createIssue=async e=>{await create(e);throw Error('response lost');};
  f.ports.findPriorRequests=async()=>f.actual?corrupt(f):[];
  const result=await submitExistingControllerApprovalFromCi(f.input,f.ports);
  assert.equal(result.status,'STATE_UNKNOWN');assert.equal(result.code,'MAINTENANCE_CREATE_OUTCOME_UNKNOWN');
  assert.equal(result.receiptMarker,undefined);assert.equal(f.saved.phase,'CREATION_UNKNOWN');
  assert.equal(f.posts,1);
 }
});
test('unknown CI POST preserves original durable receipt and forbids retry',async()=>{
 const f=workloadPublisherFixture();f.ports.createIssue=async()=>{f.posts++;throw Error('lost response');};
 assert.equal((await submitExistingControllerApprovalFromCi(f.input,f.ports)).code,'MAINTENANCE_CREATE_OUTCOME_UNKNOWN');
 assert.equal(f.saved.phase,'CREATION_UNKNOWN');
 assert.equal((await submitExistingControllerApprovalFromCi(f.input,f.ports)).code,'MAINTENANCE_CI_EXISTING_RECEIPT_NO_REPOST');
 assert.equal(f.posts,1);
});
for(const [name,edit,code] of [
 ['untrusted merger',f=>{f.pr.merged_by={login:'github-actions[bot]'}},'EXISTING_APPROVAL_PROVENANCE_DENIED'],
 ['changed approval bytes',f=>{f.ports.readMergedManifest=async()=>Buffer.from('{}')},'EXISTING_APPROVAL_BYTES_MISMATCH'],
 ['failed CI',f=>{f.run.conclusion='failure'},'CI_SUCCESS_NOT_FOUND'],
 ['prior inventory unavailable',f=>{f.ports.findPriorRequests=async()=>null},'PRIOR_REQUEST_READ_UNVERIFIED']
])test('CI publisher denies '+name,async()=>{
 const f=workloadPublisherFixture();edit(f);
 await assert.rejects(()=>submitExistingControllerApprovalFromCi(f.input,f.ports),new RegExp(code));assert.equal(f.posts,0);
});
test('CI publisher never records identity for wrong issue readback',async()=>{
 const f=workloadPublisherFixture();f.ports.readIssue=async()=>({...f.actual,user:f.owner});
 const result=await submitExistingControllerApprovalFromCi(f.input,f.ports);
 assert.equal(result.code,'MAINTENANCE_CREATED_ISSUE_NOT_VERIFIED');assert.equal(result.receiptMarker,undefined);assert.equal(f.posts,1);
});

test('CI effect claim rejects volatile runner directories before creating any receipt',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-ci-volatile-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 for(const candidate of [root,path.dirname(root)]){
  assert.throws(()=>createCiEffectReceiptStore(root,{volatileRoots:[candidate]}),
   /MAINTENANCE_CI_RECEIPT_ROOT_VOLATILE/);
 }
 // A similarly named but unrelated path must not suppress a durable root.
 assert.doesNotThrow(()=>createCiEffectReceiptStore(root,{
  volatileRoots:[root+'-unrelated',path.join(root,'child')]}));
 const entry=fs.readFileSync(new URL('../ci-approval/completed-run-intake.mjs',import.meta.url),'utf8');
 assert.match(entry,/volatileRoots:\[process\.env\.RUNNER_TEMP,process\.env\.GITHUB_WORKSPACE,/);
 assert.match(entry,/process\.env\.TEMP,process\.env\.TMP\]/);
});

test('durable effect receipt survives independent submitter instances and preserves original POST',async t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-ci-effect-test-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const f=workloadPublisherFixture(),store=createCiEffectReceiptStore(root);
 // Use the actual durable claim in the POST assertion, not the fixture's
 // in-memory receipt slot (which is intentionally not used by this store).
 f.ports.createIssue=async e=>{
  f.posts++;
  const files=fs.readdirSync(root).filter(name=>/^[a-f0-9]{64}\.json$/.test(name));
  assert.equal(files.length,1);
  const claimed=store.loadReceipt(files[0].slice(0,-5));
  assert.equal(claimed.phase,'CREATING');assert.deepEqual(claimed.expected,e);
  f.actual={number:42,state:'open',user:{login:'github-actions[bot]',id:41898282,type:'Bot'},
   title:e.title,body:e.body,labels:e.labels.map(name=>({name}))};
  return {number:42};
 };
 const first=await submitExistingControllerApprovalFromCi(f.input,{...f.ports,...store});
 assert.equal(first.status,'REQUEST_READBACK_VERIFIED');assert.equal(f.posts,1);
 const secondStore=createCiEffectReceiptStore(root);
 const retry=await submitExistingControllerApprovalFromCi({...f.input,runId:999},{...f.ports,...secondStore});
 assert.equal(retry.status,'EXISTING_REQUEST_REUSED');assert.deepEqual(retry.issueNumbers,[42]);
 assert.equal(f.posts,1);assert.equal(retry.receiptMarker,undefined);
 assert.equal(secondStore.loadReceipt(first.effectKey).issueNumber,42);
});
test('exclusive receipt claim survives an uncertain POST with no auto replay',async t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-ci-effect-test-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const f=workloadPublisherFixture();
 f.ports.createIssue=async()=>{f.posts++;throw Error('lost');};
 const first=await submitExistingControllerApprovalFromCi(f.input,{...f.ports,...createCiEffectReceiptStore(root)});
 assert.equal(first.code,'MAINTENANCE_CREATE_OUTCOME_UNKNOWN');
 const retry=await submitExistingControllerApprovalFromCi(f.input,{...f.ports,...createCiEffectReceiptStore(root)});
 assert.equal(retry.code,'MAINTENANCE_CI_EXISTING_RECEIPT_NO_REPOST');assert.equal(f.posts,1);
});
test('existing receipt cannot be overwritten by a fresh exclusive claim or changed request',async t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-ci-effect-test-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const store=createCiEffectReceiptStore(root),f=setup(),key='a'.repeat(64);
 const receipt={schema:'ZGMINI_MAINTENANCE_SUBMISSION_V1',phase:'CREATING',expected:f.expected,issueNumber:null};
 store.saveReceipt(key,receipt,{exclusive:true});
 assert.throws(()=>store.saveReceipt(key,receipt,{exclusive:true}),/EEXIST/);
 const changed={...receipt,expected:setup().expected};
 assert.throws(()=>store.saveReceipt(key,changed),/IDENTITY_DRIFT/);
 assert.deepEqual(store.loadReceipt(key),receipt);
});
test('CI receipt store rejects an alias in any parent of a real leaf directory',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-ci-effect-parent-test-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const real=path.join(root,'real'),receipts=path.join(real,'receipts');
 fs.mkdirSync(real);fs.mkdirSync(receipts);
 // The legitimate, directly addressed directory must remain usable.
 assert.doesNotThrow(()=>createCiEffectReceiptStore(receipts));
 const alias=path.join(root,'alias');
 try{fs.symlinkSync(real,alias,process.platform==='win32'?'junction':'dir');}
 catch(error){
  if(['EPERM','EACCES','ENOTSUP'].includes(error?.code)){t.diagnostic('OS denies link creation');return;}
  throw error;
 }
 // lstat(alias/receipts) is a plain directory, unlike its aliased parent.
 assert.equal(fs.lstatSync(path.join(alias,'receipts')).isDirectory(),true);
 assert.equal(fs.lstatSync(path.join(alias,'receipts')).isSymbolicLink(),false);
 assert.throws(()=>createCiEffectReceiptStore(path.join(alias,'receipts')),
  /MAINTENANCE_CI_RECEIPT_ROOT_UNVERIFIED/);
});

test('missing root, invalid effect key and corrupt receipt are not a new effect',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-ci-effect-test-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 assert.throws(()=>createCiEffectReceiptStore(path.join(root,'missing')));
 const store=createCiEffectReceiptStore(root),key='b'.repeat(64);
 assert.throws(()=>store.loadReceipt('../bad'),/EFFECT_KEY_INVALID/);
 fs.writeFileSync(path.join(root,key+'.json'),'broken');
 assert.throws(()=>store.loadReceipt(key));
});

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {test} from 'node:test';
import {manifestFingerprint,validateControllerImportClosure,controllerImportScanRoots} from '../tools/maintenance-contract.mjs';
import {prepareMaintenanceIssue,verifyMaintenanceIssue,submitMaintenanceIssue,submitPreparedMaintenanceIssue,submitCiPreparedMaintenanceIssue,reconcileMaintenanceIssue,main} from '../tools/maintenance-request.mjs';
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

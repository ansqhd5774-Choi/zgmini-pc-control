import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
 HANDOFF_TARGET,HANDOFF_APPROVAL_SHA256,HANDOFF_APPROVAL_REL,HANDOFF_FILE_SET,
 inspectHandoff1378Source,classifyKnown1378
} from '../watchdog-b/handoff-1378-source-preflight.mjs';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const A=Object.freeze({
 schema:'ZGMINI_WATCHDOG_HANDOFF_FIRSTFAIL_A_RESULT_V1',
 requestId:'pc-watchdog-handoff-a-0b27cd23-0d35-4cf0-8bf1-d583713d9a5d',
 handoffIssueNumber:1378,status:'PASS',code:'WATCHDOG_HANDOFF_A_READ_ONLY',
 watchdog:'HEALTHY_NEW_SCOPE',claim:'NOT_CLAIMED',
 bridgeStatus:'BLOCKED',bridgeCode:'ENOENT',
 receiverSource:'PRIOR',receiverState:'LISTENING',
 checkout:'MAIN_TARGET_NOT_ANCESTOR',operationalWrites:0
});
function gitReady(cwd,args){
 assert.equal(cwd,root);
 if(args[0]==='branch')return 'main';
 if(args[0]==='merge-base')return '';
 if(args[0]==='status')return '';
 throw Error('UNEXPECTED_GIT_COMMAND');
}
const prove=(options={})=>inspectHandoff1378Source({root,runGit:gitReady,...options});
const names=r=>r.failures.map(x=>x.code);
const restrictedRead=(change)=>({
 ...fs,
 lstatSync(file){return change('stat',file)??fs.lstatSync(file);},
 readFileSync(file){return change('read',file)??fs.readFileSync(file);}
});

test('actual checked out nine maintenance source files exactly match immutable approved manifest bytes',()=>{
 const r=prove();
 assert.equal(r.status,'SOURCE_BYTES_READY_OWNER_APPROVAL_AND_RUNTIME_REQUIRED');
 assert.equal(r.approvalVerified,true);
 assert.equal(r.verifiedFiles,9);assert.equal(r.totalFiles,9);
 assert.deepEqual(r.failures,[]);
 assert.equal(r.checkoutBranch,'main');assert.equal(r.targetAncestor,true);
 assert.equal(r.controllerInstalled,false);assert.equal(r.operationalWrites,0);
 assert.equal(r.handoffClaimCreated,false);assert.equal(r.receiverProcessChanged,false);
 assert.equal(HANDOFF_FILE_SET.length,9);
 assert.equal(HANDOFF_APPROVAL_SHA256.length,64);
 assert.equal(HANDOFF_TARGET.length,40);
});
test('consumes only the one original #1389 A evidence, never approves an unrelated result',()=>{
 assert.equal(classifyKnown1378(A),'PRIORITIZE_SOURCE_CHECKOUT_REPAIR');
 for(const bad of [
  {...A,requestId:'pc-watchdog-handoff-a-aaaa1111-bbbb-4ccc-8ddd-eeeeeeeeeeee'},
  {...A,handoffIssueNumber:1387},{...A,watchdog:'UNKNOWN_OR_STALE'},
  {...A,operationalWrites:1}
 ])assert.equal(classifyKnown1378(bad),'A_EVIDENCE_NOT_APPLICABLE');
 assert.equal(classifyKnown1378({...A,claim:'RUNNING'}),
  'EXISTING_CLAIM_OR_RECEIVER_CHANGE_OWNER_RECONCILE');
 assert.equal(classifyKnown1378({...A,receiverSource:'TARGET'}),
  'EXISTING_CLAIM_OR_RECEIVER_CHANGE_OWNER_RECONCILE');
 assert.equal(classifyKnown1378({...A,bridgeCode:'SOMETHING_ELSE'}),
  'FIRST_FAIL_CHANGED_OWNER_RECONCILE');
});
test('same original source and manifest are NOT enough when checkout HEAD lacks target ancestry',()=>{
 const r=prove({runGit:(cwd,args)=>{
  if(args[0]==='merge-base')throw Error('OLD_CHECKOUT');
  return gitReady(cwd,args);
 }});
 assert.equal(r.status,'SOURCE_REPAIR_PREWORK_REQUIRED');
 assert.deepEqual(names(r),['TARGET_NOT_ANCESTOR']);
 assert.equal(r.targetAncestor,false);assert.equal(r.approvalVerified,true);
 assert.equal(r.verifiedFiles,9);
});
test('missing post-target approval file is identified without rerunning Windows B',()=>{
 const io=restrictedRead((operation,file)=>{
  if(operation==='stat'&&file.endsWith(HANDOFF_APPROVAL_REL)){
   const e=Error('EXACT_FIXTURE_MISSING');e.code='ENOENT';throw e;
  }
 });
 const r=prove({io});
 assert.equal(r.status,'SOURCE_REPAIR_PREWORK_REQUIRED');
 assert.deepEqual(names(r),['APPROVAL_FILE_MISSING']);
 assert.equal(r.verifiedFiles,0);assert.equal(r.handoffClaimCreated,false);
});
test('manifest raw digest mismatch blocks even if JSON fields are still readable',()=>{
 const io=restrictedRead((operation,file)=>{
  if(operation==='read'&&file.endsWith(HANDOFF_APPROVAL_REL)){
   const bytes=fs.readFileSync(file);
   return Buffer.from(bytes.toString('utf8').replace('  "scope"', '   "scope"'));
  }
 });
 const r=prove({io});
 assert.ok(names(r).includes('APPROVAL_RAW_SHA256_DRIFT'));
 assert.equal(r.status,'SOURCE_REPAIR_PREWORK_REQUIRED');
 assert.equal(r.approvalVerified,false);
});
test('one bad approved source file is pinpointed, never masked by other eight valid files',()=>{
 const file='tools/update.mjs';
 const io=restrictedRead((operation,p)=>
  operation==='read'&&p.endsWith(file)?Buffer.from('tampered'):undefined);
 const r=prove({io});
 assert.equal(r.verifiedFiles,8);assert.equal(r.status,'SOURCE_REPAIR_PREWORK_REQUIRED');
 assert.deepEqual(r.failures,[{code:'PINNED_FILE_RAW_SHA256_DRIFT',file}]);
});
test('missing approved file and approval failure are both reported in one source pass',()=>{
 const io=restrictedRead((op,p)=>{
  if(op!=='stat')return;
  if(p.endsWith(HANDOFF_APPROVAL_REL)||p.endsWith('tools/maintenance-lock.mjs')){
   const e=Error('missing');e.code='ENOENT';throw e;
  }
 });
 const r=prove({io});
 assert.equal(r.status,'SOURCE_REPAIR_PREWORK_REQUIRED');
 assert.deepEqual(r.failures,[
  {code:'APPROVAL_FILE_MISSING'},
  {code:'PINNED_FILE_MISSING',file:'tools/maintenance-lock.mjs'}
 ]);
});
test('source dirty state blocks even when all signed bytes equal target',()=>{
 const r=prove({runGit:(cwd,args)=>args[0]==='status'
  ?'?? approvals/maintenance-handoffs/recheck.json':gitReady(cwd,args)});
 assert.deepEqual(names(r),['PINNED_CHECKOUT_DIRTY']);
 assert.equal(r.status,'SOURCE_REPAIR_PREWORK_REQUIRED');
});
test('non-main checkout blocks even when all raw hashes are valid',()=>{
 const r=prove({runGit:(cwd,args)=>args[0]==='branch'
  ?'support/test':gitReady(cwd,args)});
 assert.deepEqual(names(r),['CHECKOUT_NOT_MAIN']);
 assert.equal(r.status,'SOURCE_REPAIR_PREWORK_REQUIRED');
});
test('read-only surface exposes no command execution, credentials, overwrite or runtime certificate',()=>{
 const r=prove();
 const text=JSON.stringify(r);
 assert.doesNotMatch(text,/private key|GH_TOKEN|GITHUB_TOKEN|SECRET|password|body|rawJson/gi);
 assert.equal(r.scope,'SOURCE_ONLY_NO_RUNTIME_ATTESTATION');
 assert.equal(r.controllerInstalled,false);
 assert.equal(r.handoffClaimCreated,false);
});

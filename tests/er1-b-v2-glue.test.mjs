import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {sha256,ER1_SOURCE_SHA,CONTROL_REPO,ACTOR} from '../er1-b-contract.mjs';
import {prepareCheckoutWorkspace,executeOnce} from '../er1-b-entry.mjs';
import {validateApprovalBytesV2,V2_EDITION,V2_SOURCE_FILES,
 V2_ADAPTER,V2_CANDIDATE} from '../er1-b-contract-v2.mjs';

const own=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const fixed=JSON.parse(fs.readFileSync(path.join(own,'approval',
 'ER1_INDEPENDENT_PUBLISHER_V2_PENDING.json'),'utf8'));
const manifest={...fixed,status:'APPROVED_B',
 pcConfigSourceSha:'a'.repeat(40),pcBindingSha256:'b'.repeat(64)};
const approval=Buffer.from(JSON.stringify(manifest));
const uuid='34585fa0-987f-432d-bacd-4f03c3c0e1ef';
const requestId='pc-er1-'+uuid;
const req={schema:'ZGMINI_ER1_PC_B_JOB_V1',requestId,chatId:'chat-'+uuid,
 operation:'er1-saved-score-and-d1-publish-once',controlRepository:CONTROL_REPO,
 candidateSourceSha:ER1_SOURCE_SHA,approvalManifestSha256:sha256(approval)};
const event={action:'opened',repository:{private:true,full_name:CONTROL_REPO},
 sender:{login:ACTOR},issue:{number:503,user:{login:ACTOR},
 title:'pc-er1-approved-one-shot',labels:[{name:'pc-er1-approved'}],
 body:JSON.stringify(req)}};
const approvedControl='c'.repeat(40);
const environment={GITHUB_REPOSITORY:CONTROL_REPO,GITHUB_ACTOR:ACTOR,
 GITHUB_EVENT_NAME:'issues',GITHUB_EVENT_ACTION:'opened',RUNNER_NAME:'zgmini-pc-01',
 ER1_APPROVED_CONTROL_SHA:approvedControl,ER1_APPROVED_SOURCE_SHA:ER1_SOURCE_SHA};
const edition={...V2_EDITION,validateBundleHashes:({manifest,root,readFile})=>{
 // Isolated runner fixture cannot claim to have real public e217 files.
 // Check private module pin bytes, and public file presence only here.
 for(const relative of V2_SOURCE_FILES){
  const value=readFile(path.join(root,...relative.split('/')));
  assert.ok(value.length>0);
  if(relative===V2_ADAPTER||relative===V2_CANDIDATE)
   assert.equal(sha256(value),manifest.sourceSha256[relative]);
 }
 return true;
}};
function fixture(t){
 const workRoot=fs.mkdtempSync(path.join(os.tmpdir(),'er1-b-v2-glue-'));
 const hostRoot=fs.mkdtempSync(path.join(os.tmpdir(),'er1-b-v2-host-'));
 t.after(()=>{fs.rmSync(workRoot,{recursive:true,force:true});
  fs.rmSync(hostRoot,{recursive:true,force:true})});
 const privateRoot=path.join(workRoot,'er1-control'),publicRoot=path.join(workRoot,'er1-source');
 fs.mkdirSync(path.join(privateRoot,'approval'),{recursive:true});
 fs.mkdirSync(path.join(privateRoot,'operator'),{recursive:true});
 fs.mkdirSync(path.join(publicRoot,'tools','market-calendar-er1'),{recursive:true});
 fs.writeFileSync(path.join(privateRoot,'approval','ER1_PC_OPERATION_APPROVAL.json'),approval);
 fs.copyFileSync(path.join(own,'operator','ER1_PC_OPERATION_V2_ONCE.mjs'),
  path.join(privateRoot,'operator','ER1_PC_OPERATION_V2_ONCE.mjs'));
 fs.copyFileSync(path.join(own,'er1-b-independent-publisher-v2.mjs'),
  path.join(privateRoot,'er1-b-independent-publisher-v2.mjs'));
 for(const relative of V2_SOURCE_FILES.filter(x=>x!==V2_ADAPTER&&x!==V2_CANDIDATE)){
  const file=path.join(publicRoot,...relative.split('/'));
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file,'fixture only; public checkout must be verified by SHA in real host');
 }
 const env={...environment,GITHUB_WORKSPACE:workRoot};
 return {workRoot,hostRoot,privateRoot,publicRoot,env};
}
test('V2 signed manifest accepts exact private operator and D1 dependency pins',()=>{
 assert.equal(validateApprovalBytesV2(approval,req).schema,'ER1_PC_OPERATION_APPROVAL_V2');
 assert.throws(()=>validateApprovalBytesV2(Buffer.from(approval.toString()+' '),req),
  /ER1_B_V2_APPROVAL_HASH_STOP/);
});
test('V2 stages verified private adapter and new operator, never old Core-linked operator',t=>{
 const x=fixture(t);
 const prepared=prepareCheckoutWorkspace({event,env:x.env,workRoot:x.workRoot,
  strictPlatform:false,edition,gitSha:dir=>dir===x.privateRoot?approvedControl:ER1_SOURCE_SHA,
  gitDirty:()=>''});
 assert.equal(prepared.sourceRoot,x.publicRoot);
 for(const relative of [V2_ADAPTER,V2_CANDIDATE]){
  assert.equal(sha256(fs.readFileSync(path.join(x.publicRoot,relative))),
   manifest.sourceSha256[relative]);
 }
 assert.equal(fs.existsSync(path.join(x.publicRoot,
  'tools','market-calendar-er1','ER1_PC_OPERATION_ONCE.mjs')),false);
});
test('V2 B once consumes global ledger and reports readback without old operator',async t=>{
 const x=fixture(t);
 prepareCheckoutWorkspace({event,env:x.env,workRoot:x.workRoot,
  strictPlatform:false,edition,gitSha:dir=>dir===x.privateRoot?approvedControl:ER1_SOURCE_SHA,
  gitDirty:()=>''});
 let launches=0;
 const result=await executeOnce({event,env:x.env,root:x.hostRoot,
  packageRoot:x.publicRoot,strictPlatform:false,edition,
  preflight:async()=>true,reserveGlobal:async()=>true,
  spawnCandidate:script=>{
   launches++;assert.ok(script.endsWith('ER1_PC_OPERATION_V2_ONCE.mjs'));
   fs.writeFileSync(path.join(x.publicRoot,'ER1_PC_OPERATION_RESULT.txt'),
    'STATUS=PASS\nCODE=ER1_D1_PUBLISHED_AND_READBACK\nD1_WRITES=1\n'+
    'PROVIDER_REQUESTS=0\nRAW_EARNINGS_EXPORTED=NO');
   return {status:0};
  }});
 assert.equal(result.status,'PASS');assert.equal(launches,1);
 assert.ok(fs.existsSync(path.join(x.hostRoot,'ER1_B_ONE_SHOT_ATTEMPTED.json')));
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runCiReceiptProof} from '../tools/ci-controller-b-receipt-proof.mjs';

const root='C:\\ProgramData\\ZGMINI-CI\\ControllerBReceipts';
const repository={id:1442936296,full_name:'ansqhd5774-Choi/zgmini-pc-control',private:true};
const owner='ansqhd5774-Choi';
const req=(phase,sourceIssueNumber)=>({schema:'ZGMINI_CI_RECEIPT_PROOF_REQUEST_V1',
 operation:'ci-controller-b-receipt-proof',phase,
 requestId:phase==='write'?'658bab72-9508-4bd9-99a2-ec693159a8b3':'f2a19b3e-4e8b-49c3-b167-54e32225f194',
 ...(phase==='verify'?{sourceIssueNumber}:{})});
const event=(number=100,phase='write',source=100)=>({action:'opened',repository:{...repository},
 sender:{login:owner},issue:{number,state:'open',title:'ci-controller-b-receipt-proof',
 user:{login:owner},body:JSON.stringify(req(phase,source))}});
const ctx=(runId=2001)=>({eventName:'issues',repository:repository.full_name,actor:owner,
 ref:'refs/heads/main',enabled:'false',hostname:'DESKTOP-N62L0NG',
 runnerName:'zgmini-handoff-ci-spare-01',runId,attempt:1});
const preflight=()=>({code:'CI_RECEIPT_ROOT_DIRECTORY_PRESENT_READONLY',
 configured:true,directoryPresent:true,readable:true});
function memory(){
 const files=new Map();let opened=null,fsyncs=0,writes=0;
 return {files,get writes(){return writes},get fsyncs(){return fsyncs},
 openSync(p,flag){assert.equal(flag,'wx');if(files.has(p)){const e=Error('exists');e.code='EEXIST';throw e;}
  opened=p;files.set(p,Buffer.alloc(0));return 17;},
 writeFileSync(fd,bytes){assert.equal(fd,17);writes++;files.set(opened,Buffer.from(bytes));},
 fsyncSync(fd){assert.equal(fd,17);fsyncs++;},
 closeSync(fd){assert.equal(fd,17);opened=null;},
 lstatSync(p){if(!files.has(p)){const e=Error('missing');e.code='ENOENT';throw e;}
  return {isFile:()=>true,isSymbolicLink:()=>false,size:files.get(p).length};},
 readFileSync(p){if(!files.has(p)){const e=Error('missing');e.code='ENOENT';throw e;}return Buffer.from(files.get(p));}
 };
}
const run=(filesystem,e=event(),c=ctx(),p=preflight,r=root)=>runCiReceiptProof({
 filesystem,event:e,ctx:c,preflight:p,platform:'win32',root:r,volatileRoots:[]});
test('write uses one exclusive bounded file, flushes and verifies exact bytes',()=>{
 const filesystem=memory(),r=run(filesystem);
 assert.equal(r.code,'CI_RECEIPT_PROOF_WRITE_READBACK_VERIFIED');
 assert.equal(r.status,'PARTIAL');assert.equal(r.writableVerified,true);
 assert.equal(r.durableAcrossRunsVerified,false);assert.equal(r.operationalWrites,1);
 assert.equal(filesystem.writes,1);assert.equal(filesystem.fsyncs,1);
 assert.equal(filesystem.files.size,1);
 assert.match(r.recordSha256,/^[a-f0-9]{64}$/);
 assert.doesNotMatch(JSON.stringify(r),/C:\\\\ProgramData|secret|token/i);
});
test('different issue and run prove persisted content without second write',()=>{
 const filesystem=memory(),first=run(filesystem);
 const later=run(filesystem,event(101,'verify',100),ctx(2002));
 assert.equal(later.status,'PASS');assert.equal(later.code,'CI_RECEIPT_PROOF_CROSS_RUN_VERIFIED');
 assert.equal(later.durableAcrossRunsVerified,true);assert.equal(later.operationalWrites,0);
 assert.equal(later.recordSha256,first.recordSha256);
 assert.equal(later.sourceRunId,2001);assert.equal(later.verificationRunId,2002);
 assert.equal(filesystem.writes,1);
});
test('repeat write does not overwrite existing durable file',()=>{
 const filesystem=memory();run(filesystem);
 const duplicate=run(filesystem);
 assert.equal(duplicate.code,'CI_RECEIPT_PROOF_ALREADY_EXISTS_STOP');
 assert.equal(filesystem.writes,1);
});
test('same run cannot falsely prove cross-run durability',()=>{
 const filesystem=memory();run(filesystem);
 assert.equal(run(filesystem,event(101,'verify',100),ctx(2001)).code,
 'CI_RECEIPT_PROOF_RECORD_INVALID');
});
test('missing or altered first-run record is not verified',()=>{
 const filesystem=memory();
 assert.equal(run(filesystem,event(101,'verify',100),ctx(2002)).code,
 'CI_RECEIPT_PROOF_SOURCE_ABSENT');
 run(filesystem);const name=[...filesystem.files.keys()][0];
 const corrupt=JSON.parse(filesystem.files.get(name).toString());
 corrupt.runner='different';filesystem.files.set(name,Buffer.from(JSON.stringify(corrupt)+'\n'));
 assert.equal(run(filesystem,event(101,'verify',100),ctx(2002)).code,
 'CI_RECEIPT_PROOF_RECORD_INVALID');
});
test('identity, approval activation, root and stage validation stop before writes',()=>{
 for(const modify of [
  ({c})=>c.actor='other',({c})=>c.hostname='OTHER',
  ({c})=>c.enabled='true',({c})=>c.ref='refs/heads/other',
  ({c})=>c.attempt=2,({e})=>e.sender.login='other',
  ({e})=>e.repository.private=false,
  ({e})=>e.issue.body=JSON.stringify({...req('write'),extra:'unapproved'}),
  ({e})=>e.issue.body=JSON.stringify(req('verify',200)),
 ]){
  const filesystem=memory(),e=event(),c=ctx();modify({e,c});
  assert.equal(run(filesystem,e,c).status,'BLOCKED');
  assert.equal(filesystem.writes,0);
 }
 const filesystem=memory();
 assert.equal(run(filesystem,event(),ctx(),preflight,'C:\\Other\\Folder').code,
 'CI_RECEIPT_PROOF_FIXED_ROOT_DENIED');
 assert.equal(run(filesystem,event(),ctx(),()=>({code:'CI_RECEIPT_ROOT_PATH_ALIAS'})).code,
 'CI_RECEIPT_PROOF_ROOT_NOT_VERIFIED');
 assert.equal(filesystem.writes,0);
});
test('existing readonly A job and B publisher activation remain unchanged',()=>{
 const workflow=readFileSync(new URL('../.github/workflows/pc-process-inventory-readonly.yml',import.meta.url),'utf8');
 assert.match(workflow,/ci-receipt-proof:/);
 assert.match(workflow,/github\.actor == 'ansqhd5774-Choi'/);
 assert.match(workflow,/run: node tools\/ci-controller-b-receipt-proof\.mjs/);
 assert.match(workflow,/ZGMINI_CI_CONTROLLER_B_ENABLED: \$\{\{ vars\.ZGMINI_CI_CONTROLLER_B_ENABLED \}\}/);
 assert.match(workflow,/name: Collect read-only runtime process snapshot on isolated handoff PC/);
 const publisher=readFileSync(new URL('../.github/workflows/ci-approval-controller-b.yml',import.meta.url),'utf8');
 assert.match(publisher,/vars\.ZGMINI_CI_CONTROLLER_B_ENABLED == 'true'/);
 assert.doesNotMatch(publisher,/workflow_dispatch:|schedule:/);
});

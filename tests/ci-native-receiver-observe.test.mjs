import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {readNativeScope,observeNativeReceiver} from '../ci-approval/native-receiver-observe.mjs';
import {observeNativeAWithScope} from '../ci-approval/native-a-execute.mjs';

const REPO='ansqhd5774-Choi/zgmini-pc-control';
const file=p=>fs.readFileSync(new URL('../'+p,import.meta.url));
const sha=b=>createHash('sha256').update(b).digest('hex');
const blob=b=>createHash('sha1').update(Buffer.from('blob '+b.length+'\0')).update(b).digest('hex');
const make=effect=>{
 const approvalBytes=file(effect==='A_READONLY'?'config/operations.json':
  'approvals/writer-updates/w05-r304-maintenance-window-20261119.json');
 const approval=JSON.parse(approvalBytes);
 const request=effect==='A_READONLY'?{
  schema:'ZGMINI_PC_JOB_V1',requestId:'pc-test-001',chatId:'test',operation:'runner-smoke',
  sourceRepository:approval.sourceRepository,sourceBranch:'main',sourceSha:'a'.repeat(40)
 }:{
  schema:'ZGMINI_PC_WRITER_SOURCE_B_REQUEST_V1',
  requestId:'12345678-1234-4234-8234-123456789abc',
  chatId:'12345678-1234-4234-8234-123456789abd',
  operation:'pc-writer-source-install',controlRepository:REPO,
  approvalManifestPath:'approvals/writer-updates/w05-r304-maintenance-window-20261119.json',
  approvalManifestSha256:sha(approvalBytes)
 };
 const requestBytes=Buffer.from(JSON.stringify(request));
 const sourceBytes=Buffer.from('name: fixed source\n'),receiverBytes=Buffer.from('name: native receiver\n');
 const receiver=effect==='A_READONLY'?'.github/workflows/ci-approved-a-once.yml':
  '.github/workflows/ci-approved-writer-b-once.yml';
 const policy={schema:'ZGMINI_CI_NATIVE_DISPATCH_V1',enabled:true,effect,
  sourceRunId:222,sourceAttempt:1,sourceWorkflowId:456,
  sourceHeadSha:'a'.repeat(40),sourceWorkflowPath:'.github/workflows/controller-maintenance-source-tests.yml',
  sourceWorkflowBlobSha:blob(sourceBytes),receiverWorkflowPath:receiver,
  receiverWorkflowBlobSha:blob(receiverBytes),
  businessApprovalSha256:sha(approvalBytes),approvedRequestSha256:sha(requestBytes),
  policyRevision:'b'.repeat(40)};
 const event={repository:{id:1442936296,private:true,full_name:REPO},
  sender:{id:41898282,login:'github-actions[bot]',type:'Bot'},
  inputs:{effect,source_run_id:'222',source_attempt:'1',approval_sha256:policy.businessApprovalSha256,
   request_sha256:policy.approvedRequestSha256,
   effect_key:sha(JSON.stringify([effect,policy.businessApprovalSha256,policy.approvedRequestSha256]))}};
 const env={GITHUB_REPOSITORY:REPO,GITHUB_EVENT_NAME:'workflow_dispatch',
  GITHUB_ACTOR:'github-actions[bot]',GITHUB_REF:'refs/heads/main',
  GITHUB_SHA:'c'.repeat(40),GITHUB_RUN_ATTEMPT:'1'};
 const reads=[];
 const ports={readNativeScope:async()=>({policy,approvalBytes,requestBytes}),
  getJson:async route=>{
   reads.push(route);
   if(route==='actions/runs/222/attempts/1')
    return {id:222,run_attempt:1,workflow_id:456,path:policy.sourceWorkflowPath,
     head_sha:policy.sourceHeadSha,status:'completed',conclusion:'success',event:'pull_request',
     repository:{id:1442936296,private:true,full_name:REPO},head_repository:{id:1442936296}};
   if(route==='contents/'+policy.sourceWorkflowPath+'?ref='+policy.sourceHeadSha)
    return {type:'file',path:policy.sourceWorkflowPath,sha:policy.sourceWorkflowBlobSha,
     encoding:'base64',content:sourceBytes.toString('base64')};
   if(route==='contents/'+receiver+'?ref='+env.GITHUB_SHA)
    return {type:'file',path:receiver,sha:policy.receiverWorkflowBlobSha,
     encoding:'base64',content:receiverBytes.toString('base64')};
   throw Error('unexpected REST read');
  }};
 return {effect,policy,event,env,ports,reads};
};
for(const effect of ['A_READONLY','B_WRITER_SOURCE'])test(effect+' actual receiver observation reads REST and cannot execute',async()=>{
 const x=make(effect),r=await observeNativeReceiver(x);
 assert.equal(r.state,'CONTRACT_MATCH_ONLY');assert.equal(r.canExecute,false);
 assert.equal(r.canInstall,false);assert.equal(r.canPublish,false);assert.equal(r.operationalWrites,0);
 assert.equal(x.reads.length,3);
});
test('forged event stops before installed-policy and REST access',async()=>{
 const x=make('A_READONLY');x.event.sender.id=123;
 const r=await observeNativeReceiver(x);
 assert.equal(r.code,'CI_NATIVE_RECEIVER_EVENT_DENIED');assert.equal(x.reads.length,0);
});
test('missing installed scope gives missing evidence not approval',async()=>{
 const x=make('A_READONLY');x.ports.readNativeScope=async()=>{throw Error('not installed')};
 const r=await observeNativeReceiver(x);
 assert.equal(r.code,'CI_NATIVE_RECEIVER_LOCAL_SCOPE_UNAVAILABLE');
});
test('disabled scope never calls GitHub',async()=>{
 const x=make('A_READONLY');x.policy.enabled=false;
 const r=await observeNativeReceiver(x);
 assert.equal(r.state,'DISABLED');assert.equal(x.reads.length,0);
});
test('GitHub API failure is fail closed without retry',async()=>{
 const x=make('A_READONLY');x.ports.getJson=async()=>{throw Error('network')};
 const r=await observeNativeReceiver(x);
 assert.equal(r.code,'CI_NATIVE_RECEIVER_GITHUB_READ_UNAVAILABLE');assert.equal(r.operationalWrites,0);
});
test('GitHub file path drift fails closed',async()=>{
 const x=make('A_READONLY'),original=x.ports.getJson;
 x.ports.getJson=async route=>{const v=await original(route);if(route.startsWith('contents/'))v.path='wrong';return v};
 const r=await observeNativeReceiver(x);
 assert.equal(r.code,'CI_NATIVE_RECEIVER_GITHUB_FILE_UNVERIFIED');
});
function withRoot(fn){const root=fs.mkdtempSync(path.join(os.tmpdir(),'zgmini-native-receiver-'));try{return fn(root)}finally{fs.rmSync(root,{recursive:true,force:true})}}
test('local native scope reads exactly pinned, fixed shape',()=>withRoot(root=>{
 const obj={schema:'ZGMINI_CI_NATIVE_READONLY_SCOPE_V1',policy:{effect:'A_READONLY'},
  approvalBytesBase64:Buffer.from('a').toString('base64'),
  requestBytesBase64:Buffer.from('b').toString('base64')};
 fs.writeFileSync(path.join(root,'ci-native-a-approved.json'),JSON.stringify(obj));
 assert.equal(readNativeScope('A_READONLY',{root}).approvalBytes.toString(),'a');
 obj.attacker='extra';fs.writeFileSync(path.join(root,'ci-native-a-approved.json'),JSON.stringify(obj));
 assert.throws(()=>readNativeScope('A_READONLY',{root}),/CI_NATIVE_SCOPE_SHAPE_DENIED/);
}));
test('local scope root is never automatically created',()=>withRoot(root=>{
 assert.throws(()=>readNativeScope('A_READONLY',{root:path.join(root,'absent')}));
}));
test('symlink local scope file is rejected',()=>withRoot(root=>{
 const original=path.join(root,'real.json');fs.writeFileSync(original,'{}');
 try{fs.symlinkSync(original,path.join(root,'ci-native-a-approved.json'),'file');}
 catch(e){if(['EPERM','EACCES'].includes(e.code))return;throw e}
 assert.throws(()=>readNativeScope('A_READONLY',{root}),/CI_NATIVE_SCOPE_FILE_UNVERIFIED/);
}));
test('invalid base64 cannot be treated as approval bytes',()=>withRoot(root=>{
 const obj={schema:'ZGMINI_CI_NATIVE_READONLY_SCOPE_V1',policy:{effect:'A_READONLY'},
  approvalBytesBase64:'!!!',requestBytesBase64:Buffer.from('b').toString('base64')};
 fs.writeFileSync(path.join(root,'ci-native-a-approved.json'),JSON.stringify(obj));
 assert.throws(()=>readNativeScope('A_READONLY',{root}),/CI_NATIVE_SCOPE_BYTES_INVALID/);
}));
test('both workflow registrations remain gated and read-only',()=>{
 for(const [s,effect,flag] of [
  ['a','A_READONLY','ZGMINI_CI_NATIVE_A_ENABLED'],
  ['writer-b','B_WRITER_SOURCE','ZGMINI_CI_NATIVE_WRITER_B_ENABLED']
 ]){
  const y=file('.github/workflows/ci-approved-'+s+'-once.yml').toString('utf8').replace(/\r\n/g,'\n');
  assert.match(y,/^on:\n  workflow_dispatch:\n/m);
  assert.doesNotMatch(y,/^\s+(?:schedule:|issues:|pull_request:|workflow_run:)/m);
  assert.match(y,new RegExp("vars\\."+flag+" == 'true'"));
  assert.match(y,/github\.actor == 'github-actions\[bot\]'/);
  assert.match(y,/github\.event\.sender\.id == 41898282/);
  assert.match(y,new RegExp("inputs\\.effect == '"+effect+"'"));
  assert.match(y,/permissions:\n      contents: read\n      actions: read/);
  assert.doesNotMatch(y,/^\s+(?:issues|contents|actions): write/m);
  assert.match(y,/native-receiver-observe\.mjs/);
  assert.doesNotMatch(y,/controller\\entry\.mjs|writer-b\\windows-adapter\.mjs/);
 }
});


for(const effect of ['A_READONLY','B_WRITER_SOURCE'])test(effect+' receiver revalidates original source Run ID from dispatch against installed future-run policy',async()=>{
 const x=make(effect);
 delete x.policy.sourceRunId;
 x.policy.sourceRunMode='EVENT_COMPLETION_V1';
 const r=await observeNativeReceiver(x);
 assert.equal(r.state,'CONTRACT_MATCH_ONLY');
 assert.equal(r.canExecute,false);
 assert.equal(r.canInstall,false);
 assert.equal(x.reads[0],'actions/runs/222/attempts/1');
 assert.equal(Object.hasOwn(x.policy,'sourceRunId'),false);
});
test('event-bound receiver denies a noncanonical or prefilled source Run ID before any REST read',async()=>{
 for(const alter of [
  x=>{x.event.inputs.source_run_id='0222'},
  x=>{x.event.inputs.source_run_id='999999999999999999999999999'},
  x=>{x.event.inputs.source_run_id='not-a-number'},
  x=>{x.policy.sourceRunId=222}
 ]){
  const x=make('A_READONLY');
  delete x.policy.sourceRunId;
  x.policy.sourceRunMode='EVENT_COMPLETION_V1';
  alter(x);
  const r=await observeNativeReceiver(x);
  assert.equal(r.code,'CI_NATIVE_RECEIVER_SOURCE_RUN_INPUT_DENIED');
  assert.equal(x.reads.length,0);
 }
});
test('event-bound receiver cannot accept a different completed CI Run',async()=>{
 const x=make('A_READONLY');
 delete x.policy.sourceRunId;
 x.policy.sourceRunMode='EVENT_COMPLETION_V1';
 x.event.inputs.source_run_id='223';
 const r=await observeNativeReceiver(x);
 assert.notEqual(r.state,'CONTRACT_MATCH_ONLY');
 assert.equal(x.reads[0],'actions/runs/223/attempts/1');
});

test('native A engine admission retains exactly the scope authenticated by the receiver',async()=>{
 const x=make('A_READONLY');
 const first=await x.ports.readNativeScope();
 first.policy.nativeAExecutionEnabled=false;
 const later={...first,policy:{...first.policy,nativeAExecutionEnabled:true,
  installedControllerSha:'d'.repeat(40),policyRevision:'e'.repeat(40)}};
 // The second snapshot would have the same stable request/approval hash.
 let reads=0;
 x.ports.readNativeScope=async()=>++reads===1?first:later;
 const {observation,scope}=await observeNativeAWithScope(x);
 assert.equal(observation.state,'CONTRACT_MATCH_ONLY');
 assert.equal(reads,1);
 assert.equal(scope,first);
 assert.equal(scope.policy.nativeAExecutionEnabled,false);
 assert.notEqual(scope.policy.policyRevision,later.policy.policyRevision);
});
test('native A snapshot never loads installed scope on forged event',async()=>{
 const x=make('A_READONLY');x.event.sender.id=123;
 let reads=0;x.ports.readNativeScope=async()=>{reads++;throw Error('unexpected')};
 const {observation,scope}=await observeNativeAWithScope(x);
 assert.equal(observation.code,'CI_NATIVE_RECEIVER_EVENT_DENIED');
 assert.equal(scope,undefined);assert.equal(reads,0);assert.equal(x.reads.length,0);
});
test('native A snapshot preserves missing scope refusal without second read',async()=>{
 const x=make('A_READONLY');let reads=0;
 x.ports.readNativeScope=async()=>{reads++;throw Error('missing')};
 const {observation,scope}=await observeNativeAWithScope(x);
 assert.equal(observation.code,'CI_NATIVE_RECEIVER_LOCAL_SCOPE_UNAVAILABLE');
 assert.equal(scope,undefined);assert.equal(reads,1);assert.equal(x.reads.length,0);
});

test('public Writer receiver refuses absent opt-in before reading local scope',async()=>{
 const x=make('B_WRITER_SOURCE');
 x.event.repository.private=false;
 const refused=await observeNativeReceiver(x);
 assert.equal(refused.code,'CI_NATIVE_RECEIVER_EVENT_DENIED');
 assert.equal(x.reads.length,0);
 x.env.ZGMINI_CI_NATIVE_WRITER_B_PUBLIC_ENABLED='true';
 Object.assign(x.policy,{repositoryVisibility:'public',nativeWriterBExecutionEnabled:true,
  nativeWriterBControlSha:'d'.repeat(40),
  nativeWriterBAdapterSha256:'e'.repeat(64),installedControllerSha:'f'.repeat(40)});
 const get=x.ports.getJson;
 x.ports.getJson=async route=>{
  const v=await get(route);
  if(route.startsWith('actions/'))v.repository.private=false;
  return v;
 };
 const matched=await observeNativeReceiver(x);
 assert.equal(matched.state,'CONTRACT_MATCH_ONLY');assert.equal(matched.canInstall,false);
});

test('Writer B installed scope refuses hardlink aliases, accepts an independent regular file',()=>withRoot(root=>{
 const obj={schema:'ZGMINI_CI_NATIVE_READONLY_SCOPE_V1',
  policy:{effect:'B_WRITER_SOURCE'},
  approvalBytesBase64:Buffer.from('a').toString('base64'),
  requestBytesBase64:Buffer.from('b').toString('base64')};
 const file=path.join(root,'ci-native-writer-b-approved.json');
 fs.writeFileSync(file,JSON.stringify(obj));
 assert.equal(readNativeScope('B_WRITER_SOURCE',{root}).policy.effect,'B_WRITER_SOURCE');
 const alias=path.join(root,'untrusted-hardlink.json');
 fs.linkSync(file,alias);
 assert.throws(()=>readNativeScope('B_WRITER_SOURCE',{root}),
  /CI_NATIVE_SCOPE_FILE_UNVERIFIED/);
 fs.unlinkSync(alias);
 assert.equal(readNativeScope('B_WRITER_SOURCE',{root}).approvalBytes.toString(),'a');
}));
test('Writer B refuses policy bytes changing between two pinned file reads',()=>withRoot(root=>{
 const obj={schema:'ZGMINI_CI_NATIVE_READONLY_SCOPE_V1',
  policy:{effect:'B_WRITER_SOURCE'},
  approvalBytesBase64:Buffer.from('a').toString('base64'),
  requestBytesBase64:Buffer.from('b').toString('base64')};
 const file=path.join(root,'ci-native-writer-b-approved.json');
 fs.writeFileSync(file,JSON.stringify(obj));
 const bytes=fs.readFileSync(file);
 let reads=0;
 const io={lstatSync:p=>fs.lstatSync(p),readFileSync:()=>{
  reads++;return reads===2?Buffer.concat([bytes,Buffer.from(' ')]):Buffer.from(bytes);
 }};
 assert.throws(()=>readNativeScope('B_WRITER_SOURCE',{root,io}),
  /CI_NATIVE_SCOPE_FILE_UNVERIFIED/);
 assert.equal(reads,2);
 // The pre-existing A reader remains single-read and otherwise unchanged.
 const a=path.join(root,'ci-native-a-approved.json');
 fs.writeFileSync(a,JSON.stringify({...obj,policy:{effect:'A_READONLY'}}));
 assert.equal(readNativeScope('A_READONLY',{root}).policy.effect,'A_READONLY');
}));

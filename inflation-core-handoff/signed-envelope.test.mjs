import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {generateKeyPairSync,verify,createHash} from 'node:crypto';
import {authorizeCoreOwnedHandoff,
 CORE_HANDOFF_REQUEST_SCHEMA,CORE_HANDOFF_APPROVAL_SCHEMA,
 CORE_HANDOFF_ISSUE_TITLE,CORE_HANDOFF_ISSUE_LABEL,
 CORE_HANDOFF_OPERATION,CORE_HANDOFF_MODE,CORE_HANDOFF_DELIVERY,
 CORE_HANDOFF_SOURCE_FILES} from './contract.mjs';
import {signCoreHandoff,coreHandoffSigningBytes,stageSignedCoreHandoff} from './signed-envelope.mjs';
import {CONTROL_REPO,OWNER,SCOPE,SOURCE_ROOT,DATA_ROOT,URLS,TARGETS,MAX_BYTES}
 from '../inflation-manual-b/contract.mjs';
const id='c131d4c4-b788-4a1c-9f60-146dd6f7abb1';
const sha=b=>createHash('sha256').update(b).digest('hex');
function fixture(){
 const approval={schema:CORE_HANDOFF_APPROVAL_SCHEMA,status:'APPROVED_B',
  scope:SCOPE,sourceRoot:SOURCE_ROOT,dataRoot:DATA_ROOT,
  coreExecution:CORE_HANDOFF_MODE,delivery:CORE_HANDOFF_DELIVERY,
  runCount:1,sourceSha:'a'.repeat(40),
  sourceFiles:CORE_HANDOFF_SOURCE_FILES.map(path=>({path,sha256:'b'.repeat(64)})),
  providerUrls:URLS,targetFiles:TARGETS,maxBytes:MAX_BYTES,
  timeoutMs:40_000,allowDbWrites:false,allowD1Writes:false,
  allowTaskChanges:false,allowSourceChanges:false,allowOtherWrites:false};
 const bytes=Buffer.from(JSON.stringify(approval));
 const req={schema:CORE_HANDOFF_REQUEST_SCHEMA,requestId:id,chatId:'chat-w01',
  operation:CORE_HANDOFF_OPERATION,controlRepository:CONTROL_REPO,
  approvalManifestPath:'approvals/inflation-core-handoff/w01-v3.json',
  approvalManifestSha256:sha(bytes)};
 const event={action:'opened',repository:{full_name:CONTROL_REPO,private:true},
  sender:{login:OWNER},issue:{number:100,user:{login:OWNER},
   title:CORE_HANDOFF_ISSUE_TITLE,labels:[{name:CORE_HANDOFF_ISSUE_LABEL}],
   body:JSON.stringify(req)}};
 const env={GITHUB_REPOSITORY:CONTROL_REPO,GITHUB_EVENT_NAME:'issues',
  GITHUB_EVENT_ACTION:'opened',GITHUB_ACTOR:OWNER,GITHUB_RUN_ATTEMPT:'1',
  GITHUB_SHA:'c'.repeat(40)};
 return authorizeCoreOwnedHandoff({event,env,manifestBytes:bytes});
}
const now=Date.UTC(2026,10,21);
const nonce='7c4e0b76-153d-41af-99d4-ec13a8394c89';
test('only branded V3 authority signs bounded exact envelope',()=>{
 const auth=fixture(),{privateKey,publicKey}=generateKeyPairSync('ed25519');
 const signed=signCoreHandoff({authorization:auth,privateKey,now,nonce});
 assert.equal(signed.requestId,id);
 assert.equal(signed.expiresAt-now,1_200_000);
 assert.equal(signed.sourceSha,'a'.repeat(40));
 assert.equal(verify(null,coreHandoffSigningBytes(signed),publicKey,
  Buffer.from(signed.signature,'base64')),true);
});
test('no forged auth, altered nonce or old V2 object can obtain signature',()=>{
 const auth=fixture(),{privateKey}=generateKeyPairSync('ed25519');
 for(const value of [{...auth},{manifest:auth.manifest,request:auth.request},null]){
  assert.throws(()=>signCoreHandoff({authorization:value,privateKey,now,nonce}),
   {code:'INFL_CORE_HANDOFF_AUTH_OBJECT_STOP'});
 }
 assert.throws(()=>signCoreHandoff({authorization:auth,privateKey,
  now,nonce:'not-a-nonce'}),{code:'W01_CORE_HANDOFF_SIGNING_UNVERIFIED_STOP'});
});
test('signer accepts Ed25519 only, never an untrusted symmetric key',()=>{
 const auth=fixture();
 assert.throws(()=>signCoreHandoff({authorization:auth,
  privateKey:Buffer.from('arbitrary'),now,nonce}),
  {code:'W01_CORE_HANDOFF_SIGNING_UNVERIFIED_STOP'});
});

test('exact request staged atomically once, never replaces existing request',()=>{
 const home=fs.mkdtempSync(path.join(os.tmpdir(),'w01-signed-transfer-'));
 const data=path.join(home,'inflation-causal-candidates-r1');
 fs.mkdirSync(data);
 try{
  const authority=fixture();
  const {privateKey}=generateKeyPairSync('ed25519');
  const opts={authorization:authority,privateKey,approvedRoot:home,fsImpl:fs,now,nonce};
  const staged=stageSignedCoreHandoff(opts);
  assert.equal(staged.status,'SIGNED_CANDIDATE_STAGED_NOT_EXECUTED');
  assert.equal(staged.providerCalls,0);
  const target=path.join(data,'core-handoff',id+'.signed.json');
  const envelope=JSON.parse(fs.readFileSync(target,'utf8'));
  assert.equal(envelope.requestId,id);
  assert.throws(()=>stageSignedCoreHandoff({...opts,
   nonce:'8e40a64d-c3bb-407d-9cdb-64c67d6645e9'}),
   {code:'W01_CORE_HANDOFF_SIGNING_UNVERIFIED_STOP'});
  assert.equal(JSON.parse(fs.readFileSync(target,'utf8')).nonce,nonce);
 }finally{fs.rmSync(home,{recursive:true,force:true});}
});
test('unbranded authorization cannot stage a file',()=>{
 const home=fs.mkdtempSync(path.join(os.tmpdir(),'w01-no-auth-'));
 fs.mkdirSync(path.join(home,'inflation-causal-candidates-r1'));
 try{
  const {privateKey}=generateKeyPairSync('ed25519');
  assert.throws(()=>stageSignedCoreHandoff({authorization:{...fixture()},
   privateKey,approvedRoot:home,fsImpl:fs,now,nonce}),
   {code:'INFL_CORE_HANDOFF_AUTH_OBJECT_STOP'});
  assert.equal(fs.existsSync(path.join(home,'inflation-causal-candidates-r1','core-handoff')),false);
 }finally{fs.rmSync(home,{recursive:true,force:true});}
});

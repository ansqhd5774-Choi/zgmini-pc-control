import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {validateRequest} from '../controller/common.mjs';
import {validatePreimageApproval,readStagedPreimageScope,preimageStageFile,
 stagedPayload,isSafePreimagePath,blockedPayload} from '../controller/preimage-manifest-contract.mjs';
import {stagePreimageManifest,verifyInstalledStageSource} from '../controller/preimage-manifest-stager.mjs';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const MANIFEST='approvals/writer-preimage/inflation-candidates-7-r1.json';
const SOURCE_SHA='a'.repeat(40);
const base={schema:'ZGMINI_PC_JOB_V1',requestId:'preimage-test-12345',chatId:'preimage-test',
 operation:'writer-install-preimage-readonly',sourceRepository:'ansqhd5774-Choi/zgmini',
 sourceBranch:'main',sourceSha:SOURCE_SHA};
const policy={sourceRepository:'ansqhd5774-Choi/zgmini',operations:{
 'writer-install-preimage-readonly':{},'core-status':{}}};
const approval={schema:'ZGMINI_WRITER_PREIMAGE_SCOPE_APPROVAL_V1',
 status:'APPROVED_A_READONLY',scope:'PC_WRITER_APPROVED_SOURCE_PREIMAGE',
 sourceRoot:'projects/zgmini-earnings-history-pc-release',
 files:[{path:'scripts/pc-writer/run-local.mjs',change:'M'},
  {path:'worker/inflation-causal-candidates-public-7-r1.mjs',change:'A'}],
 allowOtherPaths:false};
const bytes=()=>Buffer.from(JSON.stringify(approval));
const scoped=()=>({...base,preimageManifestPath:MANIFEST,
 preimageManifestSha256:sha(bytes())});
const env=tmp=>({GITHUB_REPOSITORY:'ansqhd5774-Choi/zgmini-pc-control',
 GITHUB_ACTOR:'ansqhd5774-Choi',GITHUB_EVENT_NAME:'issues',GITHUB_RUN_ID:'999333',
 GITHUB_RUN_ATTEMPT:'1',RUNNER_TEMP:tmp,GITHUB_SHA:SOURCE_SHA,GITHUB_TOKEN:'token-test-without-data-leak-123'});
const event=request=>({action:'opened',repository:{private:true},
 issue:{user:{login:'ansqhd5774-Choi'},labels:[{name:'pc-job'}],
 body:JSON.stringify(request)}});

test('legacy seven-field A contract unchanged; scope only for fixed preimage operation',()=>{
 assert.deepEqual(validateRequest(base,policy),base);
 assert.deepEqual(validateRequest(scoped(),policy),scoped());
 assert.throws(()=>validateRequest({...base,files:['C:\\private']},policy),{code:'REQUEST_FIELDS'});
 assert.throws(()=>validateRequest({...scoped(),operation:'core-status'},policy),{code:'REQUEST_FIELDS'});
 assert.throws(()=>validateRequest({...scoped(),preimageManifestPath:'../../private.json'},policy),
  {code:'PREIMAGE_MANIFEST_PATH'});
 assert.throws(()=>validateRequest({...scoped(),preimageManifestSha256:'0'},policy),
  {code:'PREIMAGE_MANIFEST_SHA'});
});

test('approved scope validates hash, exact keys, path, effect, count and case collision',()=>{
 const good=bytes();const expectedSha256=sha(good);
 const read=validatePreimageApproval(good,{expectedSha256,manifestPath:MANIFEST});
 assert.equal(read.files.length,2);assert.equal(read.scope,'APPROVED_MANIFEST');
 assert.equal(isSafePreimagePath('scripts/pc-writer/run-local.mjs'),true);
 assert.equal(isSafePreimagePath('lib/../../private.mjs'),false);
 assert.equal(isSafePreimagePath('secret/private.mjs'),false);
 assert.throws(()=>validatePreimageApproval(good,{expectedSha256:'f'.repeat(64),
  manifestPath:MANIFEST}),{code:'PREIMAGE_STAGE_MANIFEST_HASH_STOP'});
 for(const replacement of [
  {...approval,files:[{path:'../private.mjs',change:'M'}]},
  {...approval,files:[{path:'scripts/pc-writer/run-local.mjs',change:'A'},
   {path:'scripts/pc-writer/RUN-LOCAL.mjs',change:'M'}]},
  {...approval,allowOtherPaths:true},
  {...approval,files:Array.from({length:33},(_,i)=>({path:`lib/x${i}.mjs`,change:'M'}))},
  {...approval,files:[{path:'lib/x.mjs',change:'M',command:'cmd /c whoami'}]},
 ]){const altered=Buffer.from(JSON.stringify(replacement));
  assert.throws(()=>validatePreimageApproval(altered,{expectedSha256:sha(altered),
   manifestPath:MANIFEST}),{code:'PREIMAGE_STAGE_MANIFEST_SCOPE_STOP'});
 }
});

test('authenticated stage pins immutable event SHA and sends no token in output',async()=>{
 const request=scoped(),e=event(request),t=fs.mkdtempSync(path.join(os.tmpdir(),'preimage-stage-'));
 try{
  const captured=[];
  const stage=await stagePreimageManifest({env:env(t),event:e,policy,
   fetchImpl:async(url,options)=>{captured.push({url,headers:options.headers});
    return {ok:true,text:async()=>JSON.stringify({type:'file',encoding:'base64',
     content:bytes().toString('base64')})};}});
  assert.match(captured[0].url,/\?ref=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa$/);
  assert.equal(JSON.stringify(stage).includes(env(t).GITHUB_TOKEN),false);
  assert.equal(stage.manifestSha256,request.preimageManifestSha256);
  const file=preimageStageFile(env(t));fs.writeFileSync(file,JSON.stringify(stage));
  const observed=readStagedPreimageScope({env:env(t),request});
  assert.deepEqual(observed.files,approval.files);
  assert.equal(readStagedPreimageScope({env:env(t),request:base}),null);
  assert.throws(()=>readStagedPreimageScope({env:{...env(t),GITHUB_SHA:'b'.repeat(40)},
   request}),{code:'PREIMAGE_STAGE_OUTPUT_STOP'});
 }finally{fs.rmSync(t,{recursive:true,force:true});}
});

test('failed fetch, invalid token or foreign actor never produces an approved scope',async()=>{
 const request=scoped(),e=event(request),t=fs.mkdtempSync(path.join(os.tmpdir(),'preimage-reject-'));
 try{
  await assert.rejects(stagePreimageManifest({env:{...env(t),GITHUB_TOKEN:''},
   event:e,policy}),{code:'PREIMAGE_STAGE_AUTH_UNAVAILABLE'});
  await assert.rejects(stagePreimageManifest({env:env(t),event:{...e,
   issue:{...e.issue,user:{login:'other'}}},policy}),{code:'PREIMAGE_STAGE_EVENT_STOP'});
  await assert.rejects(stagePreimageManifest({env:env(t),event:e,policy,
   fetchImpl:async()=>({ok:false})}),{code:'PREIMAGE_STAGE_FETCH_STOP'});
 }finally{fs.rmSync(t,{recursive:true,force:true});}
});

test('credential step checks all installed controller SHA records before token use',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'preimage-host-'));
 const names=['controller/preimage-manifest-stager.mjs',
  'controller/preimage-manifest-contract.mjs','controller/common.mjs',
  'controller/entry.mjs'];
 try{
  const controllerFiles={};
  for(const rel of names){const file=path.join(root,rel);
   fs.mkdirSync(path.dirname(file),{recursive:true});
   const data=Buffer.from('approved installed '+rel);
   fs.writeFileSync(file,data);controllerFiles[rel]=sha(data);
  }
  assert.doesNotThrow(()=>verifyInstalledStageSource(root,{controllerFiles}));
  assert.throws(()=>verifyInstalledStageSource(root,{controllerFiles:{...controllerFiles,
   'controller/common.mjs':'a'.repeat(64)}}),{code:'PREIMAGE_STAGE_SOURCE_NOT_ATTESTED'});
  assert.throws(()=>verifyInstalledStageSource(root,{controllerFiles:Object.fromEntries(
   Object.entries(controllerFiles).filter(([p])=>!p.endsWith('preimage-manifest-stager.mjs')))}),
   {code:'PREIMAGE_STAGE_SOURCE_NOT_ATTESTED'});
  fs.unlinkSync(path.join(root,'controller/entry.mjs'));
  assert.throws(()=>verifyInstalledStageSource(root,{controllerFiles}),
   {code:'PREIMAGE_STAGE_SOURCE_NOT_ATTESTED'});
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('a failed stage yields a bounded BLOCKED code, never a default scope',()=>{
 const request=scoped(),t=fs.mkdtempSync(path.join(os.tmpdir(),'preimage-block-'));
 try{
  const file=preimageStageFile(env(t));
  fs.writeFileSync(file,JSON.stringify(blockedPayload('PREIMAGE_STAGE_SOURCE_NOT_ATTESTED')));
  assert.throws(()=>readStagedPreimageScope({env:env(t),request}),
   {code:'PREIMAGE_STAGE_SOURCE_NOT_ATTESTED'});
  assert.deepEqual(blockedPayload('arbitrary credential error'),
   {status:'BLOCKED',code:'PREIMAGE_STAGE_OUTPUT_STOP'});
 }finally{fs.rmSync(t,{recursive:true,force:true});}
});

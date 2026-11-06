import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {installTwoFiles,verifyRequest,verifyApproval} from './install.mjs';
import {uploadResult} from './upload.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const workspace=path.dirname(here);
const requestId='pc-calendar-12345678-1234-4234-9234-123456789abc';
const chatId='chat-87654321-1234-4234-9234-123456789abc';
const controlSha='a'.repeat(40);
const sha=b=>createHash('sha256').update(b).digest('hex');
const paths=['lib/release-calendar.mjs','scripts/pc-writer/release-calendar.mjs'];
const originals=[
 path.join(workspace,'upload','release-calendar.mjs'),
 path.join(workspace,'upload','release-calendar(1).mjs'),
];
const before=['97800cfbe226be56c3f10e9fa4a37a8967a7e84ad5ba2f098477f7fb3447aefe',
 '75861acfb5481572cbfb4d769647cc77fb991f5b44cf909851172ebb93566eda'];
const after=['d12028f9b9c66d63a10d1e1b93d0846b5bf8d9e7c49fed2be6efefd9694f8d0b',
 'e428c40301ce34f2cadd06d15dcb9d73f554ef989bd9379cef68b2cd461a1a94'];

function fixture(t){
 const base=fs.mkdtempSync(path.join(os.tmpdir(),'calendar-b-fixture-'));
 t.after(()=>fs.rmSync(base,{recursive:true,force:true}));
 const sourceRoot=path.join(base,'source'),backupRoot=path.join(base,'backups'),
  locks=path.join(base,'locks');
 fs.mkdirSync(locks);fs.mkdirSync(sourceRoot);
 for(let i=0;i<paths.length;i++){
  const dest=path.join(sourceRoot,paths[i]);fs.mkdirSync(path.dirname(dest),{recursive:true});
  fs.copyFileSync(originals[i],dest);
 }
 return {requestId,sourceRoot,backupRoot,sharedLock:path.join(locks,'writer-source-install.lock'),
  cycleLock:path.join(locks,'local-cycle.lock'),payloadRoot:path.join(here,'payload')};
}
function current(root){return paths.map(p=>sha(fs.readFileSync(path.join(root,p))));}
function makeEvent(){
 const request={schema:'ZGMINI_RELEASE_CALENDAR_2FILE_B_REQUEST_V1',requestId,chatId,
  operation:'release-calendar-twofile-install-once',
  controlRepository:'ansqhd5774-Choi/zgmini-pc-control',controlSha,
  approvalManifestSha256:'d43a1fceef8ea606bad083d662f4a5a8d5738cfbcc8d54126169777d12c29c02'};
 const event={action:'opened',repository:{private:true,
  full_name:'ansqhd5774-Choi/zgmini-pc-control'},
  sender:{login:'ansqhd5774-Choi'},issue:{number:900,title:'pc-calendar-twofile-install-once',
   user:{login:'ansqhd5774-Choi'},labels:[{name:'pc-calendar-twofile-b-install'}],
   body:JSON.stringify(request)}};
 const env={GITHUB_REPOSITORY:'ansqhd5774-Choi/zgmini-pc-control',
  GITHUB_EVENT_NAME:'issues',GITHUB_EVENT_ACTION:'opened',GITHUB_ACTOR:'ansqhd5774-Choi',
  GITHUB_RUN_ATTEMPT:'1',GITHUB_SHA:controlSha,RUNNER_NAME:'zgmini-pc-02'};
 return {event,env};
}

test('payload files and raw approval are immutable exact bytes',()=>{
 for(let i=0;i<paths.length;i++){
  assert.equal(sha(fs.readFileSync(originals[i])),before[i]);
  assert.equal(sha(fs.readFileSync(path.join(here,'payload',paths[i]))),after[i]);
 }
 verifyApproval(fs.readFileSync(path.join(here,'approval.json')));
});

test('two-file install backs up and verifies both; no other file changes',t=>{
 const args=fixture(t),extra=path.join(args.sourceRoot,'unrelated.txt');
 fs.writeFileSync(extra,'unchanged');
 const r=installTwoFiles(args);
 assert.equal(r.status,'SUCCEEDED');
 assert.deepEqual(current(args.sourceRoot),after);
 assert.deepEqual(paths.map(p=>sha(fs.readFileSync(path.join(args.backupRoot,requestId,p)))),before);
 assert.equal(fs.readFileSync(extra,'utf8'),'unchanged');
 assert.equal(fs.existsSync(args.sharedLock),false);
 assert.equal(fs.existsSync(args.cycleLock),false);
 assert.equal(JSON.parse(fs.readFileSync(path.join(args.backupRoot,requestId,'state.json'),'utf8')).phase,'VERIFIED');
});

test('failure after first file automatically restores exact original two files',t=>{
 const args=fixture(t);
 assert.throws(()=>installTwoFiles({...args,simulateFailureAt:paths[0]}),
  /CAL_B_ROLLED_BACK_VERIFIED/);
 assert.deepEqual(current(args.sourceRoot),before);
 assert.equal(fs.existsSync(args.sharedLock),false);
 assert.equal(fs.existsSync(args.cycleLock),false);
 assert.equal(JSON.parse(fs.readFileSync(path.join(args.backupRoot,requestId,
  'rollback-result.json'),'utf8')).phase,'ROLLED_BACK');
});

test('rollback failure is RECOVERY_REQUIRED and does not release owned locks',t=>{
 const args=fixture(t);
 assert.throws(()=>installTwoFiles({...args,simulateFailureAt:paths[0],
  simulateRollbackFailure:true}),/CAL_B_RECOVERY_REQUIRED_STOP/);
 assert.deepEqual(current(args.sourceRoot),[after[0],before[1]]);
 assert.equal(fs.readFileSync(args.sharedLock,'utf8'),requestId);
 assert.equal(JSON.parse(fs.readFileSync(args.cycleLock,'utf8')).pid,process.pid);
 assert.equal(JSON.parse(fs.readFileSync(path.join(args.backupRoot,requestId,
  'recovery-required.json'),'utf8')).phase,'RECOVERY_REQUIRED');
});

test('wrong source hash stops before lock, backup, or mutation',t=>{
 const args=fixture(t);
 fs.appendFileSync(path.join(args.sourceRoot,paths[1]),'modified');
 const initial=current(args.sourceRoot);
 assert.throws(()=>installTwoFiles(args),/CAL_B_BEFORE_SHA_STOP/);
 assert.deepEqual(current(args.sourceRoot),initial);
 assert.equal(fs.existsSync(args.backupRoot),false);
 assert.equal(fs.existsSync(args.sharedLock),false);
});

test('writer mutex and live cycle lock are respected without deleting owners',t=>{
 const args=fixture(t);
 fs.writeFileSync(args.sharedLock,'someone-else');
 assert.throws(()=>installTwoFiles(args),/CAL_B_SHARED_LOCK_BUSY_STOP/);
 assert.equal(fs.readFileSync(args.sharedLock,'utf8'),'someone-else');
 fs.unlinkSync(args.sharedLock);
 fs.writeFileSync(args.cycleLock,JSON.stringify({pid:111,at:222}));
 assert.throws(()=>installTwoFiles(args),/CAL_B_CYCLE_BUSY_STOP/);
 assert.equal(fs.readFileSync(args.cycleLock,'utf8'),JSON.stringify({pid:111,at:222}));
 assert.equal(fs.existsSync(args.sharedLock),false);
 assert.deepEqual(current(args.sourceRoot),before);
});

test('one-shot event and source SHA binding reject tampered request',()=>{
 const {event,env}=makeEvent();
 const workflow=fs.readFileSync(path.join(here,'.github','workflows',
  'pc-calendar-twofile-b-install-once.yml'),'utf8');
 assert.match(workflow,/GITHUB_EVENT_ACTION:\s*\$\{\{ github\.event\.action \}\}/);
 assert.match(workflow,/GIT_CONFIG_KEY_0:\s*core\.autocrlf/);
 assert.match(workflow,/GIT_CONFIG_VALUE_0:\s*'false'/);
 assert.equal(verifyRequest(event,env).request.requestId,requestId);
 assert.throws(()=>verifyRequest(event,{...env,GITHUB_SHA:'b'.repeat(40)}),
  /CAL_B_REQUEST_SCOPE_STOP/);
 assert.throws(()=>verifyRequest({...event,sender:{login:'outsider'}},env),
  /CAL_B_ISSUE_AUTHORIZATION_STOP/);
});

test('sanitized result pair uploaded with exact remote-byte readback, once',async t=>{
 const args=fixture(t),output=path.join(path.dirname(args.sourceRoot),'temp');
 fs.mkdirSync(output);
 const {event,env}=makeEvent(),eventPath=path.join(output,'event.json');
 fs.writeFileSync(eventPath,JSON.stringify(event));
 const result={schema:'ZGMINI_RELEASE_CALENDAR_2FILE_B_RESULT_V1',requestId,
  status:'SUCCEEDED',code:'CAL_B_TWOFILE_INSTALLED_VERIFIED',phase:'VERIFIED',
  controlSha,afterVerified:2,backupVerified:2,
  retry:'NO_REEXECUTE_READBACK_ONLY',secret:'DO_NOT_UPLOAD'};
 fs.writeFileSync(path.join(output,'calendar-b-install-result.json'),JSON.stringify(result));
 const stored=new Map(),posts=[];
 const fakeFetch=async(url,options={})=>{
  if(url.endsWith('/comments')){
   posts.push(JSON.parse(options.body));return new Response('{}',{status:201});
  }
  const name=url.split('/contents/')[1];
  if(options.method==='PUT'){
   if(stored.has(name))return new Response('{}',{status:422});
   stored.set(name,Buffer.from(JSON.parse(options.body).content,'base64').toString('utf8'));
   return new Response('{}',{status:201});
  }
  if(stored.has(name))return Response.json({encoding:'base64',
   content:Buffer.from(stored.get(name),'utf8').toString('base64')});
  return new Response('{}',{status:404});
 };
 const resultUpload=await uploadResult({env:{...env,GITHUB_EVENT_PATH:eventPath,
  RUNNER_TEMP:output,GITHUB_TOKEN:'token_placeholder_for_test_12345'},fetchImpl:fakeFetch});
 assert.equal(resultUpload.remoteResultPairsVerified,2);
 assert.equal(posts.length,1);
 assert.equal(stored.size,2);
 assert.equal([...stored.values()].join('\n').includes('DO_NOT_UPLOAD'),false);
});

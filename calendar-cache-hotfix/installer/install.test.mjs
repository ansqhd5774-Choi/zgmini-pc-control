import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {installOneFile,verifyRequest,verifyApproval} from './install.mjs';
import {uploadResult} from './upload.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const hotfixRoot=path.dirname(here),scratch=path.dirname(hotfixRoot);
const relative='scripts/pc-writer/release-calendar.mjs';
const original=path.join(scratch,'calendar-b-twofile','payload',relative);
const candidate=path.join(hotfixRoot,'payload',relative);
const before='e428c40301ce34f2cadd06d15dcb9d73f554ef989bd9379cef68b2cd461a1a94';
const after='3fa8e1039fcedd3b2fb07b888996f845c6b7102505acdba7608818cb56238871';
const approval='8fe6885877b9c36b584eb51e949565ad60737da2b503d321d7a77958d4852fb9';
const requestId='pc-calendar-cache-12345678-1234-4234-9234-123456789abc';
const chatId='chat-87654321-1234-4234-9234-123456789abc';
const controlSha='a'.repeat(40);
const sha=b=>createHash('sha256').update(b).digest('hex');

function fixture(t){
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'calendar-cache-b-test-'));
 t.after(()=>fs.rmSync(temp,{recursive:true,force:true}));
 const sourceRoot=path.join(temp,'source'),backupRoot=path.join(temp,'backups'),
  locks=path.join(temp,'locks');
 fs.mkdirSync(path.dirname(path.join(sourceRoot,relative)),{recursive:true});
 fs.mkdirSync(locks);
 fs.copyFileSync(original,path.join(sourceRoot,relative));
 return {requestId,sourceRoot,backupRoot,sharedLock:path.join(locks,'writer-source-install.lock'),
  cycleLock:path.join(locks,'local-cycle.lock'),payloadRoot:path.join(hotfixRoot,'payload')};
}
const installed=root=>sha(fs.readFileSync(path.join(root,relative)));
function event(){
 const request={schema:'ZGMINI_RELEASE_CALENDAR_CACHE_HOTFIX_B_REQUEST_V1',
  requestId,chatId,operation:'release-calendar-cache-hotfix-install-once',
  controlRepository:'ansqhd5774-Choi/zgmini-pc-control',controlSha,
  approvalManifestSha256:approval};
 const evt={action:'opened',repository:{private:true,
  full_name:'ansqhd5774-Choi/zgmini-pc-control'},
  sender:{login:'ansqhd5774-Choi'},
  issue:{number:970,title:'pc-calendar-cache-hotfix-install-once',
   user:{login:'ansqhd5774-Choi'},
   labels:[{name:'pc-calendar-cache-hotfix-b-install'}],body:JSON.stringify(request)}};
 const env={GITHUB_REPOSITORY:'ansqhd5774-Choi/zgmini-pc-control',
  GITHUB_EVENT_NAME:'issues',GITHUB_EVENT_ACTION:'opened',
  GITHUB_ACTOR:'ansqhd5774-Choi',GITHUB_RUN_ATTEMPT:'1',
  GITHUB_SHA:controlSha};
 return {evt,env};
}

test('exact original and modified bytes, manifest fixed',()=>{
 assert.equal(sha(fs.readFileSync(original)),before);
 assert.equal(sha(fs.readFileSync(candidate)),after);
 assert.equal(sha(fs.readFileSync(path.join(here,'approval.json'))),approval);
 verifyApproval(fs.readFileSync(path.join(here,'approval.json')));
});

test('one approved file only installed, backup/readback and unrelated files preserved',t=>{
 const args=fixture(t);
 const untouched=path.join(args.sourceRoot,'lib','release-calendar.mjs');
 fs.mkdirSync(path.dirname(untouched),{recursive:true});
 fs.writeFileSync(untouched,'untouched source');
 const r=installOneFile(args);
 assert.equal(r.status,'SUCCEEDED');
 assert.equal(r.fileCount,1);
 assert.equal(installed(args.sourceRoot),after);
 assert.equal(sha(fs.readFileSync(path.join(args.backupRoot,requestId,relative))),before);
 assert.equal(fs.readFileSync(untouched,'utf8'),'untouched source');
 assert.equal(fs.existsSync(args.sharedLock),false);
 assert.equal(fs.existsSync(args.cycleLock),false);
 const journal=JSON.parse(fs.readFileSync(path.join(args.backupRoot,requestId,'state.json')));
 assert.equal(journal.phase,'VERIFIED');
});

test('wrong installed source SHA stops before any lock, backup or mutation',t=>{
 const args=fixture(t),target=path.join(args.sourceRoot,relative);
 fs.appendFileSync(target,'tamper');
 const initial=installed(args.sourceRoot);
 assert.throws(()=>installOneFile(args),/CAL_CACHE_B_BEFORE_SHA_STOP/);
 assert.equal(installed(args.sourceRoot),initial);
 assert.equal(fs.existsSync(args.backupRoot),false);
 assert.equal(fs.existsSync(args.sharedLock),false);
});

test('wrong candidate payload SHA stops before any lock or backup',t=>{
 const args=fixture(t),tampered=path.join(path.dirname(args.sourceRoot),'payload');
 const file=path.join(tampered,relative);
 fs.mkdirSync(path.dirname(file),{recursive:true});
 fs.copyFileSync(candidate,file);
 fs.appendFileSync(file,'unexpected bytes');
 assert.throws(()=>installOneFile({...args,payloadRoot:tampered}),
  /CAL_CACHE_B_PAYLOAD_SHA_STOP/);
 assert.equal(installed(args.sourceRoot),before);
 assert.equal(fs.existsSync(args.backupRoot),false);
 assert.equal(fs.existsSync(args.sharedLock),false);
});

test('colliding one-shot backup directory never overwrites it or the source',t=>{
 const args=fixture(t),journal=path.join(args.backupRoot,requestId);
 fs.mkdirSync(journal,{recursive:true});
 fs.writeFileSync(path.join(journal,'sentinel.txt'),'prior request');
 assert.throws(()=>installOneFile(args),/EEXIST/);
 assert.equal(fs.readFileSync(path.join(journal,'sentinel.txt'),'utf8'),'prior request');
 assert.equal(installed(args.sourceRoot),before);
 assert.equal(fs.existsSync(args.sharedLock),false);
 assert.equal(fs.existsSync(args.cycleLock),false);
});

test('mutex and Core cycle lock stop without erasing other owners',t=>{
 const args=fixture(t);
 fs.writeFileSync(args.sharedLock,'another-operation');
 assert.throws(()=>installOneFile(args),/CAL_CACHE_B_SHARED_LOCK_BUSY_STOP/);
 assert.equal(fs.readFileSync(args.sharedLock,'utf8'),'another-operation');
 fs.unlinkSync(args.sharedLock);
 fs.writeFileSync(args.cycleLock,JSON.stringify({pid:888,at:1}));
 assert.throws(()=>installOneFile(args),/CAL_CACHE_B_CYCLE_BUSY_STOP/);
 assert.equal(installed(args.sourceRoot),before);
 assert.equal(fs.readFileSync(args.cycleLock,'utf8'),JSON.stringify({pid:888,at:1}));
 assert.equal(fs.existsSync(args.sharedLock),false);
});

test('one-shot Core wait proceeds only after owner lock disappears',t=>{
 const args=fixture(t),owner=JSON.stringify({pid:777,at:1});
 fs.writeFileSync(args.cycleLock,owner);
 let ticks=0;
 const result=installOneFile({...args,waitCycleMs:5000,waitCycleTick:()=>{
  ticks++;
  assert.equal(fs.readFileSync(args.cycleLock,'utf8'),owner);
  assert.equal(fs.existsSync(args.sharedLock),false);
  assert.equal(installed(args.sourceRoot),before);
  fs.unlinkSync(args.cycleLock);
 }});
 assert.equal(ticks,1);
 assert.equal(result.status,'SUCCEEDED');
 assert.equal(installed(args.sourceRoot),after);
 assert.equal(fs.existsSync(args.cycleLock),false);
});

test('bounded Core wait does not steal owner lock or mutate source',t=>{
 const args=fixture(t),owner='another-cycle';
 fs.writeFileSync(args.cycleLock,owner);
 assert.throws(()=>installOneFile({...args,waitCycleMs:1,waitCycleTick:()=>{}}),
  /CAL_CACHE_B_CYCLE_BUSY_TIMEOUT_STOP/);
 assert.equal(fs.readFileSync(args.cycleLock,'utf8'),owner);
 assert.equal(installed(args.sourceRoot),before);
 assert.equal(fs.existsSync(args.sharedLock),false);
 assert.equal(fs.existsSync(args.backupRoot),false);
});

test('failure after replacement restores verified original and releases locks',t=>{
 const args=fixture(t);
 assert.throws(()=>installOneFile({...args,simulateFailureAfterReplace:true}),
  /CAL_CACHE_B_ROLLED_BACK_VERIFIED/);
 assert.equal(installed(args.sourceRoot),before);
 assert.equal(fs.existsSync(args.sharedLock),false);
 assert.equal(fs.existsSync(args.cycleLock),false);
 const rollback=JSON.parse(fs.readFileSync(path.join(args.backupRoot,requestId,'rollback-result.json')));
 assert.equal(rollback.phase,'ROLLED_BACK');
});

test('failed rollback preserves both owned locks for explicit recovery',t=>{
 const args=fixture(t);
 assert.throws(()=>installOneFile({...args,simulateFailureAfterReplace:true,
  simulateRollbackFailure:true}),/CAL_CACHE_B_RECOVERY_REQUIRED_STOP/);
 assert.equal(installed(args.sourceRoot),after);
 assert.equal(fs.readFileSync(args.sharedLock,'utf8'),requestId);
 assert.equal(JSON.parse(fs.readFileSync(args.cycleLock,'utf8')).pid,process.pid);
});

test('workflow and event are exact, no repeat or 2-file workflow reuse',()=>{
 const {evt,env}=event();
 const rootWorkflow=path.join(scratch,'.github','workflows','pc-calendar-cache-hotfix-once.yml');
 const localWorkflow=path.join(here,'.github','workflows','pc-calendar-cache-hotfix-once.yml');
 const workflow=fs.readFileSync(fs.existsSync(rootWorkflow)?rootWorkflow:localWorkflow,'utf8');
 assert.match(workflow,/GITHUB_EVENT_ACTION:\s*\$\{\{ github\.event\.action \}\}/);
 assert.match(workflow,/GIT_CONFIG_KEY_0:\s*core\.autocrlf/);
 assert.match(workflow,/calendar-cache-hotfix\\installer\\install\.mjs/);
 assert.doesNotMatch(workflow,/calendar-b-twofile\\install\.mjs/);
 assert.equal(verifyRequest(evt,env).request.requestId,requestId);
 assert.throws(()=>verifyRequest(evt,{...env,GITHUB_SHA:'b'.repeat(40)}),
  /CAL_CACHE_B_REQUEST_SCOPE_STOP/);
 assert.throws(()=>verifyRequest({...evt,sender:{login:'outsider'}},env),
  /CAL_CACHE_B_ISSUE_AUTHORIZATION_STOP/);
});

test('upload two sanitized artifacts and verify exact remote bytes',async t=>{
 const args=fixture(t),tmp=path.join(path.dirname(args.sourceRoot),'temp');
 fs.mkdirSync(tmp);
 const {evt,env}=event();
 const eventPath=path.join(tmp,'event.json');
 fs.writeFileSync(eventPath,JSON.stringify(evt));
 fs.writeFileSync(path.join(tmp,'calendar-cache-b-result.json'),JSON.stringify({
  schema:'ZGMINI_RELEASE_CALENDAR_CACHE_HOTFIX_B_RESULT_V1',requestId,
  status:'SUCCEEDED',code:'CAL_CACHE_B_ONEFILE_INSTALLED_VERIFIED',
  phase:'VERIFIED',controlSha,afterVerified:1,backupVerified:1,
  retry:'NO_REEXECUTE_READBACK_ONLY',secret:'DO_NOT_UPLOAD'}));
 const stored=new Map(),comments=[];
 const fetchImpl=async(url,options={})=>{
  if(url.endsWith('/comments')){
   comments.push(JSON.parse(options.body));return new Response('{}',{status:201});
  }
  const name=url.split('/contents/')[1];
  if(options.method==='PUT'){
   if(stored.has(name))return new Response('{}',{status:422});
   stored.set(name,Buffer.from(JSON.parse(options.body).content,'base64').toString('utf8'));
   return new Response('{}',{status:201});
  }
  return stored.has(name)?Response.json({encoding:'base64',
   content:Buffer.from(stored.get(name),'utf8').toString('base64')}):
   new Response('{}',{status:404});
 };
 const r=await uploadResult({env:{...env,GITHUB_EVENT_PATH:eventPath,RUNNER_TEMP:tmp,
  GITHUB_TOKEN:'token_placeholder_for_test_12345'},fetchImpl});
 assert.equal(r.remoteResultPairsVerified,2);
 assert.equal(comments.length,1);
 assert.equal(stored.size,2);
 assert.equal([...stored.values()].join('\n').includes('DO_NOT_UPLOAD'),false);
});

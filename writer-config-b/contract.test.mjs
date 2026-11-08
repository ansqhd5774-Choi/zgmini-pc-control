import test from 'node:test';
import assert from 'node:assert/strict';
import {sha256,authorize,authorizeManifest,authorizeRequest,REQUEST_SCHEMA,
  APPROVAL_SCHEMA,OPERATION,TARGET,SCOPE,TITLE,LABEL,
  CONTROL_REPOSITORY,ACTOR} from './contract.mjs';
import {EMPLOYMENT_R6_PREIMAGE_FILES} from '../controller/writer-install-preimage-readonly.mjs';

const requestId='51b0dd11-11d1-4c51-8e11-e61234567890';
const chatId='9135aa01-0181-4bd7-9b85-462345678901';
const manifest={schema:APPROVAL_SCHEMA,status:'APPROVED_B',scope:SCOPE,
  targetPath:TARGET,beforeSha256:'f'.repeat(64),runCount:1,
  changes:[{key:'employmentR6AutoCollection',value:true},
    {key:'employmentR6OneYearAutoPublication',value:true}],
  allowOtherChanges:false,allowProviderCalls:false,allowTaskChanges:false,
  allowSourceChanges:false,allowDbWrites:false,
  verifiedR6Install:{requestId:'a314f1b7-6279-4136-9bd2-b20123456789',
   manifestSha256:'e'.repeat(64),sourceSha:'c'.repeat(40),issueNumber:999,
   status:'WRITER_B_INSTALLED_VERIFIED'},
  installedFiles:EMPLOYMENT_R6_PREIMAGE_FILES.map(path=>({path,afterSha256:'a'.repeat(64)}))};
function fixture(){
 const manifestBytes=Buffer.from(JSON.stringify(manifest));
 const request={schema:REQUEST_SCHEMA,requestId,chatId,operation:OPERATION,
   controlRepository:CONTROL_REPOSITORY,
   approvalManifestPath:'approvals/writer-config/employment-r6-optins-r6-20261108.json',
   approvalManifestSha256:sha256(manifestBytes)};
 const event={repository:{full_name:CONTROL_REPOSITORY,private:true},
   sender:{login:ACTOR},issue:{number:123,title:TITLE,user:{login:ACTOR},
   labels:[{name:LABEL}],body:JSON.stringify(request)}};
 const env={GITHUB_REPOSITORY:CONTROL_REPOSITORY,GITHUB_EVENT_NAME:'issues',
   GITHUB_EVENT_ACTION:'opened',GITHUB_ACTOR:ACTOR,GITHUB_RUN_ATTEMPT:'1',
   GITHUB_SHA:'f'.repeat(40)};
 return {event,env,manifestBytes};
}

test('accept exactly pinned, owner-originated, one-shot B request',()=>{
 const f=fixture();
 const auth=authorize(f);
 assert.equal(auth.request.requestId,requestId);
 assert.equal(auth.manifest.targetPath,TARGET);
});

test('reject broadened manifest keys, target, data writes, and false values',()=>{
 for(const change of [
   x=>{x.allowDbWrites=true;},
   x=>{x.targetPath='C:\\temp\\config.json';},
   x=>{x.changes[0].value='1';},
   x=>{x.changes[0].value=false;},
   x=>{x.runCount=2;},
   x=>{x.unapproved='x';},
   x=>{x.installedFiles[3].path='lib/other-path.mjs';},
   x=>{x.verifiedR6Install.status='PENDING';},
 ]){
   const bad=structuredClone(manifest);change(bad);
   assert.throws(()=>authorizeManifest(bad),/CONFIG_B_.*_STOP/);
 }
});

test('reject arbitrary manifest path and non-UUID request',()=>{
 const f=fixture(),bad=JSON.parse(f.event.issue.body);
 bad.approvalManifestPath='approvals/writer-config/inflation19-flags-r1.json';
 f.event.issue.body=JSON.stringify(bad);
 assert.throws(()=>authorizeRequest(f.event),/CONFIG_B_REQUEST_SCOPE_STOP/);
 bad.approvalManifestPath='approvals/writer-config/employment-r6-optins-r6-20261108.json';
 bad.requestId='not-uuid';f.event.issue.body=JSON.stringify(bad);
 assert.throws(()=>authorizeRequest(f.event),/CONFIG_B_REQUEST_SCOPE_STOP/);
});

test('reject tampered manifest bytes, actor, action and retry',()=>{
 const f=fixture();
 f.manifestBytes=Buffer.from(f.manifestBytes.toString()+' ');
 assert.throws(()=>authorize(f),/CONFIG_B_MANIFEST_HASH_STOP/);
 const badActor=fixture();badActor.env.GITHUB_ACTOR='different';
 assert.throws(()=>authorize(badActor),/CONFIG_B_EVENT_AUTH_STOP/);
 const badAction=fixture();badAction.env.GITHUB_EVENT_ACTION='edited';
 assert.throws(()=>authorize(badAction),/CONFIG_B_EVENT_AUTH_STOP/);
 const retry=fixture();retry.env.GITHUB_RUN_ATTEMPT='2';
 assert.throws(()=>authorize(retry),/CONFIG_B_EVENT_AUTH_STOP/);
});

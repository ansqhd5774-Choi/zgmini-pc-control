import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {validateRecoveryEvent} from './recovery-1063-admission.mjs';
import {verifyRecoveryApproval,APPROVAL_SHA256,APPROVAL_FILE}
 from './recovery-1063-approval.mjs';
import {sanitizeRecoveryResult} from './recovery-1063-report.mjs';
import {INCIDENT_ID,PREPARED_SHA,FINGERPRINT} from './recovery-1063-core.mjs';

const CONTROL_SHA='c'.repeat(40);
const REQUEST_ID='a2fef0ac-101c-4a1c-8a6e-aabbccddeeff';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const env={GITHUB_REPOSITORY:'ansqhd5774-Choi/zgmini-pc-control',
 GITHUB_ACTOR:'ansqhd5774-Choi',GITHUB_EVENT_NAME:'issues',
 GITHUB_EVENT_ACTION:'opened',GITHUB_RUN_ATTEMPT:'1',GITHUB_SHA:CONTROL_SHA};
const request={schema:'ZGMINI_PC_WRITER_B_1063_RECOVERY_REQUEST_V1',
 requestId:REQUEST_ID,operation:'pc-writer-b-1063-reconcile',
 incidentRequestId:INCIDENT_ID,approvedPreparedSha:PREPARED_SHA,
 expectedJournalSha256:FINGERPRINT.journal,
 approvalManifestPath:APPROVAL_FILE,approvalManifestSha256:APPROVAL_SHA256};
const event=()=>({repository:{full_name:env.GITHUB_REPOSITORY,private:true},
 sender:{login:env.GITHUB_ACTOR},issue:{user:{login:env.GITHUB_ACTOR},
  title:'pc-writer-b-1063-reconcile',
  labels:[{name:'pc-writer-b-1063-recovery'}],body:JSON.stringify(request)}});

test('only exact owner + original incident + fixed B manifest admitted',()=>{
 assert.equal(validateRecoveryEvent(event(),env,CONTROL_SHA).requestId,REQUEST_ID);
});
for(const [name,change] of [
 ['other incident',e=>{const x=JSON.parse(e.issue.body);
  x.incidentRequestId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  e.issue.body=JSON.stringify(x);}],
 ['wrong approved manifest hash',e=>{const x=JSON.parse(e.issue.body);
  x.approvalManifestSha256='0'.repeat(64);e.issue.body=JSON.stringify(x);}],
 ['injected unexpected path',e=>{const x=JSON.parse(e.issue.body);
  x.command='schtasks /Enable';e.issue.body=JSON.stringify(x);}],
 ['label missing',e=>e.issue.labels=[]],
 ['public repository',e=>e.repository.private=false],
 ])test(`admission fails closed on ${name}`,()=>{
 const e=event();change(e);
 assert.throws(()=>validateRecoveryEvent(e,env,CONTROL_SHA),
  {code:/^WRITER_B_1063_(REQUEST_SCOPE|EVENT)_DENIED$/});
});

test('pinned recovery manifest raw bytes and all scope fields verify',()=>{
 assert.equal(verifyRecoveryApproval(root),APPROVAL_SHA256);
});
test('manifest byte mutation is detected before Windows effects',()=>{
 const io={...fs,readFileSync:(file)=>{
  const b=fs.readFileSync(file);
  return Buffer.from(b.toString('utf8').replace('APPROVED_B','APPROVED_A'));
 }};
 assert.throws(()=>verifyRecoveryApproval(root,{io}),
  {code:'WRITER_B_1063_APPROVAL_HASH_DRIFT'});
});

const success={status:'WRITER_B_1063_CORE_RECOVERED',
 code:'WRITER_B_1063_PREPARED_CORE_ENABLED_LOCK_FINALIZED',
 incidentRequestId:INCIDENT_ID,verified:true,lockFinalized:true,
 sourceSha:PREPARED_SHA,installationVerified:false};
test('sanitized recovery success does not claim feature installation',()=>{
 const r=sanitizeRecoveryResult(success,REQUEST_ID,'42630000000');
 assert.equal(r.status,'WRITER_B_1063_CORE_RECOVERED');
 assert.equal(r.coreTaskEnabledVerified,true);
 assert.equal(r.installationVerified,false);
});
for(const [name,patch] of [
 ['wrong incident',{incidentRequestId:'OTHER'}],
 ['wrong source',{sourceSha:'a'.repeat(40)}],
 ['no verified proof',{verified:false}],
 ['lock not finalized',{lockFinalized:false}],
 ['fake installation verified',{installationVerified:true}],
 ['unsafe status',{status:'WRITER_B_INSTALLED_VERIFIED'}],
 ])test(`report cannot turn ${name} into success`,()=>{
 const r=sanitizeRecoveryResult({...success,...patch},REQUEST_ID,'42630000000');
 assert.equal(r.status,'WRITER_B_1063_STATE_UNKNOWN');
 assert.equal(r.coreTaskEnabledVerified,false);
 assert.equal(r.installationVerified,false);
});

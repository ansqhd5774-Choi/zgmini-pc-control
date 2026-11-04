import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateApproval,validateRequest} from '../er1-nov30-actual-pilot-entry.mjs';

const folder=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const fixed='3c58c9232ad4880cf955e17a1edc9bda4b1f0543';
const issue={
 action:'opened',
 issue:{
  title:'pc-er1-nov30-actual-pilot-one-shot',
  user:{login:'ansqhd5774-Choi'},
  labels:[{name:'pc-er1-approved'}],
  body:JSON.stringify({
   schema:'ZGMINI_ER1_NOV30_ACTUAL_PILOT_V1',
   operation:'probe-private-november-2026-actual-er1',
   requestId:'pc-nov30-12345678-1234-4123-a456-123456789abc',
   chatId:'chat-12345678-1234-4123-a456-123456789abc',
   sourceSha:fixed,from:'2026-11-01',through:'2026-11-30',
  })
 }
};
const env={GITHUB_REPOSITORY:'ansqhd5774-Choi/zgmini-pc-control',
 GITHUB_ACTOR:'ansqhd5774-Choi',GITHUB_EVENT_NAME:'issues',
 GITHUB_EVENT_ACTION:'opened'};
const approval=JSON.parse(fs.readFileSync(
 path.join(folder,'ER1_NOV30_ACTUAL_PILOT_B_APPROVAL.json'),'utf8'));

test('fixed request only accepts owner, one-shot issue and exact schema',()=>{
 assert.equal(validateRequest(issue,env).sourceSha,fixed);
 assert.throws(()=>validateRequest(issue,{...env,GITHUB_ACTOR:'anonymous'}),
  /NOV30_PILOT_ISSUE_NOT_APPROVED/);
 assert.throws(()=>validateRequest({...issue,issue:{...issue.issue,labels:[]}},env),
  /NOV30_PILOT_ISSUE_NOT_APPROVED/);
 const badBody={...JSON.parse(issue.issue.body),maxRequests:999};
 assert.throws(()=>validateRequest({...issue,issue:{...issue.issue,
  body:JSON.stringify(badBody)}},env),/NOV30_PILOT_REQUEST_CONTRACT_STOP/);
});
test('fixed B approval is narrowly valid and rejects any enlarged effect',()=>{
 assert.equal(approval.approvalState,'APPROVED_B_ONE_SHOT');
 assert.equal(validateApproval(approval),true);
 const active={...approval};
 assert.throws(()=>validateApproval({...active,approvalState:'DRAFT_PENDING_B_EXECUTION_APPROVAL'}),
  /NOV30_PILOT_APPROVAL_SCOPE_STOP/);
 assert.throws(()=>validateApproval({...active,approvalEffect:'ALLOW_D1'}),
  /NOV30_PILOT_APPROVAL_SCOPE_STOP/);
 assert.equal(validateApproval(active),true);
 assert.throws(()=>validateApproval({...active,maxProviderRequests:4}),
  /NOV30_PILOT_APPROVAL_SCOPE_STOP/);
 assert.throws(()=>validateApproval({...active,allowD1Writes:true}),
  /NOV30_PILOT_APPROVAL_SCOPE_STOP/);
 assert.throws(()=>validateApproval({...active,sourceSha:'0'.repeat(40)}),
  /NOV30_PILOT_APPROVAL_SCOPE_STOP/);
});
test('fixed entry source, manifest and workflow pin same SHA, no D1 writes',()=>{
 const script=fs.readFileSync(path.join(folder,'er1-nov30-actual-pilot-entry.mjs'),'utf8');
 const workflow=fs.readFileSync(path.join(folder,'.github/workflows/pc-er1-nov30-actual-pilot.yml'),'utf8');
 assert.equal(approval.sourceSha,fixed);
 assert.equal(approval.sourceFileSha256,'4f267ae1344a999816be1d9385d8cb5dc0620ab0ec3bb65253e3eaf4e30b7720');
 assert.ok(script.includes(fixed));
 assert.ok(script.includes(approval.sourceFileSha256));
 assert.ok(workflow.includes('ref: '+fixed));
 assert.ok(workflow.includes('ref: $'+'{{ github.sha }}'));
 assert.ok(workflow.includes('shell: cmd'));
 assert.ok(workflow.includes('persist-credentials: false'));
 assert.ok(workflow.includes('timeout-minutes: 5'));
 assert.ok(!workflow.includes('schedule:'));
 assert.equal(approval.allowD1Writes,false);
 assert.equal(approval.allowCoreWrites,false);
 assert.equal(approval.allowSchedulerChanges,false);
});

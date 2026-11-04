import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {issueArtifactNames,validateApproval,validateRequest} from '../er1-nov30-batch20-recovery-entry.mjs';

const folder=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source='a646050a74c691ac6550ededdc9b7fc695c19848';
const approval=JSON.parse(fs.readFileSync(
 path.join(folder,'ER1_NOV30_BATCH20_RECOVERY_B_APPROVAL.json'),'utf8'));
const payload={schema:'ZGMINI_ER1_NOV30_BATCH20_B_V1',
 operation:'batch20-private-actual-er1',sourceSha:source,
 requestId:'pc-nov20-12345678-1234-4123-a456-123456789abc',
 chatId:'chat-12345678-1234-4123-a456-123456789abc',
 from:'2026-11-01',through:'2026-11-30'};
const event={action:'opened',issue:{title:'pc-er1-nov30-batch20-recovery-once',
 user:{login:'ansqhd5774-Choi'},labels:[{name:'pc-er1-approved'}],
 body:JSON.stringify(payload)}};
const env={GITHUB_REPOSITORY:'ansqhd5774-Choi/zgmini-pc-control',
 GITHUB_ACTOR:'ansqhd5774-Choi',GITHUB_EVENT_NAME:'issues',
 GITHUB_EVENT_ACTION:'opened'};

test('batch20 accepts only pinned owner issue, UUID, source SHA and dates',()=>{
 assert.equal(validateRequest(event,env).sourceSha,source);
 assert.throws(()=>validateRequest(event,{...env,GITHUB_ACTOR:'other'}),
  /NOV30_BATCH20_ISSUE_SCOPE_STOP/);
 assert.throws(()=>validateRequest({...event,issue:{...event.issue,labels:[]}},env),
  /NOV30_BATCH20_ISSUE_SCOPE_STOP/);
 assert.throws(()=>validateRequest({...event,issue:{...event.issue,
  body:JSON.stringify({...payload,sourceSha:'0'.repeat(40)})}},env),
  /NOV30_BATCH20_REQUEST_CONTRACT_STOP/);
});
test('exact B approval: twenty selected, at most seventeen GET, no D1',()=>{
 assert.equal(validateApproval(approval),true);
 assert.equal(approval.maxCalendarSymbols,20);
 assert.equal(approval.maxNewProviderRequests,17);
 assert.equal(approval.allowD1Writes,false);
 assert.equal(approval.allowCoreWrites,false);
 for(const change of [{maxNewProviderRequests:18},{maxCalendarSymbols:21},
  {allowD1Writes:true},{allowDirectDeployment:true},
  {allowCoreWrites:true},{approvalState:'DRAFT'},{
   dependentSourceSha256:'0'.repeat(64)}]){
  assert.throws(()=>validateApproval({...approval,...change}),
   /NOV30_BATCH20_APPROVAL_SCOPE_STOP/);
 }
});
test('workflow binds the same source commit and distinct #363 marker',()=>{
 const workflow=fs.readFileSync(path.join(folder,
  '.github/workflows/pc-er1-nov30-batch20-recovery.yml'),'utf8');
 const entry=fs.readFileSync(path.join(folder,'er1-nov30-batch20-recovery-entry.mjs'),'utf8');
 assert.ok(workflow.includes('ref: '+source));
 assert.ok(workflow.includes('ref: $'+'{{ github.sha }}'));
 assert.ok(workflow.includes('shell: cmd'));
 assert.ok(workflow.includes('timeout-minutes: 8'));
 assert.ok(entry.includes('E:\\\\ZGmini\\\\automation\\\\er1-nov30-batch20-recovery-replay1'));
 assert.ok(!entry.includes('er1-nov30-actual-pilot\\\\ONE_SHOT_STARTED'));
 assert.ok(entry.includes(approval.batchSourceSha256));
 assert.ok(entry.includes(approval.dependentSourceSha256));
 assert.ok(entry.includes(source));
 assert.ok(!workflow.includes('schedule:'));
});
test('a new issue cannot consume stale output from a previous PC request',()=>{
 const first=issueArtifactNames(394);
 const next=issueArtifactNames(398);
 assert.notEqual(first.child,next.child);
 assert.notEqual(first.report,next.report);
 assert.match(next.child,/398\.json$/);
 assert.match(next.report,/398\.json$/);
 assert.throws(()=>issueArtifactNames(0),/NOV30_BATCH20_ISSUE_NUMBER_STOP/);
});

import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateApproval,validateRequest} from '../er1-nov30-saved15-readonly-entry.mjs';

const folder=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const approval=JSON.parse(fs.readFileSync(path.join(folder,
 'ER1_NOV30_SAVED15_READONLY_A_CONTRACT.json'),'utf8'));
const source='1ec5c9755761306cd5e449a0c141e9f7b92f4908';
const request={schema:'ZGMINI_ER1_NOV30_SAVED15_READONLY_A_V1',
 operation:'inspect-saved15-private-er1',sourceSha:source,
 requestId:'pc-nov15-12345678-1234-4123-a456-123456789abc',
 chatId:'chat-12345678-1234-4123-a456-123456789abc',
 asOf:'2026-11-04'};
const event={action:'opened',issue:{
 title:'pc-er1-nov30-saved15-readonly',user:{login:'ansqhd5774-Choi'},
 labels:[{name:'pc-er1-approved'}],body:JSON.stringify(request)}};
const env={GITHUB_REPOSITORY:'ansqhd5774-Choi/zgmini-pc-control',
 GITHUB_ACTOR:'ansqhd5774-Choi',GITHUB_EVENT_NAME:'issues',
 GITHUB_EVENT_ACTION:'opened'};

test('read-only owner issue and asOf replay PIN',()=>{
 assert.equal(validateRequest(event,env).asOf,'2026-11-04');
 assert.throws(()=>validateRequest(event,{...env,GITHUB_ACTOR:'another'}),
  /NOV30_READONLY_ISSUE_STOP/);
 assert.throws(()=>validateRequest({...event,issue:{...event.issue,
  body:JSON.stringify({...request,asOf:'2026-11-05'})}},env),
  /NOV30_READONLY_REQUEST_STOP/);
});
test('manifest disallows GET, stored raw writes and D1 public publication',()=>{
 assert.equal(validateApproval(approval),true);
 for(const extra of [{maxProviderRequests:1},{allowPrivateDataWrites:true},
  {allowD1Writes:true},{allowCoreWrites:true},{sourceSha:'0'.repeat(40)}]){
  assert.throws(()=>validateApproval({...approval,...extra}),
   /NOV30_READONLY_APPROVAL_STOP/);
 }
});
test('retired frozen asOf entrypoint preserves its read-only source hash and approval',()=>{
 assert.equal(fs.existsSync(path.join(folder,'.github/workflows','pc-er1-nov30-saved15-readonly.yml')),false);
 const entry=fs.readFileSync(path.join(folder,'er1-nov30-saved15-readonly-entry.mjs'),'utf8');
 assert.equal(approval.sourceSha,source);
 assert.equal(approval.asOf,'2026-11-04');
 assert.equal(approval.sourceRepository,'ansqhd5774-Choi/zgmini');
 assert.equal(approval.maxProviderRequests,0);
 assert.equal(approval.allowPrivateDataWrites,false);
 assert.equal(approval.allowD1Writes,false);
 assert.equal(approval.allowCoreWrites,false);
 assert.equal(approval.allowSchedulerChanges,false);
 assert.ok(entry.includes(source));
 assert.ok(entry.includes(approval.sourceFileSha256));
 assert.ok(entry.includes(approval.dependentSourceSha256));
 assert.ok(!entry.includes('ONE_SHOT_STARTED'));
});

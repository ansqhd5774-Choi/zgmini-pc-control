import test from 'node:test';
import assert from 'node:assert/strict';
import {buildR47Report,createAndReadback} from '../task-cmd-b/report.mjs';
import {R47_B_ISSUE} from '../task-cmd-b/approval-intake.mjs';
const ID='01234567-89ab-4cde-8fab-0123456789ab';
function fixture(){
 const env={GITHUB_REPOSITORY:R47_B_ISSUE.repository,GITHUB_EVENT_NAME:'issues',
  GITHUB_EVENT_ACTION:'opened',GITHUB_ACTOR:R47_B_ISSUE.actor,
  GITHUB_RUN_ATTEMPT:'1',GITHUB_WORKFLOW:'ZGMINI Approved Runtime B Once',
  GITHUB_RUN_ID:'123456',GITHUB_SHA:'a'.repeat(40),
  R47_PIN_OUTCOME:'success',R47_CANDIDATE_OUTCOME:'success',
  R47_APPLY_OUTCOME:'success'};
 const request={schema:R47_B_ISSUE.requestSchema,operation:R47_B_ISSUE.operation,
  requestId:ID,chatId:'11234567-89ab-4cde-8fab-1123456789ab',
  controlRepository:R47_B_ISSUE.repository,
  approvalManifestPath:'approvals/task-cmd-b/w03.json',
  approvalManifestSha256:'b'.repeat(64)};
 const event={repository:{full_name:R47_B_ISSUE.repository,private:true},
  sender:{login:R47_B_ISSUE.actor},issue:{number:2001,
   title:R47_B_ISSUE.title,user:{login:R47_B_ISSUE.actor},
   labels:[{name:R47_B_ISSUE.label}],body:JSON.stringify(request)}};
 const local={status:'PASS',code:'TASK_CMD_B_ONEFILE_CAS_READBACK_VERIFIED',
  requestId:ID};
 return {event,env,local};
}
test('R47 success requires exact local receipt and all workflow steps',()=>{
 const x=fixture(),r=buildR47Report(x);
 assert.equal(r.status,'PASS');
 assert.equal(r.sourceEffectFiles,1);
 assert.equal(r.taskDefinitionChanges,0);
 assert.equal(r.approvalManifestSha256,'b'.repeat(64));
});
test('R47 cannot report PASS when checkout, pin or actual apply is missing',()=>{
 for(const field of ['R47_PIN_OUTCOME','R47_CANDIDATE_OUTCOME','R47_APPLY_OUTCOME']){
  const x=fixture();x.env[field]='skipped';
  const result=buildR47Report(x);
  assert.equal(result.status,'STATE_UNKNOWN');
  assert.equal(result.sourceEffectFiles,0);
 }
 const x=fixture();x.local.requestId='other';
 assert.equal(buildR47Report(x).status,'STATE_UNKNOWN');
});
test('R47 known prewrite STOP and spoofed actor remain distinct',()=>{
 const x=fixture();x.local={status:'STOP',
  code:'TASK_CMD_B_CANDIDATE_SHA_STOP',requestId:ID};
 assert.equal(buildR47Report(x).status,'STOP');
 const y=fixture();y.env.GITHUB_ACTOR='untrusted';
 assert.throws(()=>buildR47Report(y),{code:'TASK_CMD_B_REPORT_EVENT_STOP'});
});

test('R47 report-only recovery accepts existing identical bytes after rejected create',async()=>{
 const bytes=Buffer.from('R47_APPROVED_REPORT');
 const calls=[];
 const fakeApi=async(method,endpoint)=>{
  calls.push({method,endpoint});
  if(method==='PUT')throw Error('HTTP_422_EXISTS');
  return {encoding:'base64',content:bytes.toString('base64')};
 };
 await createAndReadback('results/r47-fixture.json',bytes,'fixture-token',fakeApi);
 assert.deepEqual(calls.map(x=>x.method),['PUT','GET']);
 assert.ok(calls[1].endpoint.endsWith('?ref=main'));
});
test('R47 report-only recovery refuses different existing bytes',async()=>{
 const bytes=Buffer.from('approved');
 const fakeApi=async(method)=>method==='PUT'?Promise.reject(Error('EXISTS')):
  {encoding:'base64',content:Buffer.from('mismatch').toString('base64')};
 await assert.rejects(createAndReadback('results/r47-fixture.txt',bytes,
  'fixture-token',fakeApi),{code:'TASK_CMD_B_REMOTE_READBACK_STOP'});
});

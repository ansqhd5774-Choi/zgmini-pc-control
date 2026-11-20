import test from 'node:test';import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {validateStalledClaim,retainRollbackClaim,validateConfirmedPostcheckFailure} from '../tools/controller-rollback-recovery.mjs';
const h=b=>createHash('sha256').update(b).digest('hex');
function fixture(){
 const requestId='pc-update-fixture';
 const claimBytes=Buffer.from(JSON.stringify({requestId,pid:123,nonce:'a'.repeat(36)}));
 const recordBytes=Buffer.from(JSON.stringify({schema:'ZGMINI_PC_ROLLBACK_RECONCILIATION_V1',requestId,
  status:'RECOVERY_REQUIRED',originalPhase:'SWITCHED',code:'ROLLBACK_SUPERVISOR_SOURCE_UNKNOWN',
  failureOperation:'restore',actualInstalledSha:null}));
 const backlogBytes=Buffer.from('{}');
 return {requestId,claimBytes,recordBytes,backlogBytes,ownerAlive:false,
  approval:{resumeClaim:{ownerSha256:h(claimBytes),recordSha256:h(recordBytes),backlogSha256:h(backlogBytes)}}};
}
test('separately pinned dead guard-stop claim may be preserved for a fresh verified continuation',()=>{
 assert.equal(validateStalledClaim(fixture()),true);
});
for(const [name,change] of Object.entries({
 live:f=>f.ownerAlive=true,unknown:f=>f.ownerAlive=null,otherRequest:f=>f.requestId='pc-other',
 changedOwner:f=>f.claimBytes=Buffer.from('{}'),changedRecord:f=>f.recordBytes=Buffer.from('{}'),
 changedBacklog:f=>f.backlogBytes=Buffer.from('{"changed":true}'),
 unsafePhase:f=>{const r=JSON.parse(f.recordBytes);r.code='WRITE_OUTCOME_UNKNOWN';f.recordBytes=Buffer.from(JSON.stringify(r));f.approval.resumeClaim.recordSha256=h(f.recordBytes);},
 }))test('stalled continuation refuses '+name,()=>{const f=fixture();change(f);assert.throws(()=>validateStalledClaim(f));});

test('successful archive final record releases reservation while uncertain and pre-archive writes retain it',()=>{
 const done={mutationStarted:true,status:'ROLLED_BACK',leaseArchived:true};
 assert.equal(retainRollbackClaim(done,true),false);
 assert.equal(retainRollbackClaim(done,false),true);
 assert.equal(retainRollbackClaim({...done,leaseArchived:false},true),true);
 assert.equal(retainRollbackClaim({...done,status:'RECOVERY_REQUIRED'},true),true);
});


function postcheckFixture(){
 const requestId='pc-update-8f413b02-4bb7-4d99-b71f-64d9c51a294a';
 const title='PC Update '+requestId+' postcheck';
 const source='8c4a63ee5f220976ec28f42a97bef899d29d4ec7';
 const manifest={postOperation:'core-status',
  postSourceBranch:'codex/w04-pit08-source-bundle-20261120',
  postSourceSha:source};
 const original={requestId,status:'RECOVERY_REQUIRED',
  firstFail:'POSTCHECK_PENDING',targetSha:'0f1effad0c58e8b7bd684aa638521180183ca902',
  postIssueNumber:2506};
 const approval={confirmedPostcheckFailure:{issueNumber:2506,
  runId:44753202464,jobId:136346085508,runnerName:'zgmini-pc-02'}};
 const issue={number:2506,title,created_at:'2026-11-20T14:24:43Z',
  user:{login:'ansqhd5774-Choi'},labels:[{name:'pc-job'}],
  body:JSON.stringify({schema:'ZGMINI_PC_JOB_V1',
   requestId:requestId+'-postcheck',operation:'core-status',
   sourceRepository:'ansqhd5774-Choi/zgmini',
   sourceBranch:manifest.postSourceBranch,sourceSha:source})};
 const run={id:44753202464,event:'issues',status:'completed',
  conclusion:'failure',display_title:title,created_at:'2026-11-20T14:24:47Z'};
 const job={id:136346085508,run_id:44753202464,
  status:'completed',conclusion:'failure',runner_name:'zgmini-pc-02',
  name:'approved-pc-job',steps:[{name:'Execute fixed host allowlist entry',
   status:'completed',conclusion:'failure'}]};
 return {original,manifest,approval,issue,run,job};
}
test('independent rollback recognizes exact authenticated postcheck failed job',()=>{
 assert.equal(validateConfirmedPostcheckFailure(postcheckFixture()),true);
});
for(const [label,modify] of Object.entries({
 noApproval:f=>delete f.approval.confirmedPostcheckFailure,
 unknownApprovalKey:f=>{f.approval.confirmedPostcheckFailure.extra='unexpected';},
 wrongRequest:f=>{const body=JSON.parse(f.issue.body);body.requestId='other';f.issue.body=JSON.stringify(body);},
 wrongSource:f=>{const body=JSON.parse(f.issue.body);body.sourceSha='a'.repeat(40);f.issue.body=JSON.stringify(body);},
 otherIssue:f=>f.issue.number=2508,
 otherActor:f=>f.issue.user.login='github-actions[bot]',
 wrongTitle:f=>f.run.display_title='unrelated',
 wrongEvent:f=>f.run.event='workflow_dispatch',
 wrongTime:f=>f.run.created_at='2026-11-21T14:24:47Z',
 incompleteRun:f=>f.run.status='in_progress',
 successfulRun:f=>f.run.conclusion='success',
 wrongRunId:f=>f.job.run_id=44753202465,
 otherRunner:f=>f.job.runner_name='zgmini-pc-01',
 failedUploadOnly:f=>f.job.steps[0].conclusion='success',
 otherJob:f=>f.job.id=136346085509,
 unfinishedJob:f=>f.job.status='in_progress',
 phaseMismatch:f=>f.original.firstFail='SWITCHED',
 }))test('independent confirmed failure refuses '+label,()=>{
  const f=postcheckFixture();modify(f);
  assert.equal(validateConfirmedPostcheckFailure(f),false);
 });

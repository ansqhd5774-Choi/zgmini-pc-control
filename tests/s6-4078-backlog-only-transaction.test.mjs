import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {FIXED} from '../tools/s6-4078-backlog-only-plan.mjs';
import {executeApprovedS64078Replay as execute} from '../tools/s6-4078-backlog-only-transaction.mjs';

const hash=s=>createHash('sha256').update(s).digest('hex');
const originalBody=JSON.stringify({schema:'ZGMINI_PC_JOB_V1',
 requestId:FIXED.originalRequestId,chatId:'chat-usbreadthr2-resource-window-20261127',
 operation:'shared-resource-release-readonly',sourceRepository:'ansqhd5774-Choi/zgmini',
 sourceBranch:'main',sourceSha:'7579dea082d0f7a671113e52e39cefc9be8c9a87'});
const s6Body=JSON.stringify({schema:'ZGMINI_PC_MAINTENANCE_REQUEST_V1',
 requestId:FIXED.s6RequestId,chatId:'chat-zgmini-s6-b3-20261127',
 operation:'controller-s6-failover-once',controlRepository:'ansqhd5774-Choi/zgmini-pc-control',
 targetControllerSha:'3c7d4cfefacf072fd35cb19706b352c64c5e4fd2',
 approvalManifestSha256:'1fceeba061f7f8731811220b27cac245bd91d44e87d68935cd8475117f094141'});
function evidence(){
 const journal=JSON.stringify({schema:'ZGMINI_S6_ONCE_JOURNAL_V1',
  requestId:FIXED.s6RequestId,phase:'RECOVERY_REQUIRED',
  failedAt:'WATCHDOG_RELEASE_OUTCOME_UNVERIFIED',code:'S6_PORT_PROMOTION_UNVERIFIED'});
 const backlog=JSON.stringify({schema:'ZGMINI_PC_BACKLOG_V1',requestId:FIXED.s6RequestId,
  windows:[{pausedAt:'2026-11-26T19:12:00Z',resumedAt:'2026-11-26T19:16:00Z'}],replays:{}});
 return {
  s6Issue:{number:4069,state:'open',user:{login:'ansqhd5774-Choi'},body:s6Body},
  originalIssue:{number:4078,state:'open',user:{login:'ansqhd5774-Choi'},
   created_at:FIXED.originalCreatedAt,labels:[{name:'pc-job'}],body:originalBody},
  localReadback:{journalBefore:journal,journalAfter:journal,journalSha256:hash(journal),
   backlogBefore:backlog,backlogAfter:backlog,backlogSha256:hash(backlog)},
  githubReadback:{originalIssueNumber:4078,originalRequestId:FIXED.originalRequestId,
   searchComplete:true,pcJobRuns:[],resultPairs:[],replayIssues:[]},
  workflowState:'active',runtimeState:'HEALTHY',sixRunnersOnline:true,
  watchdogReady:true,protectedStateUnchanged:true,ownerAndLeaseCasVerified:true
 };
}
const approval=()=>({authorized:true,effect:'S6_4078_BACKLOG_ONLY_REPLAY',
 s6RequestId:FIXED.s6RequestId,originalIssueNumber:FIXED.originalIssue,
 originalRequestId:FIXED.originalRequestId,originalBodySha256:FIXED.originalBodySha256,
 independentWindowsOperator:true,originalClaimAndLeasePreserved:true,
 approvalSourceSha:'a'.repeat(40)});
function fixture(){
 const events=[];
 let n=0,marker;
 const ports={
  readEvidence:async()=>{events.push('read');return evidence();},
  verifyIndependentAuthority:async()=>{events.push('authority');return approval();},
  acquireExclusiveClaim:async()=>{events.push('claim');return {nonce:'12345678-1234-1234-1234-123456789abc'};},
  assertClaimOwned:async()=>{events.push('assert');},
  writePostingCas:async data=>{events.push('posting');marker=structuredClone(data.marker);
   assert.equal(marker.status,'POSTING');assert.equal(marker.publicReplay,true);
   assert.equal(marker.originalBodySha256,FIXED.originalBodySha256);
   assert.ok(Number.isFinite(Date.parse(marker.postingAt)));},
  postExactOriginal:async data=>{events.push('post');assert.equal(data.title,'pc-job');
   assert.deepEqual(data.labels,['pc-job']);assert.equal(data.body,originalBody);n++;return {number:8000};},
  readPostedIssue:async()=>{events.push('read-posted');return {number:8000,
   title:'pc-job',
   body:originalBody,state:'open',user:{login:'ansqhd5774-Choi',id:327938088},
   created_at:marker.postingAt,labels:[{name:'pc-job'}]};},
  writeDoneCas:async data=>{events.push('done');assert.equal(data.expectedStatus,'POSTING');
   assert.deepEqual(data.expectedMarker,marker);
   assert.deepEqual(data.doneMarker,{...marker,status:'DONE',replayIssueNumber:8000});},
  archiveClaim:async()=>{events.push('archive');}
 };
 return {events,ports,get posts(){return n;}};
}
test('approved exact operation records durable POSTING then one exact POST, but not PC success',async()=>{
 const f=fixture(),r=await execute(f.ports);
 assert.equal(r.status,'DISPATCH_RECORDED');
 assert.equal(r.replayIssueNumber,8000);assert.equal(r.operationalSuccess,false);
 assert.equal(f.posts,1);
 assert.deepEqual(f.events,['read','authority','claim','assert','read','authority','assert',
  'posting','assert','post','assert','read-posted','assert','done','archive']);
});
test('missing independent port refuses before a claim',async()=>{
 const f=fixture();delete f.ports.writePostingCas;
 const r=await execute(f.ports);assert.equal(r.code,'S6_4078_INDEPENDENT_PORT_UNAVAILABLE');
 assert.deepEqual(f.events,[]);
});
test('non-authorized approval refuses before acquiring a claim',async()=>{
 const f=fixture();f.ports.verifyIndependentAuthority=async()=>({...approval(),authorized:false});
 const r=await execute(f.ports);assert.equal(r.code,'S6_4078_APPROVED_EFFECT_UNVERIFIED');
 assert.equal(f.posts,0);assert.ok(!f.events.includes('claim'));
});
test('modified source approval refuses before acquiring a claim',async()=>{
 const f=fixture();f.ports.verifyIndependentAuthority=async()=>({...approval(),approvalSourceSha:'bad'});
 const r=await execute(f.ports);assert.equal(r.code,'S6_4078_APPROVED_EFFECT_UNVERIFIED');
 assert.equal(f.posts,0);
});
test('evidence incomplete refuses before acquiring a claim',async()=>{
 const f=fixture();f.ports.readEvidence=async()=>{const e=evidence();e.githubReadback.searchComplete=false;return e;};
 const r=await execute(f.ports);
 assert.equal(r.code,'BACKLOG_4078_GITHUB_READBACK_INCOMPLETE');assert.equal(f.posts,0);
});
test('readback changes after claim never writes POSTING or POST',async()=>{
 const f=fixture();let reads=0;
 f.ports.readEvidence=async()=>{const e=evidence();if(++reads===2)e.localReadback.backlogSha256='0'.repeat(64);return e;};
 const r=await execute(f.ports);assert.equal(r.status,'RECOVERY_REQUIRED');
 assert.equal(r.phase,'CLAIM_ACQUIRED');assert.equal(f.posts,0);
 assert.ok(!f.events.includes('posting'));
});
test('owner proof changes after claim never writes POSTING',async()=>{
 const f=fixture();let approvals=0;f.ports.verifyIndependentAuthority=async()=>{
  if(++approvals===2)return {...approval(),approvalSourceSha:'b'.repeat(40)};
  return approval();
 };
 const r=await execute(f.ports);assert.equal(r.status,'RECOVERY_REQUIRED');
 assert.equal(r.phase,'CLAIM_ACQUIRED');assert.equal(f.posts,0);
});
for(const [name,point,phase] of [
 ['claim not confirmed','acquireExclusiveClaim','CLAIM_ATTEMPT'],
 ['POSTING CAS outcome unknown','writePostingCas','POSTING_ATTEMPT'],
 ['GitHub POST outcome unknown','postExactOriginal','GITHUB_POST_ATTEMPT'],
 ['replay Issue GET outcome unknown','readPostedIssue','POSTED_ISSUE_READBACK_ATTEMPT'],
 ['DONE CAS outcome unknown','writeDoneCas','DONE_CAS_ATTEMPT'],
 ['claim archive outcome unknown','archiveClaim','DISPATCH_RECORDED']
]){
 test(name+' is never automatically retried',async()=>{
  const f=fixture();f.ports[point]=async()=>{f.events.push(point);throw Error('uncertain');};
  const r=await execute(f.ports);
  assert.equal(r.status,'RECOVERY_REQUIRED');assert.equal(r.phase,phase);
  assert.equal(r.operationalSuccess,false);
  assert.equal(f.events.filter(x=>x===point).length,1);
 });
}

test('replay Issue mismatch cannot commit DONE or archive claim',async()=>{
 const f=fixture();
 f.ports.readPostedIssue=async()=>({number:8000,title:'changed',
  body:originalBody,state:'open',user:{login:'ansqhd5774-Choi'},
  labels:[{name:'pc-job'}]});
 const r=await execute(f.ports);
 assert.equal(r.status,'RECOVERY_REQUIRED');
 assert.equal(r.phase,'POSTED_ISSUE_READBACK_ATTEMPT');
 assert.equal(f.posts,1);assert.ok(!f.events.includes('done'));
 assert.ok(!f.events.includes('archive'));
});
test('replay Issue body and author must match exact original',async()=>{
 for(const mutate of [
  issue=>{issue.body+=' ';},issue=>{issue.user.login='github-actions[bot]';},
  issue=>{issue.labels=[];},issue=>{issue.pull_request={url:'fake'};},
  issue=>{issue.user.id=1;},issue=>{delete issue.created_at;},
  issue=>{issue.created_at='2026-01-01T00:00:00Z';}
 ]){
  const f=fixture(),read=f.ports.readPostedIssue;
  f.ports.readPostedIssue=async(...args)=>{const issue=await read(...args);mutate(issue);return issue;};
  const r=await execute(f.ports);
  assert.equal(r.status,'RECOVERY_REQUIRED');
  assert.equal(r.phase,'POSTED_ISSUE_READBACK_ATTEMPT');
  assert.ok(!f.events.includes('done'));
 }
});

// Source-only: a replay issue cannot predate its original Issue number.
test('old issue number cannot be treated as a newly posted replay',async()=>{
 const f=fixture();f.ports.postExactOriginal=async()=>({number:4077});
 const r=await execute(f.ports);
 assert.equal(r.status,'RECOVERY_REQUIRED');
 assert.equal(r.phase,'GITHUB_POST_ATTEMPT');
 assert.ok(!f.events.includes('done'));
});

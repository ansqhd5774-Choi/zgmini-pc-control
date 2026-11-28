import test from 'node:test';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {inspectS64078BacklogOnly as inspect,inspectS64078PinnedReadback as pinned,FIXED} from '../tools/s6-4078-backlog-only-plan.mjs';
const issueBody=JSON.stringify({schema:'ZGMINI_PC_JOB_V1',
 requestId:FIXED.originalRequestId,chatId:'chat-usbreadthr2-resource-window-20261127',
 operation:'shared-resource-release-readonly',sourceRepository:'ansqhd5774-Choi/zgmini',
 sourceBranch:'main',sourceSha:'7579dea082d0f7a671113e52e39cefc9be8c9a87'});
const s6Body=JSON.stringify({schema:'ZGMINI_PC_MAINTENANCE_REQUEST_V1',
 requestId:FIXED.s6RequestId,chatId:'chat-zgmini-s6-b3-20261127',
 operation:'controller-s6-failover-once',controlRepository:'ansqhd5774-Choi/zgmini-pc-control',
 targetControllerSha:'3c7d4cfefacf072fd35cb19706b352c64c5e4fd2',
 approvalManifestSha256:'1fceeba061f7f8731811220b27cac245bd91d44e87d68935cd8475117f094141'});
function fixture(){return {
 originalIssue:{number:4078,state:'open',user:{login:'ansqhd5774-Choi'},
  created_at:FIXED.originalCreatedAt,labels:[{name:'pc-job'}],body:issueBody},
 s6Issue:{number:4069,state:'open',user:{login:'ansqhd5774-Choi'},body:s6Body},
 journal:{schema:'ZGMINI_S6_ONCE_JOURNAL_V1',requestId:FIXED.s6RequestId,phase:'RECOVERY_REQUIRED',
  failedAt:'WATCHDOG_RELEASE_OUTCOME_UNVERIFIED',code:'S6_PORT_PROMOTION_UNVERIFIED'},
 backlog:{schema:'ZGMINI_PC_BACKLOG_V1',requestId:FIXED.s6RequestId,
  windows:[{pausedAt:'2026-11-26T19:12:00Z',resumedAt:'2026-11-26T19:16:00Z'}],replays:{}},
 workflowState:'active',runtimeState:'HEALTHY',sixRunnersOnline:true,watchdogReady:true,
 protectedStateUnchanged:true,existingPcJobRuns:0,existingResultPairs:0,
 existingReplayIssues:0,resultSearchComplete:true,ownerAndLeaseCasVerified:true,
 backlogBytesCasVerified:true,s6JournalBytesCasVerified:true
};}
test('exact preflight is non-executable',()=>{
 const r=inspect(fixture());assert.equal(r.status,'SOURCE_PREFLIGHT_ELIGIBLE');
 assert.equal(r.mutationAuthorized,false);assert.equal(r.operationalWrites,0);
});
for(const [name,edit,code] of [
 ['original body changed',e=>e.originalIssue.body+=' ','BACKLOG_4078_ORIGINAL_CAS_FAILED'],
 ['original request changed',e=>e.originalIssue.number=4079,'BACKLOG_4078_ORIGINAL_CAS_FAILED'],
 ['S6 request changed',e=>e.s6Issue.body='{}','S6_ORIGINAL_BODY_CAS_FAILED'],
 ['S6 approval bytes changed',e=>e.s6Issue.body=e.s6Issue.body.replace('1fceeba0','0fceeba0'),'S6_ORIGINAL_BODY_CAS_FAILED'],
 ['journal changed',e=>e.journal.phase='PASS','S6_JOURNAL_PHASE_DRIFT'],
 ['legacy journal field rejected',e=>{e.journal.failedCode=e.journal.code;delete e.journal.code;},'S6_JOURNAL_PHASE_DRIFT'],
 ['wrong journal schema',e=>e.journal.schema='INVALID','S6_JOURNAL_PHASE_DRIFT'],
 ['replay already present',e=>e.backlog.replays['4078']={status:'POSTING'},'S6_BACKLOG_OR_REPLAY_DRIFT'],
 ['pause window excludes issue',e=>e.backlog.windows[0].pausedAt='2026-11-26T19:15:00Z','BACKLOG_4078_PAUSE_WINDOW_UNVERIFIED'],
 ['runtime degraded',e=>e.runtimeState='STATE_UNKNOWN','S6_CURRENT_PROTECTION_UNVERIFIED'],
 ['prior run exists',e=>e.existingPcJobRuns=1,'BACKLOG_4078_DUPLICATE_OR_SEARCH_UNKNOWN'],
 ['result search truncated',e=>e.resultSearchComplete=false,'BACKLOG_4078_DUPLICATE_OR_SEARCH_UNKNOWN'],
 ['original CAS unknown',e=>e.backlogBytesCasVerified=false,'S6_ORIGINAL_LOCAL_CAS_UNVERIFIED']
]){
 test('reject '+name,()=>{const e=fixture();edit(e);const r=inspect(e);
  assert.equal(r.status,'BLOCKED');assert.equal(r.code,code);
  assert.equal(r.mutationAuthorized,false);assert.equal(r.operationalWrites,0);
 });
}

const hash=x=>createHash('sha256').update(x).digest('hex');
function pinnedFixture(){
 const e=fixture(),journal=JSON.stringify(e.journal),backlog=JSON.stringify(e.backlog);
 e.localReadback={
  journalBefore:journal,journalAfter:journal,journalSha256:hash(journal),
  backlogBefore:backlog,backlogAfter:backlog,backlogSha256:hash(backlog)
 };
 e.githubReadback={originalIssueNumber:4078,originalRequestId:FIXED.originalRequestId,
  searchComplete:true,pcJobRuns:[],resultPairs:[],replayIssues:[]};
 return e;
}
test('exact double-read CAS remains source-only and does not create a replay',()=>{
 const r=pinned(pinnedFixture());
 assert.equal(r.status,'SOURCE_PREFLIGHT_ELIGIBLE');
 assert.equal(r.code,'S6_4078_PINNED_READBACK_SOURCE_ONLY');
 assert.equal(r.mutationAuthorized,false);assert.equal(r.operationalWrites,0);
});
for(const [name,edit,code] of [
 ['backlog changes between reads',e=>e.localReadback.backlogAfter+=' ',
  'S6_LOCAL_READBACK_CAS_DRIFT'],
 ['journal changes between reads',e=>e.localReadback.journalAfter+=' ',
  'S6_LOCAL_READBACK_CAS_DRIFT'],
 ['backlog hash incorrect',e=>e.localReadback.backlogSha256='0'.repeat(64),
  'S6_LOCAL_READBACK_CAS_DRIFT'],
 ['journal bytes malformed',e=>{e.localReadback.journalBefore='{';
  e.localReadback.journalAfter='{';e.localReadback.journalSha256=hash('{');},
  'S6_LOCAL_READBACK_JSON_INVALID'],
 ['backlog read absent',e=>delete e.localReadback.backlogBefore,
  'S6_LOCAL_READBACK_INCOMPLETE'],
 ['github query incomplete',e=>e.githubReadback.searchComplete=false,
  'BACKLOG_4078_GITHUB_READBACK_INCOMPLETE'],
 ['wrong original request readback',e=>e.githubReadback.originalRequestId='pc-other',
  'BACKLOG_4078_GITHUB_READBACK_INCOMPLETE'],
 ['prior execution exists',e=>e.githubReadback.pcJobRuns.push({id:123}),
  'BACKLOG_4078_PRIOR_EFFECT_PRESENT'],
 ['prior replay issue exists',e=>e.githubReadback.replayIssues.push({number:4081}),
  'BACKLOG_4078_PRIOR_EFFECT_PRESENT'],
 ['owner CAS not attested',e=>e.ownerAndLeaseCasVerified=false,
  'S6_ORIGINAL_LOCAL_CAS_UNVERIFIED']
]){
 test('double-read gate rejects '+name,()=>{
  const e=pinnedFixture();edit(e);
  const r=pinned(e);
  assert.equal(r.status,'BLOCKED');assert.equal(r.code,code);
  assert.equal(r.mutationAuthorized,false);assert.equal(r.operationalWrites,0);
 });
}

test('malformed issue labels fail closed without an exception',()=>{
 for(const labels of [{name:'pc-job'},'pc-job',42,[null],[{}]]){
  const e=fixture();e.originalIssue.labels=labels;
  const result=inspect(e);
  assert.equal(result.status,'BLOCKED');
  assert.equal(result.code,'BACKLOG_4078_ORIGINAL_CAS_FAILED');
  assert.equal(result.mutationAuthorized,false);
  assert.equal(result.operationalWrites,0);
 }
});

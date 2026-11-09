import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validBacklogOriginalPcJob, verifiedClosedBacklogWindows,
  originalIssueInPause, originalHasResult, exactReplayCandidates,
  planPostSwitchBacklogItem,
} from '../tools/controller-postswitch-backlog.mjs';

const requestId='pc-update-877e10c8-8580-4095-a675-bef9ec032193';
const actor='ansqhd5774-Choi';
const base={schema:'ZGMINI_PC_JOB_V1',
  requestId:'pc-290d6501-ab68-4fda-b4c4-473b582fb2f1',
  chatId:'chat-0f48a9ef-a950-4491-bfa0-15fdfd349943',
  operation:'core-status',sourceRepository:'ansqhd5774-Choi/zgmini',
  sourceBranch:'main',sourceSha:'a'.repeat(40)};
const scoped={...base,operation:'writer-install-preimage-readonly',
  preimageManifestPath:'approvals/writer-preimage/market-calendar-er1-import-deps6-readonly-20261108.json',
  preimageManifestSha256:'b'.repeat(64)};
const backlog=()=>({schema:'ZGMINI_PC_BACKLOG_V1',requestId,
  pausedAt:'2026-11-08T12:28:00.000Z',resumedAt:'2026-11-08T12:30:00.000Z',
  windows:[{pausedAt:'2026-11-08T12:28:00.000Z',
    resumedAt:'2026-11-08T12:30:00.000Z'}],replays:{}});
const original=(body=scoped)=>({number:919,title:'pc-job',body:JSON.stringify(body),
  created_at:'2026-11-08T12:28:34.000Z',user:{login:actor},
  labels:[{name:'pc-job'}]});
const clone=origin=>({number:1234,title:`Maintenance replay ${requestId} original #919`,
  body:origin.body,user:{login:actor},labels:[{name:'pc-job'}]});
const bot=[{user:{login:'github-actions[bot]'},body:'zgmini-pc-result: pc-290d6501'}];
const plan=(patch={})=>{const originalItem=original();return planPostSwitchBacklogItem({
  maintenanceRequestId:requestId,original:originalItem,backlog:backlog(),
  cloneIssues:[],originalComments:[],cloneSearchComplete:true,
  resultReadComplete:true,...patch});};

test('approved seven- and nine-field pc-job bodies preserve exact scope',()=>{
  assert.equal(validBacklogOriginalPcJob(base),true);
  assert.equal(validBacklogOriginalPcJob(scoped),true);
  assert.equal(validBacklogOriginalPcJob({...base,operation:'writer-install-preimage-readonly'}),true);
});

test('unexpected fields and partial optional scope are never replayable',()=>{
  for(const body of [{...base,extra:true},
    {...scoped,other:true},
    (({preimageManifestSha256,...x})=>x)(scoped),
    {...scoped,operation:'core-status'}]){
    assert.equal(validBacklogOriginalPcJob(body),false);
  }
});

test('preimage path traversal and invalid digests are denied',()=>{
  for(const candidate of ['approvals/writer-preimage/../escape.json',
    'approvals/writer-preimage/Xy.json',
    '/approvals/writer-preimage/valid-name.json',
    'approvals/writer-preimage/valid-name.txt',null]){
    assert.equal(validBacklogOriginalPcJob({...scoped,preimageManifestPath:candidate}),false);
  }
  for(const sha of ['A'.repeat(64),'b'.repeat(63),37])
    assert.equal(validBacklogOriginalPcJob({...scoped,preimageManifestSha256:sha}),false);
});

test('malformed, extra, missing or wrong-schema requests fail closed',()=>{
  for(const item of [null,undefined,[],false,'{}',
    {...base,schema:'OTHER'},
    {...base,requestId:'bad'},
    {...base,sourceSha:undefined,other:true}]){
    assert.equal(validBacklogOriginalPcJob(item),false);
  }
});

test('closed backlog ranges are validated without rewriting original state',()=>{
  const b=backlog();const before=JSON.stringify(b);
  assert.deepEqual(verifiedClosedBacklogWindows(b,requestId),b.windows);
  assert.equal(JSON.stringify(b),before);
  assert.throws(()=>verifiedClosedBacklogWindows({...b,requestId:'different'},requestId),
    /POSTSWITCH_BACKLOG_IDENTITY_DRIFT/);
  assert.throws(()=>verifiedClosedBacklogWindows({...b,windows:[{pausedAt:b.pausedAt,resumedAt:null}]},requestId),
    /POSTSWITCH_BACKLOG_WINDOW_NOT_CLOSED/);
});

test('unknown replay status cannot be treated as a fresh issue',()=>{
  const b=backlog();b.replays['919']={status:'UNKNOWN'};
  assert.throws(()=>verifiedClosedBacklogWindows(b,requestId),/POSTSWITCH_BACKLOG_REPLAYS_INVALID/);
});

test('pause-window candidate uses original actor, pc-job label and excludes replay clones',()=>{
  const windows=verifiedClosedBacklogWindows(backlog(),requestId);
  assert.equal(originalIssueInPause(original(),windows),true);
  assert.equal(originalIssueInPause({...original(),created_at:'2026-11-08T12:31:00Z'},windows),false);
  assert.equal(originalIssueInPause({...original(),user:{login:'outsider'}},windows),false);
  assert.equal(originalIssueInPause({...original(),labels:{name:'pc-job'}},windows),false);
  assert.equal(originalIssueInPause({...original(),labels:[null]},windows),false);
  assert.equal(originalIssueInPause({...original(),pull_request:{}},windows),false);
  assert.equal(originalIssueInPause(clone(original()),windows),false);
});

test('trusted result evidence only comes from GitHub Actions bot marker',()=>{
  assert.equal(originalHasResult(bot),true);
  assert.equal(originalHasResult([{user:{login:'attacker'},body:'zgmini-pc-result: forged'}]),false);
  assert.throws(()=>originalHasResult(null),/POSTSWITCH_BACKLOG_RESULT_READBACK_UNAVAILABLE/);
});

test('unique exact clone requires title, original body, actor and label',()=>{
  const source=original(),good=clone(source);
  const spoof=[{...good,number:2345,user:{login:'outsider'}},
    {...good,number:3456,body:'{}'},
    {...good,number:4567,labels:[]},
    {...good,number:5678,labels:{name:'pc-job'}},
    {...good,number:6789,labels:[null]}];
  assert.deepEqual(exactReplayCandidates(requestId,source,[...spoof,good]),[1234]);
  assert.deepEqual(exactReplayCandidates(requestId,source,[good,good]),[1234]);
});

test('first proven unhandled request requires a durable POSTING before ONE POST',()=>{
  const b=backlog(),source=original(),before=JSON.stringify(b);
  const result=plan({backlog:b,original:source});
  assert.equal(result.action,'RECORD_POSTING_THEN_POST_ONCE');
  assert.equal(result.replayIssueNumber,null);
  assert.equal(JSON.stringify(b),before);
  assert.equal(result.originalIssueNumber,919);
});

test('verified bot result is recorded as a skip with zero reposts',()=>{
  assert.equal(plan({originalComments:bot}).action,'RECORD_RESULT_SKIP');
  const b=backlog();b.replays['919']={status:'SKIPPED_RESULT_PRESENT'};
  assert.equal(plan({backlog:b,originalComments:bot}).action,'RESULT_PRESENT');
  assert.throws(()=>plan({backlog:b}),/POSTSWITCH_BACKLOG_RESULT_SKIP_NOT_VERIFIED/);
});

test('DONE replays only pass if exact recorded issue is uniquely verified',()=>{
  const source=original(),b=backlog(),repost=clone(source);
  b.replays['919']={status:'DONE',originalRequestId:scoped.requestId,replayIssueNumber:1234};
  const x=plan({backlog:b,original:source,cloneIssues:[repost]});
  assert.equal(x.action,'ALREADY_DONE');
  assert.equal(x.replayIssueNumber,1234);
  assert.throws(()=>plan({backlog:b,original:source,cloneIssues:[]}),
    /POSTSWITCH_BACKLOG_DONE_NOT_VERIFIED/);
  assert.throws(()=>plan({backlog:b,original:source,cloneIssues:[{...repost,number:2222}]}),
    /POSTSWITCH_BACKLOG_DONE_NOT_VERIFIED/);
});

test('POSTING with one exact replay is reconciled without another POST',()=>{
  const source=original(),b=backlog();
  b.replays['919']={status:'POSTING',originalRequestId:scoped.requestId};
  const x=plan({backlog:b,original:source,cloneIssues:[clone(source)]});
  assert.equal(x.action,'LINK_LOST_ACK');
  assert.equal(x.replayIssueNumber,1234);
});

test('POSTING with zero or multiple clones remains outcome unknown',()=>{
  const source=original(),b=backlog();
  b.replays['919']={status:'POSTING',originalRequestId:scoped.requestId};
  assert.throws(()=>plan({backlog:b,cloneIssues:[]}),
    /POSTSWITCH_BACKLOG_REPLAY_OUTCOME_UNKNOWN/);
  assert.throws(()=>plan({backlog:b,cloneIssues:[clone(source),{...clone(source),number:5678}]}),
    /POSTSWITCH_BACKLOG_REPLAY_OUTCOME_UNKNOWN/);
});

test('untracked exact clone is never mistaken for a fresh unposted request',()=>{
  const source=original();
  assert.throws(()=>plan({cloneIssues:[clone(source)]}),/POSTSWITCH_BACKLOG_UNTRACKED_CLONE/);
});

test('an incomplete GitHub clone or result readback is a hard stop',()=>{
  assert.throws(()=>plan({cloneSearchComplete:false}),/POSTSWITCH_BACKLOG_READBACK_INCOMPLETE/);
  assert.throws(()=>plan({resultReadComplete:false}),/POSTSWITCH_BACKLOG_READBACK_INCOMPLETE/);
});

test('invalid nine-field request cannot become a replay',()=>{
  assert.throws(()=>plan({original:original({...scoped,preimageManifestPath:'../escape.json'})}),
    /POSTSWITCH_BACKLOG_ORIGINAL_REQUEST_INVALID/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readAllPages,prepareBacklogReadOnly} from '../tools/controller-postswitch-preflight.mjs';

const id='pc-update-877e10c8-8580-4095-a675-bef9ec032193';
const pause='2026-11-08T12:28:00Z',resume='2026-11-08T12:29:00Z';
// The actual 2026-11-08 #919 GitHub Issue's nine-field payload, with no key/token.
const req={schema:'ZGMINI_PC_JOB_V1',
  sourceRepository:'ansqhd5774-Choi/zgmini',sourceBranch:'main',
  sourceSha:'7703964728cd8c2431ce1d0192ede1854481c1bd',
  requestId:'pc-290d6501-ab68-4fda-b4c4-473b582fb2f1',
  chatId:'chat-0f48a9ef-a950-4491-bfa0-15fdfd349943',
  operation:'writer-install-preimage-readonly',
  preimageManifestPath:'approvals/writer-preimage/market-calendar-er1-import-deps6-readonly-20261108.json',
  preimageManifestSha256:'385c758d6ab8f4e183699b3b98739350381d873496dc5d59c4e58cf4ceaf0f16'};
const original={number:919,title:'pc-job',body:JSON.stringify(req),
  user:{login:'ansqhd5774-Choi'},labels:[{name:'pc-job'}],
  created_at:'2026-11-08T12:28:34Z'};
const backlog=()=>({schema:'ZGMINI_PC_BACKLOG_V1',requestId:id,
  pausedAt:pause,resumedAt:resume,replays:{}});
function ports(options={}){
  return {requestId:id,backlog:options.backlog??backlog(),
    fetchIssues:()=>options.issueRows??[original],
    fetchOriginal:()=>options.original??original,
    fetchComments:()=>options.comments??[],
    fetchAllIssues:()=>options.cloneRows??[]};
}

test('one nine-field original is planned with no writes',()=>{
  const result=prepareBacklogReadOnly(ports());
  assert.equal(result.writes,0);
  assert.equal(result.candidateCount,1);
  assert.equal(result.actions[0].action,'RECORD_POSTING_THEN_POST_ONCE');
});
test('bot result skips a replay before any POST',()=>{
  const result=prepareBacklogReadOnly(ports({comments:[{user:{login:'github-actions[bot]'},
    body:'zgmini-pc-result: PASS'}]}));
  assert.equal(result.actions[0].action,'RECORD_RESULT_SKIP');
});
test('already-replayed original is resolved by exact clone',()=>{
  const b=backlog();b.replays['919']={status:'POSTING',originalRequestId:req.requestId};
  const copy={...original,number:1230,title:`Maintenance replay ${id} original #919`};
  const result=prepareBacklogReadOnly(ports({backlog:b,cloneRows:[copy]}));
  assert.equal(result.actions[0].action,'LINK_LOST_ACK');
  assert.equal(result.actions[0].replayIssueNumber,1230);
});
test('unresolved POSTING is a hard stop, never another POST',()=>{
  const b=backlog();b.replays['919']={status:'POSTING',originalRequestId:req.requestId};
  assert.throws(()=>prepareBacklogReadOnly(ports({backlog:b})),
    /POSTSWITCH_BACKLOG_REPLAY_OUTCOME_UNKNOWN/);
});
test('remote 100-row page without a complete final page is fail-closed',()=>{
  assert.throws(()=>readAllPages(()=>Array.from({length:100},()=>({})),2),
    /POSTSWITCH_REMOTE_READBACK_TRUNCATED/);
});
test('unexpected stored replay without remote original fails',()=>{
  const b=backlog();b.replays['1147']={status:'POSTING',originalRequestId:'request-1147'};
  assert.throws(()=>prepareBacklogReadOnly(ports({backlog:b})),
    /POSTSWITCH_BACKLOG_ORPHANED_REPLAY/);
});
test('new candidate issue identity drift blocks planning',()=>{
  assert.throws(()=>prepareBacklogReadOnly(ports({original:{...original,number:920}})),
    /POSTSWITCH_ORIGINAL_ISSUE_DRIFT/);
});

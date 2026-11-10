import test from 'node:test';
import assert from 'node:assert/strict';
import {plan996BacklogWithoutReplay} from '../tools/controller-996-backlog-plan.mjs';

const REQUEST='pc-update-0010b2cf-9bca-40cf-89c5-b750fa42b404';
const pausedAt='2026-11-10T01:35:00.000Z';
const cutoffAt='2026-11-10T01:36:00.000Z';
const issue=(number,id='pc-cf5cd368-7410-4de6-9b2b-9524cd10a5a8')=>({
  number,repository:'ansqhd5774-Choi/zgmini-pc-control',title:'pc-job',
  user:{login:'ansqhd5774-Choi'},labels:[{name:'pc-job'}],
  created_at:'2026-11-10T01:35:10.000Z',
  body:JSON.stringify({schema:'ZGMINI_PC_JOB_V1',requestId:id,
    chatId:'ab6520e6-c66b-4d98-890a-fca5b0fc1a3b',operation:'core-status',
    sourceRepository:'ansqhd5774-Choi/zgmini',sourceBranch:'main',
    sourceSha:'a'.repeat(40)}),
});
function fixture(){return {requestId:REQUEST,pause:{pausedAt,resumedAt:null},
  cutoffAt,listing:{complete:true,issues:[issue(1250)]},
  commentsByIssue:{1250:{complete:true,comments:[]}},replays:{}};}

test('an unexecuted original is for owner replan only; no Issue replay is allowed',()=>{
  const p=plan996BacklogWithoutReplay(fixture());
  assert.equal(p.status,'READONLY_DISPOSITIONS_ONLY');
  assert.equal(p.entries.length,1);
  assert.equal(p.entries[0].disposition,'OWNER_REPLAN_REVIEW_REQUIRED');
  assert.equal(p.issuePostsAuthorized,0);
  assert.equal(p.automaticPcRetries,0);
  assert.equal(p.executionAuthorized,false);
});

test('a bot result comment alone is never accepted as verified PC execution',()=>{
  const a=fixture();a.commentsByIssue[1250].comments=[{
    user:{login:'github-actions[bot]'},body:'<!-- zgmini-pc-result:12345:1:2 -->\nPASS',
  }];
  assert.equal(plan996BacklogWithoutReplay(a).entries[0].disposition,
    'RESULT_PAIR_READBACK_REQUIRED');
});

test('already posted replay is never reposted; must independently reconcile',()=>{
  const a=fixture();a.replays['1250']={status:'DONE',replayIssueNumber:1251};
  assert.equal(plan996BacklogWithoutReplay(a).entries[0].disposition,
    'PRIOR_REPLAY_READBACK_REQUIRED');
  assert.equal(plan996BacklogWithoutReplay(a).issuePostsAuthorized,0);
});

test('unknown POSTING outcome fails closed without generating any new Issue',()=>{
  const a=fixture();a.replays['1250']={status:'POSTING'};
  assert.equal(plan996BacklogWithoutReplay(a).code,'BACKLOG_REPLAY_OUTCOME_UNKNOWN');
});

test('a replay journal key without a verified pause-window original fails closed',()=>{
  const a=fixture();a.replays['1259']={status:'DONE',replayIssueNumber:1260};
  assert.equal(plan996BacklogWithoutReplay(a).code,'BACKLOG_REPLAY_ORIGIN_UNVERIFIED');
});

test('missing complete history and ambiguous receipts cannot authorize review',()=>{
  const a=fixture();a.listing.complete=false;
  assert.equal(plan996BacklogWithoutReplay(a).code,'ISSUE_LIST_INCOMPLETE');
  const b=fixture();b.commentsByIssue[1250].complete=false;
  assert.equal(plan996BacklogWithoutReplay(b).code,'ORIGINAL_COMMENTS_INCOMPLETE');
  const c=fixture();c.commentsByIssue[1250].comments=[1,2].map(()=>({
    user:{login:'github-actions[bot]'},body:'<!-- zgmini-pc-result:12345:1:2 -->',
  }));
  assert.equal(plan996BacklogWithoutReplay(c).code,'ORIGINAL_RESULT_RECEIPT_AMBIGUOUS');
});

test('duplicate requests, tampered admission, and alternate pause are rejected',()=>{
  const a=fixture();a.listing.issues.push(issue(1251));a.commentsByIssue[1251]={complete:true,comments:[]};
  assert.equal(plan996BacklogWithoutReplay(a).code,'ORIGINAL_REQUEST_ID_DUPLICATE');
  const b=fixture();b.listing.issues[0].user.login='other';
  assert.equal(plan996BacklogWithoutReplay(b).code,'ORIGINAL_ADMISSION_UNVERIFIED');
  const c=fixture();c.pause.resumedAt=cutoffAt;
  assert.equal(plan996BacklogWithoutReplay(c).code,'PAUSE_WINDOW_UNVERIFIED');
  const d=fixture();d.requestId='other';
  assert.equal(plan996BacklogWithoutReplay(d).code,'REQUEST_ID_MISMATCH');
});

test('unrelated records are ignored while original dispositions stay deterministic',()=>{
  const a=fixture();a.listing.issues.unshift({...issue(1249),
    created_at:'2026-11-10T01:34:00.000Z'});
  assert.equal(plan996BacklogWithoutReplay(a).originalIssueCount,1);
  const b=fixture();b.listing.issues.push({...issue(1251),labels:[{name:'bug'}]});
  assert.equal(plan996BacklogWithoutReplay(b).originalIssueCount,1);
  const c=fixture();c.listing.issues.push({...issue(1252),pull_request:{url:'https://api.github.com/pulls/1252'}});
  assert.equal(plan996BacklogWithoutReplay(c).originalIssueCount,1);
});

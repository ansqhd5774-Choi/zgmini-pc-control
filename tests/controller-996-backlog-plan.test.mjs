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
    chatId:'chat-ab6520e6-c66b-4d98-890a-fca5b0fc1a3b',operation:'core-status',
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

test('real #1226/#1227 request shapes with chat-prefixed IDs and descriptive titles are admitted',()=>{
  const a=fixture();
  a.listing.issues=[issue(1227,'pc-6f7a24d4-823d-4648-b2c3-a645a352bef7'),
    {...issue(1226,'pc-60ed9565-9b87-4099-a4d2-db9235a3cfd4'),title:'core-status'}];
  a.commentsByIssue={1226:{complete:true,comments:[]},1227:{complete:true,comments:[]}};
  const p=plan996BacklogWithoutReplay(a);
  assert.equal(p.status,'READONLY_DISPOSITIONS_ONLY');
  assert.deepEqual(p.entries.map(x=>x.originIssue),[1226,1227]);
  assert.deepEqual(p.entries.map(x=>x.disposition),
    ['OWNER_REPLAN_REVIEW_REQUIRED','OWNER_REPLAN_REVIEW_REQUIRED']);
  assert.equal(p.issuePostsAuthorized,0);
  assert.equal(p.automaticPcRetries,0);
});

test('actual four pause-window Issue shapes remain review-only after interrupted C readback',()=>{
  // Two stable authenticated GitHub scans found these four original Issues
  // between the original PC's observed pausedAt and resumedAt. An empty
  // replay map is a TEST ASSUMPTION, not proof of the physical backlog map.
  const a=fixture();
  a.pause.pausedAt='2026-11-10T01:06:53.751Z';
  a.cutoffAt='2026-11-10T13:21:26.727Z';
  const originals=[
    [1217,'2026-11-10T01:13:35Z','pc-job','core-runtime-source-readonly',
      'pc-8da91b23-f5d6-4a94-bcd5-13b0dfcdee61'],
    [1219,'2026-11-10T01:16:07Z',
      '[테마 T1] R181 실행 Core source SHA 단회 읽기 전용',
      'core-runtime-source-readonly',
      'pc-e2710720-1a35-4a75-ab37-4940ecd33edd'],
    [1226,'2026-11-10T12:57:33Z','core-status','core-status',
      'pc-60ed9565-9b87-4099-a4d2-db9235a3cfd4'],
    [1227,'2026-11-10T12:58:56Z','pc-job','core-runtime-source-readonly',
      'pc-6f7a24d4-823d-4648-b2c3-a645a352bef7'],
  ];
  a.listing.issues=originals.map(([n,created,title,op,id])=>{
    const entry=issue(n,id),body=JSON.parse(entry.body);
    return {...entry,title,created_at:created,body:JSON.stringify({...body,
      operation:op,sourceSha:'643b7c7c4372ffad552443fc312c6cb1b944e2fc'})};
  });
  a.commentsByIssue=Object.fromEntries(originals.map(([n])=>[
    n,{complete:true,comments:n===1227?[{
      id:6781491296,user:{login:'ansqhd5774-Choi'},
      body:'D05 diagnostic: AUTOMATION_BLOCKED / PC_JOB_INTAKE_NOT_OBSERVED; no bot receipt'
    }]:[]}]));
  const p=plan996BacklogWithoutReplay(a);
  assert.equal(p.status,'READONLY_DISPOSITIONS_ONLY');
  assert.equal(p.originalIssueCount,4);
  assert.deepEqual(p.entries.map(e=>e.originIssue),[1217,1219,1226,1227]);
  assert.ok(p.entries.every(e=>e.disposition==='OWNER_REPLAN_REVIEW_REQUIRED'));
  assert.equal(a.commentsByIssue[1227].comments.length,1);
  assert.equal(p.entries.find(e=>e.originIssue===1227).disposition,'OWNER_REPLAN_REVIEW_REQUIRED');
  assert.equal(p.executionAuthorized,false);
  assert.equal(p.issuePostsAuthorized,0);
  assert.equal(p.automaticPcRetries,0);
});

test('canonical nine-field writer preimage request is valid without permitting arbitrary extras',()=>{
  const a=fixture();
  const valid={...JSON.parse(a.listing.issues[0].body),
    operation:'writer-install-preimage-readonly',
    preimageManifestPath:'approvals/writer-preimage/market-calendar-er1-import-deps6-readonly-20261108.json',
    preimageManifestSha256:'a'.repeat(64)};
  a.listing.issues[0].body=JSON.stringify(valid);
  assert.equal(plan996BacklogWithoutReplay(a).status,'READONLY_DISPOSITIONS_ONLY');
  a.listing.issues[0].body=JSON.stringify({...valid,preimageManifestSha256:'bad'});
  assert.equal(plan996BacklogWithoutReplay(a).code,'ORIGINAL_BODY_INVALID');
  a.listing.issues[0].body=JSON.stringify({...valid,preimageManifestPath:'../other.json'});
  assert.equal(plan996BacklogWithoutReplay(a).code,'ORIGINAL_BODY_INVALID');
  a.listing.issues[0].body=JSON.stringify({...valid,unapprovedKey:true});
  assert.equal(plan996BacklogWithoutReplay(a).code,'ORIGINAL_BODY_INVALID');
  a.listing.issues[0].body=JSON.stringify({...valid,operation:'core-status'});
  assert.equal(plan996BacklogWithoutReplay(a).code,'ORIGINAL_BODY_INVALID');
});

test('invalid chat ID or source identity stays blocked',()=>{
  const a=fixture();
  const valid=JSON.parse(a.listing.issues[0].body);
  for(const patch of [{chatId:'bad value'},{chatId:'x'.repeat(65)},
    {sourceRepository:'other/repository'},{sourceBranch:'../../other'},
    {sourceSha:'invalid'}]){
    a.listing.issues[0].body=JSON.stringify({...valid,...patch});
    assert.equal(plan996BacklogWithoutReplay(a).code,'ORIGINAL_BODY_INVALID');
  }
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

test('an Owner diagnostic comment never becomes bot receipt or replay consent',()=>{
  const a=fixture();
  a.commentsByIssue[1250].comments=[{
    id:6781491296,user:{login:'ansqhd5774-Choi'},
    body:'D05 AUTOMATION_BLOCKED / PC_JOB_INTAKE_NOT_OBSERVED; no verified pc-job receipt'
  }];
  const p=plan996BacklogWithoutReplay(a);
  assert.equal(p.status,'READONLY_DISPOSITIONS_ONLY');
  assert.equal(p.entries[0].disposition,'OWNER_REPLAN_REVIEW_REQUIRED');
  assert.equal(p.issuePostsAuthorized,0);
  assert.equal(p.executionAuthorized,false);
  assert.equal(p.automaticPcRetries,0);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {read996OriginalBacklogEvidence} from '../tools/controller-996-backlog-readback.mjs';

const REPO='ansqhd5774-Choi/zgmini-pc-control';
const REQUEST='pc-update-0010b2cf-9bca-40cf-89c5-b750fa42b404';
const USER='ansqhd5774-Choi';
const pausedAt='2026-11-10T01:30:00.000Z';
const resumedAt='2026-11-10T03:15:00.000Z';
const JOB='pc-5deaa1bc-0acf-4c5b-87a2-33dc0765e2e9';
function makeIssue(number=1270){return {number,title:'core-status',
 user:{login:USER},created_at:'2026-11-10T03:14:59.500Z',
 labels:[{name:'pc-job'}],body:JSON.stringify({schema:'ZGMINI_PC_JOB_V1',
 requestId:JOB,chatId:'chat-bd1755f9-7cd1-4ceb-bf8c-aac9ca521647',
 sourceRepository:'ansqhd5774-Choi/zgmini',sourceBranch:'main',
 sourceSha:'a'.repeat(40),operation:'core-status'})};}
function fixture({marker=true,replays={}}={}){
 const state={issues:[makeIssue()],calls:[],unstable:false};
 const id='123456789',attempt='1',seat='2';
 const report={schema:'ZGMINI_PC_RESULT_V1',jobId:`run-${id}-${attempt}-seat-${seat}`,
  requestId:JOB,controlRepository:REPO,seat:2,status:'PASS',code:'OK'};
 const json=Buffer.from(JSON.stringify(report,null,2)+'\n');
 const txt=Buffer.from(Object.entries(report).map(([k,v])=>`${k}=${v}`).join('\r\n')+'\r\n');
 const comments=marker?[{id:511,user:{login:'github-actions[bot]'},
  body:`<!-- zgmini-pc-result:${id}:${attempt}:${seat} -->\nPASS`}]:[];
 const remote=new Map([
  [`contents/results/${id}-${attempt}-seat-${seat}.json`,json],
  [`contents/results/${id}-${attempt}-seat-${seat}.txt`,txt],
 ]);
 const api=async route=>{
  state.calls.push(route);
  if(route.startsWith('issues?')){
   const page=Number(new URLSearchParams(route.slice(7)).get('page'));
   if(state.unstable&&state.calls.filter(x=>x.startsWith('issues?')).length===2)
    return {status:200,data:[]};
   return {status:200,data:page===1?state.issues:[]};
  }
  if(route==='issues/1270/comments?per_page=100&page=1')
   return {status:200,data:comments};
  if(route==='issues/1271/comments?per_page=100&page=1')
   return {status:200,data:[]};
  if(remote.has(route))return {status:200,data:{type:'file',
   encoding:'base64',path:route.replace('contents/',''),
   content:remote.get(route).toString('base64')}};
  return {status:404,data:{}};
 };
 const run=()=>read996OriginalBacklogEvidence({api,pausedAt,resumedAt,replays});
 return {state,api,run,report,remote,comments,json,txt};
}

test('two stable issue scans, full comments and both verified result bytes',async()=>{
 const f=fixture(),r=await f.run();
 assert.equal(r.status,'READONLY_RESULT_PAIRS_VERIFIED');
 assert.equal(r.verifiedCount,1);assert.equal(r.unresolvedCount,0);
 assert.equal(r.originalIssueCount,1);
 assert.equal(r.entries[0].verification.status,'RESULT_PAIR_VERIFIED');
 assert.equal(r.entries[0].verification.resultStatus,'PASS');
 assert.equal(r.entries[0].verification.runId,'123456789');
 assert.equal(r.issuePosts,0);assert.equal(r.pcRetries,0);
 assert.equal(r.executionAuthorized,false);
 assert.equal(f.state.calls.filter(x=>x.startsWith('issues?')).length,2);
 assert.ok(f.state.calls[0].includes('sort=created&direction=desc&per_page=100'));
 assert.ok(f.state.calls.every(x=>!x.includes('since=')));
});

test('missing result marker becomes replan only, never a new pc-job',async()=>{
 const f=fixture({marker:false}),r=await f.run();
 assert.equal(r.status,'READONLY_VERIFICATION_INCOMPLETE');
 assert.equal(r.unresolvedCount,1);
 assert.equal(r.entries[0].verification.status,'OWNER_REPLAN_REVIEW_REQUIRED');
 assert.equal(r.issuePosts,0);
 assert.equal(f.state.calls.some(x=>x.startsWith('contents/')),false);
});

test('mixed original seven-field and valid scoped nine-field Issues reconcile without replay',async()=>{
 const f=fixture({marker:false});
 const scoped={...makeIssue(1271),title:'writer-install-preimage-readonly',
  created_at:'2026-11-10T03:15:00.000Z'};
 scoped.body=JSON.stringify({...JSON.parse(scoped.body),
  requestId:'pc-20261110-scoped-readonly-1271',
  operation:'writer-install-preimage-readonly',
  preimageManifestPath:'approvals/writer-preimage/market-calendar-er1-import-deps6-readonly-20261108.json',
  preimageManifestSha256:'f'.repeat(64)});
 f.state.issues=[scoped,makeIssue()];
 const r=await f.run();
 assert.equal(r.status,'READONLY_VERIFICATION_INCOMPLETE');
 assert.deepEqual(r.entries.map(x=>x.originIssue),[1270,1271]);
 assert.ok(r.entries.every(x=>x.verification.status==='OWNER_REPLAN_REVIEW_REQUIRED'));
 assert.equal(r.issuePosts,0);assert.equal(r.pcRetries,0);
});

test('missing TXT file does not imply success from JSON or bot comment',async()=>{
 const f=fixture();f.remote.delete('contents/results/123456789-1-seat-2.txt');
 const r=await f.run();
 assert.equal(r.entries[0].verification.status,'RESULT_PAIR_INCOMPLETE');
 assert.equal(r.entries[0].verification.code,'C_GITHUB_RESULT_FILE_MISSING');
});

test('mismatched TXT bytes are rejected independently of JSON',async()=>{
 const f=fixture();f.remote.set('contents/results/123456789-1-seat-2.txt',
  Buffer.from('status=PASS\r\n'));
 const r=await f.run();
 assert.equal(r.entries[0].verification.code,'C_GITHUB_RESULT_PAIR_MISMATCH');
});

test('report requestId and run/seat identity must match original Issue',async()=>{
 const f=fixture();f.report.requestId=REQUEST;
 f.remote.set('contents/results/123456789-1-seat-2.json',
  Buffer.from(JSON.stringify(f.report)));
 const r=await f.run();
 assert.equal(r.entries[0].verification.code,'C_GITHUB_RESULT_IDENTITY_UNPROVEN');
});

test('PR rows are excluded even when labeled pc-job',async()=>{
 const f=fixture({marker:false});f.state.issues=[{...makeIssue(),
  pull_request:{url:'https://api.github.com/repos/example/pulls/1270'}}];
 const r=await f.run();
 assert.equal(r.status,'READONLY_EMPTY_WINDOW_VERIFIED');
 assert.equal(r.originalIssueCount,0);
 assert.equal(f.state.calls.some(x=>x.includes('/comments')),false);
});

test('duplicate, unsorted or unstable pages fail closed',async()=>{
 const f=fixture();f.state.issues=[makeIssue(),makeIssue()];
 await assert.rejects(f.run(),/C_GITHUB_ISSUE_PAGE_DUPLICATE_OR_UNSORTED/);
 const g=fixture();g.state.issues=[makeIssue(),{...makeIssue(1271),
  created_at:'2026-11-10T03:15:00.000Z'}];
 await assert.rejects(g.run(),/C_GITHUB_ISSUE_PAGE_DUPLICATE_OR_UNSORTED/);
 const h=fixture();h.state.unstable=true;
 await assert.rejects(h.run(),/C_GITHUB_ISSUES_UNSTABLE_BETWEEN_PASSES/);
});

test('duplicate bot receipt is an error, not a successful result',async()=>{
 const f=fixture();f.comments.push({...f.comments[0],id:512});
 await assert.rejects(f.run(),/C_GITHUB_BACKLOG_PLAN_ORIGINAL_RESULT_RECEIPT_AMBIGUOUS/);
});

test('invalid comment page and repository provenance fail closed',async()=>{
 const f=fixture();f.state.issues[0].repository='unrelated/repo';
 await assert.rejects(f.run(),/C_GITHUB_ISSUE_REPO_DRIFT/);
 const g=fixture();g.comments[0].id=null;
 await assert.rejects(g.run(),/C_GITHUB_COMMENT_DUPLICATE_OR_INVALID/);
});

test('invalid pause window is rejected before any GitHub call',async()=>{
 const f=fixture();
 await assert.rejects(read996OriginalBacklogEvidence({api:f.api,
  pausedAt:resumedAt,resumedAt:pausedAt,replays:{}}),/C_GITHUB_PAUSE_WINDOW_INVALID/);
 assert.equal(f.state.calls.length,0);
});

test('missing original Windows replay journal fails before any GitHub read',async()=>{
 const f=fixture();
 await assert.rejects(read996OriginalBacklogEvidence({api:f.api,
  pausedAt,resumedAt}),/C_GITHUB_ORIGINAL_REPLAYS_NOT_PROVIDED/);
 await assert.rejects(read996OriginalBacklogEvidence({api:f.api,
  pausedAt,resumedAt,replays:null}),/C_GITHUB_ORIGINAL_REPLAYS_NOT_PROVIDED/);
 assert.equal(f.state.calls.length,0);
});

test('DONE replay without independent replay Issue and result proof remains unresolved',async()=>{
 const replays={'1270':{status:'DONE',originalRequestId:JOB,replayIssueNumber:1279}};
 const f=fixture({marker:false,replays}),r=await f.run();
 assert.equal(r.status,'READONLY_VERIFICATION_INCOMPLETE');
 assert.equal(r.verifiedCount,0);assert.equal(r.unresolvedCount,1);
 assert.equal(r.entries[0].verification.status,'PRIOR_REPLAY_UNVERIFIED');
 assert.equal(f.state.calls.some(x=>x.startsWith('contents/')),false);
 const invalid=fixture({marker:false,replays:{'1270':{status:'DONE',
  originalRequestId:JOB,replayIssueNumber:'wrong'}}});
 const bad=await invalid.run();
 assert.equal(bad.entries[0].verification.status,'JOURNAL_INCONSISTENT');
});

test('SKIPPED_RESULT_PRESENT without verified original result pair is inconsistent',async()=>{
 const replays={'1270':{status:'SKIPPED_RESULT_PRESENT'}};
 const missing=fixture({marker:false,replays}),r=await missing.run();
 assert.equal(r.status,'READONLY_VERIFICATION_INCOMPLETE');
 assert.equal(r.entries[0].verification.status,'JOURNAL_INCONSISTENT');
 const mismatched=fixture({replays});
 mismatched.remote.set('contents/results/123456789-1-seat-2.txt',
  Buffer.from('status=PASS\r\n'));
 const bad=await mismatched.run();
 assert.equal(bad.entries[0].verification.status,'JOURNAL_INCONSISTENT');
 const verified=fixture({replays}),v=await verified.run();
 assert.equal(v.status,'READONLY_RESULT_PAIRS_VERIFIED');
 assert.equal(v.entries[0].verification.status,'RESULT_PAIR_VERIFIED');
});

test('mixed verified and unresolved results cannot become globally verified',async()=>{
 const f=fixture();
 const other={...makeIssue(1271),created_at:'2026-11-10T03:15:00.000Z'};
 other.body=JSON.stringify({...JSON.parse(other.body),
  requestId:'pc-20261110-second-test-1271'});
 f.state.issues=[other,makeIssue()];
 const r=await f.run();
 assert.equal(r.status,'READONLY_VERIFICATION_INCOMPLETE');
 assert.equal(r.verifiedCount,1);assert.equal(r.unresolvedCount,1);
 assert.equal(r.entries[1].verification.status,'OWNER_REPLAN_REVIEW_REQUIRED');
});

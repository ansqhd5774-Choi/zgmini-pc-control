import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {HANDOFF_OWNER,HANDOFF_REPOSITORY} from '../agent-handoff/queue-selector.mjs';
import {DIRECT_OWNER_REVIEWS,compileDirectOwnerBoard,renderDirectOwnerMarkdown}
 from '../agent-handoff/direct-owner-reviews.mjs';
const now=Date.parse('2026-11-17T05:00:00Z');
const API='https://api.github.com/repos/'+HANDOFF_REPOSITORY;
function fixture(){
 return DIRECT_OWNER_REVIEWS.map(s=>({
  origin:{id:s.originCommentId,user:{login:HANDOFF_OWNER},issue_url:API+'/issues/68',
    body:'Central owner request '+s.textProof},
  review:{number:s.reviewIssue,repository_url:API,title:'Shared review '+s.reviewTitle,
    state:'open',...(s.reviewType==='PR'?{pull_request:{url:API+'/pulls/'+s.reviewIssue}}:{})}
 }));
}
test('direct owner requests count four independently of agent handoff incidents',()=>{
 const b=compileDirectOwnerBoard(fixture(),now);
 assert.equal(b.intakeCount,4);
 assert.equal(b.verifiedOriginCount,4);
 assert.equal(b.verifiedReviewCount,4);
 assert.deepEqual(b.records.map(x=>x.worker),['W01','W03','W04','W05']);
 assert.equal(b.records.every(x=>x.state==='REVIEW_OPEN'),true);
 assert.equal(b.records.every(x=>x.pcRuntimeVerified===false&&x.bApprovalVerified===false),true);
 assert.equal(b.pcOperationalWrites,0);
 const md=renderDirectOwnerMarkdown(b);
 assert.match(md,/직접 담당 인계/);
 assert.match(md,/자동 장애 Incident와 별도/);
 assert.match(md,/#1892/);
});
test('spoofed central origin comments are not accepted as verified intake',()=>{
 const a=fixture();a[0].origin.user.login='attacker';
 a[1].origin.issue_url=API+'/issues/69';
 a[2].origin.body='unrelated';
 a[3].origin.id=1;
 const b=compileDirectOwnerBoard(a,now);
 assert.equal(b.verifiedOriginCount,0);
 assert.equal(b.records.every(x=>x.state==='ORIGIN_PROOF_UNVERIFIED'),true);
});
test('missing or mismatched review issues cannot produce verified review',()=>{
 const a=fixture();a[0].review=null;
 a[1].review.number=1885;
 a[2].review.repository_url='https://api.github.com/repos/other/other';
 a[3].review.pull_request={url:'fake'};
 const b=compileDirectOwnerBoard(a,now);
 assert.equal(b.verifiedReviewCount,0);
 assert.equal(b.records.every(x=>x.state==='REVIEW_PROOF_UNVERIFIED'),true);
});
test('closed review never authorizes operating B effects',()=>{
 const a=fixture();a[0].review.state='closed';
 const b=compileDirectOwnerBoard(a,now);
 assert.equal(b.records[0].state,'REVIEW_CLOSED_RUNTIME_UNVERIFIED');
 assert.equal(b.records[0].bApprovalVerified,false);
 assert.equal(b.records[0].pcRuntimeVerified,false);
});
test('bad denominator or timestamp must fail instead of silently undercounting',()=>{
 assert.throws(()=>compileDirectOwnerBoard([],now),/INPUT_INVALID/);
 assert.throws(()=>compileDirectOwnerBoard(fixture(),NaN),/INPUT_INVALID/);
 assert.throws(()=>renderDirectOwnerMarkdown({schema:'wrong'}),/OUTPUT_SCHEMA/);
});
test('board uses only read permissions for issue comments and linked PR review evidence',()=>{
 const yaml=readFileSync(new URL('../.github/workflows/agent-handoff-queue-board.yml',import.meta.url),'utf8');
 assert.match(yaml,/permissions:\\n  contents: read\\n  issues: read\\n  pull-requests: read/);
 assert.doesNotMatch(yaml,/contents: write|issues: write|pull-requests: write/);
 assert.match(yaml,/runs-on: \\[self-hosted, Windows, X64, zgmini-handoff-ci-isolated\\]/);
});
test('runner references exact readonly central comment and issue GETs',()=>{
 const s=readFileSync(new URL('../agent-handoff/queue-board-runner.mjs',import.meta.url),'utf8');
 assert.match(s,/DIRECT_OWNER_REVIEWS/);
 assert.match(s,/issues\/comments\/.*originCommentId/);
 assert.match(s,/compileDirectOwnerBoard/);
 assert.match(s,/renderDirectOwnerMarkdown/);
 assert.doesNotMatch(s,/method:\s*['"]POST|method:\s*['"]PATCH/);
});

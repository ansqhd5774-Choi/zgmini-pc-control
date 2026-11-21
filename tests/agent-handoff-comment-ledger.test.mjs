import test from 'node:test';
import assert from 'node:assert/strict';
import {readIssueCommentLedger} from '../agent-handoff/comment-ledger.mjs';

test('009 reads all 405 comments in a single Issue without 400-row blockage',async()=>{
  const all=Array.from({length:405},(_,i)=>({id:i+1,body:'comment '+i}));
  const pages=[];
  const out=await readIssueCommentLedger(async page=>{
    pages.push(page);return all.slice((page-1)*100,page*100);
  });
  assert.equal(out.length,405);
  assert.deepEqual(pages,[1,2,3,4,5]);
});
test('009 accepts exactly 400 historical rows with empty boundary page',async()=>{
  const all=Array.from({length:400},(_,i)=>({id:i+1}));
  const pages=[];
  const out=await readIssueCommentLedger(async page=>{
    pages.push(page);return all.slice((page-1)*100,page*100);
  });
  assert.equal(out.length,400);
  assert.deepEqual(pages,[1,2,3,4,5]);
});
test('009 rejects malformed or overlapping pages rather than accepting incomplete receipts',async()=>{
  await assert.rejects(readIssueCommentLedger(async()=>({})),/PAGE_INVALID/);
  await assert.rejects(readIssueCommentLedger(async p=>
    Array.from({length:p===1?100:1},(_,i)=>({id:i+1}))),/PAGE_IDENTITY/);
});

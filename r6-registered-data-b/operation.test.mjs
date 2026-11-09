import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {authorizeR6RegisteredB,R6_B_REPO,R6_B_TITLE,R6_B_LABEL,R6_B_SCHEMA}
 from './operation.mjs';

const uid='d3ac6032-49c1-47e6-98d1-d7adeba91a7c';
const chat='b3ac6032-49c1-47e6-98d1-d7adeba91a7c';
const hash=v=>createHash('sha256').update(v).digest('hex');
const sha40='a'.repeat(40),sha64='f'.repeat(64);
const proposed=JSON.parse(readFileSync(new URL('../approvals/employment-r6-registered-data/PROPOSED-ONE_YEAR-20261109.json',import.meta.url)));
const overlay=Object.freeze({schema:'ZGMINI_PC_WRITER_SOURCE_B_APPROVAL_V1',
 status:'APPROVED_B',sourceRoot:proposed.sourceRoot,candidateSourceSha:sha40,
 allowProviderCalls:false,allowDbChanges:false,allowD1Writes:false,
 files:Array.from({length:13},(_,i)=>({path:`lib/market-score/x${i}.mjs`,afterSha256:sha64}))});
function fixture(approval={...proposed,status:'APPROVED_B'},changes={}){
 const overlayBytes=Buffer.from(JSON.stringify(overlay));
 const payload={...approval,overlayManifestSha256:hash(overlayBytes)};
 const approvalBytes=Buffer.from(JSON.stringify(payload));
 const request={schema:R6_B_SCHEMA,requestId:uid,chatId:chat,
  operation:'employment-r6-registered-data-once',approvalManifestSha256:hash(approvalBytes)};
 const event={action:'opened',repository:{full_name:R6_B_REPO,private:true},
  sender:{login:'ansqhd5774-Choi'},issue:{title:R6_B_TITLE,
   user:{login:'ansqhd5774-Choi'},number:1,
   labels:[{name:R6_B_LABEL}],body:JSON.stringify(request)}};
 const env={GITHUB_REPOSITORY:R6_B_REPO,GITHUB_EVENT_NAME:'issues',
  GITHUB_EVENT_ACTION:'opened',GITHUB_ACTOR:'ansqhd5774-Choi',
  GITHUB_RUN_ATTEMPT:'1',GITHUB_SHA:sha40};
 return {event:{...event,...changes.event},env:{...env,...changes.env},
  approvalBytes,overlayBytes};
}

test('strict approved 7 BLS+2 DOL ONE_YEAR manifest passes pure authentication',()=>{
 const input=fixture();
 const result=authorizeR6RegisteredB(input);
 assert.equal(result.approval.mode,'ONE_YEAR');
 assert.equal(result.approval.maxBlsCalls,7);
 assert.equal(result.approval.maxDolCalls,2);
});
test('proposed manifest never authorizes external effects',()=>{
 assert.throws(()=>authorizeR6RegisteredB(fixture(proposed)),
  /R6_B_EFFECT_APPROVAL_STOP/);
});
test('manifest pin mismatch fails before operational checkout',()=>{
 const input=fixture();
 input.approvalBytes=Buffer.from('not the manifest');
 assert.throws(()=>authorizeR6RegisteredB(input),/R6_B_APPROVAL_HASH_STOP/);
});
test('non-owner, rerun, or wrong title are not accepted',()=>{
 for(const changes of [{env:{GITHUB_ACTOR:'someone'}},
  {env:{GITHUB_RUN_ATTEMPT:'2'}},
  {event:{issue:{title:'wrong'}}}]){
  assert.throws(()=>authorizeR6RegisteredB(fixture(undefined,changes)),
    /R6_B_OWNER_EVENT_STOP/);
 }
});
test('registered API call over-cap and unauthorized task effect fail',()=>{
 for(const mutate of [a=>{a.maxBlsCalls=14;},
  a=>{a.effects.taskWrites=true;},
  a=>{a.effects.d1PublicSnapshot=false;}]){
  const a=structuredClone(proposed);a.status='APPROVED_B';mutate(a);
  assert.throws(()=>authorizeR6RegisteredB(fixture(a)),
   /R6_B_EFFECT_APPROVAL_STOP/);
 }
});

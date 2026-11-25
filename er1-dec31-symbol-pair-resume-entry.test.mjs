import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validatePairRequest,validatePairApproval} from './er1-dec31-symbol-batch-a-entry.mjs';

const REPO='ansqhd5774-Choi/zgmini-pc-control';
const OWNER='ansqhd5774-Choi';
const TITLE='pc-er1-dec31-symbol-pair-resume-once';
const SHA='e9895abee60bc74e30380372143daf10cb3333ee';
const request=()=>({
  schema:'ZGMINI_ER1_DEC31_PAIR_RESUME_V1',
  requestId:'pc-dec31-pair-550e8400-e29b-41d4-a716-446655440000',
  chatId:'chat-550e8400-e29b-41d4-a716-446655440001',
  operation:'resume-december-2026-tol-casy-private-only',
  sourceSha:SHA,originalIssueNumber:173,from:'2026-12-01',through:'2026-12-31'
});
const env=()=>({
  GITHUB_REPOSITORY:REPO,GITHUB_ACTOR:OWNER,
  GITHUB_EVENT_NAME:'issues',GITHUB_EVENT_ACTION:'opened'
});
const event=(body=request())=>({
  action:'opened',issue:{user:{login:OWNER},title:TITLE,
    labels:[{name:'pc-er1-approved'}],body:JSON.stringify(body)}
});
const approval=()=>JSON.parse(fs.readFileSync(
  new URL('./ER1_DEC31_SYMBOL_PAIR_RESUME_B_APPROVAL.json',import.meta.url),'utf8'));

test('exact owner+issue+scope permits new request only',()=>{
  const r=validatePairRequest(event(),env());
  assert.equal(r.sourceSha,SHA);
  assert.equal(r.originalIssueNumber,173);
});

test('non-owner, wrong title, missing label and wrong action are denied',()=>{
  const wrongActor=env();wrongActor.GITHUB_ACTOR='someone-else';
  assert.throws(()=>validatePairRequest(event(),wrongActor),
    /DEC31_PAIR_REQUEST_OWNER_STOP/);
  const wrongTitle=event();wrongTitle.issue.title='pc-er1-dec31-symbol-batch-a-one-shot';
  assert.throws(()=>validatePairRequest(wrongTitle,env()),
    /DEC31_PAIR_REQUEST_OWNER_STOP/);
  const noLabel=event();noLabel.issue.labels=[];
  assert.throws(()=>validatePairRequest(noLabel,env()),
    /DEC31_PAIR_REQUEST_OWNER_STOP/);
  const wrongAction=event();wrongAction.action='labeled';
  assert.throws(()=>validatePairRequest(wrongAction,env()),
    /DEC31_PAIR_REQUEST_OWNER_STOP/);
});

test('original request ID and additional JSON fields are denied',()=>{
  const r=request();r.requestId='pc-dec31-a237c95a-dedb-4d19-854c-eb1234878eab';
  assert.throws(()=>validatePairRequest(event(r),env()),
    /DEC31_PAIR_REQUEST_CONTRACT_STOP/);
  const withExtra={...request(),manualOverride:true};
  assert.throws(()=>validatePairRequest(event(withExtra),env()),
    /DEC31_PAIR_REQUEST_CONTRACT_STOP/);
});

test('unapproved source or operation are denied',()=>{
  for(const changes of [
    {sourceSha:'55014d3c76ac1071dbe369c0a7fe72bd94ed0c5a'},
    {operation:'capture-december-2026-earnings-symbol-batch-a'},
    {originalIssueNumber:474},
    {from:'2026-11-01'}]){
    assert.throws(()=>validatePairRequest(event({...request(),...changes}),env()),
      /DEC31_PAIR_REQUEST_CONTRACT_STOP/);
  }
});

test('pinned two-request user approval is accepted',()=>{
  const a=approval();
  assert.equal(validatePairApproval(a),a);
  assert.deepEqual(a.symbols,['TOL','CASY']);
  assert.equal(a.maxProviderRequests,2);
  assert.equal(a.maxAutomaticRetries,0);
});

test('approval rejects widened limits, retries, providers, paid plan and D1',()=>{
  for(const change of [
    {maxProviderRequests:3},{maxAutomaticRetries:1},
    {allowNewProvider:true},{allowPaidPlanChange:true},
    {allowD1Writes:true},{allowCoreWrites:true},
    {allowSchedulerChanges:true},{allowPublicRawData:true},
    {symbols:['TOL','CASY','BOX']},
    {fixedExistingSymbols:37}]){
    assert.throws(()=>validatePairApproval({...approval(),...change}),
      /DEC31_PAIR_APPROVAL_SCOPE_STOP/);
  }
});

test('approval rejects wrong source or original request lineage',()=>{
  for(const change of [
    {sourceSha:'55014d3c76ac1071dbe369c0a7fe72bd94ed0c5a'},
    {sourceGitBlobSha1:'0'.repeat(40)},
    {originalIssueNumber:155},
    {originalRequestId:'pc-dec31-different'},
    {approvalState:'PROPOSED_NOT_APPROVED'}]){
    assert.throws(()=>validatePairApproval({...approval(),...change}),
      /DEC31_PAIR_APPROVAL_SCOPE_STOP/);
  }
});

test('workflow retains original job and pins separate pair job and source',()=>{
  const text=fs.readFileSync(new URL('./.github/workflows/pc-er1-dec31-symbol-batch-a.yml',import.meta.url),'utf8');
  assert.match(text,/ref: 55014d3c76ac1071dbe369c0a7fe72bd94ed0c5a/);
  assert.match(text,/ref: e9895abee60bc74e30380372143daf10cb3333ee/);
  assert.match(text,/github\.event\.issue\.title == 'pc-er1-dec31-symbol-pair-resume-once'/);
  assert.match(text,/--pair-resume/);
  assert.match(text,/--upload-pair/);
  assert.match(text,/types: \[opened\]/);
});

test('pair-mode entry can only import verified source and call constrained option',()=>{
  const text=fs.readFileSync(new URL('./er1-dec31-symbol-batch-a-entry.mjs',import.meta.url),'utf8');
  assert.match(text,/blob!==PAIR_SOURCE_BLOB/);
  assert.match(text,/sha!==PAIR_SOURCE_SHA/);
  assert.match(text,/verifyOriginalOneShot\(\)/);
  assert.match(text,/runDec31Batch\(\{resumeMissingPairOnly:true\}\)/);
  assert.match(text,/ONE_SHOT_STARTED\.json'\),'wx'/);
});

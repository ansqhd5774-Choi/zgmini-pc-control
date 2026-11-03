import test from 'node:test';
import assert from 'node:assert/strict';
import {sha256,operationSpec,validatePublicationRequest,validatePublicationApproval,
  validateBApprovalComment,validateSourceCheckpoints,classifyPublicationLedger,
  validatePublicationReadback,validatePublisherFileDigests,CONTROL_REPOSITORY,SOURCE_REPOSITORY,
  ACTOR,REQUEST_SCHEMA,APPROVAL_SCHEMA} from '../tools/publication-contract.mjs';

const UUID='4d352dc8-7cf5-4b49-bb8f-39398dc9be51';
const REQUEST_ID='pc-publication-'+UUID;
const fixture=(operation='census-qfr-margin-once')=>{
 const spec=operationSpec(operation);
 const approval={schema:APPROVAL_SCHEMA,requestId:REQUEST_ID,operation,
   sourceRepository:SOURCE_REPOSITORY,publisherSha:'a'.repeat(40),
   operationalSha:'b'.repeat(40),snapshotKey:spec.snapshotKey,
   publisherFiles:Object.fromEntries(spec.sourceFiles.map(name=>[name,'c'.repeat(64)])),
   approval:{grade:'B',scope:spec.approvalScope,actor:ACTOR,issueNumber:84},
   execution:{mode:'ONCE',maxAutomaticRetries:0,maxD1Keys:1,provider:spec.provider}};
 const bytes=JSON.stringify(approval);
 const request={schema:REQUEST_SCHEMA,requestId:REQUEST_ID,
   chatId:'chat-12f7e7d2-2ed8-4efe-baca-e3624a84097c',operation,
   controlRepository:CONTROL_REPOSITORY,approvalManifestSha256:sha256(bytes)};
 return {request,approval,bytes};
};
const context={actor:ACTOR,repository:CONTROL_REPOSITORY,privateRepository:true,
 eventName:'issues',eventAction:'opened',labels:['pc-publication']};
const validate=(f,env=context)=>validatePublicationRequest(JSON.stringify(f.request),env);
const admitted=f=>validatePublicationApproval(validate(f),f.bytes);
const repin=f=>{f.bytes=JSON.stringify(f.approval);f.request.approvalManifestSha256=sha256(f.bytes);};

test('only BEA and QFR are admitted with fixed scripts, explicit write flags and independent keys',()=>{
 const a=admitted(fixture('bea-unit-profit-once'));
 const b=admitted(fixture('census-qfr-margin-once'));
 assert.deepEqual(a.invocation.flags,['--apply','--confirm-bea-unit-d1-write']);
 assert.deepEqual(b.invocation.flags,['--apply','--confirm-census-qfr-d1-write']);
 assert.notEqual(a.invocation.snapshotKey,b.invocation.snapshotKey);
 assert.match(a.invocation.script,/EARNINGS_BEA_UNIT_PROFIT_R1_ONCE\.mjs$/);
 assert.match(b.invocation.script,/EARNINGS_CENSUS_QFR_R4_D1_ONCE\.mjs$/);
});
test('wrong actor, public repository, label, event or extra request fields are blocked',()=>{
 for(const env of [{...context,actor:'other'},{...context,privateRepository:false},
  {...context,labels:[]},{...context,eventName:'workflow_dispatch'}])
  assert.throws(()=>validate(fixture(),env),/PUBLICATION_EVENT_NOT_AUTHORIZED/);
 const f=fixture();f.request.shell='cmd /c whoami';
 assert.throws(()=>validate(f),/PUBLICATION_REQUEST_FIELDS_INVALID/);
});
test('unique UUID, approval hash and operations are strictly validated',()=>{
 const f=fixture();f.request.requestId='pc-publication-not-a-uuid';
 assert.throws(()=>validate(f),/PUBLICATION_REQUEST_ID_INVALID/);
 const g=fixture();g.request.operation='arbitrary-script';
 assert.throws(()=>validate(g),/PUBLICATION_OPERATION_NOT_ALLOWED/);
 const h=fixture();h.request.approvalManifestSha256='c'.repeat(64);
 assert.throws(()=>admitted(h),/PUBLICATION_MANIFEST_HASH_MISMATCH/);
});
test('wrong target key, source repository, source SHA, grade and operation scope block',()=>{
 const edits=[['snapshotKey','detail:earnings-recession-indicators:v1',/SCOPE_MISMATCH/],
  ['sourceRepository','attacker/repo',/SCOPE_MISMATCH/],
  ['publisherSha','notsha',/PUBLISHER_SHA_INVALID/]];
 for(const [key,value,pattern] of edits){const f=fixture();f.approval[key]=value;repin(f);
  assert.throws(()=>admitted(f),pattern);}
 for(const edit of [x=>x.approval.grade='A',x=>x.approval.scope='ALL_D1']){
  const f=fixture();edit(f.approval);repin(f);
  assert.throws(()=>admitted(f),/PUBLICATION_B_APPROVAL_MISSING/);}
});
test('BEA library files and fixed QFR import graph require exact approved bytes',()=>{
 for(const operation of ['bea-unit-profit-once','census-qfr-margin-once']){
  const v=admitted(fixture(operation));
  assert.equal(validatePublisherFileDigests(v,v.approval.publisherFiles),true);
  const file=Object.keys(v.approval.publisherFiles).find(x=>x.startsWith('lib/'))
    ??Object.keys(v.approval.publisherFiles)[0];
  const corrupted={...v.approval.publisherFiles,[file]:'d'.repeat(64)};
  assert.throws(()=>validatePublisherFileDigests(v,corrupted),/PUBLICATION_SOURCE_FILE_DRIFT/);
  const missing={...v.approval.publisherFiles};delete missing[file];
  assert.throws(()=>validatePublisherFileDigests(v,missing),/PUBLICATION_ACTUAL_FILES_INVALID/);
 }
 const f=fixture('bea-unit-profit-once');
 delete f.approval.publisherFiles['lib/market-score/earnings-bea-unit-profit-source-r1.mjs'];
 repin(f);assert.throws(()=>admitted(f),/PUBLICATION_SOURCE_FILES_INVALID/);
});
test('one write, no retries, one-shot, fixed provider contract only',()=>{
 for(const edit of [x=>x.execution.maxD1Keys=2,x=>x.execution.maxAutomaticRetries=1,
  x=>x.execution.mode='RECURRING',x=>x.execution.provider='ANY']){
  const f=fixture();edit(f.approval);repin(f);
  assert.throws(()=>admitted(f),/PUBLICATION_EXECUTION_SCOPE_INVALID/);}
});
test('an explicit separate Issue comment by the approved actor is necessary',()=>{
 const v=admitted(fixture());const marker=`ZGMINI_B_PUBLICATION_APPROVED ${REQUEST_ID} ${v.request.approvalManifestSha256}`;
 assert.throws(()=>validateBApprovalComment(v,[{user:{login:'attacker'},body:marker}]),
  /PUBLICATION_EXPLICIT_B_APPROVAL_NOT_FOUND/);
 assert.throws(()=>validateBApprovalComment(v,[{user:{login:ACTOR},body:marker+' EXTRA'}]),
  /PUBLICATION_EXPLICIT_B_APPROVAL_NOT_FOUND/);
 assert.equal(validateBApprovalComment(v,[{user:{login:ACTOR},body:marker}]),true);
});
test('dirty or drifting main and distinct operational config source stop before D1',()=>{
 const v=admitted(fixture());
 const state={publisherHead:'a'.repeat(40),originMainHead:'a'.repeat(40),
  publisherBranch:'main',publisherClean:true,operationalHead:'b'.repeat(40),
  configSource:'b'.repeat(40),operationalClean:true,
  publisherRoot:'E:/ZGmini/projects/publisher',operationalRoot:'E:/ZGmini/projects/core'};
 assert.equal(validateSourceCheckpoints(v,state),true);
 for(const edit of [x=>x.publisherClean=false,x=>x.originMainHead='c'.repeat(40),
  x=>x.publisherBranch='detached']){
  const s=structuredClone(state);edit(s);
  assert.throws(()=>validateSourceCheckpoints(v,s),/PUBLICATION_PUBLISHER_NOT_CLEAN_MAIN/);}
 for(const edit of [x=>x.configSource='c'.repeat(40),x=>x.operationalClean=false,
  x=>x.operationalRoot=x.publisherRoot]){
  const s=structuredClone(state);edit(s);
  assert.throws(()=>validateSourceCheckpoints(v,s),/PUBLICATION_OPERATIONAL_SOURCE_MISMATCH/);}
});
test('request ledger reuses exact duplicate without execution and rejects changed payload',()=>{
 const v=admitted(fixture());
 const first=classifyPublicationLedger(null,v);
 assert.equal(first.status,'NEW');
 assert.deepEqual(classifyPublicationLedger({requestId:REQUEST_ID,fingerprint:first.fingerprint,
   phase:'STATE_UNKNOWN'},v),{status:'DUPLICATE_REUSED_NO_EXECUTION',phase:'STATE_UNKNOWN'});
 assert.throws(()=>classifyPublicationLedger({requestId:REQUEST_ID,
   fingerprint:'c'.repeat(64)},v),/PUBLICATION_DUPLICATE_PAYLOAD_CHANGED/);
});
test('only exact single-key D1 readback (or identical prior stored) can pass',()=>{
 const v=admitted(fixture());
 const data={status:'PASS',key:v.invocation.snapshotKey,
  d1Result:'READBACK_VERIFIED',sourceVersion:'a'.repeat(64),sourceStoredAt:1793112733108};
 assert.equal(validatePublicationReadback(v,data),true);
 assert.equal(validatePublicationReadback(v,{...data,d1Result:'ALREADY_STORED'}),true);
 for(const edit of [x=>x.key='detail:earnings-recession-indicators:v1',
  x=>x.d1Result='WRITE_SUBMITTED',x=>x.sourceStoredAt=0]){
  const d=structuredClone(data);edit(d);
  assert.throws(()=>validatePublicationReadback(v,d),/PUBLICATION_D1_READBACK_NOT_VERIFIED/);}
});

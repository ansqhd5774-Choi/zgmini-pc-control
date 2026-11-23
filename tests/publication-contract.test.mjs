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
   execution:{mode:'ONCE',maxAutomaticRetries:0,maxD1Keys:1,provider:spec.provider},
   ...(['bea-unit-profit-once','bea-unit-nipa-json-once','bea-manufacturing-profit-once'].includes(operation)?{sourceSha256:'f'.repeat(64)}:{})};
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

test('only fixed BEA Unit, BEA manufacturing and QFR sidecars are admitted with distinct keys',()=>{
 const a=admitted(fixture('bea-unit-profit-once'));
 const b=admitted(fixture('census-qfr-margin-once'));
 const m=admitted(fixture('bea-manufacturing-profit-once'));
 assert.deepEqual(m.invocation.flags,['--apply','--confirm-bea-manufacturing-d1-write']);
 assert.equal(m.invocation.snapshotKey,'detail:earnings-bea-manufacturing-profit:r1');
 assert.equal(m.invocation.sourceSha256,'f'.repeat(64));
 assert.notEqual(m.invocation.snapshotKey,a.invocation.snapshotKey);
 assert.notEqual(m.invocation.snapshotKey,b.invocation.snapshotKey);
 assert.match(m.invocation.script,/EARNINGS_BEA_MFG_PROFIT_R6_D1_ONE_SHOT\.mjs$/);
 assert.deepEqual(a.invocation.flags,['--apply','--confirm-bea-unit-d1-write']);
 assert.deepEqual(b.invocation.flags,['--apply','--confirm-census-qfr-d1-write']);
 assert.notEqual(a.invocation.snapshotKey,b.invocation.snapshotKey);
 assert.match(a.invocation.script,/EARNINGS_BEA_UNIT_PROFIT_R1_ONCE\.mjs$/);
 assert.equal(a.invocation.sourceSha256,'f'.repeat(64));
 assert.equal(b.invocation.sourceSha256,null);
 assert.ok(operationSpec('bea-unit-profit-once').sourceFiles
   .includes('scripts/pc-writer/EARNINGS_BEA_UNIT_STORED_RAW_R1.mjs'));
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
 for(const operation of ['bea-unit-profit-once','census-qfr-margin-once','bea-manufacturing-profit-once']){
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
test('exact reviewed publisher survives unrelated main advancement only with verified ancestry',()=>{
 const v=admitted(fixture());
 const state={publisherHead:'a'.repeat(40),originMainHead:'c'.repeat(40),
  publisherBranch:'',publisherOnMainHistory:true,publisherClean:true,
  operationalHead:'b'.repeat(40),configSource:'b'.repeat(40),operationalClean:true,
  publisherRoot:'E:/ZGmini/projects/publisher',operationalRoot:'E:/ZGmini/projects/core'};
 assert.equal(validateSourceCheckpoints(v,state),true);
 for(const edit of [x=>x.publisherOnMainHistory=false,x=>x.publisherHead='d'.repeat(40),
  x=>x.publisherClean=false,x=>x.originMainHead='invalid']){
  const s=structuredClone(state);edit(s);
  assert.throws(()=>validateSourceCheckpoints(v,s),/PUBLICATION_PUBLISHER_NOT_CLEAN_MAIN/);
 }
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

test('BEA source SHA is immutable manifest-pinned while QFR rejects unexpected source pin',()=>{
 const missing=fixture('bea-unit-profit-once');
 delete missing.approval.sourceSha256;repin(missing);
 assert.throws(()=>admitted(missing),/PUBLICATION_MANIFEST_FIELDS_INVALID/);
 const malformed=fixture('bea-unit-profit-once');
 malformed.approval.sourceSha256='not-a-sha';repin(malformed);
 assert.throws(()=>admitted(malformed),/PUBLICATION_BEA_SOURCE_PIN_INVALID/);
 const unexpected=fixture('census-qfr-margin-once');
 unexpected.approval.sourceSha256='d'.repeat(64);repin(unexpected);
 assert.throws(()=>admitted(unexpected),/PUBLICATION_MANIFEST_FIELDS_INVALID/);
});


test('BEA manufacturing requires a separately pinned CSV SHA, bounded source files and its own B effect',()=>{
 const m=fixture('bea-manufacturing-profit-once');
 const v=admitted(m);
 assert.equal(v.approval.approval.scope,'BEA_MANUFACTURING_PROFIT_SINGLE_KEY_D1_ONCE');
 assert.equal(v.approval.execution.provider,'STORED_CSV_ONLY');
 for(const edit of [x=>delete x.sourceSha256,x=>x.sourceSha256='unverified',
   x=>x.approval.scope='CENSUS_QFR_MARGIN_SINGLE_KEY_D1_ONCE',
   x=>x.execution.provider='STORED_SQLITE_ONLY',
   x=>x.publisherFiles['scripts/pc-writer/EARNINGS_BEA_MFG_PROFIT_R6_D1_ONE_SHOT.mjs']='bad']){
  const copy=fixture('bea-manufacturing-profit-once');edit(copy.approval);repin(copy);
  assert.throws(()=>admitted(copy),/PUBLICATION_(MANIFEST_FIELDS_INVALID|BEA_SOURCE_PIN_INVALID|B_APPROVAL_MISSING|EXECUTION_SCOPE_INVALID|SOURCE_DIGEST_INVALID)/);
 }
 const r=fixture('bea-manufacturing-profit-once');
 r.request.operation='census-qfr-margin-once';
 assert.throws(()=>admitted(r),/PUBLICATION_MANIFEST_(FIELDS_INVALID|SCOPE_MISMATCH)/);
});


test('WPSFD42 service B requires exact one-key scope, immutable source import graph and separate approval',()=>{
  const f=fixture('bls-wpsfd42-service-once'),v=admitted(f);
  assert.equal(v.invocation.script,'scripts/pc-writer/EARNINGS_BLS_SERVICE_R1_D1_ONCE.mjs');
  assert.deepEqual(v.invocation.flags,['--apply','--confirm-earnings-c-service-d1-write']);
  assert.equal(v.invocation.snapshotKey,'detail:earnings-recession-indicators:bls-wpsfd42:v1');
  assert.equal(v.approval.approval.scope,'WPSFD42_SERVICE_SINGLE_KEY_D1_ONCE');
  assert.equal(v.approval.execution.provider,'STORED_SQLITE_ONLY');
  assert.equal(v.invocation.sourceSha256,null);
  assert.notEqual(v.invocation.snapshotKey,operationSpec('census-qfr-margin-once').snapshotKey);
  assert.notEqual(v.invocation.snapshotKey,'detail:earnings-recession-indicators:v1');
  for(const path of ['scripts/pc-writer/EARNINGS_BLS_SERVICE_R1_D1_ONCE.mjs',
    'scripts/pc-writer/EARNINGS_R4_C_READ_MODEL_PREVIEW_READONLY.mjs',
    'scripts/pc-writer/EARNINGS_R3D_STORED_BLS_CALC_READONLY.mjs',
    'worker/earnings-companion-c-r4.mjs'])
    assert.ok(operationSpec('bls-wpsfd42-service-once').sourceFiles.includes(path));
  const key=fixture('bls-wpsfd42-service-once');
  key.approval.snapshotKey='detail:earnings-recession-indicators:v1';
  repin(key);
  assert.throws(()=>admitted(key),/PUBLICATION_MANIFEST_SCOPE_MISMATCH/);
  const file=fixture('bls-wpsfd42-service-once');
  delete file.approval.publisherFiles['worker/earnings-companion-c-r4.mjs'];
  repin(file);
  assert.throws(()=>admitted(file),/PUBLICATION_SOURCE_FILES_INVALID/);
  const effects=fixture('bls-wpsfd42-service-once');
  effects.approval.execution.maxD1Keys=2;repin(effects);
  assert.throws(()=>admitted(effects),/PUBLICATION_EXECUTION_SCOPE_INVALID/);
  const grade=fixture('bls-wpsfd42-service-once');
  grade.approval.approval.scope='CENSUS_QFR_MARGIN_SINGLE_KEY_D1_ONCE';repin(grade);
  assert.throws(()=>admitted(grade),/PUBLICATION_B_APPROVAL_MISSING/);
});

test('BEA native JSON uses a separately approved effect in the existing one-key B lane',()=>{
 const native=admitted(fixture('bea-unit-nipa-json-once'));
 const fred=admitted(fixture('bea-unit-profit-once'));
 assert.equal(native.invocation.script,fred.invocation.script);
 assert.equal(native.invocation.snapshotKey,fred.invocation.snapshotKey);
 assert.equal(native.invocation.sourceSha256,'f'.repeat(64));
 assert.deepEqual(native.invocation.flags,['--apply',
  '--confirm-bea-nipa-d1-write','--source-transport=BEA_API_JSON']);
 assert.notDeepEqual(native.invocation.flags,fred.invocation.flags);
 assert.equal(native.approval.approval.scope,'BEA_UNIT_NIPA_JSON_SINGLE_KEY_D1_ONCE');
 assert.equal(native.approval.execution.provider,'BEA_API_JSON');
 for(const file of [
  'scripts/pc-writer/EARNINGS_BEA_UNIT_NIPA_PUBLIC_PROJECTION_R1.mjs',
  'scripts/pc-writer/EARNINGS_BEA_UNIT_NIPA_ARCHIVE_R1.mjs',
  'scripts/pc-writer/EARNINGS_BEA_UNIT_NIPA_EQUIVALENCE_R1.mjs',
  'worker/earnings-bea-unit-profit-r1.mjs'
 ])assert.ok(operationSpec('bea-unit-nipa-json-once').sourceFiles.includes(file));
 const wrongProvider=fixture('bea-unit-nipa-json-once');
 wrongProvider.approval.execution.provider='FRED_CSV';repin(wrongProvider);
 assert.throws(()=>admitted(wrongProvider),/PUBLICATION_EXECUTION_SCOPE_INVALID/);
 const wrongScope=fixture('bea-unit-nipa-json-once');
 wrongScope.approval.approval.scope='BEA_UNIT_PROFIT_SINGLE_KEY_D1_ONCE';repin(wrongScope);
 assert.throws(()=>admitted(wrongScope),/PUBLICATION_B_APPROVAL_MISSING/);
 const missingSource=fixture('bea-unit-nipa-json-once');
 delete missingSource.approval.sourceSha256;repin(missingSource);
 assert.throws(()=>admitted(missingSource),/PUBLICATION_MANIFEST_FIELDS_INVALID/);
 const missingFile=fixture('bea-unit-nipa-json-once');
 delete missingFile.approval.publisherFiles[
  'scripts/pc-writer/EARNINGS_BEA_UNIT_NIPA_PUBLIC_PROJECTION_R1.mjs'];
 repin(missingFile);
 assert.throws(()=>admitted(missingFile),/PUBLICATION_SOURCE_FILES_INVALID/);
});

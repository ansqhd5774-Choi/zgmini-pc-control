import test from 'node:test';
import assert from 'node:assert/strict';
import {validateIssue,validateApproval,SCHEMA,OPERATION,MANIFEST,INSTALLED_SHA,
 FILES,SOURCE_ROOT,DATA_ROOT,sha256,sanitizedCode} from './contract.mjs';
import {sanitizedReport} from './report.mjs';

const requestId='pc-w05-r304-11111111-2222-4333-8444-555555555555';
const chatId='chat-aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const makeEvent=(body={})=>({action:'opened',
 repository:{private:true,full_name:'ansqhd5774-Choi/zgmini-pc-control'},
 sender:{login:'ansqhd5774-Choi'},
 issue:{number:123,title:'pc-w05-r304-service-once',user:{login:'ansqhd5774-Choi'},
 labels:[{name:'pc-writer-b-install'}],body:JSON.stringify({
 schema:SCHEMA,requestId,chatId,operation:OPERATION,
 approvalPath:MANIFEST,approvalSha256:'1'.repeat(64),...body})}});
const env={GITHUB_REPOSITORY:'ansqhd5774-Choi/zgmini-pc-control',
 GITHUB_ACTOR:'ansqhd5774-Choi',GITHUB_EVENT_NAME:'issues',
 GITHUB_EVENT_ACTION:'opened',GITHUB_RUN_ATTEMPT:'1'};

function approved(){
 return {schema:'ZGMINI_W05_R304_SERVICE_B_APPROVAL_V1',
  status:'APPROVED_B',scope:'W05_WPSFD42_BLS_ONCE_EXISTING_SQLITE_APPEND',
  sourceRepository:'ansqhd5774-Choi/zgmini',installedSourceSha:INSTALLED_SHA,
  sourceRoot:SOURCE_ROOT,dataRoot:DATA_ROOT,files:FILES,series:'WPSFD42',
  startYear:2025,endYear:2026,maxProviderRequests:1,runCount:1,
  allowSqliteAppend:true,allowD1Writes:false,allowTaskChanges:false,
  allowSchemaChanges:false,allowOtherSources:false,allowNewSchedulers:false};
}
test('rejects unapproved actor, post-label, request path and replay',()=>{
 assert.equal(validateIssue(makeEvent(),env).requestId,requestId);
 assert.throws(()=>validateIssue({...makeEvent(),sender:{login:'other'}},env),/W05_B_REQUEST_OR_ACTOR_DENIED/);
 assert.throws(()=>validateIssue({...makeEvent(),action:'labeled'},env),/W05_B_REQUEST_OR_ACTOR_DENIED/);
 assert.throws(()=>validateIssue({...makeEvent(),issue:{...makeEvent().issue,labels:[]}},env),/W05_B_REQUEST_OR_ACTOR_DENIED/);
 assert.throws(()=>validateIssue(makeEvent({approvalPath:'../wrong'}),env),/W05_B_REQUEST_CONTRACT_STOP/);
 assert.throws(()=>validateIssue(makeEvent(),{...env,GITHUB_RUN_ATTEMPT:'2'}),/W05_B_REQUEST_OR_ACTOR_DENIED/);
});
test('rejects proposed approval, changed source, broad provider effect and wrong raw hash',()=>{
 const good=approved(),raw=Buffer.from(JSON.stringify(good));
 assert.equal(validateApproval(raw,{approvalSha256:sha256(raw)}).status,'APPROVED_B');
 assert.throws(()=>validateApproval(raw,{approvalSha256:'b'.repeat(64)}),/W05_B_APPROVAL_BYTES_STOP/);
 for(const item of [
  {...good,status:'PROPOSED_NOT_APPROVED'},
  {...good,installedSourceSha:'0'.repeat(40)},
  {...good,allowD1Writes:true},
  {...good,allowSchemaChanges:true},
  {...good,series:'WPSFD41'},
  {...good,maxProviderRequests:2},
  {...good,files:{...good.files,'scripts/pc-writer/other.mjs':'b'.repeat(64)}},
 ]){
  const bytes=Buffer.from(JSON.stringify(item));
  assert.throws(()=>validateApproval(bytes,{approvalSha256:sha256(bytes)}),
   /W05_B_EFFECT_NOT_APPROVED/);
 }
});
test('publisher permits only bounded metadata, never raw data or secret keys',()=>{
 const clean={schema:'ZGMINI_W05_R304_SERVICE_B_RESULT_V1',
  status:'BLOCKED',code:'W05_B_EFFECT_NOT_APPROVED',requestId,
  sourceSha:INSTALLED_SHA,provider:'BLS',series:'WPSFD42',
  providerCalls:'NOT_CONFIRMED',dbWrites:'NOT_CONFIRMED',
  d1Writes:0,schedulerChanges:0,automaticRetries:0};
 assert.equal(sanitizedReport(clean,requestId).status,'BLOCKED');
 assert.throws(()=>sanitizedReport({...clean,payloadJson:'secret'},requestId),
  /W05_B_REPORT_CONTRACT_STOP/);
 assert.throws(()=>sanitizedReport({...clean,d1Writes:1},requestId),
  /W05_B_REPORT_CONTRACT_STOP/);
 assert.throws(()=>sanitizedReport({...clean,providerCalls:'KEY=secret'},requestId),
  /W05_B_REPORT_CONTRACT_STOP/);
 assert.throws(()=>sanitizedReport({...clean,observationAt:'2026-13-01'},requestId),
  /W05_B_REPORT_CONTRACT_STOP/);
 assert.equal(sanitizedCode('NOT_SAFE'),'W05_B_UNEXPECTED_STOP');
});

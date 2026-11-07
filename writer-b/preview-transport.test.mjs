import test from 'node:test';
import assert from 'node:assert/strict';
import {authorizePreviewRequest,REQUEST_SCHEMA} from './preview-entry.mjs';
import {sanitizePreview} from './preview-report.mjs';
const id='12c40a54-452a-42cd-a01e-2c1a27a46de3';
const chat='2a76ba55-0fbb-4ed7-a07e-e57bf42fe514';
const req={schema:REQUEST_SCHEMA,requestId:id,chatId:chat,
 operation:'pc-writer-insert-preview',
 previewSpecPath:'approvals/writer-previews/infl19-r2.json',
 previewSpecSha256:'a'.repeat(64)};
const event={repository:{full_name:'ansqhd5774-Choi/zgmini-pc-control',private:true},
 sender:{login:'ansqhd5774-Choi'},issue:{number:645,user:{login:'ansqhd5774-Choi'},
  title:'pc-writer-insert-preview',labels:[{name:'pc-writer-insert-preview'}],
  body:JSON.stringify(req)}};
const env={GITHUB_REPOSITORY:'ansqhd5774-Choi/zgmini-pc-control',
 GITHUB_EVENT_NAME:'issues',GITHUB_EVENT_ACTION:'opened',
 GITHUB_ACTOR:'ansqhd5774-Choi',GITHUB_RUN_ATTEMPT:'1',GITHUB_SHA:'f'.repeat(40)};
test('exact owner-only, issue-opened and manifest-hash request',()=>{
 assert.deepEqual(authorizePreviewRequest(event,env),req);
 assert.throws(()=>authorizePreviewRequest(event,{...env,GITHUB_ACTOR:'outsider'}),
  /WRITER_B_PREVIEW_ISSUE_AUTH_STOP/);
 assert.throws(()=>authorizePreviewRequest({...event,issue:{...event.issue,
  labels:[]}},env),/WRITER_B_PREVIEW_ISSUE_AUTH_STOP/);
 assert.throws(()=>authorizePreviewRequest({...event,issue:{...event.issue,
  body:JSON.stringify({...req,previewSpecSha256:'weak'})}},env),
  /WRITER_B_PREVIEW_REQUEST_STOP/);
});
test('sanitized PASS requires complete read-only SHA evidence',()=>{
 const result={schema:'ZGMINI_WRITER_B_INSERT_PREVIEW_RESULT_V1',
  requestId:id,chatId:chat,issueNumber:645,status:'PASS_READONLY',
  code:'WRITER_B_INSERT_PREVIEW_VERIFIED',filePath:'scripts/pc-writer/run-local.mjs',
  baseHead:'f'.repeat(40),beforeSha256:'a'.repeat(64),
  afterSha256:'b'.repeat(64),taskXmlSha256:'c'.repeat(64),
  insertions:2,pcSourceWrites:0,taskWrites:0,dbWrites:0,d1Writes:0,
  providerCalls:0,untrustedToken:'DO_NOT_COPY'};
 const out=sanitizePreview(result,req,645);
 assert.equal(out.status,'PASS_READONLY');
 assert.equal(Object.hasOwn(out,'untrustedToken'),false);
 assert.equal(sanitizePreview({...result,pcSourceWrites:1},req,645).status,'BLOCKED');
 assert.equal(sanitizePreview({...result,afterSha256:null},req,645).status,'BLOCKED');
 const withDrain=sanitizePreview({...result,coreDrain:{status:'SNAPSHOT',enabled:true,
  state:4,instances:1,relatedProcesses:1,unknownProcessLines:0,
  cycleLockPresent:true,drainReadyIfDisabled:false}},req,645);
 assert.equal(withDrain.coreDrain.instances,1);
 assert.equal(Object.hasOwn(sanitizePreview({...result,
  coreDrain:{status:'SNAPSHOT',commandLine:'secret'}},req,645),'coreDrain'),false);
});

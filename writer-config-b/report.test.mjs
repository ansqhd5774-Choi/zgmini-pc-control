import test from 'node:test';
import assert from 'node:assert/strict';
import {sanitizeReport,uploadReport,validateReportEvent} from './report.mjs';
import {REQUEST_SCHEMA,OPERATION,CONTROL_REPOSITORY,TITLE,LABEL,ACTOR} from './contract.mjs';
import {createGitPairFixture} from './result-pair-test-fixture.mjs';

const request={schema:REQUEST_SCHEMA,
 requestId:'a314f1b7-6279-4136-9bd2-b20123456789',
 chatId:'4a14f2b7-6279-4136-9bd2-b20123456789',operation:OPERATION,
 controlRepository:CONTROL_REPOSITORY,
 approvalManifestPath:'approvals/writer-config/employment-r6-optins-20261108.json',
 approvalManifestSha256:'e'.repeat(64)};
const event={repository:{full_name:CONTROL_REPOSITORY,private:true},
 sender:{login:ACTOR},issue:{number:101,title:TITLE,user:{login:ACTOR},
 labels:[{name:LABEL}],body:JSON.stringify(request)}};
const env={GITHUB_REPOSITORY:CONTROL_REPOSITORY,GITHUB_EVENT_NAME:'issues',
 GITHUB_EVENT_ACTION:'opened',GITHUB_ACTOR:ACTOR,GITHUB_RUN_ATTEMPT:'1',
 GITHUB_RUN_ID:'424242',GITHUB_TOKEN:'x'.repeat(30)};
const complete={status:'CONFIG_B_APPLIED_VERIFIED',code:'CONFIG_B_OPTINS_SET',
 requestId:request.requestId,manifestSha256:request.approvalManifestSha256,
 controlSha:'c'.repeat(40),installedSourceSha:'d'.repeat(40),verifiedInstalledFiles:19,
 changedKeys:['employmentR6AutoCollection'],beforeSha256:'b'.repeat(64),
 afterSha256:'a'.repeat(64),backupVerified:true};

test('one-key change and idempotent no-op are distinct verified outcomes',()=>{
 assert.deepEqual(sanitizeReport(complete,request,env).changedKeys,
  ['employmentR6AutoCollection']);
 const noop={...complete,code:'CONFIG_B_ALREADY_SET',changedKeys:[],
  afterSha256:complete.beforeSha256,backupVerified:false};
 assert.equal(sanitizeReport(noop,request,env).status,'CONFIG_B_APPLIED_VERIFIED');
 assert.equal(sanitizeReport({...noop,backupVerified:true},request,env).status,
  'CONFIG_B_STATE_UNKNOWN');
});
test('rejects invented changed key, leaked fields and incorrect source proof',()=>{
 for(const altered of [
  {...complete,changedKeys:['admin']},
  {...complete,verifiedInstalledFiles:18},
  {...complete,installedSourceSha:'garbage'},
  {...complete,manifestSha256:'0'.repeat(64)},
 ])assert.equal(sanitizeReport(altered,request,env).status,'CONFIG_B_STATE_UNKNOWN');
 const sanitized=sanitizeReport({...complete,rawConfig:{privateToken:'SECRET'}},request,env);
 assert.equal(JSON.stringify(sanitized).includes('SECRET'),false);
});
test('event authorizer accepts only owner and exact issue',()=>{
 assert.equal(validateReportEvent(event,env).requestId,request.requestId);
 assert.throws(()=>validateReportEvent(event,{...env,GITHUB_ACTOR:'unknown'}),
  /CONFIG_B_REPORT_EVENT_AUTH_STOP/);
});
test('one-shot result pair commits atomically, checks bytes and comments',async()=>{
 const f=createGitPairFixture();
 const r=await uploadReport({event,env,rawResult:JSON.stringify(complete),
  fetchApi:f.fetchApi});
 assert.deepEqual([r.created,r.verified,f.counts.commits,f.counts.updates,
  f.counts.readbacks,f.counts.comments],[2,2,1,1,4,1]);
 assert.equal(r.status,'CONFIG_B_APPLIED_VERIFIED');
});
test('config-B result reporter never claims delivery after branch race',async()=>{
 const f=createGitPairFixture({rejectRefUpdate:true});
 const r=await uploadReport({event,env,rawResult:JSON.stringify(complete),
  fetchApi:f.fetchApi});
 assert.deepEqual([r.status,r.verified,r.created,f.files.size,f.counts.comments],
  ['CONFIG_B_STATE_UNKNOWN',0,0,0,1]);
});

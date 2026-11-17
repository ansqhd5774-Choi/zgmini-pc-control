import test from 'node:test';
import assert from 'node:assert/strict';
import {digest,approveExactR47B,assertApprovedR47B,R47_B_ISSUE}
 from '../task-cmd-b/approval-intake.mjs';
import {R47_CMD_B,R47_CMD_B_CALENDAR_SAFE} from '../task-cmd-b/r47-onefile-cas.mjs';
const SHA='f'.repeat(40);
const RID='01234567-89ab-4cde-8fab-0123456789ab';
const CID='11234567-89ab-4cde-8fab-1123456789ab';
const manifest=()=>({
 schema:R47_CMD_B.schema,status:'APPROVED_B',scope:R47_CMD_B.scope,
 requestId:RID,sourceRepository:R47_CMD_B.sourceRepository,
 sourceSha:'8970d2324e7a917dd0da0e7004e3fc8f8f2d1fae',
 sourcePath:R47_CMD_B.sourcePath,targetPath:R47_CMD_B.targetPath,
 task:R47_CMD_B.task,beforeSha256:R47_CMD_B.historicalOldSha256,
 afterSha256:R47_CMD_B.requestedTargetSha256,
 taskXmlSha256:R47_CMD_B.historicalTaskXmlSha256,runCount:1,
 allowTaskChanges:false,allowProviderCalls:false,allowSqliteWrites:false,
 allowD1Writes:false,allowOtherFileWrites:false,
});
function fixture(){
 const m=manifest(),manifestBytes=Buffer.from(JSON.stringify(m)+'\n');
 const request={schema:R47_B_ISSUE.requestSchema,requestId:RID,chatId:CID,
  operation:R47_B_ISSUE.operation,controlRepository:R47_B_ISSUE.repository,
  approvalManifestPath:'approvals/task-cmd-b/w03-r47-once.json',
  approvalManifestSha256:digest(manifestBytes)};
 const env={GITHUB_REPOSITORY:R47_B_ISSUE.repository,GITHUB_EVENT_NAME:'issues',
  GITHUB_EVENT_ACTION:'opened',GITHUB_ACTOR:R47_B_ISSUE.actor,
  GITHUB_RUN_ATTEMPT:'1',GITHUB_SHA:SHA};
 const event={repository:{full_name:R47_B_ISSUE.repository,private:true},
  sender:{login:R47_B_ISSUE.actor},issue:{number:3000,
   user:{login:R47_B_ISSUE.actor},title:R47_B_ISSUE.title,
   labels:[{name:R47_B_ISSUE.label}],body:JSON.stringify(request)}};
 return {manifestBytes,request,env,event,controlSha:SHA};
}
test('exact user-issued B scope is attested only with same raw manifest SHA',()=>{
 const x=fixture(),a=approveExactR47B(x);
 assert.equal(assertApprovedR47B(a),a);
 assert.equal(a.issueNumber,3000);
 assert.equal(a.manifest.sourceSha,manifest().sourceSha);
 assert.throws(()=>assertApprovedR47B({...a}),{code:'TASK_CMD_B_APPROVAL_NOT_AUTHENTICATED_STOP'});
});
test('calendar-safe exact raw-byte B approval accepts pinned transition only',()=>{
 const x=fixture(),old=JSON.parse(x.manifestBytes.toString('utf8'));
 const next={...old,beforeSha256:R47_CMD_B_CALENDAR_SAFE.beforeSha256,
  afterSha256:R47_CMD_B_CALENDAR_SAFE.afterSha256,
  sourceSha:R47_CMD_B_CALENDAR_SAFE.sourceSha};
 function replace(m){
  x.manifestBytes=Buffer.from(JSON.stringify(m)+'\n');
  x.request.approvalManifestSha256=digest(x.manifestBytes);
  x.event.issue.body=JSON.stringify(x.request);
 }
 replace(next);
 const auth=approveExactR47B(x);
 assert.equal(auth.manifest.beforeSha256,R47_CMD_B_CALENDAR_SAFE.beforeSha256);
 assert.equal(auth.manifest.afterSha256,R47_CMD_B_CALENDAR_SAFE.afterSha256);
 assert.equal(auth.manifest.sourceSha,R47_CMD_B_CALENDAR_SAFE.sourceSha);
 replace({...next,sourceSha:'f'.repeat(40)});
 assert.throws(()=>approveExactR47B(x),{code:'TASK_CMD_B_MANIFEST_SCOPE_STOP'});
 replace({...next,afterSha256:R47_CMD_B.requestedTargetSha256});
 assert.throws(()=>approveExactR47B(x),{code:'TASK_CMD_B_MANIFEST_SCOPE_STOP'});
});
test('reject fake GitHub actor, job attempt, label, title, public repo, wrong control SHA',()=>{
 for(const edit of [
  x=>x.env.GITHUB_ACTOR='someone-else',
  x=>x.env.GITHUB_RUN_ATTEMPT='2',
  x=>x.event.issue.title='pc-writer-source-install',
  x=>x.event.issue.labels=[],
  x=>x.event.repository.private=false,
  x=>x.controlSha='a'.repeat(40)
 ]) {const x=fixture();edit(x);
  assert.throws(()=>approveExactR47B(x),{code:'TASK_CMD_B_ISSUE_AUTH_STOP'});
 }
});
test('reject modified bytes, request id mismatch and forged approved status',()=>{
 for(const [edit,code] of [
  [x=>{x.manifestBytes=Buffer.concat([x.manifestBytes,Buffer.from(' ')])},'TASK_CMD_B_APPROVAL_BYTES_STOP'],
  [x=>{const m=JSON.parse(x.manifestBytes);m.status='PROPOSED_NOT_APPROVED';x.manifestBytes=Buffer.from(JSON.stringify(m));x.request.approvalManifestSha256=digest(x.manifestBytes);x.event.issue.body=JSON.stringify(x.request)},'TASK_CMD_B_MANIFEST_SCOPE_STOP'],
  [x=>{const m=JSON.parse(x.manifestBytes);m.requestId=CID;x.manifestBytes=Buffer.from(JSON.stringify(m));x.request.approvalManifestSha256=digest(x.manifestBytes);x.event.issue.body=JSON.stringify(x.request)},'TASK_CMD_B_APPROVAL_REQUEST_ID_STOP']
 ]) {const x=fixture();edit(x);assert.throws(()=>approveExactR47B(x),{code});}
});

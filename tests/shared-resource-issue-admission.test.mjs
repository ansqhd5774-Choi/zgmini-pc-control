import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {APPROVAL_ROUTES,inspectSharedIssueAdmission,prepareSharedApprovalIssue}
  from '../shared-resource/issue-admission.mjs';
import {reportRejectedAdmission,rejectionBody}
  from '../shared-resource/issue-admission-report.mjs';

const repo='ansqhd5774-Choi/zgmini-pc-control';
const owner='ansqhd5774-Choi';
const request=()=>({schema:'ZGMINI_PC_WRITER_SOURCE_B_REQUEST_V1',
  requestId:'9b4e50f9-8674-4894-9c5e-8ba454d6f79d',
  chatId:'e94b51bd-0c27-4257-b430-c8f69fa6728e',
  operation:'pc-writer-source-install',controlRepository:repo,
  approvalManifestPath:'approvals/writer-updates/employment-r6-r2.json',
  approvalManifestSha256:'b'.repeat(64)});
const base=()=>prepareSharedApprovalIssue('writer-source-b',request());
const issue=(title='pc-writer-source-install')=>({number:1090,user:{login:owner},
  title,labels:[{name:'pc-writer-b-install'}],body:base().body});
const event=(title)=>({action:'opened',
  repository:{full_name:repo,private:true},sender:{login:owner},issue:issue(title)});

test('every registered shared B route produces exact issue title, label, schema',()=>{
  const prepared=base();
  assert.deepEqual(prepared.labels,['pc-writer-b-install']);
  assert.equal(prepared.title,'pc-writer-source-install');
  assert.equal(inspectSharedIssueAdmission(prepared).state,'ADMITTED_TO_WORKFLOW');
  assert.throws(()=>prepareSharedApprovalIssue('unknown',request()),/ROUTE_NOT_REGISTERED/);
});

test('#1090-style incorrect title is explicit rejection, not silent skip success',()=>{
  const admission=inspectSharedIssueAdmission(issue('writer-install'));
  assert.equal(admission.state,'REJECTED_AT_ADMISSION');
  assert.equal(admission.code,'EXACT_ISSUE_TITLE_REQUIRED');
  assert.equal(admission.expectedTitle,'pc-writer-source-install');
  assert.equal(inspectSharedIssueAdmission({...base(),title:'other',
    labels:['unmanaged']}).state,'UNMANAGED');
  const missingLabel=inspectSharedIssueAdmission({...base(),labels:[]});
  assert.equal(missingLabel.state,'REJECTED_AT_ADMISSION');
  assert.equal(missingLabel.code,'EXACT_RESOURCE_LABEL_REQUIRED');
  assert.equal(missingLabel.expectedLabel,'pc-writer-b-install');
  assert.equal(inspectSharedIssueAdmission({...base(),
    body:JSON.stringify({...request(),approvalManifestSha256:'bad'})}).code,
    'REQUEST_MANIFEST_OR_IDENTITY_INVALID');
  assert.throws(()=>prepareSharedApprovalIssue('writer-source-b',
    {...request(),controlRepository:'other/repo'}),/REQUEST_INVALID/);
});

test('one rejecting bot comment is read-back proven; duplicate event reuses',async()=>{
  const ev=event('writer-install');
  const comments=[];let posts=0;
  const io={
    listComments:async()=>comments,
    postComment:async body=>{
      posts++;const item={id:7500,user:{login:'github-actions[bot]'},
        issue_url:`https://api.github.com/repos/${repo}/issues/1090`,body};
      comments.push(item);return {id:7500};
    },
    getComment:async id=>comments.find(x=>x.id===id)
  };
  const first=await reportRejectedAdmission(ev,io);
  assert.equal(first.state,'REJECTION_RECORDED');
  assert.equal(first.pcOperationalWrites,0);
  assert.equal(first.automaticPcRetries,0);
  assert.match(comments[0].body,/정확한 Issue 제목: `pc-writer-source-install`/);
  const second=await reportRejectedAdmission(ev,io);
  assert.equal(second.state,'REJECTION_REUSED');
  assert.equal(posts,1);
  assert.equal(rejectionBody(1090,inspectSharedIssueAdmission(issue('writer-install'))),
    comments[0].body);
});

test('admission report never posts for already valid or untrusted events',async()=>{
  let posts=0;
  const io={listComments:async()=>[],postComment:async()=>{posts++;},
    getComment:async()=>null};
  assert.equal((await reportRejectedAdmission(event(),io)).state,
    'ADMITTED_TO_WORKFLOW');
  const untrusted=event('bad');untrusted.issue.user.login='untrusted';
  await assert.rejects(()=>reportRejectedAdmission(untrusted,io),/EVENT_NOT_ALLOWED/);
  assert.equal(posts,0);
});

test('lost POST response does not duplicate an admission rejection',async()=>{
  const ev=event('writer-install');
  let posts=0,comments=[];
  const io={listComments:async()=>comments,
    postComment:async body=>{posts++;comments.push({id:7700,
      body,user:{login:'github-actions[bot]'},
      issue_url:`https://api.github.com/repos/${repo}/issues/1090`});
      throw Error('ACK_LOST');},
    getComment:async()=>null};
  assert.equal((await reportRejectedAdmission(ev,io)).state,
    'REJECTION_POST_RECONCILED');
  assert.equal(posts,1);
  comments=[];posts=0;
  await assert.rejects(()=>reportRejectedAdmission(ev,{
    ...io,postComment:async()=>{posts++;throw Error('NOT_POSTED');}
  }),/POST_OUTCOME_UNKNOWN/);
  assert.equal(posts,1);
});


test('same B label uses schema and manifest route to return its exact title',()=>{
  const inflation={schema:'ZGMINI_INFLATION_OFFICIAL_MANUAL_B_REQUEST_V1',
    requestId:'9b4e50f9-8674-4894-9c5e-8ba454d6f79d',
    chatId:'e94b51bd-0c27-4257-b430-c8f69fa6728e',
    operation:'inflation-official-manual',controlRepository:repo,
    approvalManifestPath:'approvals/inflation-manual-b/inflation-official-r1.json',
    approvalManifestSha256:'b'.repeat(64)};
  const outcome=inspectSharedIssueAdmission({...base(),
    title:'not-a-real-install-title',body:JSON.stringify(inflation)});
  assert.equal(outcome.code,'EXACT_ISSUE_TITLE_REQUIRED');
  assert.equal(outcome.kind,'inflation-manual-b');
  assert.equal(outcome.expectedTitle,'pc-inflation-official-manual-once');
  assert.equal(inspectSharedIssueAdmission(prepareSharedApprovalIssue(
    'inflation-manual-b',inflation)).state,'ADMITTED_TO_WORKFLOW');
});

test('unknown shared-label body lists valid titles without guessing one',()=>{
  const unknown=inspectSharedIssueAdmission({...base(),
    title:'wrong-title',body:'not json'});
  assert.equal(unknown.state,'REJECTED_AT_ADMISSION');
  assert.equal(unknown.expectedTitle,undefined);
  assert.deepEqual(unknown.expectedTitles,
    ['pc-inflation-official-manual-once','pc-writer-source-install']);
  const body=rejectionBody(1090,unknown);
  assert.match(body,/허용된 Issue 제목 중 하나:/);
  assert.match(body,/pc-inflation-official-manual-once/);
  assert.match(body,/pc-writer-source-install/);
});

test('#1130-style non-UUID chatId is rejected before a Writer B request is published',()=>{
  const invalid={...request(),chatId:'market-calendar-treasury-annual-r2-20261110'};
  const outcome=inspectSharedIssueAdmission({...base(),body:JSON.stringify(invalid)});
  assert.equal(outcome.state,'REJECTED_AT_ADMISSION');
  assert.equal(outcome.code,'REQUEST_MANIFEST_OR_IDENTITY_INVALID');
  assert.throws(()=>prepareSharedApprovalIssue('writer-source-b',invalid),/REQUEST_INVALID/);
});

test('workflow admission gate includes every registered shared B title when label is absent',()=>{
  const workflow=readFileSync(new URL('../.github/workflows/pc-shared-issue-admission.yml',import.meta.url),'utf8');
  for(const route of Object.values(APPROVAL_ROUTES)){
    assert.ok(workflow.includes(`github.event.issue.title == '${route.title}'`),route.title);
    const missing=inspectSharedIssueAdmission({title:route.title,labels:[],body:'{}'});
    assert.equal(missing.code,'EXACT_RESOURCE_LABEL_REQUIRED');
  }
});

test('dedicated R181 workflow titles are not falsely rejected by shared ingress',()=>{
 const workflow=readFileSync(new URL('../.github/workflows/pc-writer-b-source-once.yml',
  import.meta.url),'utf8');
 const titles=['r181-protected-route-install','r181-source-shape-readonly',
  'r181-saved-ledger-readonly','w03-r179-stored-handoff-readonly',
  'w03-r179-guard-shape-readonly',
  'w03-gmh-seven-history-manual-once',
  'w03-gmh-seven-private-score-once',
  'w03-gmh-seven-public-compat-readonly',
  'w03-gmh-seven-d1-seed-readonly',
  'w03-gmh-seven-collection-time-readonly',
  'w03-r47-private-readback-once',
  'w03-r48-private-readback-once',
  'w03-r51-stored-date-readback-once',
  'w03-r179-readback-guard-install',
  'r181-primary-route-install',
  'r181-existing-task-run-once'];
 for(const title of titles){
  assert.ok(workflow.includes("github.event.issue.title == '"+title+"'"),
   'dedicated workflow exact title missing '+title);
  const admission=inspectSharedIssueAdmission({...issue(title),
   body:JSON.stringify({schema:'WRONG_BODY_FOR_SHARED_B'})});
  assert.equal(admission.state,'UNMANAGED');
  assert.equal(admission.code,'DEDICATED_EXACT_WORKFLOW_ROUTE');
 }
 // Same label plus unregistered title still produces a meaningful rejection.
 const unknown=inspectSharedIssueAdmission({...issue('invalid-operation'),
  body:JSON.stringify({schema:'WRONG_BODY'})});
 assert.equal(unknown.code,'EXACT_ISSUE_TITLE_REQUIRED');
 assert.equal(unknown.state,'REJECTED_AT_ADMISSION');
 // Generic shared Writer B routing is not loosened.
 assert.equal(inspectSharedIssueAdmission(base()).state,'ADMITTED_TO_WORKFLOW');
});

test('dedicated R47 CMD B title is delegated without suppressing unknown-label rejection',async()=>{
 const wf=readFileSync(new URL('../.github/workflows/pc-approved-runtime-b-once.yml',import.meta.url),'utf8');
 const title='pc-r47-cmd-onefile-install';
 assert.ok(wf.includes("github.event.issue.title == '"+title+"'"));
 assert.ok(wf.includes("contains(github.event.issue.labels.*.name, 'pc-writer-b-install')"));
 const approved={...issue(title),body:JSON.stringify({
  schema:'ZGMINI_TASK_CMD_ONEFILE_B_REQUEST_V1',
  requestId:'bd14ae89-139d-4722-9e2b-7f401102474f',
  chatId:'e296811b-e936-4cf0-9db5-1b311305f89e',
  operation:'pc-r47-cmd-onefile-install',
  controlRepository:repo,
  approvalManifestPath:'approvals/task-cmd-b/w03-r47-cmd-onefile-reissue-20261117.json',
  approvalManifestSha256:'5ea21082660efcf6bbf1be373e79aeb65b12ecbe854b324de82da595a64566cd'
 })};
 const admission=inspectSharedIssueAdmission(approved);
 assert.deepEqual(admission,{state:'UNMANAGED',code:'DEDICATED_EXACT_WORKFLOW_ROUTE'});
 let posted=0;
 const report=await reportRejectedAdmission({...event(title),issue:approved},{
  listComments:async()=>[],postComment:async()=>{posted++;},getComment:async()=>null
 });
 assert.equal(report.state,'UNMANAGED');
 assert.equal(posted,0);
 const wrong={...approved,title:'invalid-r47-cmd-install'};
 const denied=inspectSharedIssueAdmission(wrong);
 assert.equal(denied.state,'REJECTED_AT_ADMISSION');
 assert.equal(denied.code,'EXACT_ISSUE_TITLE_REQUIRED');
 assert.equal(inspectSharedIssueAdmission(base()).state,'ADMITTED_TO_WORKFLOW');
});

test('dedicated W04 R6 manual B request is not falsely rejected by shared intake',async()=>{
 const workflow=readFileSync(new URL('../.github/workflows/pc-employment-r6-registered-data-once.yml',
  import.meta.url),'utf8');
 const title='pc-employment-r6-registered-data-once';
 assert.ok(workflow.includes("github.event.issue.title == '"+title+"'"));
 assert.ok(workflow.includes("contains(github.event.issue.labels.*.name, 'pc-writer-b-install')"));
 const exact={...issue(title),
  body:JSON.stringify({schema:'ZGMINI_R6_REGISTERED_DATA_B_REQUEST_V1',
   requestId:'6ebd5330-9950-4fcf-94c3-64cf392e4ac2',
   chatId:'12cf700f-384d-4bbb-b401-7ac56be203e7',
   operation:'employment-r6-registered-data-once',
   approvalManifestSha256:'8'.repeat(64)})};
 const result=inspectSharedIssueAdmission(exact);
 assert.deepEqual(result,{state:'UNMANAGED',code:'DEDICATED_EXACT_WORKFLOW_ROUTE'});
 let posted=0;
 const ev={...event(title),issue:exact};
 const report=await reportRejectedAdmission(ev,{
  listComments:async()=>[],postComment:async()=>{posted++;},
  getComment:async()=>null
 });
 assert.equal(report.state,'UNMANAGED');
 assert.equal(posted,0);
 const invalid=inspectSharedIssueAdmission({...exact,title:'not-an-approved-r6-route'});
 assert.equal(invalid.state,'REJECTED_AT_ADMISSION');
 assert.equal(invalid.code,'EXACT_ISSUE_TITLE_REQUIRED');
});


test('CNN exact Sidecar B workflow owns its shared-label issue without false rejection',async()=>{
 const wf=readFileSync(new URL('../.github/workflows/cnn-sidecar-b-once.yml',
  import.meta.url),'utf8');
 const title='cnn-sidecar-onefile-b-install';
 assert.ok(wf.includes("github.event.issue.title == '"+title+"'"));
 assert.ok(wf.includes("contains(github.event.issue.labels.*.name, 'pc-writer-b-install')"));
 const cnn={...issue(title),body:JSON.stringify({
  schema:'ZGMINI_CNN_SIDECAR_ONEFILE_B_REQUEST_V1',
  requestId:'9ca75abe-81ab-49e8-a1c1-70bc12e54b52',
  approvalManifestPath:'approvals/sidecar-b/cnn1521-onefile-20261124.json',
  approvalManifestSha256:'b'.repeat(64),
  controlHead:'236e63ab16aec72b09a5333748c445d1226554f4'
 })};
 assert.deepEqual(inspectSharedIssueAdmission(cnn),
  {state:'UNMANAGED',code:'DEDICATED_EXACT_WORKFLOW_ROUTE'});
 let posted=0;
 const result=await reportRejectedAdmission({...event(title),issue:cnn},{
  listComments:async()=>[],postComment:async()=>{posted++;},
  getComment:async()=>null
 });
 assert.equal(result.state,'UNMANAGED');
 assert.equal(posted,0);
 const incorrect=inspectSharedIssueAdmission({...cnn,title:'not-cnn-approved'});
 assert.equal(incorrect.state,'REJECTED_AT_ADMISSION');
 assert.equal(incorrect.code,'EXACT_ISSUE_TITLE_REQUIRED');
 const missingLabel=inspectSharedIssueAdmission({...cnn,labels:[]});
 assert.equal(missingLabel.state,'UNMANAGED');
 assert.equal(inspectSharedIssueAdmission(base()).state,'ADMITTED_TO_WORKFLOW');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectSharedIssueAdmission,prepareSharedApprovalIssue}
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

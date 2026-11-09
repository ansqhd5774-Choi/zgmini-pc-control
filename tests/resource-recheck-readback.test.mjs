import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {prepareResourceWait} from '../shared-resource/lifecycle.mjs';
import {resourceWaitCommentBody} from '../agent-handoff/resource-wait-ledger.mjs';
import {reviewRecordedResourceReadbacks,readAndReviewResourceWait}
  from '../agent-handoff/resource-recheck-readback.mjs';

const repo='ansqhd5774-Choi/zgmini-pc-control';
const api='https://api.github.com/repos/'+repo;
const owner={login:'ansqhd5774-Choi'};
const bot={login:'github-actions[bot]'};
const source='a'.repeat(40);
const runtime='c'.repeat(40);
const uuid='9b4e50f9-8674-4894-9c5e-8ba454d6f79d';
const hash=value=>createHash('sha256').update(value).digest('hex');
const pair=(path,object)=>({path,ref:'main',content:JSON.stringify(object)});
const txt=(path,lines)=>({path,ref:'main',content:lines.map(([k,v])=>k+'='+v).join('\r\n')+'\r\n'});
const receipt=(number,body)=>({user:{...bot},issue_url:api+'/issues/'+number,body});
const run=(id,name,sha=source,observation=false)=>({id,name,event:'issues',
  status:'completed',actor:owner,head_repository:{full_name:repo},
  head_sha:sha,head_branch:'main',run_attempt:1,
  created_at:observation?'2026-11-09T20:15:00Z':'2026-11-09T20:00:00Z',
  updated_at:observation?'2026-11-09T20:20:00Z':'2026-11-09T20:10:00Z'});

function setup(writer=true,claimed=false){
  const origNumber=1401, origRun=42777777770, aIssueNumber=1402,aRun=42777777771,seat=3;
  const manifestBody=JSON.stringify({schema:'ZGMINI_PC_WRITER_SOURCE_B_APPROVAL_V1',
    status:'APPROVED_B',scope:'PC_WRITER_APPROVED_FILE_OVERLAY_ONLY',
    runCount:1,sourceRepository:'ansqhd5774-Choi/zgmini',
    candidateSourceSha:source});
  const origRequest=writer?{
    schema:'ZGMINI_PC_WRITER_SOURCE_B_REQUEST_V1',requestId:uuid,chatId:uuid,
    operation:'pc-writer-source-install',controlRepository:repo,
    approvalManifestPath:'approvals/writer-updates/test-fixture.json',
    approvalManifestSha256:hash(manifestBody)
  }:{
    schema:'ZGMINI_PC_JOB_V1',requestId:'pc-'+uuid,chatId:'chat-'+uuid,
    operation:'core-status',sourceRepository:'ansqhd5774-Choi/zgmini',
    sourceBranch:'main',sourceSha:source
  };
  const fingerprint=writer?origRequest.approvalManifestSha256:
    hash(JSON.stringify({operation:origRequest.operation,
      sourceRepository:origRequest.sourceRepository,
      sourceBranch:origRequest.sourceBranch,sourceSha:origRequest.sourceSha}));
  const origJsonPath=writer?
    'results/writer-b-source-install-'+uuid+'.json':
    'results/'+origRun+'-1-seat-'+seat+'.json';
  const origTxtPath=origJsonPath.replace(/\.json$/,'.txt');
  const wait=prepareResourceWait({
    resourceKey:writer?'writer-source':'pc-job-heavy-memory',
    origin:{repository:repo,issueNumber:origNumber,
      requestId:origRequest.requestId,chatId:origRequest.chatId,
      sourceSha:source,...(writer?{manifestSha256:fingerprint}:
        {approvalFingerprintSha256:fingerprint})},
    evidence:{runId:origRun,status:writer?
      (claimed?'WRITER_B_INSTALL_STOP_RESTORED':'WRITER_B_PREFLIGHT_STOP'):'BLOCKED',
      code:writer?'WRITER_B_CORE_ACTIVE_WINDOW_DEFERRED':'RESOURCE_WAIT_MEMORY',
      resultJsonPath:origJsonPath,resultTxtPath:origTxtPath,
      resultPairReadbackVerified:true},
    safePoint:writer?(claimed?'CLAIMED_ORIGINAL_VERIFIED':'UNCLAIMED_UNTOUCHED'):
      'REQUEST_CONSUMED_PREWORKER_UNTOUCHED',
    ...(claimed?{recovery:'ORIGINAL_VERIFIED'}:{}),
    releaseCondition:writer?'CORE_IDLE_WINDOW_VERIFIED':'HEAVY_MEMORY_AVAILABLE_VERIFIED'
  });
  const origReport=writer?{
    schema:'ZGMINI_PC_WRITER_SOURCE_B_RESULT_V1',requestId:uuid,
    runId:String(origRun),status:wait.evidence.status,code:wait.evidence.code,
    retry:'READ_ONLY_RECONCILE_NO_REEXECUTE',
    ...(claimed?{recovery:'ORIGINAL_VERIFIED'}:{})
  }:{
    schema:'ZGMINI_PC_RESULT_V1',controlRepository:repo,
    jobId:'run-'+origRun+'-1-seat-'+seat,
    requestId:origRequest.requestId,chatId:origRequest.chatId,
    sourceRepository:origRequest.sourceRepository,
    sourceBranch:origRequest.sourceBranch,requestedSourceSha:source,
    controlSourceSha:'d'.repeat(40),operation:origRequest.operation,
    status:wait.evidence.status,code:wait.evidence.code,seat,
    finishedAt:'2026-11-09T20:05:00Z',phase:'PREVALIDATION',
    mutationStarted:false,operationalWrites:0,providerCalls:0,
    d1Writes:0,sqliteOpened:false,resourceLeasesRetained:false
  };
  const origTxt=writer?
    [['REQUEST_ID',uuid],['STATUS',origReport.status],['CODE',origReport.code],
      ['RUN_ID',String(origRun)],['RETRY',origReport.retry],
      ...(claimed?[['RECOVERY','ORIGINAL_VERIFIED']]:[]) ] :
    [['jobId',origReport.jobId],['requestId',origReport.requestId],
      ['status',origReport.status],['code',origReport.code],
      ['phase','PREVALIDATION'],['mutationStarted','false'],
      ['operationalWrites','0'],['providerCalls','0'],['d1Writes','0'],
      ['sqliteOpened','false']];
  const origReceipt=writer?
    '<!-- zgmini-writer-b-install:'+uuid+' -->\n'+
      'Writer B evidence: **'+origReport.status+'** ('+origReport.code+')\n'+
      'DELIVERY: RESULT_PAIR_READBACK_VERIFIED\n'+
      'RESULT_CREATED: 2/2; RESULT_READBACK: 2/2\n'+
      'RUN_ID: '+origRun+'; RETRY: NO_REEXECUTE\n':
    '<!-- zgmini-pc-result:'+origRun+':1:'+seat+' -->\n'+
      '**'+origReport.status+' — '+origReport.code+'**\n';
  const origin={issue:{repository:repo,number:origNumber,user:owner,
      title:writer?'pc-writer-source-install':'pc-job',
      labels:[{name:writer?'pc-writer-b-install':'pc-job'}],
      body:JSON.stringify(origRequest)},
    run:run(origRun,writer?'ZGMINI Approved Writer B Source Overlay Once':'ZGMINI PC Job'),
    receipt:receipt(origNumber,origReceipt),
    json:pair(origJsonPath,origReport),txt:txt(origTxtPath,origTxt),
    ...(writer?{manifest:{path:origRequest.approvalManifestPath,ref:source,
      content:manifestBody}}:{})};
  const aRequest={schema:'ZGMINI_PC_JOB_V1',requestId:'pc-77777777-7777-4777-8777-777777777777',
    chatId:'chat-77777777-7777-4777-8777-777777777777',
    operation:'shared-resource-release-readonly',
    sourceRepository:'ansqhd5774-Choi/zgmini',
    sourceBranch:'main',sourceSha:source};
  const aJsonPath='results/'+aRun+'-1-seat-'+seat+'.json';
  const aDetail={status:'PASS',code:'SHARED_RESOURCE_READONLY_SNAPSHOT',
    sampleCount:2,sourceStable:true,taskXmlStable:true,
    observedConfigSourceSha:runtime,releaseVerified:false,
    ownerReplanAuthorized:false,resources:{[wait.resourceKey]:{
      state:'CANDIDATE_CLEAR_NOT_AUTHORIZED'}}};
  const aReport={schema:'ZGMINI_PC_RESULT_V1',controlRepository:repo,
    jobId:'run-'+aRun+'-1-seat-'+seat,
    requestId:aRequest.requestId,chatId:aRequest.chatId,
    sourceRepository:aRequest.sourceRepository,sourceBranch:aRequest.sourceBranch,
    requestedSourceSha:aRequest.sourceSha,controlSourceSha:'d'.repeat(40),
    operation:aRequest.operation,seat,status:'PASS',
    startedAt:'2026-11-09T20:16:00Z',finishedAt:'2026-11-09T20:17:00Z',
    code:'SHARED_RESOURCE_READONLY_SNAPSHOT',result:aDetail};
  const observation={issue:{repository:repo,number:aIssueNumber,title:'pc-job',
      user:owner,labels:[{name:'pc-job'}],body:JSON.stringify(aRequest)},
    run:run(aRun,'ZGMINI PC Job',source,true),
    receipt:receipt(aIssueNumber,
      '<!-- zgmini-pc-result:'+aRun+':1:'+seat+' -->\n'+
      '**PASS — SHARED_RESOURCE_READONLY_SNAPSHOT**\n'),
    json:pair(aJsonPath,aReport),
    txt:txt(aJsonPath.replace(/\.json$/,'.txt'),
      [['jobId',aReport.jobId],['requestId',aReport.requestId],
        ['status','PASS'],['code',aReport.code]])};
  const currentApproval={currentReadbackVerified:true,
    controlSourceSha:source,runtimeConfigSourceSha:runtime,
    approvedRuntimeConfigSourceSha:runtime,
    ...(writer?{manifestSha256:fingerprint}:{approvalFingerprintSha256:fingerprint})};
  const waitComment={...receipt(68,resourceWaitCommentBody(wait)),id:99001};
  return {wait,waitComment,origin,observation,currentApproval,aIssueNumber,origNumber};
}

test('Writer B origin and nested Windows A candidate are read back without release',()=>{
  const inputs=setup();
  const result=reviewRecordedResourceReadbacks(inputs);
  assert.deepEqual(result.missing,[]);
  assert.equal(result.state,'RECHECK_EVIDENCE_PENDING');
  assert.equal(result.ownerReplanAuthorized,false);
  assert.equal(result.releaseVerified,false);
  assert.equal(result.automaticPcRetries,0);
});

test('PC job uses feature SHA/fingerprint instead of control workflow SHA/manifest',()=>{
  const inputs=setup(false);
  const result=reviewRecordedResourceReadbacks(inputs);
  assert.deepEqual(result.missing,[]);
  assert.equal(result.historicalApprovalChanged,false);
  inputs.currentApproval.approvalFingerprintSha256='f'.repeat(64);
  const drift=reviewRecordedResourceReadbacks(inputs);
  assert.equal(drift.state,'SOURCE_DRIFT_REVIEW');
  assert.equal(drift.historicalManifestChanged,false);
  assert.equal(drift.historicalApprovalChanged,true);
});

test('cross-resource A, mismatching TXT and spoofed receipt stay pending',()=>{
  const inputs=setup();
  delete inputs.observation.json;
  assert.deepEqual(reviewRecordedResourceReadbacks(inputs).missing,
    ['WINDOWS_READONLY_RELEASE_CANDIDATE']);
  const swapped=setup();
  swapped.observation.json.content=JSON.stringify({
    ...JSON.parse(swapped.observation.json.content),
    result:{...JSON.parse(swapped.observation.json.content).result,
      resources:{'wrong-resource':{state:'CANDIDATE_CLEAR_NOT_AUTHORIZED'}}}});
  assert.ok(reviewRecordedResourceReadbacks(swapped).missing.includes(
    'WINDOWS_READONLY_RELEASE_CANDIDATE'));
  const forged=setup();
  forged.origin.txt.content=forged.origin.txt.content.replace(
    'WRITER_B_PREFLIGHT_STOP','WRITER_B_INSTALLED_VERIFIED');
  forged.observation.receipt.user.login='attacker';
  assert.deepEqual(reviewRecordedResourceReadbacks(forged).missing,[
    'ORIGINAL_ISSUE_RUN_RESULT_PAIR','WINDOWS_READONLY_RELEASE_CANDIDATE']);
});

test('source mismatches, approval readback mismatch, and missing A fail closed',()=>{
  const inputs=setup(false);
  inputs.origin.json.content=JSON.stringify({
    ...JSON.parse(inputs.origin.json.content),requestedSourceSha:'e'.repeat(40)});
  inputs.currentApproval.approvedRuntimeConfigSourceSha='e'.repeat(40);
  assert.deepEqual(reviewRecordedResourceReadbacks(inputs).missing,[
    'ORIGINAL_ISSUE_RUN_RESULT_PAIR','CURRENT_SOURCE_AND_APPROVAL_READBACK']);
  const noObservation=setup();
  noObservation.observation=null;
  assert.deepEqual(reviewRecordedResourceReadbacks(noObservation).missing,[
    'WINDOWS_READONLY_RELEASE_CANDIDATE']);
});

test('old A snapshot and altered Writer manifest cannot be release candidates',()=>{
  const old=setup();
  old.observation.run.created_at='2026-11-09T19:00:00Z';
  old.observation.run.updated_at='2026-11-09T19:05:00Z';
  assert.ok(reviewRecordedResourceReadbacks(old).missing.includes(
    'WINDOWS_READONLY_RELEASE_CANDIDATE'));
  const changed=setup();
  changed.origin.manifest.content=changed.origin.manifest.content+' ';
  assert.ok(reviewRecordedResourceReadbacks(changed).missing.includes(
    'ORIGINAL_ISSUE_RUN_RESULT_PAIR'));
});

test('original resource wait must preserve exact no-write and postclaim recovery proof',()=>{
  const pc=setup(false);
  pc.origin.json.content=JSON.stringify({
    ...JSON.parse(pc.origin.json.content),mutationStarted:true});
  assert.ok(reviewRecordedResourceReadbacks(pc).missing.includes(
    'ORIGINAL_ISSUE_RUN_RESULT_PAIR'));
  const restored=setup(true,true);
  assert.deepEqual(reviewRecordedResourceReadbacks(restored).missing,[]);
  const forged=setup(true,true);
  forged.origin.json.content=JSON.stringify({
    ...JSON.parse(forged.origin.json.content),recovery:'READ_ONLY_RECONCILE_LOCK_AND_SOURCE'});
  assert.ok(reviewRecordedResourceReadbacks(forged).missing.includes(
    'ORIGINAL_ISSUE_RUN_RESULT_PAIR'));
});

test('A request/source identity drift remains an unverified candidate',()=>{
  const changed=setup();
  changed.observation.json.content=JSON.stringify({
    ...JSON.parse(changed.observation.json.content),chatId:'another-chat'});
  assert.ok(reviewRecordedResourceReadbacks(changed).missing.includes(
    'WINDOWS_READONLY_RELEASE_CANDIDATE'));
});

test('bounded read-only injected GET orchestration feeds the same evaluator',async()=>{
  const fixture=setup();
  const lookups={
    readComment:async id=>id===99001?fixture.waitComment:null,
    readIssue:async number=>number===fixture.origNumber?fixture.origin.issue:
      number===fixture.aIssueNumber?fixture.observation.issue:null,
    readRun:async id=>id===fixture.origin.run.id?fixture.origin.run:
      id===fixture.observation.run.id?fixture.observation.run:null,
    readIssueComments:async number=>({complete:true,comments:[
      number===fixture.origNumber?fixture.origin.receipt:fixture.observation.receipt]}),
    readFile:async path=>[fixture.origin.json,fixture.origin.txt,fixture.origin.manifest,
      fixture.observation.json,fixture.observation.txt].find(x=>x.path===path)??null
  };
  const result=await readAndReviewResourceWait({waitCommentId:99001,
    observationIssueNumber:fixture.aIssueNumber,io:lookups,
    currentApproval:fixture.currentApproval});
  assert.deepEqual(result.missing,[]);
  assert.equal(result.ownerReplanAuthorized,false);
  assert.equal(result.state,'RECHECK_EVIDENCE_PENDING');
  lookups.readIssueComments=async()=>({complete:false,comments:[]});
  await assert.rejects(()=>readAndReviewResourceWait({waitCommentId:99001,
    io:lookups}),/ORIGIN_COMMENTS_INCOMPLETE/);
});

test('duplicate original receipts fail closed and cannot be chosen arbitrarily',async()=>{
  const fixture=setup();
  const io={
    readComment:async()=>fixture.waitComment,
    readIssue:async()=>fixture.origin.issue,
    readRun:async()=>fixture.origin.run,
    readIssueComments:async()=>({complete:true,
      comments:[fixture.origin.receipt,fixture.origin.receipt]}),
    readFile:async()=>null
  };
  await assert.rejects(()=>readAndReviewResourceWait({
    waitCommentId:99001,io}),/ORIGIN_RECEIPT_DUPLICATE/);
});

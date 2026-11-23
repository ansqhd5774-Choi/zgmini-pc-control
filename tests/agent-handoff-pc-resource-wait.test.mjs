import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {preparePcSharedResourceWait}
  from '../agent-handoff/pc-result-to-incident.mjs';
import {processCompletedPcJob} from '../agent-handoff/pc-failure-producer.mjs';

const repo='ansqhd5774-Choi/zgmini-pc-control', owner='ansqhd5774-Choi';
const runId=42423158559,seat=4,attempt=1;
const request=()=>({schema:'ZGMINI_PC_JOB_V1',
  requestId:'pc-abcd1234-1234',chatId:'chat-1234',
  operation:'core-status',sourceRepository:'ansqhd5774-Choi/zgmini',
  sourceBranch:'main',sourceSha:'a'.repeat(40)});
const issue=()=>({repository:repo,number:1009,user:{login:owner},
  labels:[{name:'pc-job'}],body:JSON.stringify(request())});
const pathJson=`results/${runId}-1-seat-4.json`;
const blocked=(code='RESOURCE_WAIT_MEMORY')=>({
  schema:'ZGMINI_PC_RESULT_V1',jobId:`run-${runId}-1-seat-4`,
  seat,requestId:request().requestId,chatId:request().chatId,
  controlRepository:repo,controlSourceSha:'b'.repeat(40),
  sourceRepository:request().sourceRepository,sourceBranch:'main',
  requestedSourceSha:request().sourceSha,operation:'core-status',
  status:'BLOCKED',code,lastPass:'MEMORY_ADMISSION_SAMPLED',
  firstFail:'MEMORY_ADMISSION',finishedAt:'2026-11-08T23:00:00Z',
  phase:'PREVALIDATION',failureOperation:'MEMORY_ADMISSION',
  mutationStarted:false,operationalWrites:0,providerCalls:0,d1Writes:0,
  sqliteOpened:false
});
const textReport=r=>Object.entries(r).map(([k,v])=>`${k}=${v}`).join('\r\n')+'\r\n';
const ev=()=>({action:'completed',repository:{full_name:repo,private:true},
  workflow_run:{name:'ZGMINI PC Job',event:'issues',actor:{login:owner},
    head_repository:{full_name:repo},id:runId,run_attempt:attempt,
    created_at:'2026-11-08T22:00:00Z'}});
const bot='github-actions[bot]';
const receipt=()=>({user:{login:bot},
  body:`<!-- zgmini-pc-result:${runId}:1:4 -->\nreadback verified`,
  issue_url:`https://api.github.com/repos/${repo}/issues/1009`});

test('archived #2307 published JSON/TXT classify as the same verified memory wait',()=>{
  // These are the actual published, immutable result pair of original PC Job
  // 44493517681, not an invented BLOCKED fixture or a simulated PC execution.
  const base=new URL('../results/',import.meta.url);
  const report=JSON.parse(readFileSync(new URL('44493517681-1-seat-2.json',base),'utf8'));
  const resultTxt=readFileSync(new URL('44493517681-1-seat-2.txt',base),'utf8');
  const originIssue={...issue(),number:2307,body:JSON.stringify({
    schema:'ZGMINI_PC_JOB_V1',
    requestId:'pc-82e8d098-90c8-4524-8514-c5f5343444d3',
    chatId:'chat-proc-w04-recert-20261119',
    operation:'employment-r6-candidate-stage-readonly',
    sourceRepository:'ansqhd5774-Choi/zgmini',
    sourceBranch:'fix/w04-pit0405-raw-attestation-breakdown-20261117',
    sourceSha:'0193056bdb47bcf6c911f17623b6c302c8199c4c'
  })};
  const resultPath='results/44493517681-1-seat-2.json';
  const prepared=preparePcSharedResourceWait({originIssue,report,resultPath,resultTxt});
  assert.equal(prepared.state,'WAITING_SHARED_RESOURCE');
  assert.equal(prepared.wait.waitId,'resource-wait-25d1ea46e9015156f1a51993');
  assert.equal(prepared.wait.safePoint,'REQUEST_CONSUMED_WORKER_PREOP_UNTOUCHED');
  assert.equal(prepared.wait.evidence.runId,44493517681);
  assert.equal(prepared.wait.automaticPcRetries,0);
  assert.equal(report.result.candidateExecuted,false);
  assert.equal(report.actualExecutionSha,null);
  assert.equal(report.protectedBeforeSha256,report.protectedAfterSha256);
  assert.equal(report.operationalWrites,0);
  const corrupted=resultTxt.replace('actualExecutionSha=null','actualExecutionSha=forged');
  assert.equal(preparePcSharedResourceWait({originIssue,report,resultPath,
    resultTxt:corrupted}).state,'WAIT_PROOF_UNVERIFIED');
});

test('PC resource wait reuses generic ledger contract with pc- requestId',()=>{
  const r=blocked();
  const outcome=preparePcSharedResourceWait({originIssue:issue(),report:r,
    resultPath:pathJson,resultTxt:textReport(r)});
  assert.equal(outcome.state,'WAITING_SHARED_RESOURCE');
  assert.equal(outcome.wait.resourceKey,'pc-job-heavy-memory');
  assert.equal(outcome.wait.origin.requestId,'pc-abcd1234-1234');
  assert.equal(outcome.wait.safePoint,'REQUEST_CONSUMED_PREWORKER_UNTOUCHED');
  assert.equal(outcome.wait.resume,'OWNER_REPLAN_NEW_AUTHORIZED_REQUEST_ONLY');
  assert.match(outcome.wait.origin.approvalFingerprintSha256,/^[a-f0-9]{64}$/);
  assert.equal(outcome.wait.automaticPcRetries,0);
});

test('busy lease before ledger still consumes one-shot Issue attempt',()=>{
  const cases=[
    ['REQUEST_LEASE','pc-job-request-lease'],
    ['SEAT_LEASE',`pc-job-seat-${seat}`],
    ['RESOURCE_LEASE','pc-job-heavy-resource'],
  ];
  for(const [failureOperation,resourceKey] of cases){
    const r=blocked('LEASE_BUSY');r.failureOperation=failureOperation;
    const outcome=preparePcSharedResourceWait({originIssue:issue(),report:r,
      resultPath:pathJson,resultTxt:textReport(r)});
    assert.equal(outcome.state,'WAITING_SHARED_RESOURCE');
    assert.equal(outcome.wait.resourceKey,resourceKey);
    assert.equal(outcome.wait.safePoint,'REQUEST_CONSUMED_PREWORKER_UNTOUCHED');
    assert.equal(outcome.wait.automaticPcRetries,0);
    assert.equal(outcome.wait.resume,'OWNER_REPLAN_NEW_AUTHORIZED_REQUEST_ONLY');
  }
});

test('blocked-looking result missing no-mutation proof cannot enter wait ledger',()=>{
  for(const modify of [
    r=>{r.mutationStarted=true;},
    r=>{r.phase='POSTCHECK';},
    r=>{r.operationalWrites=1;},
    r=>{r.resourceLeasesRetained=true;},
    r=>{r.failureOperation='UNVERIFIED';r.code='LEASE_BUSY';},
  ]){
    const r=blocked();modify(r);
    const outcome=preparePcSharedResourceWait({originIssue:issue(),report:r,
      resultPath:pathJson,resultTxt:textReport(r)});
    assert.equal(outcome.state,'WAIT_PROOF_UNVERIFIED');
  }
  const r=blocked();
  assert.equal(preparePcSharedResourceWait({originIssue:issue(),report:r,
    resultPath:pathJson,resultTxt:'status=BLOCKED\n'}).state,'WAIT_PROOF_UNVERIFIED');
});

test('PC verified memory contention records one #68 wait, without repair or retry',async()=>{
  const r=blocked(),queue=[];let posts=0,repairs=0;
  const io={
    readReport:async p=>p===pathJson?r:null,
    readReportText:async p=>p===pathJson.replace('.json','.txt')?textReport(r):null,
    readComments:async()=>[receipt()],
    readIssue:async n=>n===1009?issue():null,
    listHandoffs:async()=>({repository:repo,complete:true,issues:[]}),
    createHandoff:async()=>{repairs++;throw Error('UNEXPECTED_REPAIR');},
    listResourceWaitComments:async()=>queue,
    createResourceWaitComment:async body=>{
      posts++;queue.push({id:12345,body,user:{login:bot},
        issue_url:`https://api.github.com/repos/${repo}/issues/68`});
      return {id:12345};
    },
    readResourceWaitComment:async id=>queue.find(x=>x.id===id),
  };
  const first=await processCompletedPcJob(ev(),io);
  assert.equal(first.state,'WAITING_SHARED_RESOURCE_RECORDED');
  assert.equal(first.waitsRecorded,1);
  assert.equal(first.confirmedFailures,0);
  assert.equal(first.newIssues,0);
  assert.equal(first.automaticPcRetries,0);
  assert.equal(posts,1);
  const again=await processCompletedPcJob(ev(),io);
  assert.equal(again.state,'WAITING_SHARED_RESOURCE_RECORDED');
  assert.equal(again.waitsReused,1);
  assert.equal(posts,1);
  assert.equal(repairs,0);
});

test('ambiguous POST readback is reconciled, not reported as existing reuse',async()=>{
  const r=blocked(),queue=[];let posts=0;
  const io={
    readReport:async p=>p===pathJson?r:null,
    readReportText:async p=>p===pathJson.replace('.json','.txt')?textReport(r):null,
    readComments:async()=>[receipt()],
    readIssue:async n=>n===1009?issue():null,
    listHandoffs:async()=>({repository:repo,complete:true,issues:[]}),
    createHandoff:async()=>{throw Error('UNEXPECTED_REPAIR');},
    listResourceWaitComments:async()=>queue,
    createResourceWaitComment:async body=>{
      posts++;
      queue.push({id:12345,body,user:{login:bot},
        issue_url:`https://api.github.com/repos/${repo}/issues/68`});
      throw Error('POST_RESPONSE_LOST');
    },
    readResourceWaitComment:async id=>queue.find(x=>x.id===id),
  };
  const first=await processCompletedPcJob(ev(),io);
  assert.equal(first.state,'WAITING_SHARED_RESOURCE_RECORDED');
  assert.equal(first.waitsRecorded,0);
  assert.equal(first.waitsReused,0);
  assert.equal(first.waitsPostReconciled,1);
  assert.equal(posts,1);
  const second=await processCompletedPcJob(ev(),io);
  assert.equal(second.waitsReused,1);
  assert.equal(second.waitsPostReconciled,0);
  assert.equal(posts,1);
});

test('PC text evidence absent remains pending, never posts a wait',async()=>{
  const r=blocked();let posts=0;
  const io={
    readReport:async p=>p===pathJson?r:null,readReportText:async()=>null,
    readComments:async()=>[receipt()],readIssue:async()=>issue(),
    listHandoffs:async()=>({repository:repo,complete:true,issues:[]}),
    createHandoff:async()=>{},listResourceWaitComments:async()=>[],
    createResourceWaitComment:async()=>{posts++;},
    readResourceWaitComment:async()=>null};
  const result=await processCompletedPcJob(ev(),io);
  assert.equal(result.state,'PARTIAL_WAIT_EVIDENCE_PENDING');
  assert.equal(result.waitProofPending,1);
  assert.equal(posts,0);
});

const verifiedWorkerWait=(operation='employment-r6-wal-memory-preflight')=>{
  const report=blocked();
  report.operation=operation;
  delete report.phase;
  delete report.mutationStarted;
  report.lastPass='ALLOWLISTED_WORKER_STARTED';
  report.firstFail='ALLOWLISTED_OPERATION';
  report.exitCode=0;
  report.actualExecutionSha=report.controlSourceSha;
  report.protectedStateUnchanged=true;
  report.protectedBeforeSha256='c'.repeat(64);
  report.protectedAfterSha256=report.protectedBeforeSha256;
  report.result={status:'BLOCKED',code:'RESOURCE_WAIT_MEMORY',
    candidateExecuted:false,providerCalls:0,sqliteOpened:false,
    operationalWrites:0,d1Writes:0};
  const origin=issue();
  origin.body=JSON.stringify({...request(),operation});
  const txt=Object.entries(report)
    .filter(([k])=>k!=='result')
    .map(([k,v])=>`${k}=${v}`).join('\r\n')+'\r\n';
  return {origin,report,txt};
};

test('worker-level memory wait requires confirmed protected state and candidate not executed',()=>{
  for(const operation of ['employment-r6-wal-memory-preflight',
    'theme-nine-r32-raw-coverage-readonly']){
    const {origin,report,txt}=verifiedWorkerWait(operation);
    const r=preparePcSharedResourceWait({originIssue:origin,report,
      resultPath:pathJson,resultTxt:txt});
    assert.equal(r.state,'WAITING_SHARED_RESOURCE');
    assert.equal(r.wait.safePoint,'REQUEST_CONSUMED_WORKER_PREOP_UNTOUCHED');
    assert.equal(r.wait.automaticPcRetries,0);
    assert.equal(r.wait.resume,'OWNER_REPLAN_NEW_AUTHORIZED_REQUEST_ONLY');
  }
});

test('R6 candidate second-stage memory guard is a verified no-execution resource wait',()=>{
  const {origin,report}=verifiedWorkerWait('employment-r6-candidate-stage-readonly');
  // Historical #2307: memory admission passed but the per-operation guard
  // observed a later dip before launching the candidate child.
  report.actualExecutionSha=null;
  delete report.result.operationalWrites; // Exact #2307 inner-result shape.
  report.memoryAdmission={admitted:true,minimumFreeMiB:1536,firstFreeMiB:1291,
    freeMiB:1547,minObservedMiB:976,samples:15};
  const txt=textReport(report);
  const out=preparePcSharedResourceWait({originIssue:origin,report,
    resultPath:pathJson,resultTxt:txt});
  assert.equal(out.state,'WAITING_SHARED_RESOURCE');
  assert.equal(out.wait.safePoint,'REQUEST_CONSUMED_WORKER_PREOP_UNTOUCHED');
  assert.equal(out.wait.releaseCondition,'HEAVY_MEMORY_AVAILABLE_VERIFIED');
  assert.equal(out.wait.automaticPcRetries,0);
});

test('R6 candidate memory guard must prove literal null SHA and intact no-effect evidence',()=>{
  const changes=[
    r=>{delete r.actualExecutionSha;},
    r=>{r.actualExecutionSha='e'.repeat(40);},
    r=>{r.result.candidateExecuted=true;},
    r=>{r.result.operationalWrites=1;},
    r=>{r.sqliteOpened=true;},
    r=>{r.protectedStateUnchanged=false;},
    r=>{r.protectedAfterSha256='d'.repeat(64);},
    r=>{r.exitCode=1;},
    r=>{r.phase='PREVALIDATION';},
    r=>{r.result.code='OTHER_BLOCKER';}
  ];
  for(const change of changes){
    const {origin,report}=verifiedWorkerWait('employment-r6-candidate-stage-readonly');
    report.actualExecutionSha=null;
    delete report.result.operationalWrites;
    change(report);
    const txt=textReport(report);
    assert.equal(preparePcSharedResourceWait({originIssue:origin,report,
      resultPath:pathJson,resultTxt:txt}).state,'WAIT_PROOF_UNVERIFIED');
  }
  const {origin,report}=verifiedWorkerWait('employment-r6-candidate-stage-readonly');
  report.actualExecutionSha=null;
  delete report.result.operationalWrites;
  const txt=textReport(report).replace('actualExecutionSha=null','actualExecutionSha=forged');
  assert.equal(preparePcSharedResourceWait({originIssue:origin,report,
    resultPath:pathJson,resultTxt:txt}).state,'WAIT_PROOF_UNVERIFIED');
});

test('worker memory proof fails closed for unsafe operation, mutation or text drift',()=>{
  const changes=[
    r=>{r.result.candidateExecuted=true;},
    r=>{r.result.operationalWrites=1;},
    r=>{r.result.sqliteOpened=true;},
    r=>{r.result.providerCalls=1;},
    r=>{r.protectedStateUnchanged=false;},
    r=>{r.protectedAfterSha256='d'.repeat(64);},
    r=>{r.actualExecutionSha='e'.repeat(40);},
    r=>{r.exitCode=1;},
    r=>{r.resourceLeasesRetained=true;},
    r=>{r.phase='PREVALIDATION';},
    r=>{r.result.code='OTHER_BLOCKER';}
  ];
  for(const change of changes){
    const {origin,report,txt}=verifiedWorkerWait();
    change(report);
    assert.equal(preparePcSharedResourceWait({originIssue:origin,report,
      resultPath:pathJson,resultTxt:txt}).state,'WAIT_PROOF_UNVERIFIED');
  }
  const {origin,report,txt}=verifiedWorkerWait();
  assert.equal(preparePcSharedResourceWait({originIssue:origin,report,
    resultPath:pathJson,resultTxt:txt.replace('protectedStateUnchanged=true',
      'protectedStateUnchanged=false')}).state,'WAIT_PROOF_UNVERIFIED');
  const invalid=verifiedWorkerWait('core-status');
  assert.equal(preparePcSharedResourceWait({originIssue:invalid.origin,
    report:invalid.report,resultPath:pathJson,resultTxt:invalid.txt}).state,
    'WAIT_PROOF_UNVERIFIED');
});

test('verified readonly worker wait records one central ledger receipt, never a repair',async()=>{
  const {origin,report,txt}=verifiedWorkerWait();
  const queue=[];let posts=0,repairs=0;
  const io={
    readReport:async p=>p===pathJson?report:null,
    readReportText:async p=>p===pathJson.replace('.json','.txt')?txt:null,
    readComments:async()=>[receipt()],
    readIssue:async n=>n===1009?origin:null,
    listHandoffs:async()=>({repository:repo,complete:true,issues:[]}),
    createHandoff:async()=>{repairs++;throw Error('UNEXPECTED_REPAIR');},
    listResourceWaitComments:async()=>queue,
    createResourceWaitComment:async body=>{
      posts++;queue.push({id:12345,body,user:{login:bot},
        issue_url:`https://api.github.com/repos/${repo}/issues/68`});
      return {id:12345};
    },
    readResourceWaitComment:async id=>queue.find(x=>x.id===id)
  };
  const result=await processCompletedPcJob(ev(),io);
  assert.equal(result.state,'WAITING_SHARED_RESOURCE_RECORDED');
  assert.equal(result.waitsRecorded,1);
  assert.equal(result.automaticPcRetries,0);
  assert.equal(repairs,0);
  assert.equal(posts,1);
  const repeated=await processCompletedPcJob(ev(),io);
  assert.equal(repeated.waitsReused,1);
  assert.equal(posts,1);
});

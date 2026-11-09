import test from 'node:test';
import assert from 'node:assert/strict';
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

test('PC resource wait reuses generic ledger contract with pc- requestId',()=>{
  const r=blocked();
  const outcome=preparePcSharedResourceWait({originIssue:issue(),report:r,
    resultPath:pathJson,resultTxt:textReport(r)});
  assert.equal(outcome.state,'WAITING_SHARED_RESOURCE');
  assert.equal(outcome.wait.resourceKey,'pc-job-heavy-memory');
  assert.equal(outcome.wait.origin.requestId,'pc-abcd1234-1234');
  assert.match(outcome.wait.origin.approvalFingerprintSha256,/^[a-f0-9]{64}$/);
  assert.equal(outcome.wait.automaticPcRetries,0);
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
  assert.equal(first.waitsRecorded,1);
  assert.equal(first.confirmedFailures,0);
  assert.equal(first.newIssues,0);
  assert.equal(first.automaticPcRetries,0);
  assert.equal(posts,1);
  const again=await processCompletedPcJob(ev(),io);
  assert.equal(again.waitsReused,1);
  assert.equal(posts,1);
  assert.equal(repairs,0);
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

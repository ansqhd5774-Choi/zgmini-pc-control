import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {verifyExistingPcRunnerTransport} from './runner-result-provenance.mjs';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const blob=bytes=>createHash('sha1').update(Buffer.concat([
 Buffer.from(`blob ${bytes.length}\0`),bytes])).digest('hex');
const REPOSITORY='ansqhd5774-Choi/zgmini-pc-control';
const workflow=Buffer.from('name: ZGMINI PC Job\non: issues\n');
const requestId='123e4567-e89b-42d3-a456-426614174000';
const chatId='123e4567-e89b-42d3-a456-426614174001';
const requestedSourceSha='a'.repeat(40);
const controlSourceSha='b'.repeat(40);
const workflowHeadSha='c'.repeat(40);
const resultsCommitSha='d'.repeat(40);
const expected={repository:REPOSITORY,runId:'791231',attempt:1,seat:3,
 issueNumber:222,requestId,chatId,workflowHeadSha,
 approvedWorkflowSha256:sha(workflow),resultsCommitSha,
 approvedControllerSourceSha:controlSourceSha,
 requestedSourceSha,operation:'theme-common-tests'};
const report={schema:'ZGMINI_PC_RESULT_V1',
 jobId:'run-791231-1-seat-3',requestId,chatId,
 seat:3,controlRepository:REPOSITORY,controlSourceSha,
 requestedSourceSha,operation:'theme-common-tests',
 status:'PASS',code:'PASS',result:{tests:44}};
const json=Buffer.from(JSON.stringify(report,null,2)+'\n');
const txt=Buffer.from(Object.entries(report).filter(([k])=>
 !['result','prior'].includes(k)).map(([k,v])=>
 `${k}=${typeof v==='object'?JSON.stringify(v):v}`).join('\r\n')+'\r\n');
const fixedSteps=[
 {name:'Execute fixed host allowlist entry',conclusion:'success'},
 {name:'Upload sanitized TXT JSON and issue result',conclusion:'success'},
];

function fixture({runPatch={},jobPatch={},reportBytes=json,txtBytes=txt,
 workflowBytes=workflow,issuePatch={}}={}){
 const run={id:791231,run_attempt:1,repository:{full_name:REPOSITORY},
  path:'.github/workflows/pc-job.yml',name:'ZGMINI PC Job',
  event:'issues',head_branch:'main',head_sha:workflowHeadSha,
  actor:{login:'ansqhd5774-Choi'},status:'completed',
  conclusion:'success',...runPatch};
 const job={name:'approved-pc-job',status:'completed',
  conclusion:'success',runner_name:'zgmini-pc-03',
  labels:['self-hosted','Windows','X64','zgmini-pc-control'],
  steps:fixedSteps,...jobPatch};
 const issue={number:222,user:{login:'ansqhd5774-Choi'},
  labels:[{name:'pc-job'}],...issuePatch};
 const bytesByPath={
  '.github/workflows/pc-job.yml':workflowBytes,
  'results/791231-1-seat-3.json':reportBytes,
  'results/791231-1-seat-3.txt':txtBytes,
 };
 const github={
  async getWorkflowRun(){return run;},
  async getWorkflowRunJobs(){return {jobs:[job]};},
  async getIssue(){return issue;},
  async readFileAtCommit({commitSha,path}){
   const bytes=bytesByPath[path];
   return {path,commitSha,gitBlobOid:blob(bytes),bytes};
  },
 };
 return {github,expected:{...expected}};
}
const rejects=async(f,code)=>assert.rejects(f,e=>e.code===code);

test('real fixed-runner-shaped GitHub result pair proves transport, NEVER runtime',async()=>{
 const r=await verifyExistingPcRunnerTransport(fixture());
 assert.equal(r.status,'GITHUB_TRANSPORT_VERIFIED_NO_RUNTIME_PROOF');
 assert.equal(r.trustedRunnerTransportVerified,true);
 assert.equal(r.trustedRuntimeFixtureExecutionVerified,false);
 assert.equal(r.trustedCrossVersionStateCompatibilityVerified,false);
 assert.equal(r.activationAllowed,false);
 assert.equal(r.resultBytesSha256,sha(json));
});
test('attacker-controlled modified workflow rejected despite successful run',async()=>{
 const f=fixture({workflowBytes:Buffer.from('name: OTHER\non: workflow_dispatch\n')});
 await rejects(()=>verifyExistingPcRunnerTransport(f),'B_RUNNER_WORKFLOW_PIN');
});
test('wrong run attempt and runner seat rejected',async()=>{
 const a=fixture({runPatch:{run_attempt:2}});
 await rejects(()=>verifyExistingPcRunnerTransport(a),'B_RUNNER_WORKFLOW_IDENTITY');
 const b=fixture({jobPatch:{runner_name:'zgmini-pc-05'}});
 await rejects(()=>verifyExistingPcRunnerTransport(b),'B_RUNNER_JOB_EXECUTION');
});
test('workflow success is not enough if fixed executable step fails',async()=>{
 const f=fixture({jobPatch:{steps:[{...fixedSteps[0],conclusion:'failure'},fixedSteps[1]]}});
 await rejects(()=>verifyExistingPcRunnerTransport(f),'B_RUNNER_JOB_EXECUTION');
});
test('run proof cannot borrow a different request or approved source',async()=>{
 const f=fixture();f.expected.requestedSourceSha='f'.repeat(40);
 await rejects(()=>verifyExistingPcRunnerTransport(f),'B_RUNNER_REPORT_IDENTITY');
 const g=fixture();g.expected.requestId='123e4567-e89b-42d3-a456-426614174099';
 await rejects(()=>verifyExistingPcRunnerTransport(g),'B_RUNNER_REPORT_IDENTITY');
});
test('tampered TXT or immutable Git blob OID rejected',async()=>{
 const a=fixture({txtBytes:Buffer.from('status=PASS\r\n')});
 await rejects(()=>verifyExistingPcRunnerTransport(a),'B_RUNNER_REPORT_PAIR_MISMATCH');
 const b=fixture();b.github.readFileAtCommit=async({path,commitSha})=>({
  path,commitSha,gitBlobOid:'f'.repeat(40),bytes:workflow});
 await rejects(()=>verifyExistingPcRunnerTransport(b),'B_RUNNER_IMMUTABLE_FILE_READBACK');
});
test('SUMMARY_ONLY cannot become runtime proof',async()=>{
 const summary={...report,reportTransfer:{status:'SUMMARY_ONLY',
  originalStored:'PC_REQUEST_LEDGER',fullInventoryTransferVerified:false}};
 const bytes=Buffer.from(JSON.stringify(summary)+'\n');
 const txtBytes=Buffer.from(Object.entries(summary).filter(([k])=>
  !['result','prior'].includes(k)).map(([k,v])=>
  `${k}=${typeof v==='object'?JSON.stringify(v):v}`).join('\r\n')+'\r\n');
 const r=await verifyExistingPcRunnerTransport(fixture({reportBytes:bytes,txtBytes}));
 assert.equal(r.status,'TRANSPORT_SUMMARY_ONLY');
 assert.equal(r.activationAllowed,false);
});
test('mutable Issue label removal is not an extra false gate',async()=>{
 const a=fixture({issuePatch:{labels:[{name:'other'}]}});
 const r=await verifyExistingPcRunnerTransport(a);
 assert.equal(r.trustedRunnerTransportVerified,true);
 assert.equal(r.activationAllowed,false);
});
test('wrong issue owner or wrong run actor cannot be trusted',async()=>{
 const a=fixture({issuePatch:{user:{login:'someone-else'}}});
 await rejects(()=>verifyExistingPcRunnerTransport(a),'B_RUNNER_ISSUE_IDENTITY');
 const b=fixture({runPatch:{actor:{login:'someone-else'}}});
 await rejects(()=>verifyExistingPcRunnerTransport(b),'B_RUNNER_WORKFLOW_IDENTITY');
});

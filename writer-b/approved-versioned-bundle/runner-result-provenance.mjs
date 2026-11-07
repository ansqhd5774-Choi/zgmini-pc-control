/**
 * SOURCE-ONLY read-only adapter for the EXISTING fixed PC A Runner transport.
 *
 * It verifies the GitHub run, Windows job and immutable committed results pair
 * through a trusted GitHub read API. A successful Actions job, exact blob SHA
 * and a PC report are transport evidence, NOT evidence that old/new isolated
 * runtime compatibility fixtures executed. This module NEVER authorizes B.
 *
 * No dynamic execution, provider calls, authentication mutation or PC writes.
 */
import {createHash} from 'node:crypto';

const REPOSITORY='ansqhd5774-Choi/zgmini-pc-control';
const WORKFLOW='.github/workflows/pc-job.yml';
const WORKFLOW_NAME='ZGMINI PC Job';
const STEPS=['Execute fixed host allowlist entry',
 'Upload sanitized TXT JSON and issue result'];
const SHA40=/^[0-9a-f]{40}$/;
const SHA64=/^[0-9a-f]{64}$/;
const RUN=/^[0-9]{1,20}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fail=code=>{throw Object.assign(new Error(code),{code});};
const need=(condition,code)=>{if(!condition)fail(code);};
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const blobOid=bytes=>createHash('sha1').update(
 Buffer.concat([Buffer.from(`blob ${bytes.length}\0`),bytes])).digest('hex');
const isObject=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const raw=(x,code)=>{
 need(Buffer.isBuffer(x)&&x.length>0&&x.length<=262144,code);
 const utf8=x.toString('utf8');
 need(Buffer.from(utf8,'utf8').equals(x),code);
 return utf8;
};
const approved=async(api,{commitSha,path,maxBytes=262144})=>{
 const obj=await api.readFileAtCommit({repository:REPOSITORY,commitSha,path});
 need(obj?.path===path&&obj.commitSha===commitSha&&
  Buffer.isBuffer(obj.bytes)&&obj.bytes.length>0&&obj.bytes.length<=maxBytes&&
  SHA40.test(obj.gitBlobOid??'')&&blobOid(obj.bytes)===obj.gitBlobOid,
  'B_RUNNER_IMMUTABLE_FILE_READBACK');
 return obj.bytes;
};
const resultTxt=report=>Object.entries(report).filter(([key])=>
 !['result','prior'].includes(key)).map(([key,value])=>
 `${key}=${typeof value==='object'?JSON.stringify(value):value}`)
 .join('\r\n')+'\r\n';
const finitePositive=x=>Number.isSafeInteger(x)&&x>0;

/**
 * Trusted API must be an independently authenticated read-only GitHub
 * connector. Never accept snapshots supplied inside an Issue JSON or proof.
 * Expected control/workflow/source pins originate in existing approval data.
 *
 * The result may only classify remote transport; it cannot yield B authority.
 */
export async function verifyExistingPcRunnerTransport({github,expected}={}){
 need(isObject(github)&&['getWorkflowRun','getWorkflowRunJobs','getIssue',
  'readFileAtCommit'].every(k=>typeof github[k]==='function'),
 'B_RUNNER_GITHUB_TRUSTED_READ_INTERFACE');
 need(isObject(expected)&&expected.repository===REPOSITORY&&
  RUN.test(String(expected.runId??''))&&
  finitePositive(expected.attempt)&&expected.attempt<=999&&
  finitePositive(expected.seat)&&expected.seat<=6&&
  finitePositive(expected.issueNumber)&&
  UUID.test(expected.requestId??'')&&UUID.test(expected.chatId??'')&&
  SHA40.test(expected.workflowHeadSha??'')&&
  SHA64.test(expected.approvedWorkflowSha256??'')&&
  SHA40.test(expected.resultsCommitSha??'')&&
  SHA40.test(expected.approvedControllerSourceSha??'')&&
  SHA40.test(expected.requestedSourceSha??'')&&
  typeof expected.operation==='string'&&/^[a-z0-9-]{3,80}$/.test(expected.operation),
 'B_RUNNER_EXPECTED_PINS');
 const runId=String(expected.runId),attempt=expected.attempt;
 const [run,jobs,issue]=await Promise.all([
  github.getWorkflowRun({repository:REPOSITORY,runId}),
  github.getWorkflowRunJobs({repository:REPOSITORY,runId,attempt}),
  github.getIssue({repository:REPOSITORY,issueNumber:expected.issueNumber}),
 ]);
 need(String(run?.id)===runId&&run?.run_attempt===attempt&&
  run?.repository?.full_name===REPOSITORY&&run?.path===WORKFLOW&&
  run?.name===WORKFLOW_NAME&&run?.event==='issues'&&
  run?.head_branch==='main'&&run?.head_sha===expected.workflowHeadSha&&
  run?.actor?.login==='ansqhd5774-Choi'&&run?.status==='completed'&&
  run?.conclusion==='success', 'B_RUNNER_WORKFLOW_IDENTITY');
 // Current issue labels are mutable after opening. The fixed Actions job
 // guard checked the ORIGINAL event labels; do not create a false hard gate
 // by demanding that 'pc-job' remain in today's mutable Issue labels.
 need(issue?.number===expected.issueNumber&&
  issue?.user?.login==='ansqhd5774-Choi',
 'B_RUNNER_ISSUE_IDENTITY');
 need(Array.isArray(jobs?.jobs)&&jobs.jobs.length>0,
  'B_RUNNER_JOBS_ABSENT');
 const matching=jobs.jobs.filter(x=>x.name==='approved-pc-job');
 need(matching.length===1&&matching[0].status==='completed'&&
  matching[0].conclusion==='success'&&
  matching[0].runner_name===`zgmini-pc-0${expected.seat}`&&
  Array.isArray(matching[0].labels)&&
  ['self-hosted','Windows','X64','zgmini-pc-control'].every(l=>
   matching[0].labels.includes(l))&&
  Array.isArray(matching[0].steps)&&STEPS.every((name,i)=>
   matching[0].steps[i]?.name===name&&
   matching[0].steps[i]?.conclusion==='success'),
  'B_RUNNER_JOB_EXECUTION');
 const workflowBytes=await approved(github,{
  commitSha:expected.workflowHeadSha,path:WORKFLOW,maxBytes:32768});
 need(sha256(workflowBytes)===expected.approvedWorkflowSha256,
  'B_RUNNER_WORKFLOW_PIN');
 const base=`results/${runId}-${attempt}-seat-${expected.seat}`;
 const [resultBytes,textBytes]=await Promise.all([
  approved(github,{commitSha:expected.resultsCommitSha,path:base+'.json'}),
  approved(github,{commitSha:expected.resultsCommitSha,path:base+'.txt'}),
 ]);
 let report;try{report=JSON.parse(raw(resultBytes,'B_RUNNER_JSON_BYTES'));}
 catch(e){if(e?.code)throw e;fail('B_RUNNER_JSON_FORMAT');}
 need(isObject(report)&&report.schema==='ZGMINI_PC_RESULT_V1'&&
  report.jobId===`run-${runId}-${attempt}-seat-${expected.seat}`&&
  report.seat===expected.seat&&report.requestId===expected.requestId&&
  report.chatId===expected.chatId&&
  report.controlRepository===REPOSITORY&&
  report.controlSourceSha===expected.approvedControllerSourceSha&&
  report.requestedSourceSha===expected.requestedSourceSha&&
  report.operation===expected.operation,
  'B_RUNNER_REPORT_IDENTITY');
 need(raw(textBytes,'B_RUNNER_TXT_BYTES')===resultTxt(report),
  'B_RUNNER_REPORT_PAIR_MISMATCH');
 // The current upload may project source inventories to SUMMARY_ONLY.
 // Even FULL ordinary A results have no authorized old/new fixture contract.
 const reportTransfer=report.reportTransfer?.status==='SUMMARY_ONLY'?
  'SUMMARY_ONLY':'FULL_OR_UNMARKED';
 return Object.freeze({status:reportTransfer==='SUMMARY_ONLY'?
  'TRANSPORT_SUMMARY_ONLY':'GITHUB_TRANSPORT_VERIFIED_NO_RUNTIME_PROOF',
  repository:REPOSITORY,runId,attempt,seat:expected.seat,
  resultBytesSha256:sha256(resultBytes),
  textBytesSha256:sha256(textBytes),
  workflowBytesSha256:sha256(workflowBytes),
  immutableResultsCommitSha:expected.resultsCommitSha,
  reportTransfer,reportStatus:report.status,
  trustedRunnerTransportVerified:true,
  trustedRuntimeFixtureExecutionVerified:false,
  trustedCrossVersionStateCompatibilityVerified:false,
  trustedCurrentProcessAndRuntimeReadbackVerified:false,
  activationAllowed:false});
}

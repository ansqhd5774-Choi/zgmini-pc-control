import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {controllerBReceiptMarker,verifyControllerBIdentity} from '../ci-approval/ci-execution-identity.mjs';
const repo='ansqhd5774-Choi/zgmini-pc-control',path='.github/workflows/ci-approval-controller-b.yml',head='a'.repeat(40);
function fixture(){
 const requestBytes=Buffer.from('{"requestId":"fixture"}'),workflowBytes=Buffer.from('reviewed immutable workflow fixture\n');
 const pin=createHash('sha1').update(Buffer.concat([Buffer.from('blob '+workflowBytes.length+'\0'),workflowBytes])).digest('hex');
 const policy={workflowId:22,workflowBlobSha:pin};
 const run={id:123,run_attempt:2,workflow_id:22,path,repository:{id:1442936296,full_name:repo,private:true},head_repository:{id:1442936296},head_branch:'main',head_sha:head,event:'workflow_run',status:'completed',conclusion:'success'};
 const file={type:'file',path,sha:pin,encoding:'base64',content:workflowBytes.toString('base64')};
 const job={id:456,run_id:123,run_attempt:2,head_sha:head,name:'submit-controller-b',status:'completed',conclusion:'success',steps:[{name:'Record Controller B request receipt',status:'completed',conclusion:'success'}]};
 const jobs={total_count:1,jobs:[job]};
 const f={run,file,job,jobs,logs:'2026-11-26T00:00:00.0000000Z '+controllerBReceiptMarker(42,requestBytes)+'\n',calls:[]};
 f.opts={issueNumber:42,requestBytes,runId:123,attempt:2,policy,getJson:async route=>{
  f.calls.push(route);
  if(route==='actions/runs/123/attempts/2')return run;
  if(route==='contents/'+path+'?ref='+head)return file;
  if(route==='actions/runs/123/attempts/2/jobs?per_page=100')return jobs;
  throw Error('unexpected route');
 },readJobLogs:async n=>{assert.equal(n,456);return f.logs;}};
 return f;
}
test('exact original attempt and Issue receipt verify workload identity only',async()=>{
 const f=fixture(),x=await verifyControllerBIdentity(f.opts);
 assert.equal(x.state,'CI_WORKLOAD_IDENTITY_VERIFIED_ONLY');assert.equal(x.issueNumber,42);
 assert.equal(x.attempt,2);assert.equal(x.canPublish,false);assert.equal(x.canExecute,false);
 assert.equal(f.calls[0],'actions/runs/123/attempts/2');
});
for(const [name,mutate,code] of [
 ['missing installed pin',f=>{delete f.opts.policy},'CI_IDENTITY_POLICY_NOT_CONFIGURED'],
 ['foreign repository',f=>{f.run.repository.id=1},'CI_RUN_IDENTITY_MISMATCH'],
 ['untrusted workflow id',f=>{f.run.workflow_id=1},'CI_RUN_IDENTITY_MISMATCH'],
 ['PR event',f=>{f.run.event='pull_request'},'CI_RUN_IDENTITY_MISMATCH'],
 ['other branch',f=>{f.run.head_branch='candidate'},'CI_RUN_IDENTITY_MISMATCH'],
 ['wrong attempt',f=>{f.run.run_attempt=3},'CI_RUN_IDENTITY_MISMATCH'],
 ['CI failure',f=>{f.run.conclusion='failure'},'CI_RUN_NOT_SUCCESS'],
 ['wrong workflow blob',f=>{f.file.sha='b'.repeat(40)},'CI_WORKFLOW_PIN_MISMATCH'],
 ['changed workflow bytes',f=>{f.file.content=Buffer.from('changed').toString('base64')},'CI_WORKFLOW_BYTES_MISMATCH'],
 ['wrong job',f=>{f.job.run_attempt=3},'CI_JOB_IDENTITY_MISMATCH'],
 ['step skipped',f=>{f.job.steps[0].conclusion='skipped'},'CI_RECEIPT_STEP_NOT_SUCCESS'],
 ['copied receipt to other issue',f=>{f.opts.issueNumber=43},'CI_RECEIPT_ISSUE_OR_BYTES_MISMATCH'],
 ['edited issue body',f=>{f.opts.requestBytes=Buffer.from('{}')},'CI_RECEIPT_ISSUE_OR_BYTES_MISMATCH'],
 ['missing logs',f=>{f.logs=''},'CI_RECEIPT_LOG_UNAVAILABLE'],
 ['echoed command is not receipt',f=>{f.logs='2026-11-26T00:00:00Z [command]echo '+controllerBReceiptMarker(42,f.opts.requestBytes)},'CI_RECEIPT_ISSUE_OR_BYTES_MISMATCH']
])test(name,async()=>{const f=fixture();mutate(f);const x=await verifyControllerBIdentity(f.opts);assert.equal(x.code,code);assert.equal(x.canExecute,false);});
test('pending original attempt queues without reading source or logs',async()=>{const f=fixture();f.run.status='in_progress';const x=await verifyControllerBIdentity(f.opts);assert.equal(x.state,'QUEUED');assert.equal(f.calls.length,1);});
test('read failure is not approval',async()=>{const f=fixture();f.opts.getJson=async()=>{throw Error('offline')};assert.equal((await verifyControllerBIdentity(f.opts)).state,'EVIDENCE_MISSING');});

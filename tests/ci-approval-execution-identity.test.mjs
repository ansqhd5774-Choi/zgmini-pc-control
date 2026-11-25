import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {controllerBReceiptMarker,verifyControllerBIdentity,authenticateControllerBIssue,CI_CONTROLLER_ACTOR} from '../ci-approval/ci-execution-identity.mjs';
import {validateMaintenanceRequest,validateUpdateRequest,manifestFingerprint} from '../tools/maintenance-contract.mjs';
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

function issueFixture(){
 const f=fixture(),old='c'.repeat(40),target='d'.repeat(40),allowFiles=[{path:'controller/example-readonly.mjs',sha256:'e'.repeat(64)}];
 const manifest={schema:'ZGMINI_PC_UPDATE_V1',installedSha:old,targetSha:target,allowFiles,
  purpose:'pc-controller-maintenance',approval:{grade:'B',scope:'PC_CONTROL_CONTROLLER_UPDATE',ref:'https://github.com/'+repo+'/pull/28'},
  checks:{status:'PASS',targetSha:target,manifestSha256:manifestFingerprint(allowFiles).sha256},
  backup:{strategy:'VERSIONED_SNAPSHOT',rollback:{kind:'RESTORE_INSTALLED_SHA',sha:old}},
  postOperation:'core-status',postSourceBranch:'main',postSourceSha:head,controllerOnlyInstall:true,
  selectiveSource:{schema:'ZGMINI_CONTROLLER_SELECTIVE_SOURCE_V1',branch:'codex/example-selective',mainSha:head,customPaths:[]}};
 const bytes=Buffer.from(JSON.stringify(manifest)),request={schema:'ZGMINI_PC_MAINTENANCE_REQUEST_V1',
  requestId:'pc-update-12345678-1234-4234-9234-1234567890ab',chatId:'chat-ci-123-2',
  operation:'controller-update',controlRepository:repo,targetControllerSha:target,
  approvalManifestSha256:createHash('sha256').update(bytes).digest('hex')};
 const actual={number:42,user:{id:41898282,type:'Bot',login:CI_CONTROLLER_ACTOR},title:'pc-controller-update',
  state:'open',labels:[{name:'pc-maintenance'}],body:JSON.stringify(request)};
 f.logs='2026-11-26T00:00:00Z '+controllerBReceiptMarker(42,Buffer.from(actual.body));
 return {...f,actual,request,bytes,manifest,old};
}
test('production default is disabled; authenticated scoped receipt is process-local and exact',async()=>{
 const f=issueFixture(),{getJson,readJobLogs,policy}=f.opts;
 assert.equal((await authenticateControllerBIssue(f.actual,{getJson,readJobLogs})).state,'DISABLED');
 const result=await authenticateControllerBIssue(f.actual,{getJson,readJobLogs,policy});
 assert.equal(result.state,'CI_WORKLOAD_IDENTITY_VERIFIED_ONLY');
 const ctx={actor:CI_CONTROLLER_ACTOR,ciAuthorization:result.authorization,installedSha:f.old};
 assert.equal(validateMaintenanceRequest(f.request,ctx).requestId,f.request.requestId);
 assert.equal(validateUpdateRequest(f.request,f.bytes,ctx).manifest.targetSha,f.request.targetControllerSha);
 assert.throws(()=>validateMaintenanceRequest(f.request,{...ctx,ciAuthorization:{}}),/ACTOR_NOT_ALLOWED/);
 assert.throws(()=>validateMaintenanceRequest({...f.request,chatId:'chat-ci-123-3'},ctx),/ACTOR_NOT_ALLOWED/);
 assert.throws(()=>validateUpdateRequest(f.request,f.bytes,{...ctx,installedSha:head}),/INSTALLED_SOURCE_DRIFT/);
});
test('authenticated CI still cannot install a non-pilot effect',async()=>{
 const f=issueFixture(),{getJson,readJobLogs,policy}=f.opts;
 f.manifest.controllerOnlyInstall=false;
 const bytes=Buffer.from(JSON.stringify(f.manifest));
 f.request.approvalManifestSha256=createHash('sha256').update(bytes).digest('hex');
 f.actual.body=JSON.stringify(f.request);
 f.logs='2026-11-26T00:00:00Z '+controllerBReceiptMarker(42,Buffer.from(f.actual.body));
 const result=await authenticateControllerBIssue(f.actual,{getJson,readJobLogs,policy});
 assert.equal(result.state,'CI_WORKLOAD_IDENTITY_VERIFIED_ONLY');
 assert.throws(()=>validateUpdateRequest(f.request,bytes,{actor:CI_CONTROLLER_ACTOR,ciAuthorization:result.authorization,installedSha:f.old}),/CI_PILOT_SCOPE_DENIED/);
});
test('bot name alone and non-controller title cannot mint a capability',async()=>{
 const f=issueFixture(),{getJson,readJobLogs,policy}=f.opts;
 for(const patch of [{user:{id:1,type:'Bot',login:CI_CONTROLLER_ACTOR}},{title:'pc-r6-host-register'},{state:'closed'}]){
  const r=await authenticateControllerBIssue({...f.actual,...patch},{getJson,readJobLogs,policy});
  assert.equal(r.state,'REJECTED');assert.equal(r.authorization,undefined);
 }
});

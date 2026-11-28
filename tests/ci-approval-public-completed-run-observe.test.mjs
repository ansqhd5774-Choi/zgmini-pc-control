import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {observePublicSourceCompletion} from '../ci-approval/public-completed-run-observe.mjs';
// Reuse the existing hosted source-only step for the shared Native A
// effect-binding regression. No public self-hosted admission or workflow pin changes.
import './ci-native-a-execute.test.mjs';

const REPO='ansqhd5774-Choi/zgmini-pc-control';
const repository=()=>({id:1442936296,full_name:REPO,private:false,
 owner:{id:327938088,login:'ansqhd5774-Choi'}});
const event=()=>({action:'completed',repository:repository(),
 workflow_run:{id:46050000000,run_attempt:1,workflow_id:416355595,
  path:'.github/workflows/controller-maintenance-source-tests.yml',
  event:'pull_request',head_sha:'a'.repeat(40),status:'completed',
  conclusion:'success',repository:repository(),
  head_repository:{id:1442936296,full_name:REPO}}});
const env=()=>({GITHUB_EVENT_NAME:'workflow_run',GITHUB_REPOSITORY:REPO,
 GITHUB_REF:'refs/heads/main',GITHUB_SHA:'b'.repeat(40),
 RUNNER_ENVIRONMENT:'github-hosted'});

const SOURCE_PATH='.github/workflows/controller-maintenance-source-tests.yml';
const PIN='a8f49337200d2e7ce902ab3ecf23d42c811fabe2';
const sourceBytes=readFileSync(new URL('../'+SOURCE_PATH,import.meta.url));
const reviewedWorkflow=()=>({type:'file',path:SOURCE_PATH,encoding:'base64',sha:PIN,
 content:sourceBytes.toString('base64')});
const jobs=e=>({total_count:2,jobs:[
 {id:991,run_id:e.workflow_run.id,name:'public-source-only',status:'completed',
  conclusion:'success',steps:[
   {name:'Verify exact public source-only event origin',status:'completed',conclusion:'success'},
   {name:'Verify public source/runner isolation and deferred B approval',
    status:'completed',conclusion:'success'}]},
 {id:992,run_id:e.workflow_run.id,name:'source-only',status:'completed',conclusion:'skipped'}
]});
const proof=e=>({getJobs:async()=>jobs(e),getWorkflow:async()=>reviewedWorkflow()});


test('public source CI is observed by an independent exact run read, never approved',async()=>{
 const e=event(),seen=[];
 const r=await observePublicSourceCompletion({event:e,env:env(),getRun:async id=>{
  seen.push(id);return structuredClone(e.workflow_run);
 },...proof(e)});
 assert.deepEqual(seen,[e.workflow_run.id]);
 assert.equal(r.state,'OBSERVED_ONLY');
 assert.equal(r.code,'PUBLIC_CI_COMPLETION_SOURCE_OBSERVED');
 assert.equal(r.runId,e.workflow_run.id);
 assert.equal(r.headSha,e.workflow_run.head_sha);
 assert.equal(r.sourceJobId,991);
 assert.equal(r.reviewedWorkflowBlobSha,PIN);
 for(const key of ['canPublish','canExecute','approvalVerified','selfHostedAuthorized',
  'controllerBAuthorized'])assert.equal(r[key],false,key);
 for(const key of ['operationalWrites','providerCalls','d1Writes'])
  assert.equal(r[key],0,key);
});

for(const [name,change] of [
 ['foreign repository',({e})=>e.repository.id++],
 ['private repository',({e})=>e.repository.private=true],
 ['foreign owner',({e})=>e.repository.owner.id++],
 ['foreign sender repository',({e})=>e.workflow_run.repository.id++],
 ['forked run',({e})=>e.workflow_run.head_repository.id++],
 ['failed run',({e})=>e.workflow_run.conclusion='failure'],
 ['cancelled run',({e})=>e.workflow_run.status='cancelled'],
 ['non-PR run',({e})=>e.workflow_run.event='push'],
 ['different source workflow',({e})=>e.workflow_run.workflow_id=2],
 ['different workflow path',({e})=>e.workflow_run.path='other.yml'],
 ['invalid head SHA',({e})=>e.workflow_run.head_sha='main'],
 ['unbound attempt',({e})=>e.workflow_run.run_attempt=0],
 ['request action',({e})=>e.action='requested'],
 ['non-main observer',({v})=>v.GITHUB_REF='refs/heads/topic'],
 ['wrong event type',({v})=>v.GITHUB_EVENT_NAME='push'],
 ['self-hosted context',({v})=>v.RUNNER_ENVIRONMENT='self-hosted'],
 ['different CI repository',({v})=>v.GITHUB_REPOSITORY='attacker/repo'],
 ['missing observer checkout SHA',({v})=>v.GITHUB_SHA=''],
]){
 test(name+' is not allowed to read run or submit',async()=>{
  const e=event(),v=env();change({e,v});let reads=0;
  const r=await observePublicSourceCompletion({event:e,env:v,getRun:async()=>{reads++;return {};}});
  assert.equal(r.state,'IGNORED');assert.equal(reads,0);
  assert.equal(r.canPublish,false);assert.equal(r.canExecute,false);
 });
}

for(const [name,change] of [
 ['run ID mismatch',r=>r.id++],
 ['attempt mismatch',r=>r.run_attempt++],
 ['head mismatch',r=>r.head_sha='c'.repeat(40)],
 ['source workflow mismatch',r=>r.workflow_id=9],
 ['run repository switched to private',r=>r.repository.private=true],
 ['run now failed',r=>r.conclusion='failure']
]){
 test(name+' fails closed after authenticated read',async()=>{
  const e=event(),run=structuredClone(e.workflow_run);change(run);
  const r=await observePublicSourceCompletion({event:e,env:env(),getRun:async()=>run,
   ...proof(e)});
  assert.equal(r.state,'EVIDENCE_MISSING');
  assert.equal(r.code,'PUBLIC_CI_COMPLETION_API_MISMATCH');
  assert.equal(r.canPublish,false);assert.equal(r.canExecute,false);
 });
}

test('missing/failed authenticated read is neither approval nor execution',async()=>{
 const e=event();
 const missing=await observePublicSourceCompletion({event:e,env:env()});
 assert.equal(missing.code,'PUBLIC_CI_COMPLETION_READ_PORT_MISSING');
 const broken=await observePublicSourceCompletion({event:e,env:env(),getRun:async()=>{
  throw Error('token or network unavailable');
 },...proof(e)});
 assert.equal(broken.code,'PUBLIC_CI_COMPLETION_API_READ_FAILED');
 assert.equal(broken.operationalWrites,0);
 assert.doesNotMatch(JSON.stringify(broken),/token or network unavailable/);
});


test('success without the authenticated job or workflow read cannot count',async()=>{
 const e=event();
 for(const x of [
  {getRun:async()=>e.workflow_run,getWorkflow:async()=>reviewedWorkflow()},
  {getRun:async()=>e.workflow_run,getJobs:async()=>jobs(e)}
 ]){
  const r=await observePublicSourceCompletion({event:e,env:env(),...x});
  assert.equal(r.code,'PUBLIC_CI_COMPLETION_READ_PORT_MISSING');
 }
});

for(const [name,mutate] of [
 ['missing job',x=>{x.jobs=[];x.total_count=0;}],
 ['truncated first page',x=>{x.total_count=3;}],
 ['duplicate successful job',x=>{x.jobs[1]={...x.jobs[0],id:999};}],
 ['public job skipped',x=>{x.jobs[0].conclusion='skipped';}],
 ['private job activated',x=>{x.jobs[1].conclusion='success';}],
 ['wrong run binding',x=>{x.jobs[0].run_id++;}],
 ['missing security step',x=>{x.jobs[0].steps.pop();}],
 ['failed security step',x=>{x.jobs[0].steps[0].conclusion='failure';}],
 ['duplicate required step',x=>{x.jobs[0].steps.push({...x.jobs[0].steps[0]});}]
]){
 test(name+' cannot become Public CI source proof',async()=>{
  const e=event(),j=jobs(e);mutate(j);
  const r=await observePublicSourceCompletion({event:e,env:env(),
   getRun:async()=>e.workflow_run,getJobs:async()=>j,
   getWorkflow:async()=>reviewedWorkflow()});
  assert.equal(r.code,'PUBLIC_CI_COMPLETION_JOB_EVIDENCE_UNVERIFIED');
  assert.equal(r.canPublish,false);assert.equal(r.canExecute,false);
 });
}

for(const [name,change] of [
 ['wrong trusted blob',x=>{x.sha='f'.repeat(40);}],
 ['modified workflow bytes',x=>{x.content=Buffer.from('fake').toString('base64');}],
 ['missing bytes',x=>{delete x.content;}],
 ['wrong path',x=>{x.path='other.yml';}],
 ['wrong encoding',x=>{x.encoding='utf-8';}]
]){
 test(name+' cannot promote PR-edited workflow',async()=>{
  const e=event(),f=reviewedWorkflow();change(f);
  const r=await observePublicSourceCompletion({event:e,env:env(),
   getRun:async()=>e.workflow_run,getJobs:async()=>jobs(e),
   getWorkflow:async()=>f});
  assert.equal(r.code,'PUBLIC_CI_COMPLETION_WORKFLOW_BLOB_UNVERIFIED');
  assert.equal(r.canPublish,false);assert.equal(r.canExecute,false);
 });
}

test('actual immutable main workflow bytes equal the reviewed pinned Git blob',async()=>{
 const {createHash}=await import('node:crypto');
 const h=createHash('sha1').update(Buffer.from('blob '+sourceBytes.length))
  .update(Buffer.from([0])).update(sourceBytes).digest('hex');
 assert.equal(h,PIN);
});

test('Public CI observer is hosted and read-only; original Private B gate remains',async()=>{
 const {readFileSync}=await import('node:fs');
 const {URL}=await import('node:url');
 const y=readFileSync(new URL('../.github/workflows/ci-approval-controller-b.yml',import.meta.url),'utf8');
 const hosted=y.split('  observe-public-source:')[1]?.split('  submit-controller-b:')[0];
 const existing=y.split('  submit-controller-b:')[1];
 assert.ok(hosted);
 assert.ok(existing);
 assert.match(hosted,/github\.event\.repository\.private == false/);
 assert.match(hosted,/github\.event_name == 'workflow_run'/);
 assert.match(hosted,/runs-on: ubuntu-latest/);
 assert.match(hosted,/contents: read/);
 assert.match(hosted,/actions: read/);
 assert.match(hosted,/node ci-approval\/public-completed-run-observe\.mjs/);
 assert.doesNotMatch(hosted,/self-hosted|contents: write|issues: write|pull-requests: write|workflow_dispatch/);
 assert.match(existing,/github\.event\.repository\.private == true/);
 assert.match(existing,/vars\.ZGMINI_CI_CONTROLLER_B_ENABLED == 'true'/);
 assert.match(existing,/runs-on: \[self-hosted, Windows, X64, zgmini-handoff-ci-isolated\]/);
 const verify=readFileSync(new URL('../.github/workflows/controller-maintenance-source-tests.yml',import.meta.url),'utf8');
 const publicCi=verify.split('  public-source-only:')[1]?.split('  source-only:')[0];
 assert.match(publicCi,/node --test --test-concurrency=1 tests\/ci-approval-public-completed-run-observe\.test\.mjs/);
});

import {createHash as nativeHash} from 'node:crypto';
import {inspectPublicNativeACandidate,inspectPublicNativeWriterBCandidate} from '../ci-approval/public-native-a-candidate.mjs';
const nativeDigest=b=>nativeHash('sha256').update(b).digest('hex');
const nativeBlob=b=>nativeHash('sha1').update(Buffer.from('blob '+b.length+'\0')).update(b).digest('hex');
const nativeFile=(path,b)=>({type:'file',path,encoding:'base64',sha:nativeBlob(b),content:b.toString('base64')});
function nativeFixture(){
 const e=event(),run=e.workflow_run,source=reviewedWorkflow(),jobProof=jobs(e);
 const receiverPath='.github/workflows/ci-approved-a-once.yml';
 const receiver=nativeFile(receiverPath,readFileSync(new URL('../'+receiverPath,import.meta.url)));
 const approvalBytes=Buffer.from(JSON.stringify({controlRepository:REPO,
  sourceRepository:'ansqhd5774-Choi/zgmini',mutationsEnabled:false,
  allowedActors:['ansqhd5774-Choi'],operations:{'core-status':{grade:'A',resource:'light'}}}));
 const requestBytes=Buffer.from(JSON.stringify({schema:'ZGMINI_PC_JOB_V1',
  requestId:'pc-test-public-native-a',chatId:'chat-test-native-a',operation:'core-status',
  sourceRepository:'ansqhd5774-Choi/zgmini',sourceBranch:'main',sourceSha:'a'.repeat(40)}));
 const policy={schema:'ZGMINI_CI_NATIVE_DISPATCH_V1',effect:'A_READONLY',
  repositoryVisibility:'public',enabled:true,nativeAExecutionEnabled:true,
  nativeAOperation:'core-status',nativeAAdapterSha256:'b'.repeat(64),
  installedControllerSha:'c'.repeat(40),sourceRunMode:'EVENT_COMPLETION_V1',
  sourceAttempt:1,sourceWorkflowId:run.workflow_id,sourceHeadSha:run.head_sha,
  sourceWorkflowPath:SOURCE_PATH,sourceWorkflowBlobSha:source.sha,
  receiverWorkflowPath:receiverPath,receiverWorkflowBlobSha:receiver.sha,
  policyRevision:'e'.repeat(40),businessApprovalSha256:nativeDigest(approvalBytes),
  approvedRequestSha256:nativeDigest(requestBytes)};
 const scope={policy,approvalBytes,requestBytes};
 const proof={schema:'ZGMINI_CI_NATIVE_B_INSTALLED_PROOF_V1',effect:'A_READONLY',
  policy:structuredClone(policy),nativePolicySha256:nativeDigest(Buffer.from(JSON.stringify(policy))),
  installationRequestId:'pc-update-12345678-1234-4234-8234-123456789abc',
  installationReceiptPath:'results/maintenance-pc-update-12345678-1234-4234-8234-123456789abc.json',
  actualControllerSha:policy.installedControllerSha};
 const receipt={schema:'ZGMINI_PC_MAINTENANCE_RESULT_V1',requestId:proof.installationRequestId,
  actualControllerSha:proof.actualControllerSha,targetControllerSha:proof.actualControllerSha,
  status:'SUCCEEDED',protectedStateUnchanged:true,ciNativeEffect:proof.effect,
  ciNativePolicySha256:proof.nativePolicySha256};
 const receiptBytes=Buffer.from(JSON.stringify(receipt));
 proof.installationReceiptSha256=nativeDigest(receiptBytes);
 let writes=0;
 const ports={readNativeScope:async effect=>{assert.equal(effect,'A_READONLY');return scope},
  readNativeInstalledProof:async effect=>{assert.equal(effect,'A_READONLY');return proof},
  getRun:async(id,attempt)=>{assert.equal(id,run.id);assert.equal(attempt,1);return run},
  getJobs:async(id,attempt)=>{assert.equal(id,run.id);assert.equal(attempt,1);return jobProof},
  getWorkflow:async(path,ref)=>{if(path===SOURCE_PATH){assert.equal(ref,policy.sourceHeadSha);return source}
   assert.equal(path,receiverPath);assert.equal(ref,'main');return receiver},
  getJson:async route=>{assert.equal(route,'contents/'+proof.installationReceiptPath+'?ref=main');
   return nativeFile(proof.installationReceiptPath,receiptBytes)},
  dispatchWorkflow:async()=>{writes++;throw Error('unexpected dispatch')},
  saveReceipt:async()=>{writes++;throw Error('unexpected write')}};
 return {sourceRunId:run.id,ports,scope,proof,run,jobProof,source,receiver,writes:()=>writes};
}
function assertNoNativeAuthority(x,r){
 for(const k of ['canPublish','canExecute','canInstall','selfHostedAuthorized'])
  assert.equal(r[k],false,k);
 assert.equal(r.operationalWrites,0);assert.equal(x.writes(),0);
 assert.doesNotMatch(JSON.stringify(r),/pc-update-|pc-test-public-native-a|installationReceiptPath/);
}
test('Public Native A exact independent evidence remains candidate only',async()=>{
 const x=nativeFixture(),r=await inspectPublicNativeACandidate(x);
 assert.equal(r.state,'CANDIDATE_ONLY');assert.equal(r.code,'PUBLIC_NATIVE_A_EXACT_EVIDENCE_MATCH');
 assertNoNativeAuthority(x,r);
});
for(const [name,mutate,code] of [
 ['private grant',x=>{x.scope.policy.repositoryVisibility='private'},'PUBLIC_NATIVE_A_SCOPE_DENIED'],
 ['Writer grant',x=>{x.scope.policy.effect='B_WRITER_SOURCE'},'PUBLIC_NATIVE_A_SCOPE_DENIED'],
 ['disabled grant',x=>{x.scope.policy.enabled=false},'PUBLIC_NATIVE_A_SCOPE_DENIED'],
 ['injected fixed run',x=>{x.scope.policy.sourceRunId=x.sourceRunId},'PUBLIC_NATIVE_A_SCOPE_DENIED'],
 ['request drift',x=>{x.scope.requestBytes=Buffer.from('{}')},'PUBLIC_NATIVE_A_BYTES_DRIFT'],
 ['approval drift',x=>{x.scope.approvalBytes=Buffer.from('{}')},'PUBLIC_NATIVE_A_BYTES_DRIFT'],
 ['operation mismatch',x=>{x.scope.policy.nativeAOperation='runner-smoke'},'PUBLIC_NATIVE_A_FIXED_OPERATION_DENIED'],
 ['attested policy drift',x=>{x.proof.policy.nativeAAdapterSha256='f'.repeat(64)},'PUBLIC_NATIVE_A_INSTALLED_PROOF_MISMATCH'],
 ['wrong installed Controller',x=>{x.proof.actualControllerSha='f'.repeat(40)},'PUBLIC_NATIVE_A_INSTALLED_PROOF_MISMATCH'],
 ['foreign receipt path',x=>{x.proof.installationReceiptPath='results/other.json'},'PUBLIC_NATIVE_A_INSTALLED_PROOF_MISMATCH'],
 ['missing receipt',x=>{x.ports.getJson=async()=>{throw Error('missing')}},'PUBLIC_NATIVE_A_INSTALLATION_RECEIPT_UNVERIFIED'],
 ['receipt bytes drift',x=>{x.ports.getJson=async()=>nativeFile(x.proof.installationReceiptPath,Buffer.from('{}'))},'PUBLIC_NATIVE_A_INSTALLATION_RECEIPT_UNVERIFIED'],
 ['wrong attempt',x=>{x.run.run_attempt=2},'PUBLIC_NATIVE_A_SOURCE_RUN_MISMATCH'],
 ['wrong source SHA',x=>{x.run.head_sha='f'.repeat(40)},'PUBLIC_NATIVE_A_SOURCE_RUN_MISMATCH'],
 ['skipped public job',x=>{x.jobProof.jobs[0].conclusion='skipped'},'PUBLIC_NATIVE_A_SOURCE_EVIDENCE_UNVERIFIED'],
 ['foreign source repository',x=>{x.run.head_repository.id++},'PUBLIC_NATIVE_A_SOURCE_EVIDENCE_UNVERIFIED'],
 ['source bytes changed',x=>{x.source.content=Buffer.from('fake').toString('base64')},'PUBLIC_NATIVE_A_SOURCE_EVIDENCE_UNVERIFIED'],
 ['receiver bytes changed',x=>{x.receiver.content=Buffer.from('fake').toString('base64')},'PUBLIC_NATIVE_A_RECEIVER_PIN_UNVERIFIED'],
 ['missing installed scope',x=>{x.ports.readNativeScope=async()=>{throw Error('not installed')}},'PUBLIC_NATIVE_A_INSTALLED_SCOPE_UNAVAILABLE']
])test('Public Native A rejects '+name,async()=>{
 const x=nativeFixture();mutate(x);const r=await inspectPublicNativeACandidate(x);
 assert.equal(r.code,code);assert.notEqual(r.state,'CANDIDATE_ONLY');assertNoNativeAuthority(x,r);
});

function writerFixture(){
 const x=nativeFixture(),p=x.scope.policy;
 const manifest=JSON.parse(readFileSync(new URL('../approvals/writer-updates/w05-r304-maintenance-window-20261119.json',import.meta.url)));
 delete manifest.coreMaintenance;
 const receiverPath='.github/workflows/ci-approved-writer-b-once.yml';
 const receiver=nativeFile(receiverPath,readFileSync(new URL('../'+receiverPath,import.meta.url)));
 const adapterPath='ci-approval/native-writer-b-execute.mjs';
 const adapter=readFileSync(new URL('../'+adapterPath,import.meta.url));
 const manifestPath='approvals/writer-updates/w05-r304-maintenance-window-20261119.json';
 function bind(){
  x.scope.approvalBytes=Buffer.from(JSON.stringify(manifest));
  p.businessApprovalSha256=nativeDigest(x.scope.approvalBytes);
  x.scope.requestBytes=Buffer.from(JSON.stringify({schema:'ZGMINI_PC_WRITER_SOURCE_B_REQUEST_V1',
   requestId:'12345678-1234-4234-8234-123456789abc',chatId:'12345678-1234-4234-8234-123456789abd',
   operation:'pc-writer-source-install',controlRepository:REPO,approvalManifestPath:manifestPath,
   approvalManifestSha256:p.businessApprovalSha256}));
  p.approvedRequestSha256=nativeDigest(x.scope.requestBytes);
  x.proof.policy=structuredClone(p);
  x.proof.nativePolicySha256=nativeDigest(Buffer.from(JSON.stringify(p)));
  const bytes=Buffer.from(JSON.stringify({schema:'ZGMINI_PC_MAINTENANCE_RESULT_V1',
   requestId:x.proof.installationRequestId,actualControllerSha:x.proof.actualControllerSha,
   targetControllerSha:x.proof.actualControllerSha,status:'SUCCEEDED',protectedStateUnchanged:true,
   ciNativeEffect:p.effect,ciNativePolicySha256:x.proof.nativePolicySha256}));
  x.proof.installationReceiptSha256=nativeDigest(bytes);
  x.ports.getJson=async()=>nativeFile(x.proof.installationReceiptPath,bytes);
 }
 Object.assign(p,{effect:'B_WRITER_SOURCE',nativeWriterBExecutionEnabled:true,
  nativeWriterBControlSha:'a'.repeat(40),nativeWriterBAdapterSha256:nativeDigest(adapter),
  receiverWorkflowPath:receiverPath,receiverWorkflowBlobSha:receiver.sha});
 delete p.nativeAExecutionEnabled;delete p.nativeAAdapterSha256;delete p.nativeAOperation;
 x.proof.effect=p.effect;
 x.ports.readNativeScope=async effect=>{assert.equal(effect,'B_WRITER_SOURCE');return x.scope};
 x.ports.readNativeInstalledProof=async effect=>{assert.equal(effect,'B_WRITER_SOURCE');return x.proof};
 x.ports.getWorkflow=async(path,ref)=>{if(path===SOURCE_PATH){assert.equal(ref,p.sourceHeadSha);return x.source}
  assert.equal(path,receiverPath);assert.equal(ref,'main');return receiver};
 x.ports.getControlFile=async(path,ref)=>{
  assert.equal(ref,p.nativeWriterBControlSha);
  if(path===manifestPath)return nativeFile(path,x.scope.approvalBytes);
  if(path===adapterPath)return nativeFile(path,adapter);
  assert.equal(path,receiverPath);return receiver;
 };
 bind();return {...x,manifest,bind,writerReceiver:receiver};
}
test('Public Native Writer B exact evidence remains candidate only',async()=>{
 const x=writerFixture(),r=await inspectPublicNativeWriterBCandidate(x);
 assert.equal(r.state,'CANDIDATE_ONLY');assert.equal(r.code,'PUBLIC_NATIVE_WRITER_B_EXACT_EVIDENCE_MATCH');
 assertNoNativeAuthority(x,r);
});
for(const [name,mutate,code] of [
 ['A grant',x=>{x.scope.policy.effect='A_READONLY'},'SCOPE_DENIED'],
 ['private grant',x=>{x.scope.policy.repositoryVisibility='private'},'SCOPE_DENIED'],
 ['missing execution opt-in',x=>{delete x.scope.policy.nativeWriterBExecutionEnabled},'SCOPE_DENIED'],
 ['missing control pin',x=>{delete x.scope.policy.nativeWriterBControlSha},'SCOPE_DENIED'],
 ['approval drift',x=>{x.scope.approvalBytes=Buffer.from('{}')},'BYTES_DRIFT'],
 ['extended maintenance',x=>{x.manifest.coreMaintenance='PAUSE_NEW_STARTS_DRAIN_360S_V1';x.bind()},'FIXED_OPERATION_DENIED'],
 ['provider scope',x=>{x.manifest.allowProviderCalls=true;x.bind()},'FIXED_OPERATION_DENIED'],
 ['DB scope',x=>{x.manifest.allowDbChanges=true;x.bind()},'FIXED_OPERATION_DENIED'],
 ['task change scope',x=>{x.manifest.allowTaskDefinitionChanges=true;x.bind()},'FIXED_OPERATION_DENIED'],
 ['wrong proof effect',x=>{x.proof.effect='A_READONLY'},'INSTALLED_PROOF_MISMATCH'],
 ['wrong installed SHA',x=>{x.proof.actualControllerSha='f'.repeat(40)},'INSTALLED_PROOF_MISMATCH'],
 ['receipt drift',x=>{x.ports.getJson=async()=>nativeFile(x.proof.installationReceiptPath,Buffer.from('{}'))},'INSTALLATION_RECEIPT_UNVERIFIED'],
 ['second source attempt',x=>{x.run.run_attempt=2},'SOURCE_RUN_MISMATCH'],
 ['skipped source job',x=>{x.jobProof.jobs[0].conclusion='skipped'},'SOURCE_EVIDENCE_UNVERIFIED'],
 ['receiver bytes drift',x=>{x.writerReceiver.content=Buffer.from('fake').toString('base64')},'RECEIVER_PIN_UNVERIFIED'],
 ['missing immutable control reader',x=>{delete x.ports.getControlFile},'CONTROL_READ_PORT_UNAVAILABLE'],
 ...['approvals/writer-updates/w05-r304-maintenance-window-20261119.json','ci-approval/native-writer-b-execute.mjs','.github/workflows/ci-approved-writer-b-once.yml'].map(path=>['immutable control drift '+path,x=>{const get=x.ports.getControlFile;x.ports.getControlFile=async(p,ref)=>p===path?nativeFile(p,Buffer.from('changed')):get(p,ref)},'CONTROL_BYTES_UNVERIFIED'])
])test('Public Native Writer B rejects '+name,async()=>{
 const x=writerFixture();mutate(x);const r=await inspectPublicNativeWriterBCandidate(x);
 assert.equal(r.code,'PUBLIC_NATIVE_WRITER_B_'+code);assert.notEqual(r.state,'CANDIDATE_ONLY');
 assertNoNativeAuthority(x,r);
});

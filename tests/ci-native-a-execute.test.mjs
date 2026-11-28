import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import {inspectNativeAExecution,runNativeAReadOnly} from '../ci-approval/native-a-execute.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
const effectKey=p=>hash(Buffer.from(JSON.stringify([p.effect,
 p.businessApprovalSha256,p.approvedRequestSha256])));
const policyBytes=fs.readFileSync(new URL('../config/operations.json',import.meta.url));
const FILES=['config/operations.json','controller/common.mjs','controller/engine.mjs',
 'controller/entry.mjs','controller/fear-greed-archive-readonly.mjs',
 'controller/operations.mjs','controller/supervisor.mjs','controller/upload.mjs','controller/worker.mjs'];
function make(operation='runner-smoke'){
 const adapterBytes=Buffer.from('exact installed A adapter');
 const policy=JSON.parse(policyBytes);
 const request={schema:'ZGMINI_PC_JOB_V1',requestId:'pc-test-001',chatId:'test',operation,
  sourceRepository:policy.sourceRepository,sourceBranch:'main',sourceSha:'a'.repeat(40)};
 const requestBytes=Buffer.from(JSON.stringify(request));
 const scope={policy:{schema:'ZGMINI_CI_NATIVE_DISPATCH_V1',
   enabled:true,effect:'A_READONLY',nativeAExecutionEnabled:true,
   nativeAOperation:operation,nativeAAdapterSha256:hash(adapterBytes),
   installedControllerSha:'c'.repeat(40),
   approvedRequestSha256:hash(requestBytes),businessApprovalSha256:hash(policyBytes)},
  approvalBytes:policyBytes,requestBytes};
 const files=Object.fromEntries(FILES.map(p=>[p,p==='config/operations.json'?policyBytes:Buffer.from('trusted source '+p)]));
 const host={controllerSourceSha:'c'.repeat(40),dataRoot:'E:\\ZGmini\\data',
  controllerFiles:Object.fromEntries(Object.entries(files).map(([p,bytes])=>[p,hash(bytes)]))};
 const observation={state:'CONTRACT_MATCH_ONLY',code:'CI_NATIVE_RECEIVER_INDEPENDENT_EVIDENCE_MATCH',
  effectKey:effectKey(scope.policy)};
 const env={RUNNER_NAME:'zgmini-pc-01',GITHUB_RUN_ID:'110004',GITHUB_RUN_ATTEMPT:'1',
  GITHUB_REPOSITORY:'ansqhd5774-Choi/zgmini-pc-control',GITHUB_EVENT_NAME:'workflow_dispatch'};
 return {observation,scope,host,controllerPolicyBytes:policyBytes,adapterBytes,
  readInstalledFile:name=>files[name],env,files};
}
for(const operation of ['runner-smoke','core-status'])test(operation+' is admitted only through installed pinned A source',()=>{
 const x=make(operation),r=inspectNativeAExecution(x);
 assert.equal(r.state,'READY_FOR_EXISTING_A_ENGINE_ONLY');
 assert.equal(r.operation,operation);assert.equal(r.seat,1);assert.equal(r.runId,'110004');
});
test('readiness without receiver provenance cannot run engine',()=>{
 const x=make();x.observation={state:'CONTRACT_MATCH_ONLY',code:'CI_NATIVE_RECEIVER_OTHER'};
 assert.equal(inspectNativeAExecution(x).code,'CI_NATIVE_A_RECEIVER_ADMISSION_MISSING');
});
test('read-only local scope disabled rejects before file access',()=>{
 const x=make();x.scope.policy.nativeAExecutionEnabled=false;
 assert.equal(inspectNativeAExecution(x).code,'CI_NATIVE_A_EXECUTION_SCOPE_UNVERIFIED');
});
test('changed adapter executable SHA is rejected',()=>{
 const x=make();x.adapterBytes=Buffer.from('unreviewed adapter');
 assert.equal(inspectNativeAExecution(x).code,'CI_NATIVE_A_EXECUTION_BYTES_UNVERIFIED');
});
test('changed approved request bytes are rejected',()=>{
 const x=make();x.scope.requestBytes=Buffer.from('{"operation":"other"}');
 assert.equal(inspectNativeAExecution(x).code,'CI_NATIVE_A_EXECUTION_BYTES_UNVERIFIED');
});
test('installed local policy must be byte-identical to approved raw policy',()=>{
 const x=make();x.controllerPolicyBytes=Buffer.from(JSON.stringify(JSON.parse(policyBytes)));
 assert.equal(inspectNativeAExecution(x).code,'CI_NATIVE_A_EXECUTION_BYTES_UNVERIFIED');
});
test('repaired-looking but different installed controller source is rejected',()=>{
 const x=make();x.host.controllerSourceSha='d'.repeat(40);
 assert.equal(inspectNativeAExecution(x).code,'CI_NATIVE_A_CONTROLLER_ATTESTATION_MISSING');
});
test('installed controller file drift is rejected',()=>{
 const x=make(),original=x.readInstalledFile;
 x.readInstalledFile=k=>k==='controller/engine.mjs'?Buffer.from('tampered'):original(k);
 assert.equal(inspectNativeAExecution(x).code,'CI_NATIVE_A_CONTROLLER_SOURCE_DRIFT');
});
test('missing installed controller file hash blocks',()=>{
 const x=make();delete x.host.controllerFiles['controller/worker.mjs'];
 assert.equal(inspectNativeAExecution(x).code,'CI_NATIVE_A_CONTROLLER_ATTESTATION_MISSING');
});
test('extra unauthorized Controller file path blocks',()=>{
 const x=make();x.host.controllerFiles['../secret.env']='f'.repeat(64);
 assert.equal(inspectNativeAExecution(x).code,'CI_NATIVE_A_CONTROLLER_FILE_MAP_INVALID');
});
test('runner must be one of six existing seat owners',()=>{
 const x=make();x.env.RUNNER_NAME='zgmini-handoff-ci-isolated';
 assert.equal(inspectNativeAExecution(x).code,'CI_NATIVE_A_RUNNER_IDENTITY_DENIED');
});
test('run attempt 2 cannot create additional execution',()=>{
 const x=make();x.env.GITHUB_RUN_ATTEMPT='2';
 assert.equal(inspectNativeAExecution(x).code,'CI_NATIVE_A_RUNNER_IDENTITY_DENIED');
});
test('A effect may not be reinterpreted as B or C',()=>{
 const x=make();x.scope.policy.effect='B_WRITER_SOURCE';
 assert.equal(inspectNativeAExecution(x).code,'CI_NATIVE_A_EXECUTION_SCOPE_UNVERIFIED');
});
test('fixed A auto execution must not accept other A operations silently',()=>{
 const x=make('d05-lineage-readonly');
 assert.equal(inspectNativeAExecution(x).code,'CI_NATIVE_A_EFFECT_SCOPE_DENIED');
});
test('Controller policy may not be mutation enabled',()=>{
 const x=make(),policy=JSON.parse(policyBytes);
 policy.mutationsEnabled=true;
 const changed=Buffer.from(JSON.stringify(policy));
 x.scope.approvalBytes=changed;x.controllerPolicyBytes=changed;
 x.scope.policy.businessApprovalSha256=hash(changed);
 x.observation.effectKey=effectKey(x.scope.policy);
 x.host.controllerFiles['config/operations.json']=hash(changed);
 x.readInstalledFile=k=>k==='config/operations.json'?changed:x.files[k];
 assert.equal(inspectNativeAExecution(x).code,'CI_NATIVE_A_EFFECT_SCOPE_DENIED');
});
test('existing engine is only invoked after all independent checks',async()=>{
 const x=make();let count=0;
 const executeJob=async(raw,{seat,runId,policy})=>{
  count++;assert.equal(seat,1);assert.equal(runId,'110004');
  assert.equal(policy.mutationsEnabled,false);
  return {report:{schema:'ZGMINI_PC_RESULT_V1',requestId:raw.requestId,
   operation:'runner-smoke',status:'PASS',code:'RUNNER_COMMAND_EXECUTED',
   jobId:'run-110004-1-seat-1',providerCalls:0,d1Writes:0,operationalWrites:0,
   actualExecutionSha:x.host.controllerSourceSha,protectedStateUnchanged:true}};
 };
 const result=await runNativeAReadOnly({...x,executeJob});
 assert.equal(result.state,'PASS');assert.equal(result.sanitized.status,'PASS');
 assert.equal(result.sanitized.providerCalls,0);
 assert.equal(count,1);
 x.adapterBytes=Buffer.from('not the installed source');
 const blocked=await runNativeAReadOnly({...x,executeJob});
 assert.equal(blocked.state,'BLOCKED');assert.equal(count,1);
});
test('engine exceptions are UNKNOWN, not success',async()=>{
 const x=make();
 const r=await runNativeAReadOnly({...x,executeJob:async()=>{throw Error('interrupted')}});
 assert.equal(r.code,'CI_NATIVE_A_ENGINE_OUTCOME_UNKNOWN');
});
test('unverified engine response cannot yield successful A receipt',async()=>{
 const x=make();
 const r=await runNativeAReadOnly({...x,executeJob:async()=>({report:{status:'PASS'}})});
 assert.equal(r.code,'CI_NATIVE_A_RESULT_UNVERIFIED');
});

test('read-only A cannot report PASS if actual worker claims provider calls',async()=>{
 const x=make();
 const r=await runNativeAReadOnly({...x,executeJob:async raw=>({report:{
  schema:'ZGMINI_PC_RESULT_V1',requestId:raw.requestId,
  operation:raw.operation,status:'PASS',code:'RUNNER_COMMAND_EXECUTED',
  operationalWrites:0,providerCalls:1,d1Writes:0
 }})});
 assert.equal(r.code,'CI_NATIVE_A_UNEXPECTED_WRITE_OR_PROVIDER_EFFECT');
});
test('read-only A cannot report PASS if actual worker wrote D1 or operational files',async()=>{
 const x=make();
 const r=await runNativeAReadOnly({...x,executeJob:async raw=>({report:{
  schema:'ZGMINI_PC_RESULT_V1',requestId:raw.requestId,
  operation:raw.operation,status:'PASS',code:'RUNNER_COMMAND_EXECUTED',
  operationalWrites:1,providerCalls:0,d1Writes:1
 }})});
 assert.equal(r.code,'CI_NATIVE_A_UNEXPECTED_WRITE_OR_PROVIDER_EFFECT');
});

for(const [reason,change] of [
 ['missing installed execution SHA',r=>{delete r.actualExecutionSha}],
 ['stale installed execution SHA',r=>{r.actualExecutionSha='d'.repeat(40)}],
 ['missing protected-state verification',r=>{delete r.protectedStateUnchanged}],
 ['observed protected-state drift',r=>{r.protectedStateUnchanged=false}],
 ['wrong run receipt job ID',r=>{r.jobId='run-999999-1-seat-1'}]
])test('native A refuses forged PASS provenance: '+reason,async()=>{
 const x=make();
 const r=await runNativeAReadOnly({...x,executeJob:async raw=>{
  const report={schema:'ZGMINI_PC_RESULT_V1',requestId:raw.requestId,
   operation:raw.operation,status:'PASS',code:'RUNNER_COMMAND_EXECUTED',
   jobId:'run-110004-1-seat-1',actualExecutionSha:x.host.controllerSourceSha,
   protectedStateUnchanged:true,providerCalls:0,d1Writes:0,operationalWrites:0};
  change(report);return {report};
 }});
 assert.equal(r.state,'BLOCKED');
 assert.equal(r.code,'CI_NATIVE_A_PASS_PROVENANCE_UNVERIFIED');
 assert.equal(r.sanitized,undefined);
});

// Real readNativeScope has no scope.effectKey; the receiver proof itself must
// bind the exact approval and request. No engine call on missing/mismatched key.
for(const [name,mutate] of [
 ['missing observation key',x=>{delete x.observation.effectKey}],
 ['different request effect',x=>{x.observation.effectKey=effectKey({...x.scope.policy,approvedRequestSha256:'e'.repeat(64)})}],
 ['different approval effect',x=>{x.observation.effectKey=effectKey({...x.scope.policy,businessApprovalSha256:'e'.repeat(64)})}],
 ['forged matching optional scope field',x=>{x.observation.effectKey='e'.repeat(64);x.scope.effectKey=x.observation.effectKey}],
 ['mismatched optional scope field',x=>{x.scope.effectKey='e'.repeat(64)}]
])test('native A binds receiver proof: '+name,async()=>{
 const x=make();assert.equal(Object.hasOwn(x.scope,'effectKey'),false);mutate(x);
 let calls=0;const r=await runNativeAReadOnly({...x,executeJob:async()=>{calls++;}});
 assert.equal(r.code,'CI_NATIVE_A_RECEIVER_EFFECT_KEY_MISMATCH');
 assert.equal(r.canExecute,false);assert.equal(calls,0);
});

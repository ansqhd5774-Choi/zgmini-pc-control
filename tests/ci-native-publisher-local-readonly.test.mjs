import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import {inspectCiNativePublisherLocalReadonly,inspectStandardNativeScopeCandidate} from '../tools/ci-native-publisher-local-readonly.mjs';
import {authenticateProcess,toText,SCHEMA,TITLE,ROLE_OPERATION}
 from '../tools/pc-process-inventory-readonly.mjs';

const sha=b=>createHash('sha256').update(b).digest('hex');
const roots=()=>({
 ZGMINI_CI_NATIVE_SCOPE_ROOT:path.join(os.tmpdir(),'PRIVATE_NATIVE_POLICY_ROOT'),
 ZGMINI_CI_NATIVE_RECEIPT_ROOT:path.join(os.tmpdir(),'PRIVATE_NATIVE_RECEIPT_ROOT'),
 ZGMINI_CI_NATIVE_A_ENABLED:'true',
 ZGMINI_CI_NATIVE_WRITER_B_ENABLED:'false',
 ZGMINI_CI_NATIVE_A_EXEC_ENABLED:'false',
 ZGMINI_CI_NATIVE_WRITER_B_EXEC_ENABLED:''
});
const fixtures=()=>{
 const approvalBytes=Buffer.from('SECRET_APPROVAL_BYTES_CANARY');
 const requestBytes=Buffer.from('SECRET_REQUEST_BYTES_CANARY');
 const make=effect=>{
  const policy={schema:'ZGMINI_CI_NATIVE_DISPATCH_V1',effect,enabled:true,
   businessApprovalSha256:sha(approvalBytes),
   approvedRequestSha256:sha(requestBytes)};
  return {scope:{policy,approvalBytes,requestBytes},
   proof:{schema:'ZGMINI_CI_NATIVE_B_INSTALLED_PROOF_V1',
    effect,policy,nativePolicySha256:sha(Buffer.from(JSON.stringify(policy)))}};
 };
 const nativeA=make('A_READONLY'),writerB=make('B_WRITER_SOURCE');
 return {nativeA,writerB,
  createPorts:()=>({
   readNativeScope:effect=>
    effect==='A_READONLY'?nativeA.scope:writerB.scope,
   readNativeInstalledProof:effect=>
    effect==='A_READONLY'?nativeA.proof:writerB.proof
  })};
};
test('native fixed A redacts approved policy bytes, scope root and installed proof contents',()=>{
 const x=fixtures(),env=roots();
 const out=inspectCiNativePublisherLocalReadonly({env,createPorts:x.createPorts});
 assert.equal(out.status,'READ_ONLY_OBSERVED');
 assert.equal(out.code,'CI_NATIVE_LOCAL_SCOPES_FORMAT_OBSERVED');
 assert.equal(out.independentRootsVerified,true);
 assert.equal(out.scopeRootConfigured,true);
 assert.equal(out.receiptRootConfigured,true);
 assert.equal(out.publisherAOptIn,'ENABLED');
 assert.equal(out.publisherWriterBOptIn,'DISABLED');
 assert.equal(out.executionAOptIn,'DISABLED');
 assert.equal(out.executionWriterBOptIn,'UNSET_OR_INVALID');
 for(const effect of ['A_READONLY','B_WRITER_SOURCE']){
  assert.equal(out.effects[effect].code,'CI_NATIVE_LOCAL_SCOPE_PROOF_FORMAT_MATCH');
  assert.equal(out.effects[effect].scopeFormatObserved,true);
  assert.equal(out.effects[effect].installedProofFormatObserved,true);
  assert.equal(out.effects[effect].policyBytesMatched,true);
 }
 assert.equal(out.canExecute,false);
 assert.equal(out.canPublish,false);
 assert.equal(out.canInstall,false);
 assert.equal(out.independentGitHubInstallationReceiptVerified,false);
 assert.equal(out.operationalWrites,0);
 const display=JSON.stringify(out);
 assert.doesNotMatch(display,/PRIVATE_NATIVE|SECRET_APPROVAL|SECRET_REQUEST|sourceSha|policyRevision|installationReceiptSha256/);
});
test('absent native scope root or receipt root is observed without attempting any file reads',()=>{
 for(const name of ['ZGMINI_CI_NATIVE_SCOPE_ROOT','ZGMINI_CI_NATIVE_RECEIPT_ROOT']){
  const env=roots();
  delete env[name];
  let calls=0;
  const r=inspectCiNativePublisherLocalReadonly({env,createPorts:()=>{
   calls++;
   throw Error('SECRET_INTERNAL_PATH');
  }});
  assert.equal(r.code,'CI_NATIVE_LOCAL_ROOTS_NOT_CONFIGURED');
  assert.equal(r.independentRootsVerified,false);
  assert.equal(calls,0);
  assert.doesNotMatch(JSON.stringify(r),/SECRET_INTERNAL_PATH|PRIVATE_NATIVE/);
 }
});
test('missing variables distinguish standard fixed scope candidate without granting authority',()=>{
 const env=roots();
 delete env.ZGMINI_CI_NATIVE_SCOPE_ROOT;
 const hint={state:'ROOT_PRESENT_UNVERIFIED',
  effects:{A_READONLY:{scopeFile:'PRESENT_UNVERIFIED',installedProofFile:'ABSENT'},
   B_WRITER_SOURCE:{scopeFile:'ABSENT',installedProofFile:'ABSENT'}},
  executionAuthorized:false,operationalWrites:0};
 let calls=0;
 const out=inspectCiNativePublisherLocalReadonly({env,
  inspectStandardScope:()=>{calls++;return hint;},
  createPorts:()=>assert.fail('unconfigured roots must not read installed policy')});
 assert.equal(calls,1);
 assert.equal(out.code,'CI_NATIVE_LOCAL_ROOTS_NOT_CONFIGURED');
 assert.deepEqual(out.standardScopeCandidate,hint);
 assert.equal(out.independentRootsVerified,false);
 assert.equal(out.independentGitHubInstallationReceiptVerified,false);
 assert.equal(out.canExecute,false);
 assert.equal(out.canPublish,false);
 assert.equal(out.canInstall,false);
 assert.doesNotMatch(JSON.stringify(out),/E:\\\\|SECRET_|PRIVATE_NATIVE/);
});
test('standard candidate probe uses only fixed Windows lstat metadata, never file contents',()=>{
 const observed=[];
 const files=new Set(['ci-native-a-approved.json','ci-native-a-installed-proof.json',
  'ci-native-writer-b-approved.json','ci-native-writer-b-installed-proof.json']);
 const filesystem={
  lstatSync:p=>{
   observed.push(p);
   const name=path.win32.basename(p);
   if(files.has(name))return {
    isDirectory:()=>false,isSymbolicLink:()=>false,isFile:()=>true,size:24};
   return {isDirectory:()=>true,isSymbolicLink:()=>false,isFile:()=>false};
  },
  readFileSync:()=>assert.fail('contents must not be read'),
  readdirSync:()=>assert.fail('no directory listing'),
  writeFileSync:()=>assert.fail('no writes')
 };
 const v=inspectStandardNativeScopeCandidate({platform:'win32',filesystem});
 assert.equal(v.state,'ROOT_PRESENT_UNVERIFIED');
 assert.equal(v.effects.A_READONLY.scopeFile,'PRESENT_UNVERIFIED');
 assert.equal(v.effects.B_WRITER_SOURCE.installedProofFile,'PRESENT_UNVERIFIED');
 assert.equal(v.executionAuthorized,false);
 assert.equal(v.operationalWrites,0);
 assert.equal(observed.length,9); // five ancestor directories + four fixed files
 assert.ok(observed.every(p=>p.startsWith('E:\\')));
 assert.equal(observed.filter(p=>files.has(path.win32.basename(p))).length,4);
 assert.doesNotMatch(JSON.stringify(v),/E:\\\\|ci-native-a-approved|ci-native-writer-b-approved/);
});
test('standard scope candidate absence, reparse points and wrong host stay non-authorizing',()=>{
 const missing={code:'ENOENT'};
 const absent=inspectStandardNativeScopeCandidate({platform:'win32',
  filesystem:{lstatSync:()=>{throw missing;}}});
 assert.equal(absent.state,'ROOT_ABSENT');
 const alias=inspectStandardNativeScopeCandidate({platform:'win32',
  filesystem:{lstatSync:()=>({isDirectory:()=>true,isSymbolicLink:()=>true})}});
 assert.equal(alias.state,'ROOT_UNVERIFIED');
 const nonWindows=inspectStandardNativeScopeCandidate({platform:'linux',
  filesystem:{lstatSync:()=>assert.fail('no non-Windows probe')}});
 assert.equal(nonWindows.state,'NOT_CHECKED_NON_WINDOWS');
 for(const v of [absent,alias,nonWindows]){
  assert.equal(v.executionAuthorized,false);
  assert.equal(v.operationalWrites,0);
 }
});
test('unverified or overlapping roots fail closed without exposing filesystem error',()=>{
 const result=inspectCiNativePublisherLocalReadonly({env:roots(),createPorts:()=>{
  throw Error('PRIVATE_NATIVE_FILE_SYSTEM_OR_REPARSE_DETAILS');
 }});
 assert.equal(result.code,'CI_NATIVE_LOCAL_ROOTS_UNVERIFIED');
 assert.equal(result.independentRootsVerified,false);
 assert.doesNotMatch(JSON.stringify(result),/PRIVATE_NATIVE_FILE_SYSTEM/);
});
test('independent scope and proof are reported separately and never become grants',()=>{
 const x=fixtures();
 for(const failed of ['readNativeScope','readNativeInstalledProof']){
  const local=x.createPorts();
  local[failed]=effect=>{
   if(effect==='A_READONLY')throw Error('SECRET_NO_SCOPE_OR_PROOF');
   return x.createPorts()[failed](effect);
  };
  const result=inspectCiNativePublisherLocalReadonly({env:roots(),createPorts:()=>local});
  assert.equal(result.code,'CI_NATIVE_LOCAL_SCOPE_OR_PROOF_UNVERIFIED');
  assert.equal(result.effects.A_READONLY.code,failed==='readNativeScope'?
   'CI_NATIVE_LOCAL_SCOPE_UNVERIFIED':'CI_NATIVE_LOCAL_INSTALLED_PROOF_UNVERIFIED');
  assert.equal(result.effects.B_WRITER_SOURCE.code,'CI_NATIVE_LOCAL_SCOPE_PROOF_FORMAT_MATCH');
  assert.equal(result.canExecute,false);
  assert.doesNotMatch(JSON.stringify(result),/SECRET_NO_SCOPE_OR_PROOF/);
 }
});
test('drift in installed policy or original approved bytes fails closed',()=>{
 for(const kind of ['scopePolicy','approvalBytes','requestBytes','proofPolicy']){
  const x=fixtures();
  if(kind==='scopePolicy')x.nativeA.scope.policy={...x.nativeA.scope.policy,
   businessApprovalSha256:'f'.repeat(64)};
  if(kind==='approvalBytes')x.nativeA.scope.approvalBytes=Buffer.from('DRIFT');
  if(kind==='requestBytes')x.nativeA.scope.requestBytes=Buffer.from('DRIFT');
  if(kind==='proofPolicy')x.nativeA.proof.policy={...x.nativeA.proof.policy,enabled:false};
  const out=inspectCiNativePublisherLocalReadonly({env:roots(),createPorts:x.createPorts});
  assert.equal(out.effects.A_READONLY.code,'CI_NATIVE_LOCAL_POLICY_BYTES_UNVERIFIED');
  assert.equal(out.effects.B_WRITER_SOURCE.code,'CI_NATIVE_LOCAL_SCOPE_PROOF_FORMAT_MATCH');
  assert.equal(out.independentGitHubInstallationReceiptVerified,false);
 }
});
test('local disabled policy can be observed but cannot be treated as approved',()=>{
 const x=fixtures();
 x.nativeA.scope.policy={...x.nativeA.scope.policy,enabled:false};
 x.nativeA.proof.policy=x.nativeA.scope.policy;
 x.nativeA.proof.nativePolicySha256=sha(Buffer.from(JSON.stringify(x.nativeA.scope.policy)));
 const out=inspectCiNativePublisherLocalReadonly({env:roots(),createPorts:x.createPorts});
 assert.equal(out.effects.A_READONLY.code,'CI_NATIVE_LOCAL_POLICY_DISABLED');
 assert.equal(out.effects.A_READONLY.localPolicyEnabled,false);
 assert.equal(out.effects.A_READONLY.policyBytesMatched,true);
 assert.equal(out.canExecute,false);
});
test('only exact Owner handoff A schema can request native local probe',()=>{
 const env={GITHUB_REPOSITORY:'ansqhd5774-Choi/zgmini-pc-control',
  GITHUB_ACTOR:'ansqhd5774-Choi',GITHUB_EVENT_NAME:'issues',
  GITHUB_RUN_ID:'45897081642',GITHUB_RUN_ATTEMPT:'1'};
 const request={schema:SCHEMA,operation:ROLE_OPERATION,
  role:'handoff',requestId:'62d2bc4c-412a-4c56-a943-bdfc0479f019',
  probe:'ci-native-publisher-local-readonly'};
 const event=(body=request)=>({action:'opened',repository:{
  full_name:'ansqhd5774-Choi/zgmini-pc-control',private:true},
  issue:{number:4501,title:TITLE,user:{login:'ansqhd5774-Choi'},
   body:JSON.stringify(body)}});
 assert.equal(authenticateProcess(event(),env,'handoff').ciNativePublisherLocal,true);
 assert.throws(()=>authenticateProcess(event({...request,role:'operating'}),env,'operating'));
 for(const malicious of [
  {...request,root:'C:/confidential'},
  {...request,approvalBytes:'forged'},
  {...request,probe:'ci-native-publisher-local-readonly;calc'}
 ])assert.throws(()=>authenticateProcess(event(malicious),env,'handoff'));
});
test('existing result TXT reports bounded booleans and sanitized fixed A evidence',()=>{
 const out=inspectCiNativePublisherLocalReadonly({env:roots(),
  createPorts:fixtures().createPorts});
 const text=toText({schema:'ZGMINI_PC_PROCESS_INVENTORY_RESULT_V1',
  requestId:'test',role:'handoff',runId:'1',attempt:1,host:'ISOLATED',
  runnerName:'handoff',status:out.status,code:out.code,
  observedAtUtc:'2026-11-27T00:00:00Z',ciNativePublisherLocal:out});
 assert.match(text,/ciNativePublisherLocal=CI_NATIVE_LOCAL_SCOPES_FORMAT_OBSERVED/);
 assert.match(text,/ciNativeIndependentReceiptVerified=false/);
 assert.match(text,/ciNativeExecutionAuthorized=false/);
 assert.match(text,/ciNativeWriterBScope=CI_NATIVE_LOCAL_SCOPE_PROOF_FORMAT_MATCH/);
 assert.doesNotMatch(text,/PRIVATE_NATIVE|SECRET_APPROVAL|SECRET_REQUEST/);
});
test('handoff probe workflow keeps isolated Runner and both native publisher disabled opt-ins',()=>{
 const workflow=fs.readFileSync(new URL('../.github/workflows/pc-process-inventory-readonly.yml',import.meta.url),'utf8');
 assert.match(workflow,/zgmini-handoff-ci-isolated/);
 for(const key of ['ZGMINI_CI_NATIVE_SCOPE_ROOT','ZGMINI_CI_NATIVE_RECEIPT_ROOT',
  'ZGMINI_CI_NATIVE_A_ENABLED','ZGMINI_CI_NATIVE_WRITER_B_ENABLED']){
  assert.match(workflow,new RegExp('vars\\.'+key));
 }
 const native=fs.readFileSync(new URL('../.github/workflows/ci-native-auto-publish.yml',import.meta.url),'utf8');
 assert.match(native,/vars.ZGMINI_CI_NATIVE_A_ENABLED == 'true'/);
 assert.match(native,/vars.ZGMINI_CI_NATIVE_WRITER_B_ENABLED == 'true'/);
});

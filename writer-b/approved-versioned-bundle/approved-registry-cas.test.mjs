import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {
 PIN_CAS_SCHEMA,PIN_CAS_SCOPE,RUNTIME_REGISTRY_SCHEMA,
 patchHostRuntimePinBytes,verifyRegistryEntryOnly,runApprovedRegistryCas,
} from './approved-registry-cas.mjs';

const sha=x=>createHash('sha256').update(x).digest('hex');
const oldSha=sha('previously approved runtime registry');
const sourceSha='0c97599431882245a156470bd51290e327e7ee78';
const id='configured-themes';
function fixture(){
 const hostRaw=Buffer.from(
  '{\n  "schema": "ZGMINI_PC_HOST_V1",\n'+
  '  "secretCarrier": "private { \\\" quoted } and \\uac00 }",\n'+
  '  "approvedSources": {"do-not-change":{"credentials":"private value"}},\n'+
  '  "approvedRuntimeInventorySha256": "'+oldSha+'"\n}\n');
 const existing={id:'existing-profile',binding:{
  sourceRepository:'ansqhd5774-Choi/zgmini',
  sourceBranch:'main',sourceSha:'a'.repeat(40)},
  rootSegments:['pc-writer'],files:[],directories:[],tasks:[]};
 const newEntry={id,binding:{
  sourceRepository:'ansqhd5774-Choi/zgmini',
  sourceBranch:'codex/theme-fear-greed-integration-20261025',
  sourceSha},
  rootSegments:['pc-writer'],files:[],directories:[],tasks:[],
  bundleProfile:{id,home:'E:\\ZGmini\\data\\pc-writer\\theme-config-tool',
   taskName:'ZGMINI-PC-Configured-Themes',taskTime:'13:00',
   requiredLaunchers:['THEME_SCHEDULED.cmd'],
   optionalLaunchers:['THEME_SCHEDULED.vbs'],
   activeRecord:'ACTIVE_RUNTIME.json',maxFiles:256,maxBundleBytes:33554432}};
 const beforeText='{\n "schema":"'+RUNTIME_REGISTRY_SCHEMA+'",\n'+
  ' "profiles": [\n  '+JSON.stringify(existing)+'\n ]\n}\n';
 const afterText=beforeText.replace(
  JSON.stringify(existing)+'\n ]',
  JSON.stringify(existing)+','+JSON.stringify(newEntry)+'\n ]');
 const beforeRegistry=Buffer.from(beforeText);
 const afterRegistry=Buffer.from(afterText);
 const newPin=sha(afterRegistry),hostAfter=patchHostRuntimePinBytes(hostRaw,{
  oldPin:oldSha,newPin,
 });
 const approval={
  schema:PIN_CAS_SCHEMA,status:'APPROVED_B',scope:PIN_CAS_SCOPE,
  profileId:id,sourceSha,
  hostBeforeSha256:sha(hostRaw),hostAfterSha256:sha(hostAfter),
  oldPin:oldSha,newPin,
  registryBeforeSha256:sha(beforeRegistry),
  registryAfterSha256:sha(afterRegistry),registryEntryKey:id,
  registryEntryBeforeSha256:null,
  registryEntryAfterSha256:sha(Buffer.from(JSON.stringify(newEntry))),
 };
 // The test's existing host PIN must match the actual previous registry hash.
 const normalizedHost=Buffer.from(hostRaw.toString('utf8').replaceAll(oldSha,
  sha(beforeRegistry)));
 const normalizedHostAfter=patchHostRuntimePinBytes(normalizedHost,{
  oldPin:sha(beforeRegistry),newPin,
 });
 const normalizedApproval={...approval,hostBeforeSha256:sha(normalizedHost),
  hostAfterSha256:sha(normalizedHostAfter),oldPin:sha(beforeRegistry)};
 const approvalRaw=Buffer.from(JSON.stringify(normalizedApproval));
 const pinnedApproval={requestId:'approved-request-20261108-001',
  sourceSha,profileId:id,rawApprovalSha256:sha(approvalRaw)};
 return {hostRaw:normalizedHost,hostAfter:normalizedHostAfter,
  beforeRegistry,afterRegistry,newEntry,existing,approval:normalizedApproval,
  approvalRaw,pinnedApproval};
}
function mockIo(f,{faultAt=null,rollbackFault=false,reportIncomplete=false}={}){
 const copy=x=>x===null?null:Buffer.from(x);
 const state={host:copy(f.hostRaw),registry:copy(f.beforeRegistry),
  lock:null,backup:null,history:[],reported:null};
 const hit=(name)=>{state.history.push(name);if(faultAt===name)throw Error('TEST_FAULT');};
 const adapter={
  async authenticatePinnedApproval({pin,sha256}){
   hit('authenticate');return {verified:pin.rawApprovalSha256===sha256,sha256};
  },
  async inspectPreimage(){hit('preimage');return {
   host:copy(state.host),registry:copy(state.registry)};},
  async acquireSharedWriterLock(){hit('lock');state.lock={id:'shared-lock'};return state.lock;},
  async verifyPreimageUnderLock(){hit('under-lock');return {
   host:copy(state.host),registry:copy(state.registry)};},
  async loadApprovedRegistryAfterBytes(){
   hit('load-approved-registry');return Buffer.from(f.afterRegistry);
  },
  async backupBoth(){
   hit('backup');state.backup={
    host:copy(state.host),registry:copy(state.registry)};
   return {complete:true,journalId:'exact-owned-journal'};
  },
  async casHost({expectedSha256,afterBytes}){
   state.history.push('cas-host');
   assert.equal(sha(state.host),expectedSha256);
   state.host=Buffer.from(afterBytes);
   if(faultAt==='cas-host')throw Error('TEST_FAULT_AFTER_HOST_WRITE');
  },
  async casRegistry({expectedSha256,afterBytes}){
   state.history.push('cas-registry');
   assert.equal(state.registry===null?null:sha(state.registry),expectedSha256);
   state.registry=Buffer.from(afterBytes);
   if(faultAt==='cas-registry')throw Error('TEST_FAULT_AFTER_REGISTRY_WRITE');
  },
  async readBack(){hit('readback');return {
   host:copy(state.host),registry:copy(state.registry)};},
  async commit(){hit('commit');return {committed:true};},
  async restoreRegistry(){
   state.history.push('restore-registry');
   if(rollbackFault)throw Error('TEST_ROLLBACK_FAIL');
   state.registry=copy(state.backup.registry);
  },
  async restoreHost(){
   state.history.push('restore-host');
   state.host=Buffer.from(state.backup.host);
  },
  async verifyRestored(){
   hit('verify-rollback');return {host:copy(state.host),registry:copy(state.registry)};
  },
  async releaseSharedWriterLock(){hit('unlock');state.lock=null;},
  async recordResult({report}){
   state.history.push('report');state.reported=JSON.stringify(report);
   return {json:true,txt:!reportIncomplete};
  },
 };
 return {state,adapter};
}
test('host PIN byte-preserving patch with braces/escapes never changes other fields',()=>{
 const f=fixture();
 assert.equal(sha(f.hostAfter),f.approval.hostAfterSha256);
 assert.equal(f.hostRaw.toString('utf8').split('"approvedRuntimeInventorySha256"')[0],
  f.hostAfter.toString('utf8').split('"approvedRuntimeInventorySha256"')[0]);
 assert.equal(f.hostRaw.toString('utf8').split('"approvedRuntimeInventorySha256"')[1].split('"\n}')[1],
  f.hostAfter.toString('utf8').split('"approvedRuntimeInventorySha256"')[1].split('"\n}')[1]);
 assert.ok(f.hostAfter.toString('utf8').includes('private value'));
 assert.equal(JSON.parse(f.hostAfter).approvedRuntimeInventorySha256,
  sha(f.afterRegistry));
});
test('missing host PIN can only be added as one field when beforePin explicitly null',()=>{
 const f=fixture();
 const before=Buffer.from('{"schema":"ZGMINI_PC_HOST_V1","note":"some } braces"}\n');
 const after=patchHostRuntimePinBytes(before,{oldPin:null,newPin:sha(f.afterRegistry)});
 assert.equal(JSON.parse(after).approvedRuntimeInventorySha256,sha(f.afterRegistry));
 assert.ok(after.toString().includes('"note":"some } braces"'));
 assert.throws(()=>patchHostRuntimePinBytes(before,{oldPin:sha(f.beforeRegistry),
  newPin:sha(f.afterRegistry)}),e=>e.code==='B_PIN_PREIMAGE');
});
test('host duplicate/case-confusable PIN keys are rejected',()=>{
 const f=fixture();
 const raw=Buffer.from('{"approvedRuntimeInventorySha256":"'+
  sha(f.beforeRegistry)+'","ApprovedRuntimeInventorySha256":"'+sha(f.beforeRegistry)+'"}');
 assert.throws(()=>patchHostRuntimePinBytes(raw,{
  oldPin:sha(f.beforeRegistry),newPin:sha(f.afterRegistry),
 }),e=>e.code==='B_JSON_DUPLICATE_KEY');
});
test('registry single profile add preserves all other bytes, SHA and source binding',()=>{
 const f=fixture();
 assert.equal(verifyRegistryEntryOnly(f.beforeRegistry,f.afterRegistry,{
  entryKey:id,beforeEntrySha256:null,
  afterEntrySha256:sha(Buffer.from(JSON.stringify(f.newEntry))),sourceSha,
 }),true);
 const tampered=Buffer.from(f.afterRegistry.toString('utf8').replace(
  ' "profiles": [','  "profiles": ['));
 assert.throws(()=>verifyRegistryEntryOnly(f.beforeRegistry,tampered,{
  entryKey:id,beforeEntrySha256:null,
  afterEntrySha256:sha(Buffer.from(JSON.stringify(f.newEntry))),sourceSha,
 }),e=>e.code==='B_REGISTRY_UNRELATED_BYTES_DRIFT');
});
test('approved dual-file CAS: authenticates, backs up, changes two files, reports only hashes',async()=>{
 const f=fixture(),d=mockIo(f);
 const result=await runApprovedRegistryCas({
  approvalRaw:f.approvalRaw,pinnedApproval:f.pinnedApproval,adapter:d.adapter});
 assert.equal(result.status,'PASS');
 assert.equal(result.reportStatus,'JSON_TXT_2_OF_2');
 assert.equal(result.endToEndDone,true);
 assert.equal(result.evidenceRecoveryRequired,false);
 assert.deepEqual(d.state.host,f.hostAfter);
 assert.deepEqual(d.state.registry,f.afterRegistry);
 assert.equal(d.state.lock,null);
 assert.equal(d.state.reported.includes('private value'),false);
 assert.deepEqual(d.state.history,['authenticate','preimage','lock','under-lock',
  'load-approved-registry','backup','cas-host','cas-registry','readback','commit',
  'unlock','report']);
});
test('committed PIN CAS with incomplete result proof requires evidence recovery, not B replay',async()=>{
 const f=fixture(),d=mockIo(f,{reportIncomplete:true});
 const r=await runApprovedRegistryCas({
  approvalRaw:f.approvalRaw,pinnedApproval:f.pinnedApproval,adapter:d.adapter});
 assert.equal(r.status,'PASS');assert.equal(r.reportStatus,'INCOMPLETE');
 assert.equal(r.endToEndDone,false);assert.equal(r.evidenceRecoveryRequired,true);
 assert.deepEqual(d.state.host,f.hostAfter);
 assert.deepEqual(d.state.registry,f.afterRegistry);
 assert.equal(d.state.history.filter(step=>step==='cas-host').length,1);
});
test('malformed/unpinned approval never reaches preimage or writes',async()=>{
 const f=fixture(),d=mockIo(f);
 const wrong={...f.pinnedApproval,rawApprovalSha256:sha('wrong')};
 const result=await runApprovedRegistryCas({
  approvalRaw:f.approvalRaw,pinnedApproval:wrong,adapter:d.adapter});
 assert.equal(result.status,'BLOCKED');
 assert.equal(result.code,'B_PIN_APPROVAL_AUTH_DRIFT');
 assert.deepEqual(d.state.history,['report']);
});
test('unbounded or unsafe one-shot request ID denied before adapter callbacks',async()=>{
 const f=fixture(),d=mockIo(f);
 const result=await runApprovedRegistryCas({
  approvalRaw:f.approvalRaw,
  pinnedApproval:{...f.pinnedApproval,requestId:'../unsafe'},
  adapter:d.adapter});
 assert.equal(result.status,'BLOCKED');
 assert.equal(result.code,'B_PIN_REQUEST_ID');
 assert.deepEqual(d.state.history,['report']);
});
test('all early transaction faults stop without operational mutation',async()=>{
 for(const faultAt of ['authenticate','preimage','lock','under-lock',
  'load-approved-registry']){
  const f=fixture(),d=mockIo(f,{faultAt});
  const result=await runApprovedRegistryCas({
   approvalRaw:f.approvalRaw,pinnedApproval:f.pinnedApproval,adapter:d.adapter});
  assert.equal(result.status,'BLOCKED',faultAt);
  assert.deepEqual(d.state.host,f.hostRaw);
  assert.deepEqual(d.state.registry,f.beforeRegistry);
  assert.equal(d.state.lock,null);
 }
});
test('both host-first and registry-second partial-CAS faults reverse rollback',async()=>{
 for(const faultAt of ['cas-host','cas-registry','readback']){
  const f=fixture(),d=mockIo(f,{faultAt});
  const result=await runApprovedRegistryCas({
   approvalRaw:f.approvalRaw,pinnedApproval:f.pinnedApproval,adapter:d.adapter});
  assert.equal(result.status,'BLOCKED',faultAt);
  assert.equal(result.rollback,'VERIFIED',faultAt);
  assert.deepEqual(d.state.host,f.hostRaw,faultAt);
  assert.deepEqual(d.state.registry,f.beforeRegistry,faultAt);
  assert.ok(d.state.history.indexOf('restore-registry')<
   d.state.history.indexOf('restore-host'),faultAt);
  assert.equal(d.state.lock,null);
 }
});
test('partial backup/ambiguous commit/rollback failure retains lock and UNKNOWN',async()=>{
 for(const faultAt of ['backup','commit']){
  const f=fixture(),d=mockIo(f,{faultAt});
  const result=await runApprovedRegistryCas({
   approvalRaw:f.approvalRaw,pinnedApproval:f.pinnedApproval,adapter:d.adapter});
  assert.equal(result.status,'STATE_UNKNOWN',faultAt);
  assert.equal(result.retainLockForRecovery,true,faultAt);
  assert.ok(d.state.lock!==null,faultAt);
 }
 const f=fixture(),d=mockIo(f,{faultAt:'cas-registry',rollbackFault:true});
 const result=await runApprovedRegistryCas({
  approvalRaw:f.approvalRaw,pinnedApproval:f.pinnedApproval,adapter:d.adapter});
 assert.equal(result.status,'STATE_UNKNOWN');
 assert.equal(result.code,'B_PIN_ROLLBACK_UNVERIFIED');
 assert.ok(d.state.lock!==null);
});
test('explicit first-create: absent registry+absent host PIN is byte-CAS, no fake empty file',async()=>{
 const f=fixture();
 f.beforeRegistry=null;
 f.afterRegistry=Buffer.from(JSON.stringify({
  schema:RUNTIME_REGISTRY_SCHEMA,profiles:[f.newEntry],
 })+'\n');
 f.hostRaw=Buffer.from(
  '{"schema":"ZGMINI_PC_HOST_V1","secretCarrier":"unchanged"}\n');
 f.hostAfter=patchHostRuntimePinBytes(f.hostRaw,{
  oldPin:null,newPin:sha(f.afterRegistry),
 });
 f.approval={...f.approval,oldPin:null,newPin:sha(f.afterRegistry),
  registryBeforeSha256:null,registryAfterSha256:sha(f.afterRegistry),
  hostBeforeSha256:sha(f.hostRaw),hostAfterSha256:sha(f.hostAfter)};
 f.approvalRaw=Buffer.from(JSON.stringify(f.approval));
 f.pinnedApproval={...f.pinnedApproval,rawApprovalSha256:sha(f.approvalRaw)};
 const d=mockIo(f);
 const result=await runApprovedRegistryCas({
  approvalRaw:f.approvalRaw,pinnedApproval:f.pinnedApproval,adapter:d.adapter,
 });
 assert.equal(result.status,'PASS');
 assert.deepEqual(d.state.host,f.hostAfter);
 assert.deepEqual(d.state.registry,f.afterRegistry);
});
test('orphan adoption forbidden: registry exists but host PIN is absent',async()=>{
 const f=fixture();
 f.hostRaw=Buffer.from('{"schema":"ZGMINI_PC_HOST_V1","private":"unchanged"}\n');
 f.hostAfter=patchHostRuntimePinBytes(f.hostRaw,{
  oldPin:null,newPin:sha(f.afterRegistry)});
 f.approval={...f.approval,oldPin:null,
  registryBeforeSha256:sha(f.beforeRegistry),
  hostBeforeSha256:sha(f.hostRaw),hostAfterSha256:sha(f.hostAfter)};
 f.approvalRaw=Buffer.from(JSON.stringify(f.approval));
 f.pinnedApproval={...f.pinnedApproval,rawApprovalSha256:sha(f.approvalRaw)};
 const d=mockIo(f);
 const result=await runApprovedRegistryCas({
  approvalRaw:f.approvalRaw,pinnedApproval:f.pinnedApproval,adapter:d.adapter});
 assert.equal(result.status,'BLOCKED');
 assert.equal(result.code,'B_PIN_REGISTRY_DIGEST_BINDING');
 assert.deepEqual(d.state.host,f.hostRaw);
 assert.deepEqual(d.state.registry,f.beforeRegistry);
 assert.deepEqual(d.state.history,['report']);
});

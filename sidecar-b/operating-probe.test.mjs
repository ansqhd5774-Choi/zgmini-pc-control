import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyProtectedSidecarSnapshot,createOperatingSidecarProbe}
 from './operating-probe.mjs';
import {TARGET,PREIMAGE} from './contract.mjs';
const ID='8f265fcb-45b7-43b8-acd2-40976524db91';
const HEAD='a'.repeat(40),HASH='b'.repeat(64);
const manifest={installedHead:HEAD,installedConfigSource:HEAD,
 taskDefinitionSha256:HASH,wrapperSha256:HASH,beforeSha256:PREIMAGE};
const live={head:HEAD,configSource:HEAD,
 taskDefinitionSha256:HASH,wrapperSha256:HASH,targetSha256:PREIMAGE,
 clean:true,sourceApproved:true,coreQuiet:true,sidecarActive:false,
 maintenanceBusy:false,lockOwner:ID};
test('one fully observed approved idle owner yields exact contract shape',()=>{
 const x=classifyProtectedSidecarSnapshot(live,manifest,ID);
 assert.equal(x.target,TARGET);
 assert.equal(x.beforeSha256,PREIMAGE);
 assert.equal(x.leaseOwned,true);
 assert.equal(x.active,false);
 assert.equal(Object.keys(x).length,12);
});
test('HEAD/config/Task/wrapper/candidate/approval/clean drift each stops',()=>{
 for(const delta of [
  {head:'c'.repeat(40)},{configSource:'c'.repeat(40)},
  {taskDefinitionSha256:'c'.repeat(64)},
  {wrapperSha256:'c'.repeat(64)},
  {targetSha256:'c'.repeat(64)},
  {sourceApproved:false},{clean:false},
  {head:null},{taskDefinitionSha256:null}
 ])assert.throws(()=>classifyProtectedSidecarSnapshot({...live,...delta},manifest,ID),
  e=>e.code==='SIDECAR_B_PROBE_LINEAGE_STOP');
});
test('Core/sidecar activity and other lease owner stop independently',()=>{
 for(const delta of [
  {coreQuiet:false},{coreQuiet:undefined},
  {sidecarActive:true},{sidecarActive:null},
  {maintenanceBusy:true},{maintenanceBusy:null},
  {lockOwner:'foreign-id'},{lockOwner:null}
 ])assert.throws(()=>classifyProtectedSidecarSnapshot({...live,...delta},manifest,ID),
  e=>e.code==='SIDECAR_B_PROBE_RESOURCE_STOP');
});
test('production probe cannot be constructed without independent approval',()=>{
 assert.throws(()=>createOperatingSidecarProbe({
  manifest,requestId:ID,sourceApproved:false
 }),e=>e.code==='SIDECAR_B_PROBE_APPROVAL_STOP');
});


test('CNN B preimage pins return exact bounded SHA only when source and preimage agree',async()=>{
 const {projectSidecarBManifestPreimageReadonly:project}=await import('./operating-probe.mjs');
 const raw={head:HEAD,configSource:HEAD,taskDefinitionSha256:HASH,
  wrapperSha256:HASH,targetSha256:PREIMAGE,secret:'DO_NOT_LEAK'};
 const out=project(raw);
 assert.deepEqual({status:out.status,code:out.code,head:out.head,beforeSha256:out.beforeSha256},
  {status:'PASS',code:'CNN_B_PREIMAGE_PINS_COLLECTED',head:HEAD,beforeSha256:PREIMAGE});
 assert.equal(Object.hasOwn(out,'secret'),false);
 assert.equal(out.operationalWrites,0);
 for(const delta of [{head:'c'.repeat(40)},{configSource:'c'.repeat(40)},
  {taskDefinitionSha256:null},{wrapperSha256:null},
  {targetSha256:'f'.repeat(64)}]){
  const denied=project({...raw,...delta});
  assert.equal(denied.status,'STATE_UNKNOWN');
  assert.equal(denied.taskDefinitionSha256,null);
 }
});


test('CNN B current resource diagnostics report only fixed booleans and no raw process data',async()=>{
 const {projectSidecarBResourceFlagsReadonly:project}=await import('./operating-probe.mjs');
 const raw={coreQuiet:true,sidecarActive:false,controllerInstallBusy:false,
  sharedWriterLockPresent:false,commandLine:'PRIVATE_COMMAND',secret:'PRIVATE_VALUE'};
 const ready=project(raw);
 assert.equal(ready.status,'PASS');
 assert.equal(ready.code,'CNN_B_RESOURCE_SNAPSHOT_COLLECTED');
 assert.equal(ready.currentPreflightReadyIgnoringLease,true);
 assert.equal(ready.priorRuntimeFailure,'NOT_OBSERVED_BY_THIS_PROBE');
 assert.equal(ready.operationalWrites,0);
 assert.equal(ready.providerCalls,0);
 assert.equal(ready.d1Writes,0);
 assert.doesNotMatch(JSON.stringify(ready),/PRIVATE|commandLine|secret/);
 for(const name of ['coreQuiet','sidecarActive','controllerInstallBusy','sharedWriterLockPresent']){
  const bad={...raw,[name]:name==='coreQuiet'?false:true};
  const result=project(bad);
  assert.equal(result.status,'PASS');
  assert.equal(result.currentPreflightReadyIgnoringLease,false);
 }
});

test('CNN B resource observation never guesses readiness if a predicate is unknown',async()=>{
 const {projectSidecarBResourceFlagsReadonly:project}=await import('./operating-probe.mjs');
 const raw={coreQuiet:true,sidecarActive:false,controllerInstallBusy:false,
  sharedWriterLockPresent:false};
 for(const name of Object.keys(raw)){
  const observed=project({...raw,[name]:null});
  assert.equal(observed.status,'STATE_UNKNOWN');
  assert.equal(observed.code,'CNN_B_RESOURCE_SNAPSHOT_PARTIAL');
  assert.equal(observed.currentPreflightReadyIgnoringLease,null);
 }
 assert.equal(project(null).status,'STATE_UNKNOWN');
});

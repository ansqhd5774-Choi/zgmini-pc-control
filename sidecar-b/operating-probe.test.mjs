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

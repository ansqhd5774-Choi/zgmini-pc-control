import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {assessPublicV3PreimageReadonly} from './public-v3-independent-preimage-readonly.mjs';

const good=()=>({
 ownerVerified:true,independentOperatorVerified:true,sourceVerified:true,
 preimage:{status:'PASS',code:'CNN_B_V3_PREIMAGE_PINS_COLLECTED',
  beforeSha256:'eb3c43bf8fba6ea4e51f3e84b77f9ec13000db9d9e38077ffd914950d7080b6b',
  head:'c8ed53a3991212dd1778742cda8a86ac133e0796',
  configSource:'c8ed53a3991212dd1778742cda8a86ac133e0796',
  taskDefinitionSha256:'dd81987c7efa4b1e343af30329a580613bb920dec89c1aa7a436ef935f0bb028',
  wrapperSha256:'9d5bc3429cd74813207cfc393eb04eff11a78106096964b80bf7833440385b7c'},
 resources:{status:'PASS',code:'CNN_B_RESOURCE_SNAPSHOT_COLLECTED',
  coreQuiet:true,sidecarActive:false,controllerInstallBusy:false,
  sharedWriterLockPresent:false}
});
const checked=x=>{
 assert.equal(x.executionAuthorized,false);
 assert.equal(x.approvalGranted,false);
 assert.equal(x.operationalWrites,0);
 assert.equal(x.providerCalls,0);
 assert.equal(x.d1Writes,0);
};
test('independent public V3 matches exact existing preimage, still only readonly',()=>{
 const r=assessPublicV3PreimageReadonly(good());
 assert.equal(r.status,'PASS');
 assert.equal(r.code,'W06_V3_PREIMAGE_AND_IDLE_READONLY_ONLY');
 checked(r);
});
test('owner identity, actual independent Windows origin, source closure are mandatory',()=>{
 for(const key of ['ownerVerified','independentOperatorVerified','sourceVerified']){
  const e=good();e[key]=false;
  const r=assessPublicV3PreimageReadonly(e);
  assert.equal(r.status,'BLOCKED');checked(r);
 }
 checked(assessPublicV3PreimageReadonly(null));
});
test('stale source pin, bad sidecar V2 bytes and task/wrapper SHA fail closed',()=>{
 for(const key of ['status','code','beforeSha256','head','configSource',
  'taskDefinitionSha256','wrapperSha256']){
  const e=good();e.preimage[key]='bad';
  const r=assessPublicV3PreimageReadonly(e);
  assert.equal(r.status,'STATE_UNKNOWN',key);checked(r);
 }
});
test('undefined or partial Windows resource evidence never yields idle PASS',()=>{
 for(const key of ['status','code','coreQuiet','sidecarActive',
  'controllerInstallBusy','sharedWriterLockPresent']){
  const e=good();e.resources[key]=null;
  const r=assessPublicV3PreimageReadonly(e);
  assert.equal(r.status,'STATE_UNKNOWN',key);checked(r);
 }
});
test('other installer or natural Core/Sidecar activity defers, never grabs lease',()=>{
 for(const key of ['controllerInstallBusy','sharedWriterLockPresent',
  'sidecarActive']){
  const e=good();e.resources[key]=true;
  const r=assessPublicV3PreimageReadonly(e);
  assert.equal(r.status,'DEFERRED',key);checked(r);
 }
 const e=good();e.resources.coreQuiet=false;
 const r=assessPublicV3PreimageReadonly(e);
 assert.equal(r.status,'DEFERRED');checked(r);
});
test('source does not create a public B execution path or GitHub Actions dispatch',()=>{
 const raw=fs.readFileSync(new URL('./public-v3-independent-preimage-readonly.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(raw,/createWindowsSidecarIO|applyOneFile|receiveApprovedSidecarB|execFileSync\([^,]+,\s*\['run'/);
 assert.match(raw,/INDEPENDENT_OPERATOR/);
 assert.match(raw,/repo\?\.private===false/);
 assert.match(raw,/W06_V3_PREIMAGE_AND_IDLE_READONLY_ONLY/);
});

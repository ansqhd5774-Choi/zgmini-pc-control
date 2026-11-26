import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {parseCanonicalBody,validateRequest,decideUpgradeState,
  TARGET,ORIGINAL,REPLACEMENT,INITIAL_SCOPE,FINAL_SCOPE,
  NEXT_TARGET,NEXT_SOURCE_SHA,R3_REQUEST_ID,R3_MANIFEST_SCHEMA,validateR3Request} from '../watchdog-b/contract.mjs';
import {verifyWatchdogUpgradeSnapshot} from '../watchdog-b/upgrade.mjs';
const digest='a'.repeat(64);
const requestId='pc-watchdog-b-12345678-abcd-4123-8234-abcdef012345';
function fixture(){
 return {
  event:{action:'opened',repository:{full_name:'ansqhd5774-Choi/zgmini-pc-control',private:true},
   sender:{login:'ansqhd5774-Choi'},
   issue:{number:1401,title:'pc-watchdog-b-upgrade',user:{login:'ansqhd5774-Choi'},
    labels:[{name:'pc-maintenance'}]}},
  body:{schema:'ZGMINI_PC_WATCHDOG_B_REQUEST_V1',requestId,
   operation:'watchdog-b-upgrade',targetSha:TARGET,approvalManifestSha256:digest},
  approval:{schema:'ZGMINI_PC_WATCHDOG_B_MANIFEST_V2',approved:true,
   scope:'CONTROL_WATCHDOG_HANDOFF_BRIDGE_B_V1',installedSha256:ORIGINAL,
   targetSha:TARGET,targetSha256:REPLACEMENT,fromScope:INITIAL_SCOPE,
   toScope:FINAL_SCOPE,allowedFiles:['pc-watchdog/runner-watchdog.mjs',
    'pc-watchdog/INSTALL.json'],operation:'watchdog-b-upgrade',approvalBasis:'existing',revision:2,
    expectedControllerSha:'badad9124157879d7a645b64f2768113d632355b',
    protectionPolicy:'CURRENT_CAS_WITH_HISTORICAL_KEY_PRESENCE'},
  installed:{scope:INITIAL_SCOPE,sha256:ORIGINAL,
    startupSha256:'b'.repeat(64),priorStartupSha256:'c'.repeat(64)},
  sourceDigest:REPLACEMENT,approvalDigest:digest
 };
}
const admit=x=>validateRequest(x.event,x.body,x.approval,x.installed,
  x.sourceDigest,x.approvalDigest);
test('exact owner+raw approval+legacy preimage admits a fixed one-time B scope',()=>{
 const p=fixture(),raw=JSON.stringify(p.body);
 assert.deepEqual(parseCanonicalBody(raw),p.body);
 assert.deepEqual(admit(p),{requestId,issueNumber:1401,targetSha:TARGET});
});
test('last-key-wins JSON and noncanonical bodies cannot hide changed commands',()=>{
 const p=fixture();assert.throws(()=>parseCanonicalBody(
   JSON.stringify(p.body).replace(/}\s*$/,',"targetSha":"'+TARGET+'"}')),
   /WATCHDOG_B_REQUEST_NONCANONICAL/);
 assert.throws(()=>parseCanonicalBody(JSON.stringify(p.body,null,2)),
   /WATCHDOG_B_REQUEST_NONCANONICAL/);
});
test('a mismatched actor/label/repo/PR action cannot authorize Windows writes',()=>{
 for(const mutate of [
   p=>p.event.sender.login='outsider',
   p=>p.event.issue.user.login='outsider',
   p=>p.event.issue.labels=[],
   p=>p.event.action='edited',
   p=>p.event.repository.private=false,
   p=>p.event.repository.full_name='outsider/repo'
 ]){
  const p=fixture();mutate(p);
  assert.throws(()=>admit(p),/WATCHDOG_B_UNTRUSTED_EVENT/);
 }
});
test('approval path, target, scope, source and preimage drifts stop',()=>{
 for(const mutate of [
   p=>p.body.operation='run-shell',
   p=>p.body.requestId='../',
   p=>p.approval.approved=false,
   p=>p.approval.allowedFiles.push('tools/handoff-maintenance.mjs'),
   p=>p.approval.toScope='RUNNER_RECOVERY_ONLY',
   p=>p.approval.targetSha256='0'.repeat(64),
   p=>p.sourceDigest='0'.repeat(64),
   p=>p.approvalDigest='0'.repeat(64),
   p=>p.installed.sha256='0'.repeat(64),
   p=>p.installed.scope=FINAL_SCOPE
 ]){
  const p=fixture();mutate(p);
  assert.throws(()=>admit(p),/WATCHDOG_B_(?:REQUEST_CONTRACT|APPROVAL_MISMATCH|INSTALLED_PREIMAGE_MISMATCH)/);
 }
});
test('owner healthy, fresh and no existing claim are mandatory',()=>{
 const t=Date.parse('2026-11-15T03:00:00Z');
 const x={existingClaim:false,installedDigest:ORIGINAL,expectedDigest:ORIGINAL,
  owner:{pid:123},ownerAlive:true,
  status:{state:'HEALTHY',pid:123,at:new Date(t-1000).toISOString()},now:t};
 assert.equal(decideUpgradeState(x),'READY');
 assert.equal(decideUpgradeState({...x,existingClaim:true}),'DUPLICATE_BLOCK');
 assert.equal(decideUpgradeState({...x,installedDigest:'bad'}),'SOURCE_DRIFT_BLOCK');
 assert.equal(decideUpgradeState({...x,ownerAlive:false}),'WATCHDOG_NOT_HEALTHY_BLOCK');
 assert.equal(decideUpgradeState({...x,status:{...x.status,at:new Date(t-100000).toISOString()}}),'WATCHDOG_NOT_HEALTHY_BLOCK');
 assert.equal(decideUpgradeState({...x,status:{...x.status,state:'PAUSED'}}),'WATCHDOG_NOT_HEALTHY_BLOCK');
});

function fixtureR3(){
 const x=fixture();
 x.body={schema:'ZGMINI_PC_WATCHDOG_B_REQUEST_V1',
  requestId:R3_REQUEST_ID,operation:'watchdog-b-upgrade',
  targetSha:NEXT_TARGET,approvalManifestSha256:digest};
 x.approval={...x.approval,
  schema:R3_MANIFEST_SCHEMA,installedSha256:REPLACEMENT,
  targetSha:NEXT_TARGET,targetSha256:NEXT_SOURCE_SHA,
  fromScope:FINAL_SCOPE,toScope:FINAL_SCOPE,revision:3,
  sourceIssueNumber:1378};
 x.installed={...x.installed,scope:FINAL_SCOPE,sha256:REPLACEMENT,
  approvedTargetSourceSha:TARGET};
 x.sourceDigest=NEXT_SOURCE_SHA;
 return x;
}
const admitR3=x=>validateR3Request(x.event,x.body,x.approval,x.installed,
 x.sourceDigest,x.approvalDigest);
test('fixed R3 permits exactly one Watchdog 2-file same-scope B upgrade',()=>{
 const x=fixtureR3();
 assert.deepEqual(admitR3(x),{
  requestId:R3_REQUEST_ID,issueNumber:1401,targetSha:NEXT_TARGET});
});
test('R3 refuses source, installed preimage, scope, manifest or request replay drift',()=>{
 const mutations=[
  x=>x.body.requestId='pc-watchdog-b-12345678-abcd-4123-8234-abcdef012345',
  x=>x.body.targetSha=TARGET,
  x=>x.body.command='cmd.exe',
  x=>x.approval.revision=2,
  x=>x.approval.sourceIssueNumber=1379,
  x=>x.approval.targetSha256='0'.repeat(64),
  x=>x.approval.allowedFiles.push('tools/handoff-maintenance.mjs'),
  x=>x.approval.toScope=INITIAL_SCOPE,
  x=>x.installed.sha256=ORIGINAL,
  x=>x.installed.approvedTargetSourceSha=NEXT_TARGET,
  x=>x.installed.scope=INITIAL_SCOPE,
  x=>x.sourceDigest=REPLACEMENT,
  x=>x.approvalDigest='f'.repeat(64),
  x=>x.event.sender.login='other',
 ];
 for(const mutate of mutations){
  const x=fixtureR3();mutate(x);
  assert.throws(()=>admitR3(x),/WATCHDOG_R3_/);
 }
});
test('R3 snapshot CAS uses exact installed R2 bytes and existing health, no new process kill',()=>{
 const bytes=Buffer.from('preimage');
 const sample={sourceBytes:bytes,installBytes:Buffer.from('{"ok":true}'),
  sourceHash:REPLACEMENT,install:{sha256:REPLACEMENT,scope:FINAL_SCOPE},
  owner:{pid:123},status:{state:'HEALTHY',pid:123,
   at:new Date('2026-11-15T00:00:00Z').toISOString()},
  aliveOwner:true,existingClaim:false,now:Date.parse('2026-11-15T00:00:01Z'),
  expectedSourceSha:REPLACEMENT,expectedScope:FINAL_SCOPE};
 assert.throws(()=>verifyWatchdogUpgradeSnapshot(sample),
  /WATCHDOG_B_PREIMAGE_SHA_MISMATCH/);
 assert.throws(()=>verifyWatchdogUpgradeSnapshot({...sample,existingClaim:true}),
  /WATCHDOG_B_PREIMAGE_SHA_MISMATCH/);
});

import {
 R4_TARGET,R4_SOURCE_SHA256,R4_PREIMAGE_SHA256,R4_INSTALL_PREIMAGE_SHA256,
 R4_MANIFEST_SCHEMA,R4_SCOPE,R4_BASIS,R4_STANDBY,R4_CONTROLLER_FILES,
 validateR4Request,verifyR4ControllerHost,projectR4InstalledManifest,rawSha256
} from '../watchdog-b/standby-r4-contract.mjs';

const R4_CONTROLLER_TARGET='b91340d5047daf753e1c17a5c966e4d2aecea586';

function fixtureR4(){
 const x=fixture();
 x.body.targetSha=R4_TARGET;
 x.approval={
  schema:R4_MANIFEST_SCHEMA,approved:true,scope:R4_SCOPE,
  installedSha256:R4_PREIMAGE_SHA256,
  installedManifestSha256:R4_INSTALL_PREIMAGE_SHA256,
  targetSha:R4_TARGET,targetSha256:R4_SOURCE_SHA256,
  fromScope:FINAL_SCOPE,toScope:FINAL_SCOPE,
  allowedFiles:['pc-watchdog/runner-watchdog.mjs','pc-watchdog/INSTALL.json'],
  operation:'watchdog-b-upgrade',approvalBasis:R4_BASIS,revision:4,
  expectedControllerSha:R4_CONTROLLER_TARGET,
  expectedControllerFiles:{...R4_CONTROLLER_FILES},
  protectionPolicy:'CURRENT_CAS_WITH_HISTORICAL_KEY_PRESENCE',
  standby:{...R4_STANDBY}
 };
 x.installed={scope:FINAL_SCOPE,sha256:R4_PREIMAGE_SHA256,
  approvedTargetSourceSha:NEXT_TARGET,
  startupSha256:'b'.repeat(64),priorStartupSha256:'c'.repeat(64)};
 x.sourceDigest=R4_SOURCE_SHA256;
 x.installedManifestDigest=R4_INSTALL_PREIMAGE_SHA256;
 return x;
}
const admitR4=x=>validateR4Request(x.event,x.body,x.approval,x.installed,
 x.sourceDigest,x.approvalDigest,x.installedManifestDigest);

test('R4 pins exact real Watchdog byte preimage and distinct INSTALL raw hash',()=>{
 assert.equal(rawSha256(Buffer.from('abc')),
  'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
 assert.notEqual(R4_PREIMAGE_SHA256,R4_INSTALL_PREIMAGE_SHA256);
 assert.notEqual(R4_PREIMAGE_SHA256,R4_SOURCE_SHA256);
 const x=fixtureR4(),plan=admitR4(x);
 assert.equal(plan.targetSha,R4_TARGET);
 assert.equal(plan.oldSha,R4_PREIMAGE_SHA256);
 assert.equal(plan.newSha,R4_SOURCE_SHA256);
 assert.equal(plan.oldManifestSha,R4_INSTALL_PREIMAGE_SHA256);
 assert.deepEqual(parseCanonicalBody(JSON.stringify(x.body)),x.body);
});

test('R4 admission fails closed for old manifest drift, approval and wrong source',()=>{
 const mutations=[
  x=>x.event.sender.login='untrusted',
  x=>x.event.issue.labels=[],
  x=>x.body.targetSha=NEXT_TARGET,
  x=>x.body.command='shell',
  x=>x.approval.approved=false,
  x=>x.approval.revision=3,
  x=>x.approval.approvalBasis='other',
  x=>x.approval.scope='OTHER',
  x=>x.approval.expectedControllerSha='invalid',
  x=>x.approval.expectedControllerFiles['controller/standby.mjs']='0'.repeat(64),
  x=>x.approval.targetSha256='0'.repeat(64),
  x=>x.approval.standby.mode='ACTIVE_2_STANDBY_0',
  x=>x.approval.standby.approved=false,
  x=>x.approval.allowedFiles.push('controller/engine.mjs'),
  x=>x.sourceDigest='0'.repeat(64),
  x=>x.approvalDigest='0'.repeat(64),
  x=>x.installedManifestDigest='0'.repeat(64),
  x=>x.installed.sha256='0'.repeat(64),
  x=>x.installed.scope=INITIAL_SCOPE,
  x=>x.installed.standby={mode:'ACTIVE_1_STANDBY_1',approved:true},
  x=>x.installed.approvedTargetSourceSha=TARGET,
 ];
 for(const change of mutations){
  const x=fixtureR4();change(x);
  assert.throws(()=>admitR4(x),/WATCHDOG_R4_/);
 }
});

test('R4 Controller must already be installed with exact five standby file hashes',()=>{
 const host={controllerSourceSha:R4_CONTROLLER_TARGET,controllerFiles:{
  ...R4_CONTROLLER_FILES,'controller/extra.mjs':'d'.repeat(64)}};
 assert.equal(verifyR4ControllerHost(host,R4_CONTROLLER_TARGET),true);
 assert.equal(verifyR4ControllerHost({...host,controllerSourceSha:NEXT_TARGET},NEXT_TARGET),true);
 for(const mutation of [
  x=>{x.controllerSourceSha=NEXT_TARGET;},
  x=>{delete x.controllerFiles['controller/standby.mjs'];},
  x=>{x.controllerFiles['controller/engine.mjs']='f'.repeat(64);},
  x=>{x.controllerFiles=[];}
 ]){
  const actual={controllerSourceSha:host.controllerSourceSha,
   controllerFiles:{...host.controllerFiles}};
  mutation(actual);
  assert.throws(()=>verifyR4ControllerHost(actual,R4_CONTROLLER_TARGET),/WATCHDOG_R4_/);
 }
});

test('R4 projected B stage changes only approved Watchdog fields, never input',()=>{
 const x=fixtureR4(),plan=admitR4(x);
 const installed=structuredClone(x.installed),at='2026-11-26T00:01:00.000Z';
 const changed=projectR4InstalledManifest(installed,plan,at);
 assert.deepEqual(changed,{...installed,sha256:R4_SOURCE_SHA256,
  scope:FINAL_SCOPE,approvedTargetSourceSha:R4_TARGET,
  standby:{mode:'ACTIVE_1_STANDBY_1',approved:true},upgradedAt:at});
 assert.equal(installed.standby,undefined);
 assert.notEqual(changed.sha256,installed.sha256);
 for(const patch of [{...plan,targetSha:NEXT_TARGET},
  {...plan,oldSha:'0'.repeat(64)},undefined]){
  assert.throws(()=>projectR4InstalledManifest(installed,patch,at),
   /WATCHDOG_R4_INSTALL_PROJECTION_INVALID/);
 }
});


test('R4 exact approved service-proof successor binds six Controller bytes and raw manifest',()=>{
 const manifestBytes=fs.readFileSync(
  new URL('../approvals/watchdog-upgrades/'+R4_TARGET+'.json',import.meta.url));
 const candidate=JSON.parse(manifestBytes.toString('utf8'));
 assert.equal(candidate.schema,R4_MANIFEST_SCHEMA);
 assert.equal(candidate.approved,true);
 assert.equal(candidate.targetSha,R4_TARGET);
 assert.equal(candidate.targetSha256,R4_SOURCE_SHA256);
 assert.equal(candidate.installedSha256,R4_PREIMAGE_SHA256);
 assert.equal(candidate.installedManifestSha256,R4_INSTALL_PREIMAGE_SHA256);
 assert.equal(candidate.expectedControllerSha,R4_CONTROLLER_TARGET);
 assert.equal(Object.keys(R4_CONTROLLER_FILES).length,6);
 assert.equal(R4_CONTROLLER_FILES['controller/operations.mjs'],
  'd4a76910806cba861b3253f5fd24eccc8968fcbaa66133999483034b2f661cd3');
 assert.deepEqual(candidate.expectedControllerFiles,R4_CONTROLLER_FILES);
 const fixture=fixtureR4();fixture.approval=candidate;
 const digest=rawSha256(manifestBytes);
 fixture.body.approvalManifestSha256=digest;
 fixture.approvalDigest=digest;
 assert.deepEqual(admitR4(fixture),{
  requestId:fixture.body.requestId,issueNumber:fixture.event.issue.number,
  targetSha:R4_TARGET,oldSha:R4_PREIMAGE_SHA256,newSha:R4_SOURCE_SHA256,
  oldManifestSha:R4_INSTALL_PREIMAGE_SHA256,
  expectedControllerSha:R4_CONTROLLER_TARGET
 });
 const invalid=fixtureR4();invalid.approval={...candidate,approved:false};
 invalid.approvalDigest=digest;invalid.body.approvalManifestSha256=digest;
 assert.throws(()=>admitR4(invalid),/WATCHDOG_R4_APPROVAL_OR_SOURCE_MISMATCH/);
 assert.equal(fs.existsSync(new URL(
  '../approvals/watchdog-upgrades/c0c4dcff6c8071b1318cca956e43ba82718c4975.json',
  import.meta.url)),false);
});


import {
 R5_TARGET,R5_SOURCE_SHA256,R5_PREIMAGE_SHA256,R5_INSTALL_PREIMAGE_SHA256,
 R5_CONTROLLER_SHA,R5_CONTROLLER_FILES,R5_MANIFEST_SCHEMA,R5_SCOPE,R5_BASIS,
 R5_STANDBY,validateR5Request,verifyR5ControllerHost,
 verifyR5FirstStandbyReady,projectR5InstalledManifest,rawSha256 as shaR5
} from '../watchdog-b/standby-r5-contract.mjs';

function fixtureR5(){
 const x=fixtureR4();
 x.body.targetSha=R5_TARGET;
 x.approval={...x.approval,schema:R5_MANIFEST_SCHEMA,scope:R5_SCOPE,
  installedSha256:R5_PREIMAGE_SHA256,
  installedManifestSha256:R5_INSTALL_PREIMAGE_SHA256,
  targetSha:R5_TARGET,targetSha256:R5_SOURCE_SHA256,
  revision:5,approvalBasis:R5_BASIS,
  expectedControllerSha:R5_CONTROLLER_SHA,
  expectedControllerFiles:{...R5_CONTROLLER_FILES},
  standby:{...R5_STANDBY}};
 x.installed={...x.installed,sha256:R5_PREIMAGE_SHA256,
  approvedTargetSourceSha:R4_TARGET,
  standby:{mode:'ACTIVE_1_STANDBY_1',approved:true},
  upgradedAt:'2026-11-26T09:00:00.000Z'};
 x.sourceDigest=R5_SOURCE_SHA256;
 x.installedManifestDigest=R5_INSTALL_PREIMAGE_SHA256;
 return x;
}
const admitR5=x=>validateR5Request(x.event,x.body,x.approval,x.installed,
 x.sourceDigest,x.approvalDigest,x.installedManifestDigest);

test('R5 admission pins exact R4 staged raw bytes and dual-passive target',()=>{
 const x=fixtureR5();
 assert.equal(R5_PREIMAGE_SHA256,R4_SOURCE_SHA256);
 assert.equal(R5_CONTROLLER_SHA,'182bb46f2838306ba40d8b4ec32bac40ab75b69a');
 assert.equal(Object.keys(R5_CONTROLLER_FILES).length,7);
 // R5 approval pins historical immutable source bytes. New Watchdog fixes
 // must never rewrite this approved hash; validate the old exact Git tree.
 const historicalR5=execFileSync('git',
  ['show',R5_TARGET+':tools/runner-watchdog.mjs'],
  {cwd:fileURLToPath(new URL('../',import.meta.url)),encoding:null,
   timeout:15000,maxBuffer:1000000});
 assert.equal(shaR5(historicalR5),R5_SOURCE_SHA256);
 assert.deepEqual(admitR5(x),{
  requestId:x.body.requestId,issueNumber:x.event.issue.number,
  targetSha:R5_TARGET,oldSha:R5_PREIMAGE_SHA256,
  newSha:R5_SOURCE_SHA256,oldManifestSha:R5_INSTALL_PREIMAGE_SHA256,
  expectedControllerSha:R5_CONTROLLER_SHA
 });
 // R4 READY was confirmed by the operating A #3838 (11:08 UTC).
 // The R5 approval is pinned to the exact R4 on-disk source and raw manifest
 // preimage; it must be accepted byte-for-byte, not by synthesized objects.
 const bytes=fs.readFileSync(new URL(
  '../approvals/watchdog-upgrades/'+R5_TARGET+'.json',import.meta.url));
 const actual=JSON.parse(bytes);
 const candidate=fixtureR5();
 candidate.approval=actual;
 candidate.approvalDigest=shaR5(bytes);
 candidate.body.approvalManifestSha256=shaR5(bytes);
 assert.equal(actual.approved,true);
 assert.equal(actual.revision,5);
 assert.deepEqual(actual.standby,{mode:'ACTIVE_1_STANDBY_2',approved:true});
 assert.deepEqual(actual.expectedControllerFiles,R5_CONTROLLER_FILES);
 assert.equal(actual.installedManifestSha256,R5_INSTALL_PREIMAGE_SHA256);
 assert.equal(actual.targetSha256,R5_SOURCE_SHA256);
 assert.equal(admitR5(candidate).newSha,R5_SOURCE_SHA256);
});

test('R5 is blocked on every unapproved effect, hash, source or actor drift',()=>{
 const mutations=[
  x=>{x.event.sender.login='untrusted';},
  x=>{x.event.issue.labels=[];},
  x=>{x.body.targetSha=R4_TARGET;},
  x=>{x.body.command='powershell';},
  x=>{x.body.requestId='unsafe';},
  x=>{x.approval.approved=false;},
  x=>{x.approval.revision=4;},
  x=>{x.approval.scope='OTHER';},
  x=>{x.approval.approvalBasis='other';},
  x=>{x.approval.expectedControllerSha=R4_TARGET;},
  x=>{x.approval.expectedControllerFiles['controller/preimage-manifest-contract.mjs']='f'.repeat(64);},
  x=>{delete x.approval.expectedControllerFiles['controller/standby.mjs'];},
  x=>{x.approval.allowedFiles.push('config/operations.json');},
  x=>{x.approval.targetSha256='f'.repeat(64);},
  x=>{x.approval.installedSha256='f'.repeat(64);},
  x=>{x.approval.installedManifestSha256='f'.repeat(64);},
  x=>{x.approval.standby.mode='ACTIVE_2_STANDBY_1';},
  x=>{x.approval.standby.approved=false;},
  x=>{x.sourceDigest='f'.repeat(64);},
  x=>{x.approvalDigest='f'.repeat(64);},
  x=>{x.installedManifestDigest='f'.repeat(64);},
  x=>{x.installed.sha256='f'.repeat(64);},
  x=>{x.installed.scope='RUNNER_RECOVERY_ONLY';},
  x=>{x.installed.standby.mode='ACTIVE_1_STANDBY_2';},
  x=>{x.installed.approvedTargetSourceSha=R5_TARGET;}
 ];
 for(const mutate of mutations){const x=fixtureR5();mutate(x);
  assert.throws(()=>admitR5(x),/WATCHDOG_R5_/);
 }
});
test('R5 pins W06 seven Controller files without accepting arbitrary successor',()=>{
 const host={controllerSourceSha:R5_CONTROLLER_SHA,controllerFiles:{
  ...R5_CONTROLLER_FILES,'controller/extra.mjs':'a'.repeat(64)}};
 assert.equal(verifyR5ControllerHost(host),true);
 for(const change of [
  x=>{x.controllerSourceSha=R4_TARGET;},
  x=>{delete x.controllerFiles['controller/standby.mjs'];},
  x=>{x.controllerFiles['controller/preimage-manifest-contract.mjs']='0'.repeat(64);},
  x=>{x.controllerFiles=[];}
 ]){const sample=structuredClone(host);change(sample);
  assert.throws(()=>verifyR5ControllerHost(sample),/WATCHDOG_R5_/);
 }
});
function r5Live(){
 const installed={sha256:R4_SOURCE_SHA256,scope:FINAL_SCOPE,
  approvedTargetSourceSha:R4_TARGET,upgradedAt:'2026-11-26T09:00:00.000Z',
  standby:{mode:'ACTIVE_1_STANDBY_1',approved:true}};
 const owner={pid:16011,nonce:'a'.repeat(18),at:'2026-11-26T09:01:00.000Z'};
 const status={pid:16011,state:'HEALTHY',at:'2026-11-26T09:02:00.000Z',
  supervisorPid:16012,standbyRole:'READY',standbyPid:16013};
 const options={now:Date.parse('2026-11-26T09:02:01.000Z'),pidAlive:()=>true};
 return {installed,owner,status,options};
}
test('R5 requires natural R4 process restart with a live Active and one READY Standby',()=>{
 const {installed,owner,status,options}=r5Live();
 assert.equal(verifyR5FirstStandbyReady(installed,owner,status,options),true);
 for(const modify of [
  a=>{a.installed.upgradedAt='2026-11-26T09:01:30.000Z';},
  a=>{a.installed.standby.mode='ACTIVE_1_STANDBY_2';},
  a=>{a.installed.sha256=R5_SOURCE_SHA256;},
  a=>{a.owner.at='2026-11-26T08:59:00.000Z';},
  a=>{a.owner.nonce='short';},
  a=>{a.status.state='BLOCKED';},
  a=>{a.status.standbyRole='STARTING';},
  a=>{a.status.standbyPid=a.status.supervisorPid;},
  a=>{a.status.pid=16014;},
  a=>{a.status.at='2026-11-26T08:59:00.000Z';},
  a=>{a.options.now=Date.parse('2026-11-26T09:05:00.000Z');},
  a=>{a.options.pidAlive=pid=>pid!==16013;},
  a=>{a.options.pidAlive=pid=>pid!==16012;},
  a=>{a.options.pidAlive=pid=>pid!==16011;}
 ]){
  const a={installed:structuredClone(installed),owner:structuredClone(owner),
   status:structuredClone(status),options:{...options}};
  modify(a);
  assert.throws(()=>verifyR5FirstStandbyReady(a.installed,a.owner,a.status,
   a.options),/WATCHDOG_R5_/);
 }
});
test('R5 projected Watchdog B stages only two existing files and target mode',()=>{
 const x=fixtureR5(),p=admitR5(x);
 const original=structuredClone(x.installed),at='2026-11-26T10:25:00.000Z';
 const projected=projectR5InstalledManifest(original,p,at);
 assert.deepEqual(projected,{...original,
  sha256:R5_SOURCE_SHA256,scope:FINAL_SCOPE,
  approvedTargetSourceSha:R5_TARGET,
  standby:{mode:'ACTIVE_1_STANDBY_2',approved:true},upgradedAt:at});
 assert.deepEqual(original,x.installed);
 assert.throws(()=>projectR5InstalledManifest(original,{
  ...p,oldSha:R4_PREIMAGE_SHA256},at),/WATCHDOG_R5_INSTALL_PROJECTION_INVALID/);
 const updater=fs.readFileSync(new URL('../watchdog-b/upgrade.mjs',import.meta.url),'utf8');
 assert.match(updater,/if\(r5\)verifyR5FirstStandbyReady\(/);
 assert.match(updater,/if\(r5\)verifyR5ControllerHost\(/);
 assert.match(updater,/projectR5InstalledManifest\(/);
 assert.match(updater,/result\.standby\?\.mode!=='ACTIVE_1_STANDBY_2'/);
 assert.doesNotMatch(updater,/taskkill\.exe/);
});

import {
 R6_TARGET,R6_SOURCE_SHA256,R6_PREIMAGE_SHA256,R6_INSTALL_PREIMAGE_SHA256,
 R6_MANIFEST_SCHEMA,R6_SCOPE,R6_BASIS,R6_CONTROLLER_SHA,R6_CONTROLLER_FILES,
 validateR6Request,verifyR6ControllerHost,verifyR6TwoStandbysReady,
 projectR6InstalledManifest
} from '../watchdog-b/standby-r6-contract.mjs';
function fixtureR6(){
 const x=fixtureR5();
 const bytes=fs.readFileSync(new URL(
  '../approvals/watchdog-upgrades/'+R6_TARGET+'.json',import.meta.url));
 const original=JSON.parse(bytes);
 x.body.targetSha=R6_TARGET;
 x.body.approvalManifestSha256=shaR5(bytes);
 x.approval=original;
 x.approvalDigest=shaR5(bytes);
 x.installed={...x.installed,sha256:R6_PREIMAGE_SHA256,
  approvedTargetSourceSha:R5_TARGET,
  standby:{mode:'ACTIVE_1_STANDBY_2',approved:true},
  upgradedAt:'2026-11-26T10:00:00.000Z'};
 x.sourceDigest=R6_SOURCE_SHA256;
 x.installedManifestDigest=R6_INSTALL_PREIMAGE_SHA256;
 return x;
}
const admitR6=x=>validateR6Request(x.event,x.body,x.approval,x.installed,
 x.sourceDigest,x.approvalDigest,x.installedManifestDigest);
test('R6 exact safety-only R5 source transition pins live installed A and immutable merged source',()=>{
 const x=fixtureR6(),p=admitR6(x);
 assert.equal(R6_TARGET,'73f517b10422d79968c3e2726b942ffbf8076902');
 assert.equal(R6_PREIMAGE_SHA256,R5_SOURCE_SHA256);
 assert.equal(R6_INSTALL_PREIMAGE_SHA256,
  '5cc8fa6f8b146054d68c003c4738f0dd4b961ccd9bbe0833913537303a78cc61');
 assert.equal(shaR5(fs.readFileSync(new URL('../tools/runner-watchdog.mjs',import.meta.url))),
  R6_SOURCE_SHA256);
 const historicalR5=execFileSync('git',['show',R5_TARGET+':tools/runner-watchdog.mjs'],
  {cwd:fileURLToPath(new URL('../',import.meta.url)),encoding:null,
   timeout:15000,maxBuffer:1000000});
 assert.equal(shaR5(historicalR5),R6_PREIMAGE_SHA256);
 assert.equal(x.approval.schema,R6_MANIFEST_SCHEMA);
 assert.equal(x.approval.revision,6);
 assert.equal(x.approval.scope,R6_SCOPE);
 assert.equal(x.approval.approvalBasis,R6_BASIS);
 assert.deepEqual(x.approval.standby,R5_STANDBY);
 assert.equal(x.approval.targetSha256,R6_SOURCE_SHA256);
 assert.equal(x.approval.installedManifestSha256,R6_INSTALL_PREIMAGE_SHA256);
 assert.deepEqual(x.approval.expectedControllerFiles,R6_CONTROLLER_FILES);
 assert.deepEqual(p,{requestId:x.body.requestId,issueNumber:x.event.issue.number,
  targetSha:R6_TARGET,oldSha:R6_PREIMAGE_SHA256,newSha:R6_SOURCE_SHA256,
  oldManifestSha:R6_INSTALL_PREIMAGE_SHA256,expectedControllerSha:R6_CONTROLLER_SHA});
 const host={controllerSourceSha:R6_CONTROLLER_SHA,controllerFiles:{...R6_CONTROLLER_FILES}};
 assert.equal(verifyR6ControllerHost(host),true);
 assert.throws(()=>verifyR6ControllerHost({...host,controllerFiles:{
  ...host.controllerFiles,'controller/standby.mjs':'f'.repeat(64)
 }}),/WATCHDOG_R5_CONTROLLER_SOURCE_NOT_ATTESTED/);
});
test('R6 rejects changed approval/preimage, invalid actor and old mode, before any B write',()=>{
 const mutations=[
  x=>{x.event.sender.login='other';},
  x=>{x.event.issue.labels=[];},
  x=>{x.body.targetSha=R5_TARGET;},
  x=>{x.approval.approved=false;},
  x=>{x.approval.scope='OTHER';},
  x=>{x.approval.targetSha256='f'.repeat(64);},
  x=>{x.approval.revision=5;},
  x=>{x.approval.allowedFiles.push('controller/supervisor.mjs');},
  x=>{x.sourceDigest='f'.repeat(64);},
  x=>{x.approvalDigest='f'.repeat(64);},
  x=>{x.installedManifestDigest='f'.repeat(64);},
  x=>{x.installed.sha256='f'.repeat(64);},
  x=>{x.installed.approvedTargetSourceSha=R6_TARGET;},
  x=>{x.installed.standby.mode='ACTIVE_1_STANDBY_1';}
 ];
 for(const mutate of mutations){
  const x=fixtureR6();mutate(x);
  assert.throws(()=>admitR6(x),/WATCHDOG_R6_/);
 }
});
test('R6 stages with two live READY standby identities and denies stale or unknown ownership',()=>{
 const installed=fixtureR6().installed;
 const owner={pid:601,nonce:'a'.repeat(36),at:'2026-11-26T12:00:00.000Z'};
 const status={pid:601,state:'HEALTHY',supervisorPid:602,standbyPid:603,
  secondStandbyPid:604,standbyRole:'READY',secondStandbyRole:'READY',
  standbyReadyCount:2,at:'2026-11-26T12:00:12.000Z'};
 const options={now:Date.parse('2026-11-26T12:00:30.000Z'),pidAlive:x=>
  [601,602,603,604].includes(x)};
 assert.equal(verifyR6TwoStandbysReady(installed,owner,status,options),true);
 const mutations=[
  a=>{a.status.secondStandbyRole='UNVERIFIED';},
  a=>{a.status.standbyReadyCount=1;},
  a=>{a.status.supervisorPid=601;},
  a=>{a.status.state='BLOCKED';},
  a=>{a.status.pid=605;},
  a=>{a.status.at='2026-11-26T11:00:00.000Z';},
  a=>{a.owner.nonce='short';},
  a=>{a.installed.sha256='f'.repeat(64);},
  a=>{a.installed.standby.approved=false;},
  a=>{a.options.pidAlive=()=>null;},
  a=>{a.options.pidAlive=x=>x!==604;}
 ];
 for(const mutate of mutations){
  const a={installed:structuredClone(installed),owner:structuredClone(owner),
   status:structuredClone(status),options:{...options}};
  mutate(a);
  assert.throws(()=>verifyR6TwoStandbysReady(
   a.installed,a.owner,a.status,a.options),/WATCHDOG_R6_/);
 }
});
test('R6 only stages existing two-file Watchdog upgrade and preserves active dual standby mode',()=>{
 const x=fixtureR6(),p=admitR6(x);
 const original=structuredClone(x.installed),at='2026-11-26T12:01:00.000Z';
 assert.deepEqual(projectR6InstalledManifest(original,p,at),{
  ...original,sha256:R6_SOURCE_SHA256,scope:FINAL_SCOPE,
  approvedTargetSourceSha:R6_TARGET,
  standby:{mode:'ACTIVE_1_STANDBY_2',approved:true},upgradedAt:at
 });
 assert.deepEqual(original,x.installed);
 assert.throws(()=>projectR6InstalledManifest(original,{
  ...p,oldSha:'f'.repeat(64)},at),/WATCHDOG_R6_INSTALL_PROJECTION_INVALID/);
 const src=fs.readFileSync(new URL('../watchdog-b/upgrade.mjs',import.meta.url),'utf8');
 assert.match(src,/if\(r6\)verifyR6TwoStandbysReady\(/);
 assert.match(src,/if\(r6\)verifyR6ControllerHost\(/);
 assert.match(src,/projectR6InstalledManifest\(/);
 assert.match(src,/result\.approvedTargetSourceSha!==R6_TARGET/);
 assert.match(src,/return publish\('STAGED','WATCHDOG_B_APPROVED_SOURCE_STAGED_AWAITING_NATURAL_RESTART',2\)/);
 assert.doesNotMatch(src,/taskkill\.exe|Stop-Process|process\.kill\(/);
});

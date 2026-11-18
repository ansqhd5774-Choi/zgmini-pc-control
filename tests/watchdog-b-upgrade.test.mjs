import test from 'node:test';
import assert from 'node:assert/strict';
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

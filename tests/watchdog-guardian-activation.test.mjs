import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {validateActivation,statusReady} from '../watchdog-b/guardian-activation.mjs';
import {normalizeResult} from '../watchdog-b/guardian-result.mjs';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const digest=buf=>createHash('sha256').update(buf).digest('hex');
const target='a2ec241d98a2ca93508443deb5b4688ecbccb905';
const replacement='3f99ea3357c6731cc9000bde1273db915cb07ba5fa480718194deb6330c29072';
const requestId='pc-watchdog-activate-31390a2f-c503-4ff1-9858-a960bbc07a0d';
const helperDigest=digest(fs.readFileSync(path.join(root,'watchdog-b/guardian-rotate.vbs')));
const scriptDigest=digest(fs.readFileSync(path.join(root,'watchdog-b/guardian-activation.mjs')));
function fixture(){
 return {
  event:{action:'opened',repository:{full_name:'ansqhd5774-Choi/zgmini-pc-control',private:true},
    sender:{login:'ansqhd5774-Choi'},
    issue:{number:1402,user:{login:'ansqhd5774-Choi'},
      title:'pc-watchdog-guardian-activate',labels:[{name:'pc-maintenance'}]}},
  body:{schema:'ZGMINI_PC_WATCHDOG_ACTIVATION_B_REQUEST_V1',
    requestId,operation:'watchdog-guardian-activate',targetSha:target,
    approvalManifestSha256:'a'.repeat(64)},
  approval:{schema:'ZGMINI_PC_WATCHDOG_ACTIVATION_B_MANIFEST_V3',
    approved:true,scope:'ONE_GUARDIAN_WATCHDOG_PROCESS_ACTIVATION_ONLY',
    targetSha:target,installedSha256:replacement,
    installedScope:'RUNNER_RECOVERY_AND_MAINTENANCE_HANDOFF_V1',
    guardianHelperSha256:helperDigest,
    activationScriptSha256:scriptDigest,
    stageRequestId:'pc-watchdog-b-6935cd13-6579-45b6-9d60-264ac879946b',
    oldStageIssueNumber:1393,
    expectedControllerSha:'badad9124157879d7a645b64f2768113d632355b',
    effect:'ONE_EXACT_WATCHDOG_PROCESS_EXIT_GUARDIAN_RESTART',approvalBasis:'approved'},
  digest:'a'.repeat(64)
 };
}
const check=f=>validateActivation(f.event,f.body,f.approval,f.digest,helperDigest);
test('only authenticated owner, exact source, staged receipt and identity helper are admitted',()=>{
 const x=fixture();assert.deepEqual(check(x),{requestId,issueNumber:1402});
});
test('untrusted actors, arbitrary operations and widened scope never authorize process stop',()=>{
 const mutations=[
  x=>{x.event.sender.login='intruder';},
  x=>{x.event.issue.labels=[];},
  x=>{x.event.issue.title='pc-controller-update';},
  x=>{x.body.requestId='bad';},
  x=>{x.body.requestId='pc-watchdog-activate-aaaa1111-1a11-4a11-8a11-aaaaaaaa1111';},
  x=>{x.body.operation='terminate-process';},
  x=>{x.body.command='cmd.exe';},
  x=>{x.approval.approved=false;},
  x=>{x.approval.scope='ANY_PROCESS_TERMINATION';},
  x=>{x.approval.guardianHelperSha256='0'.repeat(64);},
  x=>{x.approval.activationScriptSha256='0'.repeat(64);},
  x=>{x.approval.oldStageIssueNumber=1372;},
  x=>{x.digest='0'.repeat(64);}
 ];
 for(const mutate of mutations){const x=fixture();mutate(x);
  assert.throws(()=>check(x),/WATCHDOG_ACTIVATION_/);
 }
});
test('on-disk STAGED and recent matching healthy owner are required',()=>{
 const now=Date.parse('2026-11-15T02:00:00Z');
 const x={owner:{pid:444,nonce:'55c14fab-c6db-4e7c-9953-0374a7bdf158'},
  status:{state:'HEALTHY',pid:444,at:new Date(now-1000).toISOString()},
  now,source:replacement,
  manifest:{sha256:replacement,scope:'RUNNER_RECOVERY_AND_MAINTENANCE_HANDOFF_V1',
    approvedTargetSourceSha:target},
  stage:{schema:'ZGMINI_PC_WATCHDOG_B_RESULT_V1',
    requestId:'pc-watchdog-b-6935cd13-6579-45b6-9d60-264ac879946b',
    issueNumber:1393,targetSha:target,targetSourceSha256:replacement,
    status:'STAGED',writes:2}};
 assert.equal(statusReady(x),true);
 for(const mutate of [
  x=>{x.status.pid=778;},
  x=>{x.status.state='PAUSED';},
  x=>{x.stage.status='BLOCKED';},
  x=>{x.stage.writes=1;},
  x=>{x.manifest.scope='RUNNER_RECOVERY_ONLY';},
  x=>{x.source='f'.repeat(64);}
 ]){const v=JSON.parse(JSON.stringify(x));mutate(v);
  assert.throws(()=>statusReady(v),/WATCHDOG_ACTIVATION_/);
 }
});
test('reported PASS requires exact Guardian attestation and different old/new PIDs',()=>{
 const good={status:'PASS',code:'WATCHDOG_GUARDIAN_NEW_RUNTIME_ATTESTED',
  oldPid:443,newPid:444,watchdogFileWrites:0};
 assert.equal(normalizeResult(JSON.stringify(good)).newProcessAttested,true);
 assert.equal(normalizeResult(JSON.stringify({...good,newPid:443})).status,'STATE_UNKNOWN');
 assert.equal(normalizeResult(JSON.stringify({...good,code:'FAKE_PASS'})).status,'STATE_UNKNOWN');
 assert.equal(normalizeResult('garbage').status,'STATE_UNKNOWN');
});
test('fixed identity witness does not contain process-tree termination or arbitrary shell',()=>{
 const helper=fs.readFileSync(path.join(root,'watchdog-b/guardian-rotate.vbs'),'utf8');
 assert.match(helper,/watch\.Terminate\(0\)/);
 assert.match(helper,/wscript\.exe/);
 assert.match(helper,/guardian\.SessionId/);
 assert.match(helper,/WATCHDOG_RUNTIME_ATTESTED/);
 const executableLines=helper.split(/\r?\n/).filter(line=>!/^\s*'/.test(line)).join('\n');
 assert.doesNotMatch(executableLines,/taskkill\s+\/T/i);
 assert.equal((helper.match(/\.Terminate\(0\)/g)||[]).length,1);
});

test('immutable production B manifest pins exact submitted helper and runner bytes',()=>{
 const approved=JSON.parse(fs.readFileSync(path.join(root,
  'approvals/watchdog-activations/a2ec241d98a2ca93508443deb5b4688ecbccb905-r3.json')));
 assert.equal(approved.approved,true);
 // #1395 is a consumed historical authorization. Its source digest must
 // remain the ORIGINAL R3 activation bytes, not silently track new R4 code.
 assert.equal(approved.activationScriptSha256,
  'a1f426c12392389dbfb5ef50ab5c17d44543a5bd74ef3e40903954682df199ab');
 assert.notEqual(approved.activationScriptSha256,scriptDigest);
 assert.equal(approved.guardianHelperSha256,helperDigest);
 assert.equal(approved.effect,'ONE_EXACT_WATCHDOG_PROCESS_EXIT_GUARDIAN_RESTART');
});

test('WMI Guardian helper uses exact argv token parser and never broad flag acceptance',()=>{
 const src=fs.readFileSync(path.join(root,'watchdog-b/guardian-rotate.vbs'),'utf8');
 assert.match(src,/Function ExactWatchdogArgs\(binary,script,raw\)/);
 assert.match(src,/tail=LCase\(script\)/);
 assert.match(src,/If Not ExactWatchdogArgs\(nodePath,scriptPath,watch\.CommandLine\) Then Deny/);
});


import {
 R4_GUARDIAN_TARGET,R4_GUARDIAN_SOURCE_SHA256,R4_GUARDIAN_REQUEST_ID,
 R4_GUARDIAN_INSTALL_RAW_SHA256,
 R4_GUARDIAN_STAGE_REQUEST_ID,R4_GUARDIAN_STAGE_ISSUE,
 R4_GUARDIAN_SCHEMA,R4_GUARDIAN_SCOPE,R4_GUARDIAN_EFFECT,
 R4_GUARDIAN_BASIS,R4_GUARDIAN_CONTROLLER_SHA,R4_GUARDIAN_HELPER_SHA256,
 validateR4GuardianRequest,verifyR4GuardianPrecheck,verifyR4GuardianPostcheck
} from '../watchdog-b/guardian-r4-contract.mjs';

function fixtureR4(){
 const x=fixture();
 x.body={...x.body,targetSha:R4_GUARDIAN_TARGET,
  requestId:R4_GUARDIAN_REQUEST_ID};
 x.approval={
  schema:R4_GUARDIAN_SCHEMA,approved:true,scope:R4_GUARDIAN_SCOPE,
  targetSha:R4_GUARDIAN_TARGET,installedSha256:R4_GUARDIAN_SOURCE_SHA256,
  installedManifestSha256:R4_GUARDIAN_INSTALL_RAW_SHA256,
  installedScope:'RUNNER_RECOVERY_AND_MAINTENANCE_HANDOFF_V1',
  guardianHelperSha256:R4_GUARDIAN_HELPER_SHA256,
  activationScriptSha256:scriptDigest,
  stageRequestId:R4_GUARDIAN_STAGE_REQUEST_ID,
  oldStageIssueNumber:R4_GUARDIAN_STAGE_ISSUE,
  expectedControllerSha:R4_GUARDIAN_CONTROLLER_SHA,
  effect:R4_GUARDIAN_EFFECT,approvalBasis:R4_GUARDIAN_BASIS,
  protectionPolicy:'CURRENT_CAS_WITH_HISTORICAL_KEY_PRESENCE'};
 const {digest:_,...rest}=x;
 return {...rest,approvalDigest:'a'.repeat(64)};
}
const admitR4=x=>validateR4GuardianRequest(x.event,x.body,x.approval,{
 approvalDigest:x.approvalDigest,helperDigest,
 activationScriptDigest:scriptDigest});
function r4Stage(){
 const install={sha256:R4_GUARDIAN_SOURCE_SHA256,
  scope:'RUNNER_RECOVERY_AND_MAINTENANCE_HANDOFF_V1',
  approvedTargetSourceSha:R4_GUARDIAN_TARGET,
  standby:{mode:'ACTIVE_1_STANDBY_1',approved:true},
  upgradedAt:'2026-11-26T10:00:00.000Z'};
 const owner={pid:6101,nonce:'4d20d96c-16f5-4dc1-ac6e-4d0b21eeed2f',
  at:'2026-11-26T09:00:00.000Z'};
 const status={pid:6101,state:'HEALTHY',at:'2026-11-26T10:01:00.000Z'};
 const stage={schema:'ZGMINI_PC_WATCHDOG_B_RESULT_V1',
  requestId:R4_GUARDIAN_STAGE_REQUEST_ID,issueNumber:R4_GUARDIAN_STAGE_ISSUE,
  targetSha:R4_GUARDIAN_TARGET,targetSourceSha256:R4_GUARDIAN_SOURCE_SHA256,
  status:'STAGED',writes:2};
 return {install,sourceDigest:R4_GUARDIAN_SOURCE_SHA256,
  installedManifestDigest:R4_GUARDIAN_INSTALL_RAW_SHA256,owner,status,stage,
  now:Date.parse('2026-11-26T10:02:00.000Z'),pidAlive:()=>true};
}
test('R4 exact Guardian same-purpose B admission is inert without exact authorization',()=>{
 const x=fixtureR4();
 assert.equal(admitR4(x).requestId,R4_GUARDIAN_REQUEST_ID);
 for(const mutate of [
  x=>{x.event.sender.login='stranger';},
  x=>{x.event.issue.labels=[];},
  x=>{x.body.requestId=requestId;},
  x=>{x.body.targetSha=target;},
  x=>{x.body.command='powershell';},
  x=>{x.approval.approved=false;},
  x=>{x.approval.targetSha=target;},
  x=>{x.approval.installedSha256='0'.repeat(64);},
  x=>{x.approval.installedManifestSha256='0'.repeat(64);},
  x=>{x.approval.stageRequestId='fake';},
  x=>{x.approval.oldStageIssueNumber=1393;},
  x=>{x.approval.expectedControllerSha='0'.repeat(40);},
  x=>{x.approval.activationScriptSha256='0'.repeat(64);},
  x=>{x.approval.guardianHelperSha256='0'.repeat(64);},
  x=>{x.approval.protectionPolicy='ANY';},
  x=>{x.approvalDigest='f'.repeat(64);}
 ]){const y=structuredClone(x);mutate(y);
  assert.throws(()=>admitR4(y),/WATCHDOG_R4_GUARDIAN_/);
 }
 // The existing same-purpose one-PID approval is a NEW exact R4 manifest,
 // never a reissue of the consumed R3 #1395 authorization.
 const apPath=path.join(root,'approvals/watchdog-activations/',
  R4_GUARDIAN_TARGET+'-r4.json');
 const bytes=fs.readFileSync(apPath),approval=JSON.parse(bytes);
 assert.equal(approval.approved,true);
 assert.equal(approval.schema,R4_GUARDIAN_SCHEMA);
 assert.equal(approval.scope,R4_GUARDIAN_SCOPE);
 assert.equal(approval.targetSha,R4_GUARDIAN_TARGET);
 assert.equal(approval.installedSha256,R4_GUARDIAN_SOURCE_SHA256);
 assert.equal(approval.installedManifestSha256,
  'a47343964fbf3668d27f77deba69dbfc9b53788775c26ea420eeb3b2509e3805');
 assert.equal(approval.guardianHelperSha256,helperDigest);
 // R4 was consumed by #3837. Its exact historical source SHA must NOT
 // silently change when the successor R5 Guardian code is developed.
 assert.equal(approval.activationScriptSha256,
  '7e41426db2ac7831c23d8567e1651f163ffc75417991f0ff6cbbdb3309af86c1');
 assert.notEqual(approval.activationScriptSha256,scriptDigest);
 assert.equal(approval.stageRequestId,R4_GUARDIAN_STAGE_REQUEST_ID);
 assert.equal(approval.oldStageIssueNumber,R4_GUARDIAN_STAGE_ISSUE);
 assert.equal(approval.expectedControllerSha,R4_GUARDIAN_CONTROLLER_SHA);
 assert.equal(approval.effect,R4_GUARDIAN_EFFECT);
 assert.equal(approval.approvalBasis,R4_GUARDIAN_BASIS);
 const real=fixtureR4();
 real.approval=approval;
 real.approvalDigest=digest(bytes);
 real.body.approvalManifestSha256=digest(bytes);
 // Historic approval cannot be reused with this changed executable.
 assert.throws(()=>admitR4(real),/WATCHDOG_R4_GUARDIAN_APPROVAL_INVALID/);
});
test('R4 Guardian old process must be healthy, pre-stage and WMI-identity attributable',()=>{
 const x=r4Stage();
 assert.equal(verifyR4GuardianPrecheck(x),true);
 for(const mutate of [
  x=>{x.install.standby.mode='ACTIVE_1_STANDBY_2';},
  x=>{x.install.sha256='0'.repeat(64);},
  x=>{x.installedManifestDigest='0'.repeat(64);},
  x=>{x.stage.status='BLOCKED';},
  x=>{x.stage.issueNumber=1393;},
  x=>{x.stage.writes=1;},
  x=>{x.owner.at='2026-11-26T10:01:00.000Z';},
  x=>{x.status.state='BLOCKED';},
  x=>{x.status.standbyRole='READY';},
  x=>{x.status.pid=6102;},
  x=>{x.now=Date.parse('2026-11-26T10:05:00.000Z');},
  x=>{x.pidAlive=()=>false;}
 ]){const y={install:structuredClone(x.install),stage:structuredClone(x.stage),
   status:structuredClone(x.status),owner:structuredClone(x.owner),
   sourceDigest:x.sourceDigest,installedManifestDigest:x.installedManifestDigest,
   now:x.now,pidAlive:x.pidAlive};
  mutate(y);
  assert.throws(()=>verifyR4GuardianPrecheck(y),/WATCHDOG_R4_GUARDIAN_/);
 }
});
test('R4 Guardian attestation requires new exact PID, owner nonce and READY IPC',()=>{
 const x=r4Stage();
 const valid={install:x.install,sourceDigest:x.sourceDigest,
  installedManifestDigest:x.installedManifestDigest,oldOwner:x.owner,
  newOwner:{pid:6201,nonce:'ba6e3d6b-e2b6-48d6-9cb2-7828a65bd87d',
   at:'2026-11-26T10:02:00.000Z'},
  status:{pid:6201,state:'HEALTHY',at:'2026-11-26T10:02:10.000Z',
   supervisorPid:6301,standbyPid:6401,standbyRole:'READY'},
  signalledAt:'2026-11-26T10:01:59.000Z',
  now:Date.parse('2026-11-26T10:02:12.000Z'),pidAlive:()=>true};
 assert.equal(verifyR4GuardianPostcheck(valid),true);
 for(const mutate of [
  x=>{x.newOwner.pid=x.oldOwner.pid;},
  x=>{x.installedManifestDigest='0'.repeat(64);},
  x=>{x.install.standby.mode='ACTIVE_1_STANDBY_2';},
  x=>{x.newOwner.nonce=x.oldOwner.nonce;},
  x=>{x.status.standbyRole='STARTING';},
  x=>{x.status.standbyPid=x.status.supervisorPid;},
  x=>{x.status.state='BLOCKED';},
  x=>{x.status.pid=6000;},
  x=>{x.newOwner.at='2026-11-26T09:00:00.000Z';},
  x=>{x.pidAlive=()=>false;}
 ]){const y={...valid,install:structuredClone(valid.install),
  oldOwner:structuredClone(valid.oldOwner),newOwner:structuredClone(valid.newOwner),
  status:structuredClone(valid.status)};
  mutate(y);
  assert.throws(()=>verifyR4GuardianPostcheck(y),/WATCHDOG_R4_GUARDIAN_/);
 }
});
test('R4 Guardian adapter retains one original ACTIVATE call and exact source guards',()=>{
 const src=fs.readFileSync(path.join(root,'watchdog-b/guardian-activation.mjs'),'utf8');
 assert.equal(src.split("witness('ACTIVATE',owner.pid)").length-1,1);
 assert.ok(src.indexOf('verifyR4GuardianPrecheck(')<src.indexOf('persist(ledger,initial,true)'));
 assert.match(src,/verifyR4GuardianPostcheck\(/);
 assert.match(src,/verifyR5ControllerHost\(/);
 assert.match(src,/selectedSource/);
 assert.match(src,/R4_GUARDIAN_INSTALL_RAW_SHA256/);
 assert.match(src,/installedManifestDigest/);
 const reporter=fs.readFileSync(path.join(root,'watchdog-b/guardian-result.mjs'),'utf8');
 assert.match(reporter,/R4_GUARDIAN_REQUEST_ID/);
 assert.match(reporter,/R4_GUARDIAN_TARGET/);
});

import {
 R5_GUARDIAN_TARGET,R5_GUARDIAN_SOURCE_SHA256,R5_GUARDIAN_REQUEST_ID,
 R5_GUARDIAN_INSTALL_RAW_SHA256,R5_GUARDIAN_STAGE_REQUEST_ID,
 R5_GUARDIAN_STAGE_ISSUE,R5_GUARDIAN_SCHEMA,R5_GUARDIAN_SCOPE,
 R5_GUARDIAN_EFFECT,R5_GUARDIAN_BASIS,R5_GUARDIAN_CONTROLLER_SHA,
 R5_GUARDIAN_HELPER_SHA256,validateR5GuardianRequest,
 verifyR5GuardianPrecheck,verifyR5GuardianPostcheck
} from '../watchdog-b/guardian-r5-contract.mjs';

function fixtureR5(){
 const x=fixtureR4();
 x.body={...x.body,targetSha:R5_GUARDIAN_TARGET,
  requestId:R5_GUARDIAN_REQUEST_ID};
 x.approval={...x.approval,schema:R5_GUARDIAN_SCHEMA,
  scope:R5_GUARDIAN_SCOPE,targetSha:R5_GUARDIAN_TARGET,
  installedSha256:R5_GUARDIAN_SOURCE_SHA256,
  installedManifestSha256:R5_GUARDIAN_INSTALL_RAW_SHA256,
  guardianHelperSha256:R5_GUARDIAN_HELPER_SHA256,
  stageRequestId:R5_GUARDIAN_STAGE_REQUEST_ID,
  oldStageIssueNumber:R5_GUARDIAN_STAGE_ISSUE,
  expectedControllerSha:R5_GUARDIAN_CONTROLLER_SHA,
  effect:R5_GUARDIAN_EFFECT,approvalBasis:R5_GUARDIAN_BASIS,
  activationScriptSha256:scriptDigest};
 return x;
}
const admitR5=x=>validateR5GuardianRequest(x.event,x.body,x.approval,{
 approvalDigest:x.approvalDigest,helperDigest,
 activationScriptDigest:scriptDigest});
function r5Stage(){
 const install={sha256:R5_GUARDIAN_SOURCE_SHA256,
  scope:'RUNNER_RECOVERY_AND_MAINTENANCE_HANDOFF_V1',
  approvedTargetSourceSha:R5_GUARDIAN_TARGET,
  standby:{mode:'ACTIVE_1_STANDBY_2',approved:true},
  upgradedAt:'2026-11-26T11:00:00.000Z'};
 const owner={pid:6101,nonce:'4d20d96c-16f5-4dc1-ac6e-4d0b21eeed2f',
  at:'2026-11-26T10:00:00.000Z'};
 const status={pid:6101,state:'HEALTHY',at:'2026-11-26T11:01:00.000Z',
  supervisorPid:6301,standbyPid:6401,standbyRole:'READY'};
 const stage={schema:'ZGMINI_PC_WATCHDOG_B_RESULT_V1',
  requestId:R5_GUARDIAN_STAGE_REQUEST_ID,issueNumber:R5_GUARDIAN_STAGE_ISSUE,
  targetSha:R5_GUARDIAN_TARGET,targetSourceSha256:R5_GUARDIAN_SOURCE_SHA256,
  status:'STAGED',writes:2};
 return {install,sourceDigest:R5_GUARDIAN_SOURCE_SHA256,
  installedManifestDigest:R5_GUARDIAN_INSTALL_RAW_SHA256,
  stage,owner,status,now:Date.parse('2026-11-26T11:02:00.000Z'),
  pidAlive:()=>true};
}
test('R5 exact Guardian B requires independent version and approved raw source',()=>{
 const x=fixtureR5();
 assert.equal(admitR5(x).requestId,R5_GUARDIAN_REQUEST_ID);
 for(const mutate of [
  x=>{x.body.requestId=R4_GUARDIAN_REQUEST_ID;},
  x=>{x.body.targetSha=R4_GUARDIAN_TARGET;},
  x=>{x.body.command='taskkill';},
  x=>{x.event.issue.labels=[];},
  x=>{x.approval.approved=false;},
  x=>{x.approval.installedSha256=R4_GUARDIAN_SOURCE_SHA256;},
  x=>{x.approval.installedManifestSha256=R4_GUARDIAN_INSTALL_RAW_SHA256;},
  x=>{x.approval.targetSha=R4_GUARDIAN_TARGET;},
  x=>{x.approval.stageRequestId=R4_GUARDIAN_STAGE_REQUEST_ID;},
  x=>{x.approval.oldStageIssueNumber=3784;},
  x=>{x.approval.activationScriptSha256='0'.repeat(64);},
  x=>{x.approval.effect='ANY_PROCESS_KILL';},
  x=>{x.approvalDigest='f'.repeat(64);}
 ]){const t=structuredClone(x);mutate(t);
  assert.throws(()=>admitR5(t),/WATCHDOG_R5_GUARDIAN_/);
 }
 // Approval awaits byte-for-byte source hash and exact CI of this PR.
 assert.equal(fs.existsSync(path.join(root,'approvals/watchdog-activations/',
  R5_GUARDIAN_TARGET+'-r5.json')),false);
});
test('R5 Guardian rejects staged source if previous R4 1+1 READY not proven',()=>{
 const x=r5Stage();assert.equal(verifyR5GuardianPrecheck(x),true);
 for(const mutate of [
  x=>{x.installedManifestDigest='f'.repeat(64);},
  x=>{x.sourceDigest=R4_GUARDIAN_SOURCE_SHA256;},
  x=>{x.install.standby.mode='ACTIVE_1_STANDBY_1';},
  x=>{x.stage.requestId=R4_GUARDIAN_STAGE_REQUEST_ID;},
  x=>{x.stage.status='RUNNING';},
  x=>{x.stage.writes=1;},
  x=>{x.owner.at='2026-11-26T11:01:00.000Z';},
  x=>{x.status.standbyRole='STARTING';},
  x=>{x.status.secondStandbyRole='READY';},
  x=>{x.status.standbyPid=x.status.supervisorPid;},
  x=>{x.status.state='BLOCKED';},
  x=>{x.pidAlive=()=>false;}
 ]){
  const t={...x,install:structuredClone(x.install),stage:structuredClone(x.stage),
   owner:structuredClone(x.owner),status:structuredClone(x.status)};
  mutate(t);
  assert.throws(()=>verifyR5GuardianPrecheck(t),/WATCHDOG_R5_GUARDIAN_/);
 }
});
test('R5 Guardian postcheck requires one Active and precisely two live READY IPCs',()=>{
 const x=r5Stage();
 const valid={install:x.install,sourceDigest:x.sourceDigest,
  installedManifestDigest:x.installedManifestDigest,oldOwner:x.owner,
  oldStatus:x.status,
  newOwner:{pid:6201,nonce:'b90ae689-0adf-4bf9-a74a-43cb0f8b14e6',
   at:'2026-11-26T11:02:10.000Z'},
  status:{pid:6201,state:'HEALTHY',at:'2026-11-26T11:02:20.000Z',
   supervisorPid:6301,standbyPid:6501,standbyRole:'READY',
   secondStandbyPid:6502,secondStandbyRole:'READY',standbyReadyCount:2},
  signalledAt:'2026-11-26T11:02:09.000Z',
  now:Date.parse('2026-11-26T11:02:25.000Z'),pidAlive:()=>true};
 assert.equal(verifyR5GuardianPostcheck(valid),true);
 for(const mutate of [
  t=>{t.installedManifestDigest='0'.repeat(64);},
  t=>{t.newOwner.pid=t.oldOwner.pid;},
  t=>{t.newOwner.nonce=t.oldOwner.nonce;},
  t=>{t.status.secondStandbyRole='STARTING';},
  t=>{t.status.standbyReadyCount=1;},
  t=>{t.status.secondStandbyPid=t.status.standbyPid;},
  t=>{t.status.secondStandbyPid=t.status.supervisorPid;},
  t=>{t.status.supervisorPid=9999;},
  t=>{t.status.standbyRole='STARTING';},
  t=>{t.status.state='BLOCKED';},
  t=>{t.pidAlive=()=>false;}
 ]){
  const t={...valid,oldOwner:structuredClone(valid.oldOwner),
   oldStatus:structuredClone(valid.oldStatus),install:structuredClone(valid.install),
   newOwner:structuredClone(valid.newOwner),status:structuredClone(valid.status)};
  mutate(t);
  assert.throws(()=>verifyR5GuardianPostcheck(t),/WATCHDOG_R5_GUARDIAN_/);
 }
});
test('R5 Guardian executor retains exactly one ACTIVATE and no extra B runner',()=>{
 const src=fs.readFileSync(path.join(root,'watchdog-b/guardian-activation.mjs'),'utf8');
 const reporter=fs.readFileSync(path.join(root,'watchdog-b/guardian-result.mjs'),'utf8');
 assert.equal(src.split("witness('ACTIVATE',owner.pid)").length-1,1);
 assert.ok(src.indexOf('verifyR5GuardianPrecheck(')<src.indexOf('persist(ledger,initial,true)'));
 assert.match(src,/verifyR5GuardianPostcheck\(/);
 assert.match(src,/R5_GUARDIAN_INSTALL_RAW_SHA256/);
 assert.match(src,/verifyR5ControllerHost\(/);
 assert.match(reporter,/R5_GUARDIAN_REQUEST_ID/);
 assert.match(reporter,/VERIFY_R5_ACTIVE_AND_TWO_STANDBY_RUNTIME/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {
 R6_GUARDIAN_TARGET,R6_GUARDIAN_SOURCE_SHA256,R6_GUARDIAN_INSTALL_RAW_SHA256,
 R6_GUARDIAN_REQUEST_ID,R6_GUARDIAN_STAGE_REQUEST_ID,R6_GUARDIAN_STAGE_ISSUE,
 R6_GUARDIAN_SCHEMA,R6_GUARDIAN_SCOPE,R6_GUARDIAN_EFFECT,R6_GUARDIAN_BASIS,
 R6_GUARDIAN_CONTROLLER_SHA,R6_GUARDIAN_HELPER_SHA256,
 validateR6GuardianRequest,verifyR6GuardianPrecheck,verifyR6GuardianPostcheck
} from '../watchdog-b/guardian-r6-contract.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const source=fs.readFileSync(new URL('../watchdog-b/guardian-activation.mjs',import.meta.url));
const sourceDigest=sha(source);
const helperDigest=sha(fs.readFileSync(new URL('../watchdog-b/guardian-rotate.vbs',import.meta.url)));
const manifestBytes=fs.readFileSync(new URL(
 '../approvals/watchdog-activations/8bdeca9b55457fc9c9d35585aacd7eea14af63f0-r6.json',
 import.meta.url));
const manifest=JSON.parse(manifestBytes);
function event(){
 return {action:'opened',
  repository:{full_name:'ansqhd5774-Choi/zgmini-pc-control',private:true},
  sender:{login:'ansqhd5774-Choi'},
  issue:{number:4201,user:{login:'ansqhd5774-Choi'},
   title:'pc-watchdog-guardian-activate',labels:[{name:'pc-maintenance'}]}};
}
function requested(){
 return {schema:'ZGMINI_PC_WATCHDOG_ACTIVATION_B_REQUEST_V1',
  requestId:R6_GUARDIAN_REQUEST_ID,operation:'watchdog-guardian-activate',
  targetSha:R6_GUARDIAN_TARGET,approvalManifestSha256:sha(manifestBytes)};
}
const options=()=>({approvalDigest:sha(manifestBytes),helperDigest,
 activationScriptDigest:sourceDigest});
function ready(){
 return {
  install:{sha256:R6_GUARDIAN_SOURCE_SHA256,
   scope:'RUNNER_RECOVERY_AND_MAINTENANCE_HANDOFF_V1',
   approvedTargetSourceSha:R6_GUARDIAN_TARGET,
   standby:{mode:'ACTIVE_1_STANDBY_2',approved:true},
   upgradedAt:'2026-11-26T11:00:00Z'},
  sourceDigest:R6_GUARDIAN_SOURCE_SHA256,
  installedManifestDigest:R6_GUARDIAN_INSTALL_RAW_SHA256,
  stage:{schema:'ZGMINI_PC_WATCHDOG_B_RESULT_V1',
   requestId:R6_GUARDIAN_STAGE_REQUEST_ID,issueNumber:R6_GUARDIAN_STAGE_ISSUE,
   targetSha:R6_GUARDIAN_TARGET,targetSourceSha256:R6_GUARDIAN_SOURCE_SHA256,
   status:'STAGED',writes:2},
  owner:{pid:6101,nonce:'4d20d96c-16f5-4dc1-ac6e-4d0b21eeed2f',
   at:'2026-11-26T10:00:00Z'},
  status:{pid:6101,state:'HEALTHY',at:'2026-11-26T11:01:00Z',
   supervisorPid:6301,standbyPid:6401,standbyRole:'READY',
   secondStandbyPid:6402,secondStandbyRole:'READY',standbyReadyCount:2},
  now:Date.parse('2026-11-26T11:01:30Z'),pidAlive:()=>true
 };
}
test('R6 exact staged immutable Guardian approval allows one specific owner only',()=>{
 assert.equal(manifest.schema,R6_GUARDIAN_SCHEMA);
 assert.equal(manifest.scope,R6_GUARDIAN_SCOPE);
 assert.equal(manifest.approved,true);
 assert.equal(manifest.targetSha,R6_GUARDIAN_TARGET);
 assert.equal(manifest.installedSha256,R6_GUARDIAN_SOURCE_SHA256);
 assert.equal(manifest.installedManifestSha256,R6_GUARDIAN_INSTALL_RAW_SHA256);
 assert.equal(manifest.guardianHelperSha256,R6_GUARDIAN_HELPER_SHA256);
 assert.equal(manifest.activationScriptSha256,sourceDigest);
 assert.equal(helperDigest,R6_GUARDIAN_HELPER_SHA256);
 assert.equal(manifest.stageRequestId,R6_GUARDIAN_STAGE_REQUEST_ID);
 assert.equal(manifest.oldStageIssueNumber,R6_GUARDIAN_STAGE_ISSUE);
 assert.equal(manifest.expectedControllerSha,R6_GUARDIAN_CONTROLLER_SHA);
 assert.equal(manifest.effect,R6_GUARDIAN_EFFECT);
 assert.equal(manifest.approvalBasis,R6_GUARDIAN_BASIS);
 assert.equal(validateR6GuardianRequest(event(),requested(),manifest,options()).requestId,
  R6_GUARDIAN_REQUEST_ID);
 for(const change of [
  x=>{x.issue.labels=[];},
  x=>{x.sender.login='bot';},
  x=>{x.issue.user.login='bot';}
 ]){
  const e=structuredClone(event());change(e);
  assert.throws(()=>validateR6GuardianRequest(e,requested(),manifest,options()),
   /WATCHDOG_R6_GUARDIAN_/);
 }
 for(const [kind,change] of [
  ['original',x=>{x.requestId='pc-watchdog-activate-4d9b6a73-cc80-4b8b-920f-e5f3d62465b1';}],
  ['effect',x=>{x.operation='any-process-stop';}],
  ['digest',x=>{x.approvalManifestSha256='0'.repeat(64);}],
  ['extra',x=>{x.shell='powershell.exe';}]
 ]){
  const body=requested();change(body);
  assert.throws(()=>validateR6GuardianRequest(event(),body,manifest,options()),
   /WATCHDOG_R6_GUARDIAN_REQUEST_INVALID/,kind);
 }
 for(const change of [
  x=>{x.approved=false;},x=>{x.stageRequestId='fake';},
  x=>{x.installedManifestSha256='0'.repeat(64);},
  x=>{x.expectedControllerSha='0'.repeat(40);},
  x=>{x.effect='TERMINATE_RUNNERS';},
  x=>{x.activationScriptSha256='0'.repeat(64);},
  x=>{x.guardianHelperSha256='0'.repeat(64);}
 ]){
  const approval=structuredClone(manifest);change(approval);
  assert.throws(()=>validateR6GuardianRequest(event(),requested(),approval,options()),
   /WATCHDOG_R6_GUARDIAN_APPROVAL_INVALID/);
 }
});

test('R6 prestop requires healthy old Watchdog and two independent READY standby PIDs',()=>{
 const x=ready();
 assert.equal(verifyR6GuardianPrecheck(x),true);
 for(const mutate of [
  x=>{x.installedManifestDigest='0'.repeat(64);},
  x=>{x.owner.at=x.install.upgradedAt;},
  x=>{x.status.secondStandbyRole='STARTING';},
  x=>{x.status.standbyReadyCount=1;},
  x=>{x.status.secondStandbyPid=x.status.standbyPid;},
  x=>{x.status.supervisorPid=x.status.standbyPid;},
  x=>{x.status.state='BLOCKED';},
  x=>{x.status.at='2026-11-26T10:59:00Z';},
  x=>{x.stage.status='BLOCKED';},
  x=>{x.stage.issueNumber=4122;},
  x=>{x.pidAlive=()=>false;}
 ]){
  const candidate={...x,install:structuredClone(x.install),
   owner:structuredClone(x.owner),status:structuredClone(x.status),
   stage:structuredClone(x.stage)};
  mutate(candidate);
  assert.throws(()=>verifyR6GuardianPrecheck(candidate),/WATCHDOG_R6_GUARDIAN_/);
 }
});

test('R6 postcheck reattests one new Guardian PID with same Supervisor and READY2',()=>{
 const prior=ready();
 const x={install:prior.install,sourceDigest:prior.sourceDigest,
  installedManifestDigest:prior.installedManifestDigest,oldOwner:prior.owner,
  oldStatus:prior.status,
  newOwner:{pid:6201,nonce:'b90ae689-0adf-4bf9-a74a-43cb0f8b14e6',
   at:'2026-11-26T11:02:10Z'},
  status:{...prior.status,pid:6201,standbyPid:6501,secondStandbyPid:6502,
   at:'2026-11-26T11:02:20Z'},
  signalledAt:'2026-11-26T11:02:09Z',
  now:Date.parse('2026-11-26T11:02:30Z'),pidAlive:()=>true};
 assert.equal(verifyR6GuardianPostcheck(x),true);
 for(const mutate of [
  x=>{x.newOwner.pid=x.oldOwner.pid;},
  x=>{x.newOwner.nonce=x.oldOwner.nonce;},
  x=>{x.status.supervisorPid=6302;},
  x=>{x.status.standbyRole='STARTING';},
  x=>{x.status.secondStandbyRole='STARTING';},
  x=>{x.status.secondStandbyPid=x.status.standbyPid;},
  x=>{x.status.standbyReadyCount=1;},
  x=>{x.status.at='2026-11-26T11:01:00Z';},
  x=>{x.pidAlive=()=>null;}
 ]){
  const y={...x,newOwner:structuredClone(x.newOwner),
   status:structuredClone(x.status)};mutate(y);
  assert.throws(()=>verifyR6GuardianPostcheck(y),/WATCHDOG_R6_GUARDIAN_/);
 }
});

test('R6 adds no new process stop or maintenance bypass to original Guardian',()=>{
 const script=source.toString('utf8');
 const report=fs.readFileSync(new URL('../watchdog-b/guardian-result.mjs',import.meta.url),'utf8');
 assert.equal(script.split("witness('ACTIVATE',owner.pid)").length-1,1);
 assert.ok(script.indexOf('verifyR6GuardianPrecheck(')<
   script.indexOf('persist(ledger,initial,true)'));
 assert.match(script,/verifyR6ControllerHost\(/);
 assert.match(script,/verifyR6GuardianPostcheck\(/);
 assert.match(script,/R6_GUARDIAN_INSTALL_RAW_SHA256/);
 assert.match(report,/R6_GUARDIAN_REQUEST_ID/);
 assert.match(report,/VERIFY_R6_ACTIVE_AND_TWO_STANDBY_RUNTIME/);
 assert.doesNotMatch(script,/taskkill\.exe|Stop-Process|process\.kill\([^)]*,\s*9\)/);
});

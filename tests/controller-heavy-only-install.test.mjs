import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {
  MAINTENANCE_ISSUE_SCHEMA,UPDATE_SCHEMA,CONTROL_REPOSITORY,
  manifestFingerprint,validateUpdateRequest,validateControllerOnlyInstallDelta,
  validateControllerConfigTransition,controllerAdmissionForPurpose,
} from '../tools/maintenance-contract.mjs';

const sha256=x=>createHash('sha256').update(x).digest('hex');
const installedSha='11899a1a16ea77a6ecc7a579997814cde9ded76f';
const targetSha='db8924162d42adf6ee6aa27a04ce1719c8fe96c2';
const files=[
  {path:'config/operations.json',sha256:'adb51940324f8835d1b11e0769c3e1bed08713f5caee132aa5139276825a618d'},
  {path:'controller/operations.mjs',sha256:'39a80cd819268c40787bb2b6f964184774a2d9d3709d99a9c4d1e304d1bff6df'},
];
const makeManifest=(overrides={})=>({
  schema:UPDATE_SCHEMA,installedSha,targetSha,allowFiles:files,
  purpose:'pc-controller-heavy-readonly',controllerOnlyInstall:true,
  approval:{grade:'B',scope:'PC_CONTROL_HEAVY_READONLY_UPDATE',
    ref:'https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/552'},
  checks:{targetSha,status:'PASS',manifestSha256:manifestFingerprint(files).sha256},
  backup:{strategy:'VERSIONED_SNAPSHOT',
    rollback:{kind:'RESTORE_INSTALLED_SHA',sha:installedSha}},
  postOperation:'core-status',postSourceBranch:'main',
  postSourceSha:'64736e21435f2757a7f4e878db4d892bd4b9fc01',
  ...overrides,
});
const validate=manifest=>{
  const bytes=Buffer.from(JSON.stringify(manifest));
  const issue={schema:MAINTENANCE_ISSUE_SCHEMA,
    requestId:'pc-12345678-1234-4123-8123-123456789abc',
    chatId:'chat-12345678-1234-4123-8123-123456789abc',
    operation:'controller-update',controlRepository:CONTROL_REPOSITORY,
    targetControllerSha:targetSha,approvalManifestSha256:sha256(bytes)};
  return validateUpdateRequest(issue,bytes,{actor:'ansqhd5774-Choi',installedSha});
};
const prev={seats:6,mutationsEnabled:false,maxHeavyJobs:1,operations:{
  'core-status':{grade:'A',resource:'light',timeoutSeconds:60},
}};
const next={...prev,operations:{...prev.operations,
  'theme-platform-shadow-readonly':{grade:'A',resource:'heavy',
    timeoutSeconds:240,minimumFreeMiB:1536},
}};

test('exact two-file B heavy readonly controller-only manifest accepted',()=>{
  const result=validate(makeManifest());
  assert.equal(result.manifest.purpose,'pc-controller-heavy-readonly');
  assert.equal(result.manifest.controllerOnlyInstall,true);
  assert.deepEqual(result.manifest.allowFiles.map(f=>f.path),files.map(f=>f.path));
  assert.equal(validateControllerOnlyInstallDelta(files.map(f=>f.path),files),true);
  assert.equal(validateControllerConfigTransition(prev,next,
    controllerAdmissionForPurpose(result.manifest.purpose)),true);
});

test('original light controller maintenance controller-only path remains accepted',()=>{
  const result=validate(makeManifest({purpose:'pc-controller-maintenance',
    approval:{grade:'B',scope:'PC_CONTROL_CONTROLLER_UPDATE',
      ref:'https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/552'}}));
  assert.equal(result.manifest.controllerOnlyInstall,true);
});

test('new heavy A cannot use ordinary light controller maintenance purpose',()=>{
  assert.throws(()=>validateControllerConfigTransition(prev,next,
    controllerAdmissionForPurpose('pc-controller-maintenance')),
  /CONTROLLER_NEW_OPERATION_NOT_READONLY_A/);
});

test('moderate purpose cannot claim controller-only heavy exception',()=>{
  assert.throws(()=>validate(makeManifest({purpose:'pc-controller-moderate-readonly',
    approval:{grade:'B',scope:'PC_CONTROL_MODERATE_READONLY_UPDATE',
      ref:'https://github.com/ansqhd5774-Choi/zgmini-pc-control/pull/552'}})),
  /CONTROLLER_ONLY_INSTALL_SCOPE_INVALID/);
});

test('controller-only scope still forbids infrastructureEvidence and false flags',()=>{
  assert.throws(()=>validate(makeManifest({infrastructureEvidence:{}})),
    /CONTROLLER_ONLY_INSTALL_SCOPE_INVALID/);
  assert.throws(()=>validate(makeManifest({controllerOnlyInstall:false})),
    /CONTROLLER_ONLY_INSTALL_SCOPE_INVALID/);
});

test('extra Controller file and live workflow change cannot pass exact two-file scope',()=>{
  assert.throws(()=>validateControllerOnlyInstallDelta(
    [...files.map(f=>f.path),'controller/other.mjs'],files),
  /ALLOWFILE_DIFF_MISMATCH/);
  assert.throws(()=>validateControllerOnlyInstallDelta(
    [...files.map(f=>f.path),'.github/workflows/pc-job.yml'],files),
  /CONTROLLER_ONLY_LIVE_WORKFLOW_CHANGED/);
});

test('existing six-seat policy and existing A operation cannot drift',()=>{
  assert.throws(()=>validateControllerConfigTransition(prev,
    {...next,maxHeavyJobs:2},controllerAdmissionForPurpose('pc-controller-heavy-readonly')),
  /CONTROLLER_CONFIG_PROTECTED_POLICY_CHANGED/);
  assert.throws(()=>validateControllerConfigTransition(prev,
    {...next,operations:{...next.operations,'core-status':{grade:'B'}}},
    controllerAdmissionForPurpose('pc-controller-heavy-readonly')),
  /CONTROLLER_EXISTING_OPERATION_CHANGED/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDispatcherForTrustedNativeReceiver,dispatchConfiguredRuntimeB,
  REQUIRED_MANUAL_COMMANDS,SCHEMA,
} from './configured-runtime-b-dispatcher.mjs';

const hash40 = 'a'.repeat(40);
const hash64 = 'b'.repeat(64);
const manifest = 'c'.repeat(64);
const task = 'd'.repeat(64);
const token = 'e'.repeat(64);
const request = {requestId: 'github-request-823'};

function fixture() {
  const calls = [];
  const approval = {
    repository: 'ansqhd5774-Choi/zgmini',
    runnerPath: 'scripts/pc-writer/theme-config-package-runner.mjs',
    effect: 'CONFIGURED_THEMES_REPEAT_UPGRADE',
    requestId: request.requestId, sourceSha: hash40,
    approvalSha256: hash64, packageManifestSha256: manifest,
    packageRoot: 'C:/approved-staging/theme-config-package',
  };
  const windows = {
    os: 'win32', runtimeMode: 'REPEATABLE_ACTIVE_RUNTIME',
    sourceSha: hash40, taskXmlSha256: task,
    activeRuntimeSha256: token, compatibilityEvidenceSha256: hash64,
  };
  const receiver = {
    async verifyApprovedPackage(id) {
      calls.push('approved');
      assert.equal(id,request.requestId);
      return approval;
    },
    async verifyWindowsCompatibility(value) {
      calls.push('compatibility');assert.equal(value,approval);return windows;
    },
    async loadPinnedPackageRunner(value) {
      calls.push('load');assert.equal(value,approval);
      return {sourceSha: hash40, packageManifestSha256: manifest,
        runConfiguredPackage: ({mode,packageRoot}) => {
          calls.push(mode);
          assert.equal(packageRoot,approval.packageRoot);
          return mode === 'preflight' ?
            {status:'PREFLIGHT_PASS',sourceSha:hash40,
              manifestSha256:manifest,changed:0} :
            {status:'CONFIGURED_AUTO_PUBLISH_UPGRADE_INSTALLED',
              sourceSha:hash40,changed:1};
        },
      };
    },
    async consumeOneShotAuthorization({approval: a,windows: w,preflight}) {
      calls.push('consume');
      assert.equal(a,approval);assert.equal(w,windows);
      assert.equal(preflight.status,'PREFLIGHT_PASS');
      return {requestId:request.requestId,approvalSha256:hash64,
        sourceSha:hash40,receiptSha256:token};
    },
    async verifyInstalledReadback({result}) {
      calls.push('readback');
      assert.equal(result.changed,1);
      return {status:'VERIFIED',sourceSha:hash40,
        packageManifestSha256:manifest,taskXmlSha256:task,
        activeRuntimeVersion:'v123',manualCommandsVerified:3,
        rollbackRecordVerified:true};
    },
  };
  return {calls,approval,windows,receiver};
}

const configured = receiver =>
  createDispatcherForTrustedNativeReceiver(async () => receiver)(request);

test('production default has no installed native bridge: no effect',async()=>{
  const result = await dispatchConfiguredRuntimeB(request);
  assert.equal(result.schema,SCHEMA);
  assert.equal(result.status,'BLOCKED');
  assert.equal(result.reason,'B_FIXED_NATIVE_RECEIVER_NOT_INSTALLED');
  assert.equal(result.effectAttempted,false);
  assert.equal(result.retryAllowed,false);
});

test('fixed receiver DI uses existing package preflight then install once',async()=>{
  const {calls,receiver} = fixture();
  const result = await configured(receiver);
  assert.equal(result.status,'DONE');
  assert.deepEqual(calls,[
    'approved','compatibility','load','preflight','consume','install','readback',
  ]);
});

test('Issue cannot provide its own methods or source approval',async()=>{
  const {calls,receiver} = fixture();
  const evil = {...request,runConfiguredPackage:()=>{throw Error('effect!');},
    approved:true,sourceSha:'f'.repeat(40)};
  const result = await createDispatcherForTrustedNativeReceiver(
    async()=>receiver)(evil);
  assert.equal(result.status,'DONE');
  assert.deepEqual(calls.filter(x=>x==='install'),['install']);
});

test('unknown native loader blocks before preflight/install',async()=>{
  const result = await createDispatcherForTrustedNativeReceiver(
    async()=>{throw Object.assign(Error('unavailable'),{code:'B_BRIDGE_ABSENT'})})(request);
  assert.equal(result.status,'BLOCKED');
  assert.equal(result.reason,'B_BRIDGE_ABSENT');
  assert.equal(result.effectAttempted,false);
});

test('source mismatch blocks before invoking runner',async()=>{
  const {calls,receiver,approval} = fixture();
  approval.runnerPath='scripts/unapproved-install.mjs';
  const result = await configured(receiver);
  assert.equal(result.status,'BLOCKED');
  assert.equal(result.reason,'B_APPROVAL_SOURCE_PIN');
  assert.deepEqual(calls,['approved']);
});

test('missing Windows compatibility proof blocks',async()=>{
  const {calls,receiver,windows} = fixture();
  windows.compatibilityEvidenceSha256=null;
  const result = await configured(receiver);
  assert.equal(result.status,'BLOCKED');
  assert.equal(result.reason,'B_WINDOWS_REPEAT_COMPATIBILITY');
  assert.deepEqual(calls,['approved','compatibility']);
});

test('preflight failure does not consume one-shot or install',async()=>{
  const {calls,receiver} = fixture();
  const original = receiver.loadPinnedPackageRunner;
  receiver.loadPinnedPackageRunner=async approval=>{
    const loaded=await original(approval);
    loaded.runConfiguredPackage=()=>({status:'STOP',changed:0});
    return loaded;
  };
  const result = await configured(receiver);
  assert.equal(result.status,'BLOCKED');
  assert.equal(result.reason,'B_CONFIG_PACKAGE_PREFLIGHT');
  assert.deepEqual(calls,['approved','compatibility','load']);
});

test('uncertain one-shot consumption never reaches install or allows retry',async()=>{
  const {calls,receiver} = fixture();
  receiver.consumeOneShotAuthorization=async()=>{
    calls.push('consume');return {sourceSha:hash40,receiptSha256:token};
  };
  const result=await configured(receiver);
  assert.equal(result.status,'STATE_UNKNOWN');
  assert.equal(result.reason,'B_ONESHOT_RECEIPT');
  assert.equal(result.retryAllowed,false);
  assert.equal(calls.includes('install'),false);
});

test('failed installer becomes STATE_UNKNOWN and is never retried',async()=>{
  const {calls,receiver} = fixture();
  const original = receiver.loadPinnedPackageRunner;
  receiver.loadPinnedPackageRunner=async approval=>{
    const loaded=await original(approval);
    const old=loaded.runConfiguredPackage;
    loaded.runConfiguredPackage=options=>{
      if(options.mode==='install'){
        calls.push('install');throw Object.assign(Error('uncertain'),{
          code:'B_CONFIG_PACKAGE_INSTALL_UNCERTAIN'});
      }
      return old(options);
    };
    return loaded;
  };
  const result=await configured(receiver);
  assert.equal(result.status,'STATE_UNKNOWN');
  assert.equal(result.retryAllowed,false);
  assert.equal(result.effectAttempted,true);
  assert.equal(calls.filter(x=>x==='install').length,1);
});

test('readback not proved remains STATE_UNKNOWN, not DONE',async()=>{
  const {calls,receiver} = fixture();
  receiver.verifyInstalledReadback=async()=>{calls.push('readback');return {
    status:'UNKNOWN'};};
  const result=await configured(receiver);
  assert.equal(result.status,'STATE_UNKNOWN');
  assert.equal(result.reason,'B_INSTALLED_READBACK_UNCERTAIN');
  assert.equal(calls.filter(x=>x==='install').length,1);
});

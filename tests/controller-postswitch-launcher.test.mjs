import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyLauncherArguments,verifyReadOnlyPrepareArguments,
  summarizePrepareEvidence,main}
  from '../tools/controller-postswitch-launcher.mjs';

const id='pc-update-877e10c8-8580-4095-a675-bef9ec032193';
const good=['--request-id',id,'--source-sha','a'.repeat(40),
  '--approval-sha256','b'.repeat(64)];
test('direct C launcher accepts only the fixed incident and exact arguments',()=>{
  assert.equal(verifyLauncherArguments(good),good);
  for(const bad of [
    [],good.slice(0,5),[...good,'--force'],
    ['--request-id','pc-update-00000000-0000-0000-0000-000000000000',...good.slice(2)],
    [...good.slice(0,3),'X'.repeat(40),...good.slice(4)],
    [...good.slice(0,5),'B'.repeat(64)],
  ])assert.throws(()=>verifyLauncherArguments(bad),
    /POSTSWITCH_LAUNCHER_ARGUMENTS_INVALID/);
});
test('launcher refuses unattended/Linux execution before loading local code',async()=>{
  await assert.rejects(()=>main(good),
    /POSTSWITCH_DIRECT_WINDOWS_C_OPERATOR_REQUIRED/);
});
test('read-only preparation never accepts an arbitrary incident or source',()=>{
  const prepare=['prepare','--request-id',id,'--source-sha','c'.repeat(40)];
  assert.equal(verifyReadOnlyPrepareArguments(prepare),prepare);
  for(const wrong of [
    ['prepare','--request-id','other','--source-sha','c'.repeat(40)],
    [...prepare,'--execute'],
    ['prepare','--request-id',id,'--source-sha','BAD'],
  ])assert.throws(()=>verifyReadOnlyPrepareArguments(wrong),
    /POSTSWITCH_PREPARE_ARGUMENTS_INVALID/);
});
test('read-only evidence failure includes safe named checks without original material',()=>{
  const failure=summarizePrepareEvidence({status:'RECOVERY_REQUIRED',
    code:'PROTECTION_UNCHANGED',
    protectionCode:'PROTECTED_STATE_DRIFT',exactInventories:true,
    exactSourceBytes:true,owner:{nonce:'private'},
    checks:{ORIGINAL_LEDGER:true,PROTECTION_UNCHANGED:false,SUPERVISOR_FRESH:false}});
  assert.equal(failure.code,'POSTSWITCH_PREPARE_EVIDENCE_FAILED');
  assert.deepEqual(failure.failedChecks,['PROTECTION_UNCHANGED','SUPERVISOR_FRESH']);
  assert.equal(failure.protectionCode,'PROTECTED_STATE_DRIFT');
  assert.equal(failure.operationalWrites,0);
  assert.equal(JSON.stringify(failure).includes('private'),false);
  assert.equal(summarizePrepareEvidence({status:'READONLY_POSTSWITCH_EVIDENCE_VERIFIED'}),null);
});

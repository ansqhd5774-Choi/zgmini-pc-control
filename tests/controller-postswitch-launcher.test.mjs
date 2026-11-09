import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyLauncherArguments,main} from '../tools/controller-postswitch-launcher.mjs';

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

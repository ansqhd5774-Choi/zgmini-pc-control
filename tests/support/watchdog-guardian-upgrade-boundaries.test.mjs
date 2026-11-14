// ZGMINI independent support: source-contract assertions and SYNTHETIC upgrade
// state model only. No Windows shell, Runner, Installer or actual Watchdog invoked.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const wd=fs.readFileSync(new URL('../../tools/runner-watchdog.mjs',import.meta.url),'utf8');
const inst=fs.readFileSync(new URL('../../tools/install-runner-watchdog.mjs',import.meta.url),'utf8');
const guardian=fs.readFileSync(new URL('../../tools/runner-watchdog-startup.vbs',import.meta.url),'utf8');
const oldScope='RUNNER_RECOVERY_ONLY';
const newScope='RUNNER_RECOVERY_AND_MAINTENANCE_HANDOFF_V1';

// We test existing source properties, not fitness/approval of any upgrade plan.
test('existing initial installer refuses overwriting an existing watchdog home',()=>{
  assert.ok(inst.includes("if(fs.existsSync(home))throw Error('EXISTING_WATCHDOG_STOP')"));
});
test('initial installer fixes scope to old runner-recovery only',()=>{
  assert.ok(inst.includes("scope:'RUNNER_RECOVERY_ONLY'"));
  assert.ok(!inst.includes("scope:'RUNNER_RECOVERY_AND_MAINTENANCE_HANDOFF_V1'"));
});
test('Watchdog checks installed source hash at process start',()=>{
  const start=wd.indexOf('export async function main()');
  const read=wd.indexOf("const installed=read(path.join(home,'INSTALL.json'))",start);
  const gate=wd.indexOf("throw Error('WATCHDOG_SOURCE_DRIFT')",start);
  assert.ok(start>=0&&read>start&&gate>read);
});
test('handoff scope is snapshot-read by running Watchdog, not live-reloaded',()=>{
  const installed=wd.indexOf("const installed=read(path.join(home,'INSTALL.json'))");
  const poll=wd.indexOf('async function pollHandoff(){');
  const gate=wd.indexOf("installed.scope!==handoffScope",poll);
  assert.ok(installed>=0&&gate>poll&&poll>installed);
  assert.equal(wd.slice(poll).includes("read(path.join(home,'INSTALL.json'))"),false);
});
test('Guardian PAUSE is checked before next launch, not an existing-child stop',()=>{
  const pause=guardian.indexOf('FileExists("E:\\ZGmini\\automation\\pc-watchdog\\PAUSE")');
  const run=guardian.indexOf('shell.Run(command, 0, True)');
  assert.ok(pause>=0&&run>pause);
  assert.equal(/Terminate|Kill|TaskKill|Stop-Process/i.test(guardian),false);
});
test('Guardian stops after three short unsuccessful restart cycles',()=>{
  assert.ok(guardian.includes('If failures >= 3 Then'));
  assert.ok(guardian.includes('GUARDIAN_STOP.txt'));
});
test('Guardian waits for child and sleeps between cycles',()=>{
  assert.ok(guardian.includes('shell.Run(command, 0, True)'));
  assert.ok(guardian.includes('WScript.Sleep 30000'));
});
test('new capability is conditional on installed scope (not just main merge)',()=>{
  assert.ok(wd.includes("installed.scope!==handoffScope"));
  assert.ok(wd.includes("RUNNER_RECOVERY_AND_MAINTENANCE_HANDOFF_V1"));
});

// Pure model for planning, NOT an implementation of the Windows B update.
function modelUpgrade(s) {
  if(!s.oldSourceAuthenticated||!s.beforeBytesCaptured||!s.backupVerified||
     !s.aclVerified||!s.startupVerified||!s.guardianOwnerAuthenticated)
    return 'MODEL_PREIMAGE_OR_PROTECTION_MISSING';
  if(!s.guardianPaused) return 'MODEL_GUARDIAN_RELAUNCH_RACE';
  if(s.watchdogRunning||!s.oldLeaseQuiesced)
    return 'MODEL_OLD_WATCHDOG_STILL_ACTIVE';
  if(!s.newFileWritten||!s.installMetadataWritten)
    return 'MODEL_PARTIAL_UPDATE_MUST_ROLLBACK_OR_RECONCILE';
  if(!s.newBytesMatchManifest||s.installedScope!==newScope)
    return 'MODEL_SOURCE_HASH_OR_SCOPE_DRIFT';
  if(s.guardianFailureCount>=3)return 'MODEL_GUARDIAN_STOP_REQUIRES_OWNER';
  if(!s.guardianResumed||!s.newReceiverAlive||!s.newHeartbeat||
    !s.guardianProtectionPreserved||!s.oldBackupStillPresent)
    return 'MODEL_POSTCHECK_INCOMPLETE';
  return 'MODEL_ALL_REQUIREMENTS_PRESENT_NOT_RUNTIME_PASS';
}
const all={
 oldSourceAuthenticated:true,beforeBytesCaptured:true,backupVerified:true,
 aclVerified:true,startupVerified:true,guardianOwnerAuthenticated:true,
 guardianPaused:true,watchdogRunning:false,oldLeaseQuiesced:true,
 newFileWritten:true,installMetadataWritten:true,
 newBytesMatchManifest:true,installedScope:newScope,
 guardianFailureCount:0,guardianResumed:true,newReceiverAlive:true,
 newHeartbeat:true,guardianProtectionPreserved:true,oldBackupStillPresent:true
};
test('model: valid combination has all required observations, not runtime PASS',()=>{
  assert.equal(modelUpgrade(all),'MODEL_ALL_REQUIREMENTS_PRESENT_NOT_RUNTIME_PASS');
});
const rejects=[
 ['preimage missing',{oldSourceAuthenticated:false},'MODEL_PREIMAGE_OR_PROTECTION_MISSING'],
 ['guardian unpaused',{guardianPaused:false},'MODEL_GUARDIAN_RELAUNCH_RACE'],
 ['running old watcher',{watchdogRunning:true},'MODEL_OLD_WATCHDOG_STILL_ACTIVE'],
 ['old lease not quiesced',{oldLeaseQuiesced:false},'MODEL_OLD_WATCHDOG_STILL_ACTIVE'],
 ['source only',{installMetadataWritten:false},'MODEL_PARTIAL_UPDATE_MUST_ROLLBACK_OR_RECONCILE'],
 ['metadata only',{newFileWritten:false},'MODEL_PARTIAL_UPDATE_MUST_ROLLBACK_OR_RECONCILE'],
 ['old scope retained',{installedScope:oldScope},'MODEL_SOURCE_HASH_OR_SCOPE_DRIFT'],
 ['hash mismatch',{newBytesMatchManifest:false},'MODEL_SOURCE_HASH_OR_SCOPE_DRIFT'],
 ['three fast failures',{guardianFailureCount:3},'MODEL_GUARDIAN_STOP_REQUIRES_OWNER'],
 ['new heartbeat absent',{newHeartbeat:false},'MODEL_POSTCHECK_INCOMPLETE'],
 ['guardian protection unknown',{guardianProtectionPreserved:false},'MODEL_POSTCHECK_INCOMPLETE'],
 ['old backup missing',{oldBackupStillPresent:false},'MODEL_POSTCHECK_INCOMPLETE']
];
for(const [name,patch,expected] of rejects){
 test('synthetic plan '+name,()=>{
   assert.equal(modelUpgrade({...all,...patch}),expected);
 });
}

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import test from 'node:test';

const fixture = fileURLToPath(new URL('../tools/TEST_996_WINDOWS_TEMP_SECURITY_WINDOW.ps1', import.meta.url));
const source = fs.readFileSync(fixture, 'utf8');
const nativeSource = fs.readFileSync(fileURLToPath(
  new URL('../tools/TEST_996_WINDOWS_TEMP_SECURITY_WINDOW_NATIVE.cs', import.meta.url)), 'utf8');

test('temporary ACL fixture rejects production invocation before creating files', () => {
  assert.match(source, /if \(-not \$TestOnly\) \{ throw 'C996_SECURITY_PROOF_TEST_ONLY_REQUIRED' \}/);
  assert.match(source, /C996_SECURITY_PROOF_ORIGINAL_PC_FORBIDDEN/);
  assert.match(source, /-not \$AllowOriginalPcTempOnly/);
  assert.match(source, /zgmini-996-acl-fixture-/);
  assert.match(source, /C996_SECURITY_PROOF_UNSAFE_TEMP/);
  assert.ok(source.includes('^[a-zA-Z]:\\\\$'), 'drive root must require a literal backslash');
  assert.match(source, /C996_SECURITY_PROOF_TEMP_REDIRECT/);
  assert.match(source, /C996_SECURITY_PROOF_UNSUPPORTED_VOLUME/);
  assert.match(nativeSource, /C996_SECURITY_PROOF_TEST_ONLY_REQUIRED/);
  assert.match(nativeSource, /C996_SECURITY_PROOF_ISOLATION_REQUIRED/);
  assert.match(nativeSource, /C996_SECURITY_PROOF_TEMP_REDIRECT/);
  assert.match(nativeSource, /C996_SECURITY_PROOF_UNSAFE_TEMP/);
  assert.match(nativeSource, /DESKTOP-N62L0NG/);
  assert.match(nativeSource, /zgmini-handoff-ci-spare-01/);
});

test('temporary ACL fixture restores on normal and injected failures', () => {
  assert.match(source, /\[switch\]\$InjectFailure/);
  assert.match(source, /\} finally \{/);
  assert.match(source, /\$sourcePresent -xor \$archivePresent/);
  assert.match(source, /Set-Acl -LiteralPath \$restoreTarget -AclObject \$originalAcl/);
  assert.match(source, /\$afterDacl -ceq \$beforeDacl -and \$afterHash -ceq \$initialHash/);
  assert.match(source, /C996_SECURITY_PROOF_INJECTED_FAILURE/);
  assert.match(nativeSource, /SetSecurityDescriptorSddlForm\(originalDacl, Dacl\)/);
  assert.match(nativeSource, /daclMatches = afterDacl == originalDacl/);
  assert.match(nativeSource, /C996_SECURITY_PROOF_INJECTED_FAILURE/);
});

test('separate-process recovery uses a flushed journal and fixed TEMP root', () => {
  assert.match(source, /\[switch\]\$RecoverOnly/);
  assert.match(source, /\$journalStream\.Flush\(\$true\)/);
  assert.match(source, /C996_SECURITY_PROOF_JOURNAL_INVALID/);
  assert.match(source, /C996_SECURITY_PROOF_RECOVERY_PATH_AMBIGUOUS/);
  assert.match(source, /C996_SECURITY_PROOF_RECOVERY_SOURCE_DRIFT/);
  assert.match(source, /C996_SECURITY_PROOF_TERMINATION_ROOT_UNSAFE/);
  assert.match(source, /\[Environment\]::Exit\(17\)/);
  assert.match(nativeSource, /stream.Flush\(true\)/);
  assert.match(nativeSource, /Environment.Exit\(17\)/);
  assert.match(nativeSource, /C996_SECURITY_PROOF_RECOVERY_SOURCE_DRIFT/);
});

test('test fixture distinguishes locked move from move after handle close', () => {
  assert.match(source, /\[IO\.FileShare\]::Read/);
  assert.match(source, /C996_SECURITY_PROOF_LOCKED_MOVE_NOT_BLOCKED/);
  assert.match(source, /\$handle\.Dispose\(\)/);
  assert.match(source, /\$moveSucceeded = \$true/);
  assert.match(source, /executionAuthorized = \$false/);
  assert.match(source, /originalPcWrites = 0/);
  assert.match(nativeSource, /FileShare.Read/);
  assert.match(nativeSource, /Directory.Move\(source, archive\)/);
  assert.match(nativeSource, /handle.Dispose\(\)/);
  assert.match(nativeSource, /originalPcWrites/);
});

const nativeExe = process.env.ZGMINI_996_NATIVE_EXE || null;
const originalPcPresent = fs.existsSync('E:\\ZGmini');
if (process.platform === 'win32' && process.env.GITHUB_ACTIONS === 'true' && !nativeExe) {
  throw new Error('C996_TEMP_NATIVE_EXECUTABLE_REQUIRED');
}
const onApprovedWindows = process.platform === 'win32' &&
  !originalPcPresent && !!nativeExe && fs.existsSync(nativeExe);
const nativeArgs = {
  '-InjectFailure':'--inject-failure',
  '-PreexistingReadRule':'--preexisting-read-rule',
  '-SimulateChildTermination':'--simulate-child-termination',
  '-SimulateChildTimeout':'--simulate-child-timeout',
  '-RecoverOnly':'--recover-only',
};
const newRoot = () => path.join(os.tmpdir(), `zgmini-996-acl-fixture-${randomUUID().replaceAll('-', '')}`);
function runFixture(root, args, timeout=30000) {
  assert.ok(nativeExe, 'C996_TEMP_NATIVE_EXECUTABLE_REQUIRED');
  const argumentsList = ['--test-only','--fixture-root',root,...args.map(arg => nativeArgs[arg])];
  assert.ok(argumentsList.every(Boolean), 'unmapped native fixture argument');
  return spawnSync(nativeExe,argumentsList,{encoding:'utf8',timeout,windowsHide:true,
    env:{...process.env,ZGMINI_996_TEMP_TERMINATION_TEST:'1'}});
}
function recover(root) {
  assert.equal(fs.existsSync(path.join(root,'acl-recovery.json')),true,'missing durable recovery journal');
  const result=runFixture(root,['-RecoverOnly']);
  assert.equal(result.status,0,result.stderr||result.stdout||result.error?.message);
  const report=JSON.parse(result.stdout.trim());
  assert.equal(report.ok,true);
  assert.equal(report.aclRestored,true);
  assert.equal(report.originalPcWrites,0);
  return report;
}
for (const [name, args] of [
  ['normal', []], ['injected failure', ['-InjectFailure']],
  ['preexisting rule', ['-PreexistingReadRule']],
]) {
  test(`native TEMP ACL restoration (${name})`,
    {skip: !onApprovedWindows}, () => {
      const root = newRoot();
      const result = runFixture(root,args);
      if (result.status!==0 && fs.existsSync(path.join(root,'acl-recovery.json'))) recover(root);
      assert.equal(result.status, 0, result.stderr || result.error?.message);
      const payload = JSON.parse(result.stdout.trim());
      assert.equal(payload.scope, 'ISOLATED_WINDOWS_TEMP_ONLY');
      assert.equal(payload.ok, true);
      assert.equal(payload.aclChanged, !payload.aclAlreadyPresent);
      if(name==='preexisting rule')assert.equal(payload.aclAlreadyPresent,true);
      assert.equal(payload.aclRestored, true);
      assert.equal(payload.executionAuthorized, false);
      assert.equal(payload.originalPcWrites, 0);
      assert.equal(payload.injectedFailureRecovered, name==='injected failure');
      assert.equal(payload.moveAfterCloseSucceeded, name!=='injected failure');
      assert.equal(payload.pathDisposition, name==='injected failure'?'SOURCE':'ARCHIVE');
    });
}

for(const scenario of ['termination','timeout'])test('native TEMP journal recovers ACL after '+scenario,
  {skip: !onApprovedWindows}, () => {
    const root = newRoot();
    const aborted = runFixture(root,[scenario==='timeout'?'-SimulateChildTimeout':'-SimulateChildTermination']);
    let recovery;
    try {
      if(scenario==='timeout')assert.equal(aborted.error?.code,'ETIMEDOUT',aborted.stderr);
      else assert.equal(aborted.status, 17, aborted.stderr || aborted.error?.message);
      const payload = JSON.parse(aborted.stdout.trim());
      // Windows may return the same TEMP directory as an 8.3 short name or
      // its expanded long name. Resolve both to the actual filesystem path.
      assert.equal(fs.realpathSync.native(payload.fixtureRoot).toLowerCase(),
        fs.realpathSync.native(root).toLowerCase());
      assert.equal(payload.executionAuthorized, false);
    } finally {
      // A separate process attempts restoration even when the child assertion fails.
      if (fs.existsSync(path.join(root, 'acl-recovery.json'))) recovery=recover(root);
    }
    assert.ok(recovery, 'recovery journal should exist');
    assert.equal(recovery.pathDisposition,'SOURCE');
    assert.equal(fs.existsSync(path.join(root,'archive')),false);
  });

test('native TEMP recovery refuses changed source bytes before applying the journal ACL',
  {skip: !onApprovedWindows}, () => {
    const root = newRoot();
    const aborted = runFixture(root,['-SimulateChildTermination']);
    const owner = path.join(root,'source','owner.json');
    const bytes = Buffer.from('{"fixture":true}');
    try {
      assert.equal(aborted.status,17,aborted.stderr||aborted.error?.message);
      fs.appendFileSync(owner,' ');
      const blocked=runFixture(root,['-RecoverOnly']);
      assert.notEqual(blocked.status,0);
      assert.match(blocked.stderr,/C996_SECURITY_PROOF_RECOVERY_SOURCE_DRIFT/);
      assert.deepEqual(fs.readFileSync(owner),Buffer.concat([bytes,Buffer.from(' ')]));
    } finally {
      if(fs.existsSync(path.join(root,'acl-recovery.json'))){
        fs.writeFileSync(owner,bytes);
        recover(root);
      }
    }
  });

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import test from 'node:test';

const fixture = fileURLToPath(new URL('../tools/TEST_996_WINDOWS_TEMP_SECURITY_WINDOW.ps1', import.meta.url));
const source = fs.readFileSync(fixture, 'utf8');

test('temporary ACL fixture rejects production invocation before creating files', () => {
  assert.match(source, /if \(-not \$TestOnly\) \{ throw 'C996_SECURITY_PROOF_TEST_ONLY_REQUIRED' \}/);
  assert.match(source, /C996_SECURITY_PROOF_ORIGINAL_PC_FORBIDDEN/);
  assert.match(source, /zgmini-996-acl-fixture-/);
  assert.match(source, /C996_SECURITY_PROOF_UNSAFE_TEMP/);
  assert.ok(source.includes('^[a-zA-Z]:\\\\$'), 'drive root must require a literal backslash');
  assert.match(source, /C996_SECURITY_PROOF_TEMP_REDIRECT/);
  assert.match(source, /C996_SECURITY_PROOF_UNSUPPORTED_VOLUME/);
});

test('temporary ACL fixture restores on normal and injected failures', () => {
  assert.match(source, /\[switch\]\$InjectFailure/);
  assert.match(source, /\} finally \{/);
  assert.match(source, /\$sourcePresent -xor \$archivePresent/);
  assert.match(source, /Set-Acl -LiteralPath \$restoreTarget -AclObject \$originalAcl/);
  assert.match(source, /\$afterDacl -ceq \$beforeDacl -and \$afterHash -ceq \$initialHash/);
  assert.match(source, /C996_SECURITY_PROOF_INJECTED_FAILURE/);
});

test('test fixture distinguishes locked move from move after handle close', () => {
  assert.match(source, /\[IO\.FileShare\]::Read/);
  assert.match(source, /C996_SECURITY_PROOF_LOCKED_MOVE_NOT_BLOCKED/);
  assert.match(source, /\$handle\.Dispose\(\)/);
  assert.match(source, /\$moveSucceeded = \$true/);
  assert.match(source, /executionAuthorized = \$false/);
  assert.match(source, /originalPcWrites = 0/);
});

const onSeparateWindows = process.platform === 'win32' &&
  !fs.existsSync('E:\\ZGmini') &&
  fs.existsSync('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe');
for (const inject of [false, true]) {
  test(`native TEMP ACL restoration (${inject ? 'injected failure' : 'normal'})`,
    {skip: !onSeparateWindows}, () => {
      const powershell = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
      const args = ['-NoProfile', '-NonInteractive', '-File', fixture, '-TestOnly'];
      if (inject) args.push('-InjectFailure');
      const result = spawnSync(powershell, args, {
        encoding: 'utf8', timeout: 30000, windowsHide: true,
      });
      assert.equal(result.status, 0, result.stderr || result.error?.message);
      const payload = JSON.parse(result.stdout.trim());
      assert.equal(payload.scope, 'ISOLATED_WINDOWS_TEMP_ONLY');
      assert.equal(payload.ok, true);
      assert.equal(payload.aclChanged, true);
      assert.equal(payload.aclRestored, true);
      assert.equal(payload.executionAuthorized, false);
      assert.equal(payload.originalPcWrites, 0);
      assert.equal(payload.injectedFailureRecovered, inject);
      assert.equal(payload.moveAfterCloseSucceeded, !inject);
    });
}

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const helper = fileURLToPath(new URL('../tools/controller-996-windows-source-snapshot.cs', import.meta.url));
const quote = value => "'" + value.replaceAll("'", "''") + "'";
const runtime = 'E:/ZGmini/runtime/node.exe';

test('Windows retains the pinned source across a separate Node import and rejects write and rename', {
  skip: process.platform !== 'win32',
}, () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zgmini-996-source-snapshot-'));
  const dir = path.join(root, 'tools');
  fs.mkdirSync(dir);
  const source = path.join(dir, 'fixture.mjs');
  const content = 'console.log("PINNED_FIXTURE_LOADED");\n';
  fs.writeFileSync(source, content);
  const hash = createHash('sha256').update(content).digest('hex');
  const code = `
    $ErrorActionPreference = 'Stop'
    Add-Type -Path ${quote(helper)}
    $source = ${quote(source)}
    $dir = ${quote(dir)}
    $node = ${quote(process.execPath)}
    $pins = New-Object 'System.Collections.Generic.Dictionary[string,string]'
    $pins.Add($source, ('0' * 64))
    function Assert-Blocked([scriptblock]$operation, [string]$label, [string]$expected = '') {
      try { & $operation } catch {
        if ($expected -and $_.Exception.GetBaseException().Message -cne $expected) { throw }
        Write-Output $label
        return
      }
      throw "Unexpected success: $label"
    }
    Assert-Blocked { [Zgmini996WindowsSourceSnapshot]::new($pins).Dispose() } 'BAD_PIN_BLOCKED' 'C996_SNAPSHOT_SHA_MISMATCH'
    $pins[$source] = '${hash}'
    $writer = [IO.File]::Open($source, 'Open', 'ReadWrite', 'ReadWrite')
    try {
      Assert-Blocked { [Zgmini996WindowsSourceSnapshot]::new($pins).Dispose() } 'OPEN_WRITER_BLOCKED' 'C996_SNAPSHOT_OPEN_FAILED_32'
    } finally { $writer.Dispose() }
    $snapshot = [Zgmini996WindowsSourceSnapshot]::new($pins)
    try {
      Assert-Blocked { [IO.File]::WriteAllText($source, 'changed') } 'WRITE_BLOCKED'
      Assert-Blocked { [IO.File]::Move($source, $source + '.moved') } 'FILE_RENAME_BLOCKED'
      Assert-Blocked { [IO.Directory]::Move($dir, $dir + '.moved') } 'PARENT_RENAME_BLOCKED'
      & $node $source
      if ($LASTEXITCODE -ne 0) { throw 'FIXTURE_NODE_FAILED' }
    } finally { $snapshot.Dispose() }
    [IO.File]::WriteAllText($source, 'after release')
    Write-Output 'HANDLES_RELEASED'
  `;
  const ps = spawnSync('C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe',
    ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(code, 'utf16le').toString('base64')],
    {encoding:'utf8', windowsHide:true, timeout:30000});
  assert.equal(ps.status, 0, ps.stderr + ps.stdout);
  for (const label of ['BAD_PIN_BLOCKED', 'OPEN_WRITER_BLOCKED', 'WRITE_BLOCKED',
    'FILE_RENAME_BLOCKED', 'PARENT_RENAME_BLOCKED', 'PINNED_FIXTURE_LOADED', 'HANDLES_RELEASED']) {
    assert.ok(ps.stdout.includes(label), label);
  }
  assert.equal(fs.readFileSync(source, 'utf8'), 'after release');
});

test('review launcher validates the full fixture before starting Node', {
  skip: process.platform !== 'win32',
}, () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zgmini-996-source-launch-'));
  const sha = value => createHash('sha256').update(value).digest('hex');
  const write = (relative, content) => {
    const file = path.join(root, relative);
    fs.mkdirSync(path.dirname(file), {recursive:true});
    fs.writeFileSync(file, content);
    return sha(content);
  };
  const bootstrap = 'tools/controller-996-c-native-trusted-bootstrap.mjs';
  const bootstrapHash = write(bootstrap,
    'import fs from "node:fs";\n' +
    'try { fs.appendFileSync(process.argv[1], "unexpected"); process.exit(10); } catch (e) { if (!["EBUSY","EPERM","EACCES"].includes(e.code)) throw e; }\n' +
    'console.log("FIXTURE_BOOTSTRAP_STARTED_WITH_SOURCE_PINNED");\n');
  const files = {[bootstrap]:bootstrapHash};
  for (let i = 0; i < 15; i++) {
    const relative = 'tools/controller-996-fixture-' + i + '.mjs';
    files[relative] = write(relative, 'export const fixture = ' + i + ';\n');
  }
  const lockHash = write('tools/controller-996-c-native-owner-source-lock.json',
    JSON.stringify({schema:'ZGMINI_CONTROLLER_996_NATIVE_OWNER_SOURCE_LOCK_V1',files}));
  const packageHash = write('artifacts/controller-996/zgmini-996-c-native-owner-package.zip', 'fixture bytes');
  const launcher = fileURLToPath(new URL('../tools/VERIFY_996_WINDOWS_TRUSTED_SNAPSHOT.ps1', import.meta.url));
  const run = () => spawnSync('C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe',
    ['-NoProfile','-NonInteractive','-File',launcher,'-PackageRoot',root,
      '-ManifestCommitSha','a'.repeat(40),'-BootstrapSha256',bootstrapHash,
      '-SourceLockSha256',lockHash,'-PackageSha256',packageHash,
      '-SnapshotHelperSha256',sha(fs.readFileSync(helper))],
    {encoding:'utf8',windowsHide:true,timeout:30000});
  const pass = run();
  assert.equal(pass.status,0,pass.stderr+pass.stdout);
  assert.match(pass.stdout,/FIXTURE_BOOTSTRAP_STARTED_WITH_SOURCE_PINNED/);
  fs.appendFileSync(path.join(root,'tools/controller-996-fixture-0.mjs'),'changed');
  const blocked = run();
  assert.equal(blocked.status,2,blocked.stderr+blocked.stdout);
  assert.match(blocked.stdout,/C996_SNAPSHOT_SHA_MISMATCH/);
  assert.doesNotMatch(blocked.stdout,/FIXTURE_BOOTSTRAP_STARTED/);
});

test('outer Windows review retains the verified launcher and Node through child exit', {
  skip: process.platform !== 'win32',
}, () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zgmini-996-outer-anchor-'));
  const toolsDir = path.join(root, 'tools');
  fs.mkdirSync(toolsDir);
  const sha = bytes => createHash('sha256').update(bytes).digest('hex');
  const helperBytes = fs.readFileSync(helper);
  fs.writeFileSync(path.join(toolsDir, path.basename(helper)), helperBytes);
  const launcher = path.join(toolsDir, 'VERIFY_996_WINDOWS_TRUSTED_SNAPSHOT.ps1');
  const fixture = path.join(root, 'fixture.mjs');
  fs.writeFileSync(fixture, [
    'import fs from "node:fs";',
    'for (const target of [process.argv[2], process.execPath]) {',
    '  try { fs.closeSync(fs.openSync(target, "r+")); process.exit(10); }',
    '  catch (error) { if (!["EBUSY","EPERM","EACCES"].includes(error.code)) throw error; }',
    '}',
    'console.log("LAUNCHER_AND_NODE_WRITE_ACCESS_DENIED");',
  ].join('\n'));
  const launcherBytes = Buffer.from([
    'param($PackageRoot,$ManifestCommitSha,$BootstrapSha256,$SourceLockSha256,$PackageSha256,$SnapshotHelperSha256)',
    "& 'E:\\ZGmini\\runtime\\node.exe' (Join-Path $PackageRoot 'fixture.mjs') $PSCommandPath",
    'exit $LASTEXITCODE',
  ].join('\r\n'));
  fs.writeFileSync(launcher, launcherBytes);
  const runtime = 'E:/ZGmini/runtime/node.exe';
  const runtimeHash = sha(fs.readFileSync(runtime));
  const outer = fileURLToPath(new URL('../tools/VERIFY_996_WINDOWS_OUTER_ANCHOR.ps1', import.meta.url));
  const run = (nodeHash, launcherHash) => spawnSync('C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe',
    ['-NoProfile','-NonInteractive','-File',outer,'-PackageRoot',root,
      '-ManifestCommitSha','a'.repeat(40),'-BootstrapSha256','a'.repeat(64),
      '-SourceLockSha256','a'.repeat(64),'-PackageSha256','a'.repeat(64),
      '-SnapshotHelperSha256',sha(helperBytes),'-LauncherSha256',launcherHash,'-NodeSha256',nodeHash],
    {encoding:'utf8',windowsHide:true,timeout:30000});
  const pass = run(runtimeHash, sha(launcherBytes));
  assert.equal(pass.status, 0, pass.stderr + pass.stdout);
  assert.match(pass.stdout, /LAUNCHER_AND_NODE_WRITE_ACCESS_DENIED/);
  for (const blocked of [run('0'.repeat(64), sha(launcherBytes)), run(runtimeHash, '0'.repeat(64))]) {
    assert.equal(blocked.status, 2, blocked.stderr + blocked.stdout);
    assert.match(blocked.stdout, /C996_SNAPSHOT_SHA_MISMATCH/);
    assert.doesNotMatch(blocked.stdout, /LAUNCHER_AND_NODE_WRITE_ACCESS_DENIED/);
  }
});

test('Windows handoff reaches the real read-only Operator only for a matching Bootstrap receipt', {
  skip: process.platform !== 'win32',
}, () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zgmini-996-review-handoff-'));
  const sha = bytes => createHash('sha256').update(bytes).digest('hex');
  const write = (relative, content) => {
    const file = path.join(root, relative);
    fs.mkdirSync(path.dirname(file), {recursive:true});
    fs.writeFileSync(file, content);
    return sha(content);
  };
  const operator = 'tools/controller-996-c-native-owner-operator.mjs';
  const bootstrap = 'tools/controller-996-c-native-trusted-bootstrap.mjs';
  const launcher = 'tools/VERIFY_996_WINDOWS_TRUSTED_SNAPSHOT.ps1';
  const lockPath = 'tools/controller-996-c-native-owner-source-lock.json';
  const zipPath = 'artifacts/controller-996/zgmini-996-c-native-owner-package.zip';
  const localSource = relative => fs.readFileSync(fileURLToPath(new URL('../' + relative, import.meta.url)));
  const operatorSha = write(operator, localSource(operator));
  const launcherSha = write(launcher, localSource(launcher));
  const helperSha = write('tools/controller-996-windows-source-snapshot.cs', fs.readFileSync(helper));
  const zipSha = write(zipPath, 'fixture bytes');
  const outerSha = sha(localSource('tools/VERIFY_996_WINDOWS_OUTER_ANCHOR.ps1'));
  const nodeSha = sha(fs.readFileSync(runtime));
  const commit = 'a'.repeat(40);
  const manifestSha = 'b'.repeat(64);
  const bootstrapSha = write(bootstrap, [
    'import fs from "node:fs";',
    'import {createHash} from "node:crypto";',
    'const sha = url => createHash("sha256").update(fs.readFileSync(url)).digest("hex");',
    'const mode = process.env.ZGMINI_996_TEST_RECEIPT;',
    'const receipt = ' + JSON.stringify({
      schema:'ZGMINI_CONTROLLER_996_NATIVE_TRUSTED_BOOTSTRAP_REVIEW_V1',
      status:'GIT_AND_LOCAL_BYTES_OBSERVED_ONLY', filesCheckedAtS1:16, filesCheckedAtS2:3,
      effectsChecked:7, ownerConsentCommentId:123, manifestCommitSha:commit, manifestSha256:manifestSha,
      operatorSha256:operatorSha, packageSha256:zipSha, executionAuthorized:false, operatorStarted:false,
      launchPins:{outerSha256:outerSha,launcherSha256:launcherSha,helperSha256:helperSha,nodeSha256:nodeSha},
    }) + ';',
    'receipt.bootstrapSha256 = sha(new URL(import.meta.url));',
    'receipt.sourceLockSha256 = sha(new URL("./controller-996-c-native-owner-source-lock.json", import.meta.url));',
    'if (mode === "wrong-operator") receipt.operatorSha256 = "0".repeat(64);',
    'if (mode === "wrong-commit") receipt.manifestCommitSha = "0".repeat(40);',
    'if (mode === "authorized") receipt.executionAuthorized = true;',
    'if (mode === "wrong-launch") receipt.launchPins.nodeSha256 = "0".repeat(64);',
    'export function verify996CTrustedBootstrapReadOnly() {',
    '  return mode === "revoked-at-operator" ? {status:"BOOTSTRAP_NO_GO"} : receipt;',
    '}',
    'if (process.argv[1] && new URL(import.meta.url).pathname.endsWith(process.argv[1].split(/[\\\\/]/).at(-1))) {',
    '  if (mode === "missing") process.exit(2);',
    '  console.log(JSON.stringify(receipt));',
    '}',
  ].join('\n'));
  const files = {[bootstrap]:bootstrapSha, [operator]:operatorSha};
  for (let i = 0; i < 14; i++) {
    const relative = 'tools/controller-996-handoff-fixture-' + i + '.mjs';
    files[relative] = write(relative, 'export {};\n');
  }
  const lockSha = write(lockPath, JSON.stringify({schema:'ZGMINI_CONTROLLER_996_NATIVE_OWNER_SOURCE_LOCK_V1',files}));
  const outer = fileURLToPath(new URL('../tools/VERIFY_996_WINDOWS_OUTER_ANCHOR.ps1', import.meta.url));
  const run = mode => spawnSync('C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe',
    ['-NoProfile','-NonInteractive','-File',outer,'-PackageRoot',root,'-ManifestCommitSha',commit,
      '-LauncherSha256',launcherSha,'-NodeSha256',nodeSha,'-BootstrapSha256',bootstrapSha,
      '-SourceLockSha256',lockSha,'-PackageSha256',zipSha,'-SnapshotHelperSha256',helperSha,
      '-ReviewOperatorHandoff','-OuterSha256',outerSha], {
      encoding:'utf8',windowsHide:true,timeout:30000,
      env:{...process.env,ZGMINI_996_TEST_RECEIPT:mode},
    });
  const pass = run('matching');
  assert.equal(pass.status, 0, pass.stderr + pass.stdout);
  assert.deepEqual(JSON.parse(pass.stdout), {
    status:'OPERATOR_REVIEW_BOUNDARY_REACHED',code:'C_996_OWNER_PREIMPORT_AND_NATIVE_CAS_NOT_ATTESTED',
    executionAuthorized:false,originalPcWrites:0,manifestCommitSha:commit,
    manifestSha256:manifestSha,ownerConsentCommentId:123,
  });
  for (const mode of ['missing','wrong-operator','wrong-commit','authorized','wrong-launch']) {
    const blocked = run(mode);
    assert.equal(blocked.status, 2, blocked.stderr + blocked.stdout);
    const receipt = JSON.parse(blocked.stdout);
    assert.equal(receipt.operatorStarted, false);
    assert.equal(receipt.code, mode==='missing'?'C996_SNAPSHOT_BOOTSTRAP_REVIEW_FAILED':'C996_SNAPSHOT_BOOTSTRAP_RECEIPT_INVALID');
  }
  const revoked = run('revoked-at-operator');
  assert.equal(revoked.status,2,revoked.stderr+revoked.stdout);
  assert.equal(JSON.parse(revoked.stdout).code,'C996_SNAPSHOT_OPERATOR_REVIEW_FAILED');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const script=fs.readFileSync(new URL(
  '../tools/TEST_996_WINDOWS_NATIVE_MOVE_FIXTURE.ps1',import.meta.url),'utf8');

test('Windows native fixture source has no operational PC path or input root',()=>{
  assert.match(script,/\[System\.IO\.Path\]::GetTempPath\(\)/);
  assert.match(script,/zgmini-996-test-native-/);
  assert.match(script,/GetPathRoot\(\$tempPath\)/);
  assert.match(script,/\$tempPath -match/);
  assert.match(script,/FileAttributes\]::ReparsePoint/);
  assert.match(script,/FIXTURE_TEMP_REMOTE_OR_UNSUPPORTED_VOLUME/);
  assert.match(script,/DriveType\]::Fixed/);
  assert.match(script,/DriveFormat -notin @\('NTFS','ReFS'\)/);
  assert.doesNotMatch(script,/E:[\\/]ZGmini|Invoke-RestMethod|gh api/i);
  assert.doesNotMatch(script,/\bparam\s*\(/i);
  assert.match(script,/executionAuthorized=\$false/);
  assert.match(script,/operatorReady=\$false/);
  assert.match(script,/\[System\.IO\.Directory\]::Move\(\$source,\$destination\)/);
});

test('Windows native fixture uses install as final source move in main test',()=>{
  const ordered=script.slice(script.indexOf("$case = New-TestCase 'ordered'"),
    script.indexOf("$case = New-TestCase 'collision'"));
  const old=ordered.indexOf("Move-OnlyFixture $case 'oldC'");
  const cont=ordered.indexOf("Move-OnlyFixture $case 'continuation'");
  const install=ordered.indexOf("Move-OnlyFixture $case 'install'");
  assert.ok(old>=0&&old<cont&&cont<install);
  assert.doesNotMatch(script,/\[System\.IO\.Directory\]::Delete\(/);
  assert.match(script,/cleanupPerformed=\$false/);
  // STATIC source review only. The PowerShell/.NET behavior must still be
  // independently executed on isolated Windows before any operational C.
});

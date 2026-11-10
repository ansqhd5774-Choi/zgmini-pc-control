// Structural regression of an UNEXECUTED Windows PowerShell C stage candidate.
// A native Windows run and exact C approval remain separate conditions.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';

const source=fs.readFileSync(fileURLToPath(new URL(
  '../tools/INVOKE_996_WINDOWS_C_ARCHIVE_CANDIDATE.ps1',
  import.meta.url)),'utf8');
const at=x=>source.indexOf(x);

test('C stage candidate rejects production before examining caller-supplied paths',()=>{
  assert.ok(at("if (-not $TestOnly) { throw 'C_CONTINUATION_PRODUCTION_NOT_APPROVED' }")>0);
  assert.ok(at('C_CONTINUATION_PRODUCTION_NOT_APPROVED')<
    at('$root = [IO.Path]::GetFullPath($FixtureRoot)'));
  assert.match(source,/C_OPERATOR_TEST_ORIGINAL_ZGMINI_PRESENT/);
});
test('only fixed isolated local TEMP root and no reparse parents accepted',()=>{
  for(const token of ['[IO.Path]::GetTempPath()',
    '[IO.DriveType]::Fixed',"@('NTFS','ReFS')",
    '^zgmini-996-test-c-operator-', 'DirectoryInfo',
    'FileAttributes]::ReparsePoint','C_OPERATOR_TEST_ROOT_OUTSIDE_TEMP']){
    assert.ok(source.includes(token),'missing '+token);
  }
  assert.doesNotMatch(source,/E:\\ZGmini\\automation\\/);
});
test('native Windows Directory.Move path checks source and destination again',()=>{
  assert.match(source,/\[IO\.Directory\]::Move\(\$source,\$destination\)/);
  const native=source.slice(at('function Native-MovePinned'),at('function Check-Fault'));
  assert.ok(native.indexOf('Assert-Inventory $source $pins') <
    native.indexOf('Assert-DestinationAbsent $destination'));
  assert.ok(native.indexOf('Assert-DestinationAbsent $destination') <
    native.indexOf('[IO.Directory]::Move($source,$destination)'));
  assert.ok(native.indexOf('Assert-NoConflict $step') <
    native.indexOf('[IO.Directory]::Move($source,$destination)'));
  assert.match(source,/C_OPERATOR_TEST_ARCHIVE_COLLISION/);
});
test('stage order leaves canonical install lease as last moved directory',()=>{
  const old=at('Native-MovePinned $old $oldArchive');
  const ready=at('$readySha = Write-ReadyOnce');
  const cont=at('Native-MovePinned $cont $contArchive');
  const finalCheck=at("Assert-NoConflict 'BEFORE_INSTALL'");
  const install=at('Native-MovePinned $install $installArchive');
  assert.ok(old>0&&old<ready&&ready<cont&&cont<finalCheck&&finalCheck<install);
  assert.match(source,/Assert-Inventory \$install \$expected\.install[\s\S]*Check-Fault 'AFTER_OLD_C'/);
  assert.match(source,/Assert-Inventory \$installArchive \$expected\.install/);
});
test('READY is exclusively created, flushed and contains owner/lease pins',()=>{
  assert.match(source,/\[IO\.FileMode\]::CreateNew/);
  assert.match(source,/\$fd\.Flush\(\$true\)/);
  assert.match(source,/finalReleasePending=\$true/);
  assert.match(source,/oldCArchiveOwnerSha256/);
  assert.match(source,/installRecoverySha256/);
  assert.match(source,/sourceLockSha256/);
  const afterFinal=source.slice(at('Native-MovePinned $install $installArchive'));
  assert.doesNotMatch(afterFinal,/\[IO\.FileMode\]::CreateNew|WriteAllText|New-Item|Remove-Item/);
});
test('fault injection preserves data; no cleanup, retry, workflow or issue posts',()=>{
  for(const f of ['AFTER_OLD_C','AFTER_READY','AFTER_CONTINUATION',
    'BEFORE_INSTALL','AFTER_INSTALL'])assert.ok(source.includes("Check-Fault '"+f+"'"));
  assert.match(source,/status='ISOLATED_STAGE_STOP_PRESERVE_FILES'/);
  for(const token of ['executionAuthorized=$false','productionExecutable=$false',
    'workflowPuts=0','backlogWrites=0','issuePosts=0','pcRetries=0']){
    assert.ok(source.includes(token));
  }
  assert.doesNotMatch(source,/Remove-Item|Move-Item|Invoke-Expression|Start-Process|Invoke-WebRequest|Retry-After|workflow_dispatch/);
});

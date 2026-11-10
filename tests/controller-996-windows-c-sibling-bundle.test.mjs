// Structural checks only. Windows native execution is NOT inferred from these.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const ps1=fs.readFileSync(new URL(
  '../tools/TEST_996_WINDOWS_C_SIBLING_NATIVE_ONCE.ps1',import.meta.url),'utf8');
const cmd=fs.readFileSync(new URL(
  '../tools/RUN_996_WINDOWS_C_SIBLING_TEMP_ONCE.cmd',import.meta.url),'utf8');
const hash=createHash('sha256').update(Buffer.from(ps1)).digest('hex');
const at=x=>ps1.indexOf(x);

test('new same-parent native fixture is permanently isolated from original C',()=>{
  assert.ok(at("if (-not $TestOnly) { throw 'C_SIBLING_FIXTURE_PRODUCTION_DISABLED' }")>0);
  assert.match(ps1,/C_SIBLING_FIXTURE_ORIGINAL_PC_PRESENT/);
  assert.match(ps1,/GetTempPath\(\)/);
  assert.match(ps1,/\[IO.DriveType\]::Fixed/);
  assert.match(ps1,/'NTFS','ReFS'/);
  assert.match(ps1,/ReparsePoint/);
  assert.match(ps1,/zgmini-996-test-c-sibling-/);
  assert.doesNotMatch(ps1,/E:\\ZGmini\\automation\\/);
});
test('actual operational lease names are simulated as sibling directories',()=>{
  for(const s of ['controller-recovery','controller-recovery-archived-',
    'controller-recovery-continuation-',
    'controller-recovery-continuation-archived-',
    'controller-install','controller-install-recovered-'])
    assert.ok(ps1.includes(s),s);
  assert.ok(at('C_SIBLING_PARENT_DIFFERENT')<at('[IO.Directory]::Move($source,$destination)'));
  assert.match(ps1,/GetDirectoryName\(\$source\).*?\s-ieq/s);
  assert.match(ps1,/GetDirectoryName\(\$destination\)/);
  assert.doesNotMatch(ps1,/Join-Path \$root 'archives'/);
});
test('stage order retains install barrier until final move and pins real bytes',()=>{
  const old=at("Move-Sibling $f 'old' 'oldArchive'");
  const ready=at("READY_TO_RELEASE_INSTALL.json']=Write-Once");
  const cont=at("Move-Sibling $f 'continuation' 'continuationArchive'");
  const install=at("Move-Sibling $f 'install' 'installArchive'");
  assert.ok(old>0&&old<ready&&ready<cont&&cont<install);
  assert.match(ps1,/Get-FileHash -LiteralPath/);
  assert.match(ps1,/FileMode\]::CreateNew/);
  assert.match(ps1,/\$fd.Flush\(\$true\)/);
  assert.match(ps1,/C_SIBLING_WRITER_CONFLICT/);
  assert.match(ps1,/C_SIBLING_COLLISION/);
});
test('ten cases test real sibling rename, disruptions and reservation collision',()=>{
  for(const [name,where] of [
    ['success','NONE'],['after-old','AFTER_OLD'],
    ['after-ready','AFTER_READY'],['after-cont','AFTER_CONTINUATION'],
    ['before-install','BEFORE_INSTALL'],['after-install','AFTER_INSTALL'],
    ['collision','NONE'],['writer','NONE'],['marker','NONE'],
    ['reservation','NONE']])
    assert.ok(ps1.includes("Run-Case '"+name+"' '"+where+"'"),name);
  assert.match(ps1,/casesPassed=\$script:cases/);
  assert.match(ps1,/\$script:cases\+\+/);
  assert.match(ps1,/ISOLATED_WINDOWS_C_SIBLING_TEST_ONLY/);
  assert.match(ps1,/ISOLATED_WINDOWS_C_SIBLING_TEST_STOP/);
  assert.match(ps1,/cleanupPerformed=\$false/);
  assert.match(ps1,/originalPcWrites=0/);
  assert.match(ps1,/reservationFileCreateNewSequentialTested=\$true/);
  assert.match(ps1,/reservationDirectoryMoveSequentialTested=\$true/);
  assert.match(ps1,/C_SIBLING_FIXED_DIRECTORY_DUPLICATE_WON/);
});
test('pinned launcher cannot bypass execution policy, clean up, or run operational C',()=>{
  assert.ok(cmd.includes('TEST_996_WINDOWS_C_SIBLING_NATIVE_ONCE.ps1'));
  assert.ok(cmd.includes(hash));
  assert.ok(cmd.indexOf('Get-FileHash')<cmd.indexOf(' -File '));
  assert.match(cmd,/if exist "E:\\ZGmini\\"/);
  assert.match(cmd,/-File "%ZGMINI_C_SIBLING_SCRIPT%" -TestOnly/);
  for(const forbidden of ['Remove-Item','Move-Item','Invoke-WebRequest',
    'Invoke-RestMethod','Start-Process','Set-ExecutionPolicy',
    'ExecutionPolicy Bypass','workflow_dispatch','gh api',
    'https://github.com','E:\\ZGmini\\automation\\'])
    assert.ok(!ps1.includes(forbidden),forbidden);
  assert.doesNotMatch(cmd,/(-ExecutionPolicy\s+(Bypass|Unrestricted)|gh api|workflow_dispatch|Remove-Item|Set-ExecutionPolicy)/i);
  assert.match(cmd,/BLOCKED: PINNED_SIBLING_SCRIPT_SHA256_MISMATCH/);
});

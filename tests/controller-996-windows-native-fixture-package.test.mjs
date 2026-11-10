import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';

const script=fs.readFileSync(new URL(
  '../tools/TEST_996_WINDOWS_NATIVE_MOVE_FIXTURE.ps1',import.meta.url));
const cmd=fs.readFileSync(new URL(
  '../tools/RUN_996_ISOLATED_WINDOWS_NATIVE_TEMP_FIXTURE_ONCE.cmd',
  import.meta.url),'utf8');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');

test('isolated Windows native fixture CMD pins the script and preserves policy',()=>{
  assert.ok(cmd.includes(sha(script)));
  assert.match(cmd,/if exist "E:\\ZGmini\\"/);
  assert.match(cmd,/ORIGINAL_ZGMINI_ROOT_PRESENT/);
  assert.match(cmd,/Get-FileHash -LiteralPath/);
  assert.match(cmd,/-NoProfile -NonInteractive -File "%ZGMINI_FIXTURE%"/);
  assert.doesNotMatch(cmd,/-ExecutionPolicy\s+(Bypass|Unrestricted)|EncodedCommand/i);
  assert.doesNotMatch(cmd,/RUN_996_NATIVE_C_ONCE|pc-job|gh api|curl|Invoke-RestMethod/i);
});

test('isolated TEMP script blocks original before any fixture write',()=>{
  const code=script.toString('utf8');
  const originalGuard=code.indexOf('FIXTURE_ORIGINAL_ZGMINI_ROOT_PRESENT');
  const firstWrite=code.indexOf('[System.IO.Directory]::CreateDirectory($testRoot)');
  assert.ok(originalGuard>0&&firstWrite>originalGuard);
  assert.match(code,/DriveType\]::Fixed/);
  assert.match(code,/FileAttributes\]::ReparsePoint/);
  assert.match(code,/'NTFS','ReFS'/);
  assert.match(code,/cleanupPerformed=\$false/);
  assert.doesNotMatch(code,/Remove-Item|Invoke-RestMethod|Invoke-WebRequest|Start-Process/i);
});

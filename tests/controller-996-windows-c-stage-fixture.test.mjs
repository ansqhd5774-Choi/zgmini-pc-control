import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';

const harness=fs.readFileSync(fileURLToPath(new URL(
  '../tools/TEST_996_WINDOWS_C_STAGE_FIXTURE_ONCE.ps1',import.meta.url)),'utf8');
const engine=fs.readFileSync(fileURLToPath(new URL(
  '../tools/INVOKE_996_WINDOWS_C_ARCHIVE_CANDIDATE.ps1',import.meta.url)),'utf8');

test('C stage fixture is confined to generated local fixed Windows TEMP with E root stop',()=>{
  assert.match(harness,/C_STAGE_FIXTURE_ORIGINAL_ZGMINI_PRESENT/);
  assert.match(harness,/GetTempPath\(\)/);
  assert.match(harness,/\[IO\.DriveType\]::Fixed/);
  assert.match(harness,/'NTFS','ReFS'/);
  assert.match(harness,/ReparsePoint/);
  assert.match(harness,/zgmini-996-test-c-operator-/);
  assert.doesNotMatch(harness,/E:\\ZGmini\\automation\\/);
});
test('harness creates only synthetic pins, live conflict state and unique files',()=>{
  for(const value of ['oldC','continuation','install','expected.json','live.json',
    'sourceLockSha256','FileMode]::CreateNew','Write-Unique',
    'writerActiveCount','controllerActiveCount','otherContinuationCount']){
    assert.ok(harness.includes(value),value);
  }
  assert.match(engine,/C_CONTINUATION_PRODUCTION_NOT_APPROVED/);
});
test('harness tests real .NET stage engine in seven isolated cases and preserves locks',()=>{
  for(const [name,fault] of [
    ['success','NONE'],['after-old','AFTER_OLD_C'],
    ['after-cont','AFTER_CONTINUATION'],['after-install','AFTER_INSTALL'],
    ['collision','NONE'],['writer','NONE'],['marker','NONE']]){
    assert.ok(harness.includes("Run-Case '"+name+"' '"+fault+"'"),name);
  }
  assert.match(harness,/C_OPERATOR_TEST_ARCHIVE_COLLISION/);
  assert.match(harness,/C_OPERATOR_TEST_LATE_CONFLICT_PREFLIGHT/);
  assert.match(harness,/C_OPERATOR_TEST_UNEXPECTED_SOURCE_ENTRY/);
  assert.match(harness,/casesPassed=7/);
  assert.match(engine,/\[IO\.Directory\]::Move\(\$source,\$destination\)/);
});
test('harness never retries, cleans up, bypasses policy or touches GitHub/operational root',()=>{
  for(const bad of ['Remove-Item','Move-Item','Invoke-RestMethod','Invoke-WebRequest',
    'Set-ExecutionPolicy','ExecutionPolicy Bypass','workflow_dispatch',
    'github.com','gh.exe','Start-Process','E:\\ZGmini\\automation\\']){
    assert.equal(harness.includes(bad),false,bad);
  }
  assert.match(harness,/cleanupPerformed=\$false/);
  assert.match(harness,/executionAuthorized=\$false/);
  assert.match(harness,/originalPcWrites=0/);
});

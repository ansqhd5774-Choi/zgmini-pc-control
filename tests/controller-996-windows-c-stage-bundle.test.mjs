import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const dir=fileURLToPath(new URL('../tools/',import.meta.url));
const src=fs.readFileSync(new URL('../tools/RUN_996_WINDOWS_C_STAGE_TEMP_ONCE.cmd',
  import.meta.url),'utf8');
const digest=p=>createHash('sha256').update(fs.readFileSync(
  new URL('../tools/'+p,import.meta.url))).digest('hex');

test('one-shot CMD authenticates both exact PS1 sources before execution',()=>{
  for(const f of ['TEST_996_WINDOWS_C_STAGE_FIXTURE_ONCE.ps1',
    'INVOKE_996_WINDOWS_C_ARCHIVE_CANDIDATE.ps1']){
    assert.ok(src.includes(f));
    assert.ok(src.includes(digest(f)),`missing exact SHA256 for ${f}`);
  }
  assert.ok(src.indexOf('Get-FileHash')<src.indexOf(' -File '));
  assert.match(src,/BLOCKED: PINNED_SCRIPT_SHA256_MISMATCH_OR_UNREADABLE/);
});

test('the bundle CMD never bypasses PowerShell policy or executes live C',()=>{
  assert.match(src,/if exist "E:\\ZGmini\\"/);
  assert.match(src,/C:\\Windows\\System32\\WindowsPowerShell\\v1\.0\\powershell\.exe/);
  assert.doesNotMatch(src,/-ExecutionPolicy\s+(?:Bypass|Unrestricted)/i);
  assert.doesNotMatch(src,/pwsh\s+-|Invoke-Expression|workflow_dispatch|gh api|git push|Remove-Item/i);
  assert.match(src,/TEST STOPPED\. DO NOT BYPASS EXECUTION POLICY/);
});

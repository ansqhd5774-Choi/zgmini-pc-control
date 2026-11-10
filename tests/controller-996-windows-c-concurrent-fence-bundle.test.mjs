import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const base = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'tools');
const names = {
  parent: 'TEST_996_WINDOWS_C_CONCURRENT_FENCE_NATIVE_ONCE.ps1',
  worker: 'INVOKE_996_WINDOWS_C_CONCURRENT_FENCE_WORKER_TEST.ps1',
  cmd: 'RUN_996_WINDOWS_C_CONCURRENT_FENCE_TEMP_ONCE.cmd',
};
const bytes = Object.fromEntries(Object.entries(names).map(([key, name]) =>
  [key, readFileSync(resolve(base, name))]));
const source = Object.fromEntries(Object.entries(bytes).map(([key, value]) =>
  [key, value.toString('utf8')]));
const sha = (value) => createHash('sha256').update(value).digest('hex');

test('new bundle is test-only and rejects original PC before any fixture mutations', () => {
  for (const key of ['parent', 'worker']) {
    const ps = source[key];
    const gate = ps.indexOf('if (-not $TestOnly)');
    const firstCreate = ps.search(/CreateDirectory|Write-Once|Process]::Start/);
    assert.match(ps, /\[switch\]\$TestOnly/);
    assert.match(ps, /E:\\ZGmini/);
    assert.match(ps, /C_FENCE_\w*ORIGINAL_PC_PRESENT/);
    assert.ok(firstCreate > 0);
    if (key === 'worker') assert.ok(gate > 0 && gate < firstCreate);
    else {
      assert.ok(ps.indexOf("Must ([bool]$TestOnly)") < ps.indexOf('CreateDirectory($leases)'));
      assert.ok(ps.indexOf('C_FENCE_ORIGINAL_PC_PRESENT') < ps.indexOf('CreateDirectory($leases)'));
    }
  }
});

test('both processes independently enforce fixed local NTFS/ReFS TEMP and reparse safety', () => {
  for (const key of ['parent', 'worker']) {
    const ps = source[key];
    assert.match(ps, /\[IO\.Path\]::GetTempPath\(\)/);
    assert.match(ps, /DriveType -eq \[IO\.DriveType\]::Fixed|DriveType -ne \[IO\.DriveType\]::Fixed/);
    assert.match(ps, /'NTFS','ReFS'/);
    assert.match(ps, /FileAttributes\]::ReparsePoint/);
    assert.match(ps, /Safe-Directory \$temp/);
    assert.match(ps, /GetFileHash|Get-FileHash/);
  }
  assert.match(source.worker, /zgmini-996-test-c-fence-\[a-f0-9\]\{32\}/);
  assert.match(source.parent, /zgmini-996-test-c-fence-/);
});

test('distinct real Windows PowerShell OS processes—not jobs or runspaces', () => {
  const ps = source.parent;
  assert.match(ps, /\$ids=@\(\[Guid\]::NewGuid\(\)\.ToString\('D'\),\[Guid\]::NewGuid\(\)\.ToString\('D'\)\)/);
  assert.match(ps, /\[Diagnostics\.ProcessStartInfo\]::new\(\)/);
  assert.match(ps, /\$psi\.Arguments=/);
  assert.match(ps, /\[Diagnostics\.Process\]::Start\(\$psi\)/);
  assert.match(ps, /\$processes\[0\]\.Id -ne \$processes\[1\]\.Id/);
  assert.doesNotMatch(ps, /\.ArgumentList\b|Start-Job|Start-ThreadJob|Start-Process|Start-Sleep -Seconds [1-9]\d{2,}/);
  assert.match(source.worker, /processId=\$PID/);
});

test('two READY receipts with matching process IDs precede one atomic GO', () => {
  const ps = source.parent;
  const readyStart = ps.indexOf('$readyDeadline=');
  const receiptCheck = ps.indexOf("'C_FENCE_READY_PROVENANCE_INVALID'");
  const go = ps.indexOf("[IO.File]::Move($goPrepared,(Join-Path $fixtureRoot 'go.json'))");
  assert.ok(readyStart > 0 && receiptCheck > readyStart && go > receiptCheck);
  assert.match(ps, /AddSeconds\(30\)/);
  assert.match(source.worker, /AddSeconds\(45\)/);
  assert.match(source.worker, /\$goState\.nonce -ceq \$BarrierNonce/);
  assert.match(ps, /\[int\]\$receipt\.processId -eq \$processes\[\$i\]\.Id/);
  assert.equal((ps.match(/\[IO\.File\]::Move\(\$goPrepared/g) ?? []).length, 1);
});

test('real atomic Directory.Move same fixed-name reservation and valid BUSY owner required', () => {
  const ps = source.worker;
  assert.match(ps, /\[IO\.Directory\]::Move\(\$proposal,\$fixed\)/);
  assert.match(ps, /catch \[IO\.IOException\]/);
  assert.match(ps, /C_FENCE_WORKER_MOVE_IO_UNKNOWN/);
  assert.match(ps, /C_FENCE_WORKER_BUSY_OWNER_UNKNOWN/);
  assert.match(ps, /Exception\.HResult -band 0xffff/);
  assert.match(ps, /\$win32Error -in @\(80,183\)/);
  assert.match(ps, /\$winner\.continuationRequestId -cne \$ContinuationId/);
  assert.match(ps, /\$winner\.nonce -ceq \$BarrierNonce/);
  assert.match(source.parent, /\$winners\.Count -eq 1 -and \$busy\.Count -eq 1/);
  assert.match(source.parent, /C_FENCE_RACE_CARDINALITY_INVALID/);
  assert.match(source.parent, /C_FENCE_FIXED_RESERVATION_OWNER_INVALID/);
});

test('old recovery and independent install owner digests remain invariant', () => {
  const ps = source.parent;
  const child = source.worker;
  assert.match(ps, /oldOwnerSha256=\$oldPin;installOwnerSha256=\$installPin/);
  assert.match(ps, /proposalOwnerSha256=\$proposalPins/);
  assert.match(ps, /C_FENCE_WINNER_OWNER_SHA_DRIFT/);
  assert.match(ps, /C_FENCE_BUSY_OWNER_SHA_DRIFT/);
  assert.match(ps, /C_FENCE_ORIGINAL_OWNERS_CHANGED/);
  assert.match(child, /C_FENCE_WORKER_ORIGINAL_PIN_DRIFT/);
  assert.match(child, /C_FENCE_WORKER_LATE_PIN_DRIFT/);
  assert.match(child, /C_FENCE_WORKER_POSTMOVE_PIN_DRIFT/);
  assert.match(child, /C_FENCE_WORKER_BUSY_PROPOSAL_DRIFT/);
  assert.match(ps, /C_FENCE_PROPOSAL_MOVE_INVARIANT_INVALID/);
});

test('failure observes both launched OS children with one bounded clock, never kills them', () => {
  const ps = source.parent;
  assert.match(ps, /\$waitLimit=\[DateTime\]::UtcNow\.AddSeconds\(50\)/);
  assert.match(ps, /\$p\.WaitForExit\(\$remain\)/);
  assert.match(ps, /childProcessesSettled=\$settled/);
  assert.match(ps, /childPids=\$observedChildPids/);
  assert.doesNotMatch(ps, /\.Kill\(|Stop-Process|Stop-Job/);
});

test('no network, operational repairs, deletion, or policy bypass in the bundle', () => {
  for (const key of ['parent', 'worker', 'cmd']) {
    const code = source[key];
    assert.doesNotMatch(code, /\b(Remove-Item|Move-Item|Stop-Process|Stop-Service|Set-ExecutionPolicy|Invoke-RestMethod|Invoke-WebRequest|Start-BitsTransfer|gh\s+api|gh\s+workflow|git\s+push|curl\.exe|schtasks\.exe|wmic\.exe)\b/i);
    assert.doesNotMatch(code, /-ExecutionPolicy\s+(?:Bypass|Unrestricted)/i);
    assert.doesNotMatch(code, /(?:https?:\/\/|api\.github\.com)/i);
  }
  assert.match(source.parent, /originalPcWrites=0;workflowPuts=0;backlogWrites=0;issuePosts=0/);
  assert.match(source.parent, /pcRetries=0;cleanupPerformed=\$false/);
  assert.match(source.worker, /executionAuthorized=\$false;originalPcWrites=0/);
});

test('CMD fails closed unless both exact PS1 digests match reviewed content', () => {
  const cmd = source.cmd;
  assert.match(cmd, /if exist "E:\\ZGmini\\"/);
  assert.match(cmd, /Get-FileHash -LiteralPath \$env:ZGMINI_C_FENCE_PARENT -Algorithm SHA256/);
  assert.match(cmd, /Get-FileHash -LiteralPath \$env:ZGMINI_C_FENCE_WORKER -Algorithm SHA256/);
  assert.match(cmd, /PINNED_TWO_SCRIPT_SHA256_MISMATCH/);
  assert.match(cmd, /-NoProfile -NonInteractive -File "%ZGMINI_C_FENCE_PARENT%" -TestOnly/);
  assert.ok(cmd.toLowerCase().includes(sha(bytes.parent)));
  assert.ok(cmd.toLowerCase().includes(sha(bytes.worker)));
});

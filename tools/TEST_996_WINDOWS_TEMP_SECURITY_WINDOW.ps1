# #996: TEMP-only Windows proof for a scoped, reversible ACL change.
# Original-PC exception is TEMP-only and requires an explicit user-approved
# switch. E:\ZGmini data, leases, locks, workflows and security stay untouched.
# This test is not an authorized Controller C operator.
[CmdletBinding()]
param(
  [switch]$TestOnly,
  [switch]$InjectFailure,
  [switch]$RecoverOnly,
  [string]$FixtureRoot,
  [switch]$SimulateChildTermination,
  [switch]$AllowOriginalPcTempOnly
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if (-not $TestOnly) { throw 'C996_SECURITY_PROOF_TEST_ONLY_REQUIRED' }
if (([IO.Directory]::Exists('E:\ZGmini') -or [IO.File]::Exists('E:\ZGmini')) -and
    -not $AllowOriginalPcTempOnly) {
  throw 'C996_SECURITY_PROOF_ORIGINAL_PC_FORBIDDEN'
}
$temp = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\')
$volume = [IO.Path]::GetPathRoot($temp)
if ($volume -ieq 'E:\' -or $volume -notmatch '^[a-zA-Z]:\\$' -or
    $temp -match '(^|[\\/])ZGmini([\\/]|$)') {
  throw 'C996_SECURITY_PROOF_UNSAFE_TEMP'
}
$disk = [IO.DriveInfo]::new($volume)
if (-not $disk.IsReady -or $disk.DriveType -ne [IO.DriveType]::Fixed -or
    $disk.DriveFormat -notin @('NTFS','ReFS')) {
  throw 'C996_SECURITY_PROOF_UNSUPPORTED_VOLUME'
}
# Refuse a TEMP path that resolves through a junction/reparse point.
$ancestor = [IO.DirectoryInfo]::new($temp)
while ($null -ne $ancestor) {
  if (($ancestor.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
    throw 'C996_SECURITY_PROOF_TEMP_REDIRECT'
  }
  $ancestor = $ancestor.Parent
}

function Assert-FixtureRoot([string]$candidate) {
  if ([string]::IsNullOrWhiteSpace($candidate)) {
    throw 'C996_SECURITY_PROOF_RECOVERY_ROOT_MISSING'
  }
  $resolved = [IO.Path]::GetFullPath($candidate).TrimEnd('\')
  if (-not [IO.Path]::GetDirectoryName($resolved).Equals($temp,
      [StringComparison]::OrdinalIgnoreCase) -or
      [IO.Path]::GetFileName($resolved) -cnotmatch '^zgmini-996-acl-fixture-[a-f0-9]{32}$' -or
      -not [IO.Directory]::Exists($resolved)) {
    throw 'C996_SECURITY_PROOF_RECOVERY_ROOT_UNSAFE'
  }
  $entry = [IO.DirectoryInfo]::new($resolved)
  if (($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
    throw 'C996_SECURITY_PROOF_RECOVERY_ROOT_REDIRECT'
  }
  return $resolved
}

if ($RecoverOnly) {
  if ($InjectFailure -or $SimulateChildTermination) {
    throw 'C996_SECURITY_PROOF_RECOVERY_MODE_CONFLICT'
  }
  $recoveryRoot = Assert-FixtureRoot $FixtureRoot
  $journal = Join-Path $recoveryRoot 'acl-recovery.json'
  if (-not [IO.File]::Exists($journal) -or
      ([IO.FileInfo]::new($journal)).Length -gt 8192 -or
      ([IO.File]::GetAttributes($journal) -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
    throw 'C996_SECURITY_PROOF_JOURNAL_UNSAFE'
  }
  $saved = [IO.File]::ReadAllText($journal) | ConvertFrom-Json
  if ($saved.schema -cne 'ZGMINI_996_TEMP_ACL_RECOVERY_V1' -or
      $saved.testOnly -cne $true -or
      $saved.beforeHash -cnotmatch '^[0-9A-F]{64}$' -or
      $saved.beforeDacl -cnotmatch '^D:' -or
      $saved.beforeDacl.Length -gt 4096) {
    throw 'C996_SECURITY_PROOF_JOURNAL_INVALID'
  }
  $oldFile = Join-Path $recoveryRoot 'source\owner.json'
  $movedFile = Join-Path $recoveryRoot 'archive\owner.json'
  $oldExists = [IO.File]::Exists($oldFile)
  $movedExists = [IO.File]::Exists($movedFile)
  if ($oldExists -eq $movedExists) {
    throw 'C996_SECURITY_PROOF_RECOVERY_PATH_AMBIGUOUS'
  }
  $restoreTarget = $(if ($oldExists) { $oldFile } else { $movedFile })
  $targetDirectory = [IO.DirectoryInfo]::new([IO.Path]::GetDirectoryName($restoreTarget))
  if (($targetDirectory.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or
      ([IO.File]::GetAttributes($restoreTarget) -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or
      (Get-FileHash -LiteralPath $restoreTarget -Algorithm SHA256).Hash -cne $saved.beforeHash) {
    throw 'C996_SECURITY_PROOF_RECOVERY_SOURCE_DRIFT'
  }
  $section = [Security.AccessControl.AccessControlSections]::Access
  $recoveryAcl = Get-Acl -LiteralPath $restoreTarget
  $recoveryAcl.SetSecurityDescriptorSddlForm([string]$saved.beforeDacl,$section)
  Set-Acl -LiteralPath $restoreTarget -AclObject $recoveryAcl
  $restoredDacl = (Get-Acl -LiteralPath $restoreTarget).GetSecurityDescriptorSddlForm($section)
  $recovered = ($restoredDacl -ceq $saved.beforeDacl -and
    (Get-FileHash -LiteralPath $restoreTarget -Algorithm SHA256).Hash -ceq $saved.beforeHash)
  [ordered]@{
    schema='ZGMINI_996_TEMP_SECURITY_RECOVERY_V1'
    scope='ISOLATED_WINDOWS_TEMP_ONLY'
    ok=[bool]$recovered
    recoveryAttempted=$true
    aclRestored=[bool]$recovered
    executionAuthorized=$false
    originalPcWrites=0
  } | ConvertTo-Json -Compress
  if (-not $recovered) { exit 2 }
  exit 0
}
if ($InjectFailure -and $SimulateChildTermination) {
  throw 'C996_SECURITY_PROOF_FAILURE_MODE_CONFLICT'
}
if ($SimulateChildTermination) {
  if ([string]::IsNullOrWhiteSpace($FixtureRoot)) {
    throw 'C996_SECURITY_PROOF_TERMINATION_ROOT_REQUIRED'
  }
  $root = [IO.Path]::GetFullPath($FixtureRoot).TrimEnd('\')
  if (-not [IO.Path]::GetDirectoryName($root).Equals($temp,
      [StringComparison]::OrdinalIgnoreCase) -or
      [IO.Path]::GetFileName($root) -cnotmatch '^zgmini-996-acl-fixture-[a-f0-9]{32}$' -or
      [IO.Directory]::Exists($root) -or [IO.File]::Exists($root)) {
    throw 'C996_SECURITY_PROOF_TERMINATION_ROOT_UNSAFE'
  }
} else {
  if (-not [string]::IsNullOrWhiteSpace($FixtureRoot)) {
    throw 'C996_SECURITY_PROOF_ROOT_ARGUMENT_NOT_ALLOWED'
  }
  $root = Join-Path $temp ('zgmini-996-acl-fixture-' + [guid]::NewGuid().ToString('N'))
}
$source = Join-Path $root 'source'
$archive = Join-Path $root 'archive'
[IO.Directory]::CreateDirectory($source) | Out-Null
$original = Join-Path $source 'owner.json'
$initialBytes = [Text.Encoding]::UTF8.GetBytes('{"fixture":true}')
[IO.File]::WriteAllBytes($original,$initialBytes)
$initialHash = (Get-FileHash -LiteralPath $original -Algorithm SHA256).Hash
$originalAcl = Get-Acl -LiteralPath $original
$daclPart = [Security.AccessControl.AccessControlSections]::Access
$beforeDacl = $originalAcl.GetSecurityDescriptorSddlForm($daclPart)
# Persist the RESTORE-only data BEFORE any ACL effect; no owner/DB/secret data.
$recoveryJournal = Join-Path $root 'acl-recovery.json'
$journalObject = [ordered]@{
  schema='ZGMINI_996_TEMP_ACL_RECOVERY_V1'
  testOnly=$true
  beforeHash=$initialHash
  beforeDacl=$beforeDacl
}
$journalBytes = [Text.Encoding]::UTF8.GetBytes(($journalObject | ConvertTo-Json -Compress))
$journalStream = [IO.FileStream]::new($recoveryJournal,[IO.FileMode]::CreateNew,
  [IO.FileAccess]::Write,[IO.FileShare]::None,4096,[IO.FileOptions]::WriteThrough)
try {
  $journalStream.Write($journalBytes,0,$journalBytes.Length)
  $journalStream.Flush($true)
} finally { $journalStream.Dispose() }
$changed = $false
$restored = $false
$moveSucceeded = $false
$lockedMoveBlocked = $false
$expectedFailure = $false
$primaryError = $null
$handle = $null

try {
  # Scope the temporary ACL modification to this one synthetic owner.json.
  $acl = Get-Acl -LiteralPath $original
  $users = [Security.Principal.SecurityIdentifier]::new('S-1-5-32-545')
  $rule = [Security.AccessControl.FileSystemAccessRule]::new(
    $users,[Security.AccessControl.FileSystemRights]::ReadData,
    [Security.AccessControl.AccessControlType]::Allow)
  $acl.AddAccessRule($rule)
  Set-Acl -LiteralPath $original -AclObject $acl
  $changed = ((Get-Acl -LiteralPath $original).GetSecurityDescriptorSddlForm($daclPart) -cne $beforeDacl)
  if (-not $changed) { throw 'C996_SECURITY_PROOF_ACL_CHANGE_NOT_OBSERVED' }

  if ($SimulateChildTermination) {
    # Only the isolated Windows test parent may request this branch.
    # Terminate without executing finally. The next process must use
    # -RecoverOnly with the recorded fixtureRoot to restore the saved DACL.
    if ($env:ZGMINI_996_TEMP_TERMINATION_TEST -cne '1') {
      throw 'C996_SECURITY_PROOF_TERMINATION_NOT_AUTHORIZED'
    }
    [Console]::Out.WriteLine(([ordered]@{
      scope='ISOLATED_WINDOWS_TEMP_ONLY'
      fixtureRoot=$root
      executionAuthorized=$false
      originalPcWrites=0
    } | ConvertTo-Json -Compress))
    [Console]::Out.Flush()
    [Environment]::Exit(17)
  }

  if ($InjectFailure) { throw 'C996_SECURITY_PROOF_INJECTED_FAILURE' }

  # The ACL adjustment does not override a file-share violation.
  $handle = [IO.File]::Open($original,[IO.FileMode]::Open,
    [IO.FileAccess]::Read,[IO.FileShare]::Read)
  try {
    [IO.Directory]::Move($source,$archive)
  } catch [IO.IOException] {
    $lockedMoveBlocked = $true
  }
  if (-not $lockedMoveBlocked -or -not [IO.Directory]::Exists($source)) {
    throw 'C996_SECURITY_PROOF_LOCKED_MOVE_NOT_BLOCKED'
  }
  $handle.Dispose()
  $handle = $null
  # After Move, finally checks BOTH candidate paths, including when an
  # exception occurs before normal return.
  [IO.Directory]::Move($source,$archive)
  $moveSucceeded = $true
} catch {
  $primaryError = $_.Exception.Message
  $expectedFailure = ($InjectFailure -and $primaryError -match 'C996_SECURITY_PROOF_INJECTED_FAILURE')
} finally {
  if ($null -ne $handle) { $handle.Dispose() }
  # Restore the exact original DACL even if the proof fails mid-operation.
  try {
    $sourcePresent = [IO.File]::Exists($original)
    $archiveFile = Join-Path $archive 'owner.json'
    $archivePresent = [IO.File]::Exists($archiveFile)
    if ($sourcePresent -xor $archivePresent) {
      $restoreTarget = $(if ($sourcePresent) { $original } else { $archiveFile })
      Set-Acl -LiteralPath $restoreTarget -AclObject $originalAcl
      $afterDacl = (Get-Acl -LiteralPath $restoreTarget).GetSecurityDescriptorSddlForm($daclPart)
      $afterHash = (Get-FileHash -LiteralPath $restoreTarget -Algorithm SHA256).Hash
      $restored = ($afterDacl -ceq $beforeDacl -and $afterHash -ceq $initialHash)
    }
  } catch {
    $primaryError = 'C996_SECURITY_PROOF_RESTORE_FAILED'
  }
}

$ok = $restored -and $changed -and (
  ($InjectFailure -and $expectedFailure -and -not $moveSucceeded) -or
  (-not $InjectFailure -and $moveSucceeded -and $lockedMoveBlocked -and $null -eq $primaryError))
$result = [ordered]@{
  schema = 'ZGMINI_996_TEMP_SECURITY_WINDOW_PROOF_V1'
  scope = 'ISOLATED_WINDOWS_TEMP_ONLY'
  ok = [bool]$ok
  aclChanged = [bool]$changed
  aclRestored = [bool]$restored
  lockedMoveBlocked = [bool]$lockedMoveBlocked
  moveAfterCloseSucceeded = [bool]$moveSucceeded
  injectedFailureRecovered = [bool]$expectedFailure
  executionAuthorized = $false
  originalPcWrites = 0
  workflowPuts = 0
  backlogWrites = 0
  processTerminationRecoveryProven = $false
  fixtureRoot = $root
  errorCode = $(if ($ok) { $null } else { $primaryError })
}
$result | ConvertTo-Json -Compress -Depth 4
if (-not $ok) { exit 2 }

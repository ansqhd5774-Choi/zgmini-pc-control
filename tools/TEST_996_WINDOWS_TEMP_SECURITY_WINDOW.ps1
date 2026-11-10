# #996: TEMP-only Windows proof for a scoped, reversible ACL change.
# NEVER call this against the original Windows PC or E:\ZGmini.
# This test is not an authorized Controller C operator.
[CmdletBinding()]
param(
  [switch]$TestOnly,
  [switch]$InjectFailure
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if (-not $TestOnly) { throw 'C996_SECURITY_PROOF_TEST_ONLY_REQUIRED' }
if ([IO.Directory]::Exists('E:\ZGmini') -or [IO.File]::Exists('E:\ZGmini')) {
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

$root = Join-Path $temp ('zgmini-996-acl-fixture-' + [guid]::NewGuid().ToString('N'))
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

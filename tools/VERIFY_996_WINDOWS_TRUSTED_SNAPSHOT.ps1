# Review entry point. Its own source must be checked against an external pin
# before execution. The supplied pins are inputs, never Owner consent.
[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][string]$PackageRoot,
  [Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{40}$')][string]$ManifestCommitSha,
  [Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{64}$')][string]$BootstrapSha256,
  [Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{64}$')][string]$SourceLockSha256,
  [Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{64}$')][string]$PackageSha256,
  [Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{64}$')][string]$SnapshotHelperSha256,
  [switch]$ReviewOperatorHandoff
)
$ErrorActionPreference = 'Stop'
$snapshot = $null
$savedNodeEnvironment = @{}
try {
  if ($env:GITHUB_ACTIONS -or $env:RUNNER_NAME) { throw 'C996_SNAPSHOT_DIRECT_WINDOWS_ONLY' }
  $root = [IO.Path]::GetFullPath($PackageRoot)
  $tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\') + '\'
  if (!$root.StartsWith($tempRoot, [StringComparison]::OrdinalIgnoreCase)) { throw 'C996_SNAPSHOT_TEMP_REQUIRED' }
  $helper = Join-Path $PSScriptRoot 'controller-996-windows-source-snapshot.cs'
  $helperBytes = [IO.File]::ReadAllBytes($helper)
  $sha = [Security.Cryptography.SHA256]::Create()
  try {
    $helperObserved = [BitConverter]::ToString($sha.ComputeHash($helperBytes)).Replace('-', '').ToLowerInvariant()
  } finally { $sha.Dispose() }
  if ($helperObserved -cne $SnapshotHelperSha256) { throw 'C996_SNAPSHOT_HELPER_SHA_MISMATCH' }
  Add-Type -TypeDefinition ([Text.Encoding]::UTF8.GetString($helperBytes))
  $lockPath = Join-Path $root 'tools\controller-996-c-native-owner-source-lock.json'
  $bootstrapPath = Join-Path $root 'tools\controller-996-c-native-trusted-bootstrap.mjs'
  $zipPath = Join-Path $root 'artifacts\controller-996\zgmini-996-c-native-owner-package.zip'
  $pins = New-Object 'System.Collections.Generic.Dictionary[string,string]' ([StringComparer]::OrdinalIgnoreCase)
  $pins.Add($lockPath, $SourceLockSha256)
  # Pin the lock before parsing it, and keep that handle until the child exits.
  $lockGuard = [Zgmini996WindowsSourceSnapshot]::new($pins)
  try {
    $lock = Get-Content -Raw -LiteralPath $lockPath | ConvertFrom-Json
    if ($lock.schema -cne 'ZGMINI_CONTROLLER_996_NATIVE_OWNER_SOURCE_LOCK_V1' -or
        @($lock.files.PSObject.Properties).Count -ne 16) { throw 'C996_SNAPSHOT_LOCK_INVALID' }
    foreach ($entry in $lock.files.PSObject.Properties) {
      if ($entry.Name -cnotmatch '^tools/controller-996-[a-z0-9-]+\.(mjs|json)$') { throw 'C996_SNAPSHOT_LOCK_PATH_INVALID' }
      $pins.Add((Join-Path $root $entry.Name.Replace('/', '\')), [string]$entry.Value)
    }
    if (!$pins.ContainsKey($bootstrapPath) -or $pins[$bootstrapPath] -cne $BootstrapSha256) {
      throw 'C996_SNAPSHOT_BOOTSTRAP_PIN_MISMATCH'
    }
    $pins.Add($zipPath, $PackageSha256)
    $snapshot = [Zgmini996WindowsSourceSnapshot]::new($pins)
    foreach ($name in @('NODE_OPTIONS','NODE_PATH','NODE_COMPILE_CACHE','NODE_V8_COVERAGE')) {
      $savedNodeEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
      [Environment]::SetEnvironmentVariable($name, $null, 'Process')
    }
    if (!$ReviewOperatorHandoff) {
      & 'E:\ZGmini\runtime\node.exe' $bootstrapPath $ManifestCommitSha
      if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    } else {
      $operatorPath = Join-Path $root 'tools\controller-996-c-native-owner-operator.mjs'
      if (!$pins.ContainsKey($operatorPath)) { throw 'C996_SNAPSHOT_OPERATOR_PIN_MISSING' }
      $reply = & 'E:\ZGmini\runtime\node.exe' $bootstrapPath $ManifestCommitSha
      if ($LASTEXITCODE -ne 0) { throw 'C996_SNAPSHOT_BOOTSTRAP_REVIEW_FAILED' }
      if (@($reply).Count -ne 1) { throw 'C996_SNAPSHOT_BOOTSTRAP_RECEIPT_INVALID' }
      $proof = $reply | ConvertFrom-Json
      if ($proof.schema -cne 'ZGMINI_CONTROLLER_996_NATIVE_TRUSTED_BOOTSTRAP_REVIEW_V1' -or
          $proof.status -cne 'GIT_AND_LOCAL_BYTES_OBSERVED_ONLY' -or
          $proof.filesCheckedAtS1 -ne 16 -or $proof.filesCheckedAtS2 -ne 3 -or $proof.effectsChecked -ne 7 -or
          $proof.ownerConsentCommentId -isnot [ValueType] -or
          "$($proof.ownerConsentCommentId)" -cnotmatch '^[1-9][0-9]{0,14}$' -or
          $proof.manifestSha256 -cnotmatch '^[a-f0-9]{64}$' -or
          $proof.manifestCommitSha -cne $ManifestCommitSha -or
          $proof.bootstrapSha256 -cne $BootstrapSha256 -or
          $proof.operatorSha256 -cne $pins[$operatorPath] -or
          $proof.sourceLockSha256 -cne $SourceLockSha256 -or
          $proof.packageSha256 -cne $PackageSha256 -or
          $proof.executionAuthorized -isnot [bool] -or $proof.executionAuthorized -or
          $proof.operatorStarted -isnot [bool] -or $proof.operatorStarted) {
        throw 'C996_SNAPSHOT_BOOTSTRAP_RECEIPT_INVALID'
      }
      $operatorReply = & 'E:\ZGmini\runtime\node.exe' $operatorPath --review-handoff $ManifestCommitSha $proof.manifestSha256 "$($proof.ownerConsentCommentId)"
      if ($LASTEXITCODE -ne 0 -or @($operatorReply).Count -ne 1) { throw 'C996_SNAPSHOT_OPERATOR_REVIEW_FAILED' }
      $operatorProof = $operatorReply | ConvertFrom-Json
      if ($operatorProof.status -cne 'OPERATOR_REVIEW_BOUNDARY_REACHED' -or
          $operatorProof.code -cne 'C_996_OWNER_PREIMPORT_AND_NATIVE_CAS_NOT_ATTESTED' -or
          $operatorProof.manifestCommitSha -cne $ManifestCommitSha -or
          $operatorProof.manifestSha256 -cne $proof.manifestSha256 -or
          $operatorProof.ownerConsentCommentId -ne $proof.ownerConsentCommentId -or
          $operatorProof.executionAuthorized -isnot [bool] -or $operatorProof.executionAuthorized -or
          $null -eq $operatorProof.originalPcWrites -or $operatorProof.originalPcWrites -ne 0) {
        throw 'C996_SNAPSHOT_OPERATOR_RECEIPT_INVALID'
      }
      [Console]::WriteLine([string]$operatorReply)
    }
  } finally {
    if ($null -ne $snapshot) { $snapshot.Dispose() }
    $lockGuard.Dispose()
  }
} catch {
  $message = $_.Exception.GetBaseException().Message
  $code = if ($message -cmatch '^C996_SNAPSHOT_[A-Z0-9_]+$') { $message } else { 'C996_SNAPSHOT_REVIEW_BLOCKED' }
  [Console]::WriteLine((@{status='BOOTSTRAP_NO_GO'; code=$code; executionAuthorized=$false; operatorStarted=$false} | ConvertTo-Json -Compress))
  exit 2
} finally {
  foreach ($name in $savedNodeEnvironment.Keys) {
    [Environment]::SetEnvironmentVariable($name, $savedNodeEnvironment[$name], 'Process')
  }
}

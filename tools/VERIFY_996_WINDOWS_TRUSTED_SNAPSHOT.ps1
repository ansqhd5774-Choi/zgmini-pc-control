# Review entry point. Its own source must be checked against an external pin
# before execution. The supplied pins are inputs, never Owner consent.
[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][string]$PackageRoot,
  [Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{40}$')][string]$ManifestCommitSha,
  [Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{64}$')][string]$BootstrapSha256,
  [Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{64}$')][string]$SourceLockSha256,
  [Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{64}$')][string]$PackageSha256,
  [Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{64}$')][string]$SnapshotHelperSha256
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
    & 'E:\ZGmini\runtime\node.exe' $bootstrapPath $ManifestCommitSha
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
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

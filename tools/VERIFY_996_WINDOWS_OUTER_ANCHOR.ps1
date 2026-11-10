# Run this review code from an independently trusted source, outside the
# downloaded package. Package files and hash arguments cannot establish consent.
[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][string]$PackageRoot,
  [Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{40}$')][string]$ManifestCommitSha,
  [Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{64}$')][string]$LauncherSha256,
  [Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{64}$')][string]$NodeSha256,
  [Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{64}$')][string]$BootstrapSha256,
  [Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{64}$')][string]$SourceLockSha256,
  [Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{64}$')][string]$PackageSha256,
  [Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{64}$')][string]$SnapshotHelperSha256,
  [switch]$ReviewOperatorHandoff,
  [ValidatePattern('^[a-f0-9]{64}$')][string]$OuterSha256
)
$ErrorActionPreference = 'Stop'
$guard = $null
try {
  if ($env:GITHUB_ACTIONS -or $env:RUNNER_NAME) { throw 'C996_ANCHOR_DIRECT_WINDOWS_ONLY' }
  $root = [IO.Path]::GetFullPath($PackageRoot).TrimEnd('\')
  $temp = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\') + '\'
  if (!$root.StartsWith($temp, [StringComparison]::OrdinalIgnoreCase)) { throw 'C996_ANCHOR_TEMP_REQUIRED' }
  $helper = Join-Path $root 'tools\controller-996-windows-source-snapshot.cs'
  $launcher = Join-Path $root 'tools\VERIFY_996_WINDOWS_TRUSTED_SNAPSHOT.ps1'
  $helperBytes = [IO.File]::ReadAllBytes($helper)
  $sha = [Security.Cryptography.SHA256]::Create()
  try {
    $observed = [BitConverter]::ToString($sha.ComputeHash($helperBytes)).Replace('-', '').ToLowerInvariant()
  } finally { $sha.Dispose() }
  if ($observed -cne $SnapshotHelperSha256) { throw 'C996_ANCHOR_HELPER_SHA_MISMATCH' }
  Add-Type -TypeDefinition ([Text.Encoding]::UTF8.GetString($helperBytes))
  $pins = New-Object 'System.Collections.Generic.Dictionary[string,string]' ([StringComparer]::OrdinalIgnoreCase)
  $pins.Add($helper, $SnapshotHelperSha256)
  $pins.Add($launcher, $LauncherSha256)
  $pins.Add('E:\ZGmini\runtime\node.exe', $NodeSha256)
  if ($ReviewOperatorHandoff) {
    if (!$OuterSha256 -or !$PSCommandPath) { throw 'C996_ANCHOR_EXTERNAL_PIN_REQUIRED' }
    $pins.Add([IO.Path]::GetFullPath($PSCommandPath), $OuterSha256)
  }
  $guard = [Zgmini996WindowsSourceSnapshot]::new($pins)
  # Use a separate Windows PowerShell process. Its ordinary script policy
  # remains in force. The handles above stay open until the child exits.
  $reviewArgs = @()
  if ($ReviewOperatorHandoff) {
    $reviewArgs += @('-ReviewOperatorHandoff','-OuterSha256',$OuterSha256,
      '-LauncherSha256',$LauncherSha256,'-NodeSha256',$NodeSha256)
  }
  & 'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe' -NoProfile -NonInteractive -File $launcher `
    -PackageRoot $root -ManifestCommitSha $ManifestCommitSha -BootstrapSha256 $BootstrapSha256 `
    -SourceLockSha256 $SourceLockSha256 -PackageSha256 $PackageSha256 -SnapshotHelperSha256 $SnapshotHelperSha256 @reviewArgs
  exit $LASTEXITCODE
} catch {
  $message = $_.Exception.GetBaseException().Message
  $code = if ($message -cmatch '^C996_(ANCHOR|SNAPSHOT)_[A-Z0-9_]+$') { $message } else { 'C996_ANCHOR_REVIEW_BLOCKED' }
  [Console]::WriteLine((@{status='BOOTSTRAP_NO_GO'; code=$code; executionAuthorized=$false; operatorStarted=$false} | ConvertTo-Json -Compress))
  exit 2
} finally {
  if ($null -ne $guard) { $guard.Dispose() }
}

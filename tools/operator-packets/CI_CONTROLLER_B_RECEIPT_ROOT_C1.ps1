#Requires -Version 5.1
# Independent, interactive C-grade operator only. Never invoke from Actions/Runner.
# Creates one new, fixed durable ledger root on the isolated Windows host.
# Does not register GitHub variables, submit a Controller B issue, or enable publishing.
param([switch]$Apply)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$hostName = 'DESKTOP-N62L0NG'
$runnerName = 'zgmini-handoff-ci-spare-01'
$serviceName = 'actions.runner.ansqhd5774-Choi-zgmini-pc-control.zgmini-handoff-ci-spare-01'
$base = 'C:\ProgramData'
$parent = 'C:\ProgramData\ZGMINI-CI'
$root = 'C:\ProgramData\ZGMINI-CI\ControllerBReceipts'

function Stop-C([string]$code) { throw $code }
function Assert-PlainDirectory([string]$dir) {
  $item = Get-Item -LiteralPath $dir -Force -ErrorAction Stop
  if (-not $item.PSIsContainer -or ($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint)) {
    Stop-C 'CI_RECEIPT_PARENT_ALIAS_STOP'
  }
}
function New-BoundedAcl($runnerSid, [string]$runnerRights) {
  $acl = New-Object System.Security.AccessControl.DirectorySecurity
  $acl.SetAccessRuleProtection($true, $false)
  $inherit = [System.Security.AccessControl.InheritanceFlags]'ContainerInherit, ObjectInherit'
  $propagate = [System.Security.AccessControl.PropagationFlags]::None
  $allow = [System.Security.AccessControl.AccessControlType]::Allow
  $entries = @(
    @{Sid=[System.Security.Principal.SecurityIdentifier]::new('S-1-5-18'); Rights='FullControl'},
    @{Sid=[System.Security.Principal.SecurityIdentifier]::new('S-1-5-32-544'); Rights='FullControl'},
    @{Sid=$runnerSid; Rights=$runnerRights}
  )
  foreach ($entry in $entries) {
    $rights = [System.Security.AccessControl.FileSystemRights]([System.Enum]::Parse(
      [System.Security.AccessControl.FileSystemRights], [string]$entry.Rights))
    $rule = [System.Security.AccessControl.FileSystemAccessRule]::new(
      $entry.Sid, $rights, $inherit, $propagate, $allow)
    [void]$acl.AddAccessRule($rule)
  }
  return $acl
}
function Assert-ExactAcl([string]$dir, $runnerSid) {
  $acl = Get-Acl -LiteralPath $dir
  if (-not $acl.AreAccessRulesProtected) { Stop-C 'CI_RECEIPT_ACL_INHERITANCE_STOP' }
  $actual = @($acl.GetAccessRules($true, $true, [System.Security.Principal.SecurityIdentifier]))
  if ($actual.Count -ne 3) { Stop-C 'CI_RECEIPT_ACL_COUNT_STOP' }
  $expected = @('S-1-5-18', 'S-1-5-32-544', $runnerSid.Value)
  $seen = @{}
  foreach ($ace in $actual) {
    $id = $ace.IdentityReference.Value
    if ($ace.IsInherited -or $ace.AccessControlType -ne [System.Security.AccessControl.AccessControlType]::Allow -or
        $expected -notcontains $id -or $seen.ContainsKey($id)) {
      Stop-C 'CI_RECEIPT_ACL_BOUNDARY_STOP'
    }
    $seen[$id] = $true
    $full = [System.Security.AccessControl.FileSystemRights]::FullControl
    $expectedRights = if ($id -ne $runnerSid.Value) { $full }
      elseif ($dir -eq $parent) { [System.Security.AccessControl.FileSystemRights]::ReadAndExecute }
      else { [System.Security.AccessControl.FileSystemRights]::Modify }
    $rightBits = [int]$ace.FileSystemRights
    $required = [int]$expectedRights
    $sync = [int][System.Security.AccessControl.FileSystemRights]::Synchronize
    if (($rightBits -band (-bnot $sync)) -ne ($required -band (-bnot $sync))) {
      Stop-C 'CI_RECEIPT_ACL_RIGHTS_STOP'
    }
  }
  foreach ($id in $expected) {
    if (-not $seen.ContainsKey($id)) { Stop-C 'CI_RECEIPT_ACL_IDENTITY_STOP' }
  }
}

try {
  if (-not $Apply) { Stop-C 'CI_RECEIPT_EXPLICIT_C_APPLY_REQUIRED' }
  if ($env:GITHUB_ACTIONS -or $env:RUNNER_NAME -or -not [Environment]::UserInteractive) {
    Stop-C 'CI_RECEIPT_INTERACTIVE_OPERATOR_REQUIRED'
  }
  if ([Environment]::MachineName.ToUpperInvariant() -ne $hostName) {
    Stop-C 'CI_RECEIPT_HOST_MISMATCH'
  }
  $identity = [System.Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = [System.Security.Principal.WindowsPrincipal]::new($identity)
  if (-not $principal.IsInRole([System.Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Stop-C 'CI_RECEIPT_ADMIN_C_REQUIRED'
  }
  $services = @(Get-CimInstance -ClassName Win32_Service | Where-Object {
    $_.Name -ceq $serviceName -and
    $_.State -eq 'Running'
  })
  if ($services.Count -ne 1) { Stop-C 'CI_RECEIPT_RUNNER_SERVICE_UNVERIFIED' }
  $serviceAccount = [string]$services[0].StartName
  if ($serviceAccount -match '^(?i:LocalSystem|LocalService|NetworkService|NT AUTHORITY\\.*)$') {
    Stop-C 'CI_RECEIPT_DEDICATED_RUNNER_ACCOUNT_REQUIRED'
  }
  # Win32_Service.StartName may use '.\user' for a dedicated local Runner.
  # Windows NTAccount translation can reject this spelling even when
  # 'COMPUTERNAME\user' resolves to the same account. Do not change identity.
  $sidAccount = $serviceAccount
  if ($serviceAccount.StartsWith('.\', [System.StringComparison]::Ordinal)) {
    $localName = $serviceAccount.Substring(2)
    if ([string]::IsNullOrWhiteSpace($localName) -or $localName.Contains('\') -or
        $localName.Contains('/') -or $localName -ne $localName.Trim()) {
      Stop-C 'CI_RECEIPT_RUNNER_ACCOUNT_SHAPE_UNVERIFIED'
    }
    $sidAccount = [Environment]::MachineName + '\' + $localName
  }
  try {
    $runnerSid = ([System.Security.Principal.NTAccount]::new($sidAccount)).Translate([System.Security.Principal.SecurityIdentifier])
  } catch { Stop-C 'CI_RECEIPT_RUNNER_SID_UNVERIFIED' }
  if ($runnerSid.Value -in @('S-1-5-18','S-1-5-19','S-1-5-20','S-1-5-32-544')) {
    Stop-C 'CI_RECEIPT_SHARED_RUNNER_ACCOUNT_DENIED'
  }
  if ($env:ProgramData -ne $base) { Stop-C 'CI_RECEIPT_PROGRAMDATA_MISMATCH' }
  Assert-PlainDirectory 'C:\'
  Assert-PlainDirectory $base
  # Existing data is not modified or deleted. Partial prior attempts require inspection.
  if (Test-Path -LiteralPath $parent) { Stop-C 'CI_RECEIPT_PARENT_ALREADY_EXISTS_STOP' }
  if (Test-Path -LiteralPath $root) { Stop-C 'CI_RECEIPT_ROOT_ALREADY_EXISTS_STOP' }
  $parentAcl = New-BoundedAcl $runnerSid 'ReadAndExecute'
  $rootAcl = New-BoundedAcl $runnerSid 'Modify'
  [void][System.IO.Directory]::CreateDirectory($parent, $parentAcl)
  [void][System.IO.Directory]::CreateDirectory($root, $rootAcl)
  Assert-PlainDirectory $parent
  Assert-PlainDirectory $root
  Assert-ExactAcl $parent $runnerSid
  Assert-ExactAcl $root $runnerSid
  Write-Output 'status=PREPARED'
  Write-Output 'code=CI_RECEIPT_ROOT_LOCAL_ACL_PREPARED'
  Write-Output 'receiptRoot=C:\ProgramData\ZGMINI-CI\ControllerBReceipts'
  Write-Output 'publisherEnabled=false'
  Write-Output 'runnerWriteAndCrossRunDurability=UNVERIFIED'
  exit 0
} catch {
  $code = [string]$_.Exception.Message
  if ($code -notmatch '^CI_RECEIPT_[A-Z_]+$') { $code = 'CI_RECEIPT_OPERATOR_UNVERIFIED' }
  Write-Output 'status=STOPPED'
  Write-Output ('code=' + $code)
  Write-Output 'publisherEnabled=false'
  exit 1
}

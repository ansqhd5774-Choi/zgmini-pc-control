#Requires -Version 5.1
# #996 native Directory.Move primitive TEST ONLY — NO OPERATIONAL EXECUTION.
# No parameters, E: drive, installed Controller, GitHub access or approvals.
# Only a newly generated, checked TEMP fixture is written. No auto-delete.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
# This test is for a physically separate Windows machine only. Refuse the
# known original ZGmini root even when TEMP happens to be a safe C: volume.
$operationalRoot = [System.IO.Path]::Combine('E:\', 'ZGmini')
if ([System.IO.Directory]::Exists($operationalRoot) -or
  [System.IO.File]::Exists($operationalRoot)) {
  throw 'FIXTURE_ORIGINAL_ZGMINI_ROOT_PRESENT'
}
$tempPath = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
$tempDriveRoot = [System.IO.Path]::GetPathRoot($tempPath)
if ($tempDriveRoot -ieq 'E:\' -or
  $tempPath -match '(^|[\\/])ZGmini([\\/]|$)') {
  throw 'FIXTURE_TEMP_ROOT_IS_OPERATIONAL_OR_E_DRIVE'
}
# A remote/UNC/portable filesystem cannot serve as proof of a same-volume
# local Windows native move. The fixture is deliberately limited to a local
# fixed NTFS/ReFS disk outside the original E: volume.
if ($tempDriveRoot -notmatch '^[A-Za-z]:\\$') {
  throw 'FIXTURE_TEMP_REMOTE_OR_UNSUPPORTED_VOLUME'
}
$tempDrive = [System.IO.DriveInfo]::new($tempDriveRoot)
if (-not $tempDrive.IsReady -or
  $tempDrive.DriveType -ne [System.IO.DriveType]::Fixed -or
  $tempDrive.DriveFormat -notin @('NTFS','ReFS')) {
  throw 'FIXTURE_TEMP_NOT_LOCAL_FIXED_NTFS_REFS'
}
$walk = [System.IO.DirectoryInfo]::new($tempPath)
while ($null -ne $walk) {
  if (($walk.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
    throw 'FIXTURE_TEMP_PARENT_REPARSE_POINT'
  }
  $walk = $walk.Parent
}
$testRoot = Join-Path $tempPath (
  'zgmini-996-test-native-' + [guid]::NewGuid().ToString('N'))
$script:checks = 0

function Assert-Test([bool]$passed,[string]$code) {
  if (-not $passed) { throw [System.InvalidOperationException]::new($code) }
  $script:checks++
}
function New-TestCase([string]$name) {
  if ($name -notin @('ordered','collision','after-old','after-cont','new-lock')) {
    throw 'FIXTURE_CASE_NOT_ALLOWED'
  }
  $caseRoot = Join-Path $testRoot $name
  [System.IO.Directory]::CreateDirectory((Join-Path $caseRoot 'leases')) |
    Out-Null
  [System.IO.Directory]::CreateDirectory((Join-Path $caseRoot 'archives')) |
    Out-Null
  foreach ($key in @('oldC','continuation','install')) {
    $source = Join-Path (Join-Path $caseRoot 'leases') $key
    [System.IO.Directory]::CreateDirectory($source) | Out-Null
    [System.IO.File]::WriteAllText((Join-Path $source 'owner.json'),
      ('fixture-only-' + $key))
  }
  return $caseRoot
}
function Move-OnlyFixture([string]$caseRoot,[string]$step) {
  if ($step -notin @('oldC','continuation','install')) {
    throw 'FIXTURE_STEP_NOT_ALLOWED'
  }
  $source = Join-Path (Join-Path $caseRoot 'leases') $step
  $destination = Join-Path (Join-Path $caseRoot 'archives') $step
  # This tests the actual Windows .NET no-replace primitive, not C-grade
  # source/consent/ownership checks, filesystem durability or a transaction.
  [System.IO.Directory]::Move($source,$destination)
}

$result = $null
[System.IO.Directory]::CreateDirectory($testRoot) | Out-Null
try {
  $case = New-TestCase 'ordered'
  Move-OnlyFixture $case 'oldC'
  Assert-Test ([System.IO.Directory]::Exists((Join-Path $case 'leases/install'))) 'INSTALL_BARRIER_LOST_AFTER_OLD_C'
  Move-OnlyFixture $case 'continuation'
  Assert-Test ([System.IO.Directory]::Exists((Join-Path $case 'leases/install'))) 'INSTALL_BARRIER_LOST_AFTER_CONTINUATION'
  Move-OnlyFixture $case 'install'
  Assert-Test (-not [System.IO.Directory]::Exists((Join-Path $case 'leases/install'))) 'FINAL_INSTALL_MOVE_FAILED'
  foreach ($key in @('oldC','continuation','install')) {
    $oldOwner = [System.IO.File]::ReadAllText((Join-Path $case ('archives/' + $key + '/owner.json')))
    Assert-Test ($oldOwner -eq ('fixture-only-' + $key)) 'ARCHIVED_SOURCE_BYTE_DRIFT'
  }

  $case = New-TestCase 'collision'
  $occupied = Join-Path $case 'archives/oldC'
  [System.IO.Directory]::CreateDirectory($occupied) | Out-Null
  [System.IO.File]::WriteAllText((Join-Path $occupied 'sentinel.txt'),
    'preserve-destination')
  $rejected = $false
  try { Move-OnlyFixture $case 'oldC' }
  catch [System.IO.IOException] { $rejected = $true }
  Assert-Test $rejected 'EXISTING_DESTINATION_NOT_REJECTED'
  Assert-Test ([System.IO.Directory]::Exists((Join-Path $case 'leases/oldC'))) 'SOURCE_CHANGED_DURING_COLLISION'
  $sentinel = [System.IO.File]::ReadAllText((Join-Path $occupied 'sentinel.txt'))
  Assert-Test ($sentinel -eq 'preserve-destination') 'DESTINATION_OVERWRITTEN'

  $case = New-TestCase 'after-old'
  Move-OnlyFixture $case 'oldC'
  Assert-Test ([System.IO.Directory]::Exists((Join-Path $case 'leases/install'))) 'INSTALL_LOCK_LOST_AFTER_OLD_C_INTERRUPTION'

  $case = New-TestCase 'after-cont'
  Move-OnlyFixture $case 'oldC'
  Move-OnlyFixture $case 'continuation'
  Assert-Test ([System.IO.Directory]::Exists((Join-Path $case 'leases/install'))) 'INSTALL_LOCK_LOST_AFTER_CONTINUATION_INTERRUPTION'

  $case = New-TestCase 'new-lock'
  foreach ($step in @('oldC','continuation','install')) {
    Move-OnlyFixture $case $step
  }
  $newInstall = Join-Path $case 'leases/install'
  [System.IO.Directory]::CreateDirectory($newInstall) | Out-Null
  [System.IO.File]::WriteAllText((Join-Path $newInstall 'owner.json'),
    'fixture-only-next-owner')
  $archivedOwner = [System.IO.File]::ReadAllText((Join-Path $case 'archives/install/owner.json'))
  $newOwner = [System.IO.File]::ReadAllText((Join-Path $newInstall 'owner.json'))
  Assert-Test ($archivedOwner -eq 'fixture-only-install') 'OLD_INSTALL_ARCHIVE_CHANGED_BY_NEW_LOCK'
  Assert-Test ($newOwner -eq 'fixture-only-next-owner') 'NEW_LOCK_OBSERVATION_INVALID'

  $result = [ordered]@{
    schema='ZGMINI_996_WINDOWS_NATIVE_TEMP_FIXTURE_V1'
    status='WINDOWS_TEMP_FIXTURE_NATIVE_MOVE_ONLY'
    checksPassed=$script:checks
    installedRootTouched=$false
    executionAuthorized=$false
    originalPcWrites=0
    workflowPuts=0
    backlogWrites=0
    issuePosts=0
    operatorReady=$false
    fixturePath=$testRoot
    cleanupPerformed=$false
  }
} finally {
  # Intentionally NO recursive cleanup: a replaced/reparse fixture subtree
  # cannot make this test delete unrelated data. Review the returned path.
}
$result | ConvertTo-Json -Compress -Depth 5

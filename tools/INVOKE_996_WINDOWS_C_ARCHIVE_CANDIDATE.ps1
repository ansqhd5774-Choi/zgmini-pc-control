#Requires -Version 5.1
# #996 Windows C archive STAGE ENGINE CANDIDATE, not an operator/CLI.
# The only accepted mode is isolated Windows TEMP test. Original PC C work
# remains unconditionally disabled pending exact manifest, signed owner
# consent, authenticated fresh physical CAS and source byte validation.
[CmdletBinding()]
param(
  [switch]$TestOnly,
  [string]$FixtureRoot,
  [string]$ContinuationId,
  [ValidateSet('NONE','AFTER_OLD_C','AFTER_READY','AFTER_CONTINUATION','BEFORE_INSTALL','AFTER_INSTALL')]
  [string]$FailAfter = 'NONE'
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# MUST reject production before even examining a caller-supplied path.
if (-not $TestOnly) { throw 'C_CONTINUATION_PRODUCTION_NOT_APPROVED' }
if ([IO.Directory]::Exists('E:\ZGmini') -or [IO.File]::Exists('E:\ZGmini')) {
  throw 'C_OPERATOR_TEST_ORIGINAL_ZGMINI_PRESENT'
}
if ($ContinuationId -cnotmatch '^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$') {
  throw 'C_OPERATOR_TEST_NEW_ID_INVALID'
}

$temp = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$tempDrive = [IO.Path]::GetPathRoot($temp)
if ($tempDrive -ieq 'E:\' -or $tempDrive -notmatch '^[A-Za-z]:\\$' -or
    $temp -match '(^|[\\/])ZGmini([\\/]|$)') {
  throw 'C_OPERATOR_TEST_TEMP_ROOT_UNSAFE'
}
$drive = [IO.DriveInfo]::new($tempDrive)
if (-not $drive.IsReady -or $drive.DriveType -ne [IO.DriveType]::Fixed -or
    $drive.DriveFormat -notin @('NTFS','ReFS')) {
  throw 'C_OPERATOR_TEST_VOLUME_UNSAFE'
}
if ([string]::IsNullOrWhiteSpace($FixtureRoot)) {
  throw 'C_OPERATOR_TEST_ROOT_MISSING'
}
$root = [IO.Path]::GetFullPath($FixtureRoot)
if (-not $root.StartsWith($temp.TrimEnd('\') + '\',
      [StringComparison]::OrdinalIgnoreCase) -or
    [IO.Path]::GetFileName($root) -cnotmatch '^zgmini-996-test-c-operator-[a-f0-9]{32}$') {
  throw 'C_OPERATOR_TEST_ROOT_OUTSIDE_TEMP'
}

function Assert-SafeDirectory([string]$directory) {
  $node = [IO.DirectoryInfo]::new($directory)
  while ($null -ne $node) {
    if (-not $node.Exists -or
        ($node.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
      throw 'C_OPERATOR_TEST_DIRECTORY_REDIRECT_OR_ABSENT'
    }
    $node = $node.Parent
  }
}
function Assert-DestinationAbsent([string]$destination) {
  if ([IO.Directory]::Exists($destination) -or [IO.File]::Exists($destination)) {
    throw 'C_OPERATOR_TEST_ARCHIVE_COLLISION'
  }
  try { $null = [IO.File]::GetAttributes($destination) }
  catch [IO.FileNotFoundException] { return }
  catch [IO.DirectoryNotFoundException] { return }
  throw 'C_OPERATOR_TEST_ARCHIVE_EXISTENCE_UNKNOWN'
}
function Read-Inventory([string]$directory) {
  Assert-SafeDirectory $directory
  $observed = [ordered]@{}
  foreach ($entry in ([IO.DirectoryInfo]::new($directory).GetFileSystemInfos() |
      Sort-Object Name)) {
    if (($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or
        ($entry.Attributes -band [IO.FileAttributes]::Directory) -ne 0 -or
        $entry.Name -cnotmatch '^owner\.json$|^[A-Z0-9_]+\.json$') {
      throw 'C_OPERATOR_TEST_UNEXPECTED_SOURCE_ENTRY'
    }
    $f = [IO.FileInfo]::new($entry.FullName)
    if (-not $f.Exists -or $f.Length -lt 1 -or $f.Length -gt 2000000) {
      throw 'C_OPERATOR_TEST_SOURCE_UNSAFE'
    }
    $observed[$entry.Name] = (Get-FileHash -LiteralPath $f.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
  }
  return $observed
}
function Assert-Inventory([string]$directory,[object]$pins) {
  $got = Read-Inventory $directory
  $wantKeys = @($pins.PSObject.Properties.Name | Sort-Object)
  $gotKeys = @($got.Keys | Sort-Object)
  if (($wantKeys -join '|') -cne ($gotKeys -join '|')) {
    throw 'C_OPERATOR_TEST_INVENTORY_NAMES_DRIFT'
  }
  foreach ($key in $wantKeys) {
    if ($pins.$key -cnotmatch '^[0-9a-f]{64}$' -or $pins.$key -cne $got[$key]) {
      throw 'C_OPERATOR_TEST_INVENTORY_SHA_DRIFT'
    }
  }
}
function Assert-NoConflict([string]$step) {
  # SYNTHETIC fixture only. Real Writer/Controller lease state requires
  # independent, authenticated live reads immediately before each move.
  $state = [IO.File]::ReadAllText((Join-Path $root 'live.json')) | ConvertFrom-Json
  if ($state.workflowState -cne 'active' -or
      $state.protectionVerified -cne $true -or
      $state.writerActiveCount -cne 0 -or
      $state.controllerActiveCount -cne 0 -or
      $state.otherContinuationCount -cne 0) {
    throw ('C_OPERATOR_TEST_LATE_CONFLICT_' + $step)
  }
}
function Native-MovePinned([string]$source,[string]$destination,[object]$pins,
    [string]$step) {
  Assert-SafeDirectory ([IO.Path]::GetDirectoryName($source))
  Assert-SafeDirectory ([IO.Path]::GetDirectoryName($destination))
  Assert-Inventory $source $pins
  Assert-DestinationAbsent $destination
  Assert-NoConflict $step
  Assert-Inventory $source $pins
  Assert-DestinationAbsent $destination
  [IO.Directory]::Move($source,$destination)
  Assert-Inventory $destination $pins
}
function Check-Fault([string]$step) {
  if ($FailAfter -ceq $step) { throw ('C_OPERATOR_TEST_INTERRUPTED_' + $step) }
}
function Write-ReadyOnce([string]$directory,[object]$oldPins,[object]$installPins,
    [object]$allContPins,[string]$newId) {
  $owner = [IO.File]::ReadAllText((Join-Path $directory 'owner.json')) | ConvertFrom-Json
  if ($owner.requestId -cne $newId -or
      [string]::IsNullOrWhiteSpace($owner.nonce) -or
      $allContPins.sourceLockSha256 -cnotmatch '^[a-f0-9]{64}$') {
    throw 'C_OPERATOR_TEST_NEW_OWNER_INVALID'
  }
  $ready = [ordered]@{
    schema='ZGMINI_996_CONTINUATION_READY_V1'
    name='READY_TO_RELEASE_INSTALL'
    requestId=$newId
    originalRequestId='pc-update-0010b2cf-9bca-40cf-89c5-b750fa42b404'
    ownerNonce=$owner.nonce
    sourceLockSha256=$allContPins.sourceLockSha256
    oldCArchiveOwnerSha256=$oldPins.'owner.json'
    installOwnerSha256=$installPins.'owner.json'
    installRecoverySha256=$installPins.'RECOVERY_REQUIRED.json'
    finalReleasePending=$true
  }
  $bytes = [Text.UTF8Encoding]::new($false).GetBytes(
    ($ready | ConvertTo-Json -Compress) + [Environment]::NewLine)
  $destination = Join-Path $directory 'READY_TO_RELEASE_INSTALL.json'
  $fd = [IO.FileStream]::new($destination,[IO.FileMode]::CreateNew,
    [IO.FileAccess]::Write,[IO.FileShare]::None)
  try { $fd.Write($bytes,0,$bytes.Length); $fd.Flush($true) }
  finally { $fd.Dispose() }
  return (Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash.ToLowerInvariant()
}

# The harness must pre-create a pinned fixture and synthetic current state.
# No original claim is adopted or archive restored; no automatic cleanup.
$leases = Join-Path $root 'leases'
$archives = Join-Path $root 'archives'
$old = Join-Path $leases 'oldC'
$cont = Join-Path $leases 'continuation'
$install = Join-Path $leases 'install'
$oldArchive = Join-Path $archives 'oldC'
$contArchive = Join-Path $archives 'continuation'
$installArchive = Join-Path $archives 'install'
$pinsFile = Join-Path $root 'expected.json'

$result = $null
try {
  foreach ($directory in @($temp,$root,$leases,$archives)) {
    Assert-SafeDirectory $directory
  }
  $expectedBytes = [IO.File]::ReadAllText($pinsFile)
  if ($expectedBytes.Length -lt 5 -or $expectedBytes.Length -gt 30000) {
    throw 'C_OPERATOR_TEST_EXPECTED_BOUNDS_INVALID'
  }
  $expected = $expectedBytes | ConvertFrom-Json
  foreach ($key in @('oldC','install','continuation')) {
    if ($null -eq $expected.$key) { throw 'C_OPERATOR_TEST_EXPECTED_PINS_MISSING' }
  }
  $contPins = [pscustomobject]([ordered]@{})
  foreach ($p in $expected.continuation.PSObject.Properties) {
    if ($p.Name -cne 'sourceLockSha256') {
      $contPins | Add-Member -NotePropertyName $p.Name -NotePropertyValue $p.Value
    }
  }
  Assert-Inventory $old $expected.oldC
  Assert-Inventory $cont $contPins
  Assert-Inventory $install $expected.install
  foreach ($destination in @($oldArchive,$contArchive,$installArchive)) {
    Assert-DestinationAbsent $destination
  }
  Assert-NoConflict 'PREFLIGHT'

  # Canonical install lease blocks all normal installers until LAST move.
  Native-MovePinned $old $oldArchive $expected.oldC 'OLD_C'
  Assert-Inventory $install $expected.install
  Check-Fault 'AFTER_OLD_C'
  $readySha = Write-ReadyOnce $cont $expected.oldC $expected.install $expected.continuation $ContinuationId
  $contPins | Add-Member -NotePropertyName 'READY_TO_RELEASE_INSTALL.json' -NotePropertyValue $readySha
  Assert-Inventory $install $expected.install
  Check-Fault 'AFTER_READY'
  Native-MovePinned $cont $contArchive $contPins 'CONTINUATION'
  Assert-Inventory $install $expected.install
  Check-Fault 'AFTER_CONTINUATION'
  Assert-Inventory $oldArchive $expected.oldC
  Assert-Inventory $contArchive $contPins
  Assert-NoConflict 'BEFORE_INSTALL'
  Check-Fault 'BEFORE_INSTALL'
  Native-MovePinned $install $installArchive $expected.install 'INSTALL'
  # No file writes or retries may follow this boundary.
  Check-Fault 'AFTER_INSTALL'
  Assert-Inventory $oldArchive $expected.oldC
  Assert-Inventory $contArchive $contPins
  Assert-Inventory $installArchive $expected.install
  $result = [ordered]@{
    schema='ZGMINI_996_WINDOWS_C_STAGE_CANDIDATE_V1'
    status='ISOLATED_NATIVE_STAGE_TEST_ONLY'
    archiveOrder=@('oldC','continuation','install')
    installLeaseLast=$true
    executionAuthorized=$false
    productionExecutable=$false
    operationalWrites=0
    workflowPuts=0
    backlogWrites=0
    issuePosts=0
    pcRetries=0
    testRoot=$root
  }
} catch {
  $result = [ordered]@{
    schema='ZGMINI_996_WINDOWS_C_STAGE_CANDIDATE_V1'
    status='ISOLATED_STAGE_STOP_PRESERVE_FILES'
    code=[string]$_.Exception.Message
    executionAuthorized=$false
    productionExecutable=$false
    operationalWrites=0
    workflowPuts=0
    backlogWrites=0
    issuePosts=0
    pcRetries=0
    testRoot=$root
  }
}
# No recursive cleanup, no rollback and NO AUTOMATIC RETRY.
$result | ConvertTo-Json -Compress -Depth 5

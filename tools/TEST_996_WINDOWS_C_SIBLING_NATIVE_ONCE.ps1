#Requires -Version 5.1
# #996 actual sibling lease-layout NATIVE fixture: disposable Windows TEMP ONLY.
# This is not an operator. It never reads/writes original operational PC state.
# Each fixture is uniquely named and is deliberately NOT auto-cleaned.
[CmdletBinding()]
param([switch]$TestOnly)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$original='pc-update-0010b2cf-9bca-40cf-89c5-b750fa42b404'

# Reject production before creating even a synthetic fixture.
if (-not $TestOnly) { throw 'C_SIBLING_FIXTURE_PRODUCTION_DISABLED' }
if ([IO.Directory]::Exists('E:\ZGmini') -or [IO.File]::Exists('E:\ZGmini')) {
  throw 'C_SIBLING_FIXTURE_ORIGINAL_PC_PRESENT'
}
$temp=[IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$drivePath=[IO.Path]::GetPathRoot($temp)
if ($drivePath -ieq 'E:\' -or $drivePath -notmatch '^[A-Za-z]:\\$' -or
    $temp -match '(^|[\\/])ZGmini([\\/]|$)') {
  throw 'C_SIBLING_FIXTURE_UNSAFE_TEMP'
}
$drive=[IO.DriveInfo]::new($drivePath)
if (-not $drive.IsReady -or $drive.DriveType -ne [IO.DriveType]::Fixed -or
    $drive.DriveFormat -notin @('NTFS','ReFS')) {
  throw 'C_SIBLING_FIXTURE_UNSAFE_VOLUME'
}
function Check-Directory([string]$dir) {
  $node=[IO.DirectoryInfo]::new($dir)
  while ($null -ne $node) {
    if (-not $node.Exists -or
        ($node.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
      throw 'C_SIBLING_FIXTURE_REPARSE_OR_MISSING_DIRECTORY'
    }
    $node=$node.Parent
  }
}
Check-Directory $temp
$script:checks=0
$script:cases=0
$script:roots=@()
function Must([bool]$ok,[string]$code) {
  if (-not $ok) { throw $code }
  $script:checks++
}
function Sha([string]$file) {
  return (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant()
}
function Write-Once([string]$file,[string]$value) {
  $bytes=[Text.UTF8Encoding]::new($false).GetBytes($value)
  $fd=[IO.FileStream]::new($file,[IO.FileMode]::CreateNew,
    [IO.FileAccess]::Write,[IO.FileShare]::None)
  try { $fd.Write($bytes,0,$bytes.Length);$fd.Flush($true) }
  finally { $fd.Dispose() }
  return (Sha $file)
}
function Inventory([string]$directory,[object]$expected) {
  Check-Directory $directory
  $entries=@([IO.DirectoryInfo]::new($directory).GetFileSystemInfos())
  $found=@($entries | ForEach-Object { $_.Name } | Sort-Object)
  $wanted=@($expected.Keys | Sort-Object)
  Must (($found -join '|') -ceq ($wanted -join '|')) 'C_SIBLING_INVENTORY_NAMES'
  foreach($entry in $entries) {
    Must ((($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -eq 0) -and
      (($entry.Attributes -band [IO.FileAttributes]::Directory) -eq 0) -and
      $entry.Length -gt 0 -and $entry.Length -le 16384) 'C_SIBLING_FILE_UNSAFE'
    Must ((Sha $entry.FullName) -ceq $expected[$entry.Name]) 'C_SIBLING_SHA_DRIFT'
  }
}
function Exists([string]$dir) { return [IO.Directory]::Exists($dir) }
function New-Case([string]$name) {
  $id=[guid]::NewGuid().ToString()
  $root=Join-Path $temp ('zgmini-996-test-c-sibling-'+[guid]::NewGuid().ToString('N'))
  $leases=Join-Path $root 'automation\pc-maintenance\leases'
  [IO.Directory]::CreateDirectory($leases)|Out-Null
  Check-Directory $leases
  $script:roots+= $root
  $names=[ordered]@{
    old='controller-recovery'
    oldArchive=('controller-recovery-archived-'+$original)
    continuation=('controller-recovery-continuation-'+$id)
    continuationArchive=('controller-recovery-continuation-archived-'+$id)
    install='controller-install'
    installArchive=('controller-install-recovered-'+$original)
  }
  $dirs=[ordered]@{}
  foreach($key in $names.Keys){$dirs[$key]=Join-Path $leases $names[$key]}
  $pins=[ordered]@{old=[ordered]@{};continuation=[ordered]@{};
    install=[ordered]@{}}
  foreach($key in @('old','continuation','install')){
    [IO.Directory]::CreateDirectory($dirs[$key])|Out-Null
    $pins[$key]['owner.json']=Write-Once (Join-Path $dirs[$key] 'owner.json') (
      '{"case":"'+$name+'","source":"'+$key+'","id":"'+$id+'"}')
    $marker=$(if($key -eq 'install'){'RECOVERY_REQUIRED.json'}else{'PREPARED.json'})
    $pins[$key][$marker]=Write-Once (Join-Path $dirs[$key] $marker) (
      '{"marker":"'+$marker+'"}')
  }
  if($name -eq 'collision'){
    [IO.Directory]::CreateDirectory($dirs.oldArchive)|Out-Null
    $null=Write-Once (Join-Path $dirs.oldArchive 'sentinel.txt') 'preserve'
  }
  if($name -eq 'marker'){
    [IO.File]::Move((Join-Path $dirs.old 'PREPARED.json'),
      (Join-Path $dirs.old 'CHANGED.json'))
  }
  return [pscustomobject]@{
    id=$id;root=$root;leases=$leases;dirs=$dirs;pins=$pins
    writerActive=($name -eq 'writer')
  }
}
function Move-Sibling([object]$f,[string]$from,[string]$to,[object]$pins) {
  $source=$f.dirs[$from]
  $destination=$f.dirs[$to]
  Must (([IO.Path]::GetDirectoryName($source) -ieq
      [IO.Path]::GetDirectoryName($destination)) -and
      ([IO.Path]::GetDirectoryName($source) -ieq $f.leases)) 'C_SIBLING_PARENT_DIFFERENT'
  Check-Directory $f.leases
  Inventory $source $pins
  Must (-not (Exists $destination) -and -not [IO.File]::Exists($destination)) 'C_SIBLING_COLLISION'
  Must (-not $f.writerActive) 'C_SIBLING_WRITER_CONFLICT'
  Inventory $source $pins
  Must (-not (Exists $destination) -and -not [IO.File]::Exists($destination)) 'C_SIBLING_LATE_COLLISION'
  [IO.Directory]::Move($source,$destination)
  Inventory $destination $pins
}
function Run-Case([string]$name,[string]$stopAfter) {
  $f=New-Case $name
  if ($name -eq 'reservation') {
    $fixed=Join-Path $f.leases 'controller-recovery-continuation-reservation.fixture'
    $first=Write-Once $fixed '{"testOnly":true}'
    $blocked=$false
    try { $null=Write-Once $fixed '{"second":true}' }
    catch [IO.IOException] { $blocked=$true }
    Must $blocked 'C_SIBLING_RESERVATION_DUPLICATE_WON'
    Must ((Sha $fixed) -ceq $first) 'C_SIBLING_RESERVATION_CHANGED'
    # The proposed real fixed reservation is a DIRECTORY, so also test
    # one unique-directory -> fixed-directory rename, then second collision.
    # This is sequential; it is NOT a multiprocess Windows race proof.
    $fixedDir=Join-Path $f.leases 'controller-recovery-continuation-reservation'
    $proposal1=Join-Path $f.leases ('fixture-proposal-'+[guid]::NewGuid().ToString('N'))
    $proposal2=Join-Path $f.leases ('fixture-proposal-'+[guid]::NewGuid().ToString('N'))
    [IO.Directory]::CreateDirectory($proposal1)|Out-Null
    [IO.Directory]::CreateDirectory($proposal2)|Out-Null
    $null=Write-Once (Join-Path $proposal1 'owner.json') '{"contestant":1}'
    $null=Write-Once (Join-Path $proposal2 'owner.json') '{"contestant":2}'
    [IO.Directory]::Move($proposal1,$fixedDir)
    $secondRejected=$false
    try { [IO.Directory]::Move($proposal2,$fixedDir) }
    catch [IO.IOException] { $secondRejected=$true }
    Must $secondRejected 'C_SIBLING_FIXED_DIRECTORY_DUPLICATE_WON'
    Must ((Exists $fixedDir) -and (Exists $proposal2) -and
      -not (Exists $proposal1)) 'C_SIBLING_FIXED_DIRECTORY_PRESERVE'
    Must ([IO.File]::ReadAllText((Join-Path $fixedDir 'owner.json')) -ceq
      '{"contestant":1}') 'C_SIBLING_FIXED_DIRECTORY_OWNER_CHANGED'
    Must ((Exists $f.dirs.old) -and (Exists $f.dirs.install) -and
      (Exists $f.dirs.continuation)) 'C_SIBLING_RESERVATION_CHANGED_SOURCES'
    $script:cases++;return
  }
  if ($name -eq 'marker') {
    $got=$false
    try { Inventory $f.dirs.old $f.pins.old }
    catch { if($_.Exception.Message -ceq 'C_SIBLING_INVENTORY_NAMES'){$got=$true}else{throw} }
    Must $got 'C_SIBLING_MARKER_DRIFT_MISSED'
    Must ((Exists $f.dirs.install) -and -not (Exists $f.dirs.oldArchive)) 'C_SIBLING_MARKER_PRESERVE'
    $script:cases++;return
  }
  if ($name -eq 'writer' -or $name -eq 'collision') {
    $want=$(if($name -eq 'writer'){'C_SIBLING_WRITER_CONFLICT'}else{'C_SIBLING_COLLISION'})
    $got=$false
    try { Move-Sibling $f 'old' 'oldArchive' $f.pins.old }
    catch { if($_.Exception.Message -ceq $want){$got=$true}else{throw} }
    Must $got ('C_SIBLING_EXPECTED_'+$name)
    Must ((Exists $f.dirs.old) -and (Exists $f.dirs.install)) ('C_SIBLING_PRESERVED_'+$name)
    if($name -eq 'collision'){
      Must ([IO.File]::ReadAllText((Join-Path $f.dirs.oldArchive 'sentinel.txt')) -ceq 'preserve') 'C_SIBLING_SENTINEL_LOST'
    }
    $script:cases++;return
  }
  Move-Sibling $f 'old' 'oldArchive' $f.pins.old
  Must (Exists $f.dirs.install) 'C_SIBLING_INSTALL_EARLY_OLD'
  if($stopAfter -eq 'AFTER_OLD') {
    Must ((Exists $f.dirs.continuation) -and -not (Exists $f.dirs.installArchive)) 'C_SIBLING_AFTER_OLD_STATE'
    $script:cases++;return
  }
  $ready=Join-Path $f.dirs.continuation 'READY_TO_RELEASE_INSTALL.json'
  $f.pins.continuation['READY_TO_RELEASE_INSTALL.json']=Write-Once $ready (
    '{"schema":"ZGMINI_996_CONTINUATION_READY_TEST_ONLY","id":"'+$f.id+'"}')
  Must (Exists $f.dirs.install) 'C_SIBLING_INSTALL_EARLY_READY'
  if($stopAfter -eq 'AFTER_READY') {
    Inventory $f.dirs.continuation $f.pins.continuation
    $script:cases++;return
  }
  Move-Sibling $f 'continuation' 'continuationArchive' $f.pins.continuation
  Must (Exists $f.dirs.install) 'C_SIBLING_INSTALL_EARLY_CONT'
  if($stopAfter -eq 'AFTER_CONTINUATION') {
    Must (-not (Exists $f.dirs.installArchive)) 'C_SIBLING_AFTER_CONT_STATE'
    $script:cases++;return
  }
  if($stopAfter -eq 'BEFORE_INSTALL'){
    Inventory $f.dirs.install $f.pins.install
    $script:cases++;return
  }
  Move-Sibling $f 'install' 'installArchive' $f.pins.install
  Must (-not (Exists $f.dirs.install)) 'C_SIBLING_FINAL_INSTALL_STILL_ACTIVE'
  if($stopAfter -eq 'AFTER_INSTALL') {
    Must ((Exists $f.dirs.oldArchive) -and
      (Exists $f.dirs.continuationArchive) -and
      (Exists $f.dirs.installArchive)) 'C_SIBLING_AFTER_INSTALL_STATE'
    $script:cases++;return
  }
  Inventory $f.dirs.oldArchive $f.pins.old
  Inventory $f.dirs.continuationArchive $f.pins.continuation
  Inventory $f.dirs.installArchive $f.pins.install
  $script:cases++
}
try {
  Run-Case 'success' 'NONE'
  Run-Case 'after-old' 'AFTER_OLD'
  Run-Case 'after-ready' 'AFTER_READY'
  Run-Case 'after-cont' 'AFTER_CONTINUATION'
  Run-Case 'before-install' 'BEFORE_INSTALL'
  Run-Case 'after-install' 'AFTER_INSTALL'
  Run-Case 'collision' 'NONE'
  Run-Case 'writer' 'NONE'
  Run-Case 'marker' 'NONE'
  Run-Case 'reservation' 'NONE'
  Must ($script:cases -eq 10 -and $script:roots.Count -eq 10) 'C_SIBLING_INCOMPLETE_CASES'
  [ordered]@{
    schema='ZGMINI_996_WINDOWS_C_SIBLING_NATIVE_FIXTURE_V1'
    status='ISOLATED_WINDOWS_C_SIBLING_TEST_ONLY'
    casesPassed=$script:cases;checksPassed=$script:checks
    createdFixtures=$script:roots.Count
    sameParentLeaseMove=$true
    reservationFileCreateNewSequentialTested=$true
    reservationDirectoryMoveSequentialTested=$true
    executionAuthorized=$false;operatorReady=$false;originalPcWrites=0
    workflowPuts=0;backlogWrites=0;issuePosts=0;pcRetries=0
    cleanupPerformed=$false
  }|ConvertTo-Json -Compress -Depth 5
} catch {
  [ordered]@{
    schema='ZGMINI_996_WINDOWS_C_SIBLING_NATIVE_FIXTURE_V1'
    status='ISOLATED_WINDOWS_C_SIBLING_TEST_STOP'
    code=[string]$_.Exception.Message
    casesPassed=$script:cases;checksPassed=$script:checks
    createdFixtures=$script:roots.Count
    executionAuthorized=$false;operatorReady=$false;originalPcWrites=0
    workflowPuts=0;backlogWrites=0;issuePosts=0;pcRetries=0
    cleanupPerformed=$false
  }|ConvertTo-Json -Compress -Depth 5
  exit 2
}

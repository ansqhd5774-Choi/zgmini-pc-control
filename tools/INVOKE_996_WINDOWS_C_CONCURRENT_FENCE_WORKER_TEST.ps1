#Requires -Version 5.1
# Isolated Windows TEMP-only worker for #996 shared C fencing race.
# This is NEVER an operational repair process. No cleanup/retry/rollback.
[CmdletBinding()]
param(
  [switch]$TestOnly,
  [string]$FixtureRoot,
  [string]$ContinuationId,
  [string]$BarrierNonce
)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
if (-not $TestOnly) { throw 'C_FENCE_WORKER_PRODUCTION_DISABLED' }
if ([IO.Directory]::Exists('E:\ZGmini') -or [IO.File]::Exists('E:\ZGmini')) {
  throw 'C_FENCE_WORKER_ORIGINAL_PC_PRESENT'
}
if ($ContinuationId -cnotmatch '^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$' -or
    $BarrierNonce -cnotmatch '^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$') {
  throw 'C_FENCE_WORKER_INPUT_UUID_INVALID'
}
$temp=[IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$drivePath=[IO.Path]::GetPathRoot($temp)
if ($drivePath -ieq 'E:\' -or $drivePath -notmatch '^[A-Za-z]:\\$' -or
    $temp -match '(^|[\\/])ZGmini([\\/]|$)') {
  throw 'C_FENCE_WORKER_TEMP_UNSAFE'
}
$drive=[IO.DriveInfo]::new($drivePath)
if (-not $drive.IsReady -or $drive.DriveType -ne [IO.DriveType]::Fixed -or
    $drive.DriveFormat -notin @('NTFS','ReFS')) {
  throw 'C_FENCE_WORKER_VOLUME_UNSAFE'
}
if ([string]::IsNullOrWhiteSpace($FixtureRoot)) {
  throw 'C_FENCE_WORKER_ROOT_MISSING'
}
$root=[IO.Path]::GetFullPath($FixtureRoot)
if (-not $root.StartsWith($temp.TrimEnd('\')+'\',
      [StringComparison]::OrdinalIgnoreCase) -or
    [IO.Path]::GetFileName($root) -cnotmatch '^zgmini-996-test-c-fence-[a-f0-9]{32}$') {
  throw 'C_FENCE_WORKER_ROOT_OUTSIDE_TEMP'
}
function Must([bool]$ok,[string]$code) { if(-not $ok){throw $code} }
function Safe-Directory([string]$dir) {
  $item=[IO.DirectoryInfo]::new($dir)
  while($null -ne $item) {
    if (-not $item.Exists -or
        ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
      throw 'C_FENCE_WORKER_REPARSE_OR_MISSING_PARENT'
    }
    $item=$item.Parent
  }
}
function Hash([string]$file) {
  $info=[IO.FileInfo]::new($file)
  Must ($info.Exists -and $info.Length -gt 0 -and $info.Length -le 16384 -and
    ($info.Attributes -band [IO.FileAttributes]::ReparsePoint) -eq 0) 'C_FENCE_WORKER_PIN_FILE_UNSAFE'
  return (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant()
}
function Read-Json([string]$file) {
  $null=Hash $file
  return [IO.File]::ReadAllText($file) | ConvertFrom-Json
}
function Write-Once([string]$file,[object]$value) {
  $bytes=[Text.UTF8Encoding]::new($false).GetBytes(
    ($value|ConvertTo-Json -Depth 5 -Compress)+[Environment]::NewLine)
  $fd=[IO.FileStream]::new($file,[IO.FileMode]::CreateNew,
    [IO.FileAccess]::Write,[IO.FileShare]::None)
  try{$fd.Write($bytes,0,$bytes.Length);$fd.Flush($true)}
  finally{$fd.Dispose()}
}
Safe-Directory $temp
Safe-Directory $root
$leases=Join-Path $root 'automation\pc-maintenance\leases'
Safe-Directory $leases
$fixture=Read-Json (Join-Path $root 'fixture.json')
Must ($fixture.schema -ceq 'ZGMINI_996_C_CONCURRENT_FENCE_FIXTURE_V1' -and
  $fixture.nonce -ceq $BarrierNonce -and
  @($fixture.ids).Count -eq 2 -and
  @($fixture.ids | Select-Object -Unique).Count -eq 2 -and
  @($fixture.ids | Where-Object { $_ -ceq $ContinuationId }).Count -eq 1) 'C_FENCE_WORKER_FIXTURE_PROVENANCE_INVALID'
$old=Join-Path $leases 'controller-recovery'
$install=Join-Path $leases 'controller-install'
$proposal=Join-Path $leases ('controller-recovery-continuation-proposal-'+$ContinuationId)
$fixed=Join-Path $leases 'controller-recovery-continuation-reservation'
Safe-Directory $old
Safe-Directory $install
Safe-Directory $proposal
$owner=Read-Json (Join-Path $proposal 'owner.json')
Must ($owner.schema -ceq 'ZGMINI_996_C_CONCURRENT_FENCE_OWNER_TEST_V1' -and
  $owner.continuationRequestId -ceq $ContinuationId -and
  $owner.nonce -ceq $BarrierNonce -and
  $owner.originalRequestId -ceq 'pc-update-0010b2cf-9bca-40cf-89c5-b750fa42b404') 'C_FENCE_WORKER_PROPOSAL_OWNER_INVALID'
$proposalOwnerPin=Hash (Join-Path $proposal 'owner.json')
Must (@($fixture.proposalOwnerSha256).Count -eq 2 -and
  @($fixture.proposalOwnerSha256 | Where-Object { $_ -cmatch '^[a-f0-9]{64}$' }).Count -eq 2) 'C_FENCE_WORKER_PROPOSAL_SHA_PIN_MISSING'
$myIndex=if($fixture.ids[0] -ceq $ContinuationId){0}else{1}
Must ($proposalOwnerPin -ceq $fixture.proposalOwnerSha256[$myIndex]) 'C_FENCE_WORKER_PROPOSAL_SHA_PIN_DRIFT'
Must ((Hash (Join-Path $old 'owner.json')) -ceq $fixture.oldOwnerSha256 -and
  (Hash (Join-Path $install 'owner.json')) -ceq $fixture.installOwnerSha256) 'C_FENCE_WORKER_ORIGINAL_PIN_DRIFT'
Write-Once (Join-Path $root ('ready-'+$ContinuationId+'.json')) ([ordered]@{
  schema='ZGMINI_996_C_FENCE_WORKER_READY_V1'
  continuationRequestId=$ContinuationId;nonce=$BarrierNonce;processId=$PID
})
$deadline=[DateTime]::UtcNow.AddSeconds(45)
$go=Join-Path $root 'go.json'
while(-not [IO.File]::Exists($go) -and [DateTime]::UtcNow -lt $deadline) {
  [Threading.Thread]::Sleep(20)
}
Must ([IO.File]::Exists($go)) 'C_FENCE_WORKER_BARRIER_TIMEOUT'
$goState=Read-Json $go
Must ($goState.schema -ceq 'ZGMINI_996_C_FENCE_BARRIER_V1' -and
  $goState.nonce -ceq $BarrierNonce) 'C_FENCE_WORKER_BARRIER_INVALID'
Must ((Hash (Join-Path $old 'owner.json')) -ceq $fixture.oldOwnerSha256 -and
  (Hash (Join-Path $install 'owner.json')) -ceq $fixture.installOwnerSha256) 'C_FENCE_WORKER_LATE_PIN_DRIFT'
$outcome=$null
try {
  [IO.Directory]::Move($proposal,$fixed)
  $winner=Read-Json (Join-Path $fixed 'owner.json')
  Must ($winner.continuationRequestId -ceq $ContinuationId -and
    $winner.nonce -ceq $BarrierNonce -and
    -not [IO.Directory]::Exists($proposal)) 'C_FENCE_WORKER_WIN_OWNER_MISMATCH'
  $outcome='WIN'
} catch [IO.IOException] {
  # Only a verified fixed-name collision may be called BUSY. Other
  # IOException cases remain UNKNOWN and the worker fails closed.
  $win32Error=([int]$_.Exception.HResult -band 0xffff)
  Must ($win32Error -in @(80,183)) 'C_FENCE_WORKER_MOVE_IO_UNEXPECTED_HRESULT'
  Must ([IO.Directory]::Exists($fixed) -and
    [IO.Directory]::Exists($proposal)) 'C_FENCE_WORKER_MOVE_IO_UNKNOWN'
  Must ((Hash (Join-Path $proposal 'owner.json')) -ceq $proposalOwnerPin) 'C_FENCE_WORKER_BUSY_PROPOSAL_DRIFT'
  Safe-Directory $fixed
  $winner=Read-Json (Join-Path $fixed 'owner.json')
  Must ($winner.schema -ceq 'ZGMINI_996_C_CONCURRENT_FENCE_OWNER_TEST_V1' -and
    $winner.nonce -ceq $BarrierNonce -and
    $winner.continuationRequestId -cne $ContinuationId -and
    @($fixture.ids | Where-Object { $_ -ceq $winner.continuationRequestId }).Count -eq 1) 'C_FENCE_WORKER_BUSY_OWNER_UNKNOWN'
  $outcome='BUSY'
}
Must ((Hash (Join-Path $old 'owner.json')) -ceq $fixture.oldOwnerSha256 -and
  (Hash (Join-Path $install 'owner.json')) -ceq $fixture.installOwnerSha256) 'C_FENCE_WORKER_POSTMOVE_PIN_DRIFT'
Write-Once (Join-Path $root ('result-'+$ContinuationId+'.json')) ([ordered]@{
  schema='ZGMINI_996_C_FENCE_WORKER_RESULT_V1'
  continuationRequestId=$ContinuationId;nonce=$BarrierNonce
  processId=$PID;outcome=$outcome
  executionAuthorized=$false;originalPcWrites=0
})

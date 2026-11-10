#Requires -Version 5.1
# #996: two genuine PowerShell processes racing for one fixed directory.
# Only synthetic, isolated TEMP state on a separate non-operational Windows PC.
# Deliberately preserves every fixture and never repairs the operational C lane.
[CmdletBinding()]
param([switch]$TestOnly)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$fixtureRoot=$null
$processes=@()
function Must([bool]$ok,[string]$code) { if(-not $ok){throw $code} }
function Safe-Directory([string]$dir) {
  $item=[IO.DirectoryInfo]::new($dir)
  while($null -ne $item) {
    if(-not $item.Exists -or
      ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
      throw 'C_FENCE_REPARSE_OR_MISSING_PARENT'
    }
    $item=$item.Parent
  }
}
function Hash([string]$file) {
  $info=[IO.FileInfo]::new($file)
  Must ($info.Exists -and $info.Length -gt 0 -and $info.Length -le 16384 -and
    ($info.Attributes -band [IO.FileAttributes]::ReparsePoint) -eq 0) 'C_FENCE_PIN_FILE_UNSAFE'
  return (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant()
}
function Read-Json([string]$file) {
  $null=Hash $file
  return [IO.File]::ReadAllText($file) | ConvertFrom-Json
}
function Write-Once([string]$file,[object]$value) {
  $bytes=[Text.UTF8Encoding]::new($false).GetBytes(
    ($value|ConvertTo-Json -Depth 6 -Compress)+[Environment]::NewLine)
  $fd=[IO.FileStream]::new($file,[IO.FileMode]::CreateNew,
    [IO.FileAccess]::Write,[IO.FileShare]::None)
  try{$fd.Write($bytes,0,$bytes.Length);$fd.Flush($true)}
  finally{$fd.Dispose()}
}
try {
  # The two guards precede EVERY effect, including TEMP fixture creation.
  Must ([bool]$TestOnly) 'C_FENCE_PRODUCTION_DISABLED'
  Must (-not [IO.Directory]::Exists('E:\ZGmini') -and
    -not [IO.File]::Exists('E:\ZGmini')) 'C_FENCE_ORIGINAL_PC_PRESENT'
  $temp=[IO.Path]::GetFullPath([IO.Path]::GetTempPath())
  $drivePath=[IO.Path]::GetPathRoot($temp)
  Must ($drivePath -ine 'E:\' -and $drivePath -match '^[A-Za-z]:\\$' -and
    $temp -notmatch '(^|[\\/])ZGmini([\\/]|$)') 'C_FENCE_TEMP_UNSAFE'
  $drive=[IO.DriveInfo]::new($drivePath)
  Must ($drive.IsReady -and $drive.DriveType -eq [IO.DriveType]::Fixed -and
    $drive.DriveFormat -in @('NTFS','ReFS')) 'C_FENCE_VOLUME_UNSAFE'
  Safe-Directory $temp
  $worker=Join-Path $PSScriptRoot 'INVOKE_996_WINDOWS_C_CONCURRENT_FENCE_WORKER_TEST.ps1'
  Must ([IO.File]::Exists($worker)) 'C_FENCE_WORKER_NOT_FOUND'
  Must ((([IO.FileInfo]::new($worker)).Attributes -band
    [IO.FileAttributes]::ReparsePoint) -eq 0) 'C_FENCE_WORKER_REPARSE_POINT'
  Safe-Directory $PSScriptRoot
  $powershell='C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe'
  Must ([IO.File]::Exists($powershell)) 'C_FENCE_WINDOWS_POWERSHELL_MISSING'
  $nonce=[Guid]::NewGuid().ToString('D')
  $ids=@([Guid]::NewGuid().ToString('D'),[Guid]::NewGuid().ToString('D'))
  Must ($ids[0] -cne $ids[1]) 'C_FENCE_UUID_COLLISION'
  $fixtureRoot=Join-Path $temp ('zgmini-996-test-c-fence-'+[Guid]::NewGuid().ToString('N'))
  $leases=Join-Path $fixtureRoot 'automation\pc-maintenance\leases'
  $null=[IO.Directory]::CreateDirectory($leases)
  Safe-Directory $leases
  $old=Join-Path $leases 'controller-recovery'
  $install=Join-Path $leases 'controller-install'
  foreach($dir in @($old,$install)) { $null=[IO.Directory]::CreateDirectory($dir) }
  $originalRequest='pc-update-0010b2cf-9bca-40cf-89c5-b750fa42b404'
  Write-Once (Join-Path $old 'owner.json') ([ordered]@{
    schema='ZGMINI_996_C_CONCURRENT_FENCE_ORIGINAL_TEST_V1'
    originalRequestId=$originalRequest;lane='controller-recovery';synthetic=$true
  })
  Write-Once (Join-Path $install 'owner.json') ([ordered]@{
    schema='ZGMINI_996_C_CONCURRENT_FENCE_ORIGINAL_TEST_V1'
    originalRequestId=$originalRequest;lane='controller-install';synthetic=$true
  })
  $oldPin=Hash (Join-Path $old 'owner.json')
  $installPin=Hash (Join-Path $install 'owner.json')
  $proposalPins=@()
  foreach($id in $ids) {
    $proposal=Join-Path $leases ('controller-recovery-continuation-proposal-'+$id)
    $null=[IO.Directory]::CreateDirectory($proposal)
    Write-Once (Join-Path $proposal 'owner.json') ([ordered]@{
      schema='ZGMINI_996_C_CONCURRENT_FENCE_OWNER_TEST_V1'
      originalRequestId=$originalRequest
      continuationRequestId=$id;nonce=$nonce;synthetic=$true
    })
    $proposalPins+=@(Hash (Join-Path $proposal 'owner.json'))
  }
  $fixed=Join-Path $leases 'controller-recovery-continuation-reservation'
  Must (-not [IO.Directory]::Exists($fixed)) 'C_FENCE_FIXED_RESERVATION_PREEXISTS'
  Write-Once (Join-Path $fixtureRoot 'fixture.json') ([ordered]@{
    schema='ZGMINI_996_C_CONCURRENT_FENCE_FIXTURE_V1'
    nonce=$nonce;ids=$ids
    oldOwnerSha256=$oldPin;installOwnerSha256=$installPin
    proposalOwnerSha256=$proposalPins
    executionAuthorized=$false
  })
  # Separate OS processes, distinct PIDs and distinct request identifiers.
  # Windows PowerShell 5.1 uses ProcessStartInfo.Arguments, not ArgumentList.
  $processes=@()
  foreach($id in $ids) {
    $psi=[Diagnostics.ProcessStartInfo]::new()
    $psi.FileName=$powershell
    $psi.Arguments='-NoProfile -NonInteractive -File "'+$worker+'" -TestOnly -FixtureRoot "'+$fixtureRoot+'" -ContinuationId '+$id+' -BarrierNonce '+$nonce
    $psi.UseShellExecute=$false
    $psi.CreateNoWindow=$true
    $p=[Diagnostics.Process]::Start($psi)
    Must ($null -ne $p) 'C_FENCE_PROCESS_START_FAILED'
    $processes+=@($p)
  }
  Must ($processes.Count -eq 2 -and $processes[0].Id -ne $processes[1].Id) 'C_FENCE_DISTINCT_PROCESSES_REQUIRED'
  # Both children must have reached the barrier before the sole GO release.
  $readyDeadline=[DateTime]::UtcNow.AddSeconds(30)
  $ready=@()
  while([DateTime]::UtcNow -lt $readyDeadline) {
    if([IO.File]::Exists((Join-Path $fixtureRoot ('ready-'+$ids[0]+'.json'))) -and
       [IO.File]::Exists((Join-Path $fixtureRoot ('ready-'+$ids[1]+'.json')))) { break }
    if($processes[0].HasExited -or $processes[1].HasExited) { break }
    [Threading.Thread]::Sleep(20)
  }
  for($i=0;$i -lt 2;$i++) {
    $readyFile=Join-Path $fixtureRoot ('ready-'+$ids[$i]+'.json')
    Must ([IO.File]::Exists($readyFile)) 'C_FENCE_BARRIER_NOT_READY'
    $receipt=Read-Json $readyFile
    Must ($receipt.schema -ceq 'ZGMINI_996_C_FENCE_WORKER_READY_V1' -and
      $receipt.continuationRequestId -ceq $ids[$i] -and
      $receipt.nonce -ceq $nonce -and
      [int]$receipt.processId -eq $processes[$i].Id) 'C_FENCE_READY_PROVENANCE_INVALID'
    $ready+=@($receipt)
  }
  # Publish go.json atomically; the children see either absent or complete.
  $goPrepared=Join-Path $fixtureRoot 'go-prepared.json'
  Write-Once $goPrepared ([ordered]@{
    schema='ZGMINI_996_C_FENCE_BARRIER_V1';nonce=$nonce
  })
  [IO.File]::Move($goPrepared,(Join-Path $fixtureRoot 'go.json'))
  foreach($p in $processes) {
    Must ($p.WaitForExit(30000)) 'C_FENCE_WORKER_EXIT_TIMEOUT'
    Must ($p.ExitCode -eq 0) 'C_FENCE_WORKER_NONZERO_EXIT'
  }
  $results=@()
  for($i=0;$i -lt 2;$i++) {
    $receipt=Read-Json (Join-Path $fixtureRoot ('result-'+$ids[$i]+'.json'))
    Must ($receipt.schema -ceq 'ZGMINI_996_C_FENCE_WORKER_RESULT_V1' -and
      $receipt.continuationRequestId -ceq $ids[$i] -and
      $receipt.nonce -ceq $nonce -and
      [int]$receipt.processId -eq $processes[$i].Id -and
      $receipt.executionAuthorized -eq $false -and
      [int]$receipt.originalPcWrites -eq 0) 'C_FENCE_WORKER_RESULT_PROVENANCE_INVALID'
    $results+=@($receipt)
  }
  $winners=@($results|Where-Object {$_.outcome -ceq 'WIN'})
  $busy=@($results|Where-Object {$_.outcome -ceq 'BUSY'})
  Must ($winners.Count -eq 1 -and $busy.Count -eq 1) 'C_FENCE_RACE_CARDINALITY_INVALID'
  Safe-Directory $fixed
  $fixedOwner=Read-Json (Join-Path $fixed 'owner.json')
  Must ($fixedOwner.schema -ceq 'ZGMINI_996_C_CONCURRENT_FENCE_OWNER_TEST_V1' -and
    $fixedOwner.continuationRequestId -ceq $winners[0].continuationRequestId -and
    $fixedOwner.nonce -ceq $nonce) 'C_FENCE_FIXED_RESERVATION_OWNER_INVALID'
  $winnerPinIndex=if($winners[0].continuationRequestId -ceq $ids[0]){0}else{1}
  $busyPinIndex=if($busy[0].continuationRequestId -ceq $ids[0]){0}else{1}
  Must ((Hash (Join-Path $fixed 'owner.json')) -ceq $proposalPins[$winnerPinIndex]) 'C_FENCE_WINNER_OWNER_SHA_DRIFT'
  Must (-not [IO.Directory]::Exists((Join-Path $leases (
    'controller-recovery-continuation-proposal-'+$winners[0].continuationRequestId))) -and
    [IO.Directory]::Exists((Join-Path $leases (
    'controller-recovery-continuation-proposal-'+$busy[0].continuationRequestId)))) 'C_FENCE_PROPOSAL_MOVE_INVARIANT_INVALID'
  $busyOwner=Read-Json (Join-Path $leases (
    'controller-recovery-continuation-proposal-'+$busy[0].continuationRequestId+'\owner.json'))
  Must ($busyOwner.schema -ceq 'ZGMINI_996_C_CONCURRENT_FENCE_OWNER_TEST_V1' -and
    $busyOwner.continuationRequestId -ceq $busy[0].continuationRequestId -and
    $busyOwner.nonce -ceq $nonce -and
    $busyOwner.originalRequestId -ceq $originalRequest) 'C_FENCE_BUSY_PROPOSAL_OWNER_INVALID'
  Must ((Hash (Join-Path $leases (
    'controller-recovery-continuation-proposal-'+$busy[0].continuationRequestId+'\owner.json'))) -ceq
    $proposalPins[$busyPinIndex]) 'C_FENCE_BUSY_OWNER_SHA_DRIFT'
  Must ((Hash (Join-Path $old 'owner.json')) -ceq $oldPin -and
    (Hash (Join-Path $install 'owner.json')) -ceq $installPin) 'C_FENCE_ORIGINAL_OWNERS_CHANGED'
  [ordered]@{
    schema='ZGMINI_996_WINDOWS_C_CONCURRENT_FENCE_RESULT_V1'
    status='ISOLATED_WINDOWS_C_CONCURRENT_FENCE_TEST_ONLY'
    casesPassed=1
    processesStarted=2;distinctProcessIds=$true
    readyBeforeGo=$true;fixedReservationAtomicMove=$true
    winners=1;busy=1;createdFixtures=1
    fixturePath=$fixtureRoot
    executionAuthorized=$false;operatorReady=$false
    originalPcWrites=0;workflowPuts=0;backlogWrites=0;issuePosts=0
    pcRetries=0;cleanupPerformed=$false
  }|ConvertTo-Json -Depth 5 -Compress
} catch {
  $failureCode=$_.Exception.Message
  # If a child was launched, allow bounded natural exit (worker self-times out).
  # Never kill, terminate, retry, release a lease, or clean up a process/fixture.
  $settled=$true
  $observedChildPids=@()
  $waitLimit=[DateTime]::UtcNow.AddSeconds(50)
  foreach($p in $processes) {
    try {
      if($null -eq $p) {continue}
      $observedChildPids+=@($p.Id)
      if(-not $p.HasExited) {
        $remain=[int][Math]::Max(0,($waitLimit-[DateTime]::UtcNow).TotalMilliseconds)
        if($remain -gt 0) {$null=$p.WaitForExit($remain)}
      }
      if(-not $p.HasExited) {$settled=$false}
    } catch { $settled=$false }
  }
  [ordered]@{
    schema='ZGMINI_996_WINDOWS_C_CONCURRENT_FENCE_RESULT_V1'
    status='ISOLATED_WINDOWS_C_CONCURRENT_FENCE_STOP'
    errorCode=$failureCode;fixturePath=$fixtureRoot
    childPids=$observedChildPids;childProcessesSettled=$settled
    executionAuthorized=$false;operatorReady=$false
    originalPcWrites=0;workflowPuts=0;backlogWrites=0;issuePosts=0
    pcRetries=0;cleanupPerformed=$false
  }|ConvertTo-Json -Depth 5 -Compress
  exit 2
}

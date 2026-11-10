#Requires -Version 5.1
# #996 native C stage fixture: isolated Windows TEMP only, no operational C.
# Synthetic files are never deleted automatically.
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$stage=Join-Path $PSScriptRoot 'INVOKE_996_WINDOWS_C_ARCHIVE_CANDIDATE.ps1'
if ([IO.Directory]::Exists('E:\ZGmini') -or [IO.File]::Exists('E:\ZGmini')) {
  throw 'C_STAGE_FIXTURE_ORIGINAL_ZGMINI_PRESENT'
}
$temp=[IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$volume=[IO.Path]::GetPathRoot($temp)
if ($volume -ieq 'E:\' -or $volume -notmatch '^[A-Za-z]:\\$' -or
    $temp -match '(^|[\\/])ZGmini([\\/]|$)') {
  throw 'C_STAGE_FIXTURE_TEMP_UNSAFE'
}
$drive=[IO.DriveInfo]::new($volume)
if (-not $drive.IsReady -or $drive.DriveType -ne [IO.DriveType]::Fixed -or
    $drive.DriveFormat -notin @('NTFS','ReFS')) {
  throw 'C_STAGE_FIXTURE_VOLUME_UNSAFE'
}
$walk=[IO.DirectoryInfo]::new($temp)
while ($null -ne $walk) {
  if (-not $walk.Exists -or
      ($walk.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
    throw 'C_STAGE_FIXTURE_REPARSE_PARENT'
  }
  $walk=$walk.Parent
}
if (-not [IO.File]::Exists($stage)) {
  throw 'C_STAGE_FIXTURE_STAGE_SOURCE_MISSING'
}
$script:checks=0
$script:fixtures=0
function Assert-Test([bool]$ok,[string]$code) {
  if (-not $ok) { throw $code }
  $script:checks++
}
function Write-Unique([string]$name,[string]$content) {
  $data=[Text.UTF8Encoding]::new($false).GetBytes($content)
  $stream=[IO.FileStream]::new($name,[IO.FileMode]::CreateNew,
    [IO.FileAccess]::Write,[IO.FileShare]::None)
  try {$stream.Write($data,0,$data.Length);$stream.Flush($true)}
  finally {$stream.Dispose()}
}
function New-Fixture([string]$caseName) {
  $root=Join-Path $temp ('zgmini-996-test-c-operator-'+[guid]::NewGuid().ToString('N'))
  $id=[guid]::NewGuid().ToString()
  foreach($sub in @('leases/oldC','leases/continuation','leases/install','archives')) {
    [IO.Directory]::CreateDirectory((Join-Path $root $sub))|Out-Null
  }
  $script:fixtures++
  $groups=[ordered]@{
    oldC=[ordered]@{
      'owner.json'='{"fixture":"oldC"}'
      'PREPARED.json'='{"fixture":"prepared"}'
      'WORKFLOW_ENABLE_ATTEMPTED.json'='{"fixture":"workflow"}'
      'BACKLOG_CLOSE_ATTEMPTED.json'='{"fixture":"backlog"}'
    }
    continuation=[ordered]@{
      'owner.json'=('{"requestId":"'+$id+'","nonce":"'+[guid]::NewGuid().ToString()+'"}')
      'PREPARED.json'='{"fixture":"continuation"}'
    }
    install=[ordered]@{
      'owner.json'='{"fixture":"install"}'
      'RECOVERY_REQUIRED.json'='{"fixture":"recovery"}'
    }
  }
  $expected=[ordered]@{}
  foreach ($group in $groups.GetEnumerator()) {
    $pins=[ordered]@{}
    foreach ($entry in $group.Value.GetEnumerator()) {
      $target=Join-Path (Join-Path $root ('leases/'+$group.Key)) $entry.Key
      Write-Unique $target ([string]$entry.Value)
      $pins[$entry.Key]=(Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant()
    }
    if ($group.Key -eq 'continuation') {
      $dummy=[Text.UTF8Encoding]::new($false).GetBytes('fixture-lock-only')
      $pins['sourceLockSha256']=[BitConverter]::ToString(
        [Security.Cryptography.SHA256]::Create().ComputeHash($dummy)
      ).Replace('-','').ToLowerInvariant()
    }
    $expected[$group.Key]=$pins
  }
  Write-Unique (Join-Path $root 'expected.json') (
    ($expected|ConvertTo-Json -Depth 8 -Compress)+[Environment]::NewLine)
  $live=[ordered]@{
    workflowState='active';protectionVerified=$true
    writerActiveCount=$(if($caseName -eq 'writer'){1}else{0})
    controllerActiveCount=0;otherContinuationCount=0
  }
  Write-Unique (Join-Path $root 'live.json') (
    ($live|ConvertTo-Json -Compress)+[Environment]::NewLine)
  if ($caseName -eq 'collision') {
    [IO.Directory]::CreateDirectory((Join-Path $root 'archives/oldC'))|Out-Null
    Write-Unique (Join-Path $root 'archives/oldC/sentinel.txt') 'preserve-me'
  }
  if ($caseName -eq 'marker') {
    [IO.File]::Move((Join-Path $root 'leases/oldC/PREPARED.json'),
      (Join-Path $root 'leases/oldC/ALTERED.txt'))
  }
  return [pscustomobject]@{root=$root;id=$id}
}
function Has-Dir([string]$root,[string]$sub) {
  return [IO.Directory]::Exists((Join-Path $root $sub))
}
function Run-Case([string]$name,[string]$fault) {
  $fixture=New-Fixture $name
  $response=(& $stage -TestOnly -FixtureRoot $fixture.root -ContinuationId $fixture.id -FailAfter $fault | Out-String).Trim()|ConvertFrom-Json
  Assert-Test (-not $response.executionAuthorized -and -not $response.productionExecutable) ('AUTHORITY_'+$name)
  Assert-Test ($response.operationalWrites -eq 0 -and $response.pcRetries -eq 0) ('WRITES_'+$name)
  $old=Has-Dir $fixture.root 'archives/oldC'
  $cont=Has-Dir $fixture.root 'archives/continuation'
  $install=Has-Dir $fixture.root 'archives/install'
  $barrier=Has-Dir $fixture.root 'leases/install'
  switch($name) {
    'success' {
      Assert-Test ($response.status -ceq 'ISOLATED_NATIVE_STAGE_TEST_ONLY') 'ORDERED_STATUS'
      Assert-Test ($old -and $cont -and $install -and -not $barrier) 'ORDERED_MOVE'
    }
    'after-old' {
      Assert-Test ($response.code -ceq 'C_OPERATOR_TEST_INTERRUPTED_AFTER_OLD_C') 'AFTER_OLD_STATUS'
      Assert-Test ($old -and -not $cont -and -not $install -and $barrier) 'AFTER_OLD_BARRIER'
    }
    'after-cont' {
      Assert-Test ($response.code -ceq 'C_OPERATOR_TEST_INTERRUPTED_AFTER_CONTINUATION') 'AFTER_CONT_STATUS'
      Assert-Test ($old -and $cont -and -not $install -and $barrier) 'AFTER_CONT_BARRIER'
    }
    'after-install' {
      Assert-Test ($response.code -ceq 'C_OPERATOR_TEST_INTERRUPTED_AFTER_INSTALL') 'AFTER_INSTALL_STATUS'
      Assert-Test ($old -and $cont -and $install -and -not $barrier) 'AFTER_INSTALL_ARCHIVE'
    }
    'collision' {
      Assert-Test ($response.code -ceq 'C_OPERATOR_TEST_ARCHIVE_COLLISION') 'COLLISION_STATUS'
      Assert-Test ($old -and (Has-Dir $fixture.root 'leases/oldC') -and $barrier) 'COLLISION_PRESERVE'
      Assert-Test ([IO.File]::ReadAllText((Join-Path $fixture.root 'archives/oldC/sentinel.txt')) -ceq 'preserve-me') 'COLLISION_SENTINEL'
    }
    'writer' {
      Assert-Test ($response.code -ceq 'C_OPERATOR_TEST_LATE_CONFLICT_PREFLIGHT') 'WRITER_STATUS'
      Assert-Test (-not $old -and (Has-Dir $fixture.root 'leases/oldC') -and $barrier) 'WRITER_PRESERVE'
    }
    'marker' {
      Assert-Test ($response.code -ceq 'C_OPERATOR_TEST_UNEXPECTED_SOURCE_ENTRY') 'MARKER_STATUS'
      Assert-Test (-not $old -and (Has-Dir $fixture.root 'leases/oldC') -and $barrier) 'MARKER_PRESERVE'
    }
  }
}
try {
  Run-Case 'success' 'NONE'
  Run-Case 'after-old' 'AFTER_OLD_C'
  Run-Case 'after-cont' 'AFTER_CONTINUATION'
  Run-Case 'after-install' 'AFTER_INSTALL'
  Run-Case 'collision' 'NONE'
  Run-Case 'writer' 'NONE'
  Run-Case 'marker' 'NONE'
  [ordered]@{
    schema='ZGMINI_996_WINDOWS_C_STAGE_NATIVE_FIXTURE_V1'
    status='ISOLATED_WINDOWS_C_STAGE_NATIVE_TEST_ONLY'
    casesPassed=7;checksPassed=$script:checks;createdFixtures=$script:fixtures
    executionAuthorized=$false;operatorReady=$false;originalPcWrites=0
    workflowPuts=0;backlogWrites=0;issuePosts=0;pcRetries=0
    cleanupPerformed=$false
  }|ConvertTo-Json -Compress -Depth 5
} catch {
  [ordered]@{
    schema='ZGMINI_996_WINDOWS_C_STAGE_NATIVE_FIXTURE_V1'
    status='ISOLATED_WINDOWS_STAGE_TEST_STOP'
    code=[string]$_.Exception.Message
    checksPassed=$script:checks;createdFixtures=$script:fixtures
    executionAuthorized=$false;operatorReady=$false;originalPcWrites=0
    workflowPuts=0;backlogWrites=0;issuePosts=0;pcRetries=0
    cleanupPerformed=$false
  }|ConvertTo-Json -Compress -Depth 5
  exit 2
}

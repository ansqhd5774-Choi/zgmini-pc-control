#Requires -Version 5.1
# Run only from an interactive, non-elevated user session on DESKTOP-N62L0NG.
# Without -Apply this performs a read-only readiness check.
[CmdletBinding()]
param([switch]$Apply,[switch]$ConfirmRestrictedCredential,[string]$NodeExe='')
$ErrorActionPreference='Stop'
$TaskName='ZGMINI-HANDOFF-WATCH'
$script:changesStarted=$false
$Root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
function Report([string]$State,[bool]$Wrote=$false) {
  [pscustomobject]@{schema='ZGMINI_HANDOFF_WATCH_USER_ACTIVATION_R1';state=$State;
    pcWrites=$Wrote;credentialValueCaptured=$false;runtimeHeartbeatVerified=$false} | ConvertTo-Json -Compress
}
function StopSafe([string]$Code){Report $Code $script:changesStarted;exit 2}
function Unsafe([string]$P){
  return [string]::IsNullOrWhiteSpace($P) -or $P -match '[%"&|<>^!]' -or
    $P.Contains([string][char]10) -or $P.Contains([string][char]13) -or $P.StartsWith('\\')
}
function CheckSource([string]$Node,[string]$Check,[string]$Base){
  $raw=& $Node $Check '--source-root' $Base 2>$null
  if($LASTEXITCODE -ne 0){StopSafe 'SOURCE_PREFLIGHT_STOP'}
  $report=($raw | Out-String | ConvertFrom-Json -ErrorAction Stop)
  if($report.sourceEligible -ne $true -or $report.sourceFilesChecked -ne 7 -or
    $report.sourceFilesMatched -ne 7 -or $report.sourceCommit -ne '82e06469569bb6842aa4aca43970d84262329481'){
    StopSafe 'SOURCE_PREFLIGHT_STOP'
  }
  return $report
}
try {
  if([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT -or
     [Environment]::MachineName.ToUpperInvariant() -ne 'DESKTOP-N62L0NG'){StopSafe 'WRONG_HOST_STOP'}
  # A service Runner normally runs in Session 0; never create a task there.
  if([Diagnostics.Process]::GetCurrentProcess().SessionId -le 0){StopSafe 'INTERACTIVE_USER_REQUIRED'}
  $id=[Security.Principal.WindowsIdentity]::GetCurrent()
  if($id.User.Value -in @('S-1-5-18','S-1-5-19','S-1-5-20')){StopSafe 'SERVICE_IDENTITY_FORBIDDEN'}
  if((Unsafe $Root) -or $Root -match '(?i)[/\\]_work[/\\]'){StopSafe 'UNSAFE_SOURCE_CHECKOUT'}
  if(-not $NodeExe) {
    $n=Get-Command node.exe -ErrorAction SilentlyContinue
    if(!$n){StopSafe 'NODE22_MISSING'}
    $NodeExe=$n.Source
  }
  if((Unsafe $NodeExe) -or -not [IO.Path]::IsPathRooted($NodeExe) -or
     -not (Test-Path -LiteralPath $NodeExe -PathType Leaf)){StopSafe 'NODE_EXE_INVALID'}
  $version=& $NodeExe --version 2>$null
  if($LASTEXITCODE -ne 0 -or $version -notmatch '^v22[.][0-9]+[.][0-9]+$'){StopSafe 'NODE22_REQUIRED'}
  if($env:GH_TOKEN -or $env:GITHUB_TOKEN){StopSafe 'RAW_TOKEN_ENV_FORBIDDEN'}
  $checker=Join-Path $Root 'tools\handoff-watch-c-preflight.mjs'
  if(-not (Test-Path -LiteralPath $checker -PathType Leaf)){StopSafe 'PREFLIGHT_SOURCE_MISSING'}
  $manifest=CheckSource $NodeExe $checker $Root

  if(Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue){StopSafe 'TASK_ALREADY_EXISTS_STOP'}
  if(-not $env:LOCALAPPDATA -or -not $env:APPDATA){StopSafe 'USER_PROFILE_NOT_READY'}
  $parent=Join-Path $env:LOCALAPPDATA 'ZGMINI'
  $target=Join-Path $parent 'handoff-watch'
  if((Unsafe $target) -or (Test-Path -LiteralPath $target)){StopSafe 'INSTALL_ROOT_EXISTS_OR_UNSAFE'}
  if((Test-Path -LiteralPath $parent) -and
    ((Get-Item -LiteralPath $parent).Attributes -band [IO.FileAttributes]::ReparsePoint)){
    StopSafe 'INSTALL_PARENT_REPARSE_STOP'
  }

  if($env:GH_CONFIG_DIR){StopSafe 'CUSTOM_GH_CONFIG_UNVERIFIED'}
  $gh=Get-Command gh.exe -ErrorAction SilentlyContinue
  if(!$gh){StopSafe 'GH_CLI_MISSING'}
  $hosts=Join-Path $env:APPDATA 'GitHub CLI\hosts.yml'
  if(-not (Test-Path -LiteralPath $hosts -PathType Leaf)){StopSafe 'GH_CONFIG_MISSING'}
  $stat=Get-Item -LiteralPath $hosts
  if($stat.Length -gt 65536 -or
     ($stat.Attributes -band [IO.FileAttributes]::ReparsePoint)){StopSafe 'GH_CONFIG_UNSAFE'}
  # Inspect in memory only; never print file, CLI stderr or token.
  $cfg=[IO.File]::ReadAllText($hosts)
  if($cfg -match '(?im)^\s*oauth_token\s*:' -or
     $cfg -match '(?:github_pat_|gh[opusr]_|ghs_)[A-Za-z0-9_]{12,}'){StopSafe 'GH_PLAINTEXT_TOKEN_STOP'}
  $cfg=$null
  $null=& $gh.Source auth status --hostname github.com 2>&1
  if($LASTEXITCODE -ne 0){StopSafe 'GH_AUTH_UNAVAILABLE'}
  $null=& $gh.Source api --method GET 'repos/ansqhd5774-Choi/zgmini-pc-control/issues?per_page=1' 2>&1
  if($LASTEXITCODE -ne 0){StopSafe 'ISSUES_READ_UNAVAILABLE'}

  if(-not $Apply){Report 'READONLY_READY_USER_APPLY_REQUIRED';exit 0}
  # Only the user can affirm the existing credential has Issues:read only.
  if(-not $ConfirmRestrictedCredential){StopSafe 'RESTRICTED_CREDENTIAL_CONFIRMATION_REQUIRED'}

  $allowed=@('agent-handoff/intake-watch-5s.mjs','agent-handoff/intake-receipt-readonly.mjs',
    'agent-handoff/queue-selector.mjs','agent-handoff/queue-priority.mjs',
    'agent-handoff/contract.mjs','agent-handoff/watcher-gh-credential.mjs',
    'tools/handoff-watch-user-start.cmd')
  $actual=@($manifest.sourceFiles | ForEach-Object {$_.file})
  if($actual.Count -ne 7 -or @(Compare-Object ($allowed | Sort-Object) ($actual | Sort-Object)).Count -ne 0){
    StopSafe 'SOURCE_MANIFEST_UNEXPECTED'
  }
  # No files, tasks or credentials are changed before all above checks.
  $script:changesStarted=$true
  if(-not (Test-Path -LiteralPath $parent)){New-Item -ItemType Directory -Path $parent -ErrorAction Stop | Out-Null}
  New-Item -ItemType Directory -Path $target -ErrorAction Stop | Out-Null
  foreach($name in $allowed){
    $relative=$name.Replace('/','\')
    $src=Join-Path $Root $relative
    $dst=Join-Path $target $relative
    $dir=Split-Path -Parent $dst
    if(-not (Test-Path -LiteralPath $dir)){New-Item -ItemType Directory -Path $dir -Force -ErrorAction Stop | Out-Null}
    Copy-Item -LiteralPath $src -Destination $dst -ErrorAction Stop
  }
  $null=CheckSource $NodeExe $checker $target

  $launcher=Join-Path $target 'tools\handoff-watch-user-start.cmd'
  $cmd=Join-Path $env:SystemRoot 'System32\cmd.exe'
  if((Unsafe $launcher) -or -not (Test-Path -LiteralPath $cmd -PathType Leaf)){
    StopSafe 'TASK_ACTION_INVALID'
  }
  # Arguments: /d /c ""<fixed launcher>" "<fixed Node22 executable>""
  $arguments='/d /c ""'+$launcher+'" "'+$NodeExe+'""'
  $action=New-ScheduledTaskAction -Execute $cmd -Argument $arguments
  $trigger=New-ScheduledTaskTrigger -AtLogOn -User $id.Name
  $principal=New-ScheduledTaskPrincipal -UserId $id.Name -LogonType Interactive -RunLevel Limited
  $settings=New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -RestartCount 2 -RestartInterval (New-TimeSpan -Minutes 5) -ExecutionTimeLimit ([TimeSpan]::Zero)
  # No -Force; never overwrite an existing task or modify the GitHub Runner.
  Register-ScheduledTask -TaskName $TaskName -TaskPath '\' -Action $action -Trigger $trigger -Principal $principal -Settings $settings -ErrorAction Stop | Out-Null
  Start-ScheduledTask -TaskName $TaskName -ErrorAction Stop
  Report 'REGISTERED_START_REQUESTED_HEARTBEAT_PENDING' $true
} catch {
  # Exception text may contain account names, paths or credentials.
  StopSafe 'LOCAL_ACTIVATION_STOP_INSPECT_ON_PC'
}

@echo off
setlocal EnableExtensions DisableDelayedExpansion
rem Approved owner-only C-grade launch: process-scoped RemoteSigned and pinned PS1 Zone.Identifier unblock.
rem Do not invoke from Actions or Runner. No persistent execution-policy changes.
if defined GITHUB_ACTIONS goto :denied
if defined RUNNER_NAME goto :denied
set "ZG_SCRIPT=%~dp0CI_CONTROLLER_B_RECEIPT_ROOT_C1.ps1"
echo ZGMINI C1 approved one-time operator launch on DESKTOP-N62L0NG only.
powershell.exe -NoLogo -NoProfile -NonInteractive -ExecutionPolicy RemoteSigned -Command "$ErrorActionPreference='Stop'; try { if ($env:GITHUB_ACTIONS -or $env:RUNNER_NAME -or -not [Environment]::UserInteractive) { throw 'CI_RECEIPT_INTERACTIVE_OPERATOR_REQUIRED' }; if ([Environment]::MachineName.ToUpperInvariant() -ne 'DESKTOP-N62L0NG') { throw 'CI_RECEIPT_HOST_MISMATCH' }; $identity=[Security.Principal.WindowsIdentity]::GetCurrent(); $principal=[Security.Principal.WindowsPrincipal]::new($identity); if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'CI_RECEIPT_ADMIN_C_REQUIRED' }; if ((Get-ExecutionPolicy) -ne 'RemoteSigned') { throw 'CI_RECEIPT_POLICY_NOT_EFFECTIVE' }; $p=$env:ZG_SCRIPT; if (-not (Test-Path -LiteralPath $p -PathType Leaf)) { throw 'CI_RECEIPT_ORIGINAL_MISSING' }; $expected='C6E39CDCCFAB679B9A9D79C4862B039B23586793DAB9330CFD604E5563E317BA'; if ((Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash -ne $expected) { throw 'CI_RECEIPT_ORIGINAL_HASH_MISMATCH' }; Unblock-File -LiteralPath $p -ErrorAction Stop; if ((Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash -ne $expected) { throw 'CI_RECEIPT_POST_UNBLOCK_HASH_MISMATCH' }; if (Get-Item -LiteralPath $p -Stream Zone.Identifier -ErrorAction SilentlyContinue) { throw 'CI_RECEIPT_ZONE_STILL_PRESENT' }; Write-Output 'launcher=PINNED_SOURCE_CONFIRMED'; Write-Output 'executionPolicyScope=Process'; Write-Output 'effectiveExecutionPolicy=RemoteSigned'; Write-Output 'originalCOperator=START_ONCE'; & $p -Apply; if ($LASTEXITCODE -is [int]) { exit $LASTEXITCODE } else { exit 0 } } catch { $code=[string]$_.Exception.Message; if ($code -notmatch '^CI_RECEIPT_[A-Z_]+$') { $code='CI_RECEIPT_LAUNCHER_UNVERIFIED' }; Write-Output 'status=STOPPED'; Write-Output ('code='+$code); exit 1 }"
set "RC=%ERRORLEVEL%"
echo.
echo STOP after any STOPPED or error. Do not retry, delete folders, or change ACLs.
pause
exit /b %RC%
:denied
echo status=STOPPED
echo code=CI_RECEIPT_INTERACTIVE_OPERATOR_REQUIRED
pause
exit /b 1

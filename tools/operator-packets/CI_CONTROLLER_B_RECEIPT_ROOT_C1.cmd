@echo off
setlocal EnableExtensions DisableDelayedExpansion
rem C-grade independent operator only. Right-click Run as administrator on isolated PC.
rem Script is fail-closed if host, service identity, path, privilege, or ACL is unverified.
if defined GITHUB_ACTIONS exit /b 1
if defined RUNNER_NAME exit /b 1
set "ZG_SCRIPT=%~dp0CI_CONTROLLER_B_RECEIPT_ROOT_C1.ps1"
powershell.exe -NoLogo -NoProfile -NonInteractive -Command "if ((Get-FileHash -LiteralPath $env:ZG_SCRIPT -Algorithm SHA256).Hash -ne 'BECBC97FF283C9436EEBAD07A81CC0FEC667C7293CD9CE65A753F6D401A86938') {exit 9}"
if errorlevel 1 exit /b 1
powershell.exe -NoLogo -NoProfile -NonInteractive -File "%ZG_SCRIPT%" -Apply
set "RC=%ERRORLEVEL%"
echo.
echo STOP on any STOPPED result. Do not retry or delete partial folders.
pause
exit /b %RC%

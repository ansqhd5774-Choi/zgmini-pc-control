@echo off
setlocal EnableExtensions DisableDelayedExpansion
rem C-grade independent operator only. Right-click Run as administrator on isolated PC.
rem Script is fail-closed if host, service identity, path, privilege, or ACL is unverified.
if defined GITHUB_ACTIONS exit /b 1
if defined RUNNER_NAME exit /b 1
powershell.exe -NoLogo -NoProfile -NonInteractive -File "%~dp0CI_CONTROLLER_B_RECEIPT_ROOT_C1.ps1" -Apply
set "RC=%ERRORLEVEL%"
echo.
echo STOP on any STOPPED result. Do not retry or delete partial folders.
pause
exit /b %RC%

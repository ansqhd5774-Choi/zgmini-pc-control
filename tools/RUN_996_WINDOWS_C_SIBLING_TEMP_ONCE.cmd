@echo off
setlocal EnableExtensions DisableDelayedExpansion
REM #996 SAME-PARENT NATIVE WINDOWS TEST ONLY on separate non-operational PC.
REM It never authorizes operational C or changes GitHub/Workflow/Backlog.
set "ZGMINI_C_SIBLING_SCRIPT=%~dp0TEST_996_WINDOWS_C_SIBLING_NATIVE_ONCE.ps1"
set "ZGMINI_C_SIBLING_POWERSHELL=C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe"
if exist "E:\ZGmini\" (
  echo BLOCKED: ORIGINAL_ZGMINI_PRESENT
  pause
  exit /b 2
)
if not exist "%ZGMINI_C_SIBLING_SCRIPT%" (
  echo BLOCKED: PINNED_SIBLING_SCRIPT_MISSING
  pause
  exit /b 2
)
if not exist "%ZGMINI_C_SIBLING_POWERSHELL%" (
  echo BLOCKED: WINDOWS_POWERSHELL_NOT_FOUND
  pause
  exit /b 2
)
REM Verify the exact downloaded PS1 before executing it. Never bypass policy.
"%ZGMINI_C_SIBLING_POWERSHELL%" -NoProfile -NonInteractive -Command "try { if ((Get-FileHash -LiteralPath $env:ZGMINI_C_SIBLING_SCRIPT -Algorithm SHA256).Hash -ne '0a00d432d34a743ab7946ee12d6a379872df48452e5702357bc3c1182f4bfe05') { exit 2 }; exit 0 } catch { exit 2 }"
if errorlevel 1 (
  echo BLOCKED: PINNED_SIBLING_SCRIPT_SHA256_MISMATCH
  pause
  exit /b 2
)
echo #996 ISOLATED WINDOWS C SIBLING SAME-PARENT 10-CASE RESULT:
"%ZGMINI_C_SIBLING_POWERSHELL%" -NoProfile -NonInteractive -File "%ZGMINI_C_SIBLING_SCRIPT%" -TestOnly
set "ZGMINI_C_SIBLING_EXIT=%ERRORLEVEL%"
if not "%ZGMINI_C_SIBLING_EXIT%"=="0" echo TEST STOPPED. DO NOT BYPASS EXECUTION POLICY.
echo Preserve this console result for ZGMINI coordinator.
pause
exit /b %ZGMINI_C_SIBLING_EXIT%

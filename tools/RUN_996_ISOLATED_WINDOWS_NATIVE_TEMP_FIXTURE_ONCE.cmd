@echo off
setlocal EnableExtensions DisableDelayedExpansion
REM #996 NATIVE DIRECTORY.MOVE TEMP-ONLY TEST ON A SEPARATE WINDOWS PC.
REM Do not run on the original ZGmini PC; NEVER starts a C repair or PC job.
REM No original E: write/move, Workflow PUT, Backlog, Issue or GitHub call.
set "ZGMINI_FIXTURE=%~dp0TEST_996_WINDOWS_NATIVE_MOVE_FIXTURE.ps1"
set "ZGMINI_POWERSHELL=C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe"
if exist "E:\ZGmini\" (
  echo BLOCKED: ORIGINAL_ZGMINI_ROOT_PRESENT
  pause
  exit /b 2
)
if not exist "%ZGMINI_FIXTURE%" (
  echo BLOCKED: ISOLATED_FIXTURE_SCRIPT_MISSING
  pause
  exit /b 2
)
if not exist "%ZGMINI_POWERSHELL%" (
  echo BLOCKED: WINDOWS_POWERSHELL_NOT_FOUND
  pause
  exit /b 2
)
REM Stop on a changed script; never bypass the PC's PowerShell execution policy.
"%ZGMINI_POWERSHELL%" -NoProfile -NonInteractive -Command "try { if ((Get-FileHash -LiteralPath $env:ZGMINI_FIXTURE -Algorithm SHA256).Hash -ne '6f8436fec7216d278f82558571a7172e5c2d2f7cc0b8b0db357f9ec4a24e613a') { exit 2 }; exit 0 } catch { exit 2 }"
if errorlevel 1 (
  echo BLOCKED: FIXTURE_SCRIPT_SHA256_MISMATCH_OR_UNREADABLE
  pause
  exit /b 2
)
echo #996 ISOLATED WINDOWS TEMP NATIVE MOVE FIXTURE RESULT:
"%ZGMINI_POWERSHELL%" -NoProfile -NonInteractive -File "%ZGMINI_FIXTURE%"
set "ZGMINI_FIXTURE_EXIT=%ERRORLEVEL%"
if not "%ZGMINI_FIXTURE_EXIT%"=="0" echo FIXTURE STOPPED. DO NOT BYPASS EXECUTION POLICY.
echo Preserve this window and share its result with ZGMINI coordinator.
pause
exit /b %ZGMINI_FIXTURE_EXIT%

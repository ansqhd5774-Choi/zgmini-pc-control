@echo off
setlocal EnableExtensions DisableDelayedExpansion
REM #996 SYNTHETIC C STAGE NATIVE WINDOWS TEST; SEPARATE PC ONLY.
REM No operating C, original E: files, GitHub, Workflow, or backlog changes.
REM This CMD verifies TWO exact PS1 source hashes, then runs 7 TEMP fixtures.
set "ZGMINI_STAGE_FIXTURE=%~dp0TEST_996_WINDOWS_C_STAGE_FIXTURE_ONCE.ps1"
set "ZGMINI_STAGE_ENGINE=%~dp0INVOKE_996_WINDOWS_C_ARCHIVE_CANDIDATE.ps1"
set "ZGMINI_STAGE_POWERSHELL=C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe"
if exist "E:\ZGmini\" (
  echo BLOCKED: ORIGINAL_ZGMINI_ROOT_PRESENT
  pause
  exit /b 2
)
if not exist "%ZGMINI_STAGE_FIXTURE%" (
  echo BLOCKED: TEST_FIXTURE_MISSING
  pause
  exit /b 2
)
if not exist "%ZGMINI_STAGE_ENGINE%" (
  echo BLOCKED: STAGE_ENGINE_MISSING
  pause
  exit /b 2
)
if not exist "%ZGMINI_STAGE_POWERSHELL%" (
  echo BLOCKED: WINDOWS_POWERSHELL_NOT_FOUND
  pause
  exit /b 2
)
REM Never weaken or bypass the machine/user execution policy.
"%ZGMINI_STAGE_POWERSHELL%" -NoProfile -NonInteractive -Command "try { if ((Get-FileHash -LiteralPath $env:ZGMINI_STAGE_FIXTURE -Algorithm SHA256).Hash -ne '2b76e38f785a208a3aefc5d202ec1c478b2f052d244d842e5df024fb2f8cad0b') { exit 2 }; if ((Get-FileHash -LiteralPath $env:ZGMINI_STAGE_ENGINE -Algorithm SHA256).Hash -ne '7fddd91a5ee0088955cdfc03f3799186ade4d5dfce17193e457f75fcf992e657') { exit 2 }; exit 0 } catch { exit 2 }"
if errorlevel 1 (
  echo BLOCKED: PINNED_SCRIPT_SHA256_MISMATCH_OR_UNREADABLE
  pause
  exit /b 2
)
echo #996 ISOLATED WINDOWS C STAGE 7-CASE TEST RESULT:
"%ZGMINI_STAGE_POWERSHELL%" -NoProfile -NonInteractive -File "%ZGMINI_STAGE_FIXTURE%"
set "ZGMINI_STAGE_EXIT=%ERRORLEVEL%"
if not "%ZGMINI_STAGE_EXIT%"=="0" echo TEST STOPPED. DO NOT BYPASS EXECUTION POLICY.
echo Preserve this console result for ZGMINI coordinator.
pause
exit /b %ZGMINI_STAGE_EXIT%

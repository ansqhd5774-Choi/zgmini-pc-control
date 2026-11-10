@echo off
setlocal EnableExtensions DisableDelayedExpansion
REM #996 C interruption: ORIGINAL operating Windows PC only, READ-ONLY.
REM This is NOT the earlier RUN_996_NATIVE_C_ONCE.cmd and NEVER recovers C.
REM No changes to Workflow, backlog, C claim, original lease or E:\ZGmini.
set "ZGMINI_NODE=E:\ZGmini\runtime\node.exe"
set "ZGMINI_CLI=%~dp0controller-996-interrupted-readonly-cli.mjs"
set "ZGMINI_POWERSHELL=C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe"
if not exist "%ZGMINI_NODE%" (
  echo BLOCKED: ORIGINAL_PC_NODE_NOT_FOUND
  pause
  exit /b 2
)
if not exist "%ZGMINI_CLI%" (
  echo BLOCKED: INTERRUPTED_READONLY_CLI_NOT_FOUND
  pause
  exit /b 2
)
if not exist "%ZGMINI_POWERSHELL%" (
  echo BLOCKED: WINDOWS_POWERSHELL_NOT_FOUND
  pause
  exit /b 2
)
REM Avoid the old for /f nested quotation bug. Never interpolate a path as PS code.
"%ZGMINI_POWERSHELL%" -NoProfile -NonInteractive -Command "try { if ((Get-FileHash -LiteralPath $env:ZGMINI_CLI -Algorithm SHA256).Hash -ne '418aa7fb41152c81e95a37ffae858741ae23c98fa503f1300fba33250db2fdd7') { exit 2 }; exit 0 } catch { exit 2 }"
if errorlevel 1 (
  echo BLOCKED: READONLY_CLI_SHA256_MISMATCH_OR_UNREADABLE
  pause
  exit /b 2
)
REM Console only: no TXT, log, temp file, E: file or clipboard writes.
echo #996 ORIGINAL WINDOWS INTERRUPTED READ-ONLY RESULT:
"%ZGMINI_NODE%" "%ZGMINI_CLI%"
set "ZGMINI_OBSERVER_EXIT=%ERRORLEVEL%"
if not "%ZGMINI_OBSERVER_EXIT%"=="0" echo READ-ONLY OBSERVATION BLOCKED. DO NOT RE-RUN WITHOUT REVIEW.
echo Keep this window and show the result to the ZGMINI process coordinator.
pause
exit /b %ZGMINI_OBSERVER_EXIT%

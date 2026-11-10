@echo off
setlocal EnableExtensions DisableDelayedExpansion
REM #996 original Windows SECOND READ-ONLY evidence; NEVER a C recovery.
REM The old RUN_996_NATIVE_C_ONCE.cmd must NEVER be launched again.
REM No workflow PUT, backlog rename, claim/lease archive, Issue or PC retry.
set "ZGMINI_NODE=E:\ZGmini\runtime\node.exe"
set "ZGMINI_CLI=%~dp0controller-996-interrupted-readonly-cli-r2.mjs"
set "ZGMINI_POWERSHELL=C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe"
if not exist "%ZGMINI_NODE%" (
  echo BLOCKED: ORIGINAL_PC_NODE_NOT_FOUND
  pause
  exit /b 2
)
if not exist "%ZGMINI_CLI%" (
  echo BLOCKED: INTERRUPTED_R2_CLI_NOT_FOUND
  pause
  exit /b 2
)
if not exist "%ZGMINI_POWERSHELL%" (
  echo BLOCKED: WINDOWS_POWERSHELL_NOT_FOUND
  pause
  exit /b 2
)
REM Fixed Windows PowerShell executable; pass the filename only via env var.
"%ZGMINI_POWERSHELL%" -NoProfile -NonInteractive -Command "try { if ((Get-FileHash -LiteralPath $env:ZGMINI_CLI -Algorithm SHA256).Hash -ne '1dfb2f0101a6406ba6bf7dc8acb8ec8f14cc31fdf02a02afa825ff733b9b6dfe') { exit 2 }; exit 0 } catch { exit 2 }"
if errorlevel 1 (
  echo BLOCKED: READONLY_R2_CLI_SHA256_MISMATCH_OR_UNREADABLE
  pause
  exit /b 2
)
REM Console only. Never write an evidence file or a temporary log.
echo #996 ORIGINAL WINDOWS INTERRUPTED SECOND READ-ONLY RESULT:
"%ZGMINI_NODE%" "%ZGMINI_CLI%"
set "ZGMINI_OBSERVER_EXIT=%ERRORLEVEL%"
if not "%ZGMINI_OBSERVER_EXIT%"=="0" echo READ-ONLY R2 BLOCKED. DO NOT RE-RUN WITHOUT REVIEW.
echo Keep this window and show the result to the ZGMINI process coordinator.
pause
exit /b %ZGMINI_OBSERVER_EXIT%

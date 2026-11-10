@echo off
setlocal EnableExtensions DisableDelayedExpansion
REM #996 C interruption: ORIGINAL operating Windows PC only, READ-ONLY.
REM This is NOT the earlier RUN_996_NATIVE_C_ONCE.cmd and NEVER recovers C.
REM No changes to Workflow, backlog, C claim, original lease or E:\ZGmini.
set "ZGMINI_NODE=E:\ZGmini\runtime\node.exe"
set "ZGMINI_CLI=%~dp0controller-996-interrupted-readonly-cli.mjs"
set "ZGMINI_POWERSHELL=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
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
if "%TEMP%"=="" (
  echo BLOCKED: TEMP_NOT_SET
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
set "ZGMINI_RESULT=%TEMP%\ZGMINI-996-INTERRUPTED-READONLY-%RANDOM%-%RANDOM%.txt"
if exist "%ZGMINI_RESULT%" (
  echo BLOCKED: RESULT_NAME_COLLISION
  pause
  exit /b 2
)
"%ZGMINI_NODE%" "%ZGMINI_CLI%" > "%ZGMINI_RESULT%"
set "ZGMINI_OBSERVER_EXIT=%ERRORLEVEL%"
echo ORIGINAL WINDOWS #996 INTERRUPTED READ-ONLY RESULT: "%ZGMINI_RESULT%"
if not "%ZGMINI_OBSERVER_EXIT%"=="0" echo READ-ONLY OBSERVATION BLOCKED. DO NOT RE-RUN WITHOUT REVIEW.
start "" "%SystemRoot%\System32\notepad.exe" "%ZGMINI_RESULT%"
exit /b %ZGMINI_OBSERVER_EXIT%

@echo off
setlocal EnableExtensions DisableDelayedExpansion
REM #996 observation is ONLY for the ORIGINAL operating Windows PC with E:.
REM No Controller, Workflow, lease, scheduled task or source mutations.
set "ZGMINI_NODE=E:\ZGmini\runtime\node.exe"
set "ZGMINI_SCRIPT=%~dp0controller-996-windows-observer.mjs"
if not exist "%ZGMINI_NODE%" (
  echo BLOCKED: ORIGINAL_PC_NODE_NOT_FOUND
  pause
  exit /b 2
)
if not exist "%ZGMINI_SCRIPT%" (
  echo BLOCKED: OBSERVER_SOURCE_NOT_FOUND
  pause
  exit /b 2
)
if not exist "E:\ZGmini\automation\pc-maintenance\MAINTENANCE_INSTALL.json" (
  echo BLOCKED: ORIGINAL_PC_MAINTENANCE_ROOT_NOT_FOUND
  pause
  exit /b 2
)
if "%TEMP%"=="" (
  echo BLOCKED: TEMP_NOT_SET
  pause
  exit /b 2
)
set "ZGMINI_READONLY_RESULT=%TEMP%\ZGMINI-996-READONLY-%RANDOM%-%RANDOM%.txt"
if exist "%ZGMINI_READONLY_RESULT%" (
  echo BLOCKED: RESULT_NAME_COLLISION
  pause
  exit /b 2
)
"%ZGMINI_NODE%" "%ZGMINI_SCRIPT%" > "%ZGMINI_READONLY_RESULT%"
set "ZGMINI_OBSERVER_EXIT=%ERRORLEVEL%"
echo ORIGINAL PC READ-ONLY RESULT: "%ZGMINI_READONLY_RESULT%"
if not "%ZGMINI_OBSERVER_EXIT%"=="0" echo OBSERVATION BLOCKED; DO NOT RE-RUN WITHOUT REVIEW.
start "" notepad.exe "%ZGMINI_READONLY_RESULT%"
exit /b %ZGMINI_OBSERVER_EXIT%

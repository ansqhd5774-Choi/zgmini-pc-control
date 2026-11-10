@echo off
setlocal EnableExtensions DisableDelayedExpansion
REM Only the ORIGINAL operating Windows PC: E:\ZGmini is the immutable root.
REM This supplementary check is READ-ONLY, with a result in %%TEMP%% only.
set "ZGMINI_NODE=E:\ZGmini\runtime\node.exe"
set "ZGMINI_SCRIPT=%~dp0controller-996-protection-attestation.mjs"
if not exist "%ZGMINI_NODE%" (
  echo BLOCKED: ORIGINAL_PC_NODE_NOT_FOUND
  pause
  exit /b 2
)
if not exist "%ZGMINI_SCRIPT%" (
  echo BLOCKED: PROTECTION_PROBE_SOURCE_NOT_FOUND
  pause
  exit /b 2
)
if not exist "E:\ZGmini\data\pc-writer" (
  echo BLOCKED: ORIGINAL_PC_WRITER_ROOT_NOT_FOUND
  pause
  exit /b 2
)
if "%TEMP%"=="" (
  echo BLOCKED: TEMP_NOT_SET
  pause
  exit /b 2
)
set "ZGMINI_PROTECTED_RESULT=%TEMP%\ZGMINI-996-PROTECTED-%RANDOM%-%RANDOM%.txt"
if exist "%ZGMINI_PROTECTED_RESULT%" (
  echo BLOCKED: RESULT_NAME_COLLISION
  pause
  exit /b 2
)
"%ZGMINI_NODE%" "%ZGMINI_SCRIPT%" > "%ZGMINI_PROTECTED_RESULT%"
set "ZGMINI_PROBE_EXIT=%ERRORLEVEL%"
echo ORIGINAL PC PROTECTED READ-ONLY RESULT: "%ZGMINI_PROTECTED_RESULT%"
if not "%ZGMINI_PROBE_EXIT%"=="0" echo PROTECTED OBSERVATION BLOCKED; DO NOT RE-RUN WITHOUT REVIEW.
start "" notepad.exe "%ZGMINI_PROTECTED_RESULT%"
exit /b %ZGMINI_PROBE_EXIT%

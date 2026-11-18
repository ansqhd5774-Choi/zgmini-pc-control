@echo off
setlocal EnableExtensions DisableDelayedExpansion
rem C-approved local task entrypoint only: NO registration, no installs, no runner use.
rem Pass the validated absolute Node 22 executable as the sole argument.
if "%~1"=="" exit /b 2
if not "%~2"=="" exit /b 2
if not exist "%~1" exit /b 3
if not exist "%~dp0..\agent-handoff\intake-watch-5s.mjs" exit /b 4
if defined GH_TOKEN exit /b 5
if defined GITHUB_TOKEN exit /b 5
where gh >nul 2>nul
if errorlevel 1 exit /b 6

set "ZGMINI_HANDOFF_WATCH_ENABLED=true"
set "ZGMINI_HANDOFF_WATCH_AUTH_SOURCE=GH_CREDENTIAL_STORE"
set "ZGMINI_HANDOFF_WATCH_TEMP=%TEMP%\ZGMINI"
if not exist "%ZGMINI_HANDOFF_WATCH_TEMP%" mkdir "%ZGMINI_HANDOFF_WATCH_TEMP%"
if not exist "%ZGMINI_HANDOFF_WATCH_TEMP%" exit /b 7

rem Only non-secret intake and one-per-12-polls heartbeat records are written to TEMP.
"%~1" "%~dp0..\agent-handoff\intake-watch-5s.mjs" >>"%ZGMINI_HANDOFF_WATCH_TEMP%\handoff-watch-observation.log" 2>&1
set "EXIT_CODE=%ERRORLEVEL%"
endlocal & exit /b %EXIT_CODE%

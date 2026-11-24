@echo off
setlocal EnableExtensions DisableDelayedExpansion
title ZGMINI W04 3409 - independent recovery one-time operator
rem Exact C-grade interactive Windows operator only. Never run on Actions/Runner.
rem The fixed JS source is authenticated against its committed Git blob ID.
rem Do not repeat if an attempt or stage already exists. No reset/clean/rollback.
set "ZG_NODE=E:\ZGmini\runtime\node.exe"
set "ZG_SCRIPT=%~dp0w04-3409-recovery-once.mjs"
set "ZG_JS_BLOB=42d505fad9b6b0e35e1c7a15769800cc419f7d15"
if defined GITHUB_ACTIONS goto :no_runner
if defined RUNNER_NAME goto :no_runner
if not exist "%ZG_NODE%" goto :no_node
if not exist "%ZG_SCRIPT%" goto :no_script
"%ZG_NODE%" -e "try{const f=require('node:fs'),h=require('node:crypto'),b=f.readFileSync(process.argv[1]);const v=h.createHash('sha1').update(Buffer.from('blob '+b.length+'\x00')).update(b).digest('hex');process.exit(v==='%ZG_JS_BLOB%'?0:1)}catch{process.exit(1)}" "%ZG_SCRIPT%" >nul 2>nul
if errorlevel 1 goto :source_invalid
echo W04 #3409 fixed independent recovery request (one attempt only).
echo This will verify pinned source/CAS and may archive the original recovery lease.
"%ZG_NODE%" "%ZG_SCRIPT%" --once
set "ZG_EXIT=%errorlevel%"
if defined TEMP if exist "%TEMP%\ZGMINI_W04_3409_RECOVERY_ONCE_V1.txt" (
  echo.
  type "%TEMP%\ZGMINI_W04_3409_RECOVERY_ONCE_V1.txt"
)
echo.
echo ExitCode=%ZG_EXIT% ^(no automatic retry^).
pause
exit /b %ZG_EXIT%
:no_runner
echo STOP: independent Windows operator required; GitHub Runner is forbidden.
pause
exit /b 90
:no_node
echo STOP: approved Windows Node executable absent.
pause
exit /b 91
:no_script
echo STOP: matching fixed JS file absent beside this packet.
pause
exit /b 92
:source_invalid
echo STOP: pinned JS raw Git blob bytes mismatch. No action performed.
pause
exit /b 93

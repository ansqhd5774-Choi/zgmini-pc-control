@echo off
setlocal EnableExtensions DisableDelayedExpansion
title ZGMINI 434 Independent Maintainer Handoff V2
rem Operator-only approved pinned handoff. Never fetch/pull/merge, reset or retry.
set "ZG_REPO=E:\ZGmini\projects\zgmini-pc-control"
set "ZG_NODE=E:\ZGmini\runtime\node.exe"
set "ZG_LOCAL_HEAD=14fa522c0b051801f6a12b64d872d7a50532d39e"
set "ZG_TARGET=1d6f66d87c0ff247ba75b4c98682c07c646e79cc"
if not defined TEMP goto :no_temp
set "ZG_RESULT=%TEMP%\ZGMINI_MAINTENANCE_434_HANDOFF_V2_RESULT.txt"
set "ZG_REASON="
set "ZG_EXIT=0"
if exist "%ZG_RESULT%" goto :existing
> "%ZG_RESULT%" echo SCHEMA=ZGMINI_MAINTENANCE_434_HANDOFF_OPERATOR_V2
if errorlevel 1 goto :write_fail
>>"%ZG_RESULT%" echo EXPECTED_LOCAL_HEAD=%ZG_LOCAL_HEAD%
>>"%ZG_RESULT%" echo HANDOFF_TARGET_SHA=%ZG_TARGET%
>>"%ZG_RESULT%" echo GIT_UPDATE_ATTEMPTED=NO
>>"%ZG_RESULT%" echo SOURCE_FETCH_ATTEMPTED=NO
>>"%ZG_RESULT%" echo PHASE=PREVALIDATION
echo ZGMINI 434 maintainer self-handoff V2: checking approved Windows-local source...
if defined GITHUB_ACTIONS (set "ZG_REASON=GITHUB_ACTIONS_FORBIDDEN" & goto :preflight_stop)
if defined RUNNER_NAME (set "ZG_REASON=RUNNER_FORBIDDEN" & goto :preflight_stop)
if not exist "%ZG_REPO%\" (set "ZG_REASON=REPO_MISSING" & goto :preflight_stop)
if not exist "%ZG_NODE%" (set "ZG_REASON=NODE_MISSING" & goto :preflight_stop)
if not exist "%ZG_REPO%\tools\handoff-maintenance.mjs" (set "ZG_REASON=HANDOFF_SCRIPT_MISSING" & goto :preflight_stop)
if not exist "%ZG_REPO%\approvals\maintenance-handoffs\%ZG_TARGET%.json" (set "ZG_REASON=LOCAL_APPROVAL_MANIFEST_MISSING" & goto :preflight_stop)
where git >nul 2>&1
if errorlevel 1 (set "ZG_REASON=GIT_UNAVAILABLE" & goto :preflight_stop)
set "ZG_HEAD="
for /f "delims=" %%H in ('git -C "%ZG_REPO%" rev-parse --verify HEAD 2^>nul') do set "ZG_HEAD=%%H"
if /i not "%ZG_HEAD%"=="%ZG_LOCAL_HEAD%" (set "ZG_REASON=LOCAL_SOURCE_HEAD_CHANGED" & goto :preflight_stop)
>>"%ZG_RESULT%" echo ACTUAL_LOCAL_HEAD=%ZG_HEAD%
git -c core.optionalLocks=false -C "%ZG_REPO%" ls-files --error-unmatch -- "approvals/maintenance-handoffs/%ZG_TARGET%.json" >nul 2>&1
if errorlevel 1 (set "ZG_REASON=APPROVAL_MANIFEST_NOT_TRACKED" & goto :preflight_stop)
>>"%ZG_RESULT%" echo PREVALIDATION=PASS
>>"%ZG_RESULT%" echo PHASE=HANDOFF_INVOKED_ONCE
echo Source preflight PASS. Invoking approved Windows maintenance handoff once...
rem The existing helper independently verifies main, approved 8 source hashes, installed SHA,
rem receiver identity/origin, Windows medium token, active leases, backup and rollback.
"%ZG_NODE%" "%ZG_REPO%\tools\handoff-maintenance.mjs" --source-sha %ZG_TARGET% >>"%ZG_RESULT%" 2>&1
set "ZG_EXIT=%errorlevel%"
>>"%ZG_RESULT%" echo HANDOFF_PROCESS_EXIT=%ZG_EXIT%
if not "%ZG_EXIT%"=="0" goto :handoff_not_pass
>>"%ZG_RESULT%" echo OPERATOR_RESULT=HANDOFF_HELPER_PASS
echo Handoff helper PASS. Runtime effect still needs separate E report verification.
set "ZG_EXIT=0"
goto :display
:handoff_not_pass
>>"%ZG_RESULT%" echo OPERATOR_RESULT=STOP_NO_RETRY
echo STOP: handoff returned nonzero. Preserve result. Do not retry.
goto :display
:preflight_stop
>>"%ZG_RESULT%" echo OPERATOR_RESULT=PREVALIDATION_BLOCKED
>>"%ZG_RESULT%" echo CODE=%ZG_REASON%
>>"%ZG_RESULT%" echo HANDOFF_INVOKED=NO
echo STOP: preflight blocked; approved helper was not invoked.
set "ZG_EXIT=92"
goto :display
:existing
echo Existing V2 result preserved. No new handoff invocation.
set "ZG_EXIT=90"
goto :display
:display
echo.
echo ===== ZGMINI 434 HANDOFF V2 RESULT =====
type "%ZG_RESULT%"
echo.
echo Result opens in Notepad. Preserve it and do not rerun this CMD.
start "" notepad.exe "%ZG_RESULT%" >nul 2>&1
pause
exit /b %ZG_EXIT%
:no_temp
echo STOP: user TEMP unavailable. No handoff attempted.
pause
exit /b 91
:write_fail
echo STOP: unable to create result in TEMP. No handoff attempted.
pause
exit /b 91

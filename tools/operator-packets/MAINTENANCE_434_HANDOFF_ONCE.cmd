@echo off
setlocal EnableExtensions DisableDelayedExpansion
rem One-time operator-only handoff. Windows local interactive user only.
rem This packet never fetches code, changes Git state, or retries a handoff.
set "ZG_REPO=E:\ZGmini\projects\zgmini-pc-control"
set "ZG_NODE=E:\ZGmini\runtime\node.exe"
set "ZG_TARGET=1d6f66d87c0ff247ba75b4c98682c07c646e79cc"
set "ZG_REPORT=%~dp0ZGMINI_MAINTENANCE_434_ONCE_RESULT.txt"
set "ZG_MANIFEST=%ZG_REPO%\approvals\maintenance-handoffs\%ZG_TARGET%.json"
set "ZG_REASON="

if exist "%ZG_REPORT%" (
  echo STOP: existing result is preserved. Do not retry.
  exit /b 90
)
if not exist "%ZG_NODE%" (set "ZG_REASON=NODE_MISSING" & goto :preflight_stop)
if not exist "%ZG_REPO%\tools\handoff-maintenance.mjs" (set "ZG_REASON=HANDOFF_SCRIPT_MISSING" & goto :preflight_stop)
if not exist "%ZG_MANIFEST%" (set "ZG_REASON=LOCAL_APPROVAL_MANIFEST_MISSING" & goto :preflight_stop)
where git >nul 2>&1
if errorlevel 1 (set "ZG_REASON=GIT_UNAVAILABLE" & goto :preflight_stop)
set "ZG_BRANCH="
for /f "delims=" %%B in ('git -C "%ZG_REPO%" branch --show-current 2^>nul') do set "ZG_BRANCH=%%B"
if not "%ZG_BRANCH%"=="main" (set "ZG_REASON=HANDOFF_MAIN_REQUIRED" & goto :preflight_stop)

(
  echo SCHEMA=ZGMINI_MAINTENANCE_434_OPERATOR_PACKET_V1
  echo TARGET_SHA=%ZG_TARGET%
  echo PHASE=ONE_TIME_HANDOFF_INVOKED
) >"%ZG_REPORT%"
if errorlevel 1 (
  echo STOP: cannot create result file. Handoff was not invoked.
  exit /b 91
)

rem All SHA, scope, dirty-file, lease, receiver, token and rollback guards live in the approved helper.
"%ZG_NODE%" "%ZG_REPO%\tools\handoff-maintenance.mjs" --source-sha %ZG_TARGET% >>"%ZG_REPORT%" 2>&1
set "ZG_EXIT=%errorlevel%"
>>"%ZG_REPORT%" echo HANDOFF_PROCESS_EXIT=%ZG_EXIT%
if "%ZG_EXIT%"=="0" (
  >>"%ZG_REPORT%" echo OPERATOR_RESULT=HANDOFF_HELPER_PASS
  echo Handoff helper PASS. See the single result TXT for the exact result.
  exit /b 0
)
>>"%ZG_REPORT%" echo OPERATOR_RESULT=STOP_NO_RETRY
echo STOP: Handoff helper did not pass. Preserve the result and do not retry.
exit /b %ZG_EXIT%

:preflight_stop
(
  echo SCHEMA=ZGMINI_MAINTENANCE_434_OPERATOR_PACKET_V1
  echo TARGET_SHA=%ZG_TARGET%
  echo OPERATOR_RESULT=AUTOMATION_BLOCKED
  echo CODE=%ZG_REASON%
  echo HANDOFF_INVOKED=NO
) >"%ZG_REPORT%"
if errorlevel 1 (echo STOP: preflight failed and result path is not writable.)
echo STOP: %ZG_REASON%. Handoff was not invoked. Do not retry automatically.
exit /b 92

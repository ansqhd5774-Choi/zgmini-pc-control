@echo off
setlocal EnableExtensions DisableDelayedExpansion
title ZGMINI 434 Pinned FF V2 - operator only
rem #434 approved exact local main fast-forward only: no handoff and no network.
rem This packet never fetches, pulls, checks out another branch, resets or retries.
set "ZG_REPO=E:\ZGmini\projects\zgmini-pc-control"
set "ZG_OLD=91a6e085d69d35164c28cdfb8ff74cc67a6efd3b"
set "ZG_TARGET=14fa522c0b051801f6a12b64d872d7a50532d39e"
set "ZG_HANDOFF_TARGET=1d6f66d87c0ff247ba75b4c98682c07c646e79cc"
if not defined TEMP goto :no_temp
set "ZG_REPORT=%TEMP%\ZGMINI_MAINTENANCE_434_PINNED_FF_V2_RESULT.txt"
set "ZG_BRANCH_ACTUAL=%TEMP%\ZGMINI_434_V2_ACTUAL_BRANCH.tmp"
set "ZG_BRANCH_EXPECTED=%TEMP%\ZGMINI_434_V2_EXPECTED_BRANCH.tmp"
set "ZG_EXIT=0"
set "ZG_NO_HOOKS=%ZG_REPO%\__ZGMINI_434_DISABLED_HOOKS_DO_NOT_CREATE__"
set "ZG_REASON="
if exist "%ZG_REPORT%" goto :existing_report
>"%ZG_REPORT%" echo SCHEMA=ZGMINI_MAINTENANCE_434_PINNED_FF_V2
if errorlevel 1 goto :write_fail
>>"%ZG_REPORT%" echo EXPECTED_HEAD_BEFORE=%ZG_OLD%
>>"%ZG_REPORT%" echo EXACT_TARGET_HEAD=%ZG_TARGET%
>>"%ZG_REPORT%" echo HANDOFF_TARGET_SHA=%ZG_HANDOFF_TARGET%
>>"%ZG_REPORT%" echo EXPECTED_CHANGED_FILES=16
>>"%ZG_REPORT%" echo HANDOFF_INVOKED=NO
>>"%ZG_REPORT%" echo GIT_NETWORK_ATTEMPTED=NO
>>"%ZG_REPORT%" echo FF_PHASE=PREVALIDATION
echo V2 result created in user TEMP. Starting safety preflight...
if defined GITHUB_ACTIONS (set "ZG_REASON=GITHUB_ACTIONS_FORBIDDEN" & goto :preflight_stop)
if defined RUNNER_NAME (set "ZG_REASON=RUNNER_FORBIDDEN" & goto :preflight_stop)
if not exist "%ZG_REPO%\" (set "ZG_REASON=REPO_MISSING" & goto :preflight_stop)
if exist "%ZG_NO_HOOKS%" (set "ZG_REASON=DISABLED_HOOK_PATH_ALREADY_EXISTS" & goto :preflight_stop)
if exist "E:\ZGmini\automation\pc-maintenance\leases\controller-install" (
  set "ZG_REASON=CONTROLLER_INSTALL_ACTIVE"
  goto :preflight_stop
)
where git >nul 2>&1
if errorlevel 1 (set "ZG_REASON=GIT_UNAVAILABLE" & goto :preflight_stop)
git -c core.optionalLocks=false -C "%ZG_REPO%" rev-parse --is-inside-work-tree >>"%ZG_REPORT%" 2>&1
if errorlevel 1 (set "ZG_REASON=INVALID_REPO" & goto :preflight_stop)
rem Compare Git-generated ref strings byte-for-byte (no CMD parsing of untrusted branch names).
if exist "%ZG_BRANCH_ACTUAL%" (set "ZG_REASON=BRANCH_TEMP_ALREADY_PRESENT" & goto :preflight_stop)
if exist "%ZG_BRANCH_EXPECTED%" (set "ZG_REASON=BRANCH_TEMP_ALREADY_PRESENT" & goto :preflight_stop)
git -C "%ZG_REPO%" symbolic-ref --quiet HEAD >"%ZG_BRANCH_ACTUAL%" 2>>"%ZG_REPORT%"
if errorlevel 1 (set "ZG_REASON=BRANCH_READ_ERROR" & goto :preflight_stop)
git -C "%ZG_REPO%" rev-parse --symbolic-full-name refs/heads/main >"%ZG_BRANCH_EXPECTED%" 2>>"%ZG_REPORT%"
if errorlevel 1 (set "ZG_REASON=EXPECTED_BRANCH_ERROR" & goto :preflight_stop)
fc /b "%ZG_BRANCH_ACTUAL%" "%ZG_BRANCH_EXPECTED%" >nul 2>&1
set "ZG_BRANCH_COMPARE_RC=%errorlevel%"
del /q "%ZG_BRANCH_ACTUAL%" "%ZG_BRANCH_EXPECTED%" >nul 2>&1
if not "%ZG_BRANCH_COMPARE_RC%"=="0" (set "ZG_REASON=MAIN_REQUIRED" & goto :preflight_stop)
>>"%ZG_REPORT%" echo GIT_BRANCH_CONFIRMED=main
set "ZG_HEAD="
for /f "delims=" %%H in ('git -C "%ZG_REPO%" rev-parse --verify HEAD 2^>nul') do set "ZG_HEAD=%%H"
if /i not "%ZG_HEAD%"=="%ZG_OLD%" (set "ZG_REASON=HEAD_CHANGED" & goto :preflight_stop)
>>"%ZG_REPORT%" echo ACTUAL_HEAD_BEFORE=%ZG_HEAD%
set "ZG_CACHED="
for /f "delims=" %%H in ('git -C "%ZG_REPO%" rev-parse --verify refs/remotes/origin/main 2^>nul') do set "ZG_CACHED=%%H"
if not defined ZG_CACHED (set "ZG_REASON=CACHED_ORIGIN_MISSING" & goto :preflight_stop)
>>"%ZG_REPORT%" echo CACHED_ORIGIN_MAIN=%ZG_CACHED%
git -C "%ZG_REPO%" cat-file -e %ZG_TARGET% >nul 2>>"%ZG_REPORT%"
if errorlevel 1 (set "ZG_REASON=TARGET_OBJECT_MISSING" & goto :preflight_stop)
git -C "%ZG_REPO%" merge-base --is-ancestor %ZG_OLD% %ZG_TARGET% >nul 2>&1
if errorlevel 1 (set "ZG_REASON=LOCAL_TARGET_NOT_FF" & goto :preflight_stop)
git -C "%ZG_REPO%" merge-base --is-ancestor %ZG_TARGET% refs/remotes/origin/main >nul 2>&1
if errorlevel 1 (set "ZG_REASON=TARGET_NOT_CACHED_ANCESTOR" & goto :preflight_stop)
rem Protect all 10 added target paths, including ignored and untracked local files.
if exist "%ZG_REPO%\approvals\controller-updates\364c59b9d3aa30ee7881cdfcff647ccd3a164d9c.json" (set "ZG_REASON=ADDED_TARGET_ALREADY_PRESENT" & goto :preflight_stop)
if exist "%ZG_REPO%\approvals\maintenance-handoffs\1d6f66d87c0ff247ba75b4c98682c07c646e79cc.json" (set "ZG_REASON=ADDED_TARGET_ALREADY_PRESENT" & goto :preflight_stop)
if exist "%ZG_REPO%\controller\r54-sixfile-inventory-readonly.mjs" (set "ZG_REASON=ADDED_TARGET_ALREADY_PRESENT" & goto :preflight_stop)
if exist "%ZG_REPO%\controller\release-calendar-runtime-readonly.mjs" (set "ZG_REASON=ADDED_TARGET_ALREADY_PRESENT" & goto :preflight_stop)
if exist "%ZG_REPO%\controller\report-upload-verified.mjs" (set "ZG_REASON=ADDED_TARGET_ALREADY_PRESENT" & goto :preflight_stop)
if exist "%ZG_REPO%\results\42019572689-1-seat-2.json" (set "ZG_REASON=ADDED_TARGET_ALREADY_PRESENT" & goto :preflight_stop)
if exist "%ZG_REPO%\results\42019572689-1-seat-2.txt" (set "ZG_REASON=ADDED_TARGET_ALREADY_PRESENT" & goto :preflight_stop)
if exist "%ZG_REPO%\tests\r54-sixfile-inventory-readonly.test.mjs" (set "ZG_REASON=ADDED_TARGET_ALREADY_PRESENT" & goto :preflight_stop)
if exist "%ZG_REPO%\tests\release-calendar-runtime-readonly.test.mjs" (set "ZG_REASON=ADDED_TARGET_ALREADY_PRESENT" & goto :preflight_stop)
if exist "%ZG_REPO%\tests\report-upload-verified.test.mjs" (set "ZG_REASON=ADDED_TARGET_ALREADY_PRESENT" & goto :preflight_stop)
rem Check the 16 exactly approved diff paths, without a global dirty gate.
git -c core.optionalLocks=false -C "%ZG_REPO%" status --porcelain -- "AGENTS.md" "approvals/controller-updates/364c59b9d3aa30ee7881cdfcff647ccd3a164d9c.json" "approvals/maintenance-handoffs/1d6f66d87c0ff247ba75b4c98682c07c646e79cc.json" "config/operations.json" "controller/operations.mjs" "controller/r54-sixfile-inventory-readonly.mjs" "controller/release-calendar-runtime-readonly.mjs" "controller/report-upload-verified.mjs" "controller/upload.mjs" "results/42019572689-1-seat-2.json" "results/42019572689-1-seat-2.txt" "tests/maintenance-agent.test.mjs" "tests/r54-sixfile-inventory-readonly.test.mjs" "tests/release-calendar-runtime-readonly.test.mjs" "tests/report-upload-verified.test.mjs" "tools/maintenance-agent.mjs" >nul 2>&1
if errorlevel 1 (set "ZG_REASON=SCOPED_STATUS_ERROR" & goto :preflight_stop)
set "ZG_DIRTY=NO"
for /f "delims=" %%S in ('git -c core.optionalLocks=false -C "%ZG_REPO%" status --porcelain -- "AGENTS.md" "approvals/controller-updates/364c59b9d3aa30ee7881cdfcff647ccd3a164d9c.json" "approvals/maintenance-handoffs/1d6f66d87c0ff247ba75b4c98682c07c646e79cc.json" "config/operations.json" "controller/operations.mjs" "controller/r54-sixfile-inventory-readonly.mjs" "controller/release-calendar-runtime-readonly.mjs" "controller/report-upload-verified.mjs" "controller/upload.mjs" "results/42019572689-1-seat-2.json" "results/42019572689-1-seat-2.txt" "tests/maintenance-agent.test.mjs" "tests/r54-sixfile-inventory-readonly.test.mjs" "tests/release-calendar-runtime-readonly.test.mjs" "tests/report-upload-verified.test.mjs" "tools/maintenance-agent.mjs" 2^>nul') do set "ZG_DIRTY=YES"
if "%ZG_DIRTY%"=="YES" (set "ZG_REASON=APPROVED_PATHS_DIRTY" & goto :preflight_stop)
rem Capture one filter-attribute lookup in the sole result TXT; test Git exit code.
git -C "%ZG_REPO%" check-attr filter -- "AGENTS.md" "approvals/controller-updates/364c59b9d3aa30ee7881cdfcff647ccd3a164d9c.json" "approvals/maintenance-handoffs/1d6f66d87c0ff247ba75b4c98682c07c646e79cc.json" "config/operations.json" "controller/operations.mjs" "controller/r54-sixfile-inventory-readonly.mjs" "controller/release-calendar-runtime-readonly.mjs" "controller/report-upload-verified.mjs" "controller/upload.mjs" "results/42019572689-1-seat-2.json" "results/42019572689-1-seat-2.txt" "tests/maintenance-agent.test.mjs" "tests/r54-sixfile-inventory-readonly.test.mjs" "tests/release-calendar-runtime-readonly.test.mjs" "tests/report-upload-verified.test.mjs" "tools/maintenance-agent.mjs" >>"%ZG_REPORT%" 2>&1
set "ZG_ATTR_RC=%errorlevel%"
if not "%ZG_ATTR_RC%"=="0" (set "ZG_REASON=FILTER_CHECK_ERROR" & goto :preflight_stop)
set "ZG_ATTR_COUNT=0"
set "ZG_FILTERED=NO"
for /f "usebackq tokens=1,2,* delims=:" %%A in ("%ZG_REPORT%") do (
  if /i "%%B"==" filter" (
    set /a ZG_ATTR_COUNT+=1 >nul
    if /i not "%%C"==" unspecified" set "ZG_FILTERED=YES"
  )
)
if not "%ZG_ATTR_COUNT%"=="16" (set "ZG_REASON=FILTER_LINE_COUNT_ERROR" & goto :preflight_stop)
if "%ZG_FILTERED%"=="YES" (set "ZG_REASON=FILTER_ASSIGNED" & goto :preflight_stop)
if exist "%ZG_REPO%\approvals\maintenance-handoffs\%ZG_HANDOFF_TARGET%.json" (
  set "ZG_REASON=APPROVAL_ALREADY_PRESENT_RECHECK"
  goto :preflight_stop
)
>>"%ZG_REPORT%" echo PREFLIGHT=PASS
echo Safety preflight PASS. Applying exact pinned FF, one time only...
>>"%ZG_REPORT%" echo FF_PHASE=PINNED_FF_ATTEMPTED
rem Disable post-merge hooks with a checked-nonexistent per-command hook path.
git -c "core.hooksPath=%ZG_NO_HOOKS%" -C "%ZG_REPO%" merge --ff-only %ZG_TARGET% >>"%ZG_REPORT%" 2>&1
set "ZG_MERGE_RC=%errorlevel%"
>>"%ZG_REPORT%" echo FF_PROCESS_EXIT=%ZG_MERGE_RC%
if not "%ZG_MERGE_RC%"=="0" (
  >>"%ZG_REPORT%" echo OPERATOR_RESULT=STATE_UNKNOWN_AFTER_FF_ATTEMPT
  echo STOP: pinned FF returned nonzero. Preserve the result; do not retry.
  set "ZG_EXIT=94"
  goto :display
)
set "ZG_AFTER="
for /f "delims=" %%H in ('git -C "%ZG_REPO%" rev-parse --verify HEAD 2^>nul') do set "ZG_AFTER=%%H"
>>"%ZG_REPORT%" echo ACTUAL_HEAD_AFTER=%ZG_AFTER%
if /i not "%ZG_AFTER%"=="%ZG_TARGET%" (
  >>"%ZG_REPORT%" echo OPERATOR_RESULT=STATE_UNKNOWN_HEAD_MISMATCH
  echo STOP: FF outcome unverified. Preserve the result; no retry.
  set "ZG_EXIT=95"
  goto :display
)
git -C "%ZG_REPO%" ls-files --error-unmatch -- "approvals/maintenance-handoffs/%ZG_HANDOFF_TARGET%.json" >nul 2>&1
if errorlevel 1 (
  >>"%ZG_REPORT%" echo OPERATOR_RESULT=STATE_UNKNOWN_MANIFEST_NOT_TRACKED
  echo STOP: pinned FF moved HEAD but approval manifest not tracked. Preserve result.
  set "ZG_EXIT=96"
  goto :display
)
if not exist "%ZG_REPO%\approvals\maintenance-handoffs\%ZG_HANDOFF_TARGET%.json" (
  >>"%ZG_REPORT%" echo OPERATOR_RESULT=STATE_UNKNOWN_MANIFEST_ABSENT
  echo STOP: pinned FF moved HEAD but local manifest is absent. Preserve result.
  set "ZG_EXIT=97"
  goto :display
)
>>"%ZG_REPORT%" echo OPERATOR_RESULT=SOURCE_FF_PINNED_PASS
echo Source FF verified at pinned approval commit. No maintainer handoff invoked.
set "ZG_EXIT=0"
goto :display

:preflight_stop
>>"%ZG_REPORT%" echo OPERATOR_RESULT=PREVALIDATION_BLOCKED
>>"%ZG_REPORT%" echo CODE=%ZG_REASON%
>>"%ZG_REPORT%" echo HANDOFF_INVOKED=NO
>>"%ZG_REPORT%" echo SOURCE_FF_ATTEMPTED=NO
echo STOP: %ZG_REASON%. No local Git update attempted. Do not retry automatically.
set "ZG_EXIT=92"
goto :display

:existing_report
echo Previous V2 result exists. It will be displayed without retrying or overwriting.
set "ZG_EXIT=90"
goto :display

:display
echo.
echo ===== ZGMINI 434 PINNED FF V2 RESULT =====
type "%ZG_REPORT%"
echo.
echo The report opens in Notepad. Preserve the result and do not rerun.
start "" notepad.exe "%ZG_REPORT%" >nul 2>&1
pause
exit /b %ZG_EXIT%

:no_temp
echo STOP: User TEMP is unavailable. No source change attempted.
pause
exit /b 91

:write_fail
echo STOP: Unable to create report in TEMP. No source change attempted.
pause
exit /b 91

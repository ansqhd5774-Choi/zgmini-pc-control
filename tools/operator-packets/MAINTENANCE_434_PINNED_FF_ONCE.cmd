@echo off
setlocal EnableExtensions DisableDelayedExpansion
rem #434 approved exact local main fast-forward only: no handoff and no network.
rem This packet never fetches, pulls, checks out another branch, resets or retries.
set "ZG_REPO=E:\ZGmini\projects\zgmini-pc-control"
set "ZG_OLD=91a6e085d69d35164c28cdfb8ff74cc67a6efd3b"
set "ZG_TARGET=14fa522c0b051801f6a12b64d872d7a50532d39e"
set "ZG_ORIGIN_PIN=50b8a54242525754fadb04b2a172ced884052daf"
set "ZG_HANDOFF_TARGET=1d6f66d87c0ff247ba75b4c98682c07c646e79cc"
set "ZG_REPORT=%~dp0ZGMINI_MAINTENANCE_434_PINNED_FF_RESULT.txt"
set "ZG_NO_HOOKS=%ZG_REPO%\__ZGMINI_434_DISABLED_HOOKS_DO_NOT_CREATE__"
set "ZG_REASON="
if exist "%ZG_REPORT%" (
  echo STOP: previous pinned FF result is preserved. Do not retry.
  exit /b 90
)
(
  echo SCHEMA=ZGMINI_MAINTENANCE_434_PINNED_FF_V1
  echo EXPECTED_HEAD_BEFORE=%ZG_OLD%
  echo EXACT_TARGET_HEAD=%ZG_TARGET%
  echo HANDOFF_TARGET_SHA=%ZG_HANDOFF_TARGET%
  echo EXPECTED_CHANGED_FILES=16
  echo HANDOFF_INVOKED=NO
  echo GIT_NETWORK_ATTEMPTED=NO
  echo FF_PHASE=PREVALIDATION
) >"%ZG_REPORT%"
if errorlevel 1 (
  echo STOP: cannot create result TXT. No local Git mutation attempted.
  exit /b 91
)
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
git -C "%ZG_REPO%" rev-parse --is-inside-work-tree | findstr /x /c:"true" >nul
if errorlevel 1 (set "ZG_REASON=INVALID_REPO" & goto :preflight_stop)
git -C "%ZG_REPO%" branch --show-current | findstr /x /c:"main" >nul
if errorlevel 1 (set "ZG_REASON=MAIN_REQUIRED" & goto :preflight_stop)
set "ZG_HEAD="
for /f "delims=" %%H in ('git -C "%ZG_REPO%" rev-parse --verify HEAD 2^>nul') do set "ZG_HEAD=%%H"
if /i not "%ZG_HEAD%"=="%ZG_OLD%" (set "ZG_REASON=HEAD_CHANGED" & goto :preflight_stop)
>>"%ZG_REPORT%" echo ACTUAL_HEAD_BEFORE=%ZG_HEAD%
set "ZG_CACHED="
for /f "delims=" %%H in ('git -C "%ZG_REPO%" rev-parse --verify refs/remotes/origin/main 2^>nul') do set "ZG_CACHED=%%H"
if /i not "%ZG_CACHED%"=="%ZG_ORIGIN_PIN%" (set "ZG_REASON=CACHED_ORIGIN_CHANGED" & goto :preflight_stop)
git -C "%ZG_REPO%" cat-file -t %ZG_TARGET% | findstr /x /c:"commit" >nul
if errorlevel 1 (set "ZG_REASON=TARGET_OBJECT_MISSING" & goto :preflight_stop)
git -C "%ZG_REPO%" merge-base --is-ancestor %ZG_OLD% %ZG_TARGET% >nul 2>&1
if errorlevel 1 (set "ZG_REASON=LOCAL_TARGET_NOT_FF" & goto :preflight_stop)
git -C "%ZG_REPO%" merge-base --is-ancestor %ZG_TARGET% refs/remotes/origin/main >nul 2>&1
if errorlevel 1 (set "ZG_REASON=TARGET_NOT_CACHED_ANCESTOR" & goto :preflight_stop)
rem Check the 16 exactly approved diff paths, without a global dirty gate.
git -c core.optionalLocks=false -C "%ZG_REPO%" status --porcelain -- "AGENTS.md" "approvals/controller-updates/364c59b9d3aa30ee7881cdfcff647ccd3a164d9c.json" "approvals/maintenance-handoffs/1d6f66d87c0ff247ba75b4c98682c07c646e79cc.json" "config/operations.json" "controller/operations.mjs" "controller/r54-sixfile-inventory-readonly.mjs" "controller/release-calendar-runtime-readonly.mjs" "controller/report-upload-verified.mjs" "controller/upload.mjs" "results/42019572689-1-seat-2.json" "results/42019572689-1-seat-2.txt" "tests/maintenance-agent.test.mjs" "tests/r54-sixfile-inventory-readonly.test.mjs" "tests/release-calendar-runtime-readonly.test.mjs" "tests/report-upload-verified.test.mjs" "tools/maintenance-agent.mjs" >nul 2>&1
if errorlevel 1 (set "ZG_REASON=SCOPED_STATUS_ERROR" & goto :preflight_stop)
set "ZG_DIRTY=NO"
for /f "delims=" %%S in ('git -c core.optionalLocks=false -C "%ZG_REPO%" status --porcelain -- "AGENTS.md" "approvals/controller-updates/364c59b9d3aa30ee7881cdfcff647ccd3a164d9c.json" "approvals/maintenance-handoffs/1d6f66d87c0ff247ba75b4c98682c07c646e79cc.json" "config/operations.json" "controller/operations.mjs" "controller/r54-sixfile-inventory-readonly.mjs" "controller/release-calendar-runtime-readonly.mjs" "controller/report-upload-verified.mjs" "controller/upload.mjs" "results/42019572689-1-seat-2.json" "results/42019572689-1-seat-2.txt" "tests/maintenance-agent.test.mjs" "tests/r54-sixfile-inventory-readonly.test.mjs" "tests/release-calendar-runtime-readonly.test.mjs" "tests/report-upload-verified.test.mjs" "tools/maintenance-agent.mjs" 2^>nul') do set "ZG_DIRTY=YES"
if "%ZG_DIRTY%"=="YES" (set "ZG_REASON=APPROVED_PATHS_DIRTY" & goto :preflight_stop)
rem Refuse configured smudge filters on approved paths. No checkout source code execution.
git -C "%ZG_REPO%" check-attr filter -- "AGENTS.md" "approvals/controller-updates/364c59b9d3aa30ee7881cdfcff647ccd3a164d9c.json" "approvals/maintenance-handoffs/1d6f66d87c0ff247ba75b4c98682c07c646e79cc.json" "config/operations.json" "controller/operations.mjs" "controller/r54-sixfile-inventory-readonly.mjs" "controller/release-calendar-runtime-readonly.mjs" "controller/report-upload-verified.mjs" "controller/upload.mjs" "results/42019572689-1-seat-2.json" "results/42019572689-1-seat-2.txt" "tests/maintenance-agent.test.mjs" "tests/r54-sixfile-inventory-readonly.test.mjs" "tests/release-calendar-runtime-readonly.test.mjs" "tests/report-upload-verified.test.mjs" "tools/maintenance-agent.mjs" >nul 2>&1
if errorlevel 1 (set "ZG_REASON=FILTER_CHECK_ERROR" & goto :preflight_stop)
git -C "%ZG_REPO%" check-attr filter -- "AGENTS.md" "approvals/controller-updates/364c59b9d3aa30ee7881cdfcff647ccd3a164d9c.json" "approvals/maintenance-handoffs/1d6f66d87c0ff247ba75b4c98682c07c646e79cc.json" "config/operations.json" "controller/operations.mjs" "controller/r54-sixfile-inventory-readonly.mjs" "controller/release-calendar-runtime-readonly.mjs" "controller/report-upload-verified.mjs" "controller/upload.mjs" "results/42019572689-1-seat-2.json" "results/42019572689-1-seat-2.txt" "tests/maintenance-agent.test.mjs" "tests/r54-sixfile-inventory-readonly.test.mjs" "tests/release-calendar-runtime-readonly.test.mjs" "tests/report-upload-verified.test.mjs" "tools/maintenance-agent.mjs" | findstr /v /c:"filter: unspecified" >nul
if not errorlevel 1 (set "ZG_REASON=FILTER_ASSIGNED" & goto :preflight_stop)
if exist "%ZG_REPO%\approvals\maintenance-handoffs\%ZG_HANDOFF_TARGET%.json" (
  set "ZG_REASON=APPROVAL_ALREADY_PRESENT_RECHECK"
  goto :preflight_stop
)
>>"%ZG_REPORT%" echo PREFLIGHT=PASS
>>"%ZG_REPORT%" echo FF_PHASE=PINNED_FF_ATTEMPTED
rem Disable post-merge hooks with a checked-nonexistent per-command hook path.
git -c "core.hooksPath=%ZG_NO_HOOKS%" -C "%ZG_REPO%" merge --ff-only %ZG_TARGET% >>"%ZG_REPORT%" 2>&1
set "ZG_MERGE_RC=%errorlevel%"
>>"%ZG_REPORT%" echo FF_PROCESS_EXIT=%ZG_MERGE_RC%
if not "%ZG_MERGE_RC%"=="0" (
  >>"%ZG_REPORT%" echo OPERATOR_RESULT=STATE_UNKNOWN_AFTER_FF_ATTEMPT
  echo STOP: pinned FF returned nonzero. Preserve the result; do not retry.
  exit /b 94
)
set "ZG_AFTER="
for /f "delims=" %%H in ('git -C "%ZG_REPO%" rev-parse --verify HEAD 2^>nul') do set "ZG_AFTER=%%H"
>>"%ZG_REPORT%" echo ACTUAL_HEAD_AFTER=%ZG_AFTER%
if /i not "%ZG_AFTER%"=="%ZG_TARGET%" (
  >>"%ZG_REPORT%" echo OPERATOR_RESULT=STATE_UNKNOWN_HEAD_MISMATCH
  echo STOP: FF outcome unverified. Preserve the result; no retry.
  exit /b 95
)
git -C "%ZG_REPO%" ls-files --error-unmatch -- "approvals/maintenance-handoffs/%ZG_HANDOFF_TARGET%.json" >nul 2>&1
if errorlevel 1 (
  >>"%ZG_REPORT%" echo OPERATOR_RESULT=STATE_UNKNOWN_MANIFEST_NOT_TRACKED
  echo STOP: pinned FF moved HEAD but approval manifest not tracked. Preserve result.
  exit /b 96
)
if not exist "%ZG_REPO%\approvals\maintenance-handoffs\%ZG_HANDOFF_TARGET%.json" (
  >>"%ZG_REPORT%" echo OPERATOR_RESULT=STATE_UNKNOWN_MANIFEST_ABSENT
  echo STOP: pinned FF moved HEAD but local manifest is absent. Preserve result.
  exit /b 97
)
>>"%ZG_REPORT%" echo OPERATOR_RESULT=SOURCE_FF_PINNED_PASS
echo Source FF verified at pinned approval commit. No maintainer handoff invoked.
exit /b 0

:preflight_stop
(
  echo OPERATOR_RESULT=PREVALIDATION_BLOCKED
  echo CODE=%ZG_REASON%
  echo HANDOFF_INVOKED=NO
  echo SOURCE_FF_ATTEMPTED=NO
) >>"%ZG_REPORT%"
echo STOP: %ZG_REASON%. No local Git update attempted. Do not retry automatically.
exit /b 92

@echo off
setlocal EnableExtensions DisableDelayedExpansion
rem Read-only checkout probe for the approved #434 Windows-local handoff.
rem No install, no Git fetch/pull/checkout, no retry, no remote URL or secret output.
set "ZG_REPO=E:\ZGmini\projects\zgmini-pc-control"
set "ZG_NODE=E:\ZGmini\runtime\node.exe"
set "ZG_TARGET=1d6f66d87c0ff247ba75b4c98682c07c646e79cc"
set "ZG_REL=approvals/maintenance-handoffs/1d6f66d87c0ff247ba75b4c98682c07c646e79cc.json"
set "ZG_REPORT=%~dp0ZGMINI_MAINTENANCE_434_CHECKOUT_PREFLIGHT.txt"
if exist "%ZG_REPORT%" (
  echo STOP: existing checkout diagnostic is preserved. Do not retry.
  exit /b 90
)
(
  echo SCHEMA=ZGMINI_MAINTENANCE_434_CHECKOUT_PREFLIGHT_V1
  echo TARGET_SHA=%ZG_TARGET%
  echo OPERATION=READONLY_CHECKOUT_DIAGNOSTIC
  echo HANDOFF_INVOKED=NO
  echo SOURCE_UPDATE_ATTEMPTED=NO
) >"%ZG_REPORT%"
if errorlevel 1 (
  echo STOP: diagnostic TXT could not be created. No checkout touched.
  exit /b 91
)
if not exist "%ZG_REPO%\" (
  >>"%ZG_REPORT%" echo CHECKOUT_EXISTS=NO
  goto :preflight_blocked
)
>>"%ZG_REPORT%" echo CHECKOUT_EXISTS=YES
if exist "%ZG_NODE%" (
  >>"%ZG_REPORT%" echo NODE_EXISTS=YES
) else (
  >>"%ZG_REPORT%" echo NODE_EXISTS=NO
)
if exist "%ZG_REPO%\tools\handoff-maintenance.mjs" (
  >>"%ZG_REPORT%" echo HANDOFF_SCRIPT_EXISTS=YES
) else (
  >>"%ZG_REPORT%" echo HANDOFF_SCRIPT_EXISTS=NO
)
if exist "%ZG_REPO%\approvals\maintenance-handoffs\%ZG_TARGET%.json" (
  >>"%ZG_REPORT%" echo APPROVAL_MANIFEST_EXISTS=YES
) else (
  >>"%ZG_REPORT%" echo APPROVAL_MANIFEST_EXISTS=NO
)
where git >nul 2>&1
if errorlevel 1 (
  >>"%ZG_REPORT%" echo GIT_AVAILABLE=NO
  goto :preflight_blocked
)
>>"%ZG_REPORT%" echo GIT_AVAILABLE=YES
git -C "%ZG_REPO%" rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
  >>"%ZG_REPORT%" echo GIT_CHECKOUT_VALID=NO
  goto :preflight_blocked
)
>>"%ZG_REPORT%" echo GIT_CHECKOUT_VALID=YES
>>"%ZG_REPORT%" echo GIT_BRANCH_BEGIN
git -C "%ZG_REPO%" branch --show-current >>"%ZG_REPORT%" 2>nul
set "ZG_BRANCH_RC=%errorlevel%"
>>"%ZG_REPORT%" echo GIT_BRANCH_END
>>"%ZG_REPORT%" echo GIT_BRANCH_EXIT=%ZG_BRANCH_RC%
>>"%ZG_REPORT%" echo GIT_HEAD_BEGIN
git -C "%ZG_REPO%" rev-parse --verify HEAD >>"%ZG_REPORT%" 2>nul
set "ZG_HEAD_RC=%errorlevel%"
>>"%ZG_REPORT%" echo GIT_HEAD_END
>>"%ZG_REPORT%" echo GIT_HEAD_EXIT=%ZG_HEAD_RC%
>>"%ZG_REPORT%" echo GIT_ORIGIN_MAIN_LOCAL_BEGIN
git -C "%ZG_REPO%" rev-parse --verify refs/remotes/origin/main >>"%ZG_REPORT%" 2>nul
set "ZG_ORIGIN_RC=%errorlevel%"
>>"%ZG_REPORT%" echo GIT_ORIGIN_MAIN_LOCAL_END
>>"%ZG_REPORT%" echo GIT_ORIGIN_MAIN_LOCAL_EXIT=%ZG_ORIGIN_RC%
git -C "%ZG_REPO%" ls-files --error-unmatch -- "%ZG_REL%" >nul 2>&1
set "ZG_TRACKED_RC=%errorlevel%"
if "%ZG_TRACKED_RC%"=="0" (
  >>"%ZG_REPORT%" echo APPROVAL_MANIFEST_TRACKED=YES
) else (
  if "%ZG_TRACKED_RC%"=="1" (
    >>"%ZG_REPORT%" echo APPROVAL_MANIFEST_TRACKED=NO
  ) else (
    >>"%ZG_REPORT%" echo APPROVAL_MANIFEST_TRACKED=ERROR_%ZG_TRACKED_RC%
  )
)
git -C "%ZG_REPO%" merge-base --is-ancestor %ZG_TARGET% HEAD >nul 2>&1
set "ZG_ANCESTOR_RC=%errorlevel%"
if "%ZG_ANCESTOR_RC%"=="0" (
  >>"%ZG_REPORT%" echo TARGET_ANCESTOR_OF_HEAD=YES
) else (
  if "%ZG_ANCESTOR_RC%"=="1" (
    >>"%ZG_REPORT%" echo TARGET_ANCESTOR_OF_HEAD=NO
  ) else (
    >>"%ZG_REPORT%" echo TARGET_ANCESTOR_OF_HEAD=ERROR_%ZG_ANCESTOR_RC%
  )
)
>>"%ZG_REPORT%" echo SCOPED_GIT_STATUS_BEGIN
git -c core.optionalLocks=false -C "%ZG_REPO%" status --porcelain -- "%ZG_REL%" "tools/maintenance-contract.mjs" "tools/maintenance-apply.mjs" "tools/maintenance-agent.mjs" "tools/maintenance-lock.mjs" "tools/update.mjs" "tools/maintenance-ancestry.vbs" "tools/bootstrap-maintenance.mjs" "tools/handoff-maintenance.mjs" >>"%ZG_REPORT%" 2>nul
set "ZG_STATUS_RC=%errorlevel%"
>>"%ZG_REPORT%" echo SCOPED_GIT_STATUS_END
>>"%ZG_REPORT%" echo SCOPED_GIT_STATUS_EXIT=%ZG_STATUS_RC%
if not "%ZG_STATUS_RC%"=="0" (
  >>"%ZG_REPORT%" echo OPERATOR_RESULT=READONLY_DIAGNOSTIC_PARTIAL
  echo STOP: checkout status query failed. Preserve the TXT.
  exit /b 93
)
>>"%ZG_REPORT%" echo OPERATOR_RESULT=READONLY_DIAGNOSTIC_COMPLETE
echo Checkout read-only diagnostic complete. Preserve the single TXT.
exit /b 0

:preflight_blocked
>>"%ZG_REPORT%" echo OPERATOR_RESULT=AUTOMATION_BLOCKED
echo STOP: checkout diagnostic could not reach Git readback. Preserve the TXT.
exit /b 92

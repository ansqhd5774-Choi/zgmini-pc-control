@echo off
setlocal EnableExtensions DisableDelayedExpansion
title ZGMINI 434 Local HEAD READONLY R2
rem Read-only diagnostic after missing FF result. Never invoke FF, fetch, pull, checkout, handoff, or install.
set "ZG_REPO=E:\ZGmini\projects\zgmini-pc-control"
set "ZG_OLD=91a6e085d69d35164c28cdfb8ff74cc67a6efd3b"
set "ZG_TARGET=14fa522c0b051801f6a12b64d872d7a50532d39e"
set "ZG_MANIFEST=approvals/maintenance-handoffs/1d6f66d87c0ff247ba75b4c98682c07c646e79cc.json"
echo.
echo ZGMINI 434 - local HEAD read only. Git changes: NONE.
echo The previous pinned FF CMD must NOT be rerun.
if not defined TEMP goto :no_temp
set "ZG_REPORT=%TEMP%\ZGMINI_MAINTENANCE_434_HEAD_READONLY_R2_RESULT.txt"
echo Result location: %ZG_REPORT%
if exist "%ZG_REPORT%" goto :existing
> "%ZG_REPORT%" echo SCHEMA=ZGMINI_MAINTENANCE_434_HEAD_READONLY_R2
if errorlevel 1 goto :write_fail
>>"%ZG_REPORT%" echo OPERATION=LOCAL_HEAD_READONLY
>>"%ZG_REPORT%" echo SOURCE_UPDATE_ATTEMPTED=NO
>>"%ZG_REPORT%" echo HANDOFF_INVOKED=NO
>>"%ZG_REPORT%" echo EXPECTED_BEFORE=%ZG_OLD%
>>"%ZG_REPORT%" echo PINNED_TARGET=%ZG_TARGET%
if not exist "%ZG_REPO%\" goto :missing_repo
where git >nul 2>&1
if errorlevel 1 goto :missing_git
git -C "%ZG_REPO%" rev-parse --is-inside-work-tree | findstr /x /c:"true" >nul
if errorlevel 1 goto :invalid_repo
>>"%ZG_REPORT%" echo GIT_BRANCH_BEGIN
git -C "%ZG_REPO%" branch --show-current >>"%ZG_REPORT%" 2>&1
>>"%ZG_REPORT%" echo GIT_BRANCH_END
set "ZG_HEAD="
for /f "delims=" %%H in ('git -C "%ZG_REPO%" rev-parse --verify HEAD 2^>nul') do set "ZG_HEAD=%%H"
if not defined ZG_HEAD goto :head_failed
>>"%ZG_REPORT%" echo ACTUAL_HEAD=%ZG_HEAD%
set "ZG_CLASS=UNEXPECTED_HEAD"
if /i "%ZG_HEAD%"=="%ZG_OLD%" set "ZG_CLASS=BEFORE_PINNED_FF"
if /i "%ZG_HEAD%"=="%ZG_TARGET%" set "ZG_CLASS=PINNED_SOURCE_PRESENT"
>>"%ZG_REPORT%" echo HEAD_CLASS=%ZG_CLASS%
set "ZG_MANIFEST_EXISTS=NO"
if exist "%ZG_REPO%\approvals\maintenance-handoffs\1d6f66d87c0ff247ba75b4c98682c07c646e79cc.json" set "ZG_MANIFEST_EXISTS=YES"
>>"%ZG_REPORT%" echo APPROVAL_MANIFEST_EXISTS=%ZG_MANIFEST_EXISTS%
git -C "%ZG_REPO%" ls-files --error-unmatch -- "%ZG_MANIFEST%" >nul 2>&1
if errorlevel 1 goto :manifest_not_tracked
>>"%ZG_REPORT%" echo APPROVAL_MANIFEST_TRACKED=YES
goto :done
:manifest_not_tracked
>>"%ZG_REPORT%" echo APPROVAL_MANIFEST_TRACKED=NO
goto :done
:missing_repo
set "ZG_REASON=REPOSITORY_NOT_FOUND"
goto :fail
:missing_git
set "ZG_REASON=GIT_UNAVAILABLE"
goto :fail
:invalid_repo
set "ZG_REASON=NOT_GIT_REPOSITORY"
goto :fail
:head_failed
set "ZG_REASON=HEAD_UNAVAILABLE"
goto :fail
:fail
>>"%ZG_REPORT%" echo OPERATOR_RESULT=READONLY_FAILED
>>"%ZG_REPORT%" echo CODE=%ZG_REASON%
goto :display
:done
>>"%ZG_REPORT%" echo OPERATOR_RESULT=READONLY_COMPLETE
goto :display
:existing
echo Existing R2 result preserved; no new inspection performed.
goto :display
:display
echo.
echo ===== READONLY REPORT =====
type "%ZG_REPORT%"
echo.
echo The result is also opened in Notepad when available.
start "" notepad.exe "%ZG_REPORT%" >nul 2>&1
echo No Git update or maintainer handoff was performed by this tool.
echo Do not rerun the previous pinned FF CMD.
pause
exit /b 0
:no_temp
echo STOP: TEMP path unavailable. No Git change.
pause
exit /b 91
:write_fail
echo STOP: unable to create result in TEMP. No Git change.
pause
exit /b 92

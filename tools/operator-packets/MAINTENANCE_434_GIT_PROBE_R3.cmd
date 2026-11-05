@echo off
setlocal EnableExtensions DisableDelayedExpansion
title ZGMINI 434 Git Read-Only Probe R3
rem Read-only: no fetch/pull/merge/checkout/install/handoff, no E: write.
set "ZG_REPO=E:\ZGmini\projects\zgmini-pc-control"
set "ZG_EXPECTED=91a6e085d69d35164c28cdfb8ff74cc67a6efd3b"
set "ZG_PINNED=14fa522c0b051801f6a12b64d872d7a50532d39e"
echo ZGMINI 434: Git command results will be displayed and retained.
echo Do NOT rerun the original pinned fast-forward CMD.
if not defined TEMP goto :no_temp
set "ZG_OUT=%TEMP%\ZGMINI_MAINTENANCE_434_GIT_PROBE_R3_RESULT.txt"
if exist "%ZG_OUT%" goto :existing
> "%ZG_OUT%" echo SCHEMA=ZGMINI_MAINTENANCE_434_GIT_PROBE_R3
if errorlevel 1 goto :write_fail
>>"%ZG_OUT%" echo OPERATION=READONLY_RAW_GIT_PROBE
>>"%ZG_OUT%" echo SOURCE_UPDATE_ATTEMPTED=NO
>>"%ZG_OUT%" echo HANDOFF_INVOKED=NO
>>"%ZG_OUT%" echo EXPECTED_BEFORE=%ZG_EXPECTED%
>>"%ZG_OUT%" echo PINNED_TARGET=%ZG_PINNED%
if not exist "%ZG_REPO%\" goto :no_repo
>>"%ZG_OUT%" echo REPO_PATH_EXISTS=YES
if exist "%ZG_REPO%\.git" goto :git_marker_yes
>>"%ZG_OUT%" echo DOT_GIT_MARKER_EXISTS=NO
goto :git_marker_done
:git_marker_yes
>>"%ZG_OUT%" echo DOT_GIT_MARKER_EXISTS=YES
:git_marker_done
where git >nul 2>&1
if errorlevel 1 goto :no_git
>>"%ZG_OUT%" echo GIT_AVAILABLE=YES
>>"%ZG_OUT%" echo GIT_VERSION_BEGIN
git --version >>"%ZG_OUT%" 2>&1
>>"%ZG_OUT%" echo GIT_VERSION_END
>>"%ZG_OUT%" echo GIT_WORKTREE_BEGIN
git -c core.optionalLocks=false -C "%ZG_REPO%" rev-parse --is-inside-work-tree >>"%ZG_OUT%" 2>&1
set "ZG_WORKTREE_RC=%errorlevel%"
>>"%ZG_OUT%" echo GIT_WORKTREE_EXIT=%ZG_WORKTREE_RC%
>>"%ZG_OUT%" echo GIT_WORKTREE_END
>>"%ZG_OUT%" echo GIT_TOPLEVEL_BEGIN
git -c core.optionalLocks=false -C "%ZG_REPO%" rev-parse --show-toplevel >>"%ZG_OUT%" 2>&1
set "ZG_TOPLEVEL_RC=%errorlevel%"
>>"%ZG_OUT%" echo GIT_TOPLEVEL_EXIT=%ZG_TOPLEVEL_RC%
>>"%ZG_OUT%" echo GIT_TOPLEVEL_END
>>"%ZG_OUT%" echo GIT_BRANCH_BEGIN
git -c core.optionalLocks=false -C "%ZG_REPO%" branch --show-current >>"%ZG_OUT%" 2>&1
set "ZG_BRANCH_RC=%errorlevel%"
>>"%ZG_OUT%" echo GIT_BRANCH_EXIT=%ZG_BRANCH_RC%
>>"%ZG_OUT%" echo GIT_BRANCH_END
>>"%ZG_OUT%" echo GIT_HEAD_BEGIN
git -c core.optionalLocks=false -C "%ZG_REPO%" rev-parse --verify HEAD >>"%ZG_OUT%" 2>&1
set "ZG_HEAD_RC=%errorlevel%"
>>"%ZG_OUT%" echo GIT_HEAD_EXIT=%ZG_HEAD_RC%
>>"%ZG_OUT%" echo GIT_HEAD_END
if exist "%ZG_REPO%\approvals\maintenance-handoffs\1d6f66d87c0ff247ba75b4c98682c07c646e79cc.json" goto :manifest_yes
>>"%ZG_OUT%" echo APPROVAL_MANIFEST_EXISTS=NO
goto :done
:manifest_yes
>>"%ZG_OUT%" echo APPROVAL_MANIFEST_EXISTS=YES
git -c core.optionalLocks=false -C "%ZG_REPO%" ls-files --error-unmatch -- "approvals/maintenance-handoffs/1d6f66d87c0ff247ba75b4c98682c07c646e79cc.json" >nul 2>&1
if errorlevel 1 goto :manifest_untracked
>>"%ZG_OUT%" echo APPROVAL_MANIFEST_TRACKED=YES
goto :done
:manifest_untracked
>>"%ZG_OUT%" echo APPROVAL_MANIFEST_TRACKED=NO
goto :done
:no_repo
>>"%ZG_OUT%" echo REPO_PATH_EXISTS=NO
goto :done
:no_git
>>"%ZG_OUT%" echo GIT_AVAILABLE=NO
goto :done
:done
>>"%ZG_OUT%" echo OPERATOR_RESULT=READONLY_PROBE_COMPLETE
goto :display
:existing
echo Existing R3 report found. No new probe performed.
goto :display
:display
echo.
echo ===== ZGMINI 434 READ-ONLY RESULT =====
type "%ZG_OUT%"
echo.
echo A copy opens in Notepad. This window stays open until a key is pressed.
start "" notepad.exe "%ZG_OUT%" >nul 2>&1
echo No Git mutation, update, or maintainer handoff was attempted.
pause
exit /b 0
:no_temp
echo STOP: user TEMP is unavailable. Nothing changed.
pause
exit /b 91
:write_fail
echo STOP: result TXT could not be created. Nothing changed.
pause
exit /b 92

@echo off
setlocal EnableExtensions DisableDelayedExpansion
REM #996 native two-process fixed-name fencing race, synthetic TEMP only.
REM Use ONLY on the separate isolated Windows PC. Never on original E:\ZGmini.
set "ZGMINI_C_FENCE_PARENT=%~dp0TEST_996_WINDOWS_C_CONCURRENT_FENCE_NATIVE_ONCE.ps1"
set "ZGMINI_C_FENCE_WORKER=%~dp0INVOKE_996_WINDOWS_C_CONCURRENT_FENCE_WORKER_TEST.ps1"
set "ZGMINI_C_FENCE_POWERSHELL=C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe"
if exist "E:\ZGmini\" (
  echo BLOCKED: ORIGINAL_ZGMINI_PRESENT
  pause
  exit /b 2
)
if not exist "%ZGMINI_C_FENCE_PARENT%" (
  echo BLOCKED: PINNED_PARENT_SCRIPT_MISSING
  pause
  exit /b 2
)
if not exist "%ZGMINI_C_FENCE_WORKER%" (
  echo BLOCKED: PINNED_WORKER_SCRIPT_MISSING
  pause
  exit /b 2
)
if not exist "%ZGMINI_C_FENCE_POWERSHELL%" (
  echo BLOCKED: WINDOWS_POWERSHELL_NOT_FOUND
  pause
  exit /b 2
)
REM BOTH executable PS1 files must match the reviewed SHA256 source.
REM Remove Internet download Zone.Identifier ONLY from these TWO PINNED files
REM after their hashes match. Rehash them before launch. This does not alter
REM Windows ExecutionPolicy, and does not use an ExecutionPolicy bypass.
"%ZGMINI_C_FENCE_POWERSHELL%" -NoProfile -NonInteractive -Command "try { if ((Get-FileHash -LiteralPath $env:ZGMINI_C_FENCE_PARENT -Algorithm SHA256).Hash -ne '470c68479a2813f9f27ba68b49e2bbfdc2b463abb39e840948b0ac49dbec03d9') { exit 2 }; if ((Get-FileHash -LiteralPath $env:ZGMINI_C_FENCE_WORKER -Algorithm SHA256).Hash -ne '62b3e1ff821028c0af5304640bb3505e782ed7263d95070dac1cba972bffd180') { exit 2 }; Unblock-File -LiteralPath $env:ZGMINI_C_FENCE_PARENT -ErrorAction Stop; Unblock-File -LiteralPath $env:ZGMINI_C_FENCE_WORKER -ErrorAction Stop; if ((Get-FileHash -LiteralPath $env:ZGMINI_C_FENCE_PARENT -Algorithm SHA256).Hash -ne '470c68479a2813f9f27ba68b49e2bbfdc2b463abb39e840948b0ac49dbec03d9') { exit 2 }; if ((Get-FileHash -LiteralPath $env:ZGMINI_C_FENCE_WORKER -Algorithm SHA256).Hash -ne '62b3e1ff821028c0af5304640bb3505e782ed7263d95070dac1cba972bffd180') { exit 2 }; exit 0 } catch { exit 2 }"
if errorlevel 1 (
  echo BLOCKED: PINNED_TWO_SCRIPT_SHA256_MISMATCH
  pause
  exit /b 2
)
echo #996 ISOLATED WINDOWS C TWO-PROCESS FIXED FENCE RACE RESULT:
"%ZGMINI_C_FENCE_POWERSHELL%" -NoProfile -NonInteractive -File "%ZGMINI_C_FENCE_PARENT%" -TestOnly
set "ZGMINI_C_FENCE_EXIT=%ERRORLEVEL%"
if not "%ZGMINI_C_FENCE_EXIT%"=="0" echo TEST STOPPED. DO NOT BYPASS EXECUTION POLICY.
echo Preserve this console and synthetic TEMP fixture for ZGMINI coordinator.
pause
exit /b %ZGMINI_C_FENCE_EXIT%

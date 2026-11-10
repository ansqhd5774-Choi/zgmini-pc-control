@echo off
setlocal EnableExtensions DisableDelayedExpansion
REM #996 ORIGINAL Windows 84-Git-byte READ-ONLY R4. NOT a C recovery.
REM NO workflow PUT, PC install, claim/lease move, backlog write or Issue post.
REM Only extract its five-file sealed ZIP to a NEW folder outside E:\ZGmini.
REM NEVER run RUN_996_NATIVE_C_ONCE.cmd again.
set "ZGMINI_NODE=E:\ZGmini\runtime\node.exe"
set "ZGMINI_CLI=%~dp0controller-996-git-source-readonly-cli-r4.mjs"
set "ZGMINI_POWERSHELL=C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe"
if not exist "%ZGMINI_NODE%" (
  echo BLOCKED: ORIGINAL_NODE_NOT_FOUND
  pause
  exit /b 2
)
if not exist "%ZGMINI_CLI%" (
  echo BLOCKED: R4_CLI_NOT_FOUND
  pause
  exit /b 2
)
if not exist "%ZGMINI_POWERSHELL%" (
  echo BLOCKED: WINDOWS_POWERSHELL_NOT_FOUND
  pause
  exit /b 2
)
REM The CLI authenticates its LOCK and SOURCE bytes before dynamic import.
"%ZGMINI_POWERSHELL%" -NoProfile -NonInteractive -Command "try { if ((Get-FileHash -LiteralPath $env:ZGMINI_CLI -Algorithm SHA256).Hash -ne 'b0f6b834ab82f76e355a1879352d445dfdc7fc6520f7a1d36aed4760c010c4f6') { exit 2 }; exit 0 } catch { exit 2 }"
if errorlevel 1 (
  echo BLOCKED: R4_CLI_SHA256_MISMATCH_OR_UNREADABLE
  pause
  exit /b 2
)
echo #996 ORIGINAL WINDOWS 84-GIT-BYTE READ-ONLY R4 RESULT:
"%ZGMINI_NODE%" "%ZGMINI_CLI%"
set "ZGMINI_R4_EXIT=%ERRORLEVEL%"
if not "%ZGMINI_R4_EXIT%"=="0" echo R4 READ-ONLY BLOCKED. DO NOT RE-RUN WITHOUT REVIEW.
echo Preserve this window and show result to ZGMINI coordinator.
pause
exit /b %ZGMINI_R4_EXIT%

@echo off
setlocal EnableExtensions DisableDelayedExpansion
REM #996 original operating Windows only. One explicit interactive C approval.
REM No GitHub Actions or runner route, no source installation, no retry.
REM Trusted distribution MUST separately pin this CMD and all package bytes.
set "ZGMINI_996_NODE=E:\ZGmini\runtime\node.exe"
set "ZGMINI_996_SCRIPT=%~dp0controller-996-native-cli.mjs"
REM SHA256 of the final CLI bytes, including immutable source-lock SHA.
set "ZGMINI_996_CLI_EXPECTED_SHA256=1fd97d387bac2814fafd8916ed7d07c21d04d0c4facc6ad767bb21817e2cf056"
if not "%GITHUB_ACTIONS%"=="" goto :blocked_runner
if not "%RUNNER_NAME%"=="" goto :blocked_runner
if not exist "%ZGMINI_996_NODE%" goto :blocked_node
if not exist "%ZGMINI_996_SCRIPT%" goto :blocked_script
if not exist "E:\ZGmini\automation\pc-maintenance\MAINTENANCE_INSTALL.json" goto :blocked_root
REM Check the CLI before Node can parse/load it. Use the Windows system
REM PowerShell binary, not a PATH-resolved executable or a package helper.
if not exist "C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe" goto :blocked_hasher
REM Invoke PowerShell directly, avoiding nested cmd.exe quoting. The
REM comparison is entirely inside PowerShell and its process exit status is
REM the sole input to the fail-closed CMD gate.
"C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -Command "try { $actual=(Get-FileHash -Algorithm SHA256 -LiteralPath $env:ZGMINI_996_SCRIPT -ErrorAction Stop).Hash; if ($actual -ieq $env:ZGMINI_996_CLI_EXPECTED_SHA256) { exit 0 } else { exit 1 } } catch { exit 2 }"
if errorlevel 1 goto :blocked_cli_integrity
REM Remove all Node preloader-related command flags from this one-shot shell.
set "NODE_OPTIONS="
set "NODE_PATH="
"%ZGMINI_996_NODE%" "%ZGMINI_996_SCRIPT%"
set "ZGMINI_996_EXIT=%ERRORLEVEL%"
echo.
if not "%ZGMINI_996_EXIT%"=="0" (
  echo #996 stopped or outcome uncertain. DO NOT RE-RUN.
  echo Inspect the claim, original lease, Workflow and backlog READ-ONLY.
) else (
  echo #996 CLI finished. Confirm actual status in the JSON above.
)
pause
exit /b %ZGMINI_996_EXIT%
:blocked_runner
echo BLOCKED: GITHUB_ACTIONS_OR_RUNNER_NOT_ALLOWED
goto :blocked_exit
:blocked_node
echo BLOCKED: ORIGINAL_NODE_NOT_FOUND
goto :blocked_exit
:blocked_script
echo BLOCKED: C_CLI_SOURCE_NOT_FOUND
goto :blocked_exit
:blocked_root
echo BLOCKED: ORIGINAL_MAINTAINER_NOT_FOUND
goto :blocked_exit
:blocked_hasher
echo BLOCKED: WINDOWS_SYSTEM_SHA256_VERIFIER_NOT_FOUND
goto :blocked_exit
:blocked_cli_integrity
echo BLOCKED: C_CLI_SHA256_MISMATCH_OR_UNREADABLE
goto :blocked_exit
:blocked_exit
echo No C operation attempted. Source/original PC review required.
pause
exit /b 2

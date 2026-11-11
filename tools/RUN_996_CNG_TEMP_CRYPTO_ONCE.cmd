@echo off
setlocal EnableExtensions DisableDelayedExpansion
rem #996 CNG test-only: never invokes a C operator or uses original PC files.
rem Run ONLY on the separate common queue PC with VS 2026 C++ SDK installed.
if /I not "%COMPUTERNAME%"=="DESKTOP-N62L0NG" goto :wrong_pc
if exist "E:\ZGmini" goto :wrong_pc
set "C996_TEST_TEMP=%TEMP%"
if /I not "%C996_TEST_TEMP:~0,3%"=="C:\" goto :wrong_temp
set "C996_TEST_ROOT=%~dp0..\"
if not exist "%C996_TEST_ROOT%\tests\c996_cng_test_vectors.h" goto :missing_source
if not exist "%C996_TEST_ROOT%\tests\controller-996-cng-windows-temp-harness.c" goto :missing_source
if not exist "%C996_TEST_ROOT%\tools\controller-996-winpe-cng-handoff-verify.c" goto :missing_source
set "C996_VSDEVCMD=C:\Program Files\Microsoft Visual Studio\18\Community\Common7\Tools\VsDevCmd.bat"
if not exist "%C996_VSDEVCMD%" goto :missing_sdk
call "%C996_VSDEVCMD%" -arch=x64 -host_arch=x64
if errorlevel 1 goto :missing_sdk
where cl.exe >nul 2>&1
if errorlevel 1 goto :missing_sdk
set "C996_OUTPUT=%C996_TEST_TEMP%\zgmini-996-cng-test-%RANDOM%-%RANDOM%"
if exist "%C996_OUTPUT%" goto :output_collision
mkdir "%C996_OUTPUT%"
if errorlevel 1 goto :output_collision
pushd "%C996_OUTPUT%"
if errorlevel 1 goto :output_collision
cl /nologo /W3 /WX /TC /O2 /DC996_CNG_WINDOWS_TEMP_TEST_ONLY=1 /Fe:"%C996_OUTPUT%\c996_cng_temp.exe" "%C996_TEST_ROOT%\tests\controller-996-cng-windows-temp-harness.c" /link bcrypt.lib >"%C996_OUTPUT%\build.txt" 2>&1
if errorlevel 1 goto :compile_failed
"%C996_OUTPUT%\c996_cng_temp.exe" >"%C996_OUTPUT%\result.txt" 2>&1
if errorlevel 1 goto :native_failed
type "%C996_OUTPUT%\result.txt"
echo C996_CNG_TEMP_EVIDENCE_PATH: %C996_OUTPUT%
echo Only C: TEMP crypto fixture was executed. Original PC and E: unchanged.
popd
pause
exit /b 0
:compile_failed
type "%C996_OUTPUT%\build.txt"
echo STOP:C996_CNG_MSVC_COMPILE_FAILED
goto :retain_evidence
:native_failed
type "%C996_OUTPUT%\result.txt"
echo STOP:C996_CNG_NATIVE_CRYPTO_FAILED
goto :retain_evidence
:retain_evidence
echo Preserve C: TEMP evidence. Do NOT retry or clean up automatically.
echo C996_CNG_TEMP_EVIDENCE_PATH: %C996_OUTPUT%
popd
pause
exit /b 1
:wrong_pc
echo STOP:C996_CNG_UNAPPROVED_PC_OR_ORIGINAL_E_PRESENT
pause
exit /b 1
:wrong_temp
echo STOP:C996_CNG_TEMP_MUST_BE_C_DRIVE
pause
exit /b 1
:missing_source
echo STOP:C996_CNG_BUNDLE_INCOMPLETE
pause
exit /b 1
:missing_sdk
echo STOP:C996_CNG_VS2026_X64_TOOLS_MISSING
pause
exit /b 1
:output_collision
echo STOP:C996_CNG_TEMP_CREATE_FAILED_OR_COLLISION
pause
exit /b 1

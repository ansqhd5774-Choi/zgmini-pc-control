@echo off
setlocal EnableExtensions DisableDelayedExpansion
rem Build only. Never runs the EXE or mounts/customizes a WinPE image.
if /I not "%COMPUTERNAME%"=="DESKTOP-N62L0NG" exit /b 10
set "C996_TEMP=%TEMP%"
if /I not "%C996_TEMP:~0,3%"=="C:\" exit /b 11
set "C996_SOURCE=%~dp0.."
set "C996_VSWHERE=%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe"
if not exist "%C996_VSWHERE%" exit /b 12
set "C996_VSROOT="
for /f "tokens=*" %%I in ('call "%C996_VSWHERE%" -latest -products * -version "[18.0,19.0)" -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath') do set "C996_VSROOT=%%I"
if not defined C996_VSROOT exit /b 13
call "%C996_VSROOT%\Common7\Tools\VsDevCmd.bat" -arch=x64 -host_arch=x64
if errorlevel 1 exit /b 14
set "C996_OUTPUT=%C996_TEMP%\zgmini-996-winpe-cng-build-%RANDOM%-%RANDOM%"
if exist "%C996_OUTPUT%" exit /b 15
mkdir "%C996_OUTPUT%"
if errorlevel 1 exit /b 16
pushd "%C996_OUTPUT%"
if errorlevel 1 exit /b 17
cl.exe /nologo /W4 /WX /TC /O2 /MT /GS /guard:cf /DC996_WINPE_CNG_TEST_ONLY=1 /D_WIN32_WINNT=0x0A00 /Fe:"%C996_OUTPUT%\c996_winpe_cng_test.exe" "%C996_SOURCE%\tools\controller-996-winpe-cng-test.c" /link /MACHINE:X64 /SUBSYSTEM:CONSOLE /DYNAMICBASE /NXCOMPAT /INCREMENTAL:NO bcrypt.lib advapi32.lib > "%C996_OUTPUT%\build.txt" 2>&1
set "C996_RC=%ERRORLEVEL%"
if not "%C996_RC%"=="0" goto failed
dumpbin.exe /dependents "%C996_OUTPUT%\c996_winpe_cng_test.exe" > "%C996_OUTPUT%\dependents.txt" 2>&1
set "C996_RC=%ERRORLEVEL%"
if not "%C996_RC%"=="0" goto failed
dumpbin.exe /imports "%C996_OUTPUT%\c996_winpe_cng_test.exe" > "%C996_OUTPUT%\imports.txt" 2>&1
set "C996_RC=%ERRORLEVEL%"
if not "%C996_RC%"=="0" goto failed
dumpbin.exe /headers "%C996_OUTPUT%\c996_winpe_cng_test.exe" > "%C996_OUTPUT%\headers.txt" 2>&1
set "C996_RC=%ERRORLEVEL%"
if not "%C996_RC%"=="0" goto failed
certutil.exe -hashfile "%C996_OUTPUT%\c996_winpe_cng_test.exe" SHA256 > "%C996_OUTPUT%\sha256.txt" 2>&1
set "C996_RC=%ERRORLEVEL%"
if not "%C996_RC%"=="0" goto failed
echo BUILD_ONLY=PASS> "%C996_OUTPUT%\result.txt"
echo WINPE_RUNTIME=NOT_RUN>> "%C996_OUTPUT%\result.txt"
type "%C996_OUTPUT%\build.txt"
type "%C996_OUTPUT%\dependents.txt"
type "%C996_OUTPUT%\sha256.txt"
echo C996_BUILD_OUTPUT=%C996_OUTPUT%
popd
exit /b 0
:failed
echo FIRST_FAILURE_CODE=%C996_RC%> "%C996_OUTPUT%\result.txt"
type "%C996_OUTPUT%\build.txt"
echo STOP. Do not retry automatically. C996_BUILD_OUTPUT=%C996_OUTPUT%
popd
exit /b %C996_RC%

@echo off
setlocal DisableDelayedExpansion
if /I not "%COMPUTERNAME%"=="DESKTOP-N62L0NG" (
  echo C996_READONLY STOPPED code=WRONG_HOST
  exit /b 20
)
where node.exe >nul 2>&1
if errorlevel 1 (
  echo C996_READONLY STOPPED code=NODE_NOT_FOUND
  exit /b 21
)
node "%~dp0c996-r5-evidence-readonly.mjs"
set "RC=%ERRORLEVEL%"
echo C996_READONLY exit=%RC%
exit /b %RC%

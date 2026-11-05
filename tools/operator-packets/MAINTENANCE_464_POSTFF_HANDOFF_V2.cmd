@echo off
setlocal EnableExtensions DisableDelayedExpansion
title ZGMINI Maintainer 464 - post-FF operator handoff V2
rem V2 is a NEW bounded post-FF operation; do not rerun or rename the V1 packet.
rem No Git fetch, merge, pull, checkout, reset or shell-based repair is performed.
set "ZG_REPO=E:\ZGmini\projects\zgmini-pc-control"
set "ZG_NODE=E:\ZGmini\runtime\node.exe"
set "ZG_MAIN_PIN=2e326a9a5a4556749f53baaf72c0d4cbf3e4728f"
set "ZG_TARGET=4f076a0228f8ba9598e85b7d0f64f161b6b7c8a4"
set "ZG_INSTALLED=1d6f66d87c0ff247ba75b4c98682c07c646e79cc"
set "ZG_REASON=NOT_STARTED"
set "ZG_EXIT=90"
set "ZG_HANDOFF=NO"
if not defined TEMP goto :no_temp
set "ZG_REPORT=%TEMP%\ZGMINI_MAINTENANCE_464_POSTFF_V2_RESULT.txt"
set "ZG_SCOPE=%TEMP%\ZGMINI_MAINTENANCE_464_POSTFF_V2_SCOPE.tmp"
if exist "%ZG_REPORT%" goto :existing
>"%ZG_REPORT%" echo SCHEMA=ZGMINI_MAINTENANCE_464_POSTFF_OPERATOR_V2
if errorlevel 1 goto :write_failed
>>"%ZG_REPORT%" echo MAIN_PIN=%ZG_MAIN_PIN%
>>"%ZG_REPORT%" echo MAINTENANCE_TARGET=%ZG_TARGET%
>>"%ZG_REPORT%" echo EXPECTED_INSTALLED_SHA=%ZG_INSTALLED%
>>"%ZG_REPORT%" echo GIT_NETWORK_ATTEMPTED=NO
>>"%ZG_REPORT%" echo SOURCE_FF_ATTEMPTED=NO
>>"%ZG_REPORT%" echo PHASE=PREVALIDATION
if defined GITHUB_ACTIONS (set "ZG_REASON=RUNNER_CONTEXT_FORBIDDEN" & goto :stop)
if defined RUNNER_NAME (set "ZG_REASON=RUNNER_CONTEXT_FORBIDDEN" & goto :stop)
if not exist "%ZG_REPO%\" (set "ZG_REASON=REPOSITORY_PATH_MISSING" & goto :stop)
if not exist "%ZG_NODE%" (set "ZG_REASON=NODE_MISSING" & goto :stop)
if exist "E:\ZGmini\automation\pc-maintenance\leases\controller-install" (set "ZG_REASON=CONTROLLER_INSTALL_ACTIVE" & goto :stop)
where git >nul 2>nul
if errorlevel 1 (set "ZG_REASON=GIT_UNAVAILABLE" & goto :stop)
rem Verify the old installed receiver state and six raw installed file hashes first.
"%ZG_NODE%" -e "try{const f=require('node:fs'),c=require('node:child_process'),h=require('node:crypto');const r='E:/ZGmini/automation/pc-maintenance/';const p=JSON.parse(f.readFileSync(r+'MAINTENANCE_INSTALL.json','utf8'));const n=['tools/maintenance-contract.mjs','tools/maintenance-apply.mjs','tools/maintenance-agent.mjs','tools/maintenance-lock.mjs','tools/update.mjs','tools/maintenance-ancestry.vbs'];const ok=n.every(x=>h.createHash('sha256').update(f.readFileSync(r+x)).digest('hex')===p.files?.[x]);const g=c.execFileSync('C:/Windows/System32/whoami.exe',['/groups'],{encoding:'utf8',windowsHide:true});process.exit(p.sourceSha==='%ZG_INSTALLED%'&&ok&&!f.existsSync(r+'leases/controller-install')&&g.includes('S-1-16-8192')&&!g.includes('S-1-16-12288')?0:1)}catch{process.exit(1)}" >nul 2>nul
if errorlevel 1 (set "ZG_REASON=INSTALLED_SHA_HASH_LOCK_OR_USER_TOKEN_MISMATCH" & goto :stop)
rem Confirm the canonical main checkout and fixed official origin without printing URLs.
"%ZG_NODE%" -e "try{const c=require('node:child_process'),p=require('node:path'),r=process.argv[1],run=a=>c.execFileSync('git',['-C',r,...a],{encoding:'utf8',windowsHide:true}).trim();const top=run(['rev-parse','--show-toplevel']),b=run(['branch','--show-current']),u=run(['remote','get-url','origin']);const ok=/^(https:\/\/(?:[^\/@]+@)?github\.com\/ansqhd5774-Choi\/zgmini-pc-control(?:\.git)?|git@github\.com:ansqhd5774-Choi\/zgmini-pc-control(?:\.git)?|ssh:\/\/git@github\.com\/ansqhd5774-Choi\/zgmini-pc-control(?:\.git)?)$/i.test(u);process.exit(p.win32.normalize(top).toLowerCase()===p.win32.normalize(r).toLowerCase()&&b==='main'&&ok?0:1)}catch{process.exit(1)}" "%ZG_REPO%" >nul 2>nul
if errorlevel 1 (set "ZG_REASON=REPO_MAIN_OR_ORIGIN_INVALID" & goto :stop)
git -C "%ZG_REPO%" merge-base --is-ancestor %ZG_MAIN_PIN% HEAD >nul 2>nul
if errorlevel 1 (set "ZG_REASON=PINNED_MAIN_NOT_YET_APPLIED_OR_DIVERGED" & goto :stop)
git -C "%ZG_REPO%" merge-base --is-ancestor %ZG_TARGET% HEAD >nul 2>nul
if errorlevel 1 (set "ZG_REASON=MAINTENANCE_TARGET_NOT_IN_LOCAL_HISTORY" & goto :stop)
for /f "delims=" %%H in ('git -C "%ZG_REPO%" rev-parse --verify HEAD 2^>nul') do set "ZG_HEAD=%%H"
>>"%ZG_REPORT%" echo ACTUAL_LOCAL_HEAD=%ZG_HEAD%
call :scope_clean
if errorlevel 1 (set "ZG_REASON=APPROVED_PATHS_DIRTY_OR_STATUS_FAILED" & goto :stop)
if not exist "%ZG_REPO%\approvals\maintenance-handoffs\%ZG_TARGET%.json" (set "ZG_REASON=APPROVAL_MANIFEST_MISSING" & goto :stop)
>>"%ZG_REPORT%" echo PHASE=EXACT_MANIFEST_AND_SOURCE_VALIDATION
rem Only JSON CRLF->LF conversion may match the original approved Git blob.
rem All eight executable/script source files remain strict raw-byte SHA-256 pinned.
"%ZG_NODE%" -e "try{const f=require('node:fs'),c=require('node:child_process'),h=require('node:crypto'),p=require('node:path'),r=process.argv[1],mp='approvals/maintenance-handoffs/%ZG_TARGET%.json';const show=(rev,n)=>c.execFileSync('git',['-C',r,'show',rev+':'+n],{windowsHide:true,maxBuffer:3000000});const raw=f.readFileSync(p.join(r,mp)),pin=show('%ZG_MAIN_PIN%',mp),norm=Buffer.from(raw.toString('utf8').replace(/\r\n/g,'\n'),'utf8');if(!raw.equals(pin)&&!norm.equals(pin))process.exit(21);const a=JSON.parse(raw);if(a.schema!=='ZGMINI_MAINTENANCE_HANDOFF_V1'||a.approved!==true||a.targetSha!=='%ZG_TARGET%'||a.installedSha!=='%ZG_INSTALLED%')process.exit(22);const n=['tools/maintenance-contract.mjs','tools/maintenance-apply.mjs','tools/maintenance-agent.mjs','tools/maintenance-lock.mjs','tools/update.mjs','tools/maintenance-ancestry.vbs','tools/bootstrap-maintenance.mjs','tools/handoff-maintenance.mjs'],sha=x=>h.createHash('sha256').update(x).digest('hex');if(!n.every(x=>sha(show('%ZG_TARGET%',x))===a.files?.[x]))process.exit(23);if(!n.every(x=>sha(f.readFileSync(p.join(r,x)))===a.files?.[x]))process.exit(24);process.stdout.write('MANIFEST_EOL_NORMALIZED='+(!raw.equals(pin))+'\n');process.exit(0)}catch{process.exit(25)}" "%ZG_REPO%" >>"%ZG_REPORT%" 2>nul
set "ZG_VALIDATE_RC=%errorlevel%"
if "%ZG_VALIDATE_RC%"=="21" (set "ZG_REASON=MANIFEST_PINNED_CONTENT_DRIFT" & goto :stop)
if "%ZG_VALIDATE_RC%"=="22" (set "ZG_REASON=MANIFEST_SCHEMA_OR_APPROVAL_DRIFT" & goto :stop)
if "%ZG_VALIDATE_RC%"=="23" (set "ZG_REASON=TARGET_RAW_HASH_MISMATCH" & goto :stop)
if "%ZG_VALIDATE_RC%"=="24" (set "ZG_REASON=CHECKOUT_RAW_HASH_MISMATCH" & goto :stop)
if not "%ZG_VALIDATE_RC%"=="0" (set "ZG_REASON=MANIFEST_OR_SOURCE_READ_ERROR" & goto :stop)
>>"%ZG_REPORT%" echo PREVALIDATION=PASS
>>"%ZG_REPORT%" echo PHASE=HANDOFF_INVOCATION_ATTEMPTED
set "ZG_HANDOFF=YES"
"%ZG_NODE%" "%ZG_REPO%\tools\handoff-maintenance.mjs" --source-sha %ZG_TARGET% >>"%ZG_REPORT%" 2>nul
set "ZG_EXIT=%errorlevel%"
if not "%ZG_EXIT%"=="0" (set "ZG_REASON=HANDOFF_NONPASS_NO_RETRY" & goto :stop)
>>"%ZG_REPORT%" echo OPERATOR_RESULT=HANDOFF_HELPER_PASS
set "ZG_EXIT=0"
goto :display
:scope_clean
git -c core.optionalLocks=false -C "%ZG_REPO%" status --porcelain -- "tools/maintenance-contract.mjs" "tools/maintenance-apply.mjs" "tools/maintenance-agent.mjs" "tools/maintenance-lock.mjs" "tools/update.mjs" "tools/maintenance-ancestry.vbs" "tools/bootstrap-maintenance.mjs" "tools/handoff-maintenance.mjs" "approvals/maintenance-handoffs/%ZG_TARGET%.json" >"%ZG_SCOPE%" 2>nul
if errorlevel 1 exit /b 1
for %%F in ("%ZG_SCOPE%") do if %%~zF GTR 0 exit /b 1
exit /b 0
:stop
>>"%ZG_REPORT%" echo OPERATOR_RESULT=STOP_NO_RETRY
>>"%ZG_REPORT%" echo CODE=%ZG_REASON%
>>"%ZG_REPORT%" echo HANDOFF_INVOKED=%ZG_HANDOFF%
echo STOP: %ZG_REASON%. Preserve output; do not rerun.
set "ZG_EXIT=92"
goto :display
:existing
echo Prior V2 result exists. No handoff invocation.
set "ZG_EXIT=93"
goto :display
:display
echo.
echo ===== ZGMINI MAINTENANCE 464 POSTFF V2 RESULT =====
type "%ZG_REPORT%"
echo.
echo RESULT_FILE=%ZG_REPORT%
start "" notepad.exe "%ZG_REPORT%" >nul 2>nul
pause
exit /b %ZG_EXIT%
:no_temp
echo STOP: TEMP not available. No operation attempted.
pause
exit /b 94
:write_failed
echo STOP: Cannot write result. No operation attempted.
pause
exit /b 95

@echo off
setlocal EnableExtensions DisableDelayedExpansion
title ZGMINI Maintainer 464 - pinned one-time operator handoff
rem Operator-only. Fixed GitHub source pin, approved one-file maintainer change.
rem Never use on a Runner or elevated/admin shell. No reset/clean/checkout/retry.
set "ZG_REPO=E:\ZGmini\projects\zgmini-pc-control"
set "ZG_NODE=E:\ZGmini\runtime\node.exe"
set "ZG_MAIN_PIN=2e326a9a5a4556749f53baaf72c0d4cbf3e4728f"
set "ZG_TARGET=4f076a0228f8ba9598e85b7d0f64f161b6b7c8a4"
set "ZG_INSTALLED=1d6f66d87c0ff247ba75b4c98682c07c646e79cc"
set "ZG_REASON=NOT_STARTED"
set "ZG_EXIT=90"
set "ZG_HANDOFF=NO"
set "ZG_FF=NO"
if not defined TEMP goto :no_temp
set "ZG_REPORT=%TEMP%\ZGMINI_MAINTENANCE_464_ONECLICK_RESULT.txt"
set "ZG_SCOPE=%TEMP%\ZGMINI_MAINTENANCE_464_SCOPE.tmp"
if exist "%ZG_REPORT%" goto :existing
>"%ZG_REPORT%" echo SCHEMA=ZGMINI_MAINTENANCE_464_ONECLICK_V1
if errorlevel 1 goto :write_failed
>>"%ZG_REPORT%" echo MAIN_PIN=%ZG_MAIN_PIN%
>>"%ZG_REPORT%" echo MAINTENANCE_TARGET=%ZG_TARGET%
>>"%ZG_REPORT%" echo EXPECTED_INSTALLED_SHA=%ZG_INSTALLED%
>>"%ZG_REPORT%" echo PHASE=PREVALIDATION
if defined GITHUB_ACTIONS (set "ZG_REASON=RUNNER_CONTEXT_FORBIDDEN" & goto :stop)
if defined RUNNER_NAME (set "ZG_REASON=RUNNER_CONTEXT_FORBIDDEN" & goto :stop)
if not exist "%ZG_REPO%\" (set "ZG_REASON=REPOSITORY_PATH_MISSING" & goto :stop)
if not exist "%ZG_NODE%" (set "ZG_REASON=NODE_MISSING" & goto :stop)
if exist "%ZG_SCOPE%" (set "ZG_REASON=SCOPED_TEMP_ALREADY_PRESENT" & goto :stop)
if exist "E:\ZGmini\automation\pc-maintenance\leases\controller-install" (set "ZG_REASON=CONTROLLER_INSTALL_ACTIVE" & goto :stop)
where git >nul 2>nul
if errorlevel 1 (set "ZG_REASON=GIT_UNAVAILABLE" & goto :stop)
rem Check installed source, lock, and medium integrity before any Git mutation.
"%ZG_NODE%" -e "try{const f=require('node:fs'),c=require('node:child_process'),h=require('node:crypto');const r='E:/ZGmini/automation/pc-maintenance/';const p=JSON.parse(f.readFileSync(r+'MAINTENANCE_INSTALL.json','utf8'));const names=['tools/maintenance-contract.mjs','tools/maintenance-apply.mjs','tools/maintenance-agent.mjs','tools/maintenance-lock.mjs','tools/update.mjs','tools/maintenance-ancestry.vbs'];const good=names.every(n=>h.createHash('sha256').update(f.readFileSync(r+n)).digest('hex')===p.files?.[n]);const g=c.execFileSync('C:/Windows/System32/whoami.exe',['/groups'],{encoding:'utf8',windowsHide:true});process.exit(p.sourceSha==='%ZG_INSTALLED%'&&good&&!f.existsSync(r+'leases/controller-install')&&g.includes('S-1-16-8192')&&!g.includes('S-1-16-12288')?0:1)}catch{process.exit(1)}" >nul 2>nul
if errorlevel 1 (set "ZG_REASON=INSTALLED_SHA_HASH_LOCK_OR_USER_TOKEN_MISMATCH" & goto :stop)
rem Confirm the requested repository root, main branch and exact trusted origin.
"%ZG_NODE%" -e "try{const c=require('node:child_process'),p=require('node:path');const r=process.argv[1];const v=c.execFileSync('git',['-C',r,'rev-parse','--show-toplevel'],{encoding:'utf8',windowsHide:true}).trim();const b=c.execFileSync('git',['-C',r,'branch','--show-current'],{encoding:'utf8',windowsHide:true}).trim();const u=c.execFileSync('git',['-C',r,'remote','get-url','origin'],{encoding:'utf8',windowsHide:true}).trim();const ok=/^(https:\/\/(?:[^\/@]+@)?github\.com\/ansqhd5774-Choi\/zgmini-pc-control(?:\.git)?|git@github\.com:ansqhd5774-Choi\/zgmini-pc-control(?:\.git)?|ssh:\/\/git@github\.com\/ansqhd5774-Choi\/zgmini-pc-control(?:\.git)?)$/i.test(u);process.exit(p.win32.normalize(v).toLowerCase()===p.win32.normalize(r).toLowerCase()&&b==='main'&&ok?0:1)}catch{process.exit(1)}" "%ZG_REPO%" >nul 2>nul
if errorlevel 1 (set "ZG_REASON=REPO_MAIN_OR_ORIGIN_INVALID" & goto :stop)
rem Never override repository hooks. Abort if a custom hooksPath or active mutation hook exists.
"%ZG_NODE%" -e "try{const f=require('node:fs'),c=require('node:child_process'),p=require('node:path'),r=process.argv[1];const run=a=>c.execFileSync('git',['-C',r,...a],{encoding:'utf8',windowsHide:true}).trim();let custom='';try{custom=run(['config','--get','core.hooksPath'])}catch{};const d=run(['rev-parse','--path-format=absolute','--git-path','hooks']);const active=['post-merge','pre-merge-commit','reference-transaction'].some(n=>f.existsSync(p.join(d,n)));process.exit(custom||active?1:0)}catch{process.exit(1)}" "%ZG_REPO%" >nul 2>nul
if errorlevel 1 (set "ZG_REASON=ACTIVE_GIT_HOOKS_REVIEW_REQUIRED" & goto :stop)
rem Only the approved eight source files and exact approval manifest must be clean.
call :scope_clean
if errorlevel 1 (set "ZG_REASON=APPROVED_PATHS_DIRTY_OR_STATUS_FAILED" & goto :stop)
>>"%ZG_REPORT%" echo PREFLIGHT=PASS
>>"%ZG_REPORT%" echo PHASE=FETCH_PINNED_MAIN
rem Fetch may use the user's existing Git credentials. Never print remote URL/errors.
git -C "%ZG_REPO%" fetch --no-tags origin main >nul 2>nul
if errorlevel 1 (set "ZG_REASON=SOURCE_FETCH_FAILED" & goto :stop)
git -C "%ZG_REPO%" cat-file -e %ZG_MAIN_PIN% >nul 2>nul
if errorlevel 1 (set "ZG_REASON=PINNED_MAIN_OBJECT_MISSING" & goto :stop)
git -C "%ZG_REPO%" merge-base --is-ancestor %ZG_MAIN_PIN% FETCH_HEAD >nul 2>nul
if errorlevel 1 (set "ZG_REASON=PINNED_MAIN_NOT_REMOTE_ANCESTOR" & goto :stop)
git -C "%ZG_REPO%" merge-base --is-ancestor HEAD %ZG_MAIN_PIN% >nul 2>nul
if errorlevel 1 goto :already_ahead
>>"%ZG_REPORT%" echo PHASE=PINNED_FAST_FORWARD_ATTEMPTED
set "ZG_FF=YES"
git -C "%ZG_REPO%" merge --ff-only %ZG_MAIN_PIN% >nul 2>nul
if errorlevel 1 (set "ZG_REASON=SOURCE_FF_OUTCOME_UNKNOWN_NO_RETRY" & goto :stop)
goto :after_ff
:already_ahead
git -C "%ZG_REPO%" merge-base --is-ancestor %ZG_MAIN_PIN% HEAD >nul 2>nul
if errorlevel 1 (set "ZG_REASON=LOCAL_MAIN_DIVERGED_NO_UPDATE" & goto :stop)
:after_ff
git -C "%ZG_REPO%" merge-base --is-ancestor %ZG_MAIN_PIN% HEAD >nul 2>nul
if errorlevel 1 (set "ZG_REASON=PINNED_SOURCE_NOT_PRESENT" & goto :stop)
if not exist "%ZG_REPO%\approvals\maintenance-handoffs\%ZG_TARGET%.json" (set "ZG_REASON=APPROVAL_MANIFEST_MISSING" & goto :stop)
call :scope_clean
if errorlevel 1 (set "ZG_REASON=APPROVED_PATHS_DIRTY_AFTER_FF" & goto :stop)
rem Before running even the helper itself, authenticate its bytes and all eight files
rem against the exact pinned Git approval (also when local main is newer than the pin).
"%ZG_NODE%" -e "try{const f=require('node:fs'),c=require('node:child_process'),h=require('node:crypto'),p=require('node:path'),r=process.argv[1],mp='approvals/maintenance-handoffs/%ZG_TARGET%.json';const show=(rev,n)=>c.execFileSync('git',['-C',r,'show',rev+':'+n],{windowsHide:true,maxBuffer:3000000});const raw=f.readFileSync(p.join(r,mp)),pin=show('%ZG_MAIN_PIN%',mp),normalized=Buffer.from(raw.toString('utf8').replace(/\r\n/g,'\n'),'utf8');if(!raw.equals(pin)&&!normalized.equals(pin))process.exit(1);const a=JSON.parse(raw);if(a.schema!=='ZGMINI_MAINTENANCE_HANDOFF_V1'||a.approved!==true||a.targetSha!=='%ZG_TARGET%'||a.installedSha!=='%ZG_INSTALLED%')process.exit(1);const n=['tools/maintenance-contract.mjs','tools/maintenance-apply.mjs','tools/maintenance-agent.mjs','tools/maintenance-lock.mjs','tools/update.mjs','tools/maintenance-ancestry.vbs','tools/bootstrap-maintenance.mjs','tools/handoff-maintenance.mjs'];const sha=x=>h.createHash('sha256').update(x).digest('hex');process.exit(n.every(x=>sha(f.readFileSync(p.join(r,x)))===a.files?.[x]&&sha(show('%ZG_TARGET%',x))===a.files?.[x])?0:1)}catch{process.exit(1)}" "%ZG_REPO%" >nul 2>nul
if errorlevel 1 (set "ZG_REASON=EXACT_EIGHT_FILE_OR_MANIFEST_HASH_MISMATCH" & goto :stop)
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
>>"%ZG_REPORT%" echo SOURCE_FF_ATTEMPTED=%ZG_FF%
>>"%ZG_REPORT%" echo HANDOFF_INVOKED=%ZG_HANDOFF%
echo STOP: %ZG_REASON%. Preserve output; do not rerun.
set "ZG_EXIT=92"
goto :display
:existing
echo Prior result exists. No source update or handoff will be attempted.
set "ZG_EXIT=93"
goto :display
:display
echo.
echo ===== ZGMINI MAINTENANCE 464 RESULT =====
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

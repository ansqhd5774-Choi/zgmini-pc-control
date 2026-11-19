import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {C_SOURCE_BLOBS,C_SOURCE_COMMIT} from '../tools/handoff-watch-c-preflight.mjs';

const text=readFileSync('tools/handoff-watch-user-activate.ps1','utf8');

test('limited current-user activation is explicit and fails closed',()=>{
  for(const pattern of [
    /\[switch\]\$Apply/,/\[switch\]\$ConfirmRestrictedCredential/,
    /DESKTOP-N62L0NG/,/SessionId -le 0/,/SERVICE_IDENTITY_FORBIDDEN/,
    /if\(-not \$Apply\)\{Report 'READONLY_READY_USER_APPLY_REQUIRED';exit 0\}/,
    /RESTRICTED_CREDENTIAL_CONFIRMATION_REQUIRED/,
    /Get-ScheduledTask -TaskName \$TaskName/,
    /TASK_ALREADY_EXISTS_STOP/,/\$script:changesStarted=\$true/,
    /New-ScheduledTaskTrigger -AtLogOn -User \$id[.]Name/,
    /New-ScheduledTaskPrincipal -UserId \$id[.]Name -LogonType Interactive -RunLevel Limited/,
    /New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -RestartCount 2/,
    /Register-ScheduledTask -TaskName \$TaskName/,
    /Start-ScheduledTask -TaskName \$TaskName/,
    /REGISTERED_START_REQUESTED_HEARTBEAT_PENDING/
  ])assert.match(text,pattern);
  assert.doesNotMatch(text,/Register-ScheduledTask[^\r\n]*-Force|New-Service|sc[.]exe|Register-Service|Start-Service|Set-ExecutionPolicy/);
  assert.doesNotMatch(text,/RUNTIME_ACTIVATION_COMPLETED|WATCH_HEARTBEAT_VERIFIED/);
});

test('no plaintext token or privilege expansion and only seven pinned files',()=>{
  for(const pattern of [
    /GH_CONFIG_DIR/,/oauth_token/,/GH_PLAINTEXT_TOKEN_STOP/,
    /RAW_TOKEN_ENV_FORBIDDEN/,/gh[.]exe/,
    /auth status --hostname github[.]com/,
    /api --method GET 'repos\/ansqhd5774-Choi\/zgmini-pc-control\/issues[?]per_page=1'/,
    /CheckSource \$NodeExe \$checker \$Root/,
    /CheckSource \$NodeExe \$checker \$target/,
    /UNSAFE_SOURCE_CHECKOUT/,
    /Join-Path \$env:LOCALAPPDATA 'ZGMINI'/
  ])assert.match(text,pattern);
  assert.doesNotMatch(text,/gh auth login|auth refresh|gh auth token|setx|E:\\ZGmini|C:\\ZGmini/i);
  assert.equal(C_SOURCE_COMMIT,'82e06469569bb6842aa4aca43970d84262329481');
  assert.equal(Object.keys(C_SOURCE_BLOBS).length,7);
  for(const name of Object.keys(C_SOURCE_BLOBS))assert.ok(text.includes("'"+name+"'"),name);
});

test('preflight CLI accepts external pinned root and rejects malformed input',()=>{
  const executable=path.resolve('tools/handoff-watch-c-preflight.mjs');
  const env={...process.env};delete env.GITHUB_TOKEN;delete env.GH_TOKEN;
  const pass=spawnSync(process.execPath,[executable,'--source-root',process.cwd()],{encoding:'utf8',env,timeout:10_000});
  const data=JSON.parse(pass.stdout.trim());
  assert.equal(data.sourceFilesChecked,7);
  assert.equal(data.sourceFilesMatched,6);
  assert.equal(data.sourceEligible,false);
  assert.equal(data.state,'SOURCE_PREFLIGHT_STOP');
  assert.equal(pass.status,2); // An evolving HEAD cannot be the approved C install.
  assert.equal(data.sourceCommit,C_SOURCE_COMMIT);
  assert.equal(data.pcWrites,0);
  const fail=spawnSync(process.execPath,[executable,'--source-root','./relative'],{encoding:'utf8',env,timeout:10_000});
  assert.equal(fail.status,2);
  assert.equal(JSON.parse(fail.stdout.trim()).reason,'ARGS_INVALID');
  assert.equal(fail.stderr,'');
});

test('Windows PowerShell parser accepts the installer without executing it',()=>{
  if(process.platform!=='win32')return;
  const cmd="$t=$null;$e=$null;[System.Management.Automation.Language.Parser]::ParseFile("+
    "'tools/handoff-watch-user-activate.ps1',[ref]$t,[ref]$e)|Out-Null;"+
    "if($e.Count -gt 0){exit 7}";
  const p=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',cmd],{encoding:'utf8',timeout:15_000});
  assert.equal(p.status,0,'PowerShell parser failed: '+p.stderr);
});

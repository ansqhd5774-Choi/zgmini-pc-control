import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const wrapper=readFileSync(new URL('../tools/operator-packets/CI_CONTROLLER_B_RECEIPT_ROOT_C1.cmd',import.meta.url),'utf8');
const source=readFileSync(new URL('../tools/operator-packets/CI_CONTROLLER_B_RECEIPT_ROOT_C1.ps1',import.meta.url),'utf8');
test('exact isolated Windows host, fixed non-TEMP ProgramData root, separate Runner identity',()=>{
 assert.match(source,/\$hostName = 'DESKTOP-N62L0NG'/);
 assert.match(source,/\$runnerName = 'zgmini-handoff-ci-spare-01'/);
 assert.match(source,/\$root = 'C:\\ProgramData\\ZGMINI-CI\\ControllerBReceipts'/);
 assert.match(source,/MachineName\.ToUpperInvariant\(\)/);
 assert.match(source,/Win32_Service/);
 assert.match(source,/DEDICATED_RUNNER_ACCOUNT_REQUIRED/);
});
test('no Actions or unattended self-authorizing setup',()=>{
 assert.match(source,/\$env:GITHUB_ACTIONS/);
 assert.match(source,/\$env:RUNNER_NAME/);
 assert.match(source,/UserInteractive/);
 assert.match(source,/WindowsBuiltInRole\]::Administrator/);
 assert.match(source,/publisherEnabled=false/);
 assert.doesNotMatch(source,/gh\s+variable|api\.github\.com|issue\s+create|workflow_dispatch|Invoke-RestMethod|Set-ExecutionPolicy/i);
});
test('only new dedicated directories and protected restrictive ACL',()=>{
 assert.match(source,/Test-Path -LiteralPath \$parent/);
 assert.match(source,/CI_RECEIPT_PARENT_ALREADY_EXISTS_STOP/);
 assert.match(source,/CreateDirectory\(\$parent, \$parentAcl\)/);
 assert.match(source,/CreateDirectory\(\$root, \$rootAcl\)/);
 assert.match(source,/SetAccessRuleProtection\(\$true, \$false\)/);
 assert.match(source,/S-1-5-18/);
 assert.match(source,/S-1-5-32-544/);
 assert.match(source,/ReadAndExecute/);
 assert.match(source,/Modify/);
 assert.doesNotMatch(source,/Remove-Item|Delete\(|TakeOwn|icacls|Set-Acl|net user/i);
});
test('no false writable/durable/published attestation',()=>{
 assert.match(source,/runnerWriteAndCrossRunDurability=UNVERIFIED/);
 assert.match(source,/CI_RECEIPT_ACL_BOUNDARY_STOP/);
 assert.match(source,/CI_RECEIPT_HOST_MISMATCH/);
});
test('operator single-click wrapper requires C-grade and cannot auto-run in Actions',()=>{
 assert.match(source,/param\(\[switch\]\$Apply\)/);
 assert.match(source,/CI_RECEIPT_EXPLICIT_C_APPLY_REQUIRED/);
 assert.match(wrapper,/if defined GITHUB_ACTIONS exit \/b 1/);
 assert.match(wrapper,/if defined RUNNER_NAME exit \/b 1/);
 assert.match(wrapper,/powershell\.exe .* -File "%ZG_SCRIPT%" -Apply/);
 const digest=createHash('sha256').update(source,'utf8').digest('hex').toUpperCase();
 assert.ok(wrapper.includes(String.fromCharCode(39)+digest+String.fromCharCode(39)),'launcher must pin exact script SHA-256');
 assert.match(wrapper,/Get-FileHash -LiteralPath \$env:ZG_SCRIPT -Algorithm SHA256/);
 assert.doesNotMatch(wrapper,/ExecutionPolicy|EncodedCommand|runas|curl|wget|git |node /i);
});
test('Windows PowerShell parser accepts C operator source without executing it',async t=>{
 if(process.platform!=='win32')return t.skip('Windows parser only');
 const {spawnSync}=await import('node:child_process');
 const {fileURLToPath}=await import('node:url');
 const file=fileURLToPath(new URL('../tools/operator-packets/CI_CONTROLLER_B_RECEIPT_ROOT_C1.ps1',import.meta.url));
 const quoted=file.replaceAll("'","''");
 const code="$tokens=$null; $errors=$null; [void][System.Management.Automation.Language.Parser]::ParseFile('"+quoted+"',[ref]$tokens,[ref]$errors); if($errors.Count -ne 0){exit 1}";
 const r=spawnSync('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-Command',code],{
  windowsHide:true,encoding:'utf8',shell:false,timeout:15000,maxBuffer:3000
 });
 assert.equal(r.status,0,'PowerShell C script parse failed');
});

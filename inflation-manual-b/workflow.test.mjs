import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const yaml=fs.readFileSync(new URL(
 '../.github/workflows/pc-inflation-official-manual-b-once.yml',import.meta.url),
 'utf8');
const windowsAdapter=fs.readFileSync(new URL('./windows-adapter.mjs',
 import.meta.url),'utf8');
const ownerProbe=fs.readFileSync(new URL('./core-lock-owner-probe.js',
 import.meta.url),'utf8');

test('only owner issue with explicit off-by-default opt-in can queue one B run',()=>{
 assert.match(yaml,/issues:\s*\n\s*types: \[opened\]/);
 assert.match(yaml,/vars.ZGMINI_INFLATION_MANUAL_B_ENABLED == 'true'/);
 assert.match(yaml,/github\.actor == 'ansqhd5774-Choi'/);
 assert.match(yaml,/github\.event\.issue\.title == 'pc-inflation-official-manual-once'/);
 assert.match(yaml,/runs-on: \[self-hosted, Windows, X64, zgmini-pc-control\]/);
 assert.match(yaml,/cancel-in-progress: false/);
 assert.doesNotMatch(yaml,/\bschedule\s*:|workflow_dispatch:|pc-job/);
});

test('separate tokenless Windows writer and token-bearing result reporter',()=>{
 assert.match(yaml,/persist-credentials: false/);
 assert.match(yaml,/actions\/checkout@11d5960a326750d5838078e36cf38b85af677262/);
 assert.match(yaml,/shell: cmd/);
 assert.match(yaml,/E:\\ZGmini\\runtime\\node.exe/);
 assert.match(yaml,/windows-adapter\.mjs/);
 assert.match(yaml,/report\.mjs/);
 assert.equal((yaml.match(/GITHUB_TOKEN:/g)??[]).length,1);
 assert.doesNotMatch(yaml,/powershell|schtasks|wrangler|setup-node/);
});

test('live Core lock owner check is bounded, Task-linked and read-only',()=>{
 assert.match(yaml,/timeout-minutes: 30/);
 assert.match(windowsAdapter,/CORE_OWNER_OBSERVATION_MS=12\*60_000/);
 assert.match(windowsAdapter,/async proveActiveCoreLock\(\)/);
 assert.match(windowsAdapter,/INFL_MANUAL_B_CORE_OWNER_NOT_OBSERVED_STOP/);
 assert.match(windowsAdapter,/INFL_MANUAL_B_CORE_TASK_INSTANCE_GAP_STOP/);
 assert.match(windowsAdapter,/INFL_MANUAL_B_CORE_PROCESS_GAP_STOP/);
 assert.match(windowsAdapter,/if\(result.status!=='INFL_MANUAL_B_SAVED_VERIFIED'\)process.exitCode=1/);
 assert.match(ownerProbe,/GetTask\('ZGMINI-PC-Local-Core'\)/);
 assert.match(ownerProbe,/GetInstances\(0\)/);
 assert.match(ownerProbe,/EnginePID/);
 assert.match(ownerProbe,/CommandLine/);
 assert.match(ownerProbe,/indexOf\('local-cycle.mjs'\)/);
 assert.doesNotMatch(ownerProbe,/RegisterTask|Stop\(|Run\(|DeleteTask|\.Enabled\s*=/);
 assert.doesNotMatch(windowsAdapter,/schtasks|Start-ScheduledTask|Stop-ScheduledTask/);
});

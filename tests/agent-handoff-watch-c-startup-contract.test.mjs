import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const launcher=readFileSync('tools/handoff-watch-user-start.cmd','utf8');
const contract=readFileSync('docs/HANDOFF_WATCH_C_ACTIVATION_CONTRACT_20261117.md','utf8');

test('C launcher only starts isolated watcher, never registers or changes Windows system',()=>{
  assert.match(launcher,/setlocal EnableExtensions DisableDelayedExpansion/i);
  assert.match(launcher,/agent-handoff\\intake-watch-5s\.mjs/);
  assert.match(launcher,/where gh/);
  assert.match(launcher,/ZGMINI_HANDOFF_WATCH_AUTH_SOURCE=GH_CREDENTIAL_STORE/);
  assert.doesNotMatch(launcher,/schtasks\s*\/create|sc\s+create|reg\s+add|setx|powershell|curl|Invoke-WebRequest/i);
  assert.doesNotMatch(launcher,/E:\\ZGmini|zgmini-pc-0[1-6]/i);
});

test('C launcher forbids raw token inputs, records only temp watcher observations',()=>{
  assert.match(launcher,/if defined GH_TOKEN exit \/b 5/);
  assert.match(launcher,/if defined GITHUB_TOKEN exit \/b 5/);
  assert.match(launcher,/%TEMP%\\ZGMINI/);
  assert.match(launcher,/handoff-watch-observation\.log/);
  assert.doesNotMatch(launcher,/set "(?:GH_TOKEN|GITHUB_TOKEN)=/);
  assert.doesNotMatch(launcher,/echo\s+%GH_TOKEN%|echo\s+%GITHUB_TOKEN%/i);
});

test('operator contract separates owner C setup and actual 5-second runtime evidence',()=>{
  assert.match(contract,/사용자 직접 C급 설정/);
  assert.match(contract,/Runner/);
  assert.match(contract,/WATCH_HEARTBEAT/);
  assert.match(contract,/GitHub CLI/);
  assert.match(contract,/등록되지 않음/);
  assert.match(contract,/5\/5 완료 조건/);
});

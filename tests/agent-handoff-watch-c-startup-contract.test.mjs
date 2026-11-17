import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

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

test('C activation candidate uses exactly the post-receipt-fix immutable module set',()=>{
  assert.match(contract,/0a30d3061d25fc826e2b149046dea46d123e785e/);
  assert.match(contract,/정확 7파일/);
  const moduleBlobs=[
    ['agent-handoff/intake-watch-5s.mjs','bd9a5b9b428f6d11be40fbb960420d858c07c5e6'],
    ['agent-handoff/intake-receipt-readonly.mjs','0b97307fc3bf1ed8462a5a6413c3fc8f12bbb08b'],
    ['agent-handoff/queue-selector.mjs','964faf91138989cf3b42c44afbb6a77a1d2712b1'],
    ['agent-handoff/queue-priority.mjs','5178eb3b531e9f48c7f4ac9bc13888219425ed6a'],
    ['agent-handoff/contract.mjs','9b65f341c31a2ef6ac67be6824079806207ad72c'],
    ['agent-handoff/watcher-gh-credential.mjs','03340fc943af09c6be7b55e635d09b30ef346ff5']
  ];
  for(const [name,expected] of moduleBlobs){
    const bytes=readFileSync(name);
    const actual=createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
    assert.equal(actual,expected,'Git blob changed since C source pin: '+name);
    assert.ok(contract.includes(name)&&contract.includes(expected));
  }
  assert.match(contract,/1b1773df0e9f64093ce509bb1a3590da99096024/); // CMD Git blob, not Windows SHA256
  assert.match(contract,/설치 전 STOP/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const text=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('PC CI standard preserves source-only checks and does not require operational E2E',()=>{
 const standard=text('docs/CI_EIGHT_AREA_STANDARD_R1.md');
 for(const area of ['Lint','Type Check','Build','Unit','Integration','E2E','Security','Secret']){
  assert.ok(standard.includes('| '+area+' |'),'missing scope: '+area);
 }
 assert.match(standard,/\| E2E \|[^\n]*\| PARTIAL \|/);
 assert.match(standard,/NOT_APPLICABLE \(TS 전용\)/);
 assert.match(standard,/NOT_APPLICABLE \(웹 방식 Build\)/);
 const c996=text('.github/workflows/c996-r5-readonly-source-checks.yml');
 assert.match(c996,/runs-on: \[self-hosted, Windows, X64, zgmini-handoff-ci-isolated\]/);
 assert.match(c996,/node tools\/c996-source-checks\.mjs/);
 assert.match(c996,/node tools\/ci-zizmor-pr\.mjs/);
 const secret=text('.github/workflows/pc-secret-scan.yml');
 assert.match(secret,/node tools\/ci-gitleaks-pr\.mjs/);
 assert.match(secret,/node tools\/ci-oxlint-changed\.mjs/);
 const maintenance=text('.github/workflows/controller-maintenance-source-tests.yml');
 assert.match(maintenance,/tests\/maintenance-agent\.test\.mjs/);
 assert.match(maintenance,/tests\/source-bundle-register\.test\.mjs/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {GROUPS,selectGroups,changedFiles,ungroupedChangedTests} from '../tools/c996-source-checks.mjs';
const all=Object.keys(GROUPS);
test('018 retired owner-inaccessible workflow and archived collector stay foundation-only',()=>{
 assert.deepEqual(selectGroups(['.github/workflows/pc-c996-r5-readonly.yml']),['foundation']);
 assert.deepEqual(selectGroups(['c996-r5-readonly/collector.mjs']),['foundation']);
 assert.deepEqual(selectGroups(['.github/workflows/pc-c996-r5-readonly.yml','docs/PC_AUTOMATION_STANDARD.md']),['foundation']);
});

test('011 unrelated feature/docs PR cannot be blocked by unrelated source suites',()=>{
 assert.deepEqual(selectGroups(['docs/unrelated-feature.md','site/home.tsx']),[]);
});
test('011 handoff and R6 changes select their own suites without unrelated R47',()=>{
 const set=selectGroups(['agent-handoff/result-broker.mjs','tests/employment-r6-collection-evidence-readonly.test.mjs']);
 assert.deepEqual(set,['handoff007','handoff009','handoff008','employment']);
});
test('011 direct test changes and shared source preserve relevant tests',()=>{
 assert.deepEqual(selectGroups(['tests/agent-handoff-result.test.mjs']),['handoff009']);
 assert.deepEqual(selectGroups(['tests/fear-greed-archive-status.test.mjs']),['fearGreed']);
 assert.deepEqual(selectGroups(['controller/fear-greed-archive-readonly.mjs']),['fearGreed','recovery']);
 assert.deepEqual(selectGroups(['tests/agent-handoff-proactive-diagnostics.test.mjs']),['handoff007']);
 assert.deepEqual(selectGroups(['agent-handoff/proactive-diagnostics.mjs']),['handoff007','handoff009','handoff008']);
 assert.deepEqual(selectGroups(['direct-writer-b/configured-direct-b.test.mjs']),['writer']);
 assert.deepEqual(selectGroups(['tools/update.mjs']),all);
 assert.deepEqual(selectGroups(['tools/maintenance-apply.mjs']),all);
 assert.deepEqual(selectGroups(['agent-handoff/pc-failure-producer.mjs']),['handoff007','handoff009','handoff008']);
 assert.deepEqual(selectGroups(['.github/workflows/agent-handoff-candidate-selector.yml']),['handoff007','handoff009','handoff008']);
 assert.deepEqual(selectGroups(['tests/r47-task-chain.test.mjs']),['r47','recovery']);
 assert.deepEqual(selectGroups(['tools/unknown-shared-contract.mjs']),all);
 assert.deepEqual(selectGroups(['tools/ai-software-v2-register-once.mjs']),['aiSoftware']);
 assert.deepEqual(selectGroups(['.github/workflows/pc-ai-software-v2-register-once.yml']),['aiSoftware']);
 assert.deepEqual(selectGroups(['.github/workflows/pc-calendar-cache-hotfix-once.yml']),['calendar019']);
 assert.deepEqual(selectGroups(['.github/workflows/pc-calendar-cf43-two-approved-b-once.yml']),['calendar020']);
 assert.deepEqual(selectGroups(['.github/workflows/pc-calendar-d30-readonly-preview-once.yml']),['calendar021']);
 assert.deepEqual(selectGroups(['.github/workflows/pc-calendar-source-preflight-once.yml']),['calendar022']);
 assert.deepEqual(selectGroups(['.github/workflows/pc-calendar-source-recovery-once.yml']),['calendar023']);
 assert.deepEqual(selectGroups(['.github/workflows/pc-census-cdn-connectivity-once.yml']),['census025']);
 assert.deepEqual(selectGroups(['tools/http32-census-cdn-once.mjs']),['census025']);
 assert.deepEqual(selectGroups(['tests/http32-census-cdn-once.test.mjs']),['census025']);
 assert.deepEqual(selectGroups(['.github/workflows/pc-calendar-twofile-b-install-once.yml']),['retiredOneShots']);
 assert.deepEqual(selectGroups(['.github/workflows/pc-writer-b-1063-recovery-once.yml']),['retiredOneShots']);
 assert.deepEqual(selectGroups(['tests/retired-one-shots-20261120.test.mjs']),['retiredOneShots']);
 assert.deepEqual(selectGroups(['calendar-source-recovery-b/installer/export.test.mjs']),['calendar023']);
 assert.deepEqual(selectGroups(['calendar-source-b-install-20261107/preflight-windows.test.mjs']),['calendar022']);
 assert.deepEqual(selectGroups(['calendar-source-b-install-20261107/upload-preflight-result.test.mjs']),['calendar022']);
 assert.deepEqual(selectGroups(['tests/calendar-source-d30-windows-preview-host.test.mjs']),['calendar021']);
 assert.deepEqual(selectGroups(['tests/calendar-source-d30-windows-d30-sqlite-readback.test.mjs']),['calendar021']);
 assert.deepEqual(selectGroups(['calendar-cf43-b-windows-adapter/contract.test.mjs']),['calendar020']);
 assert.deepEqual(selectGroups(['calendar-cache-hotfix/installer/install.test.mjs']),['calendar019']);
 assert.deepEqual(selectGroups(['tests/ai-software-v2-register-once.test.mjs']),['aiSoftware']);
 assert.deepEqual(selectGroups(['windows-runtime-mode-a/run.mjs']),['approvedRuntimeA']);
 assert.deepEqual(selectGroups(['windows-runtime-mode-a/report.mjs']),['approvedRuntimeA']);
 assert.deepEqual(selectGroups(['w05-r304-service-b/report.mjs']),['w05B']);
 assert.deepEqual(selectGroups(['tests/w05-r304-report-recovery.test.mjs']),['w05B']);
 assert.deepEqual(selectGroups(['.github/workflows/pc-approved-runtime-a-once.yml']),['approvedRuntimeA']);
});
test('Writer B Core and Census contracts are always included when Writer source or entry workflow changes',()=>{
 const expected=['writer-b/contract.test.mjs','writer-b/installer.test.mjs',
  'writer-b/windows-guards.test.mjs','writer-b/core-idle-window.test.mjs',
  'inflation-census-api-b/coordinator.test.mjs'];
 for(const file of expected)assert.ok(GROUPS.writer.includes(file),file);
 assert.deepEqual(selectGroups(['writer-b/windows-adapter.mjs']),['writer']);
 assert.deepEqual(selectGroups(['writer-b/contract.test.mjs']),['writer']);
 assert.deepEqual(selectGroups(['.github/workflows/pc-writer-b-source-once.yml']),['writer']);
 assert.deepEqual(selectGroups(['inflation-census-api-b/coordinator.test.mjs']),['writer']);
});
test('011 workflow and selection contract changes always run all original suites',()=>{
 assert.deepEqual(selectGroups(['.github/workflows/c996-r5-readonly-source-checks.yml']),all);
 assert.deepEqual(selectGroups(['tests/c996-source-scope.test.mjs']),all);
 const tests=Object.values(GROUPS).flat();
 assert.equal(new Set(tests).size,tests.length,'each fixed test runs once');
 assert.ok(tests.includes('tests/agent-handoff-result.test.mjs'));
 assert.ok(tests.includes('tests/agent-handoff-job-concurrency.test.mjs'));
 assert.ok(tests.includes('tests/agent-handoff-proactive-diagnostics.test.mjs'));
 assert.ok(tests.includes('tests/r47-existing-task-once.test.mjs'));
 assert.ok(tests.includes('tests/marketparquet-task-retire.test.mjs'));
});
test('unmapped changed test executes instead of CI success with zero regressions',()=>{
 const changed=['tests/new-source-coverage.test.mjs','docs/other.md'];
 assert.deepEqual(selectGroups(changed),[]);
 assert.deepEqual(ungroupedChangedTests(changed,()=>true),['tests/new-source-coverage.test.mjs']);
 assert.deepEqual(ungroupedChangedTests(changed,()=>false),[]);
 assert.deepEqual(ungroupedChangedTests(['tests/agent-handoff-proactive-diagnostics.test.mjs'],()=>true),[]);
 assert.deepEqual(ungroupedChangedTests(['tests/new-source-coverage.test.mjs','tests/new-source-coverage.test.mjs'],()=>true),['tests/new-source-coverage.test.mjs']);
 assert.deepEqual(ungroupedChangedTests(['tests/../secrets.test.mjs','tests/missing.js','site/new.test.mjs'],()=>true),[]);
 assert.deepEqual(ungroupedChangedTests(null,()=>true),[]);
});

test('011 incomplete PR file retrieval retains full regression coverage',async()=>{
 const env={GITHUB_EVENT_PATH:'not-real-path',GITHUB_REPOSITORY:'ansqhd5774-Choi/zgmini-pc-control',GITHUB_TOKEN:'unit-test'};
 assert.equal(await changedFiles(env),null);
 assert.deepEqual(selectGroups(null),all);
});
test('011 CI uses scoped PR concurrency and checks host before test execution',()=>{
 const y=readFileSync(new URL('../.github/workflows/c996-r5-readonly-source-checks.yml',import.meta.url),'utf8').replace(/\r\n/g,'\n');
 assert.match(y,/group: c996-r5-readonly-source-\$\{\{ github.event.pull_request.number \}\}/);
 assert.match(y,/cancel-in-progress: true/);
 assert.match(y,/permissions:\n  contents: read/);
 assert.ok(y.indexOf('- name: Identify exact permitted queue PC')<
           y.indexOf('- name: Run changed-source regressions only'));
 assert.match(y,/runs-on: \[self-hosted, Windows, X64, zgmini-handoff-ci-isolated\]/);
 assert.doesNotMatch(y,/schedule:|workflow_dispatch:|runs-on: ubuntu-latest/);
});

test('011 actual PR comparison uses existing contents-read scope and selects only affected tests',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'c996-scope-'));
 const path=join(dir,'event.json');
 const base='a'.repeat(40),head='b'.repeat(40);
 writeFileSync(path,JSON.stringify({pull_request:{base:{sha:base},head:{sha:head}}}));
 const env={GITHUB_EVENT_PATH:path,GITHUB_REPOSITORY:'ansqhd5774-Choi/zgmini-pc-control',
  GITHUB_TOKEN:'unit-test-not-secret'};
 try{
  let calls=0;
  const changed=await changedFiles(env,async(url,opts)=>{
   calls++;
   assert.ok(url.endsWith('/compare/'+base+'...'+head));
   assert.equal(opts.headers.Authorization,'Bearer unit-test-not-secret');
   return {ok:true,json:async()=>({files:[
    {filename:'agent-handoff/result-broker.mjs'},
    {filename:'docs/unrelated-feature.md'}]})};
  });
  assert.equal(calls,1);
  assert.deepEqual(selectGroups(changed),['handoff007','handoff009','handoff008']);
  const unknown=await changedFiles(env,async()=>({ok:false,status:403}));
  assert.equal(unknown,null);
  const cap=await changedFiles(env,async()=>({ok:true,json:async()=>({
   files:Array.from({length:300},(_,i)=>({filename:'docs/'+i+'.md'}))})}));
  assert.equal(cap,null);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

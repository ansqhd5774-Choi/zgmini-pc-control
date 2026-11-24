// C996 source-only regression selector. Never runs operating PC commands.
// Group definitions keep formerly independent tests isolated and avoid repeats.
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

export const GROUPS=Object.freeze({
 foundation:[
  'tests/pc-source-origin-readonly.test.mjs','tests/c996-r5-readonly-collector.test.mjs',
  'tests/c996-r5-readonly-github.test.mjs','tests/c996-r5-acl-boundary.test.mjs',
  'tests/c996-source-scope.test.mjs',
  'tests/market-calendar-r44-runtime-readonly.test.mjs',
  'tests/market-calendar-r44-production-readonly.test.mjs','r54-readiness-once/entry.test.mjs',
  'tests/agent-handoff-pc-resource-wait.test.mjs','tests/shared-resource-lifecycle.test.mjs'],
 handoff007:['tests/agent-handoff-wide-scout.test.mjs','tests/agent-handoff-job-concurrency.test.mjs',
  'tests/agent-handoff-proactive-diagnostics.test.mjs'],
 handoff009:['tests/agent-handoff-comment-ledger.test.mjs','tests/agent-handoff-result.test.mjs',
  'tests/agent-handoff-work-progress.test.mjs','tests/agent-handoff-diagnosis.test.mjs',
  'tests/agent-handoff.test.mjs','tests/agent-handoff-queue-selector.test.mjs',
  'tests/agent-handoff-queue-board.test.mjs'],
 fearGreed:['tests/fear-greed-archive-status.test.mjs'],
 handoff008:['tests/agent-handoff-writer-b-failure-producer.test.mjs',
  'tests/agent-handoff-writer-b-workflow.test.mjs',
  'tests/shared-resource-controller-independent.test.mjs'],
 writer:['direct-writer-b/configured-direct-b.test.mjs',
  'writer-b/preview-transport.test.mjs','writer-b/insert-preview-readonly.test.mjs',
  'writer-b/import-availability.test.mjs',
  'writer-b/w04-r54-preview-scope.test.mjs',
  'writer-b/w04-r54-threefile-candidate.test.mjs',
  'writer-b/w04-r54-fourfile-import-closure.test.mjs',
  // These tests were previously omitted even when core Writer B changed:
  // approval label↔mode, extended natural drain, recovery, and Census cap.
  'writer-b/contract.test.mjs','writer-b/installer.test.mjs',
  'writer-b/windows-guards.test.mjs','writer-b/core-idle-window.test.mjs',
  'inflation-census-api-b/coordinator.test.mjs'],
 employment:['tests/employment-r6-collection-evidence-readonly.test.mjs',
  'tests/core-status-employment-r6-readonly.test.mjs'],
 breadth:['tests/us-breadth-r17-runtime-readonly.test.mjs'],
 r47:['tests/r47-cmd-approval-intake.test.mjs','tests/r47-cmd-onefile-cas.test.mjs',
  'tests/r47-cmd-report.test.mjs','tests/r47-cmd-windows-boundary.test.mjs',
  'tests/r47-cmd-approval-bytes.test.mjs','tests/r47-task-probe-wsh.test.mjs',
  'tests/shared-resource-issue-admission.test.mjs',
  'controller/theme-r47-task-action-readonly.test.mjs',
  'tests/r47-existing-task-once.test.mjs'],
 recovery:['tests/w06-composite-writer-evidence-readonly.test.mjs','tests/controller-intake-recovery.test.mjs',
  'tests/controller-1979-backlog-recovery.test.mjs',
  'tests/completed-recovery-claim.test.mjs','tests/rollback-stalled-claim.test.mjs',
  'tests/interrupted-rollback.test.mjs','tests/maintenance-backlog-request.test.mjs',
  'tests/r47-task-chain.test.mjs','tests/inflation-a401-private23-readonly.test.mjs',
  'tests/inflation-a407-integrity-readonly.test.mjs',
  'tests/w04-r54-stored-event-inventory-readonly.test.mjs',
  'tests/w04-r54-controller-selective-approval.test.mjs',
  'tests/w04-r54-public-d1-api-readback.test.mjs',
  'tests/w04-r54-public-controller-selective-approval.test.mjs',
  'tests/w05-wpsfd42-controller-selective-2f3-approval.test.mjs',
  'tests/maintenance-installed-recovery-request.test.mjs'],
 retirement:['tests/marketparquet-task-retire.test.mjs'],
 aiSoftware:['tests/ai-software-v2-register-once.test.mjs'],
 approvedRuntimeA:['windows-runtime-mode-a/approved-runtime-a.test.mjs'],
 calendar019:['calendar-cache-hotfix/installer/install.test.mjs'],
 calendar020:['calendar-cf43-b-windows-adapter/contract.test.mjs',
  'calendar-cf43-b-windows-adapter/recovery-plan.test.mjs',
  'calendar-cf43-b-windows-adapter/upload.test.mjs'],
 calendar021:['tests/calendar-source-d30-windows-preview-host.test.mjs',
  'tests/calendar-source-d30-windows-d30-sqlite-readback.test.mjs'],
 calendar022:['calendar-source-b-install-20261107/preflight-windows.test.mjs',
  'calendar-source-b-install-20261107/upload-preflight-result.test.mjs'],
 calendar023:['calendar-source-recovery-b/installer/export.test.mjs'],
 census025:['tests/http32-census-cdn-once.test.mjs'],
 retiredOneShots:['tests/retired-one-shots-20261120.test.mjs',
  'tests/agent-handoff-watch-runner-context-readonly.test.mjs',
  'r17-sip-refresh-b/workflow.test.mjs',
  'tests/report-recovery-540-workflow.test.mjs'],
 w05B:['tests/w05-r304-report-recovery.test.mjs']
});
const ALL=Object.keys(GROUPS);
const MATCH=Object.freeze({
 foundation:/^(?:c996-r5-readonly\/|\.github\/workflows\/pc-c996-r5-readonly\.yml$|tests\/(?:pc-source-origin-readonly|c996-r5-readonly-(?:collector|github)|market-calendar-r44-|agent-handoff-pc-resource-wait|shared-resource-lifecycle)|r54-readiness-once\/|market-calendar-|pc-job\/|tools\/(?:pc-source|r54-))/,
 handoff007:/^(?:tests\/agent-handoff-(?:wide-scout|job-concurrency|proactive-diagnostics)|agent-handoff\/(?:wide-scout|proactive-diagnostics|resource-wait)|\.github\/workflows\/agent-handoff-(?:wide-scout|proactive-diagnostics|deep-diagnostics|queue-board)\.yml)/,
 handoff009:/^(?:tests\/agent-handoff(?:\.|-(?:comment-ledger|result|work-progress|diagnosis|queue-selector|direct-owner|cross-chain))|agent-handoff\/(?:issue-broker|result-|diagnosis-|work-progress-|comment-ledger|queue-selector|contract|route)\b|\.github\/workflows\/agent-handoff\.yml)/,
 fearGreed:/^(?:tests\/fear-greed-archive-status\.test\.mjs|controller\/fear-greed-archive-readonly\.mjs)$/,
 handoff008:/^(?:tests\/(?:agent-handoff-writer-b-|shared-resource-controller-independent)|agent-handoff\/writer-b-|\.github\/workflows\/agent-handoff-writer-b-failure-intake\.yml)/,
 writer:/^(?:direct-writer-b\/|writer-b\/|tests\/direct-writer-b|inflation-census-api-b\/|\.github\/workflows\/pc-writer-b-source-once\.yml$)/,
 employment:/^(?:tests\/(?:employment-r6-|core-status-employment-r6-)|employment-r6\/|controller\/employment-r6-)/,
 breadth:/^(?:tests\/us-breadth-r17-|us-breadth-r17\/|controller\/us-breadth-r17-)/,
 r47:/^(?:tests\/(?:r47-|shared-resource-issue-admission)|controller\/theme-r47-|r47-)/,
 recovery:/^(?:tests\/(?:controller-intake-recovery|controller-1979-backlog-recovery|completed-recovery-claim|rollback-stalled-claim|interrupted-rollback|maintenance-backlog-request|maintenance-installed-recovery-request|r47-task-chain|inflation-a401-|inflation-a407-)|controller\/|tools\/maintenance-)/,
 retirement:/^(?:tests\/marketparquet-task-retire|marketparquet-|docs\/MARKETPARQUET_REMOVAL)/,
 aiSoftware:/^(?:tests\/ai-software-v2-register-once\.test\.mjs|tools\/ai-software-v2-register-once\.mjs|\.github\/workflows\/pc-ai-software-v2-register-once\.yml)$/,
 approvedRuntimeA:/^(?:windows-runtime-mode-a\/.*|\.github\/workflows\/pc-approved-runtime-a-once\.yml)$/,
 calendar019:/^(?:calendar-cache-hotfix\/.*|\.github\/workflows\/pc-calendar-cache-hotfix-once\.yml)$/,
 calendar020:/^(?:calendar-cf43-b-windows-adapter\/.*|\.github\/workflows\/pc-calendar-cf43-two-approved-b-once\.yml)$/,
 calendar021:/^(?:calendar-source-d30\/.*|tests\/calendar-source-d30-.*\.test\.mjs$|\.github\/workflows\/pc-calendar-d30-readonly-preview-once\.yml)$/,
 calendar022:/^(?:calendar-source-b-install-20261107\/.*|\.github\/workflows\/pc-calendar-source-preflight-once\.yml)$/,
 calendar023:/^(?:calendar-source-recovery-b\/.*|\.github\/workflows\/pc-calendar-source-recovery-once\.yml)$/,
 census025:/^(?:tools\/http32-census-cdn-once\.mjs|tests\/http32-census-cdn-once\.test\.mjs|\.github\/workflows\/pc-census-cdn-connectivity-once\.yml)$/,
 retiredOneShots:/^(?:\.github\/workflows\/(?:handoff-watch-runner-context-readonly|pc-(?:calendar-twofile-b-install-once|configured-runtime-proof-once|inflation19-public-d1-once|r17-sip-b-install-once|r17-sip-refresh-onefile-b-once|r17-writer-b-install-once|report-recovery-540-once|writer-b-1063-recovery-once|writer-config-b-once|writer-config-b-proof-once))\.yml|tests\/(?:retired-one-shots-20261120|agent-handoff-watch-runner-context-readonly|report-recovery-540-workflow)\.test\.mjs|calendar-b-twofile\/install\.test\.mjs|r17-sip-refresh-b\/workflow\.test\.mjs)$/,
 w05B:/^(?:w05-r304-service-b\/.*|tests\/w05-r304-report-recovery\.test\.mjs)$/
});
const isGlobal=p=>p==='.github/workflows/c996-r5-readonly-source-checks.yml'||
 p==='tools/c996-source-checks.mjs'||p==='tests/c996-source-scope.test.mjs'||
 p==='tools/update.mjs'||p.startsWith('tools/maintenance-');
export function selectGroups(paths){
 if(!Array.isArray(paths)||paths.some(p=>typeof p!=='string'))return ALL;
 if(paths.some(isGlobal))return ALL;
 const chosen=new Set();
 for(const p of paths){
  for(const [g,re] of Object.entries(MATCH))if(re.test(p))chosen.add(g);
  // A changed test file always selects its own suite, even if renamed or
  // introduced after a source-specific regex was first authored.
  for(const [g,tests] of Object.entries(GROUPS))
   if(tests.includes(p))chosen.add(g);
  // The agent-handoff contract and workflow components are shared by
  // 007, 008 and 009; do not validate only one of those consumers.
  if(p.startsWith('agent-handoff/')||
     p.startsWith('.github/workflows/agent-handoff-')||
     p==='.github/workflows/agent-handoff.yml')
   for(const g of ['handoff007','handoff009','handoff008'])chosen.add(g);
  // Unknown modifications to shared runtime source should not silently
  // skip an affected source test: conservatively run the full existing set.
  if(/^(?:tools\/|controller\/|direct-writer-b\/)/.test(p)&&
     !Object.values(MATCH).some(re=>re.test(p)))return ALL;
 }
 return ALL.filter(g=>chosen.has(g));
}
// Any newly introduced top-level regression must actually run, even before
// a scoped group explicitly includes it. Deletions and renamed old paths
// are absent from the checked-out tree and cannot be executed.
export function ungroupedChangedTests(paths,exists=fs.existsSync){
 if(!Array.isArray(paths))return [];
 const registered=new Set(Object.values(GROUPS).flat());
 return [...new Set(paths)].filter(p=>
   typeof p==='string'&&p.startsWith('tests/')&&
   /^[A-Za-z0-9][A-Za-z0-9._-]*[.]test[.]mjs$/.test(p.slice(6))&&
   !registered.has(p)&&exists(p));
}
export async function changedFiles(env=process.env,fetcher=fetch){
 try{
  const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
  const base=event.pull_request?.base?.sha;
  const head=event.pull_request?.head?.sha;
  const repo=env.GITHUB_REPOSITORY;
  if(!/^[a-f0-9]{40}$/.test(base??'')||!/^[a-f0-9]{40}$/.test(head??'')||
     repo!=='ansqhd5774-Choi/zgmini-pc-control'||!env.GITHUB_TOKEN)
     throw Error('NO_SCOPED_PR_PROOF');
  // Compare uses the existing contents:read token; unlike the Pull Request
  // files endpoint it does not require extra pull-requests permissions.
  const res=await fetcher('https://api.github.com/repos/'+repo+
   '/compare/'+base+'...'+head,{headers:{
    Authorization:'Bearer '+env.GITHUB_TOKEN,
    Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'
   },signal:AbortSignal.timeout(20000)});
  if(!res.ok)throw Error('PR_COMPARE_UNAVAILABLE');
  const diff=await res.json();
  // GitHub compare lists at most 300 changed files; at that boundary we
  // cannot assert complete coverage, so run the existing full suite.
  const rows=diff?.files;
  if(!Array.isArray(rows)||rows.length>=300||
     rows.some(x=>typeof x.filename!=='string'))
    throw Error('PR_COMPARE_INCOMPLETE');
  return rows.flatMap(x=>[x.filename,
   ...(typeof x.previous_filename==='string'?[x.previous_filename]:[])]);
 }catch{return null;} // Missing scope evidence => existing full test set.
}
export async function main(env=process.env){
 const paths=await changedFiles(env);
 const selected=paths===null?ALL:selectGroups(paths);
 const extra=ungroupedChangedTests(paths,p=>{
  try{return fs.lstatSync(p).isFile();}catch{return false;}
 });
 console.log('C996_SOURCE_SCOPE '+(paths===null?'FALLBACK_ALL':'SCOPED')+
  ' groups='+selected.join(',')+' extraTests='+extra.length);
 if(selected.length===0&&extra.length===0){
  console.log('C996_SOURCE_SCOPE_NO_RELEVANT_TESTS');return;
 }
 const visited=new Set();
 let failed=false;
 for(const g of selected){
  const tests=GROUPS[g].filter(t=>!visited.has(t));
  tests.forEach(t=>visited.add(t));
  if(!tests.length)continue;
  console.log('C996_GROUP_START '+g+' files='+tests.length);
  const args=['--test',...(g==='breadth'?['--test-concurrency=1']:[]),...tests];
  const p=spawnSync(process.execPath,args,{stdio:'inherit',windowsHide:true,timeout:150000});
  if(p.error||p.status!==0){failed=true;console.error('C996_GROUP_FAILED '+g);}
  else console.log('C996_GROUP_PASS '+g);
 }
 if(extra.length){
  // The isolated CI already runs repository-owned regression code.
  // Invoke Node directly (no shell) and bound the added test batch.
  console.log('C996_UNGROUPED_TEST_START files='+extra.length);
  const p=spawnSync(process.execPath,['--test',...extra],{
   stdio:'inherit',windowsHide:true,timeout:150000
  });
  if(p.error||p.status!==0){failed=true;console.error('C996_UNGROUPED_TEST_FAILED');}
  else console.log('C996_UNGROUPED_TEST_PASS');
 }
 if(failed)process.exitCode=1;
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1])
 main().catch(e=>{console.error('C996_SOURCE_CHECK_FAILED '+e.message);process.exitCode=1;});

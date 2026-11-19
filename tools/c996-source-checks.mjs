// C996 source-only regression selector. Never runs operating PC commands.
// Group definitions keep formerly independent tests isolated and avoid repeats.
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

export const GROUPS=Object.freeze({
 foundation:[
  'tests/pc-source-origin-readonly.test.mjs','tests/c996-r5-readonly-collector.test.mjs',
  'tests/c996-r5-readonly-github.test.mjs','tests/market-calendar-r44-runtime-readonly.test.mjs',
  'tests/market-calendar-r44-production-readonly.test.mjs','r54-readiness-once/entry.test.mjs',
  'tests/agent-handoff-pc-resource-wait.test.mjs','tests/shared-resource-lifecycle.test.mjs'],
 handoff007:['tests/agent-handoff-wide-scout.test.mjs','tests/agent-handoff-job-concurrency.test.mjs'],
 handoff009:['tests/agent-handoff-comment-ledger.test.mjs','tests/agent-handoff-result.test.mjs',
  'tests/agent-handoff-work-progress.test.mjs','tests/agent-handoff-diagnosis.test.mjs',
  'tests/agent-handoff.test.mjs'],
 handoff008:['tests/agent-handoff-writer-b-failure-producer.test.mjs',
  'tests/agent-handoff-writer-b-workflow.test.mjs',
  'tests/shared-resource-controller-independent.test.mjs'],
 writer:['direct-writer-b/configured-direct-b.test.mjs'],
 employment:['tests/employment-r6-collection-evidence-readonly.test.mjs',
  'tests/core-status-employment-r6-readonly.test.mjs'],
 breadth:['tests/us-breadth-r17-runtime-readonly.test.mjs'],
 r47:['tests/r47-cmd-approval-intake.test.mjs','tests/r47-cmd-onefile-cas.test.mjs',
  'tests/r47-cmd-report.test.mjs','tests/r47-cmd-windows-boundary.test.mjs',
  'tests/r47-cmd-approval-bytes.test.mjs','tests/r47-task-probe-wsh.test.mjs',
  'tests/shared-resource-issue-admission.test.mjs',
  'controller/theme-r47-task-action-readonly.test.mjs',
  'tests/r47-existing-task-once.test.mjs'],
 recovery:['tests/controller-intake-recovery.test.mjs',
  'tests/controller-1979-backlog-recovery.test.mjs',
  'tests/completed-recovery-claim.test.mjs','tests/rollback-stalled-claim.test.mjs',
  'tests/interrupted-rollback.test.mjs','tests/maintenance-backlog-request.test.mjs',
  'tests/r47-task-chain.test.mjs','tests/inflation-a401-private23-readonly.test.mjs',
  'tests/inflation-a407-integrity-readonly.test.mjs'],
 retirement:['tests/marketparquet-task-retire.test.mjs']
});
const ALL=Object.keys(GROUPS);
const MATCH=Object.freeze({
 foundation:/^(?:tests\/(?:pc-source-origin-readonly|c996-r5-readonly-(?:collector|github)|market-calendar-r44-|agent-handoff-pc-resource-wait|shared-resource-lifecycle)|r54-readiness-once\/|market-calendar-|pc-job\/|tools\/(?:pc-source|r54-))/,
 handoff007:/^(?:tests\/agent-handoff-(?:wide-scout|job-concurrency)|agent-handoff\/(?:wide-scout|proactive-diagnostics|resource-wait)|\.github\/workflows\/agent-handoff-(?:wide-scout|proactive-diagnostics|deep-diagnostics|queue-board)\.yml)/,
 handoff009:/^(?:tests\/agent-handoff(?:\.|-(?:comment-ledger|result|work-progress|diagnosis|queue-selector|direct-owner|cross-chain))|agent-handoff\/(?:issue-broker|result-|diagnosis-|work-progress-|comment-ledger|queue-selector|contract|route)\b|\.github\/workflows\/agent-handoff\.yml)/,
 handoff008:/^(?:tests\/(?:agent-handoff-writer-b-|shared-resource-controller-independent)|agent-handoff\/writer-b-|\.github\/workflows\/agent-handoff-writer-b-failure-intake\.yml)/,
 writer:/^(?:direct-writer-b\/|writer-b\/|tests\/direct-writer-b)/,
 employment:/^(?:tests\/(?:employment-r6-|core-status-employment-r6-)|employment-r6\/|controller\/employment-r6-)/,
 breadth:/^(?:tests\/us-breadth-r17-|us-breadth-r17\/|controller\/us-breadth-r17-)/,
 r47:/^(?:tests\/(?:r47-|shared-resource-issue-admission)|controller\/theme-r47-|r47-)/,
 recovery:/^(?:tests\/(?:controller-intake-recovery|controller-1979-backlog-recovery|completed-recovery-claim|rollback-stalled-claim|interrupted-rollback|maintenance-backlog-request|r47-task-chain|inflation-a401-|inflation-a407-)|controller\/|tools\/maintenance-)/,
 retirement:/^(?:tests\/marketparquet-task-retire|marketparquet-|docs\/MARKETPARQUET_REMOVAL)/
});
const isGlobal=p=>p==='.github/workflows/c996-r5-readonly-source-checks.yml'||
 p==='tools/c996-source-checks.mjs'||p==='tests/c996-source-scope.test.mjs'||
 p==='tools/update.mjs'||p==='tools/maintenance-lock.mjs';
export function selectGroups(paths){
 if(!Array.isArray(paths)||paths.some(p=>typeof p!=='string'))return ALL;
 if(paths.some(isGlobal))return ALL;
 const chosen=new Set();
 for(const p of paths){
  for(const [g,re] of Object.entries(MATCH))if(re.test(p))chosen.add(g);
  // Unknown modifications to shared runtime source should not silently
  // skip an affected source test: conservatively run the full existing set.
  if(/^(?:tools\/|controller\/|agent-handoff\/|direct-writer-b\/)/.test(p)&&
     !Object.values(MATCH).some(re=>re.test(p)))return ALL;
 }
 return ALL.filter(g=>chosen.has(g));
}
export async function changedFiles(env=process.env,fetcher=fetch){
 try{
  const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
  const n=event.pull_request?.number;
  const repo=env.GITHUB_REPOSITORY;
  if(!Number.isSafeInteger(n)||n<1||repo!=='ansqhd5774-Choi/zgmini-pc-control'||
     !env.GITHUB_TOKEN)throw Error('NO_SCOPED_PR_PROOF');
  const paths=[];
  for(let page=1;page<=10;page++){
   const res=await fetcher('https://api.github.com/repos/'+repo+
    '/pulls/'+n+'/files?per_page=100&page='+page,{headers:{
     Authorization:'Bearer '+env.GITHUB_TOKEN,
     Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'
    },signal:AbortSignal.timeout(20000)});
   if(!res.ok)throw Error('PR_FILES_UNAVAILABLE');
   const rows=await res.json();
   if(!Array.isArray(rows)||rows.length>100||rows.some(x=>typeof x.filename!=='string'))
     throw Error('PR_FILES_INVALID');
   paths.push(...rows.map(x=>x.filename));
   if(rows.length<100)return paths;
  }
  throw Error('PR_FILES_TOO_MANY');
 }catch{return null;} // Missing scope evidence => existing full test set.
}
export async function main(env=process.env){
 const paths=await changedFiles(env);
 const selected=paths===null?ALL:selectGroups(paths);
 console.log('C996_SOURCE_SCOPE '+(paths===null?'FALLBACK_ALL':'SCOPED')+
  ' groups='+selected.join(','));
 if(selected.length===0){console.log('C996_SOURCE_SCOPE_NO_RELEVANT_TESTS');return;}
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
 if(failed)process.exitCode=1;
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1])
 main().catch(e=>{console.error('C996_SOURCE_CHECK_FAILED '+e.message);process.exitCode=1;});

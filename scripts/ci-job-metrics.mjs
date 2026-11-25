// Read-only CI job observability based on GitHub's official Actions metadata.
// No logs, artifacts, runner secrets, new scheduling, or operational writes.
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

export const REPOSITORIES=Object.freeze([
 'ansqhd5774-Choi/zgmini','ansqhd5774-Choi/zgmini-pc-control'
]);
const FINAL=new Set(['success','failure','timed_out','cancelled','neutral','skipped']);

function instant(value){
 if(typeof value!=='string'||! /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value))
  throw Error('CI_METRICS_TIMESTAMP_UNVERIFIED');
 const ms=Date.parse(value);
 if(!Number.isFinite(ms))throw Error('CI_METRICS_TIMESTAMP_UNVERIFIED');
 return ms;
}
const mean=a=>a.length?Math.round(a.reduce((s,v)=>s+v,0)/a.length*10)/10:null;

export function summarizeJobs(jobs){
 if(!Array.isArray(jobs))throw Error('CI_METRICS_JOBS_UNVERIFIED');
 const queue=[],execution=[],byConclusion={};
 let excludedNoStart=0,skipped=0;
 for(const job of jobs){
  if(!job||job.status!=='completed'||!FINAL.has(job.conclusion))
   throw Error('CI_METRICS_JOB_STATE_UNVERIFIED');
  byConclusion[job.conclusion]=(byConclusion[job.conclusion]||0)+1;
  if(job.conclusion==='skipped'){skipped++;continue;}
  // GitHub may cancel a queued job without assigning a runner.
  if(job.conclusion==='cancelled'&&!job.started_at){
   excludedNoStart++;continue;
  }
  const created=instant(job.created_at),started=instant(job.started_at),
   completed=instant(job.completed_at);
  if(started<created||completed<started)throw Error('CI_METRICS_NEGATIVE_DURATION');
  queue.push((started-created)/1000);
  execution.push((completed-started)/1000);
 }
 return {jobsTotal:jobs.length,jobsWithTiming:queue.length,
  jobsExcludedNoStart:excludedNoStart,jobsSkipped:skipped,
  byConclusion,meanQueueSeconds:mean(queue),
  meanExecutionSeconds:mean(execution),
  maxQueueSeconds:queue.length?Math.max(...queue):null,
  maxExecutionSeconds:execution.length?Math.max(...execution):null};
}

export async function collectMetrics({repository,workflow,limit=10,request}){
 if(!REPOSITORIES.includes(repository))throw Error('CI_METRICS_REPOSITORY_NOT_ALLOWED');
 if(typeof workflow!=='string'||!workflow.trim()||workflow.length>150)
  throw Error('CI_METRICS_WORKFLOW_INVALID');
 if(!Number.isInteger(limit)||limit<1||limit>20)
  throw Error('CI_METRICS_LIMIT_INVALID');
 if(typeof request!=='function')throw Error('CI_METRICS_REQUEST_REQUIRED');
 // Repository-wide latest 100 runs can exclude the workflow we are measuring.
 // Use existing read-only workflow inventory to scope the subsequent runs query.
 const inventory=await request('actions/workflows?per_page=100');
 if(!inventory||!Array.isArray(inventory.workflows)||
    !Number.isSafeInteger(inventory.total_count)||
    inventory.total_count!==inventory.workflows.length||
    inventory.workflows.length>100)
  throw Error('CI_METRICS_WORKFLOW_INVENTORY_INCOMPLETE');
 const matches=inventory.workflows.filter(w=>w?.name===workflow);
 if(matches.length!==1)throw Error(matches.length?
  'CI_METRICS_WORKFLOW_NAME_AMBIGUOUS':'CI_METRICS_WORKFLOW_NOT_FOUND');
 const workflowId=matches[0].id;
 if(!Number.isSafeInteger(workflowId)||workflowId<1)
  throw Error('CI_METRICS_WORKFLOW_ID_UNVERIFIED');
 const listed=await request('actions/workflows/'+workflowId+'/runs?per_page=100');
 if(!listed||!Array.isArray(listed.workflow_runs)||
    listed.workflow_runs.length>100||
    !Number.isSafeInteger(listed.total_count)||
    listed.total_count<listed.workflow_runs.length||
    listed.workflow_runs.some(r=>r?.workflow_id!==undefined&&
      r.workflow_id!==workflowId))
  throw Error('CI_METRICS_RUN_LIST_UNVERIFIED');
 const runs=listed.workflow_runs.filter(r=>
  r&&r.name===workflow&&r.status==='completed'&&FINAL.has(r.conclusion)
 ).slice(0,limit);
 const jobs=[];
 for(const run of runs){
  if(!Number.isSafeInteger(run.id)||run.id<1||
    !Number.isSafeInteger(run.run_attempt)||run.run_attempt<1)
   throw Error('CI_METRICS_RUN_ID_UNVERIFIED');
  const result=await request('actions/runs/'+run.id+
   '/attempts/'+run.run_attempt+'/jobs?per_page=100');
  if(!result||!Array.isArray(result.jobs)||
      !Number.isSafeInteger(result.total_count)||
      result.total_count!==result.jobs.length||
      result.total_count>100)
   throw Error('CI_METRICS_JOB_INVENTORY_INCOMPLETE');
  jobs.push(...result.jobs);
 }
 const byRunConclusion={};
 for(const run of runs)
  byRunConclusion[run.conclusion]=(byRunConclusion[run.conclusion]||0)+1;
 return {repository,workflow,workflowId,scope:'MOST_RECENT_100_WORKFLOW_RUNS',
  sampledRuns:runs.length,runIds:runs.map(r=>({id:r.id,attempt:r.run_attempt})),
  byRunConclusion,...summarizeJobs(jobs)};
}

export async function githubRead(repository,resource,token,fetcher=fetch){
 if(!REPOSITORIES.includes(repository))throw Error('CI_METRICS_REPOSITORY_NOT_ALLOWED');
 if(typeof token!=='string'||!token.trim())throw Error('CI_METRICS_TOKEN_REQUIRED');
 if(!/^(?:actions\/workflows\?per_page=100|actions\/workflows\/[1-9]\d*\/runs\?per_page=100|actions\/runs\/[1-9]\d*\/attempts\/[1-9]\d*\/jobs\?per_page=100)$/.test(resource))
  throw Error('CI_METRICS_RESOURCE_NOT_ALLOWED');
 const response=await fetcher('https://api.github.com/repos/'+repository+'/'+resource,{
  method:'GET',headers:{Authorization:'Bearer '+token,
   Accept:'application/vnd.github+json',
   'X-GitHub-Api-Version':'2022-11-28'},
  signal:AbortSignal.timeout(15000)
 });
 if(!response.ok)throw Error('CI_METRICS_GITHUB_HTTP_'+response.status);
 return response.json();
}

async function main(){
 const [repository,workflow,limitText='10',...rest]=process.argv.slice(2);
 if(rest.length||! /^\d+$/.test(limitText))
  throw Error('CI_METRICS_USAGE: node scripts/ci-job-metrics.mjs <repository> <workflow-name> [1-20]');
 const report=await collectMetrics({repository,workflow,limit:Number(limitText),
  request:resource=>githubRead(repository,resource,process.env.GITHUB_TOKEN)});
 console.log(JSON.stringify(report,null,2));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))
 main().catch(e=>{console.error(e.message);process.exitCode=1;});

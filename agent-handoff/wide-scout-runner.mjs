// Isolated GitHub-only monitoring runner. Reads only control-repo metadata,
// writes only a bounded bot summary comment to pre-existing issue #1743.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {
  WIDE_POLICY,CONTROL_REPO,OWNER,reportDecision,evaluateWideSnapshot,
  snapshotMarker,renderWideReport
} from './wide-scout.mjs';
const ROOT='https://api.github.com/repos/'+CONTROL_REPO+'/';
const stop=x=>{throw Error('WIDE_SCOUT_RUNNER_'+x)};
const allowedNames=new Set([
  'ZGMINI Handoff Queue Candidate Selector',
  'ZGMINI Agent Handoff PR Evidence CI'
]);
const workflowFiles=['agent-handoff-queue-board.yml',
  'agent-handoff-proactive-diagnostics.yml','agent-handoff-deep-diagnostics.yml'];
export function validateWideEvent(event,env){
  if(event?.repository?.full_name!==CONTROL_REPO||
    event.repository.private!==true||env.GITHUB_REPOSITORY!==CONTROL_REPO||
    env.GITHUB_REF!=='refs/heads/main'||!env.GITHUB_EVENT_PATH)stop('SCOPE');
  const kind=env.GITHUB_EVENT_NAME;
  if(kind==='schedule'){
    if(event.schedule!==WIDE_POLICY.schedule)stop('SCHEDULE');
  }else if(kind==='workflow_dispatch'){
    if(event.sender?.login!==OWNER||env.GITHUB_ACTOR!==OWNER)stop('OWNER');
  }else if(kind==='workflow_run'){
    const run=event.workflow_run;
    if(event.action!=='completed'||run?.conclusion!=='success'||
      !allowedNames.has(run.name)||run.actor?.login!==OWNER||
      (run.name==='ZGMINI Handoff Queue Candidate Selector'&&run.head_branch!=='main'))
      stop('WORKFLOW_PROVENANCE');
  }else if(kind==='issues'){
    if(event.action!=='labeled'||event.label?.name!=='handoff-agent-pending'||
      event.issue?.user?.login!==OWNER||event.issue.state!=='open'||
      !event.issue?.labels?.some?.(x=>x.name==='agent-handoff')||
      env.GITHUB_ACTOR!==OWNER)stop('ISSUE_PROVENANCE');
  }else if(kind==='push'){
    if(event.ref!=='refs/heads/main'||event.deleted===true||
      env.GITHUB_ACTOR!==OWNER)stop('PUSH_PROVENANCE');
  }else stop('EVENT');
}
function ledgerGuard(x){
  if(x?.number!==WIDE_POLICY.ledgerIssue||x.state!=='open'||x.pull_request||
    x.user?.login!==OWNER||typeof x.body!=='string'||
    !x.body.includes('<!-- ZGMINI_PROACTIVE_DIAGNOSTIC_LEDGER_R1 -->')||
    !Number.isSafeInteger(x.comments)||x.comments>WIDE_POLICY.maxComments)
      stop('LEDGER_PROOF');
}
async function request(resource,{body=null}={}){
  if(!process.env.GITHUB_TOKEN)stop('TOKEN');
  const response=await fetch(ROOT+resource,{
    method:body===null?'GET':'POST',
    headers:{
      Authorization:'Bearer '+process.env.GITHUB_TOKEN,
      Accept:'application/vnd.github+json',
      'X-GitHub-Api-Version':'2022-11-28',
      ...(body!==null?{'Content-Type':'application/json'}:{})
    },
    ...(body!==null?{body:JSON.stringify(body)}:{}),
    signal:AbortSignal.timeout(20000)
  });
  if(response.status===404&&body===null)return null;
  if(!response.ok)stop('GITHUB_HTTP_'+response.status);
  return response.json();
}
async function paged(resource,maxPages,stopAfterOlder,now){
  const result=[];
  let complete=false;
  for(let p=1;p<=maxPages;p++){
    const sep=resource.includes('?')?'&':'?';
    const values=await request(resource+sep+'per_page=100&page='+p);
    if(!Array.isArray(values))stop('PAGE_FORMAT');
    result.push(...values);
    if(values.length<100){complete=true;break;}
    if(stopAfterOlder){
      const cutoff=now-WIDE_POLICY.lookbackDays*86400000;
      const oldest=Date.parse(values.at(-1)?.created_at||'');
      if(Number.isFinite(oldest)&&oldest<cutoff){complete=true;break;}
    }
  }
  return {items:result,complete};
}
export const RUN_STATUS_PARTITIONS=Object.freeze([
  'failure','timed_out','cancelled','action_required',
  'queued','waiting','in_progress','pending'
]);
async function recentRuns(now){
  const cutoff=now-WIDE_POLICY.lookbackDays*86400000;
  const after=new Date(cutoff).toISOString().slice(0,10);
  const batches=await Promise.all(RUN_STATUS_PARTITIONS.map(async status=>{
    const items=[];let complete=false;
    for(let page=1;page<=2;page++){
      const x=await request('actions/runs?status='+encodeURIComponent(status)+
        '&created='+encodeURIComponent('>='+after)+'&per_page=100&page='+page);
      if(!Array.isArray(x?.workflow_runs))stop('RUN_PAGINATION_'+status);
      items.push(...x.workflow_runs);
      if(x.workflow_runs.length<100){complete=true;break;}
      const oldest=Date.parse(x.workflow_runs.at(-1)?.created_at||'');
      if(Number.isFinite(oldest)&&oldest<cutoff){complete=true;break;}
    }
    return {status,items,complete};
  }));
  // A run may transition while parallel GitHub queries are in flight.
  // Keep the latest available state, but do not declare the inventory complete.
  const map=new Map();let complete=batches.every(x=>x.complete);
  const rank={completed:4,in_progress:3,waiting:2,queued:1,pending:0};
  for(const batch of batches){
    for(const run of batch.items){
      if(!Number.isSafeInteger(run?.id)||run.id<1)stop('RUN_IDENTITY');
      const prev=map.get(run.id);
      if(prev){
        complete=false;
        if((rank[run.status]??-1)>(rank[prev.status]??-1))map.set(run.id,run);
      }else map.set(run.id,run);
    }
  }
  const items=[...map.values()].sort((a,b)=>
    Date.parse(b.created_at)-Date.parse(a.created_at)||b.id-a.id);
  return {items,complete,coverage:batches.map(x=>({
    status:x.status,count:x.items.length,complete:x.complete
  }))};
}
async function readWorkflows(){
  const values=[];
  for(const file of workflowFiles){
    const response=await request('actions/workflows/'+file);
    values.push({file,state:response?.state??'UNAVAILABLE'});
  }
  return values;
}
async function readLedgerComments(){
  const x=await paged('issues/'+WIDE_POLICY.ledgerIssue+'/comments',4,false,Date.now());
  if(!x.complete&&x.items.length>=WIDE_POLICY.maxComments)stop('LEDGER_PAGE_LIMIT');
  return x.items;
}
export async function scoutWide(io,now){
  if(!io||!Number.isFinite(now)||
    ['getRuns','getIssues','getPulls','getWorkflows','getScheduleCount',
      'getLedger','getComments','postComment'].some(k=>typeof io[k]!=='function'))
    stop('IO');
  ledgerGuard(await io.getLedger());
  const [runs,issues,pulls,workflows,schedules]=await Promise.all([
    io.getRuns(now),io.getIssues(now),io.getPulls(now),
    io.getWorkflows(),io.getScheduleCount()
  ]);
  const report=evaluateWideSnapshot({
    runs:runs.items,issues:issues.items,pulls:pulls.items,
    workflows,scheduleRunCount:schedules,coverage:runs.coverage,
    complete:{runs:runs.complete,issues:issues.complete,pulls:pulls.complete}
  },now);
  const textReport=renderWideReport(report);
  let comments=await io.getComments();
  let decision=reportDecision(comments,report,now);
  let posted=0;
  if(decision==='REPORT'){
    ledgerGuard(await io.getLedger());
    comments=await io.getComments();
    decision=reportDecision(comments,report,now);
    if(decision==='REPORT'){
      try{await io.postComment(textReport);}
      catch(e){
        comments=await io.getComments();
        if(!comments.some(x=>x?.body?.includes(snapshotMarker(report))&&
          x?.user?.login==='github-actions[bot]'))throw e;
      }
      comments=await io.getComments();
      if(!comments.some(x=>x?.body?.includes(snapshotMarker(report))&&
        x?.user?.login==='github-actions[bot]'))stop('READBACK');
      posted=1;
    }
  }
  return {report,posted,decision,generated:textReport,
    operationalWrites:0,aiCalls:0,codeEdits:0};
}
export async function main(env=process.env){
  const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
  validateWideEvent(event,env);
  const result=await scoutWide({
    getRuns:recentRuns,
    getIssues:now=>paged('issues?state=open&labels=agent-handoff%2Chandoff-agent-pending'+
      '&sort=created&direction=desc',2,true,now),
    getPulls:now=>paged('pulls?state=open&sort=updated&direction=desc',1,false,now),
    getWorkflows:readWorkflows,
    getScheduleCount:async()=>{
      const x=await request('actions/runs?event=schedule&per_page=1');
      if(!Number.isSafeInteger(x?.total_count))stop('SCHEDULE_COUNT_UNVERIFIED');
      return x.total_count;
    },
    getLedger:()=>request('issues/'+WIDE_POLICY.ledgerIssue),
    getComments:readLedgerComments,
    postComment:body=>request('issues/'+WIDE_POLICY.ledgerIssue+'/comments',{body:{body}})
  },Date.now());
  if(env.GITHUB_STEP_SUMMARY)fs.appendFileSync(env.GITHUB_STEP_SUMMARY,
    '# GitHub 확대 능동 감시 R3\n\n'+result.generated+'\n\n댓글 저장: '+
    result.posted+' / 결정: '+result.decision+'\n');
  process.stdout.write(JSON.stringify({
    schema:WIDE_POLICY.version,
    runs:result.report.inventory.runs,
    issues:result.report.inventory.issues,
    pulls:result.report.inventory.pulls,
    completeness:result.report.inventory.complete,
    counts:result.report.counts,
    schedule:result.report.schedule,
    posted:result.posted,decision:result.decision,
    operationalWrites:0,aiCalls:0
  })+'\n');
  return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)
  main().catch(e=>{process.stderr.write(e.message+'\n');process.exitCode=1;});

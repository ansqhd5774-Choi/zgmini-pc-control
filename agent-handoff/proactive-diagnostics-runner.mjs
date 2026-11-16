// GitHub-only proactive diagnosis runner. GitHub API reads, bounded evidence,
 // and append-only GitHub diagnostic comments are the only side effects.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {
  SCOUT_POLICY,selectRecentFailures,recordedFor,classifyLogs,
  assertSameRun,buildDiagnosis
} from './proactive-diagnostics.mjs';

export const REPO='ansqhd5774-Choi/zgmini-pc-control';
export const OWNER='ansqhd5774-Choi';
const API='https://api.github.com/repos/'+REPO+'/';
const BOT='github-actions[bot]';
const stop=s=>{throw Error('PROACTIVE_DIAG_RUNNER_'+s);};
const goodId=n=>Number.isSafeInteger(n)&&n>0;
const marker='<!-- ZGMINI_PROACTIVE_DIAGNOSTIC_LEDGER_R1 -->';

export function validateScoutEvent(event,env){
  if(!event||event.repository?.full_name!==REPO||
    event.repository.private!==true||env.GITHUB_REPOSITORY!==REPO||
    typeof env.GITHUB_EVENT_PATH!=='string'||!env.GITHUB_EVENT_PATH)
    stop('SCOPE_STOP');
  if(env.GITHUB_EVENT_NAME==='schedule'){
    if(env.GITHUB_REF!=='refs/heads/main'||event.schedule!==SCOUT_POLICY.schedule)
      stop('SCHEDULE_STOP');
  }else if(env.GITHUB_EVENT_NAME==='workflow_dispatch'){
    if(env.GITHUB_REF!=='refs/heads/main'||
      event.sender?.login!==OWNER||env.GITHUB_ACTOR!==OWNER)
      stop('DISPATCH_STOP');
  }else stop('EVENT_TYPE_STOP');
}
function assertLedger(issue){
  if(issue?.number!==SCOUT_POLICY.ledgerIssueNumber||
    issue.state!=='open'||issue.pull_request||
    issue.user?.login!==OWNER||typeof issue.body!=='string'||
    !issue.body.includes(marker)||issue.comments>400)
    stop('LEDGER_NOT_VERIFIED');
}
export function lookbackQuery(nowMs){
  const cutoff=new Date(nowMs-SCOUT_POLICY.lookbackDays*86400000);
  if(!Number.isFinite(cutoff.getTime()))stop('CLOCK_INVALID');
  return '>='+cutoff.toISOString().slice(0,10);
}
export async function scanLatest(io,nowMs){
  if(!io||['listRuns','getRun','getJobs','getLog','readLedger','readComments','postComment']
    .some(k=>typeof io[k]!=='function'))stop('IO_REQUIRED');
  const ledger=await io.readLedger();
  assertLedger(ledger);
  const inventory=await io.listRuns(lookbackQuery(nowMs));
  const selected=selectRecentFailures(inventory,nowMs);
  let comments=await io.readComments();
  if(!Array.isArray(comments)||comments.length>400)stop('COMMENTS_INCOMPLETE');
  let existing=0,posted=0;
  const observed=[];
  for(const run of selected.recent){
    if(recordedFor(comments,run)){existing++;continue;}
    if(posted>=SCOUT_POLICY.maxNewComments)break;
    const live=await io.getRun(run.id);
    assertSameRun(run,live);
    const jobs=await io.getJobs(run.id,run.run_attempt);
    if(!Array.isArray(jobs)||jobs.length>SCOUT_POLICY.maxJobsPerRun)
      stop('JOBS_INCOMPLETE');
    // Job metadata and log bytes are untrusted; only fixed classifications leave memory.
    let unavailable=false;
    const hints=[];
    const failed=jobs.filter(j=>['failure','timed_out'].includes(j.conclusion)).slice(0,2);
    for(const job of failed){
      if(!goodId(job.id))stop('JOB_ID_INVALID');
      try{
        const found=classifyLogs(await io.getLog(job.id));
        hints.push(...found);
      }catch{unavailable=true;}
    }
    const report=buildDiagnosis(live,jobs,hints,nowMs,{logsUnavailable:unavailable});
    // Re-read ledger and run before the only write. Strictly fail on stale/unknown proof.
    assertLedger(await io.readLedger());
    const fresh=await io.getRun(run.id);
    assertSameRun(live,fresh);
    comments=await io.readComments();
    if(recordedFor(comments,run)){existing++;continue;}
    if(comments.length>=400)stop('LEDGER_CAP_STOP');
    try{await io.postComment(report);}
    catch{
      comments=await io.readComments();
      if(!recordedFor(comments,run))stop('WRITE_RESULT_UNKNOWN');
    }
    comments=await io.readComments();
    if(!recordedFor(comments,run))stop('WRITE_READBACK_STOP');
    posted++;
    observed.push({runId:run.id,attempt:run.run_attempt,classification:'EVIDENCE_REVIEW'});
  }
  return Object.freeze({schema:SCOUT_POLICY.version,
    cutoff:selected.cutoff,scanned:inventory.length,
    recentFailures:selected.recent.length,excludedOld:selected.excludedOld,
    alreadyRecorded:existing,newReports:posted,limit:SCOUT_POLICY.maxNewComments,
    observed,pcOperationalWrites:0,aiCalls:0,automaticRetries:0,
    ledgerIssue:SCOUT_POLICY.ledgerIssueNumber});
}
async function request(resource,{method='GET',body,text=false}={}){
  if(!process.env.GITHUB_TOKEN)stop('TOKEN_MISSING');
  const res=await fetch(API+resource,{
    method,headers:{'Authorization':'Bearer '+process.env.GITHUB_TOKEN,
      'Accept':'application/vnd.github+json',
      'X-GitHub-Api-Version':'2022-11-28',
      ...(body?{'Content-Type':'application/json'}:{})},
    ...(body?{body:JSON.stringify(body)}:{}),
    signal:AbortSignal.timeout(20000)
  });
  if(!res.ok)stop('GITHUB_HTTP_'+res.status);
  if(!text)return res.json();
  // Limit the log read to the first 128 KiB; never persist or print log text.
  if(!res.body)stop('LOG_EMPTY');
  const reader=res.body.getReader();
  const chunks=[];let len=0;
  try{
    while(len<131072){
      const {done,value}=await reader.read();
      if(done)break;
      const n=Math.min(value.length,131072-len);
      chunks.push(value.subarray(0,n));len+=n;
      if(n<value.length)break;
    }
  }finally{await reader.cancel().catch(()=>{});}
  const merged=new Uint8Array(len);let offset=0;
  for(const c of chunks){merged.set(c,offset);offset+=c.length;}
  return new TextDecoder().decode(merged);
}
async function listPaged(resource,limit){
  const out=[];
  for(let page=1;page<=limit;page++){
    const sep=resource.includes('?')?'&':'?';
    const rows=await request(resource+sep+'per_page=100&page='+page);
    if(!Array.isArray(rows))stop('PAGE_FORMAT_STOP');
    out.push(...rows);
    if(rows.length<100)return out;
  }
  stop('PAGE_LIMIT_STOP');
}
async function listRuns(created){
  const out=[];
  for(const status of ['failure','timed_out']){
    const resource='actions/runs?status='+status+'&created='+encodeURIComponent(created);
    const pages=await listPagedRuns(resource);
    out.push(...pages);
  }
  return out;
}
async function listPagedRuns(resource){
  const out=[];
  for(let page=1;page<=4;page++){
    const result=await request(resource+'&per_page=100&page='+page);
    if(!Array.isArray(result?.workflow_runs))stop('RUN_PAGE_INVALID');
    out.push(...result.workflow_runs);
    if(result.workflow_runs.length<100)return out;
  }
  stop('RUN_PAGE_LIMIT_STOP');
}
export async function main(env=process.env){
  if(!env.GITHUB_EVENT_PATH)stop('EVENT_PATH_MISSING');
  const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
  validateScoutEvent(event,env);
  const issue=SCOUT_POLICY.ledgerIssueNumber;
  const result=await scanLatest({
    listRuns,
    getRun:id=>request('actions/runs/'+id),
    getJobs:async(id,attempt)=>{
      // Pin attempt rather than silently reading a newer retry's job evidence.
      const first=await request('actions/runs/'+id+'/attempts/'+attempt+'/jobs?per_page=100&page=1');
      if(!Array.isArray(first.jobs)||first.jobs.length>=100)stop('JOBS_PAGE_STOP');
      return first.jobs;
    },
    getLog:id=>request('actions/jobs/'+id+'/logs',{text:true}),
    readLedger:()=>request('issues/'+issue),
    readComments:()=>listPaged('issues/'+issue+'/comments',4),
    postComment:body=>request('issues/'+issue+'/comments',{method:'POST',body:{body}})
  },Date.now());
  const message='# ZGMINI 능동 GitHub 진단\n\n'+
    '- 최근 7일 최신순 후보: '+result.recentFailures+'\n'+
    '- 새 진단 댓글: '+result.newReports+'\n'+
    '- 이미 기록된 실행: '+result.alreadyRecorded+'\n'+
    '- 원본 관제 Issue: #'+issue+'\n'+
    '- 운영 PC 쓰기/재실행: 0\n';
  if(env.GITHUB_STEP_SUMMARY)fs.appendFileSync(env.GITHUB_STEP_SUMMARY,message,'utf8');
  process.stdout.write(JSON.stringify(result)+'\n');
  return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)
  main().catch(e=>{process.stderr.write(e.message+'\n');process.exitCode=1;});

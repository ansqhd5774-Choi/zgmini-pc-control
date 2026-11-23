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
  if(env.GITHUB_REF!=='refs/heads/main')stop('MAIN_REF_STOP');
  if(env.GITHUB_EVENT_NAME==='schedule'){
    if(event.schedule!==SCOUT_POLICY.schedule)stop('SCHEDULE_STOP');
  }else if(env.GITHUB_EVENT_NAME==='workflow_dispatch'){
    if(event.sender?.login!==OWNER||env.GITHUB_ACTOR!==OWNER)
      stop('DISPATCH_STOP');
  }else if(env.GITHUB_EVENT_NAME==='workflow_run'){
    const run=event.workflow_run;
    if(event.action!=='completed'||run?.conclusion!=='success'||
      !['ZGMINI Handoff Queue Candidate Selector',
        'ZGMINI Agent Handoff PR Evidence CI'].includes(run.name)||
      run.actor?.login!==OWNER||
      (run.name==='ZGMINI Handoff Queue Candidate Selector'&&
       run.head_branch!=='main'))stop('FALLBACK_WORKFLOW_STOP');
  }else if(env.GITHUB_EVENT_NAME==='issues'){
    if(event.action!=='labeled'||event.label?.name!=='handoff-agent-pending'||
      event.issue?.state!=='open'||event.issue?.user?.login!==OWNER||
      !event.issue?.labels?.some?.(x=>x.name==='agent-handoff')||
      env.GITHUB_ACTOR!==OWNER)stop('FALLBACK_ISSUE_STOP');
  }else stop('EVENT_TYPE_STOP');
}

const SHARD_PREFIX='<!-- ZGMINI_PROACTIVE_DIAGNOSTIC_LEDGER_R2';
const shardTitle=(month,index)=>'ZGMINI Proactive Diagnostics '+month+' #'+index;
const shardMarker=(month,index)=>SHARD_PREFIX+' month:'+month+' shard:'+index+' -->';
const shardMonth=run=>{
  const date=typeof run?.created_at==='string'?run.created_at.slice(0,7):'';
  if(!/^\d{4}-\d\d$/.test(date))stop('SHARD_MONTH_INVALID');
  return date;
};
function assertLegacyLedger(issue){
  if(issue?.number!==SCOUT_POLICY.ledgerIssueNumber||
     issue.state!=='open'||issue.pull_request||
     issue.user?.login!==OWNER||typeof issue.body!=='string'||
     !issue.body.includes(marker))stop('LEDGER_NOT_VERIFIED');
}
// The historical 167 R1 reports are immutable, not a growing shared queue.
// Always read only the prefix ending at a known authenticated bot comment.
export async function readLegacyProactiveArchive(readPage){
  if(typeof readPage!=='function')stop('ARCHIVE_READER_INVALID');
  const rows=[];
  for(let page=1;page<=3;page++){
    const part=await readPage(page);
    if(!Array.isArray(part)||part.length>100)stop('ARCHIVE_PAGE_UNVERIFIED');
    for(const c of part){
      rows.push(c);
      if(c?.id===SCOUT_POLICY.legacyAnchorCommentId){
        if(c.user?.login!==BOT||
           c.body?.split('\n')[0]!=='<!-- ZGMINI_PROACTIVE_DIAG_R1 run:44467706543 attempt:1 -->')
          stop('ARCHIVE_ANCHOR_INVALID');
        const reports=rows.filter(x=>typeof x.body==='string'&&
          x.body.startsWith('<!-- ZGMINI_PROACTIVE_DIAG_R1 run:'));
        if(reports.length!==SCOUT_POLICY.legacyReportCount||
           reports.some(x=>x.user?.login!==BOT||!goodId(x.id)||
             typeof x.created_at!=='string'))
          stop('ARCHIVE_REPORT_INCOMPLETE');
        return rows;
      }
    }
    if(part.length<100)break;
  }
  stop('ARCHIVE_ANCHOR_NOT_FOUND');
}
function assertShard(issue,month,index){
  if(issue?.number<=0||!goodId(issue?.number)||issue.pull_request||
     issue.title!==shardTitle(month,index)||
     typeof issue.body!=='string'||!issue.body.includes(shardMarker(month,index))||
     ![OWNER,BOT].includes(issue.user?.login)||
     !['open','closed'].includes(issue.state))
    stop('SHARD_IDENTITY_UNVERIFIED');
}
function checkedShardList(shards,month){
  if(!Array.isArray(shards)||shards.length>100)stop('SHARD_INDEX_INCOMPLETE');
  const numbers=new Set();
  const entries=shards.map(issue=>{
    const match=typeof issue?.title==='string'?
      issue.title.match(/^ZGMINI Proactive Diagnostics (\d{4}-\d\d) #([1-9]\d*)$/):null;
    if(!match||match[1]!==month)stop('SHARD_INDEX_DRIFT');
    const index=Number(match[2]);
    if(!Number.isSafeInteger(index)||index>100||numbers.has(index))
      stop('SHARD_INDEX_CONFLICT');
    assertShard(issue,month,index);
    numbers.add(index);
    return {issue,index};
  }).sort((a,b)=>a.index-b.index);
  if(entries.some((e,i)=>e.index!==i+1))stop('SHARD_INDEX_GAP');
  return entries;
}
async function loadShardEvidence(io,month){
  const shards=checkedShardList(await io.findShards(month),month);
  const entries=[];
  for(const {issue,index} of shards){
    const comments=await io.readShardComments(issue.number);
    if(!Array.isArray(comments)||comments.length>400)
      stop('SHARD_COMMENTS_INCOMPLETE');
    entries.push({issue,index,comments});
  }
  return entries;
}
function recordedInEntries(entries,run){
  let found=false;
  for(const {comments} of entries){
    if(recordedFor(comments,run)){
      if(found)stop('SHARD_DUPLICATE_CROSS_INDEX');
      found=true;
    }
  }
  return found;
}
async function ensureShard(io,month,entries){
  const last=entries.at(-1);
  if(last?.issue.state==='open'&&
     last.comments.length<SCOUT_POLICY.maxShardComments)return last.issue;
  const index=(last?.index??0)+1;
  if(index>100)stop('SHARD_INDEX_CAP');
  let result;
  try{result=await io.createShard(month,index,shardTitle(month,index),shardMarker(month,index));}
  catch(error){
    // A timed-out POST may have created an Issue. Never blindly send again.
    const after=await loadShardEvidence(io,month);
    const found=after.find(x=>x.index===index);
    if(!found){
      // Preserve an authenticated HTTP denial's fixed phase after readback.
      if(/^PROACTIVE_DIAG_RUNNER_GITHUB_HTTP_(?:401|403)_SHARD_CREATE(?:_(?:RATE_LIMIT_SIGNAL|CAUSE_UNVERIFIED))?$/.test(error?.message??''))throw error;
      stop('SHARD_CREATE_OUTCOME_UNKNOWN');
    }
    return found.issue;
  }
  if(!goodId(result?.number))stop('SHARD_CREATE_RESULT_INVALID');
  const verified=await io.readShard(result.number);
  assertShard(verified,month,index);
  if(verified.number!==result.number)stop('SHARD_CREATE_READBACK');
  return verified;
}
export function lookbackQuery(nowMs){
  const cutoff=new Date(nowMs-SCOUT_POLICY.lookbackDays*86400000);
  if(!Number.isFinite(cutoff.getTime()))stop('CLOCK_INVALID');
  return '>='+cutoff.toISOString().slice(0,10);
}
export async function scanLatest(io,nowMs){
  if(!io||['listRuns','getRun','getJobs','getLog','readLedger','readLegacyComments',
    'findShards','readShard','readShardComments','createShard','postComment']
    .some(k=>typeof io[k]!=='function'))stop('IO_REQUIRED');
  assertLegacyLedger(await io.readLedger());
  const legacy=await io.readLegacyComments();
  if(!Array.isArray(legacy)||!legacy.some(x=>x.id===SCOUT_POLICY.legacyAnchorCommentId))
    stop('ARCHIVE_NOT_VERIFIED');
  const inventory=await io.listRuns(lookbackQuery(nowMs));
  const selected=selectRecentFailures(inventory,nowMs);
  let existing=0,posted=0,unverified=selected.unverified;
  const observed=[];
  // Reuse authenticated month evidence for early dedup checks only.
  // A missing marker still requires a fresh pre-write readback below.
  const checkedMonths=new Map();
  for(const run of selected.recent){
    if(posted>=SCOUT_POLICY.maxNewComments)break;
    if(recordedFor(legacy,run)){existing++;continue;}
    const month=shardMonth(run);
    let shards=checkedMonths.get(month);
    if(!shards){
      shards=await loadShardEvidence(io,month);
      checkedMonths.set(month,shards);
    }
    if(recordedInEntries(shards,run)){existing++;continue;}
    let live,jobs;
    try{
      live=await io.getRun(run.id);
      assertSameRun(run,live);
      jobs=await io.getJobs(run.id,run.run_attempt);
      if(!Array.isArray(jobs)||jobs.length>SCOUT_POLICY.maxJobsPerRun)
        stop('JOBS_INCOMPLETE');
    }catch(error){
      // A different Run remains independently reviewable. Never publish this
      // run without verified identity and complete jobs.
      if(error?.message?.includes('GITHUB_HTTP_401')||
         error?.message?.includes('GITHUB_HTTP_403'))throw error;
      unverified++;continue;
    }
    let unavailable=false;
    const hints=[];
    const failed=jobs.filter(j=>['failure','timed_out'].includes(j.conclusion)).slice(0,2);
    for(const job of failed){
      if(!goodId(job.id)){unavailable=true;continue;}
      try{hints.push(...classifyLogs(await io.getLog(job.id)));}
      catch(error){
        if(/GITHUB_HTTP_(401|403)/.test(error?.message||''))throw error;
        unavailable=true;
      }
    }
    const report=buildDiagnosis(live,jobs,hints,nowMs,{logsUnavailable:unavailable});
    // Before a GitHub write, independently verify Run and immutable archive.
    assertLegacyLedger(await io.readLedger());
    const fresh=await io.getRun(run.id);
    assertSameRun(live,fresh);
    if(recordedFor(legacy,run)){existing++;continue;}
    shards=await loadShardEvidence(io,month);
    if(recordedInEntries(shards,run)){existing++;continue;}
    let target=await ensureShard(io,month,shards);
    // The immediately preceding pre-write readback already authenticated
    // a reused shard. Only a new shard requires another full index read.
    if(!shards.some(x=>x.issue.number===target.number))
      shards=await loadShardEvidence(io,month);
    if(recordedInEntries(shards,run)){existing++;continue;}
    const actual=shards.find(x=>x.issue.number===target.number);
    if(!actual||actual.issue.state!=='open'||actual.comments.length>=
      SCOUT_POLICY.maxShardComments)stop('SHARD_WRITE_SCOPE_DRIFT');
    try{await io.postComment(target.number,report);}
    catch(error){
      const after=await loadShardEvidence(io,month);
      if(!recordedInEntries(after,run)){
        // Preserve fixed HTTP denial phase without retrying an uncertain POST.
        if(/^PROACTIVE_DIAG_RUNNER_GITHUB_HTTP_(?:401|403)_COMMENT_WRITE(?:_(?:RATE_LIMIT_SIGNAL|CAUSE_UNVERIFIED))?$/.test(error?.message??''))throw error;
        stop('WRITE_RESULT_UNKNOWN');
      }
    }
    const after=await loadShardEvidence(io,month);
    if(!recordedInEntries(after,run))stop('WRITE_READBACK_STOP');
    // A verified write must update the early-dedup snapshot for later runs.
    checkedMonths.set(month,after);
    posted++;
    observed.push({runId:run.id,attempt:run.run_attempt,
      shardIssue:target.number,classification:'EVIDENCE_REVIEW'});
  }
  return Object.freeze({schema:SCOUT_POLICY.version,
    cutoff:selected.cutoff,scanned:inventory.length,
    recentFailures:selected.recent.length,excludedOld:selected.excludedOld,
    unverified,alreadyRecorded:existing,newReports:posted,
    limit:SCOUT_POLICY.maxNewComments,observed,
    pcOperationalWrites:0,aiCalls:0,automaticRetries:0,
    legacyLedgerIssue:SCOUT_POLICY.ledgerIssueNumber,reportStore:'MONTHLY_SHARDED_ISSUES'});
}

// Report only a fixed API phase; never print query strings, tokens or response bodies.
export function githubRequestPhase(resource,method='GET'){
  if(resource.startsWith('actions/runs?'))return 'RUN_INVENTORY';
  if(/^actions\/runs\/\d+\/attempts\/\d+\/jobs\?/.test(resource))return 'RUN_JOBS';
  if(/^actions\/runs\/\d+$/.test(resource))return 'RUN_IDENTITY';
  if(/^actions\/jobs\/\d+\/logs$/.test(resource))return 'JOB_LOG';
  if(resource.startsWith('search/issues?'))return 'SHARD_INDEX';
  if(/^issues\/\d+\/comments\?/.test(resource))return 'LEDGER_COMMENTS';
  if(/^issues\/\d+\/comments$/.test(resource))return method==='POST'?'COMMENT_WRITE':'LEDGER_COMMENTS';
  if(/^issues\/\d+$/.test(resource))return 'ISSUE_IDENTITY';
  if(resource==='issues'&&method==='POST')return 'SHARD_CREATE';
  return 'OTHER';
}
// Only authenticated response headers are used; never log raw headers/body.
export function github403Signal(headers){
  if(headers?.get?.('x-ratelimit-remaining')==='0'||
     headers?.get?.('retry-after')!=null)return 'RATE_LIMIT_SIGNAL';
  return 'CAUSE_UNVERIFIED';
}
// Keep only 128 KiB of private log content in memory (16 KiB head and
// 112 KiB tail). Consume at most 4 MiB of transport; beyond that, report
// evidence as unavailable rather than misrepresenting an incomplete tail.
// Never return raw log text to GitHub Issues or workflow stdout.
export async function readBoundedLogEvidence(reader,{maxBytes=4194304}={}){
  if(typeof reader?.read!=='function'||!Number.isSafeInteger(maxBytes)||maxBytes<131072)
    stop('LOG_READER_INVALID');
  const head=new Uint8Array(16384),tail=new Uint8Array(114688);
  let headLen=0,tailLen=0,total=0;
  for(;;){
    const {done,value}=await reader.read();
    if(done)break;
    if(!(value instanceof Uint8Array))stop('LOG_CHUNK_INVALID');
    total+=value.length;
    if(total>maxBytes)stop('LOG_READ_LIMIT');
    if(headLen<head.length){
      const n=Math.min(value.length,head.length-headLen);
      head.set(value.subarray(0,n),headLen);headLen+=n;
    }
    if(value.length>=tail.length){
      tail.set(value.subarray(value.length-tail.length));tailLen=tail.length;
    }else if(tailLen+value.length<=tail.length){
      tail.set(value,tailLen);tailLen+=value.length;
    }else{
      const excess=tailLen+value.length-tail.length;
      tail.copyWithin(0,excess,tailLen);
      tail.set(value,tailLen-excess);
      tailLen=tail.length;
    }
  }
  if(total===0)stop('LOG_EMPTY');
  const decoder=new TextDecoder();
  if(total<=131072){
    // The ring holds only 112 KiB. A 112-128 KiB response needs its first
    // bytes from head before the tail, otherwise the initial error is lost.
    if(total<=tail.length)return decoder.decode(tail.subarray(0,tailLen));
    const prefix=total-tailLen;
    const full=new Uint8Array(total);
    full.set(head.subarray(0,prefix));
    full.set(tail.subarray(0,tailLen),prefix);
    return decoder.decode(full);
  }
  // Drop cut boundary lines, preventing fabricated words across joined parts.
  const headText=decoder.decode(head.subarray(0,headLen));
  const tailText=decoder.decode(tail.subarray(0,tailLen));
  const headEnd=headText.lastIndexOf('\n');
  const tailStart=tailText.indexOf('\n');
  return (headEnd<0?'':headText.slice(0,headEnd+1))+'\n'+
    (tailStart<0?'':tailText.slice(tailStart+1));
}
async function request(resource,{method='GET',body,text=false}={}){
  if(!process.env.GITHUB_TOKEN)stop('TOKEN_MISSING');
  const endpoint=resource.startsWith('search/')?'https://api.github.com/':API;
  const res=await fetch(endpoint+resource,{
    method,headers:{'Authorization':'Bearer '+process.env.GITHUB_TOKEN,
      'Accept':'application/vnd.github+json',
      'X-GitHub-Api-Version':'2022-11-28',
      ...(body?{'Content-Type':'application/json'}:{})},
    ...(body?{body:JSON.stringify(body)}:{}),
    signal:AbortSignal.timeout(20000)
  });
  if(!res.ok)stop('GITHUB_HTTP_'+res.status+'_'+githubRequestPhase(resource,method)+
    (res.status===403?'_'+github403Signal(res.headers):''));
  if(!text)return res.json();
  if(!res.body)stop('LOG_EMPTY');
  const reader=res.body.getReader();
  try{return await readBoundedLogEvidence(reader);}
  finally{await reader.cancel().catch(()=>{});}
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
  for(let page=1;page<=10;page++){
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
    readLegacyComments:()=>readLegacyProactiveArchive(page=>
      request('issues/'+issue+'/comments?per_page=100&page='+page)),
    findShards:async month=>{
      const q='repo:'+REPO+' in:title "ZGMINI Proactive Diagnostics '+month+'"';
      const all=[];
      for(let page=1;page<=2;page++){
        const result=await request('search/issues?q='+encodeURIComponent(q)+
          '&per_page=100&page='+page);
        if(!Array.isArray(result?.items)||result.total_count>200)
          stop('SHARD_SEARCH_INCOMPLETE');
        all.push(...result.items);
        if(result.items.length<100)break;
      }
      return all.filter(x=>!x.pull_request&&
        typeof x.title==='string'&&
        x.title.startsWith('ZGMINI Proactive Diagnostics '+month+' #'));
    },
    readShard:n=>request('issues/'+n),
    readShardComments:n=>listPaged('issues/'+n+'/comments',SCOUT_POLICY.maxShardPages),
    createShard:(month,index,title,body)=>request('issues',{method:'POST',
      body:{title,body:body+'\n\nVerified GitHub Actions failures for '+month+
        '. Append-only diagnostic evidence. No PC action.',
        labels:[]}}),
    postComment:(n,body)=>request('issues/'+n+'/comments',{method:'POST',
      body:{body}})
  },Date.now());
  const message='# ZGMINI 능동 GitHub 진단\n\n'+
    '- 최근 7일 최신순 후보: '+result.recentFailures+'\n'+
    '- 새 진단 댓글: '+result.newReports+'\n'+
    '- 이미 기록된 실행: '+result.alreadyRecorded+'\n'+
    '- 역사 보관 원장(읽기 전용): #'+issue+'\n'+
    '- 운영 PC 쓰기/재실행: 0\n';
  if(env.GITHUB_STEP_SUMMARY)fs.appendFileSync(env.GITHUB_STEP_SUMMARY,message,'utf8');
  process.stdout.write(JSON.stringify(result)+'\n');
  return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)
  main().catch(e=>{process.stderr.write(e.message+'\n');process.exitCode=1;});

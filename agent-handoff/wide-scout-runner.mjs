// Isolated GitHub-only monitoring runner. Reads only control-repo metadata,
// writes only bounded bot summaries to authenticated monthly shard issues.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {
  WIDE_POLICY,CONTROL_REPO,OWNER,reportDecision,evaluateWideSnapshot,
  snapshotMarker,renderWideReport
} from './wide-scout.mjs';
const ROOT='https://api.github.com/repos/'+CONTROL_REPO+'/';
const stop=x=>{throw Error('WIDE_SCOUT_RUNNER_'+x)};
const workflowFiles=['agent-handoff-queue-board.yml',
  'agent-handoff-proactive-diagnostics.yml','agent-handoff-deep-diagnostics.yml'];
const BOT='github-actions[bot]';
const MARKER='<!-- ZGMINI_WIDE_SCOUT_LEDGER_R4';
const shardTitle=(month,index)=>'ZGMINI Wide Scout '+month+' #'+index;
const shardMarker=(month,index)=>MARKER+' month:'+month+' shard:'+index+' -->';
const goodId=n=>Number.isSafeInteger(n)&&n>0;
const monthFor=now=>new Date(now).toISOString().slice(0,7);
const previousMonth=now=>{
  const d=new Date(now);d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()-1);
  return monthFor(d.getTime());
};
function validateShard(x,month,index){
  if(!goodId(x?.number)||x.pull_request||!['open','closed'].includes(x.state)||
    x.title!==shardTitle(month,index)||![OWNER,BOT].includes(x.user?.login)||
    typeof x.body!=='string'||!x.body.includes(shardMarker(month,index)))
    stop('SHARD_IDENTITY');
}
async function loadShards(io,month){
  const list=await io.findShards(month);
  if(!Array.isArray(list)||list.length>100)stop('SHARD_INDEX_LIMIT');
  const seen=new Set(),shards=[];
  for(const issue of list){
    const match=issue?.title?.match(/^ZGMINI Wide Scout (\d{4}-\d\d) #([1-9]\d*)$/);
    if(!match||match[1]!==month)stop('SHARD_INDEX');
    const index=Number(match[2]);
    if(!goodId(index)||index>100||seen.has(index))stop('SHARD_INDEX_CONFLICT');
    seen.add(index);
    validateShard(issue,month,index);
    const comments=await io.readShardComments(issue.number);
    if(!Array.isArray(comments)||comments.length>WIDE_POLICY.maxComments)
      stop('SHARD_COMMENTS_LIMIT');
    shards.push({issue,index,comments});
  }
  shards.sort((a,b)=>a.index-b.index);
  if(shards.some((x,i)=>x.index!==i+1))stop('SHARD_INDEX_GAP');
  return shards;
}
function recentComments(shards){
  return shards.flatMap(x=>x.comments).sort((a,b)=>
    Date.parse(a.created_at)-Date.parse(b.created_at)).slice(-WIDE_POLICY.maxComments);
}
async function ensureShard(io,month,shards){
  const latest=shards.at(-1);
  if(latest?.issue.state==='open'&&latest.comments.length<WIDE_POLICY.maxComments)
    return latest.issue;
  const index=(latest?.index??0)+1;
  if(index>100)stop('SHARD_INDEX_LIMIT');
  let created;
  try{created=await io.createShard(month,index,shardTitle(month,index),shardMarker(month,index));}
  catch(e){
    const after=await loadShards(io,month);
    const recovered=after.find(x=>x.index===index);
    if(!recovered)stop('SHARD_CREATE_OUTCOME_UNKNOWN');
    return recovered.issue;
  }
  validateShard(await io.readShard(created?.number),month,index);
  return created;
}
export function validateWideEvent(event,env){
  if(event?.repository?.full_name!==CONTROL_REPO||
    event.repository.private!==true||env.GITHUB_REPOSITORY!==CONTROL_REPO||
    env.GITHUB_REF!=='refs/heads/main'||!env.GITHUB_EVENT_PATH)stop('SCOPE');
  const kind=env.GITHUB_EVENT_NAME;
  if(kind==='schedule'){
    if(event.schedule!==WIDE_POLICY.schedule)stop('SCHEDULE');
  }else if(kind==='workflow_dispatch'){
    if(event.sender?.login!==OWNER||env.GITHUB_ACTOR!==OWNER)stop('OWNER');
  }else if(kind==='issues'){
    if(event.action!=='labeled'||event.label?.name!=='handoff-agent-pending'||
      event.issue?.user?.login!==OWNER||event.issue.state!=='open'||
      !event.issue?.labels?.some?.(x=>x.name==='agent-handoff')||
      env.GITHUB_ACTOR!==OWNER)stop('ISSUE_PROVENANCE');
  }else stop('EVENT');
}
async function request(resource,{body=null}={}){
  if(!process.env.GITHUB_TOKEN)stop('TOKEN');
  const endpoint=resource.startsWith('search/')?'https://api.github.com/':ROOT;
  const response=await fetch(endpoint+resource,{
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
// Overflow is resolved by at most eight day-scoped partitions, not by
// increasing the regular scan of every status or removing coverage limits.
// The first (partial) UTC day is retained; reports exclude pre-cutoff items.
export async function recentRuns(now,requestRuns=request){
  const cutoff=now-WIDE_POLICY.lookbackDays*86400000;
  const firstDay=new Date(cutoff).toISOString().slice(0,10);
  const lastDay=new Date(now).toISOString().slice(0,10);
  const dateDays=[];
  for(let d=Date.parse(firstDay+'T00:00:00Z');
      d<=Date.parse(lastDay+'T00:00:00Z');d+=86400000){
    dateDays.push(new Date(d).toISOString().slice(0,10));
  }
  if(dateDays.length>9)stop('RUN_WINDOW_OVERFLOW');
  async function pageFor(status,created,page){
    const x=await requestRuns('actions/runs?status='+encodeURIComponent(status)+
      '&created='+encodeURIComponent(created)+'&per_page=100&page='+page);
    if(!Array.isArray(x?.workflow_runs)||x.workflow_runs.length>100)
      stop('RUN_PAGINATION_'+status);
    return x.workflow_runs;
  }
  function endsWindow(rows){
    if(rows.length<100)return true;
    const oldest=Date.parse(rows.at(-1)?.created_at||'');
    return Number.isFinite(oldest)&&oldest<cutoff;
  }
  // Bounded secondary partition budget across all statuses (read-only API).
  // If exhausted, retain known results and mark coverage incomplete.
  let hourlyCalls=0;
  const maxHourlyCalls=96;
  const batches=await Promise.all(RUN_STATUS_PARTITIONS.map(async status=>{
    const items=[];let complete=false;
    for(let page=1;page<=2;page++){
      const rows=await pageFor(status,'>='+firstDay,page);
      items.push(...rows);
      if(endsWindow(rows)){complete=true;break;}
    }
    if(!complete){
      // A busy seven-day status exceeds 200 runs. Partition by calendar day
      // using bounded one/two-page reads; never infer completeness from cap.
      const daily=[];complete=true;
      for(const day of dateDays){
        let dayComplete=false;
        for(let page=1;page<=2;page++){
          const rows=await pageFor(status,day,page);
          daily.push(...rows);
          if(endsWindow(rows)){dayComplete=true;break;}
        }
        if(!dayComplete){
          // Real 2026-11-23 ledger: cancelled=497(incomplete) even after
          // UTC-day partitioning. Split only such saturated days by hour.
          const hourly=[];
          let hoursComplete=true;
          for(let h=0;h<24;h++){
            const hh=String(h).padStart(2,'0');
            const range=day+'T'+hh+':00:00Z..'+day+'T'+hh+':59:59Z';
            let completeHour=false;
            for(let page=1;page<=2;page++){
              if(hourlyCalls>=maxHourlyCalls){hoursComplete=false;break;}
              hourlyCalls++;
              const rows=await pageFor(status,range,page);
              hourly.push(...rows);
              if(endsWindow(rows)){completeHour=true;break;}
            }
            if(!completeHour){hoursComplete=false;break;}
          }
          // Ensure the finer-grained GitHub query returned every known
          // day-level run. An unsupported range must never look complete.
          const known=daily.slice(-200);
          const found=new Set(hourly.map(x=>x.id));
          if(hoursComplete&&known.every(x=>found.has(x.id))){
            daily.splice(daily.length-200,200,...hourly);
          }else complete=false;
        }
      }
      items.splice(0,items.length,...daily);
    }
    return {status,items,complete};
  }));
  // A run can change status between separate API queries; never claim full
  // completeness when the same run appears in multiple status partitions.
  const map=new Map();let complete=batches.every(x=>x.complete);
  const rank={completed:4,in_progress:3,waiting:2,queued:1,pending:0};
  for(const batch of batches){
    for(const run of batch.items){
      if(!goodId(run?.id)){complete=false;continue;}
      const prev=map.get(run.id);
      if(prev){
        complete=false;
        if((rank[run.status]??-1)>(rank[prev.status]??-1))map.set(run.id,run);
      }else map.set(run.id,run);
    }
  }
  const all=[...map.values()].sort((a,b)=>
    Date.parse(b.created_at)-Date.parse(a.created_at)||b.id-a.id);
  if(all.length>WIDE_POLICY.maxRuns)complete=false;
  return {items:all.slice(0,WIDE_POLICY.maxRuns),complete,
    coverage:batches.map(x=>({status:x.status,count:x.items.length,
      complete:x.complete}))};
}
async function readWorkflows(){
  const values=[];
  for(const file of workflowFiles){
    const response=await request('actions/workflows/'+file);
    values.push({file,state:response?.state??'UNAVAILABLE'});
  }
  return values;
}
async function findShards(month){
  const q='repo:'+CONTROL_REPO+' in:title "ZGMINI Wide Scout '+month+'"';
  const found=[];
  for(let p=1;p<=2;p++){
    const data=await request('search/issues?q='+encodeURIComponent(q)+
      '&per_page=100&page='+p);
    if(!Array.isArray(data?.items)||!Number.isSafeInteger(data.total_count)||
      data.total_count>200)stop('SHARD_SEARCH_INCOMPLETE');
    found.push(...data.items);
    if(data.items.length<100)break;
  }
  return found.filter(x=>!x.pull_request&&x.title?.startsWith('ZGMINI Wide Scout '+month+' #'));
}
async function readShardComments(n){
  const x=await paged('issues/'+n+'/comments',4,false,Date.now());
  if(!x.complete)stop('SHARD_PAGE_INCOMPLETE');
  return x.items;
}
export async function scoutWide(io,now){
  if(!io||!Number.isFinite(now)||
    ['getRuns','getIssues','getPulls','getWorkflows','getScheduleCount',
      'findShards','readShard','readShardComments','createShard','postComment']
      .some(k=>typeof io[k]!=='function'))stop('IO');
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
  const month=monthFor(now),previous=previousMonth(now);
  let shards=await loadShards(io,month);
  const previousShards=await loadShards(io,previous);
  const comments=recentComments([...previousShards,...shards]);
  let decision=reportDecision(comments,report,now),posted=0;
  if(decision==='REPORT'){
    // Other workers may have posted while GitHub inventory was read.
    shards=await loadShards(io,month);
    const current=recentComments([...previousShards,...shards]);
    decision=reportDecision(current,report,now);
    if(decision==='REPORT'){
      let target=await ensureShard(io,month,shards);
      shards=await loadShards(io,month);
      let selected=shards.find(x=>x.issue.number===target.number);
      // Re-read after selection: another worker may close or fill the shard.
      if(!selected||selected.issue.state!=='open'||
         selected.comments.length>=WIDE_POLICY.maxComments){
        const retryTarget=await ensureShard(io,month,shards);
        shards=await loadShards(io,month);
        selected=shards.find(x=>x.issue.number===retryTarget.number);
        if(!selected||selected.issue.state!=='open'||
           selected.comments.length>=WIDE_POLICY.maxComments)stop('SHARD_WRITE_SCOPE');
        target=retryTarget;
      }
      decision=reportDecision(recentComments([...previousShards,...shards]),report,now);
      if(decision==='REPORT'){
        try{await io.postComment(target.number,textReport);}
        catch(error){
          const after=await loadShards(io,month);
          if(!after.some(x=>x.comments.some(c=>c?.body?.includes(snapshotMarker(report))&&
             c.user?.login===BOT)))throw error;
        }
        const after=await loadShards(io,month);
        if(!after.some(x=>x.comments.some(c=>c?.body?.includes(snapshotMarker(report))&&
           c.user?.login===BOT)))stop('READBACK');
        posted=1;
      }
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
    getPulls:now=>paged('pulls?state=open&sort=updated&direction=desc',5,false,now),
    getWorkflows:readWorkflows,
    getScheduleCount:async()=>{
      const x=await request('actions/runs?event=schedule&per_page=1');
      if(!Number.isSafeInteger(x?.total_count))stop('SCHEDULE_COUNT_UNVERIFIED');
      return x.total_count;
    },
    findShards,
    readShard:n=>request('issues/'+n),
    readShardComments,
    createShard:async(month,index,title,marker)=>request('issues',{body:{
      title,body:marker+'\\n\\nGitHub-only wide scout evidence. No PC action.',
      labels:[]}}),
    postComment:(n,body)=>request('issues/'+n+'/comments',{body:{body}})
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

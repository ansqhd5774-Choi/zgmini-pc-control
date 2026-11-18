// R2 GitHub-only handoff evidence runner. No shell execution from Issue data.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {
  DEEP_POLICY,selectRecentHandoffs,verifyHandoff,alreadyReported,buildDeepReport
} from './deep-diagnostics.mjs';
import {HANDOFF_REPOSITORY,HANDOFF_OWNER} from './queue-selector.mjs';

const API='https://api.github.com/repos/';
const owner='ansqhd5774-Choi';
const ledgerIssue=DEEP_POLICY.ledgerIssueNumber;
const stop=x=>{throw Error('HANDOFF_DEEP_RUNNER_'+x);};
const ledgerMarker='<!-- ZGMINI_PROACTIVE_DIAGNOSTIC_LEDGER_R1 -->';
const id=x=>Number.isSafeInteger(x)&&x>0;
const sha=x=>typeof x==='string'&&/^[a-f0-9]{40}$/.test(x);

export function validateDeepEvent(event,env){
  if(!event||event.repository?.full_name!==HANDOFF_REPOSITORY||
    event.repository.private!==true||env.GITHUB_REPOSITORY!==HANDOFF_REPOSITORY||
    !env.GITHUB_EVENT_PATH||env.GITHUB_REF!=='refs/heads/main')stop('SCOPE');
  if(env.GITHUB_EVENT_NAME==='schedule'){
    if(event.schedule!==DEEP_POLICY.schedule)stop('CRON');
  }else if(env.GITHUB_EVENT_NAME==='workflow_dispatch'){
    if(event.sender?.login!==owner||env.GITHUB_ACTOR!==owner)stop('ACTOR');
  }else if(env.GITHUB_EVENT_NAME==='workflow_run'){
    const run=event.workflow_run;
    if(event.action!=='completed'||run?.conclusion!=='success'||
      !['ZGMINI Handoff Queue Candidate Selector',
        'ZGMINI Agent Handoff PR Evidence CI'].includes(run.name)||
      run.actor?.login!==owner||
      (run.name==='ZGMINI Handoff Queue Candidate Selector'&&
       run.head_branch!=='main'))stop('FALLBACK_WORKFLOW');
  }else if(env.GITHUB_EVENT_NAME==='issues'){
    if(event.action!=='labeled'||event.label?.name!=='handoff-agent-pending'||
      event.issue?.state!=='open'||event.issue?.user?.login!==owner||
      !event.issue?.labels?.some?.(x=>x.name==='agent-handoff')||
      env.GITHUB_ACTOR!==owner)stop('FALLBACK_ISSUE');
  }else stop('EVENT');
}
function checkLedger(x){
  if(!x||x.number!==ledgerIssue||x.state!=='open'||x.pull_request||
    x.user?.login!==owner||!x.body?.includes(ledgerMarker)||
    !Number.isSafeInteger(x.comments)||x.comments>DEEP_POLICY.maxComments)
    stop('LEDGER_UNVERIFIED');
}
function identity(x){
  return JSON.stringify([x?.number,x?.state,x?.title,x?.body,x?.created_at,
    x?.updated_at,x?.user?.login,
    x?.labels?.map(y=>y.name).sort()]);
}
export async function processDeepQueue(io,now){
  const required=['listIssues','readIssue','readComments','readLedger',
    'readOrigin','readOriginComments','mainSha','compareFile','recentHistory','postLedger'];
  if(!io||required.some(x=>typeof io[x]!=='function')||!Number.isFinite(now))stop('IO');
  checkLedger(await io.readLedger());
  const inventory=await io.listIssues();
  const chosen=selectRecentHandoffs(inventory,now);
  const reports=await io.readComments(ledgerIssue);
  if(!Array.isArray(reports)||reports.length>DEEP_POLICY.maxComments)stop('COMMENTS');
  const main=await io.mainSha();
  if(!sha(main))stop('MAIN_SHA');
  let posted=0,already=0,unverified=0;
  const observed=[];
  for(const candidate of chosen.selected){
    if(posted>=DEEP_POLICY.maxNewReports)break;
    const issue=await io.readIssue(candidate.number);
    if(identity(issue)!==identity(candidate))stop('ISSUE_DRIFT');
    const comments=await io.readComments(issue.number);
    let handoff;
    try{handoff=verifyHandoff(issue,comments);}
    catch{unverified++;continue;}
    const ledgerNow=await io.readComments(ledgerIssue);
    if(alreadyReported(ledgerNow,issue,handoff)){already++;continue;}
    const [origin,history]=await Promise.all([
      io.readOrigin(handoff.origin.repository,handoff.origin.issueNumber),
      io.recentHistory(handoff.origin.sourceSha)
    ]);
    const originComments=origin?await io.readOriginComments(
      handoff.origin.repository,handoff.origin.issueNumber):[];
    if(!Array.isArray(originComments)||originComments.length>DEEP_POLICY.maxComments)
      stop('ORIGIN_COMMENTS');
    const files=[];
    for(const relative of handoff.failure.fileRefs.slice(0,DEEP_POLICY.maxSourceFiles)){
      files.push({path:relative,status:await io.compareFile(relative,
        handoff.origin.sourceSha,main)});
    }
    const report=buildDeepReport(issue,handoff,{
      origin,originComments,history,source:{files,mainSha:main}
    },now);
    checkLedger(await io.readLedger());
    if(identity(await io.readIssue(issue.number))!==identity(issue))
      stop('BEFORE_POST_DRIFT');
    const pre=await io.readComments(ledgerIssue);
    if(alreadyReported(pre,issue,handoff)){already++;continue;}
    if(pre.length>=DEEP_POLICY.maxComments)stop('LEDGER_CAP');
    try{await io.postLedger(report);}
    catch{
      if(!alreadyReported(await io.readComments(ledgerIssue),issue,handoff))
        stop('POST_RESULT_UNKNOWN');
    }
    if(!alreadyReported(await io.readComments(ledgerIssue),issue,handoff))
      stop('POST_READBACK');
    posted++;
    observed.push({issue:issue.number,origin:handoff.origin.issueNumber,
      result:'STATIC_REVIEW_ONLY'});
  }
  return {schema:DEEP_POLICY.version,cutoff:chosen.cutoff,
    recentHandoffs:chosen.selected.length,posted,already,unverified,
    observed,ledgerIssue,pcOperationalWrites:0,aiCalls:0,
    pcRetries:0,sourceEdits:0,simulator:'DECISION_TABLE_ONLY'};
}
async function api(repo,resource){
  if(![HANDOFF_REPOSITORY,owner+'/zgmini'].includes(repo))stop('REPOSITORY');
  if(!process.env.GITHUB_TOKEN)stop('TOKEN');
  const response=await fetch(API+repo+'/'+resource,{
    headers:{Authorization:'Bearer '+process.env.GITHUB_TOKEN,
      Accept:'application/vnd.github+json',
      'X-GitHub-Api-Version':'2022-11-28'},
    signal:AbortSignal.timeout(20000)
  });
  if(response.status===404)return null;
  if(!response.ok)stop('GITHUB_HTTP_'+response.status);
  return response.json();
}
async function postLedger(body){
  const response=await fetch(API+HANDOFF_REPOSITORY+'/issues/'+ledgerIssue+'/comments',{
    method:'POST',headers:{Authorization:'Bearer '+process.env.GITHUB_TOKEN,
      Accept:'application/vnd.github+json','Content-Type':'application/json',
      'X-GitHub-Api-Version':'2022-11-28'},body:JSON.stringify({body}),
    signal:AbortSignal.timeout(20000)
  });
  if(!response.ok)stop('POST_HTTP_'+response.status);
  const x=await response.json();
  if(!id(x.id))stop('POST_RECEIPT');
  return x;
}
async function getPaged(repo,resource,cap){
  const all=[];
  for(let p=1;p<=cap;p++){
    const rows=await api(repo,resource+(resource.includes('?')?'&':'?')+
      'per_page=100&page='+p);
    if(!Array.isArray(rows))stop('PAGINATION_FORMAT');
    all.push(...rows);
    if(rows.length<100)return all;
  }
  stop('PAGINATION_INCOMPLETE');
}
async function compareFile(relative,oldHead,main){
  const escaped=relative.split('/').map(encodeURIComponent).join('/');
  const resource='contents/'+escaped+'?ref=';
  const [left,right]=await Promise.all([
    api(HANDOFF_REPOSITORY,resource+oldHead),
    api(HANDOFF_REPOSITORY,resource+main)
  ]);
  if(!left||!right||left.type!=='file'||right.type!=='file'||
     !sha(left.sha)||!sha(right.sha))return 'UNAVAILABLE';
  return left.sha===right.sha?'SAME_BLOB':'CHANGED_BLOB';
}
export async function main(env=process.env){
  if(!env.GITHUB_EVENT_PATH)stop('EVENT_PATH');
  const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
  validateDeepEvent(event,env);
  const outcome=await processDeepQueue({
    listIssues:()=>getPaged(HANDOFF_REPOSITORY,
      'issues?state=open&labels=agent-handoff%2Chandoff-agent-pending',2),
    readIssue:n=>api(HANDOFF_REPOSITORY,'issues/'+n),
    readComments:(n)=>getPaged(HANDOFF_REPOSITORY,'issues/'+n+'/comments',4),
    readLedger:()=>api(HANDOFF_REPOSITORY,'issues/'+ledgerIssue),
    readOrigin:(r,n)=>api(r,'issues/'+n),
    readOriginComments:(r,n)=>getPaged(r,'issues/'+n+'/comments',4),
    mainSha:async()=>{
      const result=await api(HANDOFF_REPOSITORY,'commits/main');
      return result?.sha;
    },
    compareFile,
    recentHistory:async hash=>{
      const x=await api(HANDOFF_REPOSITORY,
        'actions/runs?head_sha='+hash+'&per_page=50&page=1');
      if(!x||!Array.isArray(x.workflow_runs)||x.total_count>50)return null;
      return x.workflow_runs;
    },
    postLedger
  },Date.now());
  const message='# ZGMINI 증거 심화 진단 R2\n\n'+
    '- 최근 7일 후보: '+outcome.recentHandoffs+'\n'+
    '- 신규 증거·시뮬레이션 보고: '+outcome.posted+'\n'+
    '- 기존 보고 중복 제외: '+outcome.already+'\n'+
    '- 인증 미확인 제외: '+outcome.unverified+'\n'+
    '- 코드 수정/운영 PC 쓰기/AI: 0\n';
  if(env.GITHUB_STEP_SUMMARY)fs.appendFileSync(env.GITHUB_STEP_SUMMARY,message);
  process.stdout.write(JSON.stringify(outcome)+'\n');
  return outcome;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)
  main().catch(e=>{process.stderr.write(e.message+'\n');process.exitCode=1;});

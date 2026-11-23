// Authenticated one-event recovery for historical #2307. The original PC Job
// is never rerun. No other Issue/Run, new workflow or PC effect is accepted.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {preparePcSharedResourceWait} from './pc-result-to-incident.mjs';
import {persistResourceWait,parseResourceWaitComment} from './resource-wait-ledger.mjs';
import {reconcileResourceWait} from '../shared-resource/lifecycle.mjs';

const REPO='ansqhd5774-Choi/zgmini-pc-control';
const API='https://api.github.com/repos/'+REPO;
const OWNER='ansqhd5774-Choi',BOT='github-actions[bot]';
const ISSUE=2307,RUN=44493517681,ATTEMPT=1,SEAT=2;
const JSON_PATH='results/44493517681-1-seat-2.json';
const TXT_PATH='results/44493517681-1-seat-2.txt';
const JSON_BLOB='1daf81e6cb08effa7b4cf21ea46bd8875ae13d00';
const TXT_BLOB='1987ce935f6b137370800c1f589fa926849437cc';
const RUN_HEAD='a7401b234dc117a75107c205cda9050de739cfc1';
const REQUEST='pc-82e8d098-90c8-4524-8514-c5f5343444d3';
const WAIT='resource-wait-25d1ea46e9015156f1a51993';
const MARKER='<!-- zgmini-pc-result:44493517681:1:2 -->';
const fail=code=>{throw Error('PC_2307_RECOVERY_'+code);};

export async function reconcileArchived2307(io,{apply=false}={}){
  const required=['readRun','readIssue','readOriginComments','readResult',
    'listWaitComments','postWaitComment','readWaitComment'];
  if(required.some(k=>typeof io?.[k]!=='function')||
     typeof apply!=='boolean')fail('IO_INVALID');
  const run=await io.readRun();
  if(run?.id!==RUN||run.name!=='ZGMINI PC Job'||run.event!=='issues'||
     run.status!=='completed'||run.conclusion!=='success'||
     run.run_attempt!==ATTEMPT||run.head_sha!==RUN_HEAD||
     run.actor?.login!==OWNER||
     run.head_repository?.full_name!==REPO)fail('ORIGIN_RUN_UNVERIFIED');
  const issue=await io.readIssue();
  if(issue?.number!==ISSUE||issue.title!=='pc-job'||
     issue.repository!==REPO||issue.user?.login!==OWNER||
     !issue.labels?.some(x=>x.name==='pc-job'))fail('ORIGIN_ISSUE_UNVERIFIED');
  let request;
  try{request=JSON.parse(issue.body);}catch{fail('ORIGIN_REQUEST_UNVERIFIED');}
  if(request?.schema!=='ZGMINI_PC_JOB_V1'||
     request.requestId!==REQUEST||
     request.operation!=='employment-r6-candidate-stage-readonly'||
     request.sourceSha!=='0193056bdb47bcf6c911f17623b6c302c8199c4c')
    fail('ORIGIN_REQUEST_UNVERIFIED');
  const comments=await io.readOriginComments();
  if(!Array.isArray(comments)||comments.length>500)fail('ORIGIN_RECEIPTS_INCOMPLETE');
  const receipts=comments.filter(x=>x?.body?.split('\n')[0]===MARKER);
  if(receipts.length!==1||receipts[0].user?.login!==BOT||
     receipts[0].issue_url!==API+'/issues/'+ISSUE||
     !receipts[0].body.includes('**BLOCKED — RESOURCE_WAIT_MEMORY**')||
     !receipts[0].body.includes('/actions/runs/'+RUN))
    fail('ORIGIN_RECEIPT_UNVERIFIED');
  const json=await io.readResult(JSON_PATH),txt=await io.readResult(TXT_PATH);
  if(json?.sha!==JSON_BLOB||txt?.sha!==TXT_BLOB||
     typeof json.content!=='string'||typeof txt.content!=='string')
    fail('PUBLISHED_PAIR_DRIFT');
  let report;
  try{report=JSON.parse(json.content);}catch{fail('RESULT_JSON_INVALID');}
  if(report.jobId!=='run-'+RUN+'-'+ATTEMPT+'-seat-'+SEAT||
     report.requestId!==REQUEST||report.code!=='RESOURCE_WAIT_MEMORY'||
     report.status!=='BLOCKED')fail('RESULT_IDENTITY_DRIFT');
  const prepared=preparePcSharedResourceWait({
    originIssue:issue,report,resultPath:JSON_PATH,resultTxt:txt.content});
  if(prepared.state!=='WAITING_SHARED_RESOURCE'||prepared.wait.waitId!==WAIT||
     prepared.wait.safePoint!=='REQUEST_CONSUMED_WORKER_PREOP_UNTOUCHED'||
     prepared.wait.automaticPcRetries!==0)fail('WAIT_PROOF_UNVERIFIED');
  // Complete authenticated wait inventory is required, even for preview.
  const original=await io.listWaitComments();
  if(!Array.isArray(original)||original.length>2000)fail('LEDGER_INCOMPLETE');
  const records=original.map(parseResourceWaitComment).filter(Boolean);
  const decision=reconcileResourceWait(prepared.wait,{complete:true,records});
  if(!apply)return Object.freeze({state:decision.state==='REUSE_EXISTING'?
    'HISTORICAL_WAIT_ALREADY_RECORDED':'HISTORICAL_WAIT_READY_TO_RECORD',
    issueNumber:ISSUE,runId:RUN,waitId:WAIT,automaticPcRetries:0,
    ledgerWrite:false});
  const result=await persistResourceWait(prepared.wait,{
    listComments:io.listWaitComments,postComment:io.postWaitComment,
    getComment:io.readWaitComment});
  return Object.freeze({state:'HISTORICAL_'+result.state,
    issueNumber:ISSUE,runId:RUN,waitId:WAIT,automaticPcRetries:0,
    ledgerWrite:result.state==='WAIT_RECORDED',
    ...(result.commentId?{commentId:result.commentId}:{})});
}

async function request(endpoint,{method='GET',body}={}){
  const token=process.env.GITHUB_TOKEN;
  if(!token)fail('TOKEN_NOT_CONFIGURED');
  const response=await fetch(API+'/'+endpoint,{method,
    headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json',
      'X-GitHub-Api-Version':'2022-11-28',
      ...(body?{'Content-Type':'application/json'}:{})},
    ...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(25000)});
  if(!response.ok)fail('GITHUB_HTTP_'+response.status);
  return response.json();
}
async function completePages(endpoint,max=20){
  const all=[];
  for(let page=1;page<=max;page++){
    const rows=await request(endpoint+(endpoint.includes('?')?'&':'?')+
      'per_page=100&page='+page);
    if(!Array.isArray(rows)||rows.length>100)fail('PAGES_INVALID');
    all.push(...rows);
    if(rows.length<100)return all;
  }
  fail('PAGES_INCOMPLETE');
}
async function readPublished(path){
  const item=await request('contents/'+path+'?ref=main');
  if(item?.encoding!=='base64'||typeof item.content!=='string'||
     !Number.isSafeInteger(item.size)||item.size>65536)
    fail('RESULT_CONTENT_UNVERIFIED');
  const buf=Buffer.from(item.content.replace(/\s/g,''),'base64');
  if(buf.length!==item.size)fail('RESULT_SIZE_UNVERIFIED');
  return {sha:item.sha,content:buf.toString('utf8')};
}
export async function main(env=process.env){
  if(env.GITHUB_REPOSITORY!==REPO||env.GITHUB_EVENT_NAME!=='workflow_dispatch'||
     env.GITHUB_REF!=='refs/heads/main'||env.GITHUB_ACTOR!==OWNER||
     !env.GITHUB_EVENT_PATH)fail('ENTRY_NOT_AUTHORIZED');
  const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
  if(event?.inputs?.confirmation!=='reconcile-2307-resource-wait'||
     !['preview','apply'].includes(event?.inputs?.mode))fail('INPUT_NOT_AUTHORIZED');
  const outcome=await reconcileArchived2307({
    readRun:()=>request('actions/runs/'+RUN),
    readIssue:async()=>({...await request('issues/'+ISSUE),repository:REPO}),
    readOriginComments:()=>completePages('issues/'+ISSUE+'/comments',5),
    readResult:readPublished,
    listWaitComments:()=>completePages('issues/68/comments',20),
    postWaitComment:body=>request('issues/68/comments',
      {method:'POST',body:{body}}),
    readWaitComment:id=>request('issues/comments/'+id)
  },{apply:event.inputs.mode==='apply'});
  process.stdout.write(JSON.stringify(outcome)+'\n');
  return outcome;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)
  main().catch(e=>{process.stderr.write(e.message+'\n');process.exitCode=1;});

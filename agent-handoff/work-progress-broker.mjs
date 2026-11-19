import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {evaluateWorkUpdate,WORK_SCHEMA,WORK_RECEIPT,parseWorkUpdate} from './work-progress-contract.mjs';
import {readIssueCommentLedger} from './comment-ledger.mjs';

const REPO='ansqhd5774-Choi/zgmini-pc-control';
const OWNER='ansqhd5774-Choi';
const API='https://api.github.com/repos/'+REPO;
const stop=s=>{throw Error('HANDOFF_WORK_BROKER_'+s);};

export function isWorkUpdateComment(body){
 try{return parseWorkUpdate(body).schema===WORK_SCHEMA;}catch{return false;}
}
export function validateWorkEvent(event,env) {
  if(env.GITHUB_REPOSITORY!==REPO||env.GITHUB_EVENT_NAME!=='issue_comment'||
    env.GITHUB_ACTOR!==OWNER||event?.action!=='created'||
    event?.repository?.full_name!==REPO||event?.repository?.private!==true||
    event.issue?.pull_request||event.issue?.state!=='open'||
    !Number.isSafeInteger(event.issue?.number)||
    !event.issue?.labels?.some(x=>x.name==='agent-handoff')||
    !event.issue?.labels?.some(x=>x.name==='handoff-agent-pending')||
    ![OWNER,'github-actions[bot]'].includes(event.issue?.user?.login)||
    event.comment?.user?.login!==OWNER||
    typeof event.comment?.body!=='string'||
    !isWorkUpdateComment(event.comment.body))
    stop('EVENT_NOT_ALLOWED');
}
async function request(resource,{method='GET',body}={}) {
  if(!process.env.GITHUB_TOKEN)stop('TOKEN_REQUIRED');
  const response=await fetch(API+'/'+resource,{
    method,headers:{Authorization:'Bearer '+process.env.GITHUB_TOKEN,
      Accept:'application/vnd.github+json',
      'X-GitHub-Api-Version':'2022-11-28',
      ...(body?{'Content-Type':'application/json'}:{})},
    ...(body?{body:JSON.stringify(body)}:{}),
    signal:AbortSignal.timeout(20000)});
  if(!response.ok)stop('GITHUB_HTTP_'+response.status);
  return response.json();
}
async function readComments(issueNumber) {
  return readIssueCommentLedger(page=>request(
    'issues/'+issueNumber+'/comments?per_page=100&page='+page));
}
async function readIssue(number) {
  return {...await request('issues/'+number),repository:REPO};
}
function sameIssue(a,b) {
  return a.number===b.number&&a.body===b.body&&a.title===b.title&&
    a.state===b.state&&a.user?.login===b.user?.login&&
    JSON.stringify(a.labels?.map(x=>x.name).sort())===
    JSON.stringify(b.labels?.map(x=>x.name).sort());
}
export async function processWorkComment(event,io) {
  if(!io||['readIssue','readComments','postComment'].some(k=>typeof io[k]!=='function'))
    stop('IO_MISSING');
  const number=event.issue.number;
  const issue=await io.readIssue(number);
  if(!sameIssue(event.issue,issue))stop('ISSUE_DRIFT');
  const first=evaluateWorkUpdate(issue,await io.readComments(number),event.comment);
  if(first.state==='ALREADY_RECORDED')return {state:'ALREADY_RECORDED',issueNumber:number};
  const before=await io.readIssue(number);
  if(!sameIssue(issue,before))stop('PREWRITE_ISSUE_DRIFT');
  const verified=evaluateWorkUpdate(before,await io.readComments(number),event.comment);
  if(verified.state==='ALREADY_RECORDED')return {state:'ALREADY_RECORDED',issueNumber:number};
  if(verified.state!=='READY'||verified.receipt!==first.receipt)
    stop('PREWRITE_PROOF_CHANGED');
  let reconciled=false;
  try{await io.postComment(number,first.receipt);}catch {
    const afterUnknown=evaluateWorkUpdate(await io.readIssue(number),
      await io.readComments(number),event.comment);
    if(afterUnknown.state!=='ALREADY_RECORDED')
      stop('WRITE_OUTCOME_UNKNOWN');
    reconciled=true;
  }
  // The ambiguous POST already received an exact receipt readback.
  if(!reconciled){
    const after=evaluateWorkUpdate(await io.readIssue(number),
      await io.readComments(number),event.comment);
    if(after.state!=='ALREADY_RECORDED')stop('RECEIPT_READBACK_STOP');
  }
  return Object.freeze({state:'WORK_STATUS_RECORDED',issueNumber:number,
    updateId:first.updateId,progressState:first.progressState,
    pcOperationalWrites:0,aiCalls:0});
}
export async function main(env=process.env) {
  if(!env.GITHUB_EVENT_PATH)stop('EVENT_PATH_REQUIRED');
  const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
  validateWorkEvent(event,env);
  const result=await processWorkComment(event,{
    readIssue,readComments,
    postComment:(n,body)=>request('issues/'+n+'/comments',{method:'POST',body:{body}})
  });
  process.stdout.write(JSON.stringify(result)+'\n');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)
  main().catch(e=>{process.stderr.write(e.message+'\n');process.exitCode=1;});

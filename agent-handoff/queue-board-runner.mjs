import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {HANDOFF_REPOSITORY,HANDOFF_OWNER} from './queue-selector.mjs';
import {compileQueueBoard,renderBoardMarkdown} from './queue-board.mjs';

const API='https://api.github.com/repos/'+HANDOFF_REPOSITORY+'/';
const WORKFLOWS=new Set(['ZGMINI Handoff Queue Candidate Selector','ZGMINI Agent Handoff Intake']);
export const BOARD_CRON='7,22,37,52 * * * *';
const fail=code=>{throw Error('HANDOFF_BOARD_RUNNER_'+code);};

export function validateBoardEvent(event,env) {
  if(!event||event.repository?.private!==true||
    event.repository.full_name!==HANDOFF_REPOSITORY||
    env.GITHUB_REPOSITORY!==HANDOFF_REPOSITORY||!env.GITHUB_EVENT_PATH)
    fail('EVENT_SCOPE_STOP');
  if(env.GITHUB_EVENT_NAME==='workflow_dispatch'){
    if(event.sender?.login!==HANDOFF_OWNER||env.GITHUB_ACTOR!==HANDOFF_OWNER)
      fail('DISPATCH_OWNER_STOP');
  }else if(env.GITHUB_EVENT_NAME==='workflow_run'){
    if(event.action!=='completed'||event.workflow_run?.conclusion!=='success'||
      !WORKFLOWS.has(event.workflow_run.name)||
      event.workflow_run.actor?.login!==HANDOFF_OWNER||
      event.workflow_run.head_branch!=='main')
      fail('RUN_PROVENANCE_STOP');
  }else if(env.GITHUB_EVENT_NAME==='schedule'){
    if(env.GITHUB_REF!=='refs/heads/main'||event.schedule!==BOARD_CRON)
      fail('SCHEDULE_PROVENANCE_STOP');
  }else fail('EVENT_TYPE_STOP');
}

async function request(resource){
  if(!process.env.GITHUB_TOKEN)fail('TOKEN_REQUIRED');
  const resp=await fetch(API+resource,{
    headers:{Authorization:'Bearer '+process.env.GITHUB_TOKEN,
      Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},
    signal:AbortSignal.timeout(20000)});
  if(!resp.ok)fail('GITHUB_HTTP_'+resp.status);
  return resp.json();
}

async function pages(resource,cap){
  const result=[];
  for(let page=1;page<=cap;page++){
    const rows=await request(resource+(resource.includes('?')?'&':'?')+
      'per_page=100&page='+page);
    if(!Array.isArray(rows))fail('INVALID_PAGE');
    result.push(...rows);
    if(rows.length<100)return result;
  }
  fail('PAGINATION_INCOMPLETE');
}

function issueIdentity(issue){
  return JSON.stringify({number:issue.number,state:issue.state,title:issue.title,
    body:issue.body,created_at:issue.created_at,user:issue.user?.login,
    labels:issue.labels?.map(x=>x.name).sort()});
}

export async function collectBoard(io,nowMs){
  if(!io||['listIssues','readComments','readIssue'].some(k=>typeof io[k]!=='function'))
    fail('IO_REQUIRED');
  const issues=await io.listIssues();
  if(!Array.isArray(issues)||issues.length>100)fail('BACKLOG_CAP_EXCEEDED');
  const records=[];
  for(const issue of issues){
    if(issue.pull_request)continue;
    const comments=await io.readComments(issue.number);
    const fresh=await io.readIssue(issue.number);
    if(issueIdentity(issue)!==issueIdentity(fresh))fail('ISSUE_DRIFT_RESCAN_REQUIRED');
    // Every row is the same exact GitHub Issue at both read points.
    records.push({issue:{...fresh,repository:HANDOFF_REPOSITORY},comments});
  }
  return compileQueueBoard(records,nowMs);
}

export async function main(env=process.env) {
  if(!env.GITHUB_EVENT_PATH)fail('EVENT_PATH_REQUIRED');
  const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
  validateBoardEvent(event,env);
  const board=await collectBoard({
    listIssues:()=>pages('issues?state=open&labels=agent-handoff%2Chandoff-agent-pending',2),
    readComments:n=>pages('issues/'+n+'/comments',4),
    readIssue:n=>request('issues/'+n)
  },Date.now());
  const markdown=renderBoardMarkdown(board);
  if(env.GITHUB_STEP_SUMMARY)
    fs.appendFileSync(env.GITHUB_STEP_SUMMARY,markdown,'utf8');
  process.stdout.write(JSON.stringify(board)+'\n');
  return board;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)
  main().catch(e=>{process.stderr.write(e.message+'\n');process.exitCode=1;});

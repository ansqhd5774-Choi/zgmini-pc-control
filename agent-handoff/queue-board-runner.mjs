import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {HANDOFF_REPOSITORY,HANDOFF_OWNER} from './queue-selector.mjs';
import {readIssueCommentLedger} from './comment-ledger.mjs';
import {compileQueueBoard,renderBoardMarkdown,MAX_BOARD_ISSUES} from './queue-board.mjs';
import {DIRECT_OWNER_REVIEWS,compileDirectOwnerBoard,renderDirectOwnerMarkdown}
  from './direct-owner-reviews.mjs';

const API='https://api.github.com/repos/'+HANDOFF_REPOSITORY+'/';
// Keep the legacy completion validator for already-created pre-change Runs.
const WORKFLOWS=new Set(['ZGMINI Handoff Queue Candidate Selector']);
const SELECTOR_WORKFLOW_REF=HANDOFF_REPOSITORY+'/.github/workflows/agent-handoff-candidate-selector.yml@refs/heads/main';
const SELECTOR_INTAKES=new Set([
  'ZGMINI Agent Handoff Intake',
  'ZGMINI Agent Handoff PC Failure Intake',
  'ZGMINI Agent Handoff Writer B Failure Intake'
]);
const AFTER_SELECTION_JOB='authenticated-readonly-board-after-selection';
export const BOARD_CRON='7,22,37,52 * * * *';
const fail=code=>{throw Error('HANDOFF_BOARD_RUNNER_'+code);};

export function validateBoardEvent(event,env) {
  if(!event||event.repository?.private!==true||
    event.repository.full_name!==HANDOFF_REPOSITORY||
    env.GITHUB_REPOSITORY!==HANDOFF_REPOSITORY||!env.GITHUB_EVENT_PATH)
    fail('EVENT_SCOPE_STOP');
  // The workflow's needs dependency verifies selection success. Recheck the
  // original event here, with the exact default-branch workflow/job identity.
  if(env.GITHUB_JOB===AFTER_SELECTION_JOB){
    if(env.GITHUB_WORKFLOW_REF!==SELECTOR_WORKFLOW_REF||env.GITHUB_REF!=='refs/heads/main')
      fail('AFTER_SELECTION_SCOPE_STOP');
    if(env.GITHUB_EVENT_NAME==='workflow_run'){
      if(event.action!=='completed'||event.workflow_run?.conclusion!=='success'||
        !SELECTOR_INTAKES.has(event.workflow_run.name)||
        event.workflow_run.actor?.login!==HANDOFF_OWNER)
        fail('AFTER_SELECTION_RUN_STOP');
    }else if(env.GITHUB_EVENT_NAME==='workflow_dispatch'){
      if(event.sender?.login!==HANDOFF_OWNER||env.GITHUB_ACTOR!==HANDOFF_OWNER)
        fail('DISPATCH_OWNER_STOP');
    }else if(env.GITHUB_EVENT_NAME==='push'){
      if(event.ref!=='refs/heads/main'||event.deleted===true||env.GITHUB_ACTOR!==HANDOFF_OWNER)
        fail('AFTER_SELECTION_PUSH_STOP');
    }else fail('EVENT_TYPE_STOP');
    return;
  }
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

export async function pages(resource,cap,read=request){
  const result=[];
  for(let page=1;page<=cap;page++){
    const rows=await read(resource+(resource.includes('?')?'&':'?')+
      'per_page=100&page='+page);
    if(!Array.isArray(rows)||rows.length>100)fail('INVALID_PAGE');
    result.push(...rows);
    if(rows.length<100)return result;
  }
  const probe=await read(resource+(resource.includes('?')?'&':'?')+
    'per_page=100&page='+(cap+1));
  if(!Array.isArray(probe)||probe.length>100)fail('INVALID_PAGE');
  if(probe.length===0)return result;
  fail('PAGINATION_INCOMPLETE');
}

function issueIdentity(issue){
  return JSON.stringify({number:issue.number,state:issue.state,title:issue.title,
    body:issue.body,created_at:issue.created_at,user:issue.user?.login,
    labels:issue.labels?.map(x=>x.name).sort()});
}

// Only an issue-scoped read failure may be downgraded to UNVERIFIED.
// Authentication, bad page data, or a programming error are global failures.
function scopedReadFailure(error){
  const msg=typeof error?.message==='string'?error.message:'';
  if(/^HANDOFF_BOARD_RUNNER_GITHUB_HTTP_(404|408|429|5\d\d)$/.test(msg))
    return 'ISSUE_READ_UNAVAILABLE';
  if(['AbortError','TimeoutError'].includes(error?.name)||
     (error instanceof TypeError&&/^fetch failed(?:$|:)/i.test(msg)))
    return 'ISSUE_READ_UNAVAILABLE';
  return null;
}
export async function mapBounded(items,worker,width=4){
  if(!Array.isArray(items)||typeof worker!=='function'||
     !Number.isSafeInteger(width)||width<1||width>8)
    fail('BOUNDED_MAP_INPUT');
  const out=[];
  for(let p=0;p<items.length;p+=width){
    const batch=items.slice(p,p+width);
    const values=await Promise.all(batch.map(worker));
    out.push(...values);
  }
  return out;
}

export async function collectBoard(io,nowMs){
  if(!io||['listIssues','readComments','readIssue'].some(k=>typeof io[k]!=='function'))
    fail('IO_REQUIRED');
  const issues=await io.listIssues();
  if(!Array.isArray(issues)||issues.length>MAX_BOARD_ISSUES)
    fail('BACKLOG_CAP_EXCEEDED');
  const openHandoffs=issues.filter(issue=>!issue.pull_request);
  if(openHandoffs.some(issue=>
    !Number.isSafeInteger(issue?.number)||issue.number<1||
    !Array.isArray(issue.labels)||
    !issue.labels.some(label=>label.name==='agent-handoff')))
    fail('INCIDENT_INVENTORY_OUT_OF_SCOPE');
  const pending=openHandoffs.filter(issue=>
    issue.labels.some(label=>label.name==='handoff-agent-pending'));
  const records=await mapBounded(pending,async issue=>{
    try {
      // Independent read-only GET requests share no mutable resource.
      const [comments,fresh]=await Promise.all([
        io.readComments(issue.number),io.readIssue(issue.number)
      ]);
      if(issueIdentity(issue)!==issueIdentity(fresh))
        return {issue:{...issue,repository:HANDOFF_REPOSITORY},
          comments:[],unverifiedReason:'ISSUE_DRIFT_RESCAN_REQUIRED'};
      if(!Array.isArray(comments))
        return {issue:{...issue,repository:HANDOFF_REPOSITORY},
          comments:[],unverifiedReason:'COMMENT_INVENTORY_UNVERIFIED'};
      return {issue:{...fresh,repository:HANDOFF_REPOSITORY},comments};
    }catch(error){
      const reason=scopedReadFailure(error);
      if(!reason)throw error;
      return {issue:{...issue,repository:HANDOFF_REPOSITORY},
        comments:[],unverifiedReason:reason};
    }
  });
  return compileQueueBoard(records,nowMs,{openHandoffIssueCount:openHandoffs.length});
}

export async function main(env=process.env) {
  if(!env.GITHUB_EVENT_PATH)fail('EVENT_PATH_REQUIRED');
  const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
  validateBoardEvent(event,env);
  const board=await collectBoard({
    listIssues:()=>pages('issues?state=open&labels=agent-handoff',10),
    readComments:n=>readIssueCommentLedger(page=>request(
      'issues/'+n+'/comments?per_page=100&page='+page)),
    readIssue:n=>request('issues/'+n)
  },Date.now());
  // Central #68 direct owner reviews are a separate source, not agent-handoff Issues.
  // An unavailable proof remains UNVERIFIED; it does not erase the incident board.
  const directReads=await Promise.all(DIRECT_OWNER_REVIEWS.map(async spec=>{
    const [origin,review]=await Promise.allSettled([
      request('issues/comments/'+spec.originCommentId),
      request('issues/'+spec.reviewIssue)
    ]);
    return {origin:origin.status==='fulfilled'?origin.value:null,
      review:review.status==='fulfilled'?review.value:null};
  }));
  const directOwnerReviews=compileDirectOwnerBoard(directReads,Date.now());
  const result=Object.freeze({...board,directOwnerReviews});
  const markdown=renderBoardMarkdown(board)+renderDirectOwnerMarkdown(directOwnerReviews);
  if(env.GITHUB_STEP_SUMMARY)
    fs.appendFileSync(env.GITHUB_STEP_SUMMARY,markdown,'utf8');
  process.stdout.write(JSON.stringify(result)+'\n');
  return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)
  main().catch(e=>{process.stderr.write(e.message+'\n');process.exitCode=1;});

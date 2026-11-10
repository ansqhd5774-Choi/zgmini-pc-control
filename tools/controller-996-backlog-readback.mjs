// #996 source-only authenticated GitHub readback contract. NO CLI, no POST,
// no operational writes, no PC retries. The future C operator must provide an
// independently authenticated GitHub REST GET port bound to this exact repo.
// A caller-supplied api function alone is NOT proof of authentication.
import {createHash} from 'node:crypto';
import {plan996BacklogWithoutReplay} from './controller-996-backlog-plan.mjs';

const REPO='ansqhd5774-Choi/zgmini-pc-control';
const REQUEST='pc-update-0010b2cf-9bca-40cf-89c5-b750fa42b404';
const hash=v=>createHash('sha256').update(v).digest('hex');
const need=(ok,code)=>{if(!ok)throw Object.assign(Error(code),{code});};
const at=v=>typeof v==='string'?Date.parse(v):NaN;
const receipt=/^<!-- zgmini-pc-result:(\d{1,20}):(\d{1,3}):([1-6]) -->/;

function validPage(response,code){
 need(response?.status===200&&Array.isArray(response.data),code);
 need(response.data.length<=100,code);
 return response.data;
}

async function issueScan(api,start,end){
 const issues=[],ids=new Set();let oldest=Infinity,ended=false;
 for(let page=1;page<=40;page++){
  // Do NOT use `since`: GitHub filters updated_at, not created_at.
  const route=`issues?state=all&sort=created&direction=desc&per_page=100&page=${page}`;
  const rows=validPage(await api(route),'C_GITHUB_ISSUES_PAGE_INVALID');
  for(const row of rows){
   const created=at(row?.created_at);
   need(Number.isSafeInteger(row?.number)&&row.number>0&&
    !ids.has(row.number)&&Number.isFinite(created)&&created<=oldest,
    'C_GITHUB_ISSUE_PAGE_DUPLICATE_OR_UNSORTED');
   need(!row.repository||row.repository===REPO,'C_GITHUB_ISSUE_REPO_DRIFT');
   ids.add(row.number);oldest=created;
   if(created>=start-2000&&created<=end){
    need(issues.length<2000,'C_GITHUB_PAUSE_WINDOW_TOO_LARGE');
    // Raw GitHub Issue JSON has no repository field. This provenance is
    // trusted ONLY because `api` must enforce this fixed authenticated route.
    issues.push({...row,repository:REPO});
   }
  }
  if(rows.length<100||oldest<start-2000){ended=true;break;}
 }
 need(ended,'C_GITHUB_ISSUE_WINDOW_PAGINATION_INCOMPLETE');
 return issues;
}

async function commentsFor(api,issueNumber){
 const comments=[],ids=new Set();
 for(let page=1;page<=6;page++){
  const rows=validPage(await api(`issues/${issueNumber}/comments?per_page=100&page=${page}`),
   'C_GITHUB_COMMENTS_PAGE_INVALID');
  for(const comment of rows){
   need(Number.isSafeInteger(comment?.id)&&comment.id>0&&
    !ids.has(comment.id)&&typeof comment.body==='string',
    'C_GITHUB_COMMENT_DUPLICATE_OR_INVALID');
   ids.add(comment.id);comments.push(comment);
  }
  if(rows.length<100){
   need(comments.length<=500,'C_GITHUB_COMMENT_LIMIT_EXCEEDED');
   return {complete:true,comments};
  }
 }
 throw Object.assign(Error('C_GITHUB_COMMENT_PAGINATION_INCOMPLETE'),
  {code:'C_GITHUB_COMMENT_PAGINATION_INCOMPLETE'});
}

async function readFile(api,route){
 const r=await api('contents/'+route);
 if(r?.status===404)return null;
 need(r?.status===200&&r?.data?.type==='file'&&
  r.data.encoding==='base64'&&typeof r.data.content==='string'&&
  r.data.content.length<=1500000,'C_GITHUB_RESULT_FILE_UNREADABLE');
 if(r.data.path!==undefined)need(r.data.path===route,'C_GITHUB_RESULT_PATH_DRIFT');
 const data=r.data.content.replace(/\s/g,'');
 need(data.length>0&&data.length%4===0&&
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(data),
  'C_GITHUB_RESULT_BASE64_INVALID');
 return Buffer.from(data,'base64');
}

async function verifyReportPair(api,entry,marker){
 const [,runId,attempt,seat]=marker;
 const base=`results/${runId}-${attempt}-seat-${seat}`;
 const json=await readFile(api,base+'.json');
 const txt=await readFile(api,base+'.txt');
 if(!json||!txt)return Object.freeze({status:'RESULT_PAIR_INCOMPLETE',
  code:'C_GITHUB_RESULT_FILE_MISSING',runId,attempt,seat});
 let report;
 try{report=JSON.parse(json.toString('utf8'));}
 catch{return Object.freeze({status:'RESULT_PAIR_INCOMPLETE',
  code:'C_GITHUB_RESULT_INVALID_JSON',runId,attempt,seat});}
 need(report&&typeof report==='object'&&!Array.isArray(report),
  'C_GITHUB_RESULT_SCHEMA_INVALID');
 const expectedId=`run-${runId}-${attempt}-seat-${seat}`;
 if(report.schema!=='ZGMINI_PC_RESULT_V1'||report.jobId!==expectedId||
  report.requestId!==entry.requestId||report.controlRepository!==REPO||
  !['PASS','FAIL','BLOCKED','STATE_UNKNOWN'].includes(report.status)||
  !Number.isSafeInteger(Number(report.seat))||Number(report.seat)!==Number(seat))
  return Object.freeze({status:'RESULT_PAIR_INCOMPLETE',
   code:'C_GITHUB_RESULT_IDENTITY_UNPROVEN',runId,attempt,seat});
 // Reconstruct the same upload.mjs TXT serialization from the remote JSON.
 // Do not trust a bot comment or either file by itself.
 const expectedTxt=Object.entries(report).filter(([key])=>
  !['result','prior'].includes(key)).map(([key,value])=>
   `${key}=${typeof value==='object'?JSON.stringify(value):value}`).join('\r\n')+'\r\n';
 if(!txt.equals(Buffer.from(expectedTxt,'utf8')))
  return Object.freeze({status:'RESULT_PAIR_INCOMPLETE',
   code:'C_GITHUB_RESULT_PAIR_MISMATCH',runId,attempt,seat});
 return Object.freeze({status:'RESULT_PAIR_VERIFIED',resultStatus:report.status,
  resultCode:typeof report.code==='string'?report.code:null,
  runId,attempt,seat,jsonSha256:hash(json),txtSha256:hash(txt),
  summaryOnly:report.reportTransfer?.status==='SUMMARY_ONLY'});
}

/** Does not authorize closure, replay, or PC execution. The closed pause
 * times must come from independently pinned original-Windows readback.
 * No incomplete query is converted into successful evidence. */
export async function read996OriginalBacklogEvidence({api,pausedAt,resumedAt,
 replays}={}){
 need(typeof api==='function','C_GITHUB_AUTHENTICATED_READER_REQUIRED');
 // An omitted replay journal is UNKNOWN, never an empty journal.
 // The caller must independently pin the ORIGINAL Windows backlog bytes.
 need(replays!==null&&typeof replays==='object'&&!Array.isArray(replays),
  'C_GITHUB_ORIGINAL_REPLAYS_NOT_PROVIDED');
 const start=at(pausedAt),end=at(resumedAt);
 need(Number.isFinite(start)&&Number.isFinite(end)&&end>=start,
  'C_GITHUB_PAUSE_WINDOW_INVALID');
 // Two identical passes protect a paginated list against page-boundary churn.
 const first=await issueScan(api,start,end);
 const second=await issueScan(api,start,end);
 need(hash(JSON.stringify(first))===hash(JSON.stringify(second)),
  'C_GITHUB_ISSUES_UNSTABLE_BETWEEN_PASSES');
 const commentsByIssue={};
 for(const issue of second){
  if(issue.pull_request||!issue.labels?.some(x=>
   (typeof x==='string'?x:x?.name)==='pc-job'))continue;
  commentsByIssue[String(issue.number)]=await commentsFor(api,issue.number);
 }
 const plan=plan996BacklogWithoutReplay({requestId:REQUEST,
  pause:{pausedAt,resumedAt:null},cutoffAt:resumedAt,
  listing:{complete:true,issues:second},commentsByIssue,replays});
 need(plan.status==='READONLY_DISPOSITIONS_ONLY',
  'C_GITHUB_BACKLOG_PLAN_'+plan.code);
 const entries=[];
 for(const entry of plan.entries){
  const comments=commentsByIssue[String(entry.originIssue)].comments;
  const markers=comments.filter(c=>c.user?.login==='github-actions[bot]')
   .map(c=>receipt.exec(c.body)).filter(Boolean);
  need(markers.length<=1,'C_GITHUB_RESULT_RECEIPT_AMBIGUOUS');
  const journal=replays[String(entry.originIssue)];
  let verification;
  if(journal?.status==='DONE'){
   // A posted replay requires independent identity and result verification
   // of the *replay Issue*. A result on the original Issue is not enough.
   verification=Number.isSafeInteger(journal.replayIssueNumber)&&
    journal.replayIssueNumber>0?
    Object.freeze({status:'PRIOR_REPLAY_UNVERIFIED',
     code:'C_GITHUB_PRIOR_REPLAY_RESULT_UNVERIFIED'}):
    Object.freeze({status:'JOURNAL_INCONSISTENT',
     code:'C_GITHUB_PRIOR_REPLAY_ISSUE_INVALID'});
  }else if(!markers.length){
   verification=journal?.status==='SKIPPED_RESULT_PRESENT'?
    Object.freeze({status:'JOURNAL_INCONSISTENT',
     code:'C_GITHUB_SKIPPED_RESULT_UNVERIFIED'}):
    Object.freeze({status:'OWNER_REPLAN_REVIEW_REQUIRED',
     code:'NO_VERIFIED_RESULT_PAIR'});
  }else{
   const pair=await verifyReportPair(api,entry,markers[0]);
   verification=journal?.status==='SKIPPED_RESULT_PRESENT'&&
    pair.status!=='RESULT_PAIR_VERIFIED'?
    Object.freeze({status:'JOURNAL_INCONSISTENT',
     code:'C_GITHUB_SKIPPED_RESULT_PAIR_INCOMPLETE'}):pair;
  }
  entries.push(Object.freeze({originIssue:entry.originIssue,
   requestId:entry.requestId,disposition:entry.disposition,verification}));
 }
 const verifiedCount=entries.filter(entry=>
  entry.verification.status==='RESULT_PAIR_VERIFIED').length;
 const unresolvedCount=entries.length-verifiedCount;
 const status=entries.length===0?'READONLY_EMPTY_WINDOW_VERIFIED':
  unresolvedCount===0?'READONLY_RESULT_PAIRS_VERIFIED':
   'READONLY_VERIFICATION_INCOMPLETE';
 return Object.freeze({schema:'ZGMINI_996_GITHUB_READBACK_V1',
  status,originalIssueCount:entries.length,verifiedCount,unresolvedCount,
  entries:Object.freeze(entries),listingComplete:true,commentsComplete:true,
  issueScans:2,issuePosts:0,pcRetries:0,executionAuthorized:false});
}

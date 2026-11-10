// #996 INTAKE_PAUSED only: pure, read-only backlog disposition plan.
// In particular this module must never copy a pc-job body to a new Issue:
// that would reuse its one-shot requestId and could duplicate an execution.

const REQUEST_ID = 'pc-update-0010b2cf-9bca-40cf-89c5-b750fa42b404';
const REPO = 'ansqhd5774-Choi/zgmini-pc-control';
const OWNER = 'ansqhd5774-Choi';
const FIELDS = ['chatId', 'operation', 'requestId', 'schema',
  'sourceBranch', 'sourceRepository', 'sourceSha'];
const sha40 = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
const at = value => typeof value === 'string' && Number.isFinite(Date.parse(value))
  ? Date.parse(value) : NaN;
const stop = code => Object.freeze({schema:'ZGMINI_996_BACKLOG_PLAN_V1',
  status:'EVIDENCE_INCOMPLETE',code,executionAuthorized:false,
  issuePostsAuthorized:0,automaticPcRetries:0,entries:[]});

function strictRequest(issue) {
  let body;
  try {body=JSON.parse(issue.body);} catch {return null;}
  if(!body || Array.isArray(body) || typeof body !== 'object' ||
    JSON.stringify(Object.keys(body).sort()) !== JSON.stringify(FIELDS) ||
    body.schema !== 'ZGMINI_PC_JOB_V1' ||
    !/^[a-z0-9-]{8,80}$/.test(body.requestId ?? '') ||
    !/^[0-9a-f-]{36}$/.test(body.chatId ?? '') ||
    !sha40(body.sourceSha) ||
    typeof body.operation !== 'string' ||
    typeof body.sourceRepository !== 'string' ||
    typeof body.sourceBranch !== 'string') return null;
  return body;
}

/**
 * All inputs are raw readback material supplied by a separate authenticated,
 * complete GitHub + Windows reader. `cutoffAt` is ONLY the snapshot boundary:
 * a C executor must establish the real resumedAt after enabling intake and
 * scan the entire pause interval AGAIN, including the snapshot-to-resume gap.
 * GitHub issues `since` filters updated_at, not created_at; a caller cannot
 * assert listing.complete from a single `since` page. This plan is NOT a
 * source of authority: it cannot prove a PC result pair, release a lease,
 * enable intake, declare backlog complete or POST a replacement Issue.
 */
export function plan996BacklogWithoutReplay({requestId,pause,cutoffAt,
  listing,commentsByIssue,replays}={}) {
  if(requestId!==REQUEST_ID)return stop('REQUEST_ID_MISMATCH');
  const start=at(pause?.pausedAt),end=at(cutoffAt);
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<start||
    pause?.resumedAt!==null)return stop('PAUSE_WINDOW_UNVERIFIED');
  if(listing?.complete!==true||!Array.isArray(listing.issues)||
    listing.issues.length>2000)return stop('ISSUE_LIST_INCOMPLETE');
  if(!commentsByIssue||typeof commentsByIssue!=='object'||
    Array.isArray(commentsByIssue)||!replays||typeof replays!=='object'||
    Array.isArray(replays))return stop('READBACK_MAP_INVALID');

  const seenIssues=new Set(),seenRequests=new Set(),candidateIssues=new Set(),entries=[];
  for(const issue of listing.issues) {
    if(!Number.isSafeInteger(issue?.number)||issue.number<1||
      seenIssues.has(issue.number))return stop('ISSUE_ID_DUPLICATE_OR_INVALID');
    seenIssues.add(issue.number);
    const created=at(issue.created_at);
    if(!Number.isFinite(created))return stop('ISSUE_TIMESTAMP_INVALID');
    if(created<start-2000||created>end)continue;
    // The GitHub REST /issues endpoint includes pull requests as issue rows.
    // An authentic PR is never an admitted pc-job, even if it has that label.
    if(issue.pull_request)continue;
    const labels=issue.labels?.map(v=>typeof v==='string'?v:v?.name);
    if(!Array.isArray(labels)||!labels.includes('pc-job'))continue;
    if(issue.repository!==REPO||issue.user?.login!==OWNER||
      issue.title!=='pc-job')return stop('ORIGINAL_ADMISSION_UNVERIFIED');
    const request=strictRequest(issue);
    if(!request)return stop('ORIGINAL_BODY_INVALID');
    candidateIssues.add(String(issue.number));
    if(seenRequests.has(request.requestId))return stop('ORIGINAL_REQUEST_ID_DUPLICATE');
    seenRequests.add(request.requestId);
    const commentReadback=commentsByIssue[String(issue.number)];
    if(commentReadback?.complete!==true||
      !Array.isArray(commentReadback.comments)||
      commentReadback.comments.length>500)return stop('ORIGINAL_COMMENTS_INCOMPLETE');
    const resultMarkers=commentReadback.comments.filter(c=>
      c?.user?.login==='github-actions[bot]'&&
      /^<!-- zgmini-pc-result:\d+:\d+:[1-6] -->/.test(c.body??''));
    if(resultMarkers.length>1)return stop('ORIGINAL_RESULT_RECEIPT_AMBIGUOUS');
    const prior=replays[String(issue.number)];
    if(prior && !['DONE','SKIPPED_RESULT_PRESENT'].includes(prior.status))
      return stop('BACKLOG_REPLAY_OUTCOME_UNKNOWN');
    const disposition=prior ? 'PRIOR_REPLAY_READBACK_REQUIRED' :
      resultMarkers.length ? 'RESULT_PAIR_READBACK_REQUIRED' :
      'OWNER_REPLAN_REVIEW_REQUIRED';
    entries.push(Object.freeze({originIssue:issue.number,
      requestId:request.requestId,disposition}));
  }
  // A replay reference outside this fully observed pause window may be a
  // missing original, an altered journal or a prior unknown outcome.
  if(Object.keys(replays).some(key=>!candidateIssues.has(key)))
    return stop('BACKLOG_REPLAY_ORIGIN_UNVERIFIED');
  entries.sort((a,b)=>a.originIssue-b.originIssue);
  return Object.freeze({schema:'ZGMINI_996_BACKLOG_PLAN_V1',
    status:'READONLY_DISPOSITIONS_ONLY',code:'NO_AUTO_REPLAY_ALLOWED',
    originalIssueCount:entries.length,entries:Object.freeze(entries),
    executionAuthorized:false,issuePostsAuthorized:0,automaticPcRetries:0});
}

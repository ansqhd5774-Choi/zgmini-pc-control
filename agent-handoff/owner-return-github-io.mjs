// Authenticated, bounded, READ-ONLY GitHub REST IO for owner-return-review.
// This module never sends a mutation request and never prints credentials.
// Run it only with an already-authorized GitHub token and existing Node 22.
// The authenticated GET provenance is still not a Windows/runtime attestation.
const CONTROL='ansqhd5774-Choi/zgmini-pc-control';
const ALLOWED_REPOS=new Set([CONTROL,'ansqhd5774-Choi/zgmini']);
const HOST='https://api.github.com/repos/';
const PAGE_SIZE=100,MAX_COMMENTS=400,MAX_RESPONSE_BYTES=1_048_576;
const reject=code=>{throw new Error('OWNER_GITHUB_READ_'+code);};
const safeInteger=x=>Number.isSafeInteger(x)&&x>0;
const issueApi=id=>HOST+CONTROL+'/issues/'+id;
const isObject=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const repoAllowed=value=>typeof value==='string'&&ALLOWED_REPOS.has(value);
function verifyIssueNumber(issue,n) {
  if(!isObject(issue)||issue.number!==n||!isObject(issue.user)||
     !Number.isSafeInteger(issue.comments)||issue.comments<0||
     issue.comments>MAX_COMMENTS||
     typeof issue.updated_at!=='string')
    reject('ISSUE_METADATA_INVALID');
  return issue;
}
export function createOwnerReturnGithubReadIo({
  token,fetchImpl=globalThis.fetch,
}={}){
  if(typeof token!=='string'||token.length<12||/\s/.test(token)||
     typeof fetchImpl!=='function')reject('AUTH_INPUT_INVALID');
  const issueSnapshots=new Map();
  async function get(path) {
    if(typeof path!=='string'||!path.startsWith(HOST)||path.length>460)
      reject('URL_SCOPE_STOP');
    // The only request verb is GET, to exact caller-constructed GitHub APIs.
    let response;
    try {
      response=await fetchImpl(path,{
        method:'GET',
        redirect:'error',
        headers:{
          Accept:'application/vnd.github+json',
          'X-GitHub-Api-Version':'2022-11-28',
          Authorization:'Bearer '+token,
        },
        signal:AbortSignal.timeout(15000),
      });
    }catch{reject('GET_UNAVAILABLE');}
    if(response?.status!==200||response?.ok!==true)
      reject('HTTP_NOT_OK');
    let raw;
    try {raw=await response.text();}catch{reject('BODY_UNREADABLE');}
    if(typeof raw!=='string'||Buffer.byteLength(raw,'utf8')>MAX_RESPONSE_BYTES)
      reject('BODY_SIZE_STOP');
    try{return JSON.parse(raw);}catch{reject('JSON_INVALID');}
  }
  async function readIssue(number) {
    if(!safeInteger(number))reject('ISSUE_NUMBER_INVALID');
    const v=verifyIssueNumber(await get(issueApi(number)),number);
    issueSnapshots.set(number,{count:v.comments,updatedAt:v.updated_at});
    return v;
  }
  async function readIssueComments(number) {
    if(!safeInteger(number))reject('ISSUE_NUMBER_INVALID');
    // Exact number and timestamp are read directly from the original Issue.
    // Never claim "complete" for a truncated, racing, or unknown ledger.
    if(!issueSnapshots.has(number))await readIssue(number);
    const snapshot=issueSnapshots.get(number);
    if(snapshot.count>MAX_COMMENTS)reject('COMMENT_SCAN_LIMIT_STOP');
    const comments=[];
    const seenIds=new Set();
    const pages=Math.max(1,Math.ceil(snapshot.count/PAGE_SIZE));
    for(let page=1;page<=pages;page++){
      const batch=await get(issueApi(number)+
        '/comments?per_page='+PAGE_SIZE+'&page='+page);
      if(!Array.isArray(batch)||batch.length>PAGE_SIZE)
        reject('COMMENTS_PAGE_INVALID');
      for(const c of batch){
        if(!isObject(c)||!safeInteger(c.id)||seenIds.has(c.id)||
           c.issue_url!==issueApi(number)||
           typeof c.body!=='string'||!isObject(c.user)||
           typeof c.user.login!=='string')
          reject('COMMENT_IDENTITY_STOP');
        seenIds.add(c.id);
        comments.push(c);
      }
    }
    if(comments.length!==snapshot.count)reject('COMMENTS_TRUNCATED');
    const fresh=verifyIssueNumber(await get(issueApi(number)),number);
    if(fresh.comments!==snapshot.count||fresh.updated_at!==snapshot.updatedAt)
      reject('COMMENTS_CHANGED_DURING_READ');
    // Clear stale metadata after one bounded operation.
    issueSnapshots.delete(number);
    return Object.freeze({complete:true,comments});
  }
  async function readPullRequest(repo,number){
    if(!repoAllowed(repo)||!safeInteger(number))
      reject('PR_SCOPE_STOP');
    const pr=await get(HOST+repo+'/pulls/'+number);
    if(!isObject(pr)||pr.number!==number||
       pr.head?.repo?.full_name!==repo||pr.base?.repo?.full_name!==repo)
      reject('PR_REPOSITORY_DRIFT');
    return pr;
  }
  async function readRun(repo,number){
    if(!repoAllowed(repo)||!safeInteger(number))
      reject('RUN_SCOPE_STOP');
    const run=await get(HOST+repo+'/actions/runs/'+number);
    if(!isObject(run)||run.id!==number||
       run.repository?.full_name!==repo)
      reject('RUN_REPOSITORY_DRIFT');
    return run;
  }
  return Object.freeze({
    readIssue,readIssueComments,readPullRequest,readRun,
  });
}

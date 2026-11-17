import {pathToFileURL} from 'node:url';
import path from 'node:path';

// Read-only fast intake observation; no dispatch, remediation, or operating-PC writes.
export const INTERVAL_MS = 5_000;
export const REQUEST_TIMEOUT_MS = 3_500;
export const ISSUE_LIST_URL = 'https://api.github.com/repos/ansqhd5774-Choi/zgmini-pc-control/issues?state=open&labels=agent-handoff&per_page=100';

function stop(code) { throw new Error(code); }

export function summarizeIssues(items) {
  if (!Array.isArray(items) || items.length >= 100) stop('HANDOFF_WATCH_INCOMPLETE_PAGE_STOP');
  const issues = items.filter(x=>!x.pull_request).map(x=>{
    if (!Number.isSafeInteger(x.number) || x.number <= 0 || typeof x.updated_at !== 'string' || !Array.isArray(x.labels))
      stop('HANDOFF_WATCH_INVALID_ISSUE_STOP');
    return {issueNumber:x.number, updatedAt:x.updated_at};
  }).sort((a,b)=>a.issueNumber-b.issueNumber);
  if (new Set(issues.map(x=>x.issueNumber)).size !== issues.length) stop('HANDOFF_WATCH_DUPLICATE_ISSUE_STOP');
  return issues;
}

export function changeSummary(previous, next) {
  if (!Array.isArray(previous)) return {state:'INITIAL_INVENTORY', issueCount:next.length, observedIssueNumbers:next.map(x=>x.issueNumber)};
  const p=new Map(previous.map(x=>[x.issueNumber,x.updatedAt]));
  const n=new Map(next.map(x=>[x.issueNumber,x.updatedAt]));
  return {state:'OBSERVED_CHANGE_ONLY',issueCount:next.length,
    newIssueNumbers:next.filter(x=>!p.has(x.issueNumber)).map(x=>x.issueNumber),
    updatedIssueNumbers:next.filter(x=>p.has(x.issueNumber)&&p.get(x.issueNumber)!==x.updatedAt).map(x=>x.issueNumber),
    noLongerOpenIssueNumbers:previous.filter(x=>!n.has(x.issueNumber)).map(x=>x.issueNumber)};
}

// One GET per cycle. Existing event-triggered brokers remain responsible for intake receipts.
export async function checkOnce({token,fetchImpl=fetch,etag=null,previous=null,timeoutMs=REQUEST_TIMEOUT_MS,signal}={}) {
  if(typeof token!=='string'||!token.trim()) stop('HANDOFF_WATCH_AUTH_REQUIRED');
  if(typeof fetchImpl!=='function') stop('HANDOFF_WATCH_FETCH_REQUIRED');
  if(!Number.isInteger(timeoutMs)||timeoutMs<100||timeoutMs>4_500) stop('HANDOFF_WATCH_TIMEOUT_INVALID');
  const abort=new AbortController();
  const timeout=setTimeout(()=>abort.abort(),timeoutMs);
  const relay=()=>abort.abort();
  if (signal?.aborted) abort.abort();
  else signal?.addEventListener('abort',relay,{once:true});
  try {
    const headers={Accept:'application/vnd.github+json',Authorization:'Bearer '+token,'X-GitHub-Api-Version':'2022-11-28'};
    if(etag) headers['If-None-Match']=etag;
    const response=await fetchImpl(ISSUE_LIST_URL,{method:'GET',headers,signal:abort.signal});
    const remainingRaw=response.headers?.get?.('x-ratelimit-remaining');
    const remaining=remainingRaw == null ? NaN : Number(remainingRaw);
    const limited=Number.isFinite(remaining)&&remaining>=0&&remaining<50;
    const nextEtag=response.headers?.get?.('etag')||etag;
    if(response.status===304)return {state:'UNCHANGED',etag:nextEtag,issues:previous,needsBackoff:limited,noWrite:true};
    if(response.status===403||response.status===429)return {state:'RATE_LIMIT_OR_FORBIDDEN',etag,issues:previous,needsBackoff:true,noWrite:true};
    if(response.status===401)return {state:'AUTH_REJECTED',etag,issues:previous,needsBackoff:true,noWrite:true};
    if(response.status!==200) return {state:'GITHUB_HTTP_ERROR',httpStatus:response.status,etag,issues:previous,needsBackoff:true,noWrite:true};
    const issues=summarizeIssues(await response.json());
    return {state:changeSummary(previous,issues).state,change:changeSummary(previous,issues),etag:nextEtag,issues,needsBackoff:limited,noWrite:true};
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort',relay);
  }
}

export async function runWatch({token,fetchImpl=fetch,signal,intervalMs=INTERVAL_MS,clock=()=>Date.now(),sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms)),onReport=()=>{}}={}) {
  if(intervalMs!==INTERVAL_MS) stop('HANDOFF_WATCH_INTERVAL_MUST_BE_5000');
  let etag=null,previous=null;
  while(!signal?.aborted){
    const start=clock();let backoff=false;
    try {
      const result=await checkOnce({token,fetchImpl,etag,previous,signal});
      etag=result.etag;previous=result.issues;backoff=result.needsBackoff;
      if(result.state!=='UNCHANGED' && (result.state!=='OBSERVED_CHANGE_ONLY' || Object.values(result.change).some(v=>Array.isArray(v)&&v.length>0)))
        onReport({state:result.state,change:result.change||null,observedAt:new Date(clock()).toISOString(),deliveryVerified:false,workExecuted:false});
    } catch(err){
      if(signal?.aborted)break;
      backoff=true;
      onReport({state:'WATCH_READ_FAILED',code:err?.name==='AbortError'?'REQUEST_TIMEOUT':String(err?.message||'UNKNOWN_ERROR').slice(0,80),observedAt:new Date(clock()).toISOString(),deliveryVerified:false,workExecuted:false});
    }
    // No overlapping checks. Back off on failures/rate limits without waiting inside workers.
    await sleep(Math.max(backoff?60_000:0, start+intervalMs-clock()));
  }
}

async function main(env=process.env){
  if(env.ZGMINI_HANDOFF_WATCH_ENABLED!=='true')stop('HANDOFF_WATCH_NOT_ENABLED');
  if(!env.GITHUB_TOKEN)stop('HANDOFF_WATCH_AUTH_REQUIRED');
  await runWatch({token:env.GITHUB_TOKEN,onReport:x=>process.stdout.write(JSON.stringify(x)+'\n')});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)
  main().catch(e=>{process.stderr.write(String(e?.message||'WATCH_STOP').replace(/Bearer\s+\S+/g,'Bearer [REDACTED]')+'\n');process.exitCode=1});

import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {verifyHandoffReceipt} from './intake-receipt-readonly.mjs';
import {createGhCredentialProvider} from './watcher-gh-credential.mjs';

// Read-only fast intake observation; no dispatch, remediation, or operating-PC writes.
export const INTERVAL_MS = 5_000;
export const REQUEST_TIMEOUT_MS = 3_500;
export const ISSUE_LIST_URL = 'https://api.github.com/repos/ansqhd5774-Choi/zgmini-pc-control/issues?state=open&labels=agent-handoff&per_page=100';

function stop(code) { throw new Error(code); }

// Only fixed, source-defined diagnoses may leave the isolated watcher's process.
// Arbitrary error messages can contain a bearer token, local path or response body.
const SAFE_WATCH_ERROR_CODES=new Set([
  'HANDOFF_WATCH_AUTH_REQUIRED',
  'HANDOFF_WATCH_FETCH_REQUIRED',
  'HANDOFF_WATCH_TIMEOUT_INVALID',
  'HANDOFF_WATCH_INCOMPLETE_PAGE_STOP',
  'HANDOFF_WATCH_INVALID_ISSUE_STOP',
  'HANDOFF_WATCH_DUPLICATE_ISSUE_STOP',
  'HANDOFF_WATCH_INTERVAL_MUST_BE_5000'
]);
const SAFE_WATCH_FATAL_CODES=new Set([
  'HANDOFF_WATCH_NOT_ENABLED',
  'HANDOFF_WATCH_AUTH_SOURCE_CONFLICT',
  'HANDOFF_WATCH_AUTH_REQUIRED',
  'HANDOFF_WATCH_AUTH_REJECTED_STOP',
  'HANDOFF_WATCH_AUTH_SOURCE_UNAVAILABLE_STOP',
  'HANDOFF_WATCH_INTERVAL_MUST_BE_5000',
  'HANDOFF_GH_CREDENTIAL_CONFIG_INVALID',
  'HANDOFF_GH_EXECUTABLE_INVALID'
]);
export function safeWatchReadErrorCode(error){
  if(error?.name==='AbortError')return 'REQUEST_TIMEOUT';
  const message=error?.message;
  return typeof message==='string'&&SAFE_WATCH_ERROR_CODES.has(message)
    ?message:'WATCH_REQUEST_FAILED';
}
export function safeWatchFatalErrorCode(error){
  const message=error?.message;
  return typeof message==='string'&&SAFE_WATCH_FATAL_CODES.has(message)
    ?message:'HANDOFF_WATCH_FATAL_STOP';
}

// Use GitHub's reset/retry evidence. Never retry every 60s through a longer
// primary limit window. A 401 is handled as terminal by runWatch.
export function retryDelayMs(headers, nowMs=Date.now()) {
  const read=name=>headers?.get?.(name);
  let delay=60_000;
  const retry=read('retry-after');
  if(retry!==null&&retry!==undefined&&retry!==''&&Number.isFinite(Number(retry))&&Number(retry)>=0)
    delay=Math.max(delay,Math.ceil(Number(retry)*1000));
  const remaining=read('x-ratelimit-remaining');
  const reset=read('x-ratelimit-reset');
  if(remaining!==null&&remaining!==undefined&&remaining!==''&&Number(remaining)===0 &&
      reset!==null&&reset!==undefined&&reset!==''&&Number.isFinite(Number(reset)))
    delay=Math.max(delay,Math.ceil(Number(reset)*1000-nowMs+1000));
  return Math.min(delay,86_400_000);
}

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
export async function checkOnce({token,fetchImpl=fetch,etag=null,previous=null,timeoutMs=REQUEST_TIMEOUT_MS,signal,nowMs=Date.now()}={}) {
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
    const retryAfterMs=retryDelayMs(response.headers,nowMs);
    if(response.status===304)return {state:'UNCHANGED',etag:nextEtag,issues:previous,needsBackoff:limited,retryAfterMs:limited?retryAfterMs:null,noWrite:true};
    if(response.status===403||response.status===429)return {state:'RATE_LIMIT_OR_FORBIDDEN',etag,issues:previous,needsBackoff:true,retryAfterMs,noWrite:true};
    if(response.status===401)return {state:'AUTH_REJECTED',etag,issues:previous,needsBackoff:false,noWrite:true};
    if(response.status!==200) return {state:'GITHUB_HTTP_ERROR',httpStatus:response.status,etag,issues:previous,needsBackoff:true,retryAfterMs,noWrite:true};
    const issues=summarizeIssues(await response.json());
    return {state:changeSummary(previous,issues).state,change:changeSummary(previous,issues),etag:nextEtag,issues,needsBackoff:limited,retryAfterMs:limited?retryAfterMs:null,noWrite:true};
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort',relay);
  }
}

export async function runWatch({token,tokenProvider,fetchImpl=fetch,signal,intervalMs=INTERVAL_MS,clock=()=>Date.now(),sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms)),onReport=()=>{},receiptVerifier=verifyHandoffReceipt}={}) {
  if(intervalMs!==INTERVAL_MS) stop('HANDOFF_WATCH_INTERVAL_MUST_BE_5000');
  if(typeof tokenProvider!=='function' && (!token || typeof token!=='string'))
    stop('HANDOFF_WATCH_AUTH_REQUIRED');
  let etag=null,previous=null,consecutiveFailures=0,activeToken=token;
  // A bounded asynchronous receipt lane: never await it in the 5s discovery loop.
  const receiptQueue=[],receiptDeferred=[],receiptPending=new Set();
  const receiptNeedsRecheck=new Set(),receiptRetryCounts=new Map();
  let checkingReceipt=false,activeReceiptNumber=null,receiptBackoffUntil=0,receiptAuthRejected=false;
  const enqueueReceipt=number=>{
    if(receiptPending.has(number)){
      // Preserve an update seen during an in-flight read, but coalesce it to
      // one follow-up check instead of growing duplicate queued identities.
      if(activeReceiptNumber===number)receiptNeedsRecheck.add(number);
      return false;
    }
    receiptPending.add(number);
    if(receiptQueue.length>=25){receiptDeferred.push(number);return true;}
    receiptQueue.push(number);
    return false;
  };
  const drainReceipts=()=>{
    // The receipt lane cannot occupy the independent five-second GET lane.
    while(receiptQueue.length<25 && receiptDeferred.length>0) receiptQueue.push(receiptDeferred.shift());
    if(checkingReceipt||signal?.aborted||receiptAuthRejected||receiptQueue.length===0||clock()<receiptBackoffUntil) return;
    checkingReceipt=true;
    const number=receiptQueue.shift();
    activeReceiptNumber=number;
    Promise.resolve().then(()=>receiptVerifier({token:activeToken,issueNumber:number,fetchImpl,signal}))
      .then(result=>{
        receiptRetryCounts.delete(number);
        onReport({state:'RECEIPT_OBSERVED',...result,observedAt:new Date(clock()).toISOString(),workExecuted:false});
      })
      .catch(err=>{
        if(signal?.aborted)return;
        const raw=String(err?.message||'');
        const httpStatus=Number(err?.httpStatus)||Number(raw.match(/HTTP_(\d{3})/)?.[1])||null;
        // Do not expose arbitrary exception text or bearer credentials in the PC log.
        const code=/^HANDOFF_RECEIPT_READ_HTTP_\d{3}$/.test(raw)?raw:
          err?.name==='AbortError'?'REQUEST_TIMEOUT':'HANDOFF_RECEIPT_READ_FAILED';
        if(httpStatus===401){
          receiptAuthRejected=true;
          onReport({state:'WATCH_RECEIPT_AUTH_REJECTED_STOP',issueNumber:number,
            observedAt:new Date(clock()).toISOString(),workExecuted:false});
        } else if(httpStatus===403||httpStatus===429||(httpStatus>=500&&httpStatus<=599)||
                  err?.name==='AbortError'){
          const attempt=(receiptRetryCounts.get(number)||0)+1;
          if(attempt<=3){
            receiptRetryCounts.set(number,attempt);
            const hinted=Number(err?.retryAfterMs);
            const waitMs=Math.max(60_000,
              Number.isFinite(hinted)&&hinted>0?Math.min(hinted,86_400_000):0,
              Math.min(3_600_000,60_000*2**(attempt-1)));
            receiptBackoffUntil=Math.max(receiptBackoffUntil,clock()+waitMs);
            receiptNeedsRecheck.add(number);
            onReport({state:'RECEIPT_RETRY_DEFERRED',issueNumber:number,attempt,waitMs,
              observedAt:new Date(clock()).toISOString(),workExecuted:false});
          } else {
            receiptRetryCounts.delete(number);
            receiptNeedsRecheck.delete(number);
            onReport({state:'RECEIPT_RETRY_EXHAUSTED',issueNumber:number,attempt,
              observedAt:new Date(clock()).toISOString(),workExecuted:false});
          }
        }
        onReport({state:'RECEIPT_READ_FAILED',issueNumber:number,code,
          observedAt:new Date(clock()).toISOString(),receiptVerified:false,chatDelivered:false,workExecuted:false});
      })
      .finally(()=>{
        checkingReceipt=false;
        activeReceiptNumber=null;
        receiptPending.delete(number);
        if(receiptNeedsRecheck.delete(number)&&!signal?.aborted&&!receiptAuthRejected)
          enqueueReceipt(number);
        drainReceipts();
      });
  };
  const queueChangedReceipts=change=>{
    const numbers=[...(change?.observedIssueNumbers||[]),...(change?.newIssueNumbers||[]),...(change?.updatedIssueNumbers||[])];
    let deferredCount=0;
    for(const number of numbers){
      if(!Number.isSafeInteger(number)||number<=0)continue;
      if(enqueueReceipt(number))deferredCount++;
    }
    if(deferredCount>0) onReport({state:'RECEIPT_BACKPRESSURE_DEFERRED',
      deferredCount,at:new Date(clock()).toISOString(),workExecuted:false});
    drainReceipts();
  };
  let completedPolls=0,lastPollStart=null,minIntervalMs=Infinity,maxIntervalMs=0;
  while(!signal?.aborted){
    if(receiptAuthRejected)return {state:'AUTH_REJECTED_STOP',noWrite:true};
    const start=clock();let backoff=false,retryAfterMs=0;
    if(lastPollStart!==null){
      const interval=Math.max(0,start-lastPollStart);
      minIntervalMs=Math.min(minIntervalMs,interval);maxIntervalMs=Math.max(maxIntervalMs,interval);
    }
    lastPollStart=start;
    try {
      // An optional credential provider refreshes a short-lived token from the
      // Windows credential store; it never blocks the independent work Runner.
      const selectedToken=typeof tokenProvider==='function'?await tokenProvider():token;
      if(typeof selectedToken!=='string'||!selectedToken.trim())stop('HANDOFF_WATCH_AUTH_REQUIRED');
      activeToken=selectedToken;
      const result=await checkOnce({token:selectedToken,fetchImpl,etag,previous,signal,nowMs:start});
      if(result.state==='AUTH_REJECTED'){
        onReport({state:'WATCH_AUTH_REJECTED_STOP',observedAt:new Date(clock()).toISOString(),
          deliveryVerified:false,workExecuted:false});
        return {state:'AUTH_REJECTED_STOP',noWrite:true};
      }
      etag=result.etag;previous=result.issues;backoff=result.needsBackoff;
      consecutiveFailures=backoff?consecutiveFailures+1:0;
      retryAfterMs=backoff?Math.max(result.retryAfterMs||0,Math.min(3_600_000,60_000*2**Math.min(consecutiveFailures-1,6))):0;
      queueChangedReceipts(result.change);
      if(result.state!=='UNCHANGED' && (result.state!=='OBSERVED_CHANGE_ONLY' || Object.values(result.change).some(v=>Array.isArray(v)&&v.length>0)))
        onReport({state:result.state,change:result.change||null,observedAt:new Date(clock()).toISOString(),deliveryVerified:false,workExecuted:false});
    } catch(err){
      if(signal?.aborted)break;
      // A missing/invalid local credential is a C-setup problem, not a
      // transient GitHub rate limit. Stop this isolated watcher immediately.
      if(err?.message==='HANDOFF_GH_CREDENTIAL_UNAVAILABLE' || err?.message==='HANDOFF_GH_TOKEN_INVALID'){
        onReport({state:'WATCH_AUTH_SOURCE_UNAVAILABLE_STOP',code:err.message,
          observedAt:new Date(clock()).toISOString(),deliveryVerified:false,workExecuted:false});
        return {state:'AUTH_SOURCE_UNAVAILABLE_STOP',noWrite:true};
      }
      backoff=true;
      consecutiveFailures++;
      retryAfterMs=Math.min(3_600_000,60_000*2**Math.min(consecutiveFailures-1,6));
      onReport({state:'WATCH_READ_FAILED',code:safeWatchReadErrorCode(err),observedAt:new Date(clock()).toISOString(),deliveryVerified:false,workExecuted:false});
    }
    // A single low-volume heartbeat per 12 checks provides real PC timing
    // evidence without logging issue bodies, authentication or every poll.
    completedPolls++;
    if(completedPolls%12===0){
      onReport({state:'WATCH_HEARTBEAT',completedPolls,
        observedMinIntervalMs:Number.isFinite(minIntervalMs)?minIntervalMs:null,
        observedMaxIntervalMs:maxIntervalMs,backoffActive:backoff,
        observedAt:new Date(clock()).toISOString(),workExecuted:false,noWrite:true});
      minIntervalMs=Infinity;maxIntervalMs=0;
    }
    // No overlapping checks. Back off on failures/rate limits without waiting inside workers.
    drainReceipts();
    await sleep(Math.max(backoff?retryAfterMs:0, start+intervalMs-clock()));
  }
}

async function main(env=process.env){
  if(env.ZGMINI_HANDOFF_WATCH_ENABLED!=='true')stop('HANDOFF_WATCH_NOT_ENABLED');
  const fromGhStore=env.ZGMINI_HANDOFF_WATCH_AUTH_SOURCE==='GH_CREDENTIAL_STORE';
  if(fromGhStore && (env.GH_TOKEN || env.GITHUB_TOKEN))stop('HANDOFF_WATCH_AUTH_SOURCE_CONFLICT');
  if(!fromGhStore && !env.GITHUB_TOKEN)stop('HANDOFF_WATCH_AUTH_REQUIRED');
  const tokenProvider=fromGhStore?createGhCredentialProvider():null;
  const result=await runWatch({token:env.GITHUB_TOKEN,tokenProvider,
    onReport:x=>process.stdout.write(JSON.stringify(x)+'\n')});
  if(result?.state==='AUTH_REJECTED_STOP')stop('HANDOFF_WATCH_AUTH_REJECTED_STOP');
  if(result?.state==='AUTH_SOURCE_UNAVAILABLE_STOP')stop('HANDOFF_WATCH_AUTH_SOURCE_UNAVAILABLE_STOP');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)
  main().catch(e=>{process.stderr.write(safeWatchFatalErrorCode(e)+'\n');process.exitCode=1});

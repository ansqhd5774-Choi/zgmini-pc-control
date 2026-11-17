import {assessIncident, HANDOFF_REPOSITORY} from './queue-selector.mjs';

// Read-only, change-scoped verification. It never acknowledges an agent or posts comments.
const API = 'https://api.github.com/repos/' + HANDOFF_REPOSITORY + '/issues/';

export async function verifyHandoffReceipt({
  token, issueNumber, fetchImpl=fetch, signal, timeoutMs=3500
}={}) {
  if (typeof token!=='string'||!token.trim()) throw Error('HANDOFF_RECEIPT_AUTH_REQUIRED');
  if (!Number.isSafeInteger(issueNumber)||issueNumber<1) throw Error('HANDOFF_RECEIPT_ISSUE_INVALID');
  if (typeof fetchImpl!=='function') throw Error('HANDOFF_RECEIPT_FETCH_INVALID');
  if (!Number.isInteger(timeoutMs)||timeoutMs<100||timeoutMs>4500) throw Error('HANDOFF_RECEIPT_TIMEOUT_INVALID');

  const read = async url => {
    const controller=new AbortController(), relay=()=>controller.abort();
    if(signal?.aborted) controller.abort();
    else signal?.addEventListener('abort',relay,{once:true});
    const t=setTimeout(()=>controller.abort(),timeoutMs);
    try {
      const response=await fetchImpl(url,{method:'GET',headers:{
        Accept:'application/vnd.github+json',Authorization:'Bearer '+token,
        'X-GitHub-Api-Version':'2022-11-28'
      },signal:controller.signal});
      if(response.status!==200) throw Error('HANDOFF_RECEIPT_READ_HTTP_'+response.status);
      return await response.json();
    } finally {
      clearTimeout(t);
      signal?.removeEventListener('abort',relay);
    }
  };

  const issue=await read(API+issueNumber);
  if(issue?.number!==issueNumber||issue.pull_request||issue.state!=='open') {
    return {issueNumber,state:'ISSUE_NOT_OPEN_OR_MISMATCH',receiptVerified:false,chatDelivered:false,noWrite:true};
  }
  let comments=[],complete=false;
  for(let page=1;page<=4;page++){
    const items=await read(API+issueNumber+'/comments?per_page=100&page='+page);
    if(!Array.isArray(items)||items.length>100)throw Error('HANDOFF_RECEIPT_COMMENTS_INVALID');
    comments.push(...items);
    if(items.length<100){complete=true;break;}
  }
  if(!complete)return {issueNumber,state:'COMMENT_INVENTORY_INCOMPLETE',receiptVerified:false,chatDelivered:false,noWrite:true};
  const assessment=assessIncident({...issue,repository:HANDOFF_REPOSITORY},comments);
  const receiptVerified=['READY','ALREADY_SELECTED','RESULT_ALREADY_PRESENT'].includes(assessment.state);
  return {issueNumber,state:assessment.state,receiptVerified,chatDelivered:false,noWrite:true};
}

/**
 * Read-only GitHub REST snapshot acquisition for offline issue lifecycle review.
 * The injected GitHub client MUST be authenticated by the caller. No token,
 * private key, approval, issue closure, or operational PC action exists here.
 * A pinned artifact commit avoids following mutable main while reading a pair.
 */
import {createHash} from 'node:crypto';
import {verifyPcJobReceiptPair} from './issue-lifecycle-review-evidence.mjs';

const REPO='ansqhd5774-Choi/zgmini-pc-control';
const sha40=x=>typeof x==='string'&&/^[0-9a-f]{40}$/i.test(x);
const int=x=>Number.isSafeInteger(x)&&x>0;
const deny=reason=>Object.freeze({verified:false,reason});
const decode=(data)=>{
  if(!data||data.type!=='file'||data.encoding!=='base64'||
      typeof data.content!=='string'||!sha40(data.sha)||data.size>1024*1024)
    return null;
  const raw=data.content.replace(/\s/g,'');
  if(!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(raw))
    return null;
  const bytes=Buffer.from(raw,'base64');
  if(bytes.length>1024*1024||bytes.length!==data.size)return null;
  const blob=createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
  return blob.toLowerCase()===data.sha.toLowerCase()?bytes.toString('utf8'):null;
};
/**
 * @param {{githubGet:Function,issueNumber:number,runId:number,attempt:number,
 *   seat:number,commentId:number,artifactCommitSha:string}} request
 * githubGet receives exact relative REST path and must return {status,data}.
 */
export async function readVerifiedPcJobReceipt(request={}){
  const {githubGet,issueNumber,runId,attempt,seat,commentId,artifactCommitSha}=request;
  if(typeof githubGet!=='function'||!int(issueNumber)||!int(runId)||!int(commentId)||
     !int(attempt)||attempt>999||!int(seat)||seat>6||!sha40(artifactCommitSha))
    return deny('UNTRUSTED_READER_ARGUMENT');
  const prefix=`repos/${REPO}/`;
  const get=async path=>{
    try {
      const response=await githubGet(prefix+path);
      return response?.status===200?response.data:null;
    }catch{return null;}
  };
  const issue=await get(`issues/${issueNumber}`);
  const run=await get(`actions/runs/${runId}`);
  const comment=await get(`issues/comments/${commentId}`);
  if(!issue||issue.number!==issueNumber||issue.pull_request||
     issue.repository_url!==`https://api.github.com/repos/${REPO}`||
     !run||run.id!==runId||run.event!=='issues'||
     run.repository?.full_name!==REPO||
     !comment||comment.id!==commentId||
     comment.issue_url!==`https://api.github.com/repos/${REPO}/issues/${issueNumber}`)
    return deny('GITHUB_OBJECT_PROVENANCE_MISMATCH');
  const base=`results/${runId}-${attempt}-seat-${seat}`;
  const [json,txt]=await Promise.all(['json','txt'].map(ext=>
    get(`contents/${base}.${ext}?ref=${artifactCommitSha}`)));
  const jsonText=decode(json),txtText=decode(txt);
  if(jsonText===null||txtText===null)return deny('PINNED_BLOB_UNVERIFIED');
  const verified=verifyPcJobReceiptPair({
    issue,run,comment,jsonText,txtText,attempt,seat
  });
  if(verified.verified!==true)return deny(verified.reason);
  // Detect Issue state/body changes and workflow reruns during multi-request read.
  // This is a conservative snapshot guard, not a write lock or close permission.
  const [issueAfter,runAfter]=await Promise.all([
    get(`issues/${issueNumber}`),get(`actions/runs/${runId}`)
  ]);
  if(!issueAfter||issueAfter.number!==issueNumber||
      issueAfter.repository_url!==issue.repository_url||
      issueAfter.state!=='open'||issueAfter.body!==issue.body||
      typeof issue.updated_at!=='string'||!issue.updated_at||
      issueAfter.updated_at!==issue.updated_at||
      !runAfter||runAfter.id!==runId||
      runAfter.repository?.full_name!==REPO||
      runAfter.run_attempt!==attempt||runAfter.status!=='completed'||
      runAfter.conclusion!=='success')
    return deny('SNAPSHOT_CHANGED_DURING_REVIEW');
  return Object.freeze({verified:true,reason:'AUTHENTICATED_PINNED_GITHUB_RECEIPT',
    report:verified.report,evidence:verified.evidence,
    artifactCommitSha});
}

import {parseHandoff,fingerprintHandoff,routeHandoff} from './contract.mjs';
import {assessIncident,HANDOFF_BOT,HANDOFF_OWNER,HANDOFF_REPOSITORY} from './queue-selector.mjs';

export const WORK_SCHEMA='ZGMINI_HANDOFF_WORK_UPDATE_V1';
export const WORK_RECEIPT='HANDOFF_WORK_STATE_RECORDED_V1';
const STATES=new Set(['ACKNOWLEDGED','WORKING','WAITING_EVIDENCE']);
const REQUIRED=['schema','updateId','incidentId','fingerprint','role','state'];
const stop=s=>{throw Error('HANDOFF_WORK_'+s);};
const url=n=>'https://api.github.com/repos/'+HANDOFF_REPOSITORY+'/issues/'+n;
const own=v=>v&&typeof v==='object'&&!Array.isArray(v);

export function parseWorkUpdate(body) {
  if(typeof body!=='string'||body.length>1024)stop('BODY_SIZE_STOP');
  let data;try{data=JSON.parse(body);}catch{stop('JSON_STOP');}
  if(!own(data)||Object.keys(data).length!==REQUIRED.length||
    !REQUIRED.every(k=>Object.hasOwn(data,k)))stop('FIELDS_STOP');
  if(data.schema!==WORK_SCHEMA||
    typeof data.updateId!=='string'||!/^work-[a-z0-9-]{12,80}$/.test(data.updateId)||
    typeof data.incidentId!=='string'||!/^handoff-[a-z0-9-]{12,80}$/.test(data.incidentId)||
    typeof data.fingerprint!=='string'||!/^[a-f0-9]{64}$/.test(data.fingerprint)||
    !['COMMON_PROCESS_OWNER','ORIGIN_FUNCTION_OWNER'].includes(data.role)||
    !STATES.has(data.state))stop('CONTENT_STOP');
  return Object.freeze(data);
}

export function workReceipt(data, commentId) {
  if(!Number.isSafeInteger(commentId)||commentId<1)stop('COMMENT_ID_STOP');
  return [WORK_RECEIPT,'updateId: '+data.updateId,
    'sourceCommentId: '+commentId,'incidentId: '+data.incidentId,
    'fingerprint: '+data.fingerprint,'role: '+data.role,
    'state: '+data.state,'evidence: OWNER_GITHUB_COMMENT_ONLY',
    'aiExecution: NOT_ATTESTED','operationalWrites: 0'].join('\n');
}

function ownedComments(comments) {
  return comments.filter(c=>c?.user?.login===HANDOFF_OWNER &&
    typeof c.body==='string' && c.body.startsWith('{"schema":"'+WORK_SCHEMA+'"'));
}

function verifiedReceiptFor(comments,body,commentId,issueUrl) {
  const matched=comments.filter(c=>c?.user?.login===HANDOFF_BOT &&
    typeof c.body==='string' && c.body.startsWith(WORK_RECEIPT+'\n') &&
    c.body.split('\n').includes('sourceCommentId: '+commentId));
  if(matched.length>1||matched.some(c=>c.issue_url!==issueUrl||c.body!==body))
    stop('RECEIPT_CONFLICT_STOP');
  return matched.length===1;
}

export function evaluateWorkUpdate(issue,comments,sourceComment) {
  if(!own(issue)||!Array.isArray(comments)||
    !own(sourceComment)||!Number.isSafeInteger(sourceComment.id)||
    sourceComment.id<1||issue.state!=='open'||issue.pull_request)
    stop('ISSUE_OR_INVENTORY_STOP');
  const issueUrl=url(issue.number);
  if(sourceComment.user?.login!==HANDOFF_OWNER ||
    sourceComment.issue_url!==issueUrl)stop('SOURCE_IDENTITY_STOP');
  const identity=comments.filter(c=>c?.id===sourceComment.id);
  if(identity.length!==1||identity[0].user?.login!==HANDOFF_OWNER||
    identity[0].body!==sourceComment.body||identity[0].issue_url!==issueUrl)
    stop('SOURCE_COMMENT_READBACK_STOP');
  if(assessIncident(issue,comments).state!=='ALREADY_SELECTED')
    stop('AUTHENTICATED_SELECTION_REQUIRED');
  if(comments.some(c=>c?.user?.login===HANDOFF_BOT &&
    (c.body?.startsWith('HANDOFF_RESULT_RECORDED\n')||
     c.body?.startsWith('HANDOFF_ORIGIN_RESULT_RECORDED\n'))))
    stop('RESULT_ALREADY_RECORDED');
  const handoff=parseHandoff(issue.body);
  const data=parseWorkUpdate(sourceComment.body);
  if(data.incidentId!==handoff.incidentId||
    data.fingerprint!==fingerprintHandoff(handoff)||
    data.role!==routeHandoff(handoff).role)stop('ORIGIN_PROOF_MISMATCH');
  const existing=workReceipt(data,sourceComment.id);
  const all=ownedComments(comments);
  // Progress updates are immutable and processed in issue-comment ID order.
  const previous=all.filter(c=>c.id<sourceComment.id).sort((a,b)=>a.id-b.id);
  const newer=all.filter(c=>c.id>sourceComment.id);
  const duplicated=all.filter(c=>c.id===sourceComment.id);
  if(duplicated.length!==1)stop('SOURCE_DUPLICATED');
  if(newer.length&&!verifiedReceiptFor(comments,existing,sourceComment.id,issueUrl))
    stop('NEWER_OWNER_UPDATE_EXISTS');
  let latest=null;
  const ids=new Set();
  for(const c of previous){
    if(c.issue_url!==issueUrl)stop('PRIOR_ORIGIN_STOP');
    const p=parseWorkUpdate(c.body);
    if(p.incidentId!==data.incidentId||p.fingerprint!==data.fingerprint||
      p.role!==data.role||ids.has(p.updateId))stop('PRIOR_UPDATE_CONFLICT');
    ids.add(p.updateId);
    if(!verifiedReceiptFor(comments,workReceipt(p,c.id),c.id,issueUrl))
      stop('PRIOR_RECEIPT_MISSING');
    if(!allowedTransition(latest,p.state))stop('PRIOR_SEQUENCE_INVALID');
    latest=p.state;
  }
  if(ids.has(data.updateId))stop('UPDATE_ID_REUSED');
  if(!allowedTransition(latest,data.state))stop('TRANSITION_STOP');
  const recorded=verifiedReceiptFor(comments,existing,sourceComment.id,issueUrl);
  return Object.freeze({state:recorded?'ALREADY_RECORDED':'READY',
    issueNumber:issue.number,sourceCommentId:sourceComment.id,
    updateId:data.updateId,progressState:data.state,receipt:existing});
}

function allowedTransition(from,to) {
  if(from===null)return to==='ACKNOWLEDGED';
  if(from==='ACKNOWLEDGED')return to==='WORKING'||to==='WAITING_EVIDENCE';
  if(from==='WORKING')return to==='WAITING_EVIDENCE';
  if(from==='WAITING_EVIDENCE')return to==='WORKING';
  return false;
}

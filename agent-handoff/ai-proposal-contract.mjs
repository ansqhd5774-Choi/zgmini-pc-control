import {parseHandoff, fingerprintHandoff} from './contract.mjs';
import {assessIncident, HANDOFF_REPOSITORY, HANDOFF_BOT,
  selectionReceipt} from './queue-selector.mjs';

export const AI_ATTEMPT_MARKER = 'HANDOFF_AI_PROPOSAL_ATTEMPT_V1';
export const AI_RESULT_MARKER = 'HANDOFF_AI_PROPOSAL_RESULT_V1';
const ALLOWED_CODE = /^(?:writer-b|controller|agent-handoff|tools)\/[a-zA-Z0-9_.-]+(?:\/[a-zA-Z0-9_.-]+)*\.(?:mjs|js)$/;
const REPAIRABLE_KINDS = new Set(['COMMON_CONTROLLER','COMMON_RUNNER','COMMON_WRITER','FEATURE']);
const MAX_SOURCE = 65536;
const MAX_REPLACEMENT = 8000;

function stop(s) {throw Error('HANDOFF_AI_'+s);}

// Only already authenticated, already selected cases can be submitted.
// GitHub comments are evidence, never commands to execute on a PC.
export function prepareAiCase(issue, comments, explicitPath=null) {
  const verdict=assessIncident(issue,comments);
  if(verdict.state!=='ALREADY_SELECTED') stop('SELECTOR_PROOF_REQUIRED');
  const request=parseHandoff(issue.body);
  if(!REPAIRABLE_KINDS.has(request.failure.kind)) stop('FAILURE_KIND_STOP');
  // A recovery/lease/state-unknown incident is an operational evidence gap,
  // not proof that another source edit would repair the operating PC.
  if(request.failure.code==='BACKLOG_OR_RECOVERY_NOT_VERIFIED' ||
    request.failure.code.includes('STATE_UNKNOWN') ||
    request.failure.code.includes('RECOVERY_REQUIRED'))
    stop('RUNTIME_EVIDENCE_REQUIRED');
  const expected=selectionReceipt(request,fingerprintHandoff(request));
  const issueUrl='https://api.github.com/repos/'+HANDOFF_REPOSITORY+'/issues/'+issue.number;
  if(comments.filter(c=>c.user?.login===HANDOFF_BOT &&
    c.issue_url===issueUrl && c.body===expected).length!==1)
    stop('CANDIDATE_RECEIPT_INVALID');
  const claimed=comments.filter(c=>c.user?.login===HANDOFF_BOT &&
    (c.body?.startsWith(AI_ATTEMPT_MARKER+'\n') ||
     c.body?.startsWith(AI_RESULT_MARKER+'\n')));
  if(claimed.length>0) stop('ALREADY_ATTEMPTED_OR_RESULT_PRESENT');
  if(request.origin.repository!==HANDOFF_REPOSITORY) stop('CROSS_REPO_NOT_SUPPORTED');
  const paths=request.failure.fileRefs.filter(x=>ALLOWED_CODE.test(x));
  // Exact source reference is mandatory: never guess another source file from failure text.
  if(!paths.length) stop('NO_APPROVED_CODE_REFERENCE');
  const path=explicitPath??paths[0];
  if(!paths.includes(path)) stop('PATH_OUTSIDE_INCIDENT_PROOF');
  return Object.freeze({number:issue.number,id:request.incidentId,
    fingerprint:fingerprintHandoff(request),path,
    failureKind:request.failure.kind,failureCode:request.failure.code,
    checkpoint:request.origin.checkpoint, sourceAtIncident:request.origin.sourceSha});
}

export function attemptReceipt(task) {
  if(!task||!Number.isSafeInteger(task.number)||task.number<1||
    !/^[a-f0-9]{64}$/.test(task.fingerprint)) stop('INVALID_TASK');
  return [AI_ATTEMPT_MARKER,'incidentId: '+task.id,
    'fingerprint: '+task.fingerprint,'status: ATTEMPT_CLAIMED',
    'scope: GITHUB_DRAFT_PR_ONLY','pcOperationalWrites: 0',
    'automaticPcRetries: 0'].join('\n');
}

export function normalizePatch(proposal, task, original) {
  if(!proposal || typeof proposal!=='object'||Array.isArray(proposal)||
    typeof original!=='string'||Buffer.byteLength(original)>MAX_SOURCE)
    stop('INVALID_MODEL_INPUT');
  if(proposal.status==='NEEDS_EVIDENCE') return Object.freeze({
    status:'NEEDS_EVIDENCE',reason:'MODEL_REQUIRES_MORE_EVIDENCE'});
  if(proposal.status!=='PROPOSE'||proposal.path!==task.path ||
    typeof proposal.oldSnippet!=='string'||typeof proposal.newSnippet!=='string'||
    typeof proposal.reason!=='string'||proposal.reason.length>500)
    stop('PATCH_SCHEMA_OR_PATH_INVALID');
  const old=proposal.oldSnippet,newText=proposal.newSnippet;
  if(!old.length || old.length>MAX_REPLACEMENT || newText.length>MAX_REPLACEMENT ||
    newText===old || old.trim().length===0) stop('PATCH_SIZE_OR_NOOP');
  const first=original.indexOf(old);
  if(first<0||original.indexOf(old,first+1)>=0) stop('PATCH_ANCHOR_NOT_UNIQUE');
  const updated=original.slice(0,first)+newText+original.slice(first+old.length);
  if(updated===original || Buffer.byteLength(updated)>MAX_SOURCE) stop('PATCH_RESULT_INVALID');
  // Reject attempts to replace a whole security-sensitive source in one step.
  if(old.length>Math.min(5000,Math.floor(original.length*0.5)))
    stop('PATCH_TOO_BROAD');
  return Object.freeze({status:'PROPOSE',path:task.path,updated,
    reason:proposal.reason.replace(/[\r\n]/g,' ').slice(0,300)});
}

export const AI_SCHEMA=Object.freeze({type:'object',additionalProperties:false,
  required:['status','path','oldSnippet','newSnippet','reason'],
  properties:{
    status:{type:'string',enum:['PROPOSE','NEEDS_EVIDENCE']},
    path:{type:'string'},oldSnippet:{type:'string'},
    newSnippet:{type:'string'},reason:{type:'string'}
  }});

export function safeBranchName(task) {
  return 'ai/handoff-'+task.number+'-'+task.fingerprint.slice(0,12);
}

export function resultReceipt(task,{status,prNumber,commitSha}) {
  if(status!=='DRAFT_PR_CREATED' || !Number.isSafeInteger(prNumber) ||
    prNumber<1 || !/^[a-f0-9]{40}$/.test(commitSha))
    stop('RESULT_EVIDENCE_INVALID');
  return [AI_RESULT_MARKER,'incidentId: '+task.id,
    'fingerprint: '+task.fingerprint,'state: DRAFT_PR_CREATED',
    'pullRequest: '+prNumber,'commitSha: '+commitSha,
    'testStatus: NOT_VERIFIED','runtimeStatus: NOT_APPLIED',
    'pcOperationalWrites: 0','automaticPcRetries: 0'].join('\n');
}

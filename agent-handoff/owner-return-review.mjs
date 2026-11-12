// Source-only, side-effect-free original owner's result readback classifier.
// Inputs must be fetched from GitHub using the existing connector, including
// complete paginated comments. This module DOES NOT fetch GitHub, wake an owner
// ChatGPT, grant PC privileges or attest that the caller's inputs are genuine.
import {parseHandoff} from './contract.mjs';
import {parseAgentResult,resultDigest,verifyAgentResult} from './result-contract.mjs';
import {centralResultReceipt,originResultReceipt} from './result-receipts.mjs';

const REPO='ansqhd5774-Choi/zgmini-pc-control';
const API='https://api.github.com/repos/'+REPO+'/issues/';
const OWNER='ansqhd5774-Choi',BOT='github-actions[bot]';
const safeIssue=n=>Number.isSafeInteger(n)&&n>0;
const forbidden=code=>{throw Object.assign(new Error(code),{code});};
const issueURL=n=>API+n;
const commentsValid=(c,complete)=>complete===true&&Array.isArray(c)&&
  c.length<=400&&c.every(z=>z&&typeof z==='object'&&!Array.isArray(z));
const hasLabel=(i,name)=>Array.isArray(i?.labels)&&i.labels.some(x=>x?.name===name);
const isBotReceipt=(x,n,prefix)=>x?.user?.login===BOT&&
  x.issue_url===issueURL(n)&&typeof x.body==='string'&&
  x.body.startsWith(prefix+'\n');
const knownResult=(c,id,n)=>c.user?.login===OWNER&&
  c.issue_url===issueURL(n)&&typeof c.body==='string'&&
  c.body.length<=4096&&c.body.includes('ZGMINI_AGENT_HANDOFF_RESULT_V1')&&
  (()=>{try{return JSON.parse(c.body)?.resultId===id;}catch{return false;}})();

export function reviewOwnerHandoffReturn({
  originIssue,originComments,originCommentsComplete,
  incidentIssue,incidentComments,incidentCommentsComplete,
  pullRequest,testRun,
}={}){
  if(!safeIssue(originIssue?.number)||originIssue?.user?.login!==OWNER||
     originIssue.pull_request||typeof originIssue.body!=='string'||
     originIssue.body.length>8192)
    forbidden('OWNER_ORIGIN_ISSUE_INVALID');
  if(!commentsValid(originComments,originCommentsComplete))
    forbidden('OWNER_ORIGIN_COMMENTS_INCOMPLETE');
  let request;
  try{request=JSON.parse(originIssue.body);}catch{forbidden('OWNER_ORIGIN_JSON_INVALID');}
  if(!request||typeof request!=='object'||Array.isArray(request)||
     typeof request.requestId!=='string'||typeof request.chatId!=='string')
    forbidden('OWNER_ORIGIN_REQUEST_INVALID');
  const pc=originIssue.title==='pc-job'&&hasLabel(originIssue,'pc-job')&&
    request.schema==='ZGMINI_PC_JOB_V1';
  const writer=originIssue.title==='pc-writer-source-install'&&
    hasLabel(originIssue,'pc-writer-b-install')&&
    request.schema==='ZGMINI_PC_WRITER_SOURCE_B_REQUEST_V1'&&
    request.operation==='pc-writer-source-install'&&
    request.controlRepository===REPO;
  if(!pc&&!writer)forbidden('OWNER_ORIGIN_SCOPE_DENIED');
  // A bot return marker in the original Issue with a different issue_url
  // is an evidence conflict, not a clean "no result yet".
  const returned=originComments.filter(c=>c?.user?.login===BOT&&
    typeof c.body==='string'&&
    c.body.startsWith('HANDOFF_ORIGIN_RESULT_RECORDED\n'));
  if(returned.some(c=>c.issue_url!==issueURL(originIssue.number)))
    forbidden('OWNER_ORIGIN_RECEIPT_WRONG_ISSUE');
  if(returned.length===0)return Object.freeze({
    state:'NO_RETURNED_RESULT',originIssue:originIssue.number,
    ownerChatReceived:'UNKNOWN',runtimeVerified:false,
    executionAuthorized:false,operationalWrites:0,automaticPcRetries:0,
  });
  if(returned.length!==1)forbidden('OWNER_MULTIPLE_ORIGIN_RETURNS_REVIEW');
  const receipt=returned[0].body;
  const match=receipt.match(/^resultId: (result-[a-z0-9-]{12,80})$/m);
  const ref=receipt.match(/^handoffIssue: ([1-9][0-9]{0,15})$/m);
  if(!match||!ref||!Number.isSafeInteger(Number(ref[1])))
    forbidden('OWNER_ORIGIN_RETURN_FIELDS_INVALID');
  const incidentNumber=Number(ref[1]);
  if(incidentNumber===originIssue.number||incidentIssue?.number!==incidentNumber||
    incidentIssue?.pull_request||
    ![OWNER,BOT].includes(incidentIssue?.user?.login)||
    !hasLabel(incidentIssue,'agent-handoff')||
    typeof incidentIssue?.body!=='string')
    forbidden('OWNER_INCIDENT_BINDING_INVALID');
  if(!commentsValid(incidentComments,incidentCommentsComplete))
    forbidden('OWNER_INCIDENT_COMMENTS_INCOMPLETE');
  const handoff=parseHandoff(incidentIssue.body);
  if(incidentIssue.title!=='agent-handoff '+handoff.incidentId||
     handoff.origin.repository!==REPO||
     handoff.origin.issueNumber!==originIssue.number||
     handoff.failure.evidenceIssueNumber!==originIssue.number||
     handoff.origin.requestId!==request.requestId||
     handoff.origin.chatId!==request.chatId||
     (pc&&(handoff.origin.sourceSha!==request.sourceSha||
        handoff.origin.branch!==request.sourceBranch||
        !['ansqhd5774-Choi/zgmini',REPO].includes(request.sourceRepository)))||
     (writer&&handoff.failure.kind!=='COMMON_WRITER'))
    forbidden('OWNER_HANDOFF_ORIGIN_DRIFT');
  const ownerResults=incidentComments.filter(x=>knownResult(
    x,match[1],incidentNumber));
  if(ownerResults.length!==1)
    forbidden('OWNER_RESULT_COMMENT_MISSING_OR_DUPLICATE');
  const result=parseAgentResult(ownerResults[0].body);
  if(result.resultId!==match[1])forbidden('OWNER_RESULT_ID_DRIFT');
  const verified=verifyAgentResult(handoff,result,pullRequest,testRun,{
    featureSourceRepository:handoff.failure.kind==='FEATURE'&&pc?
      request.sourceRepository:null,
  });
  const digest=resultDigest(result),repo=result.pullRequest.repository;
  const expectedOrigin=originResultReceipt(result,digest,repo,verified,incidentNumber);
  const expectedCentral=centralResultReceipt(handoff,result,digest,repo,verified);
  if(receipt!==expectedOrigin)forbidden('OWNER_ORIGIN_RECEIPT_NOT_EXACT');
  const central=incidentComments.filter(c=>isBotReceipt(
    c,incidentNumber,'HANDOFF_RESULT_RECORDED'));
  if(central.length!==1||central[0].body!==expectedCentral)
    forbidden('OWNER_CENTRAL_RECEIPT_NOT_EXACT');
  return Object.freeze({
    state:'RETURN_EVIDENCE_REVIEWABLE',originIssue:originIssue.number,
    incidentIssue:incidentNumber,requestId:request.requestId,
    resultId:result.resultId,resultDigest:digest,
    repairRepository:repo,repairPr:result.pullRequest.number,
    repairHeadSha:result.pullRequest.headSha,
    testRunId:result.testRun.runId,
    lastKnownCheckpoint:handoff.origin.checkpoint,
    failureCode:handoff.failure.code,
    lastPass:handoff.failure.lastPass,firstFail:handoff.failure.firstFail,
    brokerState:verified.state,
    nextAction:'OWNER_REVIEW_LAST_VERIFIED_FUNCTION_STEP',
    resultReceiptCompared:true,
    suppliedGithubInputsAuthenticated:false,
    ownerChatReceived:'UNKNOWN',runtimeVerified:false,
    sourceInstallVerified:false,executionAuthorized:false,
    operationalWrites:0,automaticPcRetries:0,
  });
}

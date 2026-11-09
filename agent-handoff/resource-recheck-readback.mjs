// SOURCE-ONLY GitHub readback adapter for an existing #68 resource wait.
// No PC action, lease release, issue comment, scheduler or automatic retry.
// Read operations are injected by the caller and must use authenticated
// bounded GitHub GETs; a candidate never authorizes owner replan.
import {createHash} from 'node:crypto';
import {parseResourceWaitComment} from './resource-wait-ledger.mjs';
import {summarizeResourceRecheckEvidence} from '../shared-resource/lifecycle.mjs';

const REPO='ansqhd5774-Choi/zgmini-pc-control';
const OWNER='ansqhd5774-Choi';
const BOT='github-actions[bot]';
const SHA40=/^[a-f0-9]{40}$/;
const SHA64=/^[a-f0-9]{64}$/;
const MAX_BYTES=65536;
const stop=code=>{throw Error('RESOURCE_RECHECK_READBACK_'+code);};
const issueUrl=number=>`https://api.github.com/repos/${REPO}/issues/${number}`;
const hasLabel=(issue,label)=>issue?.labels?.some(x=>x?.name===label);
const sha256=value=>createHash('sha256').update(value).digest('hex');

function content(file,path,ref='main',maxBytes=MAX_BYTES){
  if(file?.path!==path||file.ref!==ref||
     typeof file.content!=='string'||
     Buffer.byteLength(file.content)>maxBytes) return null;
  return file.content;
}
function parsed(file,path,ref='main'){
  const bytes=content(file,path,ref);
  if(bytes===null)return null;
  try{return JSON.parse(bytes);}catch{return null;}
}
function txtMatches(txt,pairs){
  if(typeof txt!=='string')return false;
  const lines=txt.split(/\r?\n/);
  return pairs.every(([key,value])=>{
    const found=lines.filter(line=>line.startsWith(`${key}=`));
    return found.length===1&&found[0]===`${key}=${value}`;
  });
}
function issueMatches(issue,wait,label,title){
  return issue?.repository===REPO&&issue.number===wait.origin.issueNumber&&
    issue.user?.login===OWNER&&issue.title===title&&hasLabel(issue,label)&&
    typeof issue.body==='string'&&issue.body.length<=8192;
}
function validRun(run,id,name){
  return Number.isSafeInteger(id)&&id>0&&run?.id===id&&
    run.status==='completed'&&run.name===name&&run.event==='issues'&&
    run.actor?.login===OWNER&&run.head_repository?.full_name===REPO&&
    SHA40.test(run.head_sha??'')&&
    Number.isFinite(Date.parse(run.created_at))&&
    Number.isFinite(Date.parse(run.updated_at))&&
    Date.parse(run.created_at)<=Date.parse(run.updated_at)&&
    Number.isSafeInteger(run.run_attempt)&&run.run_attempt>=1&&run.run_attempt<=999;
}
function botReceipt(receipt,issue,marker){
  return receipt?.user?.login===BOT&&
    receipt.issue_url===issueUrl(issue.number)&&
    typeof receipt.body==='string'&&
    receipt.body.split('\n',1)[0]===marker;
}

function originCandidate(wait,origin){
  if(!origin)return null;
  const {issue,run,receipt,json,txt,manifest}=origin;
  const writer=typeof wait.origin.manifestSha256==='string';
  const label=writer?'pc-writer-b-install':'pc-job';
  const title=writer?'pc-writer-source-install':'pc-job';
  const workflow=writer?'ZGMINI Approved Writer B Source Overlay Once':'ZGMINI PC Job';
  if(!issueMatches(issue,wait,label,title)||
     !validRun(run,wait.evidence.runId,workflow))return null;
  let request;
  try{request=JSON.parse(issue.body);}catch{return null;}
  if(request?.requestId!==wait.origin.requestId||
     request.chatId!==wait.origin.chatId)return null;
  const result=parsed(json,wait.evidence.resultJsonPath);
  const text=content(txt,wait.evidence.resultTxtPath);
  if(!result||text===null)return null;
  if(writer){
    const manifestBytes=content(manifest,request.approvalManifestPath,
      run.head_sha,131072);
    let approved;
    try{approved=JSON.parse(manifestBytes);}catch{return null;}
    if(run.run_attempt!==1||run.head_sha!==wait.origin.sourceSha||
       request.schema!=='ZGMINI_PC_WRITER_SOURCE_B_REQUEST_V1'||
       request.controlRepository!==REPO||
       !/^approvals\/writer-updates\/[a-z0-9][a-z0-9._-]{0,95}\.json$/.test(
         request.approvalManifestPath??'')||
       request.approvalManifestSha256!==wait.origin.manifestSha256||
       !SHA64.test(request.approvalManifestSha256??'')||
       manifestBytes===null||
       sha256(manifestBytes)!==request.approvalManifestSha256||
       approved?.schema!=='ZGMINI_PC_WRITER_SOURCE_B_APPROVAL_V1'||
       approved.status!=='APPROVED_B'||
       approved.scope!=='PC_WRITER_APPROVED_FILE_OVERLAY_ONLY'||
       approved.runCount!==1||
       approved.sourceRepository!=='ansqhd5774-Choi/zgmini'||
       !SHA40.test(approved.candidateSourceSha??'')||
       result.schema!=='ZGMINI_PC_WRITER_SOURCE_B_RESULT_V1'||
       result.requestId!==request.requestId||result.runId!==String(run.id)||
       result.status!==wait.evidence.status||result.code!==wait.evidence.code||
       !botReceipt(receipt,issue,`<!-- zgmini-writer-b-install:${request.requestId} -->`)||
       !receipt.body.includes('DELIVERY: RESULT_PAIR_READBACK_VERIFIED')||
       !receipt.body.includes(
         `Writer B evidence: **${result.status}** (${result.code})`)||
       !/^RESULT_CREATED: [0-2]\/2; RESULT_READBACK: 2\/2$/m.test(receipt.body)||
       !receipt.body.includes(`RUN_ID: ${run.id}; RETRY: NO_REEXECUTE`)||
       !txtMatches(text,[['REQUEST_ID',request.requestId],['STATUS',result.status],
         ['CODE',result.code],['RUN_ID',String(run.id)]]))return null;
    return {repository:REPO,issueNumber:issue.number,requestId:request.requestId,
      runId:run.id,status:result.status,code:result.code,
      resultJsonPath:json.path,resultTxtPath:txt.path,
      controlSourceSha:run.head_sha,manifestSha256:request.approvalManifestSha256,
      botReceiptReadbackVerified:true,resultPairReadbackVerified:true};
  }
  if(request.schema!=='ZGMINI_PC_JOB_V1'||request.sourceSha!==wait.origin.sourceSha||
     !SHA40.test(request.sourceSha??'')||
     result.schema!=='ZGMINI_PC_RESULT_V1'||
     result.controlRepository!==REPO||
     result.requestId!==request.requestId||result.chatId!==request.chatId||
     result.operation!==request.operation||
     result.sourceRepository!==request.sourceRepository||
     result.sourceBranch!==request.sourceBranch||
     result.requestedSourceSha!==request.sourceSha||
     !SHA40.test(result.controlSourceSha??'')||
     result.status!==wait.evidence.status||result.code!==wait.evidence.code||
     !Number.isSafeInteger(result.seat)||result.seat<1||result.seat>6||
     result.jobId!==`run-${run.id}-${run.run_attempt}-seat-${result.seat}`||
     !botReceipt(receipt,issue,
       `<!-- zgmini-pc-result:${run.id}:${run.run_attempt}:${result.seat} -->`)||
     !receipt.body.includes(`**${result.status} — ${result.code}**`)||
     !txtMatches(text,[['requestId',request.requestId],['jobId',result.jobId],
       ['status',result.status],['code',result.code]]))return null;
  const fingerprint=sha256(JSON.stringify({operation:request.operation,
    sourceRepository:request.sourceRepository,sourceBranch:request.sourceBranch,
    sourceSha:request.sourceSha}));
  if(fingerprint!==wait.origin.approvalFingerprintSha256)return null;
  return {repository:REPO,issueNumber:issue.number,requestId:request.requestId,
    runId:run.id,status:result.status,code:result.code,
    resultJsonPath:json.path,resultTxtPath:txt.path,
    requestedSourceSha:request.sourceSha,controlSourceSha:result.controlSourceSha,
    approvalFingerprintSha256:fingerprint,
    botReceiptReadbackVerified:true,resultPairReadbackVerified:true};
}

function observationCandidate(wait,observation,originRun){
  if(!observation)return null;
  const {issue,run,receipt,json,txt}=observation;
  if(issue?.repository!==REPO||issue.title!=='pc-job'||
     issue.user?.login!==OWNER||!hasLabel(issue,'pc-job')||
     typeof issue.body!=='string'||issue.body.length>8192)return null;
  let request;
  try{request=JSON.parse(issue.body);}catch{return null;}
  if(request?.schema!=='ZGMINI_PC_JOB_V1'||
     request.operation!=='shared-resource-release-readonly'||
     !SHA40.test(request.sourceSha??'')||
     request.requestId===wait.origin.requestId||
     !validRun(run,run?.id,'ZGMINI PC Job')||run.id===wait.evidence.runId||
     !validRun(originRun,wait.evidence.runId,
       typeof wait.origin.manifestSha256==='string'?
         'ZGMINI Approved Writer B Source Overlay Once':'ZGMINI PC Job')||
     Date.parse(run.created_at)<=Date.parse(originRun.updated_at))return null;
  const pathPrefix=`results/${run.id}-${run.run_attempt}-seat-`;
  const filename=json?.path??'';
  const match=filename.match(new RegExp('^'+pathPrefix+'([1-6])\\.json$'));
  if(!match)return null;
  const seat=Number(match[1]);
  const report=parsed(json,filename);
  const text=content(txt,filename.replace(/\.json$/,'.txt'));
  const detail=report?.result;
  if(!report||text===null||
     report.schema!=='ZGMINI_PC_RESULT_V1'||
     report.controlRepository!==REPO||
     report.requestId!==request.requestId||
     report.chatId!==request.chatId||
     report.sourceRepository!==request.sourceRepository||
     report.sourceBranch!==request.sourceBranch||
     report.requestedSourceSha!==request.sourceSha||
     !SHA40.test(report.controlSourceSha??'')||
     report.operation!==request.operation||
     report.seat!==seat||
     report.jobId!==`run-${run.id}-${run.run_attempt}-seat-${seat}`||
     report.status!=='PASS'||report.code!=='SHARED_RESOURCE_READONLY_SNAPSHOT'||
     !Number.isFinite(Date.parse(report.startedAt))||
     !Number.isFinite(Date.parse(report.finishedAt))||
     Date.parse(report.startedAt)<Date.parse(run.created_at)||
     Date.parse(report.finishedAt)<Date.parse(report.startedAt)||
     detail?.status!==report.status||detail?.code!==report.code||
     detail.sampleCount!==2||detail.sourceStable!==true||
     detail.taskXmlStable!==true||
     detail.resources?.[wait.resourceKey]?.state!=='CANDIDATE_CLEAR_NOT_AUTHORIZED'||
     !SHA40.test(detail.observedConfigSourceSha??'')||
     detail.releaseVerified!==false||detail.ownerReplanAuthorized!==false||
     !botReceipt(receipt,issue,
       `<!-- zgmini-pc-result:${run.id}:${run.run_attempt}:${seat} -->`)||
     !receipt.body.includes(`**${report.status} — ${report.code}**`)||
     !txtMatches(text,[['requestId',request.requestId],['jobId',report.jobId],
       ['status',report.status],['code',report.code]]))return null;
  return {operation:request.operation,runId:run.id,
    resultJsonPath:json.path,resultTxtPath:txt.path,
    resultPairReadbackVerified:true,status:report.status,code:report.code,
    resourceKey:wait.resourceKey,
    resourceState:detail.resources[wait.resourceKey].state,
    observedConfigSourceSha:detail.observedConfigSourceSha,
    releaseVerified:false,ownerReplanAuthorized:false};
}

/** Raw GitHub GET results, never caller-written 'verified' booleans. */
export function reviewRecordedResourceReadbacks({waitComment,origin,
  observation,currentApproval}={}){
  const wait=parseResourceWaitComment(waitComment);
  if(!wait)stop('WAIT_COMMENT_UNVERIFIED');
  return summarizeResourceRecheckEvidence(wait,{
    originReadback:originCandidate(wait,origin),
    releaseObservation:observationCandidate(wait,observation,origin?.run),
    currentApproval});
}

/**
 * A bounded GET adapter; no workflow, scheduler or mutation is installed.
 * The caller authenticates GitHub transport and supplies complete comments.
 */
export async function readAndReviewResourceWait({
  waitCommentId,observationIssueNumber,io,currentApproval
}={}){
  if(!Number.isSafeInteger(waitCommentId)||waitCommentId<1||
     !io||['readComment','readIssue','readRun','readIssueComments','readFile']
       .some(name=>typeof io[name]!=='function'))stop('READ_IO_INVALID');
  const waitComment=await io.readComment(waitCommentId);
  const wait=parseResourceWaitComment(waitComment);
  if(!wait||waitComment.id!==waitCommentId)stop('WAIT_COMMENT_UNVERIFIED');
  const origIssue=await io.readIssue(wait.origin.issueNumber);
  const origRun=await io.readRun(wait.evidence.runId);
  const origComments=await io.readIssueComments(wait.origin.issueNumber);
  if(origComments?.complete!==true||!Array.isArray(origComments.comments)||
     origComments.comments.length>500)stop('ORIGIN_COMMENTS_INCOMPLETE');
  const isPc=typeof wait.origin.approvalFingerprintSha256==='string';
  const seatName=wait.evidence.resultJsonPath.match(
    /^results\/[0-9]+-[0-9]+-seat-([1-6])\.json$/)?.[1];
  const marker=isPc?`<!-- zgmini-pc-result:${origRun.id}:${origRun.run_attempt}:${seatName} -->`:
    `<!-- zgmini-writer-b-install:${wait.origin.requestId} -->`;
  const receipts=origComments.comments.filter(c=>c?.user?.login===BOT&&
    c.issue_url===issueUrl(wait.origin.issueNumber)&&
    c.body?.split('\n',1)[0]===marker);
  if(receipts.length>1)stop('ORIGIN_RECEIPT_DUPLICATE');
  const original={issue:origIssue,run:origRun,
    receipt:receipts[0]??null,
    json:await io.readFile(wait.evidence.resultJsonPath,'main'),
    txt:await io.readFile(wait.evidence.resultTxtPath,'main')};
  if(!isPc){
    let request;
    try{request=JSON.parse(origIssue?.body);}catch{request=null;}
    if(/^approvals\/writer-updates\/[a-z0-9][a-z0-9._-]{0,95}\.json$/.test(
      request?.approvalManifestPath??'')){
      original.manifest=await io.readFile(
        request.approvalManifestPath,origRun.head_sha);
    }
  }
  let observation=null;
  if(observationIssueNumber!==undefined){
    if(!Number.isSafeInteger(observationIssueNumber)||observationIssueNumber<1)
      stop('OBSERVATION_ISSUE_INVALID');
    if(observationIssueNumber===wait.origin.issueNumber)
      stop('OBSERVATION_IS_ORIGIN');
    const issue=await io.readIssue(observationIssueNumber);
    const comments=await io.readIssueComments(observationIssueNumber);
    if(comments?.complete!==true||!Array.isArray(comments.comments)||
       comments.comments.length>500)stop('OBSERVATION_COMMENTS_INCOMPLETE');
    const receipts=comments.comments.filter(c=>c?.user?.login===BOT&&
      c.issue_url===issueUrl(observationIssueNumber)&&
      /^<!-- zgmini-pc-result:[0-9]+:[0-9]+:[1-6] -->/.test(c.body??''));
    if(receipts.length>1)stop('OBSERVATION_RECEIPT_DUPLICATE');
    if(receipts.length===1){
      const match=receipts[0].body.split('\n',1)[0].match(
        /^<!-- zgmini-pc-result:([0-9]+):([0-9]+):([1-6]) -->$/);
      const run=await io.readRun(Number(match[1]));
      const base=`results/${run.id}-${run.run_attempt}-seat-${match[3]}`;
      observation={issue,run,receipt:receipts[0],
        json:await io.readFile(base+'.json','main'),
        txt:await io.readFile(base+'.txt','main')};
    }
  }
  return reviewRecordedResourceReadbacks({waitComment,origin:original,
    observation,currentApproval});
}

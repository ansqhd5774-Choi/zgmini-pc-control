#!/usr/bin/env node
// Source-only ingress reporter: records a rejected known resource request.
// It never runs an installer/Controller, edits a request or retries a job.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {inspectSharedIssueAdmission} from './issue-admission.mjs';

const REPO='ansqhd5774-Choi/zgmini-pc-control';
const OWNER='ansqhd5774-Choi';
const BOT='github-actions[bot]';
const API=`https://api.github.com/repos/${REPO}`;
const stop=code=>{throw new Error('SHARED_ADMISSION_REPORT_'+code);};

function authorize(event) {
  if(event?.action!=='opened'||event.repository?.full_name!==REPO||
    event.repository?.private!==true||event.sender?.login!==OWNER||
    event.issue?.user?.login!==OWNER||
    !Number.isSafeInteger(event.issue?.number)||event.issue.number<1||
    event.issue.pull_request||!Array.isArray(event.issue.labels))
    stop('EVENT_NOT_ALLOWED');
  return event.issue;
}

const marker=issueNumber=>`<!-- zgmini-issue-admission:${issueNumber} -->`;
export function rejectionBody(issueNumber,admission) {
  if(!Number.isSafeInteger(issueNumber)||issueNumber<1||
    admission?.state!=='REJECTED_AT_ADMISSION')stop('REJECTION_INVALID');
  return `${marker(issueNumber)}\n`+
    `공용 작업 요청 미접수: ${admission.code}\n`+
    (admission.expectedTitle?
      `정확한 Issue 제목: \`${admission.expectedTitle}\`\n`:'')+
    (admission.expectedLabel?
      `필수 Issue 라벨: \`${admission.expectedLabel}\`\n`:'')+
    '기존 요청은 설치·실행 성공이 아닙니다. 승인·manifest를 다시 대조하고 새로운 고유 요청을 명시적으로 생성해야 합니다. 기존 requestId 자동 재실행은 없습니다.\n';
}

/** The caller supplies a complete authenticated comment inventory and I/O. */
export async function reportRejectedAdmission(event,{listComments,postComment,getComment}) {
  const issue=authorize(event);
  const admission=inspectSharedIssueAdmission(issue);
  if(admission.state!=='REJECTED_AT_ADMISSION')
    return Object.freeze({state:admission.state,pcOperationalWrites:0,automaticPcRetries:0});
  if([listComments,postComment,getComment].some(f=>typeof f!=='function'))
    stop('IO_NOT_CONFIGURED');
  const expected=rejectionBody(issue.number,admission);
  const decide=comments=>{
    if(!Array.isArray(comments)||comments.length>1000)stop('INVENTORY_INCOMPLETE');
    const matches=comments.filter(x=>x?.user?.login===BOT&&
      x.issue_url===`${API}/issues/${issue.number}`&&
      typeof x.body==='string'&&x.body.startsWith(marker(issue.number)));
    if(matches.length>1)stop('DUPLICATE_REJECTION_STOP');
    if(matches.length===1&&matches[0].body!==expected)stop('REJECTION_CONFLICT_STOP');
    return matches.length===1;
  };
  if(decide(await listComments()))return Object.freeze({
    state:'REJECTION_REUSED',code:admission.code,pcOperationalWrites:0,automaticPcRetries:0});
  let created;
  try{created=await postComment(expected);}
  catch{
    // A lost POST acknowledgement is never permission to re-POST.
    if(!decide(await listComments()))stop('POST_OUTCOME_UNKNOWN');
    return Object.freeze({state:'REJECTION_POST_RECONCILED',
      code:admission.code,pcOperationalWrites:0,automaticPcRetries:0});
  }
  if(!Number.isSafeInteger(created?.id)||created.id<1)stop('POST_RECEIPT_INVALID');
  const verified=await getComment(created.id);
  if(verified?.id!==created.id||verified?.user?.login!==BOT||
    verified.issue_url!==`${API}/issues/${issue.number}`||
    verified.body!==expected)stop('POST_READBACK_UNVERIFIED');
  return Object.freeze({state:'REJECTION_RECORDED',code:admission.code,
    commentId:created.id,pcOperationalWrites:0,automaticPcRetries:0});
}

async function githubRequest(resource,method='GET',body){
  if(typeof process.env.GITHUB_TOKEN!=='string'||process.env.GITHUB_TOKEN.length<20)
    stop('TOKEN_MISSING');
  const response=await fetch(`${API}/${resource}`,{
    method,headers:{authorization:`Bearer ${process.env.GITHUB_TOKEN}`,
      accept:'application/vnd.github+json','x-github-api-version':'2022-11-28',
      ...(body?{'content-type':'application/json'}:{})},
    ...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(25000)});
  if(!response.ok)stop(`GITHUB_HTTP_${response.status}`);
  return response.json();
}

export async function main(env=process.env){
  if(env.GITHUB_REPOSITORY!==REPO||env.GITHUB_EVENT_NAME!=='issues'||
    env.GITHUB_EVENT_ACTION!=='opened'||!env.GITHUB_EVENT_PATH)
    stop('ENV_NOT_ALLOWED');
  const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
  const number=authorize(event).number;
  const answer=await reportRejectedAdmission(event,{
    listComments:async()=>{
      const items=[];
      for(let page=1;page<=10;page++){
        const rows=await githubRequest(`issues/${number}/comments?per_page=100&page=${page}`);
        if(!Array.isArray(rows))stop('COMMENT_RESPONSE_INVALID');
        items.push(...rows);
        if(rows.length<100)return items;
      }
      stop('COMMENT_INVENTORY_INCOMPLETE');
    },
    postComment:body=>githubRequest(`issues/${number}/comments`,'POST',{body}),
    getComment:id=>githubRequest(`issues/comments/${id}`),
  });
  process.stdout.write(`${JSON.stringify(answer)}\n`);
  return answer;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)
  main().catch(error=>{process.stderr.write(`${error.message}\n`);process.exitCode=1;});

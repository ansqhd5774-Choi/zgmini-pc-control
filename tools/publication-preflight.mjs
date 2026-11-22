// Shared fail-closed GitHub approval admission for an independent B-grade lane.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validatePublicationRequest,validatePublicationApproval,
  validateBApprovalComment,CONTROL_REPOSITORY} from './publication-contract.mjs';

function stop(code){console.log(`status=AUTOMATION_BLOCKED\ncode=${code}`);process.exitCode=1;}
const token=process.env.GITHUB_TOKEN;
const get=async endpoint=>{
  const response=await fetch(`https://api.github.com/repos/${CONTROL_REPOSITORY}/${endpoint}`,
    {headers:{authorization:`Bearer ${token}`,accept:'application/vnd.github+json',
      'x-github-api-version':'2022-11-28'},signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error('PUBLICATION_APPROVAL_LOOKUP_FAILED');
  return response.json();
};

export async function admitPublication({environment=process.env,githubGet=get}={}){
  if(!environment.GITHUB_TOKEN||!environment.GITHUB_EVENT_PATH)
    throw Error('PUBLICATION_EVENT_CONTEXT_MISSING');
  const event=JSON.parse(fs.readFileSync(environment.GITHUB_EVENT_PATH,'utf8'));
  const request=validatePublicationRequest(event.issue?.body,{
    actor:environment.GITHUB_ACTOR,repository:environment.GITHUB_REPOSITORY,
    privateRepository:event.repository?.private,eventName:environment.GITHUB_EVENT_NAME,
    eventAction:event.action,labels:(event.issue?.labels??[]).map(x=>x.name),
  });
  // Fixed, relative path derives only from previously validated UUID.
  const file=`approvals/publications/${request.requestId}.json`;
  const found=await githubGet('contents/'+file+'?ref=main');
  if(found.encoding!=='base64'||typeof found.content!=='string')
    throw Error('PUBLICATION_APPROVAL_BYTES_MISSING');
  const bytes=Buffer.from(found.content.replace(/\s/g,''),'base64');
  const validated=validatePublicationApproval(request,bytes);
  const approvalIssue=validated.approval.approval.issueNumber;
  if(approvalIssue===event.issue.number)throw Error('PUBLICATION_SELF_APPROVAL_NOT_ALLOWED');
  const issue=await githubGet(`issues/${approvalIssue}`);
  if(issue.user?.login!=='ansqhd5774-Choi'||issue.pull_request)
    throw Error('PUBLICATION_APPROVAL_ISSUE_INVALID');
  const comments=[];
  for(let page=1;;page++){
    const rows=await githubGet(`issues/${approvalIssue}/comments?per_page=100&page=${page}`);
    if(!Array.isArray(rows))throw Error('PUBLICATION_APPROVAL_COMMENTS_INVALID');
    comments.push(...rows);
    if(rows.length<100)break;
  }
  validateBApprovalComment(validated,comments);
  return {validated,event};
}

export function publicationCheckoutOutput(validated){
  const sha=validated?.approval?.publisherSha;
  if(typeof sha!=='string'||!/^[a-f0-9]{40}$/.test(sha)||sha==='0'.repeat(40))
    throw Error('PUBLICATION_PUBLISHER_SHA_INVALID');
  return `publisherSha=${sha}\n`;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))try{
  const {validated}=await admitPublication();
  const output=publicationCheckoutOutput(validated);
  if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,output);
  console.log(`status=APPROVAL_VERIFIED\ncode=PUBLICATION_APPROVAL_READY\noperation=${validated.request.operation}\npreflight=PASS_EXPLICIT_B_APPROVAL\nexecution=NOT_RUN`);
}catch(error){
  const code=String(error?.message??'');
  stop(/^[A-Z0-9_]{1,96}$/.test(code)?code:'PUBLICATION_PREFLIGHT_FAILED');
}

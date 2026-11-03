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
  const comments=await githubGet(`issues/${approvalIssue}/comments?per_page=100`);
  validateBApprovalComment(validated,comments);
  return {validated,event};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))try{
  const {validated}=await admitPublication();
  console.log(`status=AUTOMATION_BLOCKED\ncode=PUBLICATION_EXECUTOR_NOT_INSTALLED\noperation=${validated.request.operation}\npreflight=PASS_EXPLICIT_B_APPROVAL`);
  process.exitCode=1;
}catch(error){
  const code=String(error?.message??'');
  stop(/^[A-Z0-9_]{1,96}$/.test(code)?code:'PUBLICATION_PREFLIGHT_FAILED');
}

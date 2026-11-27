#!/usr/bin/env node
// Public GitHub Issues may be observed on GitHub-hosted CI; never dispatch them
// to an operating PC or treat GitHub ownership as a B-effect approval.
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';

const REPO='ansqhd5774-Choi/zgmini-pc-control', REPO_ID=1442936296;
const OWNER='ansqhd5774-Choi', OWNER_ID=327938088;
// Public host-side precheck remains source-only. A maintenance postcheck is
// a candidate only when its Issue title, requestId and A operation are the
// exact immutable relationship already produced by tools/update.mjs.
// The hosted observer must recognize every *existing* grade-A operation
// accepted by the fixed owner-only PC policy, not just runner-smoke.
// It only labels a source-only candidate; it can never grant PC execution.
function fixedGradeACandidate(operation){
 if(typeof operation!=='string'||!/^[a-z0-9-]{3,80}$/.test(operation))return false;
 try{
  const file=new URL('../config/operations.json',import.meta.url);
  const stat=fs.lstatSync(file);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size<2||stat.size>131072)
   return false;
  const policy=JSON.parse(fs.readFileSync(file,'utf8'));
  return policy?.schema==='ZGMINI_PC_OPERATIONS_V1'&&
   policy.controlRepository===REPO&&policy.sourceRepository===SOURCE_REPO&&
   policy.mutationsEnabled===false&&policy.maxAutomaticRetries===0&&
   policy.operations!==null&&typeof policy.operations==='object'&&
   !Array.isArray(policy.operations)&&
   Object.hasOwn(policy.operations,operation)&&
   policy.operations[operation]?.grade==='A';
 }catch{return false;}
}
function isPublicAReviewScope(issue,request){
 if(issue?.title==='pc-job')return fixedGradeACandidate(request?.operation);
 if(typeof request?.requestId!=='string'||!/^pc-(?:update-)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-postcheck$/.test(request.requestId))return false;
 const base=request.requestId.slice(0,-'-postcheck'.length);
 return issue?.title==='PC Update '+base+' postcheck'&&
   ['core-status','source-audit','fear-greed-archive-status'].includes(request.operation);
}

const SOURCE_REPO='ansqhd5774-Choi/zgmini', FIELDS=[
  'schema','requestId','chatId','operation','sourceRepository','sourceBranch','sourceSha'
];
const SHA40=/^[a-f0-9]{40}$/;
const REQUEST_ID=/^pc-[a-z0-9][a-z0-9-]{7,75}$/;
const CHAT_ID=/^chat-[a-z0-9][a-z0-9-]{3,75}$/;
const noAuthority={schema:'ZGMINI_PUBLIC_PC_JOB_REVIEW_V1',
  operationalWrites:0,executionAuthorized:false,selfHostedAuthorized:false,
  controllerBAuthorized:false,approvalVerified:false,sourceOnly:true};
const blocked=code=>({...noAuthority,status:'BLOCKED',code});

export function assessPublicPcJobCandidate({event,env}={}) {
  if(env?.GITHUB_REPOSITORY!==REPO||env.GITHUB_EVENT_NAME!=='issues'||
     env.RUNNER_ENVIRONMENT!=='github-hosted'||env.GITHUB_ACTOR!==OWNER||
     !SHA40.test(env.GITHUB_SHA??''))return blocked('PUBLIC_PC_JOB_EVENT_OR_HOST_DENIED');
  const r=event?.repository;
  if(r?.id!==REPO_ID||r?.full_name!==REPO||r.private!==false||
     r.visibility!=='public'||r.owner?.id!==OWNER_ID||r.owner.login!==OWNER)
    return blocked('PUBLIC_PC_JOB_REPOSITORY_DENIED');
  const issue=event?.issue;
  if(event?.sender?.id!==OWNER_ID||event.sender.login!==OWNER||
     issue?.user?.id!==OWNER_ID||issue.user.login!==OWNER||
     (issue.title!=='pc-job'&&
      !/^PC Update pc-(?:update-)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12} postcheck$/.test(issue.title??''))||
     issue.state!=='open'||
     !Number.isSafeInteger(issue.number)||issue.number<=0||
     // GitHub 'issues' webhook identifies the Issue in issue.number;
     // some valid payloads do not carry a redundant top-level number.
     (Object.hasOwn(event,'number')&&event.number!==issue.number)||issue.pull_request||
     !Array.isArray(issue.labels)||!issue.labels.some(l=>l?.name==='pc-job'))
    return blocked('PUBLIC_PC_JOB_ISSUE_IDENTITY_DENIED');
  if(event.action!=='opened'&&
    !(event.action==='labeled'&&event.label?.name==='pc-job'&&
      env.ZGMINI_PC_JOB_LATE_LABEL_ENABLED==='true'))
    return blocked('PUBLIC_PC_JOB_ACTION_DENIED');
  const body=issue.body;
  if(typeof body!=='string'||Buffer.byteLength(body,'utf8')>16384||body.length<2)
    return blocked('PUBLIC_PC_JOB_BODY_INVALID');
  let request;
  try {request=JSON.parse(body);}
  catch{return blocked('PUBLIC_PC_JOB_BODY_INVALID');}
  // Compact roundtrip disallows duplicate keys, hidden extra data and aliases.
  if(!request||typeof request!=='object'||Array.isArray(request)||
     body!==JSON.stringify(request)||Object.keys(request).length!==FIELDS.length||
     FIELDS.some(field=>!Object.hasOwn(request,field)))
    return blocked('PUBLIC_PC_JOB_CONTRACT_DENIED');
  if(request.schema!=='ZGMINI_PC_JOB_V1'||
     !REQUEST_ID.test(request.requestId??'')||
     !CHAT_ID.test(request.chatId??'')||
     !isPublicAReviewScope(issue,request)||
     request.sourceRepository!==SOURCE_REPO||
     request.sourceBranch!=='main'||!SHA40.test(request.sourceSha??''))
    return blocked('PUBLIC_PC_JOB_CONTRACT_DENIED');
  // A candidate proves only shape and webhook origin, NOT installed source,
  // current PC state, a unique request claim, or the permission to execute.
  return {...noAuthority,status:'CANDIDATE_ONLY',code:'PUBLIC_PC_JOB_READONLY_CANDIDATE',
    issueNumber:issue.number,requestDigest:createHash('sha256').update(body).digest('hex')};
}

export function runPublicPcJobCandidate(env=process.env) {
  if(typeof env?.GITHUB_EVENT_PATH!=='string'||!env.GITHUB_EVENT_PATH)
    return blocked('PUBLIC_PC_JOB_EVENT_FILE_INVALID');
  let event;
  try{
    const stat=fs.lstatSync(env.GITHUB_EVENT_PATH);
    if(!stat.isFile()||stat.isSymbolicLink()||stat.size<2||stat.size>1_000_000)
      return blocked('PUBLIC_PC_JOB_EVENT_FILE_INVALID');
    event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
  }catch{return blocked('PUBLIC_PC_JOB_EVENT_FILE_INVALID');}
  return assessPublicPcJobCandidate({event,env});
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const outcome=runPublicPcJobCandidate();
  process.stdout.write(JSON.stringify(outcome)+'\n');
  // A valid candidate is not an operational PASS. Reject invalid CI inputs.
  if(outcome.status==='BLOCKED')process.exitCode=1;
}

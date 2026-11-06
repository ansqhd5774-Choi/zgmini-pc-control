// Upload five already-staged files to PRIVATE CONTROL only. Never repeats the
// PC source read on failure; never targets the public zgmini repository.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {verifyRequest,verifyApproval,FILES,REPO,STAGE_BRANCH,RESULT_NAME,sha,resultText}
 from './export.mjs';

const HERE=path.dirname(fileURLToPath(import.meta.url));
const API=`https://api.github.com/repos/${REPO}`;
const SCHEMA='ZGMINI_CALENDAR_PARSER_SOURCE_RECOVERY_B_RESULT_V1';
const fail=code=>{throw Error(code);};
const need=(okay,code)=>{if(!okay)fail(code);};
const headers=token=>({accept:'application/vnd.github+json',
 authorization:`Bearer ${token}`,'x-github-api-version':'2022-11-28',
 'user-agent':'zgmini-calendar-parser-private-recovery-b'});

/** Idempotent exact private stage write; never overwrites a different blob. */
export async function putPrivateFile(remote,bytes,{fetchImpl,auth,api=API,
 branch=STAGE_BRANCH}={}){
 need(branch===STAGE_BRANCH,'CAL_SOURCE_B_STAGE_BRANCH_SCOPE_STOP');
 const target=`${api}/contents/${remote}`;
 async function readback(){
  const response=await fetchImpl(`${target}?ref=${encodeURIComponent(branch)}`,
   {headers:auth});
  if(response.status===404)return null;
  need(response.status===200,'CAL_SOURCE_B_REMOTE_READ_STOP');
  const body=await response.json();
  need(body.encoding==='base64'&&typeof body.content==='string',
   'CAL_SOURCE_B_REMOTE_FORMAT_STOP');
  return Buffer.from(body.content.replace(/\s/g,''),'base64');
 }
 const before=await readback();
 if(before){
  need(before.equals(bytes),'CAL_SOURCE_B_REMOTE_CONTENT_CONFLICT_STOP');
  return 'ALREADY_STAGED_VERIFIED';
 }
 const response=await fetchImpl(target,{method:'PUT',
  headers:{...auth,'content-type':'application/json'},
  body:JSON.stringify({message:`chore(calendar): private parser recovery ${path.basename(remote)}`,
   branch,content:bytes.toString('base64')})});
 // A transient response is not permission to retry. Only readback can prove it.
 const actual=await readback();
 need(actual?.equals(bytes)===true,
  response.status===409||response.status===422?
   'CAL_SOURCE_B_REMOTE_WRITE_CONFLICT_STOP':'CAL_SOURCE_B_REMOTE_WRITE_UNKNOWN_STOP');
 return 'NEW_STAGED_VERIFIED';
}

export async function uploadPrivate({env=process.env,fetchImpl=fetch,
 read=fs.readFileSync}={}){
 const token=env.GITHUB_TOKEN;
 need(typeof token==='string'&&token.length>15&&env.GITHUB_REPOSITORY===REPO&&
  env.RUNNER_TEMP&&env.GITHUB_EVENT_PATH,'CAL_SOURCE_B_UPLOAD_AUTH_STOP');
 const event=JSON.parse(read(env.GITHUB_EVENT_PATH,'utf8'));
 const {request,issueNumber}=verifyRequest(event,env);
 verifyApproval(read(path.join(HERE,'..','approval.json')));
 const auth=headers(token);
 const privacy=await fetchImpl(API,{headers:auth});
 need(privacy.status===200,'CAL_SOURCE_B_PRIVATE_REPO_LOOKUP_STOP');
 const repo=await privacy.json();
 need(repo.private===true&&repo.full_name===REPO,
  'CAL_SOURCE_B_PRIVATE_REPO_VERIFICATION_STOP');
 const branchResponse=await fetchImpl(`${API}/git/ref/heads/${STAGE_BRANCH}`,
  {headers:auth});
 need(branchResponse.status===200,'CAL_SOURCE_B_STAGE_BRANCH_MISSING_STOP');
 const branchInfo=await branchResponse.json();
 need(branchInfo.ref===`refs/heads/${STAGE_BRANCH}`&&
  /^[a-f0-9]{40}$/.test(branchInfo.object?.sha??''),
  'CAL_SOURCE_B_STAGE_BRANCH_IDENTITY_STOP');
 let data;
 try{data=JSON.parse(read(path.join(env.RUNNER_TEMP,RESULT_NAME),'utf8'));}
 catch{fail('CAL_SOURCE_B_LOCAL_RESULT_MISSING_STOP');}
 need(data.schema===SCHEMA&&data.status==='READY'&&
  data.code==='CAL_SOURCE_B_FIVE_FILES_STAGED_PRIVATE'&&
  data.requestId===request.requestId&&data.issueNumber===issueNumber&&
  data.controlSha===env.GITHUB_SHA&&data.runtimeSourceVerified===false&&
  data.operationalWrites===false&&data.publicRepoWrites===false&&
  Array.isArray(data.files)&&data.files.length===5&&
  data.git?.worktreeRootVerified===true&&/^[a-f0-9]{40}$/.test(data.git.head),
  'CAL_SOURCE_B_UPLOAD_RESULT_BINDING_STOP');
 const prefix=`results/calendar-parser-source-b-${request.requestId}`;
 const stage=path.join(env.RUNNER_TEMP,'private-parser-capsule-'+request.requestId);
 const verified=[];
 // Validate all local evidence before performing even one GitHub write.
 for(let i=0;i<FILES.length;i++){
  const rel=FILES[i],expected=data.files[i],file=path.join(stage,path.basename(rel));
  need(expected.path===rel&&/^[a-f0-9]{64}$/.test(expected.sha256)&&
   Number.isSafeInteger(expected.size)&&expected.size>0&&expected.size<=1_000_000,
   'CAL_SOURCE_B_UPLOAD_FILE_MANIFEST_STOP');
  const stat=fs.lstatSync(file);
  need(stat.isFile()&&!stat.isSymbolicLink()&&stat.size===expected.size,
   'CAL_SOURCE_B_UPLOAD_FILE_TYPE_STOP');
  const bytes=read(file);
  need(sha(bytes)===expected.sha256,'CAL_SOURCE_B_UPLOAD_FILE_SHA_STOP');
  verified.push({remote:`${prefix}/${rel}`,bytes});
 }
 for(const item of verified)await putPrivateFile(item.remote,item.bytes,
  {fetchImpl,auth});
 const safe={schema:SCHEMA,requestId:request.requestId,
  issueNumber,status:data.status,code:data.code,controlSha:data.controlSha,
  git:data.git,files:data.files,sourceEvidence:'HISTORICAL_CHECKOUT_ONLY',
  runtimeSourceVerified:false,operationalWrites:false,publicRepoWrites:false,
  retry:'NO_EXPORT_REEXECUTION_ON_UNKNOWN'};
 await putPrivateFile(`${prefix}/result.json`,
  Buffer.from(JSON.stringify(safe,null,2)+'\n'),{fetchImpl,auth});
 await putPrivateFile(`${prefix}/result.txt`,Buffer.from(resultText(safe)),
  {fetchImpl,auth});
 const comment=[
  `<!-- zgmini-calendar-parser-source-b:${request.requestId} -->`,
  'STATUS: FIVE_HISTORICAL_PARSER_FILES_STAGED_TO_PRIVATE_CONTROL',
  'FILES_READBACK_VERIFIED: 5/5; EVIDENCE_READBACK_VERIFIED: 2/2',
  `PRIVATE_PATH: ${prefix}/lib/`,
  `GIT_HEAD: ${safe.git.head}`,
  'RUNTIME_SOURCE_VERIFIED: NO (historical checkout only)',
  'PC_OPERATIONAL_WRITE: NO; PUBLIC_ZGMINI_WRITE: NO',
  'REVIEW_REQUIRED: secrets, parser behavior, exact public PR before use',
 ].join('\n');
 const posted=await fetchImpl(`${API}/issues/${issueNumber}/comments`,{
  method:'POST',headers:{...auth,'content-type':'application/json'},
  body:JSON.stringify({body:comment})});
 need(posted.status===201,'CAL_SOURCE_B_COMMENT_UNKNOWN_STOP');
 return {status:'PRIVATE_STAGED_READBACK_VERIFIED',filesVerified:5,
  evidenceVerified:2,commentCreated:true};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 uploadPrivate().then(r=>process.stdout.write(
  `CAL_SOURCE_B_${r.status} ${r.filesVerified}/5\n`)).catch(()=>{
   // No raw code, API bodies, tokens, paths, or unexpected errors in logs.
   process.stderr.write('CAL_SOURCE_B_UPLOAD_FAILED_REVIEW_PRIVATE_RESULTS\n');
   process.exitCode=1;
  });
}

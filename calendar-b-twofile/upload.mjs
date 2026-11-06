// Upload only sanitized one-shot result. Never rerun installation here.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {resultText,verifyRequest,verifyApproval} from './install.mjs';

const REPO='ansqhd5774-Choi/zgmini-pc-control';
const API=`https://api.github.com/repos/${REPO}`;
const REQUEST=/^pc-calendar-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const fail=code=>{throw Error(code);};
const needed=(x,code)=>{if(!x)fail(code);};
const authHeaders=token=>({accept:'application/vnd.github+json',
 authorization:`Bearer ${token}`,'x-github-api-version':'2022-11-28',
 'user-agent':'zgmini-calendar-b-twofile'});

export async function uploadResult({env=process.env,fetchImpl=fetch,read=fs.readFileSync}={}){
 const token=env.GITHUB_TOKEN;
 needed(token&&token.length>15&&env.GITHUB_REPOSITORY===REPO,
  'CAL_B_UPLOAD_AUTH_STOP');
 const event=JSON.parse(read(env.GITHUB_EVENT_PATH,'utf8'));
 const verified=verifyRequest(event,env);
 verifyApproval(read(path.join(path.dirname(fileURLToPath(import.meta.url)),'approval.json')));
 const issue=event.issue,request=verified.request;
 needed(REQUEST.test(request.requestId),'CAL_B_UPLOAD_REQUEST_STOP');
 const id=request.requestId,output=env.RUNNER_TEMP??os.tmpdir();
 let data;
 try{data=JSON.parse(read(path.join(output,'calendar-b-install-result.json'),'utf8'));}
 catch{
  data={schema:'ZGMINI_RELEASE_CALENDAR_2FILE_B_RESULT_V1',requestId:id,
   status:'STATE_UNKNOWN',code:'CAL_B_LOCAL_RESULT_MISSING',phase:'UNKNOWN',
   retry:'NO_REEXECUTE_READBACK_ONLY'};
 }
 needed(data?.requestId===id&&data.schema==='ZGMINI_RELEASE_CALENDAR_2FILE_B_RESULT_V1',
  'CAL_B_UPLOAD_RESULT_BINDING_STOP');
 // No error stack, token, machine environment, full config, or raw source.
 const allowed=['schema','requestId','issueNumber','status','code','phase','controlSha',
  'fileCount','beforeVerified','afterVerified','backupVerified',
  'controllerChanged','schedulerChanged','dbChanged','providerCalls',
  'triggerCode','recoveryNote','retry'];
 const safe=Object.fromEntries(allowed.filter(k=>Object.hasOwn(data,k)).map(k=>[k,data[k]]));
 const payloads=[
  [`results/calendar-b-${id}.json`,JSON.stringify(safe,null,2)+'\n'],
  [`results/calendar-b-${id}.txt`,resultText(safe)],
 ];
 const headers=authHeaders(token);
 const verify=async(file,expected)=>{
  const response=await fetchImpl(`${API}/contents/${file}`,{headers});
  if(response.status!==200)return false;
  const body=await response.json();
  if(body.encoding!=='base64'||typeof body.content!=='string')return false;
  return Buffer.from(body.content.replace(/\s/g,''),'base64').equals(Buffer.from(expected));
 };
 let uploaded=0;
 for(const [file,content] of payloads){
  const response=await fetchImpl(`${API}/contents/${file}`,{
   method:'PUT',headers:{...headers,'content-type':'application/json'},
   body:JSON.stringify({message:`chore(calendar): preserve approved B result ${id}`,
    content:Buffer.from(content,'utf8').toString('base64')}),
  });
  if(response.status!==201&&response.status!==409&&response.status!==422){
   // Unknown response never causes installer to run again. Read back once.
   if(!await verify(file,content))fail('CAL_B_UPLOAD_WRITE_UNKNOWN_STOP');
  }else if(!await verify(file,content)){
   fail(response.status===201?'CAL_B_UPLOAD_READBACK_STOP':'CAL_B_UPLOAD_CONFLICT_STOP');
  }
  uploaded++;
 }
 needed(uploaded===2,'CAL_B_UPLOAD_INCOMPLETE_STOP');
 const marker=`<!-- zgmini-calendar-b:${id} -->`;
 const body=[marker,`Release calendar two-file B: ${safe.status} (${safe.code})`,
  `PHASE: ${safe.phase??'UNKNOWN'}`,'RESULT_CREATED_AND_READBACK: 2/2',
  'RETRY: NO_REEXECUTE_READBACK_ONLY',
  `RESULT_JSON: results/calendar-b-${id}.json`,
  `RESULT_TXT: results/calendar-b-${id}.txt`].join('\n');
 const posted=await fetchImpl(`${API}/issues/${issue.number}/comments`,{
  method:'POST',headers:{...headers,'content-type':'application/json'},
  body:JSON.stringify({body}),
 });
 if(posted.status!==201)fail('CAL_B_COMMENT_DELIVERY_UNKNOWN_STOP');
 return {remoteResultPairsVerified:2,commentCreated:true,status:safe.status};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 uploadResult().then(result=>process.stdout.write(`CAL_B_UPLOAD_VERIFIED ${result.remoteResultPairsVerified}/2\n`))
  .catch(error=>{process.stderr.write(`${/^CAL_B_[A-Z0-9_]+$/.test(error.message)?error.message:'CAL_B_UPLOAD_UNEXPECTED'}\n`);
   process.exitCode=1;});
}

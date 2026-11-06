// Upload the sanitized one-shot evidence only. Never retry installation.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {resultText,verifyRequest,verifyApproval} from './install.mjs';

const REPO='ansqhd5774-Choi/zgmini-pc-control';
const API=`https://api.github.com/repos/${REPO}`;
const RESULT_SCHEMA='ZGMINI_RELEASE_CALENDAR_CACHE_HOTFIX_B_RESULT_V1';
const fail=code=>{throw Error(code);};
const need=(valid,code)=>{if(!valid)fail(code);};
const headers=token=>({accept:'application/vnd.github+json',
 authorization:`Bearer ${token}`,'x-github-api-version':'2022-11-28',
 'user-agent':'zgmini-calendar-cache-b-onefile'});

export async function uploadResult({env=process.env,fetchImpl=fetch,read=fs.readFileSync}={}){
 const token=env.GITHUB_TOKEN;
 need(typeof token==='string'&&token.length>15&&env.GITHUB_REPOSITORY===REPO,
  'CAL_CACHE_B_UPLOAD_AUTH_STOP');
 const event=JSON.parse(read(env.GITHUB_EVENT_PATH,'utf8'));
 const {request}=verifyRequest(event,env);
 const here=path.dirname(fileURLToPath(import.meta.url));
 verifyApproval(read(path.join(here,'approval.json')));
 const id=request.requestId,output=env.RUNNER_TEMP??os.tmpdir();
 let data;
 try{data=JSON.parse(read(path.join(output,'calendar-cache-b-result.json'),'utf8'));}
 catch{data={schema:RESULT_SCHEMA,requestId:id,status:'STATE_UNKNOWN',
  code:'CAL_CACHE_B_LOCAL_RESULT_MISSING',phase:'UNKNOWN',
  retry:'NO_REEXECUTE_READBACK_ONLY'};}
 need(data?.requestId===id&&data.schema===RESULT_SCHEMA,
  'CAL_CACHE_B_UPLOAD_RESULT_BINDING_STOP');
 const allow=['schema','requestId','issueNumber','status','code','phase','controlSha',
  'fileCount','beforeVerified','afterVerified','backupVerified',
  'controllerChanged','schedulerChanged','dbChanged','providerCalls',
  'triggerCode','recoveryNote','retry'];
 const safe=Object.fromEntries(allow.filter(k=>Object.hasOwn(data,k)).map(k=>[k,data[k]]));
 const payloads=[
  [`results/calendar-cache-b-${id}.json`,JSON.stringify(safe,null,2)+'\n'],
  [`results/calendar-cache-b-${id}.txt`,resultText(safe)],
 ];
 const auth=headers(token);
 const verify=async(file,expected)=>{
  const response=await fetchImpl(`${API}/contents/${file}`,{headers:auth});
  if(response.status!==200)return false;
  const body=await response.json();
  return body.encoding==='base64'&&typeof body.content==='string'&&
   Buffer.from(body.content.replace(/\s/g,''),'base64').equals(Buffer.from(expected));
 };
 for(const [file,content] of payloads){
  const response=await fetchImpl(`${API}/contents/${file}`,{
   method:'PUT',headers:{...auth,'content-type':'application/json'},
   body:JSON.stringify({message:`chore(calendar): preserve cache hotfix B result ${id}`,
    content:Buffer.from(content,'utf8').toString('base64')}),
  });
  if(response.status!==201&&response.status!==409&&response.status!==422){
   if(!await verify(file,content))fail('CAL_CACHE_B_UPLOAD_WRITE_UNKNOWN_STOP');
  }else if(!await verify(file,content)){
   fail(response.status===201?'CAL_CACHE_B_UPLOAD_READBACK_STOP':'CAL_CACHE_B_UPLOAD_CONFLICT_STOP');
  }
 }
 const comment=[
  `<!-- zgmini-calendar-cache-b:${id} -->`,
  `Release calendar cache B one-file: ${safe.status} (${safe.code})`,
  `PHASE: ${safe.phase??'UNKNOWN'}`,
  'RESULT_CREATED_AND_READBACK: 2/2',
  'RETRY: NO_REEXECUTE_READBACK_ONLY',
  `RESULT_JSON: results/calendar-cache-b-${id}.json`,
  `RESULT_TXT: results/calendar-cache-b-${id}.txt`,
 ].join('\n');
 const posted=await fetchImpl(`${API}/issues/${event.issue.number}/comments`,{
  method:'POST',headers:{...auth,'content-type':'application/json'},
  body:JSON.stringify({body:comment}),
 });
 need(posted.status===201,'CAL_CACHE_B_COMMENT_DELIVERY_UNKNOWN_STOP');
 return {remoteResultPairsVerified:2,commentCreated:true,status:safe.status};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 uploadResult().then(r=>process.stdout.write(`CAL_CACHE_B_UPLOAD_VERIFIED ${r.remoteResultPairsVerified}/2\n`))
  .catch(error=>{process.stderr.write(
   `${/^CAL_CACHE_B_[A-Z0-9_]+$/.test(error.message)?error.message:'CAL_CACHE_B_UPLOAD_UNEXPECTED'}\n`);
   process.exitCode=1;});
}

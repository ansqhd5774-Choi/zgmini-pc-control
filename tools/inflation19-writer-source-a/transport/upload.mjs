// Token lives in this upload step only. Bounded, sanitized A-grade result.
// Never re-executes the inventory, provider calls, or a PC write.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {RESULT_SCHEMA,REPO,validateEvent,stop} from './contract.mjs';
import {resultPath,safeResult} from './entry.mjs';

const MAX_BYTES=32_768;
const MARKER=(id,issueNumber)=>
 `<!-- zgmini-infl19-writer-source-a:${issueNumber}:${id} -->`;
const headers=token=>({accept:'application/vnd.github+json',
 authorization:`Bearer ${token}`,'x-github-api-version':'2022-11-28',
 'content-type':'application/json','user-agent':'zgmini-infl19-writer-source-a'});
function sanitized(raw,request){
 if(raw?.schema!==RESULT_SCHEMA||raw?.requestId!==request.requestId||
    raw?.chatId!==request.chatId)return safeResult({},request);
 // Strip unrecognized fields and prohibit accepting a fabricated PASS.
 const version=raw.status==='PASS_READONLY'?'ZGMINI_INFL19_WRITER_SOURCE_INVENTORY_A_V1':null;
 const code=raw.status==='PASS_READONLY'?'INFL19_A_SOURCE_IDENTITY_OBSERVED':raw.code;
 return safeResult({...raw,schema:version,code},request);
}
function txt(result){
 const lines=[`SCHEMA=${result.schema}`,`REQUEST_ID=${result.requestId}`,
  `STATUS=${result.status}`,`CODE=${result.code}`,
  `CONFIG_APPROVED_SHA=${result.configApprovedSha??'UNVERIFIED'}`,
  `SOURCE_HEAD_SHA=${result.sourceHeadSha??'UNVERIFIED'}`,
  `CONFIG_MATCHES_HEAD=${typeof result.configMatchesHead==='boolean'?String(result.configMatchesHead):'UNKNOWN'}`,
  `TARGET_FILES_DIRTY=${typeof result.targetFilesDirty==='boolean'?String(result.targetFilesDirty):'UNKNOWN'}`,
  'PC_SOURCE_WRITES=0','D1_WRITES=0','PROVIDER_CALLS=0',
  'RETRY=NO_REEXECUTE_READBACK_ONLY'];
 for(const [name,v] of Object.entries(result.files??{}))
  lines.push(`FILE_${name.replace(/[^a-z0-9]/gi,'_')}=${v.status}:${v.sha256??'-'}`);
 return lines.join('\n')+'\n';
}
function responseStatusOk(r){return r&&r.status>=200&&r.status<300}

export async function uploadReport({event,env,readReport,apiFetch=fetch}={}){
 const request=validateEvent(event,env);
 const token=env.GITHUB_TOKEN;
 if(typeof token!=='string'||token.length<20)stop('INFL19_A_UPLOAD_AUTH_DENIED');
 let raw;
 try{
  const input=readReport();
  if(typeof input!=='string'||Buffer.byteLength(input)>MAX_BYTES)
   stop('INFL19_A_RESULT_BYTES_DENIED');
  raw=JSON.parse(input);
 }catch{raw={};}
 const result=sanitized(raw,request);
 const json=JSON.stringify(result,null,2)+'\n';
 const short=txt(result);
 const base=`https://api.github.com/repos/${REPO}`;
 const h=headers(token);
 // A repeated upload must not create duplicate issue comments or rerun the PC job.
 // If comment-read is unavailable, stop: the prior POST may have succeeded.
 const existing=await apiFetch(`${base}/issues/${request.issueNumber}/comments?per_page=100`,
  {method:'GET',headers:h});
 if(!responseStatusOk(existing))stop('INFL19_A_COMMENT_STATE_UNKNOWN');
 const comments=await existing.json();
 if(!Array.isArray(comments)||comments.length>=100)
  stop('INFL19_A_COMMENT_STATE_UNKNOWN');
 // User-supplied comments are untrusted: only a genuine Actions bot result
 // can suppress a repeat upload of this exact issue/request pair.
 if(comments.some(c=>c?.user?.login==='github-actions[bot]'&&
    c?.user?.type==='Bot'&&typeof c.body==='string'&&
    c.body.includes(MARKER(request.requestId,request.issueNumber))))
  return {status:result.status,code:'INFL19_A_ALREADY_REPORTED',files:0};
 let saved=0;
 const uploads=[
  [`results/infl19-writer-source-a-${request.issueNumber}-${request.requestId}.json`,json],
  [`results/infl19-writer-source-a-${request.issueNumber}-${request.requestId}.txt`,short],
 ];
 for(const [relative,content] of uploads){
  try{
   const response=await apiFetch(`${base}/contents/${relative}`,{method:'PUT',headers:h,
    body:JSON.stringify({message:`chore(inflation): read-only Writer source inventory ${request.requestId}`,
      content:Buffer.from(content).toString('base64')})});
   if(response.status===201)saved++;
  }catch{/* No retries: result may already be stored. Final comment remains fallback. */}
 }
 const body=`${MARKER(request.requestId,request.issueNumber)}\n`+
  `Inflation19 Writer source **read-only**: **${result.status}** (${result.code})\n`+
  `RESULT_UPLOAD: ${saved}/2\n\n`+'```json\n'+json.trim()+'\n```';
 const reply=await apiFetch(`${base}/issues/${request.issueNumber}/comments`,{
  method:'POST',headers:h,body:JSON.stringify({body})});
 if(!responseStatusOk(reply))stop('INFL19_A_UPLOAD_COMMENT_UNVERIFIED');
 return {status:result.status,code:result.code,files:saved};
}

async function main(){
 try{
  if(process.platform!=='win32')stop('INFL19_A_WINDOWS_ONLY');
  const env=process.env;
  const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
  const request=validateEvent(event,env);
  const result=await uploadReport({event,env,readReport:()=>fs.readFileSync(
   resultPath(env.RUNNER_TEMP,request.requestId,request.issueNumber),'utf8')});
  process.stdout.write(`INFL19_A_UPLOAD ${result.status} FILES=${result.files}/2\n`);
 }catch{
  process.stderr.write('INFL19_A_UPLOAD_UNVERIFIED_INSPECT_ISSUE_NO_REEXECUTE\n');
  process.exitCode=1;
 }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();

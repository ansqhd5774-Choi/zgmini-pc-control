// B one-shot private result readback. Never uploads backup/source/config bytes.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {CONTROL_REPO} from './contract.mjs';
const BRANCH='codex/calendar-parser-source-stage-20261107';
const API=`https://api.github.com/repos/${CONTROL_REPO}`;
const FILE='calendar-cf43-b-result.json';
const allowed=new Set(['CAL_CF43_B_SOURCE_ALIGNED_VERIFIED','CAL_CF43_B_STOP',
 'CAL_CF43_B_STOP_RESTORED','CAL_CF43_B_RECOVERY_REQUIRED',
 'CAL_CF43_B_PREFLIGHT_STOP']);
const header=token=>({authorization:`Bearer ${token}`,
 accept:'application/vnd.github+json','content-type':'application/json',
 'x-github-api-version':'2022-11-28'});
const need=(x,code)=>{if(!x)throw Error(code);};
const resultPath=process.env.RUNNER_TEMP?path.join(process.env.RUNNER_TEMP,FILE):'';
const message=e=>/^CAL_CF43_[A-Z0-9_]+$/.test(e)?e:'CAL_CF43_UNEXPECTED_STOP';

export function safeResult(raw,request,issue){
 const int=x=>Number.isInteger(x)&&x>=0&&x<=25?x:0;
 return {schema:'ZGMINI_CAL_CF43_B_RESULT_V1',
  requestId:request,issueNumber:issue,
  status:allowed.has(raw?.status)?raw.status:'CAL_CF43_B_PREFLIGHT_STOP',
  code:typeof raw?.code==='string'?message(raw.code):null,
  phase:['PREFLIGHT','VERIFIED'].includes(raw?.phase)?raw.phase:'STOP',
  sourceSha:typeof raw?.sourceSha==='string'&&/^[a-f0-9]{40}$/.test(raw.sourceSha)?
   raw.sourceSha:null,
  operationalWrites:int(raw?.operationalWrites),
  providerCalls:0,dbWrites:0,d1Writes:0,writerRuns:0};
}
export async function upload({env=process.env,fetchImpl=fetch}={}){
 const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
 need(env.GITHUB_REPOSITORY===CONTROL_REPO&&
  env.GITHUB_ACTOR==='ansqhd5774-Choi'&&
  env.GITHUB_EVENT_ACTION==='opened'&&event.action==='opened'&&
  event.repository?.private===true&&event.sender?.login===env.GITHUB_ACTOR&&
  event.issue?.user?.login===env.GITHUB_ACTOR&&
  event.issue?.title==='pc-calendar-cf43-two-approved-source-align-once'&&
  typeof env.GITHUB_TOKEN==='string'&&env.GITHUB_TOKEN.length>15,
  'CAL_CF43_RESULT_AUTH_STOP');
 const request=JSON.parse(event.issue.body??'');
 need(/^pc-calendar-[a-f0-9-]{36}$/.test(request.requestId??''),
  'CAL_CF43_RESULT_REQUEST_STOP');
 const bytes=fs.readFileSync(path.join(env.RUNNER_TEMP,FILE));
 need(bytes.length>50&&bytes.length<8192,'CAL_CF43_RESULT_SIZE_STOP');
 const result=safeResult(JSON.parse(bytes.toString('utf8')),
  request.requestId,event.issue.number);
 const auth=header(env.GITHUB_TOKEN);
 const priv=await fetchImpl(API,{headers:auth});
 need(priv.status===200&&(await priv.json()).private===true,
  'CAL_CF43_RESULT_NOT_PRIVATE_STOP');
 const branch=await fetchImpl(`${API}/git/ref/heads/${BRANCH}`,{headers:auth});
 need(branch.status===200,'CAL_CF43_RESULT_STAGE_MISSING_STOP');
 const dir=`results/calendar-cf43-b-${request.requestId}`;
 async function save(name,output){
  const target=`${API}/contents/${dir}/${name}`;
  async function get(){
   const r=await fetchImpl(`${target}?ref=${encodeURIComponent(BRANCH)}`,
    {headers:auth});
   if(r.status===404)return null;
   need(r.status===200,'CAL_CF43_RESULT_GET_STOP');
   const o=await r.json();
   need(o.encoding==='base64','CAL_CF43_RESULT_ENCODING_STOP');
   return Buffer.from(o.content.replace(/\s/g,''),'base64');
  }
  const prior=await get();
  if(prior){need(prior.equals(output),'CAL_CF43_RESULT_COLLISION_STOP');return;}
  const put=await fetchImpl(target,{method:'PUT',headers:auth,
   body:JSON.stringify({branch:BRANCH,message:'record bounded calendar cf43 B result',
    content:output.toString('base64')})});
  need([200,201].includes(put.status),'CAL_CF43_RESULT_PUT_STOP');
  need((await get())?.equals(output),'CAL_CF43_RESULT_READBACK_STOP');
 }
 await save('result.json',Buffer.from(JSON.stringify(result,null,2)+'\n'));
 await save('result.txt',Buffer.from([
  `status=${result.status}`,`code=${result.code??'null'}`,
  `sourceSha=${result.sourceSha??'null'}`,
  `operationalWrites=${result.operationalWrites}`, 'providerCalls=0',
  'dbWrites=0','d1Writes=0','writerRuns=0',
 ].join('\n')+'\n'));
 const posted=await fetchImpl(`${API}/issues/${event.issue.number}/comments`,{
  method:'POST',headers:auth,body:JSON.stringify({body:[
   `<!-- zgmini-calendar-cf43-b:${request.requestId} -->`,
   `STATUS: ${result.status}`,`CODE: ${result.code??'none'}`,
   `PRIVATE_RESULT: ${dir}/result.json`,`READBACK: JSON/TXT verified`,
   `PC_SOURCE_SHA: ${result.sourceSha??'none'}`,
   'PROVIDER_GET: 0; DB/D1_WRITE: 0; WRITER_RUN: 0',
  ].join('\n')})});
 need(posted.status===201,'CAL_CF43_RESULT_COMMENT_STOP');
 return {status:'RESULT_READBACK_VERIFIED',issue:event.issue.number};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 upload().then(x=>process.stdout.write(JSON.stringify(x)+'\n'))
  .catch(()=>{process.stderr.write('CAL_CF43_RESULT_UPLOAD_STOP\n');process.exitCode=1;});
}

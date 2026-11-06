// Bounded private evidence uploader; never invokes the installer or providers.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {authorizeSipInstall} from './r17-sip-b-auth.mjs';

const REPO='ansqhd5774-Choi/zgmini-pc-control';
const MAX=32768;
const SHA40=/^[a-f0-9]{40}$/;
const CODE=/^SIP_B_[A-Z0-9_]{1,100}$/;
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const keys=(x,expected)=>object(x)&&Object.keys(x).length===expected.length&&
  expected.every(k=>Object.hasOwn(x,k));

export function sanitizeSipReport(raw,requestId,runId){
  const base={schema:'ZGMINI_R17_SIP_B_INSTALL_RESULT_V1',requestId,
    status:'STATE_UNKNOWN',code:'SIP_B_RESULT_UNVERIFIED',sourceSha:null,
    recovery:null,runId:/^[0-9]{1,18}$/.test(runId??'')?runId:null,
    retry:'NO_REEXECUTE_READBACK_ONLY'};
  if(!object(raw))return base;
  if(raw.status==='SIP_B_SETUP_STOP'&&keys(raw,['status','errorCode'])&&
    CODE.test(raw.errorCode??''))
    return {...base,status:'SIP_B_SETUP_STOP',code:raw.errorCode};
  if(raw.status==='SIP_B_INSTALLED_VERIFIED'&&
    keys(raw,['status','sourceSha','requestId'])&&raw.requestId===requestId&&
    SHA40.test(raw.sourceSha??''))
    return {...base,status:raw.status,code:'SIP_B_INSTALL_VERIFIED',
      sourceSha:raw.sourceSha};
  if(raw.status==='SIP_B_PREFLIGHT_STOP'&&keys(raw,['status','code'])&&
    CODE.test(raw.code??''))
    return {...base,status:raw.status,code:raw.code};
  if((raw.status==='SIP_B_INSTALL_STOP'||raw.status==='SIP_B_RECOVERY_REQUIRED')&&
    keys(raw,['status','code','recovery'])&&CODE.test(raw.code??'')&&
    ['NOT_NEEDED','MANUAL_RECONCILIATION_REQUIRED'].includes(raw.recovery)&&
    (raw.status==='SIP_B_RECOVERY_REQUIRED')===
      (raw.recovery==='MANUAL_RECONCILIATION_REQUIRED'))
    return {...base,status:raw.status,code:raw.code,recovery:raw.recovery};
  return base;
}

function resultText(result){
  return [`REQUEST_ID=${result.requestId}`,`STATUS=${result.status}`,
    `CODE=${result.code}`,`SOURCE_SHA=${result.sourceSha??'NONE'}`,
    `RECOVERY=${result.recovery??'NONE'}`,`RUN_ID=${result.runId??'UNKNOWN'}`,
    'RETRY=NO_REEXECUTE_READBACK_ONLY'].join('\n')+'\n';
}
function safeRead(file){
  try{const s=fs.lstatSync(file);if(!s.isFile()||s.isSymbolicLink()||
      s.size===0||s.size>MAX)return null;
    return JSON.parse(fs.readFileSync(file,'utf8'));
  }catch{return null;}
}
async function verify(api,url,headers,expected){
  try{const r=await api(`${url}?ref=main`,{headers});if(r.status!==200)return false;
    const x=await r.json();
    return x?.encoding==='base64'&&typeof x?.content==='string'&&
      /^[A-Za-z0-9+/=\r\n]+$/.test(x.content)&&
      Buffer.from(x.content.replace(/\s/g,''),'base64').equals(Buffer.from(expected));
  }catch{return false;}
}

export async function uploadSipReport({event,env,manifestBytes,raw,api=fetch}){
  const request=authorizeSipInstall({event,env,manifestBytes});
  if(typeof env.GITHUB_TOKEN!=='string'||env.GITHUB_TOKEN.length<20)
    throw Error('SIP_B_UPLOAD_TOKEN_STOP');
  const result=sanitizeSipReport(raw,request.requestId,env.GITHUB_RUN_ID);
  const outputs=[
    [`results/r17-sip-b-install-${request.requestId}.json`,JSON.stringify(result,null,2)+'\n'],
    [`results/r17-sip-b-install-${request.requestId}.txt`,resultText(result)],
  ];
  const headers={authorization:`Bearer ${env.GITHUB_TOKEN}`,
    accept:'application/vnd.github+json','x-github-api-version':'2022-11-28',
    'content-type':'application/json','user-agent':'zgmini-r17-sip-b-install-once'};
  let created=0,verified=0;
  for(const [file,content] of outputs){
    const url=`https://api.github.com/repos/${REPO}/contents/${file}`;
    try{const response=await api(url,{method:'PUT',headers,body:JSON.stringify({
      message:`chore(r17): record SIP private install ${request.requestId}`,
      content:Buffer.from(content).toString('base64')})});
      if(response.status===201)created++;
    }catch{/* Unknown remote PUT result: read back, never retry. */}
    if(await verify(api,url,headers,content))verified++;
  }
  const comment=`<!-- zgmini-r17-sip-b:${request.requestId} -->\n`+
    `R17 SIP private B install: **${result.status}** (${result.code})\n`+
    `RESULT_CREATED: ${created}/2; RESULT_READBACK: ${verified}/2\n`+
    `RETRY: NO_REEXECUTE_READBACK_ONLY\n`;
  const reply=await api(`https://api.github.com/repos/${REPO}/issues/${event.issue.number}/comments`,
    {method:'POST',headers,body:JSON.stringify({body:comment})});
  if(reply.status!==201)throw Error('SIP_B_UPLOAD_COMMENT_STOP');
  return {status:result.status,code:result.code,created,verified};
}

async function main(){
  try{
    const env=process.env;
    const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
    const root=path.dirname(fileURLToPath(import.meta.url));
    const manifestBytes=fs.readFileSync(path.join(root,'R17_SIP_B_SCOPE_DRAFT.json'));
    const raw=safeRead(path.join(env.RUNNER_TEMP??'','r17-sip-b-install-result.json'));
    const result=await uploadSipReport({event,env,manifestBytes,raw});
    process.stdout.write(`SIP_B_REPORT ${result.status} CREATED=${result.created}/2 READBACK=${result.verified}/2\n`);
  }catch{
    process.stderr.write('SIP_B_REPORT_UNVERIFIED_MANUAL_READBACK_ONLY\n');
    process.exitCode=1;
  }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))
  await main();

#!/usr/bin/env node
// Token-bearing reporter is separate from the Windows mutator. Fail closed,
// upload only bounded codes/hashes, create-only; never replay the B recovery.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {validateRecoveryEvent} from './recovery-1063-admission.mjs';
import {INCIDENT_ID,PREPARED_SHA} from './recovery-1063-core.mjs';
import {verifyRecoveryApproval} from './recovery-1063-approval.mjs';

const REPO='ansqhd5774-Choi/zgmini-pc-control';
const CODE=/^WRITER_B_1063_[A-Z0-9_]{2,100}$/;
const UUID=/^[a-f0-9-]{36}$/i;
const unknown='WRITER_B_1063_REPORT_UNVERIFIED';
const need=(condition,code)=>{if(!condition)
 throw Object.assign(new Error(code),{code});};

export function sanitizeRecoveryResult(raw,recoveryRequestId,runId){
 const base={schema:'ZGMINI_WRITER_B_1063_RECOVERY_RESULT_V1',
  recoveryRequestId,incidentRequestId:INCIDENT_ID,runId,
  status:'WRITER_B_1063_STATE_UNKNOWN',code:unknown,
  sourceSha:null,coreTaskEnabledVerified:false,
  lockFinalized:false,installationVerified:false,retry:'NO_REEXECUTE'};
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||
  raw.incidentRequestId!==INCIDENT_ID)return base;
 if(raw.status==='WRITER_B_1063_CORE_RECOVERED'&&
  raw.code==='WRITER_B_1063_PREPARED_CORE_ENABLED_LOCK_FINALIZED'&&
  raw.verified===true&&raw.lockFinalized===true&&
  raw.sourceSha===PREPARED_SHA&&raw.installationVerified===false)
  return {...base,status:raw.status,code:raw.code,sourceSha:PREPARED_SHA,
   coreTaskEnabledVerified:true,lockFinalized:true};
 if(['WRITER_B_1063_PREFLIGHT_STOP','WRITER_B_1063_STATE_UNKNOWN']
   .includes(raw.status)&&CODE.test(raw.code??''))
  return {...base,status:raw.status,code:raw.code,
   lockFinalized:raw.lockFinalized===true};
 return base;
}

async function readback(url,headers,expected,apiFetch){
 try{const r=await apiFetch(url+'?ref=main',{headers});
  if(r.status!==200)return false;
  const value=await r.json();
  return value.encoding==='base64'&&
   Buffer.from(value.content.replace(/\s/g,''),'base64')
    .equals(Buffer.from(expected));
 }catch{return false;}
}

export async function publishRecoveryResult({event,env,raw,apiFetch=fetch}){
 verifyRecoveryApproval(path.join(env.GITHUB_WORKSPACE,'writer-b-control'));
 const head=execFileSync('git',['-C',path.join(env.GITHUB_WORKSPACE,'writer-b-control'),
  'rev-parse','HEAD'],{encoding:'utf8',windowsHide:true}).trim();
 const req=validateRecoveryEvent(event,env,head);
 need(UUID.test(req.requestId)&&/^\d{1,18}$/.test(env.GITHUB_RUN_ID??''),
  'WRITER_B_1063_REPORT_ID_INVALID');
 need(typeof env.GITHUB_TOKEN==='string'&&env.GITHUB_TOKEN.length>=20,
  'WRITER_B_1063_REPORT_TOKEN_MISSING');
 let parsed;try{parsed=typeof raw==='string'&&Buffer.byteLength(raw)<=4096?
  JSON.parse(raw):null;}catch{parsed=null;}
 const result=sanitizeRecoveryResult(parsed,req.requestId,env.GITHUB_RUN_ID);
 const json=JSON.stringify(result,null,2)+'\n';
 const txt=[`REQUEST_ID=${result.recoveryRequestId}`,
  `INCIDENT_REQUEST_ID=${INCIDENT_ID}`,`RUN_ID=${result.runId}`,
  `STATUS=${result.status}`,`CODE=${result.code}`,
  `SOURCE_SHA=${result.sourceSha??'UNKNOWN'}`,
  `CORE_ENABLED_VERIFIED=${result.coreTaskEnabledVerified}`,
  `WRITER_LOCK_FINALIZED=${result.lockFinalized}`,
  `INSTALLATION_VERIFIED=false`,`RETRY=NO_REEXECUTE`,''].join('\n');
 const headers={accept:'application/vnd.github+json',
  authorization:'Bearer '+env.GITHUB_TOKEN,
  'x-github-api-version':'2022-11-28',
  'content-type':'application/json',
  'user-agent':'zgmini-writer-b-1063-recovery'};
 let created=0,verified=0;
 for(const [ext,content] of [['json',json],['txt',txt]]){
  const url=`https://api.github.com/repos/${REPO}/contents/`+
   `results/writer-b-1063-recovery-${req.requestId}.${ext}`;
  try{const r=await apiFetch(url,{method:'PUT',headers,
   body:JSON.stringify({message:'chore: preserve exact Writer B 1063 recovery evidence',
    content:Buffer.from(content).toString('base64')})});
   if(r.status===201)created++;
  }catch{/* Non-idempotent create never retried. */}
  if(await readback(url,headers,content,apiFetch))verified++;
 }
 const pairOk=verified===2;
 const status=pairOk?result.status:'WRITER_B_1063_STATE_UNKNOWN';
 const code=pairOk?result.code:'WRITER_B_1063_REMOTE_RESULT_UNVERIFIED';
 const body=`<!-- zgmini-writer-b-1063-recovery:${req.requestId} -->\n`+
  `Writer B #1063 exact reconcile: **${status}** (${code})\n`+
  `RESULT_CREATED: ${created}/2; RESULT_READBACK: ${verified}/2\n`+
  `CORE_ENABLED_VERIFIED: ${pairOk&&result.coreTaskEnabledVerified}; `+
  `LOCK_FINALIZED: ${pairOk&&result.lockFinalized}\n`+
  `INSTALLATION_VERIFIED: false; RUN_ID: ${env.GITHUB_RUN_ID}; `+
  `RETRY: NO_REEXECUTE\n`;
 const r=await apiFetch(`https://api.github.com/repos/${REPO}/issues/`+
  `${event.issue.number}/comments`,{method:'POST',headers,
   body:JSON.stringify({body})});
 need(r.status===201,'WRITER_B_1063_REPORT_COMMENT_FAILED');
 return {status,code,created,verified};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const env=process.env;
  const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
  let raw='';try{raw=fs.readFileSync(path.join(env.RUNNER_TEMP,
   'writer-b-1063-recovery-result.json'),'utf8');}catch{}
  const r=await publishRecoveryResult({event,env,raw});
  process.stdout.write(`WRITER_B_1063_RESULT_PAIR ${r.verified}/2\n`);
 }catch{process.stderr.write('WRITER_B_1063_REPORT_UNVERIFIED\n');
  process.exitCode=1;}
}

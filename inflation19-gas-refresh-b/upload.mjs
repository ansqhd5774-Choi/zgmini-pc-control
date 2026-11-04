// Fixed private issue receipt uploader. Runs AFTER provider process, in a
// separate step with GitHub token; never imports collector or exposes FRED key.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {REPO,TITLE,RESULT,SCHEMA} from './receiver.mjs';

function stop(){throw Error('GAS_REFRESH_RECEIPT_UPLOAD_BLOCKED')}
export function validateReceiptEnvironment(event,env){
 if(env.GITHUB_REPOSITORY!==REPO||env.GITHUB_EVENT_NAME!=='issues'||
  env.GITHUB_EVENT_ACTION!=='opened'||env.GITHUB_RUN_ATTEMPT!=='1'||
  env.GITHUB_ACTOR!=='ansqhd5774-Choi'||
  event?.repository?.private!==true||event?.repository?.full_name!==REPO||
  event?.issue?.user?.login!=='ansqhd5774-Choi'||event?.issue?.title!==TITLE||
  !Number.isSafeInteger(event?.issue?.number)||event.issue.number<1)stop();
 return event.issue.number;
}

export function receiptBody(report,runId){
 if(report?.schema!==SCHEMA||
   !['PASS','BLOCKED','STATE_UNKNOWN'].includes(report.status)||
   !/^GAS_REFRESH_[A-Z0-9_]{2,70}$/.test(report.code)||
   !/^\d+$/.test(String(runId))||!Number.isSafeInteger(Number(runId)))stop();
 const safeDate=d=>typeof d==='string'&&/^\d{4}-\d\d-\d\d$/.test(d)?d:'unavailable';
 const safeSha=d=>typeof d==='string'&&/^[0-9a-f]{64}$/.test(d)?d:'not_proven';
 const line=(name,value)=>`- ${name}: ${value}`;
 return [`<!-- zgmini-inflation-gas-refresh-b run:${runId} -->`,
  'ZGMINI #3 DHHNGSP fixed B private one-shot receipt',
  line('status',report.status),line('code',report.code),
  line('priorLatest',safeDate(report.priorLatest)),
  line('latest',safeDate(report.latest)),
  line('sourceSHA',safeSha(report.sourceSha)),
  line('priorFileSHA',safeSha(report.priorSha256)),
  line('newFileSHA',safeSha(report.newSha256)),
  line('providerCalls',Number.isInteger(report.providerCalls)&&report.providerCalls>=0&&report.providerCalls<=1?report.providerCalls:'unverified'),
  line('Core/DB/D1/Scheduler',
   report.coreWrites===0&&report.dbWrites===0&&report.d1Writes===0&&report.schedulerWrites===0?'not touched':'unverified'),
  'Old #251 ONCE_STARTED marker never modified. No public D1 or UI effect is claimed.',
 ].join('\n');
}

async function execute(){
 const env=process.env;
 const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
 const issue=validateReceiptEnvironment(event,env);
 if(!env.GITHUB_TOKEN||!env.GITHUB_WORKSPACE||!process.env.GITHUB_RUN_ID)stop();
 const output=path.join(env.GITHUB_WORKSPACE,RESULT);
 const s=fs.lstatSync(output);if(!s.isFile()||s.isSymbolicLink()||s.size>3000)stop();
 const report=JSON.parse(fs.readFileSync(output,'utf8'));
 const body=receiptBody(report,env.GITHUB_RUN_ID);
 const api=`https://api.github.com/repos/${REPO}/issues/${issue}/comments`;
 const headers={Authorization:`Bearer ${env.GITHUB_TOKEN}`,Accept:'application/vnd.github+json',
  'X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json',
  'User-Agent':'zgmini-gas-refresh-b-receipt'};
 const r=await fetch(api+'?per_page=100',{headers,redirect:'manual'});
 if(!r.ok)stop();
 const all=await r.json();if(!Array.isArray(all)||all.length>100)stop();
 const marker=`<!-- zgmini-inflation-gas-refresh-b run:${env.GITHUB_RUN_ID} -->`;
 if(all.some(x=>typeof x.body==='string'&&x.body.includes(marker)))return;
 const post=await fetch(api,{method:'POST',headers,redirect:'manual',body:JSON.stringify({body})});
 if(!post.ok)stop();
 const created=await post.json();if(typeof created?.id!=='number'||created.body!==body)stop();
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 // The path check is also checked via fixed --upload entrypoint in workflow.
 if(process.argv.length!==2)stop();
 await execute();
}

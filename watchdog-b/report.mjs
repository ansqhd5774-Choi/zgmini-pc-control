// Result delivery only. Never invokes the watchdog updater or retries B work.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {REPO,ISSUE_TITLE,parseCanonicalBody} from './contract.mjs';
const sha=value=>createHash('sha256').update(value).digest('hex');
const statusCodes=new Set(['STAGED','BLOCKED','RECOVERY_REQUIRED','STATE_UNKNOWN']);
const gh='C:/Program Files/GitHub CLI/gh.exe';
const fail=c=>{throw Object.assign(new Error(c),{code:c});};
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const exec=(args)=>execFileSync(gh,args,{windowsHide:true,encoding:'utf8',
 timeout:30000,maxBuffer:120000,env:{...process.env,GH_TOKEN:process.env.GITHUB_TOKEN}});
function createOnlyRemote(relative,bytes){
 const base='repos/'+REPO+'/contents/'+relative;
 const tmp=path.join(process.env.RUNNER_TEMP,
  'watchdog-b-report-'+sha(Buffer.from(relative)).slice(0,12)+'.json');
 fs.writeFileSync(tmp,JSON.stringify({message:'watchdog B receipt '+relative,
   content:bytes.toString('base64'),branch:'main'}),{flag:'wx'});
 try{
  // GitHub Contents PUT without sha is create-only; pre-existing paths fail.
  exec(['api',base,'--method','PUT','--input',tmp]);
  const current=JSON.parse(exec(['api',base+'?ref=main']));
  if(current.type!=='file'||current.encoding!=='base64'
    ||sha(Buffer.from(current.content.replace(/\s/g,''),'base64'))!==sha(bytes))
    fail('WATCHDOG_B_RESULT_READBACK_MISMATCH');
 }finally{try{fs.unlinkSync(tmp);}catch{}}
}
async function main(){
 if(process.env.GITHUB_ACTIONS!=='true'||process.env.GITHUB_RUN_ATTEMPT!=='1'
  ||!process.env.GITHUB_TOKEN||!process.env.RUNNER_TEMP)fail('WATCHDOG_B_REPORT_ENV_DENIED');
 const event=read(process.env.GITHUB_EVENT_PATH);
 if(event.action!=='opened'||event.repository?.full_name!==REPO
  ||event.sender?.login!=='ansqhd5774-Choi'
  ||event.issue?.user?.login!=='ansqhd5774-Choi'
  ||event.issue?.title!==ISSUE_TITLE)
  fail('WATCHDOG_B_REPORT_ACTOR_DENIED');
 const request=parseCanonicalBody(event.issue.body);
 const id=request.requestId;
 if(!/^pc-watchdog-b-[0-9a-f]{8}-[0-9a-f-]{27,}$/.test(id??''))
  fail('WATCHDOG_B_REPORT_ID_INVALID');
 let result;
 try{result=read(path.join(process.env.RUNNER_TEMP,'watchdog-b-apply.json'));}
 catch{result={status:'STATE_UNKNOWN',code:'WATCHDOG_B_RESULT_MISSING',writes:0};}
 if(result.status==='STAGED'&&
   (result.requestId!==id||result.issueNumber!==event.issue.number
    ||result.targetSha!==request.targetSha||result.writes!==2
    ||result.code!=='WATCHDOG_B_APPROVED_SOURCE_STAGED_AWAITING_NATURAL_RESTART'))
   result={status:'STATE_UNKNOWN',code:'WATCHDOG_B_STAGED_RECEIPT_MISMATCH',writes:0};
 if(!statusCodes.has(result.status)
  ||!Number.isSafeInteger(result.writes)||result.writes<0||result.writes>2
  ||!/^[A-Z][A-Z0-9_]{2,90}$/.test(result.code??''))
  result={status:'STATE_UNKNOWN',code:'WATCHDOG_B_RESULT_MALFORMED',writes:0};
 const publicResult={schema:'ZGMINI_PC_WATCHDOG_B_RESULT_V1',
  requestId:id,issueNumber:event.issue.number,status:result.status,
  code:result.code,writes:result.writes,
  targetSha:request.targetSha,
  runId:process.env.GITHUB_RUN_ID??null,
  attempt:process.env.GITHUB_RUN_ATTEMPT};
 const txt=['schema='+publicResult.schema,'requestId='+id,
  'status='+publicResult.status,'code='+publicResult.code,
  'writes='+publicResult.writes,'targetSha='+publicResult.targetSha,
  'next='+((result.status==='STAGED')
    ?'WAIT_FOR_NATURAL_WATCHDOG_RESTART_AND_VERIFY_NEW_PROCESS'
    :'STOP_INSPECT_EXISTING_CLAIM_NO_RETRY'),''].join('\r\n');
 const stem='results/watchdog-b-'+id;
 createOnlyRemote(stem+'.json',Buffer.from(JSON.stringify(publicResult,null,2)+'\n'));
 createOnlyRemote(stem+'.txt',Buffer.from(txt));
 exec(['issue','comment',String(event.issue.number),'--repo',REPO,'--body',
  ['ZGMINI Watchdog B result: '+publicResult.status,
   'Code: '+publicResult.code,
   'Result JSON/TXT: '+stem+'.json / '+stem+'.txt',
   'Owner: existing PC Runner B; maintainer self-handoff: NOT RUN',
   'Staged != active. No Watchdog process termination.'].join('\n')]);
 console.log(JSON.stringify({status:'RESULT_RECORDED',requestId:id,code:result.code}));
}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(fileURLToPath(import.meta.url))){
 await main().catch(e=>{console.log(JSON.stringify({
  status:'RESULT_DELIVERY_BLOCKED',code:e.code??'WATCHDOG_B_DELIVERY_ERROR'}));process.exitCode=1;});
}

// Create-only and redacted delivery for a single Guardian-controlled B
// activation. This file never starts, stops or retries a Windows process.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {R4_GUARDIAN_TARGET,R4_GUARDIAN_REQUEST_ID}
 from './guardian-r4-contract.mjs';
const REPO='ansqhd5774-Choi/zgmini-pc-control';
const TITLE='pc-watchdog-guardian-activate';
const SCRIPT='a2ec241d98a2ca93508443deb5b4688ecbccb905';
const APPROVED_REQUEST_ID='pc-watchdog-activate-31390a2f-c503-4ff1-9858-a960bbc07a0d';
const ID=/^pc-watchdog-activate-[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const gh='C:/Program Files/GitHub CLI/gh.exe';
const fail=c=>{throw Object.assign(new Error(c),{code:c});};
const sha=b=>createHash('sha256').update(b).digest('hex');
const run=args=>execFileSync(gh,args,{windowsHide:true,encoding:'utf8',
 timeout:30000,maxBuffer:120000,
 env:{...process.env,GH_TOKEN:process.env.GITHUB_TOKEN}});
function createOnly(file,bytes){
 const fp=path.join(process.env.RUNNER_TEMP,
  'watchdog-activation-'+sha(file).slice(0,12)+'.json');
 fs.writeFileSync(fp,JSON.stringify({message:'watchdog activation once '+file,
  content:bytes.toString('base64'),branch:'main'}),{flag:'wx'});
 try{
  run(['api','repos/'+REPO+'/contents/'+file,'--method','PUT','--input',fp]);
  const observed=JSON.parse(run(['api','repos/'+REPO+'/contents/'+file+'?ref=main']));
  if(observed.type!=='file'||observed.encoding!=='base64'
   ||sha(Buffer.from(observed.content.replace(/\s/g,''),'base64'))!==sha(bytes))
   fail('WATCHDOG_ACTIVATION_REMOTE_RECEIPT_MISMATCH');
 }finally{try{fs.unlinkSync(fp)}catch{}}
}
function allowedResult(result){
 if(result.status==='PASS')
  return result.code==='WATCHDOG_GUARDIAN_NEW_RUNTIME_ATTESTED'
   &&Number.isSafeInteger(result.oldPid)&&result.oldPid>0
   &&Number.isSafeInteger(result.newPid)&&result.newPid>0
   &&result.oldPid!==result.newPid&&result.watchdogFileWrites===0;
 return ['BLOCKED','STATE_UNKNOWN','RECOVERY_REQUIRED'].includes(result.status)
  &&/^[A-Z][A-Z0-9_]{2,90}$/.test(result.code??'');
}
export function normalizeResult(raw){
 let x;
 try{x=JSON.parse(raw.trim().split(/\r?\n/).at(-1));}catch{}
 if(!x||!allowedResult(x))
  return {status:'STATE_UNKNOWN',code:'WATCHDOG_ACTIVATION_RESULT_UNVERIFIED',
   watchdogFileWrites:0};
 return {status:x.status,code:x.code,watchdogFileWrites:0,
  ...(x.status==='PASS'?{newProcessAttested:true}:{newProcessAttested:false})};
}
function main(){
 if(process.env.GITHUB_ACTIONS!=='true'||process.env.GITHUB_RUN_ATTEMPT!=='1'
  ||!process.env.GITHUB_TOKEN||!process.env.RUNNER_TEMP)fail('WATCHDOG_ACTIVATION_REPORT_ENV');
 const event=JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH,'utf8'));
 if(event.action!=='opened'||event.repository?.full_name!==REPO
  ||event.repository.private!==true
  ||event.sender?.login!=='ansqhd5774-Choi'
  ||event.issue?.user?.login!=='ansqhd5774-Choi'
  ||event.issue?.title!==TITLE)fail('WATCHDOG_ACTIVATION_REPORT_ACTOR_DENIED');
 const body=JSON.parse(event.issue.body);
 const r4=body.targetSha===R4_GUARDIAN_TARGET;
 if(!ID.test(body.requestId??'')||
   !(r4?body.requestId===R4_GUARDIAN_REQUEST_ID:
     body.requestId===APPROVED_REQUEST_ID&&body.targetSha===SCRIPT))
  fail('WATCHDOG_ACTIVATION_REPORT_REQUEST_INVALID');
 let raw='';
 try{raw=fs.readFileSync(path.join(process.env.RUNNER_TEMP,
  'watchdog-activation-apply.json'),'utf8');}catch{}
 const result=normalizeResult(raw);
 const payload={schema:'ZGMINI_PC_WATCHDOG_ACTIVATION_B_RESULT_V1',
  requestId:body.requestId,issueNumber:event.issue.number,
  targetSha:r4?R4_GUARDIAN_TARGET:SCRIPT,runId:process.env.GITHUB_RUN_ID??null,
  attempt:process.env.GITHUB_RUN_ATTEMPT,...result};
 const stem='results/watchdog-activation-'+body.requestId;
 createOnly(stem+'.json',Buffer.from(JSON.stringify(payload,null,2)+'\n'));
 createOnly(stem+'.txt',Buffer.from([
  'schema='+payload.schema,'requestId='+payload.requestId,'status='+payload.status,
  'code='+payload.code,'newProcessAttested='+payload.newProcessAttested,
  'watchdogFileWrites=0','next='+(payload.status==='PASS'
   ?r4?'VERIFY_R4_ACTIVE_AND_STANDBY_RUNTIME':'READ_EXISTING_HANDOFF_ISSUE_1378':
     'STOP_INSPECT_EXISTING_CLAIM_NO_RETRY'),
  ''].join('\r\n')));
 run(['issue','comment',String(event.issue.number),'--repo',REPO,'--body',
  ['ZGMINI Guardian Watchdog activation: '+payload.status,
   'Code: '+payload.code,'New process attested: '+(payload.newProcessAttested??false),
   'JSON/TXT: '+stem+'.json / '+stem+'.txt',
   'No maintenance receiver handoff or Controller install executed by this B job.',
   'No duplicate activation request is permitted.'].join('\n')]);
 console.log(JSON.stringify({status:'RECEIPT_RECORDED',code:payload.code,
  newProcessAttested:payload.newProcessAttested??false}));
}
if(process.argv[1]&&path.resolve(fileURLToPath(import.meta.url))
  ===path.resolve(process.argv[1])){
 try{main();}catch(e){console.log(JSON.stringify({status:'RESULT_DELIVERY_BLOCKED',
  code:e?.code??'WATCHDOG_ACTIVATION_REPORT_FAILED'}));process.exitCode=1;}
}

// One exact first-fail snapshot for previously queued maintenance handoff
// #1378 AFTER independent Guardian Watchdog activation #1387 PASS.
// Reads only specific installed status/claim/source identities. No stop,
// handoff, lock release, process kill, file sync or B request retry.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const REPO='ansqhd5774-Choi/zgmini-pc-control';
const TITLE='pc-watchdog-handoff-status-readonly';
const SCHEMA='ZGMINI_WATCHDOG_HANDOFF_FIRSTFAIL_A_V1';
const ID=/^pc-watchdog-handoff-a-[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const ISSUE=1378;
const REQUEST='pc-handoff-51fbf9ee-18ae-4f66-9dd5-737b355223aa';
const WATCH='E:/ZGmini/automation/pc-watchdog';
const MAINT='E:/ZGmini/automation/pc-maintenance';
const CONTROL='E:/ZGmini/automation/pc-control';
const REPO_DIR='E:/ZGmini/projects/zgmini-pc-control';
const TARGET='c2e6744b2765eb13bd50d8ca3a21a0b31b448dc7';
const PRIOR='16064e29fea0e53e7769a24d93d75b6f5292cfc0';
const SOURCE='d0d788996c15a94dcd1db540b9c624f950b3ce827589fdadc56a593f1b71cfc8';
const sha=b=>createHash('sha256').update(b).digest('hex');
const safe=c=>/^[A-Z][A-Z0-9_]{2,90}$/.test(String(c??''))?c:'WATCHDOG_HANDOFF_A_UNCLASSIFIED';
const fail=c=>{throw Object.assign(new Error(c),{code:c});};
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const exact=(x,keys)=>x&&typeof x==='object'&&!Array.isArray(x)
 &&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
const evidence=file=>{try{return read(file);}catch{return null;}};
function github(args){
 return execFileSync('C:/Program Files/GitHub CLI/gh.exe',args,
  {encoding:'utf8',windowsHide:true,timeout:30000,maxBuffer:120000,
   env:{...process.env,GH_TOKEN:process.env.GITHUB_TOKEN}});
}
export function validate(event,body){
 if(event?.action!=='opened'||event.repository?.full_name!==REPO
  ||event.repository.private!==true||event.sender?.login!=='ansqhd5774-Choi'
  ||event.issue?.user?.login!=='ansqhd5774-Choi'
  ||event.issue?.title!==TITLE||!Array.isArray(event.issue.labels)
  ||!event.issue.labels.some(v=>v.name==='pc-maintenance'))
  fail('WATCHDOG_HANDOFF_A_EVENT_DENIED');
 if(!exact(body,['schema','requestId','operation','handoffIssueNumber'])
  ||body.schema!==SCHEMA||body.operation!=='watchdog-handoff-status-readonly'
  ||body.handoffIssueNumber!==ISSUE||!ID.test(body.requestId??''))
  fail('WATCHDOG_HANDOFF_A_CONTRACT_DENIED');
 return body.requestId;
}
export function classify({watchStatus,watchInstall,watchRawValid,claim,bridge,
 receiver,receiverStatus,controllerLock,branch,ancestor,stopRequest}={}){
 const live=watchStatus?.state==='HEALTHY'&&watchRawValid===true
  &&watchInstall?.scope==='RUNNER_RECOVERY_AND_MAINTENANCE_HANDOFF_V1';
 const receipt=!claim?'NOT_CLAIMED':
  ['RUNNING','PASS','BLOCKED','RECOVERY_REQUIRED','STATE_UNKNOWN'].includes(claim.status)
    &&claim.requestId===REQUEST&&claim.targetSha===TARGET?claim.status:'CLAIM_INVALID';
 const installed=receiver?.sourceSha===TARGET?'TARGET':receiver?.sourceSha===PRIOR?'PRIOR'
  :receiver?'OTHER':'UNREADABLE';
 const checkout=branch==='main'&&ancestor===true?'MAIN_TARGET_ANCESTOR':
  branch==='main'?'MAIN_TARGET_NOT_ANCESTOR':'NOT_MAIN_OR_UNREADABLE';
 return {watchdog:live?'HEALTHY_NEW_SCOPE':'UNKNOWN_OR_STALE',
  claim:receipt,bridgeStatus:bridge?.status??'NONE',
  bridgeCode:safe(bridge?.code??'WATCHDOG_HANDOFF_A_NO_BRIDGE_CODE'),
  bridgeIssue:Number.isSafeInteger(bridge?.issueNumber)?bridge.issueNumber:null,
  receiverSource:installed,
  receiverState:receiverStatus?.status??'UNKNOWN',
  checkout,controllerInstallLock:controllerLock?'HELD':'FREE',
  stopRequest:stopRequest?'PRESENT':'ABSENT'};
}
function remoteCreateOnly(file,bytes){
 const request=path.join(process.env.RUNNER_TEMP,'watchdog-handoff-a-'+sha(file).slice(0,12)+'.json');
 fs.writeFileSync(request,JSON.stringify({message:'watchdog handoff first-fail '+file,
  content:bytes.toString('base64'),branch:'main'}),{flag:'wx'});
 try{
  github(['api','repos/'+REPO+'/contents/'+file,'--method','PUT','--input',request]);
  const actual=JSON.parse(github(['api','repos/'+REPO+'/contents/'+file+'?ref=main']));
  if(actual.type!=='file'||actual.encoding!=='base64'
    ||sha(Buffer.from(actual.content.replace(/\s/g,''),'base64'))!==sha(bytes))
    fail('WATCHDOG_HANDOFF_A_REMOTE_READBACK');
 }finally{try{fs.unlinkSync(request)}catch{}}
}
function gitReady(){
 const call=args=>execFileSync('git',['--no-optional-locks',...args],
  {cwd:REPO_DIR,encoding:'utf8',windowsHide:true,timeout:15000,
   env:{...process.env,GIT_OPTIONAL_LOCKS:'0'},maxBuffer:20000}).trim();
 try{
  const branch=call(['branch','--show-current']);
  let ancestor=false;
  try{call(['merge-base','--is-ancestor',TARGET,'HEAD']);ancestor=true;}catch{}
  return {branch,ancestor};
 }catch{return {branch:'UNREADABLE',ancestor:false};}
}
function main(){
 if(process.platform!=='win32'||os.hostname().toLowerCase()!=='pc'
  ||process.env.GITHUB_ACTIONS!=='true'||!process.env.RUNNER_NAME
  ||process.env.GITHUB_RUN_ATTEMPT!=='1'||process.env.GITHUB_EVENT_ACTION!=='opened'
  ||!process.env.GITHUB_TOKEN||!process.env.RUNNER_TEMP)
  fail('WATCHDOG_HANDOFF_A_RUNNER_DENIED');
 const event=read(process.env.GITHUB_EVENT_PATH);
 let body;try{body=JSON.parse(event.issue.body);}catch{fail('WATCHDOG_HANDOFF_A_BODY_INVALID');}
 if(event.issue.body.trim()!==JSON.stringify(body))fail('WATCHDOG_HANDOFF_A_BODY_NONCANONICAL');
 const requestId=validate(event,body);
 const output={schema:'ZGMINI_WATCHDOG_HANDOFF_FIRSTFAIL_A_RESULT_V1',
  requestId,handoffIssueNumber:ISSUE,status:'PASS',code:'WATCHDOG_HANDOFF_A_READ_ONLY',
  watchdog:'UNKNOWN',claim:'UNKNOWN',bridgeStatus:'UNKNOWN',bridgeCode:'UNKNOWN',
  bridgeIssue:null,receiverSource:'UNKNOWN',receiverState:'UNKNOWN',
  checkout:'UNKNOWN',controllerInstallLock:'UNKNOWN',stopRequest:'UNKNOWN',
  operationalWrites:0,providerCalls:0,d1Writes:0};
 try{
  const witness=evidence(path.join(WATCH,'STATUS.json'));
  const installed=evidence(path.join(WATCH,'INSTALL.json'));
  const sourceOk=sha(fs.readFileSync(path.join(WATCH,'runner-watchdog.mjs')))===SOURCE;
  const claim=evidence(path.join(WATCH,'handoff-attempts',REQUEST+'.json'));
  const bridge=evidence(path.join(WATCH,'HANDOFF_STATUS.json'));
  const receiver=evidence(path.join(MAINT,'MAINTENANCE_INSTALL.json'));
  const status=evidence(path.join(MAINT,'RECEIVER_STATUS.json'));
  const git=gitReady();
  Object.assign(output,classify({watchStatus:witness,watchInstall:installed,
    watchRawValid:sourceOk,claim,bridge,receiver,receiverStatus:status,
    controllerLock:fs.existsSync(path.join(MAINT,'leases/controller-install')),
    stopRequest:fs.existsSync(path.join(MAINT,'STOP_REQUEST.json')),
    branch:git.branch,ancestor:git.ancestor}));
 }catch(e){output.status='BLOCKED';output.code=safe(e.code??e.message);}
 const stem='results/watchdog-handoff-a-'+requestId;
 remoteCreateOnly(stem+'.json',Buffer.from(JSON.stringify(output,null,2)+'\n'));
 remoteCreateOnly(stem+'.txt',Buffer.from([
  'schema='+output.schema,'requestId='+requestId,'status='+output.status,
  'code='+output.code,'watchdog='+output.watchdog,'claim='+output.claim,
  'bridgeStatus='+output.bridgeStatus,'bridgeCode='+output.bridgeCode,
  'receiverSource='+output.receiverSource,'receiverState='+output.receiverState,
  'checkout='+output.checkout,'controllerInstallLock='+output.controllerInstallLock,
  'stopRequest='+output.stopRequest,'operationalWrites=0',''].join('\r\n')));
 github(['issue','comment',String(event.issue.number),'--repo',REPO,'--body',
  ['Watchdog #1378 one-off first-fail READ-ONLY: '+output.code,
   'Claim='+output.claim+' / Bridge='+output.bridgeStatus+'/'+output.bridgeCode,
   'Receiver='+output.receiverSource+' / Checkout='+output.checkout,
   'JSON/TXT: '+stem+'.json / '+stem+'.txt',
   'No changes to PC runtime, Controller, receiver, locks or DB.'].join('\n')]);
 console.log(JSON.stringify({status:output.status,code:output.code,
  claim:output.claim,bridgeCode:output.bridgeCode,receiver:output.receiverSource}));
}
if(process.argv[1]&&path.resolve(fileURLToPath(import.meta.url))===path.resolve(process.argv[1])){
 try{main();}catch(e){console.log(JSON.stringify({status:'BLOCKED',
  code:safe(e.code??e.message)}));process.exitCode=1;}
}

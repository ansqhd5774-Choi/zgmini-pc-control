// Exact one-off first-fail observation of the consumed Guardian activation
// #1381. It cannot activate, kill, stop, restart, release or edit anything.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const REPO='ansqhd5774-Choi/zgmini-pc-control';
const TITLE='pc-watchdog-activation-first-fail-readonly';
const ROOT='E:/ZGmini/automation/pc-watchdog';
const SOURCE_SHA='d0d788996c15a94dcd1db540b9c624f950b3ce827589fdadc56a593f1b71cfc8';
const FAILED_REQUEST='pc-watchdog-activate-5ee17f39-2dfd-4d2f-919a-947ea87e1fb4';
const TITLE_SCHEMA='ZGMINI_WATCHDOG_ACTIVATION_FIRST_FAIL_A_V1';
const ID=/^pc-watchdog-activation-a-[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const script=path.join(path.dirname(fileURLToPath(import.meta.url)),'guardian-rotate.vbs');
const sha=x=>createHash('sha256').update(x).digest('hex');
const fail=c=>{throw Object.assign(new Error(c),{code:c});};
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const safe=c=>/^[A-Z][A-Z0-9_]{2,90}$/.test(String(c??''))?c:'WATCHDOG_ACTIVATION_A_READ_ERROR';
const exact=(x,keys)=>x&&typeof x==='object'&&!Array.isArray(x)
 &&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
export function classifyActivation({claim,oldKnown=false,currentOwner,currentStatus,
 newSourceValid=false,attest=false,probe=false,guardStopped=false}){
 if(!claim)return {stage:'PRECLAIM',effect:'NO_CLAIM_NO_ACTIVATION',
  source:newSourceValid?'STAGED':'DRIFT',origin:attest?'ATTESTED':'NOT_ATTESTED',
  probe:probe?'PASS':'DENIED',guard:guardStopped?'STOPPED':'NO_STOP_MARKER'};
 if(claim.requestId!==FAILED_REQUEST||claim.schema!=='ZGMINI_PC_WATCHDOG_ACTIVATION_B_RESULT_V1'
  ||!['RUNNING','PASS','BLOCKED','STATE_UNKNOWN','RECOVERY_REQUIRED'].includes(claim.status))
  throw fail('WATCHDOG_ACTIVATION_A_LEDGER_INVALID');
 const same=claim.oldPid===currentOwner?.pid&&claim.oldNonce===currentOwner?.nonce;
 const newRuntime=oldKnown&&!same&&currentStatus?.pid===currentOwner?.pid
  &&currentStatus?.state==='HEALTHY'&&newSourceValid&&attest;
 return {stage:claim.status,effect:newRuntime?'NEW_WATCHDOG_ATTESTED':
  same?'SAME_OLD_PROCESS':'PROCESS_CHANGE_UNVERIFIED',
  source:newSourceValid?'STAGED':'DRIFT',
  origin:attest?'ATTESTED':'NOT_ATTESTED',
  probe:probe?'PASS':'DENIED',guard:guardStopped?'STOPPED':'NO_STOP_MARKER'};
}
function github(args){
 return execFileSync('C:/Program Files/GitHub CLI/gh.exe',args,
  {encoding:'utf8',windowsHide:true,timeout:30000,maxBuffer:160000,
   env:{...process.env,GH_TOKEN:process.env.GITHUB_TOKEN}});
}
function pair(file,bytes){
 const tmp=path.join(process.env.RUNNER_TEMP,'zgmini-activation-a-'+sha(file).slice(0,12)+'.json');
 fs.writeFileSync(tmp,JSON.stringify({message:'watchdog activation first-fail read '+file,
  content:bytes.toString('base64'),branch:'main'}),{flag:'wx'});
 try{
  github(['api','repos/'+REPO+'/contents/'+file,'--method','PUT','--input',tmp]);
  const x=JSON.parse(github(['api','repos/'+REPO+'/contents/'+file+'?ref=main']));
  if(x.encoding!=='base64'||x.type!=='file'
    ||sha(Buffer.from(x.content.replace(/\s/g,''),'base64'))!==sha(bytes))
    fail('WATCHDOG_ACTIVATION_A_PAIR_READBACK');
 }finally{try{fs.unlinkSync(tmp);}catch{}}
}
export function verifyA(event,body){
 if(event?.action!=='opened'||event.repository?.private!==true
  ||event.repository.full_name!==REPO||event.sender?.login!=='ansqhd5774-Choi'
  ||event.issue?.user?.login!=='ansqhd5774-Choi'
  ||event.issue?.title!==TITLE||!Array.isArray(event.issue.labels)
  ||!event.issue.labels.some(v=>v.name==='pc-maintenance'))
  fail('WATCHDOG_ACTIVATION_A_EVENT');
 if(!exact(body,['schema','requestId','operation','failedIssueNumber'])
  ||body.schema!==TITLE_SCHEMA||body.operation!=='watchdog-activation-first-fail-readonly'
  ||body.failedIssueNumber!==1381||!ID.test(body.requestId??''))
  fail('WATCHDOG_ACTIVATION_A_REQUEST');
 return body.requestId;
}
function observeMode(mode,pid){
 try{
  const s=execFileSync('C:/Windows/System32/cscript.exe',
   ['//NoLogo',script,mode,String(pid)],{encoding:'utf8',windowsHide:true,
   timeout:12000,maxBuffer:512}).trim();
  return s===({ATTEST:'WATCHDOG_RUNTIME_ATTESTED',PROBE:'WATCHDOG_ROTATION_VERIFIED'}[mode]);
 }catch{return false;}
}
function main(){
 if(process.platform!=='win32'||os.hostname().toLowerCase()!=='pc'
  ||process.env.GITHUB_ACTIONS!=='true'||!process.env.RUNNER_NAME
  ||process.env.GITHUB_RUN_ATTEMPT!=='1'||process.env.GITHUB_EVENT_ACTION!=='opened'
  ||!process.env.GITHUB_TOKEN||!process.env.RUNNER_TEMP)
  fail('WATCHDOG_ACTIVATION_A_RUNNER_DENIED');
 const event=read(process.env.GITHUB_EVENT_PATH);
 let body;try{body=JSON.parse(event.issue.body);}catch{fail('WATCHDOG_ACTIVATION_A_BODY');}
 if(event.issue.body.trim()!==JSON.stringify(body))fail('WATCHDOG_ACTIVATION_A_BODY_NONCANONICAL');
 const requestId=verifyA(event,body);
 const response={schema:'ZGMINI_WATCHDOG_ACTIVATION_FIRST_FAIL_A_RESULT_V1',
  requestId,failedIssueNumber:1381,status:'PASS',
  code:'WATCHDOG_ACTIVATION_A_FIRST_FAIL_READ',
  newProcessVerified:false,claim:'UNKNOWN',source:'UNKNOWN',origin:'UNKNOWN',
  probe:'UNKNOWN',guardian:'UNKNOWN',effect:'UNKNOWN',
  operationalWrites:0,providerCalls:0,d1Writes:0};
 try{
  const claimFile=path.join(ROOT,'activations',FAILED_REQUEST+'.json');
  const claim=fs.existsSync(claimFile)?read(claimFile):null;
  const owner=read(path.join(ROOT,'receiver/owner.json'));
  const status=read(path.join(ROOT,'STATUS.json'));
  const installed=read(path.join(ROOT,'INSTALL.json'));
  const sourceValid=sha(fs.readFileSync(path.join(ROOT,'runner-watchdog.mjs')))
    ===SOURCE_SHA&&installed.sha256===SOURCE_SHA;
  const origin=Number.isSafeInteger(owner.pid)&&observeMode('ATTEST',owner.pid);
  const probe=Number.isSafeInteger(owner.pid)&&observeMode('PROBE',owner.pid);
  const delta=classifyActivation({claim,oldKnown:Boolean(claim?.oldPid),
   currentOwner:owner,currentStatus:status,newSourceValid:sourceValid,
   attest:origin,probe,guardStopped:fs.existsSync(path.join(ROOT,'GUARDIAN_STOP.txt'))});
  Object.assign(response,{claim:delta.stage,source:delta.source,origin:delta.origin,
   probe:delta.probe,guardian:delta.guard,effect:delta.effect,
   newProcessVerified:delta.effect==='NEW_WATCHDOG_ATTESTED',
   code:delta.effect==='NO_CLAIM_NO_ACTIVATION'?'WATCHDOG_ACTIVATION_A_STOPPED_PRECLAIM':
        'WATCHDOG_ACTIVATION_A_EXISTING_LEDGER'});
 }catch(e){response.status='BLOCKED';response.code=safe(e.code??e.message);}
 const stem='results/watchdog-activation-a-'+requestId;
 pair(stem+'.json',Buffer.from(JSON.stringify(response,null,2)+'\n'));
 pair(stem+'.txt',Buffer.from([
  'schema='+response.schema,'requestId='+requestId,'status='+response.status,
  'code='+response.code,'claim='+response.claim,'effect='+response.effect,
  'source='+response.source,'origin='+response.origin,'probe='+response.probe,
  'guardian='+response.guardian,'operationalWrites=0',''].join('\r\n')));
 github(['issue','comment',String(event.issue.number),'--repo',REPO,'--body',
  ['Watchdog activation #1381 exact first-fail READ-ONLY: '+response.code,
   'Claim: '+response.claim+'; Effect: '+response.effect,
   'Origin: '+response.origin+'; Probe: '+response.probe+'; Guardian: '+response.guardian,
   'Result JSON/TXT: '+stem+'.json / '+stem+'.txt',
   'Existing B activation was not retried; operational writes 0.'].join('\n')]);
 console.log(JSON.stringify({status:response.status,code:response.code,
  claim:response.claim,effect:response.effect}));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{main();}catch(e){console.log(JSON.stringify({status:'BLOCKED',
  code:safe(e.code??e.message)}));process.exitCode=1;}
}

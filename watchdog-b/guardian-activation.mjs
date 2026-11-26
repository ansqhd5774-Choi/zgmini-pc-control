// Fixed B-grade activation of an ALREADY approved/staged independent Windows
// watchdog. A single exact Guardian-owned watchdog may exit so its existing
// Guardian restarts the new installed version. Never terminate any process
// tree, Controller, Runner, Core, or the maintenance receiver.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {protection} from '../tools/install-runner-watchdog.mjs';
import {requireCurrentProtection,verifyApprovedControllerHost} from './upgrade.mjs';
import {NEXT_TARGET as TARGET,NEXT_SOURCE_SHA as REPLACEMENT,
 FINAL_SCOPE,APPROVED_CONTROLLER_SHA} from './contract.mjs';
import {verifyR5ControllerHost} from './standby-r5-contract.mjs';
import {R4_GUARDIAN_TARGET,R4_GUARDIAN_SOURCE_SHA256,
 R4_GUARDIAN_INSTALL_RAW_SHA256,
 R4_GUARDIAN_STAGE_REQUEST_ID,validateR4GuardianRequest,
 verifyR4GuardianPrecheck,verifyR4GuardianPostcheck}
 from './guardian-r4-contract.mjs';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const home='E:/ZGmini/automation/pc-watchdog';
const maint='E:/ZGmini/automation/pc-maintenance';
const control='E:/ZGmini/automation/pc-control';
const rep='ansqhd5774-Choi/zgmini-pc-control';
const name='pc-watchdog-guardian-activate';
const schema='ZGMINI_PC_WATCHDOG_ACTIVATION_B_REQUEST_V1';
const idRe=/^pc-watchdog-activate-[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const APPROVED_REQUEST_ID='pc-watchdog-activate-31390a2f-c503-4ff1-9858-a960bbc07a0d';
const approvalFileR3=path.join(root,'approvals/watchdog-activations',TARGET+'-r3.json');
const approvalFileR4=path.join(root,'approvals/watchdog-activations',
 R4_GUARDIAN_TARGET+'-r4.json');
const helper=path.join(root,'watchdog-b/guardian-rotate.vbs');
const stageRequestId='pc-watchdog-b-6935cd13-6579-45b6-9d60-264ac879946b';
const digest=b=>createHash('sha256').update(b).digest('hex');
const fail=c=>{throw Object.assign(new Error(c),{code:c});};
const load=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const limitedCode=c=>/^[A-Z][A-Z0-9_]{2,90}$/.test(String(c||''))?c:'WATCHDOG_ACTIVATION_UNKNOWN';
const exact=(o,keys)=>o&&typeof o==='object'&&!Array.isArray(o)
 &&Object.keys(o).length===keys.length&&keys.every(k=>Object.hasOwn(o,k));
const active=pid=>{
 if(!Number.isSafeInteger(pid)||pid<=0)return null;
 try{process.kill(pid,0);return true;}catch(e){return e.code==='ESRCH'?false:null;}
};
const persist=(p,v,first=false)=>fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n',
 first?{flag:'wx',mode:0o600}:undefined);

export function validateActivation(event,body,approval,rawApprovalDigest,helperDigest){
 if(event?.action!=='opened'||event.repository?.full_name!==rep
  ||event.repository.private!==true
  ||event.sender?.login!=='ansqhd5774-Choi'
  ||event.issue?.user?.login!=='ansqhd5774-Choi'
  ||event.issue?.title!==name||!Array.isArray(event.issue.labels)
  ||!event.issue.labels.some(x=>x.name==='pc-maintenance')
  ||!Number.isSafeInteger(event.issue.number)||event.issue.number<1)
  fail('WATCHDOG_ACTIVATION_EVENT_DENIED');
 if(!exact(body,['schema','requestId','operation','targetSha','approvalManifestSha256'])
  ||body.schema!==schema||!idRe.test(body.requestId??'')
  ||body.requestId!==APPROVED_REQUEST_ID
  ||body.operation!=='watchdog-guardian-activate'||body.targetSha!==TARGET
  ||body.approvalManifestSha256!==rawApprovalDigest)
  fail('WATCHDOG_ACTIVATION_REQUEST_INVALID');
 if(!exact(approval,['schema','approved','scope','targetSha','installedSha256',
  'installedScope','guardianHelperSha256','activationScriptSha256','stageRequestId','oldStageIssueNumber',
  'expectedControllerSha','effect','approvalBasis'])
  ||approval.schema!=='ZGMINI_PC_WATCHDOG_ACTIVATION_B_MANIFEST_V3'
  ||approval.approved!==true
  ||approval.scope!=='ONE_GUARDIAN_WATCHDOG_PROCESS_ACTIVATION_ONLY'
  ||approval.targetSha!==TARGET||approval.installedSha256!==REPLACEMENT
  ||approval.installedScope!==FINAL_SCOPE
  ||approval.guardianHelperSha256!==helperDigest
  ||approval.activationScriptSha256!==digest(fs.readFileSync(fileURLToPath(import.meta.url)))
  ||approval.stageRequestId!==stageRequestId||approval.oldStageIssueNumber!==1393
  ||approval.expectedControllerSha!==APPROVED_CONTROLLER_SHA
  ||approval.effect!=='ONE_EXACT_WATCHDOG_PROCESS_EXIT_GUARDIAN_RESTART')
  fail('WATCHDOG_ACTIVATION_APPROVAL_INVALID');
 return {requestId:body.requestId,issueNumber:event.issue.number};
}
export function statusReady({owner,status,now=Date.now(),source,manifest,stage}){
 if(!owner||!Number.isSafeInteger(owner.pid)||owner.pid<=0
  ||!/^[a-f0-9-]{36}$/.test(owner.nonce??'')
  ||status?.state!=='HEALTHY'||status.pid!==owner.pid
  ||typeof status.at!=='string'
  ||!Number.isFinite(Date.parse(status.at))
  ||Date.parse(status.at)>now||now-Date.parse(status.at)>90000)
  fail('WATCHDOG_ACTIVATION_OLD_RUNTIME_NOT_HEALTHY');
 if(source!==REPLACEMENT||manifest?.sha256!==REPLACEMENT
  ||manifest.scope!==FINAL_SCOPE||manifest.approvedTargetSourceSha!==TARGET)
  fail('WATCHDOG_ACTIVATION_STAGED_SHA_MISMATCH');
 if(stage?.schema!=='ZGMINI_PC_WATCHDOG_B_RESULT_V1'
  ||stage.requestId!==stageRequestId||stage.issueNumber!==1393
  ||stage.targetSha!==TARGET||stage.targetSourceSha256!==REPLACEMENT
  ||stage.status!=='STAGED'||stage.writes!==2)
  fail('WATCHDOG_ACTIVATION_PRIOR_STAGE_INVALID');
 return true;
}
function witness(mode,pid){
 let output;
 try{
  output=execFileSync('C:/Windows/System32/cscript.exe',
   ['//NoLogo',helper,mode,String(pid)],{encoding:'utf8',windowsHide:true,
     timeout:15000,maxBuffer:512}).trim();
 }catch{fail('WATCHDOG_ACTIVATION_WMI_'+mode+'_DENIED');}
 const expected={PROBE:'WATCHDOG_ROTATION_VERIFIED',
  ACTIVATE:'WATCHDOG_ROTATION_SIGNALLED',
  ATTEST:'WATCHDOG_RUNTIME_ATTESTED'}[mode];
 if(output!==expected)fail('WATCHDOG_ACTIVATION_WMI_IDENTITY_DENIED');
 return true;
}
export async function execute(){
 if(process.platform!=='win32'||os.hostname().toLowerCase()!=='pc'
  ||process.env.GITHUB_ACTIONS!=='true'||!process.env.RUNNER_NAME
  ||process.env.GITHUB_EVENT_ACTION!=='opened'
  ||process.env.GITHUB_RUN_ATTEMPT!=='1')
  fail('WATCHDOG_ACTIVATION_OPERATING_RUNNER_REQUIRED');
 const event=load(process.env.GITHUB_EVENT_PATH);
 let body;
 try{body=JSON.parse(event.issue.body);}
 catch{fail('WATCHDOG_ACTIVATION_BODY_INVALID');}
 if(event.issue.body.trim()!==JSON.stringify(body))
  fail('WATCHDOG_ACTIVATION_BODY_NONCANONICAL');
 const isR4=body.targetSha===R4_GUARDIAN_TARGET;
 const selectedSource=isR4?R4_GUARDIAN_SOURCE_SHA256:REPLACEMENT;
 const selectedTarget=isR4?R4_GUARDIAN_TARGET:TARGET;
 const selectedStage=isR4?R4_GUARDIAN_STAGE_REQUEST_ID:stageRequestId;
 const apBytes=fs.readFileSync(isR4?approvalFileR4:approvalFileR3);
 const approval=JSON.parse(apBytes),helperBytes=fs.readFileSync(helper);
 const request=isR4
  ?validateR4GuardianRequest(event,body,approval,{
    approvalDigest:digest(apBytes),helperDigest:digest(helperBytes),
    activationScriptDigest:digest(fs.readFileSync(fileURLToPath(import.meta.url)))})
  :validateActivation(event,body,approval,digest(apBytes),digest(helperBytes));
 const script=path.join(home,'runner-watchdog.mjs');
 const manifestFile=path.join(home,'INSTALL.json');
 const install=load(manifestFile);
 const installedManifestDigest=digest(fs.readFileSync(manifestFile));
 const source=digest(fs.readFileSync(script));
 const stage=load(path.join(home,'upgrades',selectedStage+'.json'));
 const owner=load(path.join(home,'receiver/owner.json'));
 const status=load(path.join(home,'STATUS.json'));
 if(isR4)verifyR4GuardianPrecheck({install,sourceDigest:source,
   installedManifestDigest,stage,owner,status,pidAlive:active});
 else statusReady({owner,status,source,manifest:install,stage});
 if(active(owner.pid)!==true)fail('WATCHDOG_ACTIVATION_OLD_PID_NOT_RUNNING');
 const startup=path.join(process.env.APPDATA||'',
  'Microsoft/Windows/Start Menu/Programs/Startup/ZGMINI_PC_CONTROL.vbs');
 if(!install.startupSha256||digest(fs.readFileSync(startup))!==install.startupSha256)
  fail('WATCHDOG_ACTIVATION_GUARDIAN_SOURCE_DRIFT');
 if(fs.existsSync(path.join(home,'GUARDIAN_STOP.txt'))
   ||fs.existsSync(path.join(home,'PAUSE'))
   ||fs.existsSync(path.join(control,'DRAIN'))
   ||fs.existsSync(path.join(maint,'leases/controller-install'))
   ||fs.existsSync(path.join(maint,'HANDOFF_RECEIVER_PROBE_GUARD.json')))
  fail('WATCHDOG_ACTIVATION_SHARED_TRANSITION_ACTIVE');
 const historical=load(path.join(home,'PROTECTION_BEFORE.json'));
 const pre=protection();
 requireCurrentProtection({historical,current:pre});
 if(isR4)verifyR5ControllerHost(load(path.join(control,'host.json')));
 else verifyApprovedControllerHost(load(path.join(control,'host.json')));
 // An elevated Runner cannot be allowed to bypass the exact medium-user
 // Guardian identity contract for a B action.
 let groups;
 try{
  groups=execFileSync('C:/Windows/System32/whoami.exe',['/groups'],
   {encoding:'utf8',windowsHide:true,timeout:15000});
 }catch{fail('WATCHDOG_ACTIVATION_TOKEN_READ_FAILED');}
 if(!groups.includes('S-1-16-8192')||groups.includes('S-1-16-12288'))
  fail('WATCHDOG_ACTIVATION_MEDIUM_TOKEN_REQUIRED');
 // Read-only Win32_Process proof of exact Node + WScript startup ancestry,
 // same user SID/session, and >600 seconds prior healthy runtime.
 witness('PROBE',owner.pid);
 const dir=path.join(home,'activations');
 if(fs.existsSync(dir)){
  const info=fs.lstatSync(dir);
  if(!info.isDirectory()||info.isSymbolicLink())fail('WATCHDOG_ACTIVATION_LEDGER_ALIAS');
 }
 fs.mkdirSync(dir,{recursive:true});
 const ledger=path.join(dir,request.requestId+'.json');
 if(fs.existsSync(ledger))fail('WATCHDOG_ACTIVATION_DUPLICATE_REQUEST');
 const initial={schema:'ZGMINI_PC_WATCHDOG_ACTIVATION_B_RESULT_V1',
  requestId:request.requestId,issueNumber:request.issueNumber,
  targetSha:selectedTarget,oldPid:owner.pid,oldNonce:owner.nonce,
  status:'RUNNING',code:'WATCHDOG_ACTIVATION_CLAIMED',watchdogFileWrites:0,
  at:new Date().toISOString()};
 persist(ledger,initial,true);
 const record=(status,code,newPid=null)=>{
  const result={...initial,status,code,newPid,at:new Date().toISOString()};
  persist(ledger,result);return result;
 };
 try{
  if(active(owner.pid)!==true
   ||load(path.join(home,'receiver/owner.json')).nonce!==owner.nonce
   ||digest(fs.readFileSync(script))!==selectedSource
   ||(isR4&&digest(fs.readFileSync(manifestFile))!==R4_GUARDIAN_INSTALL_RAW_SHA256)
   ||JSON.stringify(protection())!==JSON.stringify(pre))
   return record('BLOCKED','WATCHDOG_ACTIVATION_PRESTOP_CAS_FAILED');
  // Exactly ONE identity-attested old Watchdog PID is terminated; the
  // existing preinstalled Guardian naturally starts the staged replacement.
  witness('ACTIVATE',owner.pid);
  for(let i=0;i<90;i++){
   await new Promise(resolve=>setTimeout(resolve,1000));
   let current,live;
   try{
    current=load(path.join(home,'receiver/owner.json'));
    live=load(path.join(home,'STATUS.json'));
   }catch{continue;}
   if(current.pid===owner.pid||current.nonce===owner.nonce
     ||active(current.pid)!==true||live.pid!==current.pid
     ||live.state!=='HEALTHY'||Date.parse(live.at)<Date.parse(initial.at))
    continue;
   try{witness('ATTEST',current.pid);}
   catch{return record('RECOVERY_REQUIRED','WATCHDOG_ACTIVATION_NEW_ORIGIN_UNVERIFIED');}
   if(digest(fs.readFileSync(script))!==selectedSource
     ||load(manifestFile).sha256!==selectedSource
     ||(isR4&&digest(fs.readFileSync(manifestFile))!==R4_GUARDIAN_INSTALL_RAW_SHA256)
     ||JSON.stringify(protection())!==JSON.stringify(pre))
    return record('RECOVERY_REQUIRED','WATCHDOG_ACTIVATION_POST_SOURCE_OR_PROTECTION_DRIFT');
   if(isR4){
    try{
     verifyR4GuardianPostcheck({install:load(manifestFile),
      sourceDigest:digest(fs.readFileSync(script)),
      installedManifestDigest:digest(fs.readFileSync(manifestFile)),oldOwner:owner,
      newOwner:current,status:live,signalledAt:initial.at,pidAlive:active});
    }catch{continue;} // Keep the bounded window for IPC READY; never retry ACTIVATE.
   }
   return record('PASS','WATCHDOG_GUARDIAN_NEW_RUNTIME_ATTESTED',current.pid);
  }
  return record('STATE_UNKNOWN','WATCHDOG_ACTIVATION_NEW_PROCESS_NOT_CONFIRMED');
 }catch(e){
  return record('STATE_UNKNOWN',limitedCode(e.code??e.message));
 }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const result=await execute();
  console.log(JSON.stringify(result));
  if(result.status!=='PASS')process.exitCode=1;
 }catch(e){
  console.log(JSON.stringify({schema:'ZGMINI_PC_WATCHDOG_ACTIVATION_B_RESULT_V1',
   status:'BLOCKED',code:limitedCode(e.code??e.message),
   watchdogFileWrites:0}));process.exitCode=1;
 }
}

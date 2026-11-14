// Out-of-band recovery of the existing six-seat controller. No Core/DB access.
import fs from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {execFileSync,spawn} from 'node:child_process';
import {pathToFileURL} from 'node:url';

const control='E:/ZGmini/automation/pc-control';
const maintenance='E:/ZGmini/automation/pc-maintenance';
const home='E:/ZGmini/automation/pc-watchdog';
const gh='C:/Program Files/GitHub CLI/gh.exe';
const node='E:/ZGmini/runtime/node.exe';
const repo='ansqhd5774-Choi/zgmini-pc-control';
const sourceRoot='E:/ZGmini/projects/zgmini-pc-control';
const handoffTitle='pc-maintenance-handoff';
const handoffSchema='ZGMINI_MAINTENANCE_HANDOFF_REQUEST_V1';
const handoffScope='RUNNER_RECOVERY_AND_MAINTENANCE_HANDOFF_V1';
const sha40=/^[a-f0-9]{40}$/,sha64=/^[a-f0-9]{64}$/;
const requestIdPattern=/^pc-handoff-[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const strictKeys=(obj,keys)=>obj&&typeof obj==='object'&&!Array.isArray(obj)
  &&Object.keys(obj).length===keys.length&&keys.every(k=>Object.hasOwn(obj,k));
const code=x=>{throw Object.assign(Error(x),{code:x});};
const safeCode=x=>/^[A-Z][A-Z0-9_]{2,100}$/.test(String(x??''))?String(x):'HANDOFF_UNCLASSIFIED';

const sha=b=>createHash('sha256').update(b).digest('hex');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const write=(p,x)=>{const tmp=p+'.'+randomUUID()+'.tmp';fs.writeFileSync(tmp,JSON.stringify(x,null,2)+'\n',{flag:'wx'});fs.renameSync(tmp,p);};
export function alive(pid){if(!Number.isSafeInteger(pid)||pid<=0)return null;try{process.kill(pid,0);return true;}catch(e){return e.code==='ESRCH'?false:null;}}
export function decide({paused,owner,live,heartbeat,now=Date.now()}){
 if(paused)return 'PAUSED';
 if(owner&&live!==false)return live===true&&heartbeat&&now-Date.parse(heartbeat)<45000?'HEALTHY':'BLOCKED_LIVE_OR_UNKNOWN';
 return 'RECOVER';
}
export function archiveDeadLease(directory,isAlive=alive,destination=null){
 if(!fs.existsSync(directory))return null;
 const original=fs.readFileSync(path.join(directory,'owner.json'));
 const owner=JSON.parse(original);
 if(isAlive(owner.pid)!==false)throw Error('LEASE_OWNER_NOT_PROVEN_DEAD');
 if(!original.equals(fs.readFileSync(path.join(directory,'owner.json'))))throw Error('LEASE_OWNER_CHANGED');
 const archived=destination??directory+'.dead-'+Date.now()+'-'+randomUUID();
 fs.renameSync(directory,archived); // Preserve evidence; never delete a lock.
 return archived;
}
function workflowActive(){return JSON.parse(execFileSync(gh,['api','repos/ansqhd5774-Choi/zgmini-pc-control/actions/workflows/pc-job.yml'],{encoding:'utf8',windowsHide:true,timeout:20000})).state==='active';}
function verifyController(){
 const host=read(path.join(control,'host.json'));
 for(const [rel,hash] of Object.entries(host.controllerFiles)){
  const p=path.resolve(control,rel);
  if(!p.startsWith(path.resolve(control)+path.sep)||sha(fs.readFileSync(p))!==hash)throw Error('CONTROLLER_HASH_MISMATCH');
 }
 return host.controllerSourceSha;
}
// A signed-looking Issue body alone is NEVER authority. The authenticated GitHub
// author, existing label, immutable raw approval bytes, and installed source
// must match. This admits only a fixed local Windows operator, not commands.
export function validateHandoffApprovalIdentity(issue,body,approval,rawDigest){
 const keys=['schema','requestId','operation','targetSha','approvalManifestSha256'];
 if(!strictKeys(body,keys)||body.schema!==handoffSchema
   ||body.operation!=='maintenance-handoff'
   ||!requestIdPattern.test(body.requestId??'')
   ||!sha40.test(body.targetSha??'')
   ||!sha64.test(body.approvalManifestSha256??''))code('HANDOFF_REQUEST_CONTRACT_INVALID');
 const labels=issue?.labels;
 if(issue?.title!==handoffTitle||issue?.state!=='OPEN'
   ||issue?.author?.login!=='ansqhd5774-Choi'
   ||!Array.isArray(labels)||!labels.some(label=>label?.name==='pc-maintenance'))
   code('HANDOFF_REQUEST_ACTOR_OR_LABEL_DENIED');
 if(!approval||approval.schema!=='ZGMINI_MAINTENANCE_HANDOFF_V2'
   ||approval.transition!=='SEVEN_TO_SEVEN'||approval.approved!==true
   ||approval.scope!=='COOPERATIVE_OR_STOPPED_RECEIVER_IN_PLACE'
   ||approval.targetSha!==body.targetSha
   ||!sha40.test(approval.installedSha??'')
   ||!sha64.test(rawDigest??'')
   ||body.approvalManifestSha256!==rawDigest)
   code('HANDOFF_APPROVAL_BYTES_OR_SOURCE_MISMATCH');
 return Object.freeze({requestId:body.requestId,targetSha:body.targetSha});
}
export function validateHandoffIntent(issue,body,approval,installed,rawDigest){
 const admitted=validateHandoffApprovalIdentity(issue,body,approval,rawDigest);
 if(approval.installedSha!==installed?.sourceSha)
  code('HANDOFF_APPROVAL_BYTES_OR_SOURCE_MISMATCH');
 return admitted;
}
// Existing receipt replay must not depend on the *former* installed source SHA.
// No subprocess is permitted in this branch. It authenticates the exact
// GitHub request and signed-off manifest, then checks the durable local claim.
export function validateExistingHandoffReceipt(issue,body,approval,rawDigest,receipt,issueNumber){
 const admitted=validateHandoffApprovalIdentity(issue,body,approval,rawDigest);
 if(!Number.isSafeInteger(issueNumber)||issueNumber<1
   ||issue?.number!==issueNumber
   ||receipt?.schema!=='ZGMINI_WATCHDOG_HANDOFF_RECEIPT_V1'
   ||receipt.requestId!==admitted.requestId
   ||receipt.issueNumber!==issueNumber
   ||receipt.targetSha!==admitted.targetSha
   ||!['RUNNING','PASS','BLOCKED','RECOVERY_REQUIRED',
       'AUTOMATION_BLOCKED','STATE_UNKNOWN'].includes(receipt.status)
   ||(receipt.status!=='RUNNING'
      &&(!receipt.code||safeCode(receipt.code)!==receipt.code)))
   code('HANDOFF_LEDGER_REQUEST_DRIFT');
 return admitted;
}
function ghRead(args){
 return execFileSync(gh,args,{encoding:'utf8',windowsHide:true,timeout:30000,maxBuffer:1000000});
}
function git(args){
 return execFileSync('git',args,{cwd:sourceRoot,encoding:'utf8',windowsHide:true,timeout:30000,maxBuffer:200000});
}
// A child's printed PASS is insufficient: require the independent local
// install ledger and installed receiver source to agree with the exact target.
export function verifyHandoffPass({report,ledger,installed,targetSha,exitCode}){
 if(report?.status!=='PASS'||exitCode!==0
   ||ledger?.schema!=='ZGMINI_MAINTENANCE_HANDOFF_RESULT_V1'
   ||ledger.status!=='PASS'||ledger.targetSha!==targetSha
   ||ledger.code!=='STOPPED_RECEIVER_HANDOFF_AND_WINDOWS_ORIGIN_VERIFIED'
   ||!Number.isSafeInteger(ledger.receiverPid)||ledger.receiverPid<=0
   ||installed?.sourceSha!==targetSha)
   code('HANDOFF_PASS_RUNTIME_READBACK_MISMATCH');
 return true;
}
function readHandoffApproval(issue){
 let body;
 try{body=JSON.parse(issue.body??'');}
 catch{code('HANDOFF_REQUEST_CONTRACT_INVALID');}
 if(!strictKeys(body,['schema','requestId','operation','targetSha','approvalManifestSha256'])
   ||!sha40.test(body.targetSha??''))code('HANDOFF_REQUEST_CONTRACT_INVALID');
 const approvalFile=path.join(sourceRoot,'approvals/maintenance-handoffs',body.targetSha+'.json');
 const metadata=fs.lstatSync(approvalFile);
 if(!metadata.isFile()||metadata.isSymbolicLink()||metadata.nlink!==1||metadata.size>16000)
   code('HANDOFF_APPROVAL_PATH_INVALID');
 const approvalBytes=fs.readFileSync(approvalFile);
 return {body,approval:JSON.parse(approvalBytes.toString('utf8')),
   rawDigest:sha(approvalBytes)};
}
function prepareHandoff(issue){
 const {body,approval,rawDigest}=readHandoffApproval(issue);
 const installed=read(path.join(maintenance,'MAINTENANCE_INSTALL.json'));
 const admitted=validateHandoffIntent(issue,body,approval,installed,rawDigest);
 if(git(['branch','--show-current']).trim()!=='main')
   code('HANDOFF_OPERATOR_SOURCE_BRANCH');
 try{git(['merge-base','--is-ancestor',admitted.targetSha,'HEAD']);}
 catch{code('HANDOFF_OPERATOR_SOURCE_NOT_ANCESTOR');}
 const script=path.join(sourceRoot,'tools/handoff-maintenance.mjs');
 if(sha(fs.readFileSync(script))!==approval.files?.['tools/handoff-maintenance.mjs'])
   code('HANDOFF_OPERATOR_SCRIPT_HASH_MISMATCH');
 if(fs.existsSync(path.join(maintenance,'leases/controller-install')))
   code('HANDOFF_OPERATOR_INSTALL_LEASE_BUSY');
 return {admitted,script};
}
function postHandoffReceipt(issueNumber,receipt){
 const marker='zgmini-handoff-once:'+receipt.requestId;
 // A lost acknowledgement is reconciled before posting; never re-execute.
 const prior=JSON.parse(ghRead(['issue','view',String(issueNumber),'--repo',repo,'--json','comments']));
 if(prior.comments?.some(c=>String(c.body??'').includes(marker)))return;
 const body=['<!-- '+marker+' -->',
   'ZGMINI independent Windows handoff result',
   'requestId='+receipt.requestId,
   'targetSha='+receipt.targetSha,
   'status='+receipt.status,
   'code='+safeCode(receipt.code)].join('\n');
 ghRead(['issue','comment',String(issueNumber),'--repo',repo,'--body',body]);
}
export async function main(){
 const installed=read(path.join(home,'INSTALL.json'));
 if(sha(fs.readFileSync(new URL(import.meta.url)))!==installed.sha256)throw Error('WATCHDOG_SOURCE_DRIFT');
 fs.mkdirSync(home,{recursive:true});
 const lease=path.join(home,'receiver');
 if(fs.existsSync(lease)){
  const prior=read(path.join(lease,'owner.json'));
  if(alive(prior.pid)!==false){process.exitCode=10;return;}
  archiveDeadLease(lease);
 }
 fs.mkdirSync(lease);
 const nonce=randomUUID();
 write(path.join(lease,'owner.json'),{pid:process.pid,nonce,at:new Date().toISOString()});
 let history=fs.existsSync(path.join(home,'RESTART_HISTORY.json'))?read(path.join(home,'RESTART_HISTORY.json')):[];
 let healthySince=null;
 const status=(state,extra={})=>write(path.join(home,'STATUS.json'),{at:new Date().toISOString(),pid:process.pid,state,...extra});
 async function tick(){
  try{
   const ownerFile=path.join(control,'leases/supervisor/owner.json');
   const owner=fs.existsSync(ownerFile)?read(ownerFile):null;
   const hb=fs.existsSync(path.join(control,'SUPERVISOR_STATUS.json'))?read(path.join(control,'SUPERVISOR_STATUS.json')):null;
   const paused=fs.existsSync(path.join(home,'PAUSE'))||fs.existsSync(path.join(control,'DRAIN'))
    ||fs.existsSync(path.join(maintenance,'leases/controller-install'))
    ||fs.readdirSync(path.join(control,'leases')).some(x=>x!=='supervisor'&&!x.startsWith('supervisor.dead-'));
   const state=decide({paused,owner,live:owner?alive(owner.pid):false,heartbeat:hb?.pid===owner?.pid?hb?.at:null});
   if(state==='HEALTHY'){
    healthySince??=Date.now();
    if(Date.now()-healthySince>600000&&history.length){history=[];write(path.join(home,'RESTART_HISTORY.json'),history);}
    status(state,{supervisorPid:owner.pid,heartbeatAt:hb.at});return;
   }
   healthySince=null;
   if(state!=='RECOVER'){status(state,{supervisorPid:owner?.pid??null,heartbeatAt:hb?.at??null});return;}
   if(!workflowActive()){status('PAUSED_WORKFLOW');return;}
   history=history.filter(x=>Date.now()-x<3600000);
   if(history.length>=3){status('BLOCKED_RESTART_LIMIT');return;}
   const sourceSha=verifyController();
   // Recheck update and owner immediately before recovery; no process is killed.
   if(fs.existsSync(path.join(maintenance,'leases/controller-install'))){status('PAUSED');return;}
   fs.mkdirSync(path.join(home,'archives'),{recursive:true});
   const archived=archiveDeadLease(path.join(control,'leases/supervisor'),alive,path.join(home,'archives','supervisor-'+Date.now()+'-'+randomUUID()));
   history.push(Date.now());write(path.join(home,'RESTART_HISTORY.json'),history);
   const out=fs.openSync(path.join(home,'SUPERVISOR_OUTPUT.log'),'a');
   try{
    const child=spawn(node,[path.join(control,'controller/supervisor.mjs')],{cwd:control,windowsHide:true,detached:true,stdio:['ignore',out,out],env:{...process.env}});
    child.once('error',()=>status('BLOCKED_SPAWN_ERROR'));
    child.unref();status('STARTING',{supervisorPid:child.pid??null,sourceSha,archivedLease:archived});
   }finally{fs.closeSync(out);}
  }catch(e){status('BLOCKED',{code:/^[A-Z_]+$/.test(e.message)?e.message:'WATCHDOG_CHECK_FAILED'});}
 }
 // This optional capability is activated only by a separately verified,
 // approved watchdog install; historical RUNNER_RECOVERY_ONLY installations
 // stay unchanged even if a checkout file is updated.
 let handoffActive=false;
 async function pollHandoff(){
  if(handoffActive||installed.scope!==handoffScope)return;
  if(process.platform!=='win32'||process.env.GITHUB_ACTIONS||process.env.RUNNER_NAME)return;
  handoffActive=true;
  let issueNumber=null,receiptFile=null;
  try{
   // Paused/active Controller transitions are never used as a handoff window.
   if(fs.existsSync(path.join(home,'PAUSE'))||fs.existsSync(path.join(control,'DRAIN'))
     ||fs.existsSync(path.join(maintenance,'leases/controller-install')))return;
   const listed=JSON.parse(ghRead(['issue','list','--repo',repo,'--label','pc-maintenance',
     '--state','open','--limit','1000','--json','number,title']));
   if(!Array.isArray(listed))code('HANDOFF_ISSUE_LIST_INVALID');
   const intents=listed.filter(q=>q?.title===handoffTitle);
   if(!intents.length)return;
   if(intents.length!==1||!Number.isSafeInteger(intents[0].number))
     code('HANDOFF_MULTIPLE_OR_INVALID_INTENTS');
   issueNumber=intents[0].number;
   const issue=JSON.parse(ghRead(['issue','view',String(issueNumber),'--repo',repo,
     '--json','number,title,state,author,labels,body']));
   // Reconcile an existing one-use claim BEFORE the prior-installed-source
   // preflight; that SHA legitimately changes after a successful 7-to-7 handoff.
   // This branch can only re-post a durable receipt, never run the operator.
   const previous=readHandoffApproval(issue);
   const dir=path.join(home,'handoff-attempts');
   receiptFile=path.join(dir,previous.body.requestId+'.json');
   if(fs.existsSync(receiptFile)){
    const receipt=read(receiptFile);
    validateExistingHandoffReceipt(issue,previous.body,previous.approval,
      previous.rawDigest,receipt,issueNumber);
    if(receipt.status==='RUNNING'){
     // After this watchdog process restarted, the old child may still be
     // running. Never retry or assert failure; preserve and report unknown.
     const unknown={...receipt,status:'STATE_UNKNOWN',
       code:'HANDOFF_INTERRUPTED_RECONCILE',at:new Date().toISOString()};
     write(receiptFile,unknown);
     postHandoffReceipt(issueNumber,unknown);
     return;
    }
    if(receipt.status&&receipt.code)postHandoffReceipt(issueNumber,receipt);
    return;
   }
   const plan=prepareHandoff(issue);
   fs.mkdirSync(dir,{recursive:true});
   const initial={schema:'ZGMINI_WATCHDOG_HANDOFF_RECEIPT_V1',
     requestId:plan.admitted.requestId,issueNumber,targetSha:plan.admitted.targetSha,
     status:'RUNNING',at:new Date().toISOString()};
   // Durable single-use claim before the subprocess is launched. Unknown
   // outcomes after a crash are reconciled, NEVER automatically retried.
   fs.writeFileSync(receiptFile,JSON.stringify(initial)+'\n',{flag:'wx',mode:0o600});
   const result=await new Promise(resolve=>{
    const child=spawn(node,[plan.script,'--source-sha',plan.admitted.targetSha],
      {cwd:sourceRoot,windowsHide:true,stdio:['ignore','pipe','pipe']});
    let output='',limit=false;
    child.stdout.on('data',b=>{if(output.length+String(b).length>16384)limit=true;
      else output+=String(b);});
    child.stderr.on('data',()=>{}); // No operator stderr or secrets in GitHub.
    child.on('error',()=>resolve({status:'STATE_UNKNOWN',code:'HANDOFF_SPAWN_UNCERTAIN'}));
    child.on('close',(exitCode,signal)=>{
     if(limit||signal)return resolve({status:'STATE_UNKNOWN',code:'HANDOFF_OUTCOME_UNCERTAIN'});
     try{
      const lines=output.trim().split(/\r?\n/),json=JSON.parse(lines[lines.length-1]);
      if(json.targetSha!==plan.admitted.targetSha||!['PASS','BLOCKED',
          'RECOVERY_REQUIRED','AUTOMATION_BLOCKED'].includes(json.status))
        return resolve({status:'STATE_UNKNOWN',code:'HANDOFF_OUTCOME_UNCERTAIN'});
      if(json.status==='PASS'){
       try{
        verifyHandoffPass({report:json,
         ledger:read(path.join(maintenance,'handoff-'+plan.admitted.targetSha+'.json')),
         installed:read(path.join(maintenance,'MAINTENANCE_INSTALL.json')),
         targetSha:plan.admitted.targetSha,exitCode});
       }catch{return resolve({status:'STATE_UNKNOWN',code:'HANDOFF_PASS_RUNTIME_READBACK_MISMATCH'});}
      }
      return resolve({status:json.status,code:safeCode(json.code??'HANDOFF_UNKNOWN')});
     }catch{return resolve({status:'STATE_UNKNOWN',code:'HANDOFF_OUTCOME_UNCERTAIN'});}
    });
   });
   const receipt={...initial,...result,at:new Date().toISOString()};
   write(receiptFile,receipt);
   postHandoffReceipt(issueNumber,receipt);
  }catch(error){
   const c=safeCode(error?.code??error?.message);
   write(path.join(home,'HANDOFF_STATUS.json'),{at:new Date().toISOString(),
     status:'BLOCKED',code:c,issueNumber});
  }finally{handoffActive=false;}
 }
 await tick();setInterval(tick,15000);
 void pollHandoff();setInterval(()=>{void pollHandoff();},60000);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(()=>{process.exitCode=1;});

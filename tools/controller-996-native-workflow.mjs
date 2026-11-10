// #996 low-level original Workflow once-only gateway. NO CLI entrypoint.
// The authenticated C operator must verify original Windows evidence, owner
// consent and protected state BEFORE calling prepareEnableIntent().
// This module cannot authorize recovery by itself.
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';

const GH='C:/Program Files/GitHub CLI/gh.exe';
const REPO='ansqhd5774-Choi/zgmini-pc-control';
const WORKFLOW=`repos/${REPO}/actions/workflows/pc-job.yml`;
const need=(ok,code)=>{if(!ok)throw Object.assign(Error(code),{code});};
function githubWorkflowApi(method){
 need(process.platform==='win32'&&!process.env.GITHUB_ACTIONS&&
  !process.env.RUNNER_NAME&&
  fs.existsSync('E:/ZGmini/automation/pc-maintenance/MAINTENANCE_INSTALL.json'),
  'C_ORIGINAL_WINDOWS_PC_REQUIRED');
 const args=['api'];
 if(method==='PUT')args.push('-X','PUT');
 args.push(method==='PUT'?`${WORKFLOW}/enable`:WORKFLOW);
 const raw=execFileSync(GH,args,{encoding:'utf8',windowsHide:true,
  timeout:30000,maxBuffer:1000000});
 return method==='PUT'?true:JSON.parse(raw);
}

export function create996NativeWorkflowGateway({claimStore,
 readWorkflow=()=>githubWorkflowApi('GET'),
 enableApi=()=>githubWorkflowApi('PUT')}={}){
 need(claimStore&&typeof claimStore.ownClaimReadback==='function'&&
  typeof claimStore.hasMarker==='function'&&
  typeof claimStore.recordOnce==='function'&&
  typeof readWorkflow==='function'&&typeof enableApi==='function',
  'C_WORKFLOW_GATEWAY_PORT_INVALID');
 let intentTicket=null,putAttempted=false;
 const status=()=>{
  const observed=readWorkflow();
  need(observed&&typeof observed==='object'&&
   ['active','disabled_manually'].includes(observed.state),
   'C_WORKFLOW_STATE_UNKNOWN');
  return observed.state;
 };
 return Object.freeze({
  readState:status,
  // Exclusive durable intent is created BEFORE any PUT. The ticket exists
  // only in this process; a restarted gateway CANNOT reissue the PUT from
  // a pre-existing marker. Unknown intent is a manual reconciliation stop.
  prepareEnableIntent(){
   const owner=claimStore.ownClaimReadback();
   need(claimStore.hasMarker('PREPARED'),'C_PREPARED_RECORD_REQUIRED');
   need(!claimStore.hasMarker('WORKFLOW_ENABLE_ATTEMPTED')&&!intentTicket,
    'C_WORKFLOW_ENABLE_INTENT_ALREADY_EXISTS');
   need(status()==='disabled_manually','C_WORKFLOW_NOT_DISABLED_BEFORE_INTENT');
   claimStore.recordOnce('WORKFLOW_ENABLE_ATTEMPTED',{
    action:'ENABLE_EXISTING_PC_JOB_WORKFLOW_ONCE',
    requestId:owner.requestId,nonce:owner.nonce,
    workflow:WORKFLOW,priorState:'disabled_manually'});
   const ticket=Object.freeze({});intentTicket=ticket;
   return ticket;
  },
  enableOnce(ticket){
   need(ticket&&ticket===intentTicket&&!putAttempted&&
    claimStore.hasMarker('WORKFLOW_ENABLE_ATTEMPTED'),
    'C_WORKFLOW_ENABLE_TICKET_INVALID_OR_USED');
   // Count attempts, not ACKs. If PUT threw/timeouts or process dies, both
   // the durable marker and the in-memory spent ticket bar a second PUT.
   putAttempted=true;
   try{need(enableApi()===true,'C_WORKFLOW_ENABLE_ACK_UNKNOWN');}
   catch{throw Object.assign(Error('C_WORKFLOW_ENABLE_OUTCOME_UNKNOWN'),
    {code:'C_WORKFLOW_ENABLE_OUTCOME_UNKNOWN'});}
   return true;
  },
  verifyActiveReadback(){
   claimStore.ownClaimReadback();
   need(claimStore.hasMarker('WORKFLOW_ENABLE_ATTEMPTED'),
    'C_WORKFLOW_ENABLE_INTENT_MISSING');
   need(status()==='active','C_WORKFLOW_NOT_ACTIVE_AFTER_ENABLE');
   return true;
  },
 });
}

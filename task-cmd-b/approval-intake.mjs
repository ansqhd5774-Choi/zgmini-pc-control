// R47 Task CMD one-file B: authenticate exact owner Issue and raw approval bytes.
// Pure source contract. No network, runner, shell, Task or operating-file I/O.
import {createHash} from 'node:crypto';
import {validateR47CmdBManifest,R47_CMD_B} from './r47-onefile-cas.mjs';
export const R47_B_ISSUE=Object.freeze({
 repository:'ansqhd5774-Choi/zgmini-pc-control',
 actor:'ansqhd5774-Choi',title:'pc-r47-cmd-onefile-install',
 label:'pc-writer-b-install',operation:'pc-r47-cmd-onefile-install',
 requestSchema:'ZGMINI_TASK_CMD_ONEFILE_B_REQUEST_V1',
 approvalRoot:'approvals/task-cmd-b/'
});
const SHA40=/^[a-f0-9]{40}$/;
const SHA64=/^[a-f0-9]{64}$/;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const APPROVAL=/^approvals\/task-cmd-b\/[a-z0-9][a-z0-9._-]{0,90}\.json$/;
const KEYS=['schema','requestId','chatId','operation','controlRepository',
 'approvalManifestPath','approvalManifestSha256'];
const sealed=new WeakSet();
const stop=code=>{throw Object.assign(new Error(code),{code});};
const requireOk=(ok,code)=>{if(!ok)stop(code);};
const exact=(v,keys)=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&
 Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
export const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
export function approveExactR47B({event,env,manifestBytes,controlSha}){
 const e=R47_B_ISSUE,issue=event?.issue;
 requireOk(env?.GITHUB_REPOSITORY===e.repository&&env.GITHUB_EVENT_NAME==='issues'&&
  env.GITHUB_EVENT_ACTION==='opened'&&env.GITHUB_ACTOR===e.actor&&
  env.GITHUB_RUN_ATTEMPT==='1'&&SHA40.test(env.GITHUB_SHA??'')&&
  controlSha===env.GITHUB_SHA&&
  event?.repository?.full_name===e.repository&&event.repository.private===true&&
  event?.sender?.login===e.actor&&issue?.user?.login===e.actor&&
  !issue.pull_request&&Number.isSafeInteger(issue.number)&&issue.number>0&&
  issue.title===e.title&&issue.labels?.some(x=>x.name===e.label),
  'TASK_CMD_B_ISSUE_AUTH_STOP');
 let request;
 try{request=JSON.parse(issue.body)}catch{stop('TASK_CMD_B_ISSUE_JSON_STOP')}
 requireOk(exact(request,KEYS)&&request.schema===e.requestSchema&&
  request.operation===e.operation&&request.controlRepository===e.repository&&
  UUID.test(request.requestId??'')&&UUID.test(request.chatId??'')&&
  APPROVAL.test(request.approvalManifestPath??'')&&
  SHA64.test(request.approvalManifestSha256??''),
  'TASK_CMD_B_REQUEST_SCOPE_STOP');
 requireOk(Buffer.isBuffer(manifestBytes)&&manifestBytes.length>200&&
  manifestBytes.length<=16384&&digest(manifestBytes)===request.approvalManifestSha256,
  'TASK_CMD_B_APPROVAL_BYTES_STOP');
 let manifest;
 try{manifest=JSON.parse(manifestBytes.toString('utf8'))}
 catch{stop('TASK_CMD_B_APPROVAL_JSON_STOP')}
 validateR47CmdBManifest(manifest);
 requireOk(manifest.requestId===request.requestId&&
  manifest.sourceRepository===R47_CMD_B.sourceRepository,
  'TASK_CMD_B_APPROVAL_REQUEST_ID_STOP');
 Object.freeze(manifest);
 const auth=Object.freeze({requestId:request.requestId,
  chatId:request.chatId,issueNumber:issue.number,
  controlSha,manifestPath:request.approvalManifestPath,
  manifestSha256:request.approvalManifestSha256,manifest});
 sealed.add(auth);
 return auth;
}
export function assertApprovedR47B(auth){
 requireOk(auth!==null&&typeof auth==='object'&&sealed.has(auth),
  'TASK_CMD_B_APPROVAL_NOT_AUTHENTICATED_STOP');
 return auth;
}

// A single, owner-opened, fixed-scope SIP Writer B request. No PC I/O.
import {createHash} from 'node:crypto';

const REPO='ansqhd5774-Choi/zgmini-pc-control';
const OWNER='ansqhd5774-Choi';
const CANDIDATE='b30aefd89793de093369044a14d86c1fdc3b0d61';
const SHA40=/^[a-f0-9]{40}$/;
const SHA64=/^[a-f0-9]{64}$/;
const UUID='[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}';
const REQUEST_ID=new RegExp(`^pc-r17-${UUID}$`);
const CHAT_ID=new RegExp(`^chat-${UUID}$`);
const FIELDS=['schema','requestId','chatId','operation','controlRepository',
  'candidateSourceSha','approvalManifestSha256'];
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exactKeys=(o,fields)=>object(o)&&Object.keys(o).length===fields.length&&
  fields.every(key=>Object.hasOwn(o,key));
export const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
export class SipBAuthStop extends Error{
  constructor(code){super(code);this.code=code;}
}
const requireThat=(ok,code)=>{if(!ok)throw new SipBAuthStop(code);};

export function authorizeSipInstall({event,env,manifestBytes}){
  requireThat(env?.GITHUB_REPOSITORY===REPO&&env?.GITHUB_EVENT_NAME==='issues'&&
    env?.GITHUB_EVENT_ACTION==='opened'&&env?.GITHUB_ACTOR===OWNER&&
    env?.GITHUB_RUN_ATTEMPT==='1'&&/^[0-9]{1,18}$/.test(env?.GITHUB_RUN_ID??'')&&
    /^zgmini-pc-0[1-6]$/.test(env?.RUNNER_NAME??'')&&
    SHA40.test(env?.R17_SIP_CONTROL_SHA??'')&&
    env?.R17_SIP_CONTROL_SHA===env?.GITHUB_SHA,
    'SIP_B_EVENT_CONTEXT_STOP');
  const issue=event?.issue;
  requireThat(event?.action==='opened'&&event?.repository?.private===true&&
    event?.repository?.full_name===REPO&&event?.sender?.login===OWNER&&
    issue?.user?.login===OWNER&&!issue?.pull_request&&
    issue?.title==='pc-r17-sip-threefile-install'&&
    issue?.labels?.some(x=>x?.name==='pc-r17-writer-b-install')&&
    Number.isSafeInteger(issue?.number)&&issue.number>0&&
    typeof issue?.body==='string'&&Buffer.byteLength(issue.body,'utf8')<=4096,
    'SIP_B_ISSUE_AUTHORIZATION_STOP');
  let request;
  try{request=JSON.parse(issue.body);}catch{throw new SipBAuthStop('SIP_B_REQUEST_JSON_STOP');}
  requireThat(exactKeys(request,FIELDS)&&
    request.schema==='ZGMINI_R17_SIP_B_INSTALL_REQUEST_V1'&&
    REQUEST_ID.test(request.requestId)&&CHAT_ID.test(request.chatId)&&
    request.operation==='r17-sip-threefile-install-once'&&
    request.controlRepository===REPO&&request.candidateSourceSha===CANDIDATE&&
    SHA64.test(request.approvalManifestSha256),
    'SIP_B_REQUEST_SCOPE_STOP');
  requireThat(Buffer.isBuffer(manifestBytes)&&manifestBytes.length>=200&&
    manifestBytes.length<=16_384&&digest(manifestBytes)===request.approvalManifestSha256,
    'SIP_B_MANIFEST_DIGEST_STOP');
  return Object.freeze({...request,manifestSha256:request.approvalManifestSha256,
    registeredB:true,exactOneShot:true});
}

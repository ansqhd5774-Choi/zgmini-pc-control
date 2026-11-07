// One-shot, exact-two-flag providers.env B approval. No arbitrary keys or paths.
import {createHash} from 'node:crypto';

export const CONTROL_REPO='ansqhd5774-Choi/zgmini-pc-control';
export const ACTOR='ansqhd5774-Choi';
export const ISSUE_TITLE='pc-writer-provider-flags-once';
// Reuse the already registered B label; issue title + schema isolate this route.
export const ISSUE_LABEL='pc-writer-b-install';
export const OPERATION='pc-writer-provider-flags-once';
export const REQUEST_SCHEMA='ZGMINI_WRITER_PROVIDER_FLAGS_B_REQUEST_V1';
export const APPROVAL_SCHEMA='ZGMINI_WRITER_PROVIDER_FLAGS_B_APPROVAL_V1';
export const RESULT_SCHEMA='ZGMINI_WRITER_PROVIDER_FLAGS_B_RESULT_V1';
export const SCOPE='INFLATION19_EXACT_TWO_PROVIDER_FLAGS_ONLY';
export const CANDIDATE_SCOPE='INFLATION_CANDIDATES_EXACT_TWO_PROVIDER_FLAGS_ONLY';
export const FILE=String.raw`E:\ZGmini\data\pc-writer\providers.env`;
export const FLAGS=Object.freeze([
  'ZGMINI_INFL19_RECURRING_APPROVED',
  'ZGMINI_INFL19_GAS_DAILY_APPROVED',
]);
export const CANDIDATE_FLAGS=Object.freeze([
  'ZGMINI_INFLATION_CANDIDATE_CORE_APPROVED',
  'ZGMINI_INFLATION_CANDIDATE_BOOTSTRAP_APPROVED',
]);
const PROFILES=Object.freeze({
  [SCOPE]:FLAGS,
  [CANDIDATE_SCOPE]:CANDIDATE_FLAGS,
});

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA=/^[a-f0-9]{64}$/i;
const SHA40=/^[a-f0-9]{40}$/i;
const PATH=/^approvals\/writer-config\/(?:inflation19-flags|inflation-candidate-flags)-[a-z0-9-]{4,70}\.json$/;
export const isAllowedManifestPath=path=>typeof path==='string'&&PATH.test(path);
export const flagProfileForPath=path=>{
  if(!isAllowedManifestPath(path))return null;
  return path.startsWith('approvals/writer-config/inflation19-flags-')?
    {scope:SCOPE,flags:FLAGS}:{scope:CANDIDATE_SCOPE,flags:CANDIDATE_FLAGS};
};
export const flagsForScope=scope=>Object.hasOwn(PROFILES,scope)?PROFILES[scope]:null;
const REQUEST_KEYS=['schema','requestId','chatId','operation','controlRepository','approvalManifestPath','approvalManifestSha256'];
const APPROVAL_KEYS=['schema','status','scope','targetPath','changes','runCount','allowOtherChanges','allowProviderCalls','allowTaskChanges','allowSourceChanges','allowDbWrites'];
const CHANGE_KEYS=['key','value'];
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(x,keys)=>object(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
const stop=code=>{throw Object.assign(new Error(code),{code});};
const need=(ok,code)=>{if(!ok)stop(code);};
export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');

export function verifyApproval(manifest,{approvalManifestPath=null}={}){
  need(exact(manifest,APPROVAL_KEYS),'PROVIDER_B_MANIFEST_FIELDS_STOP');
  const flags=flagsForScope(manifest.scope);
  // Unspecified path retains the historical INFL19-only contract.
  const selected=approvalManifestPath===null?{scope:SCOPE,flags:FLAGS}:
    flagProfileForPath(approvalManifestPath);
  need(flags&&selected!==null&&selected.scope===manifest.scope&&selected.flags===flags,
    'PROVIDER_B_MANIFEST_PROFILE_STOP');
  need(manifest.schema===APPROVAL_SCHEMA&&manifest.status==='APPROVED_B'&&
    manifest.targetPath===FILE&&manifest.runCount===1&&
    ['allowOtherChanges','allowProviderCalls','allowTaskChanges','allowSourceChanges','allowDbWrites'].every(k=>manifest[k]===false),
    'PROVIDER_B_MANIFEST_SCOPE_STOP');
  need(Array.isArray(manifest.changes)&&manifest.changes.length===2&&
    manifest.changes.every((v,i)=>exact(v,CHANGE_KEYS)&&v.key===flags[i]&&v.value==='1'),
    'PROVIDER_B_CHANGE_SCOPE_STOP');
  return manifest;
}

export function issueRequest(event){
  let req;
  try{req=JSON.parse(event?.issue?.body);}catch{stop('PROVIDER_B_REQUEST_JSON_STOP');}
  need(exact(req,REQUEST_KEYS)&&req.schema===REQUEST_SCHEMA&&
    UUID.test(req.requestId)&&UUID.test(req.chatId)&&
    req.operation===OPERATION&&req.controlRepository===CONTROL_REPO&&
    PATH.test(req.approvalManifestPath)&&SHA.test(req.approvalManifestSha256),
    'PROVIDER_B_REQUEST_SCOPE_STOP');
  return req;
}

export function verifyEvent(event,env){
  need(env?.GITHUB_REPOSITORY===CONTROL_REPO&&
    env.GITHUB_EVENT_NAME==='issues'&&env.GITHUB_EVENT_ACTION==='opened'&&
    env.GITHUB_ACTOR===ACTOR&&env.GITHUB_RUN_ATTEMPT==='1'&&
    SHA40.test(env.GITHUB_SHA??'')&&event?.repository?.full_name===CONTROL_REPO&&
    event.repository.private===true&&event?.sender?.login===ACTOR&&
    event?.issue?.user?.login===ACTOR&&!event.issue.pull_request&&
    event.issue.title===ISSUE_TITLE&&
    event.issue.labels?.some(x=>x.name===ISSUE_LABEL)&&
    Number.isSafeInteger(event.issue.number)&&event.issue.number>0,
    'PROVIDER_B_EVENT_AUTH_STOP');
  return issueRequest(event);
}

export function authorize({event,env,manifestBytes}){
  const request=verifyEvent(event,env);
  need(Buffer.isBuffer(manifestBytes)&&manifestBytes.length>=200&&
    manifestBytes.length<=4096&&sha256(manifestBytes)===request.approvalManifestSha256,
    'PROVIDER_B_MANIFEST_HASH_STOP');
  let manifest;
  try{manifest=JSON.parse(manifestBytes.toString('utf8'));}
  catch{stop('PROVIDER_B_MANIFEST_JSON_STOP');}
  verifyApproval(manifest,{approvalManifestPath:request.approvalManifestPath});
  return {request,manifest,issueNumber:event.issue.number,controlSha:env.GITHUB_SHA};
}


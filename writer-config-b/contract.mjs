// Scoped, single-use authorization prototype for Writer config.json opt-in B.
// Nothing in this module writes files or executes commands.
import {createHash} from 'node:crypto';
import {EMPLOYMENT_R6_PREIMAGE_FILES} from '../controller/writer-install-preimage-readonly.mjs';

export const CONTROL_REPOSITORY='ansqhd5774-Choi/zgmini-pc-control';
export const ACTOR='ansqhd5774-Choi';
export const TITLE='pc-writer-config-b-once';
export const LABEL='pc-writer-b-install';
export const OPERATION='pc-writer-config-b-once';
export const REQUEST_SCHEMA='ZGMINI_WRITER_CONFIG_B_REQUEST_V1';
export const APPROVAL_SCHEMA='ZGMINI_WRITER_CONFIG_B_APPROVAL_V1';
export const SCOPE='EMPLOYMENT_R6_TWO_OPTIN_BOOLEAN_ONLY';
export const TARGET=String.raw`E:\ZGmini\data\pc-writer\config.json`;
export const SOURCE_ROOT=String.raw`E:\ZGmini\projects\zgmini-earnings-history-pc-release`;
export const MANIFEST_PREFIX='approvals/writer-config/employment-r6-optins-';
export const REQUEST_KEYS=Object.freeze([
  'schema','requestId','chatId','operation','controlRepository',
  'approvalManifestPath','approvalManifestSha256',
]);
export const APPROVAL_KEYS=Object.freeze([
  'schema','status','scope','targetPath','beforeSha256','changes','runCount',
  'allowOtherChanges','allowProviderCalls','allowTaskChanges',
  'allowSourceChanges','allowDbWrites','verifiedR6Install','installedFiles',
]);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256=/^[a-f0-9]{64}$/;
const SHA40=/^[a-f0-9]{40}$/;
const manifestPath=/^approvals\/writer-config\/employment-r6-optins-[a-z0-9-]{4,70}\.json$/;
export const isApprovedManifestPath=value=>typeof value==='string'&&manifestPath.test(value);
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const exact=(o,keys)=>object(o)&&Object.keys(o).length===keys.length&&
  keys.every(key=>Object.hasOwn(o,key));
const stop=code=>{throw Object.assign(new Error(code),{code});};
const need=(ok,code)=>{if(!ok)stop(code);};
export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');

export function authorizeManifest(value){
  need(exact(value,APPROVAL_KEYS),'CONFIG_B_MANIFEST_FIELDS_STOP');
  need(value.schema===APPROVAL_SCHEMA&&value.status==='APPROVED_B'&&
    value.scope===SCOPE&&value.targetPath===TARGET&&
    SHA256.test(value.beforeSha256)&&value.runCount===1&&
    ['allowOtherChanges','allowProviderCalls','allowTaskChanges',
      'allowSourceChanges','allowDbWrites'].every(key=>value[key]===false),
  'CONFIG_B_MANIFEST_SCOPE_STOP');
  need(Array.isArray(value.changes)&&value.changes.length===2&&
    exact(value.changes[0],['key','value'])&&
    value.changes[0].key==='employmentR6AutoCollection'&&
    value.changes[0].value===true&&
    exact(value.changes[1],['key','value'])&&
    value.changes[1].key==='employmentR6OneYearAutoPublication'&&
    value.changes[1].value===true,'CONFIG_B_CHANGE_SCOPE_STOP');
  const install=value.verifiedR6Install;
  need(exact(install,['requestId','manifestSha256','sourceSha','issueNumber','status'])&&
    UUID.test(install.requestId)&&SHA256.test(install.manifestSha256)&&
    SHA40.test(install.sourceSha)&&Number.isSafeInteger(install.issueNumber)&&
    install.issueNumber>0&&install.status==='WRITER_B_INSTALLED_VERIFIED',
  'CONFIG_B_INSTALL_PROVENANCE_STOP');
  need(Array.isArray(value.installedFiles)&&
    value.installedFiles.length===EMPLOYMENT_R6_PREIMAGE_FILES.length&&
    value.installedFiles.every((item,i)=>exact(item,['path','afterSha256'])&&
      item.path===EMPLOYMENT_R6_PREIMAGE_FILES[i]&&
      SHA256.test(item.afterSha256)),
  'CONFIG_B_INSTALLED_FILES_SCOPE_STOP');
  return value;
}

export function authorizeRequest(event){
  const req=event?.issue?.body;
  let data;
  try{data=JSON.parse(req);}catch{stop('CONFIG_B_REQUEST_JSON_STOP');}
  need(exact(data,REQUEST_KEYS)&&data.schema===REQUEST_SCHEMA&&
    UUID.test(data.requestId)&&UUID.test(data.chatId)&&
    data.operation===OPERATION&&data.controlRepository===CONTROL_REPOSITORY&&
    isApprovedManifestPath(data.approvalManifestPath)&&
    SHA256.test(data.approvalManifestSha256),
  'CONFIG_B_REQUEST_SCOPE_STOP');
  return data;
}

export function authorize({event,env,manifestBytes}){
  need(env?.GITHUB_REPOSITORY===CONTROL_REPOSITORY&&
    env.GITHUB_EVENT_NAME==='issues'&&
    env.GITHUB_EVENT_ACTION==='opened'&&
    env.GITHUB_ACTOR===ACTOR&&env.GITHUB_RUN_ATTEMPT==='1'&&
    SHA40.test(env.GITHUB_SHA??'')&&
    event?.repository?.full_name===CONTROL_REPOSITORY&&
    event.repository.private===true&&event?.sender?.login===ACTOR&&
    event?.issue?.user?.login===ACTOR&&!event.issue.pull_request&&
    event.issue.title===TITLE&&
    event.issue.labels?.some(x=>x.name===LABEL)&&
    Number.isSafeInteger(event.issue.number)&&event.issue.number>0,
  'CONFIG_B_EVENT_AUTH_STOP');
  const request=authorizeRequest(event);
  need(Buffer.isBuffer(manifestBytes)&&manifestBytes.length>=200&&
    manifestBytes.length<=8192&&
    sha256(manifestBytes)===request.approvalManifestSha256,
  'CONFIG_B_MANIFEST_HASH_STOP');
  let manifest;
  try{manifest=JSON.parse(manifestBytes.toString('utf8'));}
  catch{stop('CONFIG_B_MANIFEST_JSON_STOP');}
  authorizeManifest(manifest);
  return {request,manifest,issueNumber:event.issue.number,controlSha:env.GITHUB_SHA};
}

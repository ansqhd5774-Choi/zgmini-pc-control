// Shared, side-effect-free approval/read-only Git pin contract.
// Keep this module independent from every effect runner and dispatcher.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {BEA_B_SCHEMA,BEA_B_MODE,isApprovedBeaNativeSource}
  from './bea-native-source-once.mjs';

// Schema tokens are fixed here so the configured-runtime B route does not
// require unrelated PIN/BUNDLE implementation modules at process startup.
// Their actual effect code is imported only when that effect is authorized.
const PIN_CAS_SCHEMA='ZGMINI_PC_RUNTIME_PIN_AND_REGISTRY_CAS_B_V1';
const PIN_CAS_SCOPE='HOST_RUNTIME_PIN_AND_REGISTRY_BYTE_CAS_ONLY';
const BUNDLE_SCHEMA='ZGMINI_PC_VERSIONED_BUNDLE_APPROVAL_V1';
const BUNDLE_SCOPE='PC_WRITER_APPROVED_VERSIONED_BUNDLE_ACTIVATION_ONLY';

const REPO='ansqhd5774-Choi/zgmini-pc-control';
const ACTOR='ansqhd5774-Choi';
const TITLE='pc-approved-runtime-b';
const LABEL='pc-writer-b-install';
const OPERATION='pc-approved-runtime-b';
const SCHEMA='ZGMINI_PC_APPROVED_RUNTIME_B_ACTIONS_REQUEST_V1';
const SHA40=/^[a-f0-9]{40}$/;
const SHA64=/^[a-f0-9]{64}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const sha=b=>createHash('sha256').update(b).digest('hex');
const fail=code=>{throw Object.assign(Error(code),{code});};
const need=(ok,code)=>{if(!ok)fail(code);};
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const exact=(v,keys)=>object(v)&&Object.keys(v).length===keys.length&&
  keys.every(x=>Object.hasOwn(v,x));
const REQUEST_KEYS=['schema','requestId','chatId','operation','controlRepository',
  'approvalManifestSha256'];
export const CONFIGURED_B_SCHEMA='ZGMINI_CONFIGURED_RUNTIME_B_APPROVAL_V1';
export const CONFIGURED_B_SCOPE='PC_WRITER_CONFIGURED_THEME_REPEAT_UPGRADE_ONLY';
const CONFIGURED_B_EFFECT='CONFIGURED_THEMES_REPEAT_UPGRADE';
const CONFIGURED_B_KEYS=['schema','status','scope','sourceRepository',
  'sourceSha','profileId','runnerPath','packageManifestSha256','runtimeMode',
  'runtimePreimage','effects'];
const CONFIGURED_B_PREIMAGE=['activeRuntimeSha256','taskXmlSha256',
  'scheduledCmdSha256','scheduledVbsSha256'];
const CONFIGURED_B_SIDE_EFFECTS=['providerCalls','dbWrites','d1Writes',
  'taskDefinitionChanges','newTasks','otherOperationalFiles'];

export function isApprovedConfiguredRuntime(m){
  return exact(m,CONFIGURED_B_KEYS)&&
    m.schema===CONFIGURED_B_SCHEMA&&m.status==='APPROVED_B'&&
    m.scope===CONFIGURED_B_SCOPE&&
    m.sourceRepository==='ansqhd5774-Choi/zgmini'&&
    SHA40.test(m.sourceSha??'')&&
    m.profileId==='configured-themes'&&
    m.runnerPath==='scripts/pc-writer/theme-config-package-runner.mjs'&&
    SHA64.test(m.packageManifestSha256??'')&&
    m.runtimeMode==='REPEATABLE_ACTIVE_RUNTIME'&&
    exact(m.runtimePreimage,CONFIGURED_B_PREIMAGE)&&
    Object.values(m.runtimePreimage).every(x=>SHA64.test(x??''))&&
    exact(m.effects,CONFIGURED_B_SIDE_EFFECTS)&&
    Object.values(m.effects).every(x=>x===false);
}

export const DIRECT_B_RESULT='approved-runtime-b-once-result.json';
export const DIRECT_B_TITLE=TITLE;
export const DIRECT_B_OPERATION=OPERATION;
export const DIRECT_B_REQUEST_SCHEMA=SCHEMA;

export function verifyOpenedOwnerIssue(event,env){
  need(env?.GITHUB_REPOSITORY===REPO&&env.GITHUB_EVENT_NAME==='issues'&&
    env.GITHUB_EVENT_ACTION==='opened'&&env.GITHUB_ACTOR===ACTOR&&
    env.GITHUB_RUN_ATTEMPT==='1'&&SHA40.test(env.GITHUB_SHA??'')&&
    event?.repository?.full_name===REPO&&event.repository.private===true&&
    event?.sender?.login===ACTOR&&event?.issue?.user?.login===ACTOR&&
    !event.issue.pull_request&&event.issue.title===TITLE&&
    event.issue.labels?.some(x=>x.name===LABEL)&&
    Number.isSafeInteger(event.issue.number)&&event.issue.number>0,
    'DIRECT_B_ISSUE_OWNER_STOP');
  let request;
  try{request=JSON.parse(event.issue.body);}catch{fail('DIRECT_B_ISSUE_JSON_STOP');}
  need(exact(request,REQUEST_KEYS)&&request.schema===SCHEMA&&
    UUID.test(request.requestId??'')&&UUID.test(request.chatId??'')&&
    request.operation===OPERATION&&request.controlRepository===REPO&&
    SHA64.test(request.approvalManifestSha256??''),
    'DIRECT_B_REQUEST_SCOPE_STOP');
  return request;
}

export function approvalPathFor(request){
  need(SHA64.test(request?.approvalManifestSha256??''),
    'DIRECT_B_APPROVAL_PIN_STOP');
  return `approvals/approved-runtime-b/${request.approvalManifestSha256}.json`;
}

function gitBinary(){
  const found=[String.raw`C:\Program Files\Git\cmd\git.exe`,
    String.raw`C:\Program Files\Git\bin\git.exe`].find(x=>fs.existsSync(x));
  need(found,'DIRECT_B_GIT_MISSING_STOP');return found;
}
function git(root,args,max=300000){
  const r=spawnSync(gitBinary(),['-C',root,...args],{encoding:'buffer',
    shell:false,windowsHide:true,timeout:15000,maxBuffer:max});
  need(r.status===0&&Buffer.isBuffer(r.stdout),'DIRECT_B_GIT_BLOB_STOP');
  return r.stdout;
}
function equalWorktree(worktree,blob){
  if(worktree.equals(blob))return true;
  return !blob.includes(13)&&worktree.equals(Buffer.from(blob.toString('utf8').replace(/\n/g,'\r\n')));
}

// These read hooks are fixed source/OS methods, never supplied by the Issue.
export function authorizeApprovedRaw({event,env,raw,worktree,actualHead}){
  const request=verifyOpenedOwnerIssue(event,env);
  need(actualHead===env.GITHUB_SHA,'DIRECT_B_CONTROL_COMMIT_STOP');
  need(Buffer.isBuffer(raw)&&raw.length>0&&raw.length<=262144&&
    Buffer.isBuffer(worktree)&&equalWorktree(worktree,raw)&&
    sha(raw)===request.approvalManifestSha256,
    'DIRECT_B_APPROVAL_BYTES_STOP');
  let manifest;
  try{manifest=JSON.parse(raw.toString('utf8'));}catch{fail('DIRECT_B_APPROVAL_JSON_STOP');}
  const isPin=manifest?.schema===PIN_CAS_SCHEMA;
  const isBundle=manifest?.schema===BUNDLE_SCHEMA;
  const isConfigured=manifest?.schema===CONFIGURED_B_SCHEMA;
  const isBea=manifest?.schema===BEA_B_SCHEMA;
  need((isPin&&manifest.scope===PIN_CAS_SCOPE&&manifest.status==='APPROVED_B')||
    (isBundle&&manifest.scope===BUNDLE_SCOPE&&manifest.status==='APPROVED')||
    (isConfigured&&isApprovedConfiguredRuntime(manifest))||
    (isBea&&isApprovedBeaNativeSource(manifest)),
    'DIRECT_B_EFFECT_SCOPE_STOP');
  need(SHA40.test(manifest.sourceSha??'')&&
    typeof manifest.profileId==='string'&&manifest.profileId.length>0,
    'DIRECT_B_APPROVED_SOURCE_STOP');
  return Object.freeze({request,manifest,raw,issueNumber:event.issue.number,
    controlSha:env.GITHUB_SHA,approvalPath:approvalPathFor(request),
    mode:isPin?'PIN_REGISTRY_CAS':isConfigured?CONFIGURED_B_EFFECT:
      isBea?BEA_B_MODE:'VERSIONED_BUNDLE_ACTIVATE'});
}

export function loadApprovedRaw({event,env,controlRoot,
  readFile=fs.readFileSync,gitHead=(root)=>git(root,['rev-parse','HEAD'],512).toString('utf8').trim(),
  gitBlob=(root,rel)=>git(root,['show',`HEAD:${rel}`])}={}){
  const request=verifyOpenedOwnerIssue(event,env);
  need(typeof controlRoot==='string'&&path.isAbsolute(controlRoot),
    'DIRECT_B_CONTROL_ROOT_STOP');
  const relative=approvalPathFor(request);
  const file=path.join(controlRoot,...relative.split('/'));
  const worktree=readFile(file);
  const raw=gitBlob(controlRoot,relative);
  return authorizeApprovedRaw({event,env,raw,worktree,
    actualHead:gitHead(controlRoot)});
}

// The approved source SHA must match the actual candidate checkout. The
// workflow chooses this fixed directory after the approval-first preflight;
// the Issue cannot select an alternate path or repository.
export function verifyPinnedSourceCheckout(auth,{sourceRoot,
  gitHead=root=>git(root,['rev-parse','HEAD'],512).toString('utf8').trim()}={}){
  need(typeof sourceRoot==='string'&&path.isAbsolute(sourceRoot)&&
    SHA40.test(auth?.manifest?.sourceSha??'')&&
    auth.manifest.sourceSha===gitHead(sourceRoot),
  'DIRECT_B_CANDIDATE_SOURCE_DRIFT');
  return Object.freeze({sourceSha:auth.manifest.sourceSha,sourceRoot});
}

